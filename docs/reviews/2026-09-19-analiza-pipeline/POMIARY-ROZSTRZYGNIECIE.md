# Pomiary przed etapem 4 — rozstrzygnięcie (4 pomiary z ETAP2 §3)

**Data:** 2026-09-20. **Kto:** sesja główna (Fable 5.1), skrypty i `claude -p` (sonnet), zero agentów analizujących.
**Dane:** `dane/pomiar1-reguly-subagenci/` (18 + 4 scenariusze, transkrypty, repo testowe `repo-testowe.tgz`), `dane/pomiar2-lint-uwag-B/`,
`dane/pomiar3-bramki/`, `dane/pomiar4-powtorki-review.json`. **Skrypty:** `skrypty/pomiar1_reguly_run.sh`, `pomiar1_reguly_run2_workflow.sh`,
`pomiar2_lint_uwag_bota.py`, `powtorki_review.py`. Środowisko: Claude Code 2.1.278, oferty-online e8f9b97 (585 plików TS/TSX) w osobnym worktree
z doinstalowanym ESLint 10.11 / typescript-eslint 8.70 / react-hooks 7.1 / @vitest/eslint-plugin 1.6 / knip 6.37 / size-limit 14 / Stryker 10.0.

## 0. Cztery odpowiedzi w jednym zdaniu każda

1. **Kontekst subagentów:** reguły `paths:` DZIAŁAJĄ w każdym typie subagenta (Agent tool, `agent()` w Workflow, także pod `omitClaudeMd`), ale wyzwala je
   tylko Read/Edit, nie Bash `cat`, nie Write nowego pliku, nie listowanie; `omitClaudeMd` wycina CLAUDE.md i reguły bez `paths:`; **największa dźwignia to
   allowlista `tools:`: 62k → 11,6k tokenów startu agenta w workspace-template** (żaden z 16 agentów szablonu jej nie ma).
2. **Lint kontra 195 uwag B bota:** przy `plik:linia ±3` ESLint trafia **1 z 97** uwag z numerem linii (0,5%), plus 4 ostrzeżenia bez związku. Uwagi B są
   semantyczne. Bramki mechaniczne gaszą koszyk A (szum) i zapobiegają klasom, ale **nie zastępują review dla koszyka B**.
3. **Czas bramek na 585 plikach:** typecheck 9,9 s, ESLint z regułami typowanymi 23,6 s na zimno / **1,3 s z cache**, knip 1,9 s, size-limit 0,8 s.
   Bramka mieści się w domknięciu fazy bez planu B. Stryker na 3 plikach z commitu fixa: 370 mutantów, **2 min 1 s**, mutation score 80,8%,
   61 przeżytych mutantów (lista dla buildera).
4. **Inter-run agreement:** na NIEZMIENIONYM kodzie powtórka odtwarza ~40–50% findingów i dokłada 8–13 nowych (głównie P3, ale 3 P2 KOD w claude-cron);
   na kodzie ZMIENIONYM fixem powtórka odtwarza 0–1 i daje 14–19 nowych, z czego większość w plikach, które fix właśnie zmienił. „Review nie zbiega" to
   dwa różne zjawiska: niestabilność (~50%) i review kodu naprawczego (nowe defekty po fixie).

## 1. Pomiar 1 — reguły `paths:`, `omitClaudeMd`, kontekst startowy

Repo testowe: CLAUDE.md z markerem, 1 reguła bez `paths:`, 6 reguł z `paths:` (w tym jedna z dwoma globami, dwie nakładające się `src/**` i `src/**/*.tsx`),
2 agenty własne (`pelny`, `goly` z `omitClaudeMd: true`, obie z `tools:` allowlistą). Marker = losowy ciąg; agent może go podać tylko, jeśli go widzi.

