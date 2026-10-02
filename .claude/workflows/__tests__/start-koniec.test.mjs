// Testy startu i konca runu (PLAN-POPRAWY P4): bramka wejscia autopilota (czystosc, doctor, zielony start z cache po SHA),
// fazy ukonczone po stanie zadania, komenda commita ze stopka po pustej linii oraz archiwizacja w dev-docs-complete-wf
// (pathspec bez CLAUDE.md i *.bak, komunikat `docs(<zadanie>): archiwum`, plik decyzji z polem claude_md, bramka rozmiaru PR).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/start-koniec.test.mjs
//
// DLACZEGO: decyzje bramek zapadaja w JS (agenci tylko zbieraja dane i wykonuja), wiec da sie je sprawdzic bez runtime'u
// Workflow — funkcje wycinamy ze zrodla jak w kontrola-fixa.test.mjs.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))

/**
 * Wycina fragment zrodla workflowu od kotwicy do konca (wlacznie).
 * @param {string} zrodlo
 * @param {string} kotwica
 * @param {string} koniec
 * @returns {string}
 */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

const autopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
const complete = readFileSync(resolve(KATALOG, '../dev-docs-complete-wf.js'), 'utf8')

// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const A = new Function(
  `${wytnij(autopilot, '// ── Bramka wejscia (P4)', '// ── Koniec bramki wejscia')}
   return { decyzjaWejscia, decyzjaTestowStartu, fazyUkonczone, instrukcjaCommita }`,
)()

// eslint-disable-next-line no-new-func -- jw.
const C = new Function(
  `${wytnij(complete, '// ── Archiwum (P4)', '// ── Koniec archiwum')}
   return { pathspecArchiwum, komunikatArchiwum, szkieletDecyzji, sprawdzDecyzje, bramkaRozmiaruPr, PROG_PLIKOW_PR }`,
)()

const ZADANIE = 'docs/active/zadanie-x'
const FAZY_NOWE = [{ numer: 1, execute: 'pending', review: 'pending', fix: 'none' }]
const CZYSTO = { zmiany: [], doctorKod: 0, doctorWynik: 'WYNIK: OK', kodJakPrzyTescie: null }

// ── Bramka wejscia autopilota ─────────────────────────────────────────────

test('wejscie: doctor bez obowiazkowego narzedzia = STOP z komenda doctora i swiezego runu', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, doctorKod: 1, doctorWynik: 'WYNIK: BRAK obowiązkowych: gh' }, FAZY_NOWE, null)
  assert.ok(d.stop, 'brak narzedzia zatrzymuje run przed faza 1')
  assert.match(d.stop.powod, /^start: doctor/)
  assert.match(d.stop.powod, /BRAK obowiązkowych: gh/)
  assert.match(d.stop.naprawa, /bash \.claude\/scripts\/doctor\/doctor\.sh/)
  assert.match(d.stop.naprawa, /\/dev-autopilot-wf docs\/active\/zadanie-x/)
})

test('wejscie: doctor bez wyniku (stary projekt bez skryptu) = uwaga, run idzie dalej', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, doctorKod: null, doctorWynik: '' }, FAZY_NOWE, null)
  assert.equal(d.stop, null)
  assert.equal(d.uwagi.length, 1)
  assert.match(d.uwagi[0], /doctor/)
})

test('wejscie: czyste drzewo, pierwsza faza przed nami, brak cache = testy startu', () => {
  const d = A.decyzjaWejscia(ZADANIE, CZYSTO, FAZY_NOWE, null)
  assert.deepEqual({ stop: d.stop, commitZadania: d.commitZadania, testyStartu: d.testyStartu }, { stop: null, commitZadania: false, testyStartu: true })
})

test('wejscie: zielony start z cache po SHA i kod bez zmian od testu = bez ponownych testow', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, kodJakPrzyTescie: true }, FAZY_NOWE, { sha: 'abc1234', wynik: 'PASS' })
  assert.equal(d.testyStartu, false)
  assert.equal(d.stop, null)
  assert.ok(d.uwagi.some((/** @type {string} */ u) => u.includes('abc1234')), 'log mowi, z ktorego SHA wzieto wynik')
})

test('wejscie: cache PASS, ale kod zmienil sie od testu = testy startu jeszcze raz', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, kodJakPrzyTescie: false }, FAZY_NOWE, { sha: 'abc1234', wynik: 'PASS' })
  assert.equal(d.testyStartu, true)
})

