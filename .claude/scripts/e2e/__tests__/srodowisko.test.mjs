// Srodowisko E2E (P14): parametry .env.e2e, sprawdzenie przed startem (Doctor), decyzja startowa zadania, start i stop serwera.
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/srodowisko.test.mjs

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { bledySrodowiska, konfiguracja, odpowiada, parsujEnv, stanSerwera, zatrzymajSerwer } from '../srodowisko.mjs'
import { startE2e } from '../start.mjs'

const ZADANIE = 'docs/active/z'
const BAZA = 'VITE_SUPABASE_URL=https://e2e.supabase.co\nVITE_SUPABASE_ANON_KEY=a\nSUPABASE_E2E_DB_URL=postgres://x\nSUPABASE_E2E_SERVICE_ROLE_KEY=s\nE2E_TEST_EMAIL=t@x.pl\nE2E_TEST_PASSWORD=p\n'
/** @type {import('../srodowisko.mjs').Narzedzia} */
const SPRAWNE = { czyIgnorowany: () => true, agentBrowser: () => ({ ok: true, detal: '' }) }

/** @param {{ zadania?: string, env?: string | null, pliki?: Record<string, string> }} o */
function projekt({ zadania = '## Faza 1 — A\n\n- [ ] Test: [E2E] `a` — /a → ok\n', env = null, pliki = {} } = {}) {
  const katalog = mkdtempSync(join(tmpdir(), 'e2e-srodowisko-'))
  mkdirSync(join(katalog, ZADANIE), { recursive: true })
  writeFileSync(join(katalog, ZADANIE, 'z-zadania.md'), zadania)
  if (env !== null) writeFileSync(join(katalog, '.env.e2e'), env)
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(join(katalog, p, '..'), { recursive: true })
    writeFileSync(join(katalog, p), t)
  }
  return katalog
}

/** @returns {Promise<number>} wolny port */
function wolnyPort() {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.on('error', reject)
    s.listen(0, () => {
      const adres = s.address()
      s.close(() => resolve(typeof adres === 'object' && adres ? adres.port : 0))
    })
  })
}

test('parsujEnv: komentarze, export, cudzyslowy, komentarz za wartoscia', () => {
  assert.deepEqual(parsujEnv('# x\nexport A=1\nB="dwa # nie komentarz"\nC=3 # komentarz\n  D = cztery\nE=\'x\' # komentarz\n'), { A: '1', B: 'dwa # nie komentarz', C: '3', D: 'cztery', E: 'x' })
})

test('konfiguracja: domyslnie dev server Vite na 5173 z menedzerem z lockfile; parametry z .env.e2e wygrywaja', () => {
  const p = projekt({ pliki: { 'pnpm-lock.yaml': '' } })
  const dom = konfiguracja(p, {})
  assert.equal(dom.url, 'http://localhost:5173')
  assert.equal(dom.start, 'pnpm run dev -- --mode e2e --port 5173 --strictPort')
  assert.equal(dom.limitSek, 90)
  assert.equal(dom.bazaE2e, false)
  const wlasne = konfiguracja(p, { E2E_URL: 'http://127.0.0.1:4100', E2E_HEALTH: 'http://127.0.0.1:4100/zdrowie', E2E_START_TIMEOUT: '15' })
  assert.equal(wlasne.start, 'pnpm run dev -- --mode e2e --port 4100 --strictPort')
  assert.equal(wlasne.zdrowie, 'http://127.0.0.1:4100/zdrowie')
  assert.equal(wlasne.limitSek, 15)
  assert.equal(konfiguracja(p, { E2E_START: 'node serwer.js' }).start, 'node serwer.js')
  assert.equal(konfiguracja(p, { SUPABASE_E2E_DB_URL: 'x' }).bazaE2e, true)
  rmSync(p, { recursive: true })
})

