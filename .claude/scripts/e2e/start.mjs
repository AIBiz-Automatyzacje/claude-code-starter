// Decyzja startowa E2E dla zadania (P14): czy zadanie potrzebuje srodowiska, czy srodowisko jest sprawne, start serwera.
// Zastepuje dwa agenty bootstrapu autopilota (precheck haiku + env-up opus) jednym poleceniem skryptu; autopilot liczy
// z wyniku STOP albo przejscie dalej (`decyzjaSrodowiskaE2e`).
//
// Statusy: pominieto     — zadanie nie ma scenariuszy [E2E] ani makiet figma_screens (niczego nie testujemy w przegladarce);
//          brak-srodowiska — zadanie ma scenariusze, a repo nie ma .env.e2e -> STOP przed faza 1;
//          niepowodzenie — .env.e2e jest, ale sprawdzenie albo start padly -> STOP przed faza 1;
//          gotowe        — serwer odpowiada (uruchomiony albo zastany) albo sprawdzenie bez startu przeszlo.

import { join } from 'node:path'

import { czyFigmaScreens, sekcjaDesignerska } from '../dossier/dokumenty.mjs'
import { plikZadania } from '../dossier/zadanie.mjs'
import { liczE2e } from './scenariusze.mjs'
import { odpowiada, uruchomSerwer } from './serwer.mjs'
import { bledySrodowiska, envE2e, konfiguracja, NARZEDZIA, PLIK_ENV } from './srodowisko.mjs'

/**
 * @typedef {'pominieto' | 'brak-srodowiska' | 'niepowodzenie' | 'gotowe'} StatusE2e
 * @typedef {{ status: StatusE2e, scenariusze: number, figmaScreens: boolean, envE2e: boolean, bazaE2e: boolean,
 *   serwer: 'uruchomione' | 'zastane' | 'brak', url: string | null, log: string | null, bledy: string[], detal: string, naprawa: string }} WynikStartu
 */

/** @param {string} sciezka katalog zadania @returns {string} */
export const komendaSprawdzenia = (sciezka) => `node .claude/scripts/e2e/e2e.mjs sprawdz --zadanie ${sciezka}`

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
 * @param {string} sciezka katalog zadania
 * @param {{ uruchom: boolean, narzedzia?: import('./srodowisko.mjs').Narzedzia }} opcje uruchom=false: sprawdzenie bez startu (sekcja Doctor)
 * @returns {Promise<WynikStartu>}
 */
export async function startE2e(projekt, sciezka, { uruchom, narzedzia = NARZEDZIA }) {
  const { scenariusze, figmaScreens } = potrzebyZadania(projekt, sciezka)
  const env = envE2e(projekt)
  const konf = env ? konfiguracja(projekt, env) : null
  /** @type {WynikStartu} */
  const wynik = {
    status: 'pominieto', scenariusze, figmaScreens, envE2e: !!env, bazaE2e: !!konf?.bazaE2e, serwer: 'brak',
    url: konf?.url ?? null, log: null, bledy: [], detal: '', naprawa: '',
  }
  if (!scenariusze && !figmaScreens) {
    return { ...wynik, detal: 'zadanie nie ma niezaznaczonych scenariuszy [E2E] ani makiet figma_screens — przegladarka niepotrzebna' }
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
