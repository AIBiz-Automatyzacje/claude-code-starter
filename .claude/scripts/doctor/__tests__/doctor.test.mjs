// Test doctor.sh (PLAN-POPRAWY P2): lista narzedzi wyliczana z projektu, tabela, kod wyjscia jak bramka (A3) —
// podlozony brak obowiazkowego → exit ≠ 0, przywrocenie → exit 0. Projekt i HOME to katalogi-fixture, PATH podmieniony
// na katalog z atrapami narzedzi + dowiazaniami do narzedzi systemowych, ktorych uzywa sam skrypt.

import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { DOMYSLNY_PORT, NARZEDZIE_JAZDY, OPIS_PORTU_DEV, PORT_DEV, uwagaDoctora } from '../../e2e/adapter.mjs'
import { PROFIL } from '../../stack/profil.mjs'

const SKRYPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'doctor.sh')
const REPO_DOCTORA = dirname(SKRYPT)
// Adres Supabase klienta z profilu stacku (IU-1.7): test przechodzi na kazdym wariancie profilu.
const ADRES_SUPABASE = JSON.parse(readFileSync(resolve(dirname(SKRYPT), '..', '..', 'stack', 'profil.json'), 'utf8')).env.adresSupabase
const NARZEDZIA_SYSTEMOWE = ['cat', 'dirname', 'find', 'grep', 'head', 'tail', 'tr']

/** @typedef {{ katalog: string, projekt: string, dom: string, bin: string }} Srodowisko */

/** @returns {Srodowisko} */
function srodowisko() {
  const katalog = mkdtempSync(join(tmpdir(), 'doctor-'))
  const projekt = join(katalog, 'projekt')
  const dom = join(katalog, 'dom')
  const bin = join(katalog, 'bin')
  for (const k of [projekt, dom, bin]) mkdirSync(k)
  for (const n of NARZEDZIA_SYSTEMOWE) {
    symlinkSync(execFileSync('/bin/sh', ['-c', `command -v ${n}`], { encoding: 'utf8' }).trim(), join(bin, n))
  }
  symlinkSync(process.execPath, join(bin, 'node'))
  atrapa(bin, 'git', 'echo "git version 2.39.5"')
  atrapa(bin, 'gh', '[ "$1" = auth ] && exit 0; echo "gh version 2.80.0"')
  return { katalog, projekt, dom, bin }
}

/** @param {string} bin @param {string} nazwa @param {string} tresc */
function atrapa(bin, nazwa, tresc) {
  writeFileSync(join(bin, nazwa), `#!/bin/sh\n${tresc}\n`)
  chmodSync(join(bin, nazwa), 0o755)
}

/** @param {Srodowisko} s */
function doctor(s, dodatkowe = {}) {
  return spawnSync('/bin/bash', [SKRYPT, s.projekt], {
    encoding: 'utf8',
    env: { PATH: s.bin, HOME: s.dom, ...dodatkowe },
  })
}

/** @param {string} wyjscie @param {string} element */
function wiersz(wyjscie, element) {
  const linia = wyjscie.split('\n').find((l) => l.startsWith(`| ${element} |`))
  assert.ok(linia, `brak wiersza "${element}" w:\n${wyjscie}`)
  return linia.split('|').slice(1, -1).map((k) => k.trim())
}

/** @param {(s: Srodowisko) => void} cialo */
function zSrodowiskiem(cialo) {
  const s = srodowisko()
  try {
    cialo(s)
  } finally {
    rmSync(s.katalog, { recursive: true, force: true })
  }
}

test('doctor.sh: skladnia bash poprawna', () => {
  const wynik = spawnSync('bash', ['-n', SKRYPT], { encoding: 'utf8' })
  assert.equal(wynik.status, 0, wynik.stderr)
})

test('komplet narzedzi bazowych → tabela z wersjami i exit 0', () => zSrodowiskiem((s) => {
  const w = doctor(s)
  assert.equal(w.status, 0, w.stdout + w.stderr)
  assert.deepEqual(wiersz(w.stdout, 'git').slice(0, 3), ['git', 'OK', 'git version 2.39.5'])
  assert.deepEqual(wiersz(w.stdout, 'gh').slice(0, 2), ['gh', 'OK'])
  assert.equal(wiersz(w.stdout, 'node')[1], 'OK')
  assert.match(w.stdout, /WYNIK: OK/)
}))

test('podlozony brak gh → BRAK z komenda instalacji i exit ≠ 0; przywrocenie → exit 0', () => zSrodowiskiem((s) => {
  rmSync(join(s.bin, 'gh'))
  const brak = doctor(s)
  assert.notEqual(brak.status, 0)
  assert.deepEqual(wiersz(brak.stdout, 'gh').slice(0, 2), ['gh', 'BRAK'])
  assert.match(wiersz(brak.stdout, 'gh')[3], /brew install gh/)
  assert.match(brak.stdout, /WYNIK: BRAK obowiązkowych: gh/)

  atrapa(s.bin, 'gh', '[ "$1" = auth ] && exit 0; echo "gh version 2.80.0"')
  assert.equal(doctor(s).status, 0)
}))

test('gh bez logowania → BRAK z "gh auth login"', () => zSrodowiskiem((s) => {
  atrapa(s.bin, 'gh', '[ "$1" = auth ] && exit 1; echo "gh version 2.80.0"')
  const w = doctor(s)
  assert.notEqual(w.status, 0)
  assert.deepEqual(wiersz(w.stdout, 'gh').slice(1, 4), ['BRAK', 'gh version 2.80.0 — niezalogowany', 'gh auth login'])
}))

