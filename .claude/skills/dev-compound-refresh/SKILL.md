---
name: dev-compound-refresh
description: "Przegląd i odświeżanie bazy wiedzy docs/solutions/."
argument-hint: "[opcjonalnie: kategoria do przejrzenia]"
---

# Compound Refresh — przegląd i odświeżanie bazy wiedzy

**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu dokumentów.

Utrzymuje jakość `docs/solutions/` oraz reguł w `.claude/rules/learned-patterns.md` w czasie. Workflow przeglada istniejące dokumenty rozwiązań względem aktualnego codebase, a następnie odświeża dokumenty wzorcowe (pattern docs) zależne od nich.

## Tryb pracy

**Domyślny tryb: AUTONOMICZNY** — bez pytań, przetwarza wszystko w scope, generuje raport.

| Tryb | Kiedy | Zachowanie |
|------|-------|------------|
| **Autonomiczny** (domyślnie) | Bez argumentów lub z argumentem kategorii | Bez interakcji z użytkownikiem. Wykonaj wszystkie jednoznaczne akcje. Oznacz niejednoznaczne przypadki jako stale. Wygeneruj raport końcowy. |
| **Z argumentem** | Podana kategoria lub słowo kluczowe | Przegląda tylko wskazaną kategorię/obszar |

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
4. Przejrzyj `.claude/rules/learned-patterns.md` — usuń reguły bez aktualnego źródła, zaktualizuj po Replace, zdeduplikuj, wyegzekwuj limit ~50
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

## Faza 1.7: Przegląd learned-patterns.md

Po przejrzeniu dokumentów rozwiązań i wzorcowych, przejrzyj reguły w `.claude/rules/learned-patterns.md`.

Jeśli plik nie istnieje — pomiń tę fazę.

Dla KAŻDEJ reguły w pliku:

1. **Odczytaj ścieżkę Source** z reguły
2. **Sprawdź status źródła:**
   - Czy plik źródłowy nadal istnieje w `docs/solutions/`?
   - Czy plik źródłowy został przeniesiony do `docs/solutions/_archived/` w tej lub wcześniejszej sesji refresh?
   - Czy plik źródłowy został zastąpiony (Replace) — sprawdź `superseded_by` we frontmatter?

3. **Klasyfikacja akcji na regule:**

| Stan źródła | Akcja na regule |
|---|---|
| Źródło istnieje i jest Keep/Update | Zachowaj regułę bez zmian |
| Źródło zostało Replace | Zaktualizuj Source na nowy plik następcy. Jeśli treść reguły jest nadal prawdziwa — zachowaj. Jeśli następca zmienia rekomendację — przepisz regułę na podstawie nowego następcy |
| Źródło zostało Archive | Usuń regułę — problem nie jest już aktualny |
| Źródło nie istnieje (brak pliku, brak archiwum) | Zweryfikuj aktualność reguły na podstawie codebase. Jeśli nadal poprawna — zachowaj z adnotacją `(źródło usunięte, reguła zachowana)`. Jeśli nie można zweryfikować — usuń |

4. **Deduplikacja:**
   - Porównaj wszystkie reguły parami
   - Jeśli dwie reguły mówią zasadniczo to samo (nawet różnymi słowami), połącz je w jedną, zachowując oba Source
   - Preferuj bardziej precyzyjne sformułowanie

5. **Egzekwowanie limitu ~50:**
   - Po usunięciach i mergach policz reguły
   - Jeśli nadal > 50: usuń reguły o najniższej wartości (najstarsze Source + najwęższe zastosowanie)
   - Zaktualizuj `<!-- rule-count: N -->`

6. **Zapisz zmodyfikowany plik** jeśli wprowadzono jakiekolwiek zmiany.

## Strategia subagentów

Używaj subagentów do izolacji kontekstu przy badaniu wielu artefaktów — nie tylko dlatego, że zadanie brzmi złożono. Wybierz najlżejsze podejście które pasuje:

| Podejście | Kiedy użyć |
|-----------|------------|
| **Tylko główny wątek** | Mały zakres, krótkie dokumenty |
| **Sekwencyjne subagenty** | 1-2 artefakty z wieloma wspierającymi plikami do przeczytania |
| **Równoległe subagenty** | 3+ naprawdę niezależne artefakty z małym nakładaniem |
| **Wsadowe subagenty** | Szerokie przeglądy — najpierw zawęź zakres, potem badaj partiami |

**Przy uruchamianiu dowolnego subagenta, dołącz tę instrukcję w jego zadaniu:**

> Używaj dedykowanych narzędzi do wyszukiwania i czytania plików (Glob, Grep, Read) do całego badania. NIE używaj komend shell (ls, find, cat, grep, test, bash) do operacji na plikach. Unikaj promptów o uprawnienia i jest to bardziej niezawodne.

Dwie role subagentów:

1. **Subagenty badawcze** — tylko do odczytu. Nie mogą edytować plików, tworzyć następców ani archiwizować. Każdy zwraca: ścieżkę pliku, dowody, rekomendowaną akcję, pewność i otwarte pytania. Mogą działać równolegle gdy artefakty są niezależne.
2. **Subagenty zastępujące** — piszą pojedynczy nowy dokument zastępujący przestarzały. Działają **jeden na raz, sekwencyjnie** (każdy subagent zastępujący może potrzebować przeczytać znaczną ilość kodu, a uruchomienie wielu równolegle ryzykuje wyczerpanie kontekstu). Orkiestrator obsługuje całą archiwizację i aktualizacje metadanych po zakończeniu każdego zastąpienia.

Orkiestrator łączy wyniki badań, wykrywa sprzeczności, koordynuje subagenty zastępujące i wykonuje wszystkie operacje archiwizacji/metadanych centralnie. Oznacza niejednoznaczne przypadki jako stale. Jeśli dwa artefakty nakładają się lub omawiają ten sam problem, badaj je razem zamiast równolegle.

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

Przetwarzaj kandydatów Replace **jeden na raz, sekwencyjnie**. Każde zastępstwo pisane jest przez subagenta dla ochrony głównego okna kontekstu.

**Gdy dowody wystarczające:**

1. Uruchom pojedynczego subagenta do napisania dokumentu zastępczego. Przekaż mu:
   - Pełną treść starego dokumentu
   - Podsumowanie dowodów z badania (co się zmieniło, co aktualny kod robi, dlaczego stare wskazówki są mylące)
   - Docelową ścieżkę i kategorię (ta sama kategoria co stary dokument chyba że sama kategoria się zmieniła)
2. Subagent pisze nowy dokument według formatu `/dev-compound`: frontmatter YAML (title, category, date, module, component, tags), opis problemu, root cause, aktualne rozwiązanie z przykładami kodu i zapobieganie.
3. Po zakończeniu pracy subagenta, orkiestrator:
   - Dodaje `superseded_by: [ścieżka nowego dokumentu]` do frontmatter starego dokumentu
   - Przenosi stary dokument do `docs/solutions/_archived/`

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

### Learned Patterns (.claude/rules/learned-patterns.md)

Jeśli plik istnieje i był przeglądany w Fazie 1.7, dodaj sekcję:

```text
Learned Patterns:
  Reguł przed refresh: N
  Reguł po refresh: M
  Usunięte (źródło zarchiwizowane): X
  Zaktualizowane (źródło zastąpione): Y
  Zduplikowane (zmergowane): Z
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
