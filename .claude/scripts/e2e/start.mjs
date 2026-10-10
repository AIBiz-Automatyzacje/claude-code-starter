// Decyzja startowa E2E dla zadania (P14): czy zadanie potrzebuje srodowiska, czy srodowisko jest sprawne, start serwera.
// Zastepuje dwa agenty bootstrapu autopilota (precheck haiku + env-up opus) jednym poleceniem skryptu; autopilot liczy
// z wyniku STOP albo przejscie dalej (`decyzjaSrodowiskaE2e`).
//
// Statusy: pominieto     — zadanie nie ma scenariuszy [E2E] ani makiet figma_screens (niczego nie testujemy w przegladarce);
//          brak-srodowiska — zadanie ma scenariusze, a repo nie ma .env.e2e -> STOP przed faza 1;
//          niepowodzenie — .env.e2e jest, ale sprawdzenie albo start padly -> STOP przed faza 1;
//          gotowe        — serwer odpowiada (uruchomiony albo zastany) albo sprawdzenie bez startu przeszlo;
//          odroczone     — projekt od zera (P17): repo nie ma jeszcze aplikacji (brak package.json albo package.json bez
//                          zaleznosci), a komenda startu nie ma czego uruchomic; .env.e2e sprawne, serwer wystartuje restart
//                          przed testerem pierwszej fazy, ktora go potrzebuje. Swiezy klon bez node_modules albo literowka
//                          w E2E_START w projekcie z aplikacja to nadal STOP z naprawa (bez cichej degradacji do recznego).
// Bez zadania (sekcje Doctor i Launch skilla weryfikacji) srodowisko jest potrzebne zawsze: brak .env.e2e = brak-srodowiska.
// Restart fazy (`restartFazy`, P17): przed testerem kazdej fazy ze scenariuszami albo makietami nasz serwer startuje od nowa.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { czyFigmaScreens, sekcjaDesignerska } from '../dossier/dokumenty.mjs'
import { plikZadania } from '../dossier/zadanie.mjs'
import { doOdegrania, liczE2e } from './scenariusze.mjs'
import { odpowiada, uruchomSerwer } from './serwer.mjs'
import { bledySrodowiska, envE2e, konfiguracja, NARZEDZIA, PLIK_ENV } from './srodowisko.mjs'

/**
 * @typedef {'pominieto' | 'brak-srodowiska' | 'niepowodzenie' | 'gotowe' | 'odroczone'} StatusE2e
 * @typedef {{ status: StatusE2e, scenariusze: number | null, figmaScreens: boolean, envE2e: boolean, bazaE2e: boolean,
 *   serwer: 'uruchomione' | 'zastane' | 'brak', url: string | null, log: string | null, bledy: string[], detal: string, naprawa: string }} WynikStartu
 */

// Komenda startu bez aplikacji: pnpm/npm bez binarki, skryptu albo package.json, powloka bez programu (kod 127).
const BRAK_APLIKACJI = /Command "[^"]+" not found|command not found|ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND|ERR_PNPM_NO_SCRIPT|Missing script|ENOENT[^\n]*package\.json/i
const KOD_BRAKU_PROGRAMU = 127

/**
 * Repo bez aplikacji (projekt od zera, vibersi: package.json ze skryptami scrapera, bez zaleznosci): rozpoznanie po strukturze,
 * nie po stanie faz — wznowienie po STOP-ie w fazie 1, ktora aplikacji nie zbudowala, tez jest projektem od zera.
 * @param {string} projekt
 * @returns {boolean}
 */
export function projektBezAplikacji(projekt) {
  const plik = join(projekt, 'package.json')
  if (!existsSync(plik)) return true
  try {
    const pakiet = JSON.parse(readFileSync(plik, 'utf8'))
    const ile = (/** @type {unknown} */ x) => (x && typeof x === 'object' ? Object.keys(x).length : 0)
    return ile(pakiet.dependencies) + ile(pakiet.devDependencies) === 0
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return false
  }
}

/** @param {string} projekt @param {{ wyjscie?: number | string, ogon?: string }} serwer porazka startu @returns {boolean} */
const brakAplikacji = (projekt, serwer) => projektBezAplikacji(projekt) && (serwer.wyjscie === KOD_BRAKU_PROGRAMU || BRAK_APLIKACJI.test(serwer.ogon ?? ''))

