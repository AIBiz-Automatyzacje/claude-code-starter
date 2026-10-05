---
name: dev-compound-refresh
description: "Przegląd i odświeżanie bazy wiedzy docs/solutions/."
argument-hint: "[opcjonalnie: kategoria do przejrzenia]"
---

# Compound Refresh — przegląd i odświeżanie bazy wiedzy

Datę do dokumentów bierz z `date +%F`.

Utrzymuje jakość `docs/solutions/` oraz indeksu wiedzy `docs/learned-patterns.md` (generuje go skrypt z pól wiedzy solutions) w czasie. Workflow przeglada istniejące dokumenty rozwiązań względem aktualnego codebase, a następnie odświeża dokumenty wzorcowe (pattern docs) zależne od nich.

## Tryb pracy

**Domyślny tryb: AUTONOMICZNY** — bez pytań, przetwarza wszystko w scope, generuje raport.

| Tryb | Kiedy | Zachowanie |
|------|-------|------------|
| **Autonomiczny** (domyślnie) | Bez argumentów lub z argumentem kategorii | Bez interakcji z użytkownikiem. Wykonaj wszystkie jednoznaczne akcje. Oznacz niejednoznaczne przypadki jako stale. Wygeneruj raport końcowy. |
| **Z argumentem** | Podana kategoria lub słowo kluczowe | Przegląda tylko wskazaną kategorię/obszar |
| **Konwersja** | Argument `--konwersja` | Jednorazowe przeniesienie reguł ze starego pliku do pól wiedzy solutions — sekcja **Tryb konwersji** |

### Zasady trybu autonomicznego

- **Pomiń wszystkie pytania do użytkownika.** Nigdy nie czekaj na input.
- **Przetwarzaj wszystkie dokumenty w scope.** Bez argumentów = przetwarzaj WSZYSTKO w `docs/solutions/`. Z argumentem = przetwarzaj tylko dopasowany zakres.
- **Wykonuj wszystkie bezpieczne akcje:** Keep (brak edycji), Update (napraw referencje), auto-Archive (jednoznaczne kryteria spełnione), Replace (gdy dowody są wystarczające). Jeśli zapis się powiedzie, zapisz jako **wykonane**. Jeśli zapis się nie uda, zapisz akcję jako **rekomendowane** w raporcie i kontynuuj — nie zatrzymuj się.
- **Oznacz jako stale gdy niepewny.** Jeśli klasyfikacja jest genuicznie niejednoznaczna (Update vs Replace vs Archive) lub dowody na Replace są niewystarczające, oznacz jako stale: `status: stale`, `stale_reason`, `stale_date` we frontmatter.
- **Używaj konserwatywnej pewności.** Graniczne przypadki dostają oznaczenie stale. Preferuj oznaczenie stale nad nieprawidłową akcją.
- **Zawsze generuj raport.** Raport jest głównym produktem. Ma dwie sekcje: **Wykonane** (akcje zapisane) i **Rekomendowane** (akcje, których nie udało się zapisać, z pełnym uzasadnieniem).

## Opis kategorii

<category_hint> #$ARGUMENTS </category_hint>

## Kolejność odświeżania

Odświeżaj w tej kolejności:

1. Najpierw przejrzyj poszczególne dokumenty rozwiązań (learnings)
2. Zanotuj które rozwiązania pozostały aktualne, zostały zaktualizowane, zastąpione lub zarchiwizowane
3. Następnie przejrzyj dokumenty wzorcowe (pattern docs) zależne od tych rozwiązań
4. Wygeneruj indeks wiedzy `docs/learned-patterns.md` z odświeżonych solutions (Faza 1.7)
5. Na końcu przejrzyj `docs/CONCEPTS.md` (jeśli istnieje) — słownik domenowy. Usuń hasła, których kod/feature już nie istnieje; scal duplikaty; zweryfikuj, że definicje pasują do aktualnego zachowania; zamień treść skopiowaną z CLAUDE.md na link. Trzymaj formę cienkiego indeksu (1-2 zdania na hasło, alfabetycznie). Nie dubluj tu wiedzy z `docs/solutions/` — to glosariusz pojęć, nie baza rozwiązań.

