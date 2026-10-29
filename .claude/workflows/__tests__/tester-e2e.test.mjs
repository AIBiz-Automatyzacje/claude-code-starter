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

test('plik roli: makiety — visual-diff z findingiem OPERATOR; w trybie bez przegladarki kazdy ekran nadal idzie do czlowieka', () => {
  const sekcja = tester.slice(tester.indexOf('### Makiety'))
  assert.ok(tester.includes('### Makiety'))
  assert.match(sekcja, /figma_screens/)
  assert.match(sekcja, /visual-diff\/<ekran>-actual\.png/)
  assert.match(sekcja, /Operator: \[Manual\] <ekran>: visual review — Operator action:/)
  assert.match(sekcja, /W trybie `bez-przegladarki` zrzutu nie robisz, a każdy ekran z `figma_screens`[^\n]*finding OPERATOR P3/)
  assert.match(tester, /Przy zerze scenariuszy i bez makiet `figma_screens`/)
})

test('plik roli: doctor agent-browser tylko w trybie przegladarka (bez przegladarki zostaja sprawdzenia HTTP)', () => {
  assert.match(tester, /W trybie `przegladarka` zacznij od preflightu: `agent-browser doctor --offline --quick`/)
  assert.match(tester, /W trybie `bez-przegladarki`[^\n]*`curl -sS`/)
})

test('plik roli: finding seeda kontra migracja ma linie checkbox: scenariusza, ktory uzywa seeda (fix odznacza po PASS)', () => {
  const seedy = wytnij(tester, '### Seedy', '\n### ')
  assert.match(seedy.split('\n').find((l) => l.includes('DEFAULT')) ?? '', /`checkbox: <treść linii scenariusza, który używa seeda>`/)
})

// P19 (vibersi etap 2, faza 6): zrzut wisial, tester obszedl go Playwrightem (971 s, 0,64 M). Regula: limit 30 s, bez obchodzenia.
// P20 A1 (vibersi etap 3, faza 4): jedno zawieszone `screenshot` dawalo SKIP harness calej fazie (6/6 [Manual]), a powtorka
// w sesji przeszla 14/14 — zawieszenie przejsciowe. Teraz: close + probny zrzut about:blank; wynik z asercji, nie ze zrzutu;
// jedno ponowienie scenariusza; drugie zawieszenie = SKIP tylko tego scenariusza; SKIP reszty fazy tylko przy padzie probnego.
test('tester: zrzut z limitem 30 s; przerwany = close + probny zrzut about:blank, jedno ponowienie, SKIP tylko scenariusza', () => {
  const regula = tester.slice(tester.indexOf('- Każdy zrzut robisz z limitem 30 s'), tester.indexOf('- Scenariusz, który milczy'))
  assert.match(regula, /Każdy zrzut robisz z limitem 30 s: `perl -e 'alarm 30; exec @ARGV' agent-browser screenshot <plik>`/)
  assert.match(regula, /PASS i FAIL dowodzą asercje ze snapshotu, `get text` i skryptów/)
  assert.match(regula, /`agent-browser close`[^\n]*próbny zrzut[^\n]*`agent-browser open about:blank`/)
  assert.match(regula, /Próbny zrzut przerwany: do końca scenariuszy fazy nie robisz zrzutów, a ten i kolejne scenariusze odgrywasz dalej na snapshotach i `get text`/)
  assert.match(regula, /SKIP z przyczyną `harness` i tym dowodem dostaje tylko scenariusz, którego asercji nie da się rozstrzygnąć/)
  assert.doesNotMatch(regula, /ten scenariusz i pozostałe scenariusze fazy dostają wpis SKIP/, 'pad probnego zrzutu nie konczy E2E fazy')
  assert.match(regula, /z ponownym seedem, gdy scenariusz go ma/)
  assert.match(regula, /Błąd limitu wysyłki maili albo SMS przy ponowieniu daje wpis SKIP z przyczyną `limit-zewnetrzny`/)
  assert.match(regula, /asercje scenariusza rozstrzygnięte przed zawieszeniem: wpis PASS albo FAIL z tych asercji/)
  assert.match(regula, /odegraj ten scenariusz jeszcze raz od początku w nowej sesji, jeden raz/)
  assert.match(regula, /„zrzut agent-browser > 30 s \(2×\)” tylko dla tego scenariusza; potem zamknij sesję \(`agent-browser close`\) i kolejne scenariusze fazy odgrywaj normalnie/)
  assert.match(regula, /Porównanie z makietą bez zrzutu ekranu idzie do człowieka/)
  assert.doesNotMatch(regula, /pozostałe scenariusze fazy dostają ten sam wpis bez kolejnych prób/, 'pierwsze zawieszenie nie moze konczyc E2E calej fazy')
  assert.match(regula, /Zrzutu nie obchodzisz innym narzędziem \(Playwright, własny skrypt\)/)
  assert.match(tester, /wpis PASS z przyczyną `nie-dotyczy` i dowodem \(asercja, ścieżka zrzutu albo „zrzut niedostępny”\)/)
  assert.match(tester, /`harness` \([^)]*zawieszony zrzut bez rozstrzygniętych asercji\)/)
  assert.equal(PRZYCZYNY_SKIP.harness, 'manual')
})

