// Status E2E „nie odegrano” (punkt 35): faza ze scenariuszami [E2E], tester w trybie interaktywnym, zero PASS i zero FAIL.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/e2e-nie-odegrano.test.mjs
//
// Dashboard E2, run wf_a495d97e-47b (2026-11-08): w fazach 7–11 zrzuty narzedzia jazdy zawieszaly sie, testerzy oddali same SKIP,
// 8 scenariuszy poszlo do operatora, a kazda z tych faz miala E2E „wykonany”, gate CZYSTE i wynik runu OK. Raport koncowy
// tego nie wyroznial. Status liczy review-wf (statusTesteraE2e), a autopilot rozpoznaje go w raportach faz (fazyNieOdegrane)
// i pokazuje w nastepneKroki. Gate zostaje bez zmian.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const review = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')
const autopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')

/** @param {string} zrodlo @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/** @typedef {{ wynik: string, przyczyna?: string }} Wpis */
/** @typedef {{ aktywny: boolean, testerFail: boolean, jestWynik: boolean, przebiegi: Wpis[], tryb: string, retry: boolean }} WejscieStatusu */
/** @typedef {{ faza: number, przebieg: Record<string, unknown> | null | undefined }} RaportFazy */
/** @type {{ e2eNieOdegrano: (przebiegi: Wpis[], tryb: string) => boolean, statusTesteraE2e: (w: WejscieStatusu) => string }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { e2eNieOdegrano, statusTesteraE2e } = new Function(`${wytnij(review, 'function e2eNieOdegrano(', '\n}\n')}
  ${wytnij(review, 'function statusTesteraE2e(', '\n}\n')}
  return { e2eNieOdegrano, statusTesteraE2e }`)()
/** @type {{ fazyNieOdegrane: (raporty: (RaportFazy | null)[]) => { faza: number, scenariusze: number }[], nastepneKroki: (w: { smoke: string, raporty: unknown[], propozycjeBramek: unknown[], czesci: boolean, zadanie: string }) => string[], skrotPrzebiegu: (p: object) => Record<string, unknown> }} */
// eslint-disable-next-line no-new-func -- jw.
const { fazyNieOdegrane, nastepneKroki, skrotPrzebiegu } = new Function(`${wytnij(autopilot, 'const STATUS_E2E_NIE_ODEGRANO = ', '\n')}
  ${wytnij(autopilot, 'function fazyNieOdegrane(', '\n}\n')}
  ${wytnij(autopilot, 'function nastepneKroki(', '\n}\n')}
  ${wytnij(autopilot, 'function skrotPrzebiegu(', '\n}\n')}
  return { fazyNieOdegrane, nastepneKroki, skrotPrzebiegu }`)()

const SKIP_HARNESS = { wynik: 'SKIP', przyczyna: 'harness' }
const SKIP_SRODOWISKO = { wynik: 'SKIP', przyczyna: 'srodowisko' }
const PASS = { wynik: 'PASS', przyczyna: 'nie-dotyczy' }
const FAIL = { wynik: 'FAIL', przyczyna: 'nie-dotyczy' }

/** @param {Partial<WejscieStatusu>} w @returns {string} */
const status = (w) => statusTesteraE2e({ aktywny: true, testerFail: false, jestWynik: true, przebiegi: [], tryb: 'interaktywny', retry: false, ...w })

test('e2eNieOdegrano: tryb interaktywny, sa wpisy, zero PASS i zero FAIL', () => {
  assert.equal(e2eNieOdegrano([SKIP_HARNESS, SKIP_SRODOWISKO], 'interaktywny'), true)
  assert.equal(e2eNieOdegrano([SKIP_HARNESS, PASS], 'interaktywny'), false, 'jeden PASS = cos odegrano')
  assert.equal(e2eNieOdegrano([SKIP_HARNESS, FAIL], 'interaktywny'), false, 'FAIL to tez odegrany scenariusz')
  assert.equal(e2eNieOdegrano([], 'interaktywny'), false, 'faza bez scenariuszy nie ma czego odegrac')
  assert.equal(e2eNieOdegrano([SKIP_SRODOWISKO, SKIP_SRODOWISKO], 'bez-interakcji'), false, 'bez-interakcji: same SKIP sa stanem oczekiwanym')
})

