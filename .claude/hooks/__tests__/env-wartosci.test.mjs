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
  // Obejscia z recenzji P20 S1: kontynuacja linii, -e, sed bez podstawienia, slowa powloki i opakowania, stderr, cudzyslowy.
  ['grep -n KEY \\\n  .env.e2e', '.env.e2e'],
  ['cd /x && \\\n grep E2E_ .env.e2e', '.env.e2e'],
  ['grep -e KEY .env', '.env'],
  ['grep -E -e "^DB" .env.local', '.env.local'],
  ['sed -n -e "/KEY/p" .env', '.env'],
  ['sed "/^#/d" .env.e2e', '.env.e2e'],
  ['sed 1d .env', '.env'],
  ['grep -v "^#" .env.e2e | sed "/^$/d"', '.env.e2e'],
  ["sed 's/^PASS=.*//' .env", '.env'],
  ["sed 's/=.*/=&/' .env", '.env'],
  ['if true; then cat .env; fi', '.env'],
  ['for f in x; do cat .env.e2e; done', '.env.e2e'],
  ['{ cat .env; }', '.env'],
  ['! grep KEY .env', '.env'],
  ['sudo -u x cat .env', '.env'],
  ['env -i cat .env', '.env'],
  ['time cat .env', '.env'],
  ['nice -n 5 cat .env', '.env'],
  ['bash -c "cat .env"', '.env'],
  ['eval "cat .env"', '.env'],
  ['cat .env.e2e > /dev/stderr', '.env.e2e'],
  ['cat .env.e2e 1>/dev/fd/2', '.env.e2e'],
  ['cat .env.e2e &> /dev/stderr', '.env.e2e'],
  ['cat .env.e2e >| /dev/stderr', '.env.e2e'],
  ['cat .env | tee /dev/stderr | wc -l', '.env'],
  ['cat .env | tee kopia', '.env'],
  ['echo "it\'s"; echo "$(cat .env)"', '.env'],
  ["grep -oE '[[:graph:]]+' .env", '.env'],
  ["grep -oE '\\w+' .env", '.env'],
  ["grep -oE 'PASS=.{0,64}' .env", '.env'],
  ['cat .env.e2e~', '.env.e2e~'],
  ['grep -A 2 KEY .env', '.env'],
  ['cat "niedomkniety .env', '.env*'],
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
  'cat .env.sample; cat .env.template',
  'cat config/app.env',
  'cut -d= -f 1 .env',
  "cut -d '=' -f1 .env",
  "sed -n 's/=.*//p' .env",
  "sed 's/^\\([A-Z_]*\\)=.*/\\1/' .env",
  "sed '/^#/d; s/=.*//' .env",
  'awk -F= "{print \\$1}" .env',
  "awk -F= '!/^#/{print $1}' .env",
  'cat .env.e2e > kopia.txt',
  'cat .env.e2e > /dev/null',
  'bash -c "set -a; . ./.env.e2e; set +a; psql \\"$SUPABASE_E2E_DB_URL\\" -c \\"select 1\\""',
  'timeout 100 bash -c \'set -a; . ./.env.e2e; supabase db push --db-url "$SUPABASE_E2E_DB_URL"\'',
  'echo "it\'s ok"; grep -c KEY .env',
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

// P22 E1: sekrety bez pliku .env*. live-10-demo etap a–d: runbook Coolify kazal `--show-sensitive | grep`, haslo bazy trafilo
// na stdout agenta (P1 review fazy 6). Te same zasady co dla .env*: do zmiennej, filtr bez wartosci, plik — przechodza.
const SEKRETY_BEZ_PLIKU = [
  ["coolify database get tlid --format json --show-sensitive --context prod | grep -i password", 'show-sensitive'],
  ['coolify app env list dquk --show-sensitive', 'show-sensitive'],
  ["coolify app env list dquk --show-sensitive 2>&1 | grep -i 'SUPABASE_URL' | head -2", 'show-sensitive'],
  ['coolify app env list dquk --show-sensitive=true | tee /dev/stderr | wc -l', 'show-sensitive'],
  ['echo "$(coolify app env list dquk --show-sensitive)"', 'show-sensitive'],
  ['printenv', 'zmienne'],
  ['printenv SUPABASE_SECRET_KEY', 'zmienne'],
  ['printenv PATH SUPABASE_SECRET_KEY', 'zmienne'],
  ['env', 'zmienne'],
  ['env -0', 'zmienne'],
  ['FOO=1 env', 'zmienne'],
  ['/usr/bin/env | grep -i token', 'zmienne'],
  ['env | grep -i EXPO_TOKEN | cut -c1-20', 'zmienne'],
  ['echo "$(printenv TOKEN)"', 'zmienne'],
  ['set -x; psql "$SUPABASE_E2E_DB_URL" -c "select 1"', 'xtrace'],
  ['set -euxo pipefail', 'xtrace'],
  ['set -o xtrace', 'xtrace'],
  ['bash -x skrypt.sh', 'xtrace'],
  ["sh -xc 'echo $X'", 'xtrace'],
  ['T=$(set -x; echo a)', 'xtrace'],
]
const SEKRETY_BEZ_WYPISANIA = [
  "U=$(coolify database get tlid --format json --show-sensitive --context prod | jq -r '.internal_db_url')",
  "coolify database get tlid --format json --show-sensitive --context prod | jq -r 'keys[]' | tr '\\n' ' '",
  'coolify app env list dquk --show-sensitive --format json | jq length',
  "coolify app env list dquk --show-sensitive 2>&1 | grep -c 'AA_MEMBERSHIP'",
  "coolify app env list dquk --show-sensitive 2>&1 | grep -oE '^[A-Z_]+=' | sort",
  'coolify app env list dquk --show-sensitive > /tmp/cf.txt 2>/dev/null',
  'coolify app env list dquk --format json',
  'printenv PATH',
  'printenv HOME TMPDIR',
  'env | cut -d= -f1',
  'env | grep -c SUPABASE',
  'env FOO=1 node skrypt.mjs',
  "env -i HOME=$HOME bash -c 'echo ok'",
  'set +x',
  'set -e',
  'set -euo pipefail',
  'bash -e skrypt.sh',
  "bash -c 'echo x'",
  'grep -n -- --show-sensitive docs/deploy/coolify.md',
  'for s in a --show-sensitive; do echo "$s"; done',
  'echo "--show-sensitive"',
  'git log -x',
  'FOO=$(cat .env) echo hi',
]

