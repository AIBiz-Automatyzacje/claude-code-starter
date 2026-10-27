#!/usr/bin/env node
// Narzedzie „makieta obok aplikacji” w smoke'u operatora (P24 IU-6): CLI dla sesji smoke'u (skill /makieta). Serwer w tle
// laczy strone narzedzia z proxy do aplikacji; decyzje operatora trafiaja do linii checklisty, zgloszenia bledow — do sesji
// przez `czekaj` w Monitorze (jedna linia JSON = jedno zdarzenie). Stan procesu i kolejki poza repo (proces.mjs).
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   makieta.mjs start --smoke <plik> [--aplikacja <url>] [--port <n>] [--zgloszenia na-koniec|od-razu]
//                                               serwer w tle, wynik z linkiem dla operatora; zgloszenia domyslnie na koniec przegladu
//   makieta.mjs stop | stan
//   makieta.mjs czekaj [--limit-min N]          zdarzenia zgloszen i konca przegladu do limitu (N <= 25, domyslnie 25), na koncu `limit`
//   makieta.mjs zgloszenia [--smoke <plik>]     otwarte zgloszenia z checklisty (droga awaryjna)
//   makieta.mjs poprawione --punkt <id> --commit <sha> [--smoke <plik>]   adnotacja „poprawione”, przeladowanie ramek
//   makieta.mjs sprawdz --smoke <plik> [--pola]  kontrola formatu punktow wizualnych (dev-docs-complete; --pola: trzy pola po „→”)
//   makieta.mjs serwer …                        wewnetrzne: proces serwera (uruchamia go start)
// Wynik: JSON w jednej linii. Kod wyjscia: 0 = ok, 1 = problem (format, konflikt, port zajety, brak zadania), 2 = zle argumenty,
// 3 = wyjatek. Stdout bez wartosci env i bez tokenu poza polem `link` startu.

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { hostyDoDopisania } from './hosty.mjs'
import { LIMIT_CZEKANIA_MIN, czekaj, opisOtwartych } from './kolejka.mjs'
import { DOMYSLNA_APLIKACJA, DOMYSLNY_PORT, czasStartu, czekajNaOdpowiedz, katalogStanu, odpowiada, procesNaPorcie, zapisSerwera, zapiszSerwer, zatrzymaj, zyjeNasz } from './proces.mjs'
import { BladProxy, PREFIKS_NARZEDZIA, celLokalny } from './proxy.mjs'
import { punktyWizualne, sprawdzFormat } from './punkty.mjs'
import { NAGLOWEK_TOKENU, utworzSerwer } from './serwer.mjs'
import { BladZapisu, skrotSha1, zapiszDecyzje } from './zapis-linii.mjs'
import { BladZrodel, zrodlaMakiet } from './zrodla.mjs'

const KOD_PROBLEMU = 1
const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3
const LIMIT_STARTU_MS = 10_000
const LIMIT_APLIKACJI_MS = 60_000
const USTAWIENIA = /** @type {const} */ ({
  projekt: { type: 'string' }, smoke: { type: 'string' }, aplikacja: { type: 'string' }, port: { type: 'string' },
  'limit-min': { type: 'string' }, punkt: { type: 'string' }, commit: { type: 'string' }, zgloszenia: { type: 'string' }, pola: { type: 'boolean' },
})
const TRYBY_ZGLOSZEN = /** @type {const} */ (['na-koniec', 'od-razu'])

class BladArgumentow extends Error {}

/** @typedef {{ projekt?: string, smoke?: string, aplikacja?: string, port?: string, 'limit-min'?: string, punkt?: string, commit?: string, zgloszenia?: string, pola?: boolean }} Opcje */

/**
 * Wynik polecenia i koniec procesu po oproznieniu stdout (na macOS zapis do potoku jest asynchroniczny — exit zaraz po write
 * gubi ostatnie linie, a czekaj oznacza zgloszenie jako dostarczone).
 * @param {Record<string, unknown>} w
 * @param {number} [kod]
 * @returns {Promise<never>}
 */