/** @param {string | null} sciezka katalog zadania (null: sprawdzenie bez zadania) @returns {string} */
export const komendaSprawdzenia = (sciezka) => `node .claude/scripts/e2e/e2e.mjs sprawdz${sciezka ? ` --zadanie ${sciezka}` : ''}`

/**
 * @param {string} projekt
 * @param {string} sciezka katalog zadania wzgledem projektu
 * @returns {{ scenariusze: number, figmaScreens: boolean }}
 */
export function potrzebyZadania(projekt, sciezka) {
  const katalog = join(projekt, sciezka)
  const zadania = plikZadania(katalog, '-zadania.md')
  const kontekst = plikZadania(katalog, '-kontekst.md')
  return {
    scenariusze: zadania ? liczE2e(zadania.tresc) : 0,
    figmaScreens: kontekst ? czyFigmaScreens(sekcjaDesignerska(kontekst.tresc)) : false,
  }
}

/**
 * @param {string} projekt
 * @param {string | null} sciezka katalog zadania; null = bez zadania (skill weryfikacji)
 * @param {{ uruchom: boolean, narzedzia?: import('./srodowisko.mjs').Narzedzia }} opcje uruchom=false: sprawdzenie bez startu (sekcja Doctor)
 * @returns {Promise<WynikStartu>}
 */
export async function startE2e(projekt, sciezka, { uruchom, narzedzia = NARZEDZIA }) {
  const { scenariusze, figmaScreens } = sciezka ? potrzebyZadania(projekt, sciezka) : { scenariusze: null, figmaScreens: false }
  const env = envE2e(projekt)
  const konf = env ? konfiguracja(projekt, env) : null
  /** @type {WynikStartu} */
  const wynik = {
    status: 'pominieto', scenariusze, figmaScreens, envE2e: !!env, bazaE2e: !!konf?.bazaE2e, serwer: 'brak',
    url: konf?.url ?? null, log: null, bledy: [], detal: '', naprawa: '',
  }
  if (scenariusze === 0 && !figmaScreens) {
    const detal = 'zadanie nie ma niezaznaczonych scenariuszy [E2E] ani makiet figma_screens — przegladarka niepotrzebna'
    if (!env || !konf?.bazaE2e) return { ...wynik, bazaE2e: false, detal }
    // Baza e2e bez scenariuszy (P17): db-sync i advisors biegna takze w zadaniu bez przegladarki (zadanie backendowe z migracjami),
    // ale po guardzie tozsamosci, bo db-sync wgrywa migracje. Blad wylacza baze bez STOP-u — przegladarki zadanie nie potrzebuje.
    const bledy = bledySrodowiska(projekt, env, { przegladarka: false, narzedzia })
    return { ...wynik, bazaE2e: !bledy.length, bledy, detal: bledy.length ? `${detal}; baza e2e wylaczona (db-sync i advisors nie pobiegna): ${bledy.join('; ')}` : `${detal}; baza e2e sprawna — db-sync i advisors po migracjach faz` }
  }
  if ((!env || !konf) && scenariusze === null) {
    return { ...wynik, status: 'brak-srodowiska', detal: `repo nie ma ${PLIK_ENV}`, naprawa: `Setup srodowiska wg .claude/templates/e2e-env/README.md (${PLIK_ENV} w korzeniu repo, w .gitignore). Sprawdzenie: ${komendaSprawdzenia(null)}` }
  }
  if (!env || !konf) {
    if (!scenariusze) return { ...wynik, detal: `makiety figma_screens bez ${PLIK_ENV} — visual diff bez przegladarki (tester w trybie bez-przegladarki)` }
    return {
      ...wynik,
      status: 'brak-srodowiska',
      detal: `zadanie ma ${scenariusze} scenariuszy [E2E], a repo nie ma ${PLIK_ENV}`,
      naprawa: `Setup srodowiska wg .claude/templates/e2e-env/README.md (${PLIK_ENV} w korzeniu repo, w .gitignore). Swiadomy opt-out: zmien marker [E2E] na [Manual] w pliku zadan — scenariusz wykonasz recznie w smoke'u operatora. Sprawdzenie bez startu: ${komendaSprawdzenia(sciezka)}`,
    }
  }
  const bledy = bledySrodowiska(projekt, env, { przegladarka: true, narzedzia })
  if (bledy.length) {
    return { ...wynik, status: 'niepowodzenie', bledy, detal: bledy.join('; '), naprawa: `Popraw: ${bledy.join('; ')}. Sprawdzenie: ${komendaSprawdzenia(sciezka)}` }
  }
  if (!uruchom) {
    const dziala = await odpowiada(konf.zdrowie)
    return { ...wynik, status: 'gotowe', serwer: dziala ? 'zastane' : 'brak', detal: `sprawdzenie ${PLIK_ENV} ok; serwer ${dziala ? `odpowiada na ${konf.zdrowie}` : `nie dziala — autopilot uruchomi: ${konf.start}`}` }
  }
  const serwer = await uruchomSerwer(projekt, konf, env)
  if (serwer.blad && brakAplikacji(projekt, serwer)) {
    const przyczyna = (serwer.ogon ?? '').split('\n').find((l) => BRAK_APLIKACJI.test(l))?.trim() ?? `kod ${serwer.wyjscie}`
    return { ...wynik, status: 'odroczone', log: konf.log, detal: `aplikacji jeszcze nie ma („${konf.start}”: ${przyczyna}) — serwer wystartuje przed testerem pierwszej fazy, ktora go potrzebuje` }
  }
  if (serwer.blad) {
    return { ...wynik, status: 'niepowodzenie', log: konf.log, bledy: [serwer.blad], detal: serwer.blad, naprawa: `Uruchom recznie „${konf.start}” i sprawdz ${konf.zdrowie}; parametry E2E_START, E2E_URL, E2E_HEALTH, E2E_START_TIMEOUT w ${PLIK_ENV}. Sprawdzenie: ${komendaSprawdzenia(sciezka)}` }
  }
  const zastany = serwer.serwer === 'zastane'
  return {
    ...wynik,
    status: 'gotowe',
    serwer: serwer.serwer,
    log: zastany ? null : konf.log,
    detal: zastany ? `serwer juz odpowiadal na ${konf.zdrowie} — zastany, moze dzialac na bazie dev (flow zweryfikuja to logowaniem kontem e2e)` : `serwer uruchomiony („${konf.start}”), odpowiada na ${konf.zdrowie}`,
  }
}

