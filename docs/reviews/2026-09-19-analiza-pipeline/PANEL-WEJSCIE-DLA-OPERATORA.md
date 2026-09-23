# Co dostanie panel projektowy (wersja dla Kacpra)

Data: 2026-09-22. To jest ludzka wersja pliku `PANEL-WEJSCIE.md`. Tamten jest pisany dla agentów panelu i dla Claude'a: gęsty, z odsyłaczami do każdego
źródła, po to, żeby trzej projektanci dostali identyczny zestaw założeń. Ten plik ma Ci opowiedzieć to samo w kolejności, w jakiej podejmowałeś decyzje,
i przy każdej rzeczy odpowiedzieć na pytanie, dlaczego tak, a nie inaczej. Nie ma tu nic, czego nie ma w wersji technicznej, i nie ma tu żadnej nowej decyzji.

## O co chodzi w tym dokumencie

Przez trzy dni zebraliśmy model kosztu, ocenę każdego reviewera, analizę uwag CodeRabbita, research zewnętrzny, cztery pomiary, krytyka kompletności
i domknięcia D1–D6 z mapą walidacji, a potem przegląd wszystkich domknięć. Po drodze podjąłeś dziewiętnaście punktów decyzji. Leżą w pięciu dokumentach i w jednej długiej sekcji HANDOFF, a część z nich nadpisuje
wcześniejsze zapisy. Gdyby panel dostał to w tej postaci, każdy z trzech projektantów odczytałby sprzeczności po swojemu i porównywalibyśmy projekty
zbudowane na różnych założeniach.

Pakiet wejściowy zbiera to w jednym miejscu. Ten dokument tłumaczy, co w nim jest.

## Jak wygląda panel

**Zmiana z 23 września: zamiast panelu projektowego robimy panel decyzyjny.** Twoje decyzje i wymogi z tego pakietu przesądzają już szkielet nowego
pipeline'u. Trzy pełne projekty („najtańszy”, „najlepszy”, „hybryda”) różniłyby się więc w kilku miejscach, a wybór hybrydy byłby z góry przewidywalny.
Sędziowie bez danych oceniliby jakość opinią, a dobre pomysły przegranych projektów by przepadły.

Dlatego najpierw sesja główna, bez agentów, wypisuje decyzje naprawdę otwarte, każdą z opcjami i danymi. Przygotowuje też zestaw prawdziwych błędów,
które przeszły przez nasze review, i skrypt liczący koszt. Potem trzech projektantów broni trzech różnych sposobów robienia review, bo to największa
pozycja kosztu. Każdy w ramach swojego sposobu rozstrzyga pozostałe otwarte decyzje. Jeden sędzia sprawdza na tych prawdziwych błędach, który projekt
by je złapał i czym. Koszt liczy skrypt, a nie agent. Sceptyk atakuje każdą decyzję osobno i każdy zarzut musi mieć dowód. Na koniec sesja główna
zapisuje każdą decyzję: co wybrano, dlaczego, czym to zmierzymy i kiedy się wycofać. Z tych zapisów powstaje plan wdrożenia. Około pięciu do siedmiu
agentów, wszyscy na Opus 5.5 (wcześniej plan zakładał Fable), w trzech osobnych runach, między którymi sesja główna czyta wyniki.

Poniżej opis, który obowiązywał wcześniej, zostawiony dla porządku: trzech niezależnych projektantów dostaje ten sam materiał i inny priorytet: jeden ma zbudować pipeline najtańszy, drugi najlepszy jakościowo, trzeci
hybrydę. Potem trzech sędziów ocenia projekty, sceptyk atakuje zwycięzcę, a synteza składa końcowy projekt. Panel niczego nie buduje: jego wynikiem jest koncepcja docelowego pipeline'u i kolejność
wdrożenia, a kod powstaje dopiero faza po fazie, każda z własną miarą w telemetrii. Sędziowie mają dwa wymiary: koszt i jakość kodu mierzoną tym, ile poważnych uwag znajduje po nas CodeRabbit. Koszt wdrożenia
nie jest kryterium, bo zdecydowałeś, że zysk z lepszego procesu przewyższa koszt naprawy, a wdrożenie i tak pójdzie fazami. Szablon jako plugin nie jest
wariantem; zbadany, odłożony na później.

Przed panelem zrobiliśmy jeszcze mini-run na małym zadaniu buildera. Sprawdził rzeczy, o których wcześniej tylko zakładaliśmy, że działają.
Wszystkie się potwierdziły. Szczegóły są w części ósmej.

---

## Część 1. Sześć miejsc, gdzie dokumenty mówiły co innego, i co obowiązuje

Analiza szła etapami i każdy etap dopisywał swoje ustalenia zamiast zastępować stare. To było celowe, bo zachowuje historię dowodów. Ale znaczy też,
że w sześciu miejscach dwa dokumenty mówią co innego. Panel dostaje rozstrzygnięcie każdego z nich.

**Kontekst agentów.** Pomiary mówiły: każdy agent startuje bez CLAUDE.md, a buildery czytają pliki narzędziem Read, żeby działały reguły warunkowe.
Ty zdecydowałeś inaczej: odchudzony CLAUDE.md ma trafiać do builderów i reviewerów, bez niego ma startować tylko maszyneria pomocnicza, która nie patrzy
na kod. Tryb bypass i czytanie przez powłokę zostają, więc reguły warunkowe są bonusem, nie kanałem dostarczania wiedzy. Obowiązuje Twoja decyzja.
Dlaczego: reguły warunkowe wyzwala tylko Read, a w trybie bypass buildery czytają powłoką, więc budowanie na nich architektury byłoby budowaniem na
czymś, co u builderów nigdy się nie załaduje.

