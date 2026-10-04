// Zmiany fazy do dossier: lista plikow ze statusem i liczbami linii oraz pelny diff (z kontekstem) do pliku, ktory
// reviewerzy czytaja jednym Read zamiast kazdy odpalac wlasny `git diff`. Baza = commit sprzed fazy; stan = drzewo
// robocze, wiec diff obejmuje commity fazy, zmiany niezacommitowane i pliki niesledzone (jak bramki — diff.mjs).

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { git } from '../bramki/diff.mjs'

// ~75k tokenow: gorna granica, przy ktorej reviewer ma jeszcze miejsce na dossier i wlasne Read.
export const LIMIT_DIFFU_B = 300 * 1024
export const ZNACZNIK_UCIECIA = '=== DIFF PRZYCIETY (limit 300 KB) — dalsza czesc zmian fazy NIE jest w tym pliku ==='
// Galezie glowne w kolejnosci proby — baza zastepcza, gdy wolajacy nie zna bazy fazy.
const GALEZIE_GLOWNE = ['origin/main', 'main', 'origin/master', 'master']
// Stan autopilota (docs/active/<zadanie>/.autopilot-state.json) to artefakt pipeline'u, nie zmiana fazy — poza lista i diffem.
const BEZ_STANU = ':(exclude,glob)**/.autopilot-state.json'

/** @typedef {{ plik: string, status: 'A' | 'M' | 'D', dodane: number, usuniete: number }} PlikFazy */

/** @param {string} tekst @returns {string[]} */
const linie = (tekst) => tekst.split('\n').filter(Boolean)

/**
 * Diff pliku niesledzonego (git diff --no-index konczy sie kodem 1, gdy sa roznice — to nie blad).
 * @param {string} projekt
 * @param {string} plik
 * @returns {string}
 */
function diffNiesledzonego(projekt, plik) {
  const p = spawnSync('git', ['-C', projekt, 'diff', '--no-color', '--no-index', '--', '/dev/null', plik], { encoding: 'utf8' })
  if (p.status !== 0 && p.status !== 1) throw new Error(`git diff --no-index ${plik}: ${p.stderr}`)
  return p.stdout
}

/**
 * @param {string} projekt katalog projektu (repo git albo jego podkatalog)
 * @param {string} baza commit sprzed fazy
 * @returns {{ pliki: PlikFazy[], diff: string }}
 */
export function zmianyDossier(projekt, baza) {
  const opcje = ['--no-color', '--no-renames', '--no-ext-diff', '--relative']
  /** @type {Map<string, PlikFazy>} */
  const pliki = new Map()
  for (const wiersz of linie(git(projekt, ['diff', '--name-status', ...opcje, baza, '--', BEZ_STANU]))) {
    const [status, plik] = wiersz.split('\t')
    const s = status === 'A' || status === 'D' ? status : 'M'
    pliki.set(plik, { plik, status: s, dodane: 0, usuniete: 0 })
  }
  for (const wiersz of linie(git(projekt, ['diff', '--numstat', ...opcje, baza, '--', BEZ_STANU]))) {
    const [dodane, usuniete, plik] = wiersz.split('\t')
    const wpis = pliki.get(plik)
    // Plik binarny: numstat podaje "-" zamiast liczb.
    if (wpis) Object.assign(wpis, { dodane: Number(dodane) || 0, usuniete: Number(usuniete) || 0 })
  }
  const niesledzone = linie(git(projekt, ['ls-files', '--others', '--exclude-standard', '--', BEZ_STANU]))
  for (const plik of niesledzone) {
    const dodane = linie(readFileSync(join(projekt, plik), 'utf8')).length
    pliki.set(plik, { plik, status: 'A', dodane, usuniete: 0 })
  }
  const diff = git(projekt, ['diff', ...opcje, baza, '--', BEZ_STANU]) + niesledzone.map((p) => diffNiesledzonego(projekt, p)).join('')
  return { pliki: [...pliki.values()].sort((a, b) => a.plik.localeCompare(b.plik)), diff }
}

/**
 * Zapis diffu do pliku; powyzej limitu przyciety ze znacznikiem na koncu.
 * @param {string} diff
 * @param {string} plik
 * @param {number} [limit]
 * @returns {{ zapisany: boolean, uciety: boolean }}
 */
export function zapiszDiff(diff, plik, limit = LIMIT_DIFFU_B) {
  if (!diff) return { zapisany: false, uciety: false }
  const bajty = Buffer.from(diff, 'utf8')
  const uciety = bajty.length > limit
  writeFileSync(plik, uciety ? `${bajty.subarray(0, limit).toString('utf8')}\n${ZNACZNIK_UCIECIA}\n` : diff)
  return { zapisany: true, uciety }
}

/**
 * Baza, gdy wolajacy jej nie zna (review uruchomione samodzielnie, swiezy run po STOP-ie): merge-base HEAD z galezia
 * glowna — zakres moze wtedy objac wczesniejsze fazy zadania. Bez galezi glownej: HEAD (tylko zmiany niezacommitowane).
 * @param {string} projekt
 * @returns {string}
 */
export function bazaZastepcza(projekt) {
  for (const galaz of GALEZIE_GLOWNE) {
    const p = spawnSync('git', ['-C', projekt, 'merge-base', 'HEAD', galaz], { encoding: 'utf8' })
    if (p.status === 0) return p.stdout.trim()
  }
  return 'HEAD'
}
