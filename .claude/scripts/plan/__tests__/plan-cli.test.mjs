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
import { NARZEDZIE_JAZDY } from '../../e2e/adapter.mjs'
import { gotowosc } from '../gotowosc.mjs'
import { odciskFazy, odciskPlanu, polaFazy, roznicaPol, SEKCJA_REALIZACJI } from '../spojnosc.mjs'
import { PROFIL } from '../../stack/profil.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '../plan.mjs')
// Fixture niesie sciezki seedow web (e2e/seeds/); katalog seedow z profilu stacku (IU-1.7) — test przechodzi na kazdym wariancie.
const FIXTURE = readFileSync(join(KATALOG, 'fixtures/plan-techniczny.md'), 'utf8').replaceAll('e2e/seeds/', `${PROFIL.e2e.katalogSeedow}/`)
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
    // Stack z plikiem flow (D17): flow scenariuszy fixture'u są już w repo.
    ...Object.fromEntries((PROFIL.e2e.plikFlow ? ['publikacja-oferty', 'oferta-publiczna'] : []).map((f) => [PROFIL.e2e.plikFlow?.replace('<flow>', f) ?? '', 'appId: x\n'])),
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

// Atrapa narzedzia jazdy w PATH: bramka gotowosci robi pelne sprawdzenie srodowiska (jak bootstrap), a test nie moze
// zalezec od narzedzia zainstalowanego na maszynie.
const ATRAPY = mkdtempSync(join(tmpdir(), 'plan-cli-bin-'))
writeFileSync(join(ATRAPY, NARZEDZIE_JAZDY.nazwa), '#!/bin/sh\necho "ok"\n', { mode: 0o755 })
test.after(() => rmSync(ATRAPY, { recursive: true, force: true }))

/** @param {string} korzen @param {string[]} argumenty @returns {{ kod: number | null, json: any }} */
function cli(korzen, argumenty) {
  const w = spawnSync(process.execPath, [CLI, ...argumenty, '--projekt', korzen], { encoding: 'utf8', env: { ...process.env, PATH: `${ATRAPY}:${process.env.PATH}` } })
  return { kod: w.status, json: w.stdout ? JSON.parse(w.stdout) : null }
}

/** @param {string} korzen @returns {string} oznaczenia faz planu po przecinku (stan przegladu wymienia fazy bez przegladu) */
const fazyPlanu = (korzen) => cli(korzen, ['spojnosc', PLAN]).json.fazyBez.join(',')

/**
 * Czyste czytanie kazdej fazy recenzentem (6.2b): zapis czytania przed recenzentem i oznaczenie czystego wyniku — bez tego
 * koncowy zapis z --otwarte 0 odmawia (analiza vibersi audyt-paczki-1-2).
 * @param {string} korzen @param {string[]} [fazy]
 */
function czysteCzytania(korzen, fazy = fazyPlanu(korzen).split(',')) {
  for (const f of fazy) {
    assert.equal(cli(korzen, ['spojnosc', PLAN, '--faza', f, '--czytanie']).kod, 0)
    assert.equal(cli(korzen, ['spojnosc', PLAN, '--faza', f, '--czysta']).kod, 0)
  }
}

/**
 * Gotowe zadanie na galezi feature/ z commitem. Punkt 41: /dev-plan zapisuje przeglad spojnosci (6.2b) przed commitem
 * inicjalnym, wiec zadanie bez przegladu to osobny przypadek (`{ przeglad: false }`).
 * @param {string} korzen @param {{ przeglad?: boolean }} [o]
 */
function zadanieNaGalezi(korzen, o = {}) {
  git(korzen, ['checkout', '-qb', 'feature/publikacja-ofert'])
  if (o.przeglad !== false) {
    czysteCzytania(korzen)
    assert.equal(cli(korzen, ['spojnosc', PLAN, '--zapisz', '--fazy', fazyPlanu(korzen), '--otwarte', '0', '--data', '2026-10-07']).kod, 0)
  }
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

// Pilot Nawykometr W21 (run 2): bramka byla zielona, a autopilot stanal na starcie na `claude_md: do-uzgodnienia` w pliku
// decyzji poprzedniego zadania na main. Bramka czyta galaz glowna, nie galaz zadania — tak jak bootstrap.
test('gotowosc: plik decyzji na main z claude_md do-uzgodnienia = STOP z naprawa; uzgodniono albo brak katalogu = ok', () => wRepo((k) => {
  /** @param {string} tresc commit pliku decyzji poprzedniego zadania na main */
  const decyzjaNaMain = (tresc) => {
    git(k, ['checkout', '-q', 'main'])
    mkdirSync(join(k, 'docs/decisions'), { recursive: true })
    writeFileSync(join(k, 'docs/decisions/2026-11-09-haptyka-check-in.md'), `---\nzadanie: haptyka-check-in\nclaude_md: ${tresc}\n---\n`)
    git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A'])
    git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', `decyzja: ${tresc}`])
    git(k, ['checkout', '-q', 'feature/publikacja-ofert'])
  }
  zadanieNaGalezi(k)
  assert.deepEqual(gotowosc(k, ZADANIE).claudeMd, { ok: true, glowna: 'main', zadania: [], naprawa: '' }, 'brak docs/decisions/ na main')
  decyzjaNaMain('do-uzgodnienia')
  const w = gotowosc(k, ZADANIE)
  assert.deepEqual([w.ok, w.claudeMd.ok, w.claudeMd.zadania, w.git.ok], [false, false, ['haptyka-check-in'], true])
  assert.match(w.claudeMd.naprawa, /^git switch main, potem \/dev-pr --claude-md haptyka-check-in; po powrocie na gałąź zadania: git merge main/)
  decyzjaNaMain('uzgodniono')
  // Atrapa narzedzi: ogolne `ok` zalezy tez od narzedzia jazdy stacku, ktorego na CI nie ma (bez atrapy test padal na wariancie expo).
  const poUzgodnieniu = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) } })
  assert.deepEqual([poUzgodnieniu.ok, poUzgodnieniu.claudeMd.ok], [true, true])
}))

