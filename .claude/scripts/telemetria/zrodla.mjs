// Odczyt zrodel telemetrii z dysku (tylko odczyt). Uklad katalogow Claude Code (przeglad D5 §1):
//   <projekty>/<slug-projektu>/<sesja>/subagents/workflows/wf_<run>/{journal.jsonl, agent-<id>.jsonl, agent-<id>.meta.json}
//   <projekty>/<slug-projektu>/<sesja>/workflows/wf_<run>.json   — plik harnessu, powstaje dopiero po zakonczeniu runu

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { liczbaPolecen } from '../doctor/warstwa-stala.mjs'
import { rekordAgenta } from './agent.mjs'
import { agenciHarnessu, fazyAgentow } from './harness.mjs'
import { analizujTranskrypt } from './transkrypt.mjs'

export const KATALOG_PROJEKTOW = join(homedir(), '.claude', 'projects')

/**
 * @typedef {object} Run
 * @property {string} run wf_<id>
 * @property {string} sesja
 * @property {string} projektSlug
 * @property {string} katalogRunu
 * @property {string | null} plikHarnessu null = run w toku albo przerwany razem z sesja
 */

/** @param {string} katalog @returns {string[]} */
function podkatalogi(katalog) {
  if (!existsSync(katalog)) return []
  return readdirSync(katalog, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
}

/**
 * @param {string} [katalogProjektow]
 * @returns {Run[]}
 */
export function znajdzRuny(katalogProjektow = KATALOG_PROJEKTOW) {
  /** @type {Run[]} */
  const runy = []
  for (const projektSlug of podkatalogi(katalogProjektow)) {
    for (const sesja of podkatalogi(join(katalogProjektow, projektSlug))) {
      const katalogWf = join(katalogProjektow, projektSlug, sesja, 'subagents', 'workflows')
      for (const run of podkatalogi(katalogWf).filter((n) => n.startsWith('wf_'))) {
        const plik = join(katalogProjektow, projektSlug, sesja, 'workflows', `${run}.json`)
        runy.push({ run, sesja, projektSlug, katalogRunu: join(katalogWf, run), plikHarnessu: existsSync(plik) ? plik : null })
      }
    }
  }
  return runy
}

/**
 * Linie JSONL; uszkodzona linia (np. urwany zapis) jest pomijana i liczona — nie przerywa odczytu.
 * @param {string} plik
 * @returns {{ wpisy: Array<Record<string, unknown>>, uszkodzone: number }}
 */
export function czytajJsonl(plik) {
  /** @type {Array<Record<string, unknown>>} */
  const wpisy = []
  let uszkodzone = 0
  for (const linia of readFileSync(plik, 'utf8').split('\n')) {
    if (!linia.trim()) continue
    try {
      const o = JSON.parse(linia)
      if (o !== null && typeof o === 'object') wpisy.push(o)
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e
      uszkodzone++
    }
  }
  return { wpisy, uszkodzone }
}

/**
 * @param {string} katalogRunu
 * @returns {Map<string, import('./agent.mjs').WynikJournala>}
 */
export function czytajJournal(katalogRunu) {
  /** @type {Map<string, import('./agent.mjs').WynikJournala>} */
  const agenci = new Map()
  const plik = join(katalogRunu, 'journal.jsonl')
  if (!existsSync(plik)) return agenci
  for (const w of czytajJsonl(plik).wpisy) {
    const id = typeof w.agentId === 'string' ? w.agentId : null
    if (!id) continue
    if (w.type === 'started' && !agenci.has(id)) agenci.set(id, { rozpoczety: true, maWynik: false, wynik: null })
    if (w.type === 'result') agenci.set(id, { rozpoczety: true, maWynik: true, wynik: w.result ?? null })
  }
  return agenci
}

/**
 * Plik harnessu jako obiekt (null gdy brak — run w toku / przerwany).
 * @param {Run} run
 * @returns {Record<string, unknown> | null}
 */
export function czytajHarness(run) {
  if (!run.plikHarnessu) return null
  return JSON.parse(readFileSync(run.plikHarnessu, 'utf8'))
}

/**
 * Katalog projektu, w ktorym pracowal run (`cwd` wpisow transkryptu agenta) — potrzebny do `git show` commitow fixa.
 * @param {Run} run
 * @returns {string | null} null = run bez transkryptow
 */
export function katalogProjektu(run) {
  for (const plik of readdirSync(run.katalogRunu).filter((n) => n.startsWith('agent-') && n.endsWith('.jsonl'))) {
    const cwd = czytajJsonl(join(run.katalogRunu, plik)).wpisy.find((w) => typeof w.cwd === 'string')?.cwd
    if (typeof cwd === 'string') return cwd
  }
  return null
}

/**
 * Liczba instrukcji warstwy stalej roli: pozycje bloku `## Polecenia` pliku agenta w projekcie runu (ten sam licznik co
 * test szablonu i doctor). Plik czytany w chwili skanu — hook Stop skanuje zaraz po sesji, wiec to zwykle wersja z runu.
 * @param {string | null} repo katalog projektu runu
 * @param {string | null} agentType
 * @returns {number | null} null = brak projektu, typu, pliku albo bloku polecen
 */
export function instrukcjeStale(repo, agentType) {
  if (!repo || !agentType) return null
  const plik = join(repo, '.claude', 'agents', `${agentType}.md`)
  if (!existsSync(plik)) return null
  const polecen = liczbaPolecen(readFileSync(plik, 'utf8'))
  return polecen > 0 ? polecen : null
}

/**
 * Rekordy `agent` jednego runu — po jednym na transkrypt (takze wczesniejsze proby spoza workflowProgress).
 * @param {Run} run
 * @returns {Array<import('./agent.mjs').RekordAgenta>}
 */
export function agenciRunu(run) {
  const harness = czytajHarness(run)
  const postep = Array.isArray(harness?.workflowProgress) ? harness.workflowProgress : []
  const wpisyHarnessu = agenciHarnessu(postep)
  const fazy = fazyAgentow(postep)
  const journal = czytajJournal(run.katalogRunu)
  const pliki = readdirSync(run.katalogRunu).filter((n) => n.startsWith('agent-') && n.endsWith('.jsonl'))
  const repo = katalogProjektu(run)
  return pliki.map((plik) => {
    const id = plik.slice('agent-'.length, -'.jsonl'.length)
    const plikMeta = join(run.katalogRunu, `agent-${id}.meta.json`)
    const meta = existsSync(plikMeta) ? JSON.parse(readFileSync(plikMeta, 'utf8')) : {}
    const harness = wpisyHarnessu.get(id) ?? null
    return rekordAgenta({
      id,
      meta,
      harness,
      instrukcjeStale: instrukcjeStale(repo, harness?.agentType ?? meta.agentType ?? null),
      journal: journal.get(id) ?? null,
      analiza: analizujTranskrypt(czytajJsonl(join(run.katalogRunu, plik)).wpisy),
      faza: fazy.get(id) ?? null,
    })
  })
}
