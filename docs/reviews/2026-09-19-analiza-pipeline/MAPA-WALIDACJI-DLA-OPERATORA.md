# Mapa walidacji zmian — wersja dla operatora

**Data:** 2026-09-22 (domknięcie D5b). **Wersja 2** tego samego dnia: po Twojej akceptacji dziewięciu poprawek z `PROPOZYCJA-POPRAWEK-MAPY-WALIDACJI.md`.
**Wersja techniczna:** `dane/d5b-mapa-walidacji.txt` (dla Claude'a i dla skryptu raportu). **Rekord telemetrii, do którego mapa się odwołuje:**
`dane/d5-telemetria-rekord.txt`. **Liczby jakości:** `dane/d5b-baseline-jakosci.txt`.

---

## O co chodzi

Wymóg numer 13 z pakietu wejściowego mówi: każda zmiana w pipelinie ma wskazaną metrykę. Do dziś to było zdanie. Ta mapa zamienia je w listę: dla każdego z 13 twardych wymogów i 8 założeń z warunkiem odwrotu jest zapisane, co liczymy, skąd bierzemy liczbę, ile wynosi dziś i kiedy patrzymy. Założenia mają jeszcze warunek, przy którym zmianę cofamy.

## Jakie kryteria dobrałem

**Metryka musi wychodzić z rekordu telemetrii, nie z osobnego pomiaru.** Jeśli czegoś nie da się policzyć skryptem z pliku, który i tak powstaje po runie, to nie jest metryka, tylko życzenie. Dlatego przy każdym wpisie stoi nazwa pola, a jeśli pola nie było, dopisałem je do rekordu od razu. Trzy rzeczy świadomie zostawiłem poza telemetrią, bo mierzy się je przed wdrożeniem, jednorazowo: skuteczność sceptyka na starych findingach, warstwy mechaniczne testów na 31 starych uwagach bota i to, czy treść skilli builderów jest w ogóle stosowana (mini-run).

**Punkt odniesienia z etapu zerowego.** Pięć projektów, 2 941 agentów, 1 179 milionów jednostek kosztu, a dla oferty-online po 6 września: 35,5 agenta i 740 tur na fazę. Tam, gdzie etap zerowy nie mierzył (bramka advisors, hook obsługi błędów), napisałem wprost „brak" zamiast zgadywać. Dla jakości punkt odniesienia jest liczony inaczej, patrz niżej.

**Trzy horyzonty, dobrane do tego, jak szybko liczba się ustala.**
- Po jednej fazie widać ustawienia: kontekst startowy agenta, czas bramek, budżet instrukcji, czy telemetria zapisała rekord. To cechy konfiguracji, nie statystyka.
- Po pięciu fazach widać koszt i tury, bo rozrzut jest duży: builder ma zwykle 39 tur, ale co dziesiąty ma ponad 83.
- Po pięciu PR-ach widać jakość, bo CodeRabbit recenzuje PR, nie fazę. Pięć faz to nie pięć PR-ów: zadanie ma od trzech do sześciu faz i jeden PR, więc pięć faz to jeden, najwyżej dwa PR-y. Żaden próg jakości nie jest liczony „na fazy".

## Jak mierzymy jakość

Miara jakości to uwagi bota po naszym review, zgodnie z Twoją decyzją z początku analizy. Żeby ta liczba coś rozstrzygała, obowiązuje pięć zasad.

**Liczymy tylko realne defekty.** Wchodzą uwagi bota z koszyka B o wadze P1 lub P2, czyli defekty, które przeszły przez nasze review. P3 i szum konfiguracji do miary nie wchodzą.

**Na sto plików, z podziałem na typ kodu i oś.** PR-y mają od 12 do 160 plików, więc liczenie „na PR" mieszało rozmiar zadania z jakością. Typ kodu robi dużą różnicę: warstwa danych i serwer zbiera więcej uwag niż UI czy testy, więc porównujemy zawsze ten sam typ z tym samym. Oś bierzemy z oceny etapu 1b, która zapisała, która oś review powinna była daną uwagę złapać.

**Punkt odniesienia z września.** Jakość poprawiała się sama w czasie: 9,3 poważnej uwagi na sto plików w PR-ach 1–7, 7,5 w PR-ach 8–11, 3,5 we wrześniu (PR-y 13, 14, 15, 16, 17 i 19; PR 12 i 18 powstały ręcznie, więc ich nie liczę). Średnia z całości wynosi 6,7 i pokazałaby „poprawę", nawet gdyby nowe zmiany nic nie dały. We wrześniu w podziale na typ kodu: dane i serwer 4,3, logika dashboardu 7,5, UI 4,7, testy 3,0.

**Nowy punkt odniesienia po zmianie konfiguracji bota.** Osiem zmian konfiguracji CodeRabbita wchodzi przed pomiarem, a po nich bot komentuje inaczej. Dlatego w planie wdrożenia jest obowiązkowy krok: po zmianie konfiguracji, a przed pierwszą zmianą pipeline'u, zbieramy nowy punkt odniesienia z dwóch–trzech zadań. Z nim porównujemy wszystkie zmiany pipeline'u. Stare uwagi zostają jako tło.

**Unikalne wątki bota na PR (przegląd D5, 23 września).** Dev-pr to kilka osobnych runów na jeden PR, a każda kolejna tura wypisuje ponownie wątki z poprzednich. Suma po runach dawała 255 wątków, unikalnych było 178, czyli zawyżenie o 43 procent, i to najmocniej w PR-ach z wieloma turami. Liczymy więc każdy wątek bota raz na PR. Punkt odniesienia z września pochodzi z GitHuba i już liczył każdą uwagę raz.

**Jeden próg odwrotu dla wszystkich założeń.** Zmianę cofamy, gdy liczba poważnych uwag danej osi w oknie pięciu PR-ów jest co najmniej dwa razy większa od oczekiwanej z punktu odniesienia i wynosi co najmniej trzy. Klasa pojedynczego defektu służy do diagnozy, co wróciło, a nie do automatycznego cofania. Powód: liczby są małe. We wrześniu na sześć PR-ów przypadło 8 poważnych uwag correctness, 7 test-coverage, 6 security, 2 spec i jedna wydajnościowa. Dawny próg „więcej niż jedna" dla wydajności włączałby alarm przypadkiem mniej więcej w co piątym oknie, nowy w co dwudziestym. W oknie pięciu PR-ów progi wynoszą dziś: correctness 14, test-coverage 12, security 10, spec 4, wydajność 3.

---

## Część 1. Trzynaście twardych wymogów

### 1. Allowlista narzędzi i pliki agentów per klasa roli

**Co liczymy.** Kontekst pierwszej tury agenta, osobno dla każdej klasy roli. Do tego: czy agent w ogóle ma plik z ustawieniami, czy nie woła MCP, gdy nie powinien, i jaki jest udział „opłaty za powołanie" w koszcie fazy.

**Dziś.** Agent mechaniczny startuje z 65–67 tysięcy tokenów, reviewer z 95–97, builder ze 118. Pomiar 1 pokazał, że pusty agent na Twoim koncie startuje z 62,8 tysiąca, a po allowliście z 11,6, a z pominięciem CLAUDE.md z 4,5. Trzy czwarte agentów nie ma żadnego pliku. Opłata za powołanie to 22 procent całego kosztu.

**Kiedy patrzymy.** Po jednej fazie, wstępnie już w mini-runie. Cel: mechaniczne około 4,5 tysiąca, reviewer około 15, builder około 25.

**Uwaga po przeglądzie 23 września.** Liczby „dziś” pochodzą z trzech tygodni, w których CLAUDE.md w oferty-online urósł z 14 do 87 tysięcy znaków,
a start agentów rósł razem z nim, u reviewerów z 76 do 145 tysięcy tokenów. Właściwy punkt odniesienia musi pochodzić ze stanu po ścięciu CLAUDE.md,
osobno dla każdej klasy i modelu, bo haiku startuje o około 35 tysięcy niżej niż opus przy tej samej konfiguracji. Bez tego allowlista dostałaby na konto
zysk ze ścięcia CLAUDE.md. Przegląd D5 znalazł pierwszy taki run: 20 września autopilot (85 agentów) pracował ze ściętym CLAUDE.md na gałęzi zadania.
Start wynosił tam 89 tysięcy u mechanicznych na haiku, 121 u orkiestracyjnych, 125 u reviewerów, 123 u sceptyków i 135 u builderów. Próby są małe, więc
mini-run to potwierdzi. Do tego telemetria policzy wprost, ile narzędzi dostał agent: dziś 972 narzędzia i 309 skilli. Allowlista ma to zbić do kilkunastu,
więc jej działanie sprawdzi jedna liczba, bez porównywania epok. Opłata za powołanie po poprawce liczenia kosztu z przeglądu D5 wynosi 20, nie 22 procent.

### 2. Kontekst per klasa roli (CLAUDE.md u builderów, bypass zostaje, skille builderów zostają)

**Co liczymy.** Kontekst na turę i liczbę tur per rola, koszt na agenta, oraz jaki udział w koszcie ma „kontekst razy tury". Czy treść skilli jest stosowana, sprawdza mini-run, nie telemetria.

**Dziś.** Na turę: mechaniczne 86–102 tysiące, reviewerzy 193–224, buildery 238 (średnia z okresu wzrostu CLAUDE.md, więc porównujemy przy podobnym
rozmiarze stałych plików). Builder robi 39 tur, fix 37, reviewer 15–30, sceptyk 7. Builder kosztuje 1,2 miliona jednostek, reviewer od 468 do 931 tysięcy. Kontekst razy tury to 40 procent kosztu (po poprawce liczenia z przeglądu D5: 36,5).

**Kiedy patrzymy.** Po pięciu fazach. Oczekiwana dźwignia całości: 25–35 procent kosztu fazy.

### 3. Budżet instrukcji w trzech warstwach

**Co liczymy.** Warstwa stała: liczba instrukcji na rolę z testu szablonu, cel poniżej 150. Warstwa referencyjna: długość promptu delegacji, żeby doklejanie nie rozdmuchało go ponad dzisiejsze 10 tysięcy znaków plus 1–2 tysiące wycinka. Skutek: miara jakości w podziale na osie. To, czy agent przestrzega instrukcji, którą ma, sprawdzamy raz w miesiącu na próbce kilkunastu uwag, a nie w każdym runie.

**Dziś.** Reviewer security ma 365 instrukcji, builder danych około 500 (537 w pierwszej wersji, liczonej na najdłuższym prompcie zadania zamiast typowego),
po już podjętych decyzjach nadal 310–320 i około 480–490. Około 110 poleceń reviewera obowiązuje zawsze, reszta jest warunkowa i ma zejść do warstwy
doklejanej. Test szablonu liczy pozycje jednego oznaczonego bloku poleceń, nie słowa nakazu w tekście (przegląd 23 września). Prompt delegacji: builder 9,7 tysiąca znaków, reviewerzy 8–11 tysięcy, dedup 32 tysiące. Jakość: 3,5 poważnej uwagi na sto plików we wrześniu. Tło dla próbki miesięcznej: w etapie 1b 164 z 200 uwag B były w zakresie promptu, ale zostały przeoczone.

**Kiedy patrzymy.** Test szablonu pada od razu, prompt po jednej fazie, skutek po pięciu PR-ach.

### 4. Learned-patterns w trzech poziomach z wycinkiem od orkiestratora

**Co liczymy.** Rozmiar tego, co ładuje się zawsze (CLAUDE.md i indeks), rozmiar wycinka doklejanego builderowi i reviewerowi, zniknięcie dubla z dossier, oraz skutek: jaka część poważnych uwag bota dotyczy klas, które mają regułę w indeksie. To, czy klasa ma regułę, liczy skrypt, porównując ją z listą klas w indeksie, bez agenta. To samo pole zasila licznik ucieczek per wpis, jedno z ośmiu przyjętych zabezpieczeń.

**Dziś.** Learned-patterns ma 46,9 tysiąca znaków i wchodzi do każdego agenta, a do reviewerów drugi raz przez dossier. CLAUDE.md oferty-online urósł z 3,4 do 89,7 tysiąca znaków w cztery tygodnie, po odchudzeniu 20,6. Dwie trzecie ucieczek miało regułę w kontekście. Rozmiary bierzemy z transkryptu agenta, czyli tak, jak agent je dostał, a nie z repo. Przegląd D5 pokazał, że u co czwartego agenta CLAUDE.md różnił się od gałęzi main, bo run pracuje na gałęzi zadania.

**Kiedy patrzymy.** Rozmiary po jednej fazie, skutek po pięciu PR-ach, rozrost po pięciu zadaniach.

### 5. Telemetria mechaniczna, zero agentów

**Co liczymy.** Czy każdy run ma rekord z prawdziwym statusem, czy w runie nie ma agenta telemetrii, czy rekord agenta ma pełny cennik, czy plik tylko rośnie. Po przeglądzie D5 status czytamy z pliku, który Claude Code zapisuje po każdym runie (jest dla wszystkich 156 runów), więc „status nieznany” ma się zdarzać tylko po awarii sesji. Dawne zgadywanie statusu po ostatnim agencie dałoby „nieznany” w 23 z 55 runów.

**Dziś.** Jeden wpis na run pisany przez agenta haiku, który dwa razy skasował plik. Telemetria widziała tylko tokeny wyjściowe, czyli około 11 procent kosztu. Wcześniej pisałem 2 procent; przegląd D5 wykazał, że skrypt etapu zerowego zaniżał tokeny wyjściowe. Poziom agenta nie istniał.

**Kiedy patrzymy.** Od pierwszego runu. To jest pierwsza iteracja wdrożenia.

### 6. E2E przełącza na manual zamiast zatrzymywać run

**Co liczymy.** Zatrzymania z powodu środowiska E2E (cel zero), liczba runów na zadanie (cel jeden), pozycje manual per powód, czy manual dotarł do smoke operatora, wynik sprawdzenia środowiska przed startem.

**Dziś.** 13 runów na 5 zadań, trzy zadania potrzebowały dwóch lub trzech runów. Zatrzymania: niemierzalna asercja raz, limit mailera stagingu dwa razy, nierozwiązane P1 raz, fałszywy stop po Twojej edycji raz, próg gzip raz. Powtórki review po tych stopach kosztowały około 1,2 miliona tokenów wyjściowych w dwóch zadaniach.

**Kiedy patrzymy.** Po pięciu zadaniach, bo stopy są rzadkie.

### 7. Sceptyk asymetryczny

**Co liczymy.** Kill rate, czyli ile findingów sceptyk obalił z dowodem w kodzie, osobno degradacje wagi, a jako zabezpieczenie: czy bot zgłasza P1 lub P2 w miejscu, które sceptyk obalił. Do tego udział P1 naprawionych z testem padającym przed poprawką i koszt sceptyków w fazie. Werdykty w trzech etykietach i liczba P1 z testem wymagają zmiany schematu wyniku w workflowach, zanim skrypt je odczyta.

**Dziś.** Sceptycy obalają 12 procent (inne liczenia: 19,2 i 10,9), częściej przeklasyfikowują niż obalają. Literatura dla sceptyka asymetrycznego: 63–83 procent. Sceptycy to 6 procent kosztu fazy, 8,8 agenta na fazę.

**Kiedy patrzymy.** Kill rate po pięciu fazach, kasowanie prawdziwych po pięciu PR-ach. Kill rate na starych findingach o znanych werdyktach mierzymy przed wdrożeniem, poza telemetrią.

### 8. Security warunkowe po profilu stacku, advisors na chmurze

**Co liczymy.** Wynik i czas bramki advisors, koszt i tury reviewera security, findingi security per faza, a jako skutek: poważne uwagi bota osi security na sto plików, osobno dla projektów z Supabase i bez. Stąd nowe pole: profil stacku w rekordzie runu.

**Dziś.** Reviewer security kosztuje 561 tysięcy na agenta i robi 19 tur, znajduje najwięcej ze wszystkich osi (9 P1, 122 P2). Bot po naszym review: 33 poważne uwagi osi security w 17 PR-ach, czyli 1,72 na sto plików, a we wrześniu 6 uwag, czyli 0,88. Wcześniejsza liczba „cztery uwagi" była błędem mojego filtra. Dla projektu bez Supabase nie ma punktu odniesienia, bo wszystkie 19 PR-ów to jeden projekt z Supabase, więc pierwsze pięć PR-ów takiego projektu będzie jego punktem wyjścia. Advisors nie zmierzone, bo Docker był wyłączony.

**Kiedy patrzymy.** Bramka po jednej fazie, koszt po pięciu, skutek w oknie pięciu PR-ów osobno dla każdego profilu stacku.

### 9. Pętla fix bez dodatkowej rundy review, tylko P1 i P2

**Co liczymy.** Miara z Twojej decyzji: poważne uwagi bota na sto plików, których dotknął fix, wobec tej samej stopy w pozostałych plikach PR-a. Cel: ten stosunek spada. Do tego koszt pętli, liczba pominiętych P3, regresje z kontroli diffu, rozmiar diffu fixa.

**Dziś.** Fix to 17 procent kosztu fazy, 37 tur, 1,2 miliona na agenta. Naprawia 98 procent findingów łącznie z P3. W plikach dotkniętych fixem bot zgłasza 14,0 poważnej uwagi na sto plików, w pozostałych 4,7, a we wrześniu 7,2 wobec 2,2. Pliki po fixie mają więc trzy razy więcej defektów, które przechodzą do bota. W czterech PR-ach, które są serwerową częścią zadań dzielonych na dwa PR-y, commity fixów leżą w PR-ze siostrzanym, więc wynik jest raczej ostrożny niż zawyżony. Wynik D1 zostaje jako tło: dotyczy powtórki naszego review, nie bota.

**Kiedy patrzymy.** Skutek w oknie pięciu PR-ów, koszt po pięciu fazach.

### 10. Zakaz powtórek sekwencyjnych review

**Co liczymy.** Liczba rund review w fazie (cel jedna), powtórki tej samej fazy między runami, koszt review na fazę.

**Dziś.** Powtórka tej samej fazy dawała 12–18 nowych pozycji, na tym samym kodzie połowa powtarzalności, po fixie prawie zero. Sześciu reviewerów to 25 procent fazy.

**Kiedy patrzymy.** Po pięciu zadaniach.

### 11. Polecenia-listy zamiast długich reguł

Ta sama metryka co założenie 1 poniżej: miara jakości w podziale na osie i typ kodu, plus budżet instrukcji z wymogu 3. Punkt odniesienia w 17 PR-ach, poważne uwagi B per oś: correctness 56, security 33, test-coverage 26, spec 7, wydajność 5, e2e 1, code-quality 0. Najczęstsze klasy służą do diagnozy: test niefalsyfikowalny 31, bramka na czarnej liście 13, tekst w UI 12, cykl życia Reacta 12.

### 12. Scalenie dev-plan i dev-docs

**Co liczymy.** Koszt epizodu scalonego skilla wobec sumy dwóch dzisiejszych, czas operatora (mediana minut, bo jeden epizod dev-docs trwał 17 godzin z otwartą sesją), rozmiar artefaktów i udział kopii, kontekst sesji głównej. Stąd nowy typ rekordu: epizod skilla w sesji głównej.

**Dziś.** Dev-plan 930 tysięcy na epizod i 47 minut, dev-docs 707 tysięcy i 67 minut, razem 1,64 miliona na zadanie, czyli 2–5 procent kosztu zadania. Plan ma 57–137 kilobajtów, zadania 29–69, z czego 22–46 procent to kopia planu.

**Kiedy patrzymy.** Po pięciu zadaniach, bo epizody mają rozrzut od 0,4 do 2,5 miliona.

### 13. Każda zmiana ma metrykę

To jest ta mapa. Przed nią zero wymogów miało metrykę, po niej 21 z 21. Sędziowie sprawdzają obecność wpisu przy każdej zmianie w projekcie, nie jego wartość.

---

## Część 2. Osiem założeń z warunkiem odwrotu

### Założenie 1. Polecenia-listy domkną 60–70 procent uwag B

**Co liczymy.** Miara jakości w podziale na osie i typ kodu, porównywana w tym samym typie kodu: migracje z migracjami, ekrany z ekranami. Cel: spadek o 60–70 procent wobec punktu odniesienia zebranego po zmianie konfiguracji bota.

**Dziś.** We wrześniu 3,5 poważnej uwagi na sto plików; dane i serwer 4,3, logika dashboardu 7,5, UI 4,7, testy 3,0.

**Odwrót.** Wspólny próg: poważne uwagi osi w oknie pięciu PR-ów co najmniej dwa razy powyżej oczekiwanych i co najmniej trzy. Wtedy wraca reguła lub oś, a klasa wskazuje, którą regułę przywrócić.

**Kiedy patrzymy.** W oknie pięciu PR-ów. Przed wdrożeniem nie ma żadnego pomiaru, to oceny agentów z etapu 1b.

**Oczekiwanie po przeglądzie 23 września.** Sześćdziesiąt do siedemdziesięciu procent to cel z ocen agentów, a nie wynik, na który liczymy. Połowa
nowych findingów po naprawie to przeoczenia w kodzie, który reviewer oglądał, a większość uwag bota była w zakresie promptu. To wygląda bardziej na
granicę uwagi niż na brak reguł, więc realny spadek może być wyraźnie mniejszy. Mini-run („sto kontra czterysta poleceń”) pokaże, czy sama liczba
poleceń ma tu znaczenie.

### Założenie 2. Performance zastąpić bramkami i checklistą w correctness

**Co liczymy.** Poważne uwagi bota osi wydajności w oknie pięciu PR-ów, wynik i czas bramek size-limit i advisors, findingi wydajnościowe zgłoszone przez correctness, oszczędność z braku agenta.

**Dziś.** Oś performance to 3 procent fazy, 15 tur, 468 tysięcy na agenta, 183 findingi. Bot po naszym review: 5 poważnych uwag wydajnościowych w 17 PR-ach, we wrześniu jedna. Size-limit trwa 0,8 sekundy i nie ma go w szablonie.

**Odwrót.** Co najmniej trzy poważne uwagi wydajnościowe w oknie pięciu PR-ów przywracają oś na tanim tierze.

### Założenie 3. Security odchudzone i warunkowe

Metryka i punkt odniesienia jak w wymogu 8: 0,88 poważnej uwagi na sto plików we wrześniu. **Odwrót:** wspólny próg, dziś 10 uwag w oknie pięciu PR-ów, wtedy wracają wycięte polecenia. Liczone osobno dla projektów z Supabase i bez.

### Założenie 4. Packager zastąpiony skryptem

**Co liczymy.** Tury Bash reviewerów z dossier ze skryptu wobec dossier od agenta, zniknięcie kosztu roli packagera, findingi per oś bez spadku, rozmiar dossier.

**Dziś.** Packager to 81 agentów, 230 tysięcy każdy, 1,6 procent. Jedyny pomiar: reviewerzy po dossier czytali dwa razy więcej Bashem (z 10,5 do 23 tur). Bilans z etapu 1 był ujemny.

**Odwrót.** Tury Bash reviewerów rosną ponad 23 albo findingi spadają o ponad 30 procent przy tym samym typie kodu. Kierunek jest tani i odwracalny.

### Założenie 5. Sceptyk asymetryczny cztery razy skuteczniejszy

Metryka jak w wymogu 7. **Odwrót:** kill rate ponad 50 procent i jednocześnie co najmniej trzy poważne uwagi bota w miejscach obalonych findingów w oknie pięciu PR-ów. Wtedy sceptyk kasuje prawdziwe i dla P1 wraca prompt z uzasadnieniem autora.

### Założenie 6. Test-coverage scalone z correctness (tylko opcja wariantu)

**Co liczymy.** Warstwy mechaniczne: Stryker jako lista mutantów do zabicia (nie score jako cel), testy typów, poważne uwagi bota osi test-coverage na sto plików, findingi i koszt osi test.

**Dziś.** Oś test-coverage to 26 tur, 718 tysięcy na agenta, 202 findingi. Bot: 26 poważnych uwag osi test w 17 PR-ach, we wrześniu 7; klasa numer jeden to test niefalsyfikowalny, 31 uwag. Warstwa pierwsza (ESLint) trafia zero z 31. Stryker: 122 sekundy na trzy pliki, więc 5–15 minut na fazę, nie do każdego domknięcia.

**Odwrót.** Scalenie jest dopuszczalne dopiero, gdy warstwy 2–3 trafią co najmniej 20 z 31 starych uwag. Po scaleniu: wspólny próg, dziś 12 uwag osi test w oknie pięciu PR-ów, przywraca oś.

### Założenie 7. Batch sceptyków po cztery findingi

**Co liczymy.** Liczba agentów sceptyków na fazę (dziś 8,8, hipoteza 2–3), odsetek obaleń i degradacji przy batchu, koszt sceptyków.

**Dziś.** 738 sceptyków w 105 runach, obalenia 10,9 procent, degradacje P2 na P3 23 procent. Hipoteza z etapu 1: oszczędność 2 procent.

**Odwrót.** Obalenia poniżej 5 procent albo degradacje ponad 35 procent przy batchu. Wtedy P1 i P2 wracają do jednego findingu na sceptyka.

### Założenie 8. Hook przypominający o obsłudze błędów wycofać po bramce ESLint

**Co liczymy.** Wynik bramki ESLint z listą reguł, czy łapie to, co łapał hook, a po wycofaniu: poważne uwagi bota w zamkniętej grupie klas obsługi błędów (ścieżka błędu, pusty catch, granica try-catch, połknięty błąd, console, dane i sekrety wysyłane do Sentry).

**Dziś.** Ile razy hook się wyzwalał, nie wiadomo, brak danych. ESLint na oferty-online: 188 zastanych błędów do wyciszenia przy pierwszym wdrożeniu, pełny bieg 23,6 sekundy na zimno, 1,3 z cache. Bot: 21 uwag tej grupy w 17 PR-ach, z tego 12 poważnych, we wrześniu zero.

**Odwrót.** Co najmniej trzy poważne uwagi tej grupy w oknie pięciu PR-ów. Wtedy hook wraca.

---

## Część 3. Czego brakowało w rekordzie i co dopisałem

Rekord telemetrii z D5 powstał od strony „co da się zebrać z dysku". Mapa poszła od strony „co chcemy udowodnić". Zestawienie wykazało 16 braków, wszystkie dopisane teraz do rekordu, żeby telemetria weszła do wdrożenia już we właściwym kształcie. Dwa najważniejsze:

- **Rekord runu dev-pr z klasyfikacją uwag bota:** numer PR, liczba plików PR, tury, uwagi razem, P1/P2/P3, koszyki A–D, lista klas z plikiem, osią i informacją, czy klasa ma regułę w indeksie, rekomendacja. Bez tego jedenaście wpisów mapy nie ma źródła. Klasyfikację robi ten sam agent zbierania co dziś, w tej samej turze, z rozszerzonym schematem. Dziś zwraca tylko decyzję (napraw, odrzuć, do operatora), po zmianie także klasę defektu, oś i wagę. Informację o regule liczy skrypt. Ocena „dlaczego przeoczone" wypadła z runu, bo to osąd, a nie mechanika, i w każdym runie zwiększałaby koszt zbierania. Robimy ją raz w miesiącu na próbce. Zanim zaczniemy porównywać, nowy klasyfikator przepuszcza dwa–trzy stare PR-y i sprawdzamy, czy jego klasy zgadzają się z etapem 1b.
- **Nowy typ rekordu: epizod skilla w sesji głównej,** z kosztem, minutami i rozmiarem artefaktów. Bez tego scalenie planu z docs nie ma odczytu.

Reszta: długość promptu delegacji, liczba wywołań MCP, rozmiar batcha i werdykty sceptyka w trzech etykietach, rozmiar indeksu wiedzy i wycinka, pliki i rozmiar diffu fixa, P1 naprawione z testem, liczba rund review, rozmiar dossier, wynik ESLint z listą reguł, testy typów, profil stacku, pozycje smoke przeniesione z manual.

**Po przeglądzie D5 (23 września) doszło jeszcze kilka pól:**
- rozkład kontekstu startowego agenta, czyli ile dostał narzędzi, skilli i znaków CLAUDE.md;
- wersja Claude Code;
- numer próby i wynik „błąd” u agenta;
- identyfikator wątku bota, potrzebny do liczenia każdego wątku raz;
- wersja szablonu jako skrypt, który naprawdę się wykonał.

Ta ostatnia potrzebuje jednej zmiany w synchronizacji szablonu: zapisu skrótu każdego pliku.

**Część pól wymaga pracy, zanim skrypt cokolwiek odczyta.** Werdykty sceptyka, P1 naprawione z testem, wyniki bramek i pozycje smoke muszą najpierw pojawić się w wynikach workflowów, a klasyfikacja bota w schemacie agenta zbierania. W wersji technicznej każde takie pole ma dopisek „wymaga zmiany w" z nazwą miejsca, żeby plan etapu 5 to uwzględnił.

## Część 4. Skąd wezmą się liczby „przed"

Jednorazowy import do nowego pliku w pierwszej iteracji wdrożenia: 2 941 agentów z etapu zerowego, 33 odzyskane wpisy starej telemetrii, 149 epizodów skilli, 19 sklasyfikowanych PR-ów razem z ich rozmiarem i osią uwag. To załatwia też Twoją otwartą decyzję o scaleniu odzyskanej telemetrii z oryginałem: import jest scaleniem. Zaimportowane uwagi bota są tłem. Właściwy punkt odniesienia jakości powstaje dopiero po zmianie konfiguracji bota. Przed importem agentów przeliczam ich koszt poprawionym sposobem (przegląd D5: stary skrypt zaniżał tokeny wyjściowe i sklejał trzy role naprawcze w jedną).

## Część 5. Kolejność odczytów, żeby zmiany się nie mieszały

Wszystkie odczyty jakości czytają ten sam strumień uwag bota, a każdy potrzebuje pięciu PR-ów, czyli mniej więcej pięciu zadań. Kilkanaście iteracji jedna po drugiej to miesiące, a wszystkie naraz to brak wiedzy, co zadziałało. Dlatego trzy reguły:

- **Ustawienia i koszt mogą biec równolegle bez ograniczeń.** Kontekst startowy, pliki agentów, bramki, budżet instrukcji, tury i telemetria czytają różne pola i się nie zakłócają.
- **Zmiany jakościowe dotyczące różnych osi mogą biec równolegle w tym samym oknie.** Na przykład zmiana w security i zmiana w teście, bo każdą czytamy tylko po uwagach jej osi. Zastąpienie osi wydajności dotyka dwóch osi, wydajności i correctness, bo checklista trafia do correctness.
- **Zmiany przekrojowe mają okno pięciu PR-ów dla siebie.** Budżet instrukcji, wycinek wiedzy, polecenia-listy wprowadzane we wszystkich osiach naraz, kontekst reviewerów, sceptyk asymetryczny i pętla fix tylko na P1 i P2 dotykają wszystkich osi jednocześnie. Druga zmiana jakościowa w tym samym oknie sprawi, że nie da się powiedzieć, która zadziałała.

Zmiana przekrojowa, która jest też zmianą kosztu, na przykład kontekst, może wejść razem ze zmianami ustawień, ale jej odczyt jakości i tak zajmuje okno dla siebie. Która zmiana przekrojowa idzie pierwsza, rozstrzygnie plan etapu 5.

Okresy przed i po zmianie rozdzielamy po tym, który skrypt naprawdę się wykonał, a nie po numerze wersji zapisanym w projekcie. Przegląd D5 pokazał, że 33 z 55 runów autopilota puściło lokalnie zmieniony skrypt, a znacznik wersji jest tylko w 5 z 11 repo.

## Co z tego wynika dla planu wdrożenia

Pierwsza iteracja to telemetria z importem, bo bez niej nic nie ma odczytu. Potem osiem zmian konfiguracji bota, kalibracja klasyfikatora uwag i zebranie nowego punktu odniesienia jakości z dwóch–trzech zadań, zanim ruszy pierwsza zmiana pipeline'u. Każda następna iteracja wchodzi w parze ze swoim wpisem z tej mapy i ma zaplanowany moment odczytu, po jednej fazie, po pięciu fazach albo w oknie pięciu PR-ów, zgodnie z regułami kolejności z części 5. Zmiana bez wpisu jest niekompletna.
