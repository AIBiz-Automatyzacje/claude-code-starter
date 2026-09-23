# Przegląd audytu skilli (D6) — notatka dla Ciebie

**Data:** 23 września 2026. **Status:** propozycja, czeka na Twoją akceptację. Nic w pakiecie panelu jeszcze się nie zmieniło.
Wersja techniczna z pełnymi dowodami to sekcja D6 w pliku z propozycją poprawek domknięć.

## O co chodziło

Tydzień temu zrobiliśmy audyt: których skilli szablonu naprawdę używasz. Wyszło pięć koszyków. Rdzeń pipeline'u. Wytyczne, które same trafiają
do agentów. Skille używane rzadko, ale celowo. Pięciu kandydatów do usunięcia. Kilka spraw do decyzji, w tym tryb ręczny execute i review.

Dziś sprawdziłem ten audyt od nowa, tak jak wcześniej D1, D2, D3 i D5. Nie oceniałem Twoich decyzji. Sprawdzałem liczby, metody i wnioski,
na których audyt stoi.

## Co się trzyma

Większość audytu jest w porządku.

- **Liczby kosztu dają się odtworzyć co do jednostki.** Znalazłem tylko trzy epizody policzone podwójnie. Wznowiona sesja kopiuje historię
  do nowego pliku i skrypt liczył ją drugi raz.
- **Koszyk wytycznych jest policzony dobrze.** Wytyczne Supabase, security i Sentry trafiły do 148 agentów, wytyczne UI do 53,
  agent-browser do 59 testerów.
- **Rdzeń jest rdzeniem.** Po przeliczeniu jego liczby tylko rosną.
- **Pięciu kandydatów do usunięcia zostaje na liście:** code-review, code-quality, gemini, docs-update i bugfix. Nic w pipelinie ich nie
  wywołuje. Zmienia się tylko uzasadnienie (punkt 2).

## 1. Koszt skilli przed autopilotem był liczony tylko w części

To jedyna poprawka, która zmienia wniosek.

**Gdzie był problem.** Audyt i wcześniejszy model kosztu mówiły, że prep, plan i docs to 2–5% kosztu zadania. Dev-plan miał kosztować
930 tysięcy jednostek na uruchomienie, dev-docs 707 tysięcy. Od tych liczb mapa walidacji miała mierzyć, czy scalony skill plan+docs jest tańszy.

**Co go powodowało.** Skrypt uznawał, że skill kończy się na pierwszej wiadomości, która wpadnie do sesji. W dev-planie taką wiadomością
bardzo często jest powrót subagenta, który robił research. Tymczasem plan pisze się dopiero po tym powrocie. W dev-prepie pierwszą wiadomością
jest Twoja odpowiedź, a całe przechodzenie z Tobą przez decyzje dzieje się już po niej. Subagentów skrypt nie liczył w ogóle. Dev-docs zwykle kończy
sesję, więc on jeden był liczony poprawnie.

**Ile to zmienia.** Liczyłem skill aż do chwili, gdy uruchamiasz następny, razem z subagentami, których powołał. Na tych samych 51 uruchomieniach:

- prep, plan i docs razem kosztowały około 96 milionów jednostek, a nie 39 — prawie dwa i pół raza więcej;
- typowy dev-plan kosztuje 2,4 miliona, a nie 0,8;
- sam research subagentów w dev-planie kosztował tyle, ile cały dev-plan w starym liczeniu;
- typowy dev-prep kosztuje 1,4 miliona, a nie 0,4;
- dev-docs zostaje prawie bez zmian (około pół miliona).

W koszcie całego zadania te skille to w typowym zadaniu około 4–7%, a nie 2–5%. W małych zadaniach dochodzą do jednej piątej.

**Czy to na pewno praca nad skillem, a nie luźna rozmowa?** Przeczytałem sześć losowych przypadków. Po drodze była tylko praca przygotowawcza:
checklista operatora, odświeżenie makiety, pytanie „zanim odpalę dev-docs, czy mam coś jeszcze zrobić”. Nie było wątków pobocznych. Mimo to
traktuję nową liczbę jako górną granicę: w 4 z 52 przypadków sesja została otwarta na noc.

**Co z tym robimy.**

- **Decyzja o scaleniu plan+docs zostaje bez zmian.** Wniosek też: scalenie oszczędza przede wszystkim Twój czas, nie tokeny autopilota.
- **W mapie walidacji zmieniam punkt odniesienia.** Stary był za niski mniej więcej trzy razy. Porównanie z nim pokazałoby, że scalony skill
  jest droższy, choć wcale by nie był.
- **Zmieniam sposób mierzenia Twojego czasu.** Minuty to zła miara, bo kilka sesji zostawionych na noc robi ze średniej 47–101 minut, choć typowe
  uruchomienie trwa 6–17 minut. Lepiej pokazuje to liczba Twoich wiadomości: w typowym dev-prepie piszesz trzy, w dev-planie jedną, w dev-docs żadnej.
- **Telemetria, którą projektowaliśmy w D5, dostaje poprawną granicę skilla** i liczy jego subagentów. Inaczej powtarzałaby ten sam błąd.

