# Co dostanie panel projektowy (wersja dla Kacpra)

Data: 2026-09-22. To jest ludzka wersja pliku `PANEL-WEJSCIE.md`. Tamten jest pisany dla agentów panelu i dla Claude'a: gęsty, z odsyłaczami do każdego
źródła, po to, żeby trzej projektanci dostali identyczny zestaw założeń. Ten plik ma Ci opowiedzieć to samo w kolejności, w jakiej podejmowałeś decyzje,
i przy każdej rzeczy odpowiedzieć na pytanie, dlaczego tak, a nie inaczej. Nie ma tu nic, czego nie ma w wersji technicznej, i nie ma tu żadnej nowej decyzji.

## O co chodzi w tym dokumencie

Przez trzy dni zebraliśmy model kosztu, ocenę każdego reviewera, analizę uwag CodeRabbita, research zewnętrzny, cztery pomiary, krytyka kompletności
i pięć domknięć. Po drodze podjąłeś osiemnaście punktów decyzji. Leżą w pięciu dokumentach i w jednej długiej sekcji HANDOFF, a część z nich nadpisuje
wcześniejsze zapisy. Gdyby panel dostał to w tej postaci, każdy z trzech projektantów odczytałby sprzeczności po swojemu i porównywalibyśmy projekty
zbudowane na różnych założeniach.

Pakiet wejściowy zbiera to w jednym miejscu. Ten dokument tłumaczy, co w nim jest.

## Jak wygląda panel

Trzech niezależnych projektantów dostaje ten sam materiał i inny priorytet: jeden ma zbudować pipeline najtańszy, drugi najlepszy jakościowo, trzeci
hybrydę. Potem trzech sędziów ocenia projekty, sceptyk atakuje zwycięzcę, a synteza składa końcowy projekt. Około ośmiu agentów, wszyscy na Fable, bo tu
liczy się głębia rozumowania, nie wolumen. Panel idzie w trzech osobnych runach (projektanci, sędziowie, sceptyk), żeby wyczerpanie limitu w połowie nie
skasowało całości, a przed startem sprawdzamy stan limitu. Panel niczego nie buduje: jego wynikiem jest koncepcja docelowego pipeline'u i kolejność
wdrożenia, a kod powstaje dopiero faza po fazie, każda z własną miarą w telemetrii. Sędziowie mają dwa wymiary: koszt i jakość kodu mierzoną tym, ile poważnych uwag znajduje po nas CodeRabbit. Koszt wdrożenia
nie jest kryterium, bo zdecydowałeś, że zysk z lepszego procesu przewyższa koszt naprawy, a wdrożenie i tak pójdzie fazami. Szablon jako plugin nie jest
wariantem; zbadany, odłożony na później.

Zanim panel ruszy, jest jeszcze jeden krok: mini-run na małym zadaniu, który sprawdzi trzy rzeczy, o których dziś tylko zakładamy, że działają.
O tym na końcu.

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

**Ile daje odchudzenie kontekstu.** Pierwotna liczba trzydzieści do czterdziestu procent kosztu fazy była policzona dla wariantu, którego nie wybrałeś.
Po przeliczeniu dla Twojej konfiguracji zostaje dwadzieścia pięć do trzydziestu pięciu. Kolejność priorytetów się nie zmienia, bo następna zweryfikowana
oszczędność to osiem do dziesięciu procent. Mini-run ma to potwierdzić odczytem rzeczywistego kontekstu startowego.

**Model kosztu sprzed napraw.** Liczby „przed" opisują projekt oferty-online bez dziewięciu napraw z września. Uznałeś to za niską wagę: realną ocenę
da dopiero wdrożenie na prawdziwym projekcie. Idzie do raportu jako uwaga, nie jako ryzyko.

**Zatrzymanie na E2E.** Etap pierwszy zapisał: po zatrzymaniu runu na testach E2E powtarza się tylko tester, nie cały skład. Ty po etapie trzecim
zdecydowałeś, że test niewykonalny przez środowisko albo zewnętrzny limit nie zatrzymuje runu, tylko przełącza checkbox na manual z powodem, a run
idzie dalej. Wczoraj potwierdziłeś, że to druga wersja obowiązuje. Zapis z etapu pierwszego traci przedmiot: skoro run się nie zatrzymuje, nie ma
po czym robić powtórki.

---

## Część 2. Jedenaście rzeczy, które każdy z trzech projektów musi mieć

