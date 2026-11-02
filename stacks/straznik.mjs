// Strażnik słów stacku (plan szablonu mobile z rdzenia, IU-1.5). Rdzeń szablonu (`.claude/`, `output-styles/`) nie zakłada
// stacku: tekst zależny od stacku leży w slotach z `stacks/sloty.json`, które nakładka stacku podmienia w całości. Słowo
// stacku web poza slotem przechodzi tylko z wyjątkiem z `stacks/straznik.json`:
// - `usun` / `podmiana` — plik albo katalog spoza rdzenia: wariant stacku go usuwa (`usun.txt`) albo podmienia (Etap 2);
// - `przejsciowy` — zostaje w rdzeniu, słowa usunie wskazane IU;
// - `staly` — rozpoznawanie wielu stacków (vitest/jest), komentarz z historią, klucz telemetrii, przykład.
// Wyjątek, który niczego nie pokrywa, jest nieaktualny: lista kurczy się razem z rdzeniem, zamiast zostawiać furtki.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'

export const KATALOGI_RDZENIA = ['.claude', 'output-styles']
// Testy i fixture'y opisują stack wprost; worktrees, kopie zapasowe i paczki nie są plikami szablonu.
const POMIJANE_KATALOGI = new Set(['__tests__', 'worktrees', '.backups', 'node_modules'])
const POMIJANE_PLIKI = new Set(['settings.local.json'])

/** @typedef {{ nazwa: string, wzor: string, flagi?: string }} Slowo */
/**
 * @typedef {{ plik: string, rodzaj: 'usun' | 'podmiana' | 'przejsciowy' | 'staly', iu?: string, slowa?: string[],
 *   linie?: string[], powod: string }} Wyjatek
 * `plik` zakończony `/` to katalog; `linie` to fragmenty linii, które wyjątek pokrywa (bez nich — cały plik).
 */
/** @typedef {{ opis: string, slowa: Slowo[], wyjatki: Wyjatek[] }} Straznik */
/** @typedef {{ plik: string, linia: number, slowo: string, tresc: string }} Trafienie */

/** @param {string} korzen @returns {Straznik} */
export const wczytajStraznik = (korzen) => JSON.parse(readFileSync(join(korzen, 'stacks/straznik.json'), 'utf8'))

/** @param {string} korzen @returns {string[]} */
export function wczytajSloty(korzen) {
  /** @type {{ sloty: Array<{ plik: string }> }} */
  const rejestr = JSON.parse(readFileSync(join(korzen, 'stacks/sloty.json'), 'utf8'))
  return rejestr.sloty.map((s) => s.plik)
}

/**
 * Pliki rdzenia względem korzenia repo, z separatorem `/`, posortowane.
 * @param {string} korzen @returns {string[]}
 */
export function plikiRdzenia(korzen) {
  /** @type {string[]} */
  const wynik = []
  /** @param {string} katalog */
  const przejdz = (katalog) => {
    for (const wpis of readdirSync(join(korzen, katalog), { withFileTypes: true })) {
      const sciezka = posix.join(katalog, wpis.name)
      if (wpis.isDirectory() && !POMIJANE_KATALOGI.has(wpis.name)) przejdz(sciezka)
      else if (wpis.isFile() && !POMIJANE_PLIKI.has(wpis.name)) wynik.push(sciezka)
    }
  }
  for (const katalog of KATALOGI_RDZENIA) if (existsSync(join(korzen, katalog))) przejdz(katalog)
  return wynik.sort()
}

/** Wyjątek z liniami przed plikowym, plikowy przed katalogowym — trafienie bierze najwęższy pasujący. */
const szczegolowosc = (/** @type {Wyjatek} */ w) => (w.linie ? 2 : w.plik.endsWith('/') ? 0 : 1)

/** @param {Wyjatek} w @param {Trafienie} t @returns {boolean} */
function pokrywa(w, t) {
  const plik = w.plik.endsWith('/') ? t.plik.startsWith(w.plik) : t.plik === w.plik
  return plik && (!w.slowa || w.slowa.includes(t.slowo)) && (!w.linie || w.linie.some((l) => t.tresc.includes(l)))
}

