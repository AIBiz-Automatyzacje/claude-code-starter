// Walidacja planu technicznego przed generowaniem docs/active/ (PLAN-POPRAWY P13): to, czego konsumenci zadania nie
// naprawia w runie (faza bez kodu uznana za wykonana, E2E bez flow, seed bez autora), i budzet pliku z tabeli plikow.
// Linie = wyzwalacz pytania o wymiary (prog 300 + tolerancja 20% = 360, ten sam prog co ESLint max-lines i bot PR).

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { bezOgonkow } from './plan-techniczny.mjs'
import { sciezkaWzgledna } from './przygotowanie.mjs'

/**
 * @typedef {import('./plan-techniczny.mjs').Plan} Plan
 * @typedef {import('./plan-techniczny.mjs').Jednostka} Jednostka
 * @typedef {import('./plan-techniczny.mjs').Plik} Plik
 * @typedef {{ bledy: string[], uwagi: string[] }} Wynik
 */

export const PROG_PYTANIA = 300
export const PROG_ESLINT = 360
export const BUILDERZY = ['feature-builder-ui', 'feature-builder-data', 'feature-builder-fullstack']
const POLA_FRONTMATTERA = ['design_md', 'figma_spec', 'figma_screens', 'operator_prep']
const PLIK_KODU = /\.[cm]?[jt]sx?$/
const PLIK_TESTU = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|__tests__\/)/
const SEED = /^e2e\/seeds\/[\w.-]+-seed\.sql$/
const TOLERANCJA_DLUGOSCI = { procent: 0.2, linie: 10 }

/** @param {string} tresc @returns {number} liczba linii jak `wc -l` (ostatnia linia bez \n tez sie liczy) */
export function liczLinie(tresc) {
  return (tresc.match(/\n/g) ?? []).length + (tresc && !tresc.endsWith('\n') ? 1 : 0)
}

/** @param {string} komorka @returns {boolean} */
const pusta = (komorka) => !komorka.replace(/[—–\-\s]/g, '')

/** @param {Plik} p @returns {string} akcja bez ogonkow, malymi literami */
const akcja = (p) => bezOgonkow(p.akcja).toLowerCase()

