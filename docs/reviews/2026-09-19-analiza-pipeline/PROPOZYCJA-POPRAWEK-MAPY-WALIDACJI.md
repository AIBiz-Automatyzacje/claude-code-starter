# Propozycja poprawek mapy walidacji — do akceptacji operatora

**Data:** 2026-09-22. **Status:** PROPOZYCJA. Mapa walidacji (`dane/d5b-mapa-walidacji.txt` i `MAPA-WALIDACJI-DLA-OPERATORA.md`) NIE jest jeszcze zmieniona.
Poprawki wejdą do obu wersji mapy i do rekordu telemetrii dopiero po Twojej akceptacji.
**Nowe liczby w tym dokumencie** policzył skrypt `skrypty/d5b_baseline_jakosci.py` (wynik: `dane/d5b-baseline-jakosci.txt`) z klasyfikacji 574 uwag
bota z etapu 1b, z rozmiarów 19 PR-ów pobranych z GitHuba (tylko odczyt) i z commitów fixów w repo oferty-online. Zero agentów.

---

## Skąd ta propozycja

Poprzednia kontrola mapy sprawdzała, czy każdy wpis ma komplet (metryka, pole, punkt odniesienia, horyzont). Nie sprawdzała, czy te liczby pozwolą
cokolwiek rozstrzygnąć. Druga kontrola pokazała, że część o kosztach i ustawieniach się trzyma, a część o jakości ma błędy. Dotyczy to jedenastu
z 21 wpisów, czyli wszystkich, które opierają się na uwagach bota. Poniżej każda poprawka osobno: co mapa mówi teraz, co proponuję i dlaczego.

Poprawek jest dziewięć. Pierwsze pięć zmienia wnioski, cztery ostatnie są porządkowe.

---

## Poprawka 1. Jakość liczona na sto plików, a nie na PR

**Obecnie w mapie.** Punkt odniesienia dla poleceń-list i dla całej jakości to „10,5 uwagi B na PR" (200 uwag na 19 PR-ów). Porównanie po wdrożeniu:
uwagi B na PR po zmianie wobec 10,5.

**Proponuję.** Liczyć uwagi bota z koszyka B o wadze P1 lub P2 na sto plików zmienionych w PR. Tylko takie uwagi, bo to realne defekty, które przeszły
przez nasze review. P3 i koszyk A (szum konfiguracji) do tej miary nie wchodzą. Do tego rozbicie na typ kodu po ścieżce pliku: warstwa danych i serwer,
logika dashboardu, UI, testy.

**Dlaczego.** PR-y mają od 12 do 160 plików. Większy PR ma więcej uwag, bo ma więcej kodu, a nie dlatego, że review był gorszy. Liczone „na PR"
wyniki mieszają rozmiar zadania z jakością. Typ kodu też robi dużą różnicę: warstwa danych i serwer zbiera 17 poważnych uwag na sto plików, UI 8,6,
testy 4,8. Zadanie z dużą migracją wypadnie gorzej niż zadanie z ekranem, choć pipeline był ten sam. To jest ograniczenie L16 z etapu 3, które
poprzednia wersja mapy pominęła.

---

## Poprawka 2. Punkt odniesienia z ostatnich PR-ów, nie średnia z całości

**Obecnie w mapie.** Średnia z wszystkich 19 PR-ów.

**Proponuję.** Punkt odniesienia to ostatnie PR-y robione przez pipeline: 13, 14, 15, 16, 17 i 19, czyli wrzesień. PR 12 i 18 wyłączam, bo powstały
ręcznie, poza autopilotem.

**Dlaczego.** Jakość wyraźnie się poprawiała w czasie, bez żadnej zmiany, którą chcemy mierzyć:

- PR 1–7 (sierpień): 9,3 poważnej uwagi na sto plików.
- PR 8–11: 7,5.
- PR 13–19 (wrzesień): 3,5.