**Oś test-coverage.** Research chciał ją zdegradować do dodatku, bo trzy narzędzia mechaniczne miały przejąć jej pracę. Pomiar pokazał, że jedyne
zmierzone narzędzie trafia zero z trzydziestu jeden uwag tej klasy. Potwierdziłeś: oś zostaje, narzędzia to dodatki z wynikiem dla buildera, a scalenie
z correctness jest tylko opcją, którą można rozważyć po zmierzeniu dwóch pozostałych narzędzi. Dlaczego: to oś z największą liczbą znalezionych
defektów, a degradacja była warunkowa i straciła swój warunek.

**Lekka runda review po naprawie.** Pomiary ją proponowały. Ty ją wycofałeś na rzecz poleceń-list w kontroli diffu naprawczego, bo historia pokazuje,
że każda dodatkowa runda po fixie to przepalone tokeny. Obowiązuje Twoja decyzja.

**Ile daje odchudzenie kontekstu.** Pierwotna liczba trzydzieści do czterdziestu procent kosztu fazy nie miała rachunku, a etap trzeci przeskalował ją
do dwudziestu pięciu do trzydziestu pięciu. Przegląd D4 (23 września) policzył to wprost, agent po agencie, na prawdziwych zapisach runów. Po ścięciu
CLAUDE.md Twoja konfiguracja zdejmuje około czterdziestu do pięćdziesięciu procent kosztu fazy: w runie z 20 września 51%, w runach sprzed ścięcia 37%.
Sama allowlista narzędzi to 27–38%. Etap trzeci zaniżał, bo liczył od pustego agenta z terminala, a polski tekst wyceniał prawie o połowę za tanio.
Kolejność priorytetów się nie zmienia. Oszczędności się jednak nie sumują: po allowliście każdy agent kosztuje mniej, więc cięcie liczby agentów
da raczej trzy do siedmiu procent niż osiem do dziesięciu. Mini-run potwierdził to odczytem prawdziwego startu agentów na Opus 5.5: około 48%,
a sama allowlista 35%.

**Model kosztu sprzed napraw.** Liczby „przed" opisują projekt oferty-online bez dziewięciu napraw z września. Uznałeś to za niską wagę: realną ocenę
da dopiero wdrożenie na prawdziwym projekcie. Idzie do raportu jako uwaga, nie jako ryzyko.

**Zatrzymanie na E2E.** Etap pierwszy zapisał: po zatrzymaniu runu na testach E2E powtarza się tylko tester, nie cały skład. Ty po etapie trzecim
zdecydowałeś, że test niewykonalny przez środowisko albo zewnętrzny limit nie zatrzymuje runu, tylko przełącza checkbox na manual z powodem, a run
idzie dalej. Wczoraj potwierdziłeś, że to druga wersja obowiązuje. Zapis z etapu pierwszego traci przedmiot: skoro run się nie zatrzymuje, nie ma
po czym robić powtórki.

---

## Część 2. Trzynaście rzeczy, które każdy z trzech projektów musi mieć

To są Twoje decyzje z sekcji 6a, przetłumaczone na wymogi. Projekt, któremu brakuje któregoś, jest niekompletny, niezależnie od priorytetu.

**Jeden. Allowlista narzędzi u każdego agenta pipeline'u, z plikami definicji per klasa roli.**
Problem: każdy agent na Twoim koncie startuje z opisami narzędzi, listą prawie tysiąca nazw narzędzi MCP i trzystu skilli, z których prawie nic
nie jest używane (498 z 514 agentów nie zawołało żadnego narzędzia MCP). Pusty agent w terminalu to sześćdziesiąt dwa tysiące tokenów. W runach z aplikacji
desktop jest gorzej: sam ten balast to 54–77 tysięcy tokenów na agenta opusa, zależnie od serwerów MCP podłączonych w sesji. Przyczyna: żaden z szesnastu
plików agentów w szablonie nie ma pola ograniczającego narzędzia, a trzydzieści sześć ról w ogóle nie ma pliku, bo orkiestrator woła je bez typu.
Rozwiązanie: allowlista zbija start agenta o 70–90%, na przykład u reviewera ze 125 do około 29 tysięcy (z CLAUDE.md i promptem zadania); nośnikiem są pliki agentów, ale nie po jednym na rolę, tylko po jednym na klasę (maszyneria pomocnicza, orkiestracyjne,
reviewer, sceptyk, naprawiacz), bo prompty tych ról są i tak generowane w kodzie, a plik niesie wyłącznie ustawienia. Istniejące osiem plików zostaje
jako wyjątki. Co Ci to da: kilkanaście plików zamiast czterdziestu i największą pojedynczą oszczędność całej analizy. Po przeglądzie 23 września
jedno zastrzeżenie do pomiaru: start agentów rósł w trzy tygodnie o czterdzieści pięć do siedemdziesięciu pięciu tysięcy tokenów razem z CLAUDE.md
i learned-patterns. Punkt odniesienia dla allowlisty musi więc pochodzić ze stanu po ścięciu CLAUDE.md, osobno dla haiku i opusa, żeby allowlista
nie dostała na konto zysku ze ścięcia. Przegląd D5 znalazł, że taki run już jest: 20 września autopilot (85 agentów) pracował ze ściętym CLAUDE.md
na gałęzi zadania. Start spadł tam o 12–25 tysięcy tokenów zależnie od klasy, u reviewerów ze 145 do 125 tysięcy. To pierwszy punkt odniesienia,
a mini-run go potwierdził. Do tego telemetria będzie od razu widziała, ile narzędzi dostał agent (dziś 972), więc zadziałanie allowlisty sprawdzi
jedna liczba. Ten sam wzrost to też najmocniejszy dowód, że dobrze zdecydowałeś, że nic nie dopisuje do CLAUDE.md.

**Dwa. Kontekst dobrany do klasy roli.** Jak w części 1: CLAUDE.md u tych, którzy patrzą na kod, wyłączony u maszynerii pomocniczej, skille builderów
zostają. Dlaczego skille zostają: działają, a dobieranie ich per jednostka pracy nie jest warte logiki w orkiestratorze.

