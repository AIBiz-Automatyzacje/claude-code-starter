# PROMPT-AUDIT — maszyneria szablonu pod Opus 5.5 i Haiku 4.5

**Data:** 2026-09-23/24. **Status:** raport + proponowany diff, **nic nie naniesione** w `.claude/` ani CLAUDE.md. **ZAAKCEPTOWANY W CAŁOŚCI 2026-09-24 (HANDOFF 6a pkt 25)** — prompty maszynerii są odtąd osobnym obszarem zmian szablonu (PANEL-WEJSCIE §10 „Obszar: prompty”, §2a; mapa walidacji §7), wdrażanym w iteracjach etapu 5 i audytowanym ponownie przy każdej zmianie modelu.
**Wersja dla operatora:** `PROMPT-AUDIT-DLA-OPERATORA.md`. **Diff:** `dane/pa-proponowany.diff` (62 hunki, 21 ustaleń, mapa hunk → ustalenie w nagłówku pliku).
**Dane i skrypty (zero agentów):** `skrypty/pa_inwentarz.py` → `dane/pa-inwentarz.txt`, `dane/pa-sygnaly.{txt,json}`; `skrypty/pa_wywolania.py` → `dane/pa-wywolania-rol.txt`; kontrola w obie strony `skrypty/pa_kontrola.py` → `dane/pa-kontrola.txt`.
**Metoda:** przewodnik `claude-api` → `shared/prompt-audit.md` (Step 0–6) + `shared/model-migration.md` → Migrating to Claude Opus 5.5 i Behavioral shifts Opus 5 (nazwani kandydaci do re-testu).

## 0. Założenia (Step 0 — przyjęte bez pytania, do poprawienia przez operatora)

1. **Zakres.** Wszystko, co trafia do modelu jako tekst z szablonu, poza koszykiem do usunięcia:
   - skille w zakresie: 19 SKILL.md (5 055 linii) + 41 plików referencyjnych, które skille czytają na żądanie (20 103 linie);
   - 16 plików agentów (2 244 linie); stringi promptów w 6 workflowach (4 167 linii JS); `rules/coding-rules.md`; 2 hooki Stop (komunikaty na stderr przy exit 2); `templates/` (7 plików);
   - **CLAUDE.md:** szablon nie ma własnego CLAUDE.md w korzeniu (CLAUDE.md należy do projektu docelowego). Do każdego agenta trafia globalny `~/.claude/CLAUDE.md` (253 zn, „Pisz zawsze po polsku” + blok graphify) — odnotowany jako PA-42. `output-styles/adhd.md` poza zakresem (nie wymieniony przez operatora).
   - **Pominięte (6a pkt 20, do usunięcia):** code-review, code-quality, gemini, dev-docs-update, bugfix, dev-ideate, freshness-audit + `freshness-audit-wf.js`, tryb ręczny dev-docs-execute / dev-docs-review. Uwaga: SKILL.md dev-docs-execute i dev-docs-review czytają dziś agenci w runie (`dev-docs-execute-wf.js:118,179`, `dev-docs-review-wf.js:698`) — przy przenoszeniu ich treści do workflowów trzeba je przejść tą samą listą wzorców. `kieran-typescript-reviewer.md` i `code-simplicity-reviewer.md` przeczytane pobieżnie — są na liście do usunięcia (6a pkt 18 L14), stąd PA-36.
   - Pełny inwentarz z rolami czytającymi każdy plik: `dane/pa-inwentarz.txt`.
2. **Model docelowy per rola.** Opus 5.5 (`claude-opus-5-5`): sesja główna, wszyscy agenci z `model: inherit` i każde `agent()` bez `model`. Haiku 4.5: 9 ról z `model: 'haiku'` — `stan:zapis`, `telemetria`, `stop:commit-artefaktow`, `e2e:precheck`, `fix:pre-skan`, `zwin-do-poprawy`, `e2e:env-down` (autopilot), `dedup:semantyczny`, `scribe:…:inspekcja` (review). Każde ustalenie ocenione względem modelu, na którym dana rola jedzie.
3. **Proweniencja strojenia.** Z 167 plików harnessu (3 402 agentów): buildery 184× Opus 5 vs 7× Opus 5.5, reviewerzy 584× vs 20×, fix 140× vs 8× (`dane/pa-wywolania-rol.txt`). Prompty pipeline'u były więc strojone na Opus 5 i starszych; pliki reviewerów security / performance / architecture i agenci researchu to import z compound-engineering z 2026-03-26 (`c3c9d49`), `sentry-integration` „Critical Rules” — commit początkowy z 2026-01-13 (`a9e0696`).
4. **Kod API.** Szablon nie woła API Anthropic bezpośrednio (brak SDK, brak `thinking`/`budget_tokens`/`tool_choice`/prefill w kodzie). Grupa 4 dotyczy tu ustawień harnessu Claude Code: `model`/`effort` per `agent()`, pliki agentów, hooki. Marker innego dostawcy: tylko skill `gemini` (pominięty) — bez propozycji zmiany dostawcy.
5. **Skala pewności** (dopasowana do repo bez własnego evala): **wysoka** = sprzeczność sprawdzalna w repo lub danych (nazwa, która nie istnieje; fakt, który się zmienił; decyzja operatora zapisana w HANDOFF) albo zachowanie udokumentowane w migracji na Opus 5.5; **średnia** = trafienie w udokumentowany wzorzec przewodnika bez pomiaru na naszych runach; **niska** = heurystyka, datowanie po idiomie, rzecz poza zakresem diffu.
6. **Stałe ograniczenia.** `coding-rules.md` — wyłącznie raport (PA-26), zero hunków. Tryb rozkazujący w skillach zostaje (pamięć „Skille mandatują akcje”) — diff atakuje wersaliki, wzmacniacze, fałszywe fakty i archeologię, nie imperatywy. Mini-run (d): liczba poleceń nie jest dźwignią jakości — nie skracam dla długości; każde cięcie ma nazwany wzorzec i powód dla modelu docelowego.
7. **Czytanie.** W sesji głównej przeczytane w całości: stringi promptów wszystkich 6 workflowów; 11 agentów (3 buildery, tester E2E, 4 reviewerzy, learnings-researcher, repo-research-analyst, best-practices-researcher); SKILL.md `sentry-integration`, większość `security`, fragmenty `tailwind-react-guidelines` i kluczowe sekcje dev-*. Tylko miejsca z trafień skryptu: `ux-ui-guidelines`, `supabase-dev-guidelines`, `agent-browser`, pozostali agenci researchu i 41 plików referencyjnych (czytane na żądanie, nie wstrzykiwane). Proweniencja: `git blame` + `git show`.

