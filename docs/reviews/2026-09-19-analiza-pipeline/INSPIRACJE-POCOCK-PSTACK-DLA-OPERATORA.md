# Co warto wziąć od Matta Pococka i od poteto — wersja dla operatora

**Stan: zdecydowane 24 września.** Wziąłeś punkty 1–5. Przy punkcie 2 Twoje reguły kodowania dostają wyjątek: zielony, bezwartościowy test wolno usunąć, gdy nie da się go przepisać, a usunięcie trafia do raportu. Punkt 5 zapisany jako „prompty według wytycznych Anthropic, zmiany sprawdzane przed i po”. Punkty 6, 8 i 7 (ten ostatni bez wyjątku dla wylogowania) stały się wymogami dla panelu, a przejście regresyjne z punktu 6 odłożyliśmy. Punkt 9 idzie do panelu jako otwarta decyzja. Odrzuciłeś punkty 10–12, zakaz komentarzy, listę „na później” i drabinę jako zasadę dla całego panelu. Stary kod poprawiamy przed uruchomieniem nowego workflow. Niczego jeszcze nie zmieniłem w szablonie — wdrożenie idzie w iteracjach po panelu.

## Skąd to wiem

Repozytorium Matta przejrzałem w obecnym stanie. Od lipcowego przeglądu doszło kilka nowych skilli, m.in. retrospektywa sesji, szablon opisu PR, skrypt prowadzący przez zakładanie kont i poradnik pisania dla agentów.

Wystąpienie poteto przeczytałem w całości z Twojej transkrypcji (38 minut). Autorka to Lauren Tan z zespołu React, wcześniej Cursor, dziś pracuje nad Grokbotem. Obok przeczytałem jej otwarty plugin pstack, który rozpisuje szczegóły. W samym wystąpieniu mówi o 2000 PR w miesiącu, w tytule wpisu jest 2500. Żadna z tych liczb nie jest sprawdzona i nie wiadomo, ile zmian potem cofnięto.

Transkrypcja zmieniła obraz względem pierwszej wersji raportu. Myślałem, że sednem są jej skille. Tymczasem ona mówi wprost, że o pluginie nie będzie dużo opowiadać. Sednem wystąpienia jest to, gdzie trzymać wiedzę, żeby agent nie mógł zrobić źle.

## O czym naprawdę jest wystąpienie

**Zaufanie.** Dopóki nie ufasz agentom, musisz pilnować każdego czatu. Puszczenie wielu agentów bez zaufania daje tylko więcej bylejakich PR i regresji. Porównuje to do kuchni z gwiazdką Michelin: nie gotujesz już każdego składnika, ale odpowiadasz za danie i za to, jak kuchnia jest ustawiona.

**Pierwszy filar: agent sam sprawdza aplikację.** Jej pierwszy skill uczył agenta uruchamiać aplikację, klikać w nią i zbierać pomiary. Ma dwie części. Pierwsza to gotowe narzędzie w katalogu skilla, żeby agenci nie pisali za każdym razem własnych skryptów, co sesję trochę innych. Druga to mapa funkcji: jakie funkcje ma aplikacja, jak użytkownik do nich dochodzi i co robią. Mapę pilnuje automatyzacja, żeby nadążała za aplikacją. Powstała, bo zgłoszenia ze Slacka przychodziły jako niewyraźny zrzut ekranu z trzema pytajnikami, a agent zgadywał, o co chodzi. Dziś nazywa to krytyczną infrastrukturą zespołu.

**Drugi filar, według niej najważniejszy: kod ma być tak ułożony, żeby agent nie mógł zrobić źle.** Agenci kopiują to, co widzą w kodzie, więc kod jest ich najlepszą pamięcią. Z tego wynika drabina, od najmocniejszego szczebla:
1. kod i jego struktura sprawiają, że błąd jest niemożliwy,
2. automatyczna kontrola (lint) go łapie,
3. reguła albo skill mówi agentowi, jak robić — ale agent może jej nie przeczytać,
4. człowiek wyłapuje to w review — a przy takiej liczbie PR to dziura.

Przy każdej poprawce agenta każe pytać, na którym szczeblu da się ją zrobić najwyżej, i zaczynać od góry. To jej slajd końcowy: „jeśli zapamiętacie jedną rzecz, to tę”.

