// Walidacja pol wiedzy we frontmatterze solution (PLAN-POPRAWY P10; zabezpieczenia PANEL-WEJSCIE §2 pkt 4):
// klasa z zamknietego slownika, regula w 2 zdaniach, globy `paths` (skladnia + dopasowanie do plikow repo), waga,
// szczebel z powodem, data, zrodlo, licznik ucieczek. Compound odmawia zapisu, gdy wynik ma bledy.

import { posix } from 'node:path'

import { KLASY_WIEDZY } from './klasy.mjs'

export const POLA_WIEDZY = ['klasa', 'regula', 'paths', 'waga', 'szczebel', 'szczebel_powod', 'date', 'zrodlo', 'ucieczki']
// Pole opcjonalne: gdzie wdrozono bramke dla lekcji `kod`/`lint` (np. eslint.config.js no-restricted-syntax). Bez niego
// lekcja dziala jak regula (indeks, wycinek); z nim wypada z obu — pilnuje jej mechanizm.
export const POLE_BRAMKI = 'bramka'
export const WAGI = ['wysoka', 'srednia', 'niska']
export const SZCZEBLE = ['regula', 'kod', 'lint']
export const GLOB_ZAWSZE = '**'
const MAKS_ZDAN = 2
const MAKS_REGULA_ZN = 400
// Kropka po skrocie albo wewnatrz tokenu (a.ts, 1.5) nie konczy zdania.
const SKROTY = /\b(?:np|itp|itd|tzn|tj|m\.in|ok|wg|zob|por|e\.g|i\.e)\./gi
const KONIEC_ZDANIA = /[.!?…]+(?=\s|$)/g

/** @typedef {import('./frontmatter.mjs').Pola} Pola */

/** @param {string} tekst @returns {number} */
export function liczZdania(tekst) {
  const czysty = tekst.replace(/`[^`]*`/g, 'X').replace(SKROTY, 'X').trim()
  if (!czysty) return 0
  const konce = czysty.match(KONIEC_ZDANIA)?.length ?? 0
  return /[.!?…]$/.test(czysty) ? konce : konce + 1
}

/** @param {string[]} paths @returns {boolean} */
export function czyZawsze(paths) {
  return paths.includes(GLOB_ZAWSZE)
}

/** @param {string} glob @returns {string | null} powod odrzucenia albo null */
function bladSkladniGlobu(glob) {
  if (!glob.trim()) return 'pusty glob'
  if (glob.startsWith('/') || glob.includes('\\')) return `glob "${glob}" musi byc sciezka wzgledna z ukosnikami /`
  if (glob.split('/').some((s) => s === '..' || s === '.')) return `glob "${glob}" nie moze zawierac segmentu . ani ..`
  return null
}

/**
 * @param {unknown} paths
 * @param {string[] | null} plikiRepo sciezki plikow repo; null = tylko skladnia (np. pliki IU jeszcze nie istnieja)
 * @returns {string[]}
 */
function bledyPaths(paths, plikiRepo) {
  if (!Array.isArray(paths) || !paths.length) return ['paths: wymagana niepusta lista globow (wszedzie: "**")']
  return paths.flatMap((g) => {
    const skladnia = bladSkladniGlobu(String(g))
    if (skladnia) return [`paths: ${skladnia}`]
    if (plikiRepo && !plikiRepo.some((p) => posix.matchesGlob(p, g))) return [`paths: glob "${g}" nie pasuje do zadnego pliku repo`]
    return []
  })
}

/** @param {unknown} v @returns {string} */
function tekst(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/** @param {string} data @returns {boolean} */
function poprawnaData(data) {
  const d = new Date(`${data}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(d.getTime()) && d.toISOString().startsWith(data)
}

/** @param {Pola} pola @returns {string | null} */
function bladBramki(pola) {
  if (!(POLE_BRAMKI in pola)) return null
  if (!tekst(pola[POLE_BRAMKI])) return 'bramka: pusta — podaj, gdzie wdrozono bramke (plik i regula), albo usun pole'
  return ['kod', 'lint'].includes(tekst(pola.szczebel)) ? null : 'bramka: tylko przy szczeblu kod albo lint'
}

/**
 * @param {Pola} pola pola frontmattera solution
 * @param {string[] | null} plikiRepo
 * @returns {{ ok: boolean, bledy: string[] }}
 */
export function walidujWpis(pola, plikiRepo) {
  const regula = tekst(pola.regula)
  const zdania = liczZdania(regula)
  const bledy = [
    KLASY_WIEDZY.includes(tekst(pola.klasa)) ? null : `klasa: "${tekst(pola.klasa)}" spoza slownika klas defektow (.claude/scripts/wiedza/klasy.mjs)`,
    regula ? null : 'regula: brak (1-2 zdania)',
    regula && zdania > MAKS_ZDAN ? `regula: ${zdania} zdan, maksimum ${MAKS_ZDAN}` : null,
    regula.length > MAKS_REGULA_ZN ? `regula: ${regula.length} zn, maksimum ${MAKS_REGULA_ZN}` : null,
    ...bledyPaths(pola.paths, plikiRepo),
    WAGI.includes(tekst(pola.waga)) ? null : `waga: "${tekst(pola.waga)}" spoza ${WAGI.join('|')}`,
    SZCZEBLE.includes(tekst(pola.szczebel)) ? null : `szczebel: "${tekst(pola.szczebel)}" spoza ${SZCZEBLE.join('|')}`,
    tekst(pola.szczebel_powod) ? null : 'szczebel_powod: brak uzasadnienia szczebla',
    poprawnaData(tekst(pola.date)) ? null : `date: "${tekst(pola.date)}" nie jest data RRRR-MM-DD`,
    tekst(pola.zrodlo) ? null : 'zrodlo: brak (zadanie, PR albo commit)',
    /^\d+$/.test(tekst(pola.ucieczki)) ? null : `ucieczki: "${tekst(pola.ucieczki)}" nie jest liczba >= 0`,
    bladBramki(pola),
  ].filter((b) => b !== null)
  return { ok: !bledy.length, bledy }
}
