// Bramka stacku Expo (slot plikowy z rejestru stacks/sloty.json, kontrakt w wariancie web tego pliku): expo-doctor (D14). Biegnie tylko po
// zmianie zależności albo konfiguracji aplikacji, bo reszta fazy nie zmienia tego, co sprawdza, a narzędzie pobiera się z sieci.
// `expo-doctor` nie jest zależnością szablonu Expo, dlatego `npx`, a nie `node_modules/.bin`.

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { bladNarzedzia, uruchom } from './uruchom.mjs'

const SUFIT_SEKUND = 180
const DLUGOSC_OPISU = 600
const KONFIGURACJA = ['app.json', 'app.config.js', 'app.config.ts']
const WYZWALACZE = new Set([...KONFIGURACJA, 'package.json', 'metro.config.js', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'])
const PODSUMOWANIE = /\n\d+ checks? failed, indicating[^\n]*\s*$/

/** @typedef {import('./uruchom.mjs').Trafienie} Trafienie */

/**
 * Nieudane sprawdzenia z wyjścia expo-doctor: blok od `✖ <nazwa>` do następnego znacznika.
 * @param {string} wyjscie @returns {Trafienie[]}
 */
export function problemyDoctora(wyjscie) {
  return wyjscie.split(/^✖ /m).slice(1).map((blok) => {
    const [nazwa, ...reszta] = blok.replace(PODSUMOWANIE, '').split('\n')
    const opis = reszta.map((l) => l.trim()).filter(Boolean).join(' ')
    return { plik: null, linia: null, regula: 'expo-doctor', opis: `${nazwa.trim()}: ${opis}`.slice(0, DLUGOSC_OPISU) }
  })
}

/** @type {(projekt: string, zmiany: import('./diff.mjs').ZmianyFazy) => import('./uruchom.mjs').WynikBramki} */
export const bramkaStacku = (projekt, zmiany) => {
  if (!KONFIGURACJA.some((p) => existsSync(join(projekt, p)))) return { status: 'pominieta', sekundy: null, trafienia: [], powod: 'katalog bez konfiguracji Expo' }
  if (!zmiany.pliki.some((p) => WYZWALACZE.has(p))) return { status: 'pominieta', sekundy: null, trafienia: [], powod: 'faza nie zmieniła zależności ani konfiguracji aplikacji' }
  const p = uruchom('npx', ['--yes', 'expo-doctor@latest'], { cwd: projekt, sufitSekund: SUFIT_SEKUND })
  if (p.kod === 0 && !p.przekroczony) return { status: 'ok', sekundy: p.sekundy, trafienia: [] }
  const trafienia = problemyDoctora(`${p.stdout}\n${p.stderr}`)
  return trafienia.length ? { status: 'porazka', sekundy: p.sekundy, trafienia } : bladNarzedzia(p, 'expo-doctor')
}
