# Przegląd pakietu dla panelu (D4) — notatka dla Ciebie

**Data:** 23 września 2026. **Status:** przyjęte przez Ciebie w całości 23 września i wprowadzone do pakietu, Twojej wersji, obu map walidacji,
projektu telemetrii, etapu trzeciego i modelu kosztu.
Wersja techniczna z pełnymi dowodami to sekcja D4 w pliku z propozycją poprawek domknięć.

## O co chodziło

D4 to pakiet wejściowy panelu: jeden plik, który zbiera wszystkie Twoje decyzje i ustalenia z pięciu etapów, żeby trzej projektanci pracowali
na tych samych założeniach. Przez ostatnie dni poprawialiśmy liczby w D1, D2, D3, D5 i D6, a każda poprawka trafiała też do pakietu.
Dziś sprawdziłem pakiet w całości po tych zmianach. Przeliczyłem też od nowa liczbę, którą przegląd D5 zostawił na koniec: ile kosztu fazy
zdejmuje odchudzenie kontekstu startowego agentów.

## Co się trzyma

- **Pakiet niczego nie zgubił.** Ten sam skrypt co 21 września przeszedł po źródłach i poszukał każdej decyzji w pakiecie. Po wszystkich poprawkach
  jest lepiej niż wtedy, a nie gorzej. Dwie rzeczy wypadły poniżej progu, ale obie są w pakiecie, tylko zapisane innymi słowami.
- **Poprawki z przeglądów są w pakiecie.** Skrypt sprawdził w ten sam sposób propozycje poprawek D1–D6 i poprawki projektu telemetrii.
  Brakuje jednej drobnej rzeczy: rekomendacji, żeby wydłużyć czas przechowywania zapisów rozmów (punkt 4).
- **Twoje decyzje stoją bez zmian.** Żadne z ośmiu założeń z warunkiem odwrotu się nie przewraca. Z tez, które stoją na jednym dowodzie, zmienia się
  jedna liczba, i to w dobrą stronę.
- **Kolejność priorytetów stoi.** Najpierw kontekst agentów, potem skład review.

## 1. Odchudzenie kontekstu daje więcej, niż zakładaliśmy

To główna poprawka tego przeglądu.

**Gdzie był problem.** Od etapu trzeciego pakiet mówi, że odchudzenie kontekstu startowego zdejmie 25–35% kosztu fazy. Przegląd D5 znalazł dwa powody,
żeby tę liczbę sprawdzić. Model kosztu zaniżał tokeny wyjściowe, a sama liczba pochodziła z okresu, gdy CLAUDE.md był kilka razy większy niż dziś.

**Co go powodowało.** Liczba nigdy nie była policzona na prawdziwych agentach. Etap trzeci wziął pustego agenta z terminala (62 tysiące tokenów
na start), odjął to, co zostaje po zmianach, i przeskalował wcześniejsze „30–40%”, które też nie miało rachunku. Przy okazji zaniżył wszystko,
co pisane po polsku. Polski tekst kosztuje około dwóch znaków na token, a nie trzech i pół, więc CLAUDE.md i reguły ważyły prawie dwa razy więcej,
niż zakładał.

**Co zrobiłem.** Policzyłem to wprost, agent po agencie, na zapisach z oferty-online. Dla każdego agenta sprawdziłem, co dostał na start: opisy
narzędzi, listę serwerów MCP, listę skilli, CLAUDE.md, learned-patterns, reguły i prompt. Potem policzyłem, ile z tego znika po Twoich decyzjach.
Znikają narzędzia spoza allowlisty u wszystkich, CLAUDE.md u maszynerii pomocniczej i learned-patterns z ładowania bezwarunkowego. Każdy zdjęty token liczę
tyle razy, ile razy agent go potem czyta, czyli w każdej turze. Przeliczenie znaków na tokeny skalibrowałem na naszym pomiarze z 20 września.
Model trafia prawdziwy start agenta z dokładnością do około procenta.

**Wynik.**

- W runie z 20 września, pierwszym po ścięciu CLAUDE.md, zmiany zdjęłyby 51% kosztu. W każdej z trzech faz wychodzi 48–53%.
- W runach sprzed ścięcia wychodzi 37%, a na starym modelu kosztu 41%. Poprawka tokenów wyjściowych obniża więc wynik o kilka punktów,
  a ścięcie CLAUDE.md podnosi go o trzy.
- Sama allowlista narzędzi to 27–38% kosztu fazy. Na jednym agencie opusa zdejmuje 54–77 tysięcy tokenów startu.
- Uczciwy przedział na dziś: 40–50% kosztu fazy. Dolna granica przy zadaniach, w których agenci długo pracują, górna przy krótkich.
  Mini-run to potwierdzi.

**Dlaczego start jest tak ciężki.** Autopilot rusza z aplikacji desktop, a tam każdy agent dostaje opisy wszystkich narzędzi sesji. Sam opis narzędzia
do publikowania stron to 49 tysięcy znaków. Do tego lista prawie tysiąca nazw narzędzi MCP i trzystu skilli. Ile tego jest, zależy od serwerów
podłączonych w sesji: w runie z 20 września lista MCP była dwa razy dłuższa niż tydzień wcześniej. Allowlista odcina to wszystko naraz.

**Co z tym robimy.** Poprawiam liczbę we wszystkich miejscach, gdzie stoi „25–35%”. Twoje decyzje się nie zmieniają.

**Co Ci to da.** Allowlista narzędzi daje jeszcze więcej, niż myśleliśmy, przy bardzo małej zmianie. To mocny kandydat na pierwszą zmianę
po telemetrii; o kolejności zdecydujemy przy planie wdrożenia.

## 2. Oszczędności nie sumują się