| scenariusz | kto | akcja | markery widoczne |
|---|---|---|---|
| s0 | sesja główna | nic | CLAUDE.md, reguła bez paths |
| s1 | główna | Read `src/App.tsx` | + TSX + SRCALL (oba nakładające się globy) |
| s2 | główna | Bash `cat src/App.tsx` | **tylko eager** — reguły paths NIE weszły |
| s3 | główna | Read migracji | + MIG |
| s4 | główna | Write NOWEGO `src/Nowy.tsx` | **tylko eager** — Write nie wyzwala |
| s5 | główna | Read testu + Dockerfile | + TEST + DOCKER (dwa globy działają) + SRCALL |
| s6 | główna | Bash `ls -R` (lista bez otwierania) | **tylko eager** |
| s7 | główna | Edit (po Read) | + TSX + SRCALL |
| s8 | Agent tool `pelny` | Read tsx | CLAUDE.md, bez-paths, TSX, SRCALL — **subagent własny dostaje wszystko jak sesja główna** |
| s9 | Agent tool `goly` (omitClaudeMd) | Read tsx | **tylko TSX + SRCALL** — CLAUDE.md i reguła bez paths wycięte, reguły paths NADAL działają |
| s10/s11 | `pelny` / `goly` | nic | eager / **nic** |
| s12 | Agent tool `general-purpose` | Read migracji | CLAUDE.md, bez-paths, MIG |
| s13 | `goly` | Bash cat migracji | **nic** |
| s15 | Workflow `agent()` domyślny | Read tsx | CLAUDE.md, bez-paths, TSX, SRCALL — **agent() dziedziczy jak Agent tool** |
| s16 | Workflow `agent()` z `agentType: 'goly'` | Read tsx | **tylko TSX + SRCALL** — `omitClaudeMd` działa w Workflow |
| s17 | Workflow `agent()` domyślny | nic | eager |

**Kontekst startowy (tokeny pierwszej tury, z transkryptów):** repo testowe: agent własny z `tools:` 4,2–4,7k; `general-purpose` 44,3k; Workflow domyślny
42,8–53,2k; Workflow `agentType: goly` 4,4k. **workspace-template z pełnym MCP (pomiar 1b, `--agents` inline):** `general-purpose` **62,0k**; `tools: [Read, Bash,
Write, Edit]` **11,6k**; to samo + `omitClaudeMd` **4,5k**; sam `disallowedTools: ["mcp__*"]` 39,3k.

**Rozstrzygnięcie:**
- Dźwignia jest **większa, nie mniejsza**, niż zakładał etap 2, ale leży gdzie indziej: nie w `omitClaudeMd` (−7k tu, −33k w oferty-online), lecz w **allowliście
  `tools:`** (−50k: MCP + opisy narzędzi wbudowanych). W szablonie **żaden z 16 agentów nie ma `tools:`**, a workflow autopilota woła `general-purpose` i agentów
  bez allowlisty. Przy 35 agentach na fazę to ~1,75 M tokenów cache write na fazę tylko za listę narzędzi.
- Warstwowanie wiedzy przez `paths:` **działa w subagentach** — dev-compound może pisać do reguł warunkowych zamiast do CLAUDE.md. Warunek: agent czyta pliki
  **Read**, nie `cat`. To łączy się z hipotezą 7 handoffu (Read zamiast Bash): w trybie „bashFirst strict" reguły warunkowe **nigdy się nie załadują**.
- Reguła o migracjach wejdzie do buildera danych tylko, gdy otworzy plik migracji Read-em; Write nowej migracji jej nie wyzwoli — reguła „nowa migracja" musi
  być w prompcie delegacji, nie w `paths:`.
- `omitClaudeMd` + `tools:` + `skills:` u agentów pipeline'u = start ~4,5k zamiast ~62k. Reguły potrzebne agentowi: krótkie polecenia w prompcie + `paths:`.

## 2. Pomiar 2 — ile z 195 uwag B łapie sam lint

