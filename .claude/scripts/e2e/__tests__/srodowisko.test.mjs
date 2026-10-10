// Srodowisko E2E (P14): parametry .env.e2e, sprawdzenie przed startem (Doctor), decyzja startowa zadania, start i stop serwera.
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/srodowisko.test.mjs

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { odpowiada, stanSerwera, zatrzymajSerwer } from '../serwer.mjs'
import { bledySrodowiska, konfiguracja, parsujEnv } from '../srodowisko.mjs'
import { restartFazy, startE2e } from '../start.mjs'

const ZADANIE = 'docs/active/z'
const BAZA = 'VITE_SUPABASE_URL=https://e2e.supabase.co\nVITE_SUPABASE_ANON_KEY=a\nSUPABASE_E2E_DB_URL=postgres://x\nSUPABASE_E2E_SERVICE_ROLE_KEY=s\nE2E_TEST_EMAIL=t@x.pl\nE2E_TEST_PASSWORD=p\n'
/** @type {import('../srodowisko.mjs').Narzedzia} */
const SPRAWNE = { czyIgnorowany: () => true, agentBrowser: () => ({ ok: true, detal: '' }) }

// Sprzatanie po kazdym tescie, takze padnietym: serwer pipeline'u z pliku PID (zatrzymajSerwer zabija tylko nasz proces),
// log i plik PID w /tmp, katalog projektu.
/** @type {string[]} */
const PROJEKTY = []
test.afterEach(async () => {
  for (const p of PROJEKTY.splice(0)) {
    const env = existsSync(join(p, '.env.e2e')) ? parsujEnv(readFileSync(join(p, '.env.e2e'), 'utf8')) : {}
    const konf = konfiguracja(p, env)
    await zatrzymajSerwer(konf)
    rmSync(konf.log, { force: true })
    rmSync(konf.pid, { force: true })
    rmSync(p, { recursive: true, force: true })
  }
})

/** @param {{ zadania?: string, env?: string | null, pliki?: Record<string, string> }} o */
function projekt({ zadania = '## Faza 1 — A\n\n- [ ] Test: [E2E] `a` — /a → ok\n', env = null, pliki = {} } = {}) {
  const katalog = mkdtempSync(join(tmpdir(), 'e2e-srodowisko-'))
  PROJEKTY.push(katalog)
  mkdirSync(join(katalog, ZADANIE), { recursive: true })
  writeFileSync(join(katalog, ZADANIE, 'z-zadania.md'), zadania)
  if (env !== null) writeFileSync(join(katalog, '.env.e2e'), env)
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(join(katalog, p, '..'), { recursive: true })
    writeFileSync(join(katalog, p), t)
  }
  return katalog
}

/** @param {string} p @returns {import('../srodowisko.mjs').Konfiguracja} konfiguracja z .env.e2e projektu (ta sama co w skrypcie) */
const konfProjektu = (p) => konfiguracja(p, parsujEnv(readFileSync(join(p, '.env.e2e'), 'utf8')))

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
  // Wartosc ze spacjami w cudzyslowie: `. .env.e2e` w shellu (db-sync) bez cudzyslowu wykonalby `--filter` jako komende.
  assert.equal(konfiguracja(p, parsujEnv('E2E_START="pnpm --filter @x/web exec vite --mode e2e"\n')).start, 'pnpm --filter @x/web exec vite --mode e2e')
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
  assert.match(bledy[2], /brak kluczy bazy e2e w \.env\.e2e: VITE_SUPABASE_PUBLISHABLE_KEY \(albo legacy VITE_SUPABASE_ANON_KEY\), SUPABASE_E2E_DB_URL, SUPABASE_E2E_SERVICE_ROLE_KEY, E2E_TEST_EMAIL, E2E_TEST_PASSWORD/)
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