/** @param {string} katalog @param {string} sciezka @param {string} tresc */
function plik(katalog, sciezka, tresc) {
  mkdirSync(dirname(join(katalog, sciezka)), { recursive: true })
  writeFileSync(join(katalog, sciezka), tresc)
}

test('menedzer z lockfile: pnpm-lock.yaml wymaga pnpm, bez lockfile — nie dotyczy', () => zSrodowiskiem((s) => {
  assert.equal(wiersz(doctor(s).stdout, 'menedżer pakietów')[1], 'nie dotyczy')

  plik(s.projekt, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n")
  const brak = doctor(s)
  assert.notEqual(brak.status, 0)
  assert.deepEqual(wiersz(brak.stdout, 'pnpm').slice(1, 3), ['BRAK', 'brak w PATH (lockfile: pnpm-lock.yaml)'])

  atrapa(s.bin, 'pnpm', 'echo 10.28.1')
  const jest = doctor(s)
  assert.equal(jest.status, 0, jest.stdout)
  assert.deepEqual(wiersz(jest.stdout, 'pnpm').slice(1, 3), ['OK', '10.28.1'])
}))

test('jq obowiazkowy tylko, gdy hook projektu go wola', () => zSrodowiskiem((s) => {
  plik(s.projekt, '.claude/hooks/bez-jq.sh', '#!/bin/sh\necho ok\n')
  assert.equal(wiersz(doctor(s).stdout, 'jq')[1], 'nie dotyczy')

  plik(s.projekt, '.claude/hooks/z-jq.sh', '#!/bin/sh\njq -r .session_id\n')
  const brak = doctor(s)
  assert.notEqual(brak.status, 0)
  assert.equal(wiersz(brak.stdout, 'jq')[1], 'BRAK')
}))

test('projekt z supabase/ wymaga supabase CLI, bez — nie', () => zSrodowiskiem((s) => {
  const bez = doctor(s)
  assert.equal(bez.status, 0)
  assert.equal(wiersz(bez.stdout, 'supabase')[1], 'nie dotyczy')

  mkdirSync(join(s.projekt, 'supabase'))
  const brak = doctor(s)
  assert.notEqual(brak.status, 0)
  assert.equal(wiersz(brak.stdout, 'supabase')[1], 'BRAK')

  atrapa(s.bin, 'supabase', 'echo 2.106.0')
  assert.equal(doctor(s).status, 0)
}))

test('checkbox [E2E] w docs/ wymaga narzedzia jazdy w PATH; sam lokalny w node_modules/.bin to BRAK', () => zSrodowiskiem((s) => {
  const { nazwa, instalacja } = NARZEDZIE_JAZDY
  plik(s.projekt, 'docs/active/x/x-zadania.md', '- [x] Test: [Unit] cos\n')
  assert.equal(wiersz(doctor(s).stdout, nazwa)[1], 'nie dotyczy')

  plik(s.projekt, 'docs/active/x/x-zadania.md', '- [ ] Test: [E2E] `logowanie` — /login → panel\n')
  const brak = doctor(s)
  assert.notEqual(brak.status, 0)
  assert.equal(wiersz(brak.stdout, nazwa)[1], 'BRAK')

  // skill narzedzia i feature-tester-e2e wolaja gola komende — lokalna kopia poza PATH run nie znajdzie
  plik(s.projekt, `node_modules/.bin/${nazwa}`, `#!/bin/sh\necho "${nazwa} 0.31.1"\n`)
  chmodSync(join(s.projekt, `node_modules/.bin/${nazwa}`), 0o755)
  const lokalny = doctor(s)
  assert.notEqual(lokalny.status, 0, lokalny.stdout)
  assert.deepEqual(wiersz(lokalny.stdout, nazwa).slice(1),
    ['BRAK', `${nazwa} 0.31.1 tylko w node_modules/.bin — pipeline woła ${nazwa} z PATH`, instalacja])

  atrapa(s.bin, nazwa, `echo "${nazwa} 0.31.1"`)
  const globalny = doctor(s)
  assert.equal(globalny.status, 0, globalny.stdout)
  assert.deepEqual(wiersz(globalny.stdout, nazwa).slice(1, 3), ['OK', `${nazwa} 0.31.1`])
}))

test('Coolify i Dockerfile → coolify i docker jako UWAGA, nie blokuja', () => zSrodowiskiem((s) => {
  assert.equal(wiersz(doctor(s).stdout, 'coolify')[1], 'nie dotyczy')
  assert.equal(wiersz(doctor(s).stdout, 'docker')[1], 'nie dotyczy')

  plik(s.projekt, '.env.example', '# W Coolify oznacz jako zmienna builda\n')
  plik(s.projekt, 'Dockerfile', 'FROM node:22-alpine\n')
  // Config zgodny z kontraktem /dev-pr: inaczej higiena dodaje trzecia uwage (CodeRabbit).
  plik(s.projekt, 'CLAUDE.md', '# x\n')
  plik(s.projekt, '.coderabbit.yaml', ['language: pl-PL', 'reviews:', '  request_changes_workflow: false', '  review_status: true', '  auto_review:', '    enabled: true', '    auto_incremental_review: true',
    '    ignore_title_keywords:', '      - "chore(szablon)"', '  pre_merge_checks:', '    docstrings:', '      mode: "off"', '  path_filters:', '    - "!docs/**"', '    - "!.claude/**"', '    - "!**/CLAUDE.md"', 'knowledge_base:', '  code_guidelines:', '    filePatterns:', '      - "CLAUDE.md"', ''].join('\n'))
  const w = doctor(s)
  assert.equal(w.status, 0, w.stdout)
  assert.equal(wiersz(w.stdout, 'coolify')[1], 'UWAGA')
  assert.match(wiersz(w.stdout, 'coolify')[3], /install_coolify_cli\.sh|dokumentacji Coolify CLI/)
  assert.equal(wiersz(w.stdout, 'docker')[1], 'UWAGA')
  assert.match(w.stdout, /uwagi: 2\)/)
}))

