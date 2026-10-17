// Czesci PR w planie technicznym (P20 S2): szacunek plikow do recenzji bota z tabel plikow IU i sekcja `## Części PR`.
// vibersi etap 3: plan mial tabele plikow 13 IU, a rozmiar PR (172 > 150, limit bota w planie Pro) wyszedl dopiero
// w archiwizacji po 6,4 h runu; podzial na dwa PR robiony recznie (cięcie po fazie 3). Ciecie tylko na granicy faz: koniec
// fazy to stan po review i fixie, ktory przeszedl typecheck i testy — srodek fazy nie byl sprawdzany jako calosc.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { doRecenzji, filtrySciezek, PROG_PLIKOW_PR } from '../pr/rozmiar.mjs'
import { bezOgonkow } from './pola-iu.mjs'

/**
 * @typedef {import('./plan-techniczny.mjs').Plan} Plan
 * @typedef {import('./plan-techniczny.mjs').Faza} Faza
 * @typedef {{ czesc: number, od: number, do: number }} CzescPlanu  fazy od–do wlacznie
 * @typedef {{ czesci: CzescPlanu[], problemy: string[] } | null} SekcjaCzesci  null = planu bez sekcji
 * @typedef {{ czesc: number, fazy: string, pliki: number }} RozmiarCzesci
 * @typedef {{ szacunek: number, prog: number, fazy: Record<number, number>, czesci: RozmiarCzesci[] | null,
 *   propozycja: RozmiarCzesci[] | null }} RozmiarPlanu
 */

const SEKCJA = /^##\s+Cz[eę][sś]ci PR\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m
const PLIK_KODU = /\.[cm]?[jt]sx?$/
const PLIK_TESTU = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|__tests__\/|\.d\.ts$)/
// Szacunek z planu bywa nizszy od diffu: plany vibersi etapow 2, 2-poprawki i 3 dawaly 135 / 25 / 141 wobec 124 / 26 / 172
// w diffie (iloraz 0,92–1,22: pliki wydzielone w fazie, testy wariantow, poprawki fixa). Powyzej tego progu plan bez
// sekcji dostaje uwage — archiwizacja i tak zmierzy czesci na commitach.
export const PROG_UWAGI_PR = 120

