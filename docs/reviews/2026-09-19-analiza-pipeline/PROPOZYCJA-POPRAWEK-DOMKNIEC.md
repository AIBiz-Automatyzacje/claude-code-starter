# Propozycja poprawek domknięć D1–D6 i D4 — przegląd na Opus 5.5

**Data:** 2026-09-23. **Charakter:** ponowny przegląd domknięć zrobionych na Fable 5.1, w tym samym standardzie co przegląd mapy walidacji
(`PROPOZYCJA-POPRAWEK-MAPY-WALIDACJI.md`). Szukam błędów w założeniach, liczbach i metodach, które zmieniają wnioski. Decyzje operatora
(HANDOFF 6a pkt 1–19) nie są tu podważane — podważane są liczby i wnioski, na których stoją.
**Zasada:** każda sekcja ma status PROPOZYCJA albo PRZYJĘTA. Dokumenty źródłowe zmieniam dopiero po akceptacji danej sekcji.
Nowe przeliczenia: skrypty `skrypty/d<N>r_*.py`, wyniki `dane/d<N>r-*.{txt,json}`. Zero agentów.

---

## D1 — skąd się biorą nowe findingi po naprawie

**Status: PRZYJĘTA 2026-09-23** — wprowadzona do POMIARY §4, ETAP3 §7, PANEL-WEJSCIE §2a/§4/§8, PANEL-WEJSCIE-DLA-OPERATORA, mapy walidacji,
HANDOFF (wiersz 3½, 6a pkt 19); stary wynik `dane/pomiar5-atrybucja-po-fixie.txt` oznaczony jako zastąpiony.
**Przeliczenie:** `skrypty/d1r_rewizja_atrybucji.py` → `dane/d1r-rewizja-atrybucji.{txt,json}` (repo oferty-online, git tylko do odczytu).

### Co się trzyma bez zmian

- **Metoda odtwarza się.** Oryginalny skrypt D1 uruchomiony dziś daje plik wynikowy identyczny bajt w bajt.
- **Numery linii nie dryfują.** W oknach między runami są wyłącznie commity naprawy, kontroli naprawy i dokumentacji, więc druga runda oglądała
  dokładnie ten kod, na którym liczony jest blame. Kontrola niezależna: w 37 z 41 findingów identyfikator z opisu stoi w odległości do pięciu
  linii od wskazanej linii. Cztery pozostałe nie zmieniają klasy (pliki w całości z naprawy albo w całości nietknięte).
- **Wszystkie findingi urodzone w naprawie to skutek naprawiania findingu z poprzedniej rundy,** kontrola diffu naprawczego nie złapała żadnego,
  a jedyny P1 urodził się w naprawie. To się trzyma i po rozszerzeniu próby jest mocniejsze (niżej).
- **Kierunek z decyzji 6a pkt 15** (naprawa tylko P1/P2, zakaz zmian poza zgłoszonym miejscem, żadnej dodatkowej rundy) — dane go wspierają
  bardziej niż w D1, nie mniej.

### Poprawka 1 (zmienia wniosek). Pół na pół, a nie 60 do 40

**Obecnie.** D1: 33 findingi = 39% urodzonych w naprawie, 42% przeoczonych w pliku naprawy, 18% przeoczonych w kodzie nietkniętym. Wniosek
w pakiecie panelu: „składnik recall rundy 1 (60%) jest WIĘKSZY niż składnik »nowy kod« (40%)”, a w tabeli tez „D1 obaliło w 60%”.

**Proponuję.** „Oba składniki mają podobną wagę: około połowy nowych findingów to przeoczenia wcześniejszej rundy, około połowy to kod urodzony
w naprawach. Różnica mieści się w szumie tej próby. Teza »to wyłącznie review kodu naprawczego« była za mocna; teza »to głównie przeoczenia« też.”

**Dlaczego.** Trzy powody, każdy policzony:

- **Blame widzi linię, a nie przyczynę.** W trzech findingach linia jest stara, ale defekt stworzyła naprawa: komentarz opisujący sondy, które
  naprawa usunęła; duplikat stałej, którą naprawa dopiero wprowadziła (sprawdzone w historii repo); zdarzenie analityczne wysyłane mimo nowego
  stanu „błąd”, który wprowadziła naprawa. D1 zaliczyło je do przeoczeń.
- **Pominięta trzecia para** (poprawka 2).
- **Próba jest mała.** 44 findingi kodowe z trzech par, dwóch zadań, jednego repo i jednego tygodnia. Przeoczenia to 22 z 44, czyli 50%,
  z przedziałem ufności 36–64% (bez uwzględnienia, że findingi z jednej pary nie są niezależne, więc realny przedział jest szerszy). Wynik
  zależy od moich ocen: bez najsłabszej z nich 52%, bez żadnej 57%. W żadnym wariancie nie wychodzi przewaga, którą da się obronić.
  Dla samych P1/P2: 7 przeoczeń wobec 8 urodzonych w naprawach.

### Poprawka 2 (zmienia wniosek). Trzecia para i łańcuch napraw

**Obecnie.** D1 wzięło dwie pary: 9b faza 4 i samodzielna faza 3 run 1→2. Pomiar 4 ma trzecią parę z kodem zmienionym między runami
(samodzielna faza 3 run 2→3, piętnaście plików), a krytyk w ETAP3 §3 wprost ją wymienił. Nie weszła.

**Proponuję.** Włączyć ją. Razem 46 findingów, 44 kodowe. Nowy fakt, którego dwie pary nie pokazywały: **cztery findingi trzeciej pary, w tym
dwa P2, to defekty urodzone w naprawie po rundzie 1, których pełna runda 2 nie znalazła.** Znalazła je dopiero runda 3. Jeden z nich to P2
o nowo założonym członku, który przez ścieżkę powrotu dodaną w naprawie trafia na ekran zgody bez przyjęcia regulaminu. Kontrola diffu tamtej
naprawy też ich nie złapała.

**Dlaczego.** To zmienia wagę argumentu. Kod naprawczy nie jest tylko „nowym kodem, którego nikt nie oglądał”: pełna runda review
po naprawie oglądała go i też przepuściła. Źródłem trzeba więc sterować po stronie naprawy (mały diff, zakaz zmian poza zgłoszonym miejscem),
a nie liczyć na następną rundę. To wzmacnia decyzję 6a pkt 15 i pomiar bota z mapy walidacji (pliki po naprawie mają trzy razy więcej
poważnych uwag bota na sto plików: 14,0 wobec 4,7) — dwa niezależne źródła pokazują to samo.

### Poprawka 3 (zmienia wniosek). Lepszy sceptyk nie leczy przeoczeń

**Obecnie.** D1 i dopisek w POMIARY §4: „składnik B adresuje n równoległych próbek albo lepszy sceptyk”. Pakiet panelu (§4): wybór „n=3
równoległe próbki kontra jedna runda z lepszym sceptykiem” rozstrzygać na podziale z D1, bo „dotyczy WIĘKSZEGO składnika”.

**Proponuję.** Zapisać, że przeoczenia zmniejsza tylko to, co poszerza zasięg review: równoległe próbki, polecenia-listy, wycinek wiedzy
w prompcie. Sceptyk działa po drugiej stronie — odsiewa fałszywe alarmy, nie znajduje brakujących defektów. Wybór „n=3 kontra sceptyk” to
wybór, czy kupować zasięg za dodatkowy koszt. D1 mówi tylko, ile zasięgu brakuje: co najmniej 22 z 44 kodowych findingów drugiej rundy,
w tym 7 P1/P2 w trzech powtórkach dwóch faz, istniało w kodzie, który oglądała runda pierwsza. Podział pół na pół niczego w tym wyborze nie rozstrzyga.

**Dlaczego.** Obecne sformułowanie każe panelowi wybierać na podstawie liczby, która nie ma związku z jednym z wariantów. ETAP3 zapisał
„jeśli podział jest odwrotny, panel wybierze odwrotnie” — przy podziale pół na pół ta reguła nie wskazuje żadnego kierunku.

### Porządkowe

- **Kontrola diffu naprawczego.** Zamiast „nie złapała żadnego z 10” — „nie złapała żadnego z 15 kodowych urodzonych w naprawie w oknie (12 po linii,
  3 po przyczynie) ani 4 z łańcucha”; do tego 3 rozjazdy CLAUDE.md po naprawie, jak w D1 (razem 18 urodzonych w naprawie w oknie).
- **Opis progu dopasowania w POMIARY §4 nie zgadza się ze skryptem.** Tekst mówi „podobieństwo opisu powyżej 0,3 albo różnica linii do trzech”,
  a skrypty (pomiar 4 i D1) liczą podobieństwo powyżej 0,45 w tym samym pliku, bez linii. Przeliczenie użyło luźniejszego kryterium z opisu:
  na parach 1–2 wynik bez zmian (19 i 14 nowych), w trzeciej 13 nowych zamiast 14. Do poprawy zdanie w POMIARY §4, liczby zostają.
- **Czym są te findingi.** 29 z 44 to P3. Wszystkie przeszły sceptyków drugiej rundy, ale nikt poza nimi nie potwierdził, że są realne.
  Wniosek o zasięgu opieram więc przede wszystkim na P1/P2 (15 kodowych).

### Co się zmieni po akceptacji

Liczby i wniosek D1 w: dopisku POMIARY §4 i jego rozstrzygnięciu, ETAP3 §7 (wiersz D1), PANEL-WEJSCIE §2a (wariant n=3 „rozstrzygać z D1”),
§4 (D1) i §8 (teza „nowe findingi po fixie”), PANEL-WEJSCIE-DLA-OPERATORA (punkt dziewiąty części 2 i akapit o tezie, która się zawaliła),
mapie walidacji obu wersji (kontekst przy pętli naprawczej), HANDOFF wiersz 3½. Nowa wersja zdania dla panelu: „nowe findingi po naprawie są
pół na pół przeoczeniami i kodem urodzonym w naprawach; kod naprawczy przechodzi także przez pełną kolejną rundę (łańcuch); wybór n=3 kontra
sceptyk nie wynika z tego podziału — to decyzja o kupowaniu zasięgu”.

---

## D2 — ile instrukcji dostaje jeden agent

