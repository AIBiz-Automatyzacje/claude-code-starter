// Bramka knip: martwe eksporty, pliki i zaleznosci. Knip patrzy na caly projekt; porazka tylko za problemy w plikach
// zmienionych w fazie (faza dotknela pliku = naprawia jego martwy kod), reszta to liczba `zastane`.

import { bladNarzedzia, uruchom } from './uruchom.mjs'

const SUFIT_SEKUND = 300

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {import('./uruchom.mjs').Trafienie} Trafienie */
/** @typedef {{ name: string, line?: number }} ElementKnip */
/** @typedef {{ issues: ({ file: string } & Record<string, unknown>)[] }} RaportKnip */

/** @param {unknown} x @returns {x is (ElementKnip | ElementKnip[])[]} */
const czyElementy = (x) => Array.isArray(x)

/**
 * Wszystkie problemy z raportu: kazdy klucz problemu poza `file` to lista elementow (duplikaty = lista list).
 * @param {RaportKnip} raport
 * @returns {Trafienie[]}
 */
function problemy(raport) {
  return raport.issues.flatMap((problem) =>
    Object.entries(problem)
      .flatMap(([typ, elementy]) => {
        if (typ === 'file' || !czyElementy(elementy)) return []
        return elementy.map((element) => {
          const grupa = Array.isArray(element) ? element : [element]
          return { plik: problem.file, linia: grupa[0]?.line ?? null, regula: `knip/${typ}`, opis: `${typ}: ${grupa.map((e) => e.name).join(', ')}` }
        })
      }),
  )
}

/**
 * @param {string} projekt
 * @param {{ bin: string }} narzedzie
 * @param {import('./diff.mjs').ZmianyFazy} zmiany
 * @returns {WynikBramki}
 */
export function bramkaKnip(projekt, narzedzie, zmiany) {
  const p = uruchom(narzedzie.bin, ['--reporter', 'json', '--no-progress'], { cwd: projekt, sufitSekund: SUFIT_SEKUND })
  /** @type {RaportKnip} */
  let raport
  try {
    raport = JSON.parse(p.stdout)
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return bladNarzedzia(p, 'knip')
  }
  const plikiFazy = new Set(zmiany.pliki)
  const wszystkie = problemy(raport)
  const trafienia = wszystkie.filter((t) => t.plik !== null && plikiFazy.has(t.plik))
  return { status: trafienia.length ? 'porazka' : 'ok', sekundy: p.sekundy, trafienia, zastane: wszystkie.length - trafienia.length }
}