**Trzy. Budżet instrukcji w trzech warstwach.**
Problem: policzyliśmy, ile poleceń naprawdę dostaje jeden reviewer. Wyszło około trzystu sześćdziesięciu pięciu, a licząc wszystkie zdania w regułach,
do pięciuset (pierwsza wersja mówiła „do siedmiuset”, bo policzyła learned-patterns dwa razy). Builder danych: około pięciuset. Literatura pokazuje kierunek:
im więcej poleceń naraz, tym więcej cichych pominięć. Procentów z tego badania nie da się jednak przenieść na nas, bo tam „polecenie” to „użyj w tekście
słowa X”, a nasze reguły są w większości warunkowe i wymagają osądu. To, że czterdzieści pięć z sześćdziesięciu ośmiu defektów, które CodeRabbit znalazł
po nas, miało regułę i właściciela, jest z tym zgodne, ale tego nie dowodzi. Mocniejszy argument dał przegląd 23 września: około dwóch trzecich poleceń
reviewera dotyczy technologii albo sytuacji, których oglądany kod często w ogóle nie ma. Rozwiązanie, które wybrałeś: warstwa stała na rolę poniżej stu
pięćdziesięciu instrukcji, pilnowana testem szablonu (pada przy edycji promptu, nigdy nie zatrzymuje runu); test liczy pozycje jednego oznaczonego bloku
poleceń, żeby nie dało się go obejść, przepisując listę na prozę; warstwa referencyjna bez limitu, którą orkiestrator dokleja po plikach jednostki, bo
instrukcja „przeczytaj X” jest pomijana jak każda inna; warstwa mechaniczna w linterze. Skille builderów nie są skracane, tylko dzielone. Co Ci to da:
agent dostaje stale około stu dziesięciu poleceń, które zawsze go dotyczą, a resztę tylko wtedy, gdy kod jej potrzebuje, więc mniej się rozprasza i mniej
kosztuje każda tura. Mini-run rozstrzygnął, czy sama liczba poleceń psuje u nas jakość. Nie psuje: ten sam znacznik przetrwał w prompcie ze stu
i z czterystu poleceniami, za to czterysta kosztowało o 72% więcej. Budżet zostaje więc dla porządku i kosztu.
Na samych poleceniach-listach nie liczyłbym na domknięcie dwóch trzecich uwag bota. Połowa przeoczeń jest w kodzie, który reviewer oglądał, więc
wygląda to raczej na granicę uwagi niż na brak reguł.

**Cztery. Learned-patterns w trzech poziomach z ośmioma zabezpieczeniami.**
Problem: plik z nauczonymi wzorcami urósł do czterdziestu dziewięciu tysięcy znaków i wchodzi bezwarunkowo do trzydziestu pięciu agentów na fazę.
Rozwiązanie: jedna linia w CLAUDE.md, generowany indeks, szczegóły w solutions jako jedyne źródło prawdy. Orkiestrator wkleja builderowi i reviewerowi
tylko wpisy pasujące do katalogów jednostki. Osiem zabezpieczeń przyjąłeś w całości, w tym zamknięty słownik klas i walidację w kodzie, która odmawia
zapisu bez wymaganych pól. Zasada, którą sformułowałeś przy pytaniu o projekt rozwijany rok: limit dotyczy warstwy zawsze ładowanej, nie wiedzy.
Wiedza schodzi do warstw ładowanych warunkowo. Żaden skill nie dopisuje już do CLAUDE.md.

**Pięć. Telemetria mechaniczna, bez agentów.** Osobna część 6 tego dokumentu.

**Sześć. E2E przełącza się na manual zamiast zatrzymywać run.** Jak w części 1, z Twoim doprecyzowaniem: warunkiem jest środowisko E2E sprawdzone przed
startem autopilota, a checkbox przełączony na manual w trakcie runu trafia do smoke operatora na końcu zadania, nie znika. Ponowne stawianie środowiska
w runie jest droższe niż test ręczny. Do tego każdy projekt ma powiedzieć wprost, co robi z trzema
rekomendacjami z przeglądu runów: parametryzacja E2E w szablonie, katalog zadania jako własne artefakty (brudny tylko on nie jest powodem STOP-u),
kategoria przyczyny pominięcia testu.

**Siedem. Sceptyk asymetryczny.**
Problem: nasi sceptycy obalają dwanaście do dziewiętnastu procent findingów. Literatura pokazuje sześćdziesiąt trzy do osiemdziesięciu trzech.
Przyczyna: sceptyk dostaje zarzut razem z uzasadnieniem autora, więc ocenia argument, a nie kod. Rozwiązanie: dostaje sam zarzut (plik, linia, teza)
i musi odpowiedzieć jedną z trzech etykiet; niezgoda kasująca finding wymaga wskazania linii kodu lub testu, niezgoda „mam obawę" tylko obniża wagę.
Dla P1 naprawa zawiera test padający przed poprawką. Koszt: zmiana promptu, zero nowych agentów.

**Osiem. Security warunkowe po profilu stacku, Supabase wyłącznie chmurowe.**
Problem: reguły o RLS i uprawnieniach siedzą w prompcie security, a Supabase ma gotowe narzędzie, które sprawdza to mechanicznie. Rozwiązanie:
projekt z Supabase dostaje bramkę advisors przez API chmurowe (zero Dockera, zgodnie z Twoją decyzją), a security dostaje polecenie „tego nie
sprawdzaj, robi to advisors"; projekt bez Supabase zachowuje polecenia-listy o RLS. Profil stacku trafia do dossier każdego reviewera. Reguły nie są
usuwane, tylko warunkowe.

**Dziewięć. Pętla naprawcza bez dodatkowej rundy review.**
Kontrola diffu naprawczego dostaje polecenia-listy correctness zawężone do diffu; builder naprawia tylko P1 i P2, P3 idzie do known-issues albo do bota;
zakaz zmian poza zgłoszonym miejscem. Kontrola i poprawka nie są scalane, bo kontrola złapała trzy realne regresje wprowadzone przez naprawy.
Dlaczego to ważne po domknięciu D1 (wersja po przeglądzie 23 września): z czterdziestu czterech findingów w kodzie znalezionych po naprawach połowa
urodziła się w naprawach, każdy jako skutek naprawiania wcześniejszego findingu, a jedyny P1 też. Kontrola diffu nie złapała żadnego. Co gorsza,
cztery defekty z pierwszej naprawy przeszły niezauważone przez całą kolejną, pełną rundę review i wyszły dopiero w trzeciej. Więcej rund tego nie
załatwia; mniejszy diff naprawy tak.

