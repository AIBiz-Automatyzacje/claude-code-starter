// Ucieczki do bota (E5-20): skad pochodzi kazdy watek recenzji bota — review fazy juz go mial (P3/known-issues albo P1/P2,
// ktory wrocil), kod fixa, tura PR, smoke po archiwum albo nowy kod buildu. Port skryptu analizy
// docs/reviews/2026-09-19-analiza-pipeline/skrypty/ucieczki_bota.py; dopasowanie do findingu po pliku i osi
// (os w linii known-issues od P27 S1 poz. 4), nie tylko po odleglosci linii.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { blameLinii, czasArchiwum } from './git.mjs'

// Kolejnosc kubelkow w raporcie: najpierw to, co pipeline juz widzial, na koncu nieustalone.
export const KUBELKI = ['review-P3', 'review-P1P2', 'kod-fixa', 'kod-tury-PR', 'kod-smoke', 'nowy', 'sprzed-zadania', 'nieustalone']
// Linie dryfuja miedzy review fazy a PR (analiza etapu 5: przesuniecia do 8 linii przy tej samej poprawce).
const OKNO_LINII = 10
const NAGLOWEK_REVIEW = /^### (P[123]) · \w+ · `([^`:]+):(\d+)`/
const WPIS_KNOWN_ISSUES = /^- \S+ \[(P[123])(?:\/([\w-]+))?\] ([^\s:]+):(\d+)/
// Review zapisuje os nazwa reviewera (`_zrodlo`), bot — os ze slownika OSIE_UWAG dev-pr-wf.js (spec, test).
const OS_BOTA = new Map([['spec-compliance', 'spec'], ['test-coverage', 'test']])
// Pierwsze miejsce `plik:linia` albo `plik:od-do` w polu watku; reszta (prefiks `(recenzja ogolna)`, dopiski w nawiasie) to opis.
const MIEJSCE_WATKU = /(?:^|\s)([^\s:()]+):(\d+)(?:-\d+)?(?=$|[\s,;)])/

/**
 * @typedef {{ zrodlo: string, waga: string, os: string | null, plik: string, linia: number }} Finding
 * @typedef {{ temat: string, czas: number }} Blame temat i czas (s) commitu, ktory ostatni zmienil linie watku
 * @typedef {{ kubelek: string, pochodzenie: string, znane: string | null }} Ucieczka
 */

/**
 * Findingi z raportow review fazy (naglowek `### P<n> · <TYP> · \`plik:linia\``, bez osi) i known-issues (`[P3]` albo `[P3/<os>]`).
 * @param {Array<{ nazwa: string, tresc: string }>} raporty
 * @returns {Finding[]}
 */
export function findingiRaportow(raporty) {
  return raporty.flatMap(({ nazwa, tresc }) => tresc.split('\n').flatMap(/** @returns {Finding[]} */ (wiersz) => {
    const r = wiersz.match(NAGLOWEK_REVIEW)
    if (r) return [{ zrodlo: nazwa, waga: r[1], os: null, plik: r[2], linia: Number(r[3]) }]
    const k = wiersz.match(WPIS_KNOWN_ISSUES)
    return k ? [{ zrodlo: nazwa, waga: k[1], os: k[2] ? OS_BOTA.get(k[2]) ?? k[2] : null, plik: k[3], linia: Number(k[4]) }] : []
  }))
}

/**
 * Plik i linia watku z pola `plik` etapu zbierz dev-pr; zakres daje pierwsza linie (blame jednej linii wystarczy, bo bot
 * komentuje blok jednej zmiany). `plik:?`, sam plik i `(recenzja ogolna)` bez miejsca — null.
 * @param {string} pole @returns {{ plik: string, linia: number } | null}
 */
export function miejsceWatku(pole) {
  const m = pole.match(MIEJSCE_WATKU)
  return m ? { plik: m[1], linia: Number(m[2]) } : null
}

/** @param {string} tekst */
const doRegex = (tekst) => tekst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * @param {Blame} blame
 * @param {string} zadanie
 * @param {number | null} archiwum czas commitu archiwum zadania (s); null = brak — nie ma wtedy kodu smoke'u
 * @returns {string}
 */
export function pochodzenieKodu(blame, zadanie, archiwum) {
  const z = doRegex(zadanie)
  if (new RegExp(`^fix\\(${z}\\): (poprawki po review fazy|kontrola diffu naprawczego)`).test(blame.temat)) return 'kod-fixa'
  if (/^fix\(pr\): tura/.test(blame.temat)) return 'kod-tury-PR'
  if (new RegExp(`^feat\\(${z}\\)`).test(blame.temat)) return 'kod-buildu'
  if (archiwum !== null && blame.czas > archiwum) return 'kod-smoke'
  // Nazwa zadania jako slowo: `etap-5` nie lapie `etap-5b`.
  if (new RegExp(`(^|[^\\w-])${z}([^\\w-]|$)`).test(blame.temat)) return 'kod-buildu'
  return 'sprzed-zadania'
}

