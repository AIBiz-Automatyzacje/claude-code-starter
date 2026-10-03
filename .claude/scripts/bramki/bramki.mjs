#!/usr/bin/env node
// Skrypt bramek domkniecia fazy (PLAN-POPRAWY P6): deterministyczne bramki mechaniczne zamiast agenta, ktory "gra lintera".
//
// Uzycie:
//   node .claude/scripts/bramki/bramki.mjs --baza <commit sprzed fazy> [--projekt <katalog>]
//   node .claude/scripts/bramki/bramki.mjs --dopisz-sume [--projekt <katalog>]   (nowe migracje do supabase/migrations.sum)
//
// Wynik (stdout, JSON): { <bramka>: { status, sekundy, trafienia: [{ plik, linia, regula, opis }], powod?, ostrzezenia?, zastane? } }
//   status: ok | porazka (naprawa w domknieciu) | brak (narzedzie albo dane nieobecne) | blad (narzedzie padlo) | pominieta (nie dotyczy fazy)
//   Stryker i testyUsuniete sa informacyjne: lista bez porazki. ostrzezenia ESLint = wejscie code-quality.
// Kod wyjscia: 0 = bez porazki, 1 = co najmniej jedna porazka, 2 = zle argumenty.
// Stan = drzewo robocze (bramki biegna przed commitem domkniecia); baza = commit sprzed fazy.
// Monorepo: z korzenia bramki biegna tez w pakietach zmienionych w fazie, ktore maja wlasne narzedzia; sciezki od korzenia.

import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { API_SUPABASE, bramkaAdvisors } from './advisors.mjs'
import { zmianyFazy } from './diff.mjs'
import { bramkaEslint } from './eslint.mjs'
import { bramkaKnip } from './knip.mjs'
import { bramkaNiezmiennoscMigracji } from './migracje.mjs'
import { bramkaMigrationsSum, dopiszSume } from './migrations-sum.mjs'
import { wykryjNarzedzia } from './narzedzia.mjs'
import { pakietyFazy, scalWyniki } from './pakiety.mjs'
import { bramkaSizeLimit } from './size-limit.mjs'
import { bramkaStryker } from './stryker.mjs'
import { bramkaTestyUsuniete } from './testy-usuniete.mjs'
import { bramkaTsc } from './tsc.mjs'
import { bramkaVitestTypecheck } from './vitest-typecheck.mjs'

const KOD_PORAZKI = 1
const KOD_ZLYCH_ARGUMENTOW = 2

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {import('./narzedzia.mjs').Narzedzie} Narzedzie */

/**
 * Bramka narzedziowa: brak narzedzia = status brak z powodem z wykrycia.
 * @param {Narzedzie} n
 * @param {(n: { bin: string, konfiguracja: string | null }) => WynikBramki} bramka
 * @returns {WynikBramki}
 */
function zNarzedziem(n, bramka) {
  return n.jest ? bramka(n) : { status: 'brak', sekundy: null, trafienia: [], powod: n.powod }
}

/**
 * Bramki projektu; pakiety monorepo zmienione w fazie z wlasnymi narzedziami (pakiety.mjs) dostaja osobny przebieg,
 * wynik scalony. Po kolei: typecheck pierwszy (w monorepo buduje typy wspolnych pakietow, bez tego typowany ESLint widzi
 * any), Stryker ostatni (najdluzszy). Czas kazdej bramki mierzony tutaj, takze dla bramek bez narzedzia.
 * @param {string} projekt
 * @param {string} baza
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<Record<string, WynikBramki>>}
 */
async function uruchomBramki(projekt, baza, env) {
  const zmiany = zmianyFazy(projekt, baza)
  const pakiety = pakietyFazy(projekt, zmiany.pliki)
  if (!pakiety.length) return bramkiKatalogu(projekt, baza, env, zmiany)
  /** @type {[string, Record<string, WynikBramki>][]} */
  const przebiegi = [['.', await bramkiKatalogu(projekt, baza, env, zmiany)]]
  for (const k of pakiety) {
    const katalog = join(projekt, k)
    przebiegi.push([k, await bramkiKatalogu(katalog, baza, env, zmianyFazy(katalog, baza))])
  }
  return scalWyniki(przebiegi)
}

