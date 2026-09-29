// Skladanie rekordow jednego runu: run + fazy + agenci. Wejscie z dysku (zrodla.mjs), git tylko dla plikow fixa.

import { statSync } from 'node:fs'
import { join } from 'node:path'

import { rekordyFaz } from './faza.mjs'
import { zmianyCommitow } from './git.mjs'
import { rekordRunu, statusBezHarnessu, statusRunu } from './run.mjs'
import { agenciRunu, czytajHarness, czytajJournal, katalogProjektu } from './zrodla.mjs'

/** @typedef {import('./zrodla.mjs').Run} Run */

/**
 * @typedef {object} RekordyRunu
 * @property {import('./run.mjs').RekordRunu} run
 * @property {import('./faza.mjs').RekordFazy[]} fazy
 * @property {import('./agent.mjs').RekordAgenta[]} agenci
 */

/** @param {Run} run @returns {number} czas ostatniego zapisu do katalogu runu (journal albo transkrypt) */
function ostatniaAktywnosc(run) {
  const journal = join(run.katalogRunu, 'journal.jsonl')
  try {
    return statSync(journal).mtimeMs
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return statSync(run.katalogRunu).mtimeMs
    throw e
  }
}

/**
 * Rekordy jednego runu; null = run w toku (pomijany do nastepnego skanu).
 * @param {Run} run
 * @param {{ terazMs: number, runyWToku: Set<string> }} kontekst runyWToku = runy prowadzone przez zywa sesje (z hooka)
 * @returns {RekordyRunu | null}
 */
export function rekordyRunu(run, kontekst) {
  const harness = czytajHarness(run)
  const status = harness
    ? statusRunu(harness)
    : statusBezHarnessu({ wTokuWSesji: kontekst.runyWToku.has(run.run), ostatniaAktywnoscMs: ostatniaAktywnosc(run), terazMs: kontekst.terazMs })
  if (!status) return null
  const agenci = agenciRunu(run)
  const journal = czytajJournal(run.katalogRunu)
  const bootstrap = agenci.find((a) => a.rola === 'bootstrap')
  const repo = katalogProjektu(run)
  return {
    run: rekordRunu({ harness, status, agenci, bootstrap: bootstrap ? journal.get(bootstrap.id)?.wynik : null }),
    fazy: rekordyFaz({
      wynikRunu: harness?.result,
      agenci,
      journal,
      zmianyFixa: (commity) => zmianyCommitow(repo, commity),
    }),
    agenci,
  }
}
