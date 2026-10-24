// Uslugi z lista dozwolonych hostow (P28 (6), pilot etapu 5): strona i ramki narzedzia stoja pod http://127.0.0.1:<port>,
// wiec projekt z Supabase potrzebuje tego adresu w Redirect URLs (logowanie dostawca OAuth), a projekt z Cloudflare
// Turnstile — w hostach widgetu (inaczej captcha w ramkach konczy sie bledem). Wykrycie po zaleznosciach package.json.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** @param {string} projekt @returns {string[]} nazwy zaleznosci (dependencies i devDependencies); zly albo brak package.json = [] */
function zaleznosci(projekt) {
  const plik = join(projekt, 'package.json')
  if (!existsSync(plik)) return []
  /** @type {unknown} */
  let m
  try {
    m = JSON.parse(readFileSync(plik, 'utf8'))
  } catch (b) {
    // Zly package.json zglasza runner testow projektu; tu tylko brak podpowiedzi o hostach.
    if (b instanceof SyntaxError) return []
    throw b
  }
  if (!m || typeof m !== 'object') return []
  return ['dependencies', 'devDependencies'].flatMap((k) => {
    const z = /** @type {Record<string, unknown>} */ (m)[k]
    return z && typeof z === 'object' ? Object.keys(z) : []
  })
}

/**
 * @param {string} projekt
 * @param {number} port port narzedzia
 * @returns {string[]} uslugi, w ktorych operator dopisuje adres narzedzia przed logowaniem w ramkach
 */
export function hostyDoDopisania(projekt, port) {
  const nazwy = zaleznosci(projekt)
  const wynik = []
  if (nazwy.some((n) => n.startsWith('@supabase/'))) {
    wynik.push(`Supabase (logowanie OAuth): Authentication → URL Configuration → Redirect URLs — dopisz http://127.0.0.1:${port}/** (bez wpisu działa logowanie hasłem)`)
  }
  if (nazwy.some((n) => /turnstile/i.test(n))) {
    wynik.push('Cloudflare Turnstile: Turnstile → widget → Hostname Management — dopisz 127.0.0.1 (bez wpisu captcha w ramkach kończy się błędem)')
  }
  return wynik
}
