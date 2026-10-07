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

/** @param {string} tresc @param {boolean} zMigracja @returns {string} podstawienie jak `podstaw` w przygotuj-kopie.sh */
function podstaw(tresc, zMigracja) {
  const kod = tresc.replaceAll('{{KATALOG_KODU}}', KATALOG_KODU)
  return zMigracja ? kod.replaceAll('{{MIGRACJA}}', MIGRACJA) : kod.split('\n').filter((l) => !l.includes('{{MIGRACJA}}')).join('\n')
}

/** @param {boolean} zMigracja @returns {{ bledy: string[], uwagi: string[] }} */
function walidacjaWKopii(zMigracja) {
  const plan = podstaw(readFileSync(join(KATALOG, PLAN_TECHNICZNY), 'utf8'), zMigracja)
  const korzen = mkdtempSync(join(tmpdir(), 'fixture-smoke-kopia-'))
  try {
    for (const [sciezka, tresc] of Object.entries({ [SCIEZKA_PLANU]: plan, ...(zMigracja ? { [MIGRACJA]: 'create table t (id int);\n' } : {}) })) {
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

test('zadania fixture\'u: cztery testy [Unit], pozycja [Manual] w sekcji operatora fazy 1, bez [E2E]', () => {
  const zadania = readFileSync(join(KATALOG, 'smoke-autopilot-zadania.md'), 'utf8')
  assert.equal(zadania.match(/^- \[ \] Test: \[Unit\]/gm)?.length, 4)
  assert.match(zadania, /^## Operator checklist faza 1\n\n- \[ \] \[Manual\] .*\(IU-1\)$/m)
  assert.doesNotMatch(zadania, /\[E2E\]/, 'bramka setupu E2E zatrzymałaby smoke bez .env.e2e')
  assert.match(readFileSync(join(KATALOG, 'smoke-autopilot-plan.md'), 'utf8'), /^Branch: `feature\/smoke-autopilot`$/m)
})