function wynik(w, kod = 0) {
  return new Promise(() => process.stdout.write(`${JSON.stringify(w)}\n`, () => process.exit(kod)))
}

/** @param {string} projekt @param {string} smoke @returns {string} */
const sciezkaSmoke = (projekt, smoke) => (isAbsolute(smoke) ? smoke : join(projekt, smoke))

/** @param {string | undefined} v @param {string} nazwa @returns {string} */
function wymagane(v, nazwa) {
  if (!v) throw new BladArgumentow(`brak --${nazwa}`)
  return v
}

/** @param {string | undefined} v @returns {number} */
function port(v) {
  const n = v === undefined ? DOMYSLNY_PORT : /^\d+$/.test(v) ? Number(v) : NaN
  if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new BladArgumentow(`--port ${v}: liczba dziesiętna 1024–65535`)
  return n
}

/** @param {string | undefined} v @returns {import('./serwer.mjs').TrybZgloszen} */
function trybZgloszen(v) {
  const tryb = TRYBY_ZGLOSZEN.find((t) => t === (v ?? TRYBY_ZGLOSZEN[0]))
  if (!tryb) throw new BladArgumentow(`--zgloszenia ${v}: ${TRYBY_ZGLOSZEN.join(' albo ')}`)
  return tryb
}

/** @param {string} projekt @param {Opcje} o @returns {string} smoke z --smoke albo z biezacej instancji */
function smokeInstancji(projekt, o) {
  const z = zapisSerwera(katalogStanu(projekt))
  return wymagane(o.smoke ?? z?.smoke, 'smoke (narzędzie nie działa — podaj plik smoke\'u)')
}

/** @param {string} projekt @param {string} smoke @returns {string} tresc smoke'u; brak pliku = problem (kod 1), nie wyjatek */
function czytajSmoke(projekt, smoke) {
  const plik = sciezkaSmoke(projekt, smoke)
  if (!existsSync(plik)) throw new BladZrodel('brak-zadania', `brak pliku smoke'u ${smoke}`)
  return readFileSync(plik, 'utf8')
}

/** @param {string} projekt @param {string} smoke */
function stanSmoke(projekt, smoke) {
  const punkty = punktyWizualne(czytajSmoke(projekt, smoke), skrotSha1)
  return { punkty, zrodla: zrodlaMakiet(projekt, smoke, punkty) }
}

