// Fixture smoke'a (PLAN-POPRAWY P13): plan techniczny w formacie /dev-plan przechodzi walidacje po podstawieniu
// placeholderow, a pliki docs/active/smoke-autopilot/ sa wynikiem generatora planowania — nie recznym zapisem.
//
// Uruchomienie:  node --test .claude/templates/smoke-autopilot/__tests__/fixture-zadania.test.mjs
//
// DLACZEGO: smoke ma cwiczyc ten format zadania, ktory autopilot dostaje od /dev-plan. Recznie pisany fixture rozjechal sie
// z generatorem (inne naglowki IU i checkboxy), wiec smoke sprawdzal format, ktorego zaden projekt juz nie dostaje.
// Regeneracja po zmianie planu albo generatora: node .claude/templates/smoke-autopilot/generuj-fixture.mjs --zapisz

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { parsujPlan } from '../../../scripts/plan/plan-techniczny.mjs'
import { sprawdzPlan } from '../../../scripts/plan/walidacja-planu.mjs'
import { KATALOG, PLAN_TECHNICZNY, SCIEZKA_PLANU, plikiFixture } from '../generuj-fixture.mjs'

const MIGRACJA = 'supabase/migrations/20260101000000_start.sql'
const KATALOG_KODU = 'packages/smoke-autopilot/src'
const KATALOG_STRONY = 'apps/dashboard/public'

/** @param {string} tresc @param {boolean} zMigracja @returns {string} podstawienie jak `podstaw` w przygotuj-kopie.sh */
function podstaw(tresc, zMigracja) {
  const kod = tresc.replaceAll('{{KATALOG_KODU}}', KATALOG_KODU).replaceAll('{{KATALOG_STRONY}}', KATALOG_STRONY)
  return zMigracja ? kod.replaceAll('{{MIGRACJA}}', MIGRACJA) : kod.split('\n').filter((l) => !l.includes('{{MIGRACJA}}')).join('\n')
}

/** @param {boolean} zMigracja @returns {{ bledy: string[], uwagi: string[] }} */
function walidacjaWKopii(zMigracja) {
  const plan = podstaw(readFileSync(join(KATALOG, PLAN_TECHNICZNY), 'utf8'), zMigracja)
  const korzen = mkdtempSync(join(tmpdir(), 'fixture-smoke-kopia-'))
  try {
    // .env.e2e: plan ma scenariusze [E2E], a walidacja wymaga srodowiska albo pozycji setupu w checkliscie przygotowania.
    const pliki = { [SCIEZKA_PLANU]: plan, '.env.e2e': '', ...(zMigracja ? { [MIGRACJA]: 'create table t (id int);\n' } : {}) }
    for (const [sciezka, tresc] of Object.entries(pliki)) {
      mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
      writeFileSync(join(korzen, sciezka), tresc)
    }
    return sprawdzPlan(parsujPlan(plan), korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

test('plan fixture\'u po podstawieniu placeholderów przechodzi plan.mjs sprawdz — z migracją i bez', () => {
  assert.deepEqual(walidacjaWKopii(true), { bledy: [], uwagi: [] })
  assert.deepEqual(walidacjaWKopii(false).bledy, [])
})

test('pliki docs/active/ fixture\'u = wynik generatora (regeneracja: generuj-fixture.mjs --zapisz)', () => {
  for (const [plik, tresc] of Object.entries(plikiFixture())) {
    assert.equal(readFileSync(join(KATALOG, plik), 'utf8'), tresc, `${plik} różni się od generatora`)
  }
})

// Zmiana kontraktu (P14 sesja 3): fixture ma [E2E] w dwoch fazach. Faza 1 — scenariusz dla testera ze srodowiskiem (PASS),
// faza 2 — scenariusz po zatrzymanym serwerze ([Manual] w trakcie runu); bez .env.e2e bootstrap zatrzymuje run przed faza 1.
test('zadania fixture\'u: dwie fazy, cztery testy [Unit], [Manual] w sekcji operatora fazy 1, jeden scenariusz [E2E] w kazdej fazie', () => {
  const zadania = readFileSync(join(KATALOG, 'smoke-autopilot-zadania.md'), 'utf8')
  assert.deepEqual([...zadania.matchAll(/^## Faza (\d+) /gm)].map((m) => m[1]), ['1', '2'])
  assert.equal(zadania.match(/^- \[ \] Test: \[Unit\]/gm)?.length, 4)
  assert.match(zadania, /^## Operator checklist faza 1\n\n- \[ \] \[Manual\] .*\(IU-1\)$/m)
  const faza = (/** @type {number} */ n) => zadania.slice(zadania.indexOf(`## Faza ${n} `), n === 1 ? zadania.indexOf('## Faza 2 ') : undefined)
  assert.deepEqual([...faza(1).matchAll(/^- \[ \] Test: \[E2E\] `([^`]+)`/gm)].map((m) => m[1]), ['smoke-strona'])
  assert.deepEqual([...faza(2).matchAll(/^- \[ \] Test: \[E2E\] `([^`]+)`/gm)].map((m) => m[1]), ['smoke-strona-faza-2'])
  assert.match(zadania, /^- \[ \] Stwórz: `\{\{KATALOG_STRONY\}\}\/smoke-autopilot\.html`$/m)
  assert.match(readFileSync(join(KATALOG, 'smoke-autopilot-plan.md'), 'utf8'), /^Branch: `feature\/smoke-autopilot`$/m)
})
