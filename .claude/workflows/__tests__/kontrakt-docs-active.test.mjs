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
import { liczE2e, scenariuszeFazy } from '../../scripts/e2e/scenariusze.mjs'
import { KOMENDY_CLI } from '../../scripts/plan/walidacja-planu.mjs'
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
// Oczekiwania z fixture wpisane recznie, nie liczone parserem generatora: blad parsera nie moze sie tu sam potwierdzic.
const IU = [
  { faza: 1, naglowek: 'IU-1: Status oferty i serwis publikacji (feature-builder-data)' },
  { faza: 2, naglowek: 'IU-2: Przycisk publikacji na liście ofert (feature-builder-ui)' },
  { faza: 2, naglowek: 'IU-3: Adres publiczny oferty (feature-builder-fullstack)' },
]

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

// P14: start autopilota liczy scenariusze skryptem e2e.mjs (liczE2e), completion-gate i smoke operatora grepem z promptu.
const E2E_GREP = wzorzecZPromptu(autopilot, "Grepnij zadanie: \\`grep -nE '", "'")
const E2E_WYKLUCZENIA = wzorzecZPromptu(autopilot, "*-zadania.md | grep -vE '", "'")

/** Linie liczone przez completion-gate i smoke operatora: grep E2E bez kopii Operator: i findingow. */
const liniaE2e = (/** @type {string} */ l) => E2E_GREP.test(l) && !E2E_WYKLUCZENIA.test(l)

test('grepy E2E konsumentow sa te same w autopilocie (completion-gate) i w smoke operatora', () => {
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
  assert.doesNotMatch(zadania, /Równolegle z/, 'placeholder szablonu „— *(opcjonalne)*” nie trafia do zadan')
})

test('bootstrap i planner: kazda faza ma niezaznaczony checkbox liczony do execute=done, skip-lista go nie pomija', () => {
  const skipLista = literal(execute, 'Do ukonczenia NIE licza sie (pomijaj calkowicie):', 'obsluguje je review/fix')
  for (const znacznik of ['"Weryfikacja:"', '"Operator:"', '"[E2E]"/"[Manual]"', '"## Do poprawy po review fazy N"', '"## Operator checklist faza N"']) {
    assert.ok(skipLista.includes(znacznik), `skip-lista plannera bez ${znacznik}`)
  }
  // faza 1: 5 plikow IU-1 + 2 [Unit]; faza 2: 2 + 1 (IU-2) i 3 + 1 (IU-3)
  for (const [faza, oczekiwane] of [[1, 7], [2, 7]]) {
    const blok = sekcja(zadania, new RegExp(`^## Faza ${faza} `)) ?? ''
    const liczone = blok.split('\n').filter((l) => /^- \[ \]/.test(l) && !/Weryfikacja:|Operator:|\[E2E\]|\[Manual\]/.test(l))
    assert.equal(liczone.length, oczekiwane, `faza ${faza}: pliki IU + [Unit]`)
  }
})

test('planner: IU w zadaniach jako "### IU-K: nazwa (Delegate to)" pod swoja faza', () => {
  for (const { faza, naglowek } of IU) {
    assert.match(sekcja(zadania, new RegExp(`^## Faza ${faza} `)) ?? '', new RegExp(`^### ${naglowek.replace(/[()]/g, '\\$&')}$`, 'm'))
  }
})

test('precheck E2E, completion-gate i smoke operatora: jedna linia [E2E] na scenariusz albo runner, kolumna 0', () => {
  // 2 scenariusze [E2E] (IU-2, IU-3) + runner e2e/run-all.sh; [E2E] w kopii Operator: i [Manual] nie licza sie
  assert.equal(zadania.split('\n').filter(liniaE2e).length, 3)
  assert.equal(liczE2e(zadania), 3, 'start autopilota (e2e.mjs) liczy tak samo jak completion-gate')
  assert.equal(WYNIK.liczniki.e2e, 3)
  assert.doesNotMatch(zadania, /^[ \t]+- \[[ x]\]/m, 'wciety checkbox jest niewidoczny dla grepow ^- \\[ \\]')
})

// P14: linie [E2E] ksieguje skrypt e2e.mjs (scenariuszeFazy), Weryfikacja: bez markera klasyfikuje scribe — razem wszystkie
// Weryfikacja: i Test: [E2E] (zmiana kontraktu: wczesniej jeden regex scribe'a).
test('scribe review-wf: ksiegowanie obejmuje wszystkie Weryfikacja: i Test: [E2E], sekcji "Do poprawy" nie ma', () => {
  assert.ok(review.includes('Linie z markerem [E2E] (Test: i Weryfikacja:) ksieguje sam skrypt'))
  assert.ok(review.includes('Niezaznaczone linie "Weryfikacja:" BEZ markera [E2E] klasyfikujesz po tresci'))
  const zeSkryptu = [1, 2].flatMap((f) => scenariuszeFazy(zadania, f))
  const scribe = zadania.split('\n').filter((l) => /^- \[ \] Weryfikacja:/.test(l) && !/\[E2E\]/.test(l))
  assert.equal(zeSkryptu.length + scribe.length, 4 + 2, '4 Weryfikacja: + 2 Test: [E2E]')
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
  assert.match(operator, /^- \[ \] Operator: Projektant akceptuje wygląd przycisku na liście \(IU-2\)$/m)
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

test('scribe uruchamia kazda komende, ktora walidacja planu przyjmuje w Weryfikacji (inaczej "klasyfikacja niejasna")', () => {
  const lista = literal(review, '   - CLI (', '): uruchom komende')
  for (const komenda of KOMENDY_CLI) assert.match(lista, new RegExp(`(?:^|[\\s,(])${komenda}(?=[\\s,)]|$)`), `scribe bez ${komenda}`)
})
