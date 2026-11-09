#!/usr/bin/env node
// Kontrakt .coderabbit.yaml, ktorego potrzebuje pipeline /dev-pr (punkty 4, 7, 10, 18 znalezisk). Sam plik nic nie gwarantuje: aa-exam
// mial config sprzed szablonu z `request_changes_workflow: true` i bez wytycznych, a piszemy_wirale nie mial go wcale (26 z 27 watkow
// tury 1 do notatek poza kodem). Parser bez pakietu yaml, jak rozmiar.mjs: projekt nie musi go miec.
//
// Uzycie: node .claude/scripts/pr/kontrakt-bota.mjs [--projekt <katalog>] [--czubek <ref>] [--galaz <galaz docelowa>]
// Wynik: jedna linia JSON { plik, odstepstwa, ostrzezenia }. Kod wyjscia: 0 = ok, 2 = zle argumenty.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { filtrySciezek } from './rozmiar.mjs'

export const WYMAGANE_WYKLUCZENIA = ['!.claude/**', '!docs/**', '!**/CLAUDE.md']
// Tytul PR synca szablonu (/sync-template, sekcja „Domkniecie synca”) zaczyna sie od tego slowa, a config z szablonu ma je w ignore_title_keywords.
export const SLOWO_SYNCA = 'chore(szablon)'
const PLIK = '.coderabbit.yaml'
const KOD_ZLYCH_ARGUMENTOW = 2

/** @param {string} s */
const bezCudzyslowu = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2')

/**
 * Wartosc pierwszego klucza o tej nazwie (bez komentarza) albo null.
 * @param {string} tresc @param {string} klucz @param {number} [odLinii]
 * @returns {string | null}
 */
function wartosc(tresc, klucz, odLinii = 0) {
  for (const l of tresc.split('\n').slice(odLinii)) {
    const m = new RegExp(`^\\s*${klucz}:\\s*(.*?)\\s*(?:#.*)?$`).exec(l)
    if (m) return bezCudzyslowu(m[1])
  }
  return null
}

/**
 * Elementy listy pod kluczem albo null, gdy klucza nie ma.
 * @param {string} tresc @param {string} klucz
 * @returns {string[] | null}
 */