test('sprawdzenie: klucz klienta bazy e2e = publishable albo legacy anon (Supabase wycofuje anon do konca 2026)', () => {
  const p = projekt({ pliki: { 'supabase/config.toml': '' } })
  const publishable = BAZA.replace('VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY')
  assert.deepEqual(bledySrodowiska(p, parsujEnv(publishable), { przegladarka: false, narzedzia: SPRAWNE }), [])
  assert.deepEqual(bledySrodowiska(p, parsujEnv(BAZA), { przegladarka: false, narzedzia: SPRAWNE }), [])
  const bez = bledySrodowiska(p, parsujEnv(BAZA.replace('VITE_SUPABASE_ANON_KEY=a\n', '')), { przegladarka: false, narzedzia: SPRAWNE })
  assert.deepEqual(bez, ['brak kluczy bazy e2e w .env.e2e: VITE_SUPABASE_PUBLISHABLE_KEY (albo legacy VITE_SUPABASE_ANON_KEY) — szablon: .claude/templates/e2e-env/README.md'])
  rmSync(p, { recursive: true })
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
  const konf = konfProjektu(p)
  assert.ok(existsSync(konf.pid))
  // Serwer odpowiada, ale nie ma naszego PID-u (ktos odpalil go recznie) = zastany z ostrzezeniem o bazie dev.
  const pid = readFileSync(konf.pid, 'utf8')
  rmSync(konf.pid)
  const drugi = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(drugi.serwer, 'zastane')
  assert.match(drugi.detal, /zastany, moze dzialac na bazie dev/)
  writeFileSync(konf.pid, pid)
  assert.equal((await zatrzymajSerwer(konf)).posprzatano, true)
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

test('bez zadania (Doctor i Launch skilla weryfikacji): sprawdzenie zawsze; brak .env.e2e = brak-srodowiska z komenda bez --zadanie', async () => {
  const p = projekt({ zadania: '## Faza 1 — A\n\n- [ ] Stwórz: `a.ts`\n' })
  const bez = await startE2e(p, null, { uruchom: false, narzedzia: SPRAWNE })
  assert.equal(bez.status, 'brak-srodowiska')
  assert.equal(bez.scenariusze, null)
  assert.match(bez.detal, /repo nie ma \.env\.e2e/)
  assert.match(bez.naprawa, /\.claude\/templates\/e2e-env\/README\.md/)
  assert.match(bez.naprawa, /node \.claude\/scripts\/e2e\/e2e\.mjs sprawdz$/)
  assert.doesNotMatch(bez.naprawa, /--zadanie|\[Manual\]/)
  const port = await wolnyPort()
  writeFileSync(join(p, '.env.e2e'), `E2E_URL=http://127.0.0.1:${port}\n`)
  const ok = await startE2e(p, null, { uruchom: false, narzedzia: SPRAWNE })
  assert.deepEqual([ok.status, ok.serwer], ['gotowe', 'brak'])
  const blad = await startE2e(p, null, { uruchom: false, narzedzia: { ...SPRAWNE, agentBrowser: () => ({ ok: false, detal: 'chrome: fail' }) } })
  assert.equal(blad.status, 'niepowodzenie')
  assert.match(blad.naprawa, /e2e\.mjs sprawdz$/)
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
  const konf = konfProjektu(p)
  const stan = stanSerwera(konf)
  assert.equal(stan.zyje, true)
  assert.equal(typeof stan.ogonLogu, 'string')
  await zatrzymajSerwer(konf)
  assert.equal(stanSerwera(konf).zyje, false)
  rmSync(p, { recursive: true })
})

test('guard tozsamosci: .env ma VITE_SUPABASE_URL, a .env.e2e nie (Vite w trybie e2e doczyta baze dev); porownanie po origin', () => {
  const p = projekt({ pliki: { '.env': 'VITE_SUPABASE_URL=https://dev.supabase.co\n' } })
  const brak = bledySrodowiska(p, { E2E_URL: 'http://localhost:5173' }, { przegladarka: false, narzedzia: SPRAWNE })
  assert.equal(brak.length, 1)
  assert.match(brak[0], /brak VITE_SUPABASE_URL w \.env\.e2e/)
  const ukosnik = bledySrodowiska(p, { VITE_SUPABASE_URL: 'https://dev.supabase.co/' }, { przegladarka: false, narzedzia: SPRAWNE })
  assert.match(ukosnik[0] ?? '', /dedykowanego projektu Supabase e2e/)
  rmSync(p, { recursive: true })
})

test('E2E_HEALTH bez schematu = blad sprawdzenia (inaczej czekanie przez caly limit startu)', () => {
  const p = projekt()
  const bledy = bledySrodowiska(p, { E2E_HEALTH: 'localhost:5173/zdrowie' }, { przegladarka: false, narzedzia: SPRAWNE })
  assert.equal(bledy.length, 1)
  assert.match(bledy[0], /E2E_HEALTH/)
  rmSync(p, { recursive: true })
})

test('plik PID z cudzym procesem albo PID 1: serwer nie jest nasz, stop nikogo nie zabija', async () => {
  const port = await wolnyPort()
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\n` })
  const konf = konfProjektu(p)
  for (const tresc of ['1', String(process.pid), JSON.stringify({ pid: process.pid, start: 'inna komenda', odcisk: 'x' })]) {
    writeFileSync(konf.pid, tresc)
    const stan = stanSerwera(konf)
    assert.equal(stan.nasz, false, tresc)
    assert.equal((await zatrzymajSerwer(konf)).posprzatano, true, tresc)
    assert.equal(existsSync(konf.pid), false, 'plik PID usuniety, proces zostaje')
  }
  rmSync(p, { recursive: true })
})

test('stan: nasz serwer zabity z zewnatrz = nasz, nie zyje; serwer zastany (bez PID) = nie nasz', async () => {
  const port = await wolnyPort()
  const start = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=${start}\n` })
  await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  const konf = konfProjektu(p)
  assert.deepEqual({ nasz: stanSerwera(konf).nasz, zyje: stanSerwera(konf).zyje }, { nasz: true, zyje: true })
  const { pid } = JSON.parse(readFileSync(konf.pid, 'utf8'))
  process.kill(-pid, 'SIGTERM')
  await new Promise((r) => setTimeout(r, 300))
  assert.deepEqual({ nasz: stanSerwera(konf).nasz, zyje: stanSerwera(konf).zyje }, { nasz: true, zyje: false })
  await zatrzymajSerwer(konf)
  assert.equal(stanSerwera(konf).nasz, false)
  rmSync(p, { recursive: true })
})

