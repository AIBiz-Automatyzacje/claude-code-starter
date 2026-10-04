#!/usr/bin/env node
// Wiedza projektu (PLAN-POPRAWY P10): CLI dla compoundu, refreshu, plannera i dossier.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   wiedza.mjs sprawdz <solution.md>...           pola wiedzy we frontmatterze — compound nie zostawia pliku bez nich
//   wiedza.mjs indeks [--zapisz]                  indeks docs/learned-patterns.md z solutions (bramka koszyka i rozmiaru)
//   wiedza.mjs wycinek --pliki <a,b,...> [--limit <zn>]   reguly dla plikow jednostki albo fazy
//   wiedza.mjs konwersja przygotuj                kandydaci z .claude/rules/learned-patterns.md (JSON do uzupelnienia klasy)
//   wiedza.mjs konwersja zastosuj --propozycje <plik.json> [--data RRRR-MM-DD]
//                                                 zapis pol do solutions, indeks, stary plik i odrzuty do docs/archiwum/
// Wynik: JSON na stdout. Kod wyjscia: 0 = ok, 1 = do poprawy (bledy pol, bramka indeksu, odrzuty), 2 = zle argumenty.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { czytajFrontmatter } from './frontmatter.mjs'
import { PLIK_INDEKSU, generujIndeks } from './indeks.mjs'
import { PLIK_LEARNED_PATTERNS, archiwizuj, kandydaci, zastosuj } from './konwersja.mjs'
import { walidujWpis } from './walidacja.mjs'
import { plikiRepo, wczytajWpisy } from './wpisy.mjs'
import { MAKS_WYCINEK_ZN, wycinek } from './wycinek.mjs'

const KOD_DO_POPRAWY = 1
const KOD_ZLYCH_ARGUMENTOW = 2
const USTAWIENIA = /** @type {const} */ ({
  projekt: { type: 'string' }, zapisz: { type: 'boolean' }, pliki: { type: 'string' }, limit: { type: 'string' },
  propozycje: { type: 'string' }, data: { type: 'string' },
})

/** @param {string} komunikat @returns {never} */
function zleArgumenty(komunikat) {
  process.stderr.write(`wiedza: ${komunikat}\nUzycie: wiedza.mjs sprawdz <plik>... | indeks [--zapisz] | wycinek --pliki <a,b> [--limit <zn>] | konwersja przygotuj | konwersja zastosuj --propozycje <plik> [--data RRRR-MM-DD] [--projekt <katalog>]\n`)
  process.exit(KOD_ZLYCH_ARGUMENTOW)
}

/** @param {unknown} wynik @param {boolean} ok @returns {never} */
function zakoncz(wynik, ok) {
  process.stdout.write(`${JSON.stringify(wynik)}\n`)
  process.exit(ok ? 0 : KOD_DO_POPRAWY)
}

/** @param {string} projekt @param {string[]} pliki */
function sprawdz(projekt, pliki) {
  if (!pliki.length) zleArgumenty('sprawdz wymaga sciezek plikow solution')
  const repo = plikiRepo(projekt)
  const wyniki = pliki.map((plik) => {
    if (!existsSync(join(projekt, plik))) return { plik, ok: false, bledy: ['plik nie istnieje'] }
    const pola = czytajFrontmatter(readFileSync(join(projekt, plik), 'utf8'))?.pola ?? {}
    return { plik, ...walidujWpis(pola, repo) }
  })
  zakoncz({ ok: wyniki.every((w) => w.ok), pliki: wyniki }, wyniki.every((w) => w.ok))
}

/**
 * @param {string} projekt
 * @param {boolean} zapisz
 * @returns {{ wynik: Record<string, unknown>, ok: boolean }}
 */
