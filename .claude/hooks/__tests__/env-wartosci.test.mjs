// Hook PreToolUse env-wartosci (P20 A10): komenda Bash, ktora wypisalaby wartosci z .env*, jest zablokowana kodem 2.
// Przypadki z sesji vibersi (etap 2: hasla bazy i konta testowego; etap 3: adres konta testowego) i komendy, ktore te same
// sesje robily poprawnie (nazwy kluczy, obecnosc, wartosc do zmiennej, pliki wzorcowe) — te przechodza.
//
// Uruchomienie: node --test .claude/hooks/__tests__/env-wartosci.test.mjs

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { ocenKomende } from '../env-wartosci.mjs'

const HOOKI = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOOK = join(HOOKI, 'env-wartosci.mjs')

// Komendy z transkryptow vibersi (etapy 1–3), ktore wypisaly wartosci.
const WYPISUJACE = [
  ['grep -n "E2E_" .env.e2e', '.env.e2e'], // etap 2 (§7): adres bazy e2e z haslem i haslo konta testowego
  ["grep '^E2E_TEST_EMAIL=' .env.e2e | cut -d= -f2", '.env.e2e'], // etap 3 (6a pkt 86 h): adres konta testowego
  ["grep -o '^E2E_TEST_EMAIL=.*@' .env.e2e", '.env.e2e'],
  ['grep -h VITE_SUPABASE_URL .env .env.local .env.development .env.development.local .env.e2e 2>/dev/null; date', '.env'],
  ["grep -E '^E2E_(URL|START)=' .env.e2e", '.env.e2e'],
  ['grep E2E_START .env.e2e', '.env.e2e'],
  ['cat .env.e2e', '.env.e2e'],
  ['diff "$CLAUDE_JOB_DIR/tmp/env.bak" .env.e2e', '.env.e2e'],
  ['head -3 .env.local', '.env.local'],
  ["awk -F= '{print $2}' .env", '.env'],
  ['cd ~/Documents/Kodowanie/vibersi && cat .env*', '.env*'],
  ['echo "$(cat .env.local)"', '.env.local'],
  ['ls\ncat ../vibersi/.env.staging', '../vibersi/.env.staging'],
  ['sort < .env.e2e', '.env.e2e'],
]

// Komendy tych samych sesji bez wypisania wartosci.
const BEZ_WARTOSCI = [
  "grep -oE '^[A-Z0-9_]+=' .env.e2e .env.local .env .env.staging; cat .env.example",
  "grep -o '^[A-Z_]*' .env.e2e",
  "sed 's/=.*//' .env.e2e",
  "sed -E 's/=.*/=<…>/' .env.e2e | grep -v '^#'",
  "cat .env.e2e 2>/dev/null | sed -E 's/=.*/=<set>/'",
  'grep -n "E2E_URL" .env.e2e | sed \'s/=.*/=…/\'',
  'grep -q "^SUPABASE_ACCESS_TOKEN=." .env.local && echo "token w .env.local"',
  'grep -l SUPABASE_ACCESS_TOKEN .env* 2>/dev/null',
  'grep -c . .env.local',
  "export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.e2e | cut -d= -f2- | tr -d '\"'); supabase projects list",
  'source e2e/lib/psql-celu.sh; DB="$(grep \'^SUPABASE_DEV_DB_URL=\' .env.local | cut -d= -f2-)"; psql_celu "$DB" -X -q -c "select 1"',
  '[ "$VITE_SUPABASE_URL" != "$(grep \'^VITE_SUPABASE_URL=\' .env.local | cut -d= -f2)" ] && echo "URL e2e ≠ URL dev"',
  'git check-ignore -q .env.e2e && echo ok; ls -l .env.e2e | awk \'{print $1}\'; set -a; . ./.env.e2e; set +a',
  'node --env-file=.env.e2e skrypt.mjs',
  "grep -ohE 'SUPABASE_URL=https://[a-z0-9]{6}' .env .env.local .env.e2e 2>/dev/null",
  "grep -oE '^[A-Z0-9_]*(PASSWORD|PASS|HASLO)[A-Z0-9_]*=' .env .env.local .env.e2e 2>/dev/null | cut -d= -f1 | sort -u",
  "awk -F= '{print $1}' .env",
  'cut -d= -f1 .env.local',
  'cat .env | wc -l',
  'cat .claude/templates/e2e-env/.env.e2e.example',
  "ls -a | grep -E '^\\.env'",
  'git ls-files | grep -i "\\.env"',
  'grep -n "^\\.env" .gitignore',
  "sed -i '' 's/^- \\[ \\] `grep SUPABASE_URL .env .env.local`/- [x] ok/' docs/operator/smoke.md",
  "python3 - <<'EOF'\ns = s.replace('`cat .env.e2e`', '`grep -c . .env.e2e`')\ncat .env.e2e\nEOF",
  'cp .env.e2e "$CLAUDE_JOB_DIR/tmp/env.bak"',
]

test('komendy wypisujace wartosci z .env* (sesje vibersi etap 2 i 3) sa zablokowane z nazwa pliku', () => {
  for (const [komenda, plik] of WYPISUJACE) {
    const ocena = ocenKomende(komenda)
    assert.equal(ocena.blokada, true, komenda)
    assert.equal(ocena.blokada && ocena.plik, plik, komenda)
  }
})

test('nazwy kluczy, obecnosc, liczniki, wartosc do zmiennej, filtr w potoku i pliki wzorcowe przechodza', () => {
  for (const komenda of BEZ_WARTOSCI) assert.deepEqual(ocenKomende(komenda), { blokada: false }, komenda)
})

/** @param {unknown} wejscie */
const uruchom = (wejscie) => spawnSync('node', [HOOK], { encoding: 'utf8', input: typeof wejscie === 'string' ? wejscie : JSON.stringify(wejscie) })

test('CLI hooka: blokada = kod 2 i powod z bezpieczna alternatywa na stderr; inna komenda = kod 0 bez wyjscia', () => {
  const blokada = uruchom({ tool_name: 'Bash', tool_input: { command: "grep '^E2E_TEST_EMAIL=' .env.e2e | cut -d= -f2" } })
  assert.equal(blokada.status, 2)
  assert.match(blokada.stderr, /wypisałaby wartości z \.env\.e2e/)
  assert.match(blokada.stderr, /grep -oE '\^\[A-Z0-9_\]\+=' \.env\.e2e/)
  assert.match(blokada.stderr, /set -a; \. \.env\.e2e; set \+a/)
  const ok = uruchom({ tool_name: 'Bash', tool_input: { command: "grep -oE '^[A-Z0-9_]+=' .env.e2e" } })
  assert.equal(ok.status, 0)
  assert.equal(ok.stderr, '')
})

test('CLI hooka: nieczytelne wejscie albo brak komendy = przepuszczenie (kod 0)', () => {
  assert.equal(uruchom('to nie json').status, 0)
  assert.equal(uruchom({ tool_name: 'Bash', tool_input: {} }).status, 0)
})

test('settings.json: hook PreToolUse dla Bash wskazuje env-wartosci.mjs', () => {
  const ustawienia = JSON.parse(readFileSync(resolve(HOOKI, '../settings.json'), 'utf8'))
  const wpisy = ustawienia.hooks.PreToolUse.filter((/** @type {{ matcher: string }} */ w) => w.matcher === 'Bash')
  assert.ok(wpisy.some((/** @type {{ hooks: Array<{ command: string }> }} */ w) => w.hooks.some((h) => h.command === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/env-wartosci.mjs"')))
})
