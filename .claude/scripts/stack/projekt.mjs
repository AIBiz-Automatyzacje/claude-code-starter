// Sygnaly technologii projektu, jedno zrodlo dla walidacji planu i doctora (znaleziska 2026-11-02 pkt 26 i 31): dashboard
// ma klienta w frontend/ i backend w Pythonie, wiec sygnal liczony z samego korzenia klamal. Manifesty to package.json
// korzenia i katalogow pierwszego poziomu.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const POLA_ZALEZNOSCI = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
const ZALEZNOSC_SUPABASE = '@supabase/supabase-js'

/**
 * @param {string} projekt katalog projektu
 * @returns {string[]} sciezki package.json wzgledem projektu: korzen i katalogi pierwszego poziomu (bez ukrytych i node_modules)
 */
export function manifesty(projekt) {
  if (!existsSync(projekt)) return []
  const pakiety = readdirSync(projekt, { withFileTypes: true })
    .filter((k) => k.isDirectory() && !k.name.startsWith('.') && k.name !== 'node_modules')
    .map((k) => `${k.name}/package.json`)
    .sort()
  return ['package.json', ...pakiety].filter((m) => existsSync(join(projekt, m)))
}

/**
 * @param {string} projekt @param {string} nazwa nazwa paczki
 * @returns {string[]} manifesty, ktore maja paczke w zaleznosciach; manifest, ktory sie nie parsuje, nie jest sygnalem
 */
export function manifestyZZaleznoscia(projekt, nazwa) {
  return manifesty(projekt).filter((m) => {
    try {
      const pakiet = JSON.parse(readFileSync(join(projekt, m), 'utf8'))
      return POLA_ZALEZNOSCI.some((pole) => typeof pakiet?.[pole] === 'object' && pakiet[pole] !== null && nazwa in pakiet[pole])
    } catch {
      return false
    }
  })
}

/**
 * Projekt uzywa Supabase: katalog supabase/ albo zaleznosc @supabase/supabase-js w ktoryms z manifestow.
 * @param {string} projekt @returns {boolean}
 */
export function uzywaSupabase(projekt) {
  return existsSync(join(projekt, 'supabase')) || manifestyZZaleznoscia(projekt, ZALEZNOSC_SUPABASE).length > 0
}