// 02.11: dashboard ruszal autopilotem ze stara baza wiedzy w .claude/rules/ i ~110k zn kontekstu na agenta — nikt tego nie widzial.
test('gotowosc: stara baza wiedzy i przerosniety kontekst startowy = uwagi higieny z komenda, bez blokady startu', () => wRepo((k) => {
  zadanieNaGalezi(k)
  assert.deepEqual(gotowosc(k, ZADANIE).higiena, { ok: true, uwagi: [] })
  mkdirSync(join(k, '.claude/rules'), { recursive: true })
  writeFileSync(join(k, '.claude/rules/learned-patterns.md'), 'r'.repeat(25_000))
  const w = gotowosc(k, ZADANIE)
  assert.equal(w.higiena.uwagi.length, 2)
  assert.match(w.higiena.uwagi[0] ?? '', /^wiedza projektu: .* → \/dev-compound-refresh --konwersja/)
  assert.match(w.higiena.uwagi[1] ?? '', /^kontekst startowy agenta: 25\s000 zn/)
  assert.deepEqual([w.higiena.ok, w.git.brudne.length > 0], [true, true], 'higiena nie zmienia ok — tu blokuje juz brudne drzewo')
}))

// Punkt 40, krok 6: sprawy odlozone w smoke'u (docs/operator/odlozone.md) nie trafialy nigdzie dalej. Bramka je pokazuje, ale nie
// blokuje startu (decyzja operatora 2026-11-11: sprawa innego etapu nie zatrzymuje pracy; o wejsciu do etapu decyduje /dev-prep).
test('gotowosc: otwarte sprawy odlozone z etapem i linia, bez wplywu na ok', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const narzedzia = { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) }
  const przed = gotowosc(k, ZADANIE, { narzedzia })
  assert.deepEqual(przed.odlozone, { ok: true, plik: 'docs/operator/odlozone.md', otwarte: [], decyzje: [] })
  mkdirSync(join(k, 'docs/operator'), { recursive: true })
  writeFileSync(join(k, 'docs/operator/odlozone.md'), '# Sprawy odłożone\n\n- [ ] [etap: etap 5] sklep D2: limit — `src/k.ts:9` (smoke 2026-11-11)\n- [x] [etap: etap 4] zrobione\n')
  git(k, ['add', 'docs/operator/odlozone.md'])
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'docs: odlozone'])
  const w = gotowosc(k, ZADANIE, { narzedzia })
  assert.deepEqual(w.odlozone.otwarte, [{ linia: 3, etap: 'etap 5', tresc: 'sklep D2: limit — `src/k.ts:9` (smoke 2026-11-11)' }])
  assert.equal(w.ok, przed.ok, 'odlozone nie zmieniaja ok bramki')
  // Punkt 52: decyzje poprzednich zadan bez rozstrzygniecia (smoke pominiety) — widoczne w bramce, bez wplywu na ok.
  mkdirSync(join(k, 'docs/completed/sklep'), { recursive: true })
  writeFileSync(join(k, 'docs/completed/sklep/known-issues.md'), '# K\n\n## Decyzje operatora\n\n- [DECYZJA · faza 1 · fix] src/a.ts:5 — limit\n')
  git(k, ['add', 'docs/completed'])
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'docs: archiwum'])
  const zDecyzja = gotowosc(k, ZADANIE, { narzedzia })
  assert.deepEqual(zDecyzja.odlozone.decyzje, [{ zadanie: 'sklep', wiersz: '[DECYZJA · faza 1 · fix] src/a.ts:5 — limit' }])
  assert.equal(zDecyzja.ok, przed.ok, 'decyzje nie zmieniaja ok bramki')
}))

// P22 A1: runner testow projektu zbierajacy .claude/** (live-10-demo: vitest run bez configu) wychodzi w bramce, nie w bootstrapie.
// Sync nie wozi testow maszynerii do projektow: bez pliku testu pod .claude/ brak configu nie blokuje (testy.ok true).
test('gotowosc: vitest bez configu i test pod .claude/ → testy.ok false z poprawka i STOP; config z include tests/ → ok', () => wRepo((k) => {
  writeFileSync(join(k, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' }, devDependencies: { vitest: '3.2.4' } }))
  zadanieNaGalezi(k)
  const bezTestow = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) } })
  assert.deepEqual([bezTestow.testy.ok, bezTestow.testy.runner, bezTestow.testy.poprawka], [true, 'vitest', '—'])
  mkdirSync(join(k, '.claude', 'skills', 'wlasny', '__tests__'), { recursive: true })
  writeFileSync(join(k, '.claude', 'skills', 'wlasny', '__tests__', 'a.test.mjs'), '')
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A'])
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'test: wlasny test skilla'])
  const zle = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) } })
  assert.deepEqual([zle.ok, zle.testy.ok, zle.testy.runner, zle.git.ok], [false, false, 'vitest', true])
  assert.match(zle.testy.poprawka, /exclude: \[\.\.\.configDefaults\.exclude, '\.claude\/\*\*'\]/)
  writeFileSync(join(k, 'vitest.config.ts'), 'export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } })\n')
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A'])
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'test: config'])
  const dobre = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) } })
  assert.deepEqual([dobre.ok, dobre.testy.ok], [true, true])
}))

