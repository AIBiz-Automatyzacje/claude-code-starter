#!/usr/bin/env node
// Zmienne srodowiska dodane w galezi zadania vs smoke operatora (P19). vibersi etap 2: `SUPABASE_SECRET_KEY` weszla
// odchyleniem w fazach 1–2 (jest w `.env.example`), a agent smoke'u przepisal liste zmiennych z planu — deploy bez niej
// nie wstalby; sesja dopisala ja recznie. Skrypt liczy zmienne nowe w galezi ze zrodel deklaracji i uzycia:
//   `.env*.example` (linie KLUCZ=), `process.env.X` / `process.env['X']`, `import.meta.env.X`, `Deno.env.get('X')`
// w dodanych liniach diffu; zmienna znana juz na bazie (te same zrodla) i wbudowane (NODE_ENV, MODE…) nie sa nowe.
// Testy, e2e/, .claude/ i `.env.e2e*` pomijamy: to zmienne pipeline'u i testow, nie deployu.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   zmienne.mjs [--smoke <plik>] [--baza <ref>] [--glowa <ref>]   baza domyslnie merge-base glowy z main (brak main -> master)
// Wynik: JSON w jednej linii { baza, zmienne: [{ nazwa, zrodla: ["plik:linia"] }], braki: [nazwa] } — `braki` tylko z --smoke:
// nowe zmienne, ktorych nazwy nie ma w pliku smoke'u. Kod wyjscia: 0 = ok, 1 = braki w smoke'u, 2 = zle argumenty, 3 = wyjatek.

import { spawnSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const KOD_BRAKOW = 1
const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3
const NAZWA = '([A-Z_][A-Z0-9_]*)'
const WZORCE_KODU = [
  new RegExp(`process\\.env\\.${NAZWA}`, 'g'),
  new RegExp(`process\\.env\\[\\s*['"\`]${NAZWA}['"\`]\\s*\\]`, 'g'),
  new RegExp(`import\\.meta\\.env\\.${NAZWA}`, 'g'),
  new RegExp(`Deno\\.env\\.get\\(\\s*['"\`]${NAZWA}['"\`]`, 'g'),
]
const WZORZEC_EXAMPLE = new RegExp(`^\\s*(?:export\\s+)?${NAZWA}\\s*=`)
const PLIK_EXAMPLE = /(^|\/)\.env[^/]*\.example$/
const PLIK_KODU = /\.(?:[cm]?[jt]s|[jt]sx)$/
const POMIJANE = /(^|\/)(?:__tests__|e2e|\.claude|node_modules)\/|\.(?:test|spec)\.[^/]+$|(^|\/)\.env\.e2e/
// Zmienne wbudowane Vite i srodowiska uruchomienia — nie ustawia ich operator.
const WBUDOWANE = new Set(['NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL', 'CI', 'HOME', 'PATH', 'PWD', 'TZ'])

/** @param {string} projekt @param {string[]} argumenty @returns {string} */
function git(projekt, argumenty) {
  const w = spawnSync('git', argumenty, { cwd: projekt, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (w.status !== 0) throw new Error(`git ${argumenty.join(' ')}: ${(w.stderr ?? '').trim()}`)
  return w.stdout
}

/** @param {string} plik @returns {boolean} */
const zrodlowy = (plik) => !POMIJANE.test(plik) && (PLIK_EXAMPLE.test(plik) || PLIK_KODU.test(plik))

/**
 * Nazwy zmiennych w linii pliku zrodlowego: deklaracja w `.env*.example` albo uzycie w kodzie.
 * @param {string} plik
 * @param {string} linia
 * @returns {string[]}
 */
export function nazwyWLinii(plik, linia) {
  if (PLIK_EXAMPLE.test(plik)) {
    const m = WZORZEC_EXAMPLE.exec(linia)
    return m ? [m[1]] : []
  }
  return WZORCE_KODU.flatMap((w) => [...linia.matchAll(w)].map((m) => m[1]))
}

/**
 * Dodane linie diffu `-U0` z numerami linii w nowej wersji pliku.
 * @param {string} diff
 * @returns {{ plik: string, linia: number, tresc: string }[]}
 */
export function dodaneLinie(diff) {
  const wynik = []
  let plik = ''
  let numer = 0
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) plik = l.startsWith('+++ b/') ? l.slice(6) : ''
    else if (l.startsWith('@@')) numer = Number(/\+(\d+)/.exec(l)?.[1] ?? 0)
    else if (l.startsWith('+') && plik) wynik.push({ plik, linia: numer++, tresc: l.slice(1) })
  }
  return wynik
}

/**
 * Zmienne nowe w galezi: nazwy z dodanych linii plikow zrodlowych, bez znanych na bazie i wbudowanych.
 * @param {{ plik: string, linia: number, tresc: string }[]} dodane
 * @param {Set<string>} naBazie
 * @returns {{ nazwa: string, zrodla: string[] }[]}
 */
export function noweZmienne(dodane, naBazie) {
  /** @type {Map<string, string[]>} */
  const zrodla = new Map()
  for (const d of dodane.filter((x) => zrodlowy(x.plik))) {
    for (const nazwa of nazwyWLinii(d.plik, d.tresc)) {
      if (naBazie.has(nazwa) || WBUDOWANE.has(nazwa)) continue
      zrodla.set(nazwa, [...(zrodla.get(nazwa) ?? []), `${d.plik}:${d.linia}`])
    }
  }
  return [...zrodla].map(([nazwa, z]) => ({ nazwa, zrodla: z })).sort((a, b) => a.nazwa.localeCompare(b.nazwa))
}

/**
 * Zmienne nowe, ktorych nazwy (cale slowo) nie ma w tresci smoke'u.
 * @param {{ nazwa: string }[]} zmienne
 * @param {string} smoke
 * @returns {string[]}
 */
export function brakiWSmoke(zmienne, smoke) {
  return zmienne.map((z) => z.nazwa).filter((n) => !new RegExp(`(^|[^A-Za-z0-9_])${n}($|[^A-Za-z0-9_])`).test(smoke))
}

/** @param {string} projekt @param {string} baza @returns {Set<string>} nazwy zmiennych w plikach zrodlowych na bazie */
function zmienneNaBazie(projekt, baza) {
  const pliki = git(projekt, ['ls-tree', '-r', '--name-only', baza]).split('\n').filter(zrodlowy)
  const nazwy = new Set()
  for (const plik of pliki) {
    for (const linia of git(projekt, ['show', `${baza}:${plik}`]).split('\n')) for (const n of nazwyWLinii(plik, linia)) nazwy.add(n)
  }
  return nazwy
}

/** @param {string} projekt @param {string} glowa @returns {string} */
function bazaDomyslna(projekt, glowa) {
  for (const glowna of ['main', 'master']) {
    const w = spawnSync('git', ['merge-base', glowa, glowna], { cwd: projekt, encoding: 'utf8' })
    if (w.status === 0) return w.stdout.trim()
  }
  throw new Error('brak galezi main i master — podaj --baza <ref>')
}

/**
 * @param {string} projekt
 * @param {{ baza?: string, glowa?: string, smoke?: string }} opcje smoke: sciezka wzgledem projektu albo bezwzgledna
 * @returns {{ baza: string, zmienne: { nazwa: string, zrodla: string[] }[], braki?: string[] }}
 */
export function zmienneGalezi(projekt, { baza, glowa = 'HEAD', smoke } = {}) {
  const od = baza ?? bazaDomyslna(projekt, glowa)
  const zmienne = noweZmienne(dodaneLinie(git(projekt, ['diff', '-U0', '--no-color', '--no-ext-diff', od, glowa])), zmienneNaBazie(projekt, od))
  return smoke === undefined ? { baza: od, zmienne } : { baza: od, zmienne, braki: brakiWSmoke(zmienne, readFileSync(isAbsolute(smoke) ? smoke : join(projekt, smoke), 'utf8')) }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @type {{ projekt?: string, baza?: string, glowa?: string, smoke?: string }} */
  let o = {}
  try {
    o = parseArgs({ options: { projekt: { type: 'string' }, baza: { type: 'string' }, glowa: { type: 'string' }, smoke: { type: 'string' } } }).values
  } catch (blad) {
    process.stderr.write(`zmienne: ${blad instanceof Error ? blad.message : String(blad)}\nUzycie: zmienne.mjs [--smoke <plik>] [--baza <ref>] [--glowa <ref>] [--projekt <katalog>]\n`)
    process.exit(KOD_ZLYCH_ARGUMENTOW)
  }
  try {
    const w = zmienneGalezi(o.projekt ?? process.cwd(), { baza: o.baza, glowa: o.glowa, smoke: o.smoke })
    process.stdout.write(`${JSON.stringify(w)}\n`)
    process.exit(w.braki?.length ? KOD_BRAKOW : 0)
  } catch (blad) {
    process.stdout.write(`${JSON.stringify({ wyjatek: blad instanceof Error ? blad.message : String(blad) })}\n`)
    process.exit(KOD_WYJATKU)
  }
}
