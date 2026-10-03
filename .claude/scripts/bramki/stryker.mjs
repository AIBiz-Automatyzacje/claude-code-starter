// Bramka Stryker diff-scoped: mutacje tylko na liniach fazy w plikach produkcyjnych, ktorych test (x.test.ts obok x.ts) faza
// dotknela. Wynik = lista przezytych mutantow (Survived, NoCoverage) jako wejscie dla buildera i test-coverage; score nie jest
// celem, wiec bramka nie daje porazki. Raport JSON czytany i usuwany (drzewo robocze zostaje czyste).

import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { zakresy } from './diff.mjs'
import { bladNarzedzia, uruchom } from './uruchom.mjs'

const SUFIT_SEKUND = 900
const PARA_TESTU = /^(.+)\.(?:test|spec)\.([cm]?[jt]sx?)$/
const RAPORT_DOMYSLNY = 'reports/mutation/mutation.json'
const STATUSY_PRZEZYTE = new Set(['Survived', 'NoCoverage'])

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {{ mutatorName: string, replacement?: string, status: string, location: { start: { line: number } } }} Mutant */
/** @typedef {{ files: Record<string, { mutants: Mutant[] }> }} RaportStrykera */

/**
 * Argumenty --mutate `plik:od-do` dla plikow produkcyjnych z para testu zmieniona w fazie.
 * @param {import('./diff.mjs').ZmianyFazy} zmiany
 * @returns {string[]}
 */
export function zakresyStrykera(zmiany) {
  const pliki = new Set(zmiany.pliki)
  const produkcyjne = zmiany.pliki.flatMap((p) => {
    const m = PARA_TESTU.exec(p)
    const kod = m && `${m[1]}.${m[2]}`
    return kod && pliki.has(kod) && zmiany.dodaneLinie[kod]?.length ? [kod] : []
  })
  return [...new Set(produkcyjne)].sort().flatMap((p) => zakresy(zmiany.dodaneLinie[p]).map(([od, doLinii]) => `${p}:${od}-${doLinii}`))
}

/** @param {string} projekt @param {string | null} konfiguracja @returns {string} sciezka raportu JSON wzgledem projektu */
function sciezkaRaportu(projekt, konfiguracja) {
  if (!konfiguracja?.endsWith('.json')) return RAPORT_DOMYSLNY
  const dane = JSON.parse(readFileSync(join(projekt, konfiguracja), 'utf8'))
  return dane?.jsonReporter?.fileName ?? RAPORT_DOMYSLNY
}

/**
 * @param {string} projekt
 * @param {{ bin: string, konfiguracja: string | null }} narzedzie
 * @param {import('./diff.mjs').ZmianyFazy} zmiany
 * @returns {WynikBramki}
 */
export function bramkaStryker(projekt, narzedzie, zmiany) {
  const mutate = zakresyStrykera(zmiany)
  if (!mutate.length) return { status: 'pominieta', sekundy: null, trafienia: [], powod: 'faza nie zmienila pary test <-> plik produkcyjny z liniami dodanymi' }
  const raport = join(projekt, sciezkaRaportu(projekt, narzedzie.konfiguracja))
  rmSync(raport, { force: true })
  const p = uruchom(narzedzie.bin, ['run', '--mutate', mutate.join(','), '--reporters', 'json'], { cwd: projekt, sufitSekund: SUFIT_SEKUND })
  if (p.kod !== 0 || !existsSync(raport)) return bladNarzedzia(p, 'Stryker')
  /** @type {RaportStrykera} */
  const dane = JSON.parse(readFileSync(raport, 'utf8'))
  rmSync(raport)
  const trafienia = Object.entries(dane.files).flatMap(([plik, { mutants }]) =>
    mutants
      .filter((m) => STATUSY_PRZEZYTE.has(m.status))
      .map((m) => ({ plik, linia: m.location.start.line, regula: `stryker/${m.mutatorName}`, opis: `${m.status}: ${m.replacement ?? ''}` })),
  )
  return { status: 'ok', sekundy: p.sekundy, trafienia }
}