test('wejscie: zadanie w toku (faza z execute=done) = bez testow startu — kod faz testuje domkniecie', () => {
  const fazy = [{ numer: 1, execute: 'done', review: 'pending', fix: 'none' }, { numer: 2, execute: 'pending', review: 'pending', fix: 'none' }]
  const d = A.decyzjaWejscia(ZADANIE, CZYSTO, fazy, null)
  assert.equal(d.testyStartu, false)
  assert.equal(d.stop, null)
})

test('wejscie: brudny wylacznie katalog zadania = commit zadania i dalej, nie STOP', () => {
  const zmiany = [' M docs/active/zadanie-x/zadanie-x-zadania.md', '?? docs/active/zadanie-x/notatka.md', 'R  docs/active/zadanie-x/a.md -> docs/active/zadanie-x/b.md']
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, zmiany }, FAZY_NOWE, null)
  assert.equal(d.stop, null)
  assert.equal(d.commitZadania, true)
})

test('wejscie: brudne poza katalogiem zadania = STOP z lista sciezek i gotowa komenda', () => {
  const zmiany = [' M docs/active/zadanie-x/zadanie-x-zadania.md', ' M src/app.ts', '?? docs/active/zadanie-x-2/plan.md', 'R  docs/active/zadanie-x/a.md -> docs/b.md']
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, zmiany }, FAZY_NOWE, null)
  assert.ok(d.stop)
  assert.match(d.stop.powod, /niezacommitowane zmiany/, 'kategoria telemetrii: czystosc')
  for (const p of ['src/app.ts', 'docs/active/zadanie-x-2/plan.md', 'docs/b.md']) assert.ok(d.stop.powod.includes(p), `brak ${p} w powodzie`)
  assert.ok(!d.stop.powod.includes('zadanie-x-zadania.md'), 'katalog zadania nie jest zmiana operatora')
  assert.match(d.stop.naprawa, /git status --short/)
  assert.match(d.stop.naprawa, /\/dev-autopilot-wf docs\/active\/zadanie-x/)
})

test('wejscie: sciezka w cudzyslowie (spacja) jest rozpoznana', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, zmiany: ['?? "docs/active/zadanie-x/a b.md"'] }, FAZY_NOWE, null)
  assert.equal(d.stop, null)
  assert.equal(d.commitZadania, true)
})

test('testy startu: czerwone = STOP z komenda do odtworzenia i swiezym runem', () => {
  const d = A.decyzjaTestowStartu({ wynik: 'FAIL', sha: 'def5678', komenda: 'pnpm typecheck && pnpm test', bledy: ['src/a.test.ts: expected 1'] }, ZADANIE)
  assert.ok(d.stop)
  assert.match(d.stop.powod, /^start: testy/)
  assert.match(d.stop.powod, /src\/a\.test\.ts/)
  assert.match(d.stop.naprawa, /pnpm typecheck && pnpm test/)
  assert.match(d.stop.naprawa, /\/dev-autopilot-wf docs\/active\/zadanie-x/)
  assert.equal(d.cache, null, 'czerwony wynik nie trafia do cache — po naprawie testy ida jeszcze raz')
})

test('testy startu: zielone = wynik do stanu zadania z SHA', () => {
  const d = A.decyzjaTestowStartu({ wynik: 'PASS', sha: 'def5678', komenda: 'pnpm test', bledy: [] }, ZADANIE)
  assert.equal(d.stop, null)
  assert.deepEqual(d.cache, { sha: 'def5678', wynik: 'PASS' })
})

test('testy startu: agent bez wyniku albo projekt bez testow = uwaga, bez STOP-u i bez cache', () => {
  for (const w of [null, { wynik: 'BRAK-TESTOW', sha: 'def5678', komenda: '', bledy: [] }]) {
    const d = A.decyzjaTestowStartu(w, ZADANIE)
    assert.equal(d.stop, null)
    assert.equal(d.cache, null)
    assert.ok(d.uwaga)
  }
})

// ── Koniec runu autopilota ────────────────────────────────────────────────

