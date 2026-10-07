// Walidacja planu technicznego przed generowaniem docs/active/ (PLAN-POPRAWY P13): to, czego konsumenci zadania nie
// naprawia w runie (faza bez kodu uznana za wykonana, E2E bez flow albo policzone dwa razy, seed bez autora, Weryfikacja,
// ktorej scribe nie uruchomi), budzet pliku z tabeli plikow i problemy zapisu, ktorych parser nie przeczytal jednoznacznie.

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { akcja, sprawdzBudzet } from './budzet-pliku.mjs'
import { ekranyFigmy, poleTekstowe, sciezkaOrigin } from './plan-techniczny.mjs'
import { sciezkaWzgledna } from './przygotowanie.mjs'

export { PROG_ESLINT, PROG_PYTANIA } from './budzet-pliku.mjs'

/**
 * @typedef {import('./plan-techniczny.mjs').Plan} Plan
 * @typedef {import('./plan-techniczny.mjs').Jednostka} Jednostka
 * @typedef {{ bledy: string[], uwagi: string[] }} Wynik
 */

export const BUILDERZY = ['feature-builder-ui', 'feature-builder-data', 'feature-builder-fullstack']
const POLA_FRONTMATTERA = ['design_md', 'figma_spec', 'figma_screens', 'operator_prep']
const PLIK_TESTU = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|__tests__\/)/
const SEED = /^e2e\/seeds\/[\w.-]+-seed\.sql$/
// Tokeny, po ktorych grepy konsumentow licza i wykluczaja linie zadan (precheck, tester, scribe, completion-gate, execute=done).
const ZNACZNIKI = /\[(?:E2E|Manual|Unit)\]|Operator:|\[P[123]\]/
// Kategorie CLI i Grep scribe'a review-wf (bookkeeping "Weryfikacja:"): pozycja bez nich zostaje "klasyfikacja niejasna".
const KOMENDA_CLI = /`(?:bun|npm|npx|pnpm|yarn|make|tsc|vitest|cargo|pytest|ruff|eslint|grep|rg|test|ls|node)\b[^`]*`/

/** @param {Plan} plan @param {string} projekt @param {Wynik} w */
function frontmatter(plan, projekt, w) {
  const fm = plan.frontmatter
  for (const pole of POLA_FRONTMATTERA) if (!(pole in fm)) w.bledy.push(`frontmatter: brak pola ${pole} (ścieżka albo null)`)
  for (const pole of ['design_md', 'figma_spec', 'operator_prep', 'origin']) {
    if (fm[pole] && typeof fm[pole] !== 'string') w.bledy.push(`frontmatter: ${pole} — oczekiwana ścieżka albo null, jest mapa`)
  }
  if (typeof fm.figma_screens === 'string') w.bledy.push('frontmatter: figma_screens — oczekiwana mapa nazwa: ścieżka albo {}')
  const istnieje = (/** @type {string} */ s) => existsSync(join(projekt, sciezkaWzgledna(s) ?? ''))
  const spec = poleTekstowe(plan, 'figma_spec')
  if (spec && !istnieje(spec)) w.bledy.push(`frontmatter: figma_spec ${spec} — plik nie istnieje`)
  for (const [nazwa, s] of ekranyFigmy(plan)) if (!istnieje(s)) w.bledy.push(`frontmatter: figma_screens.${nazwa} ${s} — plik nie istnieje`)
  const prep = poleTekstowe(plan, 'operator_prep')
  if (prep && !istnieje(prep)) w.bledy.push(`frontmatter: operator_prep ${prep} — checklista nie istnieje`)
  const origin = poleTekstowe(plan, 'origin')
  const zrodlo = sciezkaOrigin(origin)
  if (zrodlo && !existsSync(join(projekt, zrodlo))) w.uwagi.push(`frontmatter: origin ${origin} — plik nie istnieje (popraw origin)`)
}

/** @param {Plan} plan @param {Jednostka[]} jednostki @param {Wynik} w */
function struktura(plan, jednostki, w) {
  w.bledy.push(...plan.problemy)
  plan.fazy.forEach((f, i) => {
    const etykieta = Number.isNaN(f.numer) ? `faza „${f.oznaczenie}”` : `faza ${f.numer}`
    if (f.numer !== i + 1) w.bledy.push(`${etykieta}: numeracja faz liczbami od 1 bez luk (1, 2, …)`)
    if (f.poziom !== 3) w.bledy.push(`${etykieta}: nagłówek „### Faza N — nazwa” (planner szuka w planie „### Faza N”)`)
    if (!f.zalezyOd) w.bledy.push(`${etykieta}: brak linii „Zależy od:”`)
    if (!f.iu.length) w.bledy.push(`${etykieta}: brak Implementation Units`)
    if (f.nazwa.includes('|')) w.bledy.push(`${etykieta}: znak | w nazwie psuje tabelę „## Fazy”`)
  })
  if (!plan.fazy.length && !plan.bezFazy.length) w.bledy.push('plan bez faz i Implementation Units')
  for (const iu of plan.bezFazy) w.bledy.push(`${iu.id}: jednostka poza nagłówkiem „### Faza N — nazwa”`)
  jednostki.forEach((iu, i) => {
    if (iu.numer !== i + 1) w.bledy.push(`${iu.id}: numeracja IU ciągła w całym planie od IU-1, bez powtórzeń (oczekiwane IU-${i + 1})`)
  })
}

