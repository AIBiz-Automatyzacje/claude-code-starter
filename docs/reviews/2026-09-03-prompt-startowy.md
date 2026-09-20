# Prompt startowy do wykonania planu naprawy

Do wklejenia w nowej sesji Claude Code uruchomionej w katalogu `workspace-template`.
Zmieniasz jedną linię („Zadanie na tę sesję"), żeby przełączyć się między turami.

---

## Wersja do wklejenia — Tura A

```
Wracamy do zadania z poprzedniej sesji. Kontekst masz w repo, nie musisz niczego odtwarzać.

2026-09-02 przeprowadziliśmy audyt tego szablonu na dowodach z 39 runów autopilota i projektu
oferty-online. Findingi są zweryfikowane, a plan naprawy zatwierdzony. Nic nie zostało wdrożone.

ŹRÓDŁO PRAWDY: docs/reviews/2026-09-03-plan-naprawy.md — przeczytaj go w CAŁOŚCI, zanim dotkniesz
pierwszego pliku. Zawiera pliki, kotwice w kodzie, opis każdej zmiany i sposób weryfikacji.
Raport z audytu (docs/reviews/2026-09-02-audyt-pipeline.md) otwieraj tylko wtedy, gdy któraś
pozycja planu jest niejasna — plan jest samowystarczalny.

ZADANIE NA TĘ SESJĘ: wykonaj Turę A w całości (pozycje A1–A9).

ZASADY:
- Plan jest ustalony. Nie rób ponownego audytu, nie kwestionuj findingów, nie dokładaj zakresu.
  Jeśli w trakcie zobaczysz, że pozycja planu jest błędna albo niewykonalna — zatrzymaj się przy
  niej, powiedz dlaczego, i przejdź do następnej. Nie improwizuj zamiennika.
- Kolejność: A8 (usunięcie legacy skilla /dev-autopilot) MUSI iść przed A9 (README), bo zmniejsza
  zakres tamtej pozycji. Poza tym pozycje są niezależne.
- A1 wymaga dopisania nowego pliku testowego z 12 przypadkami. To część pozycji, nie opcja.
- Jedna pozycja = jeden commit, komunikat po polsku, jawny pathspec. Masz moją zgodę na commity
  w tej sesji — bez pytania przy każdej pozycji. Zakaz `git add -A` i `git add .`.
- Nie wdrażaj Tury B ani C. Nie ruszaj rozdziału „Odłożone do osobnej decyzji".
- Obowiązują .claude/rules/coding-rules.md. W szczególności: nie osłabiaj testów, nie obniżaj progów,
  nie modyfikuj konfiguracji zamiast kodu.

NA KONIEC: krótki raport — co zrobione, co pominięte i dlaczego, co wymaga mojej decyzji.
Bez wdrażania czegokolwiek z kolejnych tur.
```

---

## Wersja do wklejenia — Tura B

Ta sama treść, ze zmienionym blokiem zadania i zasad kolejności:

```
ZADANIE NA TĘ SESJĘ: wykonaj z Tury B pozycje B1 (naprawa P3) i B2 (commit artefaktów przy STOP).
Tylko te dwie.

ZASADY DODATKOWE DLA TURY B:
- B1 to cztery spójne ruchy w trzech plikach — wykonaj wszystkie albo żaden. Połowiczne wdrożenie
  zostawia pipeline w stanie, w którym P3 wchodzą do listy fixa, ale są ucinane limitem.
- Po wdrożeniu nie wdrażaj kolejnych pozycji. Następny krok to jedno realne zadanie w oferty-online
  i pomiar: koszt etapu fix (próg odwrotu: 120k tokenów) oraz brak STOP-a „niezacommitowane zmiany".
```

Pozostałe pozycje Tury B (B3–B12) wdrażaj pojedynczo, tą samą metodą. B12 na końcu i osobno —
ma warunek odwrotu opisany w planie.

---

## Wersja do wklejenia — Tura C

```
ZADANIE NA TĘ SESJĘ: zbuduj skill /dev-pr według specyfikacji z rozdziału „Tura C" planu
(docs/reviews/2026-09-03-plan-naprawy.md).

To nowy kod, nie poprawka — zacznij od przeczytania, jak zbudowana jest istniejąca para
skill + workflow: .claude/skills/dev-docs-review/SKILL.md i .claude/workflows/dev-docs-review-wf.js.
Zachowaj ten sam podział ról: decyzje i pytania do operatora w skillu, mechanika i bramki w JS.

Zanim zaczniesz pisać, pokaż mi proponowany kształt: sygnatury argumentów, schematy danych między
skillem a workflowem i miejsca, w których workflow się zatrzymuje. Dopiero po mojej akceptacji
implementuj.
```

---

## Czego nowa sesja nie musi robić

- Klonować upstreamów. Wszystkie decyzje o adopcji są już podjęte: **żaden nowy skill z upstreamów
  nie wchodzi**.
- Czytać telemetrii. Liczby, które uzasadniają zmiany, są w planie.
- Uruchamiać autopilota, żeby cokolwiek sprawdzić. Weryfikacja każdej pozycji jest opisana na miejscu.

## Kontekst, który warto znać

Katalog roboczy: `/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template`.
Projekt referencyjny, z którego pochodzą dowody: `../oferty-online` (nie modyfikować przy Turze A i B).

Po Turze A i po każdej większej zmianie w workflowach zalecany smoke-test z
`.claude/templates/smoke-autopilot/` na realnym projekcie.

Uwaga zapisana w planie, warta przypomnienia przy pierwszym `/sync-template`: `oferty-online` ma
lokalnie przepisany fragment `dev-autopilot-wf.js` pod serwer Node zamiast Vite. Synchronizacja
szablonu skasuje ten patch, dopóki nie wejdzie parametryzacja toru E2E z rozdziału „Odłożone".