test('E1: --show-sensitive, printenv, gole env i xtrace wypisujace sekrety sa zablokowane z rodzajem', () => {
  for (const [komenda, rodzaj] of SEKRETY_BEZ_PLIKU) {
    const ocena = ocenKomende(komenda)
    assert.equal(ocena.blokada && ocena.rodzaj, rodzaj, komenda)
  }
})

test('E1: wartosc do zmiennej, klucze jq, licznik, plik, jawne zmienne, env jako opakowanie, set bez x — przechodza', () => {
  for (const komenda of SEKRETY_BEZ_WYPISANIA) assert.deepEqual(ocenKomende(komenda), { blokada: false }, komenda)
})

test('E1 CLI: powod blokady wedlug rodzaju z bezpieczna alternatywa', () => {
  const pokaz = uruchom({ tool_name: 'Bash', tool_input: { command: 'coolify app env list x --show-sensitive | grep DB' } })
  assert.equal(pokaz.status, 2)
  assert.match(pokaz.stderr, /--show-sensitive wypisałoby sekrety do transkryptu/)
  assert.match(pokaz.stderr, /U=\$\(coolify app env list <uuid> --format json --show-sensitive \| jq -r '\.\[\] \| select\(\.key=="KLUCZ"\) \| \.value'\)/)
  assert.match(pokaz.stderr, /Nazwy: coolify app env list <uuid> --format json \| jq -r '\.\[\]\.key' \(bez --show-sensitive CLI maskuje wartości\)/)
  const zmienne = uruchom({ tool_name: 'Bash', tool_input: { command: 'printenv' } })
  assert.match(zmienne.stderr, /printenv wypisałoby wartości zmiennych środowiska/)
  assert.match(zmienne.stderr, /Nazwy: env \| grep -oE '\^\[A-Za-z_\]\[A-Za-z0-9_\]\*='\. Obecność: \[ -n "\$KLUCZ" \] && echo ustawiona/)
  const xtrace = uruchom({ tool_name: 'Bash', tool_input: { command: 'set -x' } })
  assert.match(xtrace.stderr, /xtrace \(set -x, bash -x\) wypisuje rozwinięte komendy z wartościami zmiennych/)
  const plik = uruchom({ tool_name: 'Bash', tool_input: { command: 'cat .env' } })
  assert.match(plik.stderr, /wypisałaby wartości z \.env/)
})