## 1. Najważniejsze ustalenia

**Pliki trzech reviewerów to tekst pisany pod czat i pod starsze modele, a jadą w każdym review fazy.** `security-sentinel`, `performance-oracle` i `architecture-strategist` (import z compound-engineering, 2026-03-26) zaczynają się od dialogów-przykładów „użytkownik prosi o review”, przedstawiają agenta jako „elite… laser focus”, kończą wezwaniem „you are the last line of defense, be paranoid, leave no stone unturned” i każą oddać raport z „Executive Summary / Risk Matrix”, którego workflow nie przyjmuje (zwraca schemat findingów). Na Opus 5.5, który wykonuje instrukcje dosłownie, to przepis na nadmiar zgłoszeń i pracę poza zakresem — każde zbędne zgłoszenie płaci dedup, sceptyk, a przy P3 także tura fixa. Gorzej: dwa miejsca mówią co innego niż reszta szablonu — performance każe szukać brakującego `useMemo`/`useCallback`, choć builder ma React Compiler i zakaz ręcznej memoizacji (ETAP2: „przy React Compilerze brak useMemo nie jest findingiem”), a security akceptuje `getSession()` „używane poprawnie” po stronie serwera, gdy skille security i supabase uznają to za lukę HIGH. (PA-01–PA-05, PA-07.)

**Prompty najczęściej uruchamiane są pisane jako różnica względem swoich poprzednich wersji i incydentów, których model nigdy nie widział.** „P3 idą TERAZ do naprawy, nie są JUŻ notatką”, „zrób git diff dokładnie jak dotąd”, „od 2026-09-03”, „to dokładnie ten moment, w którym poprzednio poszło źle”, „w opisanym runie wszystkie trzy miejsca…” — a opis runu jest w komentarzu JS, nie w prompcie. Model dostaje odwołanie do czegoś, czego nie ma. Podobnie compound w autopilocie ma „wyciągnąć kontekst z sesji”, choć jako agent workflowu żadnej sesji nie widzi — co najwyżej dostaje przekazaną wiadomość operatora (N1 z mini-runu), a `git diff` w chwili compoundu jest pusty, bo wszystko jest zacommitowane. (PA-08, PA-09, PA-10, PA-14.)

**Role mechaniczne dostają niedookreślony zakres, a efort ról jest ustawiony pod poprzedni model.** Haiku w `fix:pre-skan` ma „grepnąć dodane linie commitów fixa tej fazy”, ale sam musi ustalić, które to commity — mediana 20 wywołań narzędzi (maks. 42) na zadanie, które jest jednym poleceniem; orkiestrator zna hashe z raportu fixa i może je podać (PA-15). Tiery efortu (`packager: low`, `sceptykP2: medium`, reszta = efort sesji) dobrano na Opus 5; na Opus 5.5 poziomy nie odpowiadają sobie 1:1, domyślny efort API to `medium`, a przy tym samym poziomie model myśli dłużej — to jest do zmierzenia, nie do zgadnięcia, i należy do panelu (PA-22).

## 2. Liczby per grupa

| Grupa przewodnika | Ustaleń | W diffie (wysoka / średnia) | Flag (średnia, poza diffem) | Niska |
|---|---|---|---|---|
| 1a nacisk | 6 | 0 / 2 (PA-01, PA-17) | 1 (PA-26, tylko raport) | 3 |
| 1c nadmiar metody, sprzeczne duplikaty | 8 | 1 / 3 (PA-03 · PA-02, PA-04, PA-07) | 2 (PA-24, PA-39) | 2 |
| 1d skamieliny | 5 | 2 / 2 (PA-09, PA-16 · PA-06, PA-08) | 0 | 1 |
| 1f choreografia wyjścia | 1 | 0 | 0 | 1 |
| 2 kruche skille | 6 | 2 / 2 (PA-12, PA-13 · PA-10, PA-11) | 1 (PA-25) | 1 |
| 3 opisy i kontrakty | 5 | 3 / 1 (PA-14, PA-19, PA-20 · PA-05) | 0 | 1 |
| 4 konfiguracja i architektura | 12 | 0 / 3 (PA-15, PA-18, PA-21) | 4 (PA-22, PA-27, PA-29, PA-30) | 5 (w tym PA-36 poza zakresem) |
| **Razem** | **43** | **8 / 13 = 21 w diffie** | **8** | **14** |

Dodatkowo PA-44 (niska, „dodaj”): brak nazwanej listy stylów do unikania, gdy builder UI projektuje bez makiety. Razem 44 pozycje. Hunków: 62 w 25 plikach.

## 3. Ustalenia (od najwyższej pewności)

Format: **Lokalizacja** · **Cytat** · **Wzorzec** · **Dlaczego przestarzałe dla modelu docelowego** · **Pewność** · **Akcja** · **Proweniencja** · **Hunki**.

### Pewność wysoka (w diffie)

**PA-03 — memoizacja: reviewer performance każe szukać tego, czego builder ma nie robić**
- Lokalizacja: `.claude/agents/performance-oracle.md:66`, `:149`; `.claude/workflows/dev-docs-review-wf.js:363` (fokus osi).
- Cytat: „Check for unnecessary re-renders (missing `useMemo`, `useCallback`, `React.memo`)”; „Verify React component memoization”; fokus „…lazy loading, memoization, useEffect cleanup”.
- Wzorzec: 1c — duplikaty, które się nie zgadzają (keep-list pkt 8 wyklucza tylko duplikaty zgodne).
- Dlaczego: builder dostaje `tailwind-react-guidelines` („React Compiler 1.0… Nie używaj useCallback/useMemo”) i reguły buildera UI („brak zbędnych useMemo/useCallback (Compiler)”); ETAP2 §2a: „przy React Compilerze brak useMemo/useCallback NIE jest findingiem”. Opus 5.5 wykona oba polecenia dosłownie — builder nie memoizuje, reviewer to zgłasza, sceptyk obala albo fix dopisuje zbędne `useMemo`.
- Akcja: rewrite — warunek „z Compilerem brak memoizacji nie jest findingiem; bez Compilera tylko handler do `memo()`”; wyciąć „memoization” z fokusu.
- Proweniencja: `c3c9d49` 2026-03-26 (import), fokus `2602f5f` 2026-09-03. Hunki: 16, 17, 56.