**Status: PRZYJĘTA 2026-09-23 (poprawki 1–4 i porządkowe, w tym zmiana jednostki w teście budżetu)** — wprowadzona do ETAP3 §7, PANEL-WEJSCIE
§2 pkt 3, §4, §6, §8, §11, PANEL-WEJSCIE-DLA-OPERATORA część 2 pkt 3, mapy walidacji obu wersji, HANDOFF (wiersz 3½, 6a pkt 18, 6a pkt 19).
**Przeliczenie:** `skrypty/d2r_rewizja_budzetu.py` → `dane/d2r-rewizja-budzetu.{txt,json}`, oceny ręczne próbek `dane/d2r-oceny-probki.json`,
same próbki `dane/d2r-probka-*.json`. Źródło IFScale sprawdzone w publikacji (arXiv 2507.11538).

### Co się trzyma bez zmian

- **Liczby odtwarzają się.** Ten sam licznik na dzisiejszych plikach daje dla reviewera security dokładnie 365.
- **Licznik łapie w większości prawdziwe polecenia.** Na losowej próbce 30 jednostek reviewera 29 to polecenia, u buildera 23 z 30.
- **Dubel learned-patterns jest prawdziwy.** Workflow review wkleja cały plik do dossier („w CAŁOŚCI, bez skracania”), a ten sam plik
  reviewer ma już w kontekście z reguł. To 13 tysięcy tokenów na reviewera za nic, tak jak mówi D2.
- **Kierunek decyzji po D2 (trzy warstwy, warstwa stała poniżej 150, test szablonu, zero STOP-ów w runie) ma teraz dodatkowe oparcie:**
  około dwóch trzecich poleceń reviewera to polecenia warunkowe — dotyczą konkretnej technologii albo sytuacji (Supabase, HTML, kolejki,
  kontener). To dokładnie ten materiał, który ma zejść do warstwy doklejanej po plikach jednostki. Po jego zdjęciu zostaje około 110 poleceń
  obowiązujących zawsze, czyli cel poniżej 150 jest osiągalny bez wycinania wiedzy.

### Poprawka 1 (zmienia wniosek). Progi IFScale są w innej jednostce

**Obecnie.** „Reviewer ~310–320, builder ~520–530 = pasmo IFScale 150–500 (84–99% → ~68% przestrzegania)”. W wersji dla operatora: „przy
pięciuset instrukcjach model przestrzega około dwóch trzecich. To wyjaśnia, dlaczego 45 z 68 defektów miało regułę i przeszło”.

**Proponuję.** „IFScale pokazuje kierunek: im więcej poleceń naraz, tym więcej cichych pominięć, a wcześniejsze polecenia wygrywają z późniejszymi.
Procentów z badania nie da się przenieść na nasze liczby, bo mierzą co innego. Nasz własny punkt na tej krzywej da dopiero mini-run, dodatek (d):
ten sam marker w prompcie około 100 i około 400 instrukcji”. Zdanie „to wyjaśnia 45 z 68” zamienić na „jest z tym zgodne”.

**Dlaczego.**

- **W IFScale instrukcja to „użyj w raporcie dokładnie słowa X”.** Wszystkie obowiązują naraz, są od siebie niezależne i sprawdza je wyrażenie regularne.
- **U nas jest inaczej.** W próbce reviewera 19 z 30 poleceń to polecenia warunkowe. Jedna reguła learned-patterns ma średnio prawie sześć zdań
  nakazowych, a przestrzeganie wymaga osądu, nie wstawienia słowa. „365 u nas” i „500 w IFScale” to liczby różnych rzeczy.
- **Cytowane procenty to najlepsze modele z badania.** Modele Claude w tym samym badaniu tracą szybciej: Opus 4 ma 94,6% przy 150 poleceniach,
  67,9% przy 250 i 44,6% przy 500. Gdyby ktoś upierał się przy przeniesieniu liczb, wypadłoby gorzej, nie lepiej. Badanie jest z lipca 2025,
  więc nasze modele pewnie są przesunięte. Tym bardziej potrzebny jest nasz pomiar, nie cudzy.
- **„To wyjaśnia 45 z 68” jest mocniejsze niż dane.** Te same ucieczki tłumaczą też inne przyczyny. Reguła była na przykład warunkowa i nie
  zadziałała w tym kontekście, albo była sformułowana zbyt ogólnie. Nie mamy pomiaru, który odróżnia te przyczyny.

Decyzja o budżecie stoi bez zmian. Cel „poniżej 150” to cel projektowy, a nie próg wzięty z badania.

### Poprawka 2 (zmienia liczbę). Górna granica liczyła learned-patterns dwa razy

**Obecnie.** Górna granica reviewera ~650–710, buildera ~710. Wersja dla operatora: „licząc zdania w regułach, do siedmiuset”.

**Proponuję.** Reviewer do około 500, builder do około 670.

**Dlaczego.**

- **Reviewer.** Dubel to te same zdania wklejone drugi raz. Kosztuje tokeny (poprawnie policzone), ale nie przynosi nowych poleceń, a IFScale liczy
  różne polecenia. Bez dubla: 365 − 38 − 38 + 211 = 500.
- **Builder.** D2 wzięło najdłuższy z pięciu ostatnich promptów zadania (97 poleceń), a mediana ma 57. Na medianie builder ma dziś 497
  zamiast 537, górna granica wynosi 670, a po podjętych decyzjach około 480–490 zamiast 520–530.
- **Wniosek się nie zmienia.** Oba nadal są wyraźnie ponad 150.

### Poprawka 3 (zmienia sposób wdrożenia decyzji). Licznik zależy od formy zapisu

**Obecnie.** Decyzja 6a pkt 18: warstwa stała poniżej 150 „liczona skryptem tą samą metodą co D2”, jako test szablonu.

**Proponuję.** Zostawić cel, test i brak STOP-ów, ale zmienić definicję jednostki w teście:

- Warstwa stała roli ma jeden jawnie oznaczony blok poleceń (stały nagłówek). Każde polecenie to jedna pozycja listy w tym bloku.
- Test liczy pozycje w bloku.
- Test pada także wtedy, gdy poza blokiem pojawia się zdanie nakazowe. Polecenie nie może się ukryć w prozie.

**Dlaczego.**

- **Licznik D2 liczy każdą pozycję listy, a zdanie prozą tylko wtedy, gdy ma słowo nakazu.** U reviewera 156 z 365 jednostek (43%) to pozycje
  list bez takiego słowa, u buildera 282 z 497 (57%). Ta sama treść przepisana prozą w ogóle nie byłaby liczona.
- **Test tą metodą nagradza przepisanie list na prozę.** Czyli dokładnie odwrotnie niż polecenia-listy, które sami zalecamy (ETAP1B, IFScale:
  krótkie polecenia na początku). Autor promptu, który „zbija” liczbę, zrobi prompt gorszym, a test przejdzie.
- **Jawny blok zamyka obie drogi.** Liczba poleceń staje się tym, co autor świadomie wpisał, a nie tym, co wyłapał regex.

To zmienia szczegół decyzji operatora, więc wymaga Twojej zgody.

### Poprawka 4 (zmienia uzasadnienie i oczekiwania; dopisana po rozmowie z operatorem)

**Obecnie.** Budżet instrukcji jest uzasadniany procentem przestrzegania z IFScale. Polecenia-listy mają domknąć ~60–70% uwag B, bo dziś reguły
toną w tle 300–500 nakazów. Dodatek (d) mini-runu, czyli 100 kontra 400 instrukcji, jest dopiskiem.

**Proponuję.**

- **Uzasadnienie budżetu: trafność i koszt.** Około dwóch trzecich poleceń reviewera nie dotyczy kodu, który ogląda. Zdjęcie ich do warstwy
  referencyjnej opłaca się niezależnie od krzywej przestrzegania: mniej rozproszenia i mniejszy kontekst w każdej turze.
- **Oczekiwania wobec poleceń-list niższe.** D1 (połowa nowych findingów to przeoczenia w oglądanym kodzie) i etap 1b (164 z 200 uwag B
  w zakresie promptu, a mimo to przeoczone) wskazują raczej na granicę uwagi i osądu przy czytaniu kodu niż na nadmiar reguł. Założenie „60–70%”
  zostaje z warunkiem odwrotu, ale nie jest oczekiwanym wynikiem.
- **Mini-run (d) jako test rozstrzygający.** Jeśli marker przy ~400 instrukcjach ginie wyraźnie częściej niż przy ~100, liczba poleceń jest
  u nas dźwignią jakości, a budżet 150 celem jakościowym. Jeśli nie ginie, budżet zostaje jako porządek i koszt, a główną dźwignią jakości są małe
  naprawy (D1) i ewentualnie równoległe próbki (decyzja o kupowaniu zasięgu).

**Dlaczego.** Po poprawce 1 procenty z IFScale nie opisują naszych poleceń. Decyzja o trzech warstwach stoi, ale panel nie powinien budować
na liczbie, której nie zmierzyliśmy.

### Porządkowe

- **„Dolna granica” (same pozycje list) nie jest dolną granicą.** Liczy też rzeczy, które poleceniami nie są. W próbce buildera 7 z 30 to spis treści,
  frontmatter skilla, listy „kiedy używać tego skilla” albo opis katalogów. Jednocześnie pomija polecenia zapisane prozą bez słowa nakazu.
  Proponuję nazwę „liczba pozycji list”.
- **Pliki od D2 się nie zmieniły** (CLAUDE.md 21 008 znaków, learned-patterns 46 897, coding-rules 11 016 — jak w D2), więc przeliczenie
  porównuje to samo.
- **Próbka ma 30 jednostek na rolę, więc udziały są przybliżone.** Polecenia zawsze obowiązujące u reviewera: 10 z 30, przedział 19–51%.
  „Około 110” to rząd wielkości, nie liczba do testu.

### Co się zmieni po akceptacji

Liczby i wniosek D2 w: ETAP3 §7 (wiersz D2 i wniosek dla panelu), PANEL-WEJSCIE §4 (D2) i §2 pkt 3 (definicja jednostki w teście — tylko po
akceptacji poprawki 3), PANEL-WEJSCIE-DLA-OPERATORA część 2 punkt trzeci, mapa walidacji obu wersji (wpis §2 pkt 3, punkt odniesienia),
HANDOFF wiersz 3½ i 6a pkt 18 (dopisek przy „tą samą metodą”, jeśli poprawka 3 przejdzie), rekord telemetrii bez zmian (`agent.instrukcje_stale`
bierze liczbę z testu, więc zmiana definicji w teście przechodzi sama).

---

## D3 — mapa ról i klasy agentów

