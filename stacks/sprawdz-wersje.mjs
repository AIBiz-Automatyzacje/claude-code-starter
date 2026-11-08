// Kontrola `.claude/.rdzen-version` w zbudowanym wariancie (plan szablonu mobile z rdzenia, IU-3.2): plik ma dokładnie oczekiwany
// SHA rdzenia, bez `-dirty`. CI i publikacja sprawdzają nim, że wariant odpowiada commitowi, z którego go zbudowano, zanim
// repo mobile dostanie commit `sync: rdzeń <sha>`.
//
// Uruchomienie: node stacks/sprawdz-wersje.mjs <katalog-wariantu> <oczekiwany-sha>

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const PLIK_WERSJI = '.claude/.rdzen-version'
const PELNY_SHA = /^[0-9a-f]{40}$/

/**
 * @param {string} katalog @param {string} oczekiwany
 * @returns {{ ok: true, wersja: string } | { ok: false, kod: 'brak-pliku' | 'zly-sha' | 'dirty' | 'inny-sha', komunikat: string }}
 */
export function sprawdzWersje(katalog, oczekiwany) {
  if (!PELNY_SHA.test(oczekiwany)) return { ok: false, kod: 'zly-sha', komunikat: `oczekiwany SHA nie jest pełnym SHA: ${oczekiwany}` }
  const plik = join(katalog, PLIK_WERSJI)
  if (!existsSync(plik)) return { ok: false, kod: 'brak-pliku', komunikat: `brak ${PLIK_WERSJI} w ${katalog}` }
  const wersja = readFileSync(plik, 'utf8').trim()
  if (wersja.endsWith('-dirty')) return { ok: false, kod: 'dirty', komunikat: `wariant zbudowany z niezacommitowanych zmian: ${wersja}` }
  if (wersja !== oczekiwany) return { ok: false, kod: 'inny-sha', komunikat: `wersja ${wersja}, oczekiwana ${oczekiwany}` }
  return { ok: true, wersja }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumenty = process.argv.slice(2)
  if (argumenty.length !== 2) {
    console.error('Użycie: node stacks/sprawdz-wersje.mjs <katalog-wariantu> <oczekiwany-sha>')
    process.exit(2)
  }
  const wynik = sprawdzWersje(argumenty[0], argumenty[1])
  if (!wynik.ok) {
    console.error(`${wynik.kod}: ${wynik.komunikat}`)
    process.exit(1)
  }
  console.log(`rdzeń ${wynik.wersja}`)
}
