// Test kontraktu: WSZYSTKO, co pipeline wklada do .autopilot-state.json, musi przejsc przez schemat stanu.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/metryki-w-stanie.test.mjs
//   albo caly katalog:  node --test '.claude/workflows/__tests__/*.test.mjs'   (glob w apostrofach)
//
// DLACZEGO TEN TEST ISTNIEJE (audyt powdrozeniowy 2026-09-06, znaleziska N3 i N2):
// stan przechodzi przez bootstrap-agenta, ktory przepisuje go przez schemat z `additionalProperties: false`.
// Kazde pole, ktorego schemat nie zna, jest po cichu WYMAZYWANE — bez bledu, bez logu. Trafilismy na to
// dwa razy naraz:
//   N3 — review-wf liczyl `dossier`, `sceptycy`, `severityKorekty`, `tiery`, ale METRYKI_FAZY ich nie
//        deklarowal, wiec do telemetrii nie mialy jak dojsc. Dwa z trzech progow alarmowych planu
//        naprawy byly przez to niemierzalne, a `dossier: false` (cichy fallback do czytania pelnych
//        dokumentow) wygladal w danych identycznie jak sukces.
//   N2 — `otwartePoReview` zaczelo (commit 3007df4, plan B1) przepuszczac findingi P3 typu KOD/TEST,
//        ale FINDING_OTWARTY.severity zostal na enum ['P1','P2']. W jednym runie fix czyta findingi
//        z pamieci, wiec bug byl niewidoczny; uderzal dopiero przy WZNOWIENIU miedzy runami.
//        Dowod z produkcji: stan oferty-online po STOP fazy 6 mial 13 findingow P3 w polu, ktorego
//        schemat ich nie dopuszcza.
//
// Test jest wiec o ZACHOWANIU ("dane przezywaja zapis stanu"), nie o ksztalcie kodu: porownuje to, co
// funkcje realnie produkuja, z tym, co schemat realnie dopuszcza.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodloAutopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
const zrodloReview = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')

// ── Ekstrakcja jednostek testowanych ──────────────────────────────────────
// Workflowy sa self-contained skryptami runtime'u Workflow (top-level await/return, globalne `agent`),
// wiec `import()` ich nie zaladuje. Wycinamy potrzebne deklaracje ze ZRODLA, zeby test sprawdzal
// dokladnie ten kod, ktory poleci w runie, a nie jego kopie.

// UWAGA na wzorzec ponizej: `new Function` z interpolacja to w kodzie produkcyjnym droga do wykonania
// obcego kodu. Tutaj jest bezpieczny i swiadomy — interpolujemy WYLACZNIE fragmenty wyciete z plikow
// tego repo (nie z wejscia uzytkownika, nie z sieci), a test biegnie lokalnie. NIE kopiuj tego do
// kodu produkcyjnego: tam obowiazuje coding-rules §9 (zero dynamicznego wykonywania kodu z inputu).
/**
 * @param {string} zrodlo
 * @param {string} kotwica
 * @param {string} koniec
 * @param {string} opis
 * @returns {string}
 */
