# Dane wejściowe do analizy pipeline'u dev-* (zebrane deterministycznie 2026-09-19, wersja 2 — po korekcie liczenia tur)

KOREKTA v2: w wersji 1 jedna odpowiedź API (thinking + text + tool_use) była liczona jako 2–3 tury, co zawyżało liczby
bezwzględne ~2,5×. Udziały procentowe per rola/etap się NIE zmieniły. Poniżej liczby poprawione.

Wszystkie liczby policzone skryptami z transkryptów agentów (`~/.claude/projects/*/…/subagents/workflows/wf_*/agent-*.jsonl`),
journali workflowów i sesji głównych. Pliki źródłowe (ten sam katalog co ten plik):
`agents.csv` (2 941 agentów, 1 wiersz = 1 agent), `koszt_tabele.txt`, `kontekst_1_tury.txt`, `koszt_skilli.txt`, `skille.csv`,
`koszt_zadan.txt`, `przezywalnosc_osi2.txt`, `findingi-per-os/<os>.json`, `telemetria-odzyskana-wszystko.json`.

## 0. Definicja kosztu i jego skład

Jednostka = ekwiwalent tokena wejściowego (cennik Anthropic): input ×1, cache write ×1,25, cache read ×0,1, output ×5.
Suma wszystkich runów (5 projektów, 2 941 agentów, **45 870 tur**): **1 179 M jednostek**.
Skład: **cache read 59%** (6 938 M tokenów × 0,1), **cache write 39%** (367 M × 1,25), **output 2%** (5,2 M × 5).
Wnioski: (1) koszt = liczba tur × rozmiar kontekstu; tokeny wyjściowe (jedyne, które mierzyła telemetria) to 2% kosztu;
(2) cache write to w 65% **pierwsza tura każdego agenta** = „opłata za powołanie agenta" ~107k tokenów × 1,25 ≈ 134k jedn.,
czyli **22% całego kosztu** to samo powoływanie agentów (35 agentów na fazę). Cache wygasania nie ma (odstępy między turami ~1 s).

## 1. Koszt per rola (wszystkie runy; udział w 1 179 M)

| rola | agentów | tur/agent (p50) | udział | koszt/agent |
|---|---|---|---|---|
| build (execute IU) | 177 | 39 (p90 83) | 18,3% | 1 220k |
| fix (pętla naprawcza) | 116 | 37 (p90 109) | 11,8% | 1 200k |
| verify (sceptyk 1 finding, 3 na P1) | 575 | 7 | 7,3% | 150k |
| review:test-coverage | 81 | 26 | 4,9% | 718k |
| review:spec-compliance | 81 | 25 | 4,9% | 718k |
| domknięcie fazy | 74 | 31 | 4,0% | 636k |
| review:security | 81 | 19 | 3,9% | 561k |
| review:performance | 78 | 15 | 3,1% | 468k |
| verify-batch (sceptyk P2 per plik) | 163 | 5 | 2,9% | 207k |
| review:correctness (nowa oś od 09.09) | 36 | 30 | 2,8% | 931k |
| stan:zapis (haiku pisze JSON) | 269 | 5 | 2,8% | 122k |
| scribe (raport review) | 84 | 14 | 2,7% | 373k |
| review:e2e | 58 | 23 | 2,5% | 500k |
| review:simplicity (stara, do 09.09) | 66 | 14 | 2,3% | 408k |
| planner fazy | 79 | 8 | 1,6% | 239k |
| kontekst:diff (packager dossier) | 81 | 8 | 1,6% | 230k |
| review:typescript / architecture (stare) | 40 / 43 | 18 / 15 | 1,5% / 1,5% | 442k / 404k |
| review:code-quality (nowa, scalona) | 15 | 25 | 1,1% | 896k |
| e2e:db-sync | 55 | 11 | 1,1% | 238k |
| fix:poprawka / fix:kontrola / fix:pre-skan | 14 / 18 / 18 | 37 / 15 / 22 | 0,8 / 0,5 / 0,5% | 710k / 338k / 302k |
| dedup:semantyczny (haiku) | 80 | 1 | 0,7% | 104k |
| bootstrap, complete, walidacja-koncowa, env-up, warmup, compound, zwin, telemetria, smoke, compound-refresh, precheck | | | 0,3–0,7% każda | 100–400k |

