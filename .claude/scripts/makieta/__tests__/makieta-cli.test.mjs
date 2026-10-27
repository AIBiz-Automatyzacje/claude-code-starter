// CLI narzedzia makiet (P24 IU-6) jako prawdziwe procesy: start w tle z linkiem, stan, stop, przejecie wlasnej instancji, port
// obcego procesu, serwer.json z cudzym PID-em, czekaj ze zgloszeniem z API, poprawione z przeladowaniem ramek, sprawdz i cel.
// Katalog stanu izolowany przez TMPDIR dziecka; po kazdym tescie bez sierot (pgrep).

import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { czasStartu, katalogStanu, zapiszSerwer } from '../proces.mjs'
import { punktyWizualne } from '../punkty.mjs'
import { skrotSha1 } from '../zapis-linii.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = join(KATALOG, '..', 'makieta.mjs')
const ZADANIE = 'etap-4-dodawanie-i-moderacja'
const SMOKE = `docs/operator/2026-10-18-${ZADANIE}-smoke.md`
const SMOKE_R11 = 'docs/operator/2026-10-20-r11-smoke.md'

/** @typedef {{ status: number | null, stdout: string, stderr: string, json: any }} WynikCli */
/** @typedef {{ projekt: string, tmp: string, port: number, portAplikacji: number, cli: (a: string[]) => Promise<WynikCli> }} Kontekst */

/** @returns {Promise<number>} wolny port */
function wolnyPort() {
  return new Promise((ok) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = /** @type {import('node:net').AddressInfo} */ (s.address()).port
      s.close(() => ok(port))
    })
  })
}

/** @param {string} tekst @returns {any} */
function jakoJson(tekst) {
  try {
    return JSON.parse(tekst.trim().split('\n').at(-1) ?? '')
  } catch {
    // Wyjscie spoza JSON (np. uzycie na stderr) — test sprawdza wtedy kod i tekst.
    return null
  }
}

/** @param {Kontekst['cli']} cli @param {string} tmp @returns {Promise<void>} */
async function bezSierot(cli, tmp) {
  await cli(['stop'])
  const w = spawnSync('pgrep', ['-fl', `makieta.mjs serwer.*${tmp.split('/').pop()}`], { encoding: 'utf8' })
  assert.equal(w.stdout.trim(), '', `sieroty: ${w.stdout}`)
}

/** @param {(k: Kontekst) => Promise<void>} cialo */
async function zProjektem(cialo) {
  const tmp = mkdtempSync(join(tmpdir(), 'makieta-cli-'))
  const projekt = join(tmp, 'projekt')
  const pliki = {
    [`docs/completed/${ZADANIE}/${ZADANIE}-plan.md`]: '# bez planu technicznego\n',
    [`docs/completed/${ZADANIE}/visual-diff/moje-projekty-telefon-figma.png`]: 'png',
    [SMOKE_R11]: '# Smoke\n\n- [ ] Telefon: `/konto` obok `visual-diff/a-figma.png` (viewport 390×844) → zgodne\n',
    'docs/completed/r11/visual-diff/a-figma.png': 'png',
  }
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(join(projekt, p, '..'), { recursive: true })
    writeFileSync(join(projekt, p), t)
  }
  copyFileSync(join(KATALOG, 'fixtures', 'vibersi-etap-4-smoke.md'), join(projekt, SMOKE))
  const aplikacja = createServer((_req, res) => res.end('aplikacja'))
  const portAplikacji = await new Promise((ok) => aplikacja.listen(0, '127.0.0.1', () => ok(/** @type {import('node:net').AddressInfo} */ (aplikacja.address()).port)))
  const port = await wolnyPort()
  // Asynchronicznie: aplikacja testowa i serwer SSE dzialaja w tym procesie — spawnSync zablokowalby im petle zdarzen.
  /** @type {Kontekst['cli']} */
  const cli = (a) => new Promise((ok) => {
    const d = spawn(process.execPath, [CLI, ...a, '--projekt', projekt], { env: { ...process.env, TMPDIR: tmp } })
    let stdout = ''
    let stderr = ''
    d.stdout.on('data', (c) => { stdout += c })
    d.stderr.on('data', (c) => { stderr += c })
    d.on('close', (status) => ok({ status, stdout, stderr, json: jakoJson(stdout) }))
  })
  try {
    await cialo({ projekt, tmp, port, portAplikacji, cli })
  } finally {
    await bezSierot(cli, tmp)
    aplikacja.closeAllConnections()
    await new Promise((ok) => aplikacja.close(ok))
    rmSync(tmp, { recursive: true, force: true })
  }
}

