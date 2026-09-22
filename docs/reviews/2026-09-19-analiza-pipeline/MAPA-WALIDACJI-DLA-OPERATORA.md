# Mapa walidacji zmian — wersja dla operatora

**Data:** 2026-09-22 (domknięcie D5b). **Wersja techniczna:** `dane/d5b-mapa-walidacji.txt` (dla Claude'a i dla skryptu raportu). **Rekord telemetrii, do którego mapa się odwołuje:** `dane/d5-telemetria-rekord.txt`.

---

## O co chodzi

Wymóg numer 13 z pakietu wejściowego mówi: każda zmiana w pipelinie ma wskazaną metrykę. Do dziś to było zdanie. Ta mapa zamienia je w listę: dla każdego z 13 twardych wymogów i 8 założeń z warunkiem odwrotu jest zapisane, co liczymy, skąd bierzemy liczbę, ile wynosi dziś i kiedy patrzymy. Założenia mają jeszcze warunek, przy którym zmianę cofamy.

## Jakie kryteria dobrałem

**Metryka musi wychodzić z rekordu telemetrii, nie z osobnego pomiaru.** Jeśli czegoś nie da się policzyć skryptem z pliku, który i tak powstaje po runie, to nie jest metryka, tylko życzenie. Dlatego przy każdym wpisie stoi nazwa pola, a jeśli pola nie było, dopisałem je do rekordu od razu. Trzy rzeczy świadomie zostawiłem poza telemetrią, bo mierzy się je przed wdrożeniem, jednorazowo: skuteczność sceptyka na starych findingach, warstwy mechaniczne testów na 31 starych uwagach bota i to, czy treść skilli builderów jest w ogóle stosowana (mini-run).

**Punkt odniesienia zawsze z etapu zerowego.** Pięć projektów, 2 941 agentów, 1 179 milionów jednostek kosztu, a dla oferty-online po 6 września: 35,5 agenta i 740 tur na fazę. Tam, gdzie etap zerowy nie mierzył (bramka advisors, hook obsługi błędów), napisałem wprost „brak" zamiast zgadywać.

**Trzy horyzonty, dobrane do tego, jak szybko liczba się ustala.**
- Po jednej fazie widać ustawienia: kontekst startowy agenta, czas bramek, budżet instrukcji, czy telemetria zapisała rekord. To cechy konfiguracji, nie statystyka.
- Po pięciu fazach widać koszt i tury, bo rozrzut jest duży: builder ma zwykle 39 tur, ale co dziesiąty ma ponad 83.
- Po pięciu PR-ach widać jakość, bo CodeRabbit recenzuje PR, nie fazę, a jedno zadanie to zwykle jeden PR.

**Miara jakości to uwagi bota po naszym review**, zgodnie z Twoją decyzją z początku analizy. Stąd najważniejsze dopisane pole: rekord runu dev-pr z klasyfikacją uwag bota w tym samym formacie, w którym w etapie 1b sklasyfikowaliśmy 574 uwagi z 19 PR-ów. Bez tego pola jedenaście z 21 wpisów nie miałoby źródła.

---

## Część 1. Trzynaście twardych wymogów

### 1. Allowlista narzędzi i pliki agentów per klasa roli

**Co liczymy.** Kontekst pierwszej tury agenta, osobno dla każdej klasy roli. Do tego: czy agent w ogóle ma plik z ustawieniami, czy nie woła MCP, gdy nie powinien, i jaki jest udział „opłaty za powołanie" w koszcie fazy.

**Dziś.** Agent mechaniczny startuje z 65–67 tysięcy tokenów, reviewer z 95–97, builder ze 118. Pomiar 1 pokazał, że pusty agent na Twoim koncie startuje z 62,8 tysiąca, a po allowliście z 11,6, a z pominięciem CLAUDE.md z 4,5. Trzy czwarte agentów nie ma żadnego pliku. Opłata za powołanie to 22 procent całego kosztu.

**Kiedy patrzymy.** Po jednej fazie, wstępnie już w mini-runie. Cel: mechaniczne około 4,5 tysiąca, reviewer około 15, builder około 25.

### 2. Kontekst per klasa roli (CLAUDE.md u builderów, bypass zostaje, skille builderów zostają)

**Co liczymy.** Kontekst na turę i liczbę tur per rola, koszt na agenta, oraz jaki udział w koszcie ma „kontekst razy tury". Czy treść skilli jest stosowana, sprawdza mini-run, nie telemetria.

**Dziś.** Na turę: mechaniczne 86–102 tysiące, reviewerzy 193–224, buildery 238. Builder robi 39 tur, fix 37, reviewer 15–30, sceptyk 7. Builder kosztuje 1,2 miliona jednostek, reviewer od 468 do 931 tysięcy. Kontekst razy tury to 40 procent kosztu.

**Kiedy patrzymy.** Po pięciu fazach. Oczekiwana dźwignia całości: 25–35 procent kosztu fazy.

### 3. Budżet instrukcji w trzech warstwach

**Co liczymy.** Warstwa stała: liczba instrukcji na rolę z testu szablonu, cel poniżej 150. Warstwa referencyjna: długość promptu delegacji, żeby doklejanie nie rozdmuchało go ponad dzisiejsze 10 tysięcy znaków plus 1–2 tysiące wycinka. Skutek: udział uwag bota „w zakresie, ale przeoczone" w koszyku B, czyli czy agent przestrzega instrukcji, którą ma.

**Dziś.** Reviewer security ma 365 instrukcji, builder danych 537, po już podjętych decyzjach nadal 310–320 i 520–530. Prompt delegacji: builder 9,7 tysiąca znaków, reviewerzy 8–11 tysięcy, dedup 32 tysiące. W koszyku B bota 164 z 200 uwag to „w zakresie, ale przeoczone".

**Kiedy patrzymy.** Test szablonu pada od razu, prompt po jednej fazie, skutek po pięciu PR-ach.

### 4. Learned-patterns w trzech poziomach z wycinkiem od orkiestratora

**Co liczymy.** Rozmiar tego, co ładuje się zawsze (CLAUDE.md i indeks), rozmiar wycinka doklejanego builderowi i reviewerowi, zniknięcie dubla z dossier, oraz skutek: ile uwag bota dotyczy klas, które mają regułę w indeksie. To samo pole zasila licznik ucieczek per wpis, jedno z ośmiu przyjętych zabezpieczeń.

**Dziś.** Learned-patterns ma 46,9 tysiąca znaków i wchodzi do każdego agenta, a do reviewerów drugi raz przez dossier. CLAUDE.md oferty-online urósł z 3,4 do 89,7 tysiąca znaków w cztery tygodnie, po odchudzeniu 20,6. Dwie trzecie ucieczek miało regułę w kontekście.

**Kiedy patrzymy.** Rozmiary po jednej fazie, skutek po pięciu PR-ach, rozrost po pięciu zadaniach.

### 5. Telemetria mechaniczna, zero agentów

**Co liczymy.** Czy każdy run ma rekord i skąd status (sesja czy skan), czy w runie nie ma agenta telemetrii, czy rekord agenta ma pełny cennik, czy plik tylko rośnie.

**Dziś.** Jeden wpis na run pisany przez agenta haiku, który dwa razy skasował plik. Telemetria widziała tylko tokeny wyjściowe, czyli 2 procent kosztu. Poziom agenta nie istniał.

**Kiedy patrzymy.** Od pierwszego runu. To jest pierwsza iteracja wdrożenia.

### 6. E2E przełącza na manual zamiast zatrzymywać run

**Co liczymy.** Zatrzymania z powodu środowiska E2E (cel zero), liczba runów na zadanie (cel jeden), pozycje manual per powód, czy manual dotarł do smoke operatora, wynik sprawdzenia środowiska przed startem.

**Dziś.** 13 runów na 5 zadań, trzy zadania potrzebowały dwóch lub trzech runów. Zatrzymania: niemierzalna asercja raz, limit mailera stagingu dwa razy, nierozwiązane P1 raz, fałszywy stop po Twojej edycji raz, próg gzip raz. Powtórki review po tych stopach kosztowały około 1,2 miliona tokenów wyjściowych w dwóch zadaniach.

**Kiedy patrzymy.** Po pięciu zadaniach, bo stopy są rzadkie.

### 7. Sceptyk asymetryczny

**Co liczymy.** Kill rate, czyli ile findingów sceptyk obalił z dowodem w kodzie, osobno degradacje wagi, a jako zabezpieczenie: czy bot zgłasza P1 lub P2 w miejscu, które sceptyk obalił. Do tego udział P1 naprawionych z testem padającym przed poprawką i koszt sceptyków w fazie.

**Dziś.** Sceptycy obalają 12 procent (inne liczenia: 19,2 i 10,9), częściej przeklasyfikowują niż obalają. Literatura dla sceptyka asymetrycznego: 63–83 procent. Sceptycy to 6 procent kosztu fazy, 8,8 agenta na fazę.

**Kiedy patrzymy.** Kill rate po pięciu fazach, kasowanie prawdziwych po pięciu PR-ach. Kill rate na starych findingach o znanych werdyktach mierzymy przed wdrożeniem, poza telemetrią.

### 8. Security warunkowe po profilu stacku, advisors na chmurze

**Co liczymy.** Wynik i czas bramki advisors, koszt i tury reviewera security, findingi security per faza, a jako skutek: uwagi bota klas bezpieczeństwa osobno dla projektów z Supabase i bez. Stąd nowe pole: profil stacku w rekordzie runu.

**Dziś.** Reviewer security kosztuje 561 tysięcy na agenta i robi 19 tur, znajduje najwięcej ze wszystkich osi (9 P1, 122 P2). Bot po naszym review: trzy P2 i jedno P3 w klasach bezpieczeństwa na 19 PR-ów. Advisors nie zmierzone, bo Docker był wyłączony.

**Kiedy patrzymy.** Bramka po jednej fazie, koszt po pięciu, skutek po pięciu PR-ach na projekcie z Supabase i pięciu bez.

### 9. Pętla fix bez dodatkowej rundy review, tylko P1 i P2

**Co liczymy.** Miara z Twojej decyzji: P1 i P2 od bota w plikach, których dotknął fix, po pięciu zadaniach. Do tego koszt pętli, liczba pominiętych P3, regresje z kontroli diffu, rozmiar diffu fixa.

**Dziś.** Fix to 17 procent kosztu fazy, 37 tur, 1,2 miliona na agenta. Naprawia 98 procent findingów łącznie z P3. Z 33 findingów po fixie 39 procent urodziło się w fixie (w tym jedyny P1), 42 procent to przeoczenia w plikach, które fix dotknął, 18 procent w kodzie nietkniętym.

**Kiedy patrzymy.** Skutek po pięciu zadaniach, koszt po pięciu fazach.

### 10. Zakaz powtórek sekwencyjnych review

**Co liczymy.** Liczba rund review w fazie (cel jedna), powtórki tej samej fazy między runami, koszt review na fazę.

**Dziś.** Powtórka tej samej fazy dawała 12–18 nowych pozycji, na tym samym kodzie połowa powtarzalności, po fixie prawie zero. Sześciu reviewerów to 25 procent fazy.

**Kiedy patrzymy.** Po pięciu zadaniach.

### 11. Polecenia-listy zamiast długich reguł

Ta sama metryka co założenie 1 poniżej: koszyk B bota per PR, per klasa, per oś, plus budżet instrukcji z wymogu 3.

### 12. Scalenie dev-plan i dev-docs

**Co liczymy.** Koszt epizodu scalonego skilla wobec sumy dwóch dzisiejszych, czas operatora (mediana minut, bo jeden epizod dev-docs trwał 17 godzin z otwartą sesją), rozmiar artefaktów i udział kopii, kontekst sesji głównej. Stąd nowy typ rekordu: epizod skilla w sesji głównej.

**Dziś.** Dev-plan 930 tysięcy na epizod i 47 minut, dev-docs 707 tysięcy i 67 minut, razem 1,64 miliona na zadanie, czyli 2–5 procent kosztu zadania. Plan ma 57–137 kilobajtów, zadania 29–69, z czego 22–46 procent to kopia planu.

**Kiedy patrzymy.** Po pięciu zadaniach, bo epizody mają rozrzut od 0,4 do 2,5 miliona.

### 13. Każda zmiana ma metrykę

To jest ta mapa. Przed nią zero wymogów miało metrykę, po niej 21 z 21. Sędziowie sprawdzają obecność wpisu przy każdej zmianie w projekcie, nie jego wartość.

---

## Część 2. Osiem założeń z warunkiem odwrotu

### Założenie 1. Polecenia-listy domkną 60–70 procent uwag B

**Co liczymy.** Uwagi koszyka B bota per PR, per klasa i per oś, na PR porównywalnym z PR-ami 2, 4 i 9 z etapu 1b.

**Dziś.** 10,5 uwagi B na PR (200 na 19 PR-ów). Najwięcej z correctness (74), test-coverage (44), security (31). Klasa numer jeden: test niefalsyfikowalny, 31 uwag.

**Odwrót.** Więcej niż jedno P1 lub P2 klasy X od bota na pięć faz przywraca regułę lub oś dla tej klasy.

**Kiedy patrzymy.** Po pięciu PR-ach. Przed wdrożeniem nie ma żadnego pomiaru, to oceny agentów z etapu 1b.

### Założenie 2. Performance zastąpić bramkami i checklistą w correctness

**Co liczymy.** Uwagi bota klas wydajnościowych na pięć faz, wynik i czas bramek size-limit i advisors, findingi wydajnościowe zgłoszone przez correctness, oszczędność z braku agenta.

**Dziś.** Oś performance to 3 procent fazy, 15 tur, 468 tysięcy na agenta, 183 findingi. Bot po naszym review: trzy uwagi wydajnościowe, zero P1. Size-limit trwa 0,8 sekundy i nie ma go w szablonie.

**Odwrót.** Więcej niż jedno P1 lub P2 klasy wydajnościowej od bota na pięć faz przywraca oś na tanim tierze.

### Założenie 3. Security odchudzone i warunkowe

Metryka jak w wymogu 8. Dziś od bota: 7 plus 6 P1 i P2 w dwóch klasach ucieczek z etapu 1. Odwrót: jeśli takich uwag jest więcej niż dziś, wracają wycięte polecenia.

### Założenie 4. Packager zastąpiony skryptem

**Co liczymy.** Tury Bash reviewerów z dossier ze skryptu wobec dossier od agenta, zniknięcie kosztu roli packagera, findingi per oś bez spadku, rozmiar dossier.

**Dziś.** Packager to 81 agentów, 230 tysięcy każdy, 1,6 procent. Jedyny pomiar: reviewerzy po dossier czytali dwa razy więcej Bashem (z 10,5 do 23 tur). Bilans z etapu 1 był ujemny.

**Odwrót.** Tury Bash reviewerów rosną ponad 23 albo findingi spadają o ponad 30 procent przy tym samym typie kodu. Kierunek jest tani i odwracalny.

### Założenie 5. Sceptyk asymetryczny cztery razy skuteczniejszy

Metryka jak w wymogu 7. **Odwrót:** kill rate ponad 50 procent i jednocześnie bot zgłasza P1 lub P2 w miejscu obalonego findingu częściej niż raz na pięć PR-ów. Wtedy sceptyk kasuje prawdziwe i dla P1 wraca prompt z uzasadnieniem autora.

### Założenie 6. Test-coverage scalone z correctness (tylko opcja wariantu)

**Co liczymy.** Warstwy mechaniczne: Stryker jako lista mutantów do zabicia (nie score jako cel), testy typów, uwagi bota klasy test niefalsyfikowalny per PR, findingi i koszt osi test.

**Dziś.** Oś test-coverage to 26 tur, 718 tysięcy na agenta, 202 findingi. Bot: 31 uwag test niefalsyfikowalny. Warstwa pierwsza (ESLint) trafia zero z 31. Stryker: 122 sekundy na trzy pliki, więc 5–15 minut na fazę, nie do każdego domknięcia.

**Odwrót.** Scalenie jest dopuszczalne dopiero, gdy warstwy 2–3 trafią co najmniej 20 z 31 starych uwag. Po scaleniu: więcej niż jedno P1 lub P2 klasy testowej na pięć faz przywraca oś.

### Założenie 7. Batch sceptyków po cztery findingi

**Co liczymy.** Liczba agentów sceptyków na fazę (dziś 8,8, hipoteza 2–3), odsetek obaleń i degradacji przy batchu, koszt sceptyków.

**Dziś.** 738 sceptyków w 105 runach, obalenia 10,9 procent, degradacje P2 na P3 23 procent. Hipoteza z etapu 1: oszczędność 2 procent.

**Odwrót.** Obalenia poniżej 5 procent albo degradacje ponad 35 procent przy batchu. Wtedy P1 i P2 wracają do jednego findingu na sceptyka.

### Założenie 8. Hook przypominający o obsłudze błędów wycofać po bramce ESLint

**Co liczymy.** Wynik bramki ESLint z listą reguł, czy łapie to, co łapał hook, a po wycofaniu: uwagi bota klas ścieżka błędu, pusty catch, console.

**Dziś.** Ile razy hook się wyzwalał, nie wiadomo, brak danych. ESLint na oferty-online: 188 zastanych błędów do wyciszenia przy pierwszym wdrożeniu, pełny bieg 23,6 sekundy na zimno, 1,3 z cache. Bot: 15 uwag tych klas na 19 PR-ów.

**Odwrót.** Uwagi tych klas rosną ponad 0,8 na PR. Wtedy hook wraca.

---

## Część 3. Czego brakowało w rekordzie i co dopisałem

Rekord telemetrii z D5 powstał od strony „co da się zebrać z dysku". Mapa poszła od strony „co chcemy udowodnić". Zestawienie wykazało 16 braków, wszystkie dopisane teraz do rekordu, żeby telemetria weszła do wdrożenia już we właściwym kształcie. Dwa najważniejsze:

- **Rekord runu dev-pr z klasyfikacją uwag bota:** numer PR, tury, uwagi razem, P1/P2/P3, koszyki A–D, lista klas z plikiem i osią, rekomendacja. Bez tego jedenaście wpisów mapy nie ma źródła.
- **Nowy typ rekordu: epizod skilla w sesji głównej,** z kosztem, minutami i rozmiarem artefaktów. Bez tego scalenie planu z docs nie ma odczytu.

Reszta: długość promptu delegacji, liczba wywołań MCP, rozmiar batcha i werdykty sceptyka w trzech etykietach, rozmiar indeksu wiedzy i wycinka, pliki i rozmiar diffu fixa, P1 naprawione z testem, liczba rund review, rozmiar dossier, wynik ESLint z listą reguł, testy typów, profil stacku, pozycje smoke przeniesione z manual.

## Część 4. Skąd wezmą się liczby „przed"

Jednorazowy import do nowego pliku w pierwszej iteracji wdrożenia: 2 941 agentów z etapu zerowego, 33 odzyskane wpisy starej telemetrii, 149 epizodów skilli, 19 sklasyfikowanych PR-ów. To załatwia też Twoją otwartą decyzję o scaleniu odzyskanej telemetrii z oryginałem: import jest scaleniem.

## Co z tego wynika dla planu wdrożenia

Pierwsza iteracja to telemetria z importem, bo bez niej nic nie ma odczytu. Każda następna iteracja wchodzi w parze ze swoim wpisem z tej mapy i ma zaplanowany moment odczytu: po jednej fazie, po pięciu fazach albo po pięciu PR-ach. Zmiana bez wpisu jest niekompletna.