/** @param {Jednostka} iu @param {Wynik} w */
function znaczniki(iu, w) {
  const teksty = [...iu.scenariusze.map((s) => s.tresc), ...iu.weryfikacja.filter((v) => !/^\[Manual\]/.test(v.tresc)).map((v) => v.tresc), ...iu.operator,
    ...iu.pliki.flatMap((p) => [p.sciezka, p.akcja, p.wymiary, p.werdykt]), iu.nazwa]
  for (const t of teksty) {
    const m = ZNACZNIKI.exec(t)
    if (m) {
      w.bledy.push(`${iu.id}: „${t.slice(0, 100)}” zawiera znacznik ${m[0]} poza początkiem pozycji — grepy prechecku, testera`
        + ' i completion-gate liczą linie po znaczniku; napisz to słowami')
    }
  }
}

/** @param {Jednostka} iu @param {Wynik} w */
function pliki(iu, w) {
  w.bledy.push(...iu.problemy.map((p) => `${iu.id}: ${p}`))
  if (!iu.pliki.length) {
    w.bledy.push(`${iu.id}: brak plików w polu Pliki`)
    return
  }
  if (!iu.tabelaPlikow) w.bledy.push(`${iu.id}: pole Pliki bez tabeli (Akcja | Plik | Linie dziś → po | Wymiary | Werdykt)`)
  for (const p of iu.pliki) {
    if (akcja(p).includes('e2e seed') && !SEED.test(p.sciezka)) w.bledy.push(`${iu.id}: seed \`${p.sciezka}\` poza wzorcem e2e/seeds/<flow>-seed.sql`)
  }
  if (iu.pliki.some((p) => /^wydziel/i.test(p.werdykt.trim())) && !iu.pliki.some((p) => akcja(p) === 'stworz')) {
    w.bledy.push(`${iu.id}: werdykt „wydziel” bez wiersza Stwórz dla nowego modułu`)
  }
  if (iu.scenariusze.some((s) => s.typ === 'Unit') && !iu.pliki.some((p) => akcja(p).startsWith('test') || PLIK_TESTU.test(p.sciezka))) {
    w.bledy.push(`${iu.id}: scenariusze [Unit] bez pliku testu w polu Pliki`)
  }
  if (/migracj/i.test(iu.opis) && !iu.pliki.some((p) => p.sciezka.startsWith('supabase/migrations/'))) {
    w.uwagi.push(`${iu.id}: opis wspomina migrację, a pole Pliki nie ma pliku w supabase/migrations/`)
  }
}

/**
 * @param {Jednostka} iu @param {string} projekt @param {Set<string>} seedyPlanu @param {Map<string, string>} flowy
 * @param {Wynik} w
 */
