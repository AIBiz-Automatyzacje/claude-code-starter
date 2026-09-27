# Decyzje i plan wdrożenia — notatka dla operatora (2026-09-27)

**Zaakceptowane 2026-09-27** — razem z trzema rekomendacjami z końca notatki.

Wersja techniczna z liczbami, rekordami decyzji i tabelą iteracji: `PANEL-WYNIK.md`. Liczby policzyły skrypty (`skrypty/pokretla_kosztu.py`,
`skrypty/d12_nowe_pliki_fixa.py`, `skrypty/tempo_pr.py`) na transkryptach testu review i danych panelu, nie ja z głowy.

## Wniosek

**Obecny pipeline da się wyraźnie potanić bez utraty jakości, ale tylko w części miejsc, w których oszczędzał projekt A.**

1. **A był o 43% tańszy w szukaniu błędów. Mniej więcej połowę tej oszczędności możemy wziąć za darmo, drugą połowę A zapłacił zgubionymi błędami.**
   Bierzemy tylko tę pierwszą: około 20% taniej na etapie szukania błędów.
2. **Trzy najlepsze pokrętła:** niższy „wysiłek myślenia” dla recenzenta testów, sprawdzanie zgłoszeń paczkami po cztery zamiast pojedynczo oraz
   listy kontrolne dla recenzenta poprawności. Każde z nich w teście coś oszczędziło i nic nie zgubiło.
3. **Trzech rzeczy nie ruszamy, choć wcześniej planowaliśmy.** Recenzent wydajności zostaje. Recenzent jakości kodu zostaje na pełnym wysiłku.
   Instrukcji recenzenta bezpieczeństwa nie skracamy bez osobnego sprawdzenia. W teście to właśnie tam A tracił błędy.
4. **Druga połowa pomysłu z poprawkami („jeśli poprawka wymaga nowego pliku, zrób z niej osobne zadanie”) — nie teraz.** Dotknęłaby dwóch trzecich
   poprawek, a pomaga przy jednym poważnym błędzie na 21.
5. **Plan ma dziewięć kroków.** Najpierw pomiar, potem nowa kontrola poprawek (najpewniejszy zysk), dalej reszta po kolei. Każdy krok ma swoją miarę
   i warunek, przy którym go cofamy. Przy tempie z września (około sześciu PR-ów tygodniowo) całość zajmie mniej więcej dwa miesiące.

Pod koniec notatki są trzy rzeczy, które potrzebuję od Ciebie.

## 1. Skąd się bierze koszt recenzji

**Problem.** Wiemy z testu, że A szukał błędów o 43% taniej przy podobnej jakości, ale nie wiedzieliśmy, co dokładnie dało tę różnicę.
**Przyczyna.** A zmienił naraz kilka rzeczy: wysiłek myślenia recenzentów, treść ich instrukcji, sposób podawania materiału i skład zespołu.
**Co zrobiłem.** Skrypt rozłożył koszt testu na każdego recenzenta osobno: ile kosztował, ile razy „myślał i czytał” (tury), ile pisał, jak długie
dostał polecenie i które błędy złapał. Potem porównał każdą rolę dzisiaj i w A.
**Co z tego wyszło.**
- **Połowa oszczędności A to niższy wysiłek myślenia** u trzech recenzentów, **prawie jedna trzecia to usunięcie** recenzenta wydajności i agenta
  przygotowującego materiał, **reszta (jedna piąta) to inne brzmienie instrukcji** u dwóch recenzentów pracujących na tym samym wysiłku.
- **Sama długość instrukcji prawie nic nie kosztuje.** Cały tekst polecenia to około 2–3% kosztu recenzenta. Koszt robi to, ile razy recenzent
  czyta i myśli. Krótszy tekst oszczędza dopiero wtedy, gdy zmienia sposób pracy, na przykład lista kontrolna zamiast ogólnego „sprawdź poprawność”.
- **Wysiłek myślenia jest dziś nieustawiony.** Recenzenci biorą go z Twojej sesji, a Ty uruchamiasz sesje raz na wysokim, raz na średnim. Koszt i jakość
  recenzji zależą więc od tego, którą sesję akurat otworzyłeś. Najpierw to przypinamy.

**Co to daje.** Wiemy, które pokrętła można przekręcić bez ryzyka, a których nie ruszać.

## 2. Które pokrętła bierzemy

- **Recenzent testów na średnim wysiłku, z listą „przeżytych mutantów”.** W teście kosztował połowę mniej i złapał trochę więcej niż dziś.
  To około 11% kosztu szukania błędów, czyli około 3% kosztu całego zadania.
