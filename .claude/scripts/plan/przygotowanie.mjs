// Checklista przygotowania operatora (`operator_prep` planu, /dev-prep i /dev-plan): pozycje z markerem `[blokuje: …]`.
// Jedna rodzina markerow w pipeline: `[blokuje: planowanie]` i `[blokuje: faza N]`.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @typedef {{ linia: number, tresc: string, faza: number | null }} Bloker
 * @typedef {{ sciezka: string, istnieje: boolean, blokujace: Bloker[], odroczone: Bloker[] }} Przygotowanie
 */

/** @param {string | null | undefined} v @returns {string | null} sciezka wzgledna bez `./` */
export function sciezkaWzgledna(v) {
  return v ? v.replace(/^\.\//, '') : null
}

/**
 * Nieodhaczone pozycje z markerem: start blokuja `planowanie`, `faza 1` i marker bez czytelnego numeru fazy;
 * `faza N` dla N >= 2 nie blokuje startu, ale trafia do planu zadania, zeby operator widzial ja w trakcie runu.
 * @param {string} md
 * @returns {{ blokujace: Bloker[], odroczone: Bloker[] }}
 */
export function blokery(md) {
  /** @type {Bloker[]} */
  const blokujace = []
  /** @type {Bloker[]} */
  const odroczone = []
  md.split('\n').forEach((l, i) => {
    if (!/^- \[ \].*\[blokuje:/.test(l)) return
    const n = /\[blokuje:\s*faza\s+(\d+)\s*\]/.exec(l)
    const b = { linia: i + 1, tresc: l.replace(/^- \[ \]\s*/, ''), faza: n ? Number(n[1]) : null }
    if (b.faza !== null && b.faza >= 2) odroczone.push(b)
    else blokujace.push(b)
  })
  return { blokujace, odroczone }
}

/**
 * @param {string} projekt
 * @param {string | null} sciezka `operator_prep` z frontmattera planu
 * @returns {Przygotowanie | null} null gdy plan nie ma checklisty
 */
export function przygotowanie(projekt, sciezka) {
  const s = sciezkaWzgledna(sciezka)
  if (!s) return null
  const plik = join(projekt, s)
  if (!existsSync(plik)) return { sciezka: s, istnieje: false, blokujace: [], odroczone: [] }
  return { sciezka: s, istnieje: true, ...blokery(readFileSync(plik, 'utf8')) }
}
