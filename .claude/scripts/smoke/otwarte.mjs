#!/usr/bin/env node
// Otwarte sprawy po automacie (punkt 40, krok 6; punkt 45). Raport konczyl sie zdaniem modelu „zamkniete w calosci”, choc smoke
// mial nieodhaczone pozycje, a sprawy odlozone w smoke'u nie trafialy nigdzie dalej. Skrypt liczy z plikow, nie z pamieci sesji:
// - pozycje smoke'u zadania: nieodhaczone checkboxy najnowszego `docs/operator/<data>-<zadanie>-smoke.md` (osobno te z dopiskiem
//   „po deployu”, ktore z definicji czekaja na wdrozenie);
// - sprawy odlozone projektu: nieodhaczone linie `- [ ] [etap: <etykieta>] …` w `docs/operator/odlozone.md` (format skilla /dev-smoke).
// - decyzje poprzednich zadan bez rozstrzygniecia (weryfikacja partii, punkt 52): wiersze `- [DECYZJA …` sekcji „## Decyzje operatora”
//   w `docs/completed/*/known-issues.md` bez dopisku „ROZSTRZYGNIĘTA” (smoke pominiety albo przerwany) — tylko bez --zadanie.
// Czytaja go raporty (autopilot, archiwizacja, /dev-pr), bramka gotowosci planu i /dev-prep.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   otwarte.mjs [--zadanie <nazwa>]     bez --zadanie: tylko sprawy odlozone
// Wynik: JSON w jednej linii { ok, smoke: { plik, otwarte, poDeployu } | null, odlozone: { plik, otwarte: [{ linia, etap, tresc }] },
// decyzje?: [{ zadanie, wiersz }] (tylko bez --zadanie), zdanie }. Kod wyjscia: 0 = ok, 2 = zle argumenty, 3 = wyjatek.

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3
export const PLIK_ODLOZONYCH = 'docs/operator/odlozone.md'
const KATALOG_OPERATORA = 'docs/operator'
const KATALOG_ARCHIWUM = 'docs/completed'
const SEKCJA_DECYZJI = '## Decyzje operatora'

/**
 * @param {string} tresc zawartosc docs/operator/odlozone.md
 * @returns {{ linia: number, etap: string, tresc: string }[]} nieodhaczone pozycje z etykieta etapu
 */
export function parsujOdlozone(tresc) {
  return tresc.replace(/\r\n/g, '\n').split('\n').flatMap((l, i) => {
    const m = /^\s*- \[ \] \[etap: ([^\]]+)\]\s*(.+)$/.exec(l)
    return m ? [{ linia: i + 1, etap: (m[1] ?? '').trim(), tresc: (m[2] ?? '').trim() }] : []
  })
}

/**
 * @param {string} tresc zawartosc pliku smoke'u
 * @returns {{ otwarte: number, poDeployu: number }} nieodhaczone checkboxy; poDeployu = te z dopiskiem „po deployu”
 */
export function liczSmoke(tresc) {
  const linie = tresc.replace(/\r\n/g, '\n').split('\n').filter((l) => /^\s*- \[ \]/.test(l))
  return { otwarte: linie.length, poDeployu: linie.filter((l) => /po deployu/i.test(l)).length }
}

/** @param {string} projekt @param {string} zadanie @returns {string | null} najnowszy plik smoke'u zadania wzgledem projektu */
export function plikSmoke(projekt, zadanie) {
  const katalog = join(projekt, KATALOG_OPERATORA)
  if (!existsSync(katalog)) return null
  // Data i dokladnie nazwa zadania: „maly-sklep” nie jest smoke'iem zadania „sklep”.
  const nazwy = readdirSync(katalog).filter((n) => /^\d{4}-\d{2}-\d{2}-/.test(n) && n.slice(11) === `${zadanie}-smoke.md`).sort()
  const ostatni = nazwy.at(-1)
  return ostatni ? `${KATALOG_OPERATORA}/${ostatni}` : null
}

/**
 * Decyzje zadan z archiwum, ktorych nikt nie rozstrzygnal: smoke pominiety albo przerwany zostawia wiersz sekcji decyzji bez dopisku.
 * @param {string} projekt
 * @returns {{ zadanie: string, wiersz: string }[]} wiersz bez „- ” na poczatku
 */
