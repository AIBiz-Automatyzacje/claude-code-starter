---
name: dev-docs-complete
description: "Archiwizacja ukończonego zadania: smoke operatora (co sprawdzić ręcznie po zielonym automacie) + przeniesienie do docs/completed/ + podsumowanie."
argument-hint: "[nazwa zadania z docs/active/]"
---

Jesteś specjalistą ds. zamykania zadań. Zarchiwizuj i udokumentuj ukończone zadanie: $ARGUMENTS

**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu plików (`date +%F`).

## Instrukcje

1. **Zlokalizuj zadanie** w `docs/active/$ARGUMENTS/`
   - Jeśli nie znaleziono, wylistuj dostępne zadania w `docs/active/` i poproś o wyjaśnienie

2. **Zweryfikuj ukończenie** — pula „nieukończone" na poziomie COMPLETE (po review, więc inna niż skip-lista execute):
   - **Pula (a)–(d):** (a) checkboxy implementacyjne w blokach IU; (b) `- [ ] Test: [Unit] …`; (c) `- [ ] Weryfikacja: …` BEZ markera `[E2E]` — review już się odbyło i odznacza je po PASS, więc niezaznaczona = kryterium niepotwierdzone; (d) `[P1]`/`[P2]` w `## Do poprawy po review fazy N` — przy wylistowaniu pokaż adnotację z linii (np. „przeniesione do known-issues"), żeby było widać, czy to świadoma decyzja.
   - **Nie liczą się** (nie wymieniaj jako nieukończone): `Operator:`, `[Manual]`, całe sekcje `## Operator checklist faza N` (zasilają smoke w kroku 3), `[P3]` (opcjonalne), wszystko z `[E2E]` (osobna czerwona flaga w kroku 3 — **nie** odhaczaj).
   - **Hierarchia:** jeśli istnieje `docs/active/<zadanie>/.autopilot-state.json`, parsuje się jako JSON i wszystkie fazy mają execute/review/fix ∈ {done, none} — (a)–(c) to rozbieżności **informacyjne** (wypisz, nie pytaj); pytaj wyłącznie o (d) P1/P2 bez adnotacji. Gdy JSON nie istnieje, nie parsuje się albo ma fazę `pending` — cała pula (a)–(d) liczy się normalnie.
   - Pytanie „Archiwizować mimo to czy kontynuować pracę?" zadawaj tylko, gdy tak policzona pula jest niepusta.

3. **Smoke operatora** — dokument `docs/operator/<YYYY-MM-DD>-$ARGUMENTS-smoke.md` (w trybie autopilota robi to faza „Smoke operatora" w `dev-docs-complete-wf.js` — nie generuj drugi raz, jeśli już istnieje na dziś).

   Cel: po zielonym automacie (typecheck, testy, E2E w przeglądarce) człowiek dostaje listę **wyłącznie tego, czego automat nie mógł sprawdzić**. Nie jest to kopia zadań ani podsumowanie — każdy punkt to coś do zrobienia na ekranie/urządzeniu z konkretnym oczekiwanym wynikiem.

   **Źródła (zbierz tylko z nich, nic nie wymyślaj):**
   1. niezaznaczone checkboxy z `## Operator checklist faza N` w `*-zadania.md` (wszystkie fazy),
   2. scenariusze `[Manual]` z `*-zadania.md` i z planu technicznego (ścieżka w `Plan techniczny:`),
   3. findingi typu OPERATOR z `review-faza-*.md` (poza fix: natywne okna przeglądarki, fizyczne urządzenie, warunki środowiskowe),
   4. otwarte wpisy z `docs/active/$ARGUMENTS/known-issues.md` (jeśli istnieje) oraz otwarte P3 z `## Do poprawy po review fazy N`. „Otwarte" = poza sekcją `## Zamkniete`; gdy sekcji nie ma, pomiń wpisy, które same lub późniejsza faza oznaczają jako ZAMKNIĘTY/naprawione/zweryfikowane — ale jeśli zamknięto tylko bloker, a sama weryfikacja (np. przebieg E2E w przeglądarce) pozostała, wpisz ją jako checkbox do wykonania, nie jako „znany problem". Z obu źródeł bierz **wyłącznie** wpisy opisujące zachowanie na ekranie/urządzeniu lub flow do ręcznego przejścia; notatki środowiskowe (`.env.local`, projekt Supabase, restart dev servera), dane testowe i pułapki narzędziowe pomiń,
   5. **czerwona flaga:** niezaznaczone `[E2E]` (`grep -nE '^- \[ \].*\[E2E\]' docs/active/$ARGUMENTS/*-zadania.md | grep -vE 'Operator:|\[P[123]\]'` — ten sam grep co completion-gate autopilota; kopie `Operator:` w Operator checklist i pozycje findingów `[P1]/[P2]/[P3]` w „Do poprawy" nie są scenariuszami; brak trafień = exit 1, to nie błąd). Rozdziel: linie z suffixem `(FAIL:` → sekcja `## ⚠️ E2E przebiegło i padło (znany defekt)` z odesłaniem do known-issues (**nie** radź zmiany na `[Manual]` — ukryłaby znany defekt); pozostałe → `## ⚠️ E2E nieuruchomione`. Obie sekcje na początku dokumentu.

   **Hierarchia stanu i dedup** (źródła się nakładają — scribe review kopiuje każdy finding OPERATOR do `## Operator checklist faza N`, a `[Manual]` z IU też tam ląduje):
   - `## Operator checklist faza N` w `*-zadania.md` jest **jedynym źródłem stanu**. Pozycja `[x]` tam = temat zamknięty: pomiń jej odpowiednik w raporcie review (finding OPERATOR o tym samym IU/pliku/temacie), w `[Manual]` planu i w known-issues. Źródła (2)–(4) służą do wzbogacenia kroków/oczekiwanego wyniku pozycji z (1); pozycja spoza (1) wchodzi tylko, gdy w zadaniach nie ma jej wcale (dopasowanie po IU-K / pliku / ekranie).
   - Każdy temat raz: `Test [Manual]` z IU, jego kopia w Operator checklist i wzmianka w findingu OPERATOR = **jeden** checkbox w sekcji ekranu; kroki scal, nie powielaj.
   - Warunki środowiskowe z findingów OPERATOR nie są pozycjami smoke'u: konieczność restartu dev servera po zmianie `.env` ląduje wyłącznie jako check w „0. Przygotowanie"; kroki stricte pod przebieg E2E (seedy na projekt e2e, dev server w trybie `--mode e2e`) **nigdy** nie wchodzą do smoke'u — kolidują z sekcją 0 (smoke leci na projekcie głównym).
   - **W całym pliku żadnych wartości haseł/tokenów/kluczy** — także gdy cytujesz known-issues lub review; zastąp nazwą zmiennej (`E2E_TEST_PASSWORD`) lub frazą `<hasło w .env.e2e>`. E-mail konta testowego może zostać.

   Jeśli po zastosowaniu hierarchii źródła (1)–(5) są puste — nie twórz pliku, powiedz „brak pozycji do ręcznego sprawdzenia".

   **Skąd brać dane do nagłówka i sekcji 0 — NIE uruchamiaj testów ani E2E w tej fazie** (suite w foreground przekracza limity Bash/watchdoga; wynik już jest w artefaktach):
   - `<N> testów`: `docs/active/<zadanie>/.autopilot-state.json` → `walidacjaWynik.testy` (string „PASS X/Y"); brak pliku/pola → „testy zielone wg walidacji końcowej" bez liczby.
   - `<M> scenariuszy E2E`: `grep -hE '^- \[x\].*\[E2E\]' docs/active/<zadanie>/*-zadania.md | grep -vcE 'Operator:|\[P[123]\]'` (bez kopii `Operator:` i pozycji findingów; brak trafień = 0, exit 1 to nie błąd).
   - `<marker>` projektu głównego i `<ref e2e>`: tylko pierwsze 6 znaków hosta, bez wartości kluczy: `grep -ohE 'SUPABASE_URL=https://[a-z0-9]{6}' .env .env.local .env.e2e 2>/dev/null`.
   - Nazwa zmiennej z hasłem konta testowego: wyłącznie nazwy — `grep -oE '^[A-Z0-9_]*(PASSWORD|PASS|HASLO)[A-Z0-9_]*=' .env .env.local .env.e2e 2>/dev/null | cut -d= -f1 | sort -u`; brak → „konto testowe: patrz `.env.example`", nie zgaduj. **Zakaz `cat`/Read całego `.env*`.**
   - Jeśli w projekcie istnieje wcześniejszy `docs/operator/*-smoke.md` — trzymaj się jego układu sekcji.

   **Układ pliku:**

   ```markdown
   # Smoke operatora — <tytuł zadania> (<ID wymagań, np. R1–R14>)

   Branch: `feature/<zadanie>` · Utworzono: YYYY-MM-DD
   Status: **do przejścia** — odhaczaj `[ ]` → `[x]` w miarę przechodzenia.

   Automat (typecheck, <N> testów, <M> scenariuszy E2E w przeglądarce) jest zielony. Ta lista pokrywa
   **wyłącznie to, czego automat nie mógł sprawdzić**: wygląd na prawdziwym ekranie, natywne
   okna przeglądarki (file picker, print, powiadomienia), odczucie animacji, responsywność na realnym urządzeniu.

   Dlaczego to nie jest formalność: <1–3 zdania o klasie błędów niewidocznych w testach w tym stacku,
   np. Tailwind cicho ignoruje nieistniejące klasy; scroll i overflow zachowują się inaczej na realnym
   urządzeniu dotykowym niż w emulowanym viewporcie — z learned-patterns / known-issues projektu, jeśli są>.

   ## ⚠️ E2E przebiegło i padło (znany defekt)   ← tylko gdy są linie z suffixem `(FAIL:`
   - [ ] [E2E] <treść checkboxa> — defekt opisany w `docs/completed/<zadanie>/known-issues.md` (faza N); napraw kod i uruchom scenariusz ponownie (tester agent-browser w review autopilota). NIE zmieniaj na `[Manual]`.

   ## ⚠️ E2E nieuruchomione   ← tylko gdy źródło (5) ma linie bez suffixu `(FAIL:`
   - [ ] [E2E] <treść checkboxa> — uruchom scenariusz przez testera agent-browser na środowisku `.env.e2e` albo wykonaj ręcznie i oznacz `[Manual]` w zadaniach

   ## 0. Przygotowanie (5 min)
   > ⚠️ Sprawdź projekt Supabase PRZED startem: `.env`/`.env.local` ma wskazywać projekt <GŁÓWNY/dev> (marker: nazwa projektu / pierwsze znaki ref), NIE środowisko E2E (<ref e2e>) — na e2e backend jest pusty.
   - [ ] `grep SUPABASE_URL .env .env.local` → wskazuje <marker>
   - [ ] Dev server uruchomiony (`<pm> run dev`), aplikacja otwiera się na localhost:5173
   - [ ] Zaloguj się kontem testowym (<nazwa zmiennej z hasłem — NIGDY wartość>)
   **Co będzie potrzebne w trakcie:** <dane/stany: konto z danymi, drugie konto, rekordy testowe…>

   ## 1. <Wymaganie / ekran> (R1, R2)
   Wejście: <jak tam dojść w aplikacji>.
   - [ ] <Czynność> → <oczekiwany wynik, konkretny>
   - [ ] **[fizyczne urządzenie]** <dotyk / push / safe-area / responsywność>

   ## 2. …

   ## Znane problemy (nie blokują, sprawdź czy nadal występują)
   - <z known-issues / P3 widocznych dla użytkownika>

   ## Jak kontynuować w nowej sesji
   Skopiuj jako pierwszą wiadomość:
   ```
   Kontynuujemy smoke operatora zadania "<zadanie>" (branch feature/<zadanie>).
   Checklista: docs/operator/YYYY-MM-DD-<zadanie>-smoke.md — prowadź mnie punkt po punkcie,
   odhaczaj za mnie w pliku, a usterki naprawiaj od razu (z testem) zamiast odkładać.
   ```
   ```

   Reguły: sekrety tylko nazwami zmiennych; pozycje pogrupowane per wymaganie/ekran w kolejności, w jakiej operator przechodzi aplikację (nie per faza autopilota); każdy checkbox ma oczekiwany wynik; nie modyfikuj `*-zadania.md` ani raportów review.

4. **Wyciągnij kluczowe wnioski** z `[zadanie]-kontekst.md`:
   - Decyzje architektoniczne warte zachowania
   - Odkryte lub ustalone wzorce
   - Napotkane pułapki/przypadki brzegowe
   - Dodane zależności

5. **Utwórz podsumowanie ukończenia** w `docs/completed/$ARGUMENTS/`:
   - Przenieś wszystkie pliki z `docs/active/$ARGUMENTS/` (plan, kontekst, zadania, raporty review, known-issues, `.autopilot-state.json` — w tym ostatnim ustaw `"complete": "done"`)
   - Dodaj `[zadanie]-podsumowanie.md` zawierający:
     - Data ukończenia
     - Co zostało dostarczone
     - Podjęte kluczowe decyzje (krótko)
     - Utworzone/zmodyfikowane pliki (główne)
     - Wyciągnięte wnioski
     - Link do smoke'u operatora (jeśli powstał) i liczba pozycji do ręcznego sprawdzenia

6. **Zaktualizuj dokumentację projektu** (jeśli istotne):
   - Dopisz decyzje architektoniczne do `CLAUDE.md`
   - Jeśli odkryto wzorce warte utrwalenia — dodaj regułę do `.claude/rules/learned-patterns.md` (utwórz plik, jeśli nie istnieje) lub zaktualizuj `CLAUDE.md`.

6.5 **Sugestia dokumentowania problemów:**
   - Jeśli podczas pracy napotkano nietrywialne problemy warte udokumentowania:
   - Zapytaj: "Czy chcesz udokumentować rozwiązane problemy? Uruchom `/dev-compound`"

7. **Posprzątaj**:
   - Usuń pusty katalog `docs/active/$ARGUMENTS/`
   - Potwierdź ukończenie użytkownikowi

## Format wyjściowy
```
✅ Zadanie "$ARGUMENTS" zarchiwizowane

📁 Przeniesiono do: docs/completed/$ARGUMENTS/
📄 Pliki: plan.md, kontekst.md, zadania.md, podsumowanie.md, review-faza-*.md

🧪 Smoke operatora: docs/operator/YYYY-MM-DD-$ARGUMENTS-smoke.md (N pozycji[, ⚠️ E [E2E] nieuruchomionych])
   → przejdź go w przeglądarce/na urządzeniu zanim zmergujesz; ramka „Jak kontynuować w nowej sesji" jest na końcu pliku

📝 Zaktualizowana dokumentacja:
   - [lista co gdzie dodano, lub "Nie wymagane"]

🎉 Świetna robota nad ukończeniem tego zadania!

💡 Rozwiązane problemy warte udokumentowania?
   → /dev-compound do zapisu rozwiązania
```