oferty-online po 06.09 (817 agentów, 23 fazy, **35,5 agentów i 740 tur na fazę**): build 22,7%, fix 15,4%, test-coverage 5,4%,
correctness 5,1%, spec 4,8%, verify-batch 4,6%, security 4,0%, domknięcie 4,0%, performance 3,0%, e2e 3,0%, stan:zapis 2,6%,
scribe 2,6%, code-quality 2,6%, kontekst:diff 1,5%. Sześciu reviewerów razem ≈ 25%, sceptycy ≈ 6%, mechanika review
(packager+dedup+scribe) ≈ 5%, pętla fix ≈ 17%, execute (planner+build+domknięcie) ≈ 28%, orkiestracja+e2e-env+zakończenie ≈ 12%.

Per workflow: dev-autopilot 70%, dev-docs-review-wf (samodzielne review) 12%, dev-docs-execute-wf 9%, dev-pr 0,7%, complete-wf 0,3%,
compound-wf 0,2%. Per model: opus 90%, haiku 6% (530 agentów), fable 4%.

## 2. Koszt zadania end-to-end (oferty-online, wrzesień) — `koszt_zadan.txt`

| zadanie | runy | h zegara | RAZEM M jedn. | skille przed/po (M) | exec | review | verify | fix | e2e-env | orkiestr. | zakończ. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| faza-8 (6 faz) | 3 | 13,5 | 128 | 3,3 | 28% | 35% | 6% | 21% | 2% | 3% | 2% |
| faza-9c (3 fazy) | 2 | 3,8 | 33 | 1,6 | 22% | 36% | 5% | 12% | 5% | 9% | 6% |
| faza-9a (4 fazy) | 1 | 9,2 | 109 | 3,1 | 36% | 34% | 5% | 15% | 2% | 3% | 3% |
| faza-9b (4 fazy) | 3 | 12,8 | 144 | 5,3 | 32% | 31% | 9% | 18% | 2% | 3% | 2% |
| samodzielna-rejestracja (3 fazy) | 3 | 7,6 | 83 | 2,2 | 21% | 38% | 4% | 21% | 3% | 6% | 4% |
| traferto (akademia, 1 faza) | 1 | 0,9 | 15 | 0,6 | 24% | 31% | 3% | 16% | 1% | 8% | 12% |

Jedna faza autopilota ≈ **25–36 M jednostek**. Skille w sesji głównej (dev-prep, dev-brainstorm, dev-plan, dev-docs, dev-pr,
dev-compound) to łącznie **2–5% kosztu zadania**. Koszt epizodu (`koszt_skilli.txt`): dev-plan 0,93 M (17 tur, 1,7 subagenta, 47 min
z człowiekiem), dev-docs 0,71 M (13 tur, 67 min), dev-prep 0,62 M (16 tur, 101 min), dev-compound 0,43 M, dev-brainstorm ~0,4 M,
dev-pr ~0,3 M. Kontekst sesji głównej przy dev-plan: 323k (p50 ctx_max) — sesja główna jest „gruba", każda tura tam kosztuje 32k jedn.
Scalenie dev-plan+dev-docs oszczędza czas operatora (~1–2 h przekazań) i jedno „przepisanie", nie tokeny autopilota.

Artefakty (rozmiar): plan techniczny z dev-plan **57–137 kB** (285–563 linii treści); zadania z dev-docs 29–69 kB, z czego
**22–46% treści to prawie dosłowne kopie planu**; kontekst 9–23 kB; plan faz 4–5 kB. Builder dostaje IU w prompcie (~9,7k znaków)
i czyta plan/zadania wycinkami; reviewer dostaje dossier.

## 3. Stały narzut kontekstu — `kontekst_1_tury.txt`

Kontekst PIERWSZEJ tury agenta (zanim cokolwiek przeczyta): p10/p50/p90 = 58k/76k/113k (verify), 85k/118k/159k (build),
70–72k/95–97k/130–134k (reviewerzy), 47k/67k (stan:zapis haiku). Per projekt p10: oferty-online 67k, claude-cron 78k, akademia 83k,
Nawykometr 43k. Trend: sierpień p50 77k → wrzesień 101k.