Dlaczego ta kolejność:

- Dokumenty rozwiązań to główne dowody
- Dokumenty wzorcowe są pochodne od jednego lub więcej rozwiązań
- Przestarzałe rozwiązania mogą sprawić, że wzorzec wygląda na bardziej wiarygodny niż jest w rzeczywistości

## Model utrzymania

Dla każdego dokumentu sklasyfikuj go do jednego z czterech wyników:

| Wynik | Znaczenie | Domyślna akcja |
|-------|-----------|----------------|
| **Keep** | Nadal dokładny i przydatny | Brak edycji pliku; raportuj że przejrzano i pozostaje wiarygodny |
| **Update** | Główne rozwiązanie nadal poprawne, ale referencje się rozjechały | Zastosuj poprawki in-place poparte dowodami |
| **Replace** | Stary dokument jest teraz mylący, ale istnieje znane lepsze zastępstwo | Stwórz godnego zaufania następcę, a stary dokument oznacz/zarchiwizuj |
| **Archive** | Nie jest już przydatny ani mający zastosowanie | Przenieś do `docs/solutions/_archived/` z metadanymi archiwizacji |

## Kluczowe zasady

1. **Dowody informują osąd.** Sygnały poniżej to dane wejściowe, nie mechaniczna karta punktowa. Używaj inżynierskiego osądu żeby zdecydować czy dokument jest nadal wiarygodny.
2. **Preferuj Keep bez edycji.** Nie aktualizuj dokumentu tylko żeby zostawić ślad przeglądu.
3. **Dopasowuj dokumenty do rzeczywistości, nie odwrotnie.** Gdy aktualny kod różni się od dokumentu, zaktualizuj dokument żeby odzwierciedlał aktualny kod. Zadaniem tego skill'a jest dokładność dokumentacji, nie code review — nie pytaj użytkownika czy zmiany w kodzie były "zamierzone" czy "regresją". Jeśli kod się zmienił, dokument powinien pasować.
4. **Bądź zdecydowany, minimalizuj pytania.** Gdy dowody są jasne (plik przemianowany, klasa przeniesiona, referencja nieaktualna), zastosuj aktualizację. Niejednoznaczne przypadki oznacz jako stale.
5. **Unikaj bezwartościowego churnu.** Nie edytuj dokumentu tylko żeby naprawić literówkę, poprawić styl lub dokonać kosmetycznych zmian, które nie poprawiają materialnie dokładności ani użyteczności.
6. **Używaj Update tylko dla znaczącego, popartego dowodami dryfu.** Ścieżki, nazwy modułów, powiązane linki, metadane kategorii, fragmenty kodu i wyraźnie przestarzałe sformułowania — gdy ich naprawa materialnie poprawia dokładność.
7. **Używaj Replace tylko gdy istnieje prawdziwe zastępstwo.** To znaczy:
   - bieżące badanie codebase znalazło aktualne podejście i może je udokumentować jako następcę, lub
   - nowsze dokumenty, pattern docs, PR-y lub issues dostarczają silnych dowodów na następcę.
8. **Archiwizuj gdy kod zniknął.** Jeśli referencjowany kod, kontroler lub workflow nie istnieje już w codebase i nie można znaleźć następcy, archiwizuj — nie zostawiaj jako Keep tylko dlatego, że ogólna rada jest nadal "słuszna". Dokument o usuniętym feature'rze wprowadza czytelników w błąd.

## Wybór zakresu

Zacznij od odkrywania dokumentów pod `docs/solutions/`.

Wyklucz:

- `README.md`
- `docs/solutions/_archived/`

Znajdź wszystkie pliki `.md` pod `docs/solutions/`, wykluczając pliki `README.md` i wszystko pod `_archived/`.

Jeśli `$ARGUMENTS` podano, użyj go do zawężenia zakresu. Próbuj te strategie dopasowania w kolejności, zatrzymując się na pierwszej która daje wyniki:

1. **Dopasowanie katalogu** — sprawdź czy argument pasuje do nazwy podkatalogu pod `docs/solutions/` (np. `performance-issues`, `database-issues`)
2. **Dopasowanie frontmatter** — szukaj w polach `module`, `component` lub `tags` we frontmatter
3. **Dopasowanie nazwy pliku** — dopasuj do nazw plików (częściowe dopasowania OK)
4. **Szukanie w treści** — szukaj argumentu jako słowa kluczowego w treści pliku

Jeśli nie znaleziono dopasowań, raportuj to i zakończ — nie zgaduj zakresu.

Jeśli nie znaleziono żadnych dokumentów kandydujących, raportuj:

```text
Nie znaleziono dokumentów kandydujących w docs/solutions/.
Uruchom /dev-compound po rozwiązaniu problemów żeby zacząć budować bazę wiedzy.
```

## Faza 0: Ocena i routing

Przed klasyfikacją czegokolwiek:

1. Odkryj dokumenty kandydujące
2. Oszacuj zakres
3. Wybierz najlżejszą ścieżkę która pasuje

### Routing według zakresu

| Zakres | Kiedy | Styl pracy |
|--------|-------|------------|
| **Skupiony** | 1-2 prawdopodobne pliki lub argument wskazuje konkretny dokument | Zbadaj bezpośrednio, potem wykonaj akcję |
| **Wsadowy** | Do ~8 w większości niezależnych dokumentów | Zbadaj najpierw, potem wykonaj zgrupowane akcje |
| **Szeroki** | 9+ dokumentów, niejednoznaczne, lub przegląd całego repo | Triażuj najpierw, potem badaj partiami |

### Triaż szerokiego zakresu

Gdy zakres jest szeroki (9+ dokumentów kandydujących), zrób lekki triaż przed głębokim badaniem:

1. **Inwentarz** — przeczytaj frontmatter wszystkich dokumentów kandydujących, grupuj według modułu/komponentu/kategorii
2. **Klasteryzacja wpływu** — zidentyfikuj obszary z najgęstszymi klastrami dokumentów + wzorców. Klaster 5 rozwiązań i 2 wzorców pokrywających ten sam moduł ma wyższy wpływ niż 5 izolowanych obszarów.
3. **Kontrola dryfu** — dla każdego klastra sprawdź czy główne referencjowane pliki nadal istnieją. Brakujące referencje w klastrze o wysokim wpływie = najsilniejszy sygnał od czego zacząć.
4. **Przetwarzaj klastry według wpływu** — zacznij od klastra o najwyższym wpływie, kontynuuj do następnego.

## Faza 1: Badanie dokumentów rozwiązań

Dla każdego dokumentu w zakresie, przeczytaj go, porównaj jego twierdzenia z aktualnym codebase i sformułuj rekomendację.

Dokument ma kilka wymiarów, które mogą niezależnie się zdezaktualizować. Powierzchowne sprawdzenia łapią oczywisty dryf, ale przestarzałość często kryje się głębiej:

- **Referencje** — czy ścieżki plików, nazwy klas i modułów, o których wspomina, nadal istnieją czy się przeniosły?
- **Rekomendowane rozwiązanie** — czy fix nadal pasuje do tego jak kod faktycznie działa? Przemianowany plik z zupełnie innym wzorcem implementacji to nie tylko aktualizacja ścieżki.
- **Przykłady kodu** — jeśli dokument zawiera fragmenty kodu, czy nadal odzwierciedlają aktualną implementację?
- **Powiązane dokumenty** — czy cross-referencjowane dokumenty i wzorce nadal istnieją i są spójne?

Dopasuj głębokość badania do specyficzności dokumentu — dokument referencjujący dokładne ścieżki plików i fragmenty kodu wymaga więcej weryfikacji niż opisujący ogólną zasadę.

### Klasyfikacja dryfu: Update vs Replace

