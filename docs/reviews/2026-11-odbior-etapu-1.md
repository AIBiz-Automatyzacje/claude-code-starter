# Odbiór Etapu 1 — szablon mobile z rdzenia

Data: 2026-11-04. Szablon: `746d862`, CI „maszyneria” zielone. Plan: `docs/plans/2026-11-01-001-feat-szablon-mobile-z-rdzenia-plan.md`.

## Wynik

| Kryterium planu | Wynik | Dowód |
|---|---|---|
| Pełne testy maszynerii | PASS | test, typecheck, lint i CI zielone; testy rdzenia na próbnym wariancie Expo: 1391/1400, 9 padnięć to dwie grupy zapisane na Etap 2 (5 × szkielet builderów, 4 × przykład planu) |
| Diff zachowania zerowy | PASS z jedną regresją, naprawioną | diff instrukcji względem `f28d829` bez utraconej wiedzy web; regresję skryptu złapał dopiero przebieg autopilota |
| Przebieg autopilota w projekcie web | PASS | vibersi, zadanie `buduje-od-roku`, run `wf_03e2ce83-609`: OK, 2/2 fazy, P1 0, P2 4 naprawione, E2E 3 PASS |

## Regresja znaleziona w odbiorze

Login canary z IU-1.8 (`scripts/e2e/konto.mjs`) zatrzymywał start E2E w projekcie z captchą Auth: `HTTP 400 captcha_failed` i rada o adresie
i kluczu, choć konto i hasło były dobre (run `wf_27376c5c-8aa`, STOP przed fazą 1). Poprawka `a94321b`, merge `746d862`: `captcha_failed` daje
wynik `pominieto` z dopiskiem w detalu startu, bez tokenu i bez zakładania konta. Hasła w takim projekcie nie sprawdza canary, tylko tester.
Testy IU-1.8 nie miały tego przypadku, a porównanie tekstu instrukcji z natury nie mogło go wykryć.

## Czy agenci dostają sloty

Transkrypty runu `wf_03e2ce83-609`, 49 agentów:
- `rules/stack.md` i `coding-rules.md` docierają symetrycznie: 20 agentów ma oba, 29 żadnego, 0 ma tylko jeden. Przed podziałem mechanizmy stały
  w tym jednym pliku, więc odbiorcy są ci sami.
- Buildery czytają Read-em oba pliki (4/4). Fix czyta oba w 4 z 6 uruchomień; w runie sprzed Etapu 1 reguły kodu czytało 5 z 8.
- Reviewerzy nie otwierają `stack.md` Read-em, ale dostają jego treść przez `paths:` przy otwarciu pliku kodu, tak samo jak reguły kodu.
- Zła komenda runnera: 0, błędy „brak pliku” w `.claude/`: 0, pytania do operatora: 0 (raport sesji przebiegu).
- Niesprawdzone: `AbortSignal.timeout` z `stack.md`, bo zadanie nie dodało kodu sieciowego.

## Telemetria

Pole `kontekst.rules_zn` nic tu nie rozstrzyga: jest 0 także w runie sprzed Etapu 1. `profil_stacku: null` jest wpisane na sztywno w `run.mjs` od 2026-09-29.

| Run | Szablon | Fazy | Jedn. na fazę | Sekundy na fazę | Agenci na fazę |
|---|---|---|---|---|---|
| `buduje-od-roku` | `746d862` | 2 | 4 040 662 | 3194 | 24,5 |
| `poprawki-przed-startem` | `ab871a5` | 4 | 3 810 533 | 1966 | 21,5 |
| `etap-6b-start` | `de79a68` | 5 | 3 280 703 | 1993 | 19 |
| `etap-2-poprawki-bezpieczenstwa` | `990d683` | 1 | 4 070 998 | 1762 | 35 |

Koszt na fazę mieści się w zakresie małych zadań. Czas na fazę jest wyższy o ok. 60% względem `poprawki-przed-startem`, głównie przez dwie role:
tester E2E (752 wobec 77 s na fazę, zawieszone zrzuty i dochodzenie do zawieszonego zapisu) i walidację końcową (730 wobec 108 s w całym runie, powtórki
przez niestabilne testy). Etapy stałe przebiegu (bootstrap, stan, compound, complete) kosztują w całym runie tyle samo albo niewiele więcej.
To jeden przebieg na innym zadaniu, więc porównanie pokazuje rząd wielkości, a nie wpływ Etapu 1. Szablon `ab871a5` jest też o 18 commitów starszy od punktu odniesienia `f28d829`.

## Otwarte po przebiegu

Żadna z tych spraw nie wynika z tekstu slotów; przyczyna dwóch pierwszych jest nieustalona.
1. **Zrzuty ekranu w E2E:** `zrzut niedostępny (> 30 s)`, także próbny na `about:blank`, choć próbny zrzut na starcie przeszedł. Tester obsłużył to wg swojej procedury i oparł PASS na tekście strony i stanie bazy. Ten sam objaw notowano w vibersi już w etapie 2 (P19) i w `etap-4`, więc to nie musi być regresja.
2. **Niestabilne testy vibersi:** 2 z 11 biegów czerwone, za każdym razem inny test (`krok-logowania.test.tsx:250`, `menu-konta.test.tsx:260`).
3. **Stryker w fazie 2:** bramka ma status `blad`. `scripts/bramki` nie zmieniły się od `f28d829`.
4. **Gałąź zadania, do oceny przed mergem:** zapis formularza zmieniony szerzej niż plan (po review), zawieszenie zapisu w przeglądarce testera 3 razy na 3 w sekwencji spoza scenariusza, osłabione asercje w `ustawienia-profilu-stany.test.tsx` (`profiles_private`: sama ścieżka, bez ciała) i ubyty przypadek Tokio w `profil.test.ts`. To kod zadania, ale reguła „Asercji nie osłabiasz” stoi w rdzeniu i fix ją przeczytał.
5. **Lokalny Docker:** agent domknięcia fazy 1 sam postawił lokalną bazę do sprawdzenia migracji i usunął ją przez `supabase stop --no-backup`. Przed usunięciem sprawdził, że wolumen powstał w tym runie, więc starszych danych to nie dotknęło. Szablon tego nie zleca.

## Stan vibersi

Gałąź `feature/buduje-od-roku`: 13 commitów, niewypchnięta, bez PR. Migracja `20261103120000_buduje_od_roku.sql` tylko na e2e; dev bez zmian, prod nietknięty wg komend agentów (bazy nie sprawdzano wprost). Smoke operatora: `docs/operator/2026-11-04-buduje-od-roku-smoke.md`.