**Co Ci to da.** Panel, który projektuje scalony skill, zobaczy, gdzie jest koszt: w subagentach researchu dev-planu. Kopiowanie planu do zadań
w dev-docs to drobiazg. Panel będzie więc ciął tam, gdzie jest najwięcej do zyskania. Agenci researchu nie mają dziś allowlisty
narzędzi, więc ustalony już wymóg allowlisty dla wszystkich agentów obejmuje także ich.

## 2. Kandydaci do usunięcia nie są nieużywani — zostali porzuceni

**Gdzie był problem.** Audyt mówił o nich „zero użyć, zero śladów”. O trybie ręcznym execute i review mówił „zero wywołań, wszystko idzie
autopilotem”. Całe okno obserwacji opisał jako siedem tygodni.

**Co go powodowało.** Audyt patrzył tylko w zapisy rozmów, a te są kasowane. W projekcie, w którym pracujesz najwięcej, sięgają tylko około
30 dni wstecz. Siedem tygodni zostaje wyłącznie w projektach, których dawno nie otwierałeś.

**Co znalazłem.** Jest drugie źródło: historia poleceń wpisanych w terminalu, sięgająca października 2025. Widać w niej, że:

- code-review był używany w styczniu (15 razy w jednym tygodniu);
- gemini — od grudnia do marca (17 razy), zostawił nawet raporty w dwóch starych projektach;
- docs-update — od grudnia do lutego (6 razy);
- code-quality — raz, w lipcu;
- bugfix — raz w kwietniu i raz we wrześniu;
- tryb ręczny execute i review to prawie 600 wywołań do czerwca, a od czasu, gdy wszedł autopilot, zero.

**Co z tym robimy.** Lista kandydatów zostaje, zmienia się opis. To nie jest martwy kod, tylko narzędzia, z których wyrosłeś wraz z pipelinem.
Panel dostaje przy trybie ręcznym uczciwy fakt: był głównym trybem przez pół roku, a 3,5 miesiąca temu zastąpił go autopilot.

**Co Ci to da.** Decydujesz o usunięciu, wiedząc, co usuwasz. Nikt później nie powie, że „ten skill był przecież używany”.

## 3. Kilka liczb było zaniżonych albo źle nazwanych

- **Workflowy wołane przez autopilota.** Audyt liczył je tylko z nowszych zapisów. Po każdym runie harness zapisuje jednak plik z podsumowaniem,
  także dla starszych runów. Z tego pliku execute ma 81 wywołań, a nie 15, a review 84, a nie 18.
- **„W każdym runie” było za mocne.** Compound-refresh i complete działają tylko w runach, które doszły do końca. To 20 z 55, czyli dokładnie
  te zakończone sukcesem.
- **75 uruchomień dev-pr to nie 75 użyć.** To 8 pull requestów, każdy rozbity na kilka etapów: start, zbieranie uwag, naprawy, merge, compound.

## Drobiazgi

- **Gemini nie ma na liście skilli**, bo jest ustawiony tak, że wywołuje się go wyłącznie komendą. To nie znaczy, że jest zepsuty.
- **Usunięcie kandydatów „nic nie kosztuje w runach” — prawie.** Zajmują drobny kawałek listy skilli każdego agenta, około 0,14% jego kontekstu
  na starcie. Po wprowadzeniu allowlisty narzędzi to spadnie do zera.
- **Lista skilli na Twoim koncie jest tak długa, że część opisów jest obcinana.** 14 skilli szablonu model widzi bez opisu, więc sam po nie
  nie sięgnie. Da się je uruchomić tylko komendą. To temat na etap porządków na koncie.
- **Usunięcie wymaga też drobnych poprawek poza samymi skillami:** README wymienia wszystkich pięciu kandydatów, jeden agent wspomina bugfix.
- **Szablon mobilny to osobna linia.** Ma własne, już zmienione kopie tych skilli. Usunięcie w szablonie webowym go nie dotyka, więc decyzja
  o mobile jest osobna.
- **Zroastuj-mnie i brainstorm nie są „rzadkie”.** W terminalu użyłeś ich 84 i 20 razy. Proponuję nazywać je „celowe, poza pipelinem”.

## Co od Ciebie potrzebuję

Akceptacji D6 w całości albo wskazania, co zmienić. Po akceptacji:

- wprowadzam poprawki we wszystkie miejsca, gdzie te liczby występują: pakiet dla panelu, obie wersje mapy walidacji, projekt telemetrii,
  model kosztu i Twoją wersję pakietu;
- sprawdzam każde miejsce w obie strony;
- robię commit;
- przechodzę do ostatniego domknięcia, D4.

Sama decyzja o usunięciu pięciu kandydatów i o trybie ręcznym nadal należy do Ciebie. Ten przegląd tylko porządkuje fakty, na których ją podejmiesz.

## Jak to było sprawdzane

Wszystko policzył jeden skrypt, bez agentów, z czterech źródeł: zapisów rozmów, plików podsumowań runów, historii poleceń z terminala oraz repozytoriów
szablonu webowego i mobilnego. Najpierw odtworzył stary wynik co do jednostki. Dopiero potem liczył nowy. Metodę sprawdziłem czytaniem losowej próbki
sześciu przypadków. Każda liczba z tej notatki pochodzi z wyniku skryptu albo z prostego działania na nim.