/** @param {string} projekt @param {Opcje} o */
async function start(projekt, o) {
  const smoke = wymagane(o.smoke, 'smoke')
  const aplikacja = celLokalny(o.aplikacja ?? DOMYSLNA_APLIKACJA)
  const p = port(o.port)
  const zgloszenia = trybZgloszen(o.zgloszenia)
  // Cel na porcie narzedzia to proxy do samego siebie — kazde zadanie zagniezdzaloby sie do wyczerpania deskryptorow.
  if (Number(aplikacja.port || 80) === p) throw new BladArgumentow(`--aplikacja ${aplikacja.origin} wskazuje port narzędzia ${p} — podaj adres aplikacji (domyślnie ${DOMYSLNA_APLIKACJA})`)
  const { punkty, zrodla } = stanSmoke(projekt, smoke)
  const stan = katalogStanu(projekt)
  if (zyjeNasz(zapisSerwera(stan))) await zatrzymaj(stan)
  const obcy = procesNaPorcie(p)
  if (obcy || (obcy === undefined && await odpowiada(`http://127.0.0.1:${p}/`))) {
    // Sam program i poczatek komendy: argumenty obcego procesu (np. --authtoken) trafilyby przez Monitor do transkryptu.
    const kto = obcy ? `PID ${obcy.pid}: ${obcy.komenda.split(/\s+/)[0].split('/').pop()}` : 'proces nieznany (brak lsof)'
    return wynik({ blad: `port ${p} zajęty — ${kto}. Zatrzymaj go albo podaj --port; adres http://127.0.0.1:${p}/** musi być w Redirect URLs Supabase dla OAuth` }, KOD_PROBLEMU)
  }
  const token = randomBytes(16).toString('hex')
  mkdirSync(stan, { recursive: true, mode: 0o700 })
  // Zgloszenia poprzedniej instancji (moze innego smoke'u) nie trafiaja do nowej sesji — stan punktu jest w checkliście,
  // a otwarte zgloszenia zwraca `zgloszenia`.
  for (const f of ['kolejka.jsonl', 'dostarczone.jsonl']) rmSync(join(stan, f), { force: true })
  const log = openSync(join(stan, 'serwer.log'), 'w')
  const dziecko = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serwer', '--projekt', projekt, '--smoke', smoke, '--aplikacja', aplikacja.origin, '--port', String(p), '--zgloszenia', zgloszenia], {
    detached: true, stdio: ['ignore', log, log], env: { ...process.env, MAKIETA_TOKEN: token },
  })
  closeSync(log)
  /** @type {number | string | null} */
  let wyjscie = null
  dziecko.on('exit', (kod, sygnal) => { wyjscie = kod ?? sygnal ?? 'nieznany' })
  dziecko.unref()
  const uruchomiony = dziecko.pid === undefined ? null : czasStartu(dziecko.pid)
  if (!dziecko.pid || !uruchomiony) return wynik({ blad: `serwer narzędzia nie wystartował — log ${join(stan, 'serwer.log')}` }, KOD_WYJATKU)
  zapiszSerwer(stan, { pid: dziecko.pid, uruchomiony, port: p, token, smoke: zrodla.smoke, aplikacja: aplikacja.origin, start: new Date().toISOString() })
  // Sonda z tokenem tej instancji: odpowiedz innego serwera na porcie (rownolegly start) nie jest sukcesem.
  const naszSerwer = async (/** @type {string} */ url) => wyjscie === null && (await fetch(url, { headers: { [NAGLOWEK_TOKENU]: token }, signal: AbortSignal.timeout(2000) }).catch(() => null))?.status === 200
  if (!await czekajNaOdpowiedz(`http://127.0.0.1:${p}${PREFIKS_NARZEDZIA}api/punkty`, LIMIT_STARTU_MS, async (url) => wyjscie !== null || await naszSerwer(url)) || wyjscie !== null) {
    await zatrzymaj(stan)
    return wynik({ blad: `serwer narzędzia nie wystartował${wyjscie !== null ? ` (zakończył się: ${wyjscie})` : ` po ${LIMIT_STARTU_MS / 1000} s`} — log ${join(stan, 'serwer.log')}` }, KOD_WYJATKU)
  }
  return wynik({
    link: `http://127.0.0.1:${p}${PREFIKS_NARZEDZIA}?t=${token}`, punkty: punkty.length, ekrany: zrodla.ekrany.length,
    bezMakiety: [...new Set(zrodla.ekrany.filter((e) => !e.makieta).map((e) => e.ekran))], pominiete: zrodla.pominiete, ostrzezenia: zrodla.ostrzezenia,
    hosty: hostyDoDopisania(projekt, p),
    aplikacja: aplikacja.origin, aplikacjaOdpowiada: await odpowiada(`${aplikacja.origin}/`), zgloszenia, pid: dziecko.pid,
  })
}

/** @param {string} projekt @param {Opcje} o */
async function serwer(projekt, o) {
  const token = wymagane(process.env.MAKIETA_TOKEN, 'MAKIETA_TOKEN w środowisku')
  const s = utworzSerwer({ projekt, smoke: wymagane(o.smoke, 'smoke'), aplikacja: celLokalny(wymagane(o.aplikacja, 'aplikacja')), token,
    katalogStanu: katalogStanu(projekt), zgloszenia: trybZgloszen(o.zgloszenia), log: (l) => process.stdout.write(`${new Date().toISOString()} ${l}\n`) })
  s.serwer.on('error', (b) => {
    process.stdout.write(`${new Date().toISOString()} serwer: ${b.message}\n`, () => process.exit(1))
  })
  s.serwer.listen(port(o.port), '127.0.0.1')
  const koniec = () => void s.zamknij().then(() => process.exit(0))
  process.on('SIGTERM', koniec)
  process.on('SIGINT', koniec)
}