**Status: PRZYJĘTA 2026-09-23, z pomiarem punktu odniesienia w mini-runie (bez osobnego przebiegu)** — wprowadzona do PANEL-WEJSCIE §4/§11/§12,
ETAP3 §7, mapy walidacji obu wersji (§2 pkt 1 i 2), PANEL-WEJSCIE-DLA-OPERATORA (część 2 pkt 1, część 8), `dane/d3-mapa-rol-agentow.txt`, HANDOFF.
**Korekta z przeglądu D5 (poprawka 7, przyjęta):** zdanie „po ścięciu CLAUDE.md nie było żadnego pełnego runu” jest fałszywe — run 20.09 (85 agentów)
pracował z CLAUDE.md 17,8k zn na gałęzi zadania; to pierwszy punkt odniesienia, mini-run (e) = potwierdzenie. Treść poniżej zostaje jako zapis przeglądu.
**Przeliczenie:** `skrypty/d3r_kontekst_per_klasa.py` → `dane/d3r-kontekst-per-klasa.{txt,json}` (repo oferty-online, git tylko do odczytu;
telemetria z `agents.csv` + pierwsza odpowiedź API każdego agenta z transkryptu).

### Co się trzyma bez zmian

- **Mapa ról jest kompletna dla sześciu workflowów pipeline'u.** Etykiety w obecnych workflowach szablonu pokrywają się z wierszami mapy.
  Liczba 45 slotów (36 bez pliku, 9 z plikiem, 8 plików) się zgadza. Zero `agentType` w autopilocie i zero plików z `tools:` — potwierdzone.
- **Prompt osi review w dwóch miejscach** (plik agenta i fokus w workflowie) — potwierdzone w kodzie.
- **Decyzja „pliki agentów per klasa roli”** stoi. Poniżej poprawiam jej uzasadnienie, nie ją samą.

### Poprawka 1 (zmienia wniosek). Kontekst per klasa z D3 nie nadaje się na punkt odniesienia

**Obecnie.** D3: „telemetria pokazuje trzy klasy po kontekście na turę: mechaniczne 86–102k, orkiestracyjne 119–168k, reviewerzy 193–224k, buildery 238k”.
Mapa walidacji bierze jako punkt „dziś” kontekst pierwszej tury z całego okresu (67–118k) i porównuje z nim efekt `tools:`.

**Proponuję.**

- **Nowy punkt odniesienia.** Kontekst pierwszej tury per klasa zmierzony na obecnym stanie repo, po ścięciu CLAUDE.md, a przed wprowadzeniem `tools:`.
  Daje go dodatek (e) mini-runu. Stare liczby zostają jako tło.
- **Reguła porównań `ctx_start` w telemetrii.** Porównujemy tylko przy podobnym rozmiarze stałych plików (pola `faza.wiedza.claude_md_zn` i rozmiar
  indeksu wiedzy już są w rekordzie). Efekt `tools:` najczyściej mierzy para „z i bez” na tym samym stanie repo.

**Dlaczego.** Telemetria pochodzi z okresu, w którym stały kontekst rósł z tygodnia na tydzień:

- **CLAUDE.md** w oferty-online miał 13,8 tysiąca znaków na koniec sierpnia, 39 tysięcy tydzień później, 46 tysięcy 12 września i 87 tysięcy
  17 września. 21 września został ścięty do 21 tysięcy.
- **learned-patterns** urósł w tym czasie z 7,8 do 45 tysięcy.
- **Kontekst pierwszej tury rósł równolegle we wszystkich klasach.** Mechaniczne z 55 do 101 tysięcy tokenów, reviewerzy z 76 do 145, buildery
  z 89 do 160.
- **Po ścięciu CLAUDE.md nie było ani jednego pełnego runu.** Ostatni agent w danych jest z 17 września, a jedyny późniejszy duży run z 20 września
  jest jeszcze sprzed ścięcia. Liczby „dziś” opisują więc żaden konkretny stan, tylko średnią z epok, które różnią się prawie dwukrotnie.
- **Porównanie z nimi po wdrożeniu `tools:` pokaże zysk, którego część da samo ścięcie CLAUDE.md.** Pliki projektu tłumaczą około 32 tysięcy
  z 46–75 tysięcy przyrostu. Reszta (prompty zadań, wersja narzędzia, zestaw MCP i skilli konta) nie ma dziś wyjaśnienia, co tym bardziej
  wymaga punktu odniesienia z jednej epoki.

### Poprawka 2 (zmienia wniosek). CLAUDE.md nie tłumaczy różnicy między klasami

**Obecnie.** D3: „różnica reviewer vs mechaniczny (~120k na turę) to CLAUDE.md 89k zn z tamtego okresu + dossier + czytane pliki”.

**Proponuję.** „Różnica w średnim kontekście na turę to głównie praca: reviewer ma medianę 25 tur i czyta pliki, mechaniczny 5 tur. Na starcie
różnica wynosi około 40 tysięcy, a większość z niej to model. Haiku startuje od około 93 tysięcy, opus od około 127 tysięcy przy tej samej
konfiguracji bez pliku agenta. CLAUDE.md dostają dziś obie klasy, więc różnicy nie tłumaczy.”

**Dlaczego.**

- **Średni kontekst na turę zależy od tego, ile agent pracuje, a nie od tego, jak jest skonfigurowany.** Nie da się go więc użyć ani do grupowania
  ról według ustawień, ani do sprawdzania `tools:`.
- **Model okazuje się osobnym czynnikiem stałego narzutu.** Pięć agentów orkiestracyjnych na haiku ma ten sam start co mechaniczne na haiku.
  Próba jest mała, ale kierunek jest wyraźny. Cel „~4,5 tysiąca dla mechanicznych” trzeba sprawdzić osobno per model.

### Poprawka 3 (porządkowa). Uzasadnienie klas ról

**Obecnie.** 6a pkt 18: „telemetria D3 pokazuje 4–5 zestawów ustawień”.

**Proponuję.** „Klasy wynikają z ustawień, których rola potrzebuje: model, czy patrzy na kod (CLAUDE.md), czy edytuje (Edit, skille),
czy potrzebuje MCP. Telemetria pokazuje poziomy kontekstu w trakcie pracy, nie zestawy ustawień.”

**Dlaczego.** Decyzja jest dobra, ale oparta na liczbie, która mierzy co innego (poprawka 2).

### Poprawka 4 (porządkowa). Siódmy workflow

`freshness-audit-wf` ma cztery role (inwentarz, weryfikacja, sceptyk, scribe), a mapa ich nie obejmuje. Audyt skilli (D6) zostawił go
do decyzji operatora. Do mapy wystarczy jedno zdanie: poza zakresem do tej decyzji, a jeśli zostaje, jego role przechodzą na pliki klas
jak reszta.

### Ustalenie dodatkowe dla panelu (fakt, bez zmiany decyzji)

Wzrost stałego kontekstu o 46–75 tysięcy tokenów w trzy tygodnie, w jednym projekcie, bez zmiany pipeline'u, to najmocniejszy dowód
na decyzje 6a pkt 1 i 17: żaden skill nie dopisuje do CLAUDE.md, learned-patterns wychodzi z ładowania bezwarunkowego. Bez tych decyzji
każdy zysk z `tools:` zjadłby wzrost plików w ciągu kilku tygodni.

### Co się zmieni po akceptacji

- **D3 i punkty odniesienia:** `dane/d3-mapa-rol-agentow.txt` (dopisek korekty), PANEL-WEJSCIE §4 (D3) i §12 (przykład `tools:` „vs dziś 67–118k”),
  mapa walidacji obu wersji (wpis §2 pkt 1: punkt odniesienia i reguła porównań).
- **Uzasadnienie decyzji:** HANDOFF 6a pkt 18 (uzasadnienie klas) i wiersz 3½.
- **Mini-run:** PANEL-WEJSCIE §11 i wersja operatora część 8. Dodatek (e) staje się pomiarem punktu odniesienia per klasa i per model.
- **Wersja operatora:** fragmenty o klasach ról.

---

## D5 — rekord telemetrii i miejsce jego zapisu

**Status: PRZYJĘTA 2026-09-23 (w całości, poprawki 1–7 i porządkowe)** — wprowadzona do `dane/d5-telemetria-rekord.txt` (§8 + dopiski
w §0–§7), PANEL-WEJSCIE §1 pkt 4/§2 pkt 5/§4/§8/§11/§12, PANEL-WEJSCIE-DLA-OPERATORA (część 6, fragmenty o D3), mapy walidacji obu wersji,
`dane/dane-digest.md` §0, `dane/d3-mapa-rol-agentow.txt`, HANDOFF (§3 pkt 1–2, wiersz 3½, 6a pkt 19). Dźwignia 25–35% — przeliczenie w D4.
**Przeliczenie:** `skrypty/d5r_wykonalnosc_rekordu.py` → `dane/d5r-wykonalnosc-rekordu.{txt,json}` (wszystkie 156 runów na dysku, oba formaty
journala, repo projektów i historia szablonu tylko do odczytu) oraz `skrypty/d5r_koszt_output.py` → `dane/d5r-koszt-output.txt` (model kosztu
etapu 0 przeliczony na tych samych 2 941 agentach).

### Co się trzyma bez zmian

- **Źródła są na dysku i wystarczają bez agentów.** Journal, transkrypt agenta i plik meta dają koszt, tury, kontekst pierwszej tury, narzędzia,
  czasy i wynik strukturalny każdego agenta. Skrypt workflowu nie ma dostępu do plików, więc zapis musi być poza workflowem — to się zgadza.
- **Identyfikator agenta jest unikalny.** Żaden z 3 314 agentów nie występuje w dwóch runach, także po wznowieniach. Klucz rekordu agenta jest bezpieczny.
- **Pola wejścia i cache są liczone poprawnie.** W obrębie jednej odpowiedzi API różni się tylko liczba tokenów wyjściowych (poprawka 6).
- **Findingi i werdykty dają się policzyć.** Wagi P1/P2/P3 są w wynikach reviewerów obu formatów, werdykty sceptyków w polach `realny`/`werdykty`.
- **Etykieta, grupa i faza są dostępne także dla starych journali**, tylko z innego miejsca niż zakładał D5 (poprawka 1): etykietę i grupę ma
  3 286 z 3 314 agentów (28 starych bez niej — dla nich zostaje klasyfikacja po prompcie z `koszt_agentow.py`), numer fazy 2 555 z 2 891 agentów
  autopilota, 335 to agenci poziomu runu (bootstrap, zakończenie, compound, complete), jeden bez fazy.

### Poprawka 1 (zmienia wniosek). Status i powód runu leżą na dysku — sesja główna nie musi ich przekazywać