- **Sprawdzanie zgłoszeń paczkami po cztery.** Dziś na każde zgłoszenie przypada prawie jeden osobny sprawdzający. Paczka po cztery kosztowała w teście
  o 42% mniej na zgłoszenie, około 4% kosztu zadania. Przy okazji: dzisiejsze sprawdzanie skasowało w teście dwa prawdziwe błędy, a nowe ani jednego.
  Przypadków jest mało, więc to tylko wskazówka.
- **Listy kontrolne dla recenzenta poprawności** (z projektu A). Około 5% kosztu szukania błędów mniej, a złapał trzy razy więcej ucieczek niż dziś
  (9 zamiast 3).
- **Listy dla recenzenta zgodności ze specyfikacją** i średni wysiłek. Oszczędność mała, ale złapał wyraźnie więcej.
- **Materiał dla recenzentów składa skrypt, nie agent.** Około 2% oszczędności. Nie dokładamy zakazu „czytaj tylko te pliki”, bo w teście niczego
  nie zmienił, a mógłby utrudnić łapanie błędów w plikach spoza zmiany.

## 3. Czego nie ruszamy i dlaczego zmieniam wcześniejsze ustalenia

**Problem.** W etapie 1 zapisaliśmy trzy uproszczenia: zastąpić recenzenta wydajności automatycznymi kontrolami, skrócić instrukcje bezpieczeństwa
o połowę, a recenzenta jakości kodu zamienić na lint i zakazać mu zgłaszania tego, co łapie lint.
**Przyczyna, dla której je cofam.** To były oceny sprzed prawdziwego testu. Test pokazał, że dokładnie w tych trzech miejscach A tracił:
- **Recenzent jakości kodu jest dziś najlepszym łapaczem ucieczek.** Z 25 błędów, które dziś łapiemy spośród tych, które kiedyś uciekły do bota,
  12 łapie on, a 10 tylko on. W A, na niskim wysiłku i krótkiej liście, złapał 2.
- **Recenzent bezpieczeństwa łapie najwięcej dzisiejszych trafień:** 16, wszystkie tylko on. Skrócona wersja z A złapała 8.
- **Recenzent wydajności ma 7 trafień, których nie ma nikt inny.** A bez niego zgubił cztery błędy wydajności.

**Co robimy.** Wydajność zostaje. Jakość kodu zostaje na pełnym wysiłku i dostaje wynik lintu jako dodatkową podpowiedź, a nie jako zastępstwo.
Bezpieczeństwo skracamy tylko wtedy, gdy ślepy test na starej fazie pokaże, że nowa wersja nie gubi (ta sama zasada co przy każdej zmianie instrukcji
recenzentów). Z tego samego powodu poprawki z przeglądu promptów dla tych trzech recenzentów wchodzą dopiero po takim teście.
**Co Ci to da.** Nie oddamy jakości za oszczędność, która w teście okazała się pozorna.

## 4. Nowa kontrola poprawek — i dlaczego bez „osobnego zadania”

**Problem.** W poprzedniej rozmowie przyjęliśmy nową kontrolę poprawek według A: łapie połowę błędów, które rodzą się w poprawkach, dziś — żadnego.
Otwarta została druga część: jeśli naprawa wymaga nowego pliku, nie naprawiać jej w poprawce, tylko zrobić osobne zadanie z pełną recenzją.
**Co sprawdziłem.** Wziąłem 24 prawdziwe poprawki z testu. 16 z nich dodaje nowy plik z kodem aplikacji. Ale z 21 poważnych błędów, które powstały
w tych poprawkach, w nowych plikach leży jeden. Pozostałe są w plikach, które poprawka tylko zmieniła.
**Co robimy.** Nie wprowadzamy tej reguły. Przerzuciłaby dwie trzecie poprawek do dodatkowego cyklu budowy i recenzji, a pomogłaby przy jednym błędzie
na 21. Nowa kontrola poprawek i tak sprawdza nowe pliki. Zapisuję warunek powrotu: jeśli bot zacznie znajdować poważne błędy w plikach dodanych przez
poprawki (trzy w pięciu PR-ach), wracamy do tematu.
**Co Ci to da.** Pełny zysk z nowej kontroli bez dokładania kosztownej pętli.

## 5. Pozostałe decyzje w jednym zdaniu

- **Sprawdzanie mutantów przez Strykera** idzie do zamknięcia każdej fazy. W teście trwało od kilku sekund do dwóch minut, a nie kwadrans, jak zakładaliśmy.
  Lista mutantów trafia do recenzenta testów w takim układzie, w jakim zadziałała w teście.
- **Weryfikacja ma cztery poziomy zamiast pięciu.** Builder sprawdza tylko swoje pliki, zamknięcie fazy uruchamia jeden skrypt z kompletem kontroli,
  poprawka te same kontrole na swoich plikach, a na końcu zadania zostaje pełna walidacja.