/** @param {Plan} plan @param {string} projekt @param {Wynik} w */
function frontmatter(plan, projekt, w) {
  const fm = plan.frontmatter
  for (const pole of POLA_FRONTMATTERA) if (!(pole in fm)) w.bledy.push(`frontmatter: brak pola ${pole} (ścieżka albo null)`)
  const spec = /** @type {string | null} */ (fm.figma_spec ?? null)
  if (spec && !existsSync(join(projekt, sciezkaWzgledna(spec) ?? ''))) w.bledy.push(`frontmatter: figma_spec ${spec} — plik nie istnieje`)
  const ekrany = typeof fm.figma_screens === 'object' && fm.figma_screens ? Object.entries(fm.figma_screens) : []
  for (const [nazwa, s] of ekrany) {
    if (!existsSync(join(projekt, sciezkaWzgledna(s) ?? ''))) w.bledy.push(`frontmatter: figma_screens.${nazwa} ${s} — plik nie istnieje`)
  }
  const origin = /** @type {string | null} */ (fm.origin ?? null)
  const sciezka = origin?.replace(/#.*$/, '').replace(/\s*\(sekcja.*$/, '').replace(/^\.\//, '')
  if (origin && sciezka && /\.md$/.test(sciezka) && sciezka.includes('/') && !existsSync(join(projekt, sciezka))) {
    w.uwagi.push(`frontmatter: origin ${origin} — plik nie istnieje (popraw origin)`)
  }
}

/** @param {Plan} plan @param {Wynik} w */
function fazy(plan, w) {
  plan.fazy.forEach((f, i) => {
    const etykieta = Number.isNaN(f.numer) ? `faza „${f.oznaczenie}”` : `faza ${f.numer}`
    if (f.numer !== i + 1) w.bledy.push(`${etykieta}: numeracja faz liczbami od 1 bez luk (1, 2, …)`)
    if (!f.zalezyOd) w.bledy.push(`${etykieta}: brak linii „Zależy od:”`)
    if (!f.iu.length) w.bledy.push(`${etykieta}: brak Implementation Units`)
  })
  if (!plan.fazy.length && !plan.bezFazy.length) w.bledy.push('plan bez faz i Implementation Units')
  for (const iu of plan.bezFazy) w.bledy.push(`${iu.id}: jednostka poza nagłówkiem „### Faza N — nazwa”`)
}

/** @param {Jednostka} iu @param {Plik} p @param {string} projekt @param {Wynik} w */
function budzetPliku(iu, p, projekt, w) {
  const plik = join(projekt, p.sciezka)
  const jestPlikiem = existsSync(plik) && statSync(plik).isFile()
  if (akcja(p) === 'modyfikuj' && !existsSync(plik)) {
    w.bledy.push(`${iu.id}: Modyfikuj \`${p.sciezka}\` — pliku nie ma w repo`)
    return
  }
  if (!PLIK_KODU.test(p.sciezka)) return
  if (jestPlikiem && p.dzis !== null && akcja(p) !== 'stworz') {
    const faktycznie = liczLinie(readFileSync(plik, 'utf8'))
    const roznica = Math.abs(faktycznie - p.dzis)
    if (roznica > TOLERANCJA_DLUGOSCI.linie && roznica > faktycznie * TOLERANCJA_DLUGOSCI.procent) {
      w.bledy.push(`${iu.id}: \`${p.sciezka}\` ma ${faktycznie} linii, tabela podaje ${p.dzis}`)
    }
  }
  if (p.po === null) return
  if (p.po > PROG_ESLINT) {
    w.bledy.push(`${iu.id}: \`${p.sciezka}\` po zmianie ${p.po} linii > ${PROG_ESLINT} (próg ESLint max-lines) — zaplanuj wydzielenie `
      + 'modułu: werdykt „wydziel …”, wiersz Stwórz nowego modułu i długość po wydzieleniu')
  } else if (p.po > PROG_PYTANIA && pusta(p.wymiary)) {
    w.bledy.push(`${iu.id}: \`${p.sciezka}\` po zmianie ${p.po} linii > ${PROG_PYTANIA} — oceń wymiary (powody zmiany, eksporty między `
      + 'warstwami, importy z wielu domen, test-lustro, reguła 5 s)')
  }
}

/** @param {Jednostka} iu @param {string} projekt @param {Wynik} w */
function pliki(iu, projekt, w) {
  if (!iu.pliki.length) {
    w.bledy.push(`${iu.id}: brak plików w polu Pliki`)
    return
  }
  if (!iu.tabelaPlikow) w.bledy.push(`${iu.id}: pole Pliki bez tabeli (Akcja | Plik | Linie dziś → po | Wymiary | Werdykt)`)
  for (const p of iu.pliki) {
    if (akcja(p).includes('e2e seed') && !SEED.test(p.sciezka)) w.bledy.push(`${iu.id}: seed \`${p.sciezka}\` poza wzorcem e2e/seeds/<flow>-seed.sql`)
    if (iu.tabelaPlikow) budzetPliku(iu, p, projekt, w)
  }
  if (iu.pliki.some((p) => /^wydziel/i.test(p.werdykt.trim())) && !iu.pliki.some((p) => akcja(p) === 'stworz')) {
    w.bledy.push(`${iu.id}: werdykt „wydziel” bez wiersza Stwórz dla nowego modułu`)
  }
  if (iu.scenariusze.some((s) => s.typ === 'Unit') && !iu.pliki.some((p) => akcja(p).startsWith('test') || PLIK_TESTU.test(p.sciezka))) {
    w.bledy.push(`${iu.id}: scenariusze [Unit] bez pliku testu w polu Pliki`)
  }
  if (/migracj/i.test(iu.tekst) && !iu.pliki.some((p) => p.sciezka.startsWith('supabase/migrations/'))) {
    w.uwagi.push(`${iu.id}: opis wspomina migrację, a pole Pliki nie ma pliku w supabase/migrations/`)
  }
}

/**
 * @param {Jednostka} iu @param {string} projekt @param {Set<string>} seedyPlanu @param {Map<string, string>} flowy
 * @param {Wynik} w
 */
function scenariuszeIWeryfikacja(iu, projekt, seedyPlanu, flowy, w) {
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
  for (const v of iu.weryfikacja) {
    if (/\[Manual\]/.test(v.tresc)) w.bledy.push(`${iu.id}: Weryfikacja [Manual] — kroki człowieka idą do Operator checklist albo Scenariusze testowe`)
    const cel = /^`([^`]+)`/.exec(v.tresc)?.[1] ?? v.tresc
    if (v.e2e && !/\.sh$/.test(cel)) w.bledy.push(`${iu.id}: Weryfikacja [E2E] \`${cel}\` — tylko runner .sh niebędący scenariuszem`)
  }
}

/**
 * @param {Plan} plan sparsowany plan techniczny
 * @param {string} projekt katalog projektu (sciezki planu sa wzgledne wobec niego)
 * @returns {Wynik}
 */
export function sprawdzPlan(plan, projekt) {
  /** @type {Wynik} */
  const w = { bledy: [], uwagi: [] }
  frontmatter(plan, projekt, w)
  fazy(plan, w)
  const jednostki = [...plan.bezFazy, ...plan.fazy.flatMap((f) => f.iu)].sort((a, b) => a.numer - b.numer)
  const seedyPlanu = new Set(jednostki.flatMap((iu) => iu.pliki.filter((p) => akcja(p).includes('e2e seed')).map((p) => p.sciezka)))
  /** @type {Map<string, string>} */
  const flowy = new Map()
  for (const iu of jednostki) {
    if (!BUILDERZY.includes(iu.delegate.replace(/-figma$/, ''))) {
      w.bledy.push(`${iu.id}: Delegate to „${iu.delegate}” — dozwolone ${BUILDERZY.join(' | ')}`)
    }
    pliki(iu, projekt, w)
    scenariuszeIWeryfikacja(iu, projekt, seedyPlanu, flowy, w)
  }
  const e2e = jednostki.some((iu) => iu.scenariusze.some((s) => s.typ === 'E2E'))
  if (e2e && !existsSync(join(projekt, '.env.e2e')) && !plan.frontmatter.operator_prep) {
    w.bledy.push('plan ma scenariusze [E2E], a projekt nie ma .env.e2e — pozycja setupu w checkliście przygotowania (operator_prep) albo [E2E] → [Manual]')
  }
  return w
}
