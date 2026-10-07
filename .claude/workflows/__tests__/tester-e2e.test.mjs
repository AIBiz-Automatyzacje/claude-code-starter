// Tester E2E (PLAN-POPRAWY P14 sesja 2): jedno zrodlo procedury. Plik roli `feature-tester-e2e.md` niesie cala procedure
// (scenariusze, seedy vs kontrakt migracji, srodowisko, klasyfikacja przyczyn SKIP, makiety), a `e2ePrompt` w review-wf podaje
// tylko parametry wywolania i tryb oraz wspolne bloki workflowu. Wczesniej ta sama procedura siedziala w obu miejscach
// i rozjezdzala sie (plik roli: „zero auto pass/fail” makiet, prompt: „rozbieznosci = P2”).
//
// Uruchomienie: node --test .claude/workflows/__tests__/tester-e2e.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { PRZYCZYNY_SKIP } from '../../scripts/e2e/ksiegowanie.mjs'
import { PLIK_SKILLA } from '../../scripts/e2e/weryfikacja.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const review = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')
const tester = readFileSync(resolve(KATALOG, '../../agents/feature-tester-e2e.md'), 'utf8')

/** @param {string} zrodlo @param {string} kotwica @param {string} koniec */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

// Bloki wspolne podstawione znacznikami — test mierzy wlasna tresc promptu testera, nie bloki workflowu.
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const e2ePrompt = new Function('BLOK_DLUGIE_KOMENDY', 'BLOK_LIMIT_P3', 'mapaBlok', 'rereviewBlok', 'SKILL_WERYFIKACJI',
  `${wytnij(review, 'function e2ePrompt(', '\n}\n')}\n  return e2ePrompt`)('<DLUGIE>', '<P3>', () => '<MAPA>', () => '<REREVIEW>', '.claude/skills/weryfikacja/SKILL.md')

const ZADANIE = 'docs/active/zadanie-x'
const MAKS_WLASNEJ_TRESCI = 700

test('e2ePrompt: parametry wywolania i tryb, bez procedury', () => {
  const p = e2ePrompt(ZADANIE, 2, [], 'bez-przegladarki', {})
  assert.match(p, /fazy 2/)
  assert.match(p, /docs\/active\/zadanie-x/)
  assert.match(p, /Tryb: bez-przegladarki/)
  assert.match(p, /\.claude\/skills\/weryfikacja\/SKILL\.md/)
  for (const blok of ['<DLUGIE>', '<P3>', '<MAPA>', '<REREVIEW>']) assert.ok(p.includes(blok), `brak bloku wspolnego ${blok}`)
  const wlasna = p.replace(/<DLUGIE>|<P3>|<MAPA>|<REREVIEW>/g, '')
  assert.ok(wlasna.length <= MAKS_WLASNEJ_TRESCI, `wlasna tresc promptu: ${wlasna.length} zn. (limit ${MAKS_WLASNEJ_TRESCI}) — procedura nalezy do pliku roli`)
  for (const procedura of [/curl/, /e2e\.mjs stan/, /agent-browser doctor/, /psql/, /run-all\.sh/, /figma_screens/, /limit-zewnetrzny/]) {
    assert.doesNotMatch(wlasna, procedura, `procedura w prompcie: ${procedura}`)
  }
  assert.match(e2ePrompt(ZADANIE, 1, [], 'przegladarka', {}), /Tryb: przegladarka/)
})

test('review-wf: blok trybu bez przegladarki przeniesiony do pliku roli; sciezka skilla = kopia stalej skryptu', () => {
  assert.doesNotMatch(review, /const BLOK_BEZ_PRZEGLADARKI/)
  assert.ok(review.includes(`const SKILL_WERYFIKACJI = '${PLIK_SKILLA}'`), 'kopia sciezki skilla w review-wf = PLIK_SKILLA z weryfikacja.mjs')
})

test('plik roli: kazda przyczyna SKIP ze schematu testera i z ksiegowania (poza padem testera, ktory nadaje workflow)', () => {
  const schemat = wytnij(review, 'const E2E_RESULT = {', '\n}\n')
  const zSchematu = /przyczyna: \{ type: 'string', enum: \[([^\]]+)\]/.exec(schemat)?.[1].match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ?? []
  assert.ok(zSchematu.length >= 6, 'enum przyczyn w schemacie')
  for (const p of [...zSchematu, ...Object.keys(PRZYCZYNY_SKIP).filter((k) => k !== 'tester-padl')]) {
    assert.ok(tester.includes(`\`${p}\``), `plik roli nie opisuje przyczyny \`${p}\``)
  }
})

test('plik roli: scenariusze ze skryptu (oba prefiksy), srodowisko i pad serwera, tryb bez przegladarki', () => {
  assert.match(tester, /e2e\.mjs scenariusze --zadanie/)
  assert.match(tester, /`Test: \[E2E\]/)
  assert.match(tester, /`Weryfikacja: \[E2E\]/)
  assert.match(tester, /curl -sS/)
  assert.match(tester, /node \.claude\/scripts\/e2e\/e2e\.mjs stan/)
  assert.match(tester, /`"nasz": true`/)
  assert.match(tester, /`"zyje": true`[^.]*watcher/)
  assert.match(tester, /serwer aplikacji padł/)
  assert.match(tester, /`srodowisko`[^.]*bez findingu/)
  assert.match(tester, /W trybie `bez-przegladarki`/)
  assert.match(tester, /agent-browser doctor --offline --quick/)
  assert.match(tester, /E2E_TEST_EMAIL/)
})

test('plik roli: seed kontra kontrakt migracji — kolumny wymagane, DEFAULT, wartosc nieosiagalna = P2', () => {
  const seedy = wytnij(tester, '### Seedy', '\n### ')
  assert.match(seedy, /kolumn[^.]*wymaganych przez migracje/)
  assert.match(seedy, /DEFAULT/)
  assert.match(seedy, /nieosiągaln/)
  assert.match(seedy, /P2 typ E2E/)
  assert.match(seedy, /`brak-seeda`/)
  assert.match(seedy, /`scenariusz-niewykonalny`/)
})

test('plik roli: skill weryfikacji projektu i mapa funkcji jako zrodlo drogi do funkcji', () => {
  assert.match(tester, /\.claude\/skills\/weryfikacja\/SKILL\.md/)
  assert.match(tester, /mapa-funkcji\.md/)
  assert.match(tester, /Drive/)
  assert.match(tester, /Evidence/)
})

test('plik roli: tester nie odznacza pliku zadan; wynik tylko w przebiegach i findingach', () => {
  assert.match(tester, /Plik zadań i kod zostają bez zmian/)
  assert.match(tester, /`\{findings, przebiegi\}`/)
  assert.doesNotMatch(tester, /<examples>/, 'przyklad wywolania z sesji to nie warstwa stala roli wolanej przez workflow')
})
