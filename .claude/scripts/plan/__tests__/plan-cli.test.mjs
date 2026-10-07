// CLI planowania i bramka gotowosci (PLAN-POPRAWY P13) na tymczasowym repo git: generuj → zapis docs/active/, odmowa
// nadpisania postepu, gotowosc z kazdym powodem STOP (E2E bez srodowiska, bloker startu, galaz, brudne drzewo).
//
// Uruchomienie:  node --test .claude/scripts/plan/__tests__/plan-cli.test.mjs

import { spawnSync, execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { gotowosc, liczScenariuszeE2e } from '../gotowosc.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '../plan.mjs')
const FIXTURE = readFileSync(join(KATALOG, 'fixtures/plan-techniczny.md'), 'utf8')
const PLAN = 'docs/plans/2026-10-07-001-feat-publikacja-ofert-plan.md'
const ZADANIE = 'docs/active/publikacja-ofert'
const PREP = 'docs/operator/publikacja-ofert-przygotowanie.md'

/** @param {string} korzen @param {string[]} a */
const git = (korzen, a) => execFileSync('git', ['-C', korzen, ...a], { stdio: 'pipe' })

/** @param {{ prep?: string, env?: boolean }} [o] @returns {string} repo z planem, plikami planu i commitem na main */
function repo(o = {}) {
  const korzen = mkdtempSync(join(tmpdir(), 'plan-cli-'))
  const pliki = {
    [PLAN]: FIXTURE,
    'docs/DESIGN.md': '#\n',
    'docs/brainstorms/2026-10-01-publikacja-ofert-requirements.md': '#\n',
    'docs/plans/publikacja-ofert-figma/SPEC.md': '#\n',
    'docs/plans/publikacja-ofert-figma/lista-ofert.png': 'png',
    'src/services/oferty-service.ts': 'const x = 1\n'.repeat(12),
    'src/features/oferty/components/lista-ofert.tsx': 'const x = 1\n'.repeat(8),
    [PREP]: o.prep ?? '# Przygotowanie\n\n- [ ] Klucz mapy — **[blokuje: faza 2]** (IU-2)\n',
    ...(o.env === false ? {} : { '.env.e2e': 'X=1\n' }),
  }
  for (const [s, t] of Object.entries(pliki)) {
    mkdirSync(dirname(join(korzen, s)), { recursive: true })
    writeFileSync(join(korzen, s), t)
  }
  writeFileSync(join(korzen, '.gitignore'), '.env.e2e\n')
  git(korzen, ['init', '-q', '-b', 'main'])
  git(korzen, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A'])
  git(korzen, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'start'])
  return korzen
}

/** @param {string} korzen @param {string[]} argumenty @returns {{ kod: number | null, json: any }} */
function cli(korzen, argumenty) {
  const w = spawnSync(process.execPath, [CLI, ...argumenty, '--projekt', korzen], { encoding: 'utf8' })
  return { kod: w.status, json: w.stdout ? JSON.parse(w.stdout) : null }
}

/** @param {string} korzen gotowe zadanie na galezi feature/ z commitem */
function zadanieNaGalezi(korzen) {
  git(korzen, ['checkout', '-qb', 'feature/publikacja-ofert'])
  assert.equal(cli(korzen, ['generuj', PLAN, '--data', '2026-10-07', '--zapisz']).kod, 0)
  git(korzen, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A'])
  git(korzen, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'docs: inicjalizacja planu'])
}

/** @param {(korzen: string) => void} f @param {Parameters<typeof repo>[0]} [o] */
function wRepo(f, o) {
  const korzen = repo(o)
  try {
    f(korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

test('generuj --zapisz: trzy pliki zadania z licznikami; bez --zapisz nic nie powstaje', () => wRepo((k) => {
  const sucho = cli(k, ['generuj', PLAN])
  assert.equal(sucho.kod, 0)
  assert.equal(existsSync(join(k, ZADANIE)), false)
  const w = cli(k, ['generuj', PLAN, '--data', '2026-10-07', '--zapisz'])
  assert.equal(w.kod, 0)
  assert.deepEqual(w.json.zapisane, ['plan', 'kontekst', 'zadania'].map((r) => `${ZADANIE}/publikacja-ofert-${r}.md`))
  assert.deepEqual(w.json.liczniki, { fazy: 2, iu: 3, implementacyjne: 10, testy: 6, weryfikacje: 4, e2e: 3, operator: 2 })
}))

test('generuj: plan z bledem nie daje plikow i zwraca bledy z kodem 1', () => wRepo((k) => {
  writeFileSync(join(k, PLAN), FIXTURE.replace('**Delegate to:** feature-builder-ui', ''))
  const w = cli(k, ['generuj', PLAN, '--zapisz'])
  assert.equal(w.kod, 1)
  assert.match(w.json.bledy.join('\n'), /IU-2: Delegate to/)
  assert.equal(existsSync(join(k, ZADANIE)), false)
}))

test('generuj: istniejace zadanie bez --nadpisz odmowa; z --nadpisz odmowa, gdy zadania maja postep', () => wRepo((k) => {
  assert.equal(cli(k, ['generuj', PLAN, '--zapisz']).kod, 0)
  const ponownie = cli(k, ['generuj', PLAN, '--zapisz'])
  assert.equal(ponownie.kod, 1)
  assert.match(ponownie.json.odmowa, /już istnieje/)
  assert.equal(cli(k, ['generuj', PLAN, '--zapisz', '--nadpisz']).kod, 0)
  const zadania = join(k, ZADANIE, 'publikacja-ofert-zadania.md')
  writeFileSync(zadania, readFileSync(zadania, 'utf8').replace('- [ ] Stwórz:', '- [x] Stwórz:'))
  const postep = cli(k, ['generuj', PLAN, '--zapisz', '--nadpisz'])
  assert.equal(postep.kod, 1)
  assert.match(postep.json.odmowa, /postępu nie nadpisuję/)
}))

test('gotowosc: zadanie na swojej galezi z czystym drzewem przechodzi; blokery faz >= 2 tylko raportowane', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const w = cli(k, ['gotowosc', ZADANIE])
  assert.equal(w.kod, 0, JSON.stringify(w.json))
  assert.equal(w.json.e2e.scenariusze, 3)
  assert.deepEqual(w.json.przygotowanie.odroczone.map((/** @type {{ faza: number }} */ b) => b.faza), [2])
}))

test('gotowosc: STOP na E2E bez .env.e2e, blokerze startu, cudzej galezi i brudnym drzewie — kazdy osobno', () => {
  wRepo((k) => {
    zadanieNaGalezi(k)
    const w = gotowosc(k, ZADANIE)
    assert.deepEqual([w.ok, w.e2e.ok, w.plan.ok, w.przygotowanie.ok, w.git.ok], [false, false, true, true, true])
  }, { env: false })
  wRepo((k) => {
    zadanieNaGalezi(k)
    const w = gotowosc(k, ZADANIE)
    assert.deepEqual([w.ok, w.przygotowanie.ok], [false, false])
    assert.deepEqual(w.przygotowanie.blokujace.map((b) => b.linia), [3, 4])
  }, { prep: '# P\n\n- [ ] Konto Sentry — **[blokuje: planowanie]**\n- [ ] Klucz — **[blokuje:** faza pierwsza]\n- [x] Gotowe — **[blokuje: faza 1]**\n' })
  wRepo((k) => {
    zadanieNaGalezi(k)
    git(k, ['checkout', '-q', 'main'])
    const naMain = gotowosc(k, ZADANIE)
    assert.deepEqual([naMain.ok, naMain.git.galaz, naMain.git.wymagana], [false, 'main', 'feature/publikacja-ofert'])
    git(k, ['checkout', '-q', 'feature/publikacja-ofert'])
    writeFileSync(join(k, 'src/nowy.ts'), 'x\n')
    assert.deepEqual(gotowosc(k, ZADANIE).git.brudne, ['?? src/nowy.ts'])
  })
})

test('gotowosc: brak planu technicznego pod wskaznikiem to blad planu, nie wyjatek', () => wRepo((k) => {
  zadanieNaGalezi(k)
  rmSync(join(k, PLAN))
  const w = gotowosc(k, ZADANIE)
  assert.equal(w.plan.ok, false)
  assert.match(w.plan.bledy[0], /brak planu technicznego \(wskaźnik w planie zadania: docs\/plans\//)
}))

test('liczScenariuszeE2e: grep precheck/completion-gate — kopie Operator: i findingi [P1-3] nie sa scenariuszami', () => {
  const md = ['- [ ] Test: [E2E] `a` — x → y', '- [x] Test: [E2E] `b` — x → y', '- [ ] Operator: [E2E] `a`', '- [ ] 🟠 [P2] [E2E] plik',
    '  - [ ] Test: [E2E] `c` — wciety', '- [ ] Weryfikacja: [E2E] `e2e/run-all.sh` — ok'].join('\n')
  assert.equal(liczScenariuszeE2e(md), 2)
})

test('zle argumenty: kod 2', () => wRepo((k) => {
  assert.equal(cli(k, ['generuj']).kod, 2)
  assert.equal(cli(k, ['nieznane', PLAN]).kod, 2)
  assert.equal(cli(k, ['generuj', PLAN, '--data', '7.10.2026']).kod, 2)
  assert.equal(cli(k, ['sprawdz', 'docs/plans/brak.md']).kod, 2)
}))
