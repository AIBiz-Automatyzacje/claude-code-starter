# Review workspace-template — 2026-07-12

**Orkiestrator:** Claude Fable 5 (tylko synteza i weryfikacja) · **Agenci:** 53 subagentów na Sonnet/Opus/Haiku
**Metoda:** 7 równoległych reviewerów (każdy inny wymiar) → adversarial verify każdego P1 (3 sceptyków) i P2 (1 sceptyk) → niezależny re-review workflowów JS na Opusie → synteza z ręcznym spot-checkiem.
**Wynik weryfikacji:** 36 findingów z workflow + 10 z review JS; **0 obalonych**, 15 z korektami severity od sceptyków.

Wymiary: aktualność funkcji Claude Code (vs oficjalne docs, lipiec 2026) · aktualność stacku frontend · aktualność stacku backend/security · poprawność 5 workflowów JS · spójność wewnętrzna · jakość promptów · architektura pipeline'u.

---

## TL;DR

Szablon jest w bardzo dobrej formie — architektura autopilota (stan w JSON, gate'y w JS, adversarial verify, null-guardy) jest dojrzała i zgodna z aktualną dokumentacją Dynamic Workflows. Znalezione problemy to głównie: **(a)** kilka literówek/martwych nazw, które **cicho wyłączają zaprojektowane mechanizmy** (Figma design-to-code, handoff brainstorm→plan), **(b)** dryf między starszymi skillami `dev-*` a nowszymi workflowami `-wf.js`, **(c)** punktowe przeterminowania w skillach technicznych (Stripe, TypeScript, React Router), **(d)** rozjazd narracji "napraw i wznów przez resume" z faktyczną semantyką cache'owania `agent()`.

---

## P1 — realne błędy (naprawić w pierwszej kolejności)

### 1. Nieistniejący skill `figma:figma-implement-design` — buildery UI cicho tracą wiedzę design-to-code
- **Gdzie:** `feature-builder-ui.md:4,37` · `feature-builder-fullstack.md:4` · `dev-plan/SKILL.md:414,416`
- Poprawna nazwa to **`figma:figma-design-to-code`** (zweryfikowane w zainstalowanych wersjach pluginu Figma 2.2.68–2.2.78 — `figma-implement-design` nie istnieje w żadnej). Wg docs subagentów brakujący skill jest **pomijany bez błędu** — czyli feature całej iteracji "Figma awareness" (changelog 2026-05-18) jest częściowo martwy, mimo że README reklamuje go jako wdrożony. Ironia: reguła anty-halucynacyjna w `feature-builder-ui.md:37` sama opiera się na halucynowanej nazwie.
- **Fix:** zamiana nazwy w 5 miejscach + weryfikacja preloadu.

### 2. Zerwany handoff CO→JAK: `docs/dev-brainstorms/` vs `docs/brainstorms/`
- **Gdzie zapisuje:** `dev-brainstorm/SKILL.md:52,248,309,323` (`docs/dev-brainstorms/`); tak samo czytają `dev-docs-review-wf.js:180` i `dev-docs-review/SKILL.md`.
- **Gdzie czyta reszta:** `dev-plan`, `dev-docs`, `zroastuj-mnie`, README (`docs/brainstorms/`).
- Efekt: rekomendowany scenariusz README (`/dev-brainstorm` → `/dev-plan`) **cicho gubi requirements doc** — dev-plan nie znajduje pliku i przechodzi do fallbacku bez requirements, tracąc wszystkie ustalenia z brainstormu.
- **Fix:** ujednolicić na `docs/brainstorms/` (4 miejsca w dev-brainstorm + review-wf.js:180 + dev-docs-review/SKILL.md).

### 3. `auto-error-resolver.md` zawiera treść obcego projektu ("Piszemy Wirale")
- **Gdzie:** `.claude/agents/auto-error-resolver.md:7,12+`
- Hardkod nazwy projektu, struktury katalogów `piszemy_wirale/` i ścieżek Stripe z innego repo. Dodatkowo frontmatter deklaruje przestarzałe narzędzie `MultiEdit` i nie przeszedł adaptacji jak pozostałe 15 agentów (brak `model: inherit`). Agent jest wołany przez hook `stop-build-check-enhanced.sh` — w nowym projekcie dostanie instrukcje szukania nieistniejących plików.
- **Fix:** przepisać generycznie (dynamiczne odkrywanie struktury projektu, jak "KROK 1: Odkryj komendy" w dev-autopilot).

### 4. Brak null-guarda na plannerze — TypeError wykolei cały autopilot
- **Gdzie:** `dev-docs-execute-wf.js:182-184`
- `const plan = await agent(...)` → gdy planner padnie, `agent()` zwraca `null`, a `plan.poza` rzuca `TypeError`. Throw propaguje przez `workflow('dev-docs-execute-wf')` i wywala cały run autopilota **niekontrolowanie** (zamiast czystego STOP, który dla execute jest już obsłużony). To jedyny `await agent()` w repo czytający pola wyniku bez guarda — wszystkie pozostałe są osłonięte.
- **Fix (1 linijka):** `if (!plan) return { fazaNumer: faza, status: 'blocked', iu: [], problem: 'planner zwrocil null' }`

### 5. Przeterminowane wersje w skillach backendowych — buildery wygenerują przestarzały kod
- **Stripe:** `npm:stripe@18` w 8 miejscach (`supabase-dev-guidelines/SKILL.md:39,168` + `resources/edge-functions.md`), a realna wersja na lipiec 2026 to **v22** (v22.3.1 z 2026-07-09). Rozjazd wewnętrzny: przykład pinuje `apiVersion: '2026-06-24.dahlia'`, który należy do v22.3.x — SDK i wersja API w tym samym bloku kodu są niekompatybilne. Wpis README "Stripe v18 nadal aktualne" (audyt 2026-07-06) był nieprawdziwy już w dniu audytu.
- **Sentry webhook:** `sentry-integration/resources/edge-functions-sentry.md:172-181` — przykład Stripe+Sentry importuje przez `esm.sh/stripe@17` z `apiVersion: '2024-12-18.acacia'`, wprost sprzecznie z tabelą "Preferowane źródła" siostrzanego skilla (esm.sh = ⚠️ Legacy). Także linie 244, 451.
- **Fix:** aktualizacja pinów (stripe@22, spójny apiVersion), przepisanie przykładu webhooka na `jsr:`/`npm:`.

---

## P2 — istotne słabości i nieaktualności

### Architektura / workflowy

**6. Narracja "napraw i wznów przez resume" rozjeżdża się z semantyką cache `agent()`** — `dev-autopilot-wf.js` (STOP-y warmup:482, e2e-env:496-504, fix:573-582, walidacja:616 + `meta.whenToUse`). Prompty tych agentów są statyczne (zależą tylko od `sciezka`), więc resume po naprawie środowiska zwróci **zcache'owaną porażkę** i run STOP-nie identycznie. Analogicznie bootstrap przy resume czyta stan z cache journala, nie z aktualnego `.autopilot-state.json` — kontrakt "JSON to źródło prawdy przy resume" jest w praktyce złamany dla ręcznych edycji.
**Fix:** cache-busting token (np. licznik próby) w promptach agentów bramkowych, albo zmiana komunikatów STOP na "odpal świeży run".

**7. Awaria scribe'a → `review=done` bez raportu** — `dev-docs-review-wf.js:342-353` + `dev-autopilot-wf.js:558`. Gate policzy się poprawnie z `findings[]`, ale `review-faza-N.md` i sekcja "Do poprawy" nigdy nie powstaną, a `review='done'` utrwali się w stanie — fix działa bez pełnego kontekstu, człowiek bez widoku, raport nie odtworzy się nigdy.
**Fix:** przy fallbacku scribe'a nie oznaczać review jako done (lub ponowić samego scribe'a).