**Obecnie.** D5 §1(e): „status i powód runu zna tylko sesja główna”, więc wariant A to krok w skillach, w którym sesja główna po zakończeniu runu
woła skrypt z argumentami `--status` i `--powod`. Siatka B (skan) ustala status z ostatniej etykiety w journalu, a run, którego ostatni agent nie ma
wyniku, uznaje za trwający i pomija. „~100 starszych journali nie ma etykiet i grup” — HANDOFF i D6 traktują to jako lukę.

**Proponuję.**

- **Skan jest głównym zapisem.** Czyta plik, który harness Claude Code zapisuje po każdym runie w katalogu sesji (`workflows/<run>.json`).
- **Wariant A odpada.** Znika krok w skillach, a razem z nim pole `zrodlo_statusu`. Status NIEZNANY zostaje tylko dla runu bez tego pliku (awaria sesji).
- **Wyzwalacz C (hook Stop) zostaje do sprawdzenia w mini-runie** jako to, co pilnuje, żeby skan przeszedł na czas.

**Dlaczego.**

- **Plik jest dla 156 ze 156 runów, w obu formatach journala.** Ma zwrócony wynik (status OK/STOP i powód, cały obiekt raportu), status harnessu
  (completed / killed / failed z treścią błędu), nazwę workflowu, argumenty (zadanie), czas trwania, wpisy `log()` i pełny skrypt, który się wykonał.
  Ma też listę agentów z etykietą, grupą i numerem próby (ostatnia próba każdego wywołania; wcześniejsze dopasowuje się po kluczu wywołania
  z journala) — także dla 115 starych journali bez tych pól.
- **Heurystyka z D5 trafia 32 z 55 runów autopilota.** Wszystkie 20 OK rozpozna, ale STOP tylko 12 z 30, a przerwane i nieudane (5) w ogóle.
  Liczone na ostatnim agencie przed agentem telemetrii, bo ten znika.
- **Reguła „ostatni agent bez wyniku = run w toku” zgubiłaby na zawsze 4 zakończone runy,** w tym wszystkie 3 przerwane (killed). Nigdy nie trafiłyby do pliku.
- **Mapa walidacji (§2 pkt 5) mierzy udział statusu NIEZNANY.** Przy samym skanie według D5 wyszłoby 23 z 55 (42%), a z plikiem harnessu zero.
- **Skill, który ma „zawsze wywołać skrypt”, to kolejna instrukcja do pominięcia.** Mechaniczny skan jej nie potrzebuje.
- **Retencja.** Najstarszy transkrypt na dysku jest z 3 sierpnia (około 7 tygodni, `cleanupPeriodDays` nieustawione). Skan musi przejść w tym oknie,
  więc wyzwalacz (hook albo doctor przy każdym runie) jest potrzebny, a sam raport miesięczny to za rzadko.

Decyzja operatora z 6a pkt 19 (zero agentów, skrypt po runie, siatka obowiązkowa) stoi. Zmienia się tylko to, że jej wariant A okazuje się zbędny.

### Poprawka 2 (zmienia projekt zapisu). Wznowienia i dwie sesje naraz — „ostatni wygrywa przy odczycie”

**Obecnie.** Klucz `run|typ|id`. Skrypt czyta istniejące klucze, nie dopisuje dubli, nigdy nie nadpisuje. §6: jeden plik JSONL albo plik per run, „decyzja przy wdrożeniu”.

**Proponuję.**

- **Rekordy `agent` — bez zmian:** dopisz, jeśli klucza nie ma.
- **Rekordy `run` i `faza` — nowa wersja przy każdej zmianie:** z polem `ts`. Raport bierze ostatnią wersję per klucz.
- **Zapis:** jedno dopisanie na partię wierszy.
- **Poprawność nie zależy od sprawdzania kluczy przed zapisem.** Deduplikacja przy odczycie; blokada (np. katalog-zamek) tylko jako oszczędność pracy.

**Dlaczego.**

- **Wznowienie nie tworzy nowego runu.** Wszystkie 9 wywołań z `resumeFromRunId` (5 runów, jeden wznowiony w innej sesji) zwróciło ten sam identyfikator.
  Nowi agenci dopisują się do tego samego katalogu, a wynik i status runu się zmieniają. Rekord `run` zapisany skanem po awarii jest więc nieaktualny,
  a reguła „klucz istnieje → nie dopisuj” zablokowałaby wersję końcową na zawsze. Skill autopilota opisuje wznowienie po awarii jako normalny tryb pracy.
- **Ponowne próby tego samego wywołania są częste.** Klucz wywołania powtarza się 41 razy, a 63 agentów z wcześniejszych prób nie ma na liście harnessu.
  Rekord agenta potrzebuje więc pola `proba` i wyniku `blad` (typ `failed` w journalu), żeby koszt ponowień był widoczny.
- **Wyścig nie jest teoretyczny.** Z 7 518 końców odpowiedzi w sesjach głównych 6,6% ma koniec odpowiedzi innej sesji w ciągu 2 sekund (10,4%
  w ciągu 10 s). Przy skanie w hooku Stop dwa procesy przeczytają „jakich kluczy brak” i oba dopiszą to samo. Deduplikacja przy odczycie
  czyni to nieszkodliwym bez względu na format pliku.

### Poprawka 3 (zmienia źródło pola). Wersja szablonu: sha repo projektu nie mówi, co się wykonało

**Obecnie.** Pole `szablon` = sha ostatniego commita dotykającego `.claude/` w repo projektu. Mapa walidacji (§6) dzieli nim epoki „przed/po iteracji N”.

**Proponuję.**

- **Pole `szablon` z trzech części:**
  - `marker` — treść `.claude/.template-version`, sha szablonu z ostatniej synchronizacji, albo null;
  - `skrypt_sha` — hash skryptu głównego workflowu z pliku harnessu, czyli dokładnie to, co się wykonało;
  - `zgodny` — czy ten hash zgadza się z plikiem dostarczonym przez synchronizację.
- **Do `zgodny` sync-template zapisuje w manifeście hash każdego pliku.** Dziś manifest ma same ścieżki. To jedna kolumna w skrypcie synchronizacji: WYMAGA ZMIANY.
- **Workflowy-dzieci:** skrypt porównuje bieżące pliki z manifestem i oznacza, jeśli któryś zmienił się po starcie runu. Ich skryptów harness nie przechowuje.

**Dlaczego.**

- **Commit w repo projektu to wersja projektu, nie szablonu.** Nie widać w nim zmian niezacommitowanych, a jedno z 11 repo z autopilotem nie ma gita.
- **Znacznika wersji brak w 6 z 11 repo.** Liczba obejmuje sam szablon i jego wersję mobilną.
- **Lokalne zmiany są powszechne.** 33 z 55 runów autopilota wykonało skrypt, którego nie ma w żadnej wersji historii szablonu: oferty-online 29
  (lokalny patch E2E, o którym mówi przegląd runów), Nawykometr 4. Dev-pr: 75 z 75 zgodnych.
- **Epoki pomieszałyby się po cichu.** Porównanie „przed/po iteracji” po znaczniku wziąłoby runy oferty-online za wersję szablonu, której tam nie było.

### Poprawka 4 (zmienia miarę jakości). Uwagi bota zsumowane po runach dev-pr zawyżają wynik o 43%

**Obecnie.** `run.pr` (tylko workflow dev-pr): numer, tury, pliki, uwagi, klasy[{klasa, severity, plik, os, ma_regule}], rekomendacja — jeden rekord na run.

**Proponuję.**

- **Klucz PR to zadanie z argumentów runu.** Numer PR skrypt bierze z runu etapu `start` tego zadania albo z gh po gałęzi.
- **`klasy[]` niesie identyfikator wątku bota.**
- **Raport liczy unikalne wątki per PR.** Miara jakości „B P1/P2 na 100 plików PR” liczona wyłącznie na unikalnych wątkach.

**Dlaczego.**

- **Run dev-pr to jeden etap jednej tury, a nie cały PR.** 75 runów to start 14, zbierz 21, napraw 23, merge 10, compound 7. Numer PR ma w wyniku tylko 9 z nich.
- **Kolejna tura `zbierz` wypisuje ponownie wątki z poprzednich.** Suma po runach: 255 wątków. Unikalnych per zadanie: 178. Suma zawyża więc o 43%.
- **Zawyżenie nie rozkłada się równo.** Faza 7 z sześcioma zbiórkami ma 97 wobec 62, zadanie z jedną — 11 wobec 11. PR-y z większą liczbą tur,
  czyli te z gorszym kodem, wyglądałyby jeszcze gorzej, a PR-y z jedną turą — względnie lepiej. Porównania B0 z oknami 5 PR byłyby skrzywione.
- **Baseline 1b to nie dotyczy.** Klasyfikacja 574 uwag jest z GitHuba, po unikalnych komentarzach. Dotyczy B0 i wszystkich pomiarów po wdrożeniu.

### Poprawka 5 (zmienia producentów pól dopisanych po D2 i D3)

- **`agent.instrukcje_stale` nie ma producenta.** D5 bierze liczbę „z pliku wyniku testu budżetu, jeśli istnieje”, ale test biegnie w szablonie
  i żadnego pliku w projekcie nie zostawia.
  - **Propozycja:** jeden moduł liczący pozycje oznaczonego bloku poleceń (jednostka z D2, poprawka 3), używany przez test i przez skrypt telemetrii.
  - **Co liczy skrypt:** blok w prompcie delegacji z transkryptu plus blok w pliku agenta.
  - **Null**, dopóki prompty nie mają bloku.
- **`faza.wiedza.*` z „rozmiaru plików w repo w chwili runu” jest złym źródłem.** U 188 z 689 agentów (27%) CLAUDE.md, który widział agent, różni się
  od gałęzi main w chwili startu, bo run pracuje na gałęzi zadania.
  - **Jest lepsze źródło.** Od 6 września transkrypt każdego agenta ma załącznik z listą plików instrukcji i ich treścią, dokładnie tak, jak agent je dostał
    (1 030 z 1 253 agentów od tej daty).
  - **Propozycja:** pole na poziomie agenta `agent.kontekst` {claude_md_zn, rules_zn, learned_zn, narzedzia_n, skille_n}.
    Liczba dostępnych narzędzi i skilli jest w dwóch innych załącznikach od początku danych (np. 972 narzędzia i 309 skilli u agenta z 20 września).
