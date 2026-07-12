# Plan naprawy po review 2026-07-12

Źródło: `docs/reviews/2026-07-12-review-workspace-template.md`. Status: ZATWIERDZONE = user potwierdził; OCZEKUJE = czeka na decyzję usera.

## P1 — zatwierdzone akcje

### A1. [WYKONANE] Import skilla Figma design-to-code do szablonu
- Skopiuj `~/.claude/plugins/cache/claude-plugins-official/figma/2.2.78/skills/figma-design-to-code/SKILL.md` → `.claude/skills/figma-design-to-code/SKILL.md` (najnowsza wersja pluginu).
- Podmień referencje `figma:figma-implement-design` → lokalny `figma-design-to-code` w: `feature-builder-ui.md:4,37`, `feature-builder-fullstack.md:4`, `dev-plan/SKILL.md:414,416`.
- Dzięki lokalnej kopii szablon działa też w projektach bez zainstalowanego pluginu Figma.

### A2. [OCZEKUJE — po wyjaśnieniu] Ujednolicenie ścieżki brainstorms
- Zamień `docs/dev-brainstorms/` → `docs/brainstorms/` w: `dev-brainstorm/SKILL.md:52,248,309,323`, `dev-docs-review-wf.js:180`, `dev-docs-review/SKILL.md:90`.

### A3. [WYKONANE] Usunięcie auto-error-resolver
- Usuń plik `.claude/agents/auto-error-resolver.md` (treść obcego projektu "Piszemy Wirale").
- Posprzątaj referencje: `.claude/hooks/stop-build-check-enhanced.sh` (linie ~64, 78 — sugestia uruchomienia agenta) + wiersz w tabeli agentów w `README.md` (i licznik "16 agentów" → "15").

### A4. [WYKONANE] Null-guard plannera
- `dev-docs-execute-wf.js:184` — przed odczytem `plan.poza` dodaj: `if (!plan) return { fazaNumer: faza, status: 'blocked', iu: [], commity: [], testy: 'n/a', odchylenia: [], problem: 'planner zwrocil null (agent padl/pominiety)' }`.
- Po zmianie: smoke-test z `.claude/templates/smoke-autopilot/`.

### A5. [WYKONANE] Aktualizacja Stripe + przykład Sentry webhook
- `npm:stripe@18` → `npm:stripe@22` (8 wystąpień: `supabase-dev-guidelines/SKILL.md:39,168` + `resources/edge-functions.md:78,90,105,168,185,266,269`) + spójny `apiVersion` (`2026-06-24.dahlia`).
- `sentry-integration/resources/edge-functions-sentry.md`: przykład webhooka (linie ~172-181, też 244, 451) z `esm.sh/stripe@17` + `apiVersion 2024-12-18.acacia` → `jsr:@supabase/supabase-js@2` + `npm:stripe@22` + aktualny apiVersion.
- Korekta wpisu w changelogu README ("Stripe v18" było nieaktualne już 2026-07-06).

## P2 — zatwierdzone akcje

### B5. [WYKONANE] Targeted verify po fixie (zamiast czystego self-reportu)
- `dev-autopilot-wf.js`: po fixie, dla każdego findingu **P1 typu KOD** z `faza.otwarteFindingi` — 1 agent adversarial-verify ("czy ten finding jest nadal otwarty w kodzie po commicie fix"). Gate P1 liczony z werdyktów zamiast wyłącznie `fix.nierozwiazaneP1`. Koszt ~liczba P1.
- Po zmianie: smoke-test.