**8. Gate po fix wyłącznie z self-reportu** — `dev-autopilot-wf.js:573-585`. Filar 3 ("gate'y z findings[], nie self-reportu") jest złamany w najbardziej ryzykownym miejscu: po fixie nie ma listy do przeliczenia, tylko skalar od agenta, który sam naprawiał. Walidacja końcowa łapie test-weakening i błędy kompilacji, ale nie pozorną naprawę P1-KOD bez pokrycia testowego.
**Fix (tani):** per finding P1 typu KOD — 1 targetowany adversarial verify ("czy ten finding nadal otwarty po commicie fix"), zamiast pełnego re-review.

**9. Hook `error-handling-reminder.sh` martwy w głównej ścieżce** — `.claude/settings.json` podpina go tylko pod session-level `Stop`, a hook analizuje niescommitowany diff. Autopilot commituje inkrementalnie per faza, więc przy `Stop` diff jest pusty — jedyny strażnik zakazu `console.log`/wymogu `captureError` nigdy nic nie widzi.
**Fix:** wciągnąć check do promptu domknięcia fazy w execute-wf (jak zrobiono z TSC) lub do fokusu security-sentinela; ewentualnie hook `SubagentStop` z matcherem na builderów.

**10. `learned-patterns.md` — pętla wiedzy bez readerów** — reguły są pisane (dev-compound) i utrzymywane (refresh), ale żaden builder/planner/reviewer w ścieżce autopilota ich nie czyta (subagenci nie mają gwarancji wstrzyknięcia project rules). Najbardziej zdestylowana wiedza projektu nie wraca do implementacji.
**Fix:** jawny krok "przeczytaj `.claude/rules/learned-patterns.md` (jeśli istnieje)" w plannerPrompt/reviewerPrompt i w `feature-builder-*.md` (analogicznie do CONCEPTS.md).