test('coolify z komunikatem o aktualizacji → w tabeli sama wersja', () => zSrodowiskiem((s) => {
  plik(s.projekt, 'CLAUDE.md', 'Aplikacja na Coolify.\n')
  atrapa(s.bin, 'coolify', 'echo "A new version (1.8.0) is available. Update with: coolify update"; echo 1.4.0')
  assert.deepEqual(wiersz(doctor(s).stdout, 'coolify').slice(1, 3), ['OK', '1.4.0'])
}))

/** @param {string} katalog @param {string} sciezka @param {unknown} dane */
const json = (katalog, sciezka, dane) => plik(katalog, sciezka, JSON.stringify(dane))

test('plugin projektu: niezainstalowany → UWAGA z komenda per projekt, zainstalowany dla projektu → OK', () => zSrodowiskiem((s) => {
  assert.equal(wiersz(doctor(s).stdout, 'pluginy projektu')[1], 'nie dotyczy')

  json(s.projekt, '.claude/settings.json', {
    enabledPlugins: { 'figma@claude-plugins-official': true, 'design@inline': false },
  })
  const brak = doctor(s)
  assert.equal(brak.status, 0, brak.stdout)
  assert.deepEqual(wiersz(brak.stdout, 'plugin figma@claude-plugins-official').slice(1),
    ['UWAGA', 'nie zainstalowany', 'claude plugin install figma@claude-plugins-official --scope project'])
  assert.ok(!brak.stdout.includes('design@inline'))

  json(s.dom, '.claude/plugins/installed_plugins.json', {
    version: 2,
    plugins: { 'figma@claude-plugins-official': [{ scope: 'project', projectPath: s.projekt, version: '2.2.120' }] },
  })
  assert.deepEqual(wiersz(doctor(s).stdout, 'plugin figma@claude-plugins-official').slice(1, 3), ['OK', '2.2.120 (project)'])
}))

test('plugin zainstalowany dla innego projektu sie nie liczy; nieznany marketplace dochodzi do komendy', () => zSrodowiskiem((s) => {
  json(s.projekt, '.claude/settings.json', {
    extraKnownMarketplaces: { 'dev-browser-marketplace': { source: { source: 'github', repo: 'sawyerhood/dev-browser' } } },
    enabledPlugins: { 'dev-browser@dev-browser-marketplace': true },
  })
  json(s.dom, '.claude/plugins/installed_plugins.json', {
    version: 2,
    plugins: { 'dev-browser@dev-browser-marketplace': [{ scope: 'local', projectPath: join(s.katalog, 'inny'), version: '1.0.0' }] },
  })
  assert.deepEqual(wiersz(doctor(s).stdout, 'plugin dev-browser@dev-browser-marketplace').slice(1), [
    'UWAGA', 'nie zainstalowany',
    'claude plugin marketplace add sawyerhood/dev-browser && claude plugin install dev-browser@dev-browser-marketplace --scope project',
  ])
}))

// Komendy instalacji pluginów, które może włączyć profil szablonu (web albo wariant stacku, plan szablonu mobile z rdzenia).
// Plugin spoza tej listy zatrzymuje test: nowy plugin w profilu wymaga dopisania jego komendy tutaj.
const INSTALACJA_PLUGINOW_PROFILU = {
  'dev-browser@dev-browser-marketplace':
    'claude plugin marketplace add sawyerhood/dev-browser && claude plugin install dev-browser@dev-browser-marketplace --scope project',
  'figma@claude-plugins-official': 'claude plugin install figma@claude-plugins-official --scope project',
  'expo@claude-code-starter':
    'claude plugin marketplace add AIBiz-Automatyzacje/claude-code-starter && claude plugin install expo@claude-code-starter --scope project',
}

test('profil szablonu (.claude/settings.json): każdy plugin projektu z komendą instalacji per projekt, bez blokady', () => zSrodowiskiem((s) => {
  const profil = readFileSync(resolve(dirname(SKRYPT), '..', '..', 'settings.json'), 'utf8')
  plik(s.projekt, '.claude/settings.json', profil)
  const wlaczone = Object.entries(JSON.parse(profil).enabledPlugins ?? {}).filter(([, wl]) => wl === true).map(([id]) => id)
  assert.ok(wlaczone.includes('figma@claude-plugins-official'), 'warianty -figma builderów wymagają pluginu figma (D23)')
  const w = doctor(s)
  assert.equal(w.status, 0, w.stdout)
  for (const id of wlaczone) {
    assert.ok(id in INSTALACJA_PLUGINOW_PROFILU, `plugin ${id} bez oczekiwanej komendy instalacji w teście`)
    assert.deepEqual(wiersz(w.stdout, `plugin ${id}`).slice(1),
      ['UWAGA', 'nie zainstalowany', INSTALACJA_PLUGINOW_PROFILU[/** @type {keyof typeof INSTALACJA_PLUGINOW_PROFILU} */ (id)]], id)
  }
}))