**PA-09 — odwołanie do opisu, którego w prompcie nie ma (BLOK_SEMANTYKA)**
- Lokalizacja: `.claude/workflows/dev-docs-review-wf.js:94`, `:108-110`.
- Cytat: „to jest dokladnie ten moment, w ktorym poprzednio poszlo zle”; „UWAGA: w opisanym runie WSZYSTKIE trzy miejsca czytaly pole jednakowo zle”.
- Wzorzec: 1d — fraza migracyjna / narracja historyczna; tu dodatkowo wisząca referencja.
- Dlaczego: opis runu (`price_pln`, 8× zawyżenie) jest w komentarzu JS nad stałą (`:76-82`), nie w stringu. Reviewer i test-coverage dostają „opisany run” bez opisu. Przewodnik: „tekst jest diffem względem wersji, której model nie widział”.
- Akcja: rewrite na regułę bez odwołania (nazwa `price` nie mówi, czy to całość, czy za osobę; jednomyślność użyć nie dowodzi poprawności). Lekarstwo zostaje w całości.
- Proweniencja: `06fdc62` 2026-08-18 (port z mobile). Hunki: 54, 55.

**PA-12 — nazwy narzędzi Figma MCP wpisane na sztywno**
- Lokalizacja: `.claude/agents/feature-builder-ui.md:37`, `:107`; `.claude/agents/feature-builder-fullstack.md:37`, `:123`; `.claude/skills/dev-plan/SKILL.md:302-304`.
- Cytat: „Wywołaj `mcp__plugin_figma_figma__get_design_context`”.
- Wzorzec: 2 — volatile specifics; 3 — kontrakt narzędzia.
- Dlaczego: pełna nazwa zależy od sposobu podłączenia Figmy. W tej sesji Figma jest jako `mcp__plugin_design_figma__*` i konektor claude.ai; `mcp__plugin_figma_figma__*` nie istnieje. Builder szuka narzędzia, którego nie ma, i wraca do zgadywania pomiarów — dokładnie tego, czemu reguła miała zapobiec. To samo będzie przy allowliście `tools:` (panel §2 pkt 1): nazwy MCP trzeba wyliczyć z instalacji, nie z tekstu promptu.
- Akcja: rewrite — nazwa funkcji `get_design_context` serwera Figma MCP + przykłady pełnych nazw.
- Proweniencja: `840a0e6` 2026-07-12, `7186d06` 2026-05-18. Hunki: 8, 10, 11, 12, 37.

**PA-13 — planner: nieaktualny rozmiar i fałszywe uzasadnienie**
- Lokalizacja: `.claude/workflows/dev-docs-execute-wf.js:131-134`.
- Cytat: „Ten plik czytasz w CALOSCI (ok. 11 KB)… buildery nie maja gwarancji dostepu do project rules”.
- Wzorzec: 2 — fakt bez daty weryfikacji, który zgnił.
- Dlaczego: learned-patterns w oferty-online ma 46 870 zn (mini-run §0); POMIARY i 6a pkt 15 pokazały, że rules docierają do builderów eager. Poprawny powód wklejania jest inny i zmierzony: reguła wklejona do promptu delegacji jest stosowana 40/40 (mini-run a), a reguła czekająca w pliku bywa pomijana (ETAP1: 45/68 ucieczek miało regułę).
- Akcja: rewrite powodu, usunąć rozmiar. Instrukcja wklejania zostaje (to kanał potwierdzony pomiarem). Hunk: 50.

**PA-14 — compound w autopilocie: „kontekst z sesji”, której agent nie ma**
- Lokalizacja: `.claude/workflows/dev-compound-wf.js:42`, `:45`.
- Cytat: „Bez dodatkowego kontekstu — wyciagnij z sesji i git diff.”; „1. Wyciagnij kontekst z sesji + git diff / git diff --cached.”
- Wzorzec: 3 — opis niezgodny z faktycznym działaniem (kontrakt ↔ zachowanie).
- Dlaczego: agent `agent()` w workflowie nie widzi rozmowy sesji głównej; co najwyżej ma w kontekście przekazaną wiadomość operatora, którą haiku w mini-runie wykonywał (N1). W chwili compoundu autopilot ma wszystko zacommitowane, więc `git diff`/`--cached` jest pusty. Na Opus 5.5 dosłowne wykonanie tego kroku daje pusty materiał albo dokumentowanie treści wiadomości operatora.
- Akcja: rewrite — materiał = raporty review, known-issues, Dziennik, commity gałęzi (`fix(`); jawnie „nie widzisz rozmowy sesji głównej”.
- Proweniencja: `d30b8a2` 2026-06-21 (przeniesienie skilla do workflowu — tekst ze skilla pisanego dla sesji głównej). Hunk: 46.

**PA-16 — archiwizacja dopisuje do CLAUDE.md wbrew decyzji operatora**
- Lokalizacja: `.claude/skills/dev-docs-complete/SKILL.md:114-116`; `.claude/workflows/dev-docs-complete-wf.js:160`, `:164`.
- Cytat: „Dopisz decyzje architektoniczne do `CLAUDE.md`”; „6. Zaktualizuj dokumentacje projektu jesli istotne (CLAUDE.md / .claude/rules/).”
- Wzorzec: 1d — instrukcja, której żadna reguła już nie popiera (unenforced/sprzeczna z polityką).
- Dlaczego: 6a pkt 1 i 11 — żaden skill nie dopisuje do CLAUDE.md; aktualizacja po merge'u. HANDOFF wskazuje dokładnie te linie do usunięcia.
- Akcja: rewrite — „Nie edytuj CLAUDE.md ani .claude/rules/” z powodem; pathspec bez CLAUDE.md. Siatka bezpieczeństwa na artefakty compoundu zostaje. Hunki: 34, 48, 49.