function scenariusze(iu, projekt, seedyPlanu, flowy, w) {
  for (const s of iu.scenariusze) {
    if (!s.typ) w.bledy.push(`${iu.id}: scenariusz bez typu [Unit] / [E2E] / [Manual]: „${s.tresc}”`)
    if (s.typ !== 'E2E') continue
    if (!s.flow) w.bledy.push(`${iu.id}: [E2E] bez identyfikatora flow w backtickach na początku linii`)
    else if (flowy.has(s.flow)) w.bledy.push(`${iu.id}: flow \`${s.flow}\` ma już linię [E2E] w ${flowy.get(s.flow)} — jeden scenariusz = jedna linia`)
    else flowy.set(s.flow, iu.id)
    if (s.seed && !seedyPlanu.has(s.seed) && !existsSync(join(projekt, s.seed))) {
      w.bledy.push(`${iu.id}: seed ${s.seed} — nie ma go w polu Pliki (Stwórz (e2e seed)) ani w repo`)
    }
  }
}

/** @param {Jednostka} iu @param {Map<string, string>} flowy wszystkie flow scenariuszy planu @param {Wynik} w */
function weryfikacja(iu, flowy, w) {
  for (const v of iu.weryfikacja) {
    if (/^\[Manual\]/.test(v.tresc)) {
      w.bledy.push(`${iu.id}: Weryfikacja [Manual] — kroki człowieka idą do Operator checklist albo Scenariusze testowe`)
    } else if (v.e2e) {
      const runner = [...v.tresc.matchAll(/`([^`]+)`/g)].map((m) => m[1]).find((s) => /\.sh$/.test(s))
      if (!runner) w.bledy.push(`${iu.id}: Weryfikacja [E2E] „${v.tresc.slice(0, 60)}” — tylko runner .sh w backtickach, niebędący scenariuszem`)
      else if (flowy.has(runner.replace(/^.*\//, '').replace(/\.sh$/, ''))) {
        w.bledy.push(`${iu.id}: Weryfikacja [E2E] \`${runner}\` to scenariusz z linii [E2E] — drugi przebieg tego samego flow`)
      }
    } else if (!KOMENDA_CLI.test(v.tresc)) {
      w.bledy.push(`${iu.id}: Weryfikacja „${v.tresc.slice(0, 60)}” bez komendy w backtickach (\`pnpm typecheck\`, \`grep …\`) — scribe jej`
        + ' nie uruchomi; krok człowieka idzie do Operator checklist')
    }
  }
}

/**
 * @param {Plan} plan sparsowany plan techniczny
 * @param {string} projekt katalog projektu (sciezki planu sa wzgledne wobec niego)
 * @param {{ wzgledemRepo?: boolean }} [opcje] wzgledemRepo=false: bez regul budzetu wobec stanu repo (bramka po fazie 1)
 * @returns {Wynik}
 */
export function sprawdzPlan(plan, projekt, opcje = {}) {
  /** @type {Wynik} */
  const w = { bledy: [], uwagi: [] }
  const jednostki = [...plan.bezFazy, ...plan.fazy.flatMap((f) => f.iu)].sort((a, b) => a.start - b.start)
  frontmatter(plan, projekt, w)
  struktura(plan, jednostki, w)
  const seedyPlanu = new Set(jednostki.flatMap((iu) => iu.pliki.filter((p) => akcja(p).includes('e2e seed')).map((p) => p.sciezka)))
  /** @type {Map<string, string>} */
  const flowy = new Map()
  for (const iu of jednostki) {
    if (!BUILDERZY.includes(iu.delegate.replace(/-figma$/, ''))) {
      w.bledy.push(`${iu.id}: Delegate to „${iu.delegate}” — dozwolone ${BUILDERZY.join(' | ')}`)
    }
    pliki(iu, w)
    znaczniki(iu, w)
    scenariusze(iu, projekt, seedyPlanu, flowy, w)
  }
  for (const iu of jednostki) weryfikacja(iu, flowy, w)
  sprawdzBudzet(jednostki, projekt, w, opcje.wzgledemRepo !== false)
  const e2e = jednostki.some((iu) => iu.scenariusze.some((s) => s.typ === 'E2E'))
  if (e2e && !existsSync(join(projekt, '.env.e2e')) && !poleTekstowe(plan, 'operator_prep')) {
    w.bledy.push('plan ma scenariusze [E2E], a projekt nie ma .env.e2e — pozycja setupu w checkliście przygotowania (operator_prep) albo [E2E] → [Manual]')
  }
  return w
}
