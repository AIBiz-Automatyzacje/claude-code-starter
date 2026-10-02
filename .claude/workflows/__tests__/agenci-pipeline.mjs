// Odczyt plikow agentow i wywolan agent() w workflowach — wspolne dla klasy-rol.test.mjs (PLAN-POPRAWY P3).
// Plik nie ma testow; funkcje biora katalog glowny, zeby te same sprawdzenia dzialaly na repo i na podlozonym drzewie.
//
// Wywolania czytamy statycznie: opcje kazdego agent() sa w jednej linii `{ schema: X, ..., label: ... }` (tak pisze je
// kazdy workflow). Liczba wywolan `agent(` musi rownac sie liczbie takich linii — wywolanie z opcjami w innym ksztalcie
// nie zniknie po cichu ze sprawdzenia, tylko zostanie zgloszone.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export const AGENCI = '.claude/agents'
export const WORKFLOWY = '.claude/workflows'

/**
 * Pola frontmattera jako mapa klucz → surowa wartosc (jedna linia).
 * @param {string} tekst
 * @returns {Map<string, string>}
 */
function frontmatter(tekst) {
  const blok = tekst.split(/^---$/m)[1] ?? ''
  return new Map(blok.split('\n')
    .map((linia) => linia.match(/^([\w-]+):\s*(.*)$/))
    .filter((m) => m !== null)
    .map((m) => [m[1] ?? '', (m[2] ?? '').trim()]))
}

/**
 * @param {string} korzen
 * @returns {Map<string, Map<string, string>>}  nazwa agenta → frontmatter
 */
export function agenci(korzen) {
  const katalog = join(korzen, AGENCI)
  if (!existsSync(katalog)) return new Map()
  return new Map(readdirSync(katalog)
    .filter((p) => p.endsWith('.md'))
    .map((p) => [p.slice(0, -'.md'.length), frontmatter(readFileSync(join(katalog, p), 'utf8'))]))
}

/**
 * @param {Map<string, string> | undefined} fm
 * @returns {string[]}  narzedzia z `tools:` (lista po przecinku)
 */
export function narzedzia(fm) {
  return (fm?.get('tools') ?? '').split(',').map((n) => n.trim()).filter(Boolean)
}

/**
 * @param {string} tekst
 * @returns {string}  tresc pliku agenta po frontmatterze
 */
export function tresc(tekst) {
  return tekst.split(/^---$/m).slice(2).join('---')
}

/**
 * Uruchamia sprawdzenie na drzewie plikow w katalogu tymczasowym.
 * @param {Record<string, string>} drzewo  sciezka wzgledna → tresc
 * @param {(korzen: string) => string[]} sprawdzenie
 * @returns {string[]}
 */
export function naPodlozonym(drzewo, sprawdzenie) {
  const korzen = mkdtempSync(join(tmpdir(), 'klasy-rol-'))
  try {
    for (const [sciezka, zawartosc] of Object.entries(drzewo)) {
      mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
      writeFileSync(join(korzen, sciezka), zawartosc)
    }
    return sprawdzenie(korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

/**
 * Wywolanie agent() odczytane z linii opcji.
 * @typedef {object} Wywolanie
 * @property {string} plik            nazwa pliku workflowu
 * @property {number} linia           numer linii opcji (od 1)
 * @property {string} etykieta        label z kazdym `${...}` zamienionym na `*`
 * @property {string | null} agentType      stala z opcji (`agentType: 'x'`)
 * @property {string | null} agentTypeZPola  obiekt pola dla `agentType: r.agentType` → 'r'
 * @property {string | null | undefined} effort  efort po rozwiazaniu `tiery.X`; null = bez efortu; undefined = nieznany tier
 * @property {boolean} maModel        opcje ustawiaja `model:`
 */

/**
 * @param {string} zrodlo
 * @returns {Record<string, string | null>}  TIERY_DOMYSLNE workflowu (pusty obiekt, gdy brak)
 */
function tieryDomyslne(zrodlo) {
  const blok = zrodlo.match(/const TIERY_DOMYSLNE = \{([^}]*)\}/)?.[1] ?? ''
  return Object.fromEntries([...blok.matchAll(/(\w+): (?:'(\w+)'|null)/g)].map((m) => [m[1] ?? '', m[2] ?? null]))
}

/**
 * @param {string} linia
 * @param {Record<string, string | null>} tiery
 * @returns {string | null | undefined}
 */
function effortLinii(linia, tiery) {
  const literal = linia.match(/effort: '(\w+)'/)?.[1]
  if (literal) return literal
  const tier = linia.match(/\}, tiery\.(\w+)\)/)?.[1]
  if (!tier) return null
  return tier in tiery ? tiery[tier] : undefined
}

/**
 * @param {string} korzen
 * @returns {{ wywolania: Wywolanie[], niezgodnosci: string[] }}  niezgodnosci = pliki, w ktorych liczba `agent(`
 *   rozni sie od liczby linii opcji
 */
export function wywolaniaAgentow(korzen) {
  const katalog = join(korzen, WORKFLOWY)
  /** @type {Wywolanie[]} */
  const wywolania = []
  /** @type {string[]} */
  const niezgodnosci = []
  for (const plik of readdirSync(katalog).filter((p) => p.endsWith('.js'))) {
    const zrodlo = readFileSync(join(katalog, plik), 'utf8')
    const tiery = tieryDomyslne(zrodlo)
    const linie = zrodlo.split('\n')
    const kod = linie.filter((l) => !l.trim().startsWith('//'))
    const liczbaWywolan = kod.reduce((n, l) => n + (l.match(/\bagent\(/g)?.length ?? 0), 0)
    const opcje = linie.map((l, i) => ({ l, i })).filter(({ l }) => /\{ schema: \w+,/.test(l) && /label: /.test(l))
    if (opcje.length !== liczbaWywolan) niezgodnosci.push(`${plik}: ${liczbaWywolan} wywolan agent(), ${opcje.length} linii opcji`)
    for (const { l, i } of opcje) {
      const label = l.match(/label: (['`])(.*?)\1/)?.[2] ?? ''
      wywolania.push({
        plik,
        linia: i + 1,
        etykieta: label.replace(/\$\{[^}]*\}/g, '*'),
        agentType: l.match(/agentType: '([\w-]+)'/)?.[1] ?? null,
        agentTypeZPola: l.match(/agentType: (\w+)\.agentType/)?.[1] ?? null,
        effort: effortLinii(l, tiery),
        maModel: /\bmodel:/.test(l),
      })
    }
  }
  return { wywolania, niezgodnosci }
}

/**
 * Typy agentow, ktore moze przyjac pole dynamiczne: `r.agentType` → REVIEWERZY w review-wf,
 * `iu.agentType` → enum `agentType` schematu IU_PLAN w execute-wf.
 * @param {string} korzen
 * @returns {Record<string, string[]>}
 */
export function typyDynamiczne(korzen) {
  const czytaj = (/** @type {string} */ plik) => {
    const sciezka = join(korzen, WORKFLOWY, plik)
    return existsSync(sciezka) ? readFileSync(sciezka, 'utf8') : ''
  }
  const reviewerzy = [...czytaj('dev-docs-review-wf.js').matchAll(/\{ key: '[\w-]+',.*agentType: '([\w-]+)'/g)].map((m) => m[1] ?? '')
  const enumIu = czytaj('dev-docs-execute-wf.js').match(/agentType: \{\s*type: 'string',\s*enum: \[([^\]]*)\]/)?.[1] ?? ''
  return { r: reviewerzy, iu: [...enumIu.matchAll(/'([\w-]+)'/g)].map((m) => m[1] ?? '') }
}
