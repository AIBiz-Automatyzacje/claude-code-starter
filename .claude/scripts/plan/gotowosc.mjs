// Bramka gotowosci zadania przed autopilotem (PLAN-POPRAWY P13, krok 6.6 skilla dev-plan): plan techniczny bez bledow,
// srodowisko dla scenariuszy [E2E] (sprawdzenie jak w bootstrapie), checklista przygotowania bez pozycji blokujacych start, galaz zadania i czyste drzewo,
// runner testow projektu bez testow maszynerii z .claude/** (P22 A1: inaczej `npm test` w runie pada na starcie),
// pliki decyzji na galezi glownej bez `claude_md: do-uzgodnienia` (bootstrap zatrzymuje na nich run). Sprawy odlozone w smoke'u
// (docs/operator/odlozone.md) bramka tylko pokazuje: start nie czeka na sprawe innego etapu (decyzja operatora, punkt 40 krok 6).
// Aktualny przeglad spojnosci planu z zerem otwartych pozycji blokuje start (punkt 41: decyzja produktowa wychodzila w runie).
// Autopilot nie przelacza galezi i zatrzymuje run na brudnym drzewie, wiec te warunki sprawdzamy przed jego startem.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { sciezkaPlanu } from '../dossier/dokumenty.mjs'
import { plikZadania } from '../dossier/zadanie.mjs'
import { kontekstStartowy, wiedzaProjektu } from '../doctor/higiena.mjs'
import { sprawdzRunnerTestow } from '../doctor/runner-testow.mjs'
import { otwarte } from '../smoke/otwarte.mjs'
import { uwagiPlanowania } from '../e2e/adapter.mjs'
import { gotowoscAdvisors } from '../e2e/advisors.mjs'
import { bledySrodowiska, envE2e, NARZEDZIA } from '../e2e/srodowisko.mjs'
import { potrzebyZadania } from '../e2e/start.mjs'
import { KOMENDA_GENERATORA, maSkillWeryfikacji, PLIK_SKILLA } from '../e2e/weryfikacja.mjs'
import { parsujPlan, poleTekstowe } from './plan-techniczny.mjs'
import { przygotowanie } from './przygotowanie.mjs'
import { stanPrzegladu } from './spojnosc.mjs'
import { sprawdzPlan } from './walidacja-planu.mjs'

/**
 * @typedef {import('./przygotowanie.mjs').Bloker} Bloker
 * @typedef {{ ok: boolean, zadanie: string, planTechniczny: string | null,
 *   plan: { ok: boolean, bledy: string[], uwagi: string[] },
 *   e2e: { ok: boolean, scenariusze: number, figmaScreens: boolean, envE2e: boolean, bledy: string[], uwagi: string[] },
 *   przygotowanie: { ok: boolean, sciezka: string | null, blokujace: Bloker[], odroczone: Bloker[] },
 *   git: { ok: boolean, galaz: string, wymagana: string, brudne: string[] },
 *   testy: { ok: boolean, runner: string | null, szczegol: string, poprawka: string },
 *   claudeMd: { ok: boolean, glowna: string | null, zadania: string[], naprawa: string },
 *   spojnosc: import('./spojnosc.mjs').StanPrzegladu,
 *   higiena: { ok: true, uwagi: string[] },
 *   odlozone: { ok: true, plik: string, otwarte: { linia: number, etap: string, tresc: string }[], decyzje: { zadanie: string, wiersz: string }[] } }} Gotowosc
 */

/**
 * CLAUDE.md nieuzgodniony po merge'u (pilot Nawykometr W21): bootstrap autopilota zatrzymuje run, gdy plik decyzji na galezi
 * glownej ma `claude_md: do-uzgodnienia` (`decyzjaClaudeMd` w dev-autopilot-wf.js). Ta sama kontrola tutaj, bo bramka byla
 * zielona, a run stawal na starcie; galaz zadania zalozona przed uzgodnieniem nie ma tez nowego CLAUDE.md.
 * @param {string} projekt @returns {Gotowosc['claudeMd']}
 */