- **Recenzent specyfikacji nie pracuje w fazach bez kodu**, chyba że zmieniają teksty w aplikacji albo dokumenty prawne.
- **Plan i zadania stają się jednym skillem.** Plik zadań generuje skrypt z planu, bez kopiowania treści. Research przy małych zadaniach tylko wtedy,
  gdy dochodzi nowa biblioteka albo obszar nie ma jeszcze zapisanej wiedzy.
- **Skille wywoływane tylko przez autopilota przestają być widoczne dla modelu** w Twojej sesji, co odciąża każdą turę. Najpierw sprawdzamy, że
  autopilot nadal potrafi je uruchomić.
- **Reguły, które da się zastosować przy pisaniu, idą do buildera** jako jedno zdanie „co zrobić zamiast”. Reguły, które wymagają przejścia wszystkich
  ścieżek, idą do recenzenta jako lista kontrolna. Reguły mechaniczne idą do lintu.

## 5a. Wszystko, co wcześniej ustaliliśmy — gdzie jest w planie

**Problem.** Pierwsza wersja tej notatki skupiła się na decyzjach z panelu i na teście. Wiele rzeczy, które ustaliliśmy wcześniej, nie miało w planie
swojego miejsca. Sprawdziłem to skryptem: z 65 ustaleń miejsce miało 31.
**Co zrobiłem.** Dopisałem brakujące, każde z przypisaniem do kroku planu. Skrypt sprawdza teraz 65 z 65 (`skrypty/panel_wynik_pokrycie.py`).
Najważniejsze, prostym językiem:

- **Plik z tym, czego się nauczyliśmy (learned-patterns) — krok 8.** Przestaje być ładowany w całości do każdego agenta. Na stałe zostaje jedna linia
  w CLAUDE.md, która wskazuje spis. Spis tworzy się sam z opisów rozwiązanych problemów (nikt go nie edytuje ręcznie). Pełna wiedza leży
  w `docs/solutions/` bez limitu. Builder i recenzent dostają tylko wpisy pasujące do plików, które zmieniają. Limit rozmiaru dotyczy spisu, nie wiedzy,
  więc projekt rozwijany latami nic nie traci. Wchodzi też osiem zabezpieczeń, które przyjąłeś, i jednorazowe przeniesienie obecnych wpisów skryptem
  z listą odrzutów do Twojego przejrzenia. Uwaga: to też spora oszczędność, więc jeśli po kroku 3 wyjdzie większa niż z kroku 7, zamienię je miejscami.
- **CLAUDE.md — krok 3.** Żaden skill już do niego nie dopisuje. Aktualizuje go jeden krok w dev-pr, dopiero po potwierdzonym merge'u, z kontrolą
  rozmiaru. Decyzje z faz trafiają do `docs/decisions/`, a autopilot przed startem sprawdza, czy ostatni merge ma tam wpis.
- **Połączenie dev-plan i dev-docs** — po kroku 3. Jeden skill, plik zadań generowany skryptem z planu, budżet rozmiaru pliku w każdej jednostce
  z pełnymi wymiarami (nie tylko liczbą linii), ten sam próg w lincie i w bocie.
- **dev-pr — krok 2.** Cztery zmiany, które uzgodniliśmy: zbieranie uwag w każdej turze, pilnowanie uzasadnień odrzuceń, jasna rekomendacja
  „merguj / nie merguj / kolejna tura” na górze raportu, raport per tura. Do tego sufit trzech tur i nowa konfiguracja bota.
- **Higiena konta — osobno, równolegle z krokiem 1, przed punktem odniesienia.** Wtyczki i serwery MCP per projekt, przegląd zainstalowanych
  wtyczek, 120 dni historii sesji, poprawki w ustawieniach. W raporcie końcowym opiszę też, jak radzić sobie z dużą liczbą MCP i skilli.
- **Twoje reguły kodu (coding-rules) — krok 8, za Twoją decyzją przy wdrożeniu.** Przepisanie według tabeli z researchu oraz wyjątek, który
  zatwierdziłeś (wolno usunąć tylko zielony test „na niby”), wchodzi w kroku 4.
- **Doctor i wymagania w README, usunięcia skilli, porządki w recenzentach, stare pliki dwóch recenzentów** — krok 3; treść tych plików wykorzystam
  w listach kontrolnych w kroku 7.
- **Poza planem:** szablon jako wtyczka (nie teraz), szablon mobilny (Twoja osobna decyzja), sprawdzanie starych funkcji w przeglądarce w każdej fazie
  (odłożone z warunkiem powrotu).
- **Na sam koniec analizy:** dwa raporty etapu 5 (techniczny i dla Ciebie), złożone z tego dokumentu i wcześniejszych ustaleń.

## 6. Plan wdrożenia krok po kroku

