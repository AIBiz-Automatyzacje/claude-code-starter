---
name: dev-prep
description: "Zamówienie na materiały wejściowe przed planowaniem: makiety, konta, assety, decyzje."
argument-hint: "[etap zbiorczego dokumentu wymagań, np. docs/brainstorms/mvp-requirements.md#etap-17]"
---

# Przygotuj materiały wejściowe przed `/dev-plan`

**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu dokumentów.

`/dev-prep` odpowiada na jedno pytanie: **co człowiek musi mieć gotowe, zanim ma sens odpalenie `/dev-plan`**. Produkuje jeden dokument — zamówienie na materiały wejściowe — i nic więcej.

Ten skill **nie planuje**. Nie tworzy Implementation Units, nie dobiera bibliotek, nie proponuje architektury, nie szacuje. Jeśli zaczynasz pisać „jak to zbudować" — jesteś w złym skillu, to należy do `/dev-plan`.

## Miejsce w pipeline

```
/dev-brainstorm → CO budować (opcjonalny)
/dev-prep       → CZEGO POTRZEBA, ŻEBY ZAPLANOWAĆ   ← ten skill
/dev-plan       → JAK budować (czyta wynik /dev-prep w 1.6 i 3.7)
/dev-docs       → cięcie planu na fazy i zadania
dev-autopilot-wf → wykonanie
```

**Trzy dokumenty operatora — nie myl ich:**

| Dokument | Kto generuje | Kiedy wykonywany | Treść |
|---|---|---|---|
| `docs/operator/<slug>-przed-planem.md` | `/dev-prep` | **przed planowaniem** | makiety do zaprojektowania, konta do założenia, assety do dostarczenia, decyzje do domknięcia |
| `docs/operator/<slug>-przygotowanie.md` | `/dev-plan` (3.7 / 5.2b) | **przed autopilotem** | klucze i środowisko wyprowadzone precyzyjnie z IU, z numerem blokowanej fazy |
| `docs/operator/<data>-<zadanie>-smoke.md` | `dev-docs-complete` | **po autopilocie** | czego automat nie sprawdził |

Granica `/dev-prep` vs 3.7 `/dev-plan`: `/dev-prep` wypisuje pozycje **o długim czasie realizacji po stronie człowieka**, które da się przewidzieć z opisu etapu (makiety, założenie konta w zewnętrznym serwisie, teksty prawne od klienta). 3.7 wypisuje pozycje **wyprowadzone z konkretnych IU** i przypisuje im numer blokowanej fazy. Pokrywanie się jest oczekiwane i nieszkodliwe — 3.7 czyta dokument z `/dev-prep` i nie duplikuje pozycji już odhaczonych.

## Kiedy używać

- Startujesz nowy etap ze zbiorczego dokumentu wymagań (`mvp-requirements.md`) i etap dotyka UI.
- Chcesz zamówić makiety u projektanta, zanim usiądziesz do planowania.
- Etap wymaga kont/kluczy zewnętrznych, których zdobycie zajmie dni, nie minuty.

**Kiedy NIE używać:** bugfix, tech-debt, zmiana czysto backendowa bez nowych integracji, poprawka w istniejącym ekranie bez nowego designu. Wtedy idź wprost do `/dev-plan` — on i tak zapyta o Figmę w 1.6, a `/dev-prep` doda tylko pusty dokument.

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

Nie kontynuuj bez jednoznacznego zakresu jednej iteracji. „Cały MVP" nie jest zakresem — zamówienie na makiety do dwudziestu ekranów naraz jest nie do wykonania i dezaktualizuje się szybciej, niż powstaje.

**Słownik domenowy:** jeśli istnieje `docs/CONCEPTS.md`, przeczytaj go i używaj jego terminologii w nazwach ekranów. Nazwa ekranu w zamówieniu jest później kluczem dopasowania do URL-a Figmy w `/dev-plan` — rozjazd nazewnictwa kosztuje ręczne mapowanie.

#### 0.2 Ustal `<feature-slug>`

`<feature-slug>` = kebab-case, 3–5 słów, opisujący etap (np. `onboarding-uzytkownika`, `panel-rozliczen`). **Ten sam slug** trafi później do `docs/plans/<feature-slug>-figma/` i `docs/operator/<feature-slug>-przygotowanie.md` — `/dev-plan` przyjmuje go z tego dokumentu zamiast wymyślać własny. Wpisz go do frontmattera (Faza 3) jako `feature_slug:`.

#### 0.3 Idempotentność

Jeśli `docs/operator/<feature-slug>-przed-planem.md` już istnieje, przeczytaj go i zadaj `AskUserQuestion`:

> „Dokument przygotowania dla `<feature-slug>` już istnieje (N pozycji, M odhaczonych). Co robimy?"

Opcje: `Zaktualizuj w miejscu` (rekomendowane — **zachowaj zaznaczone `[x]`**, dopisz nowe pozycje, oznacz nieaktualne jako `~~przekreślone~~` z jednozdaniowym powodem) / `Pokaż stan i wyjdź` / `Nadpisz od zera`.

