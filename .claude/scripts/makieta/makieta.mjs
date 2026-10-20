#!/usr/bin/env node
// Narzedzie „makieta obok aplikacji” w smoke'u operatora (P24 IU-6): CLI dla sesji smoke'u (skill /makieta). Serwer w tle
// laczy strone narzedzia z proxy do aplikacji; decyzje operatora trafiaja do linii checklisty, zgloszenia bledow — do sesji
// przez `czekaj` w Monitorze (jedna linia JSON = jedno zdarzenie). Stan procesu i kolejki poza repo (proces.mjs).
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   makieta.mjs start --smoke <plik> [--aplikacja <url>] [--port <n>]   serwer w tle, wynik z linkiem dla operatora
//   makieta.mjs stop | stan
//   makieta.mjs czekaj [--limit-min N]          zdarzenia zgloszen do limitu (N <= 25, domyslnie 25), na koncu `limit`
//   makieta.mjs zgloszenia [--smoke <plik>]     otwarte zgloszenia z checklisty (droga awaryjna)
//   makieta.mjs poprawione --punkt <id> --commit <sha> [--smoke <plik>]   adnotacja „poprawione”, przeladowanie ramek
//   makieta.mjs sprawdz --smoke <plik>          kontrola formatu punktow wizualnych (dev-docs-complete)
//   makieta.mjs serwer …                        wewnetrzne: proces serwera (uruchamia go start)
// Wynik: JSON w jednej linii. Kod wyjscia: 0 = ok, 1 = problem (format, konflikt, port zajety, brak zadania), 2 = zle argumenty,
// 3 = wyjatek. Stdout bez wartosci env i bez tokenu poza polem `link` startu.

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { LIMIT_CZEKANIA_MIN, czekaj, otwarteZgloszenia } from './kolejka.mjs'
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
  'limit-min': { type: 'string' }, punkt: { type: 'string' }, commit: { type: 'string' },
})

class BladArgumentow extends Error {}

/** @typedef {{ projekt?: string, smoke?: string, aplikacja?: string, port?: string, 'limit-min'?: string, punkt?: string, commit?: string }} Opcje */

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
  const n = Number(v ?? DOMYSLNY_PORT)
  if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new BladArgumentow(`--port ${v}: liczba 1024–65535`)
  return n
}

/** @param {string} projekt @param {Opcje} o @returns {string} smoke z --smoke albo z biezacej instancji */
function smokeInstancji(projekt, o) {
  const z = zapisSerwera(katalogStanu(projekt))
  return wymagane(o.smoke ?? z?.smoke, 'smoke (narzędzie nie działa — podaj plik smoke\'u)')
}

/** @param {string} projekt @param {string} smoke */
function stanSmoke(projekt, smoke) {
  const punkty = punktyWizualne(readFileSync(sciezkaSmoke(projekt, smoke), 'utf8'), skrotSha1)
  return { punkty, zrodla: zrodlaMakiet(projekt, smoke, punkty) }
}