test('sprawdzenie: plik poza .gitignore, brak kluczy bazy, ta sama baza co dev, agent-browser — kazdy blad z naprawa', () => {
  const p = projekt({ pliki: { 'supabase/config.toml': '', '.env': 'VITE_SUPABASE_URL=https://e2e.supabase.co\n' } })
  const bledy = bledySrodowiska(p, parsujEnv('VITE_SUPABASE_URL=https://e2e.supabase.co\n'), {
    przegladarka: true, narzedzia: { czyIgnorowany: () => false, agentBrowser: () => ({ ok: false, detal: 'brak agent-browser' }) },
  })
  assert.equal(bledy.length, 4)
  assert.match(bledy[0], /\.env\.e2e nie jest w \.gitignore — dopisz go/)
  assert.match(bledy[1], /dedykowanego projektu Supabase e2e/)
  assert.match(bledy[2], /brak kluczy bazy e2e w \.env\.e2e: VITE_SUPABASE_ANON_KEY, SUPABASE_E2E_DB_URL, SUPABASE_E2E_SERVICE_ROLE_KEY, E2E_TEST_EMAIL, E2E_TEST_PASSWORD/)
  assert.match(bledy[3], /agent-browser nie dziala: brak agent-browser — instalacja: npm i -g agent-browser/)
  rmSync(p, { recursive: true })
})

test('sprawdzenie: projekt bez Supabase nie wymaga kluczy bazy; komplet kluczy i inna baza = zero bledow', () => {
  const bez = projekt()
  assert.deepEqual(bledySrodowiska(bez, {}, { przegladarka: true, narzedzia: SPRAWNE }), [])
  const z = projekt({ pliki: { 'supabase/config.toml': '', '.env': 'VITE_SUPABASE_URL=https://dev.supabase.co\n' } })
  assert.deepEqual(bledySrodowiska(z, parsujEnv(BAZA), { przegladarka: true, narzedzia: SPRAWNE }), [])
  rmSync(bez, { recursive: true })
  rmSync(z, { recursive: true })
})

test('sprawdzenie: zmieniona wypchnieta migracja (migrations.sum) blokuje baze e2e', () => {
  const p = projekt({ pliki: { 'supabase/migrations/001_a.sql': 'select 2;', 'supabase/migrations.sum': `${'0'.repeat(64)}  001_a.sql\n` } })
  const bledy = bledySrodowiska(p, parsujEnv(BAZA), { przegladarka: false, narzedzia: SPRAWNE })
  assert.equal(bledy.length, 1)
  assert.match(bledy[0], /^migrations\.sum: supabase\/migrations\/001_a\.sql — migracja zmieniona po zapisie sumy/)
  rmSync(p, { recursive: true })
})

test('decyzja startowa: zadanie bez scenariuszy = pominieto; scenariusze bez .env.e2e = brak-srodowiska z naprawa', async () => {
  const bezScen = projekt({ zadania: '## Faza 1 — A\n\n- [ ] Stwórz: `a.ts`\n- [x] Test: [E2E] `a` — /a → ok\n' })
  const w1 = await startE2e(bezScen, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(w1.status, 'pominieto')
  assert.equal(w1.scenariusze, 0)
  const bezEnv = projekt()
  const w2 = await startE2e(bezEnv, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(w2.status, 'brak-srodowiska')
  assert.equal(w2.scenariusze, 1)
  assert.match(w2.naprawa, /\.claude\/templates\/e2e-env\/README\.md/)
  assert.match(w2.naprawa, /\[E2E\] na \[Manual\]/)
  assert.match(w2.naprawa, /node \.claude\/scripts\/e2e\/e2e\.mjs sprawdz --zadanie docs\/active\/z/)
  rmSync(bezScen, { recursive: true })
  rmSync(bezEnv, { recursive: true })
})

test('decyzja startowa: .env.e2e z bledem = niepowodzenie z lista bledow (STOP przed faza 1)', async () => {
  const p = projekt({ env: '' })
  const w = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: { ...SPRAWNE, czyIgnorowany: () => false } })
  assert.equal(w.status, 'niepowodzenie')
  assert.deepEqual(w.bledy, ['.env.e2e nie jest w .gitignore — dopisz go (plik zawiera sekrety)'])
  assert.match(w.naprawa, /^Popraw: \.env\.e2e nie jest w \.gitignore/)
  rmSync(p, { recursive: true })
})

