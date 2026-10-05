// Wiedza projektu dla rekordu run.pr (P10): klasy bledow, ktore maja regule w indeksie (szczebel regula, poprawne pola).
// Stan w chwili zbierania rekordu — hook Stop zbiera zaraz po etapie zbierz, czyli przed compoundem tego PR.

import { existsSync } from 'node:fs'

import { pole, wczytajWpisy } from '../wiedza/wpisy.mjs'

/**
 * @param {string | null} repo katalog projektu runu
 * @returns {Set<string> | null} null = katalogu nie ma (nie wiadomo, czy regula byla)
 */
export function klasyZRegula(repo) {
  if (!repo || !existsSync(repo)) return null
  return new Set(wczytajWpisy(repo, null).wpisy.filter((w) => pole(w, 'szczebel') === 'regula').map((w) => pole(w, 'klasa')))
}