// P22 E1 po recenzji: obejscia (krotka flaga Coolify -s, komenda zdalna przez ssh/docker exec/kubectl exec, bash -lc,
// filtry KLUCZ=WARTOSC na tabeli Coolify, export/declare/set), falszywe blokady (/usr/bin/env node, env -S, bash skrypt.sh -x,
// xtrace ze stderr do pliku, git grep) i mutacje, ktore przezyly pierwsza wersje testow.
const OBEJSCIA = [
  ['coolify app env list x -s | grep DB', 'show-sensitive'],
  ['coolify database get x -s --format json', 'show-sensitive'],
  ["ssh vps 'docker exec abc printenv POSTGRES_PASSWORD'", 'zmienne'],
  ['docker exec -e A=1 ctr env', 'zmienne'],
  ["docker exec ctr sh -c 'env | grep -i pass'", 'zmienne'],
  ['docker compose exec app env', 'zmienne'],
  ['docker exec --user root ctr printenv', 'zmienne'],
  ['kubectl exec pod -- env', 'zmienne'],
  ["docker inspect ctr --format '{{range .Config.Env}}{{println .}}{{end}}'", 'zmienne'],
  ["bash -lc 'printenv'", 'zmienne'],
  ["bash -lc 'cat .env'", 'env-plik'],
  ['coolify app env list x --show-sensitive | cut -d= -f1', 'show-sensitive'],
  ["coolify app env list x --show-sensitive | sed 's/=.*//'", 'show-sensitive'],
  ["coolify app env list x --show-sensitive | grep -oE 'postgres://[a-zA-Z0-9:@_-]*'", 'show-sensitive'],
  ["grep -oE 'postgres://[a-zA-Z0-9:@_-]*' .env", 'env-plik'],
  ['export -p', 'zmienne'],
  ['export', 'zmienne'],
  ['declare -x', 'zmienne'],
  ['declare -p DB_URL', 'zmienne'],
  ['set | grep TOKEN', 'zmienne'],
  ['set -eo xtrace', 'xtrace'],
  ['bash -o xtrace skrypt.sh', 'xtrace'],
  ['bash -x', 'xtrace'],
  ["U=$(coolify database get x --format json --show-sensitive | jq -r '.internal_db_url'); echo \"$U\"", 'show-sensitive'],
  ['U=$(printenv DB_URL); printf "%s\\n" "${U}"', 'zmienne'],
  ["coolify app env list x --show-sensitive | grep -oE '[a-z]{20}\\.supabase\\.co'", 'show-sensitive'],
  ["grep -oE '[A-Za-z0-9+/=]+' .env", 'env-plik'],
  ['timeout 5 printenv', 'zmienne'],
  ['timeout 5 cat .env', 'env-plik'],
  ['env | tee /dev/stderr | grep -c X', 'zmienne'],
  ["coolify app env list x --show-sensitive --format json | jq -r 'keys[], .[]'", 'show-sensitive'],
]
const BEZ_BLOKADY_PO_RECENZJI = [
  '/usr/bin/env node x.mjs',
  '/usr/bin/env bash skrypt.sh',
  "env -S 'node x.mjs'",
  'bash skrypt.sh -x',
  'bash -e skrypt.sh -x',
  'bash +e skrypt.sh -x',
  'bash -x s.sh 2>/dev/null',
  'bash -x s.sh 2>/tmp/log',
  'U=$(echo "$(printenv TOKEN)")',
  'git grep -n -- --show-sensitive',
  'git grep -e --show-sensitive',
  "coolify app env list x --show-sensitive --format json | jq -r '.[].key'",
  "coolify app env list x --show-sensitive --format json | jq 'map(.key)'",
  "coolify app env list x --show-sensitive --format json | jq -r '.[0] | keys'",
  "coolify app env list x --show-sensitive --format json | jq -r '.[] | keys[]'",
  'coolify app env list x --show-sensitive --format json | jq type',
  'printenv -0 PATH',
  'set -o pipefail',
  'printenv | true',
  'T=$(printenv TOKEN) echo ok',
  'export NODE_ENV=production',
  'declare -f moja_funkcja',
  "ssh vps 'docker ps --format {{.Names}}'",
  'docker exec ctr ls /app',
  'set -e',
  'env | grep -c X | tee /dev/stderr',
  "coolify app env list x --show-sensitive 2>&1 | grep -oE '\\bVITE_[A-Z_]+' | sort -u",
  "grep -oE '^[A-Z0-9_]+' .env.local",
  'grep -o "https://[a-z]*\\.supabase\\.co" .env',
  "U=$(coolify database get x --format json --show-sensitive | jq -r '.url'); echo \"długość ${#U}\"; psql \"$U\" -c 'select 1'",
  'U=$(printenv DB_URL); echo "$U" | wc -c',
  'U=$(printenv PATH); echo "$U"',
  "T=$(grep '^KLUCZ=' .env | cut -d= -f2-); echo $T",
  'printenv DB_URL | shasum -a 256',
]

test('E1 po recenzji: obejscia zablokowane z rodzajem', () => {
  for (const [komenda, rodzaj] of OBEJSCIA) {
    const ocena = ocenKomende(komenda)
    assert.equal(ocena.blokada && ocena.rodzaj, rodzaj, komenda)
  }
  const pokaz = ocenKomende('coolify app env list x --show-sensitive | grep DB')
  assert.equal(pokaz.blokada && pokaz.plik, '--show-sensitive')
})

test('E1 po recenzji: opakowania, argumenty skryptu, stderr do pliku, git grep, filtry jq nazw — bez blokady', () => {
  for (const komenda of BEZ_BLOKADY_PO_RECENZJI) assert.deepEqual(ocenKomende(komenda), { blokada: false }, komenda)
})