/** @param {string} projekt @param {Opcje} o */
async function start(projekt, o) {
  const smoke = wymagane(o.smoke, 'smoke')
  const aplikacja = celLokalny(o.aplikacja ?? DOMYSLNA_APLIKACJA)
  const p = port(o.port)
  // Cel na porcie narzedzia to proxy do samego siebie — kazde zadanie zagniezdzaloby sie do wyczerpania deskryptorow.
  if (Number(aplikacja.port || 80) === p) throw new BladArgumentow(`--aplikacja ${aplikacja.origin} wskazuje port narzędzia ${p} — podaj adres aplikacji (domyślnie ${DOMYSLNA_APLIKACJA})`)
  const { punkty, zrodla } = stanSmoke(projekt, smoke)
  const stan = katalogStanu(projekt)
  if (zyjeNasz(zapisSerwera(stan))) await zatrzymaj(stan)
  const obcy = procesNaPorcie(p)
  if (obcy || (obcy === undefined && await odpowiada(`http://127.0.0.1:${p}/`))) {
    const kto = obcy ? `PID ${obcy.pid}: ${obcy.komenda}` : 'proces nieznany (brak lsof)'
    return wynik({ blad: `port ${p} zajęty — ${kto}. Zatrzymaj go albo podaj --port; adres http://127.0.0.1:${p}/** musi być w Redirect URLs Supabase dla OAuth` }, KOD_PROBLEMU)
  }
  const token = randomBytes(16).toString('hex')
  mkdirSync(stan, { recursive: true, mode: 0o700 })
  const log = openSync(join(stan, 'serwer.log'), 'w')
  const dziecko = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serwer', '--projekt', projekt, '--smoke', smoke, '--aplikacja', aplikacja.origin, '--port', String(p)], {
    detached: true, stdio: ['ignore', log, log], env: { ...process.env, MAKIETA_TOKEN: token },
  })
  closeSync(log)
  dziecko.unref()
  const uruchomiony = dziecko.pid === undefined ? null : czasStartu(dziecko.pid)
  if (!dziecko.pid || !uruchomiony) return wynik({ blad: `serwer narzędzia nie wystartował — log ${join(stan, 'serwer.log')}` }, KOD_WYJATKU)
  zapiszSerwer(stan, { pid: dziecko.pid, uruchomiony, port: p, token, smoke: zrodla.smoke, aplikacja: aplikacja.origin, start: new Date().toISOString() })
  if (!await czekajNaOdpowiedz(`http://127.0.0.1:${p}${PREFIKS_NARZEDZIA}`, LIMIT_STARTU_MS, odpowiada)) {
    await zatrzymaj(stan)
    return wynik({ blad: `serwer narzędzia nie odpowiada po ${LIMIT_STARTU_MS / 1000} s — log ${join(stan, 'serwer.log')}` }, KOD_WYJATKU)
  }
  return wynik({
    link: `http://127.0.0.1:${p}${PREFIKS_NARZEDZIA}?t=${token}`, punkty: punkty.length, ekrany: zrodla.ekrany.length,
    bezMakiety: [...new Set(zrodla.ekrany.filter((e) => !e.makieta).map((e) => e.ekran))], pominiete: zrodla.pominiete, ostrzezenia: zrodla.ostrzezenia,
    aplikacja: aplikacja.origin, aplikacjaOdpowiada: await odpowiada(`${aplikacja.origin}/`), pid: dziecko.pid,
  })
}

/** @param {string} projekt @param {Opcje} o */
async function serwer(projekt, o) {
  const token = wymagane(process.env.MAKIETA_TOKEN, 'MAKIETA_TOKEN w środowisku')
  const s = utworzSerwer({ projekt, smoke: wymagane(o.smoke, 'smoke'), aplikacja: celLokalny(wymagane(o.aplikacja, 'aplikacja')), token,
    katalogStanu: katalogStanu(projekt), log: (l) => process.stdout.write(`${new Date().toISOString()} ${l}\n`) })
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
  const limit = Number(o['limit-min'] ?? LIMIT_CZEKANIA_MIN)
  if (!(limit > 0 && limit <= LIMIT_CZEKANIA_MIN)) throw new BladArgumentow(`--limit-min ${o['limit-min']}: liczba > 0 i ≤ ${LIMIT_CZEKANIA_MIN} (Monitor żyje najwyżej 30 min)`)
  const stanProjektu = katalogStanu(projekt)
  const czyZyje = async () => zyjeNasz(zapisSerwera(stanProjektu))
  if (!await czyZyje()) return wynik({ zdarzenie: 'serwer-zatrzymany' })
  for await (const z of czekaj({ katalogStanu: stanProjektu, limitMs: limit * 60_000, czyZyje })) {
    // Zgloszenie oznaczane jako dostarczone dopiero po zapisie linii do potoku Monitora.
    await new Promise((ok) => process.stdout.write(`${JSON.stringify(z)}\n`, ok))
  }
  process.exit(0)
}