test('gotowosc: pelne sprawdzenie srodowiska jak bootstrap — bledy .env.e2e i narzedzia jazdy to STOP; brak skilla weryfikacji = uwaga', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const zle = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => false, narzedzieJazdy: () => ({ ok: false, detal: 'chrome: fail' }) } })
  assert.deepEqual([zle.ok, zle.e2e.ok, zle.e2e.envE2e], [false, false, true])
  assert.equal(zle.e2e.bledy.length, 2)
  assert.match(zle.e2e.bledy[0], /\.env\.e2e nie jest w \.gitignore/)
  assert.ok(zle.e2e.bledy[1].startsWith(`${NARZEDZIE_JAZDY.nazwa} nie dziala: chrome: fail`), zle.e2e.bledy[1])
  // Plan ma migracje, a .env.e2e (X=1) nie ma bazy e2e z ref — advisors nie pobiegnie (P17): uwaga, nie bloker.
  assert.deepEqual(zle.e2e.uwagi, [
    'brak skilla weryfikacji projektu (.claude/skills/weryfikacja/SKILL.md) — tester odegra scenariusze bez mapy funkcji; generator: /weryfikacja-setup',
    `advisors nie pobiegnie: brak ref projektu e2e: ani SUPABASE_E2E_DB_URL, ani ${PROFIL.env.adresSupabase} w .env.e2e nie wskazuje projektu Supabase — dopisz SUPABASE_E2E_PROJECT_REF`,
  ])
  const dobre = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) } })
  assert.deepEqual([dobre.ok, dobre.e2e.ok, dobre.e2e.bledy], [true, true, []])
  mkdirSync(join(k, '.claude/skills/weryfikacja'), { recursive: true })
  writeFileSync(join(k, '.claude/skills/weryfikacja/SKILL.md'), '# W\n')
  writeFileSync(join(k, '.env.e2e'), `${PROFIL.env.adresSupabase}=https://abcdefghijklmnopqrst.supabase.co\n`)
  const sprawne = { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) }
  assert.deepEqual(gotowosc(k, ZADANIE, { narzedzia: sprawne, srodowisko: {} }).e2e.uwagi, ['advisors nie pobiegnie: brak SUPABASE_ACCESS_TOKEN — Supabase → Account → Access Tokens, wpis SUPABASE_ACCESS_TOKEN=<token> w .env.e2e'])
  const zTokenem = gotowosc(k, ZADANIE, { narzedzia: sprawne, srodowisko: { SUPABASE_ACCESS_TOKEN: 't' } })
  assert.deepEqual([zTokenem.e2e.ok, zTokenem.e2e.uwagi], [true, []], 'advisors to uwaga, nie bloker; z tokenem i ref znika')
}))

test('gotowosc: zadanie z samymi makietami figma_screens sprawdza srodowisko jak bootstrap; bez .env.e2e przechodzi (visual diff bez przegladarki)', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const zadania = join(k, ZADANIE, 'publikacja-ofert-zadania.md')
  writeFileSync(zadania, readFileSync(zadania, 'utf8').replace(/\[E2E\]/g, '[Manual]'))
  writeFileSync(join(k, ZADANIE, 'publikacja-ofert-kontekst.md'), '# K\n\n## Designerski kontekst\n\n- Screeny referencyjne: docs/plans/publikacja-ofert-figma/lista-ofert.png\n')
  const zle = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => false, narzedzieJazdy: () => ({ ok: true, detal: '' }) } })
  assert.deepEqual([zle.e2e.ok, zle.e2e.scenariusze, zle.e2e.figmaScreens], [false, 0, true])
  assert.match(zle.e2e.bledy.join('\n'), /\.env\.e2e nie jest w \.gitignore/)
  assert.ok(!zle.e2e.uwagi.some((u) => /skilla weryfikacji/.test(u)), 'bez scenariuszy [E2E] skill weryfikacji nie jest potrzebny')
  rmSync(join(k, '.env.e2e'))
  const bezEnv = gotowosc(k, ZADANIE, { narzedzia: { czyIgnorowany: () => false, narzedzieJazdy: () => ({ ok: false, detal: 'x' }) } })
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

// P25 A1: autopilot zatrzymuje sie przed faza z nieodhaczonym blokerem — bootstrap przepisuje ten wynik 1:1. vibersi etap 5:
// pozycja „[blokuje: faza 3]” byla tylko w planie zadania i run przeszedl fazy 3–6 bez serwera Hono w E2E.
test('blokery: nieodhaczone pozycje checklisty z numerem fazy (start = faza 1), odhaczone pominiete; bez checklisty pusto', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const w = cli(k, ['blokery', ZADANIE])
  assert.equal(w.kod, 0, JSON.stringify(w.json))
  assert.deepEqual(w.json, { ok: true, checklista: PREP, blokery: [{ faza: 2, linia: 3, tresc: 'Klucz mapy — **[blokuje: faza 2]** (IU-2)' }], spojnosc: { ok: true, powod: '' } })
  writeFileSync(join(k, PREP), '# P\n\n- [ ] Konto — **[blokuje: planowanie]**\n- [ ] Dostęp — **[blokuje: faza 1]**\n- [x] Klucz — **[blokuje: faza 2]**\n')
  assert.deepEqual(cli(k, ['blokery', ZADANIE]).json.blokery.map((/** @type {{ faza: number }} */ b) => b.faza), [1, 1])
  writeFileSync(join(k, PREP), '# P\n\n- [ ] Klucz — **[blokuje: faza 2]**\n- [ ] Konto — **[blokuje: faza 1]**\n')
  assert.deepEqual(cli(k, ['blokery', ZADANIE]).json.blokery.map((/** @type {{ linia: number }} */ b) => b.linia), [3, 4], 'kolejnosc linii checklisty')
  rmSync(join(k, PREP))
  assert.deepEqual(cli(k, ['blokery', ZADANIE]).json, { ok: true, checklista: PREP, blokery: [], spojnosc: { ok: true, powod: '' } })
}))

