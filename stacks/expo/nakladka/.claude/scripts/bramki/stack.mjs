// Bramka stacku Expo (slot plikowy z rejestru stacks/sloty.json, kontrakt w wariancie web tego pliku): expo-doctor (D14). Biegnie tylko po
// zmianie zależności albo konfiguracji aplikacji, bo reszta fazy nie zmienia tego, co sprawdza, a narzędzie pobiera się z sieci.
// `expo-doctor` nie jest zależnością szablonu Expo, dlatego `npx`, a nie `node_modules/.bin`.
//
// Rozjazd wersji paczek SDK dzieli się na wprowadzony przez fazę (porażka) i zastany (ostrzeżenie i liczba `zastane`): lista oczekiwanych
// wersji przychodzi z sieci, więc projekt bez zmian przestaje ją spełniać po każdym nowym patchu SDK (pilot Nawykometr, run 2: faza dodała
// jedną paczkę, a bramka padła na 18 zastanych). Paczki fazy = wpisy dodane albo zmienione w `package.json` projektu; zmiana samego
// `expo` przesuwa oczekiwane wersje wszystkich paczek, więc wtedy cały rozjazd należy do fazy. Zmiana samego lockfile'a bez
// `package.json` nie wskazuje paczek: rozjazd jest wtedy zastany.

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { bladNarzedzia, uruchom } from './uruchom.mjs'

const SUFIT_SEKUND = 180
const DLUGOSC_OPISU = 600
const KONFIGURACJA = ['app.json', 'app.config.js', 'app.config.ts']
const WYZWALACZE = new Set([...KONFIGURACJA, 'package.json', 'metro.config.js', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'])
const PODSUMOWANIE = /\n\d+ checks? failed, indicating[^\n]*\s*$/
const SPRAWDZENIE_WERSJI = 'Check that packages match versions required by installed Expo SDK'
const WIERSZ_WERSJI = /^(@?[\w./-]+)\s+(\S*\d\S*)\s+(\d\S*)$/
const NAPRAWA_ZASTANYCH = 'npx expo install --fix (osobny commit, potem przebudowa dev-clienta)'

/** @typedef {import('./uruchom.mjs').Trafienie} Trafienie */
/** @typedef {{ paczka: string, oczekiwana: string, znaleziona: string }} Rozjazd */

/** @param {string} opis @returns {Trafienie} */
const trafienie = (opis) => ({ plik: null, linia: null, regula: 'expo-doctor', opis: opis.slice(0, DLUGOSC_OPISU) })

/** @param {string} wyjscie @returns {{ nazwa: string, linie: string[] }[]} bloki nieudanych sprawdzeń: od `✖ <nazwa>` do następnego znacznika */
function blokiDoctora(wyjscie) {
  return wyjscie.split(/^✖ /m).slice(1).map((blok) => {
    const [nazwa, ...linie] = blok.replace(PODSUMOWANIE, '').split('\n')
    return { nazwa: nazwa.trim(), linie: linie.map((l) => l.trim()).filter(Boolean) }
  })
}

/**
 * Nieudane sprawdzenia z wyjścia expo-doctor: blok od `✖ <nazwa>` do następnego znacznika.
 * @param {string} wyjscie @returns {Trafienie[]}
 */
export function problemyDoctora(wyjscie) {
  return blokiDoctora(wyjscie).map((b) => trafienie(`${b.nazwa}: ${b.linie.join(' ')}`))
}

/**
 * Wiersze tabel „package expected found” ze sprawdzenia wersji paczek SDK (patch, minor i major).
 * @param {string[]} linie @returns {Rozjazd[]}
 */
export function rozjazdyWersji(linie) {
  return linie.flatMap((l) => {
    const m = WIERSZ_WERSJI.exec(l)
    return m ? [{ paczka: m[1], oczekiwana: m[2], znaleziona: m[3] }] : []
  })
}

/**
 * Paczki, których wpis faza dodała albo zmieniła w `package.json` projektu (strona nowa diffu -U0).
 * @param {string} diffU0 @returns {Set<string>}
 */
export function paczkiFazy(diffU0) {
  const paczki = new Set()
  let wPackageJson = false
  for (const linia of diffU0.split('\n')) {
    if (linia.startsWith('diff --git ')) wPackageJson = linia === 'diff --git a/package.json b/package.json'
    const m = wPackageJson ? /^\+\s*"([^"]+)":\s*"/.exec(linia) : null
    if (m) paczki.add(m[1])
  }
  return paczki
}