**Złe wzorce rozchodzą się jak wirus.** Jedno obejście albo komentarz tłumaczący obejście — i w kilka dni, najwyżej tygodni, agenci kopiują je wszędzie. Dlatego w swoim frameworku zakazała komentarzy: agenci używali ich jako wymówki, żeby przykleić plaster zamiast naprawić przyczynę. Z tego samego powodu granice w kodzie pilnuje automat, nie opis. Kod, który ma chodzić w tle, fizycznie nie może trafić do części rysującej interfejs.

**Ogrodnik.** Każdy zespół potrzebuje kogoś, kto regularnie wyrywa chwasty, zanim się rozejdą. Usuwa dług, pilnuje jednej utartej ścieżki na każdą rzecz, a na widok złego wzorca najpierw pisze regułę lint („zatrzymać krwawienie”), sprzątanie zostawiając na później.

**Pętla zewnętrzna.** Bot podpięty pod Slacka i Sentry sam uruchamia agentów, którzy odtwarzają zgłoszony błąd i otwierają PR.

**Jak to się ma do nas.** To ta sama teza, do której doszliśmy w analizie. Reguły bywają cicho pomijane, reguła z pliku nie zawsze dociera do agenta, a przy 45 z 68 błędów, które przeszły przez review, reguła istniała. Ona wyciąga z tego dalszy wniosek. Nie pyta, jak lepiej dostarczyć regułę, tylko jak sprawić, żeby reguła była niepotrzebna. Nasz pipeline pracuje dziś głównie na szczeblach 3 i 4: reguły kodowania, wyuczone reguły, reviewerzy, bot.

## Warto wziąć od razu (tanie, niezależne od panelu)

### 1. Compound kieruje lekcję na najwyższy możliwy szczebel

**Problem.** Po każdym zadaniu compound dopisuje lekcję jako zdanie do pliku wyuczonych reguł. W oferty-online ten plik ma już 47–49 tysięcy znaków.

**Przyczyna.** Compound pracuje tylko na szczeblu 3. Nie pyta, czy tę samą lekcję dałoby się zamienić w automatyczną kontrolę albo w zmianę w kodzie, po której błąd byłby niemożliwy.

**Co proponuję.** Przed zapisem compound oznacza szczebel lekcji: kod, lint albo reguła. Kod i lint pokazuje Ci osobno jako propozycje nowych kontroli, tak jak dziś pokazuje propozycje dla reviewerów. Do pliku reguł trafiają tylko lekcje wymagające osądu. To samo mówią Matt i poteto.

**Co to daje.** Powtarzalne błędy przestają zależeć od tego, czy agent doczytał instrukcję, a plik reguł rośnie wolniej. Uczciwie: większość naszych dotychczasowych lekcji jest opisowa (lint trafił 1 na 97 uwag bota), więc pliku to nie wyczyści. Zatrzyma w nim wpisy, które powinny być automatem.

### 2. Jedno pytanie, które demaskuje bezwartościowe testy

**Problem.** Agenci piszą testy, które przechodzą zawsze, także gdy kod jest zepsuty. Najmocniejsze narzędzie na to, testowanie mutacyjne, trwa 5–15 minut na fazę, więc nie może chodzić przy każdym domknięciu.

**Co proponuję.** Sprawdzian z pstack: czy ten test przeszedłby, gdyby każda funkcja, której używa, zwracała pustą wartość? Jeśli tak, niczego nie sprawdza. Pytanie idzie do reviewera testów i do builderów. Najprostsze przypadki, np. brak asercji albo sama asercja „coś istnieje”, złapie lint.

**Co to daje.** Darmową, ręczną wersję testowania mutacyjnego w każdej fazie.

### 3. Nowa kontrola jest gotowa dopiero, gdy raz złapała błąd

**Problem.** W etapie wdrożenia dojdzie kilka automatycznych kontroli naraz, a po punkcie 1 będą dochodzić kolejne. Źle podpięta kontrola przechodzi zawsze. Mieliśmy już taki przypadek w telemetrii, która przez wiele faz zapisywała puste pole.

**Co proponuję.** Zasada Matta: każdą kontrolę odbieramy w trzech krokach. Na czystym kodzie przechodzi, na celowo podłożonym błędzie pada, po cofnięciu błędu znowu przechodzi. Robi to jeden test na kontrolę.

**Co to daje.** Pewność, że kontrole naprawdę coś łapią.

### 4. Cztery zasady pisania promptów