test('statusTesteraE2e: same SKIP w trybie interaktywnym = „nie odegrano” z liczba scenariuszy; bez-interakcji zostaje „wykonany”', () => {
  assert.equal(status({ przebiegi: [SKIP_HARNESS, SKIP_HARNESS, SKIP_SRODOWISKO] }), 'nie odegrano (tryb interaktywny) — zaden z 3 scenariuszy nie ma PASS ani FAIL')
  assert.equal(status({ przebiegi: [SKIP_HARNESS], retry: true }), 'nie odegrano (tryb interaktywny) — zaden z 1 scenariuszy nie ma PASS ani FAIL (po retry)')
  assert.equal(status({ przebiegi: [SKIP_SRODOWISKO, SKIP_SRODOWISKO], tryb: 'bez-interakcji' }), 'wykonany (tryb bez-interakcji)')
})

test('statusTesteraE2e: pozostale statusy bez zmian', () => {
  assert.equal(status({ aktywny: false }), 'pominiety przez routing')
  assert.equal(status({ testerFail: true }), 'padl (2x wynik bez zadnego przebiegu) — zadnego dowodu')
  assert.equal(status({ testerFail: true, jestWynik: false }), 'padl (agent null 2x) — zadnego przebiegu')
  assert.equal(status({ jestWynik: false }), 'bez checkboxow [E2E] (dossier: 0, tester nic nie zwrocil — OK)')
  assert.equal(status({}), 'wykonany — brak checkboxow [E2E] w fazie')
  assert.equal(status({ retry: true }), 'wykonany — brak checkboxow [E2E] w fazie (po retry; liczba z dossier nieznana)')
  assert.equal(status({ przebiegi: [PASS, SKIP_HARNESS] }), 'wykonany (tryb interaktywny)')
  assert.equal(status({ przebiegi: [FAIL], retry: true }), 'wykonany (tryb interaktywny) (po retry)')
})

