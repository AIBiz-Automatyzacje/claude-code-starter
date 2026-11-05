// Budowa wariantu (IU-2.0): rdzeń + usun.txt + nakładka + settings.patch.json + .rdzen-version. Repo fikcyjne w katalogu
// tymczasowym, bo test sprawdza mechanizm, nie treść stacku Expo (tę pilnuje stacks/expo/__tests__/).
//
// Uruchomienie: node --test stacks/__tests__/zbuduj.test.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { BladWariantu, scalUstawienia, zbuduj } from '../zbuduj.mjs'

const SKRYPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'zbuduj.mjs')

/** @param {string} katalog @param {Record<string, string>} pliki */
function zapisz(katalog, pliki) {
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(katalog, sciezka)), { recursive: true })
    writeFileSync(join(katalog, sciezka), tresc)
  }
}

const RDZEN = {
  '.claude/settings.json': '{"enabledPlugins":{"web@x":true,"figma@x":true},"permissions":{"deny":["Bash(a)"]}}\n',
  '.claude/skills/web/SKILL.md': 'web',
  '.claude/skills/web/references/a.md': 'web a',
  '.claude/skills/wspolny/SKILL.md': 'wspólny',
  '.claude/stack/slot.md': 'slot web',
  '.claude/hooks/hak.sh': '#!/bin/sh\n',
  'output-styles/adhd.md': 'styl',
  'docs/poza.md': 'poza rdzeniem',
}