test('profil szablonu: pluginy na koncu w kolejnosci zapisu Claude Code — install --scope project nie brudzi drzewa', () => {
  // Claude Code przy `claude plugin install --scope project` przepisuje plik z tymi kluczami na koncu (test na czystym koncie 2026-10-01);
  // inna kolejnosc = zmieniony .claude/settings.json po instalacji, a brudne drzewo zatrzymuje bootstrap autopilota.
  const profil = JSON.parse(readFileSync(resolve(dirname(SKRYPT), '..', '..', 'settings.json'), 'utf8'))
  assert.deepEqual(Object.keys(profil).slice(-2), ['enabledPlugins', 'extraKnownMarketplaces'])
})

test('plugin wylaczony w settings.local.json → nie dotyczy (lokalny plik wygrywa jak w Claude Code)', () => zSrodowiskiem((s) => {
  json(s.projekt, '.claude/settings.json', {
    enabledPlugins: { 'dev-browser@dev-browser-marketplace': true, 'figma@claude-plugins-official': true },
  })
  json(s.projekt, '.claude/settings.local.json', { enabledPlugins: { 'dev-browser@dev-browser-marketplace': false } })
  const w = doctor(s)
  assert.deepEqual(wiersz(w.stdout, 'plugin dev-browser@dev-browser-marketplace').slice(1, 3),
    ['nie dotyczy', 'wyłączony w .claude/settings.local.json'])
  assert.equal(wiersz(w.stdout, 'plugin figma@claude-plugins-official')[1], 'UWAGA')
}))

test('Dynamic Workflows: domyslnie wlaczone; enableWorkflows false w ustawieniach usera → BRAK; local wygrywa', () => zSrodowiskiem((s) => {
  assert.deepEqual(wiersz(doctor(s).stdout, 'Dynamic Workflows').slice(1, 3), ['OK', 'włączone (domyślnie)'])

  json(s.dom, '.claude/settings.json', { enableWorkflows: false })
  const wylaczone = doctor(s)
  assert.notEqual(wylaczone.status, 0)
  const w = wiersz(wylaczone.stdout, 'Dynamic Workflows')
  assert.equal(w[1], 'BRAK')
  assert.ok(w[2].includes(join(s.dom, '.claude', 'settings.json')), w[2])
  assert.match(w[3], /\/config/)

  json(s.projekt, '.claude/settings.local.json', { enableWorkflows: true })
  assert.equal(doctor(s).status, 0)
}))

test('telemetria swieza (zapis < 24 h) → OK bez skanu', () => zSrodowiskiem((s) => {
  plik(s.dom, '.claude/telemetry/pipeline.jsonl', '{"klucz":"x","typ":"run"}\n')
  const w = wiersz(doctor(s).stdout, 'telemetria')
  assert.deepEqual(w.slice(1, 3), ['OK', 'ostatni zapis < 24 h'])
  assert.equal(existsSync(join(s.dom, '.claude/telemetry/zbierz-znacznik.txt')), false, 'doctor puscil skan mimo swiezej telemetrii')
}))

test('telemetria bez zapisu z ostatniej doby → doctor uruchamia zbierz.mjs --skan', () => zSrodowiskiem((s) => {
  plik(s.dom, '.claude/telemetry/pipeline.jsonl', '{"klucz":"x","typ":"run"}\n')
  const dwieDobyTemu = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  utimesSync(join(s.dom, '.claude/telemetry/pipeline.jsonl'), dwieDobyTemu, dwieDobyTemu)
  const w = doctor(s)
  assert.equal(w.status, 0, w.stdout)
  assert.deepEqual(wiersz(w.stdout, 'telemetria').slice(1, 3), ['OK', 'brak zapisu z ostatniej doby — skan: runow: 0, sesji: 0, dopisanych: 0, bledow: 0'])
  assert.equal(existsSync(join(s.dom, '.claude/telemetry/zbierz-znacznik.txt')), true, 'skan nie ruszyl')
}))

// Znaleziska 2026-11-02 pkt 32 (dashboard, run E2, faza 4): wynik testu wypisal klucz z .env do transkryptu agenta. Skan robi
// telemetria z niemego hooka Stop, wiec operator widzi trafienie dopiero tu: UWAGA z komenda potwierdzenia, bez blokady runu.
test('klucz w transkryptach: trafienie skanu telemetrii → UWAGA z runem, wzorcem i komenda potwierdzenia; po potwierdzeniu wiersz znika', () => zSrodowiskiem((s) => {
  assert.doesNotMatch(doctor(s).stdout, /\| klucz w transkryptach \|/, 'bez pliku trafien nie ma wiersza')
  const rekord = (/** @type {string} */ run, /** @type {string} */ repo) => JSON.stringify({ klucz: `${run}|stripe-rk-live`, typ: 'klucz', ts: '2026-11-07T18:00:00.000Z', run, projekt: 'p', repo,
    katalog: `/x/${run}`, wzorzec: 'stripe-rk-live', pliki: ['agent-afab.jsonl'], trafien: 1, potwierdzone: null })
  plik(s.dom, '.claude/telemetry/klucze-transkryptow.jsonl', `${rekord('wf_2e0ed17c-f7b', s.projekt)}\n${rekord('wf_obcy', join(s.katalog, 'inny'))}\n`)
  const w = doctor(s)
  assert.deepEqual(wiersz(w.stdout, 'klucz w transkryptach').slice(1), ['UWAGA', 'w transkryptach runu wf_2e0ed17c-f7b jest wzorzec klucza stripe-rk-live (1 plik) — zrotuj klucz',
    'po rotacji: node .claude/scripts/telemetria/klucze.mjs --potwierdz wf_2e0ed17c-f7b'])
  assert.doesNotMatch(w.stdout, /wf_obcy/, 'run innego projektu')
  assert.equal(w.status, 0, 'uwaga o kluczu nie blokuje runu')

  const potwierdzenie = spawnSync(process.execPath, [resolve(REPO_DOCTORA, '..', 'telemetria', 'klucze.mjs'), '--potwierdz', 'wf_2e0ed17c-f7b'], { encoding: 'utf8', env: { HOME: s.dom } })
  assert.equal(potwierdzenie.status, 0, potwierdzenie.stderr)
  assert.doesNotMatch(doctor(s).stdout, /\| klucz w transkryptach \|/, 'po potwierdzeniu uwaga znika')
}))

