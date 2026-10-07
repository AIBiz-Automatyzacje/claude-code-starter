# PLAN-POPRAWY — poprawa całego szablonu wg ustaleń analizy (paczki P0–P16)

**Data:** 2026-09-30. **Status:** ZAAKCEPTOWANY 2026-09-30 (HANDOFF 6a pkt 41; operator: „Akceptuję plan, decyzje 1–3 wg rekomendacji”) — §6 D-1, D-2, D-3
wg rekomendacji. W sesji planu zero zmian w `.claude/` i CLAUDE.md. **Wersja dla operatora:** `PLAN-POPRAWY-DLA-OPERATORA.md`.
**Podstawa:** HANDOFF 6a pkt 1–40 (zwłaszcza 20, 25, 26, 34, 36–40) i §7; PANEL-WYNIK §2–§5 (rekordy D2–D12, cofnięte ustalenia, tabela iteracji z 3a–3e i R1,
§4a — 65 pozycji, docelowy pipeline); PANEL-WEJSCIE §2, §2a, §7, §10; PROMPT-AUDIT (PA-01…PA-44) + `dane/pa-proponowany.diff` (62 hunki, `git apply --check`
na HEAD 95e8763 = OK, autopilot z przesunięciem −111 linii); INSPIRACJE-POCOCK-PSTACK; IT1-ODCZYT §5–6; KROK0-DECYZJE „WYMÓG OPERATORA” i pkt 8; ETAP1B §2–§4.
**Kontrola kompletności (skrypt, w obie strony):** `skrypty/plan_poprawy_pokrycie.py` → `dane/plan-poprawy-pokrycie.txt`, `dane/plan-poprawy-mapa.csv`
(każda pozycja źródłowa → paczka albo „wypada” z powodem), `dane/plan-poprawy-pliki.txt` (plik → paczki). Przegląd niezależnego subagenta — §8.
**Tagi:** `[ID]` przy każdej pozycji = identyfikator pozycji źródłowej z rejestru skryptu (mapa ID → źródło: `dane/plan-poprawy-mapa.csv`). `Pozycje:` = przypisanie
(każda pozycja dokładnie raz w całym planie); tagi w `Zakres:` = uzasadnienie punktu (każdy punkt planu ma co najmniej jeden).

---

## 0. Wniosek

1. **17 paczek w 4 grupach**, wykonywanych jedna po drugiej (6a pkt 40): **I. porządek i koszt** (P0–P5), **II. mechanika fazy** (P6–P9), **III. prompty i wiedza**
   (P10–P12, ze ślepym testem), **IV. planowanie, E2E, ogrodnik, zamknięcie** (P13–P16). Szacunek: **32–38 sesji** (w tym 3 sesje ślepych testów i przeróbki ich harnessu), **15 smoke'ów**.
2. **Kolejność = zależności i ryzyko:** najpierw zmiany bez zmiany zachowania i największa dźwignia kosztu (allowlista — w modelu kosztu sama −40,2% zadania,
   `dane/raport-koszt-po.txt`; część zysku zrealizował KROK 0: start opus 114–136k → 73–84k, P3 zbija dalej do celów 9–38k), potem mechanika fazy od najbezpieczniejszej (bramki, dossier) do przekrojowej (pętla fix, sceptycy), na końcu prompty ról.
3. **Każdy plik roli pisany raz:** 62 hunki prompt-auditu rozdzielone między paczki wg właściciela fragmentu pliku. Treść plików reviewerów (PA-01, 02, 05, 06, 07,
   39, 40 + listy + warstwa stała) — wyłącznie P11; builderów (PA-17, 24, 44 + D10 + warstwa stała) — wyłącznie P12. Wcześniejsze paczki ruszają w tych
   plikach tylko frontmatter (P3: `tools:`, opisy) i kilkulinijkowe łaty: fakty spójne z allowlistą (PA-12, PA-19 — P3), usunięcie kroku 1.7 razem z przeniesieniem
   learned-patterns (PA-27 — P10, tak każe źródło) oraz **cztery poprawki faktów, które dziś dają fałszywe findingi** (PA-03 memoizacja, PA-04 `getSession()`,
   PA-09, PA-20 — P1; wyjątek po przeglądzie: bez nich każdy smoke P3–P10 płaci za fałszywe uwagi, a 6a pkt 25 (a) kieruje je do pierwszej iteracji). P11 przepisuje
   pliki od zera, zachowując te poprawki. Hunk, którego fragment wcześniejsza paczka przepisuje, wchodzi jako treść, nie łata (§1).
4. **Kompletność:** każda pozycja z historii ustaleń ma paczkę albo jawne „wypada / zrobione / bez zmian / odłożone” z powodem (§5) — wynik skryptu w §8.
5. **Trzy decyzje do operatora (§6), rekomendacje:** ślepe testy ZOSTAJĄ, ale jako dwa testy (reviewerzy: stare i nowe pliki na 7 fazach testu review,
   jeden przebieg sędziego; buildery na 1–2 fazach), ~45–60 M; push po każdej zamkniętej grupie; smoke po każdej paczce zmieniającej workflowy.
6. **Przegląd niezależnego subagenta** (25 uwag, 1 blokująca) naniesiony — §8.

---

## 1. Jak wykonujemy każdą paczkę (zasady wspólne)

- **Pozycje:** [6a-40-1] [W4-N2] [F-tests] [PW60] [PW35] [H-a] [6a-25-a] [6a-36-a] [6a-25-klasy]
- **Zakres:**
  - Nowa sesja na paczkę (N2: instrukcje i skille są buforowane w sesji); gałąź `popr/Pn-<nazwa>` z main; merge `--ff-only` do main dopiero po zielonym smoke'u. [W4-N2] [6a-40-1]
  - Kolejność pracy w paczce: test → kod → `pnpm typecheck` → `pnpm test` → `pnpm lint` → commit (po polsku, Conventional); testy przypinające zmieniane zachowanie
    (np. `sceptycy-p2.test.mjs:157`) zmieniane jawnie i nazwane w commicie jako zmiana kontraktu, nigdy osłabienie asercji. [F-tests] [PW60]
  - Logika deterministyczna, którą wykonuje agent (bramki, dossier, wiedza, generator planu, ogrodnik, doctor) = moduły w `.claude/scripts/<obszar>/` ≤ 300 linii
    z testami node; logika orkiestracji w workflowach = funkcje czyste testowane ekstrakcją (wzór `__tests__/kontrola-fixa.test.mjs`). [F-tests]
  - Hunki prompt-auditu: `git apply --include=<plik>` bierze CAŁE pliki (w `dev-docs-review-wf.js` hunki należą do P1, P7, P8, P14), więc pojedynczy hunk wycina
    skrypt `skrypty/pa_hunk.py H<nn>` (P0) → `git apply --check` → `git apply`. Hunk wchodzi jako ŁATA tylko, gdy jego pojedyncze `--check` przechodzi i kierunek
    zgadza się z paczką; inaczej jako TREŚĆ (cel: usunąć archeologię, brzmienie wg paczki). Z góry jako treść: H44, H45 (opcje `agent()` zmienione w P3), H40, H52, H53,
    H62 (utrwalają „P3 do naprawy”, P8 to odwraca), H48 (decyzje idą do `docs/decisions/`, P4), H50 (wycinek zamiast całości, P10); H59, H60 wypadają razem
    z `kontekstPrompt` (P7). Grupa (a) prompt-auditu nie jest osobną paczką — jej hunki idą do właścicieli plików. [H-a] [PW35] [6a-25-a]
  - Telemetria: paczka, która produkuje pole z placeholdera `.claude/scripts/telemetria/faza.mjs:162-168` (bramki, sceptyk, wiedza, dossier_zn, testy_usuniete),
    dopisuje producenta + test; `WERSJA_REKORDU` (`zbieranie.mjs:16`) podbija TYLKO przy zmianie logiki pól, które już mają wartości w starych rekordach (nowe pole
    z nowych runów nie wymaga przepisania ~5,3 tys. starych rekordów). [F-tests]
  - Paczka dotykająca promptów: do P10 kontrola wzorców prompt-auditu na zmienionych plikach skryptem `skrypty/pa_inwentarz.py` (0 nowych trafień); od P11 test warstwy stałej;
    po P3 (pliki klas ról) i po P12 (pliki reviewerów i builderów) — skrypty `pa_*.py` w całości z kontrolą w obie strony; pełny `/claude-api prompt-audit` w P16. [H-a] [6a-25-klasy]
  - Smoke (paczka zmieniająca workflowy): kopia oferty-online skryptem z P0 (oferty = materiał do nauki, tylko kopie), operator uruchamia
    `/dev-autopilot-wf docs/active/smoke-autopilot` w osobnej sesji desktop otwartej w kopii, odczyt skryptem vs referencja (`wf_031f0eae-204`: 4,78 M, 31 agentów,
    19 min, gate CZYSTE, kontekst opus 73–84k, haiku 52k, efort 20× medium / 2× low; po P0 — nowa referencja R0). [6a-36-a]
  - Cofnięcie domyślne: przed merge'em porzucić gałąź; po merge'u `git revert` zakresu commitów paczki + `sync-template` w projektach. Wyjątki w paczkach. [6a-40-1]
  - Po paczce: HANDOFF (§2, 6a, §8 → instrukcja następnej), pamięć projektu, commit `docs/reviews`. [6a-40-1]
  - **Progi „względem B0”** (PANEL-WYNIK §2/§4): B0 nie jest zbierany (6a pkt 40 (5)) — odczyt względem pierwszych 5 PR nowego projektu po poprawie, wrześniowe
    liczby `dane/d5b-mapa-walidacji.txt` = tło; progi bezwzględne (np. spec ≥ 4, test ≥ 12 B P1/P2) bez zmian. Progi to materiał do odczytu, nie bramki wdrożenia. [6a-40-2] [6a-40-5]

---

## 2. Kolejność