function indeks(projekt, zapisz) {
  const { wpisy, niepoprawne, bezPol } = wczytajWpisy(projekt, plikiRepo(projekt))
  const { tresc, ...reszta } = generujIndeks(wpisy)
  const zapisany = zapisz && !reszta.bledy.length
  if (zapisany) writeFileSync(join(projekt, PLIK_INDEKSU), tresc)
  return { wynik: { plik: PLIK_INDEKSU, zapisany, ...reszta, niepoprawne, bezPol: bezPol.length }, ok: !reszta.bledy.length && !niepoprawne.length }
}

/** @param {string} projekt @param {string | undefined} pliki @param {string | undefined} limit */
function wytnij(projekt, pliki, limit) {
  if (!pliki) zleArgumenty('wycinek wymaga --pliki <a,b,...>')
  if (limit !== undefined && !/^\d+$/.test(limit)) zleArgumenty('--limit musi byc liczba znakow')
  // Globy wpisow sprawdza compound i indeks; wycinek nie odrzuca reguly, ktorej katalog jeszcze nie istnieje.
  const { wpisy } = wczytajWpisy(projekt, null)
  zakoncz(wycinek(wpisy, pliki.split(',').map((p) => p.trim()).filter(Boolean), limit ? Number(limit) : MAKS_WYCINEK_ZN), true)
}

/** @param {string} projekt @param {string | undefined} etap @param {string | undefined} plikPropozycji @param {string | undefined} data */
function konwersja(projekt, etap, plikPropozycji, data) {
  const zrodlo = join(projekt, PLIK_LEARNED_PATTERNS)
  if (!existsSync(zrodlo)) zleArgumenty(`brak ${PLIK_LEARNED_PATTERNS} — nie ma czego konwertowac`)
  const tekst = readFileSync(zrodlo, 'utf8')
  if (etap === 'przygotuj') zakoncz(kandydaci(tekst, projekt, plikiRepo(projekt)), true)
  if (etap !== 'zastosuj') zleArgumenty('konwersja: etap przygotuj albo zastosuj')
  if (!plikPropozycji || !existsSync(plikPropozycji)) zleArgumenty('konwersja zastosuj wymaga --propozycje <istniejacy plik JSON>')
  if (data !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(data)) zleArgumenty('--data w formacie RRRR-MM-DD')
  /** @type {unknown} */
  let propozycje
  try {
    propozycje = JSON.parse(readFileSync(plikPropozycji, 'utf8'))
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return zleArgumenty(`--propozycje: niepoprawny JSON (${e.message})`)
  }
  if (!Array.isArray(propozycje)) zleArgumenty('--propozycje: oczekiwana tablica propozycji')
  const dzis = data ?? new Date().toLocaleDateString('sv-SE')
  const wynik = zastosuj(projekt, tekst, propozycje, plikiRepo(projekt), dzis)
  const ind = indeks(projekt, true)
  const archiwum = ind.wynik.zapisany ? archiwizuj(projekt, tekst, wynik.odrzuty, dzis) : null
  zakoncz({ ...wynik, indeks: ind.wynik, archiwum }, ind.ok && !wynik.odrzuty.length)
}

/** @type {{ values: Record<string, string | boolean | undefined>, positionals: string[] }} */
let a
try {
  a = parseArgs({ options: USTAWIENIA, allowPositionals: true })
} catch (e) {
  if (!(e instanceof TypeError)) throw e
  zleArgumenty(e.message)
}
const projekt = typeof a.values.projekt === 'string' ? a.values.projekt : process.cwd()
const tekstOpcji = (/** @type {string} */ k) => (typeof a.values[k] === 'string' ? String(a.values[k]) : undefined)
const [komenda, ...reszta] = a.positionals
if (komenda === 'sprawdz') sprawdz(projekt, reszta)
else if (komenda === 'indeks') {
  const w = indeks(projekt, a.values.zapisz === true)
  zakoncz(w.wynik, w.ok)
} else if (komenda === 'wycinek') wytnij(projekt, tekstOpcji('pliki'), tekstOpcji('limit'))
else if (komenda === 'konwersja') konwersja(projekt, reszta[0], tekstOpcji('propozycje'), tekstOpcji('data'))
else zleArgumenty(`nieznana komenda "${komenda ?? ''}"`)
