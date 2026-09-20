# Przegląd runów autopilota po planie naprawy (2026-09-06 → 2026-09-19)

Zakres: wszystkie uruchomienia `dev-autopilot-wf` od wdrożenia napraw N1–N9 (2026-09-06, commity `83de0f9..e5ce4ea`
w szablonie) do dziś. Źródła dowodów: journale workflowów w `~/.claude/projects/*/subagents/workflows/*/journal.jsonl`
(13 runów), transkrypty sesji (komendy scribe'a telemetrii), `.autopilot-state.json` i `review-faza-N.md` w
`docs/completed/`, historia gita `oferty-online` i `akademia-automatyzacji-dashboard`, globalna telemetria
`~/.claude/telemetry/autopilot-runs.jsonl`. Nie opieram się na samej telemetrii, bo — patrz W2 — jest niekompletna.

## Wnioski w pięciu zdaniach

1. **Pipeline dowozi.** 5 zadań (faza-8, 9c, 9a, 9b, samodzielna-rejestracja w `oferty-online`; traferto w akademii)
   zakończyło się archiwizacją, compoundem i smoke'iem operatora; walidacja końcowa, kontrola diffu naprawczego,
   commit artefaktów przy STOP-ie i telemetria „także na STOP" działają jak zaprojektowano.
2. **Cztery zadania `oferty-online` po 06.09 jechały na STAREJ maszynerii** — `.claude/workflows/` w tym repo to stan
   szablonu z 2026-09-03/04 plus lokalny patch E2E, bez żadnej z napraw N1–N9. Jedyny run na aktualnej wersji to
   `traferto-membership-emission` (1 faza, bez E2E). Weryfikacja N1–N9 realnym runem jest więc **częściowa**.
3. **Globalna telemetria została skasowana przez scribe'a (haiku) — dwa razy.** 12.09 (`sed -i '' -e '2,$d'`) wyciął
   wszystko poza pierwszą linią, 16.09 (`sed -i '' -e '5,$d'`) wyciął trzy kolejne wpisy. Z 39+ runów zostało 6 linii,
   z czego 2 zdeformowane. Odzyskałem 32 wpisy z transkryptów do osobnego pliku (sekcja 6).
4. **Koszt i przebieg:** mediana fazy 584k tokenów (execute 242k, review 245k, fix 99k; n=23 faz). Próg 1 planu
   (mediana fixa >120k) nieprzekroczony, ale wzrósł z 75k do 99k. Review „nie zbiega": każda powtórka review tej samej
   fazy znajduje 12–18 nowych pozycji do naprawy (9b faza 4 dwukrotnie, samodzielna faza 3 trzykrotnie) — ~1,2M
   tokenów poszło na powtórki wymuszone wyłącznie przez bramkę E2E.
5. **Trzy z pięciu zadań wymagały 2–3 runów**, a przyczyny STOP-ów to niemal wyłącznie E2E: niemierzalna asercja w
   headless (9b), SKIP przez limit mailera stagingu 2/h (samodzielna, trzykrotnie ten sam SKIP), fałszywy STOP
   „niezacommitowane zmiany" po ręcznej edycji operatora w `docs/active/` (9b), oraz P1 nierozwiązane po fixie (9c).

## 1. Lista runów

| Data (lokalna) | Projekt | Zadanie | Run | Wynik | Tokeny wyj. | Uwaga |
|---|---|---|---|---|---|---|
| 09-06 20:16 | oferty-online | faza-8 | 1/3 | STOP: execute fazy 2 `blocked` (próg gzip 3072 B wymaga decyzji operatora) | 509k | faza 1 OK |
| 09-07 06:49 | oferty-online | faza-8 | 2/3 | STOP: walidacja końcowa FAIL (E2E FAIL w fazach 4–6) | 3 321k | fazy 2–6 OK, gate f6 ZASTRZEŻENIA |
| 09-07 08:10 | oferty-online | faza-8 | 3/3 | OK — walidacja PASS, compound, complete; **scribe telemetrii padł 4×**, wpis dopisał ręcznie operator | — | |
| 09-11 10:43 | oferty-online | faza-9c | 1/2 | STOP: faza 1 — 1× P1 nierozwiązane po fixie | 366k | |
| 09-11 13:13 | oferty-online | faza-9c | 2/2 | OK (fazy 2–3, E2E 2/0/0) | 580k | |
| 09-13 01:20 | oferty-online | faza-9a | 1/1 | OK — 4 fazy w jednym runie, wszystkie gate CZYSTE, E2E 5 PASS / 0 FAIL / 1 SKIP | 2 985k | scribe skasował telemetrię i zapisał wpis-szkielet |
| 09-14 00:02 | akademia-dashboard | traferto-membership-emission | 1/1 | OK — 1 faza, bez E2E | 302k | **jedyny run na wersji z N1–N9** |
| 09-14 20:08 | oferty-online | faza-9b | 1/3 | STOP: walidacja FAIL — 1 scenariusz [E2E] FAIL (rAF nie tyka w headless, driver.js nie woła `onDestroyed`) | 2 789k | 4 fazy OK, f4 gate ZASTRZEŻENIA (1 P2 e2e→fix) |
| 09-14 22:13 | oferty-online | faza-9b | 2/3 | STOP: „niezacommitowane zmiany" — operator zmienił `[E2E]→[Manual]` w `docs/active/` i nie zacommitował | 4k | fałszywy STOP; commit artefaktów `cd7a51b` zrobił to za niego |
| 09-14 23:16 | oferty-online | faza-9b | 3/3 | OK — powtórka review fazy 4 (18 poz. do naprawy + 2 z kontroli diffu), walidacja PASS | 374k | |
| 09-16 21:01 | oferty-online | samodzielna-rejestracja | 1/3 | STOP: walidacja FAIL — 1 [E2E] nieuruchomiony (SKIP: pula mailera stagingu 2/h → 429) | ~1 341k | 3 fazy OK |
| 09-16 22:41 | oferty-online | samodzielna-rejestracja | 2/3 | STOP: to samo — trzeci SKIP z rzędu, `review:e2e` padł i poszedł retry | 342k | run bez zmiany po stronie operatora |
| 09-17 00:15 | oferty-online | samodzielna-rejestracja | 3/3 | OK — po `[E2E]→[Manual]` (`7af859e`) i ręcznej edycji stanu; trzecia runda review fazy 3 (12 poz.) | 359k | |

Łącznie 13 runów, 5 zadań domkniętych, 0 zadań porzuconych. `claude-cron` nie miał runów po 06.09.

## 2. Co działa (potwierdzone dowodami z journali)

- **Bramki i STOP-y są prawdziwe.** Każdy STOP miał konkretny, mierzalny powód (P1 po fixie, E2E FAIL/SKIP, brudne
  drzewo). Żadnego STOP-u „z powietrza", żadnej awarii orkiestratora.
- **Commit artefaktów przy STOP-ie (plan B2)** zadziałał 4/4 razy (`825c2aa`, `cd7a51b`, `7fab9c5`, `2c97286`),
  zawsze z `brudnePozaZadaniem: []`.
- **Kontrola diffu naprawczego** wyłapuje realne regresje fixa (np. `redirect-path.ts:53` — fix dodał pole bez
  walidacji; `login-form.test.tsx:335` — test dołożony bez asercji zachowania) i domyka je osobnym commitem.
- **Walidacja końcowa** liczy testy (3 260 → 3 563 w oferty-online między 14.09 a 17.09), wykrywa zmodyfikowane
  testy i raportuje je z uzasadnieniem per commit, odróżnia flake-infra (`markup-scan.test.ts`, strażnik 200 ms) od
  regresji.
- **Bootstrap ze stanu** poprawnie wykrywa rozbieżności md↔JSON i ich NIE koryguje (zgodnie z regułą źródła prawdy),
  wypisując je operatorowi — 4 rozbieżności przy 9b run 3, 4 przy samodzielnej run 3.
- **Na nowej wersji (traferto):** w stanie i telemetrii są wszystkie 4 nowe metryki review (`dossier: true`,
  `sceptycy {p1:0, p2Grupy:2, p2Findingi:3}`, `severityKorekty {0/2}`, `tiery {packager: low, sceptykP2: medium}`),
  `kontrolaFixa` ma `pominiete: []` i `bezSladu: 0`, a `review-faza-1.md` ma dokładnie jeden format nagłówków
  (`## Findingi P2` / `### P2 · KOD · \`plik:linia\``). Test suite szablonu: 74/74 PASS (sprawdzone dziś).

## 3. Co nie działa — findingi

### W1 · `oferty-online` nie ma napraw N1–N9 (najważniejsze)

`diff -u` szablonu z `oferty-online/.claude/workflows/`: w `dev-autopilot-wf.js` brakuje enum `P3` w
`FINDING_OTWARTY.severity` (N1), funkcji `polaczFindingiPoPowtorce` (N2), metryk `dossier/sceptycy/severityKorekty/tiery`
w schemacie stanu (N3), `skrotE2eSync` (N6), `podsumujKontroleFixa` (N9); w `dev-docs-review-wf.js` brakuje tabeli
metryk kosztu i stałego formatu nagłówków (N3, N8). Ostatni sync w tym repo: `565e12f` 2026-09-03, po nim lokalne
patche E2E (`a5e9b76`, `1de5a4c` 2026-09-04).

Skutki widoczne w runach:
- `e2eSync` w telemetrii 9b ma po 2 000–3 300 znaków na fazę (N6 miało ciąć do 200).
- Raporty review w `oferty-online` mają **trzy różne konwencje nagłówków** w trzech kolejnych zadaniach
  (9a: `#### P1 · KOD · …`, 9b: `### 1. [P1/KOD] …`, samodzielna: `### P2` bez typu).
- Przy powtórkach review (9b f4, samodzielna f3) findingi z przerwanego podejścia nie były przenoszone — lista
  była nadpisywana (dokładnie ten mechanizm, który naprawia N2).
- `kontrolaFixa` bez `pominiete/bezSladu` — np. faza-8 f1: `pozycje: 17, naprawione: 1, walidacja: PASS` i **zero
  śladu po 16 pozycjach** (to jest luka, którą N9 miało liczyć).

Blokada synca jest znana: `sync-template` nadpisałby lokalny patch E2E (serwis Node zamiast Vite, wspólna baza
staging). Do czasu parametryzacji E2E w szablonie ten projekt nie dostanie żadnej naprawy.

### W2 · Scribe telemetrii skasował globalny plik (utrata danych)

Plik `~/.claude/telemetry/autopilot-runs.jsonl` ma dziś 6 linii i datę utworzenia 2026-09-16 22:42 (data urodzenia
i-node'a — `sed -i` tworzy nowy plik). Sekwencja z transkryptów:

- **12.09 23:23** (faza-9a, agent haiku `telemetria:OK`): `jq` bez `-c` dopisał 100+ linii pretty-printu, agent
  „posprzątał" komendą `head -1 … > /tmp/first_line.json && sed -i '' -e '2,$d'` — zostawił jedną linię z 14.07.
  Potem dopisał wpis 9a jako **szkielet** (`{"faza":1,"gate":"CZYSTE"}` × 4, bez tokenów i liczników), mimo że w
  pierwszej próbie miał pełne dane (607k/783k/506k/988k na fazę).
- **16.09 22:42** (samodzielna, ten sam agent): znów `jq` bez `-c`, potem `sed -i '' -e '5,$d'` z komentarzem
  „było 4 linie" — a było 7. Zniknęły: 9b STOP „niezacommitowane", 9b OK (run 3), samodzielna STOP (run 1 z pełnymi
  metrykami).
- **07.09 08:10** (faza-8): scribe padł 4× i nie zapisał nic; operator dopisał wpis ręcznie z sesji głównej.
- **14.09 20:08** (9b): scribe najpierw dopisał do pliku dosłowny tekst `temporary_placeholder`, potem go usunął.

Przyczyna systemowa: krok zapisu jednej linii jest delegowany do agenta z pełnym Bashem, a prompt sam podsuwa
mu `sed -i '' -e '$d'` jako narzędzie naprawy. Skrypt workflowu nie ma dostępu do `fs` (API: `agent/parallel/
pipeline/phase/log/budget`), więc deterministyczny append nie jest możliwy w JS.

Ten sam wzorzec dotyczy `.autopilot-state.json` (też pisany przez agenta): w `samodzielna-rejestracja` leży
`.autopilot-state.json.bak` z **niepoprawnym JSON-em** (błąd w linii 78) po ręcznej edycji stanu przed runem 3.

### W3 · Review nie zbiega, a bramka E2E wymusza pełną powtórkę

Powtórka review tej samej fazy po STOP-ie „tylko E2E" uruchamia komplet 6 reviewerów + verify + fix + kontrolę
diffu, mimo że kod przeszedł już review i fix. Wyniki powtórek:

| Faza | Runda 1 | Runda 2 | Runda 3 |
|---|---|---|---|
| 9b faza 4 | P1 1, P2 11, P3 7 → 18 napraw | P1 1, P2 7, P3 10 → 18 napraw (gate BLOKUJE!) | — |
| samodzielna faza 3 | P2 4, P3 10 → 12 napraw | P2 3, P3 10 → 13 napraw | P2 3, P3 9 → 12 napraw |

Każda runda znajduje tyle samo nowych pozycji, w tym nowe P1/P2 w kodzie, który już „przeszedł". To znaczy, że
(a) reviewerzy zawsze znajdą ~12–18 pozycji niezależnie od jakości, albo (b) fix wprowadza tyle nowych defektów,
ile naprawia. Oba wyjaśnienia są złe dla progu „koniec review". Koszt: ~1,2M tokenów wyjściowych na powtórki w dwóch
zadaniach. N2 (przenoszenie findingów) nie zmienia tego — nadal odpalany jest pełny skład.

### W4 · STOP-y E2E, które pipeline mógł obsłużyć sam

- **Samodzielna run 2** wystartował 1,5 h po runie 1 bez żadnej zmiany; scenariusz `rejestracja-czlonek-link`
  SKIP-nął trzeci raz z rzędu (limit mailera 2/h). 342k tokenów i 1,5 h na pewny STOP. Bramka nie odróżnia „SKIP
  przez zewnętrzny limit" od „SKIP przez brak środowiska" i nie ma mechanizmu „odczekaj i powtórz tylko tester".
- **9b run 2** to fałszywy STOP „niezacommitowane zmiany" w klasie, którą plan B2 miał usunąć: brudne były
  wyłącznie pliki `docs/active/<zadanie>/` edytowane przez operatora. Bramka czystości mogłaby traktować katalog
  zadania jak własne artefakty (commit i jazda dalej) zamiast STOP + commit + nowy run.
- **9b run 1**: asercja „przeładuj i sprawdź brak popovera" jest niemierzalna w headless (rAF). Tester poprawnie
  zdiagnozował ograniczenie harnessu, ale walidacja końcowa i tak zażądała naprawy kodu („NIE zmieniaj na [Manual]:
  to ukryłoby znany defekt"). Operator musiał sam uznać, że to nie defekt.

### W5 · Lokalny patch E2E w `oferty-online` ma dziurę w sprzątaniu

`e2e:env-up` (patch) startuje serwis komendą `nohup node apps/server/dist/index.js … & echo $! > /tmp/autopilot-server.pid`,
a `e2e:env-down` (niezpatchowany, linia 528) szuka `/tmp/autopilot-vite.pid`. Skutek: w każdym runie agent sprzątający
melduje „środowisko czyste", a serwer Node zostaje. `/tmp/autopilot-server.pid` z 16.09 nadal leży na dysku (proces
już nie żyje — ktoś go zabił ręcznie lub padł).

### W6 · Drobne

- `fazyUkonczone` w telemetrii liczy fazy ukończone **w tym runie**, nie w zadaniu — wpis `status: OK,
  fazyUkonczone: 1, fazyZadania: 3` (samodzielna run 3) wygląda na porażkę. Analiza pokrycia musi liczyć po
  `raporty[].zrodlo`.
- Agent `stop:commit-artefaktow` (haiku) wpisał `Co-Authored-By` do drugiej linii tematu commita `2c97286`
  (brak pustej linii między tematem a stopką).
- `docs/completed/traferto-membership-emission/` zawiera `…-zadania.md.bak` — plik pomocniczy operatora
  zarchiwizowany razem z zadaniem; `complete` nie filtruje `*.bak`.
- `e2e:env-up` w szablonie nadal opisuje Vite na 5173; komunikaty `naprawa` w STOP-ach `oferty-online` po patchu
  są spójne, ale każdy nowy projekt bez Vite powtórzy ten sam ręczny patch.

## 4. Trzy progi z planu naprawy — liczby po 09.09 (n = 23 fazy z pełnymi metrykami, 6 zadań)

| Próg | Wartość z audytu 06.09 | Teraz | Ocena |
|---|---|---|---|
| 1. Mediana `tokenyEtapy.fix` | 75k (n=7) | **99k** (min 39k, max 161k) | poniżej 120k; trend rosnący, 6 z 23 faz powyżej 120k |
| 2. Efekt dossier | niemierzalny | mierzalny tylko w traferto (`dossier: true`, review 112k przy 1 fazie) | **nadal bez danych** — oferty-online nie ma N3 |
| 3. P1+P2 na fazę (warunek odwrotu B12) | 6,5 | **5** (P3: 9, `poDedupSem` 18) | brak spadku potwierdzonych P1/P2 typu KOD — nie rozdzielać `code-quality` |

Dodatkowo: udział review w koszcie fazy spadł z 66% do **43%**, ale nie przez tańszy review (mediana 245k vs 236k)
— **execute urósł do 242k** (38%). Fazy są większe: 3–4 IU, 600–1 000k tokenów na fazę (9a f4: 988k).

## 5. Weryfikacja N1–N9 realnym runem — stan

| Naprawa | Dowód z runu | Werdykt |
|---|---|---|
| N1 (`P3` w enum stanu) | brak — żaden run na nowej wersji nie wznawiał się z P3 w stanie | niezweryfikowane |
| N2 (przenoszenie findingów po powtórce) | brak — traferto nie miał powtórki; oferty-online nie ma N2 | niezweryfikowane |
| N3 (4 metryki review w stanie i telemetrii) | traferto: komplet w stanie i JSONL | **potwierdzone** |
| N4/N5/N7 (dokumentacja, routing) | — | n/d |
| N6 (`e2eSync` ≤ 200 znaków) | traferto miał `n/a`; oferty-online bez N6 | niezweryfikowane |
| N8 (jeden format nagłówków) | traferto `review-faza-1.md` | **potwierdzone** |
| N9 (`kontrolaFixa.pominiete/bezSladu`) | traferto: `pominiete: [], bezSladu: 0` | **potwierdzone** (ścieżka „zero luk") |

## 6. Odzyskana telemetria

Z komend scribe'a w transkryptach (`~/.claude/projects/*/…jsonl`) odtworzyłem **32 wpisy** z 4 projektów
(lipiec–wrzesień; wpisy z `'$ts'` i bez `projekt` uzupełnione z metadanych transkryptu i oznaczone `tsZrodlo`,
każdy ma pole `odzyskane`). Zapis w **nowym pliku obok oryginału**:

`~/.claude/telemetry/autopilot-runs.odzyskane-2026-09-19.jsonl`

Oryginał nietknięty. Runy sprzed 24.08 (część z 39 w audycie 02.09) nie miały JSON-a w komendzie scribe'a i nie są
odzyskiwalne tą drogą.

## 7. Rekomendacje (kolejność = priorytet)

1. **Telemetria: jeden plik na run zamiast jednego wspólnego pliku.** Scribe pisze `~/.claude/telemetry/runs/<ts>-<projekt>-<zadanie>.json`
   narzędziem `Write` (tak jak stan) i **nie dostaje żadnej komendy modyfikującej istniejące pliki**; analiza
   globuje katalog. Zero `sed -i`, zero `>>` na wspólnym pliku, zero możliwości skasowania historii. Alternatywa
   minimalna: przed dopisaniem `cp` do `.bak-<ts>`, a naprawa błędu = „nie dotykaj pliku, zwróć `zapisano:false`".
2. **Parametryzacja E2E w szablonie** (sonda zdrowia, komenda startu, plik PID/log z `.env.e2e` albo
   `.claude/e2e.json`), potem `/sync-template` w `oferty-online`. Bez tego każde kolejne zadanie w tym projekcie
   (najbliższe: cookie-consent, plan z 19.09) jedzie bez N1–N9, a patch W5 dalej nie sprząta serwera.
3. **Powtórka review po STOP-ie „tylko E2E" = tylko tester.** Gdy `review=pending` wynika z E2E (a nie z blokera
   przed reviewem), uruchamiać wyłącznie `review:e2e` + merge findingów, nie pełny skład. To usuwa ~1,2M tokenów z
   dwóch zadań i nie osłabia niczego — kod miał pełny review w rundzie 1.
4. **Bramka czystości: katalog zadania to własne artefakty.** Brudne wyłącznie `docs/active/<zadanie>/` → commit
   i kontynuacja, nie STOP. Usuwa klasę „fałszywy STOP po edycji operatora".
5. **SKIP przez zewnętrzny limit ≠ bloker.** Tester zwraca powód SKIP-u z kategorią (`limit-zewnetrzny`,
   `srodowisko`, `harness`); dla `limit-zewnetrzny` walidacja końcowa zamiast STOP-u proponuje `[Manual]` z
   uzasadnieniem albo czeka; dla `harness` (rAF, popup OAuth) nie żąda naprawy kodu.
6. **Zbadać, dlaczego review nie zbiega** — jedno zadanie kontrolne: po fixie odpalić review ponownie i zaklasyfikować
   findingi rundy 2 jako „nowe przez fix" vs „istniały w rundzie 1, nie znalezione". Bez tego progi P1/P2 nie mają
   sensu, bo licznik zależy od liczby rund, nie od kodu.
7. Drobne: `complete` pomija `*.bak`; `fazyUkonczone` liczyć po stanie zadania; stopka commita STOP z pustą linią.

## Decyzje operatora do podjęcia

- Czy scalić `autopilot-runs.odzyskane-2026-09-19.jsonl` z oryginałem (zastąpienie 6-liniowego pliku 32-liniowym)?
- Czy parametryzacja E2E (rek. 2) wchodzi przed zadaniem cookie-consent w `oferty-online`?
- `docs/reviews/` w szablonie nadal nieśledzone przez git (pięć plików `??`, w tym ten) — decyzja #3 z planu 03.09
  wciąż otwarta.