// Punkt 53, krok B4: autopilot czyta stan przegladu spojnosci z `plan.mjs blokery` (bootstrap przepisuje wynik 1:1).
test('blokery: pole spojnosc liczone jak w bramce gotowosci — brak przegladu i zmiana tresci planu daja ok false z powodem', () => wRepo((k) => {
  zadanieNaGalezi(k, { przeglad: false })
  const bez = cli(k, ['blokery', ZADANIE]).json
  assert.equal(bez.spojnosc.ok, false)
  assert.match(bez.spojnosc.powod, /^brak zapisu przeglądu spójności planu → \/dev-plan krok 6\.2b/)
  czysteCzytania(k)
  assert.equal(cli(k, ['spojnosc', PLAN, '--zapisz', '--fazy', fazyPlanu(k), '--otwarte', '0']).kod, 0)
  assert.deepEqual(cli(k, ['blokery', ZADANIE]).json.spojnosc, { ok: true, powod: '' })
  writeFileSync(join(k, PLAN), readFileSync(join(k, PLAN), 'utf8').replace('## Granice zakresu', '## Granice zakresu\n\n- nowe wykluczenie'))
  assert.match(cli(k, ['blokery', ZADANIE]).json.spojnosc.powod, /^plan zmieniony po przeglądzie spójności/)
  // Bez checklisty przygotowania pole tez jest (blokery puste).
  rmSync(join(k, PREP))
  assert.equal(cli(k, ['blokery', ZADANIE]).json.spojnosc.ok, false)
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

// Punkt 41, kroki 3 i 5 (aa-exam E3, wf_1c69a604-076): test wymagal imienia w mailu, makieta go nie miala — faza 3 stanela,
// bo nikt nie zestawil planu z makieta przed runem. Bramka blokuje start bez aktualnego przegladu spojnosci z zerem otwartych.
test('gotowosc: przeglad spojnosci — brak, otwarte, faza bez przegladu i zmiana tresci planu blokuja; odhaczenie w planie nie', () => wRepo((k) => {
  const narzedzia = { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) }
  zadanieNaGalezi(k, { przeglad: false })
  const fazy = fazyPlanu(k).split(',')
  assert.ok(fazy.length >= 2, 'fixture ma kilka faz')
  const bez = gotowosc(k, ZADANIE, { narzedzia })
  assert.deepEqual([bez.ok, bez.spojnosc.ok, bez.spojnosc.fazyBez], [false, false, fazy])
  assert.match(bez.spojnosc.powod, /^brak zapisu przeglądu spójności planu → \/dev-plan krok 6\.2b/)

  czysteCzytania(k, fazy)
  const zapisz = (/** @type {string} */ f, /** @type {string} */ otwarte) => cli(k, ['spojnosc', PLAN, '--zapisz', '--fazy', f, '--otwarte', otwarte])
  assert.equal(zapisz(fazy.join(','), '2').kod, 1)
  assert.match(gotowosc(k, ZADANIE, { narzedzia }).spojnosc.powod, /^przegląd spójności ma otwarte pozycje \(2\)/)
  assert.equal(zapisz(fazy[0] ?? '', '0').kod, 1)
  assert.match(gotowosc(k, ZADANIE, { narzedzia }).spojnosc.powod, new RegExp(`^fazy bez przeglądu spójności: ${fazy.slice(1).join(', ')}`))
  assert.deepEqual(zapisz('1,99', '0').json.bledy, [`fazy spoza planu: 99 (plan ma: ${fazy.join(', ')})`])
  assert.equal(cli(k, ['spojnosc', PLAN, '--zapisz', '--fazy', '1']).kod, 2, 'zapis bez --otwarte to zle argumenty')

  const ok = zapisz(fazy.join(','), '0')
  assert.deepEqual([ok.kod, ok.json.ok], [0, true])
  const zapis = JSON.parse(readFileSync(join(k, PLAN.replace(/\.md$/, '.spojnosc.json')), 'utf8'))
  assert.deepEqual([zapis.plan, zapis.fazy, zapis.otwarte], [PLAN, fazy, 0])
  git(k, ['add', '-A'])
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'docs: przeglad'])
  assert.equal(gotowosc(k, ZADANIE, { narzedzia }).spojnosc.ok, true)

  // Execute odhacza scenariusze w planie technicznym po fazie: odcisk bez stanu checkboxow zostaje ten sam.
  const plan = readFileSync(join(k, PLAN), 'utf8')
  assert.ok(/^\s*- \[ \]/m.test(plan), 'fixture ma checkboxy')
  writeFileSync(join(k, PLAN), plan.replace(/^(\s*- )\[ \]/gm, '$1[x]').replace(/\n/g, '\r\n'))
  assert.equal(gotowosc(k, ZADANIE, { narzedzia }).spojnosc.ok, true, 'odhaczenia i CRLF nie zmieniaja odcisku')
  // Zmiana tresci planu po przegladzie wymaga przegladu od nowa.
  writeFileSync(join(k, PLAN), plan.replace('## Granice zakresu', '## Granice zakresu\n\n- nowe wykluczenie'))
  assert.match(gotowosc(k, ZADANIE, { narzedzia }).spojnosc.powod, /^plan zmieniony po przeglądzie spójności/)
}))

