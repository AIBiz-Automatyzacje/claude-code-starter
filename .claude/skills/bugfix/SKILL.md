---
name: bugfix
description: "Systematyczna naprawa bugow w dzialajcej aplikacji. Uzywaj przy bledach z Sentry, failujacych E2E, zgloszeniach userow, nieoczekiwanym zachowaniu po uzyciu. Wywoluj przez /bugfix [opis bugu lub link Sentry]."
argument-hint: "[opis bugu lub link Sentry]"
---

# Bugfix — systematyczna naprawa bugow

Skill do naprawy bugow wykrytych w dzialajcej aplikacji — Sentry alerty, E2E failures, zgloszenia userow, nieoczekiwane zachowanie.

**Nadrzedna zasada:** Znajdz root cause ZANIM zaproponujesz fix. Naprawa symptomu to porazka.

## Zmienne
- OPIS_BUGU: $1

## Instrukcje

### Faza 0: Triage

1. **Zrodlo bugu:** Sentry / E2E test / manual / zgloszenie usera
2. **Priorytet:**
   - P0 — blokuje userow, aplikacja niedostepna
   - P1 — powazny, funkcjonalnosc uszkodzona
   - P2 — drobny, moze poczekac
3. **Blast radius:** ilu userow dotyczy, od kiedy, jaki % ruchu
4. **Sprawdz baze wiedzy:**
   - Przeszukaj `docs/solutions/` — czy ten problem byl juz rozwiazany
   - Sprawdz Sentry — czy to regression (first seen vs last seen), czy grupuje sie z innymi bledami
   - Jesli znaleziono rozwiazanie — zastosuj je i przejdz do Fazy 4 (weryfikacja)

### Faza 0.5: Stabilizacja (tylko P0/P1)

1. **Czy rollback ostatniego deploy'a rozwiaze problem?**
   - Sprawdz `git log --oneline -10` — co weszlo w ostatnim deploymencie
   - Jesli tak — rollback TERAZ:
     - Coolify: redeploy poprzedniego taga/commita przez dashboard
     - Git: `git revert <commit>` + deploy
     - CI/CD: trigger pipeline z poprzednim stabilnym SHA
   - Investigacje przeprowadz potem, w spokoju
   - Jesli nie — kontynuuj do Fazy 1

### Faza 1: Investigacja

**ZANIM cokolwiek naprawisz:**

1. **Zbierz kontekst:**
   - Sentry: error message, stack trace, breadcrumbs, affected users, release
   - Logi: co dzialo sie PRZED bledem
   - Network: request, payload, response code
   - DB: stan danych ktorych bug dotyczy (jesli relevantne)

2. **Reprodukuj:**
   - Kroki do reprodukcji, srodowisko, dane testowe
   - Czy powtarzalny? Jesli nie — zbierz wiecej danych, nie zgaduj

3. **Sprawdz zmiany:**
   - `git log --oneline --since="3 days ago"` — co sie zmienilo
   - `git bisect` — jesli wiadomo kiedy dzialalo, a kiedy przestalo
   - Nowe dependency, zmiana configu, zmiana srodowiska

4. **Sledz dane (multi-component):**

   Jesli system ma wiele warstw (API → serwis → baza, frontend → edge function → DB):
   - Dodaj diagnostic logging na KAZDEJ granicy komponentow
   - Uruchom raz, zbierz evidence GDZIE sie psuje
   - Dopiero potem analizuj ten konkretny komponent

   Szczegolowa technika: przeczytaj `techniki/root-cause-tracing.md`

5. **Okresl rozmiar fixa:**
   - Maly (1-2 pliki, oczywista zmiana) — naprawiaj na biezacym branchu
   - Duzy (3+ pliki, zmiana logiki) — stworz branch `fix/opis-bugu`

6. **Assumption audit (przed postawieniem hipotezy):** wypisz wszystko, co „musi być prawdą", żeby Twoja hipoteza root cause się trzymała. Przy każdym założeniu oznacz: **ZWERYFIKOWANE** (sprawdziłem w kodzie / danych / logach) czy **ZAŁOŻONE** (zgaduję). Każde ZAŁOŻONE, na którym wisi hipoteza, zweryfikuj zanim ruszysz dalej — niezweryfikowane założenie to najczęstsza przyczyna naprawiania złego miejsca.

7. **OUTPUT:** Zapisz jednozdaniowe podsumowanie: "Root cause to X, bo Y"

### Faza 2: Failing test

1. Napisz MINIMALNY test reprodukujacy buga
2. Uruchom test — MUSI failowac
3. Jesli test przechodzi — nie rozumiesz buga. Wroc do Fazy 1
4. Jesli buga nie da sie pokryc unit testem — napisz scenariusz E2E lub test integracyjny

### Faza 3: Fix

1. **Jedna zmiana naprawiajaca root cause** — nie symptom
   - NIE naprawiaj wielu rzeczy naraz
   - NIE dodawaj "ulepszen" przy okazji
   - NIE oslabiaj asercji zeby test przeszedl

2. **Predykcja przed testem (gate przyczynowy):** dla każdego niepewnego ogniwa łańcucha przyczynowego zapisz, co DOKŁADNIE powinno się zmienić, jeśli Twój model przyczyny jest poprawny. Po uruchomieniu testu porównaj wynik z predykcją — jeśli fix działa, ale predykcja była błędna, prawdopodobnie naprawiłeś symptom, nie przyczynę; wróć do Fazy 1.

3. **Uruchom test z Fazy 2** — MUSI przejsc

4. **Uruchom pelny suite** — zero regresji

