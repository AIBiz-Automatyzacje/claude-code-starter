// Bramka tsc: `tsc --noEmit` calego projektu (konfiguracja z wykrycia). Kazdy blad TS = porazka — typecheck ma byc zielony
// niezaleznie od tego, ktora faza blad wprowadzila.

import { bladNarzedzia, uruchom } from './uruchom.mjs'

const SUFIT_SEKUND = 600
// `plik(linia,kolumna): error TSnnnn: opis` albo blad bez pliku (`error TS5058: ...`).
const BLAD_TS = /^(?:(.+?)\((\d+),\d+\): )?error (TS\d+): (.*)$/gm

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */

/**
 * @param {string} projekt
 * @param {{ bin: string, konfiguracja: string | null }} narzedzie
 * @returns {WynikBramki}
 */
export function bramkaTsc(projekt, narzedzie) {
  const p = uruchom(narzedzie.bin, ['--noEmit', '-p', narzedzie.konfiguracja ?? 'tsconfig.json', '--pretty', 'false'], {
    cwd: projekt,
    sufitSekund: SUFIT_SEKUND,
  })
  const trafienia = [...p.stdout.matchAll(BLAD_TS)].map((m) => ({
    plik: m[1] ?? null,
    linia: m[2] ? Number(m[2]) : null,
    regula: m[3],
    opis: m[4],
  }))
  if (p.kod === 0) return { status: 'ok', sekundy: p.sekundy, trafienia: [] }
  if (!trafienia.length) return bladNarzedzia(p, 'tsc')
  return { status: 'porazka', sekundy: p.sekundy, trafienia }
}