**PA-19 — builder fullstack: krok, którego nie da się wykonać**
- Lokalizacja: `.claude/agents/feature-builder-fullstack.md:81`.
- Cytat: „5. Manualny smoke test poprzez `dev-docs-execute` jeśli plan tego wymaga”.
- Wzorzec: 3 — kontrakt niezgodny z zachowaniem.
- Dlaczego: builder jest liściem wywołanym przez `dev-docs-execute-wf`; nie uruchamia nadrzędnego skilla, a tryb ręczny dev-docs-execute wypada (6a pkt 20). Smoke robi tester E2E w review. Akcja: remove. Hunk: 9.

**PA-20 — spec-compliance odsyła do osi, których nie ma**
- Lokalizacja: `.claude/agents/spec-compliance-reviewer.md:49`.
- Cytat: „jakości kodu (to `architecture` i `typescript`)”.
- Wzorzec: 3 — kontrakt; nazwy osi zniknęły w konsolidacji 2026-09-03 (dziś `code-quality`). ETAP1 §1 już to wskazał („martwe odwołania w spec-compliance-reviewer.md:49”).
- Akcja: rewrite na `code-quality`. Hunk: 24.

### Pewność średnia (w diffie)

**PA-01 — wzmacniacze w plikach reviewerów**
- Lokalizacja: `.claude/agents/security-sentinel.md:177`, `:181-182`, `:191`; `.claude/agents/architecture-strategist.md:119`.
- Cytat: „Always assume the worst-case scenario”; „Stay current with latest attack vectors”; „You are the last line of defense. Be thorough, be paranoid, and leave no stone unturned”; „Be proactive in identifying architectural smells”.
- Wzorzec: 1a — „Be thorough / do not stop early”, nacisk bez powodu.
- Dlaczego: przewodnik — obecne modele są proaktywne domyślnie, a wzmacniacze pisane pod modele niedotrigowujące powodują dziś nadreakcję; rejestr promptu staje się rejestrem wyniku. U reviewera to więcej zgłoszeń do obalania (sceptycy, dedup) — nie więcej złapanych defektów: D1 pokazał, że połowa findingów znalezionych dopiero po fixie to przeoczenia z pierwszej rundy, a na przeoczenia nie działa „bądź paranoiczny”, tylko zasięg (n próbek, polecenia-listy).
- Akcja: remove wzmacniaczy; zostają konkretne punkty („Test edge cases”, „external and internal threat actors”, linia + ścieżka exploita + naprawa). Nie dodaję progu precyzji — recall jest dziś problemem (D1), precyzję trzyma sceptyk.
- Proweniencja: `c3c9d49` 2026-03-26. Hunki: 6, 22, 23.

**PA-02 — dialogi-przykłady czatu i tożsamość „elite” w plikach reviewerów**
- Lokalizacja: `security-sentinel.md:7-30`, `performance-oracle.md:7-32`, `architecture-strategist.md:7-20`.
- Cytat: „I've just finished implementing the user authentication endpoints”; „You are an elite Application Security Specialist… laser focus”.
- Wzorzec: 1c — przykłady (fałszywe tury dialogu) i G3 — przykłady routingu w złym miejscu; 1d — tożsamość zastępująca kontekst.
- Dlaczego: w compound-engineering te bloki służyły routingowi agentów z czatu. U nas reviewer jest wołany przez workflow z ustrukturyzowanym promptem; przykłady opisują inną sytuację i — jako najsilniejszy sygnał w prompcie — ciągną w stronę rozmowy z użytkownikiem i pełnego „security review”, zamiast fokusu fazy. Opis `description:` pozostaje (routing).
- Akcja: remove przykładów w trzech plikach reviewerów; w security rewrite tożsamości na jedno zdanie o zadaniu (framing „myśl jak atakujący” zostaje). Pozostali agenci z przykładami (buildery, tester, researcherzy) — niska waga, bez hunków.
- Proweniencja: `c3c9d49`. Hunki: 1, 15, 19.

**PA-04 — `getSession()` po stronie serwera: reviewer łagodniejszy niż skille**
- Lokalizacja: `.claude/agents/security-sentinel.md:65`.
- Cytat: „Verify that `supabase.auth.getSession()` is used correctly (not trusting client-side tokens on server)”.
- Wzorzec: 1c — duplikat niezgodny z `skills/security/SKILL.md:78,120` (getSession do autoryzacji server-side = HIGH) i `supabase-dev-guidelines/SKILL.md:281-306`.
- Dlaczego: „used correctly” zostawia furtkę, którą skille zamykają. Opus 5.5 czyta to dosłownie i może przepuścić `getSession()` w Edge Function jako „poprawne”.
- Akcja: rewrite — tożsamość z `getUser()`/`getClaims()`/`ctx.userClaims`; `getSession()` do autoryzacji na serwerze = finding. Hunk: 20.

**PA-05 — format raportu w pliku reviewera kontra schemat workflowu**
- Lokalizacja: `security-sentinel.md:161-173`; `architecture-strategist.md:112-117`.
- Cytat: „Your security reports will include: 1. Executive Summary… 3. Risk Matrix… 4. Remediation Roadmap”; „Provide your analysis in a structured format…”.
- Wzorzec: G3 — kontrakt/zachowanie; 1c — duplikat niezgodny (workflow żąda `{findings:[…]}`).
- Dlaczego: dwa sprzeczne formaty wyjścia; model godzi je, pisząc prozę raportu w polach findingów albo marnując turę. Akcja: rewrite — w review fazy format narzuca workflow; układ raportu tylko dla audytu wołanego wprost. Hunki: 5, 21.

**PA-06 — architecture: opis zmiany zamiast zasady**
- Lokalizacja: `.claude/agents/architecture-strategist.md:26-29`.
- Cytat: „Od 2026-09-03 w `dev-docs-review-wf` jesteś jedynym reviewerem jakości wewnętrznej — przejąłeś role, które wcześniej pełnili…”.
- Wzorzec: 1d — frazy migracyjne. Akcja: rewrite w czasie teraźniejszym z powodem („jedna warstwa, jedno przejście”). Proweniencja: `2602f5f` 2026-09-03. Hunk: 2.

