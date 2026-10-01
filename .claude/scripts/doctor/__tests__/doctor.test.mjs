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

const SKRYPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'doctor.sh')
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
function doctor(s) {
  return spawnSync('/bin/bash', [SKRYPT, s.projekt], {
    encoding: 'utf8',
    env: { PATH: s.bin, HOME: s.dom },
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

test('checkbox [E2E] w docs/ wymaga agent-browser w PATH; sam lokalny w node_modules/.bin to BRAK', () => zSrodowiskiem((s) => {
  plik(s.projekt, 'docs/active/x/x-zadania.md', '- [x] Test: [Unit] cos\n')
  assert.equal(wiersz(doctor(s).stdout, 'agent-browser')[1], 'nie dotyczy')

  plik(s.projekt, 'docs/active/x/x-zadania.md', '- [ ] Test: [E2E] `logowanie` — /login → panel\n')
  const brak = doctor(s)
  assert.notEqual(brak.status, 0)
  assert.equal(wiersz(brak.stdout, 'agent-browser')[1], 'BRAK')

  // skill agent-browser i feature-tester-e2e wolaja gole `agent-browser` — lokalna kopia poza PATH run nie znajdzie
  plik(s.projekt, 'node_modules/.bin/agent-browser', '#!/bin/sh\necho "agent-browser 0.31.1"\n')
  chmodSync(join(s.projekt, 'node_modules/.bin/agent-browser'), 0o755)
  const lokalny = doctor(s)
  assert.notEqual(lokalny.status, 0, lokalny.stdout)
  assert.deepEqual(wiersz(lokalny.stdout, 'agent-browser').slice(1),
    ['BRAK', 'agent-browser 0.31.1 tylko w node_modules/.bin — pipeline woła agent-browser z PATH', 'npm install -g agent-browser && agent-browser install'])

  atrapa(s.bin, 'agent-browser', 'echo "agent-browser 0.31.1"')
  const globalny = doctor(s)
  assert.equal(globalny.status, 0, globalny.stdout)
  assert.deepEqual(wiersz(globalny.stdout, 'agent-browser').slice(1, 3), ['OK', 'agent-browser 0.31.1'])
}))

test('Coolify i Dockerfile → coolify i docker jako UWAGA, nie blokuja', () => zSrodowiskiem((s) => {
  assert.equal(wiersz(doctor(s).stdout, 'coolify')[1], 'nie dotyczy')
  assert.equal(wiersz(doctor(s).stdout, 'docker')[1], 'nie dotyczy')

  plik(s.projekt, '.env.example', '# W Coolify oznacz jako zmienna builda\n')
  plik(s.projekt, 'Dockerfile', 'FROM node:22-alpine\n')
  const w = doctor(s)
  assert.equal(w.status, 0, w.stdout)
  assert.equal(wiersz(w.stdout, 'coolify')[1], 'UWAGA')
  assert.match(wiersz(w.stdout, 'coolify')[3], /install_coolify_cli\.sh/)
  assert.equal(wiersz(w.stdout, 'docker')[1], 'UWAGA')
  assert.match(w.stdout, /uwagi: 2/)
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

test('profil szablonu (.claude/settings.json): oba pluginy projektu z komenda instalacji per projekt, bez blokady', () => zSrodowiskiem((s) => {
  plik(s.projekt, '.claude/settings.json', readFileSync(resolve(dirname(SKRYPT), '..', '..', 'settings.json'), 'utf8'))
  const w = doctor(s)
  assert.equal(w.status, 0, w.stdout)
  assert.deepEqual(wiersz(w.stdout, 'plugin dev-browser@dev-browser-marketplace').slice(1), [
    'UWAGA', 'nie zainstalowany',
    'claude plugin marketplace add sawyerhood/dev-browser && claude plugin install dev-browser@dev-browser-marketplace --scope project',
  ])
  assert.deepEqual(wiersz(w.stdout, 'plugin figma@claude-plugins-official').slice(1),
    ['UWAGA', 'nie zainstalowany', 'claude plugin install figma@claude-plugins-official --scope project'])
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
