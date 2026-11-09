// Tester E2E (PLAN-POPRAWY P14 sesja 2): jedno zrodlo procedury. Plik roli `feature-tester-e2e.md` niesie cala procedure
// (scenariusze, seedy vs kontrakt migracji, srodowisko, klasyfikacja przyczyn SKIP, makiety), a `e2ePrompt` w review-wf podaje
// tylko parametry wywolania i tryb oraz wspolne bloki workflowu. Wczesniej ta sama procedura siedziala w obu miejscach
// i rozjezdzala sie (plik roli: „zero auto pass/fail” makiet, prompt: „rozbieznosci = P2”).
// Tu sa asercje rdzenia — kontrakt testera kazdego stacku (D22). Asercje narzedzia jazdy web (preflight, zrzuty
// agent-browser, sciezka $Z, czekanie na tekst) sa w stacks/web/__tests__/role.test.mjs.
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
  const p = e2ePrompt(ZADANIE, 2, [], 'bez-interakcji', {})
  assert.match(p, /fazy 2/)
  assert.match(p, /docs\/active\/zadanie-x/)
  assert.match(p, /Tryb: bez-interakcji/)
  assert.match(p, /\.claude\/skills\/weryfikacja\/SKILL\.md/)
  for (const blok of ['<DLUGIE>', '<P3>', '<MAPA>', '<REREVIEW>']) assert.ok(p.includes(blok), `brak bloku wspolnego ${blok}`)
  const wlasna = p.replace(/<DLUGIE>|<P3>|<MAPA>|<REREVIEW>/g, '')
  assert.ok(wlasna.length <= MAKS_WLASNEJ_TRESCI, `wlasna tresc promptu: ${wlasna.length} zn. (limit ${MAKS_WLASNEJ_TRESCI}) — procedura nalezy do pliku roli`)
  for (const procedura of [/curl/, /e2e\.mjs stan/, /agent-browser doctor/, /psql/, /run-all\.sh/, /figma_screens/, /limit-zewnetrzny/]) {
    assert.doesNotMatch(wlasna, procedura, `procedura w prompcie: ${procedura}`)
  }
  assert.match(e2ePrompt(ZADANIE, 1, [], 'interaktywny', {}), /Tryb: interaktywny/)
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
  assert.match(tester, /node \.claude\/scripts\/e2e\/e2e\.mjs stan/)
  assert.match(tester, /`"nasz": true`/)
  assert.match(tester, /`"zyje": true`[^.]*watcher/)
  assert.match(tester, /serwer aplikacji padł/)
  assert.match(tester, /`srodowisko`[^.]*bez findingu/)
  assert.match(tester, /W trybie `bez-interakcji`/)
  assert.match(tester, /E2E_TEST_EMAIL/)
})

// A0.7 §6 p.3: opis pola flow mowil, jak flow wyglada w webie („agent-browser gra scenariusz z opisu linii”); wariant
// Expo ma plik flow Maestro. Postac linii scenariusza w stacku opisuje slot planowania E2E.
test('schemat wyniku: pole flow odsyla do slotu po postac linii scenariusza, bez narzedzia jazdy', () => {
  const flow = wytnij(review, 'flow: { type:', '},')
  assert.match(flow, /\.claude\/stack\/plan-e2e\.md, sekcja „Linia scenariusza”/)
  assert.doesNotMatch(flow, /agent-browser|W webie/)
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

test('plik roli: makiety — visual-diff z findingiem OPERATOR; w trybie bez przegladarki kazdy ekran nadal idzie do czlowieka', () => {
  const sekcja = tester.slice(tester.indexOf('### Makiety'))
  assert.ok(tester.includes('### Makiety'))
  assert.match(sekcja, /figma_screens/)
  assert.match(sekcja, /visual-diff\/<ekran>-actual\.png/)
  assert.match(sekcja, /Operator: \[Manual\] <ekran>: visual review — Operator action:/)
  assert.match(sekcja, /W trybie `bez-interakcji` zrzutu nie robisz, a każdy ekran fazy nadal idzie do człowieka[^\n]*finding OPERATOR P3/)
  assert.match(tester, /Przy zerze scenariuszy i zerze ekranów fazy \(sekcja o makietach\) zwróć od razu `\{findings: \[\], przebiegi: \[\]\}`/)
})

// Punkt 30 (dashboard E2, plan z 45 ekranami i okolo 10 fazami UI): tester bral cale `figma_screens` zadania w kazdej fazie,
// wiec porownywal ekrany, ktorych kod powstaje dopiero w pozniejszych fazach. Zmiana kontraktu: ekrany z pol Makiety
// jednostek biezacej fazy; plan sprzed pola idzie regula zapasowa z jednym zdaniem w wyniku.
test('plik roli: makiety — tylko ekrany z pol Makiety jednostek fazy; regula zapasowa dla planu sprzed pola ze zdaniem w wyniku', () => {
  const regula = tester.split('\n').find((l) => l.startsWith('- (niepuste pole `figma_screens`')) ?? ''
  assert.match(regula, /Porównujesz tylko ekrany fazy: nazwy z pól `\*\*Makiety:\*\*` jednostek tej fazy w planie technicznym \(dossier, sekcja „Plan techniczny — sekcja fazy”\)/)
  assert.match(regula, /Pole `—` i jednostka `feature-builder-data` bez pola to zero ekranów\./)
  assert.match(regula, /Gdy żadna jednostka fazy nie ma pola, a faza ma jednostkę inną niż `feature-builder-data` \(plan sprzed pola `Makiety`\), bierzesz wszystkie ekrany z `figma_screens`/)
  assert.match(regula, /na końcu opisu findingu OPERATOR pierwszego ekranu dopisujesz zdanie „Jednostki fazy nie mają pola Makiety: porównano wszystkie ekrany zadania\.”/)
  assert.match(regula, /Faza z zerem ekranów nie dostaje zrzutów ani findingów o makietach\./)
  const sekcja = tester.slice(tester.indexOf('### Makiety'))
  assert.doesNotMatch(sekcja, /Dla każdego ekranu odczytaj|każdy ekran z `figma_screens`/, 'zadna linia sekcji nie bierze juz wszystkich ekranow zadania')
  assert.match(sekcja, /^- Dla każdego ekranu fazy odczytaj wymiary PNG/m)
  assert.ok(sekcja.indexOf('Porównujesz tylko ekrany fazy') < sekcja.indexOf('Dla każdego ekranu fazy'), 'wybor ekranow przed pierwszym zrzutem')
})

test('plik roli: finding seeda kontra migracja ma linie checkbox: scenariusza, ktory uzywa seeda (fix odznacza po PASS)', () => {
  const seedy = wytnij(tester, '### Seedy', '\n### ')
  assert.match(seedy.split('\n').find((l) => l.includes('DEFAULT')) ?? '', /`checkbox: <treść linii scenariusza, który używa seeda>`/)
})

// P22 D2: finding P2 E2E o rozjezdzie z makieta niesie nazwe ekranu — fix szuka po niej opisu ekranu w planie zamiast PNG.
test('plik roli: finding P2 E2E rozjazdu z makieta ma nazwe ekranu w pierwszym zdaniu („z makiety <ekran>”)', () => {
  assert.match(tester, /finding P2 typ E2E z nazwą ekranu w pierwszym zdaniu opisu \(„z makiety <ekran>”\), bo fix szuka po niej opisu ekranu w planie/)
})
