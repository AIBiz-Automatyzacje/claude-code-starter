// Decyzja startowa E2E dla zadania (P14): czy zadanie potrzebuje srodowiska, czy srodowisko jest sprawne, start serwera.
// Zastepuje dwa agenty bootstrapu autopilota (precheck haiku + env-up opus) jednym poleceniem skryptu; autopilot liczy
// z wyniku STOP albo przejscie dalej (`decyzjaSrodowiskaE2e`).
//
// Statusy: pominieto     — zadanie nie ma scenariuszy [E2E] ani makiet figma_screens (niczego nie testujemy w przegladarce);
//          brak-srodowiska — zadanie ma scenariusze, a repo nie ma .env.e2e -> STOP przed faza 1;
//          niepowodzenie — .env.e2e jest, ale sprawdzenie albo start padly -> STOP przed faza 1;
//          gotowe        — serwer odpowiada (uruchomiony albo zastany) albo sprawdzenie bez startu przeszlo;
//          odroczone     — przed faza 1 komenda startu nie ma czego uruchomic (projekt od zera, P17): .env.e2e sprawne,
//                          serwer wystartuje restart przed testerem pierwszej fazy, ktora go potrzebuje.
// Bez zadania (sekcje Doctor i Launch skilla weryfikacji) srodowisko jest potrzebne zawsze: brak .env.e2e = brak-srodowiska.
// Restart fazy (`restartFazy`, P17): przed testerem kazdej fazy ze scenariuszami albo makietami nasz serwer startuje od nowa.

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

/** @param {{ wyjscie?: number | string, ogon?: string }} serwer porazka startu @returns {boolean} */
const brakAplikacji = (serwer) => serwer.wyjscie === KOD_BRAKU_PROGRAMU || BRAK_APLIKACJI.test(serwer.ogon ?? '')

/** Token Management API (advisors) nie idzie do procesu aplikacji — serwer go nie potrzebuje. @param {Record<string, string>} env */
const envSerwera = (env) => Object.fromEntries(Object.entries(env).filter(([k]) => k !== 'SUPABASE_ACCESS_TOKEN'))

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
 * @param {{ uruchom: boolean, przedPierwszaFaza?: boolean, narzedzia?: import('./srodowisko.mjs').Narzedzia }} opcje uruchom=false:
 *   sprawdzenie bez startu (sekcja Doctor); przedPierwszaFaza: zadna faza zadania nie ma execute — projekt bez aplikacji = odroczone
 * @returns {Promise<WynikStartu>}
 */
export async function startE2e(projekt, sciezka, { uruchom, przedPierwszaFaza = false, narzedzia = NARZEDZIA }) {
  const { scenariusze, figmaScreens } = sciezka ? potrzebyZadania(projekt, sciezka) : { scenariusze: null, figmaScreens: false }
  const env = envE2e(projekt)
  const konf = env ? konfiguracja(projekt, env) : null
  /** @type {WynikStartu} */
  const wynik = {
    status: 'pominieto', scenariusze, figmaScreens, envE2e: !!env, bazaE2e: !!konf?.bazaE2e, serwer: 'brak',
    url: konf?.url ?? null, log: null, bledy: [], detal: '', naprawa: '',
  }
  if (scenariusze === 0 && !figmaScreens) {
    return { ...wynik, detal: 'zadanie nie ma niezaznaczonych scenariuszy [E2E] ani makiet figma_screens — przegladarka niepotrzebna' }
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
  const serwer = await uruchomSerwer(projekt, konf, envSerwera(env))
  if (serwer.blad && przedPierwszaFaza && brakAplikacji(serwer)) {
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
  const serwer = await uruchomSerwer(projekt, konf, envSerwera(env), { odNowa: true })
  if (serwer.blad) return { ...wynik, status: 'niepowodzenie', log: konf.log, detal: serwer.blad }
  const zastany = serwer.serwer === 'zastane'
  return {
    ...wynik, status: 'gotowe', serwer: serwer.serwer, log: zastany ? null : konf.log,
    detal: zastany ? `serwer nie nasz (zastany) — zostaje bez restartu na ${konf.zdrowie}` : `serwer uruchomiony od nowa („${konf.start}”), odpowiada na ${konf.zdrowie}`,
  }
}
