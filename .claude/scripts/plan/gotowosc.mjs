// Bramka gotowosci zadania przed autopilotem (PLAN-POPRAWY P13, krok 6.6 skilla dev-plan): plan techniczny bez bledow,
// srodowisko dla scenariuszy [E2E] (sprawdzenie jak w bootstrapie), checklista przygotowania bez pozycji blokujacych start, galaz zadania i czyste drzewo.
// Autopilot nie przelacza galezi i zatrzymuje run na brudnym drzewie, wiec te warunki sprawdzamy przed jego startem.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { sciezkaPlanu } from '../dossier/dokumenty.mjs'
import { plikZadania } from '../dossier/zadanie.mjs'
import { bledySrodowiska, envE2e, NARZEDZIA } from '../e2e/srodowisko.mjs'
import { potrzebyZadania } from '../e2e/start.mjs'
import { KOMENDA_GENERATORA, maSkillWeryfikacji, PLIK_SKILLA } from '../e2e/weryfikacja.mjs'
import { parsujPlan, poleTekstowe } from './plan-techniczny.mjs'
import { przygotowanie } from './przygotowanie.mjs'
import { sprawdzPlan } from './walidacja-planu.mjs'

/**
 * @typedef {import('./przygotowanie.mjs').Bloker} Bloker
 * @typedef {{ ok: boolean, zadanie: string, planTechniczny: string | null,
 *   plan: { ok: boolean, bledy: string[], uwagi: string[] },
 *   e2e: { ok: boolean, scenariusze: number, figmaScreens: boolean, envE2e: boolean, bledy: string[], uwagi: string[] },
 *   przygotowanie: { ok: boolean, sciezka: string | null, blokujace: Bloker[], odroczone: Bloker[] },
 *   git: { ok: boolean, galaz: string, wymagana: string, brudne: string[] } }} Gotowosc
 */

/** @param {string} projekt @param {string[]} argumenty @returns {string} */
function git(projekt, argumenty) {
  return execFileSync('git', ['-C', projekt, ...argumenty], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
}

/**
 * Srodowisko E2E zadania: ta sama decyzja co bootstrap autopilota (`startE2e` bez startu serwera), zeby blad wyszedl przy
 * planowaniu, a nie jako STOP przed faza 1. Potrzeba = scenariusze [E2E] albo makiety figma_screens; makiety bez .env.e2e
 * ida w visual diff bez przegladarki (nie STOP), scenariusze bez .env.e2e — STOP. Brak skilla weryfikacji nie blokuje
 * startu: tester gra wtedy scenariusze bez mapy funkcji.
 * @param {string} projekt
 * @param {string} katalogZadania
 * @param {import('../e2e/srodowisko.mjs').Narzedzia} narzedzia
 * @returns {Gotowosc['e2e']}
 */
function srodowiskoE2e(projekt, katalogZadania, narzedzia) {
  const { scenariusze, figmaScreens } = potrzebyZadania(projekt, katalogZadania)
  const env = envE2e(projekt)
  const potrzebne = scenariusze > 0 || figmaScreens
  const bledy = potrzebne && env ? bledySrodowiska(projekt, env, { przegladarka: true, narzedzia }) : []
  const uwagi = scenariusze && !maSkillWeryfikacji(projekt)
    ? [`brak skilla weryfikacji projektu (${PLIK_SKILLA}) — tester odegra scenariusze bez mapy funkcji; generator: ${KOMENDA_GENERATORA}`]
    : []
  return { ok: !potrzebne || (env ? !bledy.length : scenariusze === 0), scenariusze, figmaScreens, envE2e: !!env, bledy, uwagi }
}

/**
 * @param {string} projekt katalog projektu
 * @param {string} katalogZadania docs/active/<zadanie> wzgledem projektu
 * @param {{ narzedzia?: import('../e2e/srodowisko.mjs').Narzedzia }} [opcje] narzedzia: atrapy git check-ignore i agent-browser (testy)
 * @returns {Gotowosc}
 */
export function gotowosc(projekt, katalogZadania, { narzedzia = NARZEDZIA } = {}) {
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

  const prep = plan ? przygotowanie(projekt, poleTekstowe(plan, 'operator_prep')) : null

  const wymagana = `feature/${zadanie}`
  const galaz = git(projekt, ['branch', '--show-current'])
  const brudne = git(projekt, ['status', '--porcelain']).split('\n').filter(Boolean)

  const wynik = {
    plan: { ok: !walidacja.bledy.length, bledy: walidacja.bledy, uwagi: walidacja.uwagi },
    e2e: srodowiskoE2e(projekt, katalogZadania, narzedzia),
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
