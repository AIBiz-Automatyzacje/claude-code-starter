// Sciezki artefaktow fazy (deterministyczne z zadania i fazy — ponowne uruchomienie nadpisuje te same pliki).
// Ten sam wzor nazwy pliku bramek liczy dev-docs-execute-wf.js (plikBramek) — test pilnuje zgodnosci.

import { join } from 'node:path'

/**
 * @param {string} wyjscie katalog plikow
 * @param {string} sciezka katalog zadania
 * @param {number} faza
 * @returns {{ diff: string, dossier: string, bramki: string }}
 */
export function sciezkiArtefaktow(wyjscie, sciezka, faza) {
  const zadanie = sciezka.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return {
    diff: join(wyjscie, `review-diff-${zadanie}-faza-${faza}.diff`),
    dossier: join(wyjscie, `review-ctx-${zadanie}-faza-${faza}.md`),
    bramki: join(wyjscie, `bramki-${zadanie}-faza-${faza}.json`),
  }
}
