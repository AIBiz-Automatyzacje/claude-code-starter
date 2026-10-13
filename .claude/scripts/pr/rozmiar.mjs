#!/usr/bin/env node
// Rozmiar PR do recenzji bota (P19): pliki diffu galezi po filtrach `reviews.path_filters` z `.coderabbit.yaml` i bez binariow.
// Wczesniej archiwizacja liczyla wszystkie pliki diffu (vibersi etap 2: 250, z czego bot recenzowal ~124 — docs/, .claude/,
// lockfile i obrazy odpadaja filtrami) i radzila podzial PR-a, ktory przeszedl recenzje w calosci.
// Filtry czytamy bez pakietu yaml (projekt nie musi go miec): lista `path_filters:` w bloku `reviews:`, wzorce glob z `!` = wyklucz.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   rozmiar.mjs [--baza <ref>]   domyslnie merge-base HEAD z main (brak main -> master)
// Wynik: JSON w jednej linii { baza, wszystkie, binarne, odfiltrowane, doRecenzji, pliki, filtry }.
// Kod wyjscia: 0 = ok, 2 = zle argumenty, 3 = wyjatek (JSON z polem wyjatek).

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const PLIK_KONFIGURACJI = '.coderabbit.yaml'
const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3

/**
 * Lista `reviews.path_filters` z tresci .coderabbit.yaml: elementy `- "wzorzec"` (cudzyslow opcjonalny) albo lista w linii
 * `path_filters: ["a", "b"]`. Komentarze i puste linie w liscie pomijamy; lista konczy sie na pierwszej linii z wciecia klucza.
 * @param {string} tresc
 * @returns {string[]}
 */