Każdy krok ma swoją miarę z mapy walidacji i zaplanowany odczyt. Zmiany ustawień i kosztu mogą iść równolegle. Zmiany jakości czytamy na uwagach bota
z pięciu PR-ów, a dwie zmiany dotykające wszystkich recenzentów nigdy nie dzielą tego samego okna, żeby było wiadomo, która zadziałała.

1. **Pomiar.** Telemetria bez agentów i import danych historycznych, zapis wysiłku myślenia każdego agenta, klasyfikacja uwag bota, dłuższe
   przechowywanie historii sesji (120 dni). Bez tego żaden następny krok nie ma odczytu.
2. **Nowa konfiguracja bota i punkt odniesienia.** Osiem zmian w konfiguracji CodeRabbita, sprawdzenie klasyfikatora na starych PR-ach i dwa–trzy
   zadania bez żadnych zmian w pipelinie. W tym samym czasie, poza pipeline'em: zadanie sprzątające w oferty-online (stare błędy lintu), bez którego
   krok 4 nie ruszy.
3. **Nowa kontrola poprawek.** Najpewniejszy zysk z testu. W tym samym oknie, jako zmiany ustawień: lista narzędzi dla każdego agenta (największa
   oszczędność całego pipeline'u), przypięty wysiłek myślenia, porządki w szablonie, materiał dla recenzentów ze skryptu, test w przeglądarce
   przełączany na ręczny zamiast zatrzymywać run.
4. **Automatyczne kontrole lint i knip** jako wejście recenzji, razem z granicami warstw; **równolegle lista mutantów dla recenzenta testów** na średnim
   wysiłku. Te dwie zmiany dotyczą różnych recenzentów, więc mogą iść razem.
5. **Sprawdzający bez uzasadnienia autora i w paczkach po cztery.**
6. **Poprawki tylko dla błędów poważnych (P1, P2).** Drobne idą do bota i listy znanych problemów. Poprawki to dziś prawie 15% kosztu zadania.
7. **Listy kontrolne dla recenzenta poprawności i specyfikacji.** Obie zmiany dotyczą różnych recenzentów, więc idą razem.
8. **Wiedza z poprzednich zadań podawana builderowi** tylko dla plików, które zmienia, razem z budżetem rozmiaru plików w planie.
9. **Uporządkowane, krótsze instrukcje stałe każdej roli.** Na końcu, bo to najbardziej ryzykowna zmiana i musi przejść ślepy test.

Obok, w dowolnym momencie po kroku 3 i po jednym: scalony skill planu, ogrodnik, compound ze szczeblami, skill sprawdzania aplikacji z mapą funkcji,
wycofanie hooka o obsłudze błędów po wejściu lintu, niższy wysiłek dla ról pomocniczych.

## 7. Czego to nie mówi

- Pokrętła to różnice między A a dziś, a A zmieniał naraz kilka rzeczy. Liczby są więc górną granicą. Prawdziwy efekt pokaże dopiero pomiar po wdrożeniu,
  i dlatego każdy krok ma warunek cofnięcia.
- Test to 13 faz jednego projektu, każda raz. Przy bezpieczeństwie i rzadkich błędach przypadków jest za mało na wniosek.
- Czas planu zakłada tempo z września.

## Gdzie jesteśmy, co dalej, czego od Ciebie chcę

**Gdzie jesteśmy.** Analiza pipeline'u jest skończona: jest test, są decyzje dla wszystkich otwartych punktów i jest plan wdrożenia w dziewięciu krokach.
**Co dalej.** Po Twojej akceptacji wpisuję decyzje do HANDOFF, aktualizuję pamięć projektu i robię commit. Następna sesja zaczyna krok 1, czyli
telemetrię. To pierwsza zmiana w `.claude/`, więc zrobimy ją w osobnej sesji, z planem do akceptacji przed pierwszą edycją.
**Czego od Ciebie chcę.**
1. **Akceptacji albo poprawek** do decyzji i planu.
2. **Potwierdzenia, że cofamy trzy stare uproszczenia** z punktu 3: wydajność zostaje, jakość kodu zostaje na pełnym wysiłku, bezpieczeństwa nie
   skracamy bez ślepego testu. Rekomenduję: tak.
3. **Zgody na to, żeby lista narzędzi dla agentów weszła w kroku 3 równolegle z nową kontrolą poprawek.** Mapa walidacji zalicza zmianę kontekstu
   recenzentów do zmian dotykających wszystkich recenzentów, które powinny mieć osobne okno. U recenzentów zmienia się jednak tylko zestaw narzędzi,
   z których i tak nie korzystają, a ich instrukcje zostają. Dlatego traktuję to jako zmianę ustawień. Rekomenduję: tak. Inaczej największa
   oszczędność czeka o jedno okno dłużej.
