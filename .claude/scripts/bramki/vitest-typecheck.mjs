// Bramka `vitest --typecheck`: testy typow (*.test-d.ts, expectTypeOf) — lapia zmiane kontraktu typow, ktorej testy
// wartosci nie widza. Projekt bez testow typow = pominieta; nieudany test typu = porazka.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { git, wzgledna } from './diff.mjs'
import { definicjeTestow } from './testy-usuniete.mjs'
import { bladNarzedzia, uruchom } from './uruchom.mjs'

const SUFIT_SEKUND = 600
const TESTY_TYPOW = ['*.test-d.ts', '*.test-d.tsx']

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {{ title: string, status: string, failureMessages?: string[], location?: { line: number } }} AsercjaVitest */
/** @typedef {{ testResults: { name: string, status: string, message?: string, assertionResults: AsercjaVitest[] }[] }} RaportVitest */

/**
 * @param {string} projekt
 * @param {{ bin: string }} narzedzie
 * @returns {WynikBramki}
 */
export function bramkaVitestTypecheck(projekt, narzedzie) {
  const pliki = git(projekt, ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...TESTY_TYPOW]).split('\n').filter(Boolean)
  if (!pliki.length) return { status: 'pominieta', sekundy: null, trafienia: [], powod: 'projekt bez testow typow (*.test-d.ts)' }
  const p = uruchom(narzedzie.bin, ['run', '--typecheck.only', '--reporter=json'], { cwd: projekt, sufitSekund: SUFIT_SEKUND })
  /** @type {RaportVitest} */
  let raport
  try {
    raport = JSON.parse(p.stdout)
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return bladNarzedzia(p, 'vitest --typecheck')
  }
  const trafienia = raport.testResults.flatMap((plik) => {
    const sciezka = wzgledna(projekt, plik.name)
    // Tryb typecheck nie podaje `location` (vitest 4.1.11, takze z --includeTaskLocation): linia definicji testu po tytule.
    const definicje = definicjeTestow(readFileSync(join(projekt, sciezka), 'utf8'))
    const nieudane = plik.assertionResults.filter((a) => a.status === 'failed').map((a) => ({
      plik: sciezka,
      linia: a.location?.line ?? definicje.find((d) => d.nazwa === a.title)?.linia ?? null,
      regula: 'vitest-typecheck',
      opis: `${a.title}: ${(a.failureMessages ?? []).join(' ')}`,
    }))
    // Plik, ktory nie przeszedl kompilacji, nie ma asercji — sam komunikat pliku.
    if (!nieudane.length && plik.status === 'failed') return [{ plik: sciezka, linia: null, regula: 'vitest-typecheck', opis: plik.message ?? 'plik testow typow nie przeszedl' }]
    return nieudane
  })
  return { status: trafienia.length ? 'porazka' : 'ok', sekundy: p.sekundy, trafienia }
}