Kluczowe rozróżnienie to czy dryf jest **kosmetyczny** (referencje się przeniosły ale rozwiązanie jest to samo) czy **merytoryczny** (samo rozwiązanie się zmieniło):

- **Terytorium Update** — ścieżki się przeniosły, klasy przemianowane, linki nieaktualne, metadane rozjechane, ale główne rekomendowane podejście nadal odpowiada temu jak kod działa. Napraw bezpośrednio.
- **Terytorium Replace** — rekomendowane rozwiązanie jest sprzeczne z aktualnym kodem, podejście architektoniczne się zmieniło, lub wzorzec nie jest już preferowanym sposobem. Trzeba napisać nowy dokument. Dokument zastępczy używa formatu `/dev-compound`: frontmatter YAML (title, category, date, module, component, tags), opis problemu, root cause, aktualne rozwiązanie z przykładami kodu i zapobieganie.

**Granica:** jeśli przepisujesz sekcję rozwiązania lub zmieniasz to co dokument rekomenduje, zatrzymaj się — to Replace, nie Update.

### Wytyczne osądu

Trzy wytyczne, które łatwo pomylić:

1. **Sprzeczność = silny sygnał Replace.** Jeśli rekomendacja dokumentu jest sprzeczna z aktualnymi wzorcami kodu lub ostatnio zweryfikowaną naprawą, to nie jest drobny dryf — dokument aktywnie wprowadza w błąd. Klasyfikuj jako Replace.
2. **Sam wiek nie jest sygnałem przestarzałości.** 2-letni dokument, który nadal pasuje do aktualnego kodu, jest w porządku. Używaj wieku tylko jako zachęty do dokładniejszego sprawdzenia.
3. **Sprawdź następców przed archiwizacją.** Przed rekomendowaniem Replace lub Archive, poszukaj nowszych dokumentów, pattern docs, PR-ów lub issues pokrywających tę samą przestrzeń problemu. Jeśli dowody na następcę istnieją, preferuj Replace nad Archive żeby czytelnicy byli kierowani do nowszych wskazówek.

## Faza 1.5: Badanie dokumentów wzorcowych

Po przejrzeniu dokumentów rozwiązań, zbadaj powiązane dokumenty wzorcowe pod `docs/solutions/patterns/`.

Dokumenty wzorcowe mają wysoki dźwignię — przestarzały wzorzec jest bardziej niebezpieczny niż przestarzałe pojedyncze rozwiązanie, bo przyszła praca może traktować go jako szeroko stosowalne wskazówki. Oceń czy uogólniona reguła nadal obowiązuje, biorąc pod uwagę odświeżony stan rozwiązań na których bazuje.

Dokument wzorcowy bez wyraźnych wspierających rozwiązań to sygnał przestarzałości — zbadaj uważnie przed zostawieniem bez zmian.

## Faza 1.7: Indeks wiedzy

Indeks `docs/learned-patterns.md` powstaje z pól wiedzy solutions (`klasa`, `regula`, `paths`, `waga`, `szczebel`…), więc
po Update, Replace i Archive generujesz go od nowa — ręcznie go nie edytujesz:

1. `node .claude/scripts/wiedza/wiedza.mjs indeks --zapisz`. Zarchiwizowane solutions (`docs/solutions/_archived/`) wypadają
   z indeksu same; dokument zastępczy wchodzi, gdy ma pola wiedzy (format `/dev-compound`, sekcja „Pola wiedzy”).
2. `niepoprawne` w wyniku = solutions z błędnymi polami: popraw pola i sprawdź `wiedza.mjs sprawdz <plik>`.
3. `zapisany: false` z `bledy` = bramka indeksu, plik zostaje bez zmian:
   - koszyk „zawsze” ponad limit (`paths: ["**"]`) — zawęź `paths` wpisów z listy w błędzie do katalogów, których reguła dotyczy;
   - indeks ponad limit znaków — scal solutions o tej samej klasie i sensie reguły (Replace jednym następcą) albo zarchiwizuj
     te o najmniejszej wartości (najniższa waga, zero ucieczek, najwęższe `paths`).
   Potem wygeneruj indeks jeszcze raz. Limit dotyczy indeksu, nie wiedzy: solution poza indeksem zostaje w bazie.
   Treści reguł nie skracasz, żeby zmieścić indeks — skrócona reguła traci to, co dostają buildery i reviewerzy.
   Wąski przegląd z autopilota bramki rozmiaru nie porządkuje: zwraca ją operatorowi, który uruchamia pełny przegląd.