Średnia z całości wynosi 6,7. Porównanie z nią pokazałoby „poprawę", nawet gdyby nowe zmiany nic nie dały, bo pipeline z września jest już lepszy
od sierpniowego. Właściwy punkt wyjścia to 3,5, a w rozbiciu na typ kodu we wrześniu: dane i serwer 4,3, logika dashboardu 7,5, UI 4,7, testy 3,0.

---

## Poprawka 3. Nowy punkt odniesienia po zmianie konfiguracji bota

**Obecnie w mapie.** Porównujemy uwagi bota po zmianie pipeline'u ze starymi 574 uwagami.

**Proponuję.** Dodać krok do planu wdrożenia: po wprowadzeniu ośmiu zmian konfiguracji CodeRabbita, a przed pierwszą zmianą pipeline'u, zebrać
nowy punkt odniesienia z dwóch–trzech zadań. Dopiero z nim porównujemy zmiany pipeline'u.

**Dlaczego.** Zgodnie z Twoją decyzją osiem zmian konfiguracji bota wchodzi przed pomiarem. Po nich bot komentuje inaczej: mniej szumu, ale też
inne ścieżki i inne instrukcje, na przykład nowa granica zaufania dla seedów. Stare 574 uwagi mierzyły inny przyrząd. Bez tego kroku nie da się
powiedzieć, czy spadek uwag to zasługa naszego pipeline'u, czy nowej konfiguracji bota. Stare liczby zostają jako tło i do sprawdzenia, czy nowy
przyrząd nie zgubił czegoś ważnego.

---

## Poprawka 4. Warunki odwrotu w PR-ach i z progiem odpornym na przypadek

**Obecnie w mapie.** Przykład z założenia o poleceniach-listach: „więcej niż jedno P1 lub P2 klasy X od bota na pięć faz, co odpowiada mniej więcej
pięciu PR-om, przywraca regułę". Tak samo przy wydajności, security i testach.

**Proponuję.** Dwie zmiany:

- **Okno w PR-ach, nie w fazach.** Pięć faz to nie pięć PR-ów, bo zadanie ma od trzech do sześciu faz i jeden PR. Pięć faz to jeden, najwyżej dwa
  PR-y. Warunki odwrotu liczymy w oknie pięciu PR-ów.
- **Próg na poziomie osi, nie pojedynczej klasy, i odporny na przypadek.** Zmianę cofamy, gdy liczba poważnych uwag osi w oknie pięciu PR-ów
  jest co najmniej dwa razy większa od oczekiwanej z punktu odniesienia i wynosi co najmniej trzy. Klasa pojedynczego defektu służy do diagnozy
  (co wróciło), a nie do automatycznego cofania.

**Dlaczego.** We wrześniu na sześć PR-ów przypadło 8 poważnych uwag correctness, 7 test-coverage, 6 security i jedna wydajnościowa. To bardzo małe
liczby. Dla wydajności w oknie pięciu PR-ów oczekujemy mniej niż jednej uwagi. Obecny próg „więcej niż jedna" zadziałałby czysto przypadkiem mniej
więcej raz na pięć okien, czyli przywrócilibyśmy oś, której zastąpienie niczego nie zepsuło. Przy progu „co najmniej trzy" przypadkowy alarm spada
do około jednego na dwadzieścia okien. Próg per klasa jest jeszcze gorszy: klas jest ponad trzydzieści, więc w każdym oknie któraś przekroczyłaby
„więcej niż jedną" samym przypadkiem.

---

## Poprawka 5. Właściwe liczby dla osi

**Obecnie w mapie.** Dla security dwie sprzeczne liczby: cztery uwagi z klasyfikacji i „7 plus 6" z etapu 1. Dla wydajności trzy uwagi.