| paczka | grupa | ryzyko (mapa §6) | zależy od | smoke | ślepy test | sesje |
|---|---|---|---|---|---|---|
| P0 Siatka bezpieczeństwa | I | — | — | tak (nowa referencja R0) | — | 1 |
| P1 Porządki i usunięcia | I | R1 | P0 | tak | — | 1 |
| P2 Instalacja per projekt i doctor | I | R1 | P0 | nie (doctor w skrypcie kopii) | — | 2 |
| P3 Kontekst i efort agentów | I | R1 | P1, P2 | tak | — | 2 |
| P4 Start i koniec runu | I | R1 | P2 | tak | — | 1–2 |
| P5 dev-pr i bot | I | R1 | P4 | tak (bootstrap: warunek decyzji) + kalibracja na starych PR | — | 2 |
| P6 Skrypt bramek domknięcia | II | R2 | P2, P3 | tak | — | 2–3 |
| P7 Dossier i stan fazy ze skryptu | II | R2 | P6 | tak + wznowienie po STOP | — | 2 |
| P8 Pętla fix | II | R3 | P6, P7 | tak | — | 2 |
| P9 Sceptycy | II | R3 | P8 | tak | kill rate na archiwum przed merge'em | 1–2 |
| P10 Wiedza projektu | III | R3 | P7 | tak | — | 2–3 |
| P11 Reviewerzy | III | R2 | P6, P7, P9, P10 | tak | tak (przed merge'em) | 3 + 2 |
| P12 Buildery i reguły kodu | III | R3 | P10, P11 | tak | tak (przed merge'em) | 2–3 + 1 |
| P13 Planowanie (scalony dev-plan) | IV | R1 | P10, P12 | tak (plan + autopilot) | — | 2 |
| P14 E2E i skill weryfikacji | IV | R1 | P3, P4, P6, P7 | tak (STOP na starcie + test awarii w runie) | — | 2–3 |
| P15 Ogrodnik | IV | R1 | P10 | tak | — | 1 |
| P16 Zamknięcie serii | IV | — | wszystko | nie | — | 1 |

Zmiany względem PANEL-WYNIK §4 (6a pkt 40 — bez okien jakości): It. 3 i It. 6 w jednej paczce (P8, ten sam fragment autopilota); wiedza (It. 8) PRZED
reviewerami (It. 7) — ślepy test reviewerów widzi docelowy wycinek, a PANEL §4a A przewidział tę zamianę [A-lp-swap]; R1 rozpisane do paczek-właścicieli plików.
Smoke'i: P0, P1, P3, P4, P5, P6–P15 = **15** (P5 dostał smoke, bo przejmuje warunek bootstrapu z P4 — uwaga 13 przeglądu).

---

## 3. Paczki

### P0 — Siatka bezpieczeństwa

**Problem → przyczyna → co robimy → co da.** Każda paczka kończy się smoke'iem, a przygotowanie kopii to dziś ~10 ręcznych kroków (HANDOFF §7); fixture smoke'a
w monorepo wypada poza bramki i wymusza przypadkowy cykl fixa (IT1-ODCZYT §6); usunięcia i allowlista mogą zostawić martwe odwołania, których żaden test nie łapie.
Robimy skrypt kopii i odczytu oraz test spójności odwołań. Da: tani, powtarzalny smoke z porównaniem do referencji i pewność, że żadna paczka nie zostawi
odwołania do nieistniejącego skilla, agenta ani workflowu.
- **Pozycje:** [F-smoke] [PW62] [IT1-6a] [6a-40-3]
- **Zakres:**
  - Skrypt przygotowania kopii: klon lokalny, bez remote, bez `.env` i `supabase/.temp`, `pnpm install`, sync z lokalnego szablonu, commit syncu i fixture,
    `.claude/.backups/` do `.git/info/exclude` (HANDOFF §7, dwa ostatnie punkty). [F-smoke] [6a-40-3]
  - Fixture jako osobny pakiet workspace kopii (wykrycie `pnpm-workspace.yaml`), objęty jej `test`/`typecheck`, izolowany od zastanych błędów oferty (188 ESLint);
    celowy defekt łatwy do wykrycia: test niefalsyfikowalny (review złapał taki 3× P2 w smoke'u It. 1), żeby pętla fix była ćwiczona z wyboru, nie z przypadku monorepo.
    P6 dokłada do tego pakietu konfiguracje z `templates/bramki` i defekt mechaniczny. [IT1-6a] [PW62]
  - Skrypt odczytu `skrypty/smoke_odczyt.py <wf_id>` (uogólnienie `it1_odczyt.py`): koszt, agenci per rola, model i efort z transkryptu, `ctx_start` per klasa, status,
    gate — porównanie z referencją → `dane/smoke-<paczka>.txt`. [6a-40-3]
  - Skrypt `skrypty/pa_hunk.py H<nn>` wycinający pojedynczy hunk z `dane/pa-proponowany.diff` (`git apply --include` bierze całe pliki; `filterdiff` niezainstalowany). [F-smoke]
  - Test spójności odwołań: każde `agentType` w workflowach ma plik w `.claude/agents/` albo jest na liście wbudowanych (`general-purpose`), wartości z `enum`
    schematu `IU_PLAN` (`dev-docs-execute-wf.js:57`) też; każda ścieżka `.claude/skills/<x>/SKILL.md` i `.claude/rules/*` w workflowach, agentach i skillach istnieje;
    każde `workflow('<x>')` ma plik; każdy wpis `skills:` agentów istnieje lokalnie albo pochodzi z pluginu (`figma:`). [F-smoke]
- **Pliki:** `.claude/templates/smoke-autopilot/` (README, fixture, nowy `przygotuj-kopie.sh`), `.claude/workflows/__tests__/odwolania.test.mjs` (nowy),
  `docs/reviews/2026-09-19-analiza-pipeline/skrypty/smoke_odczyt.py`, `docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_hunk.py` (nowe)
- **Hunki:** —
- **Testy:** `odwolania.test.mjs` najpierw na podłożonym złym odwołaniu (porażka), potem zielony na dzisiejszym stanie; skrypt kopii — `bash -n` + bieg `--dry-run` w teście;
  `pa_hunk.py` — każdy z 62 hunków przechodzi `git apply --check` pojedynczo na HEAD albo trafia na listę „treść” z §1.
- **Smoke:** tak — kalibracja procedury; wynik = referencja **R0** dla kolejnych paczek, uruchomiona w sesji z przypiętym efortem `medium` (jak `wf_031f0eae-204`),
  bo porównania kosztu w P3 zależą od efortu sesji.
- **Cofnięcie:** revert; projekty nietknięte poza `templates/`.
- **Progi do odczytu:** — (narzędzie).
- **Sesje:** 1.

### P1 — Porządki i usunięcia

**Problem → przyczyna → co robimy → co da.** Szablon niesie 9 skilli i 1 workflow, których nikt nie używa (D6: porzucone, tryb ręczny zastąpiony autopilotem
3,5 mies. temu), a agenci w runie czytają SKILL.md trybu ręcznego; hook error-handling sprawdza wzorzec sprzed migracji Edge Functions; `.DS_Store` jedzie do projektów.
Usuwamy, treść czytaną w runie wklejamy do promptów. Da: krótsza lista skilli operatora i kursantów, mniej do utrzymania; koszt runu bez zmian (D6: 0,14% kontekstu).
- **Pozycje:** [G-usun] [6a-20-koszykD] [6a-20-ideate] [6a-20-reczny] [Z-koszykD] [Z-ideate] [Z-freshness] [Z-reczny] [J-reczny] [PW23] [PW24] [IT1-6c] [PA-18]
- **Zakres:**
  - Usunąć skille code-review, code-quality, gemini, dev-docs-update, bugfix, dev-ideate, freshness-audit oraz `.claude/workflows/freshness-audit-wf.js`; poprawić
    README (lista skilli, przepływ `README.md:114`, `:126`) i `learnings-researcher.md:256`. [G-usun] [6a-20-koszykD] [6a-20-ideate] [PW23] [PW24] [Z-koszykD] [Z-ideate] [Z-freshness]
  - Tryb ręczny: sekcje czytane w runie wkleić do promptów przed usunięciem skilli dev-docs-execute i dev-docs-review (`dev-docs-execute-wf.js:118` sekcje 2.5, 3, 3a;
    `:179` sekcja 4.5; `dev-docs-review-wf.js:698` sekcje 4, 4.5, 4.7), przepuszczone przez listę wzorców prompt-auditu (PROMPT-AUDIT §0 pkt 1). [6a-20-reczny] [Z-reczny] [J-reczny]
  - `sync-template` już usuwa w projekcie pliki usunięte w szablonie (`sync-template.sh:141-237`, REMOVE) — test, że usunięty skill znika z projektu. [G-usun]
  - `.DS_Store` z indeksu gita + wpis w `.gitignore`. [IT1-6c]
  - Hook `error-handling-reminder.sh`: warunek `withSupabase|Deno\.serve`, ostrzeżenie o `captureError` bez `await` (H26, H27) — łata do wycofania hooka w P6. [PA-18]
  - `dev-brainstorm/SKILL.md:9` — data z `date +%F` zamiast roku na sztywno (H28). [PA-11]
  - Cztery poprawki faktów, które dziś dają fałszywe findingi, jako łaty (wyjątek od „pliki reviewerów raz”, §0 pkt 3): memoizacja przy React Compilerze
    (H16, H17 w `performance-oracle.md`, fokus H56), `getSession()` po stronie serwera (H20 w `security-sentinel.md`), martwe osie w spec-compliance (H24),
    BLOK_SEMANTYKA bez odwołania do nieistniejącego opisu (H54, H55). P11 przepisuje te pliki od zera, zachowując poprawki. [PA-03] [PA-04] [PA-20] [PA-09] [S3-1]
- **Pliki:** `.claude/skills/code-review/`, `.claude/skills/code-quality/`, `.claude/skills/gemini/`, `.claude/skills/dev-docs-update/`, `.claude/skills/bugfix/`,
  `.claude/skills/dev-ideate/`, `.claude/skills/freshness-audit/`, `.claude/skills/dev-docs-execute/`, `.claude/skills/dev-docs-review/` (usunięte),
  `.claude/workflows/freshness-audit-wf.js` (usunięty), `README.md`, `.claude/agents/learnings-researcher.md` (tylko linia 256),
  `.claude/workflows/dev-docs-execute-wf.js` (planner :118, domknięcie :179 — wklejenie), `.claude/workflows/dev-docs-review-wf.js` (scribe :698 — wklejenie;
  fokus performance H56; `BLOK_SEMANTYKA` H54, H55), `.claude/agents/performance-oracle.md`, `.claude/agents/security-sentinel.md`,
  `.claude/agents/spec-compliance-reviewer.md` (tylko łaty H16, H17, H20, H24), `.claude/hooks/error-handling-reminder.sh`, `.claude/skills/dev-brainstorm/SKILL.md`,
  `.gitignore`, `.claude/skills/sync-template/scripts/__tests__/sync-template.test.mjs`
- **Hunki:** [H16] [H17] [H20] [H24] [H26] [H27] [H28] [H54] [H55] [H56]
- **Testy:** `odwolania.test.mjs` (P0) pada po usunięciu przed wklejeniem, zielony po; nowy przypadek w `sync-template.test.mjs`; test hooka na pliku z `withSupabase` (dziś bez ostrzeżenia).
- **Smoke:** tak — prompty planera, domknięcia i scribe mają wklejoną treść zamiast odwołania; oczekiwane jak R0 ±10%.
- **Cofnięcie:** revert; w projektach `sync-template` przywraca skille.
- **Progi do odczytu:** brak progu odwrotu; odczyt: lista skilli sesji (−9 pozycji), 0 odwołań do usuniętych plików (test).
- **Sesje:** 1.

### P2 — Instalacja per projekt i doctor

**Problem → przyczyna → co robimy → co da.** Użytkownik szablonu bez Supabase CLI, gh czy agent-browser dowiaduje się o tym w środku runu; po KROKU 0 Figma
nie jest globalna, więc projekt z szablonu jej nie dostaje; README nie mówi, co zainstalować. Przyczyna: brak systemu wymagań (6a pkt 12) i instalacja globalna
zamiast per projekt (6a pkt 37 d). Robimy doctor (bash, lista wyliczana z projektu), profil `.claude/settings.json` z pluginami per projekt, instrukcję instalacji
i bramkę CI zmian maszynerii. Da: brak w narzędziach wychodzi przed startem, nie w runie; kursant dostaje jeden przepis instalacji.
- **Pozycje:** [F-doctor] [PW17] [6a-37-d] [6a-37-d2] [6a-37-d3] [F-ci] [PW59] [6a-38-e2] [PWE-N2] [PW34]
- **Zakres:**
  - `doctor.sh`: git, gh + auth, node + menedżer z lockfile, jq (hooki), supabase CLI przy `supabase/`, agent-browser przy checkboxach [E2E], coolify przy konfiguracji
    Coolify, docker przy Dockerfile; tabela brak / wersja + komenda instalacji; kod wyjścia ≠ 0 przy braku obowiązkowego. [F-doctor] [PW17]
  - Doctor sprawdza też pluginy projektu (dev-browser, figma), Dynamic Workflows i świeżość telemetrii (skan `zbierz.mjs --skan`, gdy brak rekordów z ostatniej doby — O5). [6a-38-e2]
  - Wołany w sync-template (pierwsza instalacja) i dev-prep (checklista); w bootstrapie autopilota — P4. [F-doctor]
  - Profil `.claude/settings.json` wg KROK0-DECYZJE pkt 8: `extraKnownMarketplaces` dev-browser, `enabledPlugins` dev-browser + figma, `disableClaudeAiConnectors`;
    hooki i statusLine bez zmian. [6a-37-d]
  - README: „Instalacja” (per projekt: pluginy, narzędzia, Dynamic Workflows) i „Wymagania” (wynik doctor); wprost: `disableClaudeAiConnectors` działa tylko
    w terminalowym `claude`, w aplikacji desktop konektory wyłącza menu konektorów sesji Code, a pluginy claude.ai `"<nazwa>@inline": false` (decyzja kursanta). [6a-37-d3] [PW17]
  - Test na czystym koncie, czy wpisy projektu proponują instalację marketplace'ów i pluginów per projekt — jedyny krok operatora w P2. [6a-37-d2]
  - sync-template: komunikat końcowy „po zmianie `.claude/` otwórz nową sesję przed autopilotem” (N2) + wywołanie doctor. [PWE-N2] [PW34]
  - Bramka CI zmian maszynerii (GitHub Actions w repo szablonu): `pnpm typecheck && pnpm test && pnpm lint` + `claude plugin validate --strict` + `claude plugin eval`;
    najpierw sprawdzić, czy validate/eval działają na repo, które nie jest pluginem — jeśli nie, zostaje sam `pnpm`, a brak zapisany w HANDOFF z powodem. [F-ci] [PW59]
  - `dev-prep/SKILL.md`: krok doctor + data z `date +%F` (H38). [PA-11]
- **Pliki:** `.claude/scripts/doctor/` (nowy: `doctor.sh` + `__tests__`), `.claude/settings.json`, `README.md`, `.claude/skills/sync-template/scripts/sync-template.sh`,
  `.claude/skills/sync-template/SKILL.md`, `.claude/skills/sync-template/scripts/__tests__/sync-template.test.mjs`, `.claude/skills/dev-prep/SKILL.md`,
  `.github/workflows/maszyneria.yml` (nowy)
- **Hunki:** [H38]
- **Testy:** doctor na katalogach-fixture z podmienionym `PATH`: projekt z `supabase/` wymaga supabase CLI, bez — nie; checkboxy [E2E] → agent-browser; podłożony brak → exit ≠ 0
  → przywrócenie → exit 0 (odbiór jak bramka, A3); komunikat N2 w teście sync-template.
- **Smoke:** nie (workflowy bez zmian); doctor przechodzi w skrypcie kopii z P0.
- **Cofnięcie:** revert; `settings.json` projektów wraca przez sync.
- **Progi do odczytu:** STOP-y z przyczyny „brak narzędzia” w środku runu = 0 (kategorie STOP w raporcie telemetrii).
- **Sesje:** 2.

### P3 — Kontekst i efort agentów

**Problem → przyczyna → co robimy → co da.** Po KROKU 0 agent opus startuje z 73–84k tokenów, haiku z 52k, choć 498/514 agentów nie woła MCP; efort reviewerów
zależy od sesji, którą operator akurat otworzył (smoke: 20× medium). Przyczyna: `agent()` w Workflow nie ma opcji `tools:`, więc bez pliku agenta dziedziczy wszystko;
`TIERY_DOMYSLNE` ma `reviewer: null` (`dev-docs-review-wf.js:819`). Robimy pliki klas ról z allowlistą, `omitClaudeMd` u mechanicznych, efort jawny per klasa,
opisy workflowów-dzieci poza listą skilli. Da: największa dźwignia kosztu planu (w modelu allowlista −40,2% kosztu zadania, `dane/raport-koszt-po.txt`; część zysku
już dał KROK 0, reszta = spadek z 73–84k do celów 9–38k) i powtarzalny koszt review.
- **Pozycje:** [W4-3a-tools] [W4-3a-omit] [W4-3a-n1] [W4-3b] [D6-1] [D6-4] [R1-7] [D9] [D-d9-doctor] [D-tools] [D-mcp] [D-claude] [D-badacz] [D-corr] [E-904] [PW16] [PW26] [PW33] [PW37] [PW53] [PW55] [6a-34-c] [6a-25-c] [PA-22] [PA-25] [PA-31] [PA-35]
- **Zakres:**
  - Pliki klas ról (ustawienia + mandat 1–2 zdania): mechaniczny-haiku (`omitClaudeMd`, Read/Grep/Glob; Bash tylko roli, która go potrzebuje — N1),
    orkiestracyjny-opus (bez MCP), sceptyk (tylko odczyt), naprawiacz (Edit + skille); badacze — ta sama allowlista w 6 plikach. [W4-3a-tools] [D-tools] [W4-3a-omit] [6a-34-c]
  - Każde `agent()` w workflowach dostaje `agentType` klasy albo roli; `model: 'haiku'` przechodzi do pliku klasy. [W4-3a-tools]
  - 8 plików ról + nowe `correctness-reviewer.md` i `test-coverage-reviewer.md` (dziś correctness jedzie jako `general-purpose` ze wszystkimi narzędziami, test-coverage
    bez `agentType`): `tools:` z instalacji; Figma MCP tylko UI / fullstack / tester przy `figma_screens` (wariant pliku z Figmą wybierany przez orkiestrator), Supabase MCP
    tylko sesja główna, reszta bez `mcp__*`; treść plików reviewerów bez zmian do P11. [D-mcp] [D-corr] [PW16] [PW55] [E-904]
  - CLAUDE.md zostaje u builderów i reviewerów, `omitClaudeMd` tylko u mechanicznych (dedup, inspekcja, commit-artefaktów, env-down, precheck, stan). [D-claude] [W4-3a-omit]
  - Badacze (6 plików): allowlista bez Edit/Write, rok z `date +%F` (H07, H14, H18, H25), bez wzmacniaczy „Be systematic, thorough” (PA-35). [D-badacz] [PA-11] [PA-35]
  - Buildery UI i fullstack: nazwy narzędzi Figma wyliczone z instalacji pluginu z P2 i spójne z `tools:` (H08, H10, H11, H12); usunięty krok trybu ręcznego (H09);
    opisy trzech builderów „wywoływany przez dev-docs-execute-wf”. [PA-12] [PA-19] [PW26]
  - PA-25 — decyzja operatora przy wdrożeniu, rekomendacja: przejść na `figma:figma-design-to-code` z pluginu (plugin figma od P2 wymagany per projekt,
    `skills:` builderów już ma `figma:figma-use`), usunąć lokalną kopię i zdanie README:233 o pracy bez pluginu. [PA-25] [PW37] [6a-25-c]
  - Efort jawny (D6 krok 1 i 4): reviewerzy `high`, sceptyk P1 `high`, P2 `medium`, builder i naprawiacz `high`, orkiestracyjni `medium`, scribe `low`, haiku bez efortu;
    `TIERY_DOMYSLNE` i `sceptycy-p2.test.mjs:157` zmienione świadomie; wywołanie test-coverage z `zEffortem`/`agentType` (`:904`). [W4-3b] [D6-1] [D6-4] [R1-7] [PA-22] [E-904] [PW53]
  - D9: `disable-model-invocation` dla 4 workflowów-dzieci; `description` `dev-autopilot-wf` skrócony do routingu. Workflow nie ma SKILL.md — tryby wznowienia
    zostają w `meta.whenToUse` (`dev-autopilot-wf.js:4`), bo z nich sesja główna decyduje o `resumeFromRunId`; najpierw sprawdzić, które pola `meta` trafiają do listy
    skilli. Warunek wstępny — dokumentacja (claude-code-guide, jedno pytanie) i próbny run, że `workflow()` uruchamia dziecko z flagą; stale test w
    `klasy-rol.test.mjs` pilnuje flagi w `meta` dzieci, a doctor ostrzega, gdy flaga zniknie po syncu. [D9] [PA-31] [D-d9-doctor]
  - N1: zdanie „do agentów workflow: ta wiadomość nie jest dla was” w poleceniu startu — w `whenToUse` `dev-autopilot-wf` i w handoffie `dev-docs/SKILL.md:171`
    (jedna linia; P13 przenosi ją do scalonego dev-plan); N2: zdanie o nowej sesji po zmianach `.claude/` w `whenToUse`. [W4-3a-n1] [PW33] [PW34]
- **Pliki:** `.claude/agents/klasa-mechaniczny.md`, `.claude/agents/klasa-orkiestracyjny.md`, `.claude/agents/klasa-sceptyk.md`, `.claude/agents/klasa-naprawiacz.md`,
  `.claude/agents/correctness-reviewer.md`, `.claude/agents/test-coverage-reviewer.md` (nowe), `.claude/agents/security-sentinel.md`, `.claude/agents/performance-oracle.md`,
  `.claude/agents/architecture-strategist.md`, `.claude/agents/spec-compliance-reviewer.md`, `.claude/agents/feature-tester-e2e.md`, `.claude/agents/feature-builder-data.md`
  (frontmatter), `.claude/agents/feature-builder-ui.md`, `.claude/agents/feature-builder-fullstack.md` (frontmatter + H08–H12), `.claude/agents/best-practices-researcher.md`,
  `.claude/agents/framework-docs-researcher.md`, `.claude/agents/repo-research-analyst.md`, `.claude/agents/web-research-specialist.md`, `.claude/agents/learnings-researcher.md`,
  `.claude/agents/spec-flow-analyzer.md`, `.claude/workflows/dev-autopilot-wf.js` (opcje `agent()`, meta), `.claude/workflows/dev-docs-review-wf.js` (opcje, TIERY, :904),
  `.claude/workflows/dev-docs-execute-wf.js` (opcje), `.claude/workflows/dev-docs-complete-wf.js` (opcje), `.claude/workflows/dev-compound-wf.js` (opcje),
  `.claude/workflows/dev-pr-wf.js` (opcje), `.claude/workflows/__tests__/sceptycy-p2.test.mjs`, `.claude/workflows/__tests__/klasy-rol.test.mjs` (nowy), `README.md` (PA-25),
  `.claude/skills/dev-docs/SKILL.md` (linia handoffu N1), `.claude/scripts/doctor/` (ostrzeżenie o fladze D9)
- **Hunki:** [H07] [H08] [H09] [H10] [H11] [H12] [H14] [H18] [H25]
- **Testy:** `klasy-rol.test.mjs`: każde `agent()` ma `agentType` z istniejącym plikiem; każdy plik agenta pipeline'u ma `tools:`; `mcp__` tylko w wariantach z Figmą;
  mechaniczni mają `omitClaudeMd`; tiery = tabela D6 (najpierw czerwony); meta dzieci z flagą D9.
- **Smoke:** tak — oczekiwane: `ctx_start` per klasa w stronę celów PANEL-WYNIK §4 It. 3a (9–10k / 25–26k / 29k / 38k; dziś 73–84k i 52k); efort z transkryptu = tabela;
  model z transkryptu = plik klasy (haiku tam, gdzie był — opus zamiast haiku to ~4× koszt roli); koszt ≤ R0 mimo `high` u reviewerów (R0 na `medium`);
  0 odmów „brak narzędzia” w transkryptach; dzieci uruchomione mimo flagi D9.
- **Cofnięcie:** brak narzędzia w smoke'u → dopisać je do klasy (jedna linia), nie cofać paczki; D9 osobnym commitem (odwrót: skrócone opisy bez flagi).
- **Progi do odczytu:** cel `ctx_start` nieosiągnięty → poprawić plik klasy; spadek findingów osi > 30% → przywrócić narzędzia; efort: B P1/P2 osi ≥ próg → poziom wyżej,
  koszt klasy > +30% bez spadku B P1/P2 osi → poziom niżej; `workflow()` nie uruchamia dziecka albo operator traci komendę → opisy bez flagi.
- **Sesje:** 2.

### P4 — Start i koniec runu

**Problem → przyczyna → co robimy → co da.** CLAUDE.md oferty urósł 3,4k → 89,7k zn w 4 tygodnie, a każdy builder i reviewer go czyta; run startuje na czerwonym
main albo bez narzędzi; brudny katalog zadania zatrzymuje run; commit archiwizacji dostaje komunikat feature; PR z 222 plikami — bot odmówił recenzji.
Przyczyna: `dev-docs-complete/SKILL.md:115` i `dev-docs-complete-wf.js:160` każą edytować CLAUDE.md; bootstrap nie sprawdza ani main, ani narzędzi.
Robimy bootstrap z bramkami przed pierwszą fazą i archiwizację bez CLAUDE.md, z decyzjami w `docs/decisions/`. Da: CLAUDE.md nie puchnie, STOP-y środowiska
przed startem zamiast w środku runu.
- **Pozycje:** [A-cmd-complete] [A-cmd-decisions] [W4-3c-pr150] [W4-3c-zielony] [W4-3c-czystosc] [W4-3c-rek7] [F-zielony] [PW01] [PW02] [PW21] [PW65] [IT1-6b] [PWE-rek7-bak] [PWE-rek7-fazy] [PWE-rek7-stopka] [PWE-N3] [PA-38]
- **Zakres:**
  - Archiwizacja bez edycji CLAUDE.md i `.claude/rules/` (H33, H34, H48, H49); bez „Zapytaj…” i „🎉” w autopilocie (PA-38). [A-cmd-complete] [PW01] [PA-16] [PA-38]
  - Decyzje zadania z Dziennika → `docs/decisions/<data>-<zadanie>.md` z polem frontmattera `claude_md: do-uzgodnienia` + jedna linia indeksu
    `docs/decisions/README.md`. To jest kontrakt dla P5: dev-pr po merge'u zmienia pole na `uzgodniono`, bootstrap (P5) je sprawdza. H48 wchodzi jako treść
    (hunk pisze „decyzje zostają w podsumowaniu”). [A-cmd-decisions] [PW02]
  - Komunikat commita archiwizacji `docs(<zadanie>): archiwum`; rek. 7: pominąć `*.bak`, `fazyUkonczone` po stanie zadania, stopka commita STOP z pustą linią. [IT1-6b] [W4-3c-rek7] [PWE-rek7-bak] [PWE-rek7-fazy] [PWE-rek7-stopka]
  - Bramka PR ≤ 150 plików w archiwizacji: próg w JS, przekroczenie = UWAGA w podsumowaniu i wyniku runu z propozycją podziału (bot i tak nie zrecenzuje). [W4-3c-pr150]
  - Bootstrap autopilota, STOP z gotową komendą przed pierwszą fazą: doctor (P2), zielony main (testy na bazie gałęzi; wynik w stanie zadania z SHA bazy — świeży
    run po STOP-ie na tej samej bazie nie powtarza pełnych testów), bramka czystości: brudny wyłącznie katalog zadania → commit i dalej (rek. 4). Warunek
    „CLAUDE.md uzgodniony po ostatnim merge'u” — P5 (razem ze znacznikiem, który go zamyka). [W4-3c-zielony] [F-zielony] [PW21] [PW65] [W4-3c-czystosc]
    Wdrożenie (HANDOFF 6a pkt 48): „baza” = HEAD startu przy czystym drzewie, nie merge-base w worktree; cache `bazaZielona` trafia, gdy od SHA zmiany tylko w `docs/`.
  - N3 (builder idzie za `git status` z `session_context`) — czyste drzewo na starcie usuwa źródło, bez osobnej zmiany. [PWE-N3]
- **Pliki:** `.claude/workflows/dev-autopilot-wf.js` (bootstrap, STOP, `fazyUkonczone`), `.claude/workflows/dev-docs-complete-wf.js`, `.claude/skills/dev-docs-complete/SKILL.md`,
  `.claude/workflows/__tests__/start-koniec.test.mjs` (nowy)
- **Hunki:** [H33] [H34] [H48] [H49]
- **Testy:** decyzja bootstrapu (STOP / kontynuacja) dla: doctor FAIL, czerwony main, zielony main z cache po SHA, brudny tylko katalog zadania vs brudne poza nim;
  `fazyUkonczone`; stopka STOP; pathspec archiwizacji bez CLAUDE.md, bez `*.bak`, komunikat `docs(...)`; plik decyzji z polem `claude_md`.
- **Smoke:** tak — bootstrap PASS, plik w `docs/decisions/` z `claude_md: do-uzgodnienia`, CLAUDE.md nietknięty, commit `docs(smoke-autopilot): archiwum`.
- **Cofnięcie:** revert.
- **Progi do odczytu:** `faza.wiedza.claude_md_zn` nie rośnie poza krokiem po merge'u (P5); STOP-y środowiska w środku runu = 0 (przeniesione do bramki wejścia).
- **Sesje:** 1–2.

### P5 — dev-pr i bot

**Problem → przyczyna → co robimy → co da.** 574 uwagi bota na 19 PR, ~85% szumu konfiguracji (progi 300/50, wyjątki testowe, `as const`); tury 2–3 omijają
klasyfikację; brak rekomendacji merguj / nie merguj; CLAUDE.md aktualizowany w złym momencie. Przyczyna: generator `coderabbit-base.yaml` z progami 300/50
i nienadpisującymi się wyjątkami; dev-pr bezstanowy (ETAP1B §4). Robimy 8 zmian w generatorze, 4 zmiany dev-pr z sufitem 3 tur, krok CLAUDE.md po potwierdzonym
merge'u, kalibrację klasyfikatora. Da: jasna decyzja po każdej turze, mniej tur, porównywalny pomiar jakości (uwagi bota = miara całego planu).
- **Pozycje:** [W4-2a] [W4-2b] [W4-2c] [C-bot] [C-devpr] [A-cmd-merge] [A-cmd-bootstrap] [PW03] [PW04] [PW05] [PW27] [F-seedy-bot] [B-budzet-bot]
- **Zakres:**
  - Generator `coderabbit-base.yaml` + `stack-blocks.md`: 8 zmian ETAP1B §2 (próg rozmiaru 360/60 z tolerancją 20%, ten sam co ESLint w P6; wyjątek testowy i `texts.ts`
    w bloku głównym; `as const`/`satisfies` nie są assertion; rzutowania w atrapach poza uwagą; „jeden eksport per plik” tylko ekrany; `tone_instructions` bez AAA,
    docstringów i DRY w testach) + `e2e/seeds/*.sql` jako granica zaufania. [W4-2a] [C-bot] [PW27] [F-seedy-bot] [B-budzet-bot]
  - Skill `coderabbit-setup`: opis, jak konfigurować bota bez szumu (L19). [C-bot]
  - dev-pr: (1) `zbierz` w każdej turze, `napraw` odrzuca wątki bez tokenu tury (JS); (2) guard uzasadnień — nazwa dokumentu + ≥ 20 zn, bez alternatywy z backtickiem
    (`dev-pr-wf.js:278`); (3) `rekomendacja` w JS (MERGUJ / NIE MERGUJ — warunek / KOLEJNA TURA / DECYZJA OPERATORA) jako pierwszy wiersz raportu + zdanie w `zbierz`
    o ostatnim komentarzu bota; (4) raport = tabela per tura złączona po id z `watki[]`, `propozycjeDoReviewerow` do `docs/reviews/propozycje-do-reviewerow.md`
    commitowane w compoundzie; sufit 3 tur, tryb interaktywny zostaje. [C-devpr] [W4-2b] [PW04] [PW05]
  - Krok „uzgodnij CLAUDE.md z rzeczywistością” po POTWIERDZONYM merge'u (etap `merge` dev-pr): wejście = plik `docs/decisions/` zadania (P4), bramka rozmiaru CLAUDE.md
    w JS, na końcu pole `claude_md: uzgodniono`. [A-cmd-merge] [PW03]
  - Bootstrap autopilota na main: ostatni zmergowany plik `docs/decisions/` ma `claude_md: do-uzgodnienia` → STOP „uzgodnij CLAUDE.md” z komendą; brak katalogu
    (projekt sprzed zmiany) → ostrzeżenie, nie STOP. [A-cmd-bootstrap]
  - Generator bota odwołuje się do `coding-rules.md` przez jedną stałą (ścieżka zmieni się w P12). [C-bot] [F-cr]
  - Kalibracja: `pr:zbierz` na 2–3 starych PR oferty-online (odczyt) vs `dane/coderabbit/klasyfikacja-574.csv`; niezgodność → poprawić opis klas / schemat przed
    pierwszym PR nowego projektu. [W4-2c]
- **Pliki:** `.claude/skills/coderabbit-setup/SKILL.md`, `.claude/skills/coderabbit-setup/templates/coderabbit-base.yaml`, `.claude/skills/coderabbit-setup/templates/reviews/`,
  `.claude/skills/coderabbit-setup/reference/stack-blocks.md`, `.claude/workflows/dev-pr-wf.js` (zbierz, napraw, merge; w compound tylko zapis propozycji),
  `.claude/skills/dev-pr/SKILL.md`, `.claude/workflows/__tests__/dev-pr.test.mjs` (nowy), `.claude/workflows/dev-autopilot-wf.js` (bootstrap: warunek decyzji),
  `.claude/workflows/__tests__/start-koniec.test.mjs`
- **Hunki:** —
- **Testy:** guard (odrzuca sam backtick, przyjmuje dokument + 20 zn), token tury, `rekomendacja` dla czterech stanów, złączenie raportu po id, bramka rozmiaru CLAUDE.md,
  zmiana pola `claude_md`; bootstrap: `do-uzgodnienia` → STOP, `uzgodniono` → dalej, brak katalogu → ostrzeżenie; generator — walidacja YAML schematem CodeRabbit
  i test, że wyjątek testowy jest w bloku głównym.
- **Smoke:** tak (bootstrap: w kopii plik decyzji ze smoke'a P4 ma `do-uzgodnienia` → oczekiwany STOP z komendą; po zmianie pola — PASS) + kalibracja
  (agenci `pr:zbierz`, ~2–4 M); pełny przebieg dev-pr — pierwszy PR nowego projektu.
- **Cofnięcie:** revert; wygenerowane już `.coderabbit.yaml` projektów nietknięte (generator działa tylko przy `/coderabbit-setup`).
- **Progi do odczytu:** B P1/P2 bota na 100 plików (tło: import 6,7, d5b); tury na PR ≤ 3; `run.pr.rekomendacja` w każdej turze; kalibracja niezgodna z 1b → poprawić schemat `pr:zbierz`.
- **Sesje:** 2.

### P6 — Skrypt bramek domknięcia

**Problem → przyczyna → co robimy → co da.** Domknięcie fazy to agent z medianą 32 wywołań narzędzi, który „gra lintera”; pusty catch i edycja wypchniętej migracji
przechodzą do bota; test-coverage nie ma wejścia mechanicznego (dziś 1/12 testów niefalsyfikowalnych złapanych, z listą mutantów w C — 6/12). Przyczyna: brak zestawu
bramek i konfiguracji w szablonie (ETAP2 §2). Robimy jeden skrypt bramek z wynikiem JSON, konfiguracje dla nowego projektu i odbiór każdej bramki testem porażki;
hook error-handling znika. Da: tańsze i deterministyczne domknięcie; bot przestaje łapać rzeczy mechaniczne; mutanty i ostrzeżenia lint jako wejście reviewerów (P7, P11).
- **Pozycje:** [W4-4a] [W4-4a-granice] [W4-4a-odbior] [W4-4b-stryker] [D5] [D7-2] [F-migr] [F-cr2-pole] [R1-6] [PW28] [PW31] [PW42] [PW45] [PW48] [PW56] [6a-26-d] [6a-26-g] [6a-26-i] [INS-A3] [INS-B6] [INS-A1-lint] [PWE-ctx] [B-budzet-eslint] [PA-29] [PA-37]
- **Zakres:**
  - `.claude/scripts/bramki/` (moduły ≤ 300 l.): wykrycie narzędzi projektu; ESLint (error → naprawa w domknięciu, warn → lista dla code-quality), knip, size-limit,
    `tsc --noEmit`, `vitest --typecheck`, `migrations.sum`, niezmienność migracji (`git diff --name-only base..HEAD -- supabase/migrations/` ∩ pliki z base → porażka
    „popraw nową migracją”), advisors przez Management API na projekcie chmurowym (bez Dockera; brak tokenu → `status: brak`); wynik `{bramka: {status, sekundy, trafienia}}`. [W4-4a] [F-migr] [PW56] [PW31]
  - Stryker diff-scoped (`--mutate plik:od-do` z `git diff -U0` bazy fazy, pliki produkcyjne, których testy faza dotknęła) → lista przeżytych mutantów w JSON; score nie jest celem. [W4-4b-stryker] [D5]
  - Testy usunięte w fazie (diff `it(`/`test(`) → `testy_usuniete[]` (wyjątek w coding-rules — P12). [F-cr2-pole]
  - Konfiguracje dla nowego projektu `.claude/templates/bramki/`: `eslint.config.ts` (ESLint 10 flat, `recommendedTypeChecked` error, `strictTypeChecked` warn,
    `max-lines` 360/60 ze skip*, `import-x/order`, `import-x/no-cycle`, zakaz importu klienta Supabase w komponentach i ekranach bez wyjątku dla auth, `no-empty`,
    `no-floating-promises`, `no-console`, `react-hooks` v6+ z regułami kompilatora, reguły wtyczki vitest na słabe asercje), `knip.json`, `.size-limit.json`,
    `stryker.config.json`; instalacja devDependencies w README, obecność sprawdza doctor. [W4-4a-granice] [PW48] [6a-26-i] [INS-B6] [PWE-ctx] [INS-A1-lint] [B-budzet-eslint]
  - Odbiór każdej bramki: test na fixture z podłożonym naruszeniem — przejście → naruszenie → porażka z konkretną regułą → przejście. [W4-4a-odbior] [6a-26-d] [PW42] [INS-A3]
  - Lint a stary kod: nowy projekt dostaje konfigurację od pierwszego commita; każda późniejsza reguła (compound, ogrodnik) wchodzi razem z posprzątaniem starych miejsc. [6a-26-g] [PW45]
  - Domknięcie fazy (`domknieciePrompt`, `dev-docs-execute-wf.js:167`): uruchamia skrypt i naprawia wskazane, nie gra lintera; pkt 1b (audyt error-handlingu)
    zostaje; krok 3 (Dziennik) bez archeologii „od 2026-09-03” (H51). [D7-2] [PA-29]
  - Hook `error-handling-reminder.sh` wycofany warunkowo: kończy się od razu, gdy projekt ma `eslint.config.*` z szablonu (ESLint `no-console` + `no-floating-promises`
    przejmuje), a działa w projektach bez niej (starsze projekty; pierwsze wdrożenie ESLint = zadanie sprzątające, 6a pkt 26 g); przy okazji `stop_hook_active`
    w obu hookach Stop wg dokumentacji. [R1-6] [PW28] [PA-37]
  - Fixture smoke'a (pakiet z P0) dostaje konfiguracje z `templates/bramki` + devDependencies i defekt mechaniczny (edycja istniejącej migracji, pusty `catch`),
    żeby smoke uruchamiał prawdziwe bramki, a nie same `brak`. [W4-4a-odbior]
  - Telemetria: producent `faza.bramki.*` i `faza.testy_usuniete`. [W4-4a]
- **Pliki:** `.claude/scripts/bramki/` (nowy), `.claude/templates/bramki/` (nowy), `.claude/workflows/dev-docs-execute-wf.js` (domknięcie, `EXECUTE_RESULT`),
  `.claude/hooks/error-handling-reminder.sh` (usunięty), `.claude/hooks/stop-build-check-enhanced.sh`, `.claude/settings.json` (hook), `.claude/scripts/telemetria/faza.mjs`,
  `.claude/scripts/doctor/`, `README.md`, `.claude/templates/smoke-autopilot/` (fixture: konfiguracje i defekt mechaniczny)
- **Hunki:** [H51]
- **Testy:** każda bramka na fixture (przejście / naruszenie / porażka / przejście), niezmienność migracji na repo testowym z commitami, zakresy Strykera z `git diff -U0`
  (funkcja czysta), wykrycie usuniętych testów, test integracyjny na małym projekcie-fixture z konfiguracjami z `templates/bramki/`, nowe pola `faza.mjs`.
- **Smoke:** tak — pakiet fixture z konfiguracjami: ESLint łapie pusty `catch`, niezmienność migracji łapie edycję, Stryker zwraca mutanty, domknięcie naprawia
  wskazane; poza pakietem skrypt zwraca `brak` dla nieobecnych narzędzi; bramki razem ≤ 143 s (test review); `faza.bramki` w rekordzie.
- **Cofnięcie:** revert (hook wraca w pełni, z łatą PA-18 z P1).
- **Progi do odczytu:** bramka > 300 s albo fałszywe STOP-y → reguła do warn; B P1/P2 osi correctness i code-quality ≥ próg → przegląd reguł; walidacja końcowa znajduje błąd
  typów/testów przy PASS bramek w ≥ 2 z 5 zadań → builder wraca do pełnego zestawu testów (D7); p50 Strykera > 300 s w 5 fazach → Stryker raz na zadanie przed dev-pr (D5).
- **Sesje:** 2–3.

### P7 — Dossier i stan fazy ze skryptu

**Problem → przyczyna → co robimy → co da.** Dossier buduje agent (packager), stan zapisują agenci haiku (`stan:zapis` 80 powołań na 23 fazy, `zwin-do-poprawy`),
a telemetria kiedyś pokazywała `dossier: undefined` w każdej fazie. Przyczyna: skrypt workflowu nie ma dostępu do plików, więc robotę deterministyczną robi model.
Robimy dossier ze skryptu uruchamianego przez agenta domknięcia i stan fazy liczony w JS, doklejany do promptu następcy. Da: −1 agent na fazę (packager) i −2…4 haiku,
dossier zawsze kompletny, jeden kanał wejścia reviewerów (w tym bloki z bramek).
- **Pozycje:** [W4-3d] [W4-3d-stan] [D3] [Z-packager] [Z-stan] [PWE-zwin] [PW14] [PA-28]
- **Zakres:**
  - `.claude/scripts/dossier/`: diff fazy do pliku, lista plików, sygnały diffu, liczba [E2E], `figma_screens`, sekcja planu fazy dla spec, profil stacku z `package.json`
    i katalogów, bloki z wyniku bramek (ostrzeżenia lint i knip, mutanty); bez mandatu „czytaj tylko pliki z listy”; flagi warstw w schemacie dzisiejszego `KONTEKST`. [W4-3d] [D3] [PW14]
  - **Kanał dossier (skrypt workflowu nie czyta plików):** agent domknięcia uruchamia skrypt po bramkach i zwraca w `EXECUTE_RESULT` pole `dossier`
    (ścieżka pliku + flagi warstw + liczba [E2E] + `figma_screens`); autopilot zapisuje je w stanie zadania i przekazuje w `args` review-wf, który z nich
    liczy routing (`WARUNKI`, dziś z `kontekst` — `dev-docs-review-wf.js:840–874`). Gdy `args` nie niosą dossier albo plik zniknął (świeży run po STOP-ie
    z `execute: done` / `review: pending`, review-wf uruchomiony samodzielnie) — jeden agent klasy mechanicznej uruchamia ten sam skrypt i zwraca pole. Agent
    `kontekst:diff` znika; H59, H60 wypadają razem z `kontekstPrompt`, H57, H58 (zapasowa ścieżka w promptach reviewerów) wchodzą jako treść. [Z-packager] [D3]
  - **Stan fazy:** mapa 13 wywołań `zapiszStan()` w autopilocie; każdy zapis `.autopilot-state.json` przejmuje agent, który w tym miejscu i tak startuje
    (np. domknięcie, scribe, fix, `stop:commit-artefaktow`, archiwizacja), z JSON-em policzonym w JS i dokładnym poleceniem zapisu. Miejsce bez takiego agenta
    zostaje przy `stan:zapis` (haiku, klasa mechaniczna) — **odstępstwo od „stan:zapis znika” (PANEL §5), zapisywane w HANDOFF z listą miejsc**, bo runtime
    nie ma innego zapisu. `zwin-do-poprawy` → sekcję „Do poprawy” pisze agent, który i tak edytuje plik zadania (scribe / fix), z danych JS. [W4-3d-stan] [Z-stan] [PWE-zwin] [PA-28]
  - Telemetria: `faza.dossier_zn`; `review_rundy` liczone dziś z agentów `kontekst:diff` (`faza.mjs:161`) → z liczby uruchomień review-wf; role `kontekst:diff`,
    `stan:zapis` (tam, gdzie znika), `zwin-do-poprawy` wychodzą z mapy ról. [W4-3d]
- **Pliki:** `.claude/scripts/dossier/` (nowy), `.claude/workflows/dev-docs-execute-wf.js` (domknięcie: krok dossier, `EXECUTE_RESULT`), `.claude/workflows/dev-docs-review-wf.js`
  (`kontekstPrompt`, `KONTEKST`, `WARUNKI`, źródło dossier w `reviewerPrompt`, zapasowy agent), `.claude/workflows/dev-autopilot-wf.js` (13 miejsc `zapiszStan`,
  `zwin-do-poprawy`, przekazanie dossier do review), `.claude/scripts/telemetria/faza.mjs`, `.claude/scripts/telemetria/role.mjs`,
  `.claude/workflows/__tests__/sceptycy-p2.test.mjs` (`TIERY_DOMYSLNE` bez `packager`, `:168`), `.claude/workflows/__tests__/metryki-w-stanie.test.mjs` (`dossierOpis`, `:150`)
- **Hunki:** [H57] [H58] [H59] [H60]
- **Testy:** skrypt dossier na repo-fixture (sekcje, flagi, profil z `supabase/` i bez), zgodność pola `dossier` z kontraktem routingu (dzisiejszy schemat `KONTEKST`),
  routing z `args` i z zapasowego agenta, funkcja stanu fazy w JS (ekstrakcja), **wznowienie po STOP-ie** między execute a review (stan → dossier odtworzone),
  zmiany kontraktu w `sceptycy-p2.test.mjs:168` i `metryki-w-stanie.test.mjs:150` nazwane w commicie.
- **Smoke:** tak + drugi, krótki przebieg: STOP podłożony po execute → świeży run → review dostaje dossier. Oczekiwane: 0 agentów `kontekst:diff` i
  `zwin-do-poprawy`, `stan:zapis` tylko w miejscach z listy, `faza.dossier_zn` > 0, routing reviewerów jak R0.
- **Cofnięcie:** revert.
- **Progi do odczytu:** findingi per oś −30% w tym samym typie kodu → wraca agent packager; Bash reviewerów p50 > 23 bez spadku findingów → dodać mandat (D3).
- **Sesje:** 2.

### P8 — Pętla fix

**Problem → przyczyna → co robimy → co da.** Kontrola diffu fixa łapie dziś 0/30 defektów urodzonych w fixie (test review), pre-skan haiku robi medianę 20 wywołań
na jeden grep i dał 199 findingów bez trafień, a fix naprawia 98% findingów łącznie z P3 (138 z 225) — fix to 14,8% kosztu zadania. Przyczyna: kontrola bez list,
zakres fixa ustalany przez agenta, P3 wysyłane do naprawy. Robimy kontrolę wg katalogu A, zakres z hashy commitów, fix tylko P1/P2, bramki na plikach fixa.
Da: 15/30 zamiast 0/30 za +0,34 M na 24 commity; mniejszy diff fixa i mniej nowych odkryć.
- **Pozycje:** [W4-3] [W4-3pre] [W4-6] [D7-3] [D12a] [R1-2-fix] [Z-preskan] [Z-verifyfix] [F-migr-fix] [PWE-scribe] [PWE-S27-p1test] [PA-15] [PA-23] [PA-33]
- **Zakres:**
  - `fix:kontrola` z listami K-1…K-7 katalogu A (`dane/panel-run1-projekty.json`, projekt A; K-4/K-5 sprzątanie nazw i opisów po fixie); K-6 zastępuje `verify-fix`
    (`dev-autopilot-wf.js:1375`); sufit jednego cyklu; `fix:kontrola` nie scalana z `fix:poprawka`. [W4-3] [D12a] [Z-verifyfix]
  - `fix:pre-skan` usunięty razem z `PRE_SKAN_FIXA` i martwym efortem `'low'` dla haiku; `zakresFixa(numerFazy, commity)` (H41–H43 łatą, H44–H45 jako treść —
    opcje `agent()` zmienione w P3) daje kontroli hashe z `FixResult.commity`. [W4-3pre] [Z-preskan] [PA-15] [PA-23]
  - Fix tylko P1/P2; P3 → known-issues i bot; zmiany tylko w zgłoszonym miejscu; naprawa P1 zawiera test padający przed poprawką (H40 jako treść). Odwraca to
    plan B1 („P3 do pętli naprawczej”): `otwartePoReview` przestaje przepuszczać P3 — zmiana kontraktu `metryki-w-stanie.test.mjs:128–147` nazwana w commicie;
    P3 zapisywane trwale w known-issues (nie tylko w stanie), żeby wznowienie ich nie zgubiło (dowód z testu: faza 6 oferty, 13 utraconych P3); archiwizacja
    (`dev-docs-complete-wf.js:67`) bierze do smoke operatora tylko otwarte P1/P2, P3 zostają w known-issues. [W4-6] [PWE-S27-p1test] [PA-08]
  - Review: blok limitu P3 (H52, H53) i scribe (H62) jako treść pod nową semantykę P3 (`LIMIT_P3_GLOBALNY` zostaje jako sufit raportu); krótszy prompt scribe. [PA-33] [PWE-scribe] [PA-08]
  - Bramki P6 na plikach fixa (D7 warstwa 3) + niezmienność migracji w kontroli fixa. [D7-3] [R1-2-fix] [F-migr-fix]
- **Pliki:** `.claude/workflows/dev-autopilot-wf.js` (`fixPrompt`, `preSkanFixaPrompt`, `regresjaFixaPrompt`, `verify-fix`, pętla fix), `.claude/workflows/dev-docs-review-wf.js`
  (blok limitu P3, `scribePrompt`), `.claude/workflows/__tests__/kontrola-fixa.test.mjs`, `.claude/workflows/__tests__/findingi-po-stopie.test.mjs`,
  `.claude/workflows/__tests__/metryki-w-stanie.test.mjs` (`otwartePoReview`), `.claude/workflows/dev-docs-complete-wf.js` (P3 poza smoke operatora),
  `.claude/scripts/telemetria/role.mjs`
- **Hunki:** [H40] [H41] [H42] [H43] [H44] [H45] [H52] [H53] [H62]
- **Testy:** `podsumujKontroleFixa` z listami K, `zakresFixa` (hashe / zapasowy grep), wybór findingów do fixa = tylko P1/P2 (P3 → known-issues), strażnik: brak agentów
  `fix:pre-skan` i `verify-fix` w źródle.
- **Smoke:** tak — celowy P2 z fixture (P0) → fix; 0 `fix:pre-skan`, 0 `verify-fix`, `fix:kontrola` z K-1…K-7, P3 w known-issues, koszt fixa ≤ R0.
- **Cofnięcie:** revert (wraca dzisiejsza kontrola i pre-skan).
- **Progi do odczytu:** B P1/P2 w plikach fixa / reszta ≥ tło w oknie 5 PR → dzisiejsza kontrola + analiza; koszt kontroli > 0,46 M/commit → skrócić listy; stosunek rośnie
  albo B P3 → P1/P2 w oknie → P3 wraca do fixa; D12 cz. 2 wraca przy ≥ 3 B P1/P2 w plikach dodanych przez fix w oknie 5 PR.
- **Sesje:** 2.

### P9 — Sceptycy

**Problem → przyczyna → co robimy → co da.** 80% grup sceptyków P2 to jeden finding, więc ~1 agent na finding (0,060 M); sceptyk dostaje uzasadnienie autora razem
z zarzutem. Robimy sceptyka asymetrycznego (sam zarzut; AGREE / DISAGREE_EVIDENCE z linią lub testem / DISAGREE_CONCERN obniża wagę) i batch po 4 dla P2.
Da: −42% kosztu weryfikacji na finding (≈ −4% zadania); literatura: sceptyk bez odpowiedzi ~4× skuteczniejszy.
- **Pozycje:** [W4-5] [W4-5pre] [D2]
- **Zakres:**
  - Verify (`dev-docs-review-wf.js` ~1240–1262): prompt asymetryczny, schemat z trzema etykietami (DISAGREE_CONCERN nie kasuje, obniża wagę), P2 batch 4 niezależnie
    od pliku, P1 ×3 z kasacją przy 2/3; findingi E2E i OPERATOR dalej poza verify. [W4-5] [D2]
  - Kill rate PRZED merge'em (PANEL §4 It. 5): nowy sceptyk na archiwalnych findingach z `~/test-review` o znanych werdyktach (findingi wariantu 0 dopasowane do kluczy
    1 i 2) — ile prawdziwych kasuje, ile fałszywych przepuszcza; porównanie z dzisiejszym (2 prawdziwe B z 21 zabite). Tylko agenci sceptycy, ~2–4 M. [W4-5pre]
  - Telemetria: `faza.sceptyk.{agree, disagree_evidence, disagree_concern}`; `werdyktySceptyka` (`agent.mjs:58–62`) liczy dziś obalenia z pola `realny` — mapowanie
    etykiet (DISAGREE_EVIDENCE = obalenie, DISAGREE_CONCERN = degradacja), inaczej `agent.weryfikowane` i `obalone` wyjdą 0, a progi P9 stoją na tych polach. [D2]
- **Pliki:** `.claude/workflows/dev-docs-review-wf.js` (verify, `VERDICT`, `VERDICTS_BATCH`), `.claude/workflows/__tests__/sceptycy-p2.test.mjs`,
  `.claude/scripts/telemetria/faza.mjs`, `.claude/scripts/telemetria/agent.mjs`, `.claude/scripts/telemetria/__tests__/agent.test.mjs`,
  `docs/reviews/2026-09-19-analiza-pipeline/skrypty/test_review_sceptycy.py` (kill rate na archiwum)
- **Hunki:** —
- **Testy:** podział na batche (13 P2 → 4 agentów), P1 ×3 i konsensus, etykiety → decyzja, strażnik: prompt sceptyka nie zawiera uzasadnienia autora;
  `werdyktySceptyka` dla etykiet (czerwony najpierw).
- **Smoke:** tak — `verify-batch` ≤ ⌈P2/4⌉, etykiety w wyniku, `agent.obalone` niezerowe, gdy są obalenia; 0 błędów schematu.
- **Cofnięcie:** revert.
- **Progi do odczytu:** obalenia < 5% albo degradacje > 35% → P2 wraca do grupy po pliku; kill rate > 50% i ≥ 3 B P1/P2 w miejscach obalonych w oknie 5 PR → P1
  z uzasadnieniem autora (tło: 8,8 sceptyka/fazę, obalenia 10,9%, degradacje 23%); przed merge'em: nowy sceptyk kasuje więcej prawdziwych niż dzisiejszy → nie merge'ować.
- **Sesje:** 1–2.

### P10 — Wiedza projektu (learned-patterns, compound)

**Problem → przyczyna → co robimy → co da.** learned-patterns (~47–49k zn w oferty) ładuje się eager do każdego agenta, builder dostaje go trzema kanałami, compound
zapisuje każdą lekcję tekstem, indeks rośnie bez limitu. Przyczyna: plik w `.claude/rules/`, brak formatu i szczebla. Robimy trzy poziomy wiedzy, 8 zabezpieczeń,
wycinek 1–2k zn dla buildera i reviewera, compound ze szczeblem kod / lint / reguła, konwersję obecnych wpisów skryptem. Da: learned-patterns poza eager — w modelu kosztu −18,3%
zadania po allowliście (`dane/raport-koszt-po.txt`, projekt z ~47k zn learned-patterns); wiedza bez limitu dla projektów rozwijanych latami; lekcje mechaniczne trafiają do bramek.
- **Pozycje:** [W4-8-lp] [A-lp] [A-lp-swap] [R1-3] [PW07] [PW08] [PW09] [PW10] [PW11] [PW40] [6a-26-a] [INS-A2] [PA-13] [PA-14] [PA-41] [PA-27]
- **Zakres:**
  - `.claude/scripts/wiedza/`: walidacja frontmatteru solutions (klasa ze słownika `KLASY_BLEDOW`, reguła 2 zdania, `paths` z walidacją globów, waga, szczebel, data, źródło,
    licznik ucieczek) — compound odmawia zapisu bez pól; generator indeksu `docs/learned-patterns.md` (klasa | reguła | wzorce plików | waga | link) z bramką rozmiaru,
    dedupem i koszykiem „zawsze” z twardym limitem; dobór wycinka 1–2k zn po katalogach IU. [A-lp] [W4-8-lp] [PW07] [PW08] [PW10]
  - Konwersja jednorazowa: `.claude/rules/learned-patterns.md` projektu → solutions + indeks, lista odrzutów dla operatora; stary plik przeniesiony do `docs/archiwum/`, nie skasowany. [PW11]
  - learned-patterns wychodzi z `.claude/rules/`; w CLAUDE.md projektu jedna linia wskazująca indeks (instrukcja w README — CLAUDE.md należy do projektu). [PW09]
  - Planner dokleja wycinek do promptu IU zamiast całego pliku (H50 jako treść, PA-13); dossier (P7) niesie ten sam wycinek dla reviewerów; dev-plan czyta indeks
    w całości (P13). [A-lp] [PA-13]
  - Wszystkie odwołania do `.claude/rules/learned-patterns.md` przepięte (test odwołań z P0 je wyłapie): reviewerzy (`dev-docs-review-wf.js:410`, `:464`, `:480–481`, `:508`
    i nowa treść H58 z P7), whitelista commita refreshu i `dodatkowePathspec` (`dev-autopilot-wf.js:1584`, `:1614`), pathspec archiwizacji (`dev-docs-complete-wf.js:170`),
    `dev-pr/SKILL.md:138`, `:153`, compound (`dev-compound-wf.js:52`, `:62`; `dev-pr-wf.js:489–497`) — inaczej nowy `docs/learned-patterns.md` nie zostanie
    zacommitowany, a bramka czystości z P4 zatrzyma następny run. [A-lp] [PW09]
  - Krok 1.7 („przeczytaj learned-patterns”) usunięty z trzech builderów (`feature-builder-ui.md:43`, `-data.md:34`, `-fullstack.md:43`) razem z przeniesieniem pliku —
    tak każe PA-27; jedna linia w pliku, treść builderów przepisuje P12. [PA-27]
  - Słownik klas: `KLASY_BLEDOW` żyje w `dev-pr-wf.js` (node go nie zaimportuje) — kopia w `.claude/scripts/wiedza/klasy.mjs` z testem równości (ekstrakcja z workflowu). [A-lp]
  - Compound (skill, `dev-compound-wf.js`, etap compound w `dev-pr-wf.js`): format frontmattera, pole `szczebel` z uzasadnieniem; `kod`/`lint` → `propozycjeBramek[]`
    obok `propozycjeDoReviewerow[]`; do indeksu tylko `regula`; materiał z raportów review, known-issues, Dziennika i commitów `fix(` (H29, H46, H47). [R1-3] [6a-26-a] [INS-A2] [PW40] [PA-14]
  - dev-compound-refresh generuje indeks (H30); strategia subagentów zawężona do wąskiego zakresu (PA-41). [PW08] [PA-41]
  - Kolejność: wiedza przed reviewerami, żeby ślepy test P11 widział docelowy wycinek (PANEL §4a A). [A-lp-swap]
  - Telemetria: `faza.wiedza.{indeks_zn, claude_md_zn, wycinek_*}`, `run.pr.klasy[].ma_regule`. [W4-8-lp]
- **Pliki:** `.claude/scripts/wiedza/` (nowy), `.claude/skills/dev-compound/SKILL.md`, `.claude/skills/dev-compound-refresh/SKILL.md`, `.claude/workflows/dev-compound-wf.js`,
  `.claude/workflows/dev-docs-execute-wf.js` (planner), `.claude/workflows/dev-pr-wf.js` (etap compound), `.claude/workflows/dev-autopilot-wf.js` (`refreshPrompt`,
  whitelista `:1584`, `:1614`), `.claude/workflows/dev-docs-review-wf.js` (odwołania `:410`, `:464`, `:480–481`, `:508`), `.claude/workflows/dev-docs-complete-wf.js`
  (pathspec `:170`), `.claude/skills/dev-pr/SKILL.md`, `.claude/agents/feature-builder-data.md`, `.claude/agents/feature-builder-ui.md`,
  `.claude/agents/feature-builder-fullstack.md` (tylko krok 1.7), `.claude/scripts/dossier/` (blok wycinka), `.claude/scripts/telemetria/faza.mjs`, `README.md`
- **Hunki:** [H29] [H30] [H46] [H47] [H50]
- **Testy:** odmowa zapisu bez pól (czerwony najpierw), generator indeksu (dedup, limit koszyka, bramka rozmiaru), dobór wycinka po katalogach, konwersja na fixture
  z fragmentu prawdziwego formatu oferty, `szczebel: lint` → `propozycjeBramek`, równość kopii słownika klas z `KLASY_BLEDOW`, test odwołań bez `.claude/rules/learned-patterns.md`.
- **Smoke:** tak — w kopii konwersja learned-patterns (47k zn) → learned-patterns nie w załączniku `instructions` agentów, wycinek w prompcie buildera, compound zapisuje
  solution z polami, indeks wygenerowany; `ctx_start` agentów niższy niż po P3.
- **Cofnięcie:** revert + w projekcie przywrócenie pliku z `docs/archiwum/` do `.claude/rules/`.
- **Progi do odczytu:** metryki §2 pkt 4 (`faza.wiedza.*`); `ctx_start` buildera +10% bez spadku P1/P2 na fazę → skrócić wycinek; wpisy indeksu na zadanie, propozycje
  bramek i odsetek wdrożonych.
- **Sesje:** 2–3.

### P11 — Reviewerzy

**Problem → przyczyna → co robimy → co da.** Pliki trzech reviewerów to import pisany pod czat i starsze modele (dialogi-przykłady, „elite”, „last line of defense”,
drugi format raportu), dwa miejsca przeczą reszcie szablonu (memoizacja przy React Compilerze, `getSession()`), correctness i spec nie mają poleceń-list,
test-coverage nie ma mutantów. Przyczyna: pliki z compound-engineering (2026-03-26), prompty strojone na Opus 5. Robimy sześć plików reviewerów od zera wg zasad
1–11 z warstwą stałą < 150 i testem budżetu; listy tam, gdzie test je potwierdził; bez skracania tam, gdzie test pokazał stratę; ślepy test przed merge'em.
Da: ≈ −20% kosztu znajdowania bez utraty trafień (PANEL §1: K1, K2, K4, K7, K9), mniej szumu dla sceptyka i fixa.
- **Pozycje:** [W4-7a] [W4-7b] [W4-7c] [W4-9-rev] [W4-4b-review] [PWE-budzet-doctor] [D4] [D6-2] [D6-3] [S3-1] [S3-2] [S3-3] [S3-4] [S3-5] [S3-6] [E-spec] [E-cq] [E-kieran] [H-b] [PW29] [PW30] [PW36] [PW41] [PW43] [PW54] [PW61] [6a-25-b] [6a-26-b] [6a-26-e] [INS-A1-rev] [INS-A4] [F-seedy-sec] [PWE-advisors] [PWE-komendy] [PA-36] [PA-39] [PA-40]
- **Zakres:**
  - Ślepy test PRZED merge'em (decyzja 1): stare i nowe pliki reviewerów uruchomione na TYM SAMYM, bieżącym zestawie (po P3–P10: allowlista, dossier ze skryptu,
    wycinek, wejścia z bramek) i ocenione przez sędziego w jednym przebiegu z neutralnymi etykietami (PANEL-WEJSCIE §10) — wariant 0 z września jechał na starym zestawie,
    więc nie jest porównywalnym „przed”. Fazy: 7 z 13 faz testu review (`~/test-review/`, klucze 1 i 2, sędzia skalibrowany 0/20), wybrane tak, by miały najwięcej
    trafień klucza 2 osi security, code-quality i performance; harness `test_review_*` przerobiony pod dossier ze skryptu (osobna sesja). Kryterium: brak istotnej straty
    na kluczu 2 per oś i koszt znajdowania nie wyższy niż stary wariant. [W4-7c] [6a-25-b] [S3-6]
  - Test warstwy stałej `__tests__/warstwa-stala.test.mjs`: jeden oznaczony blok poleceń na rolę, ≤ 150 pozycji, porażka przy zdaniu nakazowym poza blokiem i przy datach,
    „jak dotąd”, „już nie”; tu dla reviewerów, w P12 dla builderów; ten sam licznik w doctor (instalacja) i liczba instrukcji warstwy stałej w telemetrii (bez STOP-ów). [W4-9-rev] [PW30] [PWE-budzet-doctor]
  - Pliki reviewerów odwołują się do reguł kodu po temacie, nie po numerach sekcji `coding-rules.md` (P12 przepisuje ten plik). [F-cr]
  - Zasady pisania 1–11 (PROMPT-AUDIT §4 pkt 1–7 + INSPIRACJE A4 pkt 8–11) dla plików reviewerów. [PW43] [6a-26-e] [INS-A4]
  - correctness: listy z katalogu A bez L-COR-6/7 + materiał kieran §4b, §5, §7 (ETAP1B §3: drogi do operacji z bramką, `await` w ścieżce zapisu, wartość przed/po
    `await`, literał vs constraint migracji, limit czasu wywołań). [W4-7a] [E-kieran] [PW29] [S3-5]
  - spec: listy L-SPC + sekcja planu z dossier, efort `medium`, duplikat fokusu `REVIEWERZY:368` (martwe odwołania — łata H24 w P1). [W4-7b] [D6-3] [E-spec] [PW54] [PA-20]
  - D4: security, spec, test-coverage tylko w fazach z kodem (spec także przy tekstach UI i dokumencie prawnym). [D4]
  - test-coverage: blok mutantów z dossier ułożony jak w C (dla każdego mutanta: test, który powinien go zabić, i powód, że nie zabija), pytanie „undefined” + 5 kształtów
    testu niefalsyfikowalnego, efort `medium`. [W4-4b-review] [D6-2] [S3-4] [PW41] [6a-26-b] [INS-A1-rev]
  - security: H19, H21–H23 (PA-01, 02, 05) + zachowana poprawka PA-04 z P1 + PA-39 (zachodzące checklisty); bez skracania list do ~90 linii, dopóki ślepy test nie pokaże
    braku straty; warunkowo: gdy w tej fazie `faza.bramki.advisors.status == ok` (z dossier) → „RLS / search_path / auth.users sprawdził advisors”, w przeciwnym razie
    (projekt bez Supabase albo brak tokenu Management API) security zachowuje polecenia-listy RLS; strażnicy w seedach. [S3-2] [PA-39] [PWE-advisors] [F-seedy-sec]
  - performance zostaje: H15 (PA-02), zachowane poprawki memoizacji z P1 (PA-03), niesprawdzalne progi (PA-40). [S3-1] [PA-03] [PA-40]
  - code-quality: H01–H06 (PA-01, 02, 05, 06, 07); prompt osi w jednym miejscu (plik, nie fokus `REVIEWERZY:364`); efort `high`; ostrzeżenia lint i knip z dossier
    jako wejście, nie „zakaz zgłaszania”. [E-cq] [PW61] [S3-3] [H-b] [PW36]
  - Komendy-listy per technologia u reviewerów po profilu stacku z dossier. [PWE-komendy]
  - `kieran-typescript-reviewer.md` i `code-simplicity-reviewer.md` usunięte po wykorzystaniu treści. [E-kieran] [PA-36]
- **Pliki:** `.claude/agents/security-sentinel.md`, `.claude/agents/performance-oracle.md`, `.claude/agents/architecture-strategist.md`, `.claude/agents/spec-compliance-reviewer.md`,
  `.claude/agents/correctness-reviewer.md`, `.claude/agents/test-coverage-reviewer.md` (treść), `.claude/agents/kieran-typescript-reviewer.md`,
  `.claude/agents/code-simplicity-reviewer.md` (usunięte), `.claude/workflows/dev-docs-review-wf.js` (`REVIEWERZY`, treść `reviewerPrompt`, `testCoveragePrompt`,
  tiery spec i test-coverage, routing D4), `.claude/workflows/__tests__/warstwa-stala.test.mjs` (nowy), `.claude/workflows/__tests__/sceptycy-p2.test.mjs` (tiery `:168`),
  `.claude/scripts/doctor/` (licznik warstwy stałej), skrypty `skrypty/test_review_*` (ślepy test, poza katalogiem maszynerii)
- **Hunki:** [H01] [H02] [H03] [H04] [H05] [H06] [H15] [H19] [H21] [H22] [H23]
- **Testy:** warstwa stała (czerwony na dzisiejszych plikach — np. drugi format raportu w security), routing D4 (faza bez kodu → bez security / spec / test-coverage),
  tiery `medium` dla spec i test-coverage.
- **Smoke:** tak (po ślepym teście) — 6 reviewerów z nowych plików, efort zgodny z tabelą, 0 błędów schematu, koszt review ≤ po P10.
- **Cofnięcie:** per oś — przywrócenie pliku jednej roli z main sprzed paczki zamiast całej paczki.
- **Progi do odczytu:** B P1/P2 osi correctness ≥ próg → dzisiejsze polecenie; B P1/P2 osi spec ≥ 4 w oknie 5 PR z klasą w plikach faz pominiętych → spec w każdej fazie;
  zero findingów z mutantem w 5 fazach → poprawić ułożenie wejścia; B P1/P2 osi test ≥ 12 → wyłączyć listę i `medium`; B P1/P2 osi ≥ próg po obniżeniu efortu →
  poziom wyżej; spadek potwierdzonych P1/P2 osi → minimalna forma usuniętej reguły / przywrócić brzmienie roli.
- **Sesje:** 3 + 2 (przeróbka harnessu + ślepy test).

### P12 — Buildery i reguły kodu

**Problem → przyczyna → co robimy → co da.** Builder ma ~480–490 instrukcji; skill `security` wchodzi do niego jako protokół audytu z raportem; zasady Sentry krzyczą
wersalikami; coding-rules ma sprzeczności (§3/§11, 300 linii vs ESLint 360, tabela „10 anty-patternów AI” jako opis modelu) i jest ładowany każdemu agentowi.
Przyczyna: warstwa stała i referencyjna niezrozdzielone, tekst pod starsze modele. Robimy warstwę stałą builderów < 150, klasy zapobiegalne jako zdania „co robić
zamiast” doklejane po plikach IU, security jako reguły implementatora, przepisane coding-rules (decyzja operatora wiersz po wierszu). Da: builder zapobiega klasom,
które dziś łapie review (każdy finding = tura fixa); tańszy start buildera.
- **Pozycje:** [W4-8-d10] [W4-9-bld] [D10] [D7-1] [R1-2-bld] [F-cr] [F-cr2-tekst] [H-c] [H-24-27] [PW12] [PW13] [PW39] [6a-26-c] [6a-26-k] [INS-B2] [INS-A1-bld] [PWE-skille-split] [PWE-d10-regen] [PA-24] [PA-26] [PA-44]
- **Zakres:**
  - Ślepy test builderów PRZED merge'em (decyzja 1): 1–2 historyczne fazy oferty (kopie), stare vs nowe pliki builderów, ten sam review i bramki na obu wynikach, sędzia
    z neutralnymi etykietami, przestrzeganie instrukcji oceniane z transkryptu. [W4-9-bld]
  - Pliki builderów data / ui / fullstack: warstwa stała < 150 wg zasad 1–11 (test z P11); krok 1.7 już usunięty w P10; pytanie „undefined” jako jedna pozycja; PA-44
    (lista stylów do unikania dla UI bez makiety) — decyzja przy pisaniu. [W4-9-bld] [H-24-27] [INS-A1-bld] [PA-44]
  - D10: klasy zapobiegalne (timeout, `strictObject` na kopercie, numer generacji, redakcja przed Sentry, parser zamiast regexu, nowa migracja zamiast edycji, pytanie
    „undefined”) jako zdania „co robić zamiast” w warstwie referencyjnej doklejanej przez orkiestrator po plikach IU (≤ 2k zn razem z wycinkiem P10); tabela klas
    regenerowana z compoundów skryptem `.claude/scripts/wiedza/` (ETAP1B §3 „dossier klas ucieczek”); wykrywalne — u reviewerów (P11), mechaniczne — w ESLint (P6). [D10] [W4-8-d10] [6a-26-k] [INS-B2] [PWE-d10-regen]
  - Skill `security` u builderów → reguły implementatora (RLS, walidacja, sekrety), protokół audytu poza `skills:`. [PA-24] [PW39]
  - `sentry-integration`: pięć zasad normalnym zdaniem z powodem (H39). [PA-17]
  - Skille buildera podzielone na stałą i referencyjną (porządkowo, bez skracania). [PWE-skille-split]
  - coding-rules.md: przepisanie wg ETAP2 (USUŃ / ZMIEŃ / DODAJ / PRZENIEŚ-DO-LINTERA) + PA-26 (a)–(e) + wyjątek §2 (usunąć wolno tylko zielony test niefalsyfikowalny,
    gdy nie da się przepisać asercji; czerwonego nigdy; wpis w raporcie fazy) — decyzja operatora wiersz po wierszu; plik → warstwa referencyjna po typie pliku, nie eager.
    Uwaga: ten plik ładuje się też w sesjach utrzymania szablonu (CLAUDE.md repo) — zmiana obowiązuje od następnej sesji. [F-cr] [F-cr2-tekst] [PA-26] [PW12] [PW13] [6a-26-c] [H-c]
  - Odbiorcy coding-rules przepięci razem z przepisaniem: ścieżka w generatorze bota (stała z P5; `coderabbit-base.yaml:49`, `:111`), `coderabbit-setup/SKILL.md:40`,
    `dev-pr/SKILL.md:181`; numery sekcji w `dev-autopilot-wf.js:750–756` („coding-rules §4/§10/§2”), `skills/security/resources/owasp-react-supabase.md:393`
    (pliki reviewerów z P11 odwołują się po temacie). [F-cr] [H-c]
  - Samosprawdzenie buildera zawężone do plików IU (`tsc --noEmit`, `vitest related --run`); pełny zestaw w domknięciu i walidacji końcowej. [D7-1] [R1-2-bld]
- **Pliki:** `.claude/agents/feature-builder-data.md`, `.claude/agents/feature-builder-ui.md`, `.claude/agents/feature-builder-fullstack.md` (treść), `.claude/skills/security/`,
  `.claude/skills/sentry-integration/SKILL.md`, `.claude/skills/supabase-dev-guidelines/`, `.claude/skills/tailwind-react-guidelines/`, `.claude/skills/ux-ui-guidelines/`,
  `.claude/rules/coding-rules.md`, `.claude/workflows/dev-docs-execute-wf.js` (`promptIU`: warstwa referencyjna), `.claude/scripts/wiedza/` (dobór zdań D10),
  `.claude/workflows/__tests__/warstwa-stala.test.mjs`, `.claude/skills/coderabbit-setup/templates/coderabbit-base.yaml`, `.claude/skills/coderabbit-setup/SKILL.md`,
  `.claude/skills/dev-pr/SKILL.md`, `.claude/workflows/dev-autopilot-wf.js` (odwołania `:750–756`)
- **Hunki:** [H39]
- **Testy:** warstwa stała builderów (czerwony najpierw), dobór zdań D10 po plikach IU, test, że reguły przeniesione do lintu nie występują w tekście coding-rules.
- **Smoke:** tak (po ślepym teście) — prompty IU z warstwą referencyjną, `ctx_start` buildera, 0 błędów schematu.
- **Cofnięcie:** per plik buildera; coding-rules osobnym commitem (osobny revert).
- **Progi do odczytu:** klasa ze zdaniem u buildera nadal ≥ 3 B P1/P2 w oknie 5 PR → lista u reviewera albo reguła lint; `ctx_start` buildera +10% bez spadku P1/P2 na fazę →
  skrócić wycinek; walidacja końcowa znajduje błąd przy PASS bramek w ≥ 2 z 5 zadań → builder wraca do pełnego zestawu testów.
- **Sesje:** 2–3 + 1 (ślepy test).

### P13 — Planowanie (scalony dev-plan)

**Problem → przyczyna → co robimy → co da.** Operator zawsze uruchamia dev-docs zaraz po dev-plan; dev-docs kopiuje 22–46% planu; research uruchamia się zawsze
(18,6 M z 55,6 M w 19 epizodach); plan nie ma budżetu pliku, więc 80 uwag bota dotyczyło rozmiaru plików. Robimy jeden skill dev-plan z budżetem pliku i rejestrem stałych,
plikiem zadań generowanym skryptem, bramką gotowości w skrypcie i researchem warunkowym przy „Lekka”. Da: jedna komenda zamiast dwóch, tańszy dev-plan w małych
zadaniach, rozmiar pliku rozstrzygany przed pisaniem.
- **Pozycje:** [R1-1] [D8a] [D8b] [B-plan] [B-budzet-plan] [PW15] [PA-30]
- **Zakres:**
  - Scalony `dev-plan`: plan → fazy → IU z tabelą plików (długość, przyrost, powody zmiany, eksporty między warstwami, importy z wielu domen, test-lustro, reguła 5 s;
    linie = wyzwalacz z tolerancją 20% → 360; pęknięty wymiar → krok „wydziel moduł” przed dodaniem), rejestr stałych, checkboxy Test: / [E2E]; na końcu branch
    `feature/<zadanie>` + `docs/active/<zadanie>/`; `*-zadania.md` generowany skryptem z checkboxów planu (odnośniki do IU); bramka gotowości jako skrypt. [R1-1] [D8a] [B-plan] [B-budzet-plan] [PW15]
  - Research warunkowy przy „Lekka” (nowa zależność / usługa / API / wersja główna albo katalogi IU bez wpisu w indeksie wiedzy i `docs/solutions/`); „Standardowa”
    i „Głęboka” bez zmian; `Scope:` dla repo-research-analyst (H36). [D8b] [PA-30] [PA-21]
  - Skill `dev-docs` usunięty po scaleniu, odwołania przepięte; treść H31, H32 (rok, fraza migracyjna) i H35, H37 (rok, nazwy Figmy spójne z P3) w scalonym skillu. [B-plan] [PA-11] [PA-08] [PA-12]
  - Handoff na autopilota z gotowym poleceniem i zdaniem N1 (przeniesione z `dev-docs/SKILL.md`, P3); dev-plan czyta indeks wiedzy w całości (P10). [W4-3a-n1] [A-lp]
  - Kontrakt `docs/active/<zadanie>/` bez zmian dla konsumentów: `*-plan.md` (`## Fazy`, linia `Plan techniczny:` — planner `dev-docs-execute-wf.js`, od P13 S1; wcześniej `## Zrodla`, którego grep nie trafiał w `## Źródła` z dev-docs), `*-kontekst.md`
    (`## Designerski kontekst`, `## Dziennik` — planner i domknięcie), `*-zadania.md` (scribe, fix, walidacja), `.autopilot-state.json` (bootstrap parsuje md przy
    pierwszym runie), archiwizacja. [D8a] [B-plan]
- **Pliki:** `.claude/skills/dev-plan/` (SKILL.md + references), `.claude/skills/dev-docs/` (usunięty), `.claude/scripts/plan/` (nowy: generator zadań, bramka gotowości),
  `README.md`, `.claude/skills/dev-prep/SKILL.md`, `.claude/skills/dev-brainstorm/SKILL.md` (odwołania), `.claude/templates/smoke-autopilot/`,
  `.claude/workflows/__tests__/kontrakt-docs-active.test.mjs` (nowy)
- **Hunki:** [H31] [H32] [H35] [H36] [H37]
- **Testy:** test kontraktu: wygenerowane przez nowy skrypt pliki `docs/active/` przechodzą przez wszystkie parsery i prompty-konsumentów (sekcje, checkboxy, stan) —
  planner, domknięcie, bootstrap, scribe, fix, walidacja, archiwizacja; generator zadań (odnośniki do IU, bez kopii treści), bramka gotowości (plan bez tabeli plików →
  odrzucony), test odwołań z P0 po usunięciu dev-docs.
- **Smoke:** tak — w kopii nowe małe zadanie przez `/dev-plan` zamiast gotowego fixture, potem autopilot na wyniku (~7–9 M).
- **Cofnięcie:** revert (dev-docs wraca).
- **Progi do odczytu:** mediana epizodu dev-plan > 2,95 M albo bramka gotowości odrzuca > 1 z 5 planów → generowanie zadań jako osobny krok; ≥ 2 B P1/P2 klasy
  „API / wersja biblioteki niezgodne z dokumentacją” w zadaniach bez researchu w oknie 5 PR → research obowiązkowy.
- **Sesje:** 2.

### P14 — E2E i skill weryfikacji

**Problem → przyczyna → co robimy → co da.** STOP-y E2E (5 we wrześniu; największa anomalia `review:e2e` 19,6 M w jednym runie); przepis na środowisko rozsiany po agencie,
workflowie i skillach; scenariusze nie przeżywają zadania. Robimy parametryzację `.env.e2e`, precheck w env-up, E2E niewykonalny w runie → [MANUAL] do smoke operatora,
sekcję Doctor przed startem i skill weryfikacji per projekt z mapą funkcji. Da: zero STOP-ów E2E w środku runu; jedno źródło prawdy o uruchamianiu aplikacji,
które rośnie z każdym zadaniem.
- **Pozycje:** [W4-3e-env] [W4-3e-manual] [W4-3e-doctor] [R1-4] [E-precheck] [F-migr-sum] [F-seedy-e2e] [PW32] [PW46] [PW51] [PW57] [6a-26-h] [INS-B1] [PWE-e2e-prompt]
- **Zakres:**
  - `.env.e2e` parametryzacja (template `e2e-env`), harness E2E → env-up, precheck (haiku) wchłonięty przez env-up, `migrations.sum` przed env-up, jedno źródło promptu testera. [W4-3e-env] [E-precheck] [PW51] [F-migr-sum] [PWE-e2e-prompt]
  - Dwa przypadki (PANEL-WEJSCIE §2 pkt 6): środowisko E2E niesprawne NA STARCIE → STOP w bootstrapie (sekcja Doctor) z komendą naprawy, jak dziś
    (`dev-autopilot-wf.js` ~1124–1128), bez cichej degradacji; test niewykonalny W TRAKCIE runu przez środowisko / limit zewnętrzny → checkbox [MANUAL] z powodem,
    run idzie dalej, pozycja trafia do smoke operatora; kategoria przyczyny SKIP. [W4-3e-manual] [PW32]
  - Skill weryfikacji: generator w szablonie tworzy per projekt skill z sekcjami Launch / Doctor / Drive / Evidence / Cleanup + mapą funkcji (droga użytkownika, dowód działania,
    pliki kodu funkcji), jednorazowo przechodzony na żywo przed oddaniem; tester czyta skill; Doctor = sprawdzenie środowiska w bootstrapie; archiwizacja dopisuje funkcje
    ze scenariuszy [E2E] zadania. [R1-4] [6a-26-h] [PW46] [W4-3e-doctor] [INS-B1]
  - Tester: seed vs kontrakt migracji (L-E2E-2); liczenie [E2E] z obu prefiksów bez archeologii incydentu (H13, H61). [F-seedy-e2e] [PW57] [PA-10]
  - Telemetria: `faza.e2e.manual` (dziś `null`). [W4-3e-manual]
- **Pliki:** `.claude/agents/feature-tester-e2e.md` (treść), `.claude/workflows/dev-autopilot-wf.js` (precheck, env-up, db-sync, env-down), `.claude/workflows/dev-docs-review-wf.js`
  (`e2ePrompt`, bramka [E2E]), `.claude/workflows/dev-docs-complete-wf.js` (smoke operatora z [MANUAL], mapa funkcji), `.claude/templates/e2e-env/`,
  `.claude/skills/weryfikacja-setup/` (nowy generator), `.claude/skills/agent-browser/`, `.claude/scripts/telemetria/faza.mjs`,
  `.claude/templates/smoke-autopilot/`
- **Hunki:** [H13] [H61]
- **Testy:** decyzja bootstrapu przy niesprawnym środowisku (STOP), klasyfikacja przyczyny SKIP w trakcie → MANUAL vs FAIL, przeniesienie [MANUAL] do smoke operatora, generator skilla na fixture projektu (sekcje obecne), liczenie [E2E]
  (istniejący `bloker-srodowiska.test.mjs`).
- **Smoke:** tak, dwa przebiegi — (1) fixture z checkboxem [E2E] w kopii bez środowiska: STOP w bootstrapie z komendą (przed fazą 1, koszt minimalny);
  (2) środowisko sprawne na starcie, awaria podłożona w trakcie (np. zatrzymany serwer dev przed testerem): [MANUAL] z powodem + pozycja w smoke operatora, run OK.
- **Cofnięcie:** revert; skill weryfikacji wygenerowany w projekcie zostaje (artefakt projektu).
- **Progi do odczytu:** STOP E2E nadal > 0 na zadanie → przegląd kategorii SKIP; przejście regresyjne (odłożone) wraca przy uwagach bota / Sentry w funkcjach nietkniętych planem.
- **Sesje:** 2–3.

### P15 — Ogrodnik

**Problem → przyczyna → co robimy → co da.** Nic nie patrzy na kod projektu między zadaniami, a obejście z zadania N wchodzi do dossier N+1 jako „istniejący wzorzec”
(wystąpienie poteto: antywzorce rozchodzą się jak wirus). Robimy pomiar skryptem na zamknięciu zadania z porównaniem do poprzedniego i agentem oceny tylko przy przyroście.
Da: antywzorce łapane, zanim agenci je skopiują; zero zmian w kodzie bez decyzji operatora.
- **Pozycje:** [R1-5] [PW49] [6a-26-j] [INS-B7] [INS-B8]
- **Zakres:**
  - `.claude/scripts/ogrod/`: wyciszenia lint/TS, `any` i wymuszone rzutowania, komentarze TODO / obejście / tymczasowo, puste `catch` w całym projekcie; porównanie z poprzednim
    rekordem w telemetrii. [R1-5] [PW49]
  - Autopilot: krok po compound-refresh, przed archiwizacją — agent mechaniczny uruchamia skrypt; agent oceny tylko przy wyraźnym przyroście albo co N zadań (próg i N
    ustalane przy wdrożeniu). [6a-26-j]
  - Komentarze-obejścia jako kategoria pomiaru zamiast zakazu komentarzy. [INS-B8]
  - Sekcja „Ogród” w podsumowaniu zadania; propozycje do operatora: reguła lint teraz (z posprzątaniem, zasada P6) / zadanie sprzątające / zostawić. [INS-B7]
- **Pliki:** `.claude/scripts/ogrod/` (nowy), `.claude/workflows/dev-autopilot-wf.js` (krok), `.claude/workflows/dev-docs-complete-wf.js` (sekcja „Ogród”),
  `.claude/scripts/telemetria/zbieranie.mjs` (rekord `ogrod`)
- **Hunki:** —
- **Testy:** pomiar na fixture ze znanymi liczbami, decyzja o agencie oceny (funkcja progu), agent pomiaru bez Edit (klasa mechaniczna).
- **Smoke:** tak — 1 agent pomiaru, sekcja „Ogród”, 0 zmian w kodzie.
- **Cofnięcie:** revert (krok samodzielny).
- **Progi do odczytu:** kilka zadań bez przyjętej propozycji → wyłączyć.
- **Sesje:** 1.

### P16 — Zamknięcie serii

**Problem → przyczyna → co robimy → co da.** Po 16 paczkach trzeba sprawdzić całość tym samym narzędziem co na początku i dać operatorowi jedną kartę odczytu
dla pierwszego nowego projektu. Da: pewność, że prompty są czyste, i gotowy przepis „co i kiedy sprawdzić w telemetrii”.
- **Pozycje:** [H-cykl] [PW38] [6a-25-cykl] [6a-40-2]
- **Zakres:**
  - Ponowny prompt-audit całej maszynerii (`/claude-api prompt-audit`, ten sam Step 0, `skrypty/pa_*.py`, kontrola w obie strony) — oczekiwane zero trafień
    wysokiej i średniej pewności. [H-cykl] [PW38] [6a-25-cykl]
  - Karta odczytu: progi ze wszystkich paczek w jednym pliku + komenda `raport.mjs --projekt` i horyzont (1 faza / 5 faz / 5 PR). [6a-40-2]
  - README — przegląd całości; HANDOFF; pamięć projektu; push wg decyzji 2. [6a-40-2]
- **Pliki:** `README.md`, `docs/reviews/2026-09-19-analiza-pipeline/KARTA-ODCZYTU.md` (nowy)
- **Hunki:** —
- **Testy:** pełne `pnpm typecheck && pnpm test && pnpm lint`; test odwołań i warstwy stałej na całości.
- **Smoke:** nie (ostatni smoke P15 = stan końcowy).
- **Cofnięcie:** —
- **Progi do odczytu:** — (zbiera progi paczek).
- **Sesje:** 1.

---

## 4. Wspólne pliki (kto rusza który fragment)

Pliki, których nie da się dotknąć raz (duże workflowy — runtime nie pozwala ich dzielić na moduły), paczki ruszają sekwencyjnie, każda swój fragment. Fragmenty
są rozłączne wszędzie poza jednym wyjątkiem: w autopilocie P7 zmienia 13 miejsc zapisu stanu rozsianych po bootstrapie, pętli fix i zakończeniu, które potem
ruszają P5, P8, P10 i P15 — przy wykonaniu jedna po drugiej to nie konflikt, ale każda późniejsza paczka pracuje na wersji po P7.

- `.claude/workflows/dev-autopilot-wf.js` — P3 opcje `agent()` i meta; P4 bootstrap (doctor, zielony main, czystość), STOP, `fazyUkonczone`; P5 bootstrap (warunek decyzji);
  P7 13 miejsc zapisu stanu, `zwin-do-poprawy`, przekazanie dossier; P8 pętla fix (`fixPrompt`, pre-skan, kontrola, `verify-fix`); P10 `refreshPrompt`, whitelista
  i `dodatkowePathspec`; P12 odwołania do sekcji coding-rules (`:750–756`); P14 precheck, env-up, db-sync, env-down; P15 krok ogrodnika.
- `.claude/workflows/dev-docs-review-wf.js` — P1 scribe :698 (wklejenie), fokus performance, `BLOK_SEMANTYKA` (łaty); P3 opcje, `TIERY_DOMYSLNE`, :904; P7 `kontekstPrompt`,
  `KONTEKST`, `WARUNKI`, źródło dossier; P8 blok limitu P3, `scribePrompt`; P9 verify; P10 odwołania do learned-patterns; P11 `REVIEWERZY`, treść `reviewerPrompt`,
  `testCoveragePrompt`, tiery spec i test-coverage; P14 `e2ePrompt`, bramka [E2E].
- `.claude/workflows/dev-docs-execute-wf.js` — P1 planner :118 i domknięcie :179 (wklejenie); P3 opcje; P6 domknięcie (bramki); P7 domknięcie (krok dossier, `EXECUTE_RESULT`);
  P10 planner (wycinek); P12 `promptIU` (warstwa referencyjna).
- `.claude/workflows/dev-docs-complete-wf.js` — P3 opcje; P4 CLAUDE.md, decyzje, commit, `*.bak`, PR ≤ 150; P8 P3 poza smoke operatora (`:67`); P10 pathspec (`:170`);
  P14 smoke operatora z [MANUAL], mapa funkcji; P15 sekcja „Ogród”.
- `.claude/workflows/dev-compound-wf.js` — P3 opcje; P10 treść.
- `.claude/workflows/dev-pr-wf.js` — P3 opcje; P5 zbierz, napraw, merge, zapis propozycji; P10 etap compound (szczebel, indeks).
- `.claude/workflows/__tests__/sceptycy-p2.test.mjs` — P3 tiery; P7 tier packagera; P9 batch i etykiety; P11 tiery spec i test-coverage.
- `.claude/workflows/__tests__/metryki-w-stanie.test.mjs` — P7 `dossierOpis`; P8 `otwartePoReview`.
- `.claude/workflows/__tests__/start-koniec.test.mjs` — P4 tworzy; P5 dokłada warunek decyzji.
- `.claude/workflows/__tests__/warstwa-stala.test.mjs` — P11 tworzy (reviewerzy); P12 rozszerza (buildery).
- `.claude/scripts/telemetria/faza.mjs` — każda paczka tylko swoje pole: P6 `bramki`, `testy_usuniete`; P7 `dossier_zn`, `review_rundy`; P9 `sceptyk`; P10 `wiedza`; P14 `e2e.manual`.
- `.claude/scripts/telemetria/role.mjs` — P7 i P8: role, które znikają.
- `.claude/scripts/dossier/` — P7 tworzy; P10 dokłada blok wycinka.
- `.claude/scripts/doctor/` — P2 tworzy; P3 ostrzeżenie o fladze D9 (odpadło: flaga nie działa w workflowach projektu, D9 ścieżką odwrotu — HANDOFF 6a pkt 47); P6 sprawdzenie devDependencies bramek; P11 licznik warstwy stałej.
- `.claude/scripts/wiedza/` — P10 tworzy; P12 dokłada dobór zdań D10.
- `.claude/settings.json` — P2 profil pluginów; P6 hook warunkowy.
- `README.md` — P1 lista skilli; P2 Instalacja i Wymagania; P3 PA-25; P6 bramki; P10 jedna linia CLAUDE.md i konwersja; P13 przepływ bez dev-docs; P16 przegląd całości.
- `.claude/agents/learnings-researcher.md` — P1 linia 256; P3 frontmatter.
- Pliki reviewerów (`security-sentinel.md`, `performance-oracle.md`, `spec-compliance-reviewer.md`) — P1 łaty faktów (H16, H17, H20, H24); P3 frontmatter; P11 treść od zera
  z zachowaniem łat. `architecture-strategist.md`, `correctness-reviewer.md`, `test-coverage-reviewer.md` — P3 frontmatter (nowe: + mandat); P11 treść.
- Pliki builderów (`feature-builder-data.md`, `feature-builder-ui.md`, `feature-builder-fullstack.md`) — P3 frontmatter + fakty Figmy / trybu ręcznego (H08–H12);
  P10 usunięcie kroku 1.7 (PA-27); P12 treść.
- `.claude/agents/feature-tester-e2e.md` — P3 frontmatter; P14 treść.
- `.claude/hooks/error-handling-reminder.sh` — P1 łata PA-18; P6 wyłączenie warunkowe.
- `.claude/skills/dev-docs/SKILL.md` — P3 linia handoffu N1; P13 usunięcie po scaleniu.
- `.claude/skills/dev-pr/SKILL.md` — P5 raport i rekomendacja; P10 odwołania do learned-patterns (`:138`, `:153`); P12 odwołanie do coding-rules (`:181`).
- `.claude/skills/coderabbit-setup/templates/coderabbit-base.yaml`, `.claude/skills/coderabbit-setup/SKILL.md` — P5 8 zmian i stała ścieżki coding-rules; P12 nowa ścieżka.
- `.claude/skills/dev-prep/SKILL.md` — P2 doctor i data; P13 odwołania po scaleniu.
- `.claude/skills/dev-brainstorm/SKILL.md` — P1 data; P13 odwołania po scaleniu.
- `.claude/skills/sync-template/scripts/__tests__/sync-template.test.mjs` — P1 test usunięć; P2 test komunikatu N2.
- `.claude/templates/smoke-autopilot/` — P0 skrypt i pakiet fixture; P6 konfiguracje bramek i defekt mechaniczny; P13 format planu; P14 scenariusz [E2E].

---

## 5. Wypada / zrobione / bez zmian / odłożone (z powodem)

**Wypada (zmiana założeń):**
- [W4-2d] B0 z 2–3 zadań — 6a pkt 40 (5): B0 nie jest warunkiem; pierwszy nowy projekt po poprawie = pierwszy odczyt.
- [6a-40-5] Część „B0 na nowym projekcie” jako warunek — jw.
- [W4-2e] Zadanie sprzątające ESLint w oferty-online — 6a pkt 36 (a): oferty to materiał do nauki; nowe projekty dostają konfigurację od pierwszego commita (P6).
- [D11] Kolejność wdrożenia z oknami W1–W7 — zastąpiona przez 6a pkt 40 (1) i §2 tego planu.

**Zrobione wcześniej:**
- [I-konto] [6a-36-b] [PW06] [PW50] [6a-20-cleanup] [PA-42] Higiena konta, audyt pluginów, `cleanupPeriodDays` 120, globalny CLAUDE.md — KROK 0 (6a pkt 37).
- [PW22] L8 (jak radzić sobie z dużą liczbą MCP i skilli) — w RAPORT-DLA-OPERATORA (6a pkt 36).
- [PW63] statusLine `npx …@latest` — KROK 0 zdecydował: bez zmian (KROK0-DECYZJE pkt 8).
- [K-raporty] [PW64] Raporty etapu 5 — 6a pkt 36.
- [C-slownik] [PW58] Zamknięty słownik klas — It. 1 (`KLASY_BLEDOW`, 33 klasy; 6a pkt 38).
- [6a-25-effort] Pole `effort` w rekordzie agenta — It. 1 (efort z transkryptu).
- [Z-telemetria] Agent telemetrii znika — It. 1.

**Bez zmian (decyzja „zostaje”):**
- [E-dedup] [PW52] Dedup (JS + haiku) zostaje (PANEL-WEJSCIE §2a; K13 bez pokrętła).
- [D-bypass] [PW19] Tryb bypass i czytanie Bashem zostają (6a pkt 15).
- [D-skills] [PW20] `skills:` u builderów zostaje (6a pkt 15; podział treści — P12).
- [B-prep] dev-prep bez zmian merytorycznych (PANEL §4a B; P2 dokłada tylko doctor).
- [D7-4] Walidacja końcowa raz na zadanie bez zmian (D7 warstwa 4).
- [PWE-1b] Domknięcie pkt 1b (audyt error-handlingu) nie jest duplikatem hooka — zostaje (P6 go nie rusza).
- [PWE-C] 28 uwag C i preferencje bota zostają botowi (ETAP1B).
- [PA-32] „To zakaz, nie sugestia” przy testerze — nacisk z udokumentowaną awarią, zostaje do re-testu (PROMPT-AUDIT, zasada proweniencji).
- [PA-34] RÓB / NIE RÓB w learnings-researcher — duplikaty zgodne, bez zmian.
- [PA-43] „Model potrafi odczytać uszkodzony JSON…” — powód twardego zakazu, zostaje.

**Odłożone z warunkiem:**
- [D12b] [J-d12] Nowa IU dla findingu wymagającego nowego pliku — nie teraz; warunek powrotu w P8 (≥ 3 B P1/P2 w plikach dodanych przez fix w oknie 5 PR).
- [J-regres] [PW47] Przejście regresyjne po funkcjach z mapy — warunek w P14 (uwagi bota / Sentry w funkcjach nietkniętych planem).
- [J-plugin] [PW18] Szablon jako plugin — nie teraz (6a pkt 13); bramka `validate` wchodzi niezależnie (P2).
- [6a-38-e1] Kompakcja `pipeline.jsonl` — przy ~100 MB (dziś 27,6 MB).
- [IT1-5] Ogólny mechanizm dla rekordów, których skan już nie tworzy — przy drugim przypadku (dziś filtr komend lokalnych wystarcza).

**Poza szablonem:**
- [G-mobile] [PW25] [6a-20-mobile] Szablon mobile — osobna decyzja operatora (własne, zmienione kopie).
- [6a-37-e] Token Airtable — po stronie operatora.

**Odrzucone przez operatora (6a pkt 26, nie wracać):**
- [INS-B3] skala pewności dowodu 1–5; [INS-B4] lżejszy plan + „szwy testowe”; [INS-B5] równoległe IU w worktree; [INS-drabina] drabina egzekwowania jako zasada
  przekrojowa (szczebel zostaje w compoundzie — P10); [6a-26-odrz] zakaz komentarzy i sześć pozycji „na później”: [INS-C1] katalog odrzucanych uwag bota,
  [INS-C2] porażki CI, [INS-C3] dziennik decyzji, [INS-C4] opis PR z ryzykiem, [INS-C5] wizard, [INS-C6] ankieta dla klienta.
- „Nie bierzemy” z INSPIRACJE §4: [INS-N-poteto] router poteto-mode; [INS-N-interrogate] interrogate; [INS-N-sicko] osobny agent komentarzy; [INS-N-shipping] auto-merge;
  [INS-N-orchestrate] orchestrate / swarm / arena; [INS-N-petla] pętla zewnętrzna Slack/Sentry; [INS-N-formalna] weryfikacja formalna; [INS-N-setup] setup-pstack;
  [INS-N-matt] pozostałe skille Matta (handoff, tracker, teach, grill-with-docs itd.).

---

## 6. Decyzje do operatora (rekomendacja pierwsza)

- **Pozycje:** [W4-slepy] [6a-26-f] [6a-40-4] [PW44] [INS-A5] [6a-38-e3]

**D-1. Ślepe testy przed/po dla zmian promptów reviewerów i builderów (6a pkt 26 f, PANEL §3 pkt 6, It. 7c).**
- **Rekomendacja: zostają, ale jako dwa testy, nie per zmiana.** (a) Reviewerzy (P11): stare i nowe pliki na tym samym, bieżącym zestawie pipeline'u (po P3–P10),
  7 z 13 faz testu review wybranych pod osie security, code-quality i performance, jeden przebieg sędziego z neutralnymi etykietami — infrastruktura `~/test-review/`
  (9,6 GB: kopie faz, klucze 1 i 2, sędzia skalibrowany 0/20) nadal istnieje, ale harness trzeba przerobić pod dossier ze skryptu; ~30–40 M, 2 sesje. Wrześniowy
  wariant 0 nie jest porównywalnym „przed”, bo jechał na starym zestawie (packager, pełny learned-patterns, bez allowlisty). (b) Buildery (P12): 1–2 historyczne fazy,
  stare vs nowe pliki, ~10–15 M, 1 sesja. Razem ~45–60 M. Osobno, tanio (~2–4 M) i przed merge'em P9: kill rate nowego sceptyka na archiwalnych findingach.
  Powód: test review raz już pokazał, że krótsze brzmienie potrafi zgubić połowę trafień (security 16 → 8, code-quality 12 → 2) — właśnie w rolach, które P11 przepisuje;
  telemetria na nowym projekcie pokaże stratę dopiero po tygodniach i bez przypisania do zmiany, bo wszystkie paczki wchodzą razem. 7 faz zamiast 13: szersze przedziały
  ufności, ale test ma wyłapać duże straty tego rzędu, nie drobne różnice.
- Opcja 2: tylko test reviewerów (~30–40 M) — buildery mierzone telemetrią (mini-run (a): reguła wklejona builderowi stosowana 40/40, ryzyko niższe).
- Opcja 3: bez ślepych testów — najtaniej i najszybciej; ryzyko cichej utraty trafień w security i code-quality do czasu odczytu uwag bota.

**D-2. Kiedy push szablonu do GitHuba.**
- **Rekomendacja: po każdej zamkniętej grupie (I po P5, II po P9, III po P12, IV po P16), zawsze po zielonym smoke'u ostatniej paczki grupy; stan It. 1 idzie z grupą I.**
  Powód: projekty i kursanci dostają zmiany dopiero po push + `sync-template`; każda grupa zostawia szablon spójny, a push w środku grupy (np. P11 bez P12) dałby
  kursantom stan przejściowy. Cztery pushe = cztery momenty „nowa sesja po syncu” zamiast siedemnastu.
- Opcja 2: jeden push na końcu (P16) — najmniej zamieszania, ale projekty przez całą serię bez poprawek, w tym bez telemetrii v4.
- Opcja 3: po każdej paczce — najszybciej u kursantów, najwięcej stanów przejściowych.

**D-3. Smoke po każdej paczce czy po grupie.**
- **Rekomendacja: po każdej paczce zmieniającej workflowy — 15 smoke'ów (P0, P1, P3, P4, P5, P6–P15; P7 i P14 z drugim krótkim przebiegiem), ~75–80 M
  i ~15 × 25 min operatora** (skrypt kopii z P0 sprowadza pracę operatora do otwarcia sesji w kopii i jednej komendy). Powód: zapis 6a pkt 40 (3) tak zakłada, a awaria jest od razu przypisana do jednej paczki —
  cofnięcie to porzucenie jednej gałęzi.
- Opcja 2: po grupie — 5 smoke'ów (R0 + po P5, P9, P12, P15), ~25–30 M; awaria wymaga szukania winnej paczki (każdy dodatkowy smoke ~5 M i sesja operatora).

**Decyzje przy wdrożeniu (nie teraz, w paczkach):** PA-25 kopia Figmy (P3, rekomendacja: plugin); coding-rules wiersz po wierszu (P12); próg i N ogrodnika (P15);
kryterium kalibracji klasyfikatora (P5).

---

## 7. Co zostaje poza szablonem, ale jest potrzebne do wdrożenia

- Kopie oferty-online na smoke — tworzone i usuwane przez operatora (zgoda na dokładną ścieżkę przed usunięciem).
- `~/test-review/` — potrzebny do ślepego testu P11 i P12; nie usuwać przed P12.
- Czyste konto do testu instalacji per projekt (P2) — operator.

---

## 8. Kontrola kompletności i przegląd

- **Skrypt:** `python3 skrypty/plan_poprawy_pokrycie.py` — rejestr pozycji źródłowych (PANEL-WYNIK §2–§5, 65 pozycji `panel_wynik_pokrycie.py`, PA-01…PA-44
  z PROMPT-AUDIT, 62 hunki z nagłówka diffu, INSPIRACJE A1–C6 i „nie bierzemy”, HANDOFF 6a pkt 20, 25, 26, 34, 36–40, IT1-ODCZYT §5–6, PANEL-WEJSCIE §2a/§10 spoza
  listy 65) → sprawdza: (1) źródła → plan: każda pozycja przypisana dokładnie raz (paczka, §1, §6 albo §5 z powodem), PA z hunkami — przez hunki; (2) plan → źródła:
  każdy tag istnieje w rejestrze, każdy punkt `Zakres:` ma tag, każda paczka ma pozycje; (3) każdy hunk w dokładnie jednej paczce, a jego plik na liście `Pliki:`
  tej paczki; (4) każdy plik ruszany przez ≥ 2 paczki opisany w §4. Wynik: `dane/plan-poprawy-pokrycie.txt`, mapa `dane/plan-poprawy-mapa.csv`, pliki `dane/plan-poprawy-pliki.txt`.
- **Wynik skryptu (po poprawkach z przeglądu):** rejestr 395 pozycji (220 + 4 ręcznych, 65 z listy PANEL-WYNIK, 44 PA, 62 hunki); 333 do przypisania + 21 PA
  przez hunki; **KOMPLETNY — 0 braków**; 390 tagów, 126 punktów Zakres, 36 plików wspólnych opisanych w §4.
- **Odbiór skryptu:** 7 podłożonych naruszeń na kopii planu (usunięta pozycja, dubel, hunk bez paczki, nieznany tag, punkt bez tagu, wspólny plik bez opisu,
  plik hunka poza `Pliki:`) — wszystkie wykryte, kod 1 (`dane/plan-poprawy-pokrycie-odbior.txt`).
- **Przegląd niezależnego subagenta** (general-purpose, Opus, tylko odczyt, weryfikacja na kodzie HEAD): werdykt „do przyjęcia po poprawkach” — 25 uwag, 1 blokująca
  (P7: skrypt workflowu nie czyta plików, więc dossier i stan potrzebują kanału), 14 ważnych, 10 drobnych. **Wszystkie naniesione**; najważniejsze: kanał dossier przez
  `EXECUTE_RESULT` + zapasowy agent przy wznowieniu, stan fazy przejmowany przez agentów już startujących w danym miejscu (odstępstwo od „stan:zapis znika” tam,
  gdzie takiego agenta nie ma), narzędzie do pojedynczych hunków i lista hunków „jako treść”, pełna lista odwołań learned-patterns (P10, z PA-27) i coding-rules (P12),
  testy przypięte do zmienianego zachowania (P7, P8, P11), telemetria sceptyka na etykietach (P9), kill rate przed merge'em P9, ślepy test na bieżącym zestawie
  w jednym przebiegu sędziego (P11, koszt D-1 przeliczony), cztery poprawki faktów reviewerów do P1, warunek security = advisors faktycznie uruchomione,
  P14 — STOP na starcie vs [MANUAL] w trakcie, fixture z prawdziwymi bramkami (P0/P6), kontrakt decyzji P4 → P5, kontrakt `docs/active/` (P13). Lista uwag
  i sposób naniesienia: `dane/plan-poprawy-przeglad.txt`.