// Weryfikacja partii 26–45, punkt 53: domkniecie fazy dopisywalo decyzje do planu, a odcisk liczyl kazda zmiane poza `- [x]`/`* [x]`
// — bramka po wznowieniu byla czerwona bez winy operatora. Mutacja odcisku wycinajaca cale linie z checkboxem przechodzila testy.
test('odciskPlanu: odhaczenia w kazdej postaci listy, biale znaki, CRLF, BOM i sekcja realizacji nie zmieniaja odcisku; tresc tak', () => {
  const plan = [
    '# Plan', '', '## Podejście', '', 'Lista ofert z filtrem.', '', '## Faza 1', '',
    '- [ ] Test: [E2E] `a` — lista', '* [ ] Weryfikacja: lint', '1. [ ] krok numerowany', '2) [ ] krok z nawiasem',
    '+ [ ] krok z plusem', '> - [ ] w cytacie', '  - [ ] wciety', '', '## Granice zakresu', '', '- bez płatności', '',
  ].join('\n')
  const bazowy = odciskPlanu(plan)
  const odhaczony = plan.replace(/\[ \]/g, '[x]')
  assert.equal(odhaczony.split('[x]').length, 8, 'siedem postaci listy odhaczonych')
  for (const [opis, wariant] of /** @type {[string, string][]} */ ([
    ['odhaczenie - * 1. 2) + > i wciecie', odhaczony],
    ['duze X', plan.replace(/\[ \]/g, '[X]')],
    ['spacja i tabulator na koncu linii', plan.replace('Lista ofert z filtrem.', 'Lista ofert z filtrem. \t')],
    ['dodatkowe \\n na koncu', `${plan}\n\n`],
    ['brak \\n na koncu', plan.replace(/\n+$/, '')],
    ['CRLF', plan.replace(/\n/g, '\r\n')],
    ['BOM', `\uFEFF${plan}`],
    ['sekcja realizacji na koncu', `${plan}\n${SEKCJA_REALIZACJI}\n\n- faza 1, IU-1: mail bez imienia (Granice)\n`],
    ['sekcja realizacji z podsekcja', `${plan}\n${SEKCJA_REALIZACJI}\n\n### Faza 1\n\n- faza 1, IU-2: x\n`],
    // Walidacja 51–55, punkt 61: naglowek sekcji w postaci, w jakiej napisze go agent domkniecia.
    ['sekcja realizacji poziomu 3', `${plan}\n### Decyzje z realizacji\n\n- faza 1, IU-1: x\n`],
    ['sekcja realizacji z dwukropkiem i mala litera', `${plan}\n##  decyzje z realizacji: \n\n- faza 1, IU-1: x\n`],
    ['sekcja realizacji poziomu 3 w srodku, konczy ja naglowek poziomu 3', plan.replace('## Granice zakresu', '### Decyzje z realizacji\n- x\n#### szczegol\n- y\n\n## Granice zakresu')],
  ])) assert.equal(odciskPlanu(wariant), bazowy, opis)
  // Checkbox w komorce tabeli: odhaczenie nie zmienia odcisku, zmiana tresci wiersza tak.
  const zTabela = `${plan}\n| Stan | Krok |\n|---|---|\n| [ ] | migracja |\n|[ ]| seed |\n`
  assert.equal(odciskPlanu(zTabela.replace('| [ ] |', '| [x] |').replace('|[ ]|', '|[X]|')), odciskPlanu(zTabela), 'odhaczenie w tabeli')
  assert.notEqual(odciskPlanu(zTabela.replace('migracja', 'migracja danych')), odciskPlanu(zTabela), 'tresc wiersza tabeli')
  assert.notEqual(odciskPlanu(zTabela), bazowy, 'tabela jest trescia planu')

  for (const [opis, wariant] of /** @type {[string, string][]} */ ([
    ['zmiana tekstu pozycji z checkboxem', plan.replace('`a` — lista', '`a` — lista z filtrem')],
    ['zmiana tekstu pozycji numerowanej', plan.replace('krok numerowany', 'krok inny')],
    ['usuniecie pozycji z checkboxem', plan.replace('+ [ ] krok z plusem\n', '')],
    ['nowa pozycja', plan.replace('  - [ ] wciety', '  - [ ] wciety\n- [ ] Test: nowy')],
    ['zmiana w Podejsciu', plan.replace('Lista ofert z filtrem.', 'Lista ofert bez filtra.')],
    ['linia w nowej sekcji po sekcji realizacji', `${plan}\n${SEKCJA_REALIZACJI}\n\n- faza 1: x\n\n## Inna\n\n- nowe\n`],
    ['sekcja o innej nazwie', `${plan}\n## Decyzje z realizacji fazy 2\n\n- x\n`],
    ['sekcja realizacji poziomu 3: naglowek tego samego poziomu ja konczy', `${plan}\n### Decyzje z realizacji\n\n- x\n\n### Inna\n\n- nowe\n`],
    ['naglowek poziomu 1 o tej nazwie to nie sekcja', `${plan}\n# Decyzje z realizacji\n\n- x\n`],
  ])) assert.notEqual(odciskPlanu(wariant), bazowy, opis)
})

