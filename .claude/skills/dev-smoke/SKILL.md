---
name: dev-smoke
description: "Sesja smoke'u operatora po archiwizacji zadania: najpierw decyzje przed PR (popraw, zostaw jak jest, odłóż), krótkie review poprawek, potem agent sam przechodzi checklistę smoke'u i zatrzymuje się tylko przy pozycjach dla człowieka. Używaj, gdy operator wpisuje /dev-smoke, mówi „przejdźmy smoke”, „smoke operatora” albo raport archiwizacji odsyła do smoke'u."
argument-hint: "[nazwa zadania albo plik docs/operator/*-smoke.md]"
---

# `/dev-smoke` — sesja smoke'u operatora

Prowadzisz smoke zadania: $ARGUMENTS

Smoke to lista tego, czego automat nie sprawdził (`docs/operator/<data>-<zadanie>-smoke.md`, pisze go archiwizacja).
Sesja zaczyna od decyzji, bo poprawka po decyzji zmienia kod, który dalej sprawdzasz. Potem pozycje listy wykonujesz sam;
operator wchodzi tylko przy wyjątkach z sekcji „Wyjątki dla człowieka”. Operator prowadzi firmę, nie programuje: piszesz
prostym językiem, kontekst przed pytaniem, bez żargonu.

Czym klikasz i jak uruchamiasz aplikację: `references/stack.md`, sekcje „Narzędzie sesji” i „Punkty wizualne”.

## 0. Start

1. Plik smoke'u: argument będący ścieżką albo najnowszy `docs/operator/*-<zadanie>-smoke.md` (`ls -t`). Brak pliku → powiedz,
   że smoke nie powstał, i zakończ.
2. Gałąź: `feature/<zadanie>`. Inna gałąź i czyste drzewo → `git switch feature/<zadanie>`; brudne drzewo → pokaż pliki
   i zapytaj operatora, zanim cokolwiek zmienisz.
3. Przeczytaj cały plik smoke'u i `docs/completed/<zadanie>/known-issues.md` (sekcja `## Decyzje operatora`). Pozycje
   odhaczone `[x]` i wiersze decyzji z dopiskiem `→ ROZSTRZYGNIĘTA` pomijasz: sesja mogła być przerwana i wznowiona.
4. Powiedz operatorowi w dwóch zdaniach: ile decyzji, ile pozycji listy, ile z nich wymaga człowieka.

## 1. Decyzje przed PR

Pozycje sekcji „Decyzje przed PR” pokazujesz po jednej, narzędziem `AskUserQuestion`. Przed pytaniem przeczytaj kod pod
`plik:linia` i napisz prostym językiem: o co chodzi, co użytkownik aplikacji widzi dziś, co zobaczy po każdej opcji, Twoja
rekomendacja i dlaczego. Pytanie ma trzy wyjścia (pierwsze to rekomendacja z dopiskiem „(Recommended)”):

- **Popraw** — zmiana kodu od razu, z testem, który bez zmiany pada. Jeden commit na decyzję, jawnymi ścieżkami:
  `fix(<zadanie>): decyzja D<n> — <co zmienione>`. Przy zmianie widocznej na ekranie sprawdź ją narzędziem sesji.
- **Zostaw jak jest** — w pliku decyzji zadania `docs/decisions/*-<zadanie>.md`, sekcja `## Decyzje`, dopisz linię
  `- Zostaw jak jest (smoke, D<n>): <pytanie> — <powód operatora albo „decyzja operatora”> (<plik:linia>)`.
  Ten plik czyta klasyfikator odrzuceń bota w `/dev-pr` i etap uzgodnienia `CLAUDE.md`, więc sprawa nie wróci jako błąd
  bota. Autopilot treści decyzji nie czyta (z tego pliku bierze tylko pole `claude_md:`).