**11. Warmup: twardy STOP na progu maszyno-zależnym** — `dev-autopilot-wf.js:482-484`, próg `czasKontrolnySek < 60`. Na wolnej maszynie/CI poprawnie zbudowany cache może dać ≥60s → cały run pada na optymalizacji, nie na defekcie.
**Fix:** degradacja z ostrzeżeniem zamiast STOP (warmup to optymalizacja, nie warunek poprawności).

### Dryf skille ↔ workflowy ↔ README

**12. `/dev-docs-review` i `/dev-docs-execute` (SKILL.md) wykonują starszą procedurę niż obiecuje README** — README:92-94 opisuje je adnotacją "(workflow: ...-wf)" z mechaniką 7 reviewerów + adversarial verify, ale SKILL.md nie wołają Workflow toola: dev-docs-review robi 6 agentów bez verify i kończy interaktywnym pytaniem (łamiąc autonomiczność). User w scenariuszu ręcznym dostaje słabszy review niż myśli.
**Fix:** albo SKILL.md → cienki wrapper wołający `Workflow({scriptPath: '.claude/workflows/...-wf.js'})`, albo jawne oznaczenie legacy + korekta README.

**13. README — tabela reviewerów i przypisania agentów** — tabela "7 równolegle" listuje 8 agentów; `code-simplicity-reviewer` jest całkowicie osierocony (zero wywołań w repo), `auto-error-resolver` to mechanizm hooka, nie review; `web-research-specialist` przypisany do dev-plan, którego dev-plan nie woła.
**Fix:** poprawić tabele README albo faktycznie podłączyć osierocone agenty (code-simplicity-reviewer był w compound-engineering częścią review — decyzja do podjęcia).