/**
 * @typedef {{ status: 'pominieto' | 'gotowe' | 'niepowodzenie', faza: number, scenariusze: number, figmaScreens: boolean,
 *   serwer: 'uruchomione' | 'zastane' | 'brak', url: string | null, log: string | null, detal: string }} WynikRestartu
 */

/**
 * Restart serwera przed testerem fazy (P17): faza ze scenariuszami [E2E] albo z makietami figma_screens dostaje serwer
 * uruchomiony od nowa po swoim execute — serwer z bootstrapu nie widzi plikow konfiguracji powstalych w fazach (vibersi).
 * Bez sprawdzenia srodowiska: to zrobil start, a suma migracji zmieniona w fazie jest defektem kodu (bramki), nie srodowiska.
 * @param {string} projekt
 * @param {string} sciezka katalog zadania wzgledem projektu
 * @param {number} faza
 * @returns {Promise<WynikRestartu>}
 */
export async function restartFazy(projekt, sciezka, faza) {
  const zadania = plikZadania(join(projekt, sciezka), '-zadania.md')
  const scenariusze = zadania ? doOdegrania(zadania.tresc, faza).length : 0
  const { figmaScreens } = potrzebyZadania(projekt, sciezka)
  const env = envE2e(projekt)
  const konf = env ? konfiguracja(projekt, env) : null
  /** @type {WynikRestartu} */
  const wynik = { status: 'pominieto', faza, scenariusze, figmaScreens, serwer: 'brak', url: konf?.url ?? null, log: null, detal: '' }
  if (!scenariusze && !figmaScreens) return { ...wynik, detal: `faza ${faza} bez scenariuszy [E2E] i makiet — serwer niepotrzebny` }
  if (!env || !konf || konf.blad) return { ...wynik, status: 'niepowodzenie', detal: konf?.blad ?? `brak ${PLIK_ENV}` }
  const serwer = await uruchomSerwer(projekt, konf, env, { odNowa: true })
  if (serwer.blad) return { ...wynik, status: 'niepowodzenie', log: konf.log, detal: serwer.blad }
  const zastany = serwer.serwer === 'zastane'
  return {
    ...wynik, status: 'gotowe', serwer: serwer.serwer, log: zastany ? null : konf.log,
    detal: zastany ? `serwer nie nasz (zastany) — zostaje bez restartu na ${konf.zdrowie}` : `serwer uruchomiony od nowa („${konf.start}”), odpowiada na ${konf.zdrowie}`,
  }
}
