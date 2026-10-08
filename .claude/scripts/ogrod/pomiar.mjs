// Pomiar calego projektu: pliki JS/TS (sledzone i nowe nieignorowane), wystapienia kategorii, hotspoty i wystapienia
// w liniach dodanych przez zadanie (diff od merge-base z galezia glowna, z drzewem roboczym). Tylko odczyt.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { git, parsujDiffU0 } from '../bramki/diff.mjs'
import { GALEZIE_GLOWNE } from '../dossier/zmiany.mjs'
import { policz, wystapienia } from './kategorie.mjs'

const ROZSZERZENIA = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
// Kod wygenerowany, zaleznosci i maszyneria szablonu (`.claude/` przychodzi z sync-template, nie z zadan projektu).
const POMIJANE = /(^|\/)(node_modules|dist|build|coverage|\.next|\.turbo|\.vercel|\.output|\.svelte-kit|vendor)\/|^\.claude\/|\.d\.[cm]?ts$|\.min\.[cm]?js$/
// Plik wiekszy niz prog to prawie zawsze bundel albo dane (wygenerowane), nie kod pisany przez agentow.
const PROG_BAJTOW = 1024 * 1024
export const LIMIT_NOWYCH = 20
export const LIMIT_HOTSPOTOW = 5
// Wynik gita (diff calego zadania, lista plikow monorepo) nie moze wywrocic pomiaru limitem bufora.
const BUFOR_GITA = 64 * 1024 * 1024

/** @typedef {import('./kategorie.mjs').Kategoria} Kategoria */
/** @typedef {import('./kategorie.mjs').Wystapienie} Wystapienie */
/** @typedef {{ plik: string, razem: number } & Partial<Record<Kategoria, number>>} Hotspot */
/**
 * @typedef {object} Pomiar
 * @property {string} commit krotki hash HEAD ("" w repo bez commitow)
 * @property {number} plikow
 * @property {Record<Kategoria, number>} liczby
 * @property {string | null} baza merge-base z galezia glowna (null: brak galezi glownej)
 * @property {Record<Kategoria, number>} noweLiczby wystapienia w liniach dodanych przez zadanie
 * @property {Wystapienie[]} nowe pierwsze LIMIT_NOWYCH wystapien w liniach dodanych
 * @property {Hotspot[]} hotspoty
 */

/** @param {string} sciezka */
export const czyMierzony = (sciezka) => ROZSZERZENIA.test(sciezka) && !POMIJANE.test(sciezka)

/**
 * @param {string} projekt
 * @returns {string[]}
 */
export function plikiProjektu(projekt) {
  const lista = git(projekt, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean)
  return [...new Set(lista)].filter(czyMierzony).filter((p) => {
    const pelna = join(projekt, p)
    return existsSync(pelna) && statSync(pelna).isFile() && statSync(pelna).size <= PROG_BAJTOW
  }).sort()
}

/**
 * Wynik gita albo null przy niezerowym kodzie wyjscia (repo bez commitow, galaz bez wspolnego przodka).
 * @param {string} repo
 * @param {string[]} argumenty
 * @returns {string | null}
 */
function gitLubNull(repo, argumenty) {
  const wynik = spawnSync('git', ['-C', repo, ...argumenty], { encoding: 'utf8', maxBuffer: BUFOR_GITA })
  return wynik.status === 0 ? wynik.stdout.trim() : null
}

/**
 * Merge-base HEAD z pierwsza istniejaca galezia glowna (origin/main, main, origin/master, master — jak baza zastepcza dossier);
 * null, gdy zadnej nie ma albo HEAD nie ma z nia wspolnego przodka.
 * @param {string} projekt
 * @returns {string | null}
 */
export function bazaZadania(projekt) {
  for (const galaz of GALEZIE_GLOWNE) {
    if (gitLubNull(projekt, ['rev-parse', '--verify', '--quiet', `${galaz}^{commit}`]) === null) continue
    return gitLubNull(projekt, ['merge-base', 'HEAD', galaz])
  }
  return null
}

/**
 * Linie dodane przez zadanie: diff od bazy do drzewa roboczego (commity zadania i zmiany niezacommitowane) plus cale
 * pliki nieśledzone z listy mierzonych. Nie przez `zmianyFazy` z bramek: ta czyta kazdy wpis `ls-files --others`,
 * a nieśledzone dowiazanie do katalogu (np. `.agent/skills/<skill>`) konczy sie tam EISDIR.
 * @param {string} projekt
 * @param {string} baza
 * @param {string[]} pliki mierzone pliki projektu
 * @returns {Map<string, Set<number>>}
 */
function linieDodane(projekt, baza, pliki) {
  // -M: przeniesiony plik nie liczy swoich starych wystapien jako nowe; quotePath=false: sciezka spoza ASCII bez cytowania gita.
  const diff = git(projekt, ['-c', 'core.quotePath=false', 'diff', '-U0', '--no-color', '-M', '--no-ext-diff', '--relative', baza, '--'])
  const wynik = new Map(Object.entries(parsujDiffU0(diff)).map(([plik, linie]) => [plik, new Set(linie)]))
  const niesledzone = new Set(git(projekt, ['ls-files', '-z', '--others', '--exclude-standard']).split('\0'))
  for (const plik of pliki.filter((p) => niesledzone.has(p))) {
    const ile = readFileSync(join(projekt, plik), 'utf8').split('\n').length
    wynik.set(plik, new Set(Array.from({ length: ile }, (_, i) => i + 1)))
  }
  return wynik
}

/**
 * @param {Wystapienie[]} lista
 * @returns {Hotspot[]}
 */
export function hotspoty(lista) {
  /** @type {Map<string, Hotspot>} */
  const mapa = new Map()
  for (const w of lista) {
    const h = mapa.get(w.plik) ?? { plik: w.plik, razem: 0 }
    h.razem++
    h[w.kategoria] = (h[w.kategoria] ?? 0) + 1
    mapa.set(w.plik, h)
  }
  return [...mapa.values()].sort((a, b) => b.razem - a.razem || a.plik.localeCompare(b.plik)).slice(0, LIMIT_HOTSPOTOW)
}

/**
 * @param {string} projekt katalog projektu (korzen repo git)
 * @param {{ baza?: string | null }} [opcje] baza diffu zadania; domyslnie merge-base z galezia glowna
 * @returns {Pomiar}
 */
export function zmierzProjekt(projekt, opcje = {}) {
  const pliki = plikiProjektu(projekt)
  const wszystkie = pliki.flatMap((p) => wystapienia(readFileSync(join(projekt, p), 'utf8'), p))
  const baza = opcje.baza === undefined ? bazaZadania(projekt) : opcje.baza
  const dodane = baza ? linieDodane(projekt, baza, pliki) : new Map()
  const nowe = wszystkie.filter((w) => dodane.get(w.plik)?.has(w.linia))
  return {
    commit: gitLubNull(projekt, ['rev-parse', '--short', 'HEAD']) ?? '',
    plikow: pliki.length,
    liczby: policz(wszystkie),
    baza,
    noweLiczby: policz(nowe),
    nowe: nowe.slice(0, LIMIT_NOWYCH),
    hotspoty: hotspoty(wszystkie),
  }
}
