---
name: dev-prep
description: "Operator checklist etapu przed planowaniem: decyzje, konta, assety, makiety."
argument-hint: "[etap zbiorczego dokumentu wymagań, np. docs/brainstorms/mvp-requirements.md#etap-17]"
---

# Operator checklist etapu — przygotowanie przed `/dev-plan`

**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu dokumentów.

`/dev-prep` odpowiada na jedno pytanie: **co człowiek musi dostarczyć poza kodem, zanim ruszy etap**. Produkuje jeden dokument w `docs/operator/` — i nic więcej. Nazwa domyślna to `<feature-slug>-przygotowanie.md`, ale gdy w katalogu jest już seria checklist, skill dziedziczy jej konwencję (0.3).

To **jedyny** dokument przygotowawczy w pipeline. `/dev-plan` go **czyta i uzupełnia** o to, co wyjdzie dopiero z Implementation Units (numery blokowanych faz, klucze wynikłe z konkretnych plików, środowisko E2E) — nie tworzy drugiej listy. `/dev-docs` sprawdza go w bramce gotowości przed autopilotem.

Ten skill **nie planuje**. Nie tworzy Implementation Units, nie dobiera bibliotek, nie proponuje architektury, nie szacuje. Jeśli zaczynasz pisać „jak to zbudować" — jesteś w złym skillu, to należy do `/dev-plan`.

## Miejsce w pipeline

```
/dev-brainstorm → CO budować (opcjonalny)
/dev-prep       → CO CZŁOWIEK MUSI DOSTARCZYĆ   ← ten skill, tworzy <slug>-przygotowanie.md
/dev-plan       → JAK budować; czyta ten dokument (0.2, 1.6) i UZUPEŁNIA go (3.7/5.2b)
/dev-docs       → cięcie planu na fazy; sprawdza dokument w bramce gotowości
dev-autopilot-wf → wykonanie
```

**Dwa dokumenty operatora w całym cyklu — nie myl ich:**

| Dokument | Kto tworzy | Kiedy wykonywany | Treść |
|---|---|---|---|
| `docs/operator/<slug>-przygotowanie.md` | **`/dev-prep`** (uzupełnia `/dev-plan`) | **przed implementacją** | decyzje, konta i konsole, sekrety, assety, makiety |
| `docs/operator/<data>-<zadanie>-smoke.md` | `dev-docs-complete` | **po autopilocie** | czego automat nie sprawdził |

## Kiedy używać

- Startujesz etap zbiorczego dokumentu wymagań (`mvp-requirements.md`, roadmapa etapów) — zwłaszcza gdy wymaga kont zewnętrznych, assetów albo makiet.
- Chcesz zamówić makiety u projektanta albo założyć konta, zanim usiądziesz do planowania.

**Kiedy NIE używać:** bugfix, tech-debt, zmiana czysto backendowa bez nowych integracji i assetów. Wtedy wprost `/dev-plan` — on utworzy krótką listę sam (5.2b), jeśli w ogóle będzie co wpisać.

## Metoda interakcji

Używaj `AskUserQuestion` gdy dostępne; w przeciwnym razie numerowane opcje w chacie i czekaj na odpowiedź. Zadawaj jedno pytanie na raz. Nie pytaj o rzeczy, które możesz sam ustalić z dokumentu źródłowego albo ze skanu repo — to najczęstszy sposób, w jaki ten skill staje się uciążliwy.

## Źródło

<zrodlo> #$ARGUMENTS </zrodlo>

### Faza 0: Ustal źródło i slug

#### 0.1 Znajdź dokument źródłowy

Kolejność (pierwsze trafienie wygrywa):

