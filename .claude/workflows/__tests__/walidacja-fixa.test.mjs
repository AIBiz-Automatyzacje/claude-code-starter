// Walidacja koncowa autopilota: audyt testow po fixach bierze commity fixa po tresci tematu, nie po prefiksie `fix(` (P19).
// vibersi etap-2-poprawki-bezpieczenstwa: builder nadal implementacji (execute, 3184223) temat `fix(...)` i zmienil w niej
// 6 plikow testow — walidacja zglosila „UWAGA test-weakening”, choc fix (ad8c7d7, 3839aea) tylko dodal test.
// Repo testowe odtwarza te historie tematami commitow z vibersi; komenda pochodzi z promptu walidacji 1:1.
//
// Uruchomienie: node --test .claude/workflows/__tests__/walidacja-fixa.test.mjs

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const autopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')

/** @param {string} zrodlo @param {string} kotwica @param {string} koniec */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const komendaCommitowFixa = new Function(`${wytnij(autopilot, 'function komendaCommitowFixa(', '\n}\n')}
  return komendaCommitowFixa`)()
// eslint-disable-next-line no-new-func -- jw.
const finalValidationPrompt = new Function('BLOK_DLUGIE_KOMENDY', 'komendaCommitowFixa', `${wytnij(autopilot, 'function finalValidationPrompt(', '\n}\n')}
  return finalValidationPrompt`)('', komendaCommitowFixa)
// eslint-disable-next-line no-new-func -- jw.
const fixPrompt = new Function('BLOK_DLUGIE_KOMENDY', 'blokZwinieciaDoPoprawy', `${wytnij(autopilot, 'function fixPrompt(', '\n}\n')}
  return fixPrompt`)('', () => '')
// eslint-disable-next-line no-new-func -- jw.
const fixPoprawkaPrompt = new Function('BLOK_DLUGIE_KOMENDY', `${wytnij(autopilot, 'function zakresFixa(', '\n}\n')}
  ${wytnij(autopilot, 'function plikiPozycji(', '\n}\n')}
  ${wytnij(autopilot, 'function fixPoprawkaPrompt(', '\n}\n')}
  return fixPoprawkaPrompt`)('')

const ZADANIE = 'etap-2-poprawki-bezpieczenstwa'
const TEST_STARY = "it('limit', () => expect(status).toBe(429))\n"