**Proponuję.** Przypisanie uwagi do osi brać z kolumny, w której etap 1b zapisał, która oś review powinna była daną uwagę złapać. Nowe liczby
(poważne uwagi B, 17 PR-ów pipeline'u, w nawiasie wrzesień):

- correctness: 56 (8),
- security: 33 (6),
- test-coverage: 26 (7),
- spec-compliance: 7 (2),
- wydajność: 5 (1),
- e2e: 1,
- code-quality: 0.

**Dlaczego.** Cztery i trzy wyszły z mojego filtra po słowach w nazwie klasy. Filtr pominął na przykład klasy „walidacja granicy API" i „dane osobowe
w komunikacie", które są klasycznym security. „7 plus 6" pochodzi z innego zbioru, z ucieczek policzonych w etapie 1, więc nie da się go porównać
z uwagami bota per PR. Kolumna z etapu 1b to ocena, którą już raz zrobiliśmy ręcznie, więc ją trzeba było użyć od początku.

---

## Poprawka 6. Pętla fix porównywana z właściwą liczbą

**Obecnie w mapie.** Miara z Twojej decyzji to poważne uwagi bota w plikach dotkniętych fixem. Jako punkt odniesienia podałem wynik D1: 39 procent
nowych findingów urodziło się w fixie. Ale D1 dotyczy powtórki naszego review, nie bota.

**Proponuję.** Punkt odniesienia to stosunek uwag bota w plikach, których dotknął fix, do uwag w pozostałych plikach PR-a, na sto plików. Cel:
ten stosunek spada.

**Dlaczego.** Tę liczbę da się policzyć i policzyłem ją. W plikach dotkniętych fixem bot zgłasza 14,0 poważnej uwagi na sto plików, w pozostałych
4,7. We wrześniu 7,2 wobec 2,2. Pliki po fixie mają więc trzy razy więcej defektów, które przechodzą do bota. To jest mocny, zmierzony punkt wyjścia
dla decyzji „fix tylko P1 i P2, zakaz zmian poza zgłoszonym miejscem". Jedno zastrzeżenie: w czterech PR-ach (części serwerowe zadań dzielonych
na dwa PR-y) commity fixów leżą w PR-ze siostrzanym, więc tam liczba plików po fixie jest zaniżona. Wynik jest przez to raczej ostrożny niż zawyżony.

---

## Poprawka 7. Klasyfikacja uwag bota: kto ją robi i czego nie robić w runie

