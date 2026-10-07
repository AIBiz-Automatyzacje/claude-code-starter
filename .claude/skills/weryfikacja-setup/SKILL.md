---
name: weryfikacja-setup
description: "Tworzy w projekcie skill weryfikacji aplikacji (.claude/skills/weryfikacja/): sekcje Launch, Doctor, Drive, Evidence i Cleanup oraz mapę funkcji zasianą z planów zrobionych zadań, a potem raz przechodzi go na żywo. Tester E2E autopilota czyta ten skill, a archiwizacja zadań dopisuje funkcje do mapy. Używaj gdy: „skonfiguruj weryfikację”, „skill weryfikacji”, „mapa funkcji”, „weryfikacja-setup”, bramka gotowości dev-plan zgłasza brak skilla weryfikacji, a także po setupie środowiska E2E."
---

# weryfikacja-setup — skill weryfikacji projektu

Skill weryfikacji to jedno miejsce, z którego tester E2E, sesja i operator wiedzą, jak uruchomić aplikację, jak ją prowadzić
i co jest dowodem działania funkcji. Launch, Doctor i Cleanup wołają `.claude/scripts/e2e/e2e.mjs` — ten sam skrypt co autopilot,
więc skill nie ma własnego przepisu na środowisko. Ten skill dokłada fakty projektu (logowanie, nawigacja, selektory) i mapę funkcji.

Wynik: `.claude/skills/weryfikacja/SKILL.md` i `.claude/skills/weryfikacja/mapa-funkcji.md`, zacommitowane. Szablon tego katalogu
nie dostarcza, więc sync-template go nie nadpisze.

## Wykonanie

1. **Stan.** `test -f .claude/skills/weryfikacja/SKILL.md` — gdy plik istnieje, przejdź do sekcji „Utrzymanie”. Nadpisanie
   szkieletem (`--nadpisz`) kasuje uzupełnione sekcje, więc wykonujesz je wyłącznie na wyraźną prośbę operatora.

2. **Szkielet.** `node .claude/scripts/e2e/e2e.mjs weryfikacja --zapisz` → JSON: `plik`, `trasy` (z kodu), `uzupelnij` (liczba
   znaczników do wypełnienia), `mapa` (`wpisow`, `dodane` — funkcje ze scenariuszy `[E2E]` planów zadań z `docs/completed/`).
   Kod 1 z polem `odmowa` = skill już istnieje.

3. **Fakty z kodu.** Każdy znacznik `<!-- UZUPEŁNIJ: … -->` w sekcji Drive zastąp faktem odczytanym z repo, z plikiem źródłowym
   w nawiasie: formularz logowania (pola i przycisk — etykieta, rola albo `data-testid` z komponentu), nawigacja do głównych
   ekranów (menu, linki), trasy, których router nie oddał. Z listy „Trasy z kodu” zostaw ekrany; trasy API przenieś do sekcji
   Evidence jako źródło dowodu HTTP. Faktu, którego nie ma w repo, nie dopisujesz — zostaw znacznik i wymień go w raporcie.

4. **Przejście na żywo** (raz, przed oddaniem):
   - Doctor: `node .claude/scripts/e2e/e2e.mjs sprawdz`. Status inny niż `gotowe` → wynik `blocked` z treścią pola `naprawa`; przejdź do kroku 5.
   - Launch: `node .claude/scripts/e2e/e2e.mjs start` (Bash z limitem 600000 ms — skrypt czeka na odpowiedź serwera).
   - Drive: skillem `agent-browser` zaloguj się według sekcji Drive i przejdź drogę jednej funkcji z mapy (najnowszy wpis)
     albo głównego ekranu, gdy mapa jest pusta.
   - Evidence: asercja oczekiwanego stanu w snapshotcie i zrzut `agent-browser screenshot /tmp/weryfikacja-setup.png`.
   - Cleanup: `node .claude/scripts/e2e/e2e.mjs stop` i `agent-browser close`.
   - Rozjazd skilla albo mapy z aplikacją (inna etykieta, trasa, krok) poprawiasz w pliku, a wynik to `changed`; wszystko
     zgodne — `clean`.

5. **Wynik przejścia.** Linię `Przejście na żywo: niewykonane` w skillu zamień na `Przejście na żywo: <clean|changed|blocked> (<data z date +%F>)`,
   przy `blocked` z powodem po myślniku.

6. **Commit.** `git add .claude/skills/weryfikacja && git commit -m "docs(weryfikacja): skill weryfikacji projektu"` — bramka
   gotowości przed autopilotem wymaga czystego drzewa.

## Utrzymanie (skill istnieje)

Mapę funkcji uzupełnia archiwizacja każdego zadania (`e2e.mjs mapa`), więc utrzymanie dotyczy sekcji skilla:
`node .claude/scripts/e2e/e2e.mjs weryfikacja` (podgląd bez zapisu) pokazuje aktualne parametry Launch i trasy z kodu — dryf
względem skilla poprawiasz w pliku, potem przejście na żywo z kroku 4, wynik z kroku 5 i commit z kroku 6.

## Raport

Ścieżki obu plików, liczba wpisów mapy, wynik przejścia na żywo (z powodem przy `blocked`), znaczniki pozostawione bez faktu
i hash commita.