4. `duplikaty` w wyniku = ta sama klasa i treść reguły w kilku solutions; indeks bierze nowszy wpis — starszy oceń jak każdy
   dokument (Keep, gdy wnosi własny opis problemu; Archive, gdy jest redundantny).

## Jeden wątek

Badanie, dokument zastępczy i archiwizację wykonujesz w tym wątku. Pomocnicze wątki badawcze (narzędzie Agent, sam odczyt,
jeden na klaster) mają sens przy przeglądzie szerokim (9+ dokumentów), gdy klastry z Fazy 0 się nie nakładają —
zwracają ścieżkę, dowody, rekomendowaną akcję i pewność. Zapisy i archiwizacja zostają w tym wątku.

## Faza 2: Klasyfikacja właściwej akcji utrzymania

Po zebraniu dowodów, przypisz jedną rekomendowaną akcję.

### Keep

Dokument jest nadal dokładny i przydatny. Nie edytuj pliku — raportuj że przejrzano i pozostaje wiarygodny. Dodaj `last_refreshed` tylko jeśli już dokonujesz znaczącej aktualizacji z innego powodu.

### Update

Główne rozwiązanie nadal aktualne ale referencje się rozjechały (ścieżki, nazwy klas, linki, fragmenty kodu, metadane). Zastosuj poprawki bezpośrednio.

Przykłady prawidłowych aktualizacji in-place:

- Zmiana referencji `app/models/auth_token.rb` na `app/models/session_token.rb`
- Aktualizacja `module: AuthToken` na `module: SessionToken`
- Naprawienie nieaktualnych linków do powiązanych dokumentów
- Odświeżenie notatek implementacyjnych po przeniesieniu katalogu

Przykłady które **nie** powinny być aktualizacjami in-place:

- Naprawa literówki bez wpływu na zrozumienie
- Przeformułowanie prozy ze względów stylistycznych
- Drobne porządki nie poprawiające materialnie dokładności ani użyteczności
- Stary fix jest teraz anty-wzorcem
- Architektura systemu zmieniła się na tyle, że stare wskazówki są mylące
- Ścieżka diagnostyczna jest materialnie inna

Te przypadki wymagają **Replace**, nie Update.

### Replace

Wybierz **Replace** gdy główne wskazówki dokumentu są teraz mylące — rekomendowany fix zmienił się materialnie, root cause lub architektura się przesunęła, lub preferowany wzorzec jest inny.

**Ocena dowodów:**

Do czasu identyfikacji kandydata Replace, badanie Fazy 1 zebrało już znaczące dowody: twierdzenia starego dokumentu, co aktualny kod faktycznie robi i gdzie wystąpił dryf. Oceń czy te dowody są wystarczające do napisania godnego zaufania zastępstwa:

- **Wystarczające dowody** — rozumiesz zarówno co stary dokument rekomendował ORAZ jakie jest aktualne podejście. Badanie znalazło aktualne wzorce kodu, nowe lokalizacje plików, zmienioną architekturę. → Przejdź do napisania zastępstwa (patrz Faza 4 Replace Flow).
- **Niewystarczające dowody** — dryf jest tak fundamentalny, że nie możesz z pewnością udokumentować aktualnego podejścia. → Oznacz jako stale in-place:
  - Dodaj `status: stale`, `stale_reason: [co znalazłeś]`, `stale_date: YYYY-MM-DD` do frontmatter
  - Raportuj jakie dowody znalazłeś i czego brakuje
  - Zarekomenduj uruchomienie `/dev-compound` po następnym spotkaniu z tym obszarem

