#!/usr/bin/env node
// Pliki docs/active/smoke-autopilot/ fixture'u smoke'a z planu technicznego generatorem planowania (PLAN-POPRAWY P13) —
// te same, ktore /dev-plan zapisuje w projekcie (`plan.mjs generuj`). Placeholdery {{KATALOG_KODU}} i {{MIGRACJA}} zostaja
// w plikach; przygotuj-kopie.sh podstawia je w kopii.
//
// Uzycie:  node .claude/templates/smoke-autopilot/generuj-fixture.mjs [--zapisz]
//   bez --zapisz: kod 1, gdy pliki fixture'u roznia sie od wyniku generatora (lista w polu "rozne" wyniku JSON)

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { zadanieZPlanu } from '../../scripts/plan/zadanie.mjs'

export const KATALOG = dirname(fileURLToPath(import.meta.url))
export const PLAN_TECHNICZNY = 'plan-techniczny-smoke-autopilot.md'
export const SCIEZKA_PLANU = `docs/plans/${PLAN_TECHNICZNY}`
export const NAZWA = 'smoke-autopilot'
// Data w naglowkach plikow zadania = data planu technicznego (frontmatter), zeby wynik byl powtarzalny.
const DATA = /^date:\s*(\d{4}-\d{2}-\d{2})$/m

/** @returns {Record<string, string>} nazwa pliku fixture'u → tresc z generatora */
export function plikiFixture() {
  const plan = readFileSync(join(KATALOG, PLAN_TECHNICZNY), 'utf8')
  const data = DATA.exec(plan)?.[1]
  if (!data) throw new Error(`${PLAN_TECHNICZNY}: brak daty we frontmatterze (date: RRRR-MM-DD)`)
  const projekt = mkdtempSync(join(tmpdir(), 'fixture-smoke-'))
  try {
    mkdirSync(join(projekt, 'docs/plans'), { recursive: true })
    writeFileSync(join(projekt, SCIEZKA_PLANU), plan)
    const zadanie = zadanieZPlanu(projekt, SCIEZKA_PLANU, { nazwa: NAZWA, data })
    if (zadanie.bledyBilansu.length) throw new Error(zadanie.bledyBilansu.join('\n'))
    return Object.fromEntries(Object.entries(zadanie.pliki).map(([rodzaj, tresc]) => [`${NAZWA}-${rodzaj}.md`, tresc]))
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const zapisz = process.argv.includes('--zapisz')
  const rozne = Object.entries(plikiFixture()).filter(([plik, tresc]) => {
    const sciezka = join(KATALOG, plik)
    const obecna = existsSync(sciezka) ? readFileSync(sciezka, 'utf8') : ''
    if (zapisz && obecna !== tresc) writeFileSync(sciezka, tresc)
    return obecna !== tresc
  }).map(([plik]) => plik)
  process.stdout.write(`${JSON.stringify({ ok: zapisz || !rozne.length, rozne, zapisane: zapisz ? rozne : [] })}\n`)
  process.exit(zapisz || !rozne.length ? 0 : 1)
}