- **To daje bezpośredni odczyt `tools:` i `omitClaudeMd`.** Pytanie brzmi „czy lista narzędzi spadła z 972 do kilkunastu” i „czy agent mechaniczny
  nie dostał CLAUDE.md”. Nie trzeba porównywać `ctx_start` między epokami, co D3 uznało za najsłabszy punkt.
- **Raport miesięczny liczy `ctx_start` per klasa I per model** (D3: haiku ~93k, opus ~127k). Tak samo próg anomalii „ctx_start > progu klasy”.
  Dziś D5 §4 pkt 2 grupuje per klasa i agentType.
- **Do rekordu agenta dochodzi `cc_wersja`** (pole `version` jest w każdym wpisie transkryptu). D3 wskazało wersję narzędzia jako niewyjaśniony składnik wzrostu kontekstu.

### Poprawka 6 (ustalenie przekrojowe, wychodzi poza D5). Model kosztu etapu 0 nie doliczał tokenów wyjściowych

**Obecnie.** HANDOFF §3 pkt 1 i digest §0: skład kosztu cache read 59%, cache write 39%, output 2%. D5 §0: „tokenyRazemK = tylko output = 2% kosztu”.
Rekord D5 ma być portem `koszt_agentow.py` z regułą „licz usage raz per message.id”.

**Proponuję.** Port bierze **ostatni** wpis każdej odpowiedzi API, nie pierwszy. Liczby etapu 0 poprawić:

- **Skład kosztu:** cache read 53,6%, cache write 35,5%, output 10,9%. Całość 1 293 M jednostek zamiast 1 179 M.
- **Udziały liczone na całym koszcie mnożymy przez 0,91:** opłata za powołanie 22% → 20%, kontekst × tury 40% → 36,5%, czysty narzut 26% → 24%.
- **Dźwignię 25–35% przeliczyć w D4** razem z poprawką epoki z D3.

**Dlaczego.**

- **Transkrypt agenta zapisuje odpowiedź API w kilku wpisach z tym samym identyfikatorem.** W 49% odpowiedzi wpisy mają różną liczbę tokenów
  wyjściowych: pierwszy to stan w trakcie strumienia, ostatni to wartość końcowa. Pola wejścia i cache są identyczne. `koszt_agentow.py` bierze pierwszy
  wpis — kontrola: odtwarza agents.csv u 2 941 z 2 941 agentów.
- **Ostatni wpis zgadza się z licznikiem harnessu.** W 15 z 19 runów mieści się w ±15% od `budget.spent()` zapisanego w wyniku runu. Pierwszy wpis daje tam
  9–43% licznika. W pozostałych 4 runach (27.08–07.09) oba są poniżej licznika, przyczyny nie sprawdziłem. We wszystkich 19 ostatni jest bliżej.
- **Kolejność priorytetów się nie zmienia.** Udziały etapów fazy w oferty-online po 6 września przesuwają się najwyżej o 0,4 punktu procentowego.
  Najbardziej zyskują role piszące dużo tekstu (planner, scribe, stan:zapis), ale to 2–3% kosztu.
- **Koszt skilli w sesji głównej jest bez zmian** (dev-plan 930k, dev-docs 669k na epizod). W transkryptach sesji głównej wpisy mają już wartość końcową.
- **Zdanie „telemetria widziała 2% kosztu” trzeba zmienić na „około 11%”.** Wniosek (liczyć cache, nie output) stoi, liczba nie.

### Poprawka 7 (korekta przyjętego D3). Po ścięciu CLAUDE.md był pełny run

**Obecnie (D3, przyjęte 2026-09-23).** „Po ścięciu CLAUDE.md do 21k nie było żadnego pełnego runu; jedyny późniejszy duży run z 20 września jest
jeszcze sprzed ścięcia” → punkt odniesienia kontekstu startowego = wyłącznie mini-run (e).

**Proponuję.**

