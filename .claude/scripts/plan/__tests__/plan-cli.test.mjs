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

import { liczE2e as liczScenariuszeE2e } from '../../dossier/dokumenty.mjs'
import { gotowosc } from '../gotowosc.mjs'

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
    [PREP]: o.prep ?? '# Przygotowanie\n\n- [ ] Klucz mapy — **[blokuje: faza 2]** (IU-2)\n- [x] Konto — **[blokuje: faza 1]**\n',
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

// Atrapa CLI agent-browser w PATH: bramka gotowosci robi pelne sprawdzenie srodowiska (jak bootstrap), a test nie moze
// zalezec od przegladarki zainstalowanej na maszynie.
const ATRAPY = mkdtempSync(join(tmpdir(), 'plan-cli-bin-'))
writeFileSync(join(ATRAPY, 'agent-browser'), '#!/bin/sh\necho "ok"\n', { mode: 0o755 })
test.after(() => rmSync(ATRAPY, { recursive: true, force: true }))

/** @param {string} korzen @param {string[]} argumenty @returns {{ kod: number | null, json: any }} */
function cli(korzen, argumenty) {
  const w = spawnSync(process.execPath, [CLI, ...argumenty, '--projekt', korzen], { encoding: 'utf8', env: { ...process.env, PATH: `${ATRAPY}:${process.env.PATH}` } })
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
  assert.equal(w.json.odmowa, null)
  // Rozmiary i budzet dla telemetrii (rekord skill, pole artefakty): znaki planu technicznego i pliku zadan na dysku.
  assert.deepEqual(w.json.rozmiary, { plan_zn: FIXTURE.length, zadania_zn: readFileSync(join(k, ZADANIE, 'publikacja-ofert-zadania.md'), 'utf8').length })
  assert.deepEqual(w.json.budzet, { iu_z_wymiarami: 0, wydzielenia: 0 })
}))

test('generuj: plan z bledem nie daje plikow i zwraca bledy z kodem 1', () => wRepo((k) => {
  writeFileSync(join(k, PLAN), FIXTURE.replace('**Delegate to:** feature-builder-ui', ''))
  const w = cli(k, ['generuj', PLAN, '--zapisz'])
  assert.equal(w.kod, 1)
  assert.match(w.json.bledy.join('\n'), /IU-2: Delegate to/)
  assert.equal(existsSync(join(k, ZADANIE)), false)
}))

test('generuj --nadpisz: odmowa przy stanie autopilota, raporcie review albo wpisach dziennika', () => wRepo((k) => {
  for (const [plik, tresc] of [['.autopilot-state.json', '{}'], ['review-faza-1.md', '# R'], ['publikacja-ofert-kontekst.md', '## Dziennik\n\n- faza 1: zrobione\n']]) {
    assert.equal(cli(k, ['generuj', PLAN, '--zapisz', '--nadpisz']).kod, 0)
    writeFileSync(join(k, ZADANIE, plik), tresc)
    const w = cli(k, ['generuj', PLAN, '--zapisz', '--nadpisz'])
    assert.equal(w.kod, 1, plik)
    assert.match(w.json.odmowa, /postępu nie nadpisuję/)
    rmSync(join(k, ZADANIE), { recursive: true })
  }
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
    assert.deepEqual(w.przygotowanie.blokujace.map((b) => b.linia), [3, 4, 5])
  }, { prep: '# P\n\n- [ ] Konto Sentry — **[blokuje: planowanie]**\n- [ ] Klucz — **[blokuje:** faza pierwsza]\n- [ ] DSN — **[blokuje: faza 1]**\n- [x] Gotowe — **[blokuje: faza 1]**\n' })
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

test('gotowosc: pelne sprawdzenie srodowiska jak bootstrap — bledy .env.e2e i agent-browser to STOP; brak skilla weryfikacji = uwaga', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const zle = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => false, agentBrowser: () => ({ ok: false, detal: 'chrome: fail' }) } })
  assert.deepEqual([zle.ok, zle.e2e.ok, zle.e2e.envE2e], [false, false, true])
  assert.equal(zle.e2e.bledy.length, 2)
  assert.match(zle.e2e.bledy[0], /\.env\.e2e nie jest w \.gitignore/)
  assert.match(zle.e2e.bledy[1], /agent-browser nie dziala: chrome: fail/)
  // Plan ma migracje, a .env.e2e (X=1) nie ma bazy e2e z ref — advisors nie pobiegnie (P17): uwaga, nie bloker.
  assert.deepEqual(zle.e2e.uwagi, [
    'brak skilla weryfikacji projektu (.claude/skills/weryfikacja/SKILL.md) — tester odegra scenariusze bez mapy funkcji; generator: /weryfikacja-setup',
    'advisors nie pobiegnie: brak ref projektu e2e: ani SUPABASE_E2E_DB_URL, ani VITE_SUPABASE_URL w .env.e2e nie wskazuje projektu Supabase — dopisz SUPABASE_E2E_PROJECT_REF',
  ])
  const dobre = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => true, agentBrowser: () => ({ ok: true, detal: '' }) } })
  assert.deepEqual([dobre.ok, dobre.e2e.ok, dobre.e2e.bledy], [true, true, []])
  mkdirSync(join(k, '.claude/skills/weryfikacja'), { recursive: true })
  writeFileSync(join(k, '.claude/skills/weryfikacja/SKILL.md'), '# W\n')
  writeFileSync(join(k, '.env.e2e'), 'VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co\n')
  const sprawne = { czyIgnorowany: () => true, agentBrowser: () => ({ ok: true, detal: '' }) }
  assert.deepEqual(gotowosc(k, ZADANIE, { narzedzia: sprawne, srodowisko: {} }).e2e.uwagi, ['advisors nie pobiegnie: brak SUPABASE_ACCESS_TOKEN — Supabase → Account → Access Tokens, wpis SUPABASE_ACCESS_TOKEN=<token> w .env.e2e'])
  const zTokenem = gotowosc(k, ZADANIE, { narzedzia: sprawne, srodowisko: { SUPABASE_ACCESS_TOKEN: 't' } })
  assert.deepEqual([zTokenem.e2e.ok, zTokenem.e2e.uwagi], [true, []], 'advisors to uwaga, nie bloker; z tokenem i ref znika')
}))

