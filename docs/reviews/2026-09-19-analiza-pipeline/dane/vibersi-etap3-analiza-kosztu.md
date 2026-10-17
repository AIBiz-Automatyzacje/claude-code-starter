# Analiza: koszt /dev-plan i wzrost kosztu runu autopilota (vibersi, etapy 1–3)

Data: 2026-10-15 (6a pkt 86 h). Tylko odczyt. Skrypty: `skrypty/vibersi-etap3/` (`ep.py`, `delta.py`, `sub.py`, `role.js`, `agentan.py`),
epizody: `dane/vibersi-etap3-devplan-epizody.txt`. Koszt w jednostkach jak w telemetrii (cache_r × 0,1 + cache_w × 1,25 + out × 5 + in).

## Wniosek

**A. /dev-plan:** prawdziwy koszt rośnie 3,40 → 4,30 → 6,89 M (etap 1 → 2 → 3). Etap-2-poprawki (wariant Lekki) kosztował 0,78 M, a nie 2,91 M:
telemetria nie zamyka epizodu na wywołaniu Workflow i dolicza pracę po runie. Przyrost w etapie 3 ma trzy źródła, z których dwa to narzut procesu:
1. **Odziedziczony kontekst.** `/dev-plan` ruszył w sesji, która miała już 215k tokenów z `/dev-prep` i propozycji makiet (105 tur, 2,32 M przed epizodem).
   Każda z 48 tur ciągnęła ten balast, co kosztowało ok. 1,0 M (48 × 215k × 0,1).
2. **Agent SPEC Figmy:** 2,07 M w etapie 2 i 2,26 M w etapie 3, czyli ok. 60% kosztu subagentów. Miał 81–91 tur, 25 zrzutów w kontekście, kontekst do 414k.
3. **Rozmiar etapu:** plan 72 → 86 → 95 KB, 11 → 12 → 13 IU, 4 agenty researchu dla nowej domeny auth (0,78 M). To normalne skalowanie.

**B. Run autopilota +18,8 M (38,6 → 57,4 M):** mniej więcej po połowie skalowanie i narzut. Praca: execute +37% plików i +17% linii,
fix +85% linii, P1+P2 +11%. Koszt: build +67%, fix +79%. Trzy największe źródła:
1. **Builder +9,2 M:** na IU 1,14 → 1,76 M, na 1000 linii 1,10 → 1,58 M. Tury 43 → 60, ctx_sr 146k → 166k, ctx_max 204k → 243k.
   Kontekst puchnie od czytania całych plików przez `cat`/`sed` (35–48% wejścia), pełnego SPEC.md Figmy (47 KB), 3–8 zrzutów makiet i wejść
   Write (13–19%). Wyniki testów to tylko 4–7%.
2. **Fix +5,3 M:** na finding 0,11 → 0,18 M. Jeden agent naprawia 12–20 findingów w jednym rosnącym kontekście (ctx_max 264k, 75 tur).
   Findingi test-coverage zmuszają do pisania testów (73% linii fixa to testy). Pętla red-green: 17,8 biegu vitest na agenta wobec 7,7,
   z czego 34 z 70 biegów celowanych padły.
3. **Sceptycy +1,2 M** (grupy P2 po pliku, P19 pkt 8) i **fix:poprawka +1,1 M** (czyta pełny diff fixa, 50k zn).

## A. /dev-plan — epizody

| epizod | etap | sesja | ctx przed | tury | ctx śr | koszt sesji (do Workflow) | subagenci | razem | plan |
|---|---|---|---|---|---|---|---|---|---|
| e1a | 1 (research) | 81e81c7f | 219k | 27 | 294k | 1,06 M | 0,97 M (5 research) | | |
| e1b | 1 (plan) | 6a039663 | 0 | 38 | 173k | 1,37 M | 0 (figma design-to-code w sesji) | **3,40 M** | 72 KB, 11 IU |
| e2 | 2 | d4ba5a5a | 0 | 40 | 172k | 1,44 M (tel. 2,06 — +0,62 po Workflow) | 2,86 M | **4,30 M** | 86 KB, 12 IU |
| e2p | 2-poprawki (Lekki) | ece73440 | 159k | 20 | ~200k | 0,78 M (tel. 2,91 — +2,14 po Workflow) | 0 | **0,78 M** | 19 KB, 6 IU |
| e3 | 3 | 8b09672c | **215k** | 48 | **353k** | 3,02 M | 3,88 M | **6,89 M** | 95 KB, 13 IU |

Źródła: rekordy `typ: skill` w `~/.claude/telemetry/pipeline.jsonl`, `ep.py`, podział przed i po Workflow skryptem inline (sesje jsonl).