- **Zapisać, że punkt odniesienia już istnieje.** Run z 20 września (cookie-consent, 85 agentów, trzy fazy, status OK) pracował z CLAUDE.md 17,8 tys. znaków
  i learned-patterns 45 tys. D3 datowało ścięcie po commicie na main, a ścięta wersja była już na gałęzi zadania (PR #21 zmergowany 21 września).
- **Kontekst pierwszej tury w tym runie (p50), wobec 13–17 września:** mechaniczni na haiku 89k (wobec 101k), orkiestracyjni na opusie 121k (139k),
  reviewerzy 125k (145k), sceptycy 123k (144k), buildery 135k (160k).
- **Próby są małe:** od 6 do 29 agentów na klasę.
- **Mini-run (e) zostaje, ale jako potwierdzenie** na obecnym stanie repo i per model, a nie jedyne źródło.

**Dlaczego.** Rozmiar CLAUDE.md D3 brało z gita gałęzi main. Załącznik instrukcji w transkrypcie pokazuje, co agent naprawdę dostał (poprawka 5).
Wniosek D3 (nie porównywać ze średnią z epok) stoi, ale punkt odniesienia ma już pierwszą realną wartość.

### Porządkowe

- **`rola()` z `koszt_agentow.py` skleja `fix:kontrola`, `fix:pre-skan` i `fix:poprawka` w `fix`** u etykiet nowego formatu (43 agentów w agents.csv),
  bo krótsza alternatywa w wyrażeniu wygrywa. Udział pętli naprawczej się nie zmienia, ale per rola „fix” jest zawyżony, a pre-skan (haiku,
  mechaniczny) wpada do naprawiaczy. Port musi dopasowywać najdłuższą nazwę.
- **Numer fazy agentów workflowów-dzieci** brać z najbliższej wcześniejszej grupy „Faza N”. Numer „#N” w nazwie grupy to numer wywołania, nie fazy:
  run zaczynający od fazy 2 ma review #1 = faza 2. Działa w obu formatach. Dopisanie numeru fazy do etykiet (wymóg D5) przestaje być konieczne,
  zostaje wygodą.
- **`totalTokens` z pliku harnessu nie jest kosztem** (≈ zapis do cache + wyjście, bez odczytu cache, np. 13 M wobec 164 M tokenów w runie z 20 września).
  Nie używać.
- **Retencja.** Warto rozważyć podniesienie `cleanupPeriodDays` w ustawieniach konta, np. do 120 dni. To zapas na import i na raport po przerwie.
  Decyzja operatora, etap higieny konta.
- **Do sprawdzenia w mini-runie, razem z wariantem C:** czy plik harnessu powstaje dopiero po zakończeniu runu (wtedy „brak pliku” = run w toku albo
  awaria sesji) i co zostaje po zabiciu sesji głównej.

### Co się zmieni po akceptacji

- **Rekord:** `dane/d5-telemetria-rekord.txt` (§0, §1 pkt e, §2, §3, §4 pkt 2, §6, §7 run.pr i instrukcje_stale) — źródło statusu, zapis
  „ostatni wygrywa”, pola `proba`, `blad`, `cc_wersja`, `kontekst`, `szablon{marker, skrypt_sha, zgodny}`, `run.pr` per zadanie z id wątków,
  port z ostatnim wpisem usage i poprawioną `rola()`.
- **Pakiet panelu:** PANEL-WEJSCIE §12 (wariant A → skan jako główny, liczba 2% → ~11%), §2 pkt 5, §4 (D3: punkt odniesienia z runu 20.09),
  §11 (mini-run e jako potwierdzenie, dopisek o pliku harnessu).
- **Wersje dla operatora:** PANEL-WEJSCIE-DLA-OPERATORA część 6.
- **Mapa walidacji obu wersji:** §2 pkt 5 (NIEZNANY tylko przy braku pliku harnessu), §2 pkt 1 i 4 (odczyt przez `agent.kontekst`),
  miara jakości (unikalne wątki per PR), §6 (epoki po `szablon.skrypt_sha`).
- **Model kosztu:** HANDOFF §3 pkt 1–2 i digest §0 (skład kosztu, 22% → 20%, 40% → 36,5%).
- **Dźwignia 25–35%:** do przeliczenia w D4.
- **Wymagane zmiany w szablonie na listę etapu 5:** sync-template zapisuje hash per plik w manifeście.

---

## D6 — audyt użycia skilli szablonu

**Status: PRZYJĘTA 2026-09-23 (w całości, poprawki 1–3 i porządkowe)** — wprowadzona do `dane/d6-audyt-skilli.txt` (dopisek korekty),
PANEL-WEJSCIE §2 pkt 12/§7/§12, PANEL-WEJSCIE-DLA-OPERATORA część 7, map walidacji obu wersji (§2 pkt 12), `dane/d5-telemetria-rekord.txt`
(typ `skill`, §8 pkt 1), HANDOFF (§3 pkt 6, wiersz 3½, 6a pkt 19), `dane/dane-digest.md` §2. Notatka dla operatora: `PRZEGLAD-D6-DLA-OPERATORA.md`.
**Przeliczenie:** `skrypty/d6r_rewizja_audytu.py` → `dane/d6r-rewizja-audytu.{txt,json}`. Źródła, wszystkie tylko do odczytu: transkrypty
sesji głównych i subagentów, pliki harnessu `<sesja>/workflows/<run>.json` (156 runów), `~/.claude/history.jsonl` (polecenia wpisane w terminalu
od 5 października 2025), repo szablonu i szablonu mobile. Sesja główna przeczytała dodatkowo losową próbkę sześciu epizodów dev-prep i dev-plan.

### Co się trzyma bez zmian

- **Źródło kosztu odtwarza się.** Granica epizodu z `koszt_skilli.py`, policzona od nowa, daje na tym samym zakresie dat 146 epizodów i 85,4 M.
  To dokładnie `skille.csv` (149 epizodów, 86,5 M) bez trzech duplikatów z kopii wznowionej sesji (1,1 M). Wpisy sesji głównej mają od razu
  końcową liczbę tokenów wyjściowych, więc błąd z D5 tego źródła nie dotyczy — potwierdzone.
- **Koszyk B się zgadza.** 148 agentów z wytycznymi Supabase, security i Sentry (buildery danych 125, fullstack 23), 53 z wytycznymi UI, 59 testerów
  z agent-browser — zgodne z plikami meta agentów.
- **Rdzeń (A) jest rdzeniem.** Przeliczenie niżej tylko podnosi liczby.
- **Pięciu kandydatów do usunięcia (D) zostaje kandydatami.** Nic w maszynerii ich nie woła, a rozmiar się zgadza: 748 linii w 15 plikach.
  Zmienia się uzasadnienie (poprawka 2), nie lista.

### Poprawka 1 (zmienia wniosek). Epizod skilla ucina większość pracy przed autopilotem

**Obecnie.** D6 i rekord D5 (typ `skill`): „koszt obejmuje rozmowę z operatorem”. HANDOFF §3 pkt 6, digest i PANEL-WEJSCIE §2 pkt 12:
„skille przed autopilotem = 2–5% kosztu zadania”. Mapa walidacji §2 pkt 12, punkt odniesienia dla scalenia: dev-plan 930 tysięcy i 47 minut,
dev-docs 707 tysięcy i 67 minut.

**Proponuję.**

- **Dzisiejszą liczbę nazwać „kosztem pierwszej odpowiedzi skilla”.** To dolna granica, a nie koszt skilla.
- **Pełny koszt pracy przed autopilotem liczyć do wywołania następnego skilla albo do końca sesji, razem z subagentami, których skill powołał.**
  Na tych samych 51 epizodach prep, plan i docs wychodzi 95,8 M zamiast 39,2 M, czyli 2,4 raza więcej.
  - dev-plan: mediana 0,81 M → 2,39 M na epizod. Subagenci researchu (37 agentów) kosztowali 18,6 M — tyle, ile cały dev-plan w dzisiejszym
    liczeniu (17,7 M), i jedną trzecią jego pełnego kosztu (55,6 M).
  - dev-prep: mediana 0,43 M → 1,40 M. Przejście z Tobą przez decyzje odbywa się już poza epizodem.
  - dev-docs: prawie bez zmian (0,51 M → 0,56 M), bo zwykle kończy sesję.
- **Udział w koszcie zadania (19 zadań):** dolna granica — mediana 4,1% (od 1,1 do 8,8%); pełny koszt — mediana 7,9% (od 1,6 do 21,8%).
  Po korekcie outputu runów z D5 (×~0,9) to około 4% i około 7%. Zamiast „2–5%” proponuję „około 4–7% w medianie, w małych zadaniach do jednej piątej”.
- **Minuty: mediana, nie średnia, i nie jako czas operatora.** Mediany pierwszej odpowiedzi to 8,9 minuty dla planu, 5,9 dla docs i 17,1 dla prep.
  Średnie 47 / 67 / 101 minut robią pojedyncze sesje zostawione otwarte na noc. Minuty nie mierzą też Twojego czasu, bo epizod kończy się, zanim
  zaczniesz rozmowę. Twój wysiłek lepiej pokazuje liczba Twoich wiadomości w epizodzie: mediana 3 w prep, 1 w planie, 0 w docs.

**Dlaczego.**

- **`koszt_skilli.py` zamyka epizod na każdej wiadomości typu „user”.** Liczy się jako wiadomość także powrót subagenta w tle, przerwanie
  i wyjście komendy lokalnej.
  - dev-plan: 7 z 19 epizodów kończy się na powrocie subagenta researchu (plan pisze się dopiero po nim), 4 na przerwaniu, 5 na Twoim tekście.
  - dev-prep: 8 z 15 kończy się na Twojej pierwszej wiadomości, a przejście przez dokument operatora następuje po niej.
  - dev-docs: 15 z 18 dobiega końca sesji — tu liczenie jest poprawne.
- **Subagenci nie są liczeni wcale.** Epizod sumuje tylko sesję główną.
- **Próbka czytana ręcznie.** Sześć losowych epizodów prep i plan. W oknie pełnego liczenia jest praca przygotowawcza: checklista operatora,
  odświeżenie makiety, „zanim odpalę dev-docs, czy mam coś wykonać”. W próbce nie ma wątków pobocznych. Mimo to pełne liczenie to górna granica:
  4 z 52 epizodów ma okno dłuższe niż 12 godzin (sesja zostawiona na noc).

**Co z tego wynika.**

- **Decyzja o scaleniu (6a pkt 19) stoi.** Wniosek „oszczędza czas operatora, a nie tokeny autopilota” też stoi.
- **Punkt odniesienia w mapie jest za niski około trzech razy dla planu i prep.** Porównanie scalonego skilla z nim pokazałoby fałszywy wzrost kosztu.
- **Panel projektujący budżet scalonego skilla powinien wiedzieć, gdzie jest koszt.** Największa pozycja to subagenci researchu dev-planu (18,6 M
  z 55,6 M), a nie kopia planu w dev-docs (cały dev-docs to mediana 0,56 M na epizod). Sześciu agentów researchowych nie ma `tools:` (PANEL-WEJSCIE §7), więc wymóg §2 pkt 1 dotyczy też ich.
- **Rekord `skill` z D5 potrzebuje innej granicy** (port `koszt_skilli.py` nie może jej odziedziczyć):
  - koniec epizodu = następny skill albo koniec sesji;
  - subagenci po `toolUseId` z pliku meta;
  - deduplikacja kopii po identyfikatorze wiadomości otwierającej;
  - nowe pola `pierwsza_odpowiedz_jedn` i `wiadomosci_operatora`.

### Poprawka 2 (zmienia uzasadnienie). Kandydaci do usunięcia i tryb ręczny były używane — zostały porzucone

**Obecnie.** D6: kandydaci D „zero użyć w oknie, zero artefaktów”. Koszyk E: „tryb ręczny execute/review — 0 wywołań, wszystko autopilotem”.
Okno transkryptów opisane jako „~7 tygodni”.

**Proponuję.** Opisać je historią, która sięga dalej niż transkrypty. Plik `history.jsonl` zapisuje każde polecenie wpisane w terminalu od 5 października 2025.

- **code-review:** 15 wywołań, wszystkie 18–23 stycznia 2026.
- **gemini:** 17 wywołań od 27 grudnia do 16 marca. Zostawił raporty w `dev/gemini` w dwóch starych repo (n8n_dashboard, n8n-egzamin-5), spoza 17 repo audytu.
- **dev-docs-update:** 6 wywołań od 12 grudnia do 4 lutego.
- **code-quality:** 1 wywołanie, 13 lipca.
- **bugfix:** 1 wywołanie 19 kwietnia i 1 w oknie (10 września).
- **Tryb ręczny (koszyk E):** dev-docs-execute 402 wywołania i dev-docs-review 191, od 28 grudnia do 7 czerwca, potem zero. Pierwszy
  `/dev-autopilot-wf` jest z 31 maja. Tryb ręczny był więc głównym trybem przez pół roku i został zastąpiony przez autopilota 3,5 miesiąca temu.

Lista D zostaje, ale uzasadnienie brzmi „porzucone”, a nie „nieużywane”: code-review, gemini i dev-docs-update ostatni raz 6–8 miesięcy temu,
code-quality i bugfix to pojedyncze wywołania (lipiec; kwiecień i wrzesień). Pytanie do panelu o tryb ręczny zostaje, a fakt dla niego brzmi: 593 wywołania do czerwca, zero przez 3,5 miesiąca.

**Dlaczego.**

- **„0 w oknie” nie znaczy „nigdy”, a okno jest krótsze, niż zapisano.** Transkrypty kasuje się po okresie bez aktywności.
  - Najstarszy plik w aktywnym projekcie (oferty-online) jest z 22 sierpnia, czyli sprzed około 30 dni.
  - Siedem tygodni zostaje tylko w rzadko otwieranych projektach, np. claude-cron od 5 sierpnia.
  - Z tygodni 3–17 sierpnia zostało 51 plików, a w pełnych tygodniach od 24 sierpnia jest ich od 153 do 381.
- **`history.jsonl` widzi tylko terminal.**
  - 11 wywołań `/dev-prep` i 9 `/dev-pr` z aplikacji desktop w oknie w ogóle w nim nie ma.
  - Wywołań przez model (narzędzie Skill) sprzed okna nie widać nigdzie.
  - Do wniosku „porzucone” to wystarcza: przerwa jest długa i widać ją także w oknie transkryptów, gdzie liczą się również wywołania przez model.
    Dla gemini historia terminala jest pełna, bo ten skill da się wywołać wyłącznie komendą.

### Poprawka 3 (zmienia liczby). Workflowy-dzieci i dev-pr z pliku harnessu

- **Workflowy-dzieci — wszystkie runy, oba formaty journala** (D6 liczył tylko nowy format):
  - execute: 81 wywołań w 31 runach (D6: 15);
  - review: 84 w 34 runach (D6: 18);
  - compound: 20 (D6: 5);
  - complete: 20 (D6: 5).
- **dev-compound-refresh i dev-docs-complete: SKILL.md czyta agent tylko w runach, które doszły do zakończenia.** To 20 z 55 runów autopilota
  (dokładnie te ze statusem OK), a nie „w każdym runie”. Klasa A się nie zmienia.
- **dev-pr-wf: 75 runów to 8 PR w dwóch projektach** (oferty-online 7, claude-cron 1). Etapy: start 14, zbierz 21, napraw 23, merge 10, compound 7.
  Zamiast „75 uruchomień” — „8 PR, 75 etapów”.
- **Autopilot: 55 runów według pliku harnessu** (D6: 54 wywołania Workflow), w pięciu projektach. Statusy: 20 OK, 30 STOP, 3 przerwane, 2 nieudane.

### Porządkowe

- **Retencja w rekordzie D5 (§8 pkt 1) i w PANEL-WEJSCIE §12.** Zamiast „~7 tygodni (najstarszy 03.08)”: „około 30 dni w aktywnym projekcie,
  dłużej tylko w rzadko otwieranych”. Skan telemetrii ma to okno. Rekomendacja podniesienia `cleanupPeriodDays` (etap higieny konta) zyskuje na wadze.
- **Mapa walidacji §2 pkt 12, porządkowo.** „Mediana 900k” dla dev-plan to w danych 814k. Metryka mówi o medianie minut, a punkt odniesienia
  podaje średnie. Po poprawce 1 obie liczby i tak się zmieniają.
- **gemini „nie ma nawet na liście skilli sesji”.** Powód to `disable-model-invocation: true`: skill jest tylko dla komendy. To nie jest objaw
  uszkodzenia.
- **„Usunięcie nie zmienia kosztu runów” jest prawie prawdą.** Kandydaci D zajmują około 0,6 tysiąca znaków listy skilli każdego agenta, czyli około
  0,14% kontekstu startowego. Po wprowadzeniu `tools:` bez narzędzia Skill to zero.
- **Lista skilli przycina opisy.** 14 skilli szablonu jest na liście agenta bez opisu (310 skilli na koncie), m.in. dev-ideate, code-quality,
  freshness-audit, coderabbit-setup i dev-compound-refresh. Model nie wie, kiedy ich użyć, więc zostaje im tylko komenda. To fakt dla etapu higieny konta.
- **Usunięcie wymaga poprawek poza katalogiem skilla.**
  - README wymienia wszystkich pięciu kandydatów.
  - `learnings-researcher.md:256` wspomina `/bugfix` i `/dev-ideate`.
  - Gdyby tryb ręczny execute odpadł, opisy trzech builderów („wywoływany przez dev-docs-execute”) trzeba przepiąć na workflow.
  - Szablon mobile to osobna linia: skopiowany z web, bez znacznika wersji i manifestu. Ma wszystkich pięciu kandydatów, czterech już zmienionych,
    więc usunięcie w web go nie dotyczy. Decyzja o mobile jest osobna.
- **Koszyk C: słowo „rzadko” jest prawdziwe tylko w oknie.** zroastuj-mnie ma w terminalu 84 wywołania, dev-brainstorm 20. Proponuję „celowo, poza
  pipeline'em” bez „rzadko” przy tych dwóch.

### Co się zmieni po akceptacji

- **Wynik D6:** `dane/d6-audyt-skilli.txt` — dopisek korekty na początku (dzieci, dev-pr, retencja, historia kandydatów, granica epizodu).
- **Pakiet panelu:**
  - PANEL-WEJSCIE §7, wiersz D6: liczby dzieci i dev-pr, D jako porzucone, tryb ręczny 593 → 0, okno ~30 dni;
  - §2 pkt 12: udział skilli przed autopilotem i miejsce kosztu (subagenci researchu);
  - §12: retencja i punkt odniesienia typu `skill`.
- **Wersja dla operatora:** PANEL-WEJSCIE-DLA-OPERATORA część 7 (narracja koszyków D i E, okno transkryptów).
- **Mapa walidacji obu wersji:** §2 pkt 12 — nowy punkt odniesienia (mediany, pełny koszt, wiadomości operatora).
- **Rekord telemetrii:** `dane/d5-telemetria-rekord.txt` — typ `skill` (granica epizodu, subagenci, deduplikacja, dwa nowe pola) i §8 pkt 1 (retencja).
- **Model kosztu:** HANDOFF §3 pkt 6 i digest §2 („2–5%” oraz koszt epizodu z dopiskiem, że to pierwsza odpowiedź).
- **HANDOFF:** wiersz 3½ i 6a pkt 19.

---

## D4 — pakiet wejściowy panelu jako kompilacja i dźwignia kontekstu

**Status: PRZYJĘTA 2026-09-23 (w całości, poprawki 1–3 i porządkowe)** — wprowadzona do PANEL-WEJSCIE §0/§1 pkt 4/§2 pkt 1/§4 D3/§5/§6/§8/§9/§10/§11/§12,
ETAP3 §1.1/§4/§7, ETAP3-DLA-OPERATORA, PANEL-WEJSCIE-DLA-OPERATORA (wstęp, części 1, 2, 6, 8, „jak sprawdzany”, „co teraz”), mapy walidacji obu wersji,
`dane/d5-telemetria-rekord.txt` (§4 pkt 2, §8 pkt 5), `dane/dane-digest.md` §3, HANDOFF (§3 pkt 2, wiersz 3½, 6a pkt 19, §8).
Notatka dla operatora: `PRZEGLAD-D4-DLA-OPERATORA.md`.
**Przeliczenie:** `skrypty/d4r_dzwignia_kontekstu.py` → `dane/d4r-dzwignia-kontekstu.{txt,json}` (dźwignia agent po agencie, oferty-online, transkrypty
tylko do odczytu); `skrypty/d4r_kontrola_odwrotna.py` → `dane/d4r-kontrola-odwrotna.txt` (źródła → pakiet: pierwotne źródła na obecnym pakiecie, nowe
źródła PROPOZYCJA D1–D6 i rekord D5 §8–§9, odtworzenie kontroli z 21.09 na wersjach z gita). Pakiet → źródła: czytanie obok źródeł i grep starych liczb
w PANEL-WEJSCIE, wersji operatora, mapie walidacji obu wersji, rekordzie D5, notatce D6 i ETAP3.

### Co się trzyma bez zmian

- **Nic nie zginęło przy poprawkach D1–D6.** Pierwotna kontrola odwrotna na obecnym pakiecie: 176 jednostek z markerem, poniżej progu 37 (21.09: 44).
  Spoza dawnej listy wypadły tylko dwie, obie pokryte: L3 z ETAP3 (dziś §4 D1) i zasada pracy w nowych sesjach (poza panelem).
- **Nowe źródła są w pakiecie.** Z 103 jednostek PROPOZYCJI D1–D6 i rekordu D5 §8–§9 poniżej progu jest 11. Dziesięć to uzasadnienia albo treść
  zapisana w pakiecie innymi słowami. Jedna to luka (porządkowe 7).
- **Liczby zmienione w przeglądzie stoją wszędzie, gdzie pakiet ich używa:** pół na pół 22/44 (§4, §8), ~500/~670 i ~110 (§2 pkt 3, §4), 480–490,
  run 20.09 jako punkt odniesienia (§4, §11, §12), output 10,9% i 1 293 M (§1 pkt 4, §12), 2,39 M i 4–7% (§2 pkt 12, §12), ~30 dni (§7, §12).
  Stare zapisy zostały tylko w wersji operatora i w mapie dla operatora (porządkowe 4–5).
- **Precedensy §1 pkt 1–3, 5–6, wymogi §2 i §2a, decyzje §3 — bez zmian.** Żadne z ośmiu założeń §6 się nie przewraca. Z tez §8 zmienia się jedna liczba
  (teza 1, w górę), kierunek żadnej.
- **Kolejność priorytetów stoi** i po przeliczeniu jest wyraźniejsza niż dotąd.

### Poprawka 1 (zmienia liczbę). Dźwignia kontekstu to około 40–50% kosztu fazy, nie 25–35%

**Obecnie.** ETAP3 §1.1, PANEL-WEJSCIE §1 pkt 4, §5, §8, §11, wersja operatora, mapa §2 pkt 2: „dźwignia kontekstu startowego = 25–35% kosztu fazy”.
Liczone arytmetycznie: pusty agent 62k minus docelowy start klasy daje średnio 49k zamiast 57k, czyli 86% z „30–40%”.

**Proponuję.** „Konfiguracja z decyzji 6a pkt 15/17 (allowlista `tools:` u wszystkich, `omitClaudeMd` u mechanicznych, learned-patterns poza ładowaniem
eager; CLAUDE.md, coding-rules i `skills:` zostają) zdejmuje około 40–50% kosztu fazy w stanie po ścięciu CLAUDE.md. Sama allowlista to 27–38%.
Mini-run (e) potwierdza per klasa i model.” Z coding-rules przeniesionym do warstwy referencyjnej (6a pkt 18 po D2) dochodzi około 2 punktów.

**Dlaczego.**

- **Liczone wprost, agent po agencie.** Dla każdego agenta: ile tokenów znika ze startu (Δ) razy waga każdego wywołania API — 1,25 za zapis w pierwszym,
  0,1 za odczyt z cache w każdym następnym. Koszt w mianowniku z ostatnim wpisem `usage` (poprawka 6 z D5). Prefiks przepisany w trakcie agenta:
  3 z 10 856 wywołań, więc odczyt z cache jest pewny. Pierwsza tura haiku czyta wspólny prefiks z cache (130 z 494 agentów) — policzone z wagą 0,1.
- **Wyniki.** Przed ścięciem CLAUDE.md (09-08..09-17, 494 agentów, 24 runy): 37,1%, na koszcie etapu 0 40,7%. Duże runy 32,8–40,6%, jeden krótszy 47,5%.
  Te same runy z CLAUDE.md przyciętym do stanu z 20.09 dają 39,9%. Run 20.09 (85 agentów, CLAUDE.md 17,8k zn): 51,4%, fazy 48,1 / 50,8 / 52,5%.
  Składniki w runie 20.09: allowlista 37,8, learned-patterns 10,3, `omitClaudeMd` 3,3 (przed ścięciem 27,2 / 7,6 / 2,3).
  Wrażliwość na przeliczenie znaków na tokeny (±15%): 32,2–43,6% przed ścięciem, 44,7–60,4% w runie 20.09.
- **Skąd rozpiętość 40–50%.**
  - Długość pracy agenta: w runie 20.09 12,2 wywołania na agenta, przed ścięciem 22,0. Im krótszy agent, tym większy udział startu w jego koszcie.
  - Zestaw narzędzi w sesji, z której startuje autopilot: nazwy narzędzi MCP to 15,7 tys. tokenów na agenta opusa przed ścięciem i 30,4 tys. w runie 20.09.
    Sama allowlista zdejmuje u opusa 54–77 tys. tokenów (p10–p90), u haiku 37–53 tys.
  - Jeden run po ścięciu i jedno zadanie.
- **Dlaczego ETAP3 wyszło za nisko — cztery przyczyny.**
  - Punkt wyjścia: pusty agent w CLI workspace-template (62k), a agenci oferty-online startowali średnio ze 127k przed ścięciem i ze 115k w runie 20.09.
  - Tekst polski kosztuje ~2 znaki na token, nie 3,4–3,7. CLAUDE.md 20,6k zn to ~10,5k tokenów, nie 6k; coding-rules ~5,6k, nie 3k.
  - Środowisko aplikacji desktop jest cięższe niż CLI z pomiaru 1b. Schematy narzędzi zajmują 116–172 tys. znaków zamiast 79 tys., z czego sam Artifact
    to 49 tys. Lista nazw MCP to 26–55 tys. znaków zamiast 42 tys.
  - „30–40%” z HANDOFF §5 hip. 1 nigdy nie było wyliczone. ETAP3 przeskalował liczbę, która nie miała rachunku.
- **Korekta outputu i epoka działają w przeciwne strony.** Output obniża wynik ×0,91 (40,7 → 37,1). Ścięcie CLAUDE.md podnosi go o 2,8 pkt (37,1 → 39,9),
  bo zmniejsza koszt, a allowlista zostaje tej samej wielkości. Reszta różnicy do 51% to krótsi agenci i więcej MCP w runie 20.09.
- **Kalibracja i kontrola.**
  - Stawki z pomiaru 1b (cztery konfiguracje tego samego agenta, ta sama maszyna, 20.09): schematy i listy 3,61 zn/tok, nazwy MCP z UUID 1,85, tekst polski 1,97.
  - Jeden mnożnik na model: opus 1,016 (p10–p90 1,008–1,025 na 451 agentach z CLAUDE.md od 18 do 87 tys. zn), haiku 0,742 (0,740–0,745 na 133).
    U 80% agentów opusa model trafia start z dokładnością do 1%.
  - Niezależnie, na samych danych oferty-online: stawka dla tekstu polskiego, przy której ten iloraz najmniej się rozjeżdża z rozmiarem instrukcji,
    to 2,05 zn/tok u obu modeli (wobec 1,97 z pomiaru 1b). Różnica 4% mieści się w badanej wrażliwości ±15%.

Kolejność priorytetów stoi: kontekst ≈ 40–50% wobec rosteru i mechaniki 8–10%, a po allowliście 3–7% (poprawka 2). Decyzje 6a pkt 15/17 bez zmian.

### Poprawka 2 (zmienia wniosek). Dźwignie nie sumują się

**Obecnie.** PANEL-WEJSCIE §1 pkt 4: „kontekst > roster + mechanika review (8–10%, ETAP1)”; §6: batch sceptyków ≈ −2% (sama opłata za powołanie);
§5 hip. 2: 35 → ~15 agentów na fazę. Każda liczba policzona na dzisiejszym koszcie agenta.

**Proponuję.** „Oszczędności z mniejszej liczby agentów panel liczy na koszcie agenta PO zmianie kontekstu.”

**Dlaczego.**

- **Po allowliście agent kosztuje mniej.** Agent mechaniczny zachowuje około jednej trzeciej dzisiejszego kosztu (stan:zapis 167–203 tys. → 48–62 tys. jedn.),
  sceptyk około połowy (250–256 tys. → 120–127 tys.), reviewer 56–67%.
- **Oszczędności liczone na opłacie za powołanie kurczą się najbardziej.** Start spada o 70–90%: mechaniczne 89k → ~9k, sceptyk 123k → ~26k.
  - stan:zapis w prompcie następcy (ETAP1: 9,6 M jedn. na 23 fazy, w całości zapis startu) daje ~1 M.
  - Batch sceptyków: ~−0,4% zamiast −2%.
- **Roster i mechanika: rząd 3–7% zamiast 8–10%,** zależnie od tego, czy znikają agenci mechaniczni (zostaje 1/3 kosztu), czy reviewerzy (ponad połowa).
  To szacunek z dźwigni per klasa, nie przeliczenie ETAP1 element po elemencie.
- **Skutek dla panelu.** Projekt, który sumuje „kontekst + roster” na dzisiejszych liczbach, zawyży zysk z drugiej dźwigni. Minimalistyczny wariant
  powinien wiedzieć, że cięcie agentów po allowliście daje mniej niż dziś.

### Poprawka 3 (zmienia progi mapy walidacji). Cele kontekstu startowego

**Obecnie.** PANEL-WEJSCIE §12 (dwa miejsca), mapa §2 pkt 1 (obie wersje), rekord D5 §4 pkt 2: „cel ~4,5k mechaniczne / ~15k reviewer / ~25k builder”.

**Proponuję.**

- **Cele `ctx_start` per klasa i model na stanie z 20.09, z promptem zadania** (bo `ctx_start` go zawiera):
  - mechaniczne ~9–10k (haiku i opus);
  - orkiestracyjne, sceptycy i naprawiacze na opusie ~25–26k (naprawiacz na haiku ~21k);
  - reviewerzy ~29k, buildery ~38k.
  To spadek o 70–90% wobec 89–135k.
- **Pierwszy odczyt działania zostaje bez porównań:** `agent.kontekst.narzedzia_n` (972 → ~5) i `claude_md_zn` = 0 u mechanicznych.
- **Mini-run (e) potwierdza cele.** Próg anomalii „ctx_start > progu klasy” bierze się z tych celów.

**Dlaczego.**

- **Skąd stare cele.** 4,5k to pusty agent bez promptu, 15k i 25k to szacunek ETAP3 z CLAUDE.md liczonym jako 6k tokenów i bez promptu zadania (4–6k).
- **Co by się stało.** Po poprawnym wdrożeniu reviewer miałby ~29k, więc mapa pokazałaby, że allowlista nie działa, a próg anomalii alarmowałby w każdym runie.

### Porządkowe

1. **Haiku a opus to tokenizer, nie konfiguracja.** Ten sam tekst to u haiku 0,742 tokena opusa, stale (p10–p90 0,740–0,745). To doprecyzowuje D3
   poprawkę 2 („różnica startu to głównie model”) i mapę dla operatora („haiku startuje ~35 tys. niżej przy tej samej konfiguracji”).
   Cele per model zostają. Przeniesienie roli mechanicznej z opusa na haiku oszczędza też ~26% tokenów, nie tylko cenę.
2. **Skład startu z HANDOFF §3 pkt 2 jest nieaktualny.** Tam: 107k = system prompt 44k + CLAUDE.md i reguły 33k + nazwy MCP 27k + skille 10k.
   Zmierzony skład opusa przed ścięciem (p50 137,5k):
   - schematy narzędzi 42k (to one są „system promptem 44k”);
   - CLAUDE.md 30k, learned-patterns 21k, coding-rules 6k;
   - nazwy MCP 16k, skille 8,5k, prompt 6k.
   W runie 20.09 CLAUDE.md ma już 9k, a learned-patterns 23k: sam learned-patterns waży dziś ponad dwa razy więcej niż ścięty CLAUDE.md.
3. **Środowisko sesji i L8.** „−50k” (§2 pkt 1, §9 L8) to pusty agent w CLI. W runach z aplikacji desktop allowlista zdejmuje 54–77 tys. tokenów u opusa
   i 37–53 tys. u haiku. Liczba zależy od serwerów MCP podłączonych w sesji, z której startuje autopilot.
   Do rekordu D5 (§8 pkt 5) dopisać w `agent.kontekst` rozmiary w znakach: tools_zn, odroczone_zn, skille_zn i instrukcje per plik.
   Wtedy raport miesięczny przeliczy dźwignię tą samą metodą co `d4r_dzwignia_kontekstu.py`.
4. **Wersja operatora ma stare zapisy.**
   - Część 6: „skan w ciągu około siedmiu tygodni” → ~30 dni (D6); „dziś 67–118 tys., cel 4,5–25 tys.” → run 20.09 i cele z poprawki 3.
   - Część 2 pkt 1: „62 tys. … allowlista zbija start do kilkunastu tysięcy” → liczby z poprawki 1 i 3.
   - Nagłówek części 2: „Jedenaście rzeczy” → trzynaście. Wstęp: „osiemnaście punktów decyzji”, „pięć domknięć” → 19 punktów, D1–D6 i D5b.
   - „Jak ten pakiet był sprawdzany”: „sto osiemnaście o niższym pokryciu przejrzałem ręcznie” → 58 niskich ręcznie i 60 średnich wyrywkowo
     (odtworzone skryptem na wersji z 21.09: 58 / 60 / 46; HANDOFF mówi 58).
5. **Mapa dla operatora.** „1 179 milionów jednostek” bez dopisku → 1 293 M po D5. §2 pkt 2: „oczekiwana dźwignia 25–35 procent” → 40–50.
6. **Mapa techniczna §2 pkt 2, metryka (c).** Wzór `Σ(ctx_sr × tury × 0,1) / Σ koszt` z punktem odniesienia „dziś 40%” miesza dwie rzeczy.
   40% z digestu liczono na kontekście PIERWSZEJ tury, a ten wzór liczy prawie cały odczyt z cache (~54%).
   Proponuję metrykę z d4r: udział „start × wywołania” (1,25 w pierwszym, 0,1 w następnych). Dziś 54,7% przed ścięciem i 60,9% w runie 20.09.
7. **Luka z kontroli odwrotnej.** Rekomendacja z D5 (porządkowe): podnieść `cleanupPeriodDays`, np. do 120 dni, bo retencja ~30 dni skraca okno skanu
   i importu. Tego nie ma w pakiecie → §10 przy higienie konta.
8. **§12, opis pola `rola`:** „jak `rola()` w `koszt_agentow.py`” → „z dopasowaniem najdłuższej nazwy (przegląd D5)”.
   §0: „start panelu … po D5 i rozmowie” → „po przeglądzie domknięć i rozmowie”.
9. **Grupowanie etapów fazy.** Raport miesięczny (§12) porównuje z „ETAP0 28/25/6/5/17/12%” z digestu. `d5r-koszt-output.txt` §2 grupuje role
   inaczej: reviewerzy 29,3% zamiast 25%, orkiestracja 8,8% zamiast 12%. Tam tester E2E (3,1%) i stara oś simplicity (1,3%) trafiają do reviewerów
   (sprawdzone na `agents.csv`, oferty-online po 06.09: sześć osi razem 24,9%).
   Wniosek D5 (przesunięcia ≤0,4 pp) stoi. Port raportu musi mieć jedno jawne grupowanie ról i przeliczyć punkt odniesienia tym grupowaniem.

### Co się zmieni po akceptacji

- **PANEL-WEJSCIE:** §0; §1 pkt 4 (liczba, metoda, nieaddytywność); §2 pkt 1 (−50k → 54–77k / 37–53k w aplikacji); §5 wiersz 1; §6 wiersz batch
  sceptyków (−0,4% po allowliście); §8 wiersz 1 (liczba i filar: przeliczenie z transkryptów dwóch epok zamiast arytmetyki); §9 L8; §10
  (`cleanupPeriodDays`); §11 (e); §12 (cele, opis `rola`, grupowanie w raporcie).
- **ETAP3:** dopisek korekty w §1.1, §4 (wiersz tezy) i §7 („25–35%”). **ETAP3-DLA-OPERATORA:** dopisek przy „dwadzieścia pięć do trzydziestu pięciu”.
- **PANEL-WEJSCIE-DLA-OPERATORA:** części 1, 2 (nagłówek i pkt 1), 6 i 8, wstęp, „Jak ten pakiet był sprawdzany”.
- **Mapa walidacji obu wersji:** §2 pkt 1 (cele, tokenizer), §2 pkt 2 (dźwignia, metryka c), punkt odniesienia 1 293 M w wersji operatora.
- **Rekord D5:** §4 pkt 2 (cele, próg anomalii), §8 pkt 5 (rozmiary w znakach w `agent.kontekst`).
- **Model kosztu:** HANDOFF §3 pkt 2–3 i digest §0/§3 — dopisek ze składem startu i udziałem „start × wywołania”.
- **HANDOFF:** wiersz 3½, 6a pkt 19, §8 na stan po przeglądzie. **Pamięć projektu**, commit `docs/reviews`.