/** @param {string} komorka @returns {string} */
const bezZnacznikow = (komorka) => komorka.replace(/[`*]/g, '').trim()

/**
 * Tabela sekcji `## Części PR`: `| Część | Fazy | … |`, fazy jako `N` albo `N–M`. Plan bez sekcji = null.
 * @param {string} md
 * @returns {SekcjaCzesci}
 */
export function sekcjaCzesci(md) {
  // Nagłówek w bloku ``` (przyklad w planie) nie jest sekcja.
  const m = SEKCJA.exec(md.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1.*$/gm, ''))
  if (!m) return null
  /** @type {CzescPlanu[]} */
  const czesci = []
  /** @type {string[]} */
  const problemy = []
  for (const linia of m[1].split('\n')) {
    if (!/^\s*\|/.test(linia) || /^\s*\|\s*:?-{3,}/.test(linia)) continue
    const komorki = linia.trim().replace(/^\||\|$/g, '').split('|').map(bezZnacznikow)
    if (/^cz/i.test(komorki[0])) continue
    const nr = /^(\d+)$/.exec(komorki[0] ?? '')
    const fazy = /^(\d+)(?:\s*[–—-]\s*(\d+))?$/.exec(komorki[1] ?? '')
    if (!nr || !fazy) {
      problemy.push(`Części PR: wiersz „${linia.trim().slice(0, 60)}” — zapis „| N | od–do |” (numer części, fazy liczbami)`)
      continue
    }
    czesci.push({ czesc: Number(nr[1]), od: Number(fazy[1]), do: Number(fazy[2] ?? fazy[1]) })
  }
  if (!czesci.length && !problemy.length) problemy.push('Części PR: sekcja bez tabeli „| Część | Fazy |”')
  return { czesci, problemy }
}

/**
 * Pliki do recenzji jednej grupy faz: sciezki z tabel plikow IU po filtrach bota, plus test obok kazdego pliku kodu bez
 * testu w planie (coding-rules: testy obok zrodel; plan wymienia je nie zawsze).
 * @param {Faza[]} fazy
 * @param {string[]} filtry
 * @returns {number}
 */
function plikiFaz(fazy, filtry) {
  const wiersze = fazy.flatMap((f) => f.iu.flatMap((iu) => iu.pliki)).filter((p) => doRecenzji(p.sciezka, filtry))
  const pliki = new Set(wiersze.map((p) => p.sciezka))
  const lista = [...pliki]
  // Usuwany plik nie dostaje nowego testu.
  const usuwane = new Set(wiersze.filter((p) => /^usu/i.test(bezOgonkow(p.akcja).trim())).map((p) => p.sciezka))
  let testy = 0
  for (const s of lista) {
    if (!PLIK_KODU.test(s) || PLIK_TESTU.test(s) || usuwane.has(s)) continue
    const rdzen = s.replace(PLIK_KODU, '')
    const katalog = rdzen.slice(0, rdzen.lastIndexOf('/') + 1)
    const nazwa = rdzen.slice(katalog.length)
    const zTestem = (/** @type {string} */ p) => p.startsWith(`${rdzen}.test.`) || p.startsWith(`${rdzen}.spec.`)
      || p.startsWith(`${katalog}__tests__/${nazwa}.`)
    if (!lista.some(zTestem)) testy += 1
  }
  return pliki.size + testy
}

/** @param {number} od @param {number} doFazy @returns {string} */
const zakres = (od, doFazy) => (od === doFazy ? `${od}` : `${od}–${doFazy}`)

/**
 * Podzial faz na najmniej czesci, kazda < progu; z rownie licznych — ten z najmniejsza najwieksza czescia (vibersi etap 3:
 * fazy 1–3 / 4–6 = 93 / 101 zamiast 146 / 30 przy cieciu jak najpozniej — czesc tuz pod progiem nie ma zapasu na tury bota).
 * Faza, ktora sama ma >= prog, nie daje podzialu — null.
 * @param {number} n liczba faz
 * @param {(od: number, doFazy: number) => number} rozmiar pliki czesci z faz od..doFazy (indeksy od 0, wlacznie)
 * @returns {number[] | null} indeksy faz konczacych czesci poza ostatnia
 */
export function podzialFaz(n, rozmiar) {
  /** @type {Map<string, number>} */
  const pamiec = new Map()
  const r = (/** @type {number} */ od, /** @type {number} */ doFazy) => {
    const k = `${od}-${doFazy}`
    if (!pamiec.has(k)) pamiec.set(k, rozmiar(od, doFazy))
    return /** @type {number} */ (pamiec.get(k))
  }
  for (let czesci = 1; czesci <= n; czesci += 1) {
    /** @type {{ ciecia: number[], maks: number } | null} */
    let najlepszy = null
    /** @param {number} od @param {number} zostalo @param {number[]} ciecia @param {number} maks */
    const szukaj = (od, zostalo, ciecia, maks) => {
      if (zostalo === 1) {
        const m = Math.max(maks, r(od, n - 1))
        if (m < PROG_PLIKOW_PR && (!najlepszy || m < najlepszy.maks)) najlepszy = { ciecia, maks: m }
        return
      }
      for (let koniec = od; koniec <= n - zostalo; koniec += 1) {
        const m = Math.max(maks, r(od, koniec))
        if (m < PROG_PLIKOW_PR) szukaj(koniec + 1, zostalo - 1, [...ciecia, koniec], m)
      }
    }
    szukaj(0, czesci, [], 0)
    if (najlepszy) return /** @type {{ ciecia: number[] }} */ (najlepszy).ciecia
  }
  return null
}

/**
 * Propozycja czesci planu z `podzialFaz`; bez podzialu (faza >= prog) — kazda faza osobno, zeby bylo widac, ktora przekracza.
 * @param {Faza[]} fazy
 * @param {string[]} filtry
 * @returns {RozmiarCzesci[]}
 */
function propozycjaCzesci(fazy, filtry) {
  const ciecia = podzialFaz(fazy.length, (od, doFazy) => plikiFaz(fazy.slice(od, doFazy + 1), filtry)) ?? fazy.slice(0, -1).map((_, i) => i)
  const granice = [...ciecia, fazy.length - 1]
  return granice.map((koniec, i) => {
    const start = i ? granice[i - 1] + 1 : 0
    return { czesc: i + 1, fazy: zakres(fazy[start].numer, fazy[koniec].numer), pliki: plikiFaz(fazy.slice(start, koniec + 1), filtry) }
  })
}

/** @param {string} projekt @returns {string[]} filtry `reviews.path_filters` z .coderabbit.yaml projektu */
function filtryProjektu(projekt) {
  const plik = join(projekt, '.coderabbit.yaml')
  return existsSync(plik) ? filtrySciezek(readFileSync(plik, 'utf8')) : []
}

/**
 * @param {Plan} plan
 * @param {string} projekt
 * @returns {RozmiarPlanu}
 */
export function rozmiarPlanu(plan, projekt) {
  const filtry = filtryProjektu(projekt)
  const szacunek = plikiFaz(plan.fazy, filtry)
  const czesci = plan.czesci?.czesci.map((c) => ({
    czesc: c.czesc, fazy: zakres(c.od, c.do), pliki: plikiFaz(plan.fazy.filter((f) => f.numer >= c.od && f.numer <= c.do), filtry),
  })) ?? null
  return {
    szacunek, prog: PROG_PLIKOW_PR, fazy: Object.fromEntries(plan.fazy.map((f) => [f.numer, plikiFaz([f], filtry)])), czesci,
    propozycja: szacunek > PROG_PLIKOW_PR ? propozycjaCzesci(plan.fazy, filtry) : null,
  }
}

/** @param {RozmiarCzesci[]} czesci @returns {string} */
const opisCzesci = (czesci) => czesci.map((c) => `część ${c.czesc}: fazy ${c.fazy} (${c.pliki})`).join(', ')

/**
 * Bledy i uwagi sekcji `## Części PR`: plan powyzej progu bez sekcji, czesci nie pokrywajace faz po kolei, czesc >= prog.
 * @param {Plan} plan
 * @param {string} projekt
 * @returns {{ bledy: string[], uwagi: string[] }}
 */
export function sprawdzCzesci(plan, projekt) {
  const r = rozmiarPlanu(plan, projekt)
  /** @type {{ bledy: string[], uwagi: string[] }} */
  const w = { bledy: [], uwagi: [] }
  const zrodlo = 'tabele plików IU + test obok pliku kodu, po filtrach .coderabbit.yaml'
  // Faza > progu zawsze; faza = prog tylko, gdy plan i tak trzeba ciac (jeden PR do progu wlacznie).
  const fazaZaDuza = Object.entries(r.fazy).filter(([, n]) => n > PROG_PLIKOW_PR || (n === PROG_PLIKOW_PR && r.szacunek > PROG_PLIKOW_PR)).map(([f, n]) => `faza ${f} (~${n})`)
  if (fazaZaDuza.length) {
    // Ciecie jest tylko na granicy faz — sekcja nie pomoze, trzeba podzielic faze (albo zadanie).
    w.bledy.push(`${fazaZaDuza.join(', ')} sama ma >= ${PROG_PLIKOW_PR} plików do recenzji bota (${zrodlo}) — podziel fazę na mniejsze`)
    return w
  }
  if (!plan.czesci) {
    if (r.szacunek > PROG_PLIKOW_PR) {
      w.bledy.push(`plan ma ~${r.szacunek} plików do recenzji bota (${zrodlo}) > ${PROG_PLIKOW_PR} — sekcja „## Części PR” z cięciem na granicy faz`
        + ` (propozycja: ${opisCzesci(r.propozycja ?? [])})`)
    } else if (r.szacunek > PROG_UWAGI_PR) {
      w.uwagi.push(`plan ma ~${r.szacunek} plików do recenzji bota (${zrodlo}) — szacunek bywa o ~20% niższy od diffu; przy`
        + ` ${PROG_PLIKOW_PR}+ w archiwizacji PR pójdzie w częściach — rozważ sekcję „## Części PR”`)
    }
    return w
  }
  w.bledy.push(...plan.czesci.problemy)
  if (r.szacunek <= PROG_PLIKOW_PR) {
    w.uwagi.push(`sekcja „## Części PR” przy ~${r.szacunek} plikach do recenzji — archiwizacja wyśle jeden PR, gdy diff zmieści się w ${PROG_PLIKOW_PR}`)
  }
  const { czesci } = plan.czesci
  const ostatnia = plan.fazy.at(-1)?.numer ?? 0
  const poKolei = czesci.every((c, i) => c.czesc === i + 1 && c.od <= c.do && c.od === (i ? czesci[i - 1].do + 1 : 1))
  if (czesci.length && (!poKolei || czesci.at(-1)?.do !== ostatnia)) {
    w.bledy.push(`Części PR: części numerowane od 1 pokrywają fazy 1–${ostatnia} po kolei, bez luk i nakładania — cięcie tylko na granicy faz`)
  }
  for (const c of r.czesci ?? []) {
    if (c.pliki >= PROG_PLIKOW_PR) {
      w.bledy.push(`Części PR: część ${c.czesc} (fazy ${c.fazy}) ma ~${c.pliki} plików do recenzji — każda część < ${PROG_PLIKOW_PR}`
        + (r.propozycja ? ` (propozycja: ${opisCzesci(r.propozycja)})` : ''))
    }
  }
  return w
}