export function decyzjeNierozstrzygniete(projekt) {
  const katalog = join(projekt, KATALOG_ARCHIWUM)
  if (!existsSync(katalog)) return []
  return readdirSync(katalog, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().flatMap((zadanie) => {
    const plik = join(katalog, zadanie, 'known-issues.md')
    if (!existsSync(plik)) return []
    let wSekcji = false
    return readFileSync(plik, 'utf8').replace(/\r\n/g, '\n').split('\n').flatMap((l) => {
      if (l.startsWith('## ')) wSekcji = l.trimEnd() === SEKCJA_DECYZJI
      if (!wSekcji || !l.startsWith('- [DECYZJA') || l.includes('ROZSTRZYGNIĘTA')) return []
      return [{ zadanie, wiersz: l.slice(2).trim() }]
    })
  })
}

/**
 * Punkt 52: `poDeployu` liczyl sie, a nikt go nie czytal — zdanie podaje teraz, ile otwartych pozycji czeka na wdrozenie.
 * Zdanie zaczyna sie zawsze od „Otwarte: ” (archiwizacja przyjmuje tylko taki poczatek).
 * @param {{ smoke: { otwarte: number, poDeployu?: number } | null, odlozone: { otwarte: unknown[] } }} w
 * @returns {string} zdanie do raportu; przy zerze mowi to wprost
 */
export function zdanieOtwartych({ smoke, odlozone }) {
  const n = smoke?.otwarte ?? 0
  const k = smoke?.poDeployu ?? 0
  const m = odlozone.otwarte.length
  if (!n && !m) return `Otwarte: brak${smoke ? ' (smoke odhaczony' : ' (bez smoke\'u'}, nic odłożonego).`
  const czesci = [smoke ? `${n} pozycji smoke'u${k > 0 ? ` (w tym ${k} po deployu)` : ''}` : null, `${m} odłożonych (${PLIK_ODLOZONYCH})`].filter(Boolean)
  return `Otwarte: ${czesci.join(', ')}.`
}

/**
 * @param {string} projekt @param {{ zadanie?: string }} [o]
 */
export function otwarte(projekt, { zadanie } = {}) {
  const sciezkaSmoke = zadanie ? plikSmoke(projekt, zadanie) : null
  const smoke = sciezkaSmoke ? { plik: sciezkaSmoke, ...liczSmoke(readFileSync(join(projekt, sciezkaSmoke), 'utf8')) } : null
  const plikOdl = join(projekt, PLIK_ODLOZONYCH)
  const odlozone = { plik: PLIK_ODLOZONYCH, otwarte: existsSync(plikOdl) ? parsujOdlozone(readFileSync(plikOdl, 'utf8')) : [] }
  // Z --zadanie pozycje D<n> liczy juz plik smoke'u tego zadania; bez niego (planowanie, /dev-prep) — decyzje calego archiwum.
  return { ok: true, smoke, odlozone, ...(zadanie ? {} : { decyzje: decyzjeNierozstrzygniete(projekt) }), zdanie: zdanieOtwartych({ smoke, odlozone }) }
}

// realpath i fileURLToPath: sciezka ze spacja albo polskimi znakami jest w URL-u zakodowana (%20), /var → /private/var.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @type {{ projekt?: string, zadanie?: string }} */
  let o = {}
  try {
    o = parseArgs({ options: { projekt: { type: 'string' }, zadanie: { type: 'string' } } }).values
    if (o.zadanie !== undefined && !/^[\w.-]+$/.test(o.zadanie)) throw new Error('zla nazwa --zadanie')
  } catch (blad) {
    process.stderr.write(`otwarte: ${blad instanceof Error ? blad.message : String(blad)}\nUzycie: otwarte.mjs [--zadanie <nazwa>] [--projekt <katalog>]\n`)
    process.exit(KOD_ZLYCH_ARGUMENTOW)
  }
  try {
    process.stdout.write(`${JSON.stringify(otwarte(o.projekt ?? process.cwd(), { zadanie: o.zadanie }))}\n`)
  } catch (blad) {
    process.stdout.write(`${JSON.stringify({ ok: false, wyjatek: blad instanceof Error ? blad.message : String(blad) })}\n`)
    process.exit(KOD_WYJATKU)
  }
}