Skład (attachmenty jednego agenta review w 9b, znaki): `instructions` (łańcuch CLAUDE.md + rules) 132k zn ≈ 33k tok,
`prompt_snapshot` (system prompt z opisami agentów, przykładami) 174k zn ≈ 44k tok, `deferred_tools_delta` (nazwy ~900 narzędzi MCP)
109k zn ≈ 27k tok, `skill_listing` (opisy ~300 skilli, w tym ~200 posthog) 42k zn ≈ 10k tok.
Rozrost instrukcji projektu oferty-online: CLAUDE.md 3,4k zn (22.08) → 89,7k zn (17.09); `.claude/rules/learned-patterns.md`
0 → 47k zn; coding-rules 11k. Razem ~37k tokenów wstrzykiwanych do KAŻDEJ tury KAŻDEGO agenta. Źródłem rozrostu jest
dev-compound (reguły do CLAUDE.md i learned-patterns). Akademia: 55k + 54k + 11k zn.

Udział „kontekst startowy × tury × 0,1" w koszcie całkowitym: **40%**; czysty stały narzut (p10 projektu, bez promptu zadania): **26%**.
Do tego „opłata za powołanie" (1. tura, cache write): **22%**. Razem ~50–60% kosztu to kontekst, którego agent nie potrzebował do zadania.

## 4. Tury i narzędzia — `koszt_tabele.txt` (ROZKŁADY) i mix narzędzi

build: 39 tur/agent (p50; p90 83, max 136), 50 wywołań narzędzi: **37 Bash, 2 Read, 6 Edit, 3 Write**; kontekst średni 176k (p90 261k), max 204k.
fix: 37 tur (p90 109), 53 narzędzi (40 Bash, 8 Edit). reviewer: 15–30 tur, 18–31 narzędzi (13–27 Bash, 3 Read). verify: 7 tur / 9 narzędzi.
Komendy Bash builderów+fix w runie 9b (n=1 413): **czytanie/grep 1 098 (78%)**, testy 158, typecheck 45, zapis przez shell 40, git 38.
Tryb auto z „bashFirst: strict" — agenci czytają pliki przez cat/sed/grep zamiast Read, po kawałku; każda komenda = tura = ponowny odczyt
całego kontekstu (~150–200k × 0,1 = 15–20k jedn. za turę). Thinking: build 7k tok/agent, reviewerzy 7–11k, verify 2k.
Agentów na fazę: 35,5 (2,1 buildera, 8,8 sceptyków, 3,2 stan:zapis, 6–7 reviewerów, 1 packager, 1 dedup, 1 scribe, 1 fix, 1 pre-skan,
1 kontrola, ~1 poprawka, 1 zwiń, 1 planner, 1 domknięcie, 1 db-sync).

## 5. Review: wartość findingów — `przezywalnosc_osi2.txt`, `findingi-per-os/*.json`