### Archive

Wybierz **Archive** gdy:

- Kod lub workflow nie istnieje już
- Dokument jest przestarzały i nie ma nowoczesnego zastępstwa wartego dokumentowania
- Dokument jest redundantny i nie jest już przydatny sam w sobie
- Brak znaczących dowodów na następcę sugerujących, że powinien być zastąpiony

Akcja:

- Przenieś plik do `docs/solutions/_archived/`, zachowując strukturę katalogów gdy pomocne
- Dodaj:
  - `archived_date: YYYY-MM-DD`
  - `archive_reason: [dlaczego zarchiwizowano]`

### Przed archiwizacją: sprawdź czy domena problemu jest nadal aktywna

Gdy referencjowane pliki dokumentu zniknęły, to silne dowody — ale tylko że **implementacja** zniknęła. Przed archiwizacją zastanów się czy **problem który dokument rozwiązuje** jest nadal aktualny w codebase:

- Dokument o przechowywaniu tokenów sesji gdzie `auth_token.rb` zniknął — czy aplikacja nadal obsługuje tokeny sesji? Jeśli tak, koncepcja trwa pod nową implementacją. To Replace, nie Archive.
- Dokument o wycofanym endpoincie API gdzie cały feature został usunięty — domena problemu zniknęła. To Archive.

Nie szukaj mechanicznie słów kluczowych ze starego dokumentu. Zamiast tego zrozum jaki problem dokument adresuje, potem zbadaj czy ta domena problemu nadal istnieje w codebase.

**Auto-archiwizuj tylko gdy zniknęła ZARÓWNO implementacja JAK I domena problemu:**

- referencjowany kod zniknął ORAZ aplikacja nie zajmuje się już tą domeną problemu
- dokument jest w pełni zastąpiony przez wyraźnie lepszego następcę
- dokument jest wyraźnie redundantny i nie wnosi żadnej unikalnej wartości

Jeśli implementacja zniknęła ale domena problemu trwa (aplikacja nadal robi auth, nadal przetwarza płatności, nadal obsługuje migracje), klasyfikuj jako **Replace** — problem nadal ma znaczenie i aktualne podejście powinno być udokumentowane.

## Wskazówki dla dokumentów wzorcowych

Stosuj te same cztery wyniki (Keep, Update, Replace, Archive) do dokumentów wzorcowych, ale oceniaj je jako **pochodne wskazówki** a nie rozwiązania na poziomie incydentu. Kluczowe różnice:

- **Keep**: bazowe rozwiązania nadal wspierają uogólnioną regułę a przykłady pozostają reprezentatywne
- **Update**: reguła obowiązuje ale przykłady, linki, zakres lub wspierające referencje się rozjechały
- **Replace**: uogólniona reguła jest teraz myląca, lub bazowe rozwiązania wspierają inną syntezę. Oprzyj zastępstwo na odświeżonym zestawie rozwiązań — nie wymyślaj nowych reguł na podstawie domysłów
- **Archive**: wzorzec nie jest już prawidłowy, nie jest już powtarzalny, lub w pełni pochłonięty przez silniejszy dokument wzorcowy

## Faza 3: Wykonanie akcji

Wykonaj wszystkie akcje na podstawie klasyfikacji z Fazy 2:

- Jednoznaczne Keep, Update, auto-Archive i Replace (z wystarczającymi dowodami) → wykonaj bezpośrednio
- Niejednoznaczne przypadki → oznacz jako stale
- Po zakończeniu wygeneruj raport (patrz Format raportu)

### Keep Flow

Brak edycji pliku. Podsumuj dlaczego dokument pozostaje wiarygodny.

### Update Flow

Zastosuj edycje in-place tylko gdy rozwiązanie jest nadal merytorycznie poprawne.

### Replace Flow

Przetwarzaj kandydatów Replace **jeden na raz, sekwencyjnie**. Dokument zastępczy piszesz sam.

**Gdy dowody wystarczające:**