Dopisać do zasad z audytu promptów i do listy kontrolnej następnego audytu:
- Zakaz przyciąga to, czego zakazuje. Lepiej pisać, co agent ma zrobić, a zakaz zostawić tylko tam, gdzie inaczej się nie da, i wtedy w parze z celem. Tryb rozkazujący zostaje.
- Każdy krok kończy się jasnym warunkiem „zrobione”.
- Nie przepisujemy do promptu tego, co agent sam odczyta z projektu — taka kopia się starzeje (jak „plik ma 11 KB” z audytu).
- Spór, czy zdanie coś zmienia, rozstrzyga uruchomienie, nie dyskusja.

### 5. Jak testować zmianę promptu, żeby agent nie wiedział, że jest testowany

To metoda dla nas, nie zmiana w szablonie. Agent dostaje zwykłe zadanie, bez słów „test” czy „ocena”. Sędzia widzi wyniki pod neutralnymi nazwami. To, czy agent trzymał się instrukcji, ocenia się z plików, które naprawdę otworzył, a nie z jego deklaracji. Przyda się przy każdej iteracji zmian promptów.

## Do rozstrzygnięcia w panelu

### 6. Skill do sprawdzania aplikacji z mapą funkcji — pierwszy filar wystąpienia

**Problem.** Środowisko do testów w przeglądarce to najsłabsze ogniwo naszych runów, stąd zatrzymania zamienione na „do ręcznego sprawdzenia”. Tester sprawdza tylko nową funkcję z pliku zadania. Nie widzi, czy faza zepsuła coś, co działało wcześniej, a po zadaniu scenariusze przepadają.

**Przyczyna.** Wiedza o tym, jak uruchomić i prowadzić aplikację, jest rozsiana po kilku plikach. Nie ma listy funkcji aplikacji z opisem, co dowodzi, że każda działa.

**Co proponuję panelowi.** Trzy warianty: (a) jak dziś plus porządne ustawienia środowiska; (b) skill sprawdzania aplikacji z mapą funkcji, z którego korzysta tester; (c) wariant (b) plus sprawdzenie w każdej fazie funkcji, których pliki zmieniła.

**Co to daje.** Sprawdzenie środowiska przed startem dostaje gotowy przepis. Mapa rośnie z każdym zadaniem, więc sprawdzanie regresji jest tanie, a Twoja ręczna lista smoke może brać z niej pozycje. W przyszłości to też warunek automatycznej obsługi zgłoszeń z Sentry — dokładnie po to mapa u niej powstała. Koszt to mapa do utrzymania i dłuższe testy w wariancie (c).

### 7. Granice w kodzie pilnowane automatem

**Problem.** Twoja reguła „komponent nie woła bazy bezpośrednio, zero cyklicznych zależności” jest tekstem, czyli szczeblem 3.

**Co proponuję.** U niej ta sama rzecz jest automatem na grafie importów. Dwa warianty: tańszy, czyli dwie dodatkowe reguły w linterze, który i tak wchodzi, albo pełny, czyli narzędzie dependency-cruiser od Matta. Pełny wariant to nowa zależność w projektach, więc decyzja jest Twoja.

**Co to daje.** Reguła z tekstu staje się błędem, którego nie da się przepuścić.

### 8. Ogrodnik — regularny przegląd tego, co agenci kopiują

**Problem.** Nic u nas nie patrzy na kod projektu między zadaniami. Reviewerzy widzą tylko zmiany jednej fazy, bot tylko PR. Obejście z zadania N trafia do zadania N+1 jako „istniejący wzorzec” i agent je powiela.

**Co proponuję.** Przegląd po zamknięciu zadania albo co kilka zadań, a nie w każdej fazie. Skrypt wyszukuje powtarzające się obejścia, duplikaty, wyciszenia lintu i komentarze tłumaczące obejście. Jeden agent ocenia listę, a Ty dostajesz propozycje: które reguły lint dodać od razu, co posprzątać osobnym zadaniem. Bez zmian w kodzie bez Twojej decyzji. To samo robi Matt skillem, który każe uruchamiać „co kilka dni”.

**Dla panelu.** Czy, jak często i w którym miejscu pipeline'u.

### 9. Kto ma pilnować standardów kodu: builder czy reviewer

Matt mówi, że builder jest najbardziej obciążony, więc standardy powinien egzekwować reviewer. Za tym przemawia to, że builder dostaje ok. 480–490 instrukcji, z czego ponad sto to reguły kodowania, a mini-run pokazał, że cztery razy więcej poleceń nie poprawia wykonania, tylko kosztuje o 72% więcej. Przeciw przemawia to, że każdy błąd złapany dopiero w review to dodatkowa tura poprawek. Poteto dodaje trzecią drogę: najlepiej, żeby tej reguły nie musiał nieść nikt, bo zrobi to kod albo lint. Decyzja dla panelu, z metryką: błędy na fazę i liczba tur poprawek przed zmianą i po niej.