1. **Argument wskazuje etap** — ścieżka z kotwicą sekcji (`docs/brainstorms/mvp-requirements.md#etap-17`). Przeczytaj **wyłącznie tę sekcję** plus sekcje przekrojowe dokumentu („decyzje obowiązujące", „ustalenia", „konwencje"), jeśli istnieją.
2. **Argument wskazuje plik bez kotwicy** — przeczytaj, wypisz etapy/sekcje i zapytaj przez `AskUserQuestion`, którego etapu dotyczy przygotowanie. Nie przetwarzaj całego dokumentu naraz.
3. **Argument pusty** — zrób glob `docs/brainstorms/*.md`. Jeden trafny dokument → wypisz jego etapy i zapytaj o etap. Wiele → zapytaj najpierw o dokument. Zero → zapytaj: „Nie znalazłem dokumentu wymagań w `docs/brainstorms/`. Podaj ścieżkę do etapu albo opisz zakres iteracji."

Nie kontynuuj bez jednoznacznego zakresu **jednego etapu**. „Cały MVP" nie jest zakresem — checklista do dwudziestu ekranów naraz jest nie do wykonania i dezaktualizuje się szybciej, niż powstaje.

Jeśli dokument źródłowy ma etapy zależne (`Zależy od: E1`), sprawdź stan poprzedniego etapu i zanotuj go w nagłówku — pozycje już dostarczone w poprzednim etapie **nie wracają** na listę.

**Słownik domenowy:** jeśli istnieje `docs/CONCEPTS.md`, przeczytaj go i używaj jego terminologii w nazwach ekranów. Nazwa ekranu w sekcji makiet jest kluczem dopasowania do URL-a Figmy w `/dev-plan` 1.6 — rozjazd nazewnictwa kosztuje ręczne mapowanie.

#### 0.2 Ustal `<feature-slug>`

`<feature-slug>` = kebab-case, 3–5 słów, opisujący etap (np. `e2-auth-onboarding`, `panel-rozliczen`). Przy dokumencie etapowym użyj identyfikatora etapu jako prefiksu — porządkuje `docs/operator/` chronologicznie.

**Ten sam slug** trafi później do `docs/plans/<feature-slug>-figma/` i nazwy pliku planu — `/dev-plan` przyjmuje go z frontmattera tego dokumentu zamiast wymyślać własny.

#### 0.3 Nazwa pliku — dziedzicz z istniejącej serii

Domyślna nazwa to `docs/operator/<feature-slug>-przygotowanie.md`, ale **projekt z zastaną serią checklist wygrywa z tą domyślną**. Operator rozpoznaje swoje dokumenty po nazwie; wstawienie w środek serii pliku nazwanego inaczej łamie porządek katalogu.

Ustal nazwę tak:

1. Zrób `ls docs/operator/*.md`. Odrzuć `*-smoke.md` (generuje je `dev-docs-complete`) i pliki bez frontmattera/nagłówka checklisty (poradniki, notatki).
2. Jeśli zostały **≥2 pliki dzielące wspólny sufiks** po identyfikatorze etapu — masz serię. Przykłady: `e1-operator-checklist.md` + `e2-operator-checklist.md` → sufiks `-operator-checklist`; `etap-3-przygotowanie.md` + `etap-4-przygotowanie.md` → sufiks `-przygotowanie`.
3. Odtwórz **prefiks** z konwencji serii, nie ze swojego slugu: gdy seria używa identyfikatorów etapu (`e1`, `e2`, `etap-3`), użyj identyfikatora **tego** etapu z dokumentu źródłowego w tym samym formacie. Gdy seria używa pełnych slugów — użyj `<feature-slug>`.
4. **Jeden plik w katalogu** = za mało na serię, ale za dużo na ignorowanie: przyjmij jego sufiks, jeśli jest jednoznaczny.
5. **Dwa konkurencyjne wzorce** (np. `e1-external-setup-checklist.md` obok `e2-operator-checklist.md`) → zapytaj przez `AskUserQuestion`, którą konwencję kontynuować, pokazując obie jako pełne nazwy pliku, który zaraz utworzysz.
6. **Pusty katalog** → nazwa domyślna.

Wybraną nazwę ogłoś jednym zdaniem przed zapisem: „Kontynuuję konwencję serii: `docs/operator/e3-operator-checklist.md`."

Do frontmattera dokumentu **zawsze** wpisz `feature_slug:` i `origin:` — `/dev-plan` odnajduje checklistę po nich, nie po nazwie pliku, więc dowolna konwencja nazewnicza działa w pipeline bez zmian.

#### 0.4 Idempotentność

Jeśli plik o ustalonej w 0.3 nazwie już istnieje, przeczytaj go i zadaj `AskUserQuestion`:

> „Przygotowanie dla `<feature-slug>` już istnieje (N pozycji, M odhaczonych). Co robimy?"

Opcje: `Zaktualizuj w miejscu` (rekomendowane — **zachowaj zaznaczone `[x]` wraz z wpisanymi wartościami i datami**, dopisz nowe pozycje, oznacz nieaktualne jako `~~przekreślone~~` z jednozdaniowym powodem) / `Pokaż stan i wyjdź` / `Nadpisz od zera`.

Nigdy nie odznaczaj `[x]` postawionego przez człowieka — to jego oświadczenie, że materiał jest gotowy. Nie kasuj też dopisanych przy pozycjach wartości („Team ID = `GFFF7Z9PK9`, sprawdzone 2026-06-16") — dokument jest dziennikiem ustaleń, nie tylko listą.

### Faza 1: Rozpoznanie

Wykonaj **przed** pisaniem czegokolwiek. Cel: nie zamawiać rzeczy, które już są.

#### 1.1 Klasyfikacja UI / pure-data

Tą samą regułą ścieżek co `/dev-plan` 1.6 krok A:

- **Dotyka UI** — etap opisuje ekrany, komponenty, layouty, nawigację, stany widoczne dla użytkownika.
- **Pure-data** — praca zamyka się w `src/lib/`, `src/hooks/`, `supabase/migrations/`, `supabase/functions/`, konfiguracji.

Ogłoś wynik jednym zdaniem. Przy **pure-data** sekcja „Makiety" nie powstaje (wpisz w niej „Etap nie dotyka UI — brak makiet do przygotowania."), pozostałe wypełniasz normalnie.

#### 1.2 Skan repo (równolegle, read-only)

| Co sprawdzasz | Po co |
|---|---|
| Istniejące route'y / strony (`src/pages/`, `src/features/*/`, router) | ekran, który już istnieje, to zamówienie na **modyfikację** z opisem różnicy — nie na nowy design |
| `docs/DESIGN.md` | brak = pozycja w sekcji „Decyzje": design system nie istnieje, projektant nie ma tokenów |
| `docs/plans/*-figma/SPEC.md` | pokrywający się feature = część makiet już sfetchowana; nie zamawiaj ich ponownie |
| `.env.example`, `.env.local` (tylko **nazwy** zmiennych — `grep -o '^[A-Z_]*='`) | które klucze już są ustawione, a które trzeba zdobyć |
| Checklisty wcześniejszych etapów w `docs/operator/` (nazwy wg 0.3) | co dostarczono wcześniej — nie powtarzaj; trzymaj się układu sekcji tamtych plików |
| `docs/solutions/` | wcześniejsze wnioski o tej domenie |
| `public/`, `src/assets/` | jakie assety już są |

**Nigdy nie czytaj ani nie cytuj wartości sekretów.** Operuj wyłącznie nazwami zmiennych — dokument trafia do gita.

Gdy skan wymaga przeszukania wielu lokalizacji, deleguj do agenta `Explore` albo `repo-research-analyst` zamiast czytać plik po pliku.

### Faza 2: Wyprowadź listy

Wyprowadzaj **wyłącznie** z dokumentu źródłowego i skanu repo. Czego nie ma w etapie, nie wymyślaj. Gdy czegoś nie wiesz, wpisz to do sekcji „Decyzje" zamiast zgadywać.

Obowiązuje jedna granica: **tu trafia wyłącznie to, co robi człowiek poza kodem**. Migracje, komponenty, testy, dev server, `git` — to implementacja. Gdy pozycja jest blisko granicy, dopisz przy niej `*(kod — robi autopilot)*` zamiast kasować; operator przy nagraniu/przeglądzie wie wtedy, że to nie jego krok.

#### 2.1 Decyzje

Na górze dokumentu, bo zwykle blokują resztę: nieodwracalne wybory (bundle identifier, region danych, dostawca płatności), rozstrzygnięcia produktowe zostawione otwarte przez etap, wybór między wariantami implementacji, który zmienia zakres.

Każdą zapisz jako **pytanie zamknięte z wypisanymi opcjami**, nie jako temat do przemyślenia. Pytanie bez opcji wraca do Ciebie po tygodniu w tej samej postaci. Oznacz **[blokuje planowanie]** te, bez których `/dev-plan` nie napisze IU (zasada 0.5 `dev-plan`: nierozwiązany bloker planowania).

#### 2.2 Konta, konsole, sekrety

Konta i konsole zewnętrzne (dostawca auth, płatności, monitoring, mapy, store'y), tokeny, klucze, zmienne środowiskowe — te, które wynikają z opisu etapu i których nie widać jako już ustawionych.

Dla każdej pozycji: **co**, **po co / co blokuje**, **jak** (gdzie wejść, co kliknąć, do jakiej zmiennej wpisać), **dowód wykonania** (komenda lub obserwacja).

Oznacz każdą wartość jako 🔓 publiczną (może iść do repo) albo 🔒 sekret (nigdy do gita) i zamknij dokument sekcją **„Gdzie to ląduje"** — która wartość idzie do `.env`, która do sekretów builda, która do konfiguracji. Sekrety opisuj **nazwą zmiennej**, nigdy wartością.

**Kolejność ma znaczenie.** Gdy jedna pozycja zależy od innej (klucz wymaga fingerprintu, który powstaje dopiero z builda; DSN wymaga org założonej w wybranym regionie), zapisz to wprost jako notatkę o kolejności — inaczej operator utknie w połowie i wróci z pytaniem.

#### 2.3 Assety i treści

Ikony, favicon, splash, ilustracje empty state, wideo, dźwięki, fonty (wraz z licencją), teksty prawne, tłumaczenia, treści od klienta. Kryterium: **czas realizacji po stronie człowieka**. Rzeczy do wygenerowania w minutę podczas implementacji tu nie należą.

Dla każdej: co, format/wymiary (gdy etap je określa), kto dostarcza, gdzie w repo ma wylądować.

Świadomie odpuszczony asset oznacz `[~]` z powodem i tym, co go zastępuje — to dług, nie brak.

#### 2.4 Makiety (tylko gdy etap dotyka UI)

Ta sekcja musi być gotowa **przed** `/dev-plan` — makiety są referencją dla implementacji, a ich zawartość determinuje format assetów z 2.3.

Dla każdego ekranu/komponentu z etapu:

- **Nazwa** w kebab-case (`panel-rozliczen`, `modal-potwierdzenia`) — klucz dopasowania do URL-a Figmy w `/dev-plan` 1.6 krok D.
- **Status**: `nowy` / `modyfikacja <ścieżka istniejącego pliku>` / `już zaprojektowany (SPEC: <ścieżka>)`.
- **Co pokazuje** — jedno–dwa zdania z wymagań etapu, nie z wyobraźni.
- **Stany do zaprojektowania** — te, które etap implikuje: pusty, ładowanie, błąd, brak uprawnień, po sukcesie, walidacja formularza. Brakujący stan pustej listy to najczęstsza dziura, która wychodzi dopiero u buildera.
- **Breakpointy** — zgodnie z etapem; gdy etap milczy, wpisz „do potwierdzenia" i dodaj pozycję do 2.1.
- **Wymagania z etapu**, które ekran realizuje (`R1`, `#etap-17`) — traceability, którą `/dev-plan` przenosi dalej.
- **`URL Figma:`** — puste pole do wklejenia po zaprojektowaniu.

Nie projektuj. Nie opisuj układu, kolorów ani komponentów — zamawiasz makietę, nie zastępujesz projektanta.

### Faza 3: Zapisz dokument

`mkdir -p docs/operator/` i zapisz plik pod nazwą ustaloną w 0.3 (domyślnie `docs/operator/<feature-slug>-przygotowanie.md`):

```markdown
---
feature_slug: <feature-slug>
origin: docs/brainstorms/mvp-requirements.md#etap-17
utworzono: YYYY-MM-DD
dotyka_ui: true | false
status: do-zrobienia | gotowe
---

# <Etap> — Operator checklist (przygotowanie przed implementacją)

**Etap:** <nazwa etapu ze źródła> · **Utworzono:** YYYY-MM-DD · **Zależy od:** <poprzedni etap / —>
Źródło: `docs/brainstorms/mvp-requirements.md#etap-17`

> Lista kroków, które robi **człowiek poza kodem**: decyzje, konta zewnętrzne, sekrety, assety, makiety.
> Kod (migracje, komponenty, testy) powstaje w implementacji — nie jest tutaj.
> Legenda: 🔓 publiczne (może iść do repo) · 🔒 sekret (nigdy do gita) · `[~]` świadomy dług · *(kod)* nie Twój krok.
> `/dev-plan` dopisze do tej listy numery blokowanych faz i pozycje wynikłe z Implementation Units.

## 1. Decyzje (zero plików, ale blokują resztę)

- [ ] **<Pytanie zamknięte?>** — **[blokuje planowanie]**
  - Opcje: A) <…> B) <…>
  - Dlaczego blokuje: <który obszar etapu zależy od odpowiedzi>
  - Ustalono: _(wpisz wybór i datę)_