**Gdzie był problem.** Pakiet mówi: kontekst daje najwięcej, potem skład review i mechanika, 8–10%. Batch sceptyków miał dać 2%.
Każda z tych liczb jest policzona na dzisiejszym koszcie jednego agenta.

**Co go powodowało.** Po allowliście każdy agent kosztuje dużo mniej. Agent pomocniczy zachowuje około jednej trzeciej dzisiejszego kosztu,
sceptyk około połowy. Wszystko, co liczyliśmy jako „oszczędność na powołaniu agenta”, kurczy się najbardziej. Przykład: usunięcie agenta,
który zapisuje stan fazy, miało dać 9,6 miliona jednostek, a po allowliście da około miliona. Batch sceptyków da około 0,4% zamiast 2%.

**Co z tym robimy.** Panel dostaje zasadę: oszczędność z mniejszej liczby agentów liczy się na kosztach po zmianie kontekstu. Skład review
i mechanika to wtedy raczej 3–7% niż 8–10%.

**Co Ci to da.** Projekt nastawiony na minimalny koszt nie obieca zysku, który po pierwszej zmianie wyparuje. Twoja ocena projektów będzie oparta
na liczbach, które się potem sprawdzą.

## 3. Cele w mapie walidacji były za niskie

**Gdzie był problem.** Mapa walidacji mówi, że po allowliście agent pomocniczy ma startować z 4,5 tysiąca tokenów, reviewer z 15, builder z 25.

**Co go powodowało.** 4,5 tysiąca to pusty agent bez żadnego zadania. Pozostałe dwie liczby pochodzą z tego samego zaniżonego rachunku co 25–35%
i też nie liczą promptu zadania.

**Co z tym robimy.** Nowe cele liczę na runie z 20 września, razem z promptem. Pomocniczy około 9–10 tysięcy, reviewer około 29, builder około 38.
To nadal spadek o 70–90% wobec dzisiejszych 89–135 tysięcy. Pierwszym sprawdzeniem zostaje prosta liczba: ile narzędzi dostał agent.
Dziś 972, po allowliście kilka.

**Co Ci to da.** Bez tej poprawki za miesiąc zobaczyłbyś w raporcie, że allowlista „nie działa”, bo reviewer ma 29 tysięcy zamiast 15. Do tego
alarm anomalii odpalałby się w każdym runie.

## 4. Drobiazgi

- **Haiku i opus liczą tokeny inaczej.** Ten sam tekst to u haiku około trzech czwartych tokenów opusa, i to stale. Stąd różnica startu między
  modelami, którą widzieliśmy w D3. Przeniesienie roboty pomocniczej na haiku oszczędza więc nie tylko na cenie.
- **Sam learned-patterns waży dziś ponad dwa razy więcej niż ścięty CLAUDE.md**, około 23 tysięcy tokenów na każdego agenta opusa.
  To mocny argument za Twoją decyzją, żeby wyszedł z ładowania bezwarunkowego.
- **Twoja wersja pakietu ma kilka nieaktualnych zdań.**
  - Część o telemetrii mówi o siedmiu tygodniach przechowywania zapisów, a przegląd D6 ustalił około 30 dni.
  - W części o wymogach nagłówek mówi „jedenaście”, a wymogów jest trzynaście.
  - Opis sprawdzania pakietu mówi, że ręcznie przejrzałem 118 miejsc. Ręcznie przejrzałem 58, a kolejne 60 wyrywkowo. Odtworzyłem to skryptem.
- **Mapa dla Ciebie** podaje jeszcze stary koszt całości (1 179 milionów zamiast 1 293) i starą dźwignię.
- **Jedna luka.** W pakiecie brakuje rekomendacji, żeby wydłużyć czas przechowywania zapisów rozmów, na przykład do 120 dni. Dopisuję ją do etapu
  porządków na koncie. To Twoja decyzja.
- **Wzór jednej metryki w mapie walidacji był niespójny z punktem odniesienia.** Mierzył co innego, niż mówiła liczba obok. Zamieniam go na ten,
  którym liczyłem dźwignię.

## Co od Ciebie potrzebuję

Akceptacji D4 w całości albo wskazania, co zmienić. Po akceptacji:

- wprowadzam poprawki we wszystkie miejsca: pakiet dla panelu, Twoja wersja pakietu, obie wersje mapy walidacji, projekt telemetrii, etap trzeci
  i model kosztu;
- sprawdzam każde miejsce w obie strony;
- aktualizuję instrukcję startową następnej sesji i robię commit.

To było ostatnie domknięcie. Potem zostają Twoje decyzje z D6: pięciu kandydatów do usunięcia, ideate i freshness-audit oraz tryb ręczny.
Mini-run ruszy dopiero na Twój znak.

## Jak to było sprawdzane

Wszystko policzyły dwa skrypty, bez agentów. Pierwszy przeliczył dźwignię na 579 agentach z dwóch okresów: przed ścięciem CLAUDE.md i po nim.
Przeliczenie znaków na tokeny sprawdziłem na dwa sposoby. Model przewiduje start agenta z dokładnością do około procenta. Stawkę dla polskiego
tekstu policzyłem też drugi raz, wyłącznie z danych oferty-online, i wyszła prawie ta sama (różnica 4%). Drugi skrypt sprawdził, czy wszystko ze źródeł jest w pakiecie, i odtworzył
kontrolę z 21 września na ówczesnych wersjach plików. W drugą stronę przeczytałem pakiet obok źródeł, a każdą liczbę zmienioną w przeglądach
wyszukałem w pakiecie, Twojej wersji, obu mapach walidacji, projekcie telemetrii i etapie trzecim.
Każda liczba w tej notatce pochodzi z wyniku skryptu albo z prostego działania na nim.
