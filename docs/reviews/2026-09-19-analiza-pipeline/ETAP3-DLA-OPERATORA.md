# Etap 3 — czy panel może startować (wersja dla Kacpra)

Data: 2026-09-20. To jest ludzka wersja dokumentu `ETAP3-ROZSTRZYGNIECIE.md`. Tamten ma wszystkie dowody, ścieżki i liczby. Ten ma odpowiedzieć na jedno pytanie.

## O co chodziło w tym etapie

Mamy za sobą model kosztu, ocenę każdego reviewera, analizę uwag bota, research zewnętrzny i cztery pomiary. Na tym wszystkim ma stanąć panel,
który zaprojektuje pipeline „po". Zanim panel ruszy, jeden agent dostał zadanie: znaleźć dziury. Czego nie sprawdziliśmy, gdzie wniosek stoi na jednym
pomiarze, gdzie dwa dokumenty mówią co innego, którego elementu nikt nie dotknął. Nie miał nic proponować i nie miał podważać Twoich decyzji.

## Odpowiedź

**Panel może startować, ale nie dziś i nie od razu.** Krytyk znalazł dziewiętnaście luk i cztery z nich uznał za blokujące. Sprawdziłem każdą z tych
czterech. Jedną zamknąłem od ręki przeliczeniem. Dwie zamykają się w około dwie godziny pracy skryptami, bez agentów. Jedna wymaga jednego zdania od Ciebie.
Pozostałe piętnaście to ryzyka, które panel może dostać jako jawne założenia i które trafią do raportu końcowego.

Nic z tego, co znalazł krytyk, nie unieważnia żadnej Twojej decyzji. Zmienia się jedna liczba i dochodzi kilka rzeczy, o których panel musi wiedzieć.

## Cztery rzeczy, które krytyk uznał za blokujące

### 1. Oszczędność na kontekście agentów była policzona dla wariantu, którego nie wybrałeś

**Gdzie był problem.** Pomiary mówiły: największa oszczędność to odchudzenie startu każdego agenta, trzydzieści do czterdziestu procent kosztu fazy.
Ta liczba zakładała, że każdy agent startuje z minimalnym kontekstem, bez CLAUDE.md i bez skilli.

**Co go powoduje.** Po pomiarach zdecydowałeś inaczej: buildery i reviewerzy mają dostawać CLAUDE.md, buildery zachowują swoje skille, dochodzi wycinek
wiedzy z learned-patterns. To słuszne, ale nikt nie przeliczył, ile z tej oszczędności zostaje po Twojej decyzji.

**Co z tym robimy.** Przeliczyłem to na liczbach z pomiarów. Zostaje mniej więcej dwadzieścia pięć do trzydziestu pięciu procent zamiast trzydziestu do
czterdziestu. Kolejność priorytetów się nie zmienia, bo następna zweryfikowana oszczędność to osiem do dziesięciu procent. Do tego jeden fakt, o którym
panel musi wiedzieć: odchudzony start wymaga osobnego pliku definicji dla każdej roli agenta, a dziś taki plik ma dziewięć ról z około trzydziestu.
Reszta to praca do zrobienia, nie problem z pomiarem.

**Co Ci to da.** Panel projektuje pod prawdziwą liczbę, a raport nie obieca więcej, niż da się dowieźć.

### 2. Główny lek na ucieczki do bota nie ma żadnego pomiaru

**Gdzie był problem.** Bot znajduje po naszym review około dwustu prawdziwych defektów. Naszą odpowiedzią są polecenia-listy w promptach reviewerów,
z szacunkiem, że domkną sześćdziesiąt do siedemdziesięciu procent tych ucieczek. Ten szacunek pochodzi z ocen agentów, nie z żadnego runu.

**Co go powoduje.** Research pokazał, że modele po cichu pomijają instrukcje, gdy jest ich dużo. To samo badanie uzasadnia polecenia-listy i jednocześnie
tłumaczy, dlaczego mogą nie zadziałać. Nikt nie policzył, ile instrukcji dostaje dziś jeden reviewer, licząc prompt, wspólne bloki, CLAUDE.md, reguły
kodowania i skille. To może być kilkadziesiąt, może być kilkaset.

**Co z tym robimy.** Skuteczności poleceń-list nie da się zmierzyć przed ich wdrożeniem, więc panel nie może na to czekać. Dostanie je jako założenie
z warunkiem odwrotu: jeśli po pięciu zadaniach bot dalej znajduje defekty danej klasy, wracamy do poprzedniego mechanizmu. Liczbę instrukcji na agenta
policzę skryptem przed panelem, żeby każdy projekt miał twardy budżet, ile poleceń wolno dać jednemu agentowi.