test('review-wf: status liczy funkcja, a log nazywa faze bez odegranych scenariuszy', () => {
  assert.match(review, /const e2eStatus = statusTesteraE2e\(\{ aktywny: e2eAktywny, testerFail: e2eTesterFail, jestWynik: !!e2eWynik, przebiegi: e2ePrzebiegi, tryb: e2eTryb, retry: e2eRetry \}\)/)
  assert.match(review, /if \(!e2eTesterFail && e2eNieOdegrano\(e2ePrzebiegi, e2eTryb\)\) log\(/)
})

// Status przechodzi do autopilota przez stan fazy (skrotPrzebiegu), wiec test sklada oba konce: tekst z review-wf i rozpoznanie
// w autopilocie. Zmiana brzmienia statusu po jednej stronie zatrzymuje ten test.
test('fazyNieOdegrane: rozpoznaje status z review-wf po zapisie do stanu; liczba = scenariusze fazy', () => {
  const przebiegi = [SKIP_HARNESS, SKIP_HARNESS]
  const zReview = { pominieci: [], e2eTryb: 'interaktywny', e2eCheckboxy: 3, e2eStatus: status({ przebiegi }), e2ePass: 0, e2eFail: 0, e2eSkip: 2, e2eManual: 2 }
  const odegrana = { ...zReview, e2eStatus: status({ przebiegi: [PASS, SKIP_HARNESS] }), e2ePass: 1, e2eSkip: 1 }
  const bezInterakcji = { ...zReview, e2eTryb: 'bez-interakcji', e2eStatus: status({ przebiegi, tryb: 'bez-interakcji' }) }
  const raporty = [
    { faza: 6, przebieg: skrotPrzebiegu(odegrana) },
    { faza: 7, przebieg: skrotPrzebiegu(zReview) },
    { faza: 8, przebieg: skrotPrzebiegu(bezInterakcji) },
    { faza: 9, przebieg: skrotPrzebiegu({ ...zReview, e2eCheckboxy: null, e2eSkip: 2 }) },
    { faza: 10, przebieg: null },
    { faza: 11, przebieg: undefined },
    null,
  ]
  assert.deepEqual(fazyNieOdegrane(raporty), [{ faza: 7, scenariusze: 3 }, { faza: 9, scenariusze: 2 }],
    'faza 7: 3 linie [E2E], 2 wpisy SKIP — trzeci scenariusz bez wpisu tez nie zostal odegrany')
})

test('nastepneKroki: fazy z E2E „nie odegrano” ida do akcji operatora z numerami faz i liczba scenariuszy', () => {
  const nieOdegrana = (/** @type {number} */ faza, /** @type {number} */ n) => ({ faza, liczniki: { operator: 0 }, przebieg: { e2eStatus: status({ przebiegi: Array.from({ length: n }, () => SKIP_HARNESS) }), e2eCheckboxy: n, e2eSkip: n } })
  const kroki = nastepneKroki({ smoke: 'docs/operator/x-smoke.md', raporty: [{ faza: 6, liczniki: { operator: 1 }, przebieg: { e2eStatus: 'wykonany (tryb interaktywny)', e2eSkip: 0 } }, nieOdegrana(7, 3), nieOdegrana(8, 5)], propozycjeBramek: [], czesci: false, zadanie: 'x' })
  assert.equal(kroki.length, 3)
  assert.match(kroki[1], /^Akcje operatora: E2E nie odegrano — do odegrania recznie albo ponownie: faza 7 \(scenariuszy: 3\), faza 8 \(scenariuszy: 5\), 1 findingow OPERATOR/)
  const bez = nastepneKroki({ smoke: '', raporty: [{ faza: 6, liczniki: { operator: 0 }, przebieg: { e2eStatus: 'wykonany (tryb interaktywny)' } }], propozycjeBramek: [], czesci: false, zadanie: 'x' })
  assert.deepEqual(bez, ["Po smoke'u: `/clear`, potem `/dev-pr 3 --bez-merge` (zadanie x)."], 'bez takich faz raport bez dodatkowej pozycji')
})

// Pilot Nawykometr, run 3: tura poprawkowa zostawila pozycje kontroli fixa z uzasadnieniem „do decyzji operatora”, ale bez
// prefiksu OPERATOR — doDecyzjiOperatora bylo puste, gate CZYSTE, a pozycja zostala tylko w kontrolaFixa.pominiete wyniku runu.
test('nastepneKroki: pozycje kontroli fixa bez naprawy (pominiete bez prefiksu OPERATOR i bez sladu) ida do akcji operatora', () => {
  const raport = (/** @type {number} */ faza, /** @type {object | null} */ kontrolaFixa) => ({ faza, liczniki: { operator: 0 }, kontrolaFixa, doDecyzjiOperatora: [], przebieg: { e2eStatus: 'wykonany (tryb interaktywny)' } })
  const kroki = nastepneKroki({ smoke: '', propozycjeBramek: [], czesci: false, zadanie: 'x', raporty: [
    raport(1, { pozycje: 1, naprawione: 0, pominiete: ['smoke.sql:1 — nie da sie zamknac doslownie, do decyzji operatora'], bezSladu: 0 }),
    raport(2, { pozycje: 3, naprawione: 1, pominiete: ['OPERATOR: zmiana spoza planu'], bezSladu: 1 }),
    raport(3, { pozycje: 2, naprawione: 2, pominiete: [], bezSladu: 0 }),
    raport(4, null),
  ] })
  assert.equal(kroki[0], 'Akcje operatora: pozycje kontroli fixa bez naprawy: faza 1 (1), faza 2 (1) — uzasadnienia w kontrolaFixa.pominiete wyniku runu.')
})

test('autopilot: log koncowy bierze fazy ze stanu (takze z poprzedniego runu); schemat stanu opisuje nowy status', () => {
  assert.match(autopilot, /const e2eNieOdegrane = fazyNieOdegrane\(stan\.fazy\.map\(\(f\) => \(\{ faza: f\.numer, przebieg: f\.metryki && f\.metryki\.przebieg \}\)\)\)\nif \(e2eNieOdegrane\.length\) log\(`UWAGA: E2E nie odegrano/)
  assert.match(autopilot, /e2eStatus: \{ type: \['string', 'null'\], description: 'status testera E2E z review-wf \(wykonany \/ nie odegrano \/ padl \/ pominiety przez routing\)' \}/)
})
