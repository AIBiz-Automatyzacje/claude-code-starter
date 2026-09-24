# Panel decyzyjny — plan w prostych słowach

Wersja techniczna: `PANEL-PLAN.md`. Tu jest to samo bez tabel i ścieżek: co panel ma rozstrzygnąć, jak to zrobi, ile to kosztuje i gdzie się zatrzyma.

## Gdzie jesteśmy

Mamy za sobą pomiary, domknięcia, mini-run, prompt-audit i inspiracje. Większość kształtu nowego pipeline'u jest już przesądzona Twoimi decyzjami: allowlista narzędzi,
pliki agentów per klasa, wiedza doklejana przez orkiestrator, telemetria skryptem, sceptyk asymetryczny, E2E przechodzące w tryb ręczny zamiast zatrzymywać run,
scalony plan, mapa funkcji, granice warstw w lincie, ogrodnik. Panel nie ma tego projektować od nowa. Ma rozstrzygnąć to, co zostało otwarte — i zrobić to na
danych, a nie na opinii trzech agentów tego samego modelu.

## Część 1. Co jest do rozstrzygnięcia

**Problem.** Kandydaci do decyzji są rozsiani po kilku dokumentach, a część z nich po cichu przesądziły już wcześniejsze ustalenia. Gdyby panel dostał listę bez
sprawdzenia, zmarnowałby czas na sprawy zamknięte albo pominąłby coś ważnego.

**Co zrobiłem.** Przeszedłem każdego kandydata z Twoich decyzji i z pakietu wejściowego. Zostało jedenaście otwartych spraw, a dwunastą dopisałem (o niej niżej). Najważniejsza to kształt review, bo
od niej zależy ponad połowa kosztu fazy: sami reviewerzy to około jednej czwartej, do tego sceptycy i pętla poprawek, która rośnie z liczbą zgłoszeń. Pozostałe
to mniejsze pytania: jak grupować sceptyków, czy paczka kontekstu dla reviewerów ma im mówić „zacznij ode mnie”, czy oś zgodności ze specyfikacją ma chodzić
w fazach bez kodu, gdzie uruchamiać testy mutacyjne, jaki wysiłek myślenia i jaki model dać każdej klasie agentów, ile warstw sprawdzania zostawić, jak ma wyglądać
scalony plan i czy przy lekkim planie zawsze puszczać agentów researchu, co zrobić z opisami workflowów na liście skilli, gdzie trzymać reguły zachowania —
u buildera czy u reviewera, i w jakiej kolejności to wdrażać.

Przy okazji wyszło, czego panel wybierać nie może. Scalenie osi testów z osią poprawności jest dozwolone dopiero po pomiarze — tak postanowiłeś wcześniej — więc
panel może je co najwyżej zaplanować na później. Hook sprawdzający typy w sesji głównej zostaje, więc pytanie o warstwy sprawdzania dotyczy tylko runu.

**Jedną sprawę dopisałem i proszę o Twoje tak albo nie.** Przy przeglądzie domknięć zanotowaliśmy obserwację: po poprawce warto mechanicznie posprzątać nazwy,
które poprawka zmieniła, a zgłoszenie wymagające nowej funkcji powinno iść jako nowa jednostka pracy z własnym review, nie jako łatka. Zapisaliśmy to jako
„nie decyzja, na etap 5”. Dopisałem ją do panelu, bo dotyczy jedynego miejsca, gdzie dziś widać wyraźnie gorszą jakość: w plikach dotkniętych poprawkami bot
znajduje mniej więcej trzy razy więcej realnych błędów niż w reszcie PR-a. Jeśli wolisz, żeby została na etapie 5 — skreślam.

**Co to daje.** Panel pracuje tylko na sprawach otwartych, a każda z nich ma już wskazaną miarę z mapy walidacji. Nic przesądzonego nie wraca pod dyskusję.

## Część 2. Na czym mierzymy jakość

**Problem.** Pierwotny plan zakładał sędziów, którzy ocenią jakość projektów. Bez danych każdy z nich oceniłby ją opinią, a trzech sędziów na tym samym modelu to ta
sama opinia trzy razy.