**14. Martwe referencje plikowe** — `dev-docs-complete/SKILL.md:35-36` bezwarunkowo każe edytować nieistniejące `.claude/rules/best-practices.md` i `troubleshooting.md` (workflow-odpowiednik już poprawiony — skill nie); `zroastuj-mnie/SKILL.md:21` czyta `docs/archive/` zamiast `docs/completed/` (research przed roastem zawsze pusty).
**Fix:** podmiana na `learned-patterns.md`/generyczne `.claude/rules/` oraz `docs/completed/`.

### Aktualność stacku frontend

**15. `react-router-dom` w ux-ui-guidelines** — `patterns.md:38,58,512`, `responsive-design.md:554` importują z deprecated pakietu (usunięty w React Router v8, wydanym 2026-06-17), podczas gdy tailwind-react-guidelines poprawnie używa `react-router`. Projekt wg tailwind-guidelines nie będzie miał `react-router-dom` w node_modules → zepsuty import.
**16. TypeScript "aktualna: 5.9"** — `typescript-standards.md:3`; stan faktyczny: TS 6.0 GA (strict domyślnie, target min. przesunięty, ES5 usunięty) i TS 7.0 (natywny kompilator Go, GA 2026-07-08; ekosystem czeka na 7.1). Warto dodać wskazówkę 6.x vs 7.0.
**17. React Router "v7" w nagłówku** — `file-organization.md:117`; v8 podnosi minima (Node 22.22+, React 19.2.7+, Vite 7+) — kod działa, etykieta i minima do aktualizacji (sceptycy: P3, ale robić razem z #15).

### Aktualność stacku backend (poza P1 #5)

**18. Wzorce JWT uczą tylko `getUser()`** — `edge-functions.md:118-175`, `auth-security-patterns.md:112-168`, mimo że `auth-patterns.md:217-229` i oficjalne docs Supabase rekomendują `getClaims()` server-side (szybsze, bez sieci, przy asymetrycznych kluczach — domyślnych dla nowych projektów od **1 października 2025**, nie "maja 2025" jak twierdzi auth-patterns.md:227).
**19. `@sentry/deno` + `Deno.serve`** — skill kategorycznie twierdzi "ograniczenia nieaktualne", a aktualna oficjalna dokumentacja Supabase nadal zaleca `defaultIntegrations: false` z powodu braku scope separation. Złagodzić i dodać flagę do wzorca init.
**20. `npm:zod@3` w Edge Functions** — `auth-security-patterns.md:213`, `edge-functions.md:81` vs Zod v4 jako standard reszty stacku (różnice API `.extend()`/`.merge()`, format błędów) — ryzyko przy współdzieleniu schematów UI↔Edge.

---

## P3 — drobiazgi i szanse (opcjonalne)

- **Pole frontmatter `paths` w skillach technicznych** — deterministyczny auto-scoping (tailwind/supabase/ux-ui/security/sentry) wg wzorców plików; obecnie triggering czysto opisowy.
- **Natywna pamięć subagentów (`memory: project`)** — uzupełnienie docs/solutions/ dla agentów research/builderów.
- **Routing reviewerów wg mapy zmian** — context-packager już buduje `pliki[]`, orkiestrator mógłby ciąć 8-9 agentów do 4-5 na małych fazach (sceptycy: ostrożnie — security/spec/test zostawić zawsze; realny zysk tylko na performance/architecture).
- **Telemetria runów** — dane do strojenia progów są w journalu harnessu (labels/phases), ale brak pre-agregowanego podsumowania per-run; 1 linia JSONL na koniec autopilota (haiku, jak zapiszStan) załatwia temat.
- **Dedup findingów po `opis.slice(0,60)`** — nie sklei parafraz między reviewerami; dwa różne findingi z `plik:"?"` może błędnie scalić. Znane ograniczenie — odnotować.
- **Build `partial` nie przerywa** — `execute-wf` łapie `blocked`/null, ale `partial` przechodzi do domknięcia jako komplet; w serialu kolejne IU startują na niedokończonej pracy.
- **`historia[faza]`** miesza number i string (`'1 (graceful P2)'`) — utrudnia programową konsumpcję.
- **`complete-wf` null → autopilot zwraca `status:'OK'`** mimo braku archiwizacji (resume dokończy, ale status myli).
- **`wersja: 1` w stanie** nigdy nie jest czytana — brak guardu migracji schematu stanu.
- **`BLOK_DLUGIE_KOMENDY` w 3 kopiach** ("synchronizuj ręcznie") — obecnie zsynchronizowane, latentny dryf.
- **`useOptimistic` poza transition** — skille mówią "React rzuci błąd", w praktyce to warning + revert, nie wyjątek.
- **Legacy `dev-autopilot` MAX_FIX_CYKLI=2** — to celowo inna architektura (fix→re-review), nie błąd; dopisać jedno zdanie wyjaśnienia w README, nie zmieniać na 1.
- **`dev-compound-refresh` Faza 1.5 (`docs/solutions/patterns/`)** — nie martwa (learnings-researcher czyta patterns/), ale brak guardu "pomiń gdy nie istnieje" jak w Fazie 1.7.
- **`MultiEdit` w tools auto-error-resolver** — przestarzała nazwa narzędzia (naprawi się przy #3).

---

## Co zweryfikowano i jest ZDROWE

- Użycie **Dynamic Workflows** (`Workflow({scriptPath, resumeFromRunId})`, `agentType`, schematy) zgodne z aktualną dokumentacją; frontmattery skilli i agentów (`disable-model-invocation`, `model: inherit`, `skills:`) poprawne wg docs z lipca 2026.
- **Zero `Date.now`/`Math.random`/`new Date`** w workflowach — resume-safe.
- Liczba reviewerów (7), konsensus sceptyków (`P1=3, P2=1`, korekta severity tylko większością), obsługa 0 głosów, gate'y liczone w JS z `findings[]` — wszystko zgodne kod↔README↔meta.
- Null-guardy kompletne poza jednym wyjątkiem (P1 #4); bariery `parallel` wszystkie uzasadnione; zagnieżdżenie workflow ≤1 poziom.
- Stan `.autopilot-state.json` jako źródło prawdy + checkboxy jako widok — spójnie zaimplementowane (z zastrzeżeniem #6 o resume).
- Pętla wiedzy **CONCEPTS.md domyka się** (writer dev-compound → readerzy dev-plan/dev-docs/buildery/learnings-researcher — potwierdzone grepem). Luka dotyczy tylko learned-patterns (#10).
- Skille techniczne w większości **zaskakująco aktualne**: OWASP Top 10:2025, RLS `(SELECT auth.uid())`, `app_metadata` vs `user_metadata`, Zod v4 w warstwie form, Motion rename, Vitest 4, React Compiler 1.0, WCAG 2.2, Deno 2.x, Sentry React SDK v10, Supavisor — zgodne z oficjalnymi źródłami.

---

## Sugerowana kolejność wdrożenia

| Krok | Zakres | Wysiłek |
|------|--------|---------|
| 1 | P1 #1-4: nazwa skilla Figma, ścieżka brainstorms, auto-error-resolver, null-guard plannera | ~godzina, czysto mechaniczne |
| 2 | P1 #5 + P2 #15-20: aktualizacje wersji/wzorców w skillach technicznych (stripe, router, TS, zod, getClaims, sentry) | pojedyncza sesja "audyt skilli" jak 2026-07-06 |
| 3 | P2 #12-14: decyzja skille-legacy vs wrappery na workflowy + porządki README/martwe referencje | wymaga decyzji kierunkowej |
| 4 | P2 #6-11: resume/cache-busting, scribe-fallback, targeted post-fix verify, hook console.log, readerzy learned-patterns, warmup-degradacja | zmiany w workflowach — po każdej smoke-test z `.claude/templates/smoke-autopilot/` |
| 5 | P3 wg uznania (najciekawsze: `paths` w skillach, telemetria JSONL, guard w refresh 1.5) | opcjonalne |