// ── Bramki domkniecia (P6): devDependencies z .claude/templates/bramki/package.json w projekcie z konfiguracja z szablonu ──

/** @type {Record<string, string>} */
const WYMAGANE_BRAMKI = JSON.parse(readFileSync(resolve(dirname(SKRYPT), '..', '..', 'templates', 'bramki', 'package.json'), 'utf8')).devDependencies
const ESLINT_Z_SZABLONU = '// Konfiguracja ESLint z szablonu (.claude/templates/bramki) — w projekcie kopiuj jako eslint.config.ts\nexport default []\n'

/** @param {string} projekt @param {string} nazwa @param {string} wersja */
function zainstaluj(projekt, nazwa, wersja) {
  mkdirSync(join(projekt, 'node_modules', nazwa), { recursive: true })
  writeFileSync(join(projekt, 'node_modules', nazwa, 'package.json'), JSON.stringify({ name: nazwa, version: wersja }))
}

// Pilot mobile W6: wlasny eslint.config.js projektu dawal „nie dotyczy”, choc bramka ESLint biegla na jego regulach.
test('bramki: brak eslint.config.* → nie dotyczy; własny bez szablonu → UWAGA z drogą przejścia, bez blokady', () => zSrodowiskiem((s) => {
  assert.equal(wiersz(doctor(s).stdout, 'bramki domknięcia')[1], 'nie dotyczy')
  writeFileSync(join(s.projekt, 'eslint.config.js'), 'export default []\n')
  const w = doctor(s)
  const bramki = wiersz(w.stdout, 'bramki domknięcia')
  assert.equal(bramki[1], 'UWAGA')
  assert.match(bramki[2], /^własny eslint\.config\.js bez konfiguracji szablonu/)
  assert.match(bramki[3], /eslint\.config\.szablon\.ts/)
  assert.equal(w.status, 0)
}))

test('bramki: konfiguracja z szablonu bez zaleznosci → UWAGA z komenda instalacji dokladnych wersji; komplet → OK', () => zSrodowiskiem((s) => {
  writeFileSync(join(s.projekt, 'eslint.config.ts'), ESLINT_Z_SZABLONU)
  writeFileSync(join(s.projekt, 'pnpm-lock.yaml'), '')
  atrapa(s.bin, 'pnpm', 'echo 10.28.1')
  const brak = wiersz(doctor(s).stdout, 'bramki domknięcia')
  assert.equal(brak[1], 'UWAGA')
  assert.match(brak[2], /brak: .*eslint/)
  assert.match(brak[3], /^pnpm add -D -E .*typescript-eslint@8\.70\.1/)
  assert.equal(doctor(s).status, 0, 'brak zaleznosci bramek nie blokuje runu — bramki daja wtedy status brak')

  for (const [nazwa, wersja] of Object.entries(WYMAGANE_BRAMKI)) zainstaluj(s.projekt, nazwa, wersja)
  assert.equal(wiersz(doctor(s).stdout, 'bramki domknięcia')[1], 'OK')
}))

test('bramki: typescript >= 6.1 w projekcie → UWAGA (typescript-eslint i Stryker wymagaja API JS < 6.1)', () => zSrodowiskiem((s) => {
  writeFileSync(join(s.projekt, 'eslint.config.ts'), ESLINT_Z_SZABLONU)
  for (const [nazwa, wersja] of Object.entries(WYMAGANE_BRAMKI)) zainstaluj(s.projekt, nazwa, wersja)
  zainstaluj(s.projekt, 'typescript', '7.0.2')
  const w = wiersz(doctor(s).stdout, 'bramki domknięcia')
  assert.equal(w[1], 'UWAGA')
  assert.match(w[2], /typescript 7\.0\.2/)
}))

// Licznik warstwy stalej (PLAN-POPRAWY P11): pliki rol z blokiem `## Polecenia` w instalacji projektu — liczba polecen
// i naruszenia zasad pisania. Plik po sync-template zgodny = OK; plik zmieniony w projekcie, ktory lamie zasady = UWAGA,
// bez STOP-u (rola dziala, tylko jej warstwa stala odjechala od szablonu).
const ROLA_ZGODNA = '---\nname: a\ndescription: "a"\n---\n\nSzukasz defektow.\n\n## Polecenia\n\n- Wypisz drogi.\n- Zglaszaj finding.\n'

test('warstwa stala: brak plikow rol z blokiem polecen → nie dotyczy', () => zSrodowiskiem((s) => {
  mkdirSync(join(s.projekt, '.claude', 'agents'), { recursive: true })
  writeFileSync(join(s.projekt, '.claude', 'agents', 'stary.md'), '---\nname: s\n---\n\nYou are an expert.\n')
  assert.equal(wiersz(doctor(s).stdout, 'warstwa stała ról')[1], 'nie dotyczy')
}))