To są Twoje decyzje z sekcji 6a, przetłumaczone na wymogi. Projekt, któremu brakuje któregoś, jest niekompletny, niezależnie od priorytetu.

**Jeden. Allowlista narzędzi u każdego agenta pipeline'u, z plikami definicji per klasa roli.**
Problem: każdy agent na Twoim koncie startuje z opisami dziewięciuset narzędzi i trzystu skilli, czyli sześćdziesiąt dwa tysiące tokenów, z których
prawie żaden nie jest używany (498 z 514 agentów nie zawołało żadnego narzędzia MCP). Przyczyna: żaden z szesnastu plików agentów w szablonie nie ma
pola ograniczającego narzędzia, a trzydzieści sześć ról w ogóle nie ma pliku, bo orkiestrator woła je bez typu. Rozwiązanie: allowlista zbija start
do kilkunastu tysięcy; nośnikiem są pliki agentów, ale nie po jednym na rolę, tylko po jednym na klasę (maszyneria pomocnicza, orkiestracyjne,
reviewer, sceptyk, naprawiacz), bo prompty tych ról są i tak generowane w kodzie, a plik niesie wyłącznie ustawienia. Istniejące osiem plików zostaje
jako wyjątki. Co Ci to da: kilkanaście plików zamiast czterdziestu i największą pojedynczą oszczędność całej analizy.

**Dwa. Kontekst dobrany do klasy roli.** Jak w części 1: CLAUDE.md u tych, którzy patrzą na kod, wyłączony u maszynerii pomocniczej, skille builderów
zostają. Dlaczego skille zostają: działają, a dobieranie ich per jednostka pracy nie jest warte logiki w orkiestratorze.

**Trzy. Budżet instrukcji w trzech warstwach.**
Problem: policzyliśmy, ile poleceń naprawdę dostaje jeden reviewer. Wyszło około trzystu sześćdziesięciu pięciu, a licząc zdania w regułach, do siedmiuset.
Builder danych: pięćset trzydzieści siedem. Literatura mówi, że przy pięciuset instrukcjach model przestrzega około dwóch trzecich, a błędem jest ciche
pominięcie. To wyjaśnia, dlaczego czterdzieści pięć z sześćdziesięciu ośmiu defektów, które CodeRabbit znalazł po nas, miało regułę i właściciela,
a mimo to przeszło. Przyczyna: reguły dokładano latami, learned-patterns wchodził dwa razy (raz z reguł, raz w dossier), skille builderów niosą sto
siedemdziesiąt osiem poleceń. Rozwiązanie, które wybrałeś: warstwa stała na rolę poniżej stu pięćdziesięciu instrukcji, pilnowana testem szablonu
(pada przy edycji promptu, nigdy nie zatrzymuje runu); warstwa referencyjna bez limitu, którą orkiestrator dokleja po plikach jednostki, bo instrukcja
„przeczytaj X" jest pomijana jak każda inna; warstwa mechaniczna w linterze. Skille builderów nie są skracane, tylko dzielone. Co Ci to da: polecenia-listy
dostaną szansę, której nie miałyby dołożone do trzystu istniejących nakazów.

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
Dlaczego to ważne po domknięciu D1: z trzydziestu trzech findingów znalezionych po naprawie trzynaście urodziło się w naprawie, a wszystkie kodowe
były skutkiem naprawiania findingu z pierwszej rundy. Kontrola diffu nie złapała żadnego. Mniejszy diff naprawy to mniej takich odkryć.

**Dziesięć. Zakaz powtórek sekwencyjnych review.** Literatura i nasz pomiar zgadzają się: druga runda po pierwszej na tym samym kodzie kupuje jeden
prawdziwy defekt za cztery do pięciu fałszywych. Równoległe próbki pomagają, sekwencyjne szkodzą.

**Jedenaście. Polecenia-listy zamiast długich reguł, z warunkiem odwrotu.** To główny lek na ucieczki do bota i jedyny bez pomiaru, bo skuteczność
da się zmierzyć dopiero po wdrożeniu. Każdy projekt wpisuje warunek, przy którym się z tego wycofa.

**Dwanaście. Scalenie dev-plan z dev-docs w jeden skill.** Do wczoraj hipoteza otwarta dla panelu, od dziś wymóg. Odpalasz je zawsze po sobie i nic
między nimi nie robisz, a dev-docs przepisuje od jednej piątej do połowy planu. Każdy projekt ma zaprojektować scalony skill z budżetem tokenów,
na analizie tego, co oba dziś robią i gdzie przepalają kontekst. Dev-prep zostaje osobno, bo jest interaktywny.

