// Bramka gotowosci zadania przed autopilotem (PLAN-POPRAWY P13, dawniej Faza 5 dev-docs): plan techniczny bez bledow,
// srodowisko dla scenariuszy [E2E], checklista przygotowania bez pozycji blokujacych start, galaz zadania i czyste drzewo.
// Autopilot nie przelacza galezi i zatrzymuje run na brudnym drzewie, wiec te warunki sprawdzamy przed jego startem.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { liczE2e, sciezkaPlanu } from '../dossier/dokumenty.mjs'
import { plikZadania } from '../dossier/zadanie.mjs'
import { parsujPlan, poleTekstowe } from './plan-techniczny.mjs'
import { przygotowanie } from './przygotowanie.mjs'
import { sprawdzPlan } from './walidacja-planu.mjs'

/**
 * @typedef {import('./przygotowanie.mjs').Bloker} Bloker
 * @typedef {{ ok: boolean, zadanie: string, planTechniczny: string | null,
 *   plan: { ok: boolean, bledy: string[], uwagi: string[] },
 *   e2e: { ok: boolean, scenariusze: number, envE2e: boolean },
 *   przygotowanie: { ok: boolean, sciezka: string | null, blokujace: Bloker[], odroczone: Bloker[] },
 *   git: { ok: boolean, galaz: string, wymagana: string, brudne: string[] } }} Gotowosc
 */

/** @param {string} projekt @param {string[]} argumenty @returns {string} */
function git(projekt, argumenty) {
  return execFileSync('git', ['-C', projekt, ...argumenty], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
}

/**
 * @param {string} projekt katalog projektu
 * @param {string} katalogZadania docs/active/<zadanie> wzgledem projektu
 * @returns {Gotowosc}
 */
export function gotowosc(projekt, katalogZadania) {
  const zadanie = basename(katalogZadania)
  const katalog = join(projekt, katalogZadania)
  const planZadania = plikZadania(katalog, '-plan.md')?.tresc
  const zadania = plikZadania(katalog, '-zadania.md')?.tresc ?? ''
  const wskaznik = planZadania ? sciezkaPlanu(planZadania) : null
  const planMd = wskaznik && existsSync(join(projekt, wskaznik)) ? readFileSync(join(projekt, wskaznik), 'utf8') : null
  const plan = planMd ? parsujPlan(planMd) : null
  // Bramka dziala tez po fazie 1 (wznowienie): budzet wobec repo sprawdzil `generuj`, tu tylko reguly strukturalne.
  const walidacja = plan ? sprawdzPlan(plan, projekt, { wzgledemRepo: false })
    : { bledy: [`brak planu technicznego (wskaźnik w planie zadania: ${wskaznik ?? 'brak linii „Plan techniczny:”'})`], uwagi: [] }
  if (!zadania) walidacja.bledy.push(`brak pliku *-zadania.md w ${katalogZadania}`)

  const scenariusze = liczE2e(zadania)
  const envE2e = existsSync(join(projekt, '.env.e2e'))
  const prep = plan ? przygotowanie(projekt, poleTekstowe(plan, 'operator_prep')) : null

  const wymagana = `feature/${zadanie}`
  const galaz = git(projekt, ['branch', '--show-current'])
  const brudne = git(projekt, ['status', '--porcelain']).split('\n').filter(Boolean)

  const wynik = {
    plan: { ok: !walidacja.bledy.length, bledy: walidacja.bledy, uwagi: walidacja.uwagi },
    e2e: { ok: scenariusze === 0 || envE2e, scenariusze, envE2e },
    przygotowanie: { ok: !prep?.blokujace.length, sciezka: prep?.sciezka ?? null, blokujace: prep?.blokujace ?? [], odroczone: prep?.odroczone ?? [] },
    git: { ok: galaz === wymagana && !brudne.length, galaz, wymagana, brudne },
  }
  return {
    ok: wynik.plan.ok && wynik.e2e.ok && wynik.przygotowanie.ok && wynik.git.ok,
    zadanie,
    planTechniczny: wskaznik,
    ...wynik,
  }
}