function lista(tresc, klucz) {
  const linie = tresc.split('\n')
  const start = linie.findIndex((l) => new RegExp(`^\\s*${klucz}:\\s*(#.*)?$`).test(l))
  if (start === -1) return null
  const wynik = []
  for (const l of linie.slice(start + 1)) {
    if (!l.trim() || l.trim().startsWith('#')) continue
    const m = /^\s*-\s+(.*?)\s*(?:\s#.*)?$/.exec(l)
    if (!m) break
    wynik.push(bezCudzyslowu(m[1]))
  }
  return wynik
}

/** @param {string} tresc @param {string} sekcja @param {string} klucz */
function wSekcji(tresc, sekcja, klucz) {
  const start = tresc.split('\n').findIndex((l) => new RegExp(`^\\s*${sekcja}:\\s*(#.*)?$`).test(l))
  return start === -1 ? null : wartosc(tresc, klucz, start + 1)
}

/**
 * Odstepstwa configu od kontraktu pipeline'u.
 * @param {string} tresc
 * @param {{ galaz?: string | null, istnieje?: (plik: string) => boolean }} [opcje]
 * @returns {string[]}
 */
export function odstepstwaKontraktu(tresc, { galaz = null, istnieje = () => true } = {}) {
  const wynik = []
  const filtry = filtrySciezek(tresc)
  const brakujace = WYMAGANE_WYKLUCZENIA.filter((f) => !filtry.includes(f))
  if (brakujace.length) wynik.push(`path_filters bez wykluczen: ${brakujace.join(', ')}`)
  if (wartosc(tresc, 'request_changes_workflow') !== 'false') wynik.push('request_changes_workflow nie jest false: otwarty watek trzyma CHANGES_REQUESTED')
  if (wSekcji(tresc, 'auto_review', 'enabled') !== 'true') wynik.push('auto_review.enabled nie jest true')
  if (wartosc(tresc, 'auto_incremental_review') !== 'true') wynik.push('auto_incremental_review nie jest true: tury nie dostana recenzji przyrostowej')
  if (wartosc(tresc, 'review_status') !== 'true') wynik.push('review_status nie jest true')
  if (wartosc(tresc, 'language') !== 'pl-PL') wynik.push('language nie jest pl-PL')
  const galezie = lista(tresc, 'base_branches')
  if (galaz && galezie && !galezie.includes(galaz)) wynik.push(`base_branches nie obejmuje galezi docelowej ${galaz}`)
  const wytyczne = lista(tresc, 'filePatterns')
  if (!wytyczne?.length) wynik.push('knowledge_base.code_guidelines.filePatterns puste: bot nie zna regul projektu')
  else {
    const martwe = wytyczne.filter((p) => !p.includes('*') && !istnieje(p))
    if (martwe.length) wynik.push(`filePatterns wskazuje nieistniejace pliki: ${martwe.join(', ')}`)
  }
  if (wSekcji(tresc, 'docstrings', 'mode') !== 'off') wynik.push('pre_merge_checks.docstrings.mode nie jest off: check wraca w kazdej recenzji')
  return wynik
}

/**
 * Sprzecznosc CLAUDE.md z baza PR (aa-exam PR #48: dokument kazal PR-y do develop, a start tworzyl je do main).
 * @param {string} claudeMd @param {string | null} galaz
 * @returns {string[]}
 */
export function ostrzezeniaBazy(claudeMd, galaz) {
  if (!galaz) return []
  const inne = [...claudeMd.matchAll(/\b(?:PR-y|PR|branche?|gałęzie|feature\S*)\b[^\n]{0,40}\bdo\s+`?(develop|dev|staging)`?/gi)].map((m) => m[1])
  return [...new Set(inne)].filter((g) => g !== galaz).map((g) => `CLAUDE.md kieruje PR-y do ${g}, a baza PR to ${galaz}`)
}

/**
 * Config bez slowa synca: PR synca szablonu czeka na recenzje bota (aa-exam PR #52, dashboard PR #127). Ostrzezenie, nie
 * odstepstwo: odstepstwo zatrzymaloby start /dev-pr w kazdym projekcie z configiem sprzed tej zmiany.
 * @param {string} tresc
 * @returns {string[]}
 */
export function ostrzezeniaSynca(tresc) {
  if (lista(tresc, 'ignore_title_keywords')?.includes(SLOWO_SYNCA)) return []
  return [`ignore_title_keywords bez "${SLOWO_SYNCA}": PR synca szablonu poczeka na recenzje bota (dopisz slowo albo /coderabbit-setup)`]
}

/** @param {string} projekt @param {string[]} argumenty */
function git(projekt, argumenty) {
  const w = spawnSync('git', argumenty, { cwd: projekt, encoding: 'utf8' })
  return w.status === 0 ? w.stdout : null
}

/**
 * @param {string} projekt
 * @param {{ czubek?: string, galaz?: string }} [opcje]
 * @returns {{ plik: boolean, odstepstwa: string[], ostrzezenia: string[] }}
 */
export function kontraktBota(projekt, { czubek, galaz } = {}) {
  const czytaj = (/** @type {string} */ p) => (czubek ? git(projekt, ['show', `${czubek}:${p}`]) : (existsSync(join(projekt, p)) ? readFileSync(join(projekt, p), 'utf8') : null))
  const tresc = czytaj(PLIK)
  const ostrzezenia = ostrzezeniaBazy(czytaj('CLAUDE.md') ?? '', galaz ?? null)
  if (tresc === null) return { plik: false, odstepstwa: [`brak ${PLIK}`], ostrzezenia }
  return { plik: true, odstepstwa: odstepstwaKontraktu(tresc, { galaz: galaz ?? null, istnieje: (p) => czytaj(p) !== null }), ostrzezenia: [...ostrzezenia, ...ostrzezeniaSynca(tresc)] }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @type {{ projekt?: string, czubek?: string, galaz?: string }} */
  let o = {}
  try {
    o = parseArgs({ options: { projekt: { type: 'string' }, czubek: { type: 'string' }, galaz: { type: 'string' } } }).values
  } catch (blad) {
    process.stderr.write(`kontrakt-bota: ${blad instanceof Error ? blad.message : String(blad)}\n`)
    process.exit(KOD_ZLYCH_ARGUMENTOW)
  }
  process.stdout.write(`${JSON.stringify(kontraktBota(o.projekt ?? process.cwd(), { czubek: o.czubek, galaz: o.galaz }))}\n`)
}
