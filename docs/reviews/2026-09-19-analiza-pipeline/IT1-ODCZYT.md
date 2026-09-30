# It. 1 — odczyt (smoke) — 2026-09-30

Run `wf_031f0eae-204` (sesja `d40cf2e0`, kopia `~/Documents/Kodowanie/_smoke-it1-oferty-online`, gałąź `test/smoke-autopilot`).
Dane: `dane/it1-odczyt.txt` (skrypt `skrypty/it1_odczyt.py wf_031f0eae-204`), raport `docs/reviews/telemetria/raport-2026-09-01_2026-09-30.txt`.

## 0. Wniosek

**Telemetria działa: odczyt ZALICZONY po jednej poprawce skanu.** Hook sam zapisał rekordy runu 30 s po jego końcu, rekordy zgadzają się
z plikiem harnessu co do agenta, nie ma agenta telemetrii ani pól `tokeny*`. Pełny skan: 427/427 plików harnessu z rekordem `run`, 0 NIEZNANY.
**Błąd skanu (poprawiony, test → kod):** `run.walidacja` było `null` we wszystkich 57 runach autopilota, bo autopilot zwraca obiekt walidacji,
a skan przyjmował tylko tekst. Po poprawce (v4): 22 PASS, 4 FAIL, 31 bez walidacji, co do sztuki jak w plikach harnessu.
**Trzy wady raportu — POPRAWIONE po akceptacji (§5):** raport liczy tylko pipeline dev-\* (analizy osobnym wierszem), wątki bota bez wagi
to „bez klasyfikacji”, komendy lokalne nie są skillami. Bez ponownego skanu — potrzebne pola już są w rekordach; akceptacja raportu z It. 1
(udziały 06–19.09 = d5r §2, `ctx_start` 20.09 = D3) po poprawkach bez zmiany liczby.

## 1. Run smoke

| | plan | wynik |
|---|---|---|
| status | OK | OK (harness `completed`, wynik `OK`) |
| koszt | ~5–10 M jedn. | **4,78 M** (faza 1: 3,19 M; poza fazą 1,58 M) |
| agenci | 30–40 | 31 (22 opus 5.5, 9 haiku) |
| czas | 30–45 min | 19 min (1 135 s) |
| review | — | 9 → 4 po dedupie, 3 P2 zweryfikowane (0 obalonych), gate CZYSTE, fix 4/4, kontrola fixa 0 regresji |
| walidacja końcowa | — | PASS (lint SKIPPED; dashboard bez `.env` → testy z atrapami zmiennych, 3 flaky czasowe w `markup-scan`) |

## 2. Asercje pkt 3 (rekordy runu)

| asercja | wynik |
|---|---|
| rekord `run`, status = plik harnessu | TAK — `OK` = `completed` + `wynik.status OK`; zapis hooka `07:34:04Z` (koniec runu `07:33:34Z`), bez komendy operatora |
| rekordy `faza` i `agent` dla każdego agenta z `workflowProgress` | TAK — 1 faza; 31/31 agentów, 0 brakujących, 0 nadmiarowych, każdy z etykietą |
| `szablon.zgodny = true` | TAK — marker `0d3876f`, `dzieci_zmienione: false`; 165/165 plików kopii = `.template-hashes` |
| `effort` u agentów opus | TAK — 22/22 (20 medium, 2 low); haiku bez efortu (zgodnie z planem) |
| 0 agentów `telemetria:*` w pliku harnessu | TAK |
| wynik runu bez `tokeny`/`tokenyEtapy` | TAK |
| smoke: `smokeStatus`, plik w `docs/operator/` | TAK — `smokeStatus: "plik"`; log complete-wf `(1 pozycji)` bez „UWAGA … [E2E]”; plik ma 4 pozycje `- [ ]`, 0 wartości sekretów (jedyne trafienie to nazwa zmiennej z `.env.example`); commit archiwizacji `2e94fa7` zawiera `docs/operator/2026-09-30-smoke-autopilot-smoke.md` |
| epizod skilla `dev-autopilot-wf` w sesji głównej | TAK — `zrodlo: slash`, 9 tur |

## 3. Pkt 4 — pełny skan i błąd skanu

- `zbierz.mjs --skan`: 429 runów (427 z plikiem + 2 KILLED bez pliku), 1 741 sesji, 0 błędów, 26 s. Statusy: OK 385, STOP 36, KILLED 6, FAILED 2; NIEZNANY 0.
- **Błąd:** `rekordRunu()` brał `tekstLubNull(wynik.walidacja)`. Autopilot od dawna zwraca pełny obiekt (`{ wynik, typecheck, lint, build, testy, … }`),
  więc pole było zawsze `null` (225 rekordów v1–v3). Stary agent telemetrii zapisywał sam wynik (`"PASS"` w 6/8 wpisach `autopilot-runs.jsonl`).