### 10. Jak pewny jest dowód w zgłoszeniu

Pięciostopniowa skala z pstack: „tak twierdzę”, „oto linia kodu”, „przeszedłem ścieżkę błędu”, „uruchomiłem kod, który to pokazuje”, „odtworzyłem w aplikacji”. Pole w każdym zgłoszeniu reviewera i w werdykcie sceptyka, z progiem dla błędów krytycznych. Telemetria dostaje miarę jakości zgłoszeń, nie tylko ich liczbę.

### 11. Lżejszy plan dla małych zadań

Poteto nie planuje („najlepsza specyfikacja to kod”), a Matt przed pierwszym testem uzgadnia, gdzie testy mają powstać. Nie proponuję rezygnacji z planów. Dla scalonego skilla planu proponuję dwie rzeczy: lżejszą ścieżkę dla małych zadań i pole „gdzie testujemy” w każdej jednostce planu.

### 12. Równoległa praca kilku builderów — do odłożenia

Oboje puszczają kilka jednostek naraz. Poteto zastrzega jednak w wystąpieniu, że skalować liczbę agentów można dopiero po zbudowaniu zaufania. U nas to duża przebudowa autopilota i więcej procesów naraz. Proponuję opcję na przyszłość z warunkiem: gdy telemetria pokaże, że czas faz jest wąskim gardłem.

## Obserwować: zakaz komentarzy

Teza jest mocna, ale w naszych danych słaba. Na 574 uwagi bota tylko 5 dotyczy komentarza, który rozmija się z kodem, a tego, czy agenci kopiują komentarze-obejścia, nikt u nas nie mierzył. Proponuję nie zakazywać teraz. Komentarze tłumaczące obejście niech będą jedną z rzeczy, które liczy ogrodnik (punkt 8). Zakaz dopiero wtedy, gdy liczby pokażą, że się rozchodzą.

## Dobre, ale na później

- Katalog uwag bota, które odrzucamy, z poziomem pewności, plus tematy, o które zawsze pytamy Ciebie: bezpieczeństwo, dane, migracje.
- Reguła na czerwone CI: jedno ponowne uruchomienie; identyczna druga porażka to nie przypadek; porażka w kodzie, którego zmiana nie dotyka, to nieaktualna gałąź.
- Sekcja „na co zwrócić uwagę” w raporcie końcowym zadania, z danych, które już zbieramy.
- Opis PR z sekcją ryzyka i oznaczeniem zmian trudnych do cofnięcia, jak migracja.
- Skrypt Matta, który prowadzi Cię krok po kroku przez konta i klucze z dev-prep i sam zapisuje wartości.
- Ankieta dla klienta z decyzjami, których nie rozstrzygniesz sam.

## Czego nie bierzemy

Całego systemu poteto z 23 scenariuszami pracy — nasz przepływ to autopilot, a 7,5 tysiąca linii tekstu to odwrotność odchudzania. Zresztą ona sama stawia skille na trzecim szczeblu. Nie bierzemy też review kilkoma modelami (mamy jednego dostawcę, różnorodność daje bot), osobnego agenta do komentarzy, automatycznego scalania PR (merge zostaje Twoją decyzją), weryfikacji formalnej (sama autorka mówi, że prawie nikt jej nie stosuje) ani pętli zewnętrznej ze Slacka i Sentry — to kierunek na po wdrożeniu, gdy będzie mapa funkcji. Od Matta pomijam skille do issue trackera, nauki, pisania, przekazywania sesji i diagnozowania błędów, bo bugfix wypada decyzją z września.

## Co teraz

Do Twojej decyzji:

1. Które z punktów 1–5 bierzemy od razu (zmiany szablonu poza panelem, wdrażane w iteracjach z metryką).
2. Czy drabinę z wystąpienia wpisuję do pakietu panelu jako zasadę przekrojową, a punkty 6–12 jako otwarte decyzje.
3. Czy zakaz komentarzy zostaje „do obserwacji”.
4. Czy coś z listy „na później” przesunąć wyżej.

Po Twojej akceptacji wpiszę decyzje do HANDOFF i pakietu panelu, poprawię instrukcję panelu, zaktualizuję pamięć projektu i zrobię commit.
