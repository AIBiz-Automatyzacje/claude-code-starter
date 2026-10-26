// Indeks wiedzy projektu docs/learned-patterns.md (PLAN-POPRAWY P10, poziom 1): generowany z frontmatteru solutions,
// jeden wiersz na regule (klasa | regula | wzorce plikow | waga | link). Do indeksu szczebel `regula` oraz `kod`/`lint`
// bez pola `bramka` — do wdrozenia bramki lekcja dziala jak regula. Dedup po klasie i tresci reguly, koszyk „zawsze” z twardym limitem, bramka rozmiaru:
// limit dotyczy indeksu, nie wiedzy — po przekroczeniu refresh scala albo archiwizuje solutions.

import { czyZawsze } from './walidacja.mjs'
import { czyObowiazuje, pole, porownajWpisy, sciezkiWpisu } from './wpisy.mjs'

export const MAKS_ZAWSZE = 5
export const MAKS_INDEKS_ZN = 40000
export const PLIK_INDEKSU = 'docs/learned-patterns.md'
// E5-15(d)(e) (vibersi etap 5): 4 reguly `sciezka-bledu` osobno zajmowaly limit wycinka, a `seed-e2e` uciekal botowi
// w czterech turach. Indeks podaje refreshowi klasy do scalenia i klasy, ktorym nalezy sie bramka mechaniczna.
const MIN_REGUL_DO_SCALENIA = 3
const MIN_UCIECZEK_DO_BRAMKI = 3

/** @typedef {import('./wpisy.mjs').Wpis} Wpis */

/** @param {string} regula @returns {string} */
function kluczReguly(regula) {
  return regula.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** @param {string} tekst @returns {string} */
function komorka(tekst) {
  return tekst.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|')
}

/**
 * @param {Wpis[]} wpisy
 * @returns {{ unikalne: Wpis[], duplikaty: { plik: string, duplikatZ: string }[] }}
 */
export function bezDuplikatow(wpisy) {
  /** @type {Map<string, Wpis>} */
  const wgKlucza = new Map()
  const duplikaty = []
  const odNajnowszego = [...wpisy].sort((a, b) => pole(b, 'date').localeCompare(pole(a, 'date')))
  for (const w of odNajnowszego) {
    const klucz = `${pole(w, 'klasa')}|${kluczReguly(pole(w, 'regula'))}`
    const zachowany = wgKlucza.get(klucz)
    if (zachowany) duplikaty.push({ plik: w.plik, duplikatZ: zachowany.plik })
    else wgKlucza.set(klucz, w)
  }
  return { unikalne: [...wgKlucza.values()], duplikaty }
}

/**
 * @param {Wpis[]} unikalne obowiazujace wpisy po dedupie (duplikat nie liczy sie podwojnie — nowszy niesie licznik starszego)
 * @returns {{ doScalenia: { klasa: string, pliki: string[] }[], doBramki: { klasa: string, ucieczki: number }[] }}
 */
function klasyDoPrzegladu(unikalne) {
  /** @type {Map<string, Wpis[]>} */
  const wgKlasy = new Map()
  for (const w of unikalne) wgKlasy.set(pole(w, 'klasa'), [...(wgKlasy.get(pole(w, 'klasa')) ?? []), w])
  const klasy = [...wgKlasy.entries()].sort(([a], [b]) => a.localeCompare(b))
  const doScalenia = klasy.filter(([, ws]) => ws.length >= MIN_REGUL_DO_SCALENIA)
    .map(([klasa, ws]) => ({ klasa, pliki: ws.map((w) => w.plik).sort() }))
  const doBramki = klasy.map(([klasa, ws]) => ({ klasa, ucieczki: ws.reduce((s, w) => s + Number(pole(w, 'ucieczki')), 0) }))
    .filter((k) => k.ucieczki >= MIN_UCIECZEK_DO_BRAMKI)
    .sort((a, b) => b.ucieczki - a.ucieczki || a.klasa.localeCompare(b.klasa))
  return { doScalenia, doBramki }
}

/** @param {Wpis} w @returns {string} */
function wiersz(w) {
  const wzorce = sciezkiWpisu(w).map((g) => `\`${g}\``).join(', ')
  const link = w.plik.replace(/^docs\//, '')
  return `| ${pole(w, 'klasa')} | ${komorka(pole(w, 'regula'))} | ${wzorce} | ${pole(w, 'waga')} | [solution](${link}) |`
}

/**
 * @param {Wpis[]} wpisy zwalidowane wpisy solutions
 * @returns {{ tresc: string, zn: number, wpisy: number, zawsze: number, duplikaty: { plik: string, duplikatZ: string }[], bramki: { propozycje: number, wdrozone: number },
 *   doScalenia: { klasa: string, pliki: string[] }[], doBramki: { klasa: string, ucieczki: number }[], bledy: string[] }}
 */
export function generujIndeks(wpisy) {
  const { unikalne, duplikaty } = bezDuplikatow(wpisy.filter(czyObowiazuje))
  const posortowane = unikalne.sort(porownajWpisy)
  const zawsze = posortowane.filter((w) => czyZawsze(sciezkiWpisu(w)))
  const tresc = [
    '# Wiedza projektu — indeks',
    '',
    'Generowany z frontmatteru docs/solutions/ (`node .claude/scripts/wiedza/wiedza.mjs indeks --zapisz`) — nie edytuj recznie.',
    'Wzorce `**` obowiazuja kazdy plik. Pelny opis problemu: link do solution.',
    `<!-- wpisy: ${posortowane.length}, zawsze: ${zawsze.length} -->`,
    '',
    '| klasa | regula | wzorce plikow | waga | zrodlo |',
    '|---|---|---|---|---|',
    ...posortowane.map(wiersz),
    '',
  ].join('\n')
  const bledy = [
    zawsze.length > MAKS_ZAWSZE
      ? `koszyk "zawsze": ${zawsze.length} wpisow, limit ${MAKS_ZAWSZE} — zawez paths w: ${zawsze.map((w) => w.plik).join(', ')}`
      : null,
    tresc.length > MAKS_INDEKS_ZN ? `indeks: ${tresc.length} zn, limit ${MAKS_INDEKS_ZN} — scal albo zarchiwizuj solutions (dev-compound-refresh)` : null,
  ].filter((b) => b !== null)
  // Metryka wdrozen bramek (6a pkt 60 g3b): lekcje kod/lint z polem `bramka` wsrod wszystkich lekcji kod/lint.
  const propozycje = wpisy.filter((w) => pole(w, 'szczebel') !== 'regula')
  const bramki = { propozycje: propozycje.length, wdrozone: propozycje.filter((w) => !czyObowiazuje(w)).length }
  return { tresc, zn: tresc.length, wpisy: posortowane.length, zawsze: zawsze.length, duplikaty, bramki, ...klasyDoPrzegladu(posortowane), bledy }
}