### B6. [WYKONANE] Aktualizacje frontend
- `react-router-dom` → `react-router`: `ux-ui-guidelines/resources/patterns.md:38,58,512`, `responsive-design.md:554`.
- Nagłówek "React Router v7" → "v8" + notka o minimach (Node 22.22+, React 19.2.7+, Vite 7+): `tailwind-react-guidelines/resources/file-organization.md:117`.
- TypeScript: `typescript-standards.md:3` — "aktualna: 6.0; TS 7.0 (natywny) w adopcji ekosystemu (Vue/Svelte/Astro czekają na 7.1)" + zmiany domyślnych w 6.0 (strict=true, ES5 usunięty).
- `npm:zod@3` → `npm:zod@4`: `security/resources/auth-security-patterns.md:213`, `supabase-dev-guidelines/resources/edge-functions.md:81`.
- `getClaims()` jako preferowany wzorzec obok `getUser()`: `edge-functions.md` (Weryfikacja JWT), `auth-security-patterns.md` (JWT Verification) + korekta daty "maja 2025" → "1 października 2025" w `auth-patterns.md:227`.

## P2 — oczekujące na decyzję usera (z rekomendacją)

### B1. [WYKONANE] Resume vs cache agent() — `dev-autopilot-wf.js` (workflow, nie skill)
- Rekomendacja: licznik prób w stanie (`stan.proby`) doklejany do promptów agentów bramkowych (warmup, e2e-env-up, fix, walidacja) = cache-busting; + korekta komunikatów STOP.

### B2. [WYKONANE] Martwy hook console.log/Sentry
- Rekomendacja: wciągnąć check do promptu domknięcia fazy w `dev-docs-execute-wf.js` (deterministycznie, jak TSC); hook Stop zostaje dla sesji ręcznych.

### B3. [WYKONANE] learned-patterns.md bez readerów
- Rekomendacja: krok "Przeczytaj `.claude/rules/learned-patterns.md` (jeśli istnieje)" w plannerPrompt (execute-wf), reviewerPrompt (review-wf) i sekcji 1.x builderów `feature-builder-*.md` (analogicznie do CONCEPTS.md).

### B4. [WYKONANE] Skille /dev-docs-review i /dev-docs-execute wykonują starszą procedurę
- Rekomendacja: przerobić oba SKILL.md na cienkie wrappery wołające `Workflow({scriptPath: ".claude/workflows/..."})` — jedno źródło prawdy mechaniki, ścieżka ręczna = ta sama jakość co autopilot.

### B7. [WYKONANE] Awaria scribe'a → `review=done` bez raportu review-faza-N.md
- Rekomendacja: przy fallbacku scribe'a ponowić samego scribe'a 1×; jeśli znów padnie — nie oznaczać review jako done (resume dokończy zapis raportu).

### B8. [WYKONANE] Warmup: twardy STOP całego runu na progu maszyno-zależnym (<60s)
- Rekomendacja: degradacja z ostrzeżeniem zamiast STOP (warmup to optymalizacja, nie warunek poprawności).

### B9. [WYKONANE] README: tabela reviewerów (8 zamiast 7) + osieroceni agenci
- `code-simplicity-reviewer` — nigdzie nie wołany; `web-research-specialist` — przypisany do dev-plan, którego dev-plan nie woła.
- Rekomendacja: poprawić tabele README + zdecydować: podłączyć osierocone agenty (np. code-simplicity-reviewer jako 8. reviewer, web-research-specialist do dev-brainstorm/dev-ideate) albo usunąć.

### B10. [WYKONANE] Martwe referencje plikowe w skillach
- `dev-docs-complete/SKILL.md:35-36`: nieistniejące `best-practices.md`/`troubleshooting.md` → zamienić na `learned-patterns.md` / generyczne `.claude/rules/`.
- `zroastuj-mnie/SKILL.md:21`: `docs/archive/` → `docs/completed/`.

### B11. [WYKONANE] Kategoryczny claim `@sentry/deno` + `Deno.serve`
- `sentry-integration` twierdzi "ograniczenia nieaktualne"; oficjalne docs Supabase nadal zalecają `defaultIntegrations: false`.
- Rekomendacja: złagodzić claim + dodać `defaultIntegrations: false` do wzorca init (bezpieczny default).

