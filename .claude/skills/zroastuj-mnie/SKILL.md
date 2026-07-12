---
name: zroastuj-mnie
description: Przesłuchuje użytkownika o każdym aspekcie planu lub projektu aż do pełnego zrozumienia, rozwiązując każdą gałąź drzewa decyzyjnego. Używaj gdy user chce stress-testować plan, prosi o "roast", "zroastuj", chce przegadać temat, lub mówi "podważ to".
---

Przesłuchaj mnie bezlitośnie o każdym aspekcie tego planu, aż dojdziemy do wspólnego zrozumienia. Idź po każdej gałęzi drzewa decyzyjnego, rozwiązując zależności między decyzjami jedna po drugiej.

## Zasady rozmowy

- Zadawaj **JEDNO pytanie naraz**. Czekaj na odpowiedź zanim przejdziesz dalej.
- Przy każdym pytaniu daj swoją **rekomendowaną odpowiedź** z uzasadnieniem.
- Jeśli na pytanie można odpowiedzieć eksplorując codebase lub dokumenty — zrób to **sam zamiast pytać**.

## Krok 0: Research przed pierwszym pytaniem

Zanim zaczniesz roast, **przeskanuj istniejące źródła decyzji** w repo. Nie pytaj o rzeczy, które są już udokumentowane.

Kolejność i cel:

1. **`docs/active/`** — aktywne projekty z `/dev-docs`. Plany, status, learnings z trwających prac. Sprawdź czy roastowany temat nie jest częścią aktywnego zadania.
2. **`docs/completed/`** — ukończone projekty wdrożeniowe. Decyzje historyczne i ich uzasadnienia. Cennie dla "dlaczego zrobiliśmy to tak".
3. **`docs/solutions/`** — baza rozwiązanych problemów z `/dev-compound`. Filtruj po YAML frontmatter i nagłówkach. Cenne przy decyzjach technicznych powtarzających się wzorce.
4. **`docs/brainstorms/*-requirements.md`** — requirements docs z `/dev-brainstorm`. Granice scope'u i kryteria sukcesu, które już zostały rozstrzygnięte.
5. **Codebase** — gdy roast dotyczy zachowania istniejącego kodu, zweryfikuj o czym mówisz, zanim zapytasz.

Jeśli temat jest mały i izolowany, możesz pominąć research i przejść od razu do pytań — ale **napisz to wprost** ("temat na tyle wąski, że pomijam skan archiwum").

## W trakcie sesji

### Wykrywaj sprzeczności z udokumentowanymi decyzjami

Jeśli plan użytkownika kłóci się z czymś znalezionym w `docs/`, **zatrzymaj się** i wskaż konkretny dokument: "W `docs/solutions/2026-03-15-rate-limiting.md` zdecydowaliśmy X — teraz proponujesz Y. To świadoma zmiana kierunku, czy nie pamiętałeś tej decyzji?". Nie kontynuuj dopóki nie ma jasnej odpowiedzi.

### Wymuszaj precyzję terminologiczną

Gdy user używa rozmytego lub przeciążonego terminu ("kurs" vs "lekcja", "user" vs "klient", "moduł" vs "feature"), zapytaj o kanoniczne znaczenie. Jeśli termin jest już używany w `docs/` lub w kodzie z konkretnym znaczeniem, **odeślij do tego źródła** zamiast tworzyć nową definicję.

**Nie twórz** samodzielnie plików słownikowych w trakcie roastu — to nie jest rola tego skilla (utrwalanie jest sugerowane na końcu sesji, patrz niżej). Ale gdy roast ustali **kanoniczne znaczenie terminu domenowego** (encja, status, nazwany proces), zanotuj je — to kandydat do `docs/CONCEPTS.md`. Hierarchia plików w `docs/` jest stabilna i nie psujemy jej.

### Stress-testuj konkretnymi scenariuszami

Przy decyzjach o granicach, relacjach między bytami lub edge case'ach — wymyśl konkretny scenariusz i zapytaj "co się dzieje gdy...". Abstrakcyjne deklaracje są tanie. Konkretne scenariusze ujawniają niedoprecyzowanie.

### Cross-referencuj z kodem

Gdy user mówi jak coś działa w istniejącym systemie, **zweryfikuj to z kodem** zanim zbudujesz na tym kolejne pytanie. Jeśli kod mówi co innego — wskaż sprzeczność.

## Po sesji — sugerowanie utrwalenia (raz per typ artefaktu)

Gdy w trakcie roastu wyłonią się decyzje warte zachowania, na końcu sesji zasugeruj **konkretny istniejący skill** do utrwalenia. **Maksymalnie jedna sugestia per typ artefaktu** w całej sesji — nie spamuj.

Mapowanie:

- **Rozwiązanie konkretnego problemu technicznego** (root cause + fix) → `/dev-compound`
- **Rozstrzygnięcie scope'u / kryteriów sukcesu / zachowań produktu** → `/dev-brainstorm`
- **Plan techniczny implementacji większej zmiany** → `/dev-docs` lub `/dev-plan`
- **Kanoniczne znaczenie terminu domenowego** (encja, status, nazwany proces o niestandardowym sensie) → `docs/CONCEPTS.md` — jedno hasło jako cienki indeks; utrwal przez `/dev-compound` (ma krok słownika) albo bezpośrednim dopiskiem

Format sugestii: jedna linia na końcu odpowiedzi, np. _"Decyzja o granicy kontekstu Customer/User warta utrwalenia — rozważ `/dev-brainstorm` żeby zapisać to do requirements doc."_

Nie tworzysz tych artefaktów samodzielnie. Sugerujesz, user decyduje.
