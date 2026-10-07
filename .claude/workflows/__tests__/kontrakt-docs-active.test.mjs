// Kontrakt docs/active/<zadanie>/ (PLAN-POPRAWY P13): pliki wygenerowane skryptem .claude/scripts/plan/ z planu technicznego
// przechodza przez parsery i prompty konsumentow — planner i domkniecie (execute-wf), bootstrap, db-sync, fix, walidacja
// koncowa (autopilot), scribe (review-wf), smoke operatora i archiwizacja (complete-wf), dossier fazy (skrypt).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/kontrakt-docs-active.test.mjs
//
// DLACZEGO: scalony dev-plan zastepuje dev-docs, ktory pisal te pliki recznie wg tabeli kontraktu. Konsumenci szukaja
// nagłowkow i linii grepem albo poleceniem w prompcie; zmiana formatu nie wysypuje zadnego testu, tylko run (faza
// "done" bez kodu, E2E policzone dwa razy, planner bez planu technicznego). Wzorce i naglowki test bierze ze zrodel
// workflowow, wiec zmiana po stronie konsumenta tez go wywraca.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { wycinkiZadania } from '../../scripts/dossier/zadanie.mjs'
import { sciezkaPlanu } from '../../scripts/dossier/dokumenty.mjs'
import { parsujPlan } from '../../scripts/plan/plan-techniczny.mjs'
import { zadanieZPlanu } from '../../scripts/plan/zadanie.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const WF = (/** @type {string} */ plik) => readFileSync(resolve(KATALOG, '..', plik), 'utf8')
const autopilot = WF('dev-autopilot-wf.js')
const execute = WF('dev-docs-execute-wf.js')
const review = WF('dev-docs-review-wf.js')
const complete = WF('dev-docs-complete-wf.js')
const PLAN_MD = readFileSync(resolve(KATALOG, '../../scripts/plan/__tests__/fixtures/plan-techniczny.md'), 'utf8')
const SCIEZKA_PLANU = 'docs/plans/2026-10-07-001-feat-publikacja-ofert-plan.md'
const ZADANIE = 'docs/active/publikacja-ofert'

/** Projekt tymczasowy z planem i plikami, na ktore plan wskazuje. @returns {string} */
function projekt() {
  const korzen = mkdtempSync(join(tmpdir(), 'kontrakt-docs-active-'))
  const pliki = {
    [SCIEZKA_PLANU]: PLAN_MD,
    'docs/DESIGN.md': '# Design\n',
    'docs/plans/publikacja-ofert-figma/SPEC.md': '# SPEC\n',
    'docs/plans/publikacja-ofert-figma/lista-ofert.png': 'png',
    'docs/operator/publikacja-ofert-przygotowanie.md': '# Przygotowanie\n\n- [x] Konto Sentry — **[blokuje: faza 1]**\n'
      + '- [ ] Klucz mapy w `.env.local` — **[blokuje: faza 2]** (IU-2)\n',
  }
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
    writeFileSync(join(korzen, sciezka), tresc)
  }
  return korzen
}

const KORZEN = projekt()
const WYNIK = zadanieZPlanu(KORZEN, SCIEZKA_PLANU, { data: '2026-10-07' })
const { plan: planZadania, kontekst, zadania } = WYNIK.pliki
for (const [nazwa, tresc] of Object.entries(WYNIK.pliki)) {
  mkdirSync(join(KORZEN, ZADANIE), { recursive: true })
  writeFileSync(join(KORZEN, ZADANIE, `publikacja-ofert-${nazwa}.md`), tresc)
}
test.after(() => rmSync(KORZEN, { recursive: true, force: true }))
const PLAN = parsujPlan(PLAN_MD)

/** Literal wyciety ze zrodla workflowu: tekst miedzy kotwica a koncem (bez nich). */
function literal(/** @type {string} */ zrodlo, /** @type {string} */ kotwica, /** @type {string} */ koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" w zrodle workflowu — kotwica testu wymaga aktualizacji`)
  return zrodlo.slice(start + kotwica.length, zrodlo.indexOf(koniec, start + kotwica.length))
}

/** Wzorzec grepa z promptu (w zrodle JS ukosniki sa podwojone przez template literal). */
function wzorzecZPromptu(/** @type {string} */ zrodlo, /** @type {string} */ kotwica, /** @type {string} */ koniec) {
  return new RegExp(literal(zrodlo, kotwica, koniec).replace(/\\\\/g, '\\'))
}