/** @param {string} projekt @param {string} tmp @returns {string} katalog stanu dziecka z TMPDIR=tmp */
function stanDziecka(projekt, tmp) {
  const stary = process.env.TMPDIR
  process.env.TMPDIR = tmp
  try {
    return katalogStanu(projekt)
  } finally {
    if (stary === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = stary
  }
}

/** @param {Kontekst} k @param {string[]} [dodatkowe] @returns {Promise<any>} wynik startu (link, pid, punkty, bezMakiety…) */
async function uruchom(k, dodatkowe = []) {
  const w = await k.cli(['start', '--smoke', SMOKE, '--aplikacja', `http://127.0.0.1:${k.portAplikacji}`, '--port', String(k.port), ...dodatkowe])
  assert.equal(w.status, 0, w.stdout + w.stderr)
  return w.json
}

/** @param {number} port @param {string} sciezka @param {{ method?: string, token?: string, body?: unknown }} [o] @returns {Promise<{ status: number, json: any }>} */
async function api(port, sciezka, { method = 'GET', token, body } = {}) {
  const odp = await fetch(`http://127.0.0.1:${port}/__makieta/${sciezka}`, {
    method, headers: { ...(token ? { 'x-makieta-token': token } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
  })
  return { status: odp.status, json: await odp.json() }
}

test('start daje link z tokenem, stan widzi proces, stop go kończy', () => zProjektem(async (k) => {
  const w = await uruchom(k)
  assert.match(w.link, new RegExp(`^http://127\\.0\\.0\\.1:${k.port}/__makieta/\\?t=[0-9a-f]{32}$`))
  assert.deepEqual([w.punkty, w.aplikacjaOdpowiada], [24, true])
  assert.ok(w.bezMakiety.includes('admin-stany') && !w.bezMakiety.includes('moje-projekty-telefon'))
  const token = new URL(w.link).searchParams.get('t') ?? ''
  assert.equal((await api(k.port, 'api/punkty', { token })).json.data.punkty.length, 24)
  const stan = await k.cli(['stan'])
  assert.equal(stan.json.dziala, true)
  assert.equal(stan.json.pid, w.pid)
  assert.ok(!stan.stdout.includes(token), 'stan bez tokenu')
  assert.equal((await k.cli(['stop'])).json.zatrzymany, true)
  assert.equal(czasStartu(w.pid), null, 'proces serwera zakończony')
  assert.equal((await k.cli(['stan'])).json.dziala, false)
  const martwy = await uruchom(k)
  process.kill(martwy.pid, 'SIGKILL')
  await new Promise((ok) => setTimeout(ok, 200))
  assert.equal((await k.cli(['stan'])).json.dziala, false, 'serwer.json martwego procesu to nie działająca instancja')
}))

test('drugi start przejmuje własną instancję; port zajęty przez obcy proces = kod 1 z PID-em', () => zProjektem(async (k) => {
  const pierwszy = await uruchom(k)
  const drugi = await uruchom(k)
  assert.notEqual(drugi.pid, pierwszy.pid)
  assert.equal(czasStartu(pierwszy.pid), null)
  await k.cli(['stop'])
  const obcy = createServer()
  await new Promise((ok) => obcy.listen(k.port, '127.0.0.1', () => ok(undefined)))
  try {
    const w = await k.cli(['start', '--smoke', SMOKE, '--aplikacja', `http://127.0.0.1:${k.portAplikacji}`, '--port', String(k.port)])
    assert.equal(w.status, 1, w.stdout)
    assert.match(w.json.blad, new RegExp(`port ${k.port} zajęty — PID ${process.pid}`))
  } finally {
    await new Promise((ok) => obcy.close(ok))
  }
}))

test('serwer.json z PID 1 albo z PID innego procesu (inny czas startu) — stop nic nie zabija', () => zProjektem(async (k) => {
  const stan = stanDziecka(k.projekt, k.tmp)
  const ofiara = spawn('sleep', ['30'], { stdio: 'ignore' })
  try {
    for (const pid of [1, /** @type {number} */ (ofiara.pid)]) {
      zapiszSerwer(stan, { pid, uruchomiony: 'Mon Jan  1 00:00:00 2001', port: k.port, token: 'x', smoke: SMOKE, aplikacja: 'http://127.0.0.1:1', start: '' })
      const w = await k.cli(['stop'])
      assert.equal(w.json.zatrzymany, false, JSON.stringify(w.json))
    }
    assert.notEqual(czasStartu(/** @type {number} */ (ofiara.pid)), null, 'obcy proces żyje')
  } finally {
    ofiara.kill()
  }
}))

test('czekaj z krótkim limitem wypisuje zgłoszenie złożone przez API, potem limit; drugi czekaj go nie powtarza; bez serwera = serwer-zatrzymany', () => zProjektem(async (k) => {
  assert.deepEqual((await k.cli(['czekaj', '--limit-min', '0.02'])).json, { zdarzenie: 'serwer-zatrzymany' })
  const token = new URL((await uruchom(k, ['--zgloszenia', 'od-razu'])).link).searchParams.get('t') ?? ''
  const p = punktyWizualne(readFileSync(join(k.projekt, SMOKE), 'utf8'), skrotSha1).find((x) => x.linia === 51)
  assert.ok(p)
  const z = await api(k.port, 'api/decyzja', { method: 'POST', token, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'ucięte liczniki', urzadzenie: 'iphone-15', szerokosc: 393 } })
  assert.equal(z.status, 200, JSON.stringify(z.json))
  const pierwszy = await k.cli(['czekaj', '--limit-min', '0.02'])
  const linie = pierwszy.stdout.trim().split('\n').map((l) => JSON.parse(l))
  assert.deepEqual(linie.map((l) => [l.zdarzenie, l.opis ?? null, l.ekran ?? null]), [['zgloszenie', 'ucięte liczniki', 'moje-projekty-telefon'], ['limit', null, null]])
  assert.deepEqual((await k.cli(['czekaj', '--limit-min', '0.01'])).stdout.trim().split('\n').map((l) => JSON.parse(l).zdarzenie), ['limit'])
  const zgl = await k.cli(['zgloszenia'])
  assert.deepEqual(zgl.json.zgloszenia.map((/** @type {{ punkt: string, linia: number }} */ x) => [x.punkt, x.linia]), [[p.id, 51]])
  assert.match(zgl.json.zgloszenia[0].zgloszenie, /błąd zgłoszony — iphone-15 393 px: ucięte liczniki/)
}))

test('poprawione zmienia status punktu i wysyła przeladuj do strony (SSE); konflikt i brak punktu = kod 1', () => zProjektem(async (k) => {
  const token = new URL((await uruchom(k)).link).searchParams.get('t') ?? ''
  const plik = join(k.projekt, SMOKE)
  const zgodny = punktyWizualne(readFileSync(plik, 'utf8'), skrotSha1).find((x) => x.linia === 51)
  assert.ok(zgodny)
  const zgodnyPoprawione = await k.cli(['poprawione', '--punkt', zgodny.id, '--commit', 'abc1234'])
  assert.deepEqual([zgodnyPoprawione.status, zgodnyPoprawione.json.konflikt, zgodnyPoprawione.json.status], [1, 'status', 'zgodny'], 'punkt bez zgłoszenia')
  const z = await api(k.port, 'api/decyzja', { method: 'POST', token, body: { punkt: zgodny.id, linia: zgodny.tekst, decyzja: 'blad', notatka: 'x', urzadzenie: 'u', szerokosc: 390 } })
  assert.equal(z.status, 200)
  const p = punktyWizualne(readFileSync(plik, 'utf8'), skrotSha1).find((x) => x.linia === 51)
  assert.ok(p)
  const sse = new Promise((ok, nie) => {
    const r = request({ host: '127.0.0.1', port: k.port, path: `/__makieta/api/zdarzenia?t=${token}`, headers: { host: `127.0.0.1:${k.port}` } }, (odp) => {
      let bufor = ''
      odp.on('data', (c) => {
        bufor += c.toString()
        if (bufor.includes('event: przeladuj')) { r.destroy(); ok(true) }
      })
    })
    r.on('error', (b) => (b.message.includes('socket hang up') ? undefined : nie(b)))
    r.end()
  })
  await new Promise((ok) => setTimeout(ok, 200))
  const w = await k.cli(['poprawione', '--punkt', p.id, '--commit', 'abc1234'])
  assert.deepEqual([w.status, w.json.przeladowano, w.json.aplikacjaOdpowiada], [0, true, true])
  assert.equal(await sse, true)
  assert.equal(punktyWizualne(readFileSync(plik, 'utf8'), skrotSha1).find((x) => x.id === p.id)?.status, 'poprawione')
  assert.equal((await k.cli(['poprawione', '--punkt', 'p-00000000', '--commit', 'abc1234'])).status, 1)
  assert.equal((await k.cli(['poprawione', '--punkt', p.id, '--commit', 'nie-sha'])).status, 1)
  assert.equal((await k.cli(['poprawione', '--punkt', p.id, '--commit', 'abc1234'])).json.konflikt, 'status', 'druga adnotacja poprawki = konflikt')
}))

test('sprawdz: fixture etapu 4 wskazuje punkt z dwiema makietami; smoke w formacie R11 = kod 0; cel spoza localhost = kod 2', () => zProjektem(async (k) => {
  const w = await k.cli(['sprawdz', '--smoke', SMOKE])
  assert.equal(w.status, 1)
  assert.ok(w.json.problemy.some((/** @type {{ linia: number, powod: string }} */ p) => p.linia === 95 && /kilka makiet/.test(p.powod)))
  assert.ok(w.json.problemy.some((/** @type {{ powod: string }} */ p) => /brak PNG makiety ekranu admin-stany/.test(p.powod)))
  const r11 = await k.cli(['sprawdz', '--smoke', SMOKE_R11])
  assert.deepEqual([r11.status, r11.json], [0, { punkty: 1, problemy: [] }])
  const pola = await k.cli(['sprawdz', '--smoke', SMOKE_R11, '--pola'])
  assert.deepEqual([pola.status, pola.json.problemy.map((/** @type {{ powod: string }} */ p) => p.powod)], [1, ['po „→” brak pól „Wejście: … Porównaj: … Stany: …”']], 'P27 S3 poz. 28: --pola wymaga trzech pól')
  writeFileSync(join(k.projekt, 'docs/operator/2026-10-20-bez-smoke.md'), '- [ ] zwykły punkt\n')
  assert.equal((await k.cli(['sprawdz', '--smoke', 'docs/operator/2026-10-20-bez-smoke.md'])).status, 0, 'bez punktów wizualnych')
  assert.equal((await k.cli(['start', '--smoke', SMOKE, '--aplikacja', 'http://example.com', '--port', String(k.port)])).status, 2)
  assert.equal((await k.cli(['czekaj', '--limit-min', '26'])).status, 2)
  assert.equal((await k.cli(['start', '--smoke', SMOKE, '--aplikacja', `http://localhost:${k.port}`, '--port', String(k.port)])).status, 2, 'proxy do samego siebie')
  assert.equal((await k.cli(['nieznane'])).status, 2)
}))

test('po recenzji: CLI przez ścieżkę ze spacją i polskimi znakami (dowiązanie) działa; start czyści kolejkę poprzedniej instancji; martwa aplikacja i martwy serwer', () => zProjektem(async (k) => {
  const katalog = join(k.tmp, 'kat z zażółć')
  mkdirSync(katalog)
  symlinkSync(CLI, join(katalog, 'makieta.mjs'))
  const przez = await new Promise((ok) => {
    const d = spawn(process.execPath, [join(katalog, 'makieta.mjs'), 'stan', '--projekt', k.projekt], { env: { ...process.env, TMPDIR: k.tmp } })
    let out = ''
    d.stdout.on('data', (c) => { out += c })
    d.on('close', (status) => ok([status, out.trim()]))
  })
  assert.deepEqual(przez, [0, '{"dziala":false}'])
  const stan = stanDziecka(k.projekt, k.tmp)
  mkdirSync(stan, { recursive: true })
  writeFileSync(join(stan, 'kolejka.jsonl'), `${JSON.stringify({ id: 'stare', punkt: 'p-1', ekran: 'a', opis: 'stare', urzadzenie: 'u', czas: 'x' })}\n`)
  const martwa = await wolnyPort()
  const w = await k.cli(['start', '--smoke', SMOKE, '--aplikacja', `http://127.0.0.1:${martwa}`, '--port', String(k.port)])
  assert.equal(w.json.aplikacjaOdpowiada, false)
  assert.equal(statSync(join(stan, 'serwer.json')).mode & 0o777, 0o600)
  const czekanie = (await k.cli(['czekaj', '--limit-min', '0.01'])).stdout.trim().split('\n').map((l) => JSON.parse(l).zdarzenie)
  assert.deepEqual(czekanie, ['limit'], 'stare zgłoszenie nie trafia do nowej sesji')
  process.kill(w.json.pid, 'SIGKILL')
  await new Promise((ok) => setTimeout(ok, 200))
  const plik = join(k.projekt, SMOKE)
  writeFileSync(plik, readFileSync(plik, 'utf8').replace('- [x] *(2026-10-18, druga sesja: 390 px', '- [ ] *(2026-10-20: błąd zgłoszony — u 390 px: x)* *(2026-10-18, druga sesja: 390 px'))
  const p = punktyWizualne(readFileSync(plik, 'utf8'), skrotSha1).find((x) => x.linia === 51)
  assert.equal(p?.status, 'blad')
  const popr = await k.cli(['poprawione', '--punkt', p?.id ?? '', '--commit', 'abc1234'])
  assert.deepEqual([popr.status, popr.json.przeladowano], [0, false], 'serwer martwy — linia zapisana, bez przeładowania')
  await k.cli(['stop'])
  assert.equal(existsSync(join(stan, 'serwer.json')), false)
  writeFileSync(join(stan, 'serwer.json'), '{uszkodzony')
  assert.equal((await k.cli(['stop'])).json.zatrzymany, false)
  assert.equal(existsSync(join(stan, 'serwer.json')), false, 'uszkodzony serwer.json usunięty')
  for (const zle of [['start', '--smoke', SMOKE, '--port', '80'], ['start', '--smoke', SMOKE, '--port', '0x1450'], ['czekaj', '--limit-min', '0'], ['czekaj', '--limit-min', '0x1'], ['czekaj', '--foo'], ['czekaj', 'x'], ['start', '--smoke', SMOKE, '--zgloszenia', 'zaraz']]) {
    assert.equal((await k.cli(zle)).status, 2, zle.join(' '))
  }
  assert.equal((await k.cli(['sprawdz', '--smoke', 'docs/operator/2026-10-20-brak-smoke.md'])).status, 1, 'brak pliku smoke\'u = problem')
}))

test('P28 (4) start domyślnie zbiera zgłoszenia na koniec: czekaj milczy do api/zakoncz, potem jedno zdarzenie przeglad-zakonczony', () => zProjektem(async (k) => {
  writeFileSync(join(k.projekt, 'package.json'), JSON.stringify({ dependencies: { '@marsidev/react-turnstile': '1.6.2' } }))
  const w = await uruchom(k)
  assert.equal(w.zgloszenia, 'na-koniec')
  assert.deepEqual(w.hosty.map((/** @type {string} */ h) => h.split(':')[0]), ['Cloudflare Turnstile'], 'P28 (6) usługi z hostem narzędzia w wyniku startu')
  const token = new URL(w.link).searchParams.get('t') ?? ''
  const p = punktyWizualne(readFileSync(join(k.projekt, SMOKE), 'utf8'), skrotSha1).find((x) => x.linia === 51)
  assert.ok(p)
  assert.equal((await api(k.port, 'api/decyzja', { method: 'POST', token, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'ucięte', urzadzenie: 'iphone-15', szerokosc: 393 } })).status, 200)
  assert.deepEqual((await k.cli(['czekaj', '--limit-min', '0.01'])).stdout.trim().split('\n').map((l) => JSON.parse(l).zdarzenie), ['limit'])
  assert.equal((await api(k.port, 'api/zakoncz', { method: 'POST', token })).json.data.zgloszenia, 1)
  const linie = (await k.cli(['czekaj', '--limit-min', '0.01'])).stdout.trim().split('\n').map((l) => JSON.parse(l))
  assert.deepEqual(linie.map((l) => [l.zdarzenie, l.zgloszenia?.map((/** @type {{ linia: number }} */ z) => z.linia) ?? null]), [['przeglad-zakonczony', [51]], ['limit', null]])
  await k.cli(['stop'])
}))
