// CLI ogrodnika na repo-fixture: galaz glowna ze stanem zastanym, galaz zadania z nowymi wystapieniami (commit + plik
// nieśledzony), rekord poprzedniego pomiaru w pliku telemetrii. Skrypt tylko czyta: drzewo i telemetria bez zmian.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { FIXTURES, commit, git, noweRepo, zapisz } from '../../bramki/__tests__/repo-testowe.mjs'

const CLI = resolve(FIXTURES, '..', '..', '..', 'ogrod', 'ogrod.mjs')

/** @param {string[]} argumenty */
function cli(argumenty) {
  const p = spawnSync(process.execPath, [CLI, ...argumenty], { encoding: 'utf8' })
  return { kod: p.status, wynik: p.stdout ? JSON.parse(p.stdout) : null, stdout: p.stdout, stderr: p.stderr }
}

/** @returns {{ repo: string, telemetria: string }} */
function projekt() {
  const repo = noweRepo()
  git(repo, ['branch', '-M', 'main'])
  zapisz(repo, {
    'src/a.ts': 'export const a: any = 1\n// TODO: zastane\n',
    '.claude/scripts/x.ts': 'const x: any = 1 // eslint-disable-line\n',
    'dist/bundle.js': 'try { x() } catch {}\n',
    'src/typy.d.ts': 'declare const y: any\n',
    'docs/notatka.md': '// TODO w markdownie\n',
  })
  commit(repo, 'stan zastany')
  git(repo, ['checkout', '-q', '-b', 'feature/zadanie'])
  zapisz(repo, {
    'src/b.ts': '// eslint-disable-next-line no-console\nexport const b = (x: any): any => x\n',
    'src/a.ts': 'export const a: any = 1\n// TODO: zastane\ntry { a() } catch {}\n',
  })
  commit(repo, 'zadanie')
  zapisz(repo, { 'src/c.ts': '// FIXME: nowy plik niesledzony\n' })
  const telemetria = join(mkdtempSync(join(tmpdir(), 'ogrod-tel-')), 'pipeline.jsonl')
  const poprzedni = {
    klucz: 'wf_poprzedni|run|wf_poprzedni', typ: 'run', workflow: 'dev-autopilot', projekt: basename(repo), run: 'wf_poprzedni',
    start: '2026-10-01T10:00:00.000Z', ogrod: { liczby: { wyciszenia: 0, any: 1, rzutowania: 0, komentarze: 1, pusty_catch: 0 }, bez_oceny: 2 },
  }
  writeFileSync(telemetria, `${JSON.stringify(poprzedni)}\n`)
  return { repo, telemetria }
}

/** @param {string} repo */
const stanDrzewa = (repo) => git(repo, ['status', '--porcelain', '--untracked-files=all'])

test('pomiar z poprzednim rekordem: liczby projektu, przyrost wzgledem telemetrii, nowe z diffu zadania, tylko odczyt', () => {
  const { repo, telemetria } = projekt()
  try {
    const drzewoPrzed = stanDrzewa(repo)
    const telemetriaPrzed = readFileSync(telemetria, 'utf8')
    const { kod, wynik, stderr } = cli(['pomiar', '--projekt', repo, '--telemetria', telemetria])
    assert.equal(kod, 0, stderr)
    assert.equal(wynik.projekt, basename(repo))
    assert.equal(wynik.plikow, 3, 'src/a.ts, src/b.ts, src/c.ts — bez .claude/, dist/, *.d.ts i .md')
    assert.deepEqual(wynik.liczby, { wyciszenia: 1, any: 3, rzutowania: 0, komentarze: 2, pusty_catch: 1 })
    assert.deepEqual(wynik.poprzedni, { run: 'wf_poprzedni', start: '2026-10-01T10:00:00.000Z', liczby: { wyciszenia: 0, any: 1, rzutowania: 0, komentarze: 1, pusty_catch: 0 } })
    assert.equal(wynik.decyzja.zrodlo, 'telemetria')
    assert.deepEqual(wynik.decyzja.przyrost, { wyciszenia: 1, any: 2, rzutowania: 0, komentarze: 1, pusty_catch: 1 })
    assert.equal(wynik.decyzja.ocena, true)
    assert.equal(wynik.decyzja.bez_oceny, 3)
    assert.equal(wynik.noweRazem, 5)
    assert.deepEqual(wynik.nowe.map((/** @type {{ kategoria: string, plik: string, linia: number }} */ w) => `${w.kategoria} ${w.plik}:${w.linia}`).sort(), [
      'any src/b.ts:2', 'any src/b.ts:2', 'komentarze src/c.ts:1', 'pusty_catch src/a.ts:3', 'wyciszenia src/b.ts:1',
    ])
    assert.deepEqual(wynik.hotspoty, [
      { plik: 'src/a.ts', razem: 3, any: 1, komentarze: 1, pusty_catch: 1 },
      { plik: 'src/b.ts', razem: 3, wyciszenia: 1, any: 2 },
      { plik: 'src/c.ts', razem: 1, komentarze: 1 },
    ], 'malejaco po liczbie, remis alfabetycznie')
    assert.equal(stanDrzewa(repo), drzewoPrzed)
    assert.equal(readFileSync(telemetria, 'utf8'), telemetriaPrzed)
  } finally {
    rmSync(repo, { recursive: true, force: true })
    rmSync(telemetria, { force: true })
  }
})