test('vibersi etap-2-poprawki: commity fixa = poprawki po review i kontrola diffu tego zadania; execute z prefiksem fix( i fix innego zadania poza lista', () => {
  const repo = mkdtempSync(join(tmpdir(), 'walidacja-fixa-'))
  const git = (/** @type {string[]} */ ...a) => {
    const w = spawnSync('git', a, { cwd: repo, encoding: 'utf8' })
    assert.equal(w.status, 0, w.stderr)
    return w.stdout
  }
  const commit = (/** @type {string} */ temat, /** @type {Record<string, string>} */ pliki) => {
    for (const [p, t] of Object.entries(pliki)) {
      mkdirSync(join(repo, p, '..'), { recursive: true })
      writeFileSync(join(repo, p), t)
    }
    git('add', '-A')
    git('commit', '-qm', temat)
    return git('rev-parse', '--short=7', 'HEAD').trim()
  }
  try {
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 't@x.pl')
    git('config', 'user.name', 't')
    commit('feat: start', { 'server/licznik.test.ts': TEST_STARY, 'server/licznik.ts': 'export const a = 1\n' })
    git('switch', '-qc', 'feature/etap-2-katalog-publiczny')
    commit('fix(etap-2-katalog-publiczny): poprawki po review fazy 3', { 'server/licznik.test.ts': "it('limit', () => expect(status).toBeDefined())\n" })
    commit('docs: inicjalizacja planu dla etap-2-poprawki-bezpieczenstwa', { 'docs/plan.md': '# plan\n' })
    const execute = commit('fix(etap-2-poprawki-bezpieczenstwa): licznik wyświetleń przez serwer i liczniki odporne na nadużycia', {
      'server/licznik.test.ts': "it('limit przez serwer', () => expect(odpowiedz.status).toBe(429))\n", 'server/licznik.ts': 'export const a = 2\n',
    })
    const poprawki = commit(`fix(${ZADANIE}): poprawki po review fazy 1`, { 'server/limiter.test.ts': "it('nowy', () => expect(1).toBe(1))\n" })
    const kontrola = commit(`fix(${ZADANIE}): kontrola diffu naprawczego fazy 1`, { 'server/licznik.ts': 'export const a = 3\n' })
    commit('docs(known-issues): przenies zamkniete wpisy', { 'docs/known-issues.md': '# ki\n' })

    const komenda = komendaCommitowFixa(`docs/active/${ZADANIE}`)
    assert.ok(finalValidationPrompt(`docs/active/${ZADANIE}`).includes(`commity fixa tego zadania wylacznie z \`${komenda}\``))
    const lista = spawnSync('sh', ['-c', komenda], { cwd: repo, encoding: 'utf8' })
    assert.equal(lista.status, 0, lista.stderr)
    assert.deepEqual(lista.stdout.trim().split('\n'), [kontrola, poprawki])
    assert.ok(!lista.stdout.includes(execute), 'execute z prefiksem fix( nie jest commitem fixa')
    // Diff per commit (nie zakresu): zmiany testow w fixie = tylko nowy plik testu.
    const testyFixa = [kontrola, poprawki].map((sha) => git('show', '--format=', sha, '--', '*.test.*', '*.spec.*')).join('')
    assert.match(testyFixa, /^new file mode/m)
    assert.doesNotMatch(testyFixa, /^-it\(/m, 'zaden istniejacy test nie zmieniony w commitach fixa')
    // Regresja: stary wzorzec `^fix(` bral execute i fix innego zadania.
    const stary = git('log', '--format=%h', '--grep=^fix(', 'main..HEAD')
    assert.ok(stary.includes(execute))
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('polecenia fixa i kontroli diffu podaja temat commita z nazwa zadania doslownie (ten sam, ktory rozpoznaje walidacja)', () => {
  assert.match(fixPrompt(`docs/active/${ZADANIE}`, 2, [], 'gotowe'), new RegExp(`commit \`fix\\(${ZADANIE}\\): poprawki po review fazy 2\` \\(temat dokladnie taki`))
  assert.match(fixPoprawkaPrompt(`docs/active/${ZADANIE}`, 2, [], []), new RegExp(`\`fix\\(${ZADANIE}\\): kontrola diffu naprawczego fazy 2\` \\(temat dokladnie taki\\)`))
  assert.doesNotMatch(wytnij(autopilot, 'function finalValidationPrompt(', '\n}\n'), /\^fix\(/)
})

// P20 A9 (vibersi etap 3, fix:poprawka fazy 4): pelny `git diff` fixa to 51% wejscia agenta (50k zn), a pozycje kontroli
// wskazuja konkretne pliki. Tura poprawkowa dostaje diff tylko tych plikow; kontrola fixa nadal widzi caly diff.
test('fix:poprawka: diff tylko plikow z pozycji K (bez duplikatow, bez "?" i znakow powloki), bez pelnego diffu fixa', () => {
  const pozycje = [
    { zrodlo: 'K-1', plik: 'src/lib/konto/akcje-auth.ts:124', opis: 'a' },
    { zrodlo: 'K-5', plik: 'src/lib/konto/akcje-auth.ts:30', opis: 'b' },
    { zrodlo: 'bramki', plik: 'supabase/migrations/20261016_konto.sql', opis: 'c' },
    { zrodlo: 'K-3', plik: '?', opis: 'd' },
    { zrodlo: 'K-7', plik: 'src/x.ts; rm -rf ~:1', opis: 'e' },
    { zrodlo: 'K-1', plik: "src/routes/$id/(grupa)/[slug]/page.tsx:3", opis: 'f' },
    { zrodlo: 'K-4', plik: 'Dockerfile:2', opis: 'g' },
    { zrodlo: 'K-4', plik: "src/a'b.ts:2", opis: 'h' },
  ]
  const p = fixPoprawkaPrompt(`docs/active/${ZADANIE}`, 4, pozycje, ['abc1234 fix', 'def5678'])
  assert.ok(p.includes("`git diff <najstarszy>^ -- 'src/lib/konto/akcje-auth.ts' 'supabase/migrations/20261016_konto.sql' 'src/routes/$id/(grupa)/[slug]/page.tsx' 'Dockerfile'`"), 'pliki w apostrofach, bez duplikatow i sciezek spoza zapisu')
  assert.doesNotMatch(p, /\.\.HEAD/, 'pelny diff fixa poza tura poprawkowa')
  assert.doesNotMatch(String(p).split('\n').find((l) => l.includes('Diff do poprawek')) ?? '', /rm -rf|\?|a'b/, 'sciezka spoza zapisu nie trafia do polecenia git')
  const bezHashy = fixPoprawkaPrompt(`docs/active/${ZADANIE}`, 4, pozycje, [])
  assert.ok(bezHashy.includes("`git diff <pierwszy-commit-fixa>^ -- 'src/lib/konto/akcje-auth.ts' 'supabase"))
  const bezPlikow = fixPoprawkaPrompt(`docs/active/${ZADANIE}`, 4, [{ zrodlo: 'K-3', plik: '?', opis: 'd' }], ['abc1234'])
  assert.match(bezPlikow, /Diff fixa: `git diff <najstarszy>\^\.\.HEAD`/, 'pozycje bez sciezki = pelny diff jak dotad')
})