**Co Ci to da.** Pipeline „po" nie będzie tańszy i gorszy jednocześnie, bo każda oszczędność na review ma wpisany bezpiecznik.

### 3. Nie wiemy, skąd biorą się nowe findingi po naprawie

**Gdzie był problem.** Gdy review powtarza się po naprawie, znajduje kilkanaście nowych rzeczy. Pomiar uznał, że to review kodu naprawczego, bo
prawie wszystkie nowe findingi leżą w plikach, które naprawa zmieniła.

**Co go powoduje.** Naprawa zmieniła dwadzieścia trzy pliki. Finding w takim pliku może być defektem, który naprawa wprowadziła, albo defektem, który
tam był od początku i pierwszy review go nie zauważył. To dwa różne problemy z dwoma różnymi rozwiązaniami, a pomiar ich nie rozróżnił. W dwóch innych
powtórkach połowa nowych findingów była w plikach nietkniętych, więc składnik „przeoczone" na pewno istnieje.

**Co z tym robimy.** To jedyna luka, którą podtrzymuję jako blokującą, bo fakt jest tani. Trzydzieści trzy findingi do przeczytania i przypisania:
wprowadzone naprawą, istniały wcześniej, kod nietknięty. Około godziny pracy w sesji głównej, bez agentów.

**Co Ci to da.** Panel dostanie prawdziwą odpowiedź na pytanie, czy pierwszy review za mało znajduje, czy naprawy psują. Od tego zależy,
czy warto płacić za równoległe próbki review, czy wystarczy mocniejszy sceptyk.

### 4. Dwa dokumenty mówią co innego o osi test-coverage

**Gdzie był problem.** Research z etapu 2 zapisał: trzy narzędzia mechaniczne przejmą klasę słabych testów, a agent zostaje tylko na resztki, do
scalenia z inną osią. Pomiary zapisały: żadnej dodatkowej osi nie da się skasować. Panel dostałby oba zdania naraz.

**Co go powoduje.** Degradacja z researchu była warunkowa: miała sens, jeśli narzędzia przejmą klasę. Jedyne zmierzone narzędzie trafiło zero z
trzydziestu jeden przypadków. Dwa pozostałe nie mają pomiaru. Przesłanka zniknęła, ale zapis został.

**Co z tym robimy.** Moje odczytanie: obowiązują pomiary, bo są późniejsze i były pomyślane jako warunek wejścia. Oś test-coverage zostaje,
narzędzia to dodatki, scalenie z inną osią jest opcją tylko z bezpiecznikiem i dopiero po pomiarze pozostałych narzędzi. To dotyczy osi, która
daje najwięcej findingów, więc **potrzebuję Twojego jednego zdania, że tak ma być.**

**Co Ci to da.** Trzy projekty panelu dostaną jeden mandat zamiast dwóch i sędziowie będą mogli je porównać.

## Co trafia do raportu jako ryzyko

Piętnaście pozostałych luk nie zatrzymuje panelu. Najważniejsze z nich w trzech zdaniach. Nasze liczby o skuteczności sceptyków są trzy różne
i żadna nie jest rozbita na osie, więc mocniejszy sceptyk będzie stosowany do wszystkich osi jednakowo i może zacząć kasować prawdziwe findingi.
Model kosztu opisuje maszynerię sprzed napraw z września, a oszczędność na kontekście jest liczona na koncie z dziewięcioma setkami narzędzi MCP,
więc dla czystego szablonu będzie mniejsza. Miara sukcesu, czyli liczba uwag bota po wdrożeniu, potrafi spaść o połowę bez żadnej zmiany
w pipeline, wyłącznie dlatego, że zmienia się rodzaj pisanego kodu.

Do tego lista rzeczy, których żaden etap nie dotknął, a które zostaną w szablonie po przeprojektowaniu: dwa martwe pliki agentów, drugi roster review
w skillu code-review, mechanizm audytu aktualności reviewerów, którego nie użyliśmy, hooki nakładające się na nową bramkę, testy workflowów,
które każdy projekt złamie, i generator konfiguracji bota, w którym siedzą progi produkujące najwięcej szumu. Panel dostanie tę listę z poleceniem:
objąć albo jawnie zostawić.

Jedna propozycja ode mnie: sędziowie w panelu powinni oceniać także koszt wdrożenia i utrzymania przez jedną osobę. Bez tego może wygrać projekt,
którego nie da się dowieźć.

## Co teraz

Przed panelem: godzina na klasyfikację trzydziestu trzech findingów, pół godziny na policzenie instrukcji per agent, dwadzieścia minut na mapę
oś do pliku agenta. Zero agentów, wszystko w sesji głównej. I jedno zdanie od Ciebie w sprawie test-coverage oraz zgoda lub nie na czwarty
wymiar oceny dla sędziów.

Potem panel.