function wytnij(zrodlo, kotwica, koniec, opis) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu (${opis}) wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca ${opis}`)
  return zrodlo.slice(start, stop + koniec.length)
}

const kodMetryki = wytnij(zrodloAutopilot, 'const METRYKI_FAZY = {', "\n  required: ['liczniki', 'przebieg'],\n}", 'METRYKI_FAZY')
const kodFinding = wytnij(zrodloAutopilot, 'const FINDING_OTWARTY = {', "\n}", 'FINDING_OTWARTY')
const kodSkrot = wytnij(zrodloAutopilot, 'function skrotPrzebiegu(', '\n}', 'skrotPrzebiegu')
const kodOtwarte = wytnij(zrodloAutopilot, 'function otwartePoReview(', '\n}', 'otwartePoReview')

/** @typedef {import('./typy.mjs').Finding} Finding */
/**
 * Czesci schematow stanu, ktore czyta ten test (METRYKI_FAZY.przebieg, FINDING_OTWARTY.severity).
 * @type {{
 *   METRYKI_FAZY: { properties: { przebieg: { properties: Record<string, unknown>, required: string[] } } },
 *   FINDING_OTWARTY: { properties: { severity: { enum: string[] } } },
 *   skrotPrzebiegu: (p: object) => Record<string, unknown>,
 *   otwartePoReview: (findings: Finding[]) => Finding[],
 * }}
 */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { METRYKI_FAZY, FINDING_OTWARTY, skrotPrzebiegu, otwartePoReview } = new Function(
  `${kodMetryki}\n${kodFinding}\n${kodSkrot}\n${kodOtwarte}\nreturn { METRYKI_FAZY, FINDING_OTWARTY, skrotPrzebiegu, otwartePoReview }`,
)()

// Pelny przebieg, taki jaki review-wf sklada w obiekcie `przebieg` (dev-docs-review-wf.js, koniec pliku).
const PRZEBIEG_Z_REVIEW = {
  pominieci: [{ key: 'e2e', powod: 'zero checkboxow' }],
  e2eTryb: 'pominiety',
  znalezione: 34, poDedupJs: 34, poDedupSem: 19, weryfikowane: 8, obalone: 1, p3Odrzucone: 0,
  e2eCheckboxy: 0, e2eStatus: 'pominiety przez routing', e2ePass: 0, e2eFail: 0, e2eSkip: 0,
  dossier: true,
  sceptyk: { agree: 7, disagree_evidence: 2, disagree_concern: 3, degradacje: 3 },
  sceptycy: { p1: 6, p2Grupy: 4, p2Findingi: 11 },
  tiery: { packager: 'haiku', reviewer: null, sceptykP1: null, sceptykP2: 'medium' },
}

// ── Testy ─────────────────────────────────────────────────────────────────

test('skrotPrzebiegu przepisuje metryki kosztu review do stanu', () => {
  const s = skrotPrzebiegu(PRZEBIEG_Z_REVIEW)
  assert.equal(s.dossier, true, 'dossier musi przejsc — bez niego prog "efekt dossier" jest niemierzalny, a cichy fallback nieodrozialny od sukcesu')
  assert.deepEqual(s.sceptycy, { p1: 6, p2Grupy: 4, p2Findingi: 11 }, 'sceptycy musza przejsc — bez nich nie widac, czy batchowanie P2 dziala')
  // Zmiana kontraktu (P9): etykiety sceptyka asymetrycznego zastepuja severityKorekty (regula A7 nie obowiazuje dla P2).
  assert.deepEqual(s.sceptyk, { agree: 7, disagree_evidence: 2, disagree_concern: 3, degradacje: 3 }, 'etykiety musza przejsc — progi P9 (obalenia, degradacje) stoja na faza.sceptyk')
  assert.ok(!('severityKorekty' in s), 'severityKorekty nie ma juz producenta')
  assert.deepEqual(s.tiery, PRZEBIEG_Z_REVIEW.tiery)
})

test('skrotPrzebiegu na przebiegu ze STARSZEGO runu daje null, nie zero', () => {
  /** @type {Partial<typeof PRZEBIEG_Z_REVIEW>} */
  const stary = { ...PRZEBIEG_Z_REVIEW }
  delete stary.dossier; delete stary.sceptycy; delete stary.sceptyk; delete stary.tiery
  const s = skrotPrzebiegu(stary)
  // Zero znaczyloby "zmierzone i wyszlo zero". Brak danych ma byc odrozialny od pomiaru.
  assert.equal(s.dossier, null)
  assert.equal(s.sceptycy, null)
  assert.equal(s.sceptyk, null)
  assert.equal(s.tiery, null)
})

test('METRYKI_FAZY dopuszcza KAZDY klucz, ktory produkuje skrotPrzebiegu', () => {
  const wyprodukowane = Object.keys(skrotPrzebiegu(PRZEBIEG_Z_REVIEW))
  const dopuszczone = Object.keys(METRYKI_FAZY.properties.przebieg.properties)
  const wymazane = wyprodukowane.filter((k) => !dopuszczone.includes(k))
  assert.deepEqual(
    wymazane, [],
    `te pola zostalyby po cichu WYMAZANE przy pierwszym zapiszStan (additionalProperties: false): ${wymazane.join(', ')}. Dopisz je do METRYKI_FAZY.properties.przebieg — poza "required", zeby nie wywrocic resume starszych zadan.`,
  )
})

test('METRYKI_FAZY nie wymaga nowych pol — resume starszego zadania nie moze paść', () => {
  const wymagane = METRYKI_FAZY.properties.przebieg.required
  for (const nowe of ['dossier', 'sceptycy', 'sceptyk', 'tiery', 'p3Odrzucone', 'e2eCheckboxy']) {
    assert.ok(!wymagane.includes(nowe), `${nowe} nie moze byc w "required" — stany zapisane wczesniej tego pola nie maja i bootstrap wywalilby sie na walidacji`)
  }
})

// Zmiana kontraktu (P8): fix naprawia tylko P1/P2 — otwartePoReview przestaje przepuszczac P3 (odwrocenie planu B1),
// P3 zapisuje scribe do known-issues. FINDING_OTWARTY zostaje przy P3: stan sprzed P8 moze je trzymac, a bootstrap
// bez P3 w enumie wymazalby je przy wznowieniu, zanim orkiestrator przeniesie je do known-issues (odlozP3ZeStanu).
test('otwartePoReview przepuszcza do fixa tylko P1/P2 typu KOD/TEST/E2E', () => {
  const findings = [
    { severity: 'P1', typ: 'KOD', plik: 'a.ts:1', opis: 'p1' },
    { severity: 'P2', typ: 'TEST', plik: 'b.ts:2', opis: 'p2' },
    { severity: 'P2', typ: 'E2E', plik: 'g.ts:7', opis: 'p2 e2e' },
    { severity: 'P3', typ: 'KOD', plik: 'c.ts:3', opis: 'p3 kod — known-issues' },
    { severity: 'P3', typ: 'TEST', plik: 'd.ts:4', opis: 'p3 test — known-issues' },
    { severity: 'P2', typ: 'OPERATOR', plik: 'f.ts:6', opis: 'operator — poza fixem' },
  ]
  assert.deepEqual(otwartePoReview(findings).map((f) => f.plik), ['a.ts:1', 'b.ts:2', 'g.ts:7'])
})

test('FINDING_OTWARTY dopuszcza severity z otwartePoReview i P3 ze stanu sprzed P8', () => {
  const otwarte = otwartePoReview([
    { severity: 'P1', typ: 'KOD', plik: 'a.ts:1', opis: 'p1' },
    { severity: 'P2', typ: 'TEST', plik: 'b.ts:2', opis: 'p2' },
  ])
  const dopuszczane = FINDING_OTWARTY.properties.severity.enum
  const odrzucane = [...new Set(otwarte.map((f) => f.severity))].filter((s) => !dopuszczane.includes(s))
  assert.deepEqual(odrzucane, [], `severity ${odrzucane.join(', ')} trafia do otwarteFindingi, ale FINDING_OTWARTY ich nie dopuszcza — bootstrap wymazalby je przy wznowieniu`)
  assert.ok(dopuszczane.includes('P3'), 'stan sprzed P8 trzyma P3 w otwarteFindingi — bez P3 w enumie bootstrap wymaze je przed przeniesieniem do known-issues (dowod: oferty-online, faza 6, 13 utraconych P3)')
})

// Zmiana kontraktu (P7): dossier liczy skrypt w domknieciu fazy albo zapasowy agent w review — raport nazywa zrodlo,
// bo zapasowy agent po STOP-ie miedzy execute a review to sciezka do sprawdzenia w smoke'u (PLAN-POPRAWY P7).
test('dossierOpis rozroznia "nie powstalo" od "nie mierzono" i nazywa zrodlo dossier', () => {
  const kod = wytnij(zrodloReview, 'function dossierOpis(', '\n}', 'dossierOpis')
  // eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
  const { dossierOpis } = new Function(`${kod}\nreturn { dossierOpis }`)()
  assert.match(dossierOpis(true, 'domkniecie'), /^TAK — .*domkniecia fazy/)
  assert.match(dossierOpis(true, 'zapas'), /^TAK — .*zapasowy agent/)
  assert.match(dossierOpis(false), /^NIE/, 'false to realny sygnal cichego fallbacku — musi byc widoczny')
  // Przebieg ze starszego runu nie ma tego pola. Raportowanie go jako "NIE" oskarzaloby pipeline
  // o fallback, ktorego nikt nie zmierzyl — i zafalszowaloby prog "efekt dossier" przy porownaniach.
  assert.match(dossierOpis(null), /brak danych/)
  assert.match(dossierOpis(undefined), /brak danych/)
})

test('przebiegBlok renderuje metryki kosztu review w raporcie fazy', () => {
  // Raport jest jedynym miejscem, w ktorym te liczby widzi czlowiek — telemetria jest do strojenia progow.
  // Zmiana kontraktu (P9): wiersz korekt severity zastapiony etykietami sceptyka asymetrycznego.
  for (const kotwica of ['| Dossier fazy |', '| Sceptycy:', '| Sceptycy: AGREE / DISAGREE_EVIDENCE / DISAGREE_CONCERN', '| Tiery rozumowania |']) {
    assert.ok(zrodloReview.includes(kotwica), `przebiegBlok nie renderuje wiersza "${kotwica}" — metryka bedzie zyla wylacznie w zywym logu workflowu`)
  }
})