/** @param {string} projekt @param {Opcje} o */
function zgloszenia(projekt, o) {
  const { punkty, zrodla } = stanSmoke(projekt, smokeInstancji(projekt, o))
  return wynik({ zgloszenia: otwarteZgloszenia(punkty).map((p) => ({
    punkt: p.id, linia: p.linia, zgloszenie: p.adnotacje[0], tresc: p.tresc, trasa: p.trasa,
    ekrany: zrodla.ekrany.filter((e) => e.punkt === p.id).map(({ ekran, spec, makieta, wymiary }) => ({ ekran, spec, makieta, wymiary })),
  })) })
}

/** @param {string} projekt @param {Opcje} o */
async function poprawione(projekt, o) {
  const punkt = wymagane(o.punkt, 'punkt')
  const smoke = smokeInstancji(projekt, o)
  const plik = sciezkaSmoke(projekt, smoke)
  const p = punktyWizualne(readFileSync(plik, 'utf8'), skrotSha1).find((x) => x.id === punkt)
  if (!p) return wynik({ blad: `brak punktu ${punkt} w ${smoke}` }, KOD_PROBLEMU)
  const stanProjektu = katalogStanu(projekt)
  const w = await zapiszDecyzje({ plik, katalogStanu: stanProjektu, punkt, linia: p.tekst, decyzja: 'poprawione', commit: wymagane(o.commit, 'commit') })
  if (w.wynik === 'konflikt') return wynik({ konflikt: w.powod, linia: w.linia }, KOD_PROBLEMU)
  const z = zapisSerwera(stanProjektu)
  if (!zyjeNasz(z) || !z) return wynik({ linia: w.linia, przeladowano: false, detal: 'narzędzie nie działa — ramek nie ma czego przeładować' })
  const aplikacjaOdpowiada = await czekajNaOdpowiedz(`${z.aplikacja}/`, LIMIT_APLIKACJI_MS, odpowiada)
  const odp = await fetch(`http://127.0.0.1:${z.port}${PREFIKS_NARZEDZIA}api/przeladuj`, { method: 'POST', headers: { [NAGLOWEK_TOKENU]: z.token }, signal: AbortSignal.timeout(5000) })
  return wynik({ linia: w.linia, aplikacjaOdpowiada, przeladowano: odp.ok })
}

/** @param {string} projekt @param {Opcje} o */
function sprawdz(projekt, o) {
  const smoke = wymagane(o.smoke, 'smoke')
  const md = readFileSync(sciezkaSmoke(projekt, smoke), 'utf8')
  const problemy = sprawdzFormat(md)
  const punkty = punktyWizualne(md, skrotSha1)
  if (punkty.length) {
    const zrodla = zrodlaMakiet(projekt, smoke, punkty)
    for (const e of zrodla.ekrany.filter((x) => !x.makieta)) {
      const p = punkty.find((x) => x.id === e.punkt)
      problemy.push({ linia: p?.linia ?? 0, powod: `brak PNG makiety ekranu ${e.ekran} (ani visual-diff/, ani figma_screens)` })
    }
  }
  return wynik({ punkty: punkty.length, problemy: problemy.sort((a, b) => a.linia - b.linia) }, problemy.length ? KOD_PROBLEMU : 0)
}

const POLECENIA = { start, serwer, stop: async (/** @type {string} */ p) => await wynik(await zatrzymaj(katalogStanu(p))), stan, czekaj: czekajNaZgloszenia, zgloszenia, poprawione, sprawdz }

if (import.meta.url === `file://${process.argv[1]}`) {
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
      process.stderr.write(`makieta: ${komunikat}\nUzycie: makieta.mjs start --smoke <plik> [--aplikacja <url>] [--port <n>] | stop | stan | czekaj [--limit-min N] | zgloszenia | poprawione --punkt <id> --commit <sha> | sprawdz --smoke <plik>\n`)
      process.exit(KOD_ZLYCH_ARGUMENTOW)
    }
    if (blad instanceof BladZrodel || blad instanceof BladZapisu) await wynik({ blad: komunikat, kod: blad.kod }, KOD_PROBLEMU)
    await wynik({ wyjatek: komunikat }, KOD_WYJATKU)
  }
}