Potwierdzone (po dedup + verify; z promptów 84 scribe'ów, wszystkie runy) per oś, P1/P2/P3:
security 9/122/134 (265), test-coverage 7/81/114 (202), performance 7/71/105 (183), code-quality 1/36/99 (136, od 09.09),
spec-compliance 10/58/64 (132), architecture 3/28/58 (89, do 09.09), correctness 4/39/38 (81, od 09.09), typescript 1/25/49 (75, do 09.09),
e2e 1/13/51 (65), simplicity 1/5/49 (55, do 09.09). Typy: KOD 977, TEST 287, OPERATOR 291, E2E 51.
Runy z etykietami (15 faz): zgłoszone 391 → po dedup+verify 269 (−31%). Dedup semantyczny: 11,7 findingów w 4,5 grupach na fazę.
Verify (sceptycy): werdykt `realny` True 94 / False 13 / null 5 (**12% obalonych**); korekty severity 64 (P3 16, P2 39, P1 9) — sceptyk częściej PRZEKLASYFIKOWUJE niż obala.
Pętla fix (15 faz): P1 5, P2 82, P3 138 → naprawione 221 = **98% wszystkich, łącznie z P3**. nierozwiązane P1 0, P2 1.
Review nie zbiega: powtórka review tej samej fazy po STOP-ie „tylko E2E" daje 12–18 nowych pozycji (9b f4 ×2, samodzielna f3 ×3).
Co znajduje CodeRabbit PO naszym review: 19 wpisów w `oferty-online/docs/solutions/*/` z „bota" w treści, m.in.
`2026-09-17-klasy-z-istniejaca-regula-wracaja-po-naszym-review-…`, `2026-09-13-straznik-negatywny-bez-badanej-zaleznosci-…`;
audyt 02.09: 127 komentarzy bota w 6 PR-ach, 14 commitów ręcznych tur.

## 6. Przebieg runów po 06.09 (raport `docs/reviews/2026-09-19-przeglad-runow-po-naprawie.md` w workspace-template)

13 runów, 5 zadań domkniętych, 3 z 5 wymagały 2–3 runów. Przyczyny STOP: E2E FAIL na niemierzalnej asercji (9b), E2E SKIP przez limit
mailera stagingu (samodzielna ×2), P1 nierozwiązane po fixie (9c), fałszywy STOP „niezacommitowane" po edycji operatora w docs/active (9b),
execute `blocked` przez próg gzip (faza-8). Scribe telemetrii (haiku) skasował globalny plik JSONL dwa razy (`sed -i`).
oferty-online NIE ma napraw N1–N9 z 06.09 (sync zablokowany lokalnym patchem E2E). Stan i telemetria pisane przez agentów haiku
(269 agentów stan:zapis = 2,8% kosztu; `.autopilot-state.json.bak` z uszkodzonym JSON-em po ręcznej edycji).

## 7. Inwentarz maszynerii (workspace-template/.claude)

Skille dev-*: 12 plików SKILL.md, 3 574 linii (dev-plan 867, dev-compound 459, dev-compound-refresh 413, dev-ideate 403,
dev-brainstorm 344, dev-prep 258, dev-pr 184, dev-docs 183, dev-docs-complete 143, dev-docs-review 130, dev-docs-update 107, dev-docs-execute 83).
Workflowy: dev-autopilot-wf.js 1 781 linii, dev-docs-review-wf.js 1 392, dev-pr-wf.js 454, freshness-audit-wf.js 295,
dev-docs-execute-wf.js 278, dev-docs-complete-wf.js 185, dev-compound-wf.js 77. Testy: 7 plików, 74 testy.
Agenci: 16 plików (2 244 linii): security-sentinel 191, performance-oracle 153, kieran-typescript-reviewer 139, architecture-strategist 127,
code-simplicity-reviewer 101, spec-compliance-reviewer 64, feature-tester-e2e 96, feature-builder-{ui,data,fullstack} 107/105/123,
repo-research-analyst 295, learnings-researcher 259, web-research-specialist 138, best-practices-researcher 126, framework-docs-researcher 115, spec-flow-analyzer 105.
Reguły: coding-rules.md 216 linii. Hooki: Stop (stop-build-check-enhanced.sh), error-handling-reminder.sh. Templates: e2e-env, smoke-autopilot.
Ścieżka procesu: dev-brainstorm → dev-prep → dev-plan → dev-docs → dev-autopilot-wf (bootstrap → e2e:precheck/env-up → warmup →
per faza: planner → build×IU → domknięcie → stan:zapis → e2e:db-sync → kontekst:diff → 6 reviewerów + e2e → dedup → verify/verify-batch →
scribe → stan:zapis → fix → pre-skan → kontrola → poprawka → zwiń → stan:zapis) → walidacja-koncowa → env-down → compound →
compound-refresh → smoke-operatora → complete → telemetria) → dev-pr (bot CodeRabbit, tury napraw, compound).
Ograniczenie platformy: skrypt Workflow nie ma fs/Bash (tylko agent/parallel/pipeline/phase/log/budget) — stąd agenci haiku piszący stan i telemetrię.

## 8. Wcześniejsze audyty (workspace-template/docs/reviews/)

`2026-09-02-audyt-pipeline.md` (39 runów; review = 66% tokenów WYJŚCIOWYCH; P3 741 wygenerowanych, 0 naprawionych — od 03.09 P3 są naprawiane;
fałszywe STOP-y), `2026-09-03-plan-naprawy.md` (Tury A/B/C), `2026-09-06-audyt-powdrozeniowy.md`, `2026-09-19-przeglad-runow-po-naprawie.md`.