/** @param {Rozjazd[]} rozjazdy @returns {string} */
const listaRozjazdow = (rozjazdy) => rozjazdy.map((r) => `${r.paczka} ${r.znaleziona} (oczekiwana ${r.oczekiwana})`).join(', ')

/**
 * Sprawdzenie wersji paczek: rozjazd paczek fazy to trafienie, pozostały to ostrzeżenie. Blok bez rozpoznanych wierszy zostaje trafieniem.
 * @param {{ nazwa: string, linie: string[] }} blok @param {Set<string>} zFazy
 * @returns {{ trafienia: Trafienie[], ostrzezenia: Trafienie[], zastane: number }}
 */
function podzielWersje(blok, zFazy) {
  const rozjazdy = rozjazdyWersji(blok.linie)
  if (!rozjazdy.length || zFazy.has('expo')) return { trafienia: [trafienie(`${blok.nazwa}: ${blok.linie.join(' ')}`)], ostrzezenia: [], zastane: 0 }
  const wprowadzone = rozjazdy.filter((r) => zFazy.has(r.paczka))
  const zastane = rozjazdy.filter((r) => !zFazy.has(r.paczka))
  return {
    trafienia: wprowadzone.length ? [trafienie(`${blok.nazwa}: paczki zmienione w fazie: ${listaRozjazdow(wprowadzone)}. Naprawa: npx expo install <paczka>`)] : [],
    // Naprawa przed listą: opis jest ucinany, a operator ma zobaczyć komendę także przy długiej liście paczek.
    ostrzezenia: zastane.length ? [trafienie(`${blok.nazwa}: ${zastane.length} paczek z rozjazdem sprzed fazy (naprawa poza fazą, decyzja operatora: ${NAPRAWA_ZASTANYCH}): ${listaRozjazdow(zastane)}`)] : [],
    zastane: zastane.length,
  }
}

/** @type {(projekt: string, zmiany: import('./diff.mjs').ZmianyFazy) => import('./uruchom.mjs').WynikBramki} */
export const bramkaStacku = (projekt, zmiany) => {
  if (!KONFIGURACJA.some((p) => existsSync(join(projekt, p)))) return { status: 'pominieta', sekundy: null, trafienia: [], powod: 'katalog bez konfiguracji Expo' }
  if (!zmiany.pliki.some((p) => WYZWALACZE.has(p))) return { status: 'pominieta', sekundy: null, trafienia: [], powod: 'faza nie zmieniła zależności ani konfiguracji aplikacji' }
  const p = uruchom('npx', ['--yes', 'expo-doctor@latest'], { cwd: projekt, sufitSekund: SUFIT_SEKUND })
  if (p.kod === 0 && !p.przekroczony) return { status: 'ok', sekundy: p.sekundy, trafienia: [] }
  const bloki = blokiDoctora(`${p.stdout}\n${p.stderr}`)
  if (!bloki.length) return bladNarzedzia(p, 'expo-doctor')
  const zFazy = paczkiFazy(zmiany.diffU0)
  /** @type {Trafienie[]} */
  const trafienia = []
  /** @type {Trafienie[]} */
  const ostrzezenia = []
  let zastane = 0
  for (const blok of bloki) {
    if (blok.nazwa !== SPRAWDZENIE_WERSJI) {
      trafienia.push(trafienie(`${blok.nazwa}: ${blok.linie.join(' ')}`))
      continue
    }
    const w = podzielWersje(blok, zFazy)
    trafienia.push(...w.trafienia)
    ostrzezenia.push(...w.ostrzezenia)
    zastane += w.zastane
  }
  return { status: trafienia.length ? 'porazka' : 'ok', sekundy: p.sekundy, trafienia, ...(ostrzezenia.length ? { ostrzezenia, zastane } : {}) }
}