test('warstwa stala: zgodne pliki → OK z liczba plikow i polecen; naruszenie → UWAGA z plikiem, exit 0', () => zSrodowiskiem((s) => {
  const agenci = join(s.projekt, '.claude', 'agents')
  mkdirSync(agenci, { recursive: true })
  writeFileSync(join(agenci, 'a.md'), ROLA_ZGODNA)
  writeFileSync(join(agenci, 'b.md'), ROLA_ZGODNA.replace('- Zglaszaj finding.\n', '- Zglaszaj finding.\n- Licz.\n'))
  writeFileSync(join(agenci, 'stary.md'), '---\nname: s\n---\n\nYou are an expert.\n')
  const ok = wiersz(doctor(s).stdout, 'warstwa stała ról')
  assert.deepEqual(ok.slice(0, 3), ['warstwa stała ról', 'OK', '2 pliki ról, poleceń 5 (najwięcej 3: b.md), budżet 150 na plik'])

  writeFileSync(join(agenci, 'a.md'), ROLA_ZGODNA.replace('Szukasz defektow.', 'Szukasz defektow. Sprawdz plan. Zglaszaj.'))
  const w = doctor(s)
  const uwaga = wiersz(w.stdout, 'warstwa stała ról')
  assert.equal(uwaga[1], 'UWAGA')
  assert.match(uwaga[2], /^a\.md: mandat: 3 zdania/)
  assert.match(uwaga[3], /sync-template/)
  assert.equal(w.status, 0, 'naruszenie warstwy stalej nie blokuje runu')
}))

// P17: advisors biegnie na bazie e2e po migracjach fazy; w vibersi bez tokenu milczal przez dwie fazy z migracjami. Doctor
// mowi o tym przed runem — UWAGA (nie blokuje), z miejscem, gdzie wygenerowac token i gdzie go wpisac.
test('advisors: bez Supabase nie dotyczy; baza e2e bez tokenu → UWAGA z naprawa; token w .env.e2e → OK z ref', () => zSrodowiskiem((s) => {
  assert.equal(wiersz(doctor(s).stdout, 'advisors (baza e2e)')[1], 'nie dotyczy')
  writeFileSync(join(s.projekt, '.env.e2e'), `${ADRES_SUPABASE}=https://abcdefghijklmnopqrst.supabase.co\n`)
  const bezTokenu = wiersz(doctor(s).stdout, 'advisors (baza e2e)')
  assert.equal(bezTokenu[1], 'UWAGA')
  assert.match(bezTokenu[2], /brak SUPABASE_ACCESS_TOKEN/)
  assert.match(bezTokenu[3], /Access Tokens.*SUPABASE_ACCESS_TOKEN=<token> w \.env\.e2e/)
  writeFileSync(join(s.projekt, '.env.e2e'), `${ADRES_SUPABASE}=https://abcdefghijklmnopqrst.supabase.co\nSUPABASE_ACCESS_TOKEN=tajny\n`)
  const ok = doctor(s)
  assert.deepEqual(wiersz(ok.stdout, 'advisors (baza e2e)').slice(1, 3), ['OK', 'token i projekt e2e abcdefghijklmnopqrst'])
  assert.doesNotMatch(ok.stdout, /tajny/)
}))

// Pilot mobile W1/W8: tokeny kont w shellu operatora widzi kazda sesja i kazdy agent. Doctor mowi o tym bez wartosci.
test('tokeny kont: brak = OK; w srodowisku = UWAGA bez wartosci; zastapione w settings.local.json = OK; nie blokuje', () => zSrodowiskiem((s) => {
  assert.deepEqual(wiersz(doctor(s).stdout, 'tokeny kont w środowisku').slice(1, 3), ['OK', 'brak tokenów kont w środowisku'])
  const z = doctor(s, { SUPABASE_ACCESS_TOKEN: 'sbp_tajny', EXPO_TOKEN: 'expo_tajny' })
  const w = wiersz(z.stdout, 'tokeny kont w środowisku')
  assert.equal(w[1], 'UWAGA')
  assert.match(w[2], /SUPABASE_ACCESS_TOKEN \(konto Supabase: wszystkie projekty\); EXPO_TOKEN \(konto Expo/)
  assert.match(w[3], /"SUPABASE_ACCESS_TOKEN": "", "EXPO_TOKEN": "" \} w \.claude\/settings\.local\.json/)
  assert.doesNotMatch(z.stdout, /tajny/)
  assert.equal(z.status, 0, 'UWAGA nie blokuje runu')
  json(s.projekt, '.claude/settings.local.json', { env: { SUPABASE_ACCESS_TOKEN: 'atrapa' } })
  const czesc = wiersz(doctor(s, { SUPABASE_ACCESS_TOKEN: 'sbp_tajny', EXPO_TOKEN: 'expo_tajny' }).stdout, 'tokeny kont w środowisku')
  assert.equal(czesc[1], 'UWAGA')
  assert.doesNotMatch(czesc[2], /SUPABASE_ACCESS_TOKEN/)
  json(s.projekt, '.claude/settings.local.json', { env: { SUPABASE_ACCESS_TOKEN: 'atrapa', EXPO_TOKEN: '' } })
  assert.deepEqual(wiersz(doctor(s, { SUPABASE_ACCESS_TOKEN: 'sbp_tajny', EXPO_TOKEN: 'expo_tajny' }).stdout, 'tokeny kont w środowisku').slice(1, 3),
    ['OK', 'zastąpione w .claude/settings*.json: SUPABASE_ACCESS_TOKEN, EXPO_TOKEN'])
}))