Nigdy nie odznaczaj `[x]` postawionego przez człowieka — to jego oświadczenie, że materiał jest gotowy.

### Faza 1: Rozpoznanie

Wykonaj **przed** pisaniem czegokolwiek. Cel: nie zamawiać rzeczy, które już są.

#### 1.1 Klasyfikacja UI / pure-data

Tą samą regułą ścieżek co `/dev-plan` 1.6 krok A:

- **Dotyka UI** — etap opisuje ekrany, komponenty, layouty, nawigację, stany widoczne dla użytkownika.
- **Pure-data** — praca zamyka się w `src/lib/`, `src/hooks/`, `supabase/migrations/`, `supabase/functions/`, konfiguracji.

Ogłoś wynik jednym zdaniem. Przy **pure-data** sekcja „Makiety" nie powstaje (wpisz w niej jedno zdanie „Etap nie dotyka UI — brak zamówienia na makiety."), a pozostałe trzy sekcje wypełniasz normalnie.

#### 1.2 Skan repo (równolegle, read-only)

| Co sprawdzasz | Po co |
|---|---|
| Istniejące route'y / strony (`src/pages/`, `src/features/*/`, router) | ekran, który już istnieje, to zamówienie na **modyfikację** z opisem różnicy — nie na nowy design |
| `docs/DESIGN.md` | brak = pozycja w sekcji „Decyzje": design system nie istnieje, projektant nie ma tokenów |
| `docs/plans/*-figma/SPEC.md` | pokrywający się feature = część makiet już sfetchowana; nie zamawiaj ich ponownie |
| `.env.example`, `.env.local` (tylko **nazwy** zmiennych — `grep -o '^[A-Z_]*='`) | które klucze już są ustawione, a które trzeba zdobyć |
| `docs/solutions/` | wcześniejsze wnioski o tej domenie |
| `public/`, `src/assets/` | jakie assety już są |

**Nigdy nie czytaj ani nie cytuj wartości sekretów.** Operuj wyłącznie nazwami zmiennych — dokument trafia do gita.

Gdy skan repo wymaga przeszukania wielu lokalizacji, deleguj do agenta `Explore` albo `repo-research-analyst` zamiast czytać plik po pliku.

### Faza 2: Wyprowadź cztery listy

Wyprowadzaj **wyłącznie** z dokumentu źródłowego i skanu repo. Czego nie ma w etapie, nie wymyślaj — to ta sama zasada, która obowiązuje `/dev-docs` wobec planu. Gdy czegoś nie wiesz, wpisz to do sekcji „Decyzje do domknięcia" zamiast zgadywać.

#### 2.1 Makiety (tylko gdy etap dotyka UI)

Dla każdego ekranu/komponentu z etapu zapisz:

- **Nazwa** w kebab-case (`panel-rozliczen`, `modal-potwierdzenia`) — będzie kluczem przy podawaniu URL-a Figmy w `/dev-plan` 1.6 krok D.
- **Status**: `nowy` / `modyfikacja <ścieżka istniejącego pliku>` / `już zaprojektowany (SPEC: <ścieżka>)`.
- **Co pokazuje** — jedno–dwa zdania z wymagań etapu, nie z wyobraźni.
- **Stany do zaprojektowania** — wypisz te, które etap implikuje: pusty, ładowanie, błąd, brak uprawnień, stan po sukcesie, walidacja formularza. Brakujący stan pustej listy to najczęstsza dziura, która wychodzi dopiero u buildera.
- **Breakpointy** — mobile / desktop / oba, zgodnie z tym, co mówi etap. Gdy etap milczy: wpisz „do potwierdzenia" i dodaj pozycję do „Decyzji".
- **Wymagania z etapu**, które ekran realizuje (identyfikatory `R1`, `#etap-17` itp.) — to jest traceability, którą `/dev-plan` przenosi dalej.

Nie projektuj. Nie opisuj układu, kolorów ani komponentów shadcn/ui — zamawiasz makietę, a nie zastępujesz projektanta.

#### 2.2 Konta, klucze, dostępy

Wyłącznie te, które wynikają z opisu etapu (integracja z zewnętrznym serwisem, płatności, mapy, auth przez dostawcę, monitoring) **i** których nie widać w `.env.example` / `.env.local` jako już ustawionych. Dla każdej pozycji: **co**, **po co**, **jak zdobyć** (gdzie wejść, co kliknąć, do jakiej zmiennej wpisać), **dowód** (komenda lub obserwacja).

Sekrety opisuj **nazwą zmiennej**, nigdy wartością.

Nie wpisuj tu rzeczy, które autopilot robi sam (typecheck, testy, dev server, migracje i seedy na projekt e2e, `git`) ani środowiska E2E — to domena 3.7 `/dev-plan`, które policzy scenariusze `[E2E]` z gotowych IU.

#### 2.3 Assety i treści

Favicon, ikony, ilustracje empty state, wideo, zdjęcia, teksty prawne (regulamin, polityka prywatności), tłumaczenia, treści od klienta. Kryterium jest jedno: **czas realizacji po stronie człowieka**. Rzeczy, które da się wygenerować w minutę podczas implementacji, tu nie należą.