1. Napisz nowy dokument według formatu `/dev-compound`: frontmatter YAML (title, category, date, tags i pola wiedzy
   z sekcji „Pola wiedzy” — reguła i wzorce według aktualnego kodu), opis problemu, root cause, aktualne rozwiązanie
   z przykładami kodu i zapobieganie. Ścieżka i kategoria jak w starym dokumencie, chyba że zmieniła się kategoria.
2. `node .claude/scripts/wiedza/wiedza.mjs sprawdz <nowy plik>` — kod 1: popraw pola wg `bledy`.
3. Dodaj `superseded_by: [ścieżka nowego dokumentu]` do frontmatter starego dokumentu i przenieś go do `docs/solutions/_archived/`.

**Gdy dowody niewystarczające:**

1. Oznacz dokument jako stale in-place:
   - Dodaj do frontmatter: `status: stale`, `stale_reason: [co znalazłeś]`, `stale_date: YYYY-MM-DD`
2. Raportuj jakie dowody znaleziono i czego brakuje
3. Zarekomenduj uruchomienie `/dev-compound` po następnym spotkaniu z tym obszarem

### Archive Flow

Archiwizuj tylko gdy dokument jest wyraźnie przestarzały lub redundantny. Nie archiwizuj dokumentu tylko dlatego, że jest stary.

## Format raportu

**Pełny raport MUSI być wydrukowany jako output markdown.** Nie streszczaj wewnętrznie wyników i nie wypuszczaj jednolinijkowego podsumowania. Raport jest produktem — drukuj każdą sekcję w całości, sformatowaną jako czytelny markdown z nagłówkami, tabelami i bullet pointami.

Po przetworzeniu wybranego zakresu, wypisz następujący raport:

```text
Compound Refresh — Podsumowanie
================================
Przeskanowano: N dokumentów

Zachowano (Keep): X
Zaktualizowano (Update): Y
Zastąpiono (Replace): Z
Zarchiwizowano (Archive): W
Pominięto: V
Oznaczono jako stale: S
```

Następnie dla KAŻDEGO przetworzonego pliku podaj:
- Ścieżkę pliku
- Klasyfikację (Keep/Update/Replace/Archive/Stale)
- Jakie dowody znaleziono
- Jaką akcję wykonano (lub zarekomendowano)

Dla wyników **Keep**, umieść je w sekcji przejrzanych-bez-edycji żeby wynik był widoczny bez tworzenia churnu git.

### Indeks wiedzy (docs/learned-patterns.md)

Dodaj sekcję z wyniku `wiedza.mjs indeks --zapisz` z Fazy 1.7:

```text
Indeks wiedzy:
  Zapisany: tak / nie (bramka: <błędy>)
  Wpisy: N (koszyk „zawsze”: Z), znaki: C
  Niepoprawne pola: <lista albo „brak”>
  Duplikaty: <lista albo „brak”>
```

### Format raportu autonomicznego

Raport jest jedynym produktem — nie ma użytkownika do zadawania dodatkowych pytań, więc raport musi być samowystarczalny i kompletny. **Drukuj pełny raport. Nie skracaj, nie streszczaj, nie pomijaj sekcji.**

Podziel akcje na dwie sekcje:

**Wykonane** (zapisy które się powiodły):
- Dla każdego **zaktualizowanego** pliku: ścieżka pliku, jakie referencje naprawiono i dlaczego
- Dla każdego **zastąpionego** pliku: co stary dokument rekomendował vs co aktualny kod robi, i ścieżka do nowego następcy
- Dla każdego **zarchiwizowanego** pliku: ścieżka pliku i jaki referencjowany kod/workflow zniknął
- Dla każdego **oznaczonego jako stale** pliku: ścieżka pliku, jakie dowody znaleziono i dlaczego było to niejednoznaczne

**Rekomendowane** (akcje których nie udało się zapisać):
- Te same szczegóły co powyżej, ale sformułowane jako rekomendacje dla człowieka do zastosowania
- Dołącz wystarczająco kontekstu żeby użytkownik mógł zastosować zmianę ręcznie lub ponownie uruchomić skill interaktywnie

