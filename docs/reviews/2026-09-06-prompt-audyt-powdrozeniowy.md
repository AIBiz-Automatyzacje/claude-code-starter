# Prompt startowy — audyt powdrożeniowy 2026-09-06

Do wklejenia w nowej sesji po wyczyszczeniu kontekstu. Treść poniżej linii jest promptem.

---

Robimy audyt powdrożeniowy szablonu `workspace-template` na dowodach z dwóch realnych projektów.
Kontekst masz w plikach — nie musisz niczego odtwarzać z rozmowy.

## Co się stało wcześniej

2026-09-02 przeprowadziliśmy audyt szablonu na dowodach z 39 runów autopilota. 2026-09-03 wdrożyliśmy
cały plan naprawy: Tura A (9 poprawek punktowych), Tura B (12 zmian zachowania), Tura C (nowy skill
`/dev-pr` + `dev-pr-wf.js`). Commity `cd1d0c0..5729d38` w `~/Documents/Kodowanie/workspace-template`,
wypchnięte na `origin/main`. **Żadna z tych zmian nie była wtedy zweryfikowana runem** — powstały
na dowodach historycznych, nie na dowodach, że działają.

Od tego czasu dwa projekty zaciągnęły nowy szablon przez `/sync-template` i **przerobiły po jednym
pełnym zadaniu**. To jest materiał do tego audytu.

## Projekty i materiał

**1. `/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online`**
- zadanie: `faza-7-szablony-i-grafiki`, **6 faz**, zarchiwizowane w `docs/completed/faza-7-szablony-i-grafiki/`
- telemetria: STOP 2026-09-03 18:30 (9k) → STOP 2026-09-04 16:49 (1136k, 6/6 faz z metrykami) → **OK** 2026-09-04 17:38 (217k)
- ślady w gicie: 5 commitów `fix(pr)` (czyli `/dev-pr` był używany), 2 × `stan pipeline'u po STOP`, 7 × `kontrola diffu naprawczego`

**2. `/Users/kacper_trzepiecinski/Documents/Kodowanie/claude-cron`**
- zadanie: `zalaczniki-w-skrzynce`, **4 fazy**, zarchiwizowane w `docs/completed/zalaczniki-w-skrzynce/`
- telemetria: 3 × STOP 2026-09-03 (3k, 3k, 132k) → **OK** 2026-09-03 22:03 (1376k, 4/4 faz)
- ślady w gicie: 2 commity `fix(pr)`, 1 × `stan pipeline'u po STOP`, 3 × `kontrola diffu naprawczego`

Oba projekty są na `main` (zadania zmergowane). Oba mają nowy szablon — potwierdzone obecnością
`.claude/workflows/dev-pr-wf.js` i reviewera `correctness` w `dev-docs-review-wf.js`.

## Źródło prawdy

`~/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-03-plan-naprawy.md`, rozdział
**„Review wprowadzonych zmian"** na końcu pliku. **Przeczytaj go w całości, zanim cokolwiek sprawdzisz.**
Zawiera: cztery źródła dowodów, trzy progi alarmowe z gotową akcją naprawczą, tabele pozycja-po-pozycji
dla Tur A, B i C z pustą kolumną „Wynik", ryzyko przy synchronizacji i otwarte decyzje.

Uwaga: ten plik jest **nieśledzony w gicie** (świadoma decyzja operatora) — istnieje tylko lokalnie.

Raport z audytu (`2026-09-02-audyt-pipeline.md`) otwieraj tylko wtedy, gdy potrzebujesz liczby bazowej
do porównania — plan jest samowystarczalny.

## Zadanie

**Część 1 — czy poprawki zadziałały.** Przejdź tabele z rozdziału „Review wprowadzonych zmian"
pozycja po pozycji i **wypełnij kolumnę „Wynik"** w pliku planu. Dla każdej pozycji podaj dowód
(ścieżka pliku, wpis telemetrii, hash commita), nie opinię.

**Część 2 — trzy progi alarmowe.** Policz je na realnych danych z obu runów:
1. mediana `tokenyEtapy.fix` — oczekiwanie 60–80k, próg alarmowy >120k
2. efekt dossier — czy review realnie stanieje (uwaga: mierz czas i liczbę wywołań narzędzi, **nie
   tokeny wyjściowe**)
3. liczba **potwierdzonych** P1/P2 typu KOD przez fazy — spadek = warunek odwrotu B12

**Część 3 — co jeszcze warto poprawić.** To nie jest powtórka audytu z 2026-09-02. Szukasz wyłącznie
rzeczy widocznych **w tych dwóch runach**: nowych klas problemów, które te zmiany wprowadziły albo
odsłoniły, oraz miejsc, gdzie koszt jest nieproporcjonalny do wartości. Każda propozycja z severity,
dowodem i szacunkiem kosztu wdrożenia.

## Znany trop — nie odkrywaj go od zera

Sprawdziłem to wstępnie 2026-09-06 i **jest to potwierdzony problem**: metryki dodane w A7, B3 i B4
(`przebieg.dossier`, `przebieg.sceptycy`, `przebieg.tiery`, `przebieg.severityKorekty`) **nie są
widoczne nigdzie poza żywym logiem workflowu**. Nie ma ich ani w tabeli `## Przebieg review` w raporcie
(funkcja `przebiegBlok` w `dev-docs-review-wf.js`), ani w telemetrii (funkcja `skrotPrzebiegu`
w `dev-autopilot-wf.js` filtruje, co trafia do stanu i wpisu JSONL).

Skutek: **dwa z trzech progów alarmowych są dziś niemierzalne**, bo plan każe patrzeć na pola, których
w tych źródłach nie ma. W telemetrii widać `dossier: undefined` we wszystkich fazach obu runów.

Potwierdź to i zaproponuj naprawę (dopisanie wierszy do `przebiegBlok` + pól do `skrotPrzebiegu`),
ale **nie wdrażaj jej bez mojej zgody** — najpierw chcę zobaczyć całość audytu.

## Zasady

- **Dowody przed opiniami.** Zaczynasz od telemetrii (`~/.claude/telemetry/autopilot-runs.jsonl`),
  `.autopilot-state.json`, raportów `review-faza-N.md` i `git log`. Nie pytasz mnie o wrażenia.
- **„Nie da się sprawdzić, bo run nie dotknął tej ścieżki" jest poprawnym wynikiem** i lepszym niż
  naciągnięte „wygląda OK". Zmiana nietknięta przez run zostaje niezweryfikowana — tak ją zapisz.
- **Nie zmieniaj kodu szablonu w tej sesji.** Audyt kończy się raportem i listą propozycji; wdrożenie
  to osobna decyzja i osobna sesja. Wyjątek: wypełnienie kolumny „Wynik" w planie naprawy.
- Nie commituj niczego bez mojej zgody.
- Gdy dwa projekty dają sprzeczny obraz — pokaż oba, nie uśredniaj.
- Obowiązują `.claude/rules/coding-rules.md`.

## Wynik

Zapisz raport do `~/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-06-audyt-powdrozeniowy.md`:

1. **Werdykt per pozycja** (A1–A9, B1–B12, C) — działa / nie działa / niezweryfikowane, z dowodem.
2. **Trzy progi** — liczby, nie opisy, plus rekomendacja przy każdym przekroczeniu.
3. **Nowe znaleziska** — posortowane po severity, każde z dowodem i szacunkiem kosztu naprawy.
4. **Co wymaga mojej decyzji** — krótka lista na koniec.

Na czacie zostaw streszczenie: co zadziałało, co nie, co jest do decyzji. Bez wklejania całego raportu.