/** @param {string} url @returns {Promise<string>} */
const odpowiedz = async (url) => (await fetch(url)).text()

test('zmiana .env.e2e: nasz serwer ze stara konfiguracja zatrzymany i uruchomiony od nowa (poprawka operatora dziala)', async () => {
  const port = await wolnyPort()
  const start = `node -e "require('http').createServer((q,s)=>s.end(process.env.MARK)).listen(${port})"`
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=${start}\nMARK=a\n` })
  assert.equal((await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })).serwer, 'uruchomione')
  assert.equal(await odpowiedz(`http://127.0.0.1:${port}`), 'a')
  writeFileSync(join(p, '.env.e2e'), `E2E_URL=http://127.0.0.1:${port}\nE2E_START=${start}\nMARK=b\n`)
  const ponowny = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(ponowny.serwer, 'uruchomione', ponowny.detal)
  assert.equal(await odpowiedz(`http://127.0.0.1:${port}`), 'b')
})

test('nasz serwer zywy, ale zawieszony (nie odpowiada): start zatrzymuje go i uruchamia od nowa', async () => {
  const port = await wolnyPort()
  const start = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=${start}\nE2E_START_TIMEOUT=20\n` })
  await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  const { pid } = JSON.parse(readFileSync(konfProjektu(p).pid, 'utf8'))
  process.kill(-pid, 'SIGSTOP')
  const w = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
  assert.equal(w.serwer, 'uruchomione', w.detal)
  assert.notEqual(JSON.parse(readFileSync(konfProjektu(p).pid, 'utf8')).pid, pid)
})

test('PID ponownie uzyty przez inny proces uzytkownika (inny czas startu): nie nasz, stop go nie zabija', async () => {
  const p = projekt({ env: 'E2E_URL=http://127.0.0.1:1\n' })
  const konf = konfProjektu(p)
  const { spawn } = await import('node:child_process')
  const obcy = spawn('sleep', ['30'])
  writeFileSync(konf.pid, JSON.stringify({ pid: obcy.pid, start: konf.start, odcisk: konf.odcisk, uruchomiony: 'Mon Jan  1 00:00:00 2024' }))
  assert.equal(stanSerwera(konf).zyje, false)
  await zatrzymajSerwer(konf)
  assert.equal(obcy.exitCode, null)
  assert.equal(obcy.kill(), true, 'obcy proces przezyl stop')
})

test('guard tozsamosci uwzglednia .env.e2e.local (Vite daje mu najwyzszy priorytet)', () => {
  const p = projekt({ pliki: { '.env': 'VITE_SUPABASE_URL=https://dev.supabase.co\n', '.env.e2e.local': 'VITE_SUPABASE_URL=https://dev.supabase.co\n' } })
  const bledy = bledySrodowiska(p, { VITE_SUPABASE_URL: 'https://e2e.supabase.co' }, { przegladarka: false, narzedzia: SPRAWNE })
  assert.equal(bledy.length, 1)
  assert.match(bledy[0], /\.env\.e2e\.local/)
})

// Smoke P16 (wf_1a28a396-1e1): autopilot startowal serwer w sesji z LANG=pl_PL.UTF-8, stop szedl z powloki z innym locale.
// `ps -o lstart=` formatuje date wg locale („pt.  9 paź” vs „Fri Oct  9”), wiec czas startu z pliku PID nie zgadzal sie z odczytem
// i stop uznal wlasny serwer za obcy. Czas startu jest zawsze czytany w locale C.
test('stop z innym locale niz start zatrzymuje wlasny serwer (czas startu w locale C)', async () => {
  const port = await wolnyPort()
  const start = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`
  const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=${start}\nE2E_START_TIMEOUT=20\n` })
  const lcAll = process.env.LC_ALL
  try {
    process.env.LC_ALL = 'pl_PL.UTF-8'
    const w = await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })
    assert.equal(w.serwer, 'uruchomione', w.detal)
    process.env.LC_ALL = 'C'
    const konf = konfProjektu(p)
    assert.equal(stanSerwera(konf).zyje, true, 'wlasny serwer uznany za obcy przy innym locale')
    assert.match((await zatrzymajSerwer(konf)).detal, /zatrzymany serwer PID/)
  } finally {
    if (lcAll === undefined) delete process.env.LC_ALL
    else process.env.LC_ALL = lcAll
  }
})

// P17 (vibersi etap 1): projekt od zera — przed faza 1 komenda startu nie ma czego uruchomic. To nie awaria srodowiska:
// serwer wystartuje restart przed testerem pierwszej fazy, ktora go potrzebuje. Po fazie (bez flagi) ten sam blad = STOP.
test('start przed faza 1: komenda bez aplikacji (pnpm bez binarki, kod 127) = odroczone; inny blad i start po fazie = niepowodzenie', async () => {
  const port = await wolnyPort()
  const pnpm = `E2E_URL=http://127.0.0.1:${port}\nE2E_START=echo ' ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "vite" not found' && exit 254\n`
  const p = projekt({ env: pnpm })
  const odroczone = await startE2e(p, ZADANIE, { uruchom: true, przedPierwszaFaza: true, narzedzia: SPRAWNE })
  assert.equal(odroczone.status, 'odroczone', odroczone.detal)
  assert.match(odroczone.detal, /aplikacji jeszcze nie ma .*Command "vite" not found/)
  assert.equal(odroczone.serwer, 'brak')
  assert.equal((await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })).status, 'niepowodzenie')
  writeFileSync(join(p, '.env.e2e'), `E2E_URL=http://127.0.0.1:${port}\nE2E_START=program-ktorego-nie-ma-e2e\n`)
  assert.equal((await startE2e(p, ZADANIE, { uruchom: true, przedPierwszaFaza: true, narzedzia: SPRAWNE })).status, 'odroczone')
  writeFileSync(join(p, '.env.e2e'), `E2E_URL=http://127.0.0.1:${port}\nE2E_START=echo port zajety && exit 3\n`)
  assert.equal((await startE2e(p, ZADANIE, { uruchom: true, przedPierwszaFaza: true, narzedzia: SPRAWNE })).status, 'niepowodzenie')
})

