// Wersje paczek SDK przed startem autopilota: uwaga do bramki gotowości /dev-plan. Lista oczekiwanych wersji przychodzi z sieci, więc
// projekt bez zmian przestaje ją spełniać po nowym patchu SDK. Bramka stacku zgłasza taki rozjazd jako ostrzeżenie dopiero po fazie
// zmieniającej zależności (pilot Nawykometr, run 2: 18 zastanych paczek); tu operator widzi go, zanim ruszy run, i decyduje o podbiciu.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const LIMIT_MS = 60_000
const ILE_NAZW = 5
const WIERSZ = /^\s*(@?[\w./-]+)@\S+ - expected version: \S+\s*$/gm

/** @param {string} wyjscie `expo install --check` @returns {string[]} paczki z wersją inną niż oczekiwana */
export function paczkiDoPodbicia(wyjscie) {
  return [...wyjscie.matchAll(WIERSZ)].map((m) => m[1])
}

/**
 * Projekt bez zainstalowanego `expo` (repo od zera, katalog bez `node_modules`) nie ma czego sprawdzać.
 * @param {string} projekt @returns {string | null} uwaga albo null, gdy wersje się zgadzają
 */
export function uwagaPaczekSdk(projekt) {
  if (!existsSync(join(projekt, 'node_modules', 'expo'))) return null
  // CI=1: bez pytania o instalację; kod 1 z listą paczek to wynik, nie błąd.
  const p = spawnSync('npx', ['expo', 'install', '--check'], { cwd: projekt, encoding: 'utf8', timeout: LIMIT_MS, env: { ...process.env, CI: '1' } })
  if (!p.error && p.status === 0) return null
  const paczki = paczkiDoPodbicia(`${p.stdout ?? ''}\n${p.stderr ?? ''}`)
  if (!paczki.length) return `wersji paczek SDK nie sprawdzono (npx expo install --check: ${p.error ? p.error.message : `kod ${p.status}`})`
  const nazwy = `${paczki.slice(0, ILE_NAZW).join(', ')}${paczki.length > ILE_NAZW ? ', …' : ''}`
  return `${paczki.length} paczek SDK ma inną wersję, niż oczekuje zainstalowane Expo (${nazwy}): faza zmieniająca zależności zgłosi je jako ostrzeżenie bramki stack. Podbicie przed startem to decyzja operatora: npx expo install --fix (osobny commit, potem przebudowa dev-clienta)`
}