**Przyczyna, dla której możemy zrobić lepiej.** Mamy konkretną listę błędów, które przeszły przez nasze review, a znalazł je dopiero bot: 195 realnych defektów,
w tym 132 poważne. Przy każdym znamy plik, rodzaj błędu i treść uwagi bota. Tę listę przygotowałem już skryptem, bez żadnych agentów. Przy okazji wyjaśniło się,
że „68 ucieczek” z etapu 1 to nie osobny zbiór, tylko opis tych samych uwag bota zebrany w dokumentach wiedzy — więc służą jako kontekst do części przypadków,
a nie jako druga lista.

**Co robimy.** Każdy projekt ma zapisać dokładnym brzmieniem swoje mechanizmy łapania błędów: reguły lintera, polecenia dla reviewerów, wiedzę doklejaną
builderowi. Sędzia bierze każdy z 195 przypadków i sprawdza, czy któryś mechanizm by go złapał — i czym. Rozróżnia to, co działa pewnie (reguła lintera,
która odpali zawsze), od tego, co działa być może (polecenie każące wypisać konkretne rzeczy), i od ogólnego „ta oś ma to w zakresie”. To ostatnie ma na tej liście
zerową skuteczność, bo każdy z tych błędów przeszedł mimo że jakaś oś miała go w zakresie.

Dwa zabezpieczenia uczciwości. Po pierwsze, obok trzech projektów sędzia ocenia też dzisiejszy pipeline, nie wiedząc, który to jest. Skoro wszystkie te błędy
dziś przeszły, dzisiejszy pipeline powinien wypaść prawie na zero — jeśli sędzia da mu dużo punktów, znaczy, że jest za łagodny, i wtedy to sprawdzam, zanim
użyję wyników. Po drugie, projektanci znają nazwy głównych klas błędów, więc mogliby dopisać polecenia „pod test”. Dlatego osobno liczymy 27 przypadków z rzadkich
klas, których projektanci po nazwie nie widzą — to pokazuje, czy projekt łapie też to, czego się nie spodziewał.

**Czego ta metoda nie powie — mówię to od razu.** Nie zmierzy, czy trzy równoległe przejścia review znajdą więcej niż jedno. To da się sprawdzić tylko puszczając
review na starych zmianach i porównując, a to jest pomiar na etap 5, nie praca panelu.

**Co to daje.** Zamiast „sędzia uważa, że projekt B jest lepszy” dostajesz: projekt B łapie tyle poważnych błędów regułą, tyle poleceniem, tyle nie łapie wcale —
na prawdziwych błędach z Twojego projektu.

## Część 3. Jak liczymy koszt

**Problem.** Agent-projektant, pytany o koszt swojego projektu, zgaduje. Wiemy też z przeglądu, że oszczędności się nie sumują — po odchudzeniu kontekstu
każdy agent jest tańszy, więc mniejsza liczba agentów daje mniej, niż wynika z prostego dodawania.

**Co robimy.** Projektant nie podaje kwot. Wypisuje role: kto, na jakim modelu, ile razy w fazie i w jakich fazach. Koszt liczy skrypt na prawdziwych
transkryptach z runu z 20 września i na startach agentów zmierzonych w mini-runie. Zanim policzy cokolwiek, musi odtworzyć koszt tamtego runu z dokładnością
do pięciu procent — inaczej go nie używam.

**Co to daje.** Każdy projekt ma koszt policzony tą samą miarą co dzisiejszy pipeline, a nie deklarację.

## Część 4. Trzej projektanci — dlaczego trzy architektury review

**Problem.** Wcześniej planowaliśmy trzy projekty: tani, jakościowy i hybrydowy. Przy tylu przesądzonych wymogach różniłyby się w kilku miejscach, a wygrałaby
przewidywalnie hybryda.

**Co robimy.** Każdy projektant broni jednej odpowiedzi na pytanie, dlaczego tyle błędów przechodzi przez nasze review, choć ktoś ma je w zakresie. Pierwszy:
bo reviewer ma za dużo naraz na głowie, więc trzeba go skupić — osobne osie z konkretnymi poleceniami do wypisania (to jest dzisiejszy kierunek, dopracowany).
Drugi: bo pojedyncze przejście jest loterią — powtórka review na tym samym kodzie odtwarza tylko około połowy zgłoszeń — więc lepiej puścić trzy równoległe
przejścia na najważniejszych osiach i złożyć wyniki. Trzeci: bo liczba poleceń nie ma znaczenia — mini-run pokazał, że cztery razy więcej poleceń nie pogorszyło
ich stosowania, więc może wystarczy jeden reviewer i mocne bramki; to też daje dolną granicę kosztu. Każdy w ramach swojej architektury rozstrzyga pozostałe
jedenaście spraw.