/** Sekcja `## <naglowek>` do nastepnego naglowka poziomu 2. */
function sekcja(/** @type {string} */ md, /** @type {RegExp} */ naglowek) {
  const linie = md.split('\n')
  const start = linie.findIndex((l) => naglowek.test(l))
  if (start === -1) return null
  const koniec = linie.findIndex((l, i) => i > start && /^## /.test(l))
  return linie.slice(start, koniec === -1 ? undefined : koniec).join('\n')
}

const E2E_GREP = wzorzecZPromptu(autopilot, "CZY ZADANIE WYMAGA E2E: \\`grep -hE '", "'")
const E2E_WYKLUCZENIA = wzorzecZPromptu(autopilot, "*-zadania.md | grep -vcE '", "'")

/** Linie liczone przez precheck, completion-gate i smoke operatora: grep E2E bez kopii Operator: i findingow. */
const liniaE2e = (/** @type {string} */ l) => E2E_GREP.test(l) && !E2E_WYKLUCZENIA.test(l)

test('grepy E2E konsumentow sa te same w autopilocie (precheck, completion-gate) i w smoke operatora', () => {
  assert.equal(E2E_GREP.source, '^- \\[ \\].*\\[E2E\\]')
  assert.equal(E2E_WYKLUCZENIA.source, 'Operator:|\\[P[123]\\]')
  assert.ok(complete.includes(`grep -nE '^- \\\\[ \\\\].*\\\\[E2E\\\\]' docs/active/\${nazwaZadania}/*-zadania.md | grep -vE 'Operator:|\\\\[P[123]\\\\]'`))
})

test('planner: plan zadania ma tabele "## Fazy" i wskaznik planu technicznego, z ktorego dossier czyta plan', () => {
  assert.ok(execute.includes('tabela \\`## Fazy\\`'), 'planner czyta tabele ## Fazy')
  assert.ok(execute.includes('linia \\`Plan techniczny:\\`'), 'planner bierze sciezke planu technicznego z linii "Plan techniczny:"')
  assert.match(planZadania, /^## Fazy$/m)
  for (const plik of [planZadania, kontekst, zadania]) assert.equal(sciezkaPlanu(plik), SCIEZKA_PLANU)
})

test('bootstrap: lista faz z tabeli "## Fazy" = naglowki "## Faza N — nazwa" w zadaniach = fazy planu technicznego', () => {
  assert.ok(autopilot.includes('*-plan.md -> lista faz [(numer, nazwa)]'))
  const wiersze = (sekcja(planZadania, /^## Fazy$/) ?? '').split('\n').filter((l) => /^\| \d+ \|/.test(l))
  const zTabeli = wiersze.map((l) => l.split('|').map((k) => k.trim()).slice(1, 3).join(' — '))
  const zNaglowkow = [...zadania.matchAll(/^## Faza (\d+) — (.+)$/gm)].map((m) => `${m[1]} — ${m[2]}`)
  assert.deepEqual(zTabeli, ['1 — Status i zapis', '2 — Przycisk na liście'])
  assert.deepEqual(zNaglowkow, zTabeli)
  assert.deepEqual(PLAN.fazy.map((f) => `${f.numer} — ${f.nazwa}`), zTabeli)
})

test('bootstrap i planner: kazda faza ma niezaznaczony checkbox liczony do execute=done, skip-lista go nie pomija', () => {
  const skipLista = literal(execute, 'Do ukonczenia NIE licza sie (pomijaj calkowicie):', 'obsluguje je review/fix')
  for (const znacznik of ['"Weryfikacja:"', '"Operator:"', '"[E2E]"/"[Manual]"', '"## Do poprawy po review fazy N"', '"## Operator checklist faza N"']) {
    assert.ok(skipLista.includes(znacznik), `skip-lista plannera bez ${znacznik}`)
  }
  for (const faza of PLAN.fazy) {
    const blok = sekcja(zadania, new RegExp(`^## Faza ${faza.numer} `)) ?? ''
    const liczone = blok.split('\n').filter((l) => /^- \[ \]/.test(l) && !/Weryfikacja:|Operator:|\[E2E\]|\[Manual\]/.test(l))
    const oczekiwane = faza.iu.reduce((n, iu) => n + iu.pliki.length + iu.scenariusze.filter((s) => s.typ === 'Unit').length, 0)
    assert.equal(liczone.length, oczekiwane, `faza ${faza.numer}: pliki IU + [Unit]`)
    assert.ok(liczone.every((l) => !/^- \[ \] (Test: \[E2E\]|Weryfikacja:)/.test(l)))
  }
})

test('planner: IU w zadaniach jako "### IU-K: nazwa (Delegate to)" pod swoja faza', () => {
  for (const faza of PLAN.fazy) {
    const blok = sekcja(zadania, new RegExp(`^## Faza ${faza.numer} `)) ?? ''
    for (const iu of faza.iu) assert.ok(blok.includes(`### ${iu.id}: ${iu.nazwa} (${iu.delegate})`), `${iu.id} w fazie ${faza.numer}`)
  }
})

test('precheck E2E, completion-gate i smoke operatora: jedna linia [E2E] na scenariusz albo runner, kolumna 0', () => {
  const scenariusze = PLAN.fazy.flatMap((f) => f.iu.flatMap((iu) => iu.scenariusze.filter((s) => s.typ === 'E2E')))
  const runnery = PLAN.fazy.flatMap((f) => f.iu.flatMap((iu) => iu.weryfikacja.filter((w) => w.e2e)))
  assert.equal(zadania.split('\n').filter(liniaE2e).length, scenariusze.length + runnery.length)
  assert.equal(scenariusze.length, 2)
  assert.doesNotMatch(zadania, /^[ \t]+- \[[ x]\]/m, 'wciety checkbox jest niewidoczny dla grepow ^- \\[ \\]')
})

test('scribe review-wf: regex bookkeepingu lapie wszystkie Weryfikacja: i Test: [E2E], sekcji "Do poprawy" nie ma', () => {
  const bookkeeping = wzorzecZPromptu(review, 'pasujace do regex ', ' — oba prefiksy')
  const trafione = zadania.split('\n').filter((l) => bookkeeping.test(l))
  const weryfikacje = PLAN.fazy.flatMap((f) => f.iu.flatMap((iu) => iu.weryfikacja)).length
  assert.equal(trafione.length, weryfikacje + 2)
  assert.doesNotMatch(zadania, /^## Do poprawy po review fazy/m)
})

test('fix i db-sync: identyfikator flow w pierwszym backticku linii [E2E], seed jawnie i jako checkbox "Stwórz (e2e seed):"', () => {
  assert.ok(autopilot.includes('checkboxy implementacyjne "Stwórz (e2e seed):" tej fazy'))
  const e2e = zadania.split('\n').filter((l) => /^- \[ \] Test: \[E2E\]/.test(l))
  assert.deepEqual(e2e.map((l) => /`([^`]+)`/.exec(l)?.[1]), ['publikacja-oferty', 'oferta-publiczna'])
  assert.ok(e2e.every((l) => l.includes('(seed: e2e/seeds/publikacja-oferty-seed.sql)')))
  assert.match(zadania, /^- \[ \] Stwórz \(e2e seed\): `e2e\/seeds\/publikacja-oferty-seed\.sql`$/m)
})

test('scribe, fix i smoke operatora: "## Operator checklist faza N" po IU fazy, z [Manual] i pozycjami operatora IU', () => {
  assert.ok(review.includes('"## Operator checklist faza ${faza}"'))
  const operator = sekcja(zadania, /^## Operator checklist faza 2$/) ?? ''
  assert.match(operator, /^- \[ \] \[Manual\] przycisk na fizycznym telefonie ma wygodny cel dotyku \(IU-2\)$/m)
  assert.match(operator, /^- \[ \] Projektant akceptuje wygląd przycisku na liście \(IU-2\)$/m)
  assert.equal(sekcja(zadania, /^## Operator checklist faza 1$/), null, 'faza bez pozycji operatora nie ma sekcji')
  assert.ok(zadania.indexOf('## Operator checklist faza 2') > zadania.indexOf('### IU-3'))
})

test('domkniecie, scribe, compound i archiwizacja: kontekst ma sekcje "## Dziennik", planner "## Designerski kontekst"', () => {
  assert.ok(execute.includes('sekcji \\`## Dziennik\\`') && review.includes('sekcji \\`## Dziennik\\`'))
  assert.ok(execute.includes('sekcja \\`## Designerski kontekst\\`'))
  assert.match(kontekst, /^## Dziennik$/m)
  const design = sekcja(kontekst, /^## Designerski kontekst$/) ?? ''
  assert.match(design, /docs\/plans\/publikacja-ofert-figma\/SPEC\.md/)
  assert.match(design, /`lista-ofert`: `\.\/docs\/plans\/publikacja-ofert-figma\/lista-ofert\.png`/)
})

test('plan zadania: blokery operatora faz >= 2 z checklisty przygotowania, odhaczone pozycje pominiete', () => {
  const blokery = sekcja(planZadania, /^## Blokery operatora per faza$/) ?? ''
  assert.match(blokery, /^- \[ \] faza 2 — Klucz mapy w `\.env\.local` — \*\*\[blokuje: faza 2\]\*\* \(IU-2\) · docs\/operator\/publikacja-ofert-przygotowanie\.md:4$/m)
  assert.doesNotMatch(blokery, /Sentry/)
})

test('dossier fazy: wycinki planu, zadan, wymagan i kontekstu designerskiego znalezione w wygenerowanych plikach', () => {
  for (const faza of [1, 2]) {
    const w = wycinkiZadania(KORZEN, ZADANIE, faza)
    for (const pole of /** @type {const} */ (['planFazy', 'zadaniaFazy', 'designerski', 'wymagania'])) {
      assert.doesNotMatch(w[pole], /^Brak/, `faza ${faza}: ${pole}`)
    }
    assert.equal(w.e2eCheckboxy, faza === 2 ? 3 : 0)
    assert.equal(w.figmaScreens, true)
  }
})

test('kazdy plik zadania zaczyna sie od naglowka, galezi i daty aktualizacji', () => {
  for (const tresc of [planZadania, kontekst, zadania]) {
    assert.match(tresc, /^# .+\n\nBranch: `feature\/publikacja-ofert`\nOstatnia aktualizacja: 2026-10-07\n/)
  }
})