export function filtrySciezek(tresc) {
  const linie = tresc.split('\n')
  const reviews = linie.findIndex((l) => /^reviews:\s*(#.*)?$/.test(l))
  if (reviews === -1) return []
  for (let i = reviews + 1; i < linie.length; i += 1) {
    if (/^\S/.test(linie[i]) && !linie[i].startsWith('#')) return []
    const m = /^(\s+)path_filters:\s*(.*?)\s*(#.*)?$/.exec(linie[i])
    if (!m) continue
    if (m[2].startsWith('[')) return m[2].replace(/^\[|\]$/g, '').split(',').map(bezCudzyslowu).filter(Boolean)
    return elementyListy(linie.slice(i + 1), m[1].length)
  }
  return []
}

/** @param {string[]} linie @param {number} wciecieKlucza @returns {string[]} */
function elementyListy(linie, wciecieKlucza) {
  const wynik = []
  for (const linia of linie) {
    if (!linia.trim() || linia.trim().startsWith('#')) continue
    const m = /^(\s*)-\s+(.*?)\s*(?:\s#.*)?$/.exec(linia)
    if (!m || m[1].length < wciecieKlucza) break
    wynik.push(bezCudzyslowu(m[2]))
  }
  return wynik
}

/** @param {string} s @returns {string} */
const bezCudzyslowu = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2')

/**
 * Glob (skladnia minimatch, jak path_filters CodeRabbita) -> RegExp na sciezke wzgledem korzenia repo: `**` przechodzi przez
 * katalogi, `*` i `?` nie przechodza przez `/`, `{a,b}` = alternatywa.
 * @param {string} wzorzec
 * @returns {RegExp}
 */
export function regexGlobu(wzorzec) {
  let r = ''
  for (let i = 0; i < wzorzec.length; i += 1) {
    const z = wzorzec[i]
    if (wzorzec.startsWith('**/', i)) {
      r += '(?:.*/)?'
      i += 2
    } else if (wzorzec.startsWith('**', i)) {
      r += '.*'
      i += 1
    } else if (z === '*') r += '[^/]*'
    else if (z === '?') r += '[^/]'
    else if (z === '{') r += '(?:'
    else if (z === '}') r += ')'
    else if (z === ',' && r.lastIndexOf('(?:') > r.lastIndexOf(')')) r += '|'
    else r += z.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${r}$`)
}

/**
 * Czy plik trafia do recenzji: wzorce z `!` wykluczaja; gdy sa wzorce bez `!`, plik musi pasowac do ktoregos z nich.
 * @param {string} plik
 * @param {string[]} filtry
 * @returns {boolean}
 */
export function doRecenzji(plik, filtry) {
  const wlacz = filtry.filter((f) => !f.startsWith('!')).map(regexGlobu)
  const wyklucz = filtry.filter((f) => f.startsWith('!')).map((f) => regexGlobu(f.slice(1)))
  if (wlacz.length && !wlacz.some((r) => r.test(plik))) return false
  return !wyklucz.some((r) => r.test(plik))
}

/**
 * Pliki diffu z `git diff --numstat -z`: binarny = liczby `-` (git nie liczy linii). Zmiana nazwy to jeden plik (nowa sciezka),
 * jak w liczniku plikow PR na GitHubie.
 * @param {string} wyjscie
 * @returns {{ plik: string, binarny: boolean }[]}
 */
export function plikiNumstat(wyjscie) {
  const czesci = wyjscie.split('\0')
  const wynik = []
  for (let i = 0; i < czesci.length; i += 1) {
    const m = /^(-|\d+)\t(-|\d+)\t(.*)$/s.exec(czesci[i])
    if (!m) continue
    const binarny = m[1] === '-' && m[2] === '-'
    // Zmiana nazwy w -z: pusta sciezka w rekordzie, potem stara i nowa sciezka jako osobne pola.
    if (m[3] === '') {
      wynik.push({ plik: czesci[i + 2], binarny })
      i += 2
    } else wynik.push({ plik: m[3], binarny })
  }
  return wynik
}

/** @param {string} projekt @param {string[]} argumenty @returns {{ ok: boolean, stdout: string, stderr: string }} */
function git(projekt, argumenty) {
  const w = spawnSync('git', argumenty, { cwd: projekt, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { ok: w.status === 0, stdout: w.stdout ?? '', stderr: w.stderr ?? '' }
}

/** @param {string} projekt @returns {string} merge-base HEAD z main albo master */
function bazaDomyslna(projekt) {
  for (const glowna of ['main', 'master']) {
    const w = git(projekt, ['merge-base', 'HEAD', glowna])
    if (w.ok) return w.stdout.trim()
  }
  throw new Error('brak galezi main i master — podaj --baza <ref>')
}

/**
 * @param {string} projekt
 * @param {string} [baza]
 * @returns {{ baza: string, wszystkie: number, binarne: number, odfiltrowane: number, doRecenzji: number, pliki: string[], filtry: number }}
 */
export function rozmiarPr(projekt, baza) {
  const od = baza ?? bazaDomyslna(projekt)
  const diff = git(projekt, ['diff', '--numstat', '-z', '-M', od, 'HEAD'])
  if (!diff.ok) throw new Error(`git diff ${od} HEAD: ${diff.stderr.trim()}`)
  const konfiguracja = join(projekt, PLIK_KONFIGURACJI)
  const filtry = existsSync(konfiguracja) ? filtrySciezek(readFileSync(konfiguracja, 'utf8')) : []
  const wszystkie = plikiNumstat(diff.stdout)
  const tekstowe = wszystkie.filter((p) => !p.binarny)
  const pliki = tekstowe.map((p) => p.plik).filter((p) => doRecenzji(p, filtry))
  return {
    baza: od, wszystkie: wszystkie.length, binarne: wszystkie.length - tekstowe.length, odfiltrowane: tekstowe.length - pliki.length,
    doRecenzji: pliki.length, pliki, filtry: filtry.length,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  /** @type {{ projekt?: string, baza?: string }} */
  let o = {}
  try {
    o = parseArgs({ options: { projekt: { type: 'string' }, baza: { type: 'string' } } }).values
  } catch (blad) {
    process.stderr.write(`rozmiar: ${blad instanceof Error ? blad.message : String(blad)}\nUzycie: rozmiar.mjs [--baza <ref>] [--projekt <katalog>]\n`)
    process.exit(KOD_ZLYCH_ARGUMENTOW)
  }
  try {
    process.stdout.write(`${JSON.stringify(rozmiarPr(o.projekt ?? process.cwd(), o.baza))}\n`)
  } catch (blad) {
    process.stdout.write(`${JSON.stringify({ wyjatek: blad instanceof Error ? blad.message : String(blad) })}\n`)
    process.exit(KOD_WYJATKU)
  }
}