Czwartego, hybrydowego, nie planuję: synteza i tak bierze najlepsze rozwiązanie każdej sprawy z dowolnego projektu, więc dobre pomysły przegranych nie giną.
Jeśli chcesz oszczędzić, można zrezygnować z trzeciego projektanta — tracimy wtedy dolną granicę kosztu.

Projektanci dostają pakiet wejściowy i dokumenty etapów, ale nie dostają starych werdyktów liczonych na zawyżonych danych ani listy przypadków sędziego.

## Część 5. Sceptycy i synteza

**Co robimy.** Po sędzim układam wstępny wybór w każdej sprawie. Trzech sceptyków dostaje te wybory bez moich uzasadnień i atakuje je — ale zarzut liczy się tylko
z dowodem: liczbą z danych, linią kodu albo przypadkiem z listy. Zarzut bez dowodu obniża pewność, ale nie zmienia wyboru. Na końcu każda sprawa dostaje zapis:
co wybieramy, dlaczego, czym to zmierzymy po wdrożeniu i kiedy się wycofujemy. To jest prosto wejście do planu iteracji etapu 5.

**Co to daje.** Każda decyzja ma dowód, miarę i drogę odwrotu — tak jak przy wszystkich Twoich wcześniejszych decyzjach.

## Część 6. Model, bezpieczeństwo, koszt, czas

Wszyscy agenci jadą na Opusie 5.5 z przypiętym modelem, a po każdym runie sprawdzam w transkryptach, na czym faktycznie jechali. Projektanci i sceptycy dostają
wyższy wysiłek myślenia, bo szukają i łączą; sędzia średni, bo przypisuje według zamkniętej listy — jeśli okaże się za łagodny, jego część idzie ponownie
z wyższym. Każdy agent ma na początku zdanie, że to jego jedyne zadanie i że Twoja wiadomość nie jest dla niego, a w Twojej wiadomości ze znakiem zostaje zdanie
do agentów — to lekcja z mini-runu, gdzie agent haiku wykonał Twoją prośbę zamiast swojego zadania. Panel niczego nie zmienia w maszynerii, więc może ruszyć
w tej sesji, o ile nikt w międzyczasie nie zmieniał plików maszynerii szablonu.

Dziewięciu agentów, około 10–16 milionów jednostek — mniej więcej jedna trzecia do połowy jednego runu autopilota. Agenci pracują łącznie półtorej do dwóch godzin,
do tego moja praca między runami; realnie dwie sesje.

## Część 7. Gdzie się zatrzymam

Dwa razy czekam na Ciebie: po projektantach (krótka notatka: trzy architektury, ich koszt, czy są kompletne) i po syntezie (wynik do akceptacji). Sam się zatrzymam,
jeśli któryś agent pojedzie na innym modelu, jeśli skrypt kosztu nie odtworzy starego runu, jeśli projekt po jednej poprawce dalej będzie niekompletny, jeśli sędzia
okaże się za łagodny, jeśli koszt wyjdzie wyraźnie ponad szacunek albo jeśli któryś agent zacznie coś zapisywać lub robić poza swoim zadaniem.

## Czego panel nie robi

Nie pisze kodu ani gotowych promptów, niczego nie zmienia w szablonie ani w oferty-online, nie puszcza review na starych zmianach, nie wraca do Twoich decyzji
i nie pisze raportów końcowych — to etap 5.

## Czego potrzebuję od Ciebie

Znaku na wykonanie, a przy nim dwóch odpowiedzi: czy sprawa „sprzątanie po poprawce i nowa funkcja jako nowa jednostka” wchodzi do panelu, i czy zostaje trzeci
projektant (jeden reviewer z bramkami).

**Odpowiedziałeś 24 września:** sprawa dwunasta wchodzi, trzeci projektant zostaje. Panel ruszy w nowej sesji, bo ta urosła do prawie 400 tysięcy tokenów.