test('fazyUkonczone liczy fazy domkniete w zadaniu, nie tylko w tym runie', () => {
  const fazy = [
    { numer: 1, execute: 'done', review: 'done', fix: 'none' },
    { numer: 2, execute: 'done', review: 'done', fix: 'done' },
    { numer: 3, execute: 'done', review: 'done', fix: 'pending' },
    { numer: 4, execute: 'pending', review: 'pending', fix: 'none' },
  ]
  assert.equal(A.fazyUkonczone(fazy), 2)
})

test('instrukcja commita: temat w pierwszym -m, stopka tylko w drugim -m (git wstawia pusta linie)', () => {
  const tekst = A.instrukcjaCommita("docs(zadanie-x): stan pipeline'u po STOP (faza 2)")
  assert.ok(tekst.includes('git commit -m "docs(zadanie-x): stan pipeline\'u po STOP (faza 2)"'))
  assert.match(tekst, /drugim `-m`/)
})

// ── Archiwizacja (dev-docs-complete-wf) ───────────────────────────────────

test('pathspec archiwum: katalogi zadania, smoke, decyzje i wyjscia compound; bez CLAUDE.md, .claude/rules/ i *.bak', () => {
  const p = C.pathspecArchiwum('zadanie-x', 'docs/operator/2026-10-02-zadanie-x-smoke.md', ['docs/solutions', '.claude/rules/learned-patterns.md'])
  for (const s of ['docs/active/zadanie-x', 'docs/completed/zadanie-x', 'docs/operator/2026-10-02-zadanie-x-smoke.md', 'docs/decisions', 'docs/solutions']) {
    assert.ok(p.split(' ').includes(s), `brak ${s}`)
  }
  assert.ok(!p.includes('CLAUDE.md'))
  assert.ok(p.includes("':(exclude,glob)**/*.bak'"), 'kopie robocze operatora nie wchodza do archiwum')
  assert.deepEqual(p.split(' ').filter((/** @type {string} */ s) => s.startsWith('.claude/rules/')), ['.claude/rules/learned-patterns.md'], 'z rules tylko wyjscie compound')
})

test('pathspec archiwum bez smoke i bez compound', () => {
  assert.equal(C.pathspecArchiwum('zadanie-x', '', []), "docs/active/zadanie-x docs/completed/zadanie-x docs/decisions ':(exclude,glob)**/*.bak'")
})

test('komunikat commita archiwizacji', () => {
  assert.equal(C.komunikatArchiwum('smoke-autopilot'), 'docs(smoke-autopilot): archiwum')
})

test('szkielet pliku decyzji ma frontmatter z polem claude_md: do-uzgodnienia', () => {
  const s = C.szkieletDecyzji('zadanie-x')
  assert.match(s, /^---\nzadanie: zadanie-x\ndata: <data z `date \+%F`>\nclaude_md: do-uzgodnienia\n---\n/)
})

test('plik decyzji: poprawna sciezka i pole = bez uwagi; brak pliku, zla sciezka albo inne pole = UWAGA', () => {
  assert.equal(C.sprawdzDecyzje({ plik: 'docs/decisions/2026-10-02-zadanie-x.md', claudeMd: 'do-uzgodnienia' }, 'zadanie-x'), null)
  for (const d of [null, { plik: '', claudeMd: '' }, { plik: 'docs/decisions/zadanie-x.md', claudeMd: 'do-uzgodnienia' }, { plik: 'docs/decisions/2026-10-02-zadanie-x.md', claudeMd: 'uzgodniono' }]) {
    assert.match(C.sprawdzDecyzje(d, 'zadanie-x') ?? '', /^UWAGA/)
  }
})

test('bramka rozmiaru PR: do progu bez uwagi, powyzej UWAGA z liczba i propozycja podzialu po katalogach', () => {
  /** @param {number} n @param {string} katalog @returns {string[]} */
  const pliki = (n, katalog) => Array.from({ length: n }, (_, i) => `${katalog}/p${i}.ts`)
  assert.equal(C.PROG_PLIKOW_PR, 150)
  assert.equal(C.bramkaRozmiaruPr(pliki(150, 'src/lib')), null)
  const u = C.bramkaRozmiaruPr([...pliki(120, 'apps/web/src'), ...pliki(31, 'packages/core/src'), 'README.md'])
  assert.match(u, /^UWAGA: PR ma 152 plików \(próg 150\)/)
  assert.match(u, /apps\/web: 120/)
  assert.match(u, /packages\/core: 31/)
})
