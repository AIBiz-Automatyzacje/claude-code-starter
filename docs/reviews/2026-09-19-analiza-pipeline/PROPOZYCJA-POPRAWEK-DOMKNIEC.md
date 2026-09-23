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