test('bez pliku telemetrii: pierwszy pomiar, przyrost z linii dodanych przez zadanie', () => {
  const { repo, telemetria } = projekt()
  try {
    const { kod, wynik } = cli(['pomiar', '--projekt', repo, '--telemetria', join(repo, 'brak.jsonl')])
    assert.equal(kod, 0)
    assert.equal(wynik.poprzedni, null)
    assert.equal(wynik.decyzja.zrodlo, 'diff')
    assert.deepEqual(wynik.decyzja.przyrost, { wyciszenia: 1, any: 2, rzutowania: 0, komentarze: 1, pusty_catch: 1 })
    assert.equal(wynik.decyzja.bez_oceny, 1)
  } finally {
    rmSync(repo, { recursive: true, force: true })
    rmSync(telemetria, { force: true })
  }
})

test('repo bez galezi main i master: liczby projektu bez listy nowych', () => {
  const repo = noweRepo()
  try {
    git(repo, ['branch', '-M', 'trunk'])
    zapisz(repo, { 'src/a.ts': 'const a: any = 1\n' })
    commit(repo, 'kod')
    const { kod, wynik } = cli(['pomiar', '--projekt', repo, '--telemetria', join(repo, 'brak.jsonl')])
    assert.equal(kod, 0)
    assert.equal(wynik.liczby.any, 1)
    assert.deepEqual([wynik.noweRazem, wynik.nowe], [0, []])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('realne przypadki brzegowe: niesledzone dowiazanie do katalogu, galaz bez wspolnego przodka, repo bez commitow', () => {
  const { repo, telemetria } = projekt()
  const pusty = mkdtempSync(join(tmpdir(), 'ogrod-pusty-'))
  try {
    mkdirSync(join(repo, 'skille', 'cel'), { recursive: true })
    writeFileSync(join(repo, 'skille', 'cel', 'x.ts'), 'const x: any = 1\n')
    symlinkSync(join(repo, 'skille', 'cel'), join(repo, 'dowiazanie'))
    const zDowiazaniem = cli(['pomiar', '--projekt', repo, '--telemetria', telemetria])
    assert.equal(zDowiazaniem.kod, 0, zDowiazaniem.stdout)
    assert.equal(zDowiazaniem.wynik.noweRazem, 6, 'plik w niesledzonym katalogu liczony, dowiazanie do katalogu pominiete')

    git(repo, ['checkout', '-q', '--orphan', 'sierota'])
    commit(repo, 'bez przodka')
    const sierota = cli(['pomiar', '--projekt', repo, '--telemetria', telemetria])
    assert.equal(sierota.kod, 0)
    assert.deepEqual([sierota.wynik.noweRazem, sierota.wynik.decyzja.zrodlo], [0, 'telemetria'])

    execFileSync('git', ['init', '-q', pusty])
    writeFileSync(join(pusty, 'a.ts'), 'const a: any = 1\n')
    const bezCommitow = cli(['pomiar', '--projekt', pusty, '--telemetria', telemetria])
    assert.equal(bezCommitow.kod, 0)
    assert.deepEqual([bezCommitow.wynik.commit, bezCommitow.wynik.liczby.any], ['', 1])
  } finally {
    rmSync(repo, { recursive: true, force: true })
    rmSync(pusty, { recursive: true, force: true })
    rmSync(telemetria, { force: true })
  }
})

test('krawedzie pomiaru: limit nowych, plik ponad prog bajtow, zmiana w drzewie roboczym, rename, origin/main przed main', () => {
  const { repo, telemetria } = projekt()
  try {
    git(repo, ['mv', 'src/a.ts', 'src/przeniesiony.ts'])
    commit(repo, 'rename pliku z galezi glownej')
    zapisz(repo, {
      'src/b.ts': '// eslint-disable-next-line no-console\nexport const b = (x: any): any => x\nexport const z: any = 2\n',
      'src/wiele.ts': Array.from({ length: 21 }, (_, i) => `export const w${i}: any = ${i}`).join('\n') + '\n',
      'src/bundel.js': `${'// TODO\n'.repeat(10)}${'x'.repeat(1024 * 1024)}\n`,
    })
    const { kod, wynik } = cli(['pomiar', '--projekt', repo, '--telemetria', join(repo, 'brak.jsonl')])
    assert.equal(kod, 0)
    const nowe = (/** @type {{ nowe: Array<{ plik: string, linia: number }> }} */ w) => w.nowe.map((x) => `${x.plik}:${x.linia}`)
    assert.ok(!nowe(wynik).includes('src/przeniesiony.ts:1') && !nowe(wynik).includes('src/przeniesiony.ts:2'), 'stare wystapienia przeniesionego pliku nie sa nowe')
    assert.ok(nowe(wynik).includes('src/przeniesiony.ts:3'), 'linia dodana w zadaniu przed przeniesieniem zostaje nowa')
    assert.ok(nowe(wynik).includes('src/b.ts:3'), 'niezacommitowana zmiana w sledzonym pliku')
    assert.equal(wynik.nowe.length, 20, 'LIMIT_NOWYCH')
    assert.equal(wynik.noweRazem, 1 + 4 + 1 + 21, 'przeniesiony :3, b.ts 4, niesledzony c.ts 1, wiele.ts 21; bundel ponad prog pominiety')
    assert.deepEqual(Object.keys(wynik.nowe[0]), ['kategoria', 'plik', 'linia'], 'bez tresci linii — wynik przepisuje agent')

    // origin/main przed main: lokalny main przesuniety na commit zadania, origin/main zostaje na stanie zastanym.
    git(repo, ['update-ref', 'refs/remotes/origin/main', 'main'])
    git(repo, ['update-ref', 'refs/heads/main', 'HEAD'])
    const zOrigin = cli(['pomiar', '--projekt', repo, '--telemetria', join(repo, 'brak.jsonl')])
    assert.equal(zOrigin.wynik.noweRazem, 1 + 4 + 1 + 21, 'baza z origin/main, nie z przesunietego main')
  } finally {
    rmSync(repo, { recursive: true, force: true })
    rmSync(telemetria, { force: true })
  }
})

test('--zadanie: rekordy runow tego zadania nie sa poprzednim pomiarem', () => {
  const { repo, telemetria } = projekt()
  try {
    const run = { typ: 'run', workflow: 'dev-autopilot', projekt: basename(repo), start: '2026-10-05T10:00:00.000Z', zadanie: 'biezace' }
    const swiezy = { ...run, klucz: 'wf_b|run|wf_b', run: 'wf_b', ogrod: { liczby: { wyciszenia: 1, any: 3, rzutowania: 0, komentarze: 2, pusty_catch: 1 }, bez_oceny: 0 } }
    writeFileSync(telemetria, `${readFileSync(telemetria, 'utf8')}${JSON.stringify(swiezy)}\n`)
    assert.equal(cli(['pomiar', '--projekt', repo, '--telemetria', telemetria]).wynik.poprzedni.run, 'wf_b')
    const { wynik } = cli(['pomiar', '--projekt', repo, '--telemetria', telemetria, '--zadanie', 'biezace'])
    assert.equal(wynik.poprzedni.run, 'wf_poprzedni')
    assert.equal(wynik.decyzja.ocena, true)
  } finally {
    rmSync(repo, { recursive: true, force: true })
    rmSync(telemetria, { force: true })
  }
})

test('zle argumenty = kod 2; katalog bez gita = kod 1 z polem blad', () => {
  assert.equal(cli([]).kod, 2)
  assert.equal(cli(['ocena']).kod, 2)
  assert.equal(cli(['pomiar', '--nieznana']).kod, 2)
  const katalog = mkdtempSync(join(tmpdir(), 'ogrod-bez-gita-'))
  try {
    const { kod, wynik } = cli(['pomiar', '--projekt', katalog, '--telemetria', join(katalog, 'brak.jsonl')])
    assert.equal(kod, 1)
    assert.equal(typeof wynik.blad, 'string')
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})