- **Poprawka (niezacommitowana, czeka na akceptację):** test `walidacja koncowa z wyniku autopilota…` w `__tests__/run.test.mjs` (RED potwierdzony) →
  `wynikWalidacji()` w `run.mjs` (obiekt → `wynik`, tekst `PASS`/`FAIL` → bez zmian, reszta — w tym „done w poprzednim runie” — `null`) →
  `WERSJA_REKORDU` 3 → 4. `pnpm typecheck && pnpm test && pnpm lint` zielone (192 testy).
- **Na prawdziwych danych:** skan dopisał 5 368 rekordów v4 (plik 20,8 → 27,6 MB); walidacja 22 PASS / 4 FAIL / 31 null = stan plików harnessu;
  raport za wrzesień po poprawce identyczny z raportem przed nią (sumy nie dublują się po podbiciu wersji).
- Kopia projektu ma dalej skan v3 (sync przed poprawką) — projekty dostaną v4 dopiero po push szablonu + `sync-template`; skan z szablonu i tak
  przelicza całą maszynę (najwyższa wersja wygrywa).

## 4. Skrót raportu za wrzesień (po poprawkach §5)

- **Koszt per etap** (pipeline dev-\*: 1 013,3 M, 1 928 agentów, 112 runów): review 30,2%, execute 26,9%, fix 16,6%, orkiestracja 9,7%,
  sceptycy 7,7%, mechanika review 5,2%, poza etapami faz 3,7% (37,1 M). oferty-online 816 M (81%). Poza pipeline'em (analizy, testy):
  280 runów, 935 agentów, 306,2 M — razem 1 319,5 M jak przed filtrem.
- **Kontekst startowy per klasa** (raport §2 po poprawce = `dane/it1-odczyt.txt` §3):

| klasa | 20.09 (D3) | dev-* opus 5.5 wrzesień (przed KROK 0) | smoke 30.09 (po KROK 0) |
|---|---|---|---|
| orkiestracyjny opus | 121k | 114k | 73k |
| reviewer opus | 125k | 118k | 76k |
| sceptyk opus | 123k | 115k | 73k |
| naprawiacz opus | — | 116k | 77k |
| builder opus | 135k | 136k | 84k |
| mechaniczny haiku | 89k | 81k (raport, wszystkie modele opus 5 / 5.5) | 52k |

  Spadek o ~40k w smoke'u to efekt KROKU 0 (porządki konta): 40 narzędzi na starcie zamiast 685. To jeszcze nie It. 3a (cele 9–38k).
- **Efort:** opus prawie zawsze z efortem; „brak” tylko u haiku i agentów syntetycznych.
- **STOP-y** (dev-autopilot: STOP 19, OK 14, FAILED 2; dev-pr: OK 69, STOP 6; bez harnessu KILLED 2): czystość repo 6, E2E-środowisko 5,
  execute 4, bramka wejścia 4, walidacja 4, scribe 1, P1 1.
- **Skille (sesja główna, pełny koszt p50):** dev-pr 5,7 M (n 3), dev-plan 3,2 M (n 7); poza pipeline'em skill-creator 9,6 M, wpis-blog 5,3 M.
- **Anomalie:** top `review:e2e` 19,6 M w `wf_51feac8b-a22`; potem fix/build 4,4–7,0 M.
- **Jakość bota:** wszystkie 7 zadań wrześniowych (178 wątków) „bez klasyfikacji (sprzed słownika klas)” — pierwsza liczba P1/P2 na 100 plików
  przyjdzie z pierwszego runu dev-pr po sync (It. 2). Punkt odniesienia do tego czasu: import (19 PR, 6,7 P1/P2 na 100 plików, d5b).

## 5. Wady raportu (nie skanu) — POPRAWIONE 2026-09-30 po akceptacji operatora