**Etap 3, sesja główna:** cache_r 16,3 M → 1,63 M, cache_w 0,69 M → 0,86 M, out 105k → 0,53 M.
- Kontekst na starcie 233k, na końcu 467k (`delta.py`).
- Wyniki pięciu subagentów wróciły jako wiadomości tekstowe 13,7–20,0k zn każda, razem ok. 87k zn.
- Zapis planu jednym Write to 52 652 tokeny wyjścia w jednej turze (21:05:35, +52,8k kontekstu).
- Zapytania do operatora: AskUserQuestion 3×. `plan.mjs sprawdz`: 2 przebiegi, 1 odrzucenie (4 błędy, w tym 2 budżetu).

**Etap 3, subagenci** (`sub.py`; koszt liczony moim przelicznikiem 3,16 M, telemetria 3,88 M):

| agent | tury | ctx max | koszt | narzędzia |
|---|---|---|---|---|
| general-purpose „Figma SPEC etapu 3” | 81 | 414k | 2,26 M | get_screenshot 25, get_design_context 26, Bash 59 |
| repo-research-analyst | 20 | 126k | 0,33 M | Bash 21 |
| framework-docs-researcher | 31 | 63k | 0,20 M | WebFetch 14 |
| learnings-researcher | 11 | 88k | 0,17 M | |
| spec-flow-analyzer | 6 | 76k | 0,12 M | |
| best-practices-researcher | 12 | 42k | 0,08 M | |
| (etap 2) Figma „Pobranie makiet” | 91 | 310k | 2,07 M | get_design_context 39, get_screenshot 13 |

**Anomalie:**
- Długi kontekst z `/dev-prep` ciągnięty przez cały epizod; było tak w e1a, e2p i e3.
- Agent Figmy ogląda zrzuty w kontekście, choć SPEC potrzebuje głównie danych z get_design_context.
- Epizod telemetrii zostaje „otwarty” i połyka pracę po Workflow (e2 +0,62 M, e2p +2,14 M). Przez to próg karty P13 (2,95 M) porównywany był na zawyżonych danych.
- Research dla nowej domeny auth (0,78 M) jest uzasadniony i nie jest anomalią.
- Uwaga poboczna: sesja dev-plan e3 wypisała wartość `E2E_TEST_EMAIL` z `.env.e2e` (`grep … | cut -d= -f2`).

**Propozycje (szacunek przy skali etapu 3):**
1. `/dev-plan` zawsze w świeżej sesji: `/clear` po `/dev-prep` i makietach. Skill i checklista przygotowania mówią to wprost, a raport §6 flaguje
   `pierwsza_odpowiedz_jedn` > 0,2 M. Oszczędność ok. **1,0 M** na etap.
2. Agent SPEC Figmy bez zrzutów w kontekście (PNG zapisywane do plików, nie oglądane) i podzielony na 2–3 agentów po kilka ekranów
   (kontekst ≤ 120k zamiast 414k). Oszczędność ok. **1,0–1,4 M**.
3. Telemetria: koniec epizodu dev-plan na wywołaniu Workflow albo na `plan.mjs gotowosc`. To nie oszczędza tokenów, tylko poprawia pomiar
   (e2p 2,91 → 0,78 M, e2 2,06 → 1,44 M).
4. Plan zapisywany sekcjami (Write szkieletu, potem Edit per faza) zamiast jednego Write 52k: mniejszy skok kontekstu na ostatnich turach.
   Oszczędność mała, ok. 0,05–0,1 M.

## B. Run autopilota — rozmiar pracy kontra narzut na jednostkę

**Rozmiar pracy** (git w vibersi, bez `docs/`, obrazów i lockfile; etap 2 = `bdd35ce..1457e5d`, etap 3 = `main..feature/etap-3-konto-i-auth`):

| | etap 2 | etap 3 | Δ |
|---|---|---|---|
| execute: pliki / linie + | 119 / 12 416 | 163 / 14 504 | +37% / +17% |
| fix: pliki / linie + (udział testów) | 74 / 2 617 (65%) | 104 / 4 848 (73%) | +41% / +85% |
| potwierdzone P1+P2 | 62 | 69 | +11% |
| IU | 12 | 13 | +8% |

**Narzut per rola** (`role.js`, rekordy agent; e1 = `wf_b60193c7-987`):

| rola | e1 koszt/agent, tury, ctx_sr | e2 | e3 |
|---|---|---|---|
| build | 0,49 M, 27, 70k | 1,14 M, 43, 146k (max 204k) | **1,76 M, 60, 166k (max 243k)** |
| fix | 0,55 M, 25, 71k | 1,12 M, 53, 133k (max 187k) | **2,00 M, 75, 179k (max 264k)** |
| fix:poprawka | 0,18 M, 16, 38k | 0,17 M, 15, 44k | **0,36 M, 27, 76k** |
| fix:kontrola | 0,14 M | 0,18 M | 0,23 M |
| review:test-coverage | 0,18 M | 0,30 M | 0,36 M |
| review:correctness | 0,16 M | 0,32 M | 0,34 M |
| verify-batch | 0,03 M × 8 | 0,05 M × 19 | 0,03 M × 61 |