**Trzynaście. Każda zmiana ma metrykę.** Projekt, który proponuje zmianę bez wskazania, po którym polu telemetrii poznamy, że zadziałała, jest
niekompletny. To wymóg oparty na mapie walidacji z części 6.

---

## Część 3. Rzeczy rozstrzygnięte wcześniej, które panel też musi wbudować

To ustalenia z etapów 1, 1b i 2, które nie przeszły przez Twoje decyzje, bo nikt ich nie kwestionował. Przy pierwszej wersji pakietu je pominąłem;
wyszły przy czytaniu obok źródeł. Najważniejsze:

Roster review z sześciu osi na pięć: performance zostaje zastąpiona narzędziami (limit rozmiaru bundle'a, advisors, pięć linii w correctness),
z warunkiem powrotu, jeśli bot znajdzie więcej niż jeden poważny defekt wydajnościowy na pięć faz. Security ma prompt do skrócenia o połowę.
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

Jedna teza się po drodze zawaliła i to jest dobra wiadomość: pomiary mówiły, że nowe findingi po naprawie to review kodu naprawczego. Domknięcie D1
pokazało, że w sześćdziesięciu procentach to defekty przeoczone w pierwszej rundzie. Panel wybiera między trzema równoległymi próbkami a jedną rundą
z lepszym sceptykiem na tym podziale, nie na tamtym.

---

## Część 6. Telemetria, czyli jak za miesiąc zobaczysz, co działa

**Gdzie był problem.** Dzisiejsza telemetria liczy wyłącznie tokeny wyjściowe, czyli dwa procent kosztu. Nie widzi poziomu agenta. Zapisuje ją agent
haiku, który dwa razy skasował plik z historią. Progi alarmowe, które stroiliśmy przez tygodnie, oceniały niewłaściwą wielkość.

**Co go powoduje.** Pełne dane leżą na dysku: dziennik runu ma etykietę, fazę i wynik każdego agenta; transkrypt agenta ma zużycie tokenów z pełnym
cennikiem, model, czasy i narzędzia; plik stanu zadania ma metryki fazy. Nikt ich nie składa. Sprawdziłem też dwie rzeczy, które ograniczają projekt:
skrypt workflowu nie ma dostępu do plików ani powłoki, więc orkiestrator nie dopisze rekordu sam, a dziennik nie zapisuje końcowego wyniku runu.
Status i powód zatrzymania zna tylko sesja główna.

**Co proponuję.** Jeden plik dopisywany wyłącznie na końcu, z kluczem, który uniemożliwia duplikaty, i trzy typy rekordu. Rekord agenta: klasa roli,
kontekst pierwszej tury (to jest bezpośrednia miara, czy allowlista działa), pełny cennik, narzędzia, czas, findingi u reviewerów, obalenia u sceptyków.
Rekord fazy: findingi per oś, checkboxy przełączone na manual z powodem, wynik bramek domknięcia, regresje po naprawie, koszt per etap. Rekord runu:
status z kategorią przyczyny zatrzymania. Skrypt w Node, będący portem skryptu, którym liczyłem model kosztu w etapie zerowym, plus skrypt raportu
miesięcznego z sześcioma zestawieniami: koszt, kontekst, jakość, niezawodność, budżet instrukcji, anomalie.

**Kiedy się uruchamia.** Trzy warianty, w każdym zero agentów. Główny: sesja główna po zakończeniu runu wywołuje skrypt z numerem runu, statusem
i powodem, bo tylko ona to zna; agent telemetrii znika z orkiestratora. Siatka: tryb skanu wszystkich runów, wołany z raportu miesięcznego i z doctora,
dopisuje każdy run bez rekordu, żeby nic nie zginęło po awarii. Do sprawdzenia w mini-runie: hook Stop, który robiłby skan automatycznie po każdej
odpowiedzi. Przegląd runów proponował jeszcze plik per run zamiast wspólnego; przy skrypcie, który nigdy nie nadpisuje, oba formaty są bezpieczne
i wybór zostaje na wdrożenie.

**Co Ci to da.** Po miesiącu jeden skrypt odpowie, ile kosztuje faza i kto ją zjada, czy odchudzenie kontekstu zadziałało, które osie znajdują, a które
tylko kosztują, na czym stają runy i czy ktoś nie przekroczył budżetu instrukcji. Bez powtarzania tej analizy.

**Twoja decyzja:** wariant główny z siatką przyjęty, hook do sprawdzenia w mini-runie.

**Jak poznamy, że zmiany działają.** Rekord to dopiero połowa. Druga połowa to mapa walidacji, którą zrobimy przed panelem: dla każdego z trzynastu
wymogów i każdego założenia z warunkiem odwrotu jedna linia z metryką, polem rekordu, punktem odniesienia sprzed zmiany i horyzontem, po ilu fazach
patrzymy. Potem kontrola w drugą stronę: czy rekord ma wszystkie pola, których mapa potrzebuje. Jeśli czegoś brakuje, dopisujemy teraz, nie po
wdrożeniu. Bez tego za miesiąc mielibyśmy dane, ale nie wiedzielibyśmy, na które patrzeć.

---

## Część 7. Co panel ma objąć albo jawnie zostawić

Trzynaście elementów szablonu, których żaden etap nie dotknął. Część już rozstrzygnąłeś: dwa martwe pliki reviewerów idą do usunięcia po
wykorzystaniu ich treści jako materiału do poleceń-list; hook sprawdzający typy zostaje, hook przypominający o obsłudze błędów wypada, gdy wejdzie
bramka ESLint; skill bugfix jest kandydatem do usunięcia; generator konfiguracji bota do poprawy. Reszta czeka na projekt: sześć agentów researchowych
wołanych ze skilli planowania, trzy skille (ideate, brainstorm, docs-update) bez ani jednego wystąpienia w analizie, drugi niezależny roster review
w skillu code-review, nieużyty mechanizm freshness-audit, szablony E2E i smoke, siedemdziesiąt cztery testy workflowów, które każdy projekt łamie,
treść skilli builderów do podziału na warstwy, prompt osi code-quality żyjący w dwóch miejscach. Każdy projekt musi powiedzieć przy każdym z nich:
obejmuję albo zostawiam, i dlaczego.

Do tego dochodzi audyt użycia wszystkich skilli szablonu, który zrobimy przed panelem: skrypt na danych z etapu zerowego policzy, który skill był
uruchamiany, ile razy, w ilu projektach i za ile, a który nigdy. Panel dostanie listę „używane, nieużywane, kandydaci do usunięcia" jako fakt,
a nie jako przeczucie.

---

## Część 8. Mini-run przed panelem

Godzina pracy na jednym małym zadaniu buildera, metodą markerów z pierwszego pomiaru. Pięć pytań: czy reguła wklejona przez orkiestrator do promptu
jest stosowana w kodzie; czy reguła dostarczona warunkowo jest stosowana (kontrola); czy treść skilla wstrzykniętego w definicji agenta jest stosowana,
czy tylko zajmuje kontekst; czy ten sam marker przeżywa w prompcie ze stu i z czterystu instrukcji; ile naprawdę wynosi kontekst startowy per klasa
roli. Odpowiedzi rozstrzygają wariant learned-patterns, czy skille builderów zostają bez zmian, i czy liczba dwadzieścia pięć do trzydziestu pięciu
procent się broni.

---

## Jak ten pakiet był sprawdzany

Pierwsza wersja była pisana z pamięci lektury. Druga runda sprawdziła trzy podejrzane miejsca i dwadzieścia siedem liczb. Trzecia czytała pakiet obok
źródeł zdanie po zdaniu i znalazła całą pominiętą kategorię (część 3). Czwarta poszła w drugą stronę: skrypt wyciągnął ze źródeł sto sześćdziesiąt
cztery jednostki z markerem decyzji i dla każdej wskazał odpowiednik w pakiecie; sto osiemnaście o niższym pokryciu przejrzałem ręcznie, dopisałem
dziewięć uzupełnień, a pozostałe czterdzieści cztery mają zapisaną klasyfikację, dlaczego pakiet ich nie potrzebuje. Jedyne ryzyko, o którym wiem:
zdanie decyzyjne bez żadnego ze słów-markerów nie weszło do kontroli. Skrypt zostaje w katalogu i można go odpalić po każdej zmianie.

## Co teraz

Kolejność uzgodniona 2026-09-22: audyt skilli, mapa walidacji, po każdym rozmowa. Potem mini-run na Opusie i panel w trzech runach na Fable, oba
wyłącznie na Twój znak. Na końcu dwa raporty i plan wdrożenia w iteracjach.