// P19: w vibersi zwykly dev server Vite na 5173 zajal port E2E (domyslny do P19) i start przyjal go jako serwer aplikacji.
// Doctor mowi o porcie 5173 przed runem — UWAGA z naprawa (nie blokuje); domyslny port E2E (5174) i inny port = OK.
test('port E2E: bez .env.e2e nie dotyczy; domyslny i wlasny port → OK; rozny port w E2E_START → UWAGA z naprawa', () => zSrodowiskiem((s) => {
  assert.equal(wiersz(doctor(s).stdout, 'port E2E')[1], 'nie dotyczy')
  writeFileSync(join(s.projekt, '.env.e2e'), 'E2E_TEST_EMAIL=e2e@x.pl\n')
  assert.deepEqual(wiersz(doctor(s).stdout, 'port E2E').slice(1, 3), ['OK', `http://localhost:${DOMYSLNY_PORT}`])
  writeFileSync(join(s.projekt, '.env.e2e'), 'E2E_URL=http://127.0.0.1:3000\n')
  assert.deepEqual(wiersz(doctor(s).stdout, 'port E2E').slice(1, 3), ['OK', 'http://127.0.0.1:3000'])
  // Stary .env.e2e z samym E2E_START --port innym niz domyslny E2E_URL — UWAGA z naprawa zamiast „OK”.
  writeFileSync(join(s.projekt, '.env.e2e'), 'E2E_START="serwer --port 3999"\n')
  assert.deepEqual(wiersz(doctor(s).stdout, 'port E2E').slice(1, 4), ['UWAGA', `E2E_START uruchamia serwer na porcie 3999, a E2E_URL wskazuje port ${DOMYSLNY_PORT}`, `ustaw w .env.e2e E2E_URL=http://localhost:3999 albo zmien --port w E2E_START na ${DOMYSLNY_PORT}`])
}))

test('port deweloperski stacku w E2E_URL → UWAGA z naprawa na port domyslny, bez blokady runu (stack bez portu deweloperskiego: nie dotyczy)', { skip: PORT_DEV === null && 'stack bez osobnego portu deweloperskiego' }, () => zSrodowiskiem((s) => {
  writeFileSync(join(s.projekt, '.env.e2e'), `E2E_URL=http://localhost:${PORT_DEV}\n`)
  const w = doctor(s)
  const uwaga = wiersz(w.stdout, 'port E2E')
  assert.deepEqual(uwaga.slice(1, 2), ['UWAGA'])
  assert.ok(uwaga[2].startsWith(`http://localhost:${PORT_DEV} — ${PORT_DEV} to ${OPIS_PORTU_DEV}`), uwaga[2])
  assert.ok(uwaga[3].startsWith(`E2E_URL=http://localhost:${DOMYSLNY_PORT} w .env.e2e`), uwaga[3])
  assert.equal(w.status, 0, 'port deweloperski nie blokuje runu')
}))

test('uwaga stacku z adaptera: wiersz tylko, gdy adapter go zwraca', () => zSrodowiskiem((s) => {
  const w = spawnSync(process.execPath, [join(REPO_DOCTORA, 'uwaga-stacku.mjs'), s.projekt], { encoding: 'utf8' })
  assert.equal(w.status, 0, w.stderr)
  assert.equal(w.stdout, uwagaDoctora(s.projekt) ? `${uwagaDoctora(s.projekt)?.join('\t')}\n` : '')
  assert.equal(spawnSync(process.execPath, [join(REPO_DOCTORA, 'uwaga-stacku.mjs')], { encoding: 'utf8' }).status, 2)
}))

// Znaleziska 2026-11-02 pkt 26: dashboard (klient w frontend/, backend w Pythonie) i aa-exam (Drizzle) dostaja warstwe stacku
// z Supabase. Doctor mowi per element, czego wtedy nie stosowac; sygnal z pakietu pierwszego poziomu liczy sie jak z korzenia.
test('stack: Supabase — bez katalogu supabase/ i zaleznosci → nie dotyczy z lista, czego nie stosowac; sygnal w frontend/ albo supabase/ → bez wiersza', () => zSrodowiskiem((s) => {
  const bez = doctor(s)
  const w = wiersz(bez.stdout, 'stack: Supabase')
  assert.equal(w[1], 'nie dotyczy')
  assert.match(w[2], /brak katalogu supabase\/, supabase\/config\.toml, zależności @supabase\/\* i wpisu supabase w requirements\.txt\/pyproject\.toml/)
  for (const element of ['skilla supabase-dev-guidelines', 'komend supabase z roli buildera danych', 'reguł RLS', 'narzędziami projektu (plan, CLAUDE.md)']) {
    assert.ok(w[3].includes(element), `${element} w: ${w[3]}`)
  }
  assert.equal(bez.status, 0, 'informacja nie blokuje runu')
  json(s.projekt, 'frontend/package.json', { dependencies: { '@supabase/supabase-js': '2.50.0' } })
  assert.doesNotMatch(doctor(s).stdout, /\| stack: Supabase \|/)
  rmSync(join(s.projekt, 'frontend'), { recursive: true })
  mkdirSync(join(s.projekt, 'supabase'))
  atrapa(s.bin, 'supabase', 'echo 2.106.0')
  assert.doesNotMatch(doctor(s).stdout, /\| stack: Supabase \|/)
}))