**Biegi narzędzi** (Bash w transkryptach):

| | e2 | e3 |
|---|---|---|
| vitest na agenta fix | 7,7 | 17,8 |
| vitest na agenta build | 7,2 | 11,0 |
| vitest na agenta poprawki | 2,2 | 4,7 |

W e3 biegi vitest fixa: 70 celowanych (34 z błędem), 37 pełnych (5 z błędem). U buildera: 98 celowanych (33 z błędem) i 45 pełnych.

**Skąd puchnie kontekst** (`agentan.py`; znaki wyników narzędzi i wejść Edit/Write):

| agent | tury | ctx start → koniec | odczyt plików Bash (cat/sed) | Read .claude* | wejścia Write | zrzuty | figma | vitest |
|---|---|---|---|---|---|---|---|---|
| build:IU-6 (3,72 M) | 99 | 50k → 353k | 148k zn, 35× (35%) | 96k (23%) | 81k (19%) | 3 | 30k | 20k (4%) |
| build:IU-9 | 79 | 60k → 302k | 190k zn, 42× (48%) | 11k | 51k (13%) | 8 | 24k | 30k (7%) |
| build:IU-8 | 81 | 48k → 276k | 135k zn, 34× (39%) | 59k (17%) | 63k (18%) | 5 | 21k | 14k (4%) |
| fix:faza-4 | 106 | 32k → 345k | 207k zn, 39× (48%) | 112k (26%) | 63k (14%) | — | — | 19k (4%) |
| fix:faza-3 | 91 | 29k → 286k | 231k zn, 39× (72%) | 11k | 21k | — | — | 14k |
| fix:poprawka:faza-4 | 30 | 21k → 96k | 19k | 11k | — | — | — | 5k; **git diff 51k (51%)** |

\* „Read .claude” to `rules/coding-rules.md` (11,1k zn, czytany 19× w build+fix, zgodnie z P16) oraz **przetrwałe wyniki > 30k zn czytane w całości**
(`tool-results/*.txt` po `cat` wielu plików naraz albo pełnym `git diff`): 8 w e3 (33–48k zn każdy) wobec 3 w e2.
Builderzy czytają też cały `SPEC.md` Figmy (etap 3: 46 961 B; IU-6 `cat docs/plans/etap-3-konto-i-auth-figma/SPEC.md`).

**Trzy największe źródła i ocena:**

1. **Builder +9,2 M — w połowie skalowanie, w połowie narzut.** Pliki +37%, ale koszt na 1000 linii +43%.
   Rosną IU (prompt 10–20k zn), rośnie udział buildów Figmy (8/13, w tym 2 fullstack-figma ze startem 58–60k).
   Na każdą turę pracują całe odczytane pliki, SPEC i zrzuty, a koszt rośnie z kwadratem liczby tur.
   - Pełny SPEC zamiast sekcji ekranów IU: ok. 13k tok × 60 tur × 8 builderów ≈ **0,6 M**.
   - Reguła odczytu zakresami (`sed -n`/`grep -n`, bez `cat` 5–9 plików naraz, bez czytania przetrwałych wyników w całości).
   - Budżet IU w `plan.mjs sprawdz` (np. > 8 plików kodu albo > 1500 linii → wydzielenie; dziś `wydzielenia: 0`).
2. **Fix +5,3 M — głównie narzut.** Linii fixa +85%, ale kontekst agenta rośnie do 264–345k, bo jeden agent bierze wszystkie findingi fazy
   (12–20, w fazie 4 33 pliki), a red-green testów (17,8 biegu vitest) odbywa się w pełnym kontekście.
   - Fix porcjami po pliku lub grupie 4–6 findingów, każda porcja w świeżym kontekście (jak sceptycy).
   - Koszt ∝ tury × ctx_sr; przy trzech porcjach ctx_sr spada mniej więcej o połowę, oszczędność ok. **35–45% etapu fix (≈ 4–5 M przy skali e3)**. Do potwierdzenia pilotem.
3. **Sceptycy +1,2 M** (decyzja P19 pkt 8, obalenia nadal 1,4%) i **fix:poprawka +1,1 M**.
   - Sceptycy: porcje po 4 posortowane po pliku.
   - fix:poprawka: dostaje diff tylko plików z pozycji K, nie pełny diff fixa (51% wejścia); oszczędność ok. 0,5 M.

Wyniki testów, Strykera i vitest nie są źródłem puchnięcia (4–7% wejścia). Kontekst startowy ról poza builderem jest stabilny (e2 → e3 0 do +17%).
