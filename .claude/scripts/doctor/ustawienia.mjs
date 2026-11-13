#!/usr/bin/env node
// Czesc doctor.sh czytajaca JSON (bez jq): pluginy projektu, Dynamic Workflows i tokeny kont w srodowisku. Wypisuje wiersze tabeli doctora
// jako TSV: element \t stan \t szczegol \t instalacja. Zly JSON w pliku ustawien = blad i exit ≠ 0 (doctor pokaze go jako UWAGA).
//
// Uzycie: node ustawienia.mjs <katalog-projektu>      (HOME wskazuje konto Claude Code: ~/.claude/…)

import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** @typedef {[string, string, string, string]} Wiersz */
/** @typedef {{ scope?: string, projectPath?: string, version?: string }} Instalacja */

/** @param {string} plik @returns {Record<string, unknown>} */
function czytajJson(plik) {
  if (!existsSync(plik)) return {}
  const dane = JSON.parse(readFileSync(plik, 'utf8'))
  return dane && typeof dane === 'object' ? dane : {}
}

/** @param {unknown} v @returns {Record<string, unknown>} */
const obiekt = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {})

/** @param {string} sciezka */
const normalna = (sciezka) => (existsSync(sciezka) ? realpathSync(sciezka) : sciezka).toLowerCase()

/**
 * Pluginy wlaczone w `.claude/settings.json` projektu (bez `@inline` — to wylaczniki pluginow claude.ai; `false` w settings.local.json
 * wygrywa jak w Claude Code) i ich instalacja:
 * zakres `user` albo `project`/`local` dla TEGO projektu (Claude Code zapisuje sciezke projektu przy instalacji).
 * @param {string} projekt
 * @param {string} dom
 * @returns {Wiersz[]}
 */
export function wierszePluginow(projekt, dom) {
  const ustawienia = czytajJson(join(projekt, '.claude', 'settings.json'))
  const wlaczone = Object.entries(obiekt(ustawienia.enabledPlugins))
    .filter(([id, wl]) => wl === true && !id.endsWith('@inline'))
    .map(([id]) => id)
  if (wlaczone.length === 0) return [['pluginy projektu', 'nie dotyczy', 'brak enabledPlugins w .claude/settings.json', '—']]

  const zainstalowane = obiekt(czytajJson(join(dom, '.claude', 'plugins', 'installed_plugins.json')).plugins)
  const znaneMarketplace = czytajJson(join(dom, '.claude', 'plugins', 'known_marketplaces.json'))
  const dodatkoweMarketplace = obiekt(ustawienia.extraKnownMarketplaces)
  const lokalne = obiekt(czytajJson(join(projekt, '.claude', 'settings.local.json')).enabledPlugins)
  const sciezkaProjektu = normalna(projekt)

  return wlaczone.map((id) => {
    if (lokalne[id] === false) return /** @type {Wiersz} */ ([`plugin ${id}`, 'nie dotyczy', 'wyłączony w .claude/settings.local.json', '—'])

    const lista = /** @type {Instalacja[]} */ (Array.isArray(zainstalowane[id]) ? zainstalowane[id] : [])
    const trafienie = lista.find((i) => i.scope === 'user' || (typeof i.projectPath === 'string' && normalna(i.projectPath) === sciezkaProjektu))
    if (trafienie) return /** @type {Wiersz} */ ([`plugin ${id}`, 'OK', `${trafienie.version ?? '?'} (${trafienie.scope})`, '—'])

    const marketplace = id.slice(id.indexOf('@') + 1)
    const repo = obiekt(obiekt(dodatkoweMarketplace[marketplace]).source).repo
    const dodaj = typeof repo === 'string' && !(marketplace in znaneMarketplace) ? `claude plugin marketplace add ${repo} && ` : ''
    return /** @type {Wiersz} */ ([`plugin ${id}`, 'UWAGA', 'nie zainstalowany', `${dodaj}claude plugin install ${id} --scope project`])
  })
}

/**
 * Dynamic Workflows: `enableWorkflows` (brak = wlaczone) i `disableWorkflows` w ustawieniach usera, projektu i lokalnych
 * (pozniejszy plik nadpisuje wczesniejszy) oraz zmienna CLAUDE_CODE_DISABLE_WORKFLOWS. Bez nich autopilot „nie istnieje”.
 * @param {string} projekt
 * @param {string} dom
 * @param {NodeJS.ProcessEnv} srodowisko
 * @returns {Wiersz}
 */
