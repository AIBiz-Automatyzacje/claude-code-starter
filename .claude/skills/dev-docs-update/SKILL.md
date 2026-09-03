---
name: dev-docs-update
description: "Aktualizacja dokumentacji dev przed kompaktowaniem kontekstu."
argument-hint: "[ścieżka-do-folderu] [opcjonalnie: co zaktualizować]"
---

Zbliżamy się do limitu kontekstu. Zaktualizuj dokumentację deweloperską, aby zapewnić płynną kontynuację po resecie kontekstu.

## Wymagane aktualizacje

### 0. Zabezpieczenie stanu git
Przed aktualizacją dokumentacji:

1. **Zapisz aktualny branch:** `git branch --show-current`
2. **Sprawdź niezacommitowane zmiany:** `git status --short`
3. **Jeśli są zmiany — wykonaj commit WIP.** Nigdy `git add .` ani `git add -A`: commit WIP powstaje
   w środku pracy, więc w drzewie leżą wtedy artefakty runów, logi, `.env` i pliki cudzych zadań.
   Dwa kroki, oba jawne:
```bash
   git add -u                        # tylko pliki JUŻ śledzone — nic nowego nie wchodzi po cichu
   git status --short                # pozostaną wiersze `??` = pliki nieśledzone
```
   Każdy plik `??` rozpatrz **osobno** i dodaj jawną ścieżką (`git add <ścieżka>`) tylko wtedy, gdy
   należy do tego zadania i ma być w repo. Nie dodawaj: `.env*`, plików z `/tmp`, logów, zrzutów diffu,
   artefaktów narzędzi, plików innego zadania. Czego nie dodajesz — wypisz w podsumowaniu, żeby operator
   wiedział, że zostały poza commitem.
```bash
   git commit -m "wip([nazwa-zadania]): stan przed resetem kontekstu"
```
4. **Zapisz hash ostatniego commita:** `git rev-parse --short HEAD`

### 1. Aktualizacja dokumentacji aktywnych zadań
Dla każdego zadania w `docs/active/[nazwa-zadania]/`:

> Format `docs/active/` jest **kontraktem parserów** — patrz `dev-docs/SKILL.md` → „Kontrakt wyjściowy". Jeśli w folderze jest `.autopilot-state.json`, to on jest źródłem prawdy o fazach, a checkboxy są tylko widokiem — nie „naprawiaj" ich ręcznie (zmiana stanu wymaga świeżego runu autopilota).

**Zaktualizuj `[nazwa-zadania]-plan.md`:**
- Sprawdź, że `## Źródła` i tabela `## Fazy` są nadal zgodne z planem technicznym w `docs/plans/`. Jeśli w sesji zmienił się podział faz/IU — zmiana idzie **do planu technicznego** (jak robi execute-wf), a `plan.md` tylko odzwierciedla ją 1:1
- Nie dodawaj sekcji „Ryzyka", „Szacunek", statusów faz — plan.md ich nie ma (status faz = `.autopilot-state.json` + checkboxy w `zadania.md`)
- Znacznik "Ostatnia aktualizacja: RRRR-MM-DD"

**Zaktualizuj `[nazwa-zadania]-kontekst.md`** (to jedyny plik, który `dev-docs-complete` czyta przy wyciąganiu wniosków):
- Kluczowe decyzje podjęte w tej sesji → sekcja `## Decyzje techniczne`
- Zmodyfikowane pliki i powód zmian, odkryte blokery, obecny stan implementacji → sekcja `## Dziennik`
- Następne bezpośrednie kroki → sekcja „Przekazanie" (pkt 4)
- Znacznik "Ostatnia aktualizacja: RRRR-MM-DD"