Jeśli wszystkie zapisy się powiodą, sekcja Rekomendowane jest pusta. Jeśli żaden zapis się nie powiedzie, wszystkie akcje trafiają pod Rekomendowane — raport staje się planem utrzymania.

## Relacja z /dev-compound

- `/dev-compound` przechwytuje nowo rozwiązany, zweryfikowany problem
- `/dev-compound-refresh` utrzymuje starsze dokumenty gdy codebase ewoluuje

Używaj **Replace** tylko gdy proces odświeżania ma wystarczające prawdziwe dowody do napisania godnego zaufania następcy. Gdy dowody są niewystarczające, oznacz jako stale i zarekomenduj `/dev-compound` na gdy użytkownik następnym razem natrafi na ten obszar problemu.

## Tryb konwersji (`--konwersja`)

Jednorazowo, w projekcie, który ma jeszcze stary plik reguł `learned-patterns.md` w katalogu `.claude/rules` (format sprzed
indeksu wiedzy: `- **tytuł**: treść` + `Source:`). Reguły przechodzą do pól wiedzy ich solutions, indeks powstaje skryptem,
a stary plik idzie do `docs/archiwum/` — przestaje ładować się do każdego agenta.

1. Start przy czystym drzewie (`git status --porcelain` pusty): konwersja kończy się commitem, cudze zmiany by się do niego dokleiły.
2. `node .claude/scripts/wiedza/wiedza.mjs konwersja przygotuj > /tmp/wiedza-kandydaci.json` — kandydat na regułę:
   `nr`, `tytul`, `tresc`, `zrodla`, `solution`, `regula` (tytuł jako propozycja), `paths` (wzorce ze ścieżek cytowanych
   w solution), `waga`, `uwagi`; pole `klasa` jest puste.
3. Dla każdego kandydata ustal:
   - `klasa` — klasa defektu z `KLASY_WIEDZY` w `.claude/scripts/wiedza/klasy.mjs`, wg treści reguły i solution;
   - `regula` — popraw, gdy tytuł nie mówi, co robić (jedno albo dwa zdania, ≤ 400 zn, „rób X, nie Y”);
   - `paths` — wybierz z kandydatów albo podaj własne globy katalogów kodu, których reguła dotyczy; `["**"]` dla reguły
     przekrojowej, a takich w projekcie jest najwyżej 5;
   - `solution` — jeden plik z `zrodla` wewnątrz `docs/solutions/` (jedna reguła na solution); `null`, gdy żadnego nie ma.
   Zapisz tablicę `[{"nr", "klasa", "regula", "paths", "solution", "waga"}]` do `/tmp/wiedza-propozycje.json`.
4. `node .claude/scripts/wiedza/wiedza.mjs konwersja zastosuj --propozycje /tmp/wiedza-propozycje.json` — skrypt waliduje
   każdą propozycję tym samym walidatorem co compound, zapisuje pola do solutions (szczebel `regula`), generuje indeks
   i po zapisanym indeksie przenosi stary plik do `docs/archiwum/learned-patterns-<data>.md`, a odrzuty do
   `docs/archiwum/learned-patterns-odrzuty-<data>.md`. Bramka indeksu (`indeks.zapisany: false`) zostawia stary plik
   na miejscu: popraw `paths` albo wpisy wg Fazy 1.7 i uruchom `wiedza.mjs indeks --zapisz`, a stary plik przenieś
   dopiero po zapisanym indeksie.
5. Commit: `git add -A docs/solutions docs/learned-patterns.md docs/archiwum .claude/rules` i
   `docs(wiedza): konwersja learned-patterns do wiedzy projektu`.
6. Raport: liczba zapisanych reguł, odrzuty z powodami (plik odrzutów — decyzja operatora: dopisać pola ręcznie albo
   pominąć), rozmiar indeksu i koszyk „zawsze”. CLAUDE.md projektu nie edytujesz — linię wskazującą indeks dopisuje
   operator wg README szablonu.