/**
 * Finding review, ktory mogl dotyczyc linii watku: ten sam plik i (w oknie linii przy osi nieznanej albo tej samej)
 * albo (ta sama znana os w dowolnej linii pliku — linia przesunieta po zmianach). Najblizszy wygrywa.
 * @param {{ plik: string, linia: number, os: string | null }} watek @param {Finding[]} findingi
 */
function dopasujFinding(watek, findingi) {
  const pasujace = findingi.filter((f) => f.plik === watek.plik && (f.os === null || watek.os === null
    ? Math.abs(f.linia - watek.linia) <= OKNO_LINII
    : f.os === watek.os))
  return pasujace.sort((a, b) => Math.abs(a.linia - watek.linia) - Math.abs(b.linia - watek.linia))[0] ?? null
}

/**
 * @param {{ plik: string, os: string | null }} watek plik jako `sciezka:linia` albo `sciezka:od-do` z dopiskami (z etapu zbierz dev-pr)
 * @param {Blame | null} blame null = linia bez blame (recenzja ogolna, plik usuniety, commit nieosiagalny)
 * @param {{ findingi: Finding[], zadanie: string, czasArchiwum: number | null }} kontekst
 * @returns {Ucieczka}
 */
export function kubelekWatku(watek, blame, kontekst) {
  const m = miejsceWatku(watek.plik)
  if (!m || !blame) return { kubelek: 'nieustalone', pochodzenie: 'nieustalone', znane: null }
  const pochodzenie = pochodzenieKodu(blame, kontekst.zadanie, kontekst.czasArchiwum)
  // Finding review dotyczy linii tylko wtedy, gdy kod istnial w czasie review — linia z fixa, tury PR albo smoke'u to nowy kod.
  const znane = pochodzenie === 'kod-buildu' || pochodzenie === 'sprzed-zadania'
    ? dopasujFinding({ ...m, os: watek.os }, kontekst.findingi)
    : null
  const opis = znane ? `${znane.zrodlo} ${znane.waga}${znane.os ? `/${znane.os}` : ''} ${znane.plik}:${znane.linia}` : null
  if (znane) return { kubelek: znane.waga === 'P3' || znane.zrodlo === 'known-issues.md' ? 'review-P3' : 'review-P1P2', pochodzenie, znane: opis }
  return { kubelek: pochodzenie === 'kod-buildu' ? 'nowy' : pochodzenie, pochodzenie, znane: null }
}

/**
 * @template {{ plik: string | null, os: string | null }} K
 * @param {K[]} klasy watki z run.pr.klasy
 * @param {{ zadanie: string, czasArchiwum: number | null, findingi: Finding[], blame: (plik: string, linia: number) => Blame | null }} kontekst
 * @returns {Array<K & { ucieczka: Ucieczka }>}
 */
export function oznaczUcieczki(klasy, kontekst) {
  return klasy.map((k) => {
    const m = miejsceWatku(k.plik ?? '')
    const blame = m ? kontekst.blame(m.plik, m.linia) : null
    return { ...k, ucieczka: kubelekWatku({ plik: k.plik ?? '', os: k.os }, blame, kontekst) }
  })
}

/**
 * Raporty review fazy i known-issues zadania z drzewa projektu (archiwum albo docs/active).
 * @param {string} repo @param {string} zadanie @returns {Array<{ nazwa: string, tresc: string }>}
 */
function raportyZadania(repo, zadanie) {
  return [join(repo, 'docs', 'completed', zadanie), join(repo, 'docs', 'active', zadanie)].filter((k) => existsSync(k))
    .flatMap((k) => readdirSync(k).filter((n) => /^review-faza-\d+\.md$/.test(n) || n === 'known-issues.md').sort()
      .map((nazwa) => ({ nazwa, tresc: readFileSync(join(k, nazwa), 'utf8') })))
}

/**
 * Ucieczki watkow etapu zbierz dev-pr: blame linii na czubku PR z chwili zbierania (kod, ktory bot skomentowal).
 * @template {{ plik: string | null, os: string | null }} K
 * @param {{ repo: string | null, zadanie: string | null, head: string | null }} pr
 * @param {K[]} klasy
 * @returns {Array<K & { ucieczka: Ucieczka | null }>}
 */
export function ucieczkiPr(pr, klasy) {
  const { repo, zadanie, head } = pr
  if (!repo || !zadanie || !head) return klasy.map((k) => ({ ...k, ucieczka: null }))
  return oznaczUcieczki(klasy, {
    zadanie,
    czasArchiwum: czasArchiwum(repo, head, zadanie),
    findingi: findingiRaportow(raportyZadania(repo, zadanie)),
    blame: (plik, linia) => blameLinii(repo, head, plik, linia),
  })
}
