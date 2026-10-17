// Makiety jednostki (P21 B2): builder UI dostaje tylko ekrany swojej IU — SPEC tych ekranow (`<folder SPEC>/ekrany/<nazwa>.md`)
// i ich PNG — zamiast calego SPEC.md i wszystkich zrzutow. Vibersi etap 3: SPEC.md 47 KB czytany w calosci przez 8 builderow
// (ok. 13k tokenow × 60 tur × 8 ≈ 0,6 M) i 3–8 zrzutow makiet w kontekscie kazdego.
//
// Pole IU `**Makiety:**` wymienia nazwy z frontmattera `figma_screens`. Jednostka UI bez pola w planie z makietami dostaje
// wszystkie ekrany i caly SPEC (dawne zachowanie) z uwaga walidacji; SPEC bez katalogu `ekrany/` (plan sprzed P21) — caly SPEC.

import { existsSync } from 'node:fs'
import { join, posix } from 'node:path'

import { ekranyFigmy, poleTekstowe } from './plan-techniczny.mjs'

/** @typedef {import('./plan-techniczny.mjs').Plan} Plan */
/** @typedef {import('./pola-iu.mjs').Jednostka} Jednostka */

const BUILDERZY_UI = ['feature-builder-ui', 'feature-builder-fullstack']
export const KATALOG_EKRANOW = 'ekrany'

/** @param {string} s @returns {string} sciezka bez wiodacego `./` */
const bezKropki = (s) => s.replace(/^\.\//, '')

/** @param {Plan} plan @returns {string | null} katalog SPEC ekranow (obok figma_spec), wzgledem projektu */
function katalogSpecEkranow(plan) {
  const spec = poleTekstowe(plan, 'figma_spec')
  return spec ? posix.join(posix.dirname(bezKropki(spec)), KATALOG_EKRANOW) : null
}

/** @param {Jednostka} iu @returns {boolean} */
function budujeUi(iu) {
  // Plan bez pola Delegate to (starszy): buildera dobiera planner po plikach, wiec blok liczymy jak dla UI.
  return !iu.delegate || BUILDERZY_UI.includes(iu.delegate.replace(/-figma$/, ''))
}

/**
 * Bledy i uwagi walidacji planu: nazwa spoza `figma_screens` = blad (builder dostalby nieistniejacy ekran), jednostka UI bez pola
 * Makiety w planie z makietami = uwaga (dostanie wszystkie ekrany), pole Makiety w planie bez makiet = blad.
 * @param {Plan} plan
 * @param {Jednostka[]} jednostki
 * @param {string} projekt katalog projektu (pliki SPEC ekranow)
 * @returns {{ bledy: string[], uwagi: string[] }}
 */
export function sprawdzMakiety(plan, jednostki, projekt) {
  const ekrany = new Set(ekranyFigmy(plan).map(([nazwa]) => nazwa))
  /** @type {{ bledy: string[], uwagi: string[] }} */
  const w = { bledy: [], uwagi: [] }
  // SPEC podzielony na ekrany (katalog `ekrany/`) to sam indeks bez pomiarow — ekran bez pliku zostawilby builder bez pomiarow.
  const katalog = katalogSpecEkranow(plan)
  if (katalog && existsSync(join(projekt, katalog))) {
    const brak = [...ekrany].filter((n) => !existsSync(join(projekt, katalog, `${n}.md`)))
    if (brak.length) w.bledy.push(`figma_spec: SPEC podzielony na ekrany, brak ${brak.map((n) => `${katalog}/${n}.md`).join(', ')} — pobierz ekran ponownie (kontekst designerski, krok E)`)
  }
  for (const iu of jednostki) {
    if (iu.makiety === null) {
      if (ekrany.size && budujeUi(iu)) {
        w.uwagi.push(`${iu.id}: jednostka UI bez pola Makiety — builder dostanie wszystkie ${ekrany.size} ekrany i cały SPEC; wpisz ekrany, które buduje, albo „—”`)
      }
      continue
    }
    if (iu.makiety.length && !ekrany.size) w.bledy.push(`${iu.id}: pole Makiety, a frontmatter nie ma figma_screens — usuń pole albo dodaj makiety`)
    const obce = iu.makiety.filter((n) => ekrany.size && !ekrany.has(n))
    if (obce.length) w.bledy.push(`${iu.id}: Makiety ${obce.join(', ')} — brak w figma_screens (dozwolone: ${[...ekrany].join(', ')})`)
  }
  return w
}

/**
 * Blok kontekstu designerskiego dla buildera jednostki — wkleja go planner. Pusty tekst = blok pominiety (builder danych,
 * plan bez DESIGN.md, SPEC i makiet).
 * @param {Plan} plan
 * @param {Jednostka} iu
 * @param {string} projekt katalog projektu (istnienie plikow SPEC ekranow)
 * @returns {{ tresc: string, ekrany: string[], specEkranow: string[] }}
 */
export function blokDesignerski(plan, iu, projekt) {
  const design = poleTekstowe(plan, 'design_md')
  const spec = poleTekstowe(plan, 'figma_spec')
  const wszystkie = ekranyFigmy(plan)
  if (!budujeUi(iu) || (!design && !spec && !wszystkie.length)) return { tresc: '', ekrany: [], specEkranow: [] }
  const makiety = iu.makiety
  const wybrane = makiety ? wszystkie.filter(([nazwa]) => makiety.includes(nazwa)) : wszystkie
  const katalogSpec = katalogSpecEkranow(plan)
  const specEkranow = katalogSpec ? wybrane.map(([nazwa]) => posix.join(katalogSpec, `${nazwa}.md`)) : []
  // Tryb ekranow: jednostka z polem Makiety, SPEC podzielony na ekrany (katalog `ekrany/`) i plik SPEC kazdego wybranego ekranu.
  // Inaczej — caly SPEC.md jak przed P21 (plan bez pola, SPEC sprzed podzialu, brakujacy plik ekranu).
  const poEkranach = makiety !== null && katalogSpec !== null && existsSync(join(projekt, katalogSpec))
    && specEkranow.every((s) => existsSync(join(projekt, s)))
  const linie = [
    '## Mandatory designerski kontekst (przeczytaj przed implementacja)',
    `- DESIGN.md (tokeny calego projektu): ${design ?? 'brak'}`,
    spec
      ? poEkranach
        ? `- SPEC.md (naglowek, tokeny i rozjazdy z Figmy; SPEC ekranow innych jednostek nie czytasz): ${bezKropki(spec)}`
        : `- SPEC.md (pomiary tej funkcji z Figmy): ${bezKropki(spec)}`
      : '- SPEC.md: brak — projektujesz w oparciu o DESIGN.md',
    ...(poEkranach && specEkranow.length ? ['- SPEC ekranow tej jednostki:', ...specEkranow.map((s) => `  - ${s}`)] : []),
    ...(wybrane.length ? ['- Screeny referencyjne (PNG) tej jednostki:', ...wybrane.map(([nazwa, s]) => `  - ${nazwa}: ${bezKropki(s)}`)] : []),
  ]
  return { tresc: linie.join('\n'), ekrany: wybrane.map(([nazwa]) => nazwa), specEkranow: poEkranach ? specEkranow : [] }
}