- **Odłóż** — dopisz pozycję do `docs/operator/odlozone.md` (brak pliku = utwórz z nagłówkiem `# Sprawy odłożone` i zdaniem
  „Pozycje odłożone w smoke'u do późniejszego etapu; czyta je `/dev-prep` i bramka gotowości planu.”):
  `- [ ] [etap: <etykieta>] <zadanie> D<n>: <pytanie> — \`<plik:linia>\` (smoke <YYYY-MM-DD>)`. Etykieta to etap, do którego
  operator odkłada sprawę; nie podał go → „następny etap”. Pozycję odhacza (`[x]` z numerem commitu) sesja, która sprawę
  później wykona; plik czytają `/dev-prep` i bramka gotowości planu.

**Opcje z pozycji.** Pozycja smoke'u ma 2–3 opcje ze skutkiem dla użytkownika (pisze je archiwizacja; jedna to zawsze „zostaw
jak jest”). Każdy wariant zmiany pokazujesz jako osobną odpowiedź „Popraw: <wariant>”, do tego „Zostaw jak jest” i „Odłóż”.
`AskUserQuestion` ma najwyżej 4 opcje: przy trzech wariantach zmiany „Odłóż” się nie mieści — napisz w pytaniu, że operator
wybiera je przez „Other”.

**Decyzja autopilota** (wiersz ze znacznikiem `[DECYZJA · faza N · autopilot]`): wybór jest już w kodzie, bo builder rozstrzygnął
sprzeczność źródeł planu. „Zostaw jak jest” = potwierdzenie wyboru autopilota (zapis jak wyżej); „Popraw” = przywrócenie źródła,
które przegrało (opisane w pozycji, np. tekst ze scenariusza), z testem, który bez zmiany pada.

Po każdej decyzji zapisz ślad w dwóch miejscach:
- plik smoke'u: linia `- [ ] D<n> …` → `- [x] D<n> … → <poprawione w <sha 12 znaków> | zostaw jak jest | odłożone>`;
- `docs/completed/<zadanie>/known-issues.md`, sekcja `## Decyzje operatora`: na końcu wiersza tej decyzji dopisz
  ` → ROZSTRZYGNIĘTA (smoke <YYYY-MM-DD>): <poprawione w <sha> | zostaw jak jest | odłożone do <etykieta>>`.
  Wiersz z dopiskiem `ROZSTRZYGNIĘTA` jest zamknięty; nie przenosisz go i nie usuwasz.

## 2. Kontrola poprawek

Po ostatniej decyzji, gdy co najmniej jedna skończyła się commitem „Popraw”: dwa wywołania naraz narzędziem `Agent` z typami
`correctness-reviewer` i `security-sentinel`, każde z poleceniem: „Review poprawek po decyzjach operatora w smoke'u zadania
<zadanie>: `git show <sha>` dla commitów <lista sha z tematami>. Zwróć findingi P1/P2/P3 z plik:linia, scenariuszem błędu
i poprawką; bez zmian w plikach.”

- P1/P2 → pokaż je operatorowi prostym językiem, zanim przejdziesz dalej, i zapytaj: „Naprawiam teraz” (poprawka z testem,
  osobny commit) albo „Zostaw do opisu PR”.
- P3 i findingi zostawione do opisu PR dopisz do `docs/completed/<zadanie>/known-issues.md`, sekcja `## P3 po archiwizacji`
  (brak = utwórz przed `## Zamkniete`), po linii: `- 🟡 [P<n>/<oś>] <plik:linia> — <opis> (krótkie review w smoke'u)`,
  oś = `correctness` albo `security`.
- Znacznik: pusty commit, który `/dev-pr` (`po-archiwum.mjs`) czyta, żeby nie recenzować tych commitów drugi raz
  (każda linia `Sprawdzone:` w osobnym wierszu wiadomości):

```
git commit --allow-empty -m "chore(<zadanie>): krótkie review poprawek decyzji" -m "Sprawdzone: <pełny sha 1>
Sprawdzone: <pełny sha 2>"
```

  W znaczniku są tylko commity, które reviewerzy obejrzeli. Poprawka po findingu z tego review idzie bez znacznika:
  krótkie review `/dev-pr` obejrzy ją przed PR.

Kontroli diffu i ponownego przebiegu E2E nie robisz (tryb lekki, decyzja operatora).

## 3. Lista

Pozostałe pozycje smoke'u przechodzisz po kolei, sam, narzędziem sesji z `references/stack.md`:

1. Wykonaj czynność z pozycji i porównaj wynik z oczekiwanym.
2. Zgodne → odhacz w pliku `[x]` i dopisz krótko, co widać (`→ OK: <jedno zdanie>`).
3. Niezgodne → usterka: odtwórz ją, napraw z testem, który bez poprawki pada, commit jawnymi ścieżkami
   `fix(<zadanie>): <co naprawione> (smoke)`, sprawdź pozycję jeszcze raz i odhacz z dopiskiem `→ poprawione w <sha>`.
   Usterki, której nie umiesz naprawić bez decyzji o zakresie, nie zgadujesz: zapytaj operatora z trzema wyjściami jak w sekcji 1.
   Usterkę odłożoną przez operatora zapisujesz w `docs/operator/odlozone.md` jak decyzję, z numerem `U<n>` (kolejna usterka
   tej sesji) zamiast `D<n>`: `- [ ] [etap: <etykieta>] <zadanie> U<n>: <opis usterki> — \`<plik:linia>\` (smoke <YYYY-MM-DD>)`.
4. Pozycja z wyjątku dla człowieka → zatrzymaj się i prowadź operatora krok po kroku: co otworzyć, gdzie kliknąć, czego się
   spodziewać. Wynik od operatora wpisz przy pozycji.
5. Operator może odłożyć pozycję listy (np. sprawdzenie wymaga czegoś, czego jeszcze nie ma). Wtedy wpis w
   `docs/operator/odlozone.md`: `- [ ] [etap: <etykieta>] <zadanie> smoke: <treść pozycji> — \`<plik smoke'u>\` (smoke <YYYY-MM-DD>)`,
   a w pliku smoke'u pozycja `- [x] … → odłożone do <etykieta>`. Etykieta jak w sekcji 1 (brak = „następny etap”).

Pozycje „E2E nieuruchomione” i „E2E do odegrania ręcznie” odgrywasz narzędziem sesji jak zwykłe pozycje; tylko przy pozycjach
z sekcji „E2E przebiegło i padło” najpierw naprawiasz defekt opisany w known-issues.

## 4. Wyjątki dla człowieka

Te pozycje zawsze robi operator, a Ty prowadzisz:

- produkcja i deploy (wdrożenie, zmiany na produkcyjnej bazie, `db push` na projekt główny);
- zewnętrzne konsole (Supabase Dashboard, sklep z aplikacjami, panel płatności, DNS, poczta);
- fizyczne urządzenie (pozycje **[fizyczne urządzenie]**);
- prawdziwa skrzynka pocztowa (odebranie maila, kliknięcie linku z maila);
- płatność prawdziwą kartą;
- wpisanie hasła (logowanie kontem, którego hasła nie wolno Ci czytać z `.env*`);
- ocena punktów wizualnych (zgodność z makietą ocenia człowiek: `references/stack.md`, sekcja „Punkty wizualne”).

Sekretów nie czytasz: wartości z `.env*` nie wczytujesz do kontekstu, w pliku smoke'u zostają nazwy zmiennych.

## 5. Koniec

1. Zacommituj plik smoke'u i dokumenty zmienione w sesji jawnymi ścieżkami, bez `git add -A` (`/dev-pr` wymaga czystego
   drzewa): `docs(<zadanie>): smoke operatora`. Dokumenty: plik smoke'u, `docs/completed/<zadanie>/known-issues.md`,
   plik decyzji zadania, `docs/operator/odlozone.md` — te, które się zmieniły.
2. Zdanie o otwartych sprawach: pole `zdanie` z `node .claude/scripts/smoke/otwarte.mjs --zadanie <zadanie>` 1:1 (liczy pliki po
   commicie), potem ile poprawek w sesji. Nie piszesz, że wszystko zamknięte, dopóki zdanie nie brzmi „Otwarte: brak …”.
3. Ostatnia linia: „Następny krok: /clear, potem /dev-pr 3 --bez-merge --czesc 1”, gdy podsumowanie zadania
   (`docs/completed/<zadanie>/<zadanie>-podsumowanie.md`) ma sekcję „Części PR”; bez niej „Następny krok: /clear, potem
   /dev-pr 3 --bez-merge”. `/dev-pr` w tej sesji nie uruchamiasz: smoke i PR w jednej sesji kosztują kilka razy więcej.