Każda: test (RED potwierdzony) → kod → `pnpm typecheck && pnpm test && pnpm lint` zielone (196 testów). Bez ponownego skanu: filtry działają
na polach, które już są w rekordach (sprawdzone na danych: `workflow` ma 3 088/3 090 agentów — 2 bez to KILLED run analizy `mr-f`;
`severity` w `run.pr` = null w 255/255 wątków; rekordy `exit`/`copy` = 3). Kontrola na prawdziwych danych: `skrypty/it1_akceptacja_raportu.mjs`
bez zmiany wyniku (ZALICZONE), raport §2 = `dane/it1-odczyt.txt` §3, suma pipeline + analizy = 1 319,5 M jak przed filtrem.
- **a.** `czyPipeline()` w `raport-sekcje.mjs`: run należy do raportu, gdy `workflow` zaczyna się od `dev-` albo jest nieznany (run bez harnessu —
  nie wiadomo czyj, jego KILLED to sygnał niezawodności). Agent po workflowie SWOJEGO runu (z całej historii). Test CLI w `raport-cli.test.mjs`.
- **b.** `jakoscBota()` zwraca `bez_wagi`; wskaźnik na 100 plików tylko, gdy jest choć jeden wątek z wagą. Test w `raport-sekcje.test.mjs`
  + test CLI tekstu. Istniejący test `jakosc bota…` dostał w oczekiwanym obiekcie nowe pole `bez_wagi: 0` (zmiana kontraktu, asercja silniejsza).
- **c.** `KOMENDY_LOKALNE` w `skill.mjs` — jedna lista dla skanu i raportu; wyrażenie regularne skanu zbudowane z niej jest identyczne ze starym
  (porównanie `source`), więc skan bez zmian i bez podbicia wersji. `skillePerNazwa()` pomija te nazwy.
- **Otwarte (do It. 3c, doctor):** rekord, którego nowsza logika skanu już nie tworzy, zostaje w pliku na zawsze (dziś tylko te 3). Filtr c
  załatwia komendy lokalne; ogólny mechanizm (znacznik „wycofany” przy skanie) — gdy pojawi się drugi przypadek.

Opis wad sprzed poprawki:

a. **§2 i §5 raportu biorą wszystkie workflowy, nie tylko dev-\*.** Agenci analiz i testów (test-review 98+37+24, mini-run, panel) mają 13 narzędzi
   i mały CLAUDE.md, więc mediana opus 5.5 spada do 45–54k — fałszywy obraz „kontekst już ścięty”. §5 wypisuje ~230 jednorazowych workflowów,
   §1 „per projekt” ma katalogi robocze testu review (`f-*`, `x-*`). Naprawa: filtr `workflow` ∈ pipeline dev-\* w §2/§3/§5/§7 (reszta jednym wierszem).
b. **§4 liczy brak wagi jako „0 P1/P2”.** Stare runy dev-pr (przed słownikiem klas z kroku 8) mają `severity: null` i `pliki: null` — raport wypisuje
   „0 P1/P2 z 43 wątków, — na 100 plików”. Import (typ `pr`, v0: 19 PR, 6,7 P1/P2 na 100 plików) do raportu nie trafia — zgodnie z planem (krok 6: tylko `run.pr`).
   Naprawa: wątki bez wagi jako „bez klasyfikacji: N” zamiast zera.
c. **3 osierocone rekordy v1** (`exit`, `copy` ×2 jako skille) — v2 przestała je tworzyć, ale odczyt bierze ostatni rekord per klucz, więc zostały.
   Naprawa: raport pomija nazwy komend lokalnych (ta sama lista co `RE_LOKALNA` w `skill.mjs`).

Decyzja operatora (2026-09-30): „akceptuję, popraw wszystkie trzy wady raportu teraz”.

## 6. Obserwacje poza telemetrią (do It. 3, nie blokują)

- Fixture smoke'a (`src/lib/`) w monorepo wypada poza bramki jakości (root `pnpm test`/`typecheck` go nie widzi). Review to złapał (3× P2 test-coverage),
  fix dopisał `src/lib` do `package.json` i `tsconfig.tools.json`, compound zapisał solution + regułę do `learned-patterns` kopii. Pipeline zadziałał
  poprawnie, ale smoke w monorepo zawsze zrobi cykl fixa — koszt ~0,6 M.
- Commit archiwizacji `2e94fa7` ma komunikat commita feature (`feat(smoke-autopilot): dodajBezpiecznie…`), nie `docs(...)`: archiwum.
- Szablon śledzi w gicie `.claude/skills/ux-ui-guidelines/.DS_Store` — sync kopiuje go do projektów.

## 7. Po akceptacji

HANDOFF (§2 wiersz It.1, 6a pkt 39, §7, §8 → instrukcja It. 2 — bot, dev-pr i B0), pamięć projektu, commity poprawki skanu i raportu
(`fix(telemetria)`) i `docs/reviews`.
Sprzątanie kopii `~/Documents/Kodowanie/_smoke-it1-oferty-online` tylko za zgodą na dokładną ścieżkę.
