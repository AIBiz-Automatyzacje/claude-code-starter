// Sygnaly technologii projektu, jedno zrodlo dla walidacji planu i doctora (znaleziska 2026-11-02 pkt 26 i 31): dashboard
// ma klienta w frontend/ i backend w Pythonie, wiec sygnal liczony z samego korzenia klamal. Manifesty to package.json
// korzenia i katalogow pierwszego poziomu.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const POLA_ZALEZNOSCI = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
const GLEBOKOSC_SUPABASE = 3
const POMIJANE = new Set(['node_modules', 'dist', 'build'])

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
 * @param {string} projekt @param {number} glebokosc
 * @returns {string[]} katalogi wzgledem projektu do zadanej glebokosci ('' = korzen), bez ukrytych, node_modules, dist i build
 */
function katalogi(projekt, glebokosc) {
  /** @type {string[]} */
  const wynik = ['']
  /** @param {string} rel @param {number} poziom */
  const zejdz = (rel, poziom) => {
    if (poziom >= glebokosc) return
    let wpisy
    try {
      wpisy = readdirSync(join(projekt, rel), { withFileTypes: true })
    } catch {
      return
    }
    for (const k of wpisy.filter((w) => w.isDirectory() && !w.name.startsWith('.') && !POMIJANE.has(w.name)).sort((a, b) => a.name.localeCompare(b.name))) {
      const sciezka = rel ? `${rel}/${k.name}` : k.name
      wynik.push(sciezka)
      zejdz(sciezka, poziom + 1)
    }
  }
  if (existsSync(projekt)) zejdz('', 0)
  return wynik
}

/**
 * Weryfikacja partii 26–45, punkt 55 (26): sygnal liczony z korzenia i pierwszego poziomu dawal „nie dotyczy” przy Supabase
 * w apps/web/, w requirements.txt, przy samym @supabase/ssr i przy zepsutym package.json. Brak trafienia przy nieczytelnym
 * manifescie to „nieznane”, nie „nie” (ta sama zasada co przy wariancie szablonu: brak trafienia nie jest dowodem).
 * @param {string} projekt
 * @returns {{ sygnal: 'tak' | 'nie' | 'nieznane', nieczytelne: string[] }} nieczytelne = package.json, ktore sie nie parsuja
 */
export function stanSupabase(projekt) {
  if (existsSync(join(projekt, 'supabase'))) return { sygnal: 'tak', nieczytelne: [] }
  const dirs = katalogi(projekt, GLEBOKOSC_SUPABASE)
  if (dirs.some((d) => d.split('/').pop() === 'supabase' && existsSync(join(projekt, d, 'config.toml')))) return { sygnal: 'tak', nieczytelne: [] }
  /** @type {string[]} */
  const nieczytelne = []
  for (const d of dirs) {
    const m = d ? `${d}/package.json` : 'package.json'
    if (!existsSync(join(projekt, m))) continue
    try {
      const pakiet = JSON.parse(readFileSync(join(projekt, m), 'utf8'))
      const zSupabase = POLA_ZALEZNOSCI.some((pole) => typeof pakiet?.[pole] === 'object' && pakiet[pole] !== null && Object.keys(pakiet[pole]).some((n) => n.startsWith('@supabase/')))
      if (zSupabase) return { sygnal: 'tak', nieczytelne: [] }
    } catch {
      nieczytelne.push(m)
    }
  }
  const python = dirs.filter((d) => !d.includes('/')).flatMap((d) => ['requirements.txt', 'pyproject.toml'].map((p) => (d ? `${d}/${p}` : p)))
  for (const p of python) {
    if (!existsSync(join(projekt, p))) continue
    // Walidacja 51–55, punkt 58: w pyproject.toml lista zaleznosci bywa w jednej linii (`dependencies = ["fastapi", "supabase>=2"]`),
    // wiec nazwa w cudzyslowie liczy sie takze w srodku linii; linia komentarza nie.
    const wzor = p.endsWith('pyproject.toml') ? /^\s*supabase(?![\w-])|^[^#]*["']supabase(?![\w-])/i : /^\s*["']?supabase(?![\w-])/i
    if (readFileSync(join(projekt, p), 'utf8').split('\n').some((l) => wzor.test(l))) return { sygnal: 'tak', nieczytelne: [] }
  }
  return { sygnal: nieczytelne.length ? 'nieznane' : 'nie', nieczytelne }
}

/** @param {string} projekt @returns {'tak' | 'nie' | 'nieznane'} */
export function sygnalSupabase(projekt) {
  return stanSupabase(projekt).sygnal
}

/**
 * Projekt (byc moze) uzywa Supabase: wszystko poza pewnym „nie” — uwaga o migracjach w walidacji planu woli falszywy alarm
 * niz przegapiona migracje.
 * @param {string} projekt @returns {boolean}
 */
export function uzywaSupabase(projekt) {
  return sygnalSupabase(projekt) !== 'nie'
}