Dla każdej pozycji: co, w jakim formacie/rozmiarze (gdy etap to określa), kto dostarcza.

#### 2.4 Decyzje produktowe do domknięcia

Pytania, które etap zostawia otwarte, a bez których `/dev-plan` się zatrzyma (zasada 0.5 `dev-plan`: nierozwiązany bloker planowania). Typowo: który dostawca płatności, czy wymagamy weryfikacji e-mail, co się dzieje przy przekroczeniu limitu, jaki jest zakres uprawnień roli.

Każdą pozycję zapisz jako pytanie zamknięte z wypisanymi opcjami, nie jako temat do przemyślenia. Pytanie bez opcji wraca do Ciebie po tygodniu w tej samej postaci.

Oznacz **[blokuje planowanie]** te, bez których nie da się napisać IU. Pozostałe zostaw jako „warto ustalić".

### Faza 3: Zapisz dokument

`mkdir -p docs/operator/` i zapisz `docs/operator/<feature-slug>-przed-planem.md`:

```markdown
---
feature_slug: <feature-slug>
origin: docs/brainstorms/mvp-requirements.md#etap-17
utworzono: YYYY-MM-DD
dotyka_ui: true | false
status: do-zrobienia | gotowe
---

# Przygotowanie przed planowaniem — <Tytuł etapu>

Źródło: `docs/brainstorms/mvp-requirements.md#etap-17` · Utworzono: YYYY-MM-DD
Status: **do zrobienia przed `/dev-plan`** — odhaczaj `[ ]` → `[x]`.

To lista materiałów wejściowych, bez których planowanie będzie zgadywaniem.
Pozycje **[blokuje planowanie]** muszą być gotowe przed `/dev-plan`; pozostałe mogą dojść w trakcie.

## 1. Makiety do zaprojektowania

Po zaprojektowaniu wklej URL-e Figmy przy ekranach — `/dev-plan` weźmie je stąd zamiast pytać.

- [ ] **`<nazwa-ekranu>`** — nowy / modyfikacja `src/pages/<x>.tsx` — **[blokuje planowanie]**
  - Co pokazuje: <1–2 zdania z etapu>
  - Stany: pusty · ładowanie · błąd · <inne z etapu>
  - Breakpointy: mobile + desktop
  - Wymagania: R3, R7
  - URL Figma: _(wklej po zaprojektowaniu)_

## 2. Konta, klucze, dostępy

- [ ] **<Co zrobić>**
  - Po co: <co się stanie bez tego>
  - Jak: <gdzie wejść, co skopiować, do jakiej zmiennej>
  - Dowód: `grep <NAZWA_ZMIENNEJ> .env.local` zwraca wartość

## 3. Assety i treści

- [ ] **<Co>** — format/rozmiar: <…> — dostarcza: <kto>

## 4. Decyzje do domknięcia

- [ ] **<Pytanie zamknięte?>** — **[blokuje planowanie]**
  - Opcje: A) <…> B) <…>
  - Dlaczego blokuje: <który obszar etapu zależy od odpowiedzi>
  - Ustalono: _(wpisz wybór)_

---
Gdy wszystkie **[blokuje planowanie]** są odhaczone: `/dev-plan docs/brainstorms/mvp-requirements.md#etap-17`
```

Sekcję bez pozycji zostaw z jedną linią „Brak — nic do przygotowania w tej kategorii." Nie usuwaj nagłówka: `/dev-plan` szuka sekcji po numerze i tytule.

### Faza 4: Podsumowanie i handoff

Ogłoś:

```text
Przygotowanie przed planowaniem: docs/operator/<feature-slug>-przed-planem.md
Makiety: N ekranów (M blokuje planowanie) · Konta/klucze: N · Assety: N · Decyzje: N (M blokuje)
```

Następnie zadaj `AskUserQuestion`: „Co dalej?"

- `Zamawiam makiety i wracam później` — zakończ. Przypomnij jedną linią: po zaprojektowaniu wklej URL-e Figmy do sekcji 1, wtedy `/dev-plan` nie zapyta o nie ponownie.
- `Wszystko już mam — planujmy` — **uruchom `/dev-plan <origin>` w tej sesji** (nie opisuj tylko komendy). Przed uruchomieniem sprawdź, czy któraś pozycja **[blokuje planowanie]** została nieodhaczona; jeśli tak, wymień je i potwierdź, że użytkownik świadomie idzie dalej.
- `Popraw dokument` — wróć do Fazy 2 z jego uwagami.

**Commit:** dokument jest artefaktem planowania — `/dev-docs` dociąga takie ścieżki do commitu inicjalnego na branchu feature'a (klasa (a) w jego Fazie 0). Nie commituj go sam, chyba że użytkownik poprosi.

**Tryb pipeline:** przy wywołaniu z automatycznego workflow lub kontekstu `disable-model-invocation` pomiń pytania interaktywne, podejmij potrzebne wybory sam i zapisz dokument.
