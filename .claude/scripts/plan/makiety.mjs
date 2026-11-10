// Makiety jednostki (P21 B2): builder UI dostaje tylko ekrany swojej IU — SPEC tych ekranow (`<folder SPEC>/ekrany/<nazwa>.md`)
// i ich PNG — zamiast calego SPEC.md i wszystkich zrzutow. Vibersi etap 3: SPEC.md 47 KB czytany w calosci przez 8 builderow
// (ok. 13k tokenow × 60 tur × 8 ≈ 0,6 M) i 3–8 zrzutow makiet w kontekscie kazdego.
//
// Pole IU `**Makiety:**` wymienia nazwy z frontmattera `figma_screens`. Jednostka UI bez pola w planie z makietami dostaje
// wszystkie ekrany i caly SPEC (dawne zachowanie) z uwaga walidacji; SPEC bez katalogu `ekrany/` (plan sprzed P21) — caly SPEC.

import { existsSync } from 'node:fs'
import { join, posix } from 'node:path'

import { ekranyFigmy, poleTekstowe } from './plan-techniczny.mjs'
import { bezOgonkow } from './pola-iu.mjs'

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
 * Punkt 41 (aa-exam E3, IU-12: obecny mail z imieniem, makieta bez powitania, granica „bez tekstow spoza makiet”): jednostka,
 * ktora zmienia istniejacy plik wedlug makiety, wypisuje w polu „Znika z obecnej wersji”, czego makieta nie ma, z decyzja przy
 * kazdym elemencie. Bez pola decyzje produktowa podejmuje builder albo run staje na `blocked`.
 * @param {Jednostka} iu
 * @returns {boolean}
 */
export function przebudowujeBezDecyzji(iu) {
  const modyfikuje = iu.pliki.some((p) => bezOgonkow(p.akcja).toLowerCase() === 'modyfikuj')
  return Boolean(iu.makiety && iu.makiety.length) && modyfikuje && iu.znika === null
}

/**
 * Bledy i uwagi walidacji planu: nazwa spoza `figma_screens` = blad (builder dostalby nieistniejacy ekran), jednostka UI bez pola
 * Makiety w planie z makietami = uwaga (dostanie wszystkie ekrany), pole Makiety w planie bez makiet = blad, ekran bez jednostki
 * w planie z polem Makiety = uwaga (tester E2E porownuje ekrany z pol Makiety jednostek fazy).
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
    if (przebudowujeBezDecyzji(iu)) {
      w.uwagi.push(`${iu.id}: jednostka zmienia istniejący plik według makiety, a nie ma pola „Znika z obecnej wersji” — wypisz elementy obecnej wersji, których makieta nie ma, z decyzją przy każdym, albo „—”`)
    }
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
  // Punkt 30 (dashboard E2, 45 ekranow): tester E2E porownuje z makieta tylko ekrany z pol Makiety jednostek fazy, wiec ekran,
  // ktorego nie wymienia zadna jednostka, nie trafia do zadnego porownania ani do punktow wizualnych smoke'u. Plan bez zadnego pola
  // (sprzed P21) pomijamy: tester bierze tam wszystkie ekrany, a kazda jednostka UI ma juz uwage wyzej.
  const wymienione = new Set(jednostki.flatMap((iu) => iu.makiety ?? []))
  const bezJednostki = jednostki.some((iu) => iu.makiety !== null) ? [...ekrany].filter((n) => !wymienione.has(n)) : []
  if (bezJednostki.length) {
    w.uwagi.push(`figma_screens: ${bezJednostki.join(', ')} — żadna jednostka nie wymienia tych ekranów w polu Makiety, a tester E2E porównuje z makietą ekrany z pól Makiety jednostek fazy; dopisz je do jednostki, która je buduje, albo usuń z figma_screens`)
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
