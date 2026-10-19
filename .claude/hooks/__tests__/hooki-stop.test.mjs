// Hooki Stop (PLAN-POPRAWY P6): error-handling-reminder.sh konczy sie od razu w projekcie z konfiguracja ESLint
// z szablonu (no-console, no-empty i no-floating-promises przejmuja jego prace), a dziala dalej w projektach bez niej.
// Oba hooki Stop wychodza od razu przy stop_hook_active: true — Claude kontynuuje juz po blokadzie hooka Stop, druga
// blokada w tej samej turze to petla (dokumentacja hookow Claude Code).

import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HOOKI = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BLOKADA = 2
const WEJSCIE = (/** @type {boolean} */ aktywny) => JSON.stringify({ session_id: 's', hook_event_name: 'Stop', stop_hook_active: aktywny })

/**
 * @param {string} hook
 * @param {Record<string, string>} pliki
 * @param {string} wejscie stdin hooka
 * @param {NodeJS.ProcessEnv} [env]
 */
function uruchom(hook, pliki, wejscie, env = {}) {
  const projekt = mkdtempSync(join(tmpdir(), 'hook-stop-'))
  try {
    execFileSync('git', ['-C', projekt, 'init', '-q'])
    for (const [sciezka, tresc] of Object.entries(pliki)) {
      mkdirSync(dirname(join(projekt, sciezka)), { recursive: true })
      writeFileSync(join(projekt, sciezka), tresc)
    }
    const wynik = spawnSync('bash', [join(HOOKI, hook)], { encoding: 'utf8', input: wejscie, env: { ...process.env, ...env, CLAUDE_PROJECT_DIR: projekt } })
    return { ...wynik, projekt }
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

const CONSOLE_W_SRC = { 'src/app.ts': "export const x = 1\nconsole.log('start')\n" }

test('error-handling: console.log w src bez konfiguracji ESLint z szablonu = blokada (starsze projekty)', () => {
  const w = uruchom('error-handling-reminder.sh', { ...CONSOLE_W_SRC, 'eslint.config.js': 'export default []\n' }, WEJSCIE(false))
  assert.equal(w.status, BLOKADA, w.stderr)
  assert.match(w.stderr, /src\/app\.ts/)
})

test('error-handling: eslint.config.ts z szablonu (znacznik .claude/templates/bramki) = koniec od razu', () => {
  const konfiguracja = '// Konfiguracja ESLint z szablonu (.claude/templates/bramki) — w projekcie kopiuj jako eslint.config.ts\nexport default []\n'
  const w = uruchom('error-handling-reminder.sh', { ...CONSOLE_W_SRC, 'eslint.config.ts': konfiguracja }, WEJSCIE(false))
  assert.equal(w.status, 0, w.stderr)
  assert.equal(w.stderr, '')
})

test('error-handling: stop_hook_active = koniec od razu mimo ostrzezen', () => {
  const w = uruchom('error-handling-reminder.sh', CONSOLE_W_SRC, WEJSCIE(true))
  assert.equal(w.status, 0, w.stderr)
})

/** Atrapa npx w PATH: zapisuje znacznik wywolania — sprawdza, czy hook doszedl do tsc. */
function atrapaNpx() {
  const bin = mkdtempSync(join(tmpdir(), 'hook-npx-'))
  const znacznik = join(bin, 'wywolano')
  writeFileSync(join(bin, 'npx'), `#!/bin/sh\ntouch "${znacznik}"\n`)
  chmodSync(join(bin, 'npx'), 0o755)
  return { bin, znacznik }
}

const PROJEKT_TS = { 'tsconfig.json': '{}', 'node_modules/typescript/package.json': '{}' }

test('stop-build-check: stop_hook_active = koniec przed tsc; bez niego tsc biegnie', () => {
  const npx = atrapaNpx()
  try {
    const env = { PATH: `${npx.bin}:${process.env.PATH}` }
    const aktywny = uruchom('stop-build-check-enhanced.sh', PROJEKT_TS, WEJSCIE(true), env)
    assert.equal(aktywny.status, 0, aktywny.stderr)
    assert.equal(existsSync(npx.znacznik), false)

    const zwykly = uruchom('stop-build-check-enhanced.sh', PROJEKT_TS, WEJSCIE(false), env)
    assert.equal(zwykly.status, 0, zwykly.stderr)
    assert.equal(existsSync(npx.znacznik), true)
  } finally {
    rmSync(npx.bin, { recursive: true, force: true })
  }
})

// P22 A2: cache hooka poza repo (katalog tymczasowy per projekt i sesja) — zapis w .claude/tsc-cache/ brudzil drzewo nowego
// projektu i zatrzymywal autopilota. Zmiana drzewa w trakcie tsc (workflow `/dev-pr start` przelaczyl galaz czesci PR)
// dawala 56 × TS6053 dla plikow, ktorych na nowej galezi nie ma — hook liczy wynik z biezacego drzewa.

/**
 * Projekt TS z repo git i atrapa npx (skrypt sh w PATH, uruchamiany w katalogu projektu); cialo dostaje projekt i wynik.
 * @param {string} skryptNpx tresc atrapy npx
 * @param {(w: { status: number | null, stderr: string, projekt: string, tmp: string, licznik: () => number }) => void} cialo
 * @param {Record<string, string>} [env] nadpisania zmiennych hooka
 */
function zAtrapaTsc(skryptNpx, cialo, env = {}) {
  const katalog = mkdtempSync(join(tmpdir(), 'hook-tsc-'))
  const projekt = join(katalog, 'projekt')
  const bin = join(katalog, 'bin')
  const tmp = join(katalog, 'tmp')
  try {
    for (const k of [projekt, bin, tmp]) mkdirSync(k)
    for (const [sciezka, tresc] of Object.entries({ ...PROJEKT_TS, 'src/a.ts': 'export const a = 1\n' })) {
      mkdirSync(dirname(join(projekt, sciezka)), { recursive: true })
      writeFileSync(join(projekt, sciezka), tresc)
    }
    const g = (/** @type {string[]} */ a) => execFileSync('git', ['-C', projekt, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a])
    g(['init', '-q', '-b', 'main'])
    g(['add', '-A'])
    g(['commit', '-qm', 'start'])
    g(['branch', 'czesc-1'])
    writeFileSync(join(bin, 'npx'), `#!/bin/sh\necho x >> "${join(katalog, 'wywolania')}"\n${skryptNpx}\n`)
    chmodSync(join(bin, 'npx'), 0o755)
    const wynik = spawnSync('bash', [join(HOOKI, 'stop-build-check-enhanced.sh')], {
      encoding: 'utf8', input: JSON.stringify({ session_id: 'sesja-1', hook_event_name: 'Stop', stop_hook_active: false }),
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CLAUDE_PROJECT_DIR: projekt, TMPDIR: tmp, ...env },
    })
    const licznik = () => (existsSync(join(katalog, 'wywolania')) ? readFileSync(join(katalog, 'wywolania'), 'utf8').split('\n').filter(Boolean).length : 0)
    cialo({ status: wynik.status, stderr: wynik.stderr, projekt, tmp, licznik })
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
}

test('stop-build-check: cache w TMPDIR per projekt i sesja, drzewo projektu czyste', () => zAtrapaTsc("echo \"src/a.ts(1,1): error TS2322: x\"", (w) => {
  assert.equal(w.status, 2, w.stderr)
  assert.equal(existsSync(join(w.projekt, '.claude')), false)
  assert.equal(execFileSync('git', ['-C', w.projekt, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }), '')
  const sesje = readdirSync(join(w.tmp, 'claude-tsc-cache'))
  assert.equal(sesje.length, 1)
  assert.match(sesje[0] ?? '', /^projekt-\d+$/)
  assert.match(readFileSync(join(w.tmp, 'claude-tsc-cache', sesje[0] ?? '', 'sesja-1', 'last-errors.txt'), 'utf8'), /error TS2322/)
}))

// Format tsc 5.9 (--pretty false) dla pliku dobranego wzorcem include, usunietego w trakcie biegu (wyscig odtworzony w sesji P22).
const TS6053_INCLUDE = (/** @type {string} */ plik) => `echo "error TS6053: File '$PWD/${plik}' not found."; echo "  The file is in the program because:"; echo "    Matched by include pattern 'src' in '$PWD/tsconfig.json'"`

test('stop-build-check: TS6053 z include pattern dla pliku spoza biezacego drzewa nie jest bledem; plik istniejacy i lista files — sa', () => {
  zAtrapaTsc([1, 2, 3, 4, 5].map((i) => TS6053_INCLUDE(`src/usuniety-${i}.ts`)).join('\n'), (w) => {
    assert.equal(w.status, 0, w.stderr)
    assert.match(w.stderr, /Pominięte TS6053 plików spoza bieżącego drzewa: 5/)
  })
  const prawdziwe = [
    ...[1, 2, 3].map((i) => TS6053_INCLUDE(`src/usuniety-${i}.ts`)),
    TS6053_INCLUDE('src/a.ts'),
    `echo "error TS6053: File '$PWD/src/brak-z-files.ts' not found."; echo "  The file is in the program because:"; echo "    Part of 'files' list in tsconfig.json"`,
    'echo "src/a.ts(1,1): error TS2322: x"',
  ]
  zAtrapaTsc(prawdziwe.join('\n'), (w) => {
    assert.equal(w.status, 2, w.stderr)
    assert.match(w.stderr, /TSC CHECK: 3 błąd/)
    assert.match(w.stderr, /brak-z-files\.ts/)
    assert.doesNotMatch(w.stderr, /usuniety/)
  })
})

test('stop-build-check: tsc z --pretty false (kolory ANSI psulyby wzorzec "error TS"); niezapisywalny TMPDIR nie wylacza sprawdzenia', () => {
  zAtrapaTsc('echo "$@" > "$PWD/../argumenty"; echo "src/a.ts(1,1): error TS2322: x"', (w) => {
    assert.equal(readFileSync(join(w.projekt, '..', 'argumenty'), 'utf8').trim(), 'tsc --noEmit --pretty false')
  })
  zAtrapaTsc('echo "src/a.ts(1,1): error TS2322: x"', (w) => {
    assert.equal(w.status, 2, w.stderr)
    assert.doesNotMatch(w.stderr, /Cache błędów/)
  }, { TMPDIR: '/dev/null/nie-ma' })
})

test('stop-build-check: zmiana galezi w trakcie tsc → drugi bieg na biezacym drzewie; drzewo zmienia sie dalej → pominiety', () => {
  // Pierwszy bieg: workflow przelacza galaz w trakcie, tsc zglasza bledy plikow starej galezi (istniejacy plik — bez filtra TS6053).
  const raz = `if [ ! -f "${'$'}PWD/.git/przelaczone" ]; then touch .git/przelaczone; git checkout -q czesc-1; for i in 1 2 3 4; do echo "src/a.ts(1,1): error TS2307: stary-$i"; done; fi`
  zAtrapaTsc(raz, (w) => {
    assert.equal(w.status, 0, w.stderr)
    assert.equal(w.licznik(), 2)
  })
  // Checkout tam i z powrotem (HEAD i galaz bez zmian) oraz commit na tej samej galezi — wykrywa dlugosc reflogu i SHA.
  const tamIZPowrotem = `if [ ! -f "${'$'}PWD/.git/przelaczone" ]; then touch .git/przelaczone; git checkout -q czesc-1; git checkout -q main; echo "src/a.ts(1,1): error TS2307: stary"; fi`
  zAtrapaTsc(tamIZPowrotem, (w) => {
    assert.equal(w.status, 0, w.stderr)
    assert.equal(w.licznik(), 2)
  })
  const commit = `if [ ! -f "${'$'}PWD/.git/przelaczone" ]; then touch .git/przelaczone; git -c user.name=t -c user.email=t@t commit -q --allow-empty -m x; echo "src/a.ts(1,1): error TS2307: stary"; fi`
  zAtrapaTsc(commit, (w) => {
    assert.equal(w.status, 0, w.stderr)
    assert.equal(w.licznik(), 2)
  })
  // Drugi bieg na stabilnym drzewie zglasza prawdziwe bledy — blokada.
  const drugiZBledami = `if [ ! -f "${'$'}PWD/.git/przelaczone" ]; then touch .git/przelaczone; git checkout -q czesc-1; else for i in 1 2 3 4; do echo "src/a.ts(1,1): error TS2322: b-$i"; done; fi`
  zAtrapaTsc(drugiZBledami, (w) => {
    assert.equal(w.status, 2, w.stderr)
    assert.equal(w.licznik(), 2)
  })
  const zawsze = 'git checkout -q "$(git branch --format="%(refname:short)" | grep -vx "$(git branch --show-current)" | head -1)"; echo "src/a.ts(1,1): error TS2307: x"'
  zAtrapaTsc(zawsze, (w) => {
    assert.equal(w.status, 0, w.stderr)
    assert.equal(w.licznik(), 2)
    assert.match(w.stderr, /TSC CHECK POMINIĘTY - drzewo zmieniało się w trakcie sprawdzenia/)
  })
})