// P17: serwer z bootstrapu nie wczytuje pliku konfiguracji, ktorego nie bylo przy jego starcie (vibersi: vite.config.ts z IU-1
// -> 500 w fazie 4). Restart przed testerem fazy: nasz serwer od nowa; faza bez scenariuszy i makiet — bez restartu.
test('restart fazy: serwer od nowa widzi plik powstaly po starcie; faza bez scenariuszy = pominieto; token advisors nie idzie do serwera', async () => {
  const port = await wolnyPort()
  const start = `node -e "const fs=require('fs');const t=fs.existsSync('konfig.txt')?fs.readFileSync('konfig.txt','utf8'):'brak';require('http').createServer((q,s)=>s.end(t+'|'+(process.env.SUPABASE_ACCESS_TOKEN||'-'))).listen(${port})"`
  const zadania = '## Faza 1 — A\n\n- [ ] Stwórz: `a.ts`\n\n## Faza 2 — B\n\n- [ ] Test: [E2E] `b` — /b → ok\n'
  const p = projekt({ zadania, env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=${start}\nE2E_START_TIMEOUT=20\nSUPABASE_ACCESS_TOKEN=tajny\n` })
  const url = `http://127.0.0.1:${port}`
  assert.equal((await startE2e(p, ZADANIE, { uruchom: true, narzedzia: SPRAWNE })).status, 'gotowe')
  assert.equal(await odpowiedz(url), 'brak|-')
  writeFileSync(join(p, 'konfig.txt'), 'nowa')
  const bezScenariuszy = await restartFazy(p, ZADANIE, 1)
  assert.equal(bezScenariuszy.status, 'pominieto')
  assert.equal(await odpowiedz(url), 'brak|-')
  const pidPrzed = JSON.parse(readFileSync(konfProjektu(p).pid, 'utf8')).pid
  const w = await restartFazy(p, ZADANIE, 2)
  assert.equal(w.status, 'gotowe', w.detal)
  assert.equal(w.serwer, 'uruchomione')
  assert.equal(w.scenariusze, 1)
  assert.notEqual(JSON.parse(readFileSync(konfProjektu(p).pid, 'utf8')).pid, pidPrzed)
  assert.equal(await odpowiedz(url), 'nowa|-')
})

test('restart fazy: serwer nie nasz (bez pliku PID) zostaje — gotowe z zastanym; komenda, ktora pada = niepowodzenie z logiem', async () => {
  const port = await wolnyPort()
  const obcy = createServer().listen(port)
  try {
    const p = projekt({ env: `E2E_URL=http://127.0.0.1:${port}\nE2E_START=exit 1\n` })
    // Serwer TCP bez HTTP nie odpowiada na sonde — najpierw start komendy, ktora pada.
    const pada = await restartFazy(p, ZADANIE, 1)
    assert.equal(pada.status, 'niepowodzenie')
    assert.match(pada.detal, /zakonczyla sie \(1\)|nie odpowiada/)
  } finally {
    obcy.close()
  }
  const port2 = await wolnyPort()
  const http = await import('node:http')
  const zastany = http.createServer((_zapytanie, s) => s.end('obcy')).listen(port2)
  try {
    const p2 = projekt({ env: `E2E_URL=http://127.0.0.1:${port2}\nE2E_START=exit 1\n` })
    const w = await restartFazy(p2, ZADANIE, 1)
    assert.equal(w.status, 'gotowe', w.detal)
    assert.equal(w.serwer, 'zastane')
    assert.equal(await odpowiedz(`http://127.0.0.1:${port2}`), 'obcy')
  } finally {
    zastany.close()
  }
})