test('start: uruchamia serwer z E2E_START, czeka na sonde, stop zabija tylko swoj proces; drugi start zastaje dzialajacy', async () => {
  const port = await wolnyPort()
  const start = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=${start}\nE2E_START_TIMEOUT=20\n` })
  const w = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(w.status, 'gotowe', w.detal)
  assert.equal(w.serwer, 'uruchomione')
  const konf = konfiguracja(p, parsujEnv(`E2E_URL=http://127.0.0.1:${port}\n`))
  assert.ok(existsSync(konf.pid))
  // Serwer odpowiada, ale nie ma naszego PID-u (ktos odpalil go recznie) = zastany z ostrzezeniem o bazie dev.
  const pid = readFileSync(konf.pid, 'utf8')
  rmSync(konf.pid)
  const drugi = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(drugi.serwer, 'zastane')
  assert.match(drugi.detal, /zastany, moze dzialac na bazie dev/)
  writeFileSync(konf.pid, pid)
  assert.equal(zatrzymajSerwer(konf).posprzatano, true)
  let dziala = true
  for (let i = 0; i < 20 && dziala; i += 1) {
    dziala = await odpowiada(`http://127.0.0.1:${port}`)
    if (dziala) await new Promise((r) => setTimeout(r, 100))
  }
  assert.equal(dziala, false)
  assert.equal(existsSync(konf.pid), false)
  rmSync(p, { recursive: true })
})

test('start: komenda, ktora konczy sie przed odpowiedzia = niepowodzenie z ogonem logu', async () => {
  const port = await wolnyPort()
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=echo port zajety && exit 3\n` })
  const w = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(w.status, 'niepowodzenie')
  assert.match(w.detal, /zakonczyla sie \(3\)/)
  assert.match(w.detal, /port zajety/)
  rmSync(p, { recursive: true })
})

test('start: brak odpowiedzi w E2E_START_TIMEOUT = niepowodzenie, proces zatrzymany', async () => {
  const port = await wolnyPort()
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=sleep 30\nE2E_START_TIMEOUT=1\n` })
  const w = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(w.status, 'niepowodzenie')
  assert.match(w.detal, /nie odpowiada po 1 s/)
  assert.equal(existsSync(konfiguracja(p, {}).pid), false)
  rmSync(p, { recursive: true })
})

test('sprawdz bez startu (Doctor): gotowe przy poprawnym .env.e2e, serwer brak', async () => {
  const port = await wolnyPort()
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\n` })
  const w = await startE2e(p, ZADANIE, { uruchom: false, narzedzia: SPRAWNE })
  assert.equal(w.status, 'gotowe')
  assert.equal(w.serwer, 'brak')
  assert.match(w.detal, /autopilot uruchomi/)
  rmSync(p, { recursive: true })
})

test('E2E_URL bez schematu albo nie-URL = blad sprawdzenia z naprawa, nie wyjatek skryptu', () => {
  const p = projekt()
  for (const url of ['localhost:5173', 'nie-url', '127.0.0.1:3000']) {
    const konf = konfiguracja(p, { E2E_URL: url })
    assert.match(konf.blad ?? '', /E2E_URL .* — podaj pelny adres http\(s\):\/\//, url)
    const bledy = bledySrodowiska(p, { E2E_URL: url }, { przegladarka: false, narzedzia: SPRAWNE })
    assert.equal(bledy.length, 1, url)
  }
  rmSync(p, { recursive: true })
})

test('guard tozsamosci dziala takze bez katalogu supabase/ (VITE_SUPABASE_URL w .env.e2e = jak w .env)', () => {
  const p = projekt({ pliki: { '.env': 'VITE_SUPABASE_URL=https://dev.supabase.co\n' } })
  const bledy = bledySrodowiska(p, { VITE_SUPABASE_URL: 'https://dev.supabase.co' }, { przegladarka: false, narzedzia: SPRAWNE })
  assert.equal(bledy.length, 1)
  assert.match(bledy[0], /dedykowanego projektu Supabase e2e/)
  rmSync(p, { recursive: true })
})

test('limit startu przyciety do 540 s (limit Basha agenta 600 s)', () => {
  assert.equal(konfiguracja('/tmp/x', { E2E_START_TIMEOUT: '9999' }).limitSek, 540)
})

test('wlasny serwer z poprzedniego runu (zywy PID) = uruchomione, nie zastany; stan serwera z ogonem logu', async () => {
  const port = await wolnyPort()
  const start = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=${start}\n` })
  assert.equal((await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })).serwer, 'uruchomione')
  const ponowny = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(ponowny.serwer, 'uruchomione')
  assert.doesNotMatch(ponowny.detal, /zastany/)
  const konf = konfiguracja(p, parsujEnv(`E2E_URL=http://127.0.0.1:${port}\n`))
  const stan = stanSerwera(konf)
  assert.equal(stan.zyje, true)
  assert.equal(typeof stan.ogonLogu, 'string')
  zatrzymajSerwer(konf)
  assert.equal(stanSerwera(konf).zyje, false)
  rmSync(p, { recursive: true })
})