test('gotowosc: zadanie z samymi makietami figma_screens sprawdza srodowisko jak bootstrap; bez .env.e2e przechodzi (visual diff bez przegladarki)', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const zadania = join(k, ZADANIE, 'publikacja-ofert-zadania.md')
  writeFileSync(zadania, readFileSync(zadania, 'utf8').replace(/\[E2E\]/g, '[Manual]'))
  writeFileSync(join(k, ZADANIE, 'publikacja-ofert-kontekst.md'), '# K\n\n## Designerski kontekst\n\n- Screeny referencyjne: docs/plans/publikacja-ofert-figma/lista-ofert.png\n')
  const zle = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => false, agentBrowser: () => ({ ok: true, detal: '' }) } })
  assert.deepEqual([zle.e2e.ok, zle.e2e.scenariusze, zle.e2e.figmaScreens], [false, 0, true])
  assert.match(zle.e2e.bledy.join('\n'), /\.env\.e2e nie jest w \.gitignore/)
  assert.ok(!zle.e2e.uwagi.some((u) => /skilla weryfikacji/.test(u)), 'bez scenariuszy [E2E] skill weryfikacji nie jest potrzebny')
  rmSync(join(k, '.env.e2e'))
  const bezEnv = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => false, agentBrowser: () => ({ ok: false, detal: 'x' }) } })
  assert.deepEqual([bezEnv.e2e.ok, bezEnv.e2e.bledy], [true, []])
}))

test('gotowosc po fazie 1: plik zmieniony przez faze nie zatrzymuje bramki (budzet wobec repo sprawdza generuj)', () => wRepo((k) => {
  zadanieNaGalezi(k)
  writeFileSync(join(k, 'src/services/oferty-service.ts'), 'const x = 1\n'.repeat(60))
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'feat: faza 1'])
  assert.equal(cli(k, ['gotowosc', ZADANIE]).kod, 0)
  assert.equal(cli(k, ['sprawdz', PLAN]).kod, 1)
}))

test('linie: liczba linii kodu jak ESLint dla kolumny „dziś”; brak pliku = null', () => wRepo((k) => {
  writeFileSync(join(k, 'src/x.ts'), '// opis\n\nconst a = 1\n')
  assert.deepEqual(cli(k, ['linie', 'src/x.ts', 'src/brak.ts']).json.linie, { 'src/x.ts': 1, 'src/brak.ts': null })
}))

test('wyjatek skryptu: kod 3 z JSON, nie kod 1 jak plan do poprawy; sciezka absolutna planu dziala', () => wRepo((k) => {
  mkdirSync(join(k, 'docs/plans/katalog.md'))
  const w = cli(k, ['sprawdz', 'docs/plans/katalog.md'])
  assert.equal(w.kod, 3)
  assert.equal(w.json.ok, false)
  assert.equal(cli(k, ['sprawdz', join(k, PLAN)]).kod, 0)
}))

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