/** @param {Record<string, string>} [dodatkowe] @returns {string} korzeń repo z pierwszym commitem */
function repo(dodatkowe = {}) {
  const k = mkdtempSync(join(tmpdir(), 'zbuduj-repo-'))
  zapisz(k, { ...RDZEN, 'stacks/expo/usun.txt': '', ...dodatkowe })
  chmodSync(join(k, '.claude/hooks/hak.sh'), 0o755)
  for (const a of [['init', '-q'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['add', '.'], ['commit', '-q', '-m', 'r']]) {
    execFileSync('git', ['-C', k, ...a])
  }
  return k
}

const celTymczasowy = () => mkdtempSync(join(tmpdir(), 'zbuduj-cel-'))
/** @param {string} k */
const sha = (k) => execFileSync('git', ['-C', k, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

test('build bez nakładki: kopia rdzenia i output-styles, bez plików spoza rdzenia, plik wersji z SHA', () => {
  const k = repo()
  const cel = celTymczasowy()
  const wynik = zbuduj({ korzen: k, stack: 'expo', katalog: cel })
  assert.equal(readFileSync(join(cel, '.claude/skills/web/SKILL.md'), 'utf8'), 'web')
  assert.equal(readFileSync(join(cel, 'output-styles/adhd.md'), 'utf8'), 'styl')
  assert.equal(existsSync(join(cel, 'docs/poza.md')), false)
  assert.equal(existsSync(join(cel, 'stacks')), false)
  assert.equal(readFileSync(join(cel, '.claude/.rdzen-version'), 'utf8'), `${sha(k)}\n`)
  assert.deepEqual(wynik, { wersja: sha(k), pliki: 7, usuniete: 0, podmienione: [], dodane: [] })
})

test('build zachowuje bit wykonywalny hooka', () => {
  const k = repo()
  const cel = celTymczasowy()
  zbuduj({ korzen: k, stack: 'expo', katalog: cel })
  assert.equal(statSync(join(cel, '.claude/hooks/hak.sh')).mode & 0o111, 0o111)
})

test('usun.txt: katalog i plik znikają, komentarz i pusta linia nie są wpisami', () => {
  const k = repo({ 'stacks/expo/usun.txt': '# komentarz\n\n.claude/skills/web/\n.claude/stack/slot.md\n' })
  const cel = celTymczasowy()
  const wynik = zbuduj({ korzen: k, stack: 'expo', katalog: cel })
  assert.equal(existsSync(join(cel, '.claude/skills/web')), false)
  assert.equal(existsSync(join(cel, '.claude/stack/slot.md')), false)
  assert.equal(existsSync(join(cel, '.claude/skills/wspolny/SKILL.md')), true)
  assert.equal(wynik.usuniete, 3)
})

test('usun.txt: wpis bez pliku i ścieżka spoza rdzenia zatrzymują build', () => {
  const nieaktualny = repo({ 'stacks/expo/usun.txt': '.claude/skills/brak/\n' })
  assert.throws(() => zbuduj({ korzen: nieaktualny, stack: 'expo', katalog: celTymczasowy() }), { kod: 'usun-nieaktualny' })
  for (const wpis of ['../poza.md', 'docs/poza.md', '.claude/../docs/poza.md']) {
    const k = repo({ 'stacks/expo/usun.txt': `${wpis}\n` })
    assert.throws(() => zbuduj({ korzen: k, stack: 'expo', katalog: celTymczasowy() }), { kod: 'usun-poza-rdzeniem' }, wpis)
  }
})

test('usun.txt: katalog bez ukośnika nie usuwa zawartości, tylko zatrzymuje build', () => {
  const k = repo({ 'stacks/expo/usun.txt': '.claude/skills/web\n' })
  assert.throws(() => zbuduj({ korzen: k, stack: 'expo', katalog: celTymczasowy() }), { kod: 'usun-nieaktualny' })
})

test('nakładka: podmienia cały plik i dodaje nowe, zgłasza które', () => {
  const k = repo({
    'stacks/expo/nakladka/.claude/stack/slot.md': 'slot expo',
    'stacks/expo/nakladka/.claude/skills/rn/SKILL.md': 'rn',
    'stacks/expo/nakladka/output-styles/expo.md': 'styl expo',
  })
  const cel = celTymczasowy()
  const wynik = zbuduj({ korzen: k, stack: 'expo', katalog: cel })
  assert.equal(readFileSync(join(cel, '.claude/stack/slot.md'), 'utf8'), 'slot expo')
  assert.equal(readFileSync(join(cel, '.claude/skills/rn/SKILL.md'), 'utf8'), 'rn')
  assert.equal(readFileSync(join(cel, 'output-styles/expo.md'), 'utf8'), 'styl expo')
  assert.deepEqual(wynik.podmienione, ['.claude/stack/slot.md'])
  assert.deepEqual(wynik.dodane, ['.claude/skills/rn/SKILL.md', 'output-styles/expo.md'])
})

test('nakładka: katalog z usun.txt wraca z nową zawartością bez plików web', () => {
  const k = repo({ 'stacks/expo/usun.txt': '.claude/skills/web/\n', 'stacks/expo/nakladka/.claude/skills/web/SKILL.md': 'expo' })
  const cel = celTymczasowy()
  zbuduj({ korzen: k, stack: 'expo', katalog: cel })
  assert.equal(readFileSync(join(cel, '.claude/skills/web/SKILL.md'), 'utf8'), 'expo')
  assert.equal(existsSync(join(cel, '.claude/skills/web/references/a.md')), false)
})

test('nakładka: naruszenia kontraktu zatrzymują build i nie ruszają celu', () => {
  const przypadki = [
    ['nakladka-poza-rdzeniem', { 'stacks/expo/nakladka/docs/x.md': 'x' }],
    ['nakladka-testy', { 'stacks/expo/nakladka/.claude/scripts/__tests__/a.test.mjs': 'x' }],
    ['nakladka-ustawienia', { 'stacks/expo/nakladka/.claude/settings.json': '{}' }],
    ['nakladka-usun', { 'stacks/expo/usun.txt': '.claude/stack/slot.md\n', 'stacks/expo/nakladka/.claude/stack/slot.md': 'x' }],
  ]
  for (const [kod, pliki] of /** @type {Array<[string, Record<string, string>]>} */ (przypadki)) {
    const cel = celTymczasowy()
    zapisz(cel, { '.claude/stary.md': 'zostaje' })
    assert.throws(() => zbuduj({ korzen: repo(pliki), stack: 'expo', katalog: cel, zastap: true }), { kod }, kod)
    assert.equal(readFileSync(join(cel, '.claude/stary.md'), 'utf8'), 'zostaje', kod)
  }
})

test('settings.patch.json: wynik scalony w settings.json wariantu', () => {
  const k = repo({ 'stacks/expo/settings.patch.json': '{"enabledPlugins":{"web@x":null,"expo@x":true},"permissions":{"deny":["Bash(b)"]}}' })
  const cel = celTymczasowy()
  zbuduj({ korzen: k, stack: 'expo', katalog: cel })
  assert.deepEqual(JSON.parse(readFileSync(join(cel, '.claude/settings.json'), 'utf8')), {
    enabledPlugins: { 'figma@x': true, 'expo@x': true },
    permissions: { deny: ['Bash(a)', 'Bash(b)'] },
  })
})

test('settings.json wariantu w kolejności zapisu Claude Code: permissions na początku, klucze pluginów na końcu', () => {
  const k = repo({
    '.claude/settings.json': '{"enabledPlugins":{"a@x":true},"extraKnownMarketplaces":{"x":{}},"hooks":{}}\n',
    'stacks/expo/settings.patch.json': '{"permissions":{"deny":["Bash(a)"]}}',
  })
  const cel = celTymczasowy()
  zbuduj({ korzen: k, stack: 'expo', katalog: cel })
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(cel, '.claude/settings.json'), 'utf8'))), ['permissions', 'hooks', 'enabledPlugins', 'extraKnownMarketplaces'])
})