// Sygnal drugiego wariantu bierze sie z profilu (szablon.innyWariant), wiec test przechodzi na kazdym wariancie profilu.
test('stack: wariant szablonu — sygnal drugiego wariantu w manifestach → UWAGA z jego repo z profilu, exit 0; bez sygnalu → bez wiersza', () => zSrodowiskiem((s) => {
  const { nazwa, zaleznosc, obecna, repo } = PROFIL.szablon.innyWariant
  const zPaczka = { dependencies: { [zaleznosc]: '1.0.0' } }
  assert.doesNotMatch(doctor(s).stdout, /\| stack: wariant szablonu \|/, 'projekt bez package.json nie daje sygnalu')
  json(s.projekt, 'package.json', obecna ? { dependencies: { 'left-pad': '1.3.0' } } : zPaczka)
  assert.doesNotMatch(doctor(s).stdout, /\| stack: wariant szablonu \|/, 'projekt zgodny z profilem')

  // Profil zakladajacy paczke nie daje wiersza takze bez niej w manifestach: aplikacja moze lezec glebiej niz pierwszy poziom.
  if (!obecna) {
    json(s.projekt, 'package.json', { dependencies: { 'left-pad': '1.3.0' } })
    assert.doesNotMatch(doctor(s).stdout, /\| stack: wariant szablonu \|/, 'brak paczki w manifestach nie jest dowodem')
    return
  }
  // Paczka w pakiecie pierwszego poziomu liczy sie jak w korzeniu (uklad frontend/ + backend/).
  json(s.projekt, 'aplikacja/package.json', zPaczka)
  const w = doctor(s)
  const uwaga = wiersz(w.stdout, 'stack: wariant szablonu')
  assert.equal(uwaga[1], 'UWAGA')
  assert.ok(uwaga[2].includes(`zależność ${zaleznosc} w aplikacja/package.json`), uwaga[2])
  assert.equal(uwaga[3], `dla tej aplikacji jest wariant ${nazwa} szablonu: ${repo}`)
  assert.equal(w.status, 0, 'uwaga o wariancie nie blokuje runu')
}))

// P22 A1: live-10-demo — `vitest run` bez configu zebral 113 testow maszynerii z .claude/** i autopilot stanal na starcie.
// Doctor mowi o tym przed runem: BRAK z gotowym configiem (exit 1); config z include tests/ → OK; projekt bez vitest — nie dotyczy.
// Sync nie wozi testow maszynerii do projektow, wiec BRAK wymaga pliku testu pod .claude/ (tu wlasny test projektu);
// bez niego vitest bez configu to „nie dotyczy” i exit 0.
test('runner testow: vitest bez configu i test pod .claude/ → BRAK z gotowym vitest.config.ts i exit 1; config z include tests/ → OK', () => zSrodowiskiem((s) => {
  assert.deepEqual(wiersz(doctor(s).stdout, 'runner testów').slice(1, 3), ['nie dotyczy', 'brak runnera vitest/jest w repo (package.json w korzeniu i w katalogach pierwszego poziomu)'])
  writeFileSync(join(s.projekt, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' }, devDependencies: { vitest: '3.2.4' } }))
  const bezTestow = doctor(s)
  assert.deepEqual(wiersz(bezTestow.stdout, 'runner testów').slice(1, 3), ['nie dotyczy', 'pod .claude/ nie ma plików testów, więc vitest nie ma tam czego zebrać; listy testów nie sprawdzono (brak node_modules/.bin/vitest)'])
  assert.equal(bezTestow.status, 0)
  mkdirSync(join(s.projekt, '.claude', 'skills', 'wlasny', '__tests__'), { recursive: true })
  writeFileSync(join(s.projekt, '.claude', 'skills', 'wlasny', '__tests__', 'a.test.mjs'), '')
  const brak = doctor(s)
  const w = wiersz(brak.stdout, 'runner testów')
  assert.equal(w[1], 'BRAK')
  assert.match(w[3], /^vitest\.config\.ts: .*'\.claude\/\*\*'/)
  assert.equal(brak.status, 1)
  assert.match(brak.stdout, /WYNIK: BRAK obowiązkowych: runner testów/)
  // vitest zainstalowany: werdykt z `vitest list` (atrapa) — lista bez .claude → OK; ostrzezenie na stderr nie psuje wiersza.
  writeFileSync(join(s.projekt, 'vitest.config.ts'), 'export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } })\n')
  mkdirSync(join(s.projekt, 'node_modules', '.bin'), { recursive: true })
  atrapa(join(s.projekt, 'node_modules', '.bin'), 'vitest', `echo "(!) ostrzezenie vite" >&2; echo '[{"file":"${s.projekt}/tests/a.test.ts"}]'`)
  const ok = doctor(s)
  assert.deepEqual(wiersz(ok.stdout, 'runner testów').slice(1, 3), ['OK', 'vitest: 1 plików testów, 0 z .claude/**'])
  assert.equal(ok.status, 0)
}))

// P22 A2: hook piszacy w drzewie projektu (stary cache tsc w .claude/tsc-cache/) brudzi drzewo — doctor zglasza UWAGA
// z plikiem i linia, bez blokady runu; hooki bez zapisu w drzewie → OK.
test('zapis hookow: hook pisze do $CLAUDE_PROJECT_DIR → UWAGA z plikiem:linia, exit 0; bez zapisu → OK', () => zSrodowiskiem((s) => {
  mkdirSync(join(s.projekt, '.claude', 'hooks'), { recursive: true })
  writeFileSync(join(s.projekt, '.claude', 'hooks', 'stop.sh'), 'C="$CLAUDE_PROJECT_DIR/.claude/tsc-cache"\nmkdir -p "$C"\n')
  const w = doctor(s)
  assert.deepEqual(wiersz(w.stdout, 'zapis hooków').slice(1, 3), ['UWAGA', '.claude/hooks/stop.sh:2 pisze do "$C" — plik spoza .gitignore brudzi drzewo i zatrzyma bramkę gotowości i autopilota'])
  assert.equal(w.status, 0)
  writeFileSync(join(s.projekt, '.claude', 'hooks', 'stop.sh'), 'mkdir -p "${TMPDIR:-/tmp}/cache"\n')
  assert.equal(wiersz(doctor(s).stdout, 'zapis hooków')[1], 'OK')
}))