**Dziesięć. Zakaz powtórek sekwencyjnych review.** Literatura i nasz pomiar zgadzają się: druga runda po pierwszej na tym samym kodzie kupuje jeden
prawdziwy defekt za cztery do pięciu fałszywych. Równoległe próbki pomagają, sekwencyjne szkodzą.

**Jedenaście. Polecenia-listy zamiast długich reguł, z warunkiem odwrotu.** To główny lek na ucieczki do bota i jedyny bez pomiaru, bo skuteczność
da się zmierzyć dopiero po wdrożeniu. Każdy projekt wpisuje warunek, przy którym się z tego wycofa.

**Dwanaście. Scalenie dev-plan z dev-docs w jeden skill.** Do wczoraj hipoteza otwarta dla panelu, od dziś wymóg. Odpalasz je zawsze po sobie i nic
między nimi nie robisz, a dev-docs przepisuje od jednej piątej do połowy planu. Każdy projekt ma zaprojektować scalony skill z budżetem tokenów,
na analizie tego, co oba dziś robią i gdzie przepalają kontekst. Dev-prep zostaje osobno, bo jest interaktywny. Po przeglądzie D6 wiadomo, gdzie jest
koszt. Typowy dev-plan kosztuje 2,4 miliona jednostek, a nie 0,8, jak liczyliśmy dotąd, i największą pozycją są w nim subagenci researchu.
Kopia planu w dev-docs to drobiazg. Skille przed autopilotem to w typowym zadaniu około 4–7 procent kosztu.

**Trzynaście. Każda zmiana ma metrykę.** Projekt, który proponuje zmianę bez wskazania, po którym polu telemetrii poznamy, że zadziałała, jest
niekompletny. To wymóg oparty na mapie walidacji z części 6.

---

## Część 3. Rzeczy rozstrzygnięte wcześniej, które panel też musi wbudować

To ustalenia z etapów 1, 1b i 2, które nie przeszły przez Twoje decyzje, bo nikt ich nie kwestionował. Przy pierwszej wersji pakietu je pominąłem;
wyszły przy czytaniu obok źródeł. Najważniejsze:

Roster review z sześciu osi na pięć: performance zostaje zastąpiona narzędziami (limit rozmiaru bundle'a, advisors, pięć linii w correctness),
z warunkiem powrotu, jeśli bot znajdzie co najmniej trzy poważne defekty wydajnościowe w oknie pięciu PR-ów (próg poprawiony w mapie walidacji;
dawny „więcej niż jeden na pięć faz" liczył w złej jednostce i alarmowałby przypadkiem). Security ma prompt do skrócenia o połowę.
Correctness dostaje własny plik agenta. Code-quality zostaje, ale z zakazem zgłaszania czegokolwiek, co łapie linter. Spec-compliance zostaje bez zmian,
bo trzy z pięciu proponowanych cięć kasowały prawdziwe findingi.

Stan fazy doklejany do promptu następnego agenta zamiast osobnego agenta zapisującego plik (osiemdziesiąt powołań na dwadzieścia trzy fazy).
Pre-skan naprawy do skasowania, bo to praca lintera. Bramka niezmienności migracji: edycja wypchniętej migracji zatrzymuje run z poleceniem
„popraw nową migracją". Seedy dostają właściciela: e2e pilnuje zgodności z migracją, security strażników. Dossier klas ucieczek u buildera: tabela
ośmiu do dziesięciu klas z jednym zdaniem „co robić zamiast", bo ten sam builder powtarzał tę samą klasę błędu kilka razy w jednym PR.

Pełny zestaw bramek domknięcia fazy: ESLint w nowej konfiguracji, knip, limit rozmiaru, typecheck testów, mutacje na diffie, suma kontrolna migracji,
advisors. Z pomiarów wiemy, że z cache to około czterech sekund plus dziesięć na typecheck, ale pierwsze wdrożenie wymaga wyciszenia stu
osiemdziesięciu ośmiu zastanych błędów, a mutacje trwają za długo na każde domknięcie (pięć do piętnastu minut na fazę), więc lądują przed PR-em
albo tylko na plikach testowych. Wynik mutacji idzie do buildera jako lista mutantów do zabicia, a nie jako procent do osiągnięcia, bo agent zacząłby
pisać testy pod metrykę. Zasada alokacji: to, co oszczędzamy na osiach produkujących szum, idzie na sceptyków, którzy dziś kosztują sześć procent
fazy.

Dev-pr: cztery wąskie zmiany (zbieranie uwag w każdej turze, poprawiony guard uzasadnień, rekomendacja merguj/nie/kolejna tura liczona w kodzie,
raport per tura), sufit trzech tur. Dev-pr to niecały procent kosztu, więc nie jest celem oszczędności; celem jest jakość Twojej decyzji o merge'u.

Packager dossier ma zniknąć na rzecz doboru plików w kodzie. To założenie z literatury, a nasz jedyny pomiar mówi coś przeciwnego, więc idzie
z warunkiem odwrotu.

---

## Część 4. Dziewięć pierwotnych hipotez i co się z nimi stało

Na początku analizy zapisałem dziewięć hipotez. Panel dostaje je ze stanem, żeby nie projektować na czymś, co już rozstrzygnięte.

Odchudzenie kontekstu: obowiązuje w wersji z Twoich decyzji. Mniej agentów na fazę: otwarte dla panelu, z ustaleniami powyżej. Roster review:
rozstrzygnięte, sześć na pięć. Powtórka po zatrzymaniu E2E samym testerem: nieaktualne. P3 nie naprawiać automatycznie: przyjęte. Scalenie dev-plan
z dev-docs w jeden skill: od dziś wymóg, z Twoim uzupełnieniem o budżet pliku w jednostce pracy. Buildery czytające przez Read: nieaktualne.
Telemetria pełna: przyjęta i rozszerzona. Parametryzacja E2E: na listę zmian szablonu.

Zostaje więc jedna prawdziwie otwarta kwestia projektowa: ile agentów na fazę i jak je poskładać. Reszta to wbudowanie ustaleń, w tym zaprojektowanie
scalonego skilla planowania.

---

## Część 5. Na czym stoimy na jednej nodze

Kilka założeń całej analizy stoi na jednym pomiarze albo na literaturze bez naszego pomiaru. Panel dostaje je z warunkiem odwrotu, a raport końcowy
jako jawne ograniczenia. Polecenia-listy: zero runów, tylko oceny agentów. Zastąpienie performance: advisors nigdy nie uruchomione, zmierzymy przy
wdrożeniu bramki na chmurze. Sceptyk asymetryczny: dwie prace zewnętrzne, u nas zero pomiaru; ryzyko, że mocniejszy sceptyk zacznie kasować
prawdziwe P1. Packager w kodzie: jak wyżej. Batch sceptyków: hipoteza o dwóch procentach oszczędności.

Jedna teza się po drodze zawaliła: pomiary mówiły, że nowe findingi po naprawie to review kodu naprawczego. Domknięcie D1 po przeglądzie
23 września pokazało, że to pół na pół: połowa to defekty przeoczone przez wcześniejszą rundę, połowa urodziła się w naprawach. Pierwsza wersja D1
mówiła „sześćdziesiąt procent przeoczeń”, ale pominęła jedną powtórkę i trzy defekty, które naprawa stworzyła w starej linii. Wybór między trzema
równoległymi próbkami a lepszym sceptykiem nie wynika z tego podziału: sceptyk odsiewa fałszywe alarmy, ale nie znajduje przeoczonych defektów.
Podział mówi tylko, ile zasięgu review brakuje, a decyzja, czy za zasięg dopłacić, należy do panelu.

---

## Część 6. Telemetria, czyli jak za miesiąc zobaczysz, co działa

**Gdzie był problem.** Dzisiejsza telemetria liczy wyłącznie tokeny wyjściowe, czyli około jedenastu procent kosztu. Wcześniej pisałem „dwa procent”;
przegląd D5 wykazał, że mój skrypt z etapu zerowego brał niepełny zapis każdej odpowiedzi i zaniżał tokeny wyjściowe. Kolejność priorytetów się
od tego nie zmienia. Telemetria nie widzi poziomu agenta. Zapisuje ją agent haiku, który dwa razy skasował plik z historią. Progi alarmowe, które
stroiliśmy przez tygodnie, oceniały niewłaściwą wielkość.

**Co go powoduje.** Pełne dane leżą na dysku: dziennik runu ma etykietę, fazę i wynik każdego agenta; transkrypt agenta ma zużycie tokenów z pełnym
cennikiem, model, czasy i narzędzia; plik stanu zadania ma metryki fazy. Nikt ich nie składa. Skrypt workflowu nie ma dostępu do plików ani powłoki,
więc orkiestrator nie dopisze rekordu sam. Pierwotnie sądziłem też, że status i powód zatrzymania zna tylko sesja główna. Przegląd D5 znalazł plik,
który Claude Code zapisuje po każdym runie: jest w nim wynik, status (także „przerwany”), użyty skrypt i lista agentów, dla wszystkich 156 runów.

**Co proponuję.** Jeden plik dopisywany wyłącznie na końcu i trzy typy rekordu. Po przeglądzie D5: rekord agenta dopisujemy raz, a rekord runu i fazy
w nowej wersji przy każdej zmianie, bo wznowienie po awarii działa na tym samym runie; raport bierze ostatnią wersję, więc dwie sesje zapisujące
naraz nie zrobią dubli. Wersję szablonu bierzemy ze skryptu, który naprawdę się wykonał, bo 33 z 55 runów autopilota puściło lokalnie zmieniony
skrypt. Uwagi bota liczymy jako unikalne wątki na PR, bo kolejne tury wypisują stare wątki ponownie i suma zawyżałaby jakość o 43%. Rekord agenta: klasa roli,
kontekst pierwszej tury (to jest bezpośrednia miara, czy allowlista działa), pełny cennik, narzędzia, czas, findingi u reviewerów, obalenia u sceptyków.
Rekord fazy: findingi per oś, checkboxy przełączone na manual z powodem, wynik bramek domknięcia, regresje po naprawie, koszt per etap. Rekord runu:
status z kategorią przyczyny zatrzymania. Skrypt w Node, będący portem skryptu, którym liczyłem model kosztu w etapie zerowym, plus skrypt raportu
miesięcznego z sześcioma zestawieniami: koszt, kontekst, jakość, niezawodność, budżet instrukcji, anomalie.

**Kiedy się uruchamia.** W każdym wariancie zero agentów; agent telemetrii znika z orkiestratora. Po przeglądzie D5 głównym zapisem jest skan: czyta
plik zapisany przez Claude Code po runie i dopisuje wszystko, czego brak. Krok w skillach, w którym sesja główna podawała status, okazał się zbędny.
Skan musi przejść w ciągu około trzydziestu dni, bo tyle żyją transkrypty w projekcie, w którym pracujesz na co dzień (przegląd D6), więc woła go doctor przy każdym runie. Mini-run sprawdził hook
Stop, który robi to automatycznie. Odpala się po każdej odpowiedzi sesji, także po powiadomieniu o końcu runu, i widzi, czy w tle działa jeszcze
jakiś run. Wyszło przy tym, że run zabity razem z sesją nie zostawia pliku z wynikiem, więc skan musi go rozpoznać po samym dzienniku agentów. Przegląd runów proponował jeszcze plik per run zamiast wspólnego; oba formaty są
bezpieczne i wybór zostaje na wdrożenie.

**Co Ci to da.** Po miesiącu jeden skrypt odpowie, ile kosztuje faza i kto ją zjada, czy odchudzenie kontekstu zadziałało, które osie znajdują, a które
tylko kosztują, na czym stają runy i czy ktoś nie przekroczył budżetu instrukcji. Bez powtarzania tej analizy.

**Twoja decyzja:** wariant główny z siatką przyjęty, hook do sprawdzenia w mini-runie (sprawdzony 23 września, działa). Po przeglądzie D5 (23 września, akceptacja w całości): zasada
bez zmian, krok w skillach odpada, skan jest głównym zapisem.

**Jak poznamy, że zmiany działają.** Mapa walidacji jest zrobiona (2026-09-22, plik `dane/d5b-mapa-walidacji.txt`; wszystkie 21 wpisów prostą
narracją, z kryteriami doboru: `MAPA-WALIDACJI-DLA-OPERATORA.md`). Problem był taki, że wymóg
„każda zmiana ma metrykę" był zdaniem, a nie liczbą: za miesiąc mielibyśmy dane, ale nie wiedzielibyśmy, na które patrzeć. Mapa ma dwadzieścia
jeden wpisów, po jednym na każdy z trzynastu wymogów i ośmiu założeń z warunkiem odwrotu. Każdy wpis mówi cztery rzeczy: co liczymy, z którego
pola rekordu, jaki jest punkt odniesienia z etapu zerowego i po ilu fazach patrzymy. Założenia mają dodatkowo warunek odwrotu wyrażony tymi
samymi polami, więc cofnięcie zmiany nie będzie dyskusją, tylko odczytem.

Horyzonty są trzy. Ustawienia widać po jednej fazie: kontekst startowy agenta per klasa roli, czas bramek, budżet instrukcji. Dla kontekstu punktem
odniesienia jest run z 20 września, pierwszy po ścięciu CLAUDE.md: od 89 tysięcy tokenów u agentów pomocniczych do 135 tysięcy u builderów. Cele po
przeglądzie D4, razem z promptem zadania: pomocnicze około 9–10 tysięcy, reviewer około 29, builder około 38. Wcześniejszy cel „od czterech i pół
do dwudziestu pięciu tysięcy” był liczony od pustego agenta i pokazałby, że allowlista nie działa, choć działałaby. Pierwszym sprawdzeniem jest i tak
prosta liczba: ile narzędzi dostał agent, dziś 972. Koszt i liczbę tur widać po pięciu fazach, bo
rozrzut jest duży. Jakość widać w oknie pięciu PR-ów, bo bot recenzuje PR, nie fazę.

Jakość liczymy od wersji drugiej mapy (po Twojej akceptacji dziewięciu poprawek) jako poważne uwagi bota na sto plików PR-a, w podziale na typ kodu
i oś, bo PR-y mają od 12 do 160 plików, a warstwa danych zbiera więcej uwag niż UI. Punkt odniesienia to wrzesień, 3,5 na sto plików, a nie średnia
z całości, bo jakość poprawiała się sama od 9,3 w sierpniu. Wszystkie zmiany pipeline'u porównujemy z nowym punktem odniesienia zebranym po zmianie
konfiguracji bota, bo po niej bot jest innym przyrządem. Warunek odwrotu jest jeden dla wszystkich założeń: co najmniej dwa razy więcej poważnych
uwag osi niż oczekiwane w oknie pięciu PR-ów i co najmniej trzy. Przykład z pętli fix: w plikach po naprawie bot znajduje dziś trzy razy więcej
poważnych defektów niż w pozostałych (14,0 wobec 4,7 na sto plików), i ten stosunek ma spadać.

Kontrola w drugą stronę wykazała, że rekord telemetrii nie miał szesnastu rzeczy, których mapa potrzebuje. Dopisałem je teraz. Dwie są
najważniejsze. Pierwsza: rekord runu dev-pr z klasyfikacją uwag bota, bo bez niego żadna miara jakości nie ma źródła, a jakość to połowa tego,
co oceniają sędziowie. Klasyfikację robi ten sam agent zbierania co dziś, z rozszerzonym schematem, bez nowych agentów; ocena „dlaczego
przeoczone" wypadła z runu i robimy ją raz w miesiącu na próbce. Druga: nowy typ rekordu dla skilli w sesji głównej, bo bez niego scalenie planu
z docs nie miałoby odczytu. Reszta to
mniejsze pola: długość promptu, werdykty sceptyka w trzech etykietach, rozmiar indeksu wiedzy i wycinka, pliki dotknięte fixem, wynik ESLint
z listą reguł, profil stacku, pozycje smoke przeniesione z manual.

Wniosek dla planu wdrożenia: pierwsza iteracja to telemetria z importem danych z etapu zerowego, bo bez niej nic nie ma odczytu. Potem zmiana
konfiguracji bota, kalibracja klasyfikatora uwag i nowy punkt odniesienia z dwóch–trzech zadań. Każda kolejna iteracja wchodzi w parze ze swoim
wpisem z mapy i ma zaplanowany moment odczytu. Ustawienia i koszt mogą się zmieniać równolegle, zmiany jakościowe różnych osi też, a zmiany
przekrojowe, które dotykają wszystkich osi naraz, dostają okno pięciu PR-ów dla siebie. Trzy rzeczy mierzymy poza telemetrią, przed wdrożeniem:
skuteczność sceptyka na starych findingach, warstwy mechaniczne testów na trzydziestu jeden starych uwagach i to, czy treść skilli builderów jest
w ogóle stosowana. To ostatnie mini-run już sprawdził: jest stosowana.

---

## Część 7. Co panel ma objąć albo jawnie zostawić

Trzynaście elementów szablonu, których żaden etap nie dotknął. Część już rozstrzygnąłeś: dwa martwe pliki reviewerów idą do usunięcia po
wykorzystaniu ich treści jako materiału do poleceń-list; hook sprawdzający typy zostaje, hook przypominający o obsłudze błędów wypada, gdy wejdzie
bramka ESLint; skill bugfix jest kandydatem do usunięcia; generator konfiguracji bota do poprawy. Reszta czeka na projekt: sześć agentów researchowych
wołanych ze skilli planowania, trzy skille (ideate, brainstorm, docs-update) bez ani jednego wystąpienia w analizie, drugi niezależny roster review
w skillu code-review, nieużyty mechanizm freshness-audit, szablony E2E i smoke, siedemdziesiąt cztery testy workflowów, które każdy projekt łamie,
treść skilli builderów do podziału na warstwy, prompt osi code-quality żyjący w dwóch miejscach. Każdy projekt musi powiedzieć przy każdym z nich:
obejmuję albo zostawiam, i dlaczego.

Audyt użycia skilli szablonu jest zrobiony (2026-09-22, plik `dane/d6-audyt-skilli.txt`). Problem był taki, że w szablonie leży dwadzieścia osiem
skilli i siedem workflowów, a nikt nie wiedział, które z nich ktokolwiek uruchamia. Skrypt policzył to z trzech źródeł: koszt z danych etapu zerowego
(pięć projektów), liczba uruchomień ze wszystkich transkryptów na dysku (trzydzieści projektów, ale tylko ostatnie około trzydzieści dni w aktywnym
projekcie, bo starsze transkrypty są kasowane) i ślady w repozytoriach z całego życia szablonu, na przykład katalog solutions jako ślad po skillu compound.
Przegląd z 23 września dołożył czwarte źródło: historię poleceń wpisanych w terminalu, sięgającą października 2025. Poprawił też trzy rzeczy, opisane
niżej przy koszykach. Pełna notatka jest w pliku z przeglądem D6 dla Ciebie.

Wynik w pięciu koszykach. Trzynaście elementów to rdzeń, używany w każdym zadaniu: prep, plan i docs (pięćdziesiąt dwa uruchomienia w pięciu
projektach), autopilot z czterema workflowami-dziećmi, pr, compound, complete i refresh. Po przeglądzie liczby rdzenia są wyższe. Autopilot wywołał
execute osiemdziesiąt jeden razy, a review osiemdziesiąt cztery. Complete i refresh działają tylko w runach, które doszły do końca: dwudziestu
z pięćdziesięciu pięciu. Siedemdziesiąt pięć uruchomień dev-pr to osiem pull requestów rozbitych na etapy. Przegląd pokazał też, że koszt
prep, plan i docs był liczony tylko do pierwszej odpowiedzi skilla. Pełny koszt jest około dwa i pół raza wyższy, a w dev-planie największą
pozycją są subagenci researchu. Siedem skilli-wytycznych nikt nie uruchamia ręcznie, ale
wchodzą do każdego buildera i testera przez definicję agenta: wytyczne Supabase, security i Sentry trafiły do stu czterdziestu ośmiu agentów,
wytyczne UI do pięćdziesięciu trzech, agent-browser do pięćdziesięciu dziewięciu testerów; mini-run sprawdził, że builder tę treść stosuje.
Pięć skilli używasz celowo i poza pipeline'em: coolify-manager, sync-template, zroastuj-mnie, brainstorm i coderabbit-setup (ten
ostatni raz na projekt, z natury, ale pięć repozytoriów ma wygenerowany przez niego plik). Zroastuj-mnie i brainstorm wcale nie są rzadkie:
w terminalu użyłeś ich osiemdziesiąt cztery i dwadzieścia razy.

Pięć skilli to kandydaci do usunięcia, bo od miesięcy nikt ich nie uruchamia i żadna część maszynerii ich nie woła: code-review (drugi,
niezależny roster review, ostatnia zmiana w marcu), code-quality (jedyne „odwołanie" to zbieżność nazwy z osią review w workflowie), gemini
(ostatnie użycie w marcu), docs-update (zero odwołań, dubluje bootstrap autopilota) i bugfix (dwa uruchomienia od kwietnia, co potwierdza Twoją
wcześniejszą decyzję). Razem siedemset czterdzieści
osiem linii instrukcji w piętnastu plikach. Usunięcie praktycznie nic nie zmienia w koszcie runów, bo te skille nie ładują się do agentów; porządkuje listę
skilli, którą widzisz w sesji, i to, co trzeba utrzymywać.

Przegląd z 23 września poprawił uzasadnienie, choć lista zostaje ta sama. Te skille nie są nieużywane, tylko porzucone. Historia terminala
pokazuje, że code-review był używany w styczniu, gemini do marca, a docs-update do lutego. Gemini nie ma na liście skilli sesji z prostego
powodu: da się go wywołać tylko komendą. To nie znaczy, że jest zepsuty. Code-quality i bugfix to pojedyncze wywołania. Usuwasz więc narzędzia, z których wyrosłeś razem z pipelinem.
Przy usuwaniu trzeba też poprawić README. Szablon mobilny ma własne kopie tych skilli, więc decyzja o nim jest osobna.

Pięć zostaje do decyzji: ideate (jedno przerwane uruchomienie i jeden plik), freshness-audit ze swoim workflowem (dwa uruchomienia i trzy raporty,
wszystko z jednego dnia w sierpniu, wyłącznie w repozytorium szablonu), oraz execute i review jako skille, czyli tryb ręczny pipeline'u, którego
treść czyta też agent wewnątrz runu. Tryb ręczny był Twoim głównym trybem przez pół roku: prawie sześćset wywołań do 7 czerwca. Od wejścia
autopilota nie użyłeś go ani razu, czyli od trzech i pół miesiąca.

**Twoje decyzje z 23 września:** wszystkie pięć kandydatów do usunięcia wypada, a z koszyka do decyzji wypadają ideate, freshness-audit z workflowem
i tryb ręczny execute i review. Workflowy execute i review zostają, bo woła je autopilot; przed usunięciem skilli przeniesiemy do nich to, co agent
w runie dziś z tych skilli czyta. Usunięcia trafiają na listę zmian szablonu i do planu wdrożenia, a panel projektuje już bez tych elementów.
Przechowywanie zapisów rozmów wydłużamy do 120 dni w etapie porządków na koncie. Skille z konta, nie z szablonu (Figma, frontend-design i podobne), audyt pomija zgodnie
z Twoją decyzją, że to etap higieny konta.

---

## Część 8. Mini-run przed panelem

Godzina pracy na jednym małym zadaniu buildera, metodą markerów z pierwszego pomiaru. Pięć pytań: czy reguła wklejona przez orkiestrator do promptu
jest stosowana w kodzie; czy reguła dostarczona warunkowo jest stosowana (kontrola); czy treść skilla wstrzykniętego w definicji agenta jest stosowana,
czy tylko zajmuje kontekst; czy ten sam marker przeżywa w prompcie ze stu i z czterystu instrukcji; ile naprawdę wynosi kontekst startowy per klasa
roli. Odpowiedzi rozstrzygają wariant learned-patterns, czy skille builderów zostają bez zmian, i czy liczba czterdzieści do pięćdziesięciu
procent z przeglądu D4 się broni (wcześniej zapisywana jako dwadzieścia pięć do trzydziestu pięciu). Pytanie „sto kontra czterysta” jest od przeglądu 23 września rozstrzygające, a nie dodatkowe: to jedyny pomiar tego, czy sama liczba
poleceń psuje u nas jakość. Jeśli marker przy czterystu ginie wyraźnie częściej, budżet poniżej stu pięćdziesięciu jest celem jakościowym. Jeśli nie,
budżet zostaje dla porządku i kosztu, a o jakości decydują przede wszystkim małe naprawy. Odczyt kontekstu pierwszej tury per klasa jest od tego
samego przeglądu punktem odniesienia dla allowlisty narzędzi, bo stare liczby pochodzą z okresu, gdy CLAUDE.md był nawet cztery razy większy niż dziś.
Po przeglądzie D5 to potwierdzenie, a nie jedyne źródło: pierwszy punkt odniesienia daje run z 20 września. Mini-run sprawdzi jeszcze, kiedy powstaje
plik, z którego czyta telemetria, i czy hook Stop odpala się po zakończeniu runu.

**Wynik (23 września, zaakceptowany; pełna narracja w osobnej notatce z wynikiem mini-runu).** Wszystkie pytania mają odpowiedź i żadna nie zmienia planu.
Reguły wklejone builderowi do promptu były stosowane za każdym razem, więc kierunek z wklejaniem wiedzy projektu ma potwierdzenie. Reguła przypięta do ścieżek
plików nie dotarła ani razu, bo buildery czytają pliki terminalem. Skill wstrzyknięty builderowi był stosowany, więc skille zostają bez zmian. Sto i czterysta
poleceń dało ten sam wynik, a czterysta kosztowało o 72% więcej. Budżet 150 zostaje więc dla porządku i kosztu. Start każdej klasy agentów po zmianach
mieści się w 7% od celu, a oszczędność na runie z 20 września wychodzi około 48%. Plik z wynikiem runu powstaje dopiero na końcu. Hook Stop działa.

Wyszły też dwie rzeczy, których nie szukaliśmy. Pierwsza: tani agent Haiku potrafi wykonać Twoją wiadomość startową zamiast swojego zadania.
W jednej serii jeden z nich przeniósł plik w repo. Jedno zdanie do agentów w wiadomości wystarczyło, żeby to ustało. Panel dostaje to jako wymóg
zabezpieczenia polecenia startu autopilota. Druga: zmiany w konfiguracji agentów nie docierają do agentów w trwającej sesji. Po aktualizacji szablonu
trzeba otworzyć nową sesję, zanim ruszy autopilot. To trafiło na listę zmian poza panelem.

---

## Jak ten pakiet był sprawdzany

Pierwsza wersja była pisana z pamięci lektury. Druga runda sprawdziła trzy podejrzane miejsca i dwadzieścia siedem liczb. Trzecia czytała pakiet obok
źródeł zdanie po zdaniu i znalazła całą pominiętą kategorię (część 3). Czwarta poszła w drugą stronę: skrypt wyciągnął ze źródeł sto sześćdziesiąt
cztery jednostki z markerem decyzji i dla każdej wskazał odpowiednik w pakiecie; pięćdziesiąt osiem o niskim pokryciu przejrzałem ręcznie, a sześćdziesiąt
o średnim wyrywkowo, dopisałem dziewięć uzupełnień, a pozostałe czterdzieści cztery mają zapisaną klasyfikację, dlaczego pakiet ich nie potrzebuje.
(Pierwsza wersja tego zdania mówiła o stu osiemnastu przejrzanych ręcznie; przegląd D4 odtworzył kontrolę skryptem i poprawił liczbę.) Piąta runda,
przegląd D4 z 23 września, powtórzyła kontrolę po wszystkich poprawkach D1–D6 i dołożyła do źródeł propozycje poprawek i projekt telemetrii:
nic nie zginęło, brakowała jedna drobna rekomendacja o przechowywaniu zapisów rozmów, dopisana do porządków na koncie. Jedyne ryzyko, o którym wiem:
zdanie decyzyjne bez żadnego ze słów-markerów nie weszło do kontroli. Skrypt zostaje w katalogu i można go odpalić po każdej zmianie.

## Co teraz

Kolejność uzgodniona 2026-09-22: audyt skilli, mapa walidacji, po każdym rozmowa — zrobione, a 23 września przejrzałem od nowa wszystkie domknięcia
(D1–D6, ostatnie D4) i poprawki są w tym pakiecie. Twoje decyzje z audytu skilli są podjęte, a mini-run na Opusie jest zrobiony i zaakceptowany (23 września).
Teraz panel decyzyjny w trzech runach na Opus 5.5, wyłącznie na Twój znak. Na końcu dwa raporty i plan wdrożenia w iteracjach.