Metoda: dla każdego z 19 PR-ów checkout head sha (z GitHuba), build shared, ESLint na plikach z uwagami B, dopasowanie komunikatu ERROR do `plik:linia ±3`.
Konfiguracja: `dane/pomiar3-bramki/eslint.config.js.txt` (js recommended + recommendedTypeChecked error + strictTypeChecked warn + react-hooks v7
recommended-latest + vitest recommended + prefer-called-with + max-lines 360/60 + no-empty + no-floating-promises + consistent-type-imports).

| | liczba |
|---|---|
| uwag B ocenionych | 200 (w tym 103 **bez numeru linii** — komentarze do pliku, nieporównywalne) |
| z numerem linii | 97 |
| trafienie ERROR ±3 linie | **1** (react-hooks/set-state-in-effect, PR 12, klasa cykl-zycia-react) |
| trafienie WARN ±3 linie | 4 (no-unnecessary-condition, no-undef, no-return-await, require-await — bez związku z treścią uwagi) |
| reguły ERROR odpalone gdziekolwiek w plikach z uwagami B | max-lines-per-function 49, no-unused-vars 8, max-lines 6, set-state-in-effect 4, consistent-type-imports 2, refs 1 |

Klasy z zerem trafień mimo „oczywistego" lintera: pusty-catch 3/3 (sprawdzone ręcznie: PR 9 `offer-images.ts:260` — catch **nie jest pusty**, ma `logger.debug`;
bot zgłosił połknięcie błędu semantycznie, nie składniowo), test-niefalsyfikowalny 0/31 (prefer-called-with odpalił 5× w repo, ale nie na liniach uwag),
brak-timeoutu 0/3 (nie ma reguły ESLint na timeout), ścieżka-błędu 0/12.

**Rozstrzygnięcie:** teza z etapu 2 „część z 195 B to rzeczy, które u bota znajduje linter" **nie potwierdza się na liniach**: bot **nie** znalazł tych 195 uwag
linterami, znalazł je modelem. Bramki mechaniczne mają u nas inną rolę: (a) gaszą koszyk A (progi rozmiaru, styl, 157 uwag) u źródła; (b) **zapobiegają**
klasom, które w kodzie oferty-online realnie występują (11 × set-state-in-effect, 3 × refs, 8 × valid-expect, 5 × prefer-called-with, 4 × no-conditional-expect
w całym repo); (c) zdejmują z agenta code-quality pracę stylistyczną. **Nie uzasadniają kasowania osi review** poza tym, co już postanowiono (performance,
code-quality → lint + fokus zachowaniowy). Liczba „ile osi można skasować" po tym pomiarze: **zero dodatkowych**.

## 3. Pomiar 3 — czas bramek na oferty-online (585 plików)