5. **Jesli fix nie dziala:**
   - < 3 proby: wroc do Fazy 1, przeanalizuj z nowa wiedza
   - >= 3 proby: **STOP.** Zakwestionuj architekture:
     - Czy kazdy fix ujawnia nowy problem w innym miejscu?
     - Czy fixy wymagaja "masowej refaktoryzacji"?
     - Czy trzymamy sie wzorca z bezwladnosci?
     - Omow z userem zanim podejmiesz kolejna probe

   **Smart escalation — dopasuj typ problemu do wzorca dowodów:**

   | Wzorzec, który widzisz | Co to prawdopodobnie znaczy | Ruch |
   |---|---|---|
   | Każdy fix psuje coś w innym module | Problem architektoniczny, nie lokalny bug | Cofnij się o poziom; omów granice z userem |
   | Dowody sobie przeczą | Twój model myślowy jest zły | Odrzuć hipotezę, wróć do assumption audit (Faza 1) |
   | Działa lokalnie, pada w CI / produkcji | Problem środowiska, nie kodu | Porównaj env, wersje, dane, kolejność — nie zmieniaj logiki |
   | Bug znika i wraca losowo | Race condition lub stan współdzielony | Szukaj async / timing / closure, nie pojedynczej linii |

6. **Opcjonalnie — defense-in-depth:**
   Po udanym fixie dodaj walidacje na wielu warstwach, zeby bug byl strukturalnie niemozliwy.
   Szczegoly: przeczytaj `techniki/defense-in-depth.md`

### Faza 3.5: Cleanup

Przed przejsciem do weryfikacji — usun wszelkie diagnostic logi dodane w Fazie 1:
- Usun `console.error('DEBUG:...')` i tymczasowe logi
- Sprawdz `git diff` — czy nie committujesz kodu diagnostycznego
- Produkcyjny kod nie moze zawierac debug logowania

### Faza 4: Weryfikacja (Gate Function)

**Zanim powiesz "naprawione" — URUCHOM komendy i PRZECZYTAJ output:**

| Claim | Wymagany dowod | NIE wystarczy |
|-------|----------------|---------------|
| "Testy przechodza" | Output komendy testowej: 0 failures | "Powinno przechodzic" |
| "Typecheck OK" | Output tsc: 0 errors | "Zmiana jest prosta" |
| "Lint czysty" | Output lintera: 0 errors | Czesciowe sprawdzenie |
| "Bug naprawiony" | Test z Fazy 2 przechodzi | "Kod wyglada dobrze" |

Kolejnosc:
1. Typecheck → przeczytaj output → 0 errors?
2. Testy → przeczytaj output → 0 failures?
3. Lint → przeczytaj output → 0 errors?
4. E2E (jesli dotyczy) → przechodzi?

**DOPIERO TERAZ mozesz powiedziec "naprawione".**

Jesli cokolwiek failuje — wroc do Fazy 3. NIE racjonalizuj ("to pre-existing", "to nie zwiazane").

### Faza 5: Monitoring po uzyciu

1. Jesli bug dotyczyl produkcji — po deploy'u fixa:
   - Sprawdz Sentry — error rate spada?
   - Sprawdz metryki — endpoint/funkcja wraca do normy?
   - Potwierdz na zywo — nie polegaj tylko na lokalnych testach
2. Jesli bug dotyczyl E2E/staging — uruchom pelny E2E suite po fixie

### Faza 6: Zamkniecie

1. **Dokumentacja:** Czy to problem warty zapamietania?
   - Tak → uruchom `/dev-compound` z opisem problemu, root cause i rozwiazania
   - Nie (trywialny fix) → pomin
2. **Pattern:** Czy ten typ bugu moze sie powtorzyc?
   - Tak → zaproponuj regule, hook lub walidacje zapobiegajaca
3. **Zamknij issue/ticket** jesli istnieje

---

## Red Flags — jesli lapiesz sie na tym, STOP

- "Szybki fix, zbadamy pozniej" → Faza 1
- "Sprobujmy zmienic X i zobaczymy" → Faza 1
- "Dodajmy kilka zmian naraz" → Faza 3, punkt 1
- "Pominmy test, sprawdze recznie" → Faza 2
- "Pewnie to X, naprawmy to" → Faza 1
- "Jeszcze jedna proba" (po 2+ nieudanych) → Faza 3, punkt 5
- "Gotowe!" (bez uruchomienia komend) → Faza 4

## Techniki wspierajace

Pliki w katalogu `techniki/` — czytaj gdy potrzebne:

- **`root-cause-tracing.md`** — sledz buga wstecz przez call stack do zrodla
- **`defense-in-depth.md`** — po fixie dodaj walidacje na wielu warstwach
- **`condition-based-waiting.md`** — zamien sleep()/setTimeout() na polling warunku (flaky testy)
- **`find-polluter.sh`** — skrypt bisection: ktory test zanieczyszcza stan

## Racjonalizacje vs rzeczywistosc

| Wymowka | Rzeczywistosc |
|---------|---------------|
| "Prosty bug, nie potrzeba procesu" | Proste bugi tez maja root cause. Proces jest szybki dla prostych. |
| "Awaryjnie, nie ma czasu" | Systematyczne debugowanie jest SZYBSZE niz strzelanie na slepo. |
| "Najpierw fix, potem zbadamy" | Pierwszy fix ustala pattern. Zrob dobrze od razu. |
| "Napisze test po potwierdzeniu fixa" | Test ktory od razu przechodzi niczego nie dowodzi. |
| "Kilka fixow naraz oszczedzi czas" | Nie wiadomo co zadzialalo. Powoduje nowe bugi. |
| "Widze problem, naprawmy to" | Widziec symptom != rozumiec root cause. |