/** @param {string} projekt */
async function stan(projekt) {
  const z = zapisSerwera(katalogStanu(projekt))
  if (!zyjeNasz(z) || !z) return wynik({ dziala: false })
  return wynik({ dziala: true, pid: z.pid, port: z.port, smoke: z.smoke, aplikacja: z.aplikacja, aplikacjaOdpowiada: await odpowiada(`${z.aplikacja}/`), start: z.start })
}

/** @param {string} projekt @param {Opcje} o */
async function czekajNaZgloszenia(projekt, o) {
  const limit = o['limit-min'] === undefined ? LIMIT_CZEKANIA_MIN : /^\d+(\.\d+)?$/.test(o['limit-min']) ? Number(o['limit-min']) : NaN
  if (!(limit > 0 && limit <= LIMIT_CZEKANIA_MIN)) throw new BladArgumentow(`--limit-min ${o['limit-min']}: liczba > 0 i ≤ ${LIMIT_CZEKANIA_MIN} (Monitor żyje najwyżej 30 min)`)
  const stanProjektu = katalogStanu(projekt)
  const czyZyje = async () => zyjeNasz(zapisSerwera(stanProjektu))
  if (!await czyZyje()) return wynik({ zdarzenie: 'serwer-zatrzymany' })
  for await (const z of czekaj({ katalogStanu: stanProjektu, limitMs: limit * 60_000, czyZyje })) {
    // Zgloszenie oznaczane jako dostarczone dopiero po zapisie linii do potoku Monitora.
    await new Promise((ok, nie) => process.stdout.write(`${JSON.stringify(z)}\n`, (b) => (b ? nie(b) : ok(undefined))))
  }
  process.exit(0)
}

/** @param {string} projekt @param {Opcje} o */
function zgloszenia(projekt, o) {
  const { punkty, zrodla } = stanSmoke(projekt, smokeInstancji(projekt, o))
  return wynik({ zgloszenia: opisOtwartych(punkty, zrodla) })
}

/** @param {string} projekt @param {Opcje} o */
async function poprawione(projekt, o) {
  const punkt = wymagane(o.punkt, 'punkt')
  const smoke = smokeInstancji(projekt, o)
  const plik = sciezkaSmoke(projekt, smoke)
  const p = punktyWizualne(czytajSmoke(projekt, smoke), skrotSha1).find((x) => x.id === punkt)
  if (!p) return wynik({ blad: `brak punktu ${punkt} w ${smoke}` }, KOD_PROBLEMU)
  // Pomylka identyfikatora nie moze odznaczyc punktu zatwierdzonego przez operatora ani dopisac drugiej adnotacji poprawki.
  if (p.status !== 'blad') return wynik({ konflikt: 'status', status: p.status, linia: p.tekst }, KOD_PROBLEMU)
  const stanProjektu = katalogStanu(projekt)
  const w = await zapiszDecyzje({ plik, katalogStanu: stanProjektu, punkt, linia: p.tekst, decyzja: 'poprawione', commit: wymagane(o.commit, 'commit') })
  if (w.wynik === 'konflikt') return wynik({ konflikt: w.powod, linia: w.linia }, KOD_PROBLEMU)
  const z = zapisSerwera(stanProjektu)
  if (!zyjeNasz(z) || !z) return wynik({ linia: w.linia, przeladowano: false, detal: 'narzędzie nie działa — ramek nie ma czego przeładować' })
  const aplikacjaOdpowiada = await czekajNaOdpowiedz(`${z.aplikacja}/`, LIMIT_APLIKACJI_MS, odpowiada)
  try {
    const odp = await fetch(`http://127.0.0.1:${z.port}${PREFIKS_NARZEDZIA}api/przeladuj`, { method: 'POST', headers: { [NAGLOWEK_TOKENU]: z.token }, signal: AbortSignal.timeout(5000) })
    return wynik({ linia: w.linia, aplikacjaOdpowiada, przeladowano: odp.ok })
  } catch (b) {
    // Linia juz zapisana — ponowienie dopisaloby druga adnotacje; operator przeladuje ramki przyciskiem.
    return wynik({ linia: w.linia, aplikacjaOdpowiada, przeladowano: false, detal: `serwer narzędzia nie odpowiedział: ${b instanceof Error ? b.message : String(b)}` })
  }
}