test('scalUstawienia: obiekty rekurencyjnie, tablice bez powtórzeń, prosta wartość nadpisana, null usuwa, baza nietknięta', () => {
  const baza = { a: { b: 1, c: 2 }, l: [{ x: 1 }], s: 'web', d: true }
  const wynik = scalUstawienia(baza, { a: { b: 9 }, l: [{ x: 1 }, { x: 2 }], s: 'expo', d: null, n: [1] })
  assert.deepEqual(wynik, { a: { b: 9, c: 2 }, l: [{ x: 1 }, { x: 2 }], s: 'expo', n: [1] })
  assert.deepEqual(baza, { a: { b: 1, c: 2 }, l: [{ x: 1 }], s: 'web', d: true })
})

test('plik wersji: niezacommitowana zmiana rdzenia albo stacku daje -dirty, zmiana poza nimi nie', () => {
  const k = repo()
  zapisz(k, { 'docs/inne.md': 'x' })
  assert.equal(zbuduj({ korzen: k, stack: 'expo', katalog: celTymczasowy() }).wersja, sha(k))
  zapisz(k, { 'stacks/expo/usun.txt': '# zmiana\n' })
  assert.equal(zbuduj({ korzen: k, stack: 'expo', katalog: celTymczasowy() }).wersja, `${sha(k)}-dirty`)
})

test('nowy nieśledzony plik rdzenia wchodzi do wariantu, ignorowany i usunięty nie', () => {
  const k = repo({ '.gitignore': '.claude/ignorowany.md\n' })
  zapisz(k, { '.claude/nowy.md': 'nowy', '.claude/ignorowany.md': 'i', '.claude/settings.local.json': '{}' })
  rmSync(join(k, '.claude/skills/wspolny/SKILL.md'))
  const cel = celTymczasowy()
  zbuduj({ korzen: k, stack: 'expo', katalog: cel })
  assert.equal(existsSync(join(cel, '.claude/nowy.md')), true)
  assert.equal(existsSync(join(cel, '.claude/ignorowany.md')), false)
  assert.equal(existsSync(join(cel, '.claude/settings.local.json')), false)
  assert.equal(existsSync(join(cel, '.claude/skills/wspolny')), false)
})

test('cel z .claude albo output-styles wymaga zastap; wtedy wycofane pliki znikają, a reszta katalogu zostaje', () => {
  const k = repo()
  const cel = celTymczasowy()
  zapisz(cel, { '.claude/wycofany.md': 'stary', 'README.md': 'repo mobile', 'output-styles/stary.md': 'stary' })
  assert.throws(() => zbuduj({ korzen: k, stack: 'expo', katalog: cel }), { kod: 'cel-zajety' })
  assert.equal(readFileSync(join(cel, '.claude/wycofany.md'), 'utf8'), 'stary')
  zbuduj({ korzen: k, stack: 'expo', katalog: cel, zastap: true })
  assert.equal(existsSync(join(cel, '.claude/wycofany.md')), false)
  assert.equal(existsSync(join(cel, 'output-styles/stary.md')), false)
  assert.equal(readFileSync(join(cel, 'README.md'), 'utf8'), 'repo mobile')
})

test('cel w repo szablonu i niepoprawny stack zatrzymują build, nawet z zastap', () => {
  const k = repo()
  assert.throws(() => zbuduj({ korzen: k, stack: 'expo', katalog: k, zastap: true }), { kod: 'cel-w-repo' })
  assert.throws(() => zbuduj({ korzen: k, stack: 'expo', katalog: join(k, 'wynik'), zastap: true }), { kod: 'cel-w-repo' })
  assert.equal(readFileSync(join(k, '.claude/skills/web/SKILL.md'), 'utf8'), 'web')
  assert.throws(() => zbuduj({ korzen: k, stack: 'brak', katalog: celTymczasowy() }), { kod: 'stack-brak' })
  assert.throws(() => zbuduj({ korzen: k, stack: '../expo', katalog: celTymczasowy() }), { kod: 'stack-nazwa' })
})

test('błąd kontraktu to BladWariantu z kodem', () => {
  const k = repo()
  assert.throws(() => zbuduj({ korzen: k, stack: 'brak', katalog: celTymczasowy() }), BladWariantu)
})

test('CLI: bez argumentów kod 2, zły stack kod 1 z kodem błędu, poprawny kod 0 z wynikiem JSON', () => {
  assert.equal(spawnSync(process.execPath, [SKRYPT], { encoding: 'utf8' }).status, 2)
  assert.equal(spawnSync(process.execPath, [SKRYPT, 'expo', celTymczasowy(), '--inne'], { encoding: 'utf8' }).status, 2)
  const zly = spawnSync(process.execPath, [SKRYPT, 'brak-stacku', celTymczasowy()], { encoding: 'utf8' })
  assert.equal(zly.status, 1)
  assert.match(zly.stderr, /^stack-brak: /)
  const dobry = spawnSync(process.execPath, [SKRYPT, 'expo', celTymczasowy()], { encoding: 'utf8' })
  assert.equal(dobry.status, 0, dobry.stderr)
  assert.ok(JSON.parse(dobry.stdout).pliki > 0)
})
