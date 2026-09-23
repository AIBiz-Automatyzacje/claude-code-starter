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