// Punkt 53, krok B2: domkniecie fazy pisze decyzje korygujace plan tylko do sekcji realizacji na koncu planu. Parser zamyka
// faze i jednostke na kazdym `## `, wiec sekcja nie zmienia ani walidacji planu, ani struktury pliku zadan (odswiez).
test('sekcja „Decyzje z realizacji” na koncu planu: sprawdz bez zmian, odswiez nie widzi roznicy; prompt domkniecia ja nazywa', () => wRepo((k) => {
  zadanieNaGalezi(k)
  const przed = cli(k, ['sprawdz', PLAN])
  writeFileSync(join(k, PLAN), `${readFileSync(join(k, PLAN), 'utf8').replace(/\n*$/, '\n')}\n${SEKCJA_REALIZACJI}\n\n- faza 1, IU-1: mail bez imienia (Granice wygrywaja ze scenariuszem)\n- faza 2, IU-3: [x] lista bez filtra\n`)
  const po = cli(k, ['sprawdz', PLAN])
  assert.deepEqual([po.kod, po.json], [przed.kod, przed.json])
  const odsw = cli(k, ['odswiez', ZADANIE])
  assert.match(String(odsw.json.odmowa), /^plan względem HEAD nie zmienia pliku zadań/)
  const execute = readFileSync(resolve(KATALOG, '../../../workflows/dev-docs-execute-wf.js'), 'utf8')
  const domkniecie = execute.slice(execute.indexOf('function domknieciePrompt('), execute.indexOf('\n}\n', execute.indexOf('function domknieciePrompt(')))
  assert.ok(domkniecie.includes(`\\\`${SEKCJA_REALIZACJI}\\\``), 'prompt domkniecia nazywa sekcje stala ze spojnosc.mjs')
  const skillPlanu = readFileSync(resolve(KATALOG, '../../../skills/dev-plan/SKILL.md'), 'utf8')
  assert.ok(skillPlanu.includes(`odcisk planu bez stanu checkboxów i bez sekcji \`${SEKCJA_REALIZACJI}\``), 'skill /dev-plan 6.2b opisuje odcisk')
  assert.ok(skillPlanu.includes(`(odhaczenia i sekcja \`${SEKCJA_REALIZACJI}\` go nie zmieniają, zmiana treści tak)`), 'skill /dev-plan 6.6')
  assert.match(skillPlanu, /Autopilot sprawdza to samo na starcie \(`plan\.mjs blokery`\): świeże zadanie bez ważnego przeglądu kończy STOP-em, zadanie w toku dostaje uwagę;/)
  assert.match(domkniecie, /trafia WYLACZNIE do sekcji \\`## Decyzje z realizacji\\` na koncu planu \(brak sekcji = utworz ja jako ostatnia\), jedna linia\n {3}na decyzje: \\`- faza \$\{faza\}, IU-x: <decyzja>\\`\. Poza ta sekcja w planie zmieniasz tylko stan checkboxow/)
}))

// Analiza vibersi audyt-paczki-1-2 (decyzja operatora 2026-11-13): po piatym czytaniu fazy 3 sesja naniosla poprawki i zapisala
// --otwarte 0 bez ponownego czytania. Koncowy zapis porownuje odcisk kazdej fazy z ostatnim czystym czytaniem.
test('spojnosc: --otwarte 0 bez czystego czytania albo po zmianie fazy odmawia; --bez-czytania daje zielona bramke z zastrzezeniem', () => wRepo((k) => {
  const narzedzia = { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) }
  zadanieNaGalezi(k, { przeglad: false })
  const fazy = fazyPlanu(k).split(',')
  const zapisz = (/** @type {string[]} */ dodatkowe = []) => cli(k, ['spojnosc', PLAN, '--zapisz', '--fazy', fazy.join(','), '--otwarte', '0', ...dodatkowe])
  const nigdy = zapisz()
  assert.equal(nigdy.kod, 1)
  assert.match(nigdy.json.bledy[0], new RegExp(`^fazy ${fazy.map((f) => `${f} \\(bez czystego czytania\\)`).join(', ')} — przed zapisem z --otwarte 0`))
  assert.ok(!existsSync(join(k, PLAN.replace(/\.md$/, '.spojnosc.json'))), 'odmowa niczego nie zapisuje')

  czysteCzytania(k)
  // Poprawka w fazie 2 po czystym czytaniu (jak w vibersi: trzy poprawki po piatym czytaniu fazy 3).
  const plan = readFileSync(join(k, PLAN), 'utf8')
  const iuFazy2 = /### Faza 2[\s\S]*?\*\*Podejście:\*\*\n/.exec(plan)?.[0] ?? ''
  assert.ok(iuFazy2, 'fixture ma Podejście w fazie 2')
  writeFileSync(join(k, PLAN), plan.replace(iuFazy2, `${iuFazy2}- poprawka po przeglądzie: przycisk nieaktywny bez tytułu\n`))
  const poZmianie = zapisz()
  assert.equal(poZmianie.kod, 1)
  assert.match(poZmianie.json.bledy[0], /^fazy 2 \(zmieniona po ostatnim czytaniu\)/)
  assert.equal(zapisz(['--bez-czytania', '99']).kod, 1, 'faza spoza planu w --bez-czytania')
  assert.equal(cli(k, ['spojnosc', PLAN, '--bez-czytania', '2']).kod, 2, '--bez-czytania bez --zapisz')

  // Zgoda operatora: faza 2 zamknieta bez czytania — bramka zielona z zastrzezeniem, autopilot dostaje powod.
  const ok = zapisz(['--bez-czytania', '2'])
  assert.deepEqual([ok.kod, ok.json.ok, ok.json.zastrzezenie], [0, true, 'faza 2 zmieniona po ostatnim czytaniu (decyzja operatora)'])
  const zapis = JSON.parse(readFileSync(join(k, PLAN.replace(/\.md$/, '.spojnosc.json')), 'utf8'))
  assert.deepEqual([zapis.bezCzytania, Object.keys(zapis.czytania)], [['2'], fazy])
  git(k, ['add', '-A'])
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'docs: przeglad'])
  const g = gotowosc(k, ZADANIE, { narzedzia }).spojnosc
  assert.deepEqual([g.ok, g.zastrzezenie, g.powod], [true, 'faza 2 zmieniona po ostatnim czytaniu (decyzja operatora)',
    'OK z zastrzeżeniem: faza 2 zmieniona po ostatnim czytaniu (decyzja operatora)'])
  assert.deepEqual(cli(k, ['blokery', ZADANIE]).json.spojnosc, { ok: true, powod: 'OK z zastrzeżeniem: faza 2 zmieniona po ostatnim czytaniu (decyzja operatora)' })

  // Kolejne czyste czytanie fazy 2 zdejmuje zastrzezenie przy nastepnym zapisie.
  czysteCzytania(k, ['2'])
  const czysty = zapisz()
  assert.deepEqual([czysty.kod, czysty.json.zastrzezenie, czysty.json.powod], [0, '', ''])
  // --otwarte > 0 nie wymaga czytan (bramka i tak czerwona).
  assert.equal(cli(k, ['spojnosc', PLAN, '--zapisz', '--fazy', fazy.join(','), '--otwarte', '1']).kod, 1)
  assert.match(gotowosc(k, ZADANIE, { narzedzia }).spojnosc.powod, /^przegląd spójności ma otwarte pozycje \(1\)/)
}))

