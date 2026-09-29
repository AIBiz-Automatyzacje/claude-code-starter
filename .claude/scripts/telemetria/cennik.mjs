// Cennik wzgledny kosztu (input = 1). Ten sam co w modelu kosztu analizy 2026-09 (koszt_agentow.py, d4r, panel),
// zeby liczby z telemetrii byly porownywalne z punktem odniesienia etapu 0 (1 293 M jedn. po przegladzie D5).

export const KOSZT_INPUT = 1
export const KOSZT_CACHE_WRITE = 1.25
export const KOSZT_CACHE_READ = 0.1
export const KOSZT_OUTPUT = 5

/**
 * @param {{ in: number, cache_w: number, cache_r: number, out: number }} tokeny
 * @returns {number} koszt w jednostkach wzglednych, zaokraglony
 */
export function kosztJednostek(tokeny) {
  return Math.round(
    tokeny.in * KOSZT_INPUT + tokeny.cache_w * KOSZT_CACHE_WRITE + tokeny.cache_r * KOSZT_CACHE_READ + tokeny.out * KOSZT_OUTPUT,
  )
}