| bramka | czas | uwagi |
|---|---|---|
| build shared | 1,2 s | |
| typecheck (skrypt projektu: build + 3 × tsc) | 9,9 s | |
| ESLint typed, zimny | 23,6 s | 585 plików, 188 errors (96 max-lines-per-function, 33 błędy parsowania plików poza tsconfig, 16 consistent-type-imports, 11 set-state-in-effect), 1557 warnings (501 no-unused-vars, 315 require-await) |
| ESLint `--cache`, pierwszy bieg | 23,9 s | buduje cache |
| ESLint `--cache`, drugi bieg | **1,3 s** | to jest czas w domknięciu fazy przy cache trzymanym między fazami |
| knip | 1,9 s (cache 0,9 s) | 113 issues — wymaga knip.json (entry pointy, fixture'y) |
| size-limit (dist z builda) | 0,8 s | JS 263 kB gzip, CSS 9,4 kB |
| Stryker, 3 pliki z commitu fixa 417a9fd (use-first-steps, use-screen-tour, use-profile) | **2 min 1 s** (w tym dry run 184 testów 14 s) | 370 mutantów: 299 killed, 61 survived, 10 no-coverage → score 80,8% (83,1% na pokrytych); 4,7 testu na mutanta dzięki `perTest`. Przeżyte: głównie ConditionalExpression/EqualityOperator/BlockStatement w `use-profile.ts:72-94` i `use-first-steps.ts` — dokładnie klasa „gałąź bez asercji". Wymagało wykluczenia **4 czerwonych testów na main oferty-online** (`offer-details-page.test.tsx`, timeouty 1 s) — Stryker odmawia startu przy czerwonym dry runie |
| `supabase db advisors` | **NIE zmierzone** | Docker wyłączony; do zmierzenia przy działającym lokalnym Supabase |

Pułapki wdrożeniowe (kosztowały czas w pomiarze): pnpm izoluje pakiety per workspace — Stryker w `apps/dashboard` nie widzi runnera z roota, plugin trzeba
wskazać **ścieżką do `dist/src/index.js`** (katalog nie działa w ESM); pliki poza `include` tsconfig (scripts/, e2e/, supabase/tests) dają błąd parsowania
przy regułach typowanych — potrzebny `tsconfig.tools.json` w `projectService.allowDefaultProject` albo osobny blok bez typów; `no-undef` na `NodeJS` = brak
`globals.node` w bloku serwera; `strictTypeChecked` jako warn generuje 1,5k ostrzeżeń — w domknięciu fazy liczyć tylko errors.

**Rozstrzygnięcie:** przy cache ESLint + knip + size-limit to **~4 s na fazę**, typecheck 10 s. Plan B (oxlint) niepotrzebny. Pierwsze wdrożenie wymaga tury
wyciszania zastanych naruszeń (188 errors, z czego 96 to długość funkcji). Stryker: **~2 min na 3 pliki** (370 mutantów) — na diffie fazy 10–30 plików
to szacunkowo 5–15 min, więc **nie do każdego domknięcia fazy**; kandydat na krok przed dev-pr lub na pliki testowe dotknięte w fazie (perTest ogranicza
liczbę testów, nie mutantów). Warunek twardy: zielony zestaw testów, a main oferty-online go dziś nie ma.

## 4. Pomiar 4 — inter-run agreement review (6 par runów tej samej fazy)

Dopasowanie: ten sam plik i (|Δlinia| ≤ 3 lub podobieństwo opisu > 0,3). Kod „zmieniony" = commity w repo między startami obu scribe'ów (bez docs/, .claude/).

| zadanie / faza | kod zmieniony między runami | run1 → run2 | powtórzone | nowe (P1/P2/P3) | nowe w plikach zmienionych | nowe P1/P2 KOD w plikach NIEzmienionych |
|---|---|---|---|---|---|---|
| akademia / przypomnienia f3 | NIE | 29 → 25 | 12 | 13 (1/1/11) | — | 0 |
| claude-cron / załączniki f1 | NIE | 5 → 15 | 7 | 8 (0/3/5) | — | **3** (autoryzacja odczytu bajtów, dedup po zapisie, wzorzec URL) |
| oferty / faza-7 f6 | NIE | 22 → 5 | 4 | 1 | — | 1 („NADAL OTWARTE") |
| oferty / 9b f4 | TAK (23 pliki, fix + kontrola) | 21 → 19 | **0** | 19 (1/8/10) | **17/19** | 0 |
| oferty / samodzielna f3, run 2 | TAK (20 plików) | 17 → 14 | 0 | 14 (0/4/10) | 7/14 | 2 (oba: CLAUDE.md rozjechany z kodem po fixie) |
| oferty / samodzielna f3, run 3 | TAK (15 plików) | 14 → 15 | 1 | 14 (0/5/9) | 6/14 | 2 (fetch bez timeoutu; ścieżka powrotu wprowadzona w fixie) |

Zastrzeżenia: run 1 akademii f3 miał findingi „NIEZWERYFIKOWANE — 0 głosów sceptyków"; faza-7 f6 run 2 to powtórka „czy nadal otwarte", nie pełny review;
próba to 6 par, z czego 3 na tym samym kodzie.

**Rozstrzygnięcie:**
- Na tym samym kodzie powtarzalność ~40–50% (12/25, 7/15) — zgodne z literaturą (α 0,33–0,79). Nowe findingi to w 80% P3, ale nie zero P2 KOD.
- Na kodzie po fixie powtarzalność ~0 i **większość nowych findingów dotyczy plików zmienionych przez fix** (17/19 w 9b). To NIE jest niezbieganie review —
  to review **kodu naprawczego**, którego dziś nikt poza kontrolą diffu nie ogląda. Potwierdza decyzję z etapu 1 (nie scalać kontroli z poprawką) i pokazuje,
  że kontrola diffu fixa łapie za mało (3 regresje vs 17 findingów pełnego review w tych samych plikach).
- Dla panelu: „powtórka po STOP-ie E2E = sam tester" stoi, **ale** po fixie z dużym diffem (>15 plików) opłaca się jedna lekka runda (correctness na samym
  diffie fixa), nie pełny skład. Alternatywa z etapu 2 (n=3 równoległe próbki) adresuje tylko składnik „niestabilność", nie składnik „nowy kod".
  **[WYCOFANE 6a pkt 15: żadnej dodatkowej rundy; zamiast tego polecenia-listy correctness w `fix:kontrola`.]**

**Uzupełnienie D1 (2026-09-21, etap 3 L3) — atrybucja 33 nowych findingów po fixie przez `git blame` na linii (skrypt `skrypty/d1_atrybucja_po_fixie.py`,
dane `dane/pomiar5-atrybucja-po-fixie.{json,txt}`):** zdanie „to NIE jest niezbieganie — to review kodu naprawczego" jest **za mocne**. Z 17/19 findingów 9b
„w plikach zmienionych fixem" tylko **7 urodził fix** (wszystkie jako skutek naprawy findingu z rundy 1, w tym jedyny P1: import statyczny → dynamiczny bez bufora),
a **10 istniało przed fixem** w plikach, które runda 1 czytała i w których miała inne findingi. Łącznie 33: **A urodzone w fixie 13 (39%; 10 kod + 3 drift CLAUDE.md),
B przeoczone w rundzie 1 w pliku dotkniętym fixem 14 (42%), C przeoczone w kodzie nietkniętym 6 (18%)**. P1/P2 kodowe: A 4 (1 P1), B 5, C 1. Oba składniki są realne:
składnik A adresuje 6a pkt 15 (polecenia-listy w `fix:kontrola` + mały diff fixa — kontrola diffu nie złapała żadnego z 10 A), składnik B+C (60%, 6 P2) to recall
rundy 1 — rozstrzygnięcie n=3 próbek vs lepszy sceptyk należy do panelu i dotyczy WIĘKSZEGO składnika.

## 5. Co zmienia się w wejściach do etapów 3–4 po pomiarach

1. **Kontekst agentów (twarde):** każdy agent pipeline'u dostaje `tools:` allowlistę (−50k/agent) + `omitClaudeMd: true` + reguły przez prompt delegacji
   i `paths:`; buildery i reviewerzy czytają **Read**, nie `cat` (inaczej `paths:` martwe). Szacunek: 35 agentów × ~57k × 1,25 = ~2,5 M jednostek cache write
   na fazę z 21,8 M → **~11% fazy z samego startu**, plus mniejszy kontekst w każdej kolejnej turze (to jest te 30–40%).
2. **Bramki mechaniczne (twarde):** ESLint z cache + knip + size-limit + typecheck ≈ 15 s. Rola: koszyk A + prewencja + odchudzenie code-quality. **Nie** kasują
   kolejnych osi — pomiar 2 zamyka ten wątek.
3. **Review (do panelu):** składnik „nowy kod po fixie" wymaga lekkiego review diffu fixa (correctness, sam diff), składnik „niestabilność" — decyzja panelu
   między n=3 próbek a jedną rundą z lepszym sceptykiem.
4. **Nie zmierzone (zostaje):** `supabase db advisors` (Docker), Stryker na klasie „atrapa bez argumentów" i na Zod, kill rate sceptyka asymetrycznego,
   run kontrolny „1 reviewer vs 6 osi".