**Obecnie w mapie.** Rekord runu dev-pr ma zawierać klasę każdej uwagi, jej oś, koszyk, przyczynę przeoczenia („dlaczego przeszło") i to, czy klasa
ma regułę w indeksie wiedzy. Źródło: „wynik etapu zbierania w dev-pr", tak jakby to już działało.

**Proponuję.** Trzy zmiany:

- **Rozszerzyć schemat istniejącego agenta zbierania** o klasę ze słownika klas, oś i wagę. Ten agent już dziś czyta każdą uwagę i klasyfikuje ją,
  tylko według decyzji (napraw, odrzuć, do operatora), a nie według rodzaju defektu. To ten sam agent i ta sama tura, zero nowych agentów.
- **„Czy klasa ma regułę" liczyć skryptem,** porównując klasę z listą klas w indeksie wiedzy. To czysta mechanika, nie wymaga agenta.
- **„Dlaczego przeszło" usunąć z runu.** Ocenę, czy nasz prompt obejmował daną uwagę, zrobimy raz w miesiącu przy raporcie, na próbce kilkunastu uwag.

Do tego jednorazowa kalibracja: nowy klasyfikator przepuszcza dwa–trzy stare PR-y i porównujemy jego klasy z klasyfikacją z etapu 1b. Jeśli
się rozjeżdżają, poprawiamy słownik, zanim zaczniemy porównywać.

**Dlaczego.** Dziś etap zbierania nie zwraca ani klasy defektu, ani osi. W etapie 1b tę klasyfikację robiło sześciu agentów Opus. Pole „dlaczego
przeszło" wymaga zestawienia każdej uwagi z promptami reviewerów, czyli osądu, a nie mechaniki. W runie złamałoby to Twój wymóg, że zbieranie
telemetrii nie może zwiększać kosztu. Kalibracja jest potrzebna, bo inny klasyfikator to kolejna zmiana przyrządu, jak w poprawce 3.

---

## Poprawka 8. Kolejność odczytów, żeby zmiany się nie mieszały

**Obecnie w mapie.** Każda iteracja wdrożenia ma swój wpis i swój moment odczytu. Nic nie mówi, co się dzieje, gdy iteracje nachodzą na siebie.

**Proponuję.** Nową sekcję z trzema regułami:

- **Ustawienia i koszt mogą biec równolegle.** Kontekst startowy, bramki, budżet instrukcji i tury czytają różne pola, więc dwie zmiany w tym
  obszarze nie zakłócają się nawzajem.
- **Zmiany jakościowe dotyczące rozłącznych osi też mogą biec równolegle.** Na przykład zmiana w security i zmiana w teście, bo każdą czytamy tylko
  po uwagach jej osi.
- **Zmiany przekrojowe mają okno pięciu PR-ów dla siebie.** Budżet instrukcji, wycinek wiedzy, pliki agentów i kontekst dotykają wszystkich osi naraz.
  Druga zmiana jakościowa w tym samym oknie sprawi, że nie da się powiedzieć, która zadziałała.

**Dlaczego.** Wszystkie odczyty jakości czytają ten sam strumień uwag bota, a każdy potrzebuje pięciu PR-ów, czyli mniej więcej pięciu zadań.
Przy kilkunastu iteracjach, jeśli każda czekałaby pięć PR-ów, wdrożenie trwałoby miesiącami. Jeśli żadna by nie czekała, nie wiedzielibyśmy nic.
Te trzy reguły pozwalają iść równolegle tam, gdzie to bezpieczne, i czekać tylko tam, gdzie trzeba. To bezpośrednio wpływa na plan etapu 5.

---

## Poprawka 9. Porządkowe

- **Kto produkuje nowe pola.** Część pól dopisanych do rekordu wymaga zmiany w workflowach, zanim skrypt cokolwiek odczyta: werdykty sceptyka
  w trzech etykietach, liczba P1 naprawionych z testem, trafienia bramek z listą reguł, pozycje smoke przeniesione z manual. Mapa podaje dla nich
  źródło, ale nie mówi, że to jest praca do zrobienia. Proponuję przy każdym takim polu dopisek „wymaga zmiany w" z nazwą miejsca, żeby plan
  etapu 5 to uwzględnił.
- **Hook obsługi błędów.** Punkt odniesienia liczył 15 uwag z trzech klas z górnej listy. Pełne dopasowanie po wszystkich klasach tego rodzaju
  (ścieżka błędu, pusty catch, console, dane do Sentry, połknięty błąd) daje 21 uwag, w tym 12 poważnych. Poprawiam na tę liczbę.
- **Cele kontekstu startowego.** Sprawdziłem je z przeliczeniem z etapu 3: mechaniczne 4,5 tysiąca, reviewer 15–16, builder 22–28. Mapa ma
  „około 25" dla buildera, czyli zgodnie. Bez zmian.
- **Rzeczy, które się trzymają.** Wpisy o kontekście, turach, bramkach, budżecie instrukcji, telemetrii i scaleniu skilli nie wymagają zmian.
  Ich metryki są mechaniczne, a punkty odniesienia zgadzają się ze źródłami.

---

## Co się zmieni po akceptacji

Obie wersje mapy dostaną poprawki 1–9. Rekord telemetrii dostanie dwie zmiany: pole „dlaczego przeszło" wypada z runu, a „czy klasa ma regułę"
jest liczone skryptem. Plan etapu 5 dostanie dwa nowe kroki: punkt odniesienia po zmianie konfiguracji bota i kalibrację klasyfikatora uwag.
Skrypt, który policzył nowe liczby, zostaje w katalogu i można go odpalić ponownie.
