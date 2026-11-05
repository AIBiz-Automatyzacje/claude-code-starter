#!/usr/bin/env node
// Świeżość dev-clienta na koniec runu. Bramka natywna biegnie w `e2e.mjs restart` przed testerem fazy ze scenariuszami, więc nie widzi zmiany
// natywnej z ostatniej fazy bez scenariuszy ani z fixa. Smoke operatora woła ten skrypt przed zapisem startu aplikacji
// (slot dev-docs-complete/references/stack.md). Wynik: JSON w jednej linii. Kod wyjścia zawsze 0, bo to informacja do smoke'u, nie STOP.
//
// Użycie: node .claude/scripts/e2e/expo-swiezosc.mjs [katalog projektu]

import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { aplikacjaProjektu, przygotujUrzadzenie, wykonaj } from './expo-urzadzenie.mjs'
import { envE2e } from './srodowisko.mjs'

/**
 * @param {string} projekt @param {Record<string, string>} env @param {import('./expo-urzadzenie.mjs').Wykonaj} [wykonajKomende]
 * @returns {{ ok: boolean, przebudowa: boolean, detal: string, naprawa: string }}
 */
export function swiezosc(projekt, env, wykonajKomende = wykonaj) {
  const aplikacja = aplikacjaProjektu(projekt, wykonajKomende)
  if (!aplikacja) return { ok: true, przebudowa: false, detal: 'repo bez konfiguracji Expo', naprawa: '' }
  const w = przygotujUrzadzenie(projekt, aplikacja, env, wykonajKomende)
  if (w.ok) return { ok: true, przebudowa: false, detal: [`${w.urzadzenie.platforma} ${w.urzadzenie.nazwa}`, ...w.uwagi].join('; '), naprawa: '' }
  return { ok: false, przebudowa: w.przebudowa === true, detal: w.detal, naprawa: w.naprawa }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projekt = process.argv[2] ?? process.cwd()
  process.stdout.write(`${JSON.stringify(swiezosc(projekt, envE2e(projekt) ?? {}))}\n`)
}
