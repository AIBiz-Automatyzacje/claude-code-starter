#!/usr/bin/env node
// Rozmiar PR do recenzji bota (P19): pliki diffu galezi po filtrach `reviews.path_filters` z `.coderabbit.yaml` i bez binariow.
// Wczesniej archiwizacja liczyla wszystkie pliki diffu (vibersi etap 2: 250, z czego bot recenzowal ~124 — docs/, .claude/,
// lockfile i obrazy odpadaja filtrami) i radzila podzial PR-a, ktory przeszedl recenzje w calosci.
// Filtry czytamy bez pakietu yaml (projekt nie musi go miec): lista `path_filters:` w bloku `reviews:`, wzorce glob z `!` = wyklucz.
//
// --czubek (P20 S2, PR wieloczesciowy): rozmiar czesci PR bez worktree — diff baza..czubek, filtry z .coderabbit.yaml w czubku
// (`git show`), bo czesc PR-a recenzuje bot z konfiguracja z jej galezi, nie z drzewa roboczego.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   rozmiar.mjs [--baza <ref>] [--czubek <ref>]   baza domyslnie merge-base czubka z main (brak main -> master), czubek HEAD
// Wynik: JSON w jednej linii { baza, czubek, wszystkie, binarne, odfiltrowane, doRecenzji, pliki, filtry }.
// Kod wyjscia: 0 = ok, 2 = zle argumenty, 3 = wyjatek (JSON z polem wyjatek).

import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const PLIK_KONFIGURACJI = '.coderabbit.yaml'
// Limit plikow PR w recenzji bota (CodeRabbit Pro: 150; ETAP1 §5 — odmowa przy 222). Czesc PR ma byc ponizej, plan powyzej
// wymaga sekcji „Części PR” (plan/czesci-pr.mjs); kopia w dev-docs-complete-wf.js (workflowy sa self-contained).
export const PROG_PLIKOW_PR = 150
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

/** @param {string} projekt @param {string} czubek @returns {string} merge-base czubka z main albo master */
function bazaDomyslna(projekt, czubek) {
  for (const glowna of ['main', 'master']) {
    const w = git(projekt, ['merge-base', czubek, glowna])
    if (w.ok) return w.stdout.trim()
  }
  throw new Error('brak galezi main i master — podaj --baza <ref>')
}

/**
 * Filtry z .coderabbit.yaml w czubku (`git show`); brak pliku w czubku = brak filtrow.
 * @param {string} projekt @param {string} czubek @returns {string[]}
 */
function filtryCzubka(projekt, czubek) {
  const w = git(projekt, ['show', `${czubek}:${PLIK_KONFIGURACJI}`])
  return w.ok ? filtrySciezek(w.stdout) : []
}

/**
 * @param {string} projekt
 * @param {string} [baza]
 * @param {string} [czubek] domyslnie HEAD
 * @returns {{ baza: string, czubek: string, wszystkie: number, binarne: number, odfiltrowane: number, doRecenzji: number, pliki: string[], filtry: number }}
 */
export function rozmiarPr(projekt, baza, czubek = 'HEAD') {
  const sha = git(projekt, ['rev-parse', '--verify', '--quiet', `${czubek}^{commit}`])
  if (!sha.ok) throw new Error(`nie ma commita ${czubek}`)
  const od = baza ?? bazaDomyslna(projekt, czubek)
  const diff = git(projekt, ['diff', '--numstat', '-z', '-M', od, czubek])
  if (!diff.ok) throw new Error(`git diff ${od} ${czubek}: ${diff.stderr.trim()}`)
  const filtry = filtryCzubka(projekt, czubek)
  const wszystkie = plikiNumstat(diff.stdout)
  const tekstowe = wszystkie.filter((p) => !p.binarny)
  const pliki = tekstowe.map((p) => p.plik).filter((p) => doRecenzji(p, filtry))
  return {
    baza: od, czubek: sha.stdout.trim(), wszystkie: wszystkie.length, binarne: wszystkie.length - tekstowe.length, odfiltrowane: tekstowe.length - pliki.length,
    doRecenzji: pliki.length, pliki, filtry: filtry.length,
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @type {{ projekt?: string, baza?: string, czubek?: string }} */
  let o = {}
  try {
    o = parseArgs({ options: { projekt: { type: 'string' }, baza: { type: 'string' }, czubek: { type: 'string' } } }).values
  } catch (blad) {
    process.stderr.write(`rozmiar: ${blad instanceof Error ? blad.message : String(blad)}\nUzycie: rozmiar.mjs [--baza <ref>] [--czubek <ref>] [--projekt <katalog>]\n`)
    process.exit(KOD_ZLYCH_ARGUMENTOW)
  }
  try {
    process.stdout.write(`${JSON.stringify(rozmiarPr(o.projekt ?? process.cwd(), o.baza, o.czubek))}\n`)
  } catch (blad) {
    process.stdout.write(`${JSON.stringify({ wyjatek: blad instanceof Error ? blad.message : String(blad) })}\n`)
    process.exit(KOD_WYJATKU)
  }
}
