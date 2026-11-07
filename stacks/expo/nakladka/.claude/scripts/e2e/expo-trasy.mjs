// Trasy Expo Router do szkieletu skilla weryfikacji. Router wynika ze struktury plików, więc konfiguracji do odczytania nie ma. Bez `expo-router`
// w zależnościach `src/app` to zwykły katalog kodu. Monorepo z aplikacją w podkatalogu nie daje tu tras: szkielet zostawia znacznik do uzupełnienia.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PLIK_TRASY = /^(?:src\/)?app\/(.+)\.(?:tsx|ts|jsx|js)$/
const PLATFORMA = /\.(?:ios|android|native|web)$/
// `_layout` to układ, a pliki z `+` (+not-found, +html, +native-intent, +middleware, <x>+api) nie są ekranami, na które się wchodzi (docs Expo Router).
const NIE_EKRAN = /^_layout$|^\+|\+api$/
const GRUPA = /^\(.*\)$/

/** @param {string} projekt @returns {boolean} */
function maRouter(projekt) {
  const plik = join(projekt, 'package.json')
  if (!existsSync(plik)) return false
  try {
    const { dependencies = {}, devDependencies = {} } = JSON.parse(readFileSync(plik, 'utf8'))
    return 'expo-router' in dependencies || 'expo-router' in devDependencies
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    process.stderr.write(`weryfikacja: pomijam trasy Expo Router, nieczytelny ${plik}: ${e.message}\n`)
    return false
  }
}

/**
 * @param {string[]} pliki pliki kodu względem projektu, bez testów
 * @param {string} projekt
 * @returns {string[]} adresy ekranów, np. `/`, `/notatki/[id]`
 */
export function trasyExpoRouter(pliki, projekt) {
  if (!maRouter(projekt)) return []
  return pliki.flatMap((p) => {
    const trasa = PLIK_TRASY.exec(p)?.[1].replace(PLATFORMA, '')
    if (!trasa) return []
    const segmenty = trasa.split('/')
    if (NIE_EKRAN.test(segmenty.at(-1) ?? '')) return []
    const adres = segmenty.filter((s, i) => !GRUPA.test(s) && !(s === 'index' && i === segmenty.length - 1)).join('/')
    return [`/${adres}`]
  })
}
