// Uruchomienie narzedzia bramki z pomiarem czasu i sufitem; typ wyniku bramki wspolny dla wszystkich modulow.

import { spawnSync } from 'node:child_process'

// Raport ESLint/knip/Strykera na duzym projekcie ma kilka MB JSON.
const BUFOR_WYJSCIA = 64 * 1024 * 1024

/** @typedef {{ plik: string | null, linia: number | null, regula: string, opis: string }} Trafienie */
/**
 * Status: ok | porazka (trafienia do naprawy) | brak (narzedzie lub dane nieobecne) | blad (narzedzie padlo, powod)
 * | pominieta (bramka nie dotyczy fazy, powod). Bramki informacyjne (Stryker, testy usuniete) nie daja porazki — trafienia sa lista.
 * @typedef {{ status: 'ok' | 'porazka' | 'brak' | 'blad' | 'pominieta', sekundy: number | null, trafienia: Trafienie[], powod?: string, ostrzezenia?: Trafienie[], zastane?: number }} WynikBramki
 */
/** @typedef {{ kod: number | null, stdout: string, stderr: string, sekundy: number, przekroczony: boolean }} Przebieg */

/**
 * @param {string} bin
 * @param {string[]} argumenty
 * @param {{ cwd: string, sufitSekund: number, env?: NodeJS.ProcessEnv }} o
 * @returns {Przebieg}
 */
export function uruchom(bin, argumenty, o) {
  const start = performance.now()
  const p = spawnSync(bin, argumenty, {
    cwd: o.cwd,
    env: o.env ?? process.env,
    encoding: 'utf8',
    timeout: o.sufitSekund * 1000,
    killSignal: 'SIGKILL',
    maxBuffer: BUFOR_WYJSCIA,
  })
  const sekundy = Math.round((performance.now() - start) / 100) / 10
  if (p.error && !('code' in p.error && p.error.code === 'ETIMEDOUT')) throw p.error
  return { kod: p.status, stdout: p.stdout ?? '', stderr: p.stderr ?? '', sekundy, przekroczony: Boolean(p.error) }
}

const DLUGOSC_POWODU = 400
const LINIA_STOSU = /^\s+at /

/**
 * Wynik `blad` z koncowka wyjscia narzedzia bez linii stosu (ESLint pisze komunikat przed stosem) — diagnoza bez logow.
 * @param {Przebieg} p
 * @param {string} narzedzie
 * @returns {WynikBramki}
 */
export function bladNarzedzia(p, narzedzie) {
  const wyjscie = (p.stderr || p.stdout).split('\n').filter((l) => l.trim() && !LINIA_STOSU.test(l)).join('\n')
  const powod = p.przekroczony
    ? `${narzedzie}: przekroczony sufit czasu (${p.sekundy} s)`
    : `${narzedzie}: kod ${p.kod}, ${wyjscie.slice(-DLUGOSC_POWODU)}`
  return { status: 'blad', sekundy: p.sekundy, trafienia: [], powod }
}