// HANDOFF 6a pkt 108: faza 3 — probny zrzut padl o 21:02 i 9 porownan z makieta poszlo do smoke'u, a w fazie 6 zrzuty
// dzialaly. Przed porownaniem z makieta tester ponawia probny zrzut raz; zapisany = zrzuty makiet normalnie.
test('tester: przed porownaniem z makieta po padzie probnego zrzutu — jedno ponowienie probnego; zapisany = zrzuty makiet', () => {
  const makiety = tester.slice(tester.indexOf('### Makiety'))
  const ponowienie = makiety.split('\n').find((l) => l.includes('ponów próbny zrzut')) ?? ''
  assert.match(ponowienie, /próbny zrzut przerwany wcześniej w tej fazie/)
  assert.match(ponowienie, /`agent-browser close`[^\n]*`agent-browser open about:blank`[^\n]*`perl -e 'alarm 30; exec @ARGV' agent-browser screenshot "\$Z\/visual-diff\/probny\.png"`/)
  assert.match(ponowienie, /jeden raz/)
  assert.match(ponowienie, /Zapisany: zrzuty ekranów makiet robisz według punktów niżej/)
  assert.match(ponowienie, /Przerwany: każdy ekran idzie do człowieka jak w trybie `bez-przegladarki`/)
  assert.ok(makiety.indexOf('ponów próbny zrzut') < makiety.indexOf('zapisz zrzut jako'), 'ponowienie przed zrzutem makiety')
})

// P22 A3: `cd <zadanie> && agent-browser screenshot x.png` zapisal x.png w korzeniu repo — demon agent-browser liczy sciezke
// wzgledna od swojego katalogu. Plik roli kaze zapisywac zrzut pod sciezka bezwzgledna w katalogu zadania.
test('plik roli: zrzut pod sciezka bezwzgledna w katalogu zadania ($Z od git rev-parse --show-toplevel), z powodem; dowod wzgledny', () => {
  assert.match(tester, /^- Zrzut zapisujesz w katalogu zadania pod ścieżką bezwzględną `\$Z` = `"\$\(git rev-parse --show-toplevel\)\/<folder>"`: scenariusz — `"\$Z\/<flow>\.png"`/m)
  assert.match(tester, /Demon agent-browser rozwiązuje ścieżkę względną od swojego katalogu startowego/)
  assert.match(tester, /W `dowod` wpisujesz ścieżkę względną od korzenia repo/)
  // Kazdy przyklad zrzutu w pliku roli idzie przez $Z — model kopiuje dosłowny przyklad.
  assert.doesNotMatch(tester, /screenshot <folder>\//)
  assert.doesNotMatch(tester, /zrzut jako `<folder>\//)
  assert.match(tester, /screenshot "\$Z\/visual-diff\/probny\.png"/)
  assert.match(tester, /zapisz zrzut jako `"\$Z\/visual-diff\/<ekran>-actual\.png"` \(`mkdir -p "\$Z\/visual-diff"`\)/)
})

// P22 D2: finding P2 E2E o rozjezdzie z makieta niesie nazwe ekranu — fix szuka po niej opisu ekranu w planie zamiast PNG.
test('plik roli: finding P2 E2E rozjazdu z makieta ma nazwe ekranu w pierwszym zdaniu („z makiety <ekran>”)', () => {
  assert.match(tester, /finding P2 typ E2E z nazwą ekranu w pierwszym zdaniu opisu \(„z makiety <ekran>”\), bo fix szuka po niej opisu ekranu w planie/)
})

// P27 (4b)+(4c) (vibersi etap 5): tester czytal toast po ~5 s (zniknal) i sprawdzal licznik po odswiezeniu przed koncem zapisu
// — dwa falszywe FAIL i stracone tury fixa. Czekanie na tekst od razu po akcji, FAIL dopiero po czekaniu.
test('plik roli: komunikat znikajacy = wait --text od razu po akcji; liczba/stan po zapisie = wait --text albo networkidle; FAIL po czekaniu', () => {
  const linia = tester.split('\n').find((l) => l.includes('Oczekiwany stan sprawdź')) ?? ''
  assert.match(linia, /[Kk]omunikat znikający \(toast, alert\) czytasz `agent-browser wait --text "<tekst>"` od razu po akcji/)
  assert.match(linia, /[Ll]iczbę albo stan po zapisie \(licznik, lista po odświeżeniu\) — `agent-browser wait --text "<wartość>"` albo `agent-browser wait --load networkidle`/)
  assert.match(linia, /FAIL dopiero po czekaniu/)
})