function decyzjeClaudeMd(projekt) {
  const glowna = ['main', 'master'].find((g) => spawnSync('git', ['-C', projekt, 'rev-parse', '--verify', '--quiet', `refs/heads/${g}`]).status === 0) ?? null
  // git grep konczy kodem 1 przy braku trafien i 128 przy braku katalogu — oba to „nic do uzgodnienia”.
  const linie = glowna ? spawnSync('git', ['-C', projekt, 'grep', '-e', '^claude_md:', glowna, '--', 'docs/decisions/*.md'], { encoding: 'utf8' }).stdout ?? '' : ''
  const zadania = linie.split('\n').flatMap((l) => {
    const m = /^[^:]+:docs\/decisions\/([^:]+)\.md:claude_md:\s*(\S+)/.exec(l)
    return m && m[2] === 'do-uzgodnienia' ? [(m[1] ?? '').replace(/^\d{4}-\d{2}-\d{2}-/, '')] : []
  })
  return {
    ok: !zadania.length,
    glowna,
    zadania,
    naprawa: zadania.length
      ? `git switch ${glowna}, potem ${zadania.map((z) => `/dev-pr --claude-md ${z}`).join(', ')}; po powrocie na gałąź zadania: git merge ${glowna} (gałąź założona przed uzgodnieniem nie ma nowego CLAUDE.md)`
      : '',
  }
}

/**
 * Higiena przed autopilotem (02.11): niezrobiona konwersja wiedzy i przerosniety kontekst startowy agenta nie blokuja runu, ale
 * kosztuja kazdego agenta kazdej fazy — operator widzi je tu, zanim odpali autopilota, takze bez synchronizacji szablonu.
 * @param {string} projekt @returns {Gotowosc['higiena']}
 */
function higienaZadania(projekt) {
  const uwagi = [wiedzaProjektu(projekt), kontekstStartowy(projekt)].filter((w) => w.stan === 'UWAGA')
    .map((w) => `${w.element}: ${w.szczegol} → ${w.instalacja}`)
  return { ok: true, uwagi }
}

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
  const bledy = potrzebne && env ? bledySrodowiska(projekt, env, { jazda: true, narzedzia }) : []
  const uwagi = scenariusze && !maSkillWeryfikacji(projekt)
    ? [`brak skilla weryfikacji projektu (${PLIK_SKILLA}) — tester odegra scenariusze bez mapy funkcji; generator: ${KOMENDA_GENERATORA}`]
    : []
  if (scenariusze && env) uwagi.push(...uwagiPlanowania(projekt, env))
  return { ok: !potrzebne || (env ? !bledy.length : scenariusze === 0), scenariusze, figmaScreens, envE2e: !!env, bledy, uwagi }
}

/**
 * Plan techniczny zadania przez wskaznik „Plan techniczny:” w planie zadania.
 * @param {string} projekt @param {string} katalogZadania docs/active/<zadanie> wzgledem projektu
 * @returns {{ wskaznik: string | null, plan: import('./plan-techniczny.mjs').Plan | null }}
 */
function planTechnicznyZadania(projekt, katalogZadania) {
  const planZadania = plikZadania(join(projekt, katalogZadania), '-plan.md')?.tresc
  const wskaznik = planZadania ? sciezkaPlanu(planZadania) : null
  const planMd = wskaznik && existsSync(join(projekt, wskaznik)) ? readFileSync(join(projekt, wskaznik), 'utf8') : null
  return { wskaznik, plan: planMd ? parsujPlan(planMd) : null }
}

/**
 * Nieodhaczone blokery checklisty zadania z faza, ktora wstrzymuja (P25 A1): bootstrap autopilota przepisuje je 1:1, a STOP
 * przed faza liczy orkiestrator. Pozycje startu (`planowanie`, `faza 1`, marker bez numeru) wstrzymuja faze 1.
 * `spojnosc` (weryfikacja partii, punkt 53): autopilot nie wolal ani `spojnosc`, ani `gotowosc`, wiec plan bez aktualnego
 * przegladu spojnosci szedl do runu; stan przegladu liczony jak w bramce gotowosci, decyzje (STOP albo uwaga) liczy orkiestrator.
 * @param {string} projekt @param {string} katalogZadania
 * @returns {{ checklista: string | null, blokery: { faza: number, linia: number, tresc: string }[], spojnosc: { ok: boolean, powod: string } }}
 */