## 2. Konta, konsole, sekrety

Kolejność: <notatka, gdy pozycje zależą od siebie>

- [ ] 🔒 **<Co zrobić>**
  - Po co: <co się stanie bez tego>
  - Jak: <gdzie wejść, co skopiować, do jakiej zmiennej>
  - Dowód: `grep <NAZWA_ZMIENNEJ> .env.local` zwraca wartość

## 3. Assety i treści

- [ ] 🔓 **<Co>** — format/wymiary: <…> — dostarcza: <kto> — ląduje w: `<ścieżka>`

## 4. Makiety

Po zaprojektowaniu wklej URL-e — `/dev-plan` weźmie je stąd zamiast pytać.

- [ ] **`<nazwa-ekranu>`** — nowy / modyfikacja `src/pages/<x>.tsx`
  - Co pokazuje: <1–2 zdania z etapu>
  - Stany: pusty · ładowanie · błąd · <inne z etapu>
  - Breakpointy: mobile + desktop
  - Wymagania: R3, R7
  - URL Figma: _(wklej po zaprojektowaniu)_

## Gdzie to ląduje

- 🔓 → `.env` / konfiguracja klienta
- 🔒 → sekrety builda + lokalny `.env` poza gitem

---
Gdy **[blokuje planowanie]** są odhaczone: `/dev-plan docs/brainstorms/mvp-requirements.md#etap-17`
```

Sekcję bez pozycji zostaw z jedną linią „Brak — nic do przygotowania w tej kategorii." Nie usuwaj nagłówka: `/dev-plan` i `/dev-docs` szukają sekcji po numerze i tytule.

Gdy w `docs/operator/` istnieją dokumenty z wcześniejszych etapów — **trzymaj się ich układu sekcji i nazewnictwa**, nawet jeśli różni się od szablonu powyżej. Spójność serii jest ważniejsza niż zgodność z tym skillem.

### Faza 4: Podsumowanie i handoff

Ogłoś:

```text
Operator checklist: docs/operator/<nazwa ustalona w 0.3>
Decyzje: N (M blokuje planowanie) · Konta/sekrety: N · Assety: N · Makiety: N ekranów
```

Następnie zadaj `AskUserQuestion`: „Co dalej?"

- `Idę dostarczyć pozycje i wracam` — zakończ. Przypomnij jedną linią: po zaprojektowaniu makiet wklej URL-e do sekcji 4, wtedy `/dev-plan` nie zapyta o Figmę.
- `Wszystko już mam — planujmy` — **uruchom `/dev-plan <origin>` w tej sesji** (nie opisuj tylko komendy). Wcześniej sprawdź nieodhaczone pozycje **[blokuje planowanie]**; jeśli są, wymień je i potwierdź, że użytkownik świadomie idzie dalej.
- `Popraw dokument` — wróć do Fazy 2 z jego uwagami.

**Commit:** dokument jest artefaktem planowania — `/dev-docs` dociąga takie ścieżki do commitu inicjalnego na branchu feature'a (klasa (a) w jego Fazie 0). Nie commituj go sam, chyba że użytkownik poprosi.

**Tryb pipeline:** przy wywołaniu z automatycznego workflow lub kontekstu `disable-model-invocation` pomiń pytania interaktywne, podejmij potrzebne wybory sam i zapisz dokument.