**Zaktualizuj `[nazwa-zadania]-zadania.md`:**
- Ukończone checkboxy implementacyjne i `Test: [Unit]`: zamień `- [ ]` → `- [x]` (jedyny format czytany przez bootstrap autopilota, execute-wf i grepy E2E). Nie dopisuj emoji, statusów ani tekstu między `- [ ]`/`- [x]` a treścią/prefiksem
- **NIE odhaczaj** `Weryfikacja:` ani niczego z `[E2E]` — odznacza je wyłącznie review-wf po realnym przebiegu; ręczne `[x]` na `[E2E]` omija precheck i completion-gate (fałszywe zielone E2E)
- Nowo odkryte zadania wpisuj pod właściwym `## Faza N` / `### IU-K`, w kolumnie 0 i tylko z kontraktowymi prefiksami; pozycje dla człowieka → `## Operator checklist faza N` jako `- [ ] Operator: …` / `[Manual]`. Zwykły `- [ ]` bez prefiksu = checkbox implementacyjny blokujący `execute=done`. Gdy nowe zadanie zmienia zakres — zaktualizuj plan techniczny w `docs/plans/`, nie dopisuj IU ręcznie
- Status zadań w toku opisuj w `kontekst.md` (Przekazanie), nie w linii checkboxa
- Znacznik "Ostatnia aktualizacja: RRRR-MM-DD"

### 2. Utrwalenie kontekstu sesji
W odpowiednich plikach zadania uwzględnij:
- Rozwiązane złożone problemy → `[nazwa-zadania]-kontekst.md` (`## Dziennik`)
- Podjęte decyzje architektoniczne → `[nazwa-zadania]-kontekst.md` (`## Decyzje techniczne`)
- Znalezione i naprawione błędy → `[nazwa-zadania]-kontekst.md` (`## Dziennik`)
- Nowe zadania do wykonania → `[nazwa-zadania]-zadania.md` (wg kontraktu formatu wyżej)
- Zmiany w podejściu lub strategii → `[nazwa-zadania]-kontekst.md` (`## Dziennik`) + korekta planu technicznego w `docs/plans/`, jeśli zmienia IU/fazy

### 3. Dokumentacja niedokończonej pracy
W `[nazwa-zadania]-kontekst.md` zapisz:
- Nad czym trwała praca gdy zbliżał się limit kontekstu
- Dokładny stan częściowo ukończonych funkcji
- Komendy do uruchomienia po restarcie
- Tymczasowe obejścia wymagające trwałych poprawek

### 4. Notatki przekazania
Na końcu `[nazwa-zadania]-kontekst.md` dodaj sekcję "Przekazanie":
- **Branch:** [nazwa brancha]
- **Ostatni commit:** [hash] - [message]
- Dokładny plik i linia będąca edytowana
- Cel bieżących zmian
- Komendy testowe do weryfikacji pracy

### 5. Commit dokumentacji
Po aktualizacji wszystkich plików:
```bash
git add docs/active/ docs/plans/<plik>-plan.md   # plan techniczny TYLKO jeśli go zmieniłeś w §1/§2 (dokładna ścieżka, bez blanket docs/plans/)
git commit -m "docs([nazwa-zadania]): aktualizacja przed resetem kontekstu"
git status --short   # MUSI być puste — bootstrap autopilota zatrzymuje run na niezacommitowanych zmianach
```

## Dodatkowy kontekst: $ARGUMENTS

**Priorytet**: Skup się na uchwyceniu informacji, które byłyby trudne do ponownego odkrycia lub odtworzenia z samego kodu.

## Format wyjściowy
```
✅ Dokumentacja zaktualizowana przed resetem kontekstu

🔀 Branch: [nazwa-brancha]
💾 Ostatni commit: [hash] - [message]

📝 Zaktualizowane pliki:
   - [lista plików]

📋 Stan zadania:
   - Ukończone fazy: X/Y
   - Następna faza: [nazwa/numer]

🔄 Po resecie uruchom (domyślnie autopilot; przy STOP bramki — świeży run bez resumeFromRunId):
   Workflow({ scriptPath: ".claude/workflows/dev-autopilot-wf.js", args: "[ścieżka-zadania]" })
   Ręczna kontrola faza po fazie: /dev-docs-execute [ścieżka-zadania]
```