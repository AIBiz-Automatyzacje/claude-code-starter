// Asercje stacku web dla plików ról, które nakładka stacku podmienia w całości: buildery i tester E2E (plan szablonu
// mobile z rdzenia, IU-1.6, D22). Kontrakt wspólny dla każdego stacku sprawdzają testy rdzenia
// `.claude/workflows/__tests__/szkielet-buildera.test.mjs` i `tester-e2e.test.mjs` — przechodzą też na wariancie Expo.
// Tu zostaje to, co należy do stacku web: runner testów w samosprawdzeniu buildera, skille web bez krzyku wersalikami
// oraz procedura narzędzia jazdy agent-browser w pliku testera (preflight, zrzuty z limitem, ścieżka `$Z`, czekanie
// na tekst). Asercje przeniesione z testów rdzenia bez zmian. Wariant Expo dostaje własny test w `stacks/expo/__tests__/`.
//
// Uruchomienie: node --test stacks/web/__tests__/role.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { AGENCI, blokPolecen, wersaliki } from '../../../.claude/workflows/__tests__/agenci-pipeline.mjs'
import { PRZYCZYNY_SKIP } from '../../../.claude/scripts/e2e/ksiegowanie.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const BUILDERY = ['feature-builder-data', 'feature-builder-ui', 'feature-builder-fullstack', 'feature-builder-ui-figma',
  'feature-builder-fullstack-figma']
// Skille web przepisane wg PA-17 (jedna zasada = jedno zdanie z powodem); wspólne sprawdza szkielet-buildera.
const SKILLE_WEB_BEZ_WERSALIKOW = ['tailwind-react-guidelines', 'ux-ui-guidelines']
const tester = readFileSync(join(REPO, AGENCI, 'feature-tester-e2e.md'), 'utf8')

for (const builder of BUILDERY) {
  test(`samosprawdzenie buildera testami powiązanymi Vitest: ${builder}.md`, () => {
    assert.ok(blokPolecen(readFileSync(join(REPO, AGENCI, `${builder}.md`), 'utf8')).includes('vitest related --run'))
  })
}

for (const skill of SKILLE_WEB_BEZ_WERSALIKOW) {
  test(`skill bez krzyku wersalikami: ${skill}`, () => {
    assert.deepEqual(wersaliki(readFileSync(join(REPO, '.claude/skills', skill, 'SKILL.md'), 'utf8')), [])
  })
}

test('plik roli: preflight narzędzia jazdy i sprawdzenie HTTP serwera aplikacji', () => {
  assert.match(tester, /curl -sS/)
  assert.match(tester, /agent-browser doctor --offline --quick/)
})

test('plik roli: doctor agent-browser tylko w trybie przegladarka (bez przegladarki zostaja sprawdzenia HTTP)', () => {
  assert.match(tester, /W trybie `interaktywny` zacznij od preflightu: `agent-browser doctor --offline --quick`/)
  assert.match(tester, /W trybie `bez-interakcji`[^\n]*`curl -sS`/)
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
  assert.match(ponowienie, /Przerwany: każdy ekran idzie do człowieka jak w trybie `bez-interakcji`/)
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

// P27 (4b)+(4c) (vibersi etap 5): tester czytal toast po ~5 s (zniknal) i sprawdzal licznik po odswiezeniu przed koncem zapisu
// — dwa falszywe FAIL i stracone tury fixa. Czekanie na tekst od razu po akcji, FAIL dopiero po czekaniu.
test('plik roli: komunikat znikajacy = wait --text od razu po akcji; liczba/stan po zapisie = wait --text albo networkidle; FAIL po czekaniu', () => {
  const linia = tester.split('\n').find((l) => l.includes('Oczekiwany stan sprawdź')) ?? ''
  assert.match(linia, /[Kk]omunikat znikający \(toast, alert\) czytasz `agent-browser wait --text "<tekst>"` od razu po akcji/)
  assert.match(linia, /[Ll]iczbę albo stan po zapisie \(licznik, lista po odświeżeniu\) — `agent-browser wait --text "<wartość>"` albo `agent-browser wait --load networkidle`/)
  assert.match(linia, /FAIL dopiero po czekaniu/)
})