export function wierszWorkflowow(projekt, dom, srodowisko) {
  const element = 'Dynamic Workflows'
  if (srodowisko.CLAUDE_CODE_DISABLE_WORKFLOWS) {
    return [element, 'BRAK', 'wyłączone zmienną CLAUDE_CODE_DISABLE_WORKFLOWS', 'usuń zmienną CLAUDE_CODE_DISABLE_WORKFLOWS ze środowiska']
  }
  /** @type {{ enableWorkflows?: { wartosc: unknown, plik: string }, disableWorkflows?: { wartosc: unknown, plik: string } }} */
  const efektywne = {}
  const pliki = [join(dom, '.claude', 'settings.json'), join(projekt, '.claude', 'settings.json'), join(projekt, '.claude', 'settings.local.json')]
  for (const plik of pliki) {
    const ustawienia = czytajJson(plik)
    for (const klucz of /** @type {const} */ (['enableWorkflows', 'disableWorkflows'])) {
      if (klucz in ustawienia) efektywne[klucz] = { wartosc: ustawienia[klucz], plik }
    }
  }
  const wylacznik = efektywne.disableWorkflows?.wartosc === true ? efektywne.disableWorkflows
    : efektywne.enableWorkflows?.wartosc === false ? efektywne.enableWorkflows : undefined
  if (wylacznik) {
    const klucz = wylacznik === efektywne.disableWorkflows ? 'disableWorkflows: true' : 'enableWorkflows: false'
    return [element, 'BRAK', `wyłączone: ${klucz} w ${wylacznik.plik}`, `/config → Dynamic workflows: true (albo usuń ${klucz} z tego pliku)`]
  }
  return [element, 'OK', efektywne.enableWorkflows ? 'włączone (enableWorkflows: true)' : 'włączone (domyślnie)', '—']
}

// Pilot mobile W1/W8 (2026-11-09): SUPABASE_ACCESS_TOKEN i EXPO_TOKEN w srodowisku shella operatora daja kazdej sesji i kazdemu
// agentowi dostep do calego konta (wszystkie projekty Supabase, buildy i publikacje EAS), takze w projekcie bez plikow .env.
// Szablon potrzebuje tokenu Supabase tylko w .env.e2e (advisors, token projektu e2e), a EXPO_TOKEN wcale.
export const TOKENY_KONT = [
  ['SUPABASE_ACCESS_TOKEN', 'konto Supabase: wszystkie projekty'],
  ['EXPO_TOKEN', 'konto Expo: buildy i publikacje EAS'],
]

/**
 * Tokeny kont w srodowisku, z ktorego sesja uruchamia doctor. Klucz w `env` ustawien projektu (settings.json albo
 * settings.local.json) zastepuje wartosc dla sesji tego projektu — wtedy OK. Wartosci nigdy nie trafiaja do wiersza.
 * @param {string} projekt @param {NodeJS.ProcessEnv} srodowisko @returns {Wiersz}
 */
export function wierszTokenow(projekt, srodowisko) {
  const element = 'tokeny kont w środowisku'
  const zastapione = new Set()
  for (const plik of ['settings.json', 'settings.local.json']) {
    for (const klucz of Object.keys(obiekt(czytajJson(join(projekt, '.claude', plik)).env))) zastapione.add(klucz)
  }
  const widoczne = TOKENY_KONT.filter(([klucz]) => srodowisko[klucz] && !zastapione.has(klucz))
  if (!widoczne.length) {
    const z = TOKENY_KONT.filter(([klucz]) => zastapione.has(klucz)).map(([klucz]) => klucz)
    return [element, 'OK', z.length ? `zastąpione w .claude/settings*.json: ${z.join(', ')}` : 'brak tokenów kont w środowisku', '—']
  }
  const opis = widoczne.map(([klucz, zakres]) => `${klucz} (${zakres})`).join('; ')
  return [element, 'UWAGA', `widoczne dla każdej sesji i agenta: ${opis}`,
    `usuń z profilu shella (~/.zshrc, ~/.bashrc) albo zastąp w projekcie: "env": { ${widoczne.map(([k]) => `"${k}": ""`).join(', ')} } w .claude/settings.local.json; token Supabase do advisors trzymaj w .env.e2e (token projektu e2e)`]
}

const projekt = process.argv[2]
if (!projekt) {
  process.stderr.write('Użycie: node ustawienia.mjs <katalog-projektu>\n')
  process.exit(2)
}
for (const w of [...wierszePluginow(projekt, homedir()), wierszWorkflowow(projekt, homedir(), process.env), wierszTokenow(projekt, process.env)]) {
  process.stdout.write(`${w.join('\t')}\n`)
}