/**
 * Bramki jednego katalogu (projekt albo pakiet monorepo) po kolei.
 * @param {string} projekt
 * @param {string} baza
 * @param {NodeJS.ProcessEnv} env
 * @param {import('./diff.mjs').ZmianyFazy} zmiany
 * @returns {Promise<Record<string, WynikBramki>>}
 */
async function bramkiKatalogu(projekt, baza, env, zmiany) {
  const n = wykryjNarzedzia(projekt)
  /** @type {[string, () => WynikBramki | Promise<WynikBramki>][]} */
  const kolejka = [
    ['typecheck', () => zNarzedziem(n.tsc, (t) => bramkaTsc(projekt, t))],
    ['eslint', () => zNarzedziem(n.eslint, (t) => bramkaEslint(projekt, t, zmiany))],
    ['testyTypow', () => zNarzedziem(n.vitest, (t) => bramkaVitestTypecheck(projekt, t))],
    ['knip', () => zNarzedziem(n.knip, (t) => bramkaKnip(projekt, t, zmiany))],
    ['sizeLimit', () => zNarzedziem(n.sizeLimit, (t) => bramkaSizeLimit(projekt, t))],
    ['migracje', () => bramkaNiezmiennoscMigracji(projekt, baza)],
    ['migracjeSuma', () => bramkaMigrationsSum(projekt)],
    ['advisors', () => bramkaAdvisors(projekt, env, API_SUPABASE)],
    ['testyUsuniete', () => bramkaTestyUsuniete(projekt, zmiany)],
    ['stryker', () => zNarzedziem(n.stryker, (t) => bramkaStryker(projekt, t, zmiany))],
  ]
  /** @type {Record<string, WynikBramki>} */
  const wyniki = {}
  for (const [nazwa, bramka] of kolejka) {
    const start = performance.now()
    const wynik = await bramka()
    wyniki[nazwa] = { ...wynik, sekundy: Math.round((performance.now() - start) / 100) / 10 }
  }
  return wyniki
}

/** @param {string} komunikat @returns {never} */
function zleArgumenty(komunikat) {
  process.stderr.write(`bramki: ${komunikat}\nUzycie: bramki.mjs --baza <commit> [--projekt <katalog>] | --dopisz-sume [--projekt <katalog>]\n`)
  process.exit(KOD_ZLYCH_ARGUMENTOW)
}

/** @returns {{ baza: string | undefined, projekt: string, dopiszSume: boolean }} */
function argumenty() {
  try {
    const { values } = parseArgs({ options: { baza: { type: 'string' }, projekt: { type: 'string' }, 'dopisz-sume': { type: 'boolean' } } })
    return { baza: values.baza, projekt: values.projekt ?? process.cwd(), dopiszSume: values['dopisz-sume'] ?? false }
  } catch (e) {
    if (!(e instanceof TypeError)) throw e
    return zleArgumenty(e.message)
  }
}

const a = argumenty()
if (a.dopiszSume) {
  process.stdout.write(`${JSON.stringify({ dopisane: dopiszSume(a.projekt) })}\n`)
} else {
  if (!a.baza) zleArgumenty('brak --baza (commit sprzed fazy)')
  /** @type {Record<string, WynikBramki>} */
  let wyniki
  try {
    wyniki = await uruchomBramki(a.projekt, a.baza, process.env)
  } catch (e) {
    if (!(e instanceof Error && /baza fazy/.test(e.message))) throw e
    zleArgumenty(e.message)
  }
  process.stdout.write(`${JSON.stringify(wyniki, null, 1)}\n`)
  if (Object.values(wyniki).some((w) => w.status === 'porazka')) process.exitCode = KOD_PORAZKI
}