**PA-07 — architecture: „najpierw zmapuj cały system”**
- Lokalizacja: `architecture-strategist.md:83-91`, `:95`.
- Cytat: „Begin by examining the overall system structure through architecture documentation, README files”; „Read and analyze architecture documentation and README files”.
- Wzorzec: 1c — choreografia kroków / coaching strategii; rozszerzanie zakresu (nazwany kandydat re-testu z migracji Opus 5 → 5.5: „task scope expansion”).
- Dlaczego: w review fazy zakresem jest diff; polecenie mapowania całego systemu przez dokumentację to dodatkowe tury na każdym wywołaniu (code-quality: mediana 20 wywołań narzędzi, `dane/pa-wywolania-rol.txt`).
- Akcja: rewrite — zakres = zmiana + pliki, których dotyka; docs/README tylko przy przekraczaniu granicy, którą opisują. Hunki: 3, 4.

**PA-08 — frazy migracyjne w promptach review / fix / execute / dev-docs**
- Lokalizacja: `dev-docs-review-wf.js:63`, `:73`, `:400`, `:416`, `:440`, `:463-464`, `:727`; `dev-autopilot-wf.js:562`; `dev-docs-execute-wf.js:196`; `skills/dev-docs/SKILL.md:112-116`.
- Cytat (przykłady): „AKCYJNOSC (ZAOSTRZONA — P3 IDA TERAZ DO NAPRAWY): P3 nie jest juz notatka”; „zrob wlasny \`git diff\` fazy dokladnie jak dotad”; „(dotad 7x ten sam git diff)”; „P3 sa tu od 2026-09-03”; „P3 nie sa juz odcinane”; „Do 2026-09-03 plik kontekstu je kopiował…”.
- Wzorzec: 1d — „write as if current rules are the only rules that ever existed”.
- Dlaczego: sugerują alternatywę, której model nie zna („jak dotąd” — czyli jak?); wersaliki „ZAOSTRZONA/TERAZ” to nacisk bez nowej treści.
- Akcja: rewrite w czasie teraźniejszym, zachowując każdy powód (koszt tury fixa, rozjazd kopii planu). Hunki: 32, 40, 51, 52, 53, 57, 58, 59, 60, 62.

**PA-10 — archeologia incydentu E2E i niezgodna definicja liczenia**
- Lokalizacja: `dev-docs-review-wf.js:555-558`; `.claude/agents/feature-tester-e2e.md:23`.
- Cytat: „BRAMKA (Poprawka 10)”, „UWAGA — historyczny bug (regresja etap-12b, mobile)”; „Liczenie tylko jednego prefiksu to udokumentowana regresja (szablon mobile, etap-12b)”.
- Wzorzec: 2 — narracja historyczna, ID incydentów; plus duplikat niezgodny: plik testera wyklucza tylko `Operator:`, workflow wyklucza też `[P1]/[P2]/[P3]`.
- Akcja: rewrite — ta sama reguła z mechanizmem porażki zamiast nazwy incydentu; grep w pliku agenta zrównany z workflowem. Hunki: 13, 61.

**PA-11 — rok wpisany na sztywno**
- Lokalizacja: `skills/{dev-brainstorm,dev-compound,dev-docs,dev-docs-complete,dev-compound-refresh,dev-plan,dev-prep}/SKILL.md:9`; `agents/framework-docs-researcher.md:22`, `best-practices-researcher.md:22`, `repo-research-analyst.md:34`, `web-research-specialist.md:29`; `workflows/dev-compound-wf.js:49`.
- Cytat: „**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu…”; „(rok 2026)”.
- Wzorzec: 2 — treść zależna od czasu. Dlaczego: 1 stycznia 2027 każda z 12 linii zacznie produkować błędne daty w nazwach plików i zapytaniach; data jest w środowisku sesji i w `date +%F`.
- Akcja: rewrite na `date +%F`. Proweniencja: `c3c9d49` (import). Hunki: 7, 14, 18, 25, 28, 29, 30, 31, 33, 35, 38, 47.

**PA-15 — zakres diffu fixa dla ról mechanicznych**
- Lokalizacja: `dev-autopilot-wf.js:694-698` (`preSkanFixaPrompt`, haiku), `:714-719` (`regresjaFixaPrompt`), wywołania `:1509`, `:1520`.
- Cytat: „Ustal zakres: `git log --oneline --grep="^fix("` -> pierwszy commit fixa tej fazy.”
- Wzorzec: G2 „wrong degrees of freedom” (wąski most opisany prozą zamiast dokładnego polecenia) + G4 „LLM executor for a deterministic plan”.
- Dlaczego: grep zwraca commity fix wszystkich faz; agent musi sam rozstrzygnąć, które są „tej fazy”. Haiku robi to w medianie 20 wywołań narzędzi (maks. 42, n=39; mediana pola `tokens` harnessu ~107k) — na zadanie, które jest jednym `git diff`. `FixResult.commity` ma hashe, a orkiestrator trzyma `fix` w tym samym bloku.
- Akcja: replace — funkcja `zakresFixa(numerFazy, commity)` podaje hashe z raportu fixa; gdy ich brak, zostaje obecna instrukcja (doprecyzowana o „fazy N” w komunikacie). Model call zostaje (skrypt workflowu nie ma powłoki). Proweniencja: `bd9bfb2` 2026-09-03. Hunki: 41, 42, 43, 44, 45.

**PA-17 — sentry-integration: „NIGDY NIE ŁAMIESZ TYCH ZASAD / ALL ERRORS MUST”**
- Lokalizacja: `.claude/skills/sentry-integration/SKILL.md:31-37` (wstrzykiwany builderom data i fullstack).
- Wzorzec: 1a — wersaliki i nacisk bez powodu. Dlaczego: reguły są prawdziwe, ale krzyk z czasów modeli, które je pomijały, na Opus 5.5 przenosi się na nadgorliwość (Sentry w każdym `catch`, także przy oczekiwanych odmowach).
- Akcja: rewrite tych samych pięciu zasad normalnym zdaniem, każda z powodem. Proweniencja: `a9e0696` 2026-01-13. Hunk: 39.

**PA-18 — hook error-handling: sprawdza wzorzec sprzed migracji i żąda czegoś sprzecznego ze skillem**
- Lokalizacja: `.claude/hooks/error-handling-reminder.sh:83`, `:101-103`.
- Cytat: „grep -q 'Deno\.serve' || continue”; „Brak await flush() — eventy Sentry mogą nie zostać wysłane”.
- Wzorzec: G4 — komunikat do modelu niezgodny z kontraktem (skille od `9ace785` 2026-08-24 piszą `export default { fetch: withSupabase(...) }`, a `sentry-integration:143` mówi „await captureError (flush wewnętrznie)”).
- Dlaczego: nowe funkcje nie są sprawdzane wcale; stare dostają polecenie dopisania `flush()`, którego skill nie wymaga. Operator zdecydował wycofać hook po bramce ESLint (L14) — to łata na okres przejściowy.
- Akcja: rewrite warunku (`withSupabase|Deno\.serve`) i ostrzeżenia (`captureError` bez `await`). Hunki: 26, 27.

**PA-21 — dev-plan woła repo-research-analyst bez `Scope:`**
- Lokalizacja: `.claude/skills/dev-plan/SKILL.md:171`; kontrakt agenta `agents/repo-research-analyst.md:40-59`.
- Wzorzec: G4 — koszt przy zbędnej pracy; G3 — agent ma parametr zakresu, wołający go nie używa.
- Dlaczego: bez `Scope:` agent przechodzi też „GitHub Issue Pattern Analysis” i „Template Discovery”, które planu technicznego nie zasilają. Research to największa pozycja kosztu dev-plan (D6: 18,6 z 55,6 M). Opus 5.5 wykona pełną listę faz, bo tak mówi agent.
- Akcja: add — `Scope: technology, architecture, patterns, conventions` w prompcie delegacji. Hunk: 36.

### Pewność średnia — flagi (poza diffem: decyzja panelu, pomiar albo tekst vendora)

**PA-22 — efort ról po przejściu na Opus 5.5.** `dev-docs-review-wf.js:819` `TIERY_DOMYSLNE = { packager: 'low', sceptykP2: 'medium', sceptykP1: null, reviewer: null }`; buildery, fix, scribe, walidacja — bez `effort` (efort sesji). Migracja Opus 5.5: domyślny efort API `medium` (Opus 5: `high`), poziomy nie odpowiadają sobie 1:1, przy tym samym poziomie 5.5 myśli dłużej; „set effort explicitly and re-run the sweep”. Tiery strojone na Opus 5 (992 z 1 058 agentów opusowych w rolach build/fix/review/scribe, ~94%). Test `sceptycy-p2.test.mjs:157` przypina `TIERY_DOMYSLNE` dosłownie — zmiana wymaga świadomej decyzji. Plik harnessu nie zapisuje efortu (3 402 / 3 402 wpisów bez pola) i rekord D5 go nie ma. **Akcja:** panel — efort jako parametr kosztu per klasa; rekord `agent` dostaje pole `effort` (z etykiety/tieru w JS); pomiar w pierwszej iteracji.

**PA-24 — skill `security` wstrzykiwany builderom to protokół audytu.** `agents/feature-builder-data.md:4`, `feature-builder-fullstack.md:4` → `skills/security/SKILL.md:22` „Workflow -- 6-skanowy protokol”, `:133` „Format Raportu” (Executive Summary, Risk Matrix), `:179` „Mysl jak atakujacy — zakladaj najgorszy scenariusz”. Builder dostaje instrukcję audytu i raportu, której nie ma wykonywać (1c: aside stosowany tam, gdzie nie pasuje). **Akcja:** panel — podział skilli na warstwę stałą i referencyjną (6a pkt 18): builder potrzebuje reguł (RLS, walidacja, sekrety), nie protokołu audytu.

**PA-25 — `figma-design-to-code` to nieaktualna kopia skilla vendora.** Lokalna kopia (import z pluginu v2.2.78, `840a0e6`) nie ma sekcji „Reproduce images and icons faithfully” z pluginu 2.2.111 (zakaz rysowania własnych SVG, wygasające URL-e assetów) i odsyła do nieistniejących plików (`../figma-generate-design/SKILL.md`). Gęstość „You MUST” 21/100 linii to tekst vendora — nie przepisywać lokalnie. **Akcja:** operator — odświeżyć kopię z pluginu (albo przejść na `figma:figma-design-to-code`, tracąc „działa bez pluginu”, README:233).

**PA-26 — `coding-rules.md` (TYLKO RAPORT, reguły operatora).** (a) `:72-85` „Katalog 10 udokumentowanych anty-patternów AI” z częstościami „80-90%” — to opis cech modelu (1a „you tend to…”) i powtórzenie reguł z `:61-70`; na modelu, który czyta dosłownie, tabela o jego „skłonnościach” dubluje polecenia i niczego nie dodaje. (b) Gęstość NIGDY/ZAWSZE 22 na 217 linii — najwyższa w zakresie poza tekstem vendora; większość ma powód, część tylko zamiennik bez powodu (`:161-163`). (c) `:65` „Nie modyfikuj swoich własnych reguł / review scripts / hooks” koliduje z compoundem, który pisze do `.claude/rules/learned-patterns.md`, i z utrzymaniem szablonu na prośbę operatora. (d) `:22` i `:92` — dwa razy „uruchom testy/typecheck/lint przed gotowe”; weryfikacja jest nazwanym kandydatem re-testu (Opus 5: over-verification) i jest egzekwowana przez domknięcie i walidację końcową. (e) Znane wcześniej: `:5` 300 linii vs ESLint `max-lines` 360 (ETAP2), sprzeczność §3/§11 (6a pkt 5). **Akcja:** decyzja operatora przy przepisaniu coding-rules (tabela USUŃ/ZMIEŃ z ETAP2).

**PA-27 — learned-patterns dociera do buildera trzema kanałami.** Eager z `.claude/rules/`, polecenie w pliku agenta („1.7 Przeczytaj `.claude/rules/learned-patterns.md`”, `feature-builder-{data,ui,fullstack}.md:34/43`) i wklejka plannera. 46,9k zn czytane dwa razy na buildera. **Akcja:** już przesądzone (panel §2 pkt 4) — przy wdrożeniu usunąć też krok 1.7 z plików builderów.

**PA-29 — weryfikacja w pięciu warstwach.** Builder (tsc/test/lint/build, `feature-builder-*.md` §4), domknięcie fazy (System-Wide Test Check, mediana 32 wywołań), fix (pełna walidacja), walidacja końcowa, hook Stop (`tsc` po każdej odpowiedzi sesji). Migracja Opus 5 → 5.5 wskazuje instrukcje weryfikacji jako kandydata do re-testu (model weryfikuje sam; polecenia weryfikacji powodują nadweryfikację). To są bramki kontraktu, nie proza — nie do wycinania bez pomiaru. **Akcja:** panel — otwarta decyzja „które warstwy weryfikacji zostają”, miara: wywołania narzędzi i koszt domknięcia.

**PA-30 — dev-plan zawsze uruchamia agentów researchu.** `skills/dev-plan/SKILL.md:159-165` — „1.1 Research lokalny (uruchamiany zawsze)… Uruchom tych agentów równolegle”, plus warunkowo 1.3 i 1.5. Opus 5.x deleguje chętnie; tu delegacja jest nakazana także dla głębokości „Lekka”. D6: subagenci researchu to największa pozycja dev-plan. **Akcja:** panel (§2 pkt 12, scalony dev-plan + dev-docs z budżetem tokenów).

**PA-39 — security-sentinel: trzy zachodzące checklisty i pozycje niewykonalne w review diffu.** `:32-95`, `:97-108`, `:145-159`; „Document compliance status for each category” (`:77`), „Dependencies are up-to-date” (`:158`). ETAP1 już zdecydował: prompt security 191 → ~90 linii, warunek `plikiKodu>0`, warunkowość po profilu stacku (6a pkt 18). **Akcja:** panel/§10 — przepisanie pliku klasy „reviewer security” (hunki PA-01/02/04/05 są podzbiorem i nie kolidują).

### Pewność niska (tylko raport)

- **PA-23** — `dev-autopilot-wf.js:1509`: efort `'low'` przekazywany agentowi `model: 'haiku'`; Haiku 4.5 nie obsługuje efortu, harness go pomija (39/39 wywołań zakończonych normalnie). Martwy parametr — usunąć przy okazji PA-22.
- **PA-28** — `stan:zapis` (n=290, mediana 5 wywołań), `telemetria` (mediana 6–8, maks. 32), scribe (mediana 14) to w dużej części wykonawcy deterministycznego planu; przyczyna: skrypt workflowu nie ma dostępu do plików. Telemetria przechodzi na skan skryptem (D5); scribe — ETAP1 „niższy tier + krótszy prompt”.
- **PA-31** — opisy skilli i workflowów szablonu to ~12k zn w liście skilli każdego startu agenta; opisy workflowów-dzieci (review 1 001 zn, pr 545, complete 302, execute 274, compound 230) opisują mechanikę, nie routing. Koszt startu → panel.
- **PA-32** — `dev-docs-review-wf.js:536` „To zakaz, nie sugestia… pod zadnym pozorem” — nacisk z udokumentowaną awarią (2026-07-30, tester poszedł w przeglądarkę mimo braku środowiska); zostaje do re-testu na 5.5 (zasada proweniencji).
- **PA-33** — `dev-docs-review-wf.js:60` „zglos MAKSYMALNIE 5 findingow P3” — klamra liczbowa (1f), ale kontrakt potoku egzekwowany też w JS (`LIMIT_P3_GLOBALNY`); los P3 rozstrzyga 6a pkt 15 (P3 → known-issues/bot).
- **PA-34** — `agents/learnings-researcher.md:229-250` „RÓB / NIE RÓB” powtarza kroki 3–6 (1c, powtórzenie jako wzmocnienie); duplikaty zgodne — bez zmian.
- **PA-35** — wzmacniacze w agentach researchu („Be systematic, thorough”, `repo-research-analyst.md:295`; „thorough but focused”, `best-practices-researcher.md:126`).
- **PA-36** — `kieran-typescript-reviewer.md`, `code-simplicity-reviewer.md`: poza audytem (do usunięcia po wykorzystaniu treści, L14).
- **PA-37** — hooki Stop nie czytają `stop_hook_active` i przy trwałych ostrzeżeniach zwracają exit 2 po każdej odpowiedzi; `error-handling-reminder.sh:120` każe „Zapytać użytkownika” z hooka. Do sprawdzenia z dokumentacją hooków przy wycofaniu (L14).
- **PA-38** — `skills/dev-docs-complete/SKILL.md:120` „Zapytaj: Czy chcesz udokumentować… /dev-compound” i `:139` „🎉 Świetna robota” — w autopilocie compound już się odbył, a agent archiwizacji nie ma kogo pytać.
- **PA-40** — `performance-oracle.md:100-105` progi „O(n log n)”, „200 ms”, „5 KB per feature” — niesprawdzalne w review diffu (1c); oś do zastąpienia (ETAP1 roster 6 → 5).
- **PA-41** — `skills/dev-compound-refresh/SKILL.md:200-220` „Strategia subagentów” — zachęta do delegacji z czasów modeli, które delegowały za rzadko; w autopilocie refresh jest wąski (1–2 dokumenty).
- **PA-42** — `~/.claude/CLAUDE.md` (blok graphify) trafia do każdego agenta; higiena konta, nie szablonu.
- **PA-43** — `dev-autopilot-wf.js:355` „Model potrafi 'odczytać' uszkodzony JSON i zmyślić stan faz” — opis cechy modelu (1a), ale pełni rolę powodu dla twardego zakazu; zostaje.
- **PA-44 (add)** — brak nazwanej listy stylów do unikania, gdy builder UI projektuje bez makiety („projektujemy z głowy” w dev-plan 1.6). Migracja Opus 5.5: bez kierunku model wraca do kilku domyślnych stylów, a lista nazwanych wzorców działa lepiej niż „unikaj generycznego wyglądu”. W szablonie brak tekstu, który by to psuł — to dopisek na przyszłość, do decyzji przy warstwie stałej buildera UI.

## 4. Co z tego dla panelu decyzyjnego

**Wpływ na warstwę stałą ról (PANEL-WEJSCIE §2 pkt 3).** Audyt daje projektantom zasady pisania warstwy stałej, zanim policzą budżet:
1. Pliki klas ról pisać od zera w obecnym stylu, nie przerabiać plików compound-engineering: mandat w 1–2 zdaniach, polecenia-listy z powodem przy każdym, format wyjścia = schemat workflowu (bez drugiego formatu w pliku), bez dialogów-przykładów i bez tożsamości „expert/elite” (PA-01, PA-02, PA-05).
2. Czas teraźniejszy, zero dat, numerów poprawek i nazw incydentów w tekście dla modelu — historia zostaje w komentarzach JS i w `docs/solutions/` (PA-06, PA-08, PA-09, PA-10). Test budżetu warstwy stałej może łapać `20\d\d-\d\d-\d\d`, „jak dotąd”, „już nie” jako wzorzec niedozwolony — tanie i mechaniczne.
3. Role mechaniczne dostają dokładne polecenie i dane wejściowe z orkiestratora, nie zadanie ustalenia zakresu (PA-15; także wzorzec dla stanu fazy „liczonego w JS i doklejanego do promptu”, ETAP1). Kandydaci do sprawdzenia tą samą miarą: `zwin-do-poprawy` (mediana 8), `telemetria` (maks. 32).
4. Każda nazwa narzędzia MCP w prompcie i w allowliście `tools:` wyliczona z instalacji, nie przepisana z tekstu (PA-12) — wprost wymóg dla §2 pkt 1.
5. Efort jest parametrem klasy roli obok modelu i `tools:`; tiery do przeliczenia na Opus 5.5, rekord `agent` z polem `effort` (PA-22). Do mapy walidacji: koszt i findingi potwierdzone per klasa przy zmianie efortu.
6. Skille builderów: `security` przenieść do warstwy referencyjnej w postaci reguł dla implementatora, nie protokołu audytu (PA-24); `sentry-integration` i reszta — jedna zasada = jedno zdanie z powodem (PA-17).
7. Otwarte decyzje do kroku 0 panelu (dopisać do listy): liczba warstw weryfikacji (PA-29), obowiązkowy research w dev-plan przy głębokości „Lekka” (PA-30), opisy workflowów-dzieci w liście skilli (PA-31).

**Niezależne od panelu — mogą iść od razu jako zmiany szablonu (PANEL-WEJSCIE §10).** Poprawki faktów i kontraktów, które każdy projekt panelu i tak by przyjął: PA-03, PA-04, PA-09, PA-12, PA-13, PA-14, PA-16, PA-19, PA-20 (sprzeczności i nieistniejące odwołania), PA-08, PA-10, PA-11 (frazy migracyjne, rok), PA-15 (zakres fixa), PA-17 (ton zasad Sentry), PA-18 (hook do czasu bramki ESLint), PA-21 (Scope w dev-plan). Hunki w plikach reviewerów (PA-01, PA-02, PA-05, PA-06, PA-07) są tanie i spójne z kierunkiem panelu, ale panel i tak zastąpi te pliki plikami klas — brać teraz tylko wtedy, gdy wdrożenie panelu jest dalej niż jedna iteracja. Po naniesieniu czegokolwiek z `.claude/`: nowa sesja przed autopilotem (N2).

**Weryfikacja (Step 7 — usunięcie to hipoteza).** Poprawki faktów (PA-03/04/09/12/13/14/16/19/20/11) nie wymagają próby — zmieniają tekst na zgodny z repo. Wymagają pomiaru przed i po: (a) PA-01/02/05/07 — jeden historyczny review fazy (ten sam diff, stare i nowe pliki reviewerów, 2 × 3 osie): liczba findingów, odsetek obalonych przez sceptyków, potwierdzone P1/P2, wywołania narzędzi; (b) PA-15 — wywołania narzędzi `fix:pre-skan` w pierwszym runie po zmianie (telemetria, cel: mediana ≤ 3); (c) PA-14 — czy compound po zmianie produkuje wpis z materiału runu, a nie z wiadomości operatora. Każdy regres: przywrócić minimalną formę reguły, nie oryginał.

## 5. Czysta powierzchnia (sprawdzone, nic do zmiany)

Brak „think step by step”, `<scratchpad>`, próśb o pokazanie rozumowania (ryzyko `reasoning_extraction` na 5.5), prefillu, `budget_tokens`, `temperature`, wymuszonego `tool_choice` (structured output workflowów działał na Opus 5.5 w mini-runie), tłumików narracji („nie narruj”, „wstrzymaj findingi”), zakazów formatowania, słownika oceniania („będziesz oceniany”) i przypomnień wstawianych co N tur (`dane/pa-sygnaly.txt`, sygnały 1b, 1c, 1d = 0 trafień merytorycznych). Prompty ról Haiku (`stan:zapis`, `e2e:precheck`, `env-down`, `commit-artefaktow`, `dedup`, `inspekcja`) są imperatywne, z dokładnymi komendami i walidacją — poza zakresem fixa (PA-15) nic do zmiany; ich ryzyko to N1 (allowlista bez Bash/Write), już w panelu. Bloki `BLOK_DLUGIE_KOMENDY`, `BLOK_GH`, `BLOK_ZAUFANIE`, guard plików binarnych, zakaz test-weakeningu — fakty środowiska i reguły z udokumentowaną awarią, z powodem przy każdej; zostają w całości.

## 6. Ograniczenia

Bez evala: pewność „średnia” opiera się na wzorcach przewodnika i danych z plików harnessu, nie na próbie przed/po. ~94% historii agentów opusowych to Opus 5 — liczby wywołań opisują zachowanie starszego modelu. Pliki referencyjne skilli (20k linii) czytane tylko w miejscach trafień. Sprawdzenie diffu: `git apply --check` na HEAD 46e854b, 74/74 testów `__tests__` na kopii z naniesionym diffem, `bash -n` hooka, wyrenderowanie `zakresFixa()` i promptu compoundu w node; brak uruchomienia autopilota na zmienionym szablonie.

## 7. Pliki

`PROMPT-AUDIT.md` (ten), `PROMPT-AUDIT-DLA-OPERATORA.md`, `dane/pa-proponowany.diff`, `dane/pa-inwentarz.txt`, `dane/pa-sygnaly.{txt,json}`, `dane/pa-wywolania-rol.txt`, `dane/pa-kontrola.txt`; skrypty `skrypty/pa_inwentarz.py`, `skrypty/pa_wywolania.py`, `skrypty/pa_kontrola.py`.