/** @param {Wyjatek} w @param {Trafienie[]} trafienia @returns {string[]} */
function nieaktualnosc(w, trafienia) {
  const opis = `${w.plik} (${w.rodzaj})`
  if (!trafienia.length) return [`${opis}: wyjątek niczego nie pokrywa`]
  return [
    ...(w.slowa ?? []).filter((s) => !trafienia.some((t) => t.slowo === s)).map((s) => `${opis}: słowo ${s} już nie występuje`),
    ...(w.linie ?? []).filter((l) => !trafienia.some((t) => t.tresc.includes(l))).map((l) => `${opis}: brak linii z „${l}”`),
  ]
}

/**
 * Słowa stacku w plikach rdzenia poza slotami: naruszenia (bez wyjątku) i nieaktualne wyjątki.
 * @param {string} korzen @param {Straznik} straznik @param {string[]} sloty
 * @returns {{ naruszenia: Trafienie[], nieaktualne: string[] }}
 */
export function skanuj(korzen, straznik, sloty) {
  const slowa = straznik.slowa.map((s) => ({ nazwa: s.nazwa, wzor: new RegExp(s.wzor, s.flagi ?? '') }))
  const wyjatki = [...straznik.wyjatki].sort((a, b) => szczegolowosc(b) - szczegolowosc(a))
  /** @type {Trafienie[][]} */
  const pokryte = wyjatki.map(() => [])
  /** @type {Trafienie[]} */
  const naruszenia = []
  for (const plik of plikiRdzenia(korzen).filter((p) => !sloty.includes(p))) {
    readFileSync(join(korzen, plik), 'utf8').split('\n').forEach((linia, i) => {
      for (const { nazwa } of slowa.filter((s) => s.wzor.test(linia))) {
        const trafienie = { plik, linia: i + 1, slowo: nazwa, tresc: linia.trim() }
        const indeks = wyjatki.findIndex((w) => pokrywa(w, trafienie))
        if (indeks === -1) naruszenia.push(trafienie)
        else pokryte[indeks].push(trafienie)
      }
    })
  }
  return { naruszenia, nieaktualne: wyjatki.flatMap((w, i) => nieaktualnosc(w, pokryte[i])) }
}

const SLOT_PELNA_SCIEZKA = /\.claude\/(?:stack\/[a-z0-9-]+\.(?:md|json)|skills\/[a-z0-9-]+\/references\/stack\.md)/g
const SLOT_SKILLA = /(?<![\w/.-])references\/stack\.md/g
const IMPORT_WZGLEDNY = /(?:\bfrom\s+|\bimport\s*\(\s*)'(\.\.?\/[^']+)'/g

/**
 * Odesłania rdzenia do slotów: pełne ścieżki `.claude/stack/…` i `.claude/skills/<s>/references/stack.md`,
 * `references/stack.md` w plikach skilla (slot tego skilla) oraz względne importy modułów będących slotami plikowymi.
 * @param {string} korzen @param {string[]} sloty @returns {Array<{ plik: string, slot: string }>}
 */
export function odeslaniaDoSlotow(korzen, sloty) {
  /** @type {Array<{ plik: string, slot: string }>} */
  const wynik = []
  for (const plik of plikiRdzenia(korzen)) {
    const tresc = readFileSync(join(korzen, plik), 'utf8')
    for (const m of tresc.matchAll(SLOT_PELNA_SCIEZKA)) wynik.push({ plik, slot: m[0] })
    const skill = /^\.claude\/skills\/[a-z0-9-]+\//.exec(plik)?.[0]
    if (skill) for (const m of tresc.matchAll(SLOT_SKILLA)) wynik.push({ plik, slot: `${skill}${m[0]}` })
    if (!/\.m?js$/.test(plik)) continue
    for (const m of tresc.matchAll(IMPORT_WZGLEDNY)) {
      const cel = posix.normalize(posix.join(posix.dirname(plik), m[1]))
      if (sloty.includes(cel)) wynik.push({ plik, slot: cel })
    }
  }
  return wynik
}