/** @param {string} projekt @param {Opcje} o */
function sprawdz(projekt, o) {
  const smoke = wymagane(o.smoke, 'smoke')
  const md = czytajSmoke(projekt, smoke)
  const problemy = sprawdzFormat(md, { pola: o.pola })
  const punkty = punktyWizualne(md, skrotSha1)
  if (punkty.length) {
    /** @type {import('./zrodla.mjs').Zrodla | null} */
    let zrodla = null
    try {
      zrodla = zrodlaMakiet(projekt, smoke, punkty)
    } catch (b) {
      if (!(b instanceof BladZrodel)) throw b
      problemy.push({ linia: 0, powod: b.message })
    }
    for (const e of zrodla?.ekrany.filter((x) => !x.makieta) ?? []) {
      const p = punkty.find((x) => x.id === e.punkt)
      problemy.push({ linia: p?.linia ?? 0, powod: `brak PNG makiety ekranu ${e.ekran} (ani visual-diff/, ani figma_screens)` })
    }
  }
  return wynik({ punkty: punkty.length, problemy: problemy.sort((a, b) => a.linia - b.linia) }, problemy.length ? KOD_PROBLEMU : 0)
}

const POLECENIA = { start, serwer, stop: async (/** @type {string} */ p) => await wynik(await zatrzymaj(katalogStanu(p))), stan, czekaj: czekajNaZgloszenia, zgloszenia, poprawione, sprawdz }

// realpath: sciezka ze spacja albo polskimi znakami (import.meta.url jest zakodowany procentowo) i wywolanie przez dowiazanie.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [polecenie, ...reszta] = process.argv.slice(2)
  try {
    if (!polecenie || !Object.hasOwn(POLECENIA, polecenie)) throw new BladArgumentow(`nieznane polecenie „${polecenie ?? ''}”`)
    const { values } = parseArgs({ args: reszta, options: USTAWIENIA })
    const projekt = values.projekt ?? process.cwd()
    if (!existsSync(projekt)) throw new BladArgumentow(`--projekt ${projekt} nie istnieje`)
    await POLECENIA[/** @type {keyof typeof POLECENIA} */ (polecenie)](projekt, values)
  } catch (blad) {
    const komunikat = blad instanceof Error ? blad.message : String(blad)
    if (blad instanceof BladArgumentow || blad instanceof BladProxy || (blad instanceof TypeError && 'code' in blad && String(blad.code).startsWith('ERR_PARSE_ARGS'))) {
      process.stderr.write(`makieta: ${komunikat}\nUzycie: makieta.mjs start --smoke <plik> [--aplikacja <url>] [--port <n>] [--zgloszenia na-koniec|od-razu] | stop | stan | czekaj [--limit-min N] | zgloszenia | poprawione --punkt <id> --commit <sha> | sprawdz --smoke <plik> [--pola]\n`)
      process.exit(KOD_ZLYCH_ARGUMENTOW)
    }
    if (blad instanceof BladZrodel || blad instanceof BladZapisu) await wynik({ blad: komunikat, kod: blad.kod }, KOD_PROBLEMU)
    await wynik({ wyjatek: komunikat }, KOD_WYJATKU)
  }
}