## C. [WYKONANE] Follow-up: sync skilla agent-browser z upstream (2026-07-12)

Audyt wykazał: skill był na poziomie ~0.26, upstream 0.31.1 (werdykt: ISTOTNIE PRZESTARZAŁY). Wykonano:
- CLI zaktualizowane globalnie 0.26.0 → **0.31.1** (`agent-browser doctor`: 5 pass / 1 warn / 0 fail). Uwaga: paczka deklaruje node >=24, lokalnie 22.22.3 — działa, warning zniknie po podbiciu Node.
- `references/` podmienione 1:1 z binarki (`agent-browser skills get core --full`) + NOWY `trust-boundaries.md` (bezpieczeństwo: untrusted content, sekrety, HAR z tokenami). 8/8 plików.
- `SKILL.md` re-adaptowany po polsku: `--session <id> --restore` + `session id --scope worktree` (stary `--session-name` = legacy), taby `t2`/etykiety zamiast indeksów, nowe komendy (`read`, `doctor`, `vitals`, `react *`, `pushstate`, `frame @eN`, `dialog status`, `cookies set --curl`), sekcja Working Safely.
- `templates/*.sh` — zweryfikowane diffem: bajtowo identyczne z upstream 0.31.1, bez zmian.
- `feature-tester-e2e.md` — preflight `agent-browser doctor --offline --quick` (fail = bloker OPERATOR, nie defekt kodu).
- `ZRODLA-SZABLONU.md` — dodane upstream repo vercel-labs/agent-browser + procedura aktualizacji Z BINARKI (nie przez klonowanie; upstream wersjonuje skill razem z CLI).

## D. [WYKONANE] Follow-up 2: mechanizmy z warstwy 3 review (2026-07-12)

- **Routing reviewerów** (`dev-docs-review-wf.js`): rdzeń (security/typescript/spec/simplicity/test/E2E) zawsze; `performance-oracle` i `architecture-strategist` warunkowo na małych fazach (≤2 pliki; perf gdy diff dotyka hooks/lib/query/SQL, arch gdy nowy moduł). Brak mapy zmian = pełny skład.
- **Dedup 2-przebiegowy** (`dev-docs-review-wf.js`): JS (klucz tekstowy) + agent semantyczny na Haiku (grupuje parafrazy tego samego problemu; konserwatywny — "w razie wątpliwości NIE łączyć"; pad agenta = zostaje wynik JS).
- **`/freshness-audit`** (nowy skill + `freshness-audit-wf.js`, zbudowany przez agenta na Opusie): cykliczny audyt skilli technicznych w ŻYWYCH źródłach (zakaz pamięci modelu, każde ustalenie z URL) → adversarial verify → raport `docs/reviews/freshness-<data>.md`. Nic nie zmienia sam.
- **Telemetria** (`dev-autopilot-wf.js`): na końcu udanego runu leaf-agent (Haiku) dopisuje 1 linię JSONL do GLOBALNEGO `~/.claude/telemetry/autopilot-runs.jsonl` (pola: ts, projekt, zadanie, fazy, per-faza liczniki P1/P2/P3 + wynik fix + gate + tokeny). Wariant globalny wybrany świadomie: dane do strojenia progów szablonu muszą być w jednym miejscu między projektami. Best-effort — pad zapisu nie zagraża runowi.
- Pozostałe drobne: zdanie o legacy `dev-autopilot` w README, pola `paths` w 3 skillach guideline (tailwind/ux-ui/supabase; celowo NIE w security/sentry — to skille intencyjne), korekta opisu `useOptimistic` (warning + revert, nie błąd).

## Zasady wykonania
- Zmiany w `.claude/workflows/*-wf.js` (A4, B5, ew. B1/B7/B8) → po każdej smoke-test z `.claude/templates/smoke-autopilot/`.
- Bez commitów, dopóki user nie poprosi.
