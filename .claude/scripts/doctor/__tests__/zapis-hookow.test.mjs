// Hooki a drzewo projektu (P22 A2): stary hook Stop pisal cache tsc w .claude/tsc-cache/<sesja>/ — nieśledzone pliki
// zatrzymywaly bramke gotowosci i autopilota („brudne drzewo”). Doctor czyta pliki .claude/hooks/ i zglasza zapis do
// sciezki z katalogu projektu (wprost albo przez zmienna) oraz pozostalosc .claude/tsc-cache/ spoza .gitignore.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { wierszZapisu, zapisyWDrzewie } from '../zapis-hookow.mjs'

const HOOK_SZABLONU = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'hooks', 'stop-build-check-enhanced.sh')

// Linie starego hooka Stop (przed P22) dosłownie.
const STARY_HOOK = `PROJECT_DIR="\${CLAUDE_PROJECT_DIR:-$(pwd)}"
SESSION_ID="\${CLAUDE_SESSION_ID:-default}"
CACHE_DIR="$PROJECT_DIR/.claude/tsc-cache/$SESSION_ID"
mkdir -p "$CACHE_DIR"
cd "$PROJECT_DIR"
TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
echo "$TSC_OUTPUT" > "$CACHE_DIR/last-errors.txt"
echo "npx tsc --noEmit" > "$CACHE_DIR/tsc-commands.txt"
`

test('stary hook Stop: mkdir i dwa zapisy do $CACHE_DIR zbudowanego z $PROJECT_DIR', () => {
  assert.deepEqual(zapisyWDrzewie('h.sh', STARY_HOOK).map((z) => [z.linia, z.cel]),
    [[4, '"$CACHE_DIR"'], [7, '"$CACHE_DIR/last-errors.txt"'], [8, '"$CACHE_DIR/tsc-commands.txt"']])
})

test('hook Stop z szablonu: cache w katalogu tymczasowym — bez zapisu w drzewie (basename/cksum katalogu to nie sciezka)', () => {
  assert.deepEqual(zapisyWDrzewie('stop-build-check-enhanced.sh', readFileSync(HOOK_SZABLONU, 'utf8')), [])
})

test('powloka: zapis wzgledny po cd do projektu i przez ${CLAUDE_PROJECT_DIR} — tak; operator w cudzyslowie, /dev/null, czytanie — nie', () => {
  const hook = [
    'echo "a -> b" > /dev/null',
    'cat "$CLAUDE_PROJECT_DIR/x" | grep -q y',
    'touch "${CLAUDE_PROJECT_DIR}/znacznik"',
    'cd "$CLAUDE_PROJECT_DIR"',
    'echo "uzyj > zamiast" 2>&1',
    "echo 'x' >> log.txt",
    'cp /tmp/a "$CLAUDE_PROJECT_DIR/b"',
    'cp "$CLAUDE_PROJECT_DIR/b" /tmp/a',
  ].join('\n')
  assert.deepEqual(zapisyWDrzewie('h.sh', hook).map((z) => [z.linia, z.cel]),
    [[3, '"${CLAUDE_PROJECT_DIR}/znacznik"'], [6, 'log.txt'], [7, '"$CLAUDE_PROJECT_DIR/b"']])
})

test('JS: writeFileSync(join(projekt, …)) przy projekt = process.env.CLAUDE_PROJECT_DIR — tak; zapis do homedir — nie', () => {
  const hook = [
    "const projekt = process.env.CLAUDE_PROJECT_DIR ?? '.'",
    "const plik = join(projekt, '.cache', 'x.json')",
    "writeFileSync(plik, '{}')",
    "appendFileSync(join(homedir(), '.claude', 'log'), 'x')",
    "mkdirSync(`${projekt}/tmp`, { recursive: true })",
  ].join('\n')
  assert.deepEqual(zapisyWDrzewie('h.mjs', hook).map((z) => z.linia), [3, 5])
})

/** @param {(projekt: string) => void} cialo */
function wProjekcie(cialo) {
  const projekt = mkdtempSync(join(tmpdir(), 'zapis-hookow-'))
  try {
    execFileSync('git', ['-C', projekt, 'init', '-q'])
    cialo(projekt)
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

test('wiersz: stary hook → UWAGA z plikiem:linia i naprawa; hook szablonu → OK; brak hookow → nie dotyczy', () => wProjekcie((p) => {
  assert.equal(wierszZapisu(p)[1], 'nie dotyczy')
  mkdirSync(join(p, '.claude', 'hooks'), { recursive: true })
  writeFileSync(join(p, '.claude', 'hooks', 'stop.sh'), STARY_HOOK)
  const [, stan, szczegol, naprawa] = wierszZapisu(p)
  assert.equal(stan, 'UWAGA')
  assert.match(szczegol, /^\.claude\/hooks\/stop\.sh:4 pisze do "\$CACHE_DIR"; .*brudne drzewo zatrzyma bramkę gotowości/)
  assert.match(naprawa, /katalogu tymczasowego/)
  writeFileSync(join(p, '.claude', 'hooks', 'stop.sh'), readFileSync(HOOK_SZABLONU, 'utf8'))
  assert.deepEqual(wierszZapisu(p).slice(1, 3), ['OK', '1 plików w .claude/hooks/ bez zapisu w drzewie projektu'])
}))

test('wiersz: pozostalosc .claude/tsc-cache/ spoza .gitignore → UWAGA z usunieciem; w .gitignore → OK', () => wProjekcie((p) => {
  mkdirSync(join(p, '.claude', 'hooks'), { recursive: true })
  writeFileSync(join(p, '.claude', 'hooks', 'stop.sh'), 'exit 0\n')
  mkdirSync(join(p, '.claude', 'tsc-cache', 'default'), { recursive: true })
  writeFileSync(join(p, '.claude', 'tsc-cache', 'default', 'last-errors.txt'), '\n')
  const [, stan, szczegol, naprawa] = wierszZapisu(p)
  assert.equal(stan, 'UWAGA')
  assert.match(szczegol, /^\.claude\/tsc-cache\/ spoza \.gitignore/)
  assert.match(naprawa, /^usuń katalog \.claude\/tsc-cache\//)
  writeFileSync(join(p, '.gitignore'), '.claude/tsc-cache/\n')
  assert.equal(wierszZapisu(p)[1], 'OK')
}))