// Zgodnosc wstecz: zadania w toku maja zapisy sprzed odciskow faz (bez czytania i bezCzytania) — bramka czyta je jak dawniej.
test('spojnosc: stary zapis bez czytan faz przechodzi bramke i blokery jak dawniej; zapis samych czytan = przeglad w toku', () => wRepo((k) => {
  const narzedzia = { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) }
  zadanieNaGalezi(k, { przeglad: false })
  const tresc = readFileSync(join(k, PLAN), 'utf8')
  const plik = join(k, PLAN.replace(/\.md$/, '.spojnosc.json'))
  writeFileSync(plik, `${JSON.stringify({ plan: PLAN, odcisk: odciskPlanu(tresc), data: '2026-11-01', fazy: fazyPlanu(k).split(','), otwarte: 0 }, null, 2)}\n`)
  git(k, ['add', '-A'])
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'docs: stary przeglad'])
  const g = gotowosc(k, ZADANIE, { narzedzia }).spojnosc
  assert.deepEqual([g.ok, g.zastrzezenie, g.powod], [true, '', ''])
  assert.deepEqual(cli(k, ['blokery', ZADANIE]).json.spojnosc, { ok: true, powod: '' })
  // Sesja zaczela czytania, koncowego zapisu jeszcze nie ma.
  rmSync(plik)
  assert.equal(cli(k, ['spojnosc', PLAN, '--faza', '1', '--czytanie']).kod, 0)
  assert.match(cli(k, ['blokery', ZADANIE]).json.spojnosc.powod, /^przegląd spójności w toku — brak końcowego zapisu/)
}))

// 4b: recenzent tury 2+ czyta zmienione pola fazy zamiast calej fazy od zera; dziala bez gita (plan przed commitem inicjalnym).
test('spojnosc --faza: czytanie liczy tury i roznice pol, --roznica wypisuje pola zmienione miedzy czytaniami, --czysta wymaga czytania', () => wRepo((k) => {
  rmSync(join(k, '.git'), { recursive: true, force: true })
  const tura1 = cli(k, ['spojnosc', PLAN, '--faza', '1', '--czytanie'])
  assert.deepEqual([tura1.kod, tura1.json.tura, tura1.json.roznica, tura1.json.poLimicie], [0, 1, null, false])
  assert.deepEqual(cli(k, ['spojnosc', PLAN, '--faza', '1', '--roznica']).json.roznica, null, 'pierwsza tura: cala faza')
  assert.equal(cli(k, ['spojnosc', PLAN, '--faza', '2', '--czysta']).kod, 1, 'czysta bez czytania')
  assert.match(cli(k, ['spojnosc', PLAN, '--faza', '2', '--czysta']).json.bledy[0], /^faza 2 bez zapisanego czytania/)

  const plan = readFileSync(join(k, PLAN), 'utf8')
  const podejscie = /### Faza 1[\s\S]*?\*\*Podejście:\*\*\n/.exec(plan)?.[0] ?? ''
  writeFileSync(join(k, PLAN), plan.replace(podejscie, `${podejscie}- nowa decyzja w podejściu\n`).replace(/^(\s*- )\[ \]/gm, '$1[x]'))
  const tura2 = cli(k, ['spojnosc', PLAN, '--faza', '1', '--czytanie'])
  assert.equal(tura2.json.tura, 2)
  assert.deepEqual(tura2.json.roznica, [{ pole: 'IU-1/podejscie', zmiana: 'zmienione' }], 'odhaczenia nie sa zmiana pola')
  const r = cli(k, ['spojnosc', PLAN, '--faza', '1', '--roznica']).json
  assert.deepEqual([r.tura, r.roznica, r.uwagi], [2, [{ pole: 'IU-1/podejscie', zmiana: 'zmienione' }], []])
  // Zmiana po zapisie czytania: roznica zostaje z czytan, uwaga mowi o zmianie od czytania.
  writeFileSync(join(k, PLAN), readFileSync(join(k, PLAN), 'utf8').replace('**Zależy od:** Brak', '**Zależy od:** Brak (fundament)'))
  assert.match(cli(k, ['spojnosc', PLAN, '--faza', '1', '--roznica']).json.uwagi[0], /^faza 1 zmieniła się od zapisu czytania w turze 2/)
  const czysta = cli(k, ['spojnosc', PLAN, '--faza', '1', '--czysta'])
  assert.deepEqual([czysta.kod, czysta.json.tura], [0, 2])
  assert.match(czysta.json.uwagi[0], /^faza 1 zmieniła się od czytania w turze 2/)
  for (let t = 3; t <= 4; t += 1) assert.equal(cli(k, ['spojnosc', PLAN, '--faza', '1', '--czytanie']).json.poLimicie, t > 3, `tura ${t}`)

  assert.equal(cli(k, ['spojnosc', PLAN, '--faza', '1']).kod, 2, '--faza bez trybu')
  assert.equal(cli(k, ['spojnosc', PLAN, '--faza', '1', '--czytanie', '--czysta']).kod, 2, 'dwa tryby')
  assert.equal(cli(k, ['spojnosc', PLAN, '--czytanie']).kod, 2, 'tryb bez --faza')
  assert.deepEqual(cli(k, ['spojnosc', PLAN, '--faza', '9', '--czytanie']).json.bledy, [`fazy spoza planu: 9 (plan ma: ${fazyPlanu(k).split(",").join(", ")})`])
}))