export function blokeryZadania(projekt, katalogZadania) {
  const { wskaznik, plan } = planTechnicznyZadania(projekt, katalogZadania)
  const przeglad = stanPrzegladu(projekt, wskaznik, plan ? plan.fazy.map((f) => f.oznaczenie) : [])
  const spojnosc = { ok: przeglad.ok, powod: przeglad.powod }
  const prep = plan ? przygotowanie(projekt, poleTekstowe(plan, 'operator_prep')) : null
  if (!prep) return { checklista: null, blokery: [], spojnosc }
  const blokery = [...prep.blokujace, ...prep.odroczone]
    .map(({ faza, linia, tresc }) => ({ faza: faza ?? 1, linia, tresc }))
    .sort((a, b) => a.linia - b.linia)
  return { checklista: prep.sciezka, blokery, spojnosc }
}

/** @param {string} projekt @returns {Gotowosc['testy']} */
function testyProjektu(projekt) {
  const { stan, runner, szczegol, poprawka } = sprawdzRunnerTestow(projekt)
  return { ok: stan !== 'BRAK', runner, szczegol, poprawka }
}

/**
 * @param {string} projekt katalog projektu
 * @param {string} katalogZadania docs/active/<zadanie> wzgledem projektu
 * @param {{ narzedzia?: import('../e2e/srodowisko.mjs').Narzedzia, srodowisko?: Record<string, string | undefined> }} [opcje] narzedzia:
 *   atrapy git check-ignore i narzedzia jazdy (testy); srodowisko: zmienne procesu dla tokenu advisors
 * @returns {Gotowosc}
 */
export function gotowosc(projekt, katalogZadania, { narzedzia = NARZEDZIA, srodowisko = process.env } = {}) {
  const zadanie = basename(katalogZadania)
  const zadania = plikZadania(join(projekt, katalogZadania), '-zadania.md')?.tresc ?? ''
  const { wskaznik, plan } = planTechnicznyZadania(projekt, katalogZadania)
  // Bramka dziala tez po fazie 1 (wznowienie): budzet wobec repo sprawdzil `generuj`, tu tylko reguly strukturalne.
  const walidacja = plan ? sprawdzPlan(plan, projekt, { wzgledemRepo: false, zadanieWToku: true })
    : { bledy: [`brak planu technicznego (wskaźnik w planie zadania: ${wskaznik ?? 'brak linii „Plan techniczny:”'})`], uwagi: [] }
  if (!zadania) walidacja.bledy.push(`brak pliku *-zadania.md w ${katalogZadania}`)

  const prep = plan ? przygotowanie(projekt, poleTekstowe(plan, 'operator_prep')) : null

  const wymagana = `feature/${zadanie}`
  const galaz = git(projekt, ['branch', '--show-current'])
  const brudne = git(projekt, ['status', '--porcelain']).split('\n').filter(Boolean)

  const e2e = srodowiskoE2e(projekt, katalogZadania, narzedzia)
  // Zadanie z migracjami (P17): advisors bez tokenu albo bazy e2e nie pobiegnie — uwaga, nie bloker (security sprawdzi recznie).
  const advisors = zadania.includes('supabase/migrations/') ? gotowoscAdvisors(projekt, srodowisko) : null
  if (advisors && !advisors.gotowe) e2e.uwagi.push(advisors.uwaga)
  const sprawy = otwarte(projekt)
  const wynik = {
    plan: { ok: !walidacja.bledy.length, bledy: walidacja.bledy, uwagi: walidacja.uwagi },
    e2e,
    przygotowanie: { ok: !prep?.blokujace.length, sciezka: prep?.sciezka ?? null, blokujace: prep?.blokujace ?? [], odroczone: prep?.odroczone ?? [] },
    git: { ok: galaz === wymagana && !brudne.length, galaz, wymagana, brudne },
    testy: testyProjektu(projekt),
    claudeMd: decyzjeClaudeMd(projekt),
    spojnosc: stanPrzegladu(projekt, wskaznik, plan ? plan.fazy.map((f) => f.oznaczenie) : []),
    higiena: higienaZadania(projekt),
    // Punkt 52: decyzje poprzednich zadan bez rozstrzygniecia (smoke pominiety) — pokazane, nie blokuja.
    odlozone: { ok: /** @type {const} */ (true), ...sprawy.odlozone, decyzje: sprawy.decyzje ?? [] },
  }
  return {
    ok: wynik.plan.ok && wynik.e2e.ok && wynik.przygotowanie.ok && wynik.git.ok && wynik.testy.ok && wynik.claudeMd.ok && wynik.spojnosc.ok,
    zadanie,
    planTechniczny: wskaznik,
    ...wynik,
  }
}