test('odciskFazy i polaFazy: sekcja fazy do nastepnej fazy albo naglowka ##; zmiana innej fazy, checkboxy i sekcja realizacji — bez zmiany', () => {
  const plan = ['# P', '', '## Implementation Units', '', '### Faza 1 — A', '', '**Zależy od:** Brak', '', '- [ ] **IU-1: x**', '',
    '**Podejście:**', '- a', '', '**Scenariusze testowe:**', '- [ ] [Unit] t', '', '```', '### Faza 9 — w kodzie', '```', '',
    '### Faza 2 — B', '', '**Zależy od:** Faza 1', '', '#### IU-2: y', '', '**Podejście:**', '- b', '', '## Ryzyka', '', '- r', ''].join('\n')
  const f1 = odciskFazy(plan, '1')
  assert.equal(odciskFazy(plan, '9'), null, 'naglowek w bloku kodu to nie faza')
  assert.equal(odciskFazy(plan.replace('- b', '- b2'), '1'), f1, 'zmiana fazy 2')
  assert.equal(odciskFazy(plan.replace('- r', '- r2'), '2'), odciskFazy(plan, '2'), 'sekcja ## Ryzyka poza faza')
  assert.equal(odciskFazy(plan.replace('- [ ] [Unit]', '- [x] [Unit]').replace('- [ ] **IU-1', '- [x] **IU-1'), '1'), f1, 'odhaczenia')
  assert.equal(odciskFazy(`${plan}\n${SEKCJA_REALIZACJI}\n\n- faza 1, IU-1: x\n`, '1'), f1, 'sekcja realizacji')
  assert.notEqual(odciskFazy(plan.replace('- a', '- a2'), '1'), f1)
  assert.deepEqual(Object.keys(polaFazy(plan, '1') ?? {}), ['faza/naglowek', 'IU-1/naglowek', 'IU-1/podejscie', 'IU-1/scenariusze testowe'])
  assert.deepEqual(Object.keys(polaFazy(plan, '2') ?? {}), ['faza/naglowek', 'IU-2/naglowek', 'IU-2/podejscie'])
  assert.deepEqual(roznicaPol(polaFazy(plan, '1'), polaFazy(plan.replace('- a', '- a2').replace('**Scenariusze testowe:**\n- [ ] [Unit] t\n', ''), '1') ?? {}),
    [{ pole: 'IU-1/podejscie', zmiana: 'zmienione' }, { pole: 'IU-1/scenariusze testowe', zmiana: 'usunięte' }])
  assert.deepEqual(roznicaPol(null, {}), [])
})

// Zgodnosc wstecz decyzji startowych: zadanie zaplanowane przed polami glebokosc/research_zewnetrzny/dotyka_ui nie staje
// w bramce gotowosci ani w odswiez (autopilot woła blokery, ktore walidacji planu nie robia); nowy plan — blad w sprawdz.
test('decyzje startowe: plan zadania w toku bez pol — gotowosc i odswiez daja uwagi, nie bledy; sprawdz takiego planu — bledy', () => wRepo((k) => {
  const narzedzia = { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) }
  zadanieNaGalezi(k)
  const stary = readFileSync(join(k, PLAN), 'utf8').replace(/^(glebokosc|research_zewnetrzny|dotyka_ui):.*\n/gm, '')
  writeFileSync(join(k, PLAN), stary)
  git(k, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'docs: plan sprzed decyzji startowych'])
  const g = gotowosc(k, ZADANIE, { narzedzia }).plan
  assert.deepEqual(g.bledy, [])
  assert.equal(g.uwagi.filter((u) => /^frontmatter: (glebokosc|research_zewnetrzny|dotyka_ui)/.test(u)).length, 3)
  writeFileSync(join(k, PLAN), stary.replace('## Granice zakresu', '## Granice zakresu\n\n- nowe wykluczenie'))
  const odsw = cli(k, ['odswiez', ZADANIE])
  assert.deepEqual(odsw.json.bledy, [])
  assert.equal(cli(k, ['sprawdz', PLAN]).json.bledy.filter((/** @type {string} */ b) => /^frontmatter: (glebokosc|research_zewnetrzny|dotyka_ui)/.test(b)).length, 3)
}))
