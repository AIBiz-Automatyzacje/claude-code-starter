# RAPORT-TECHNICZNY — spis wyników analizy pipeline'u dev-* (etap 5, forma skrócona)

**Data:** 2026-09-27. **Status:** ZAAKCEPTOWANY 2026-09-28 (HANDOFF 6a pkt 36; forma 6a pkt 35). **Dla kogo:** Claude przy wdrażaniu iteracji. **Forma:** spis — decyzja w jednej linii
+ plik z dowodem; treść i uzasadnienia są w `PANEL-WYNIK.md` (decyzje D1–D12, pokrętła K1–K13, plan It. 1–9, §4a pełna lista 65 ustaleń) i w plikach
etapów. Nie kopiuję ich tutaj. **Wersja dla operatora:** `RAPORT-DLA-OPERATORA.md`.
**Jedyna nowa liczba:** koszt „po całym planie” — `skrypty/raport_koszt_po.py` → `dane/raport-koszt-po.{txt,json}` (wejście `dane/panel-projekt-docelowy.json`).

---

## 0. Koszt typowego zadania: dziś vs po całym planie (`dane/raport-koszt-po.txt`)

† = dolna granica: jednostki z małych faz runu 20.09 zaniżają duże fazy o ~39% (`dane/panel-koszt.txt` §3). Porównania względne tego błędu nie dziedziczą
w całości. Model: `panel_koszt_model.py` (metoda d4r), typowa faza 3,71 / zadanie; kontrola §0 skryptu: projekt 0 odtworzony co do < 0,1%.

- **S0 dziś:** faza 12,75 M†, zadanie 52,04 M†, 122,8 agenta na zadanie.
- **S1 + allowlista (It. 3a):** zadanie 31,10 M† (−40,2%). **S2 + learned-patterns poza eager (It. 8) = „po” panelu:** 25,41 M† (−51,2%).
- **S3 docelowe role w kontekście dziś:** 45,31 M† (−12,9%). **S5 PO CAŁYM PLANIE:** faza 5,65 M†, zadanie 22,37 M† (**−57,0%**), 99,0 agenta.
- **Dźwignie się nie sumują:** kontekst −51,2% + pokrętła −12,9% = −64,1% (ŹLE); poprawnie (1 − 0,512) × (1 − 0,120) − 1 = −57,0%. Pokrętła i zmiany ról
  po zmianie kontekstu dają −12,0%, a w dzisiejszym kontekście −12,9%. Usunięcia mechaniki w kontekście dziś to −7,8%, po allowliście −2,2%.
- **Grupy po kontekście (każda sama, % zadania S2):** mechanika −4,4%; pokrętła review (K1, K2, K4, K9) −4,5%; batch sceptyków P2 −3,3%; kontrola
  diffu fixa wg A ±0,0% (koszt jak pre-skan + dzisiejsza kontrola, verify-fix znika); ogrodnik +0,3%.
- **Mnożniki pracy z testu** (kalibracja: koszt roli na fazę = test A/0 lub B/0 × dziś): test-coverage ×0,492 (K1), correctness ×0,737 (K4), spec ×0,927 (K2),
  verify-batch ×0,577 (K11), fix:kontrola ×1,066 względem pary pre-skan + kontrola (D12 cz. 1). Efort nie wchodzi wariantem ±20% — siedzi w mnożniku.
- **Udziały etapów S5:** execute 28,7%, review 27,2%, fix 18,6%, E2E 8,1%, sceptycy 6,6%, orkiestracja 4,3%, zamknięcie 4,1%, mechanika 2,5%.
  Etap review S2 → S5: −15,9% (w teście, bez K7: −19,3%).
- **Poza liczbą główną:** fix tylko P1/P2 (×0,6 = założenie A) → −58,0%. Nieliczone: K12 (efort sesji ±15%), mniej powtórek po STOP, D7, D8a/D8b (skille
  przed autopilotem, ~4–7% zadania), K10, fałszywe alarmy list w fixie, USD (haiku ~4× tańszy per token).
- **Sygnał dla kolejności:** learned-patterns poza eager (S1 → S2, −18,3%) > listy It. 7 (część grupy review) — warunek zamiany It. 7 ↔ It. 8
  z PANEL-WYNIK §4a A ma już przesłankę z modelu; decyduje odczyt po It. 3.

## 1. Decyzja per element pipeline'u

Format: **element** — decyzja · iteracja · dowód.

- **Roster review** — 6 osobnych reviewerów + tester E2E zostają; A/B/C nie idą dalej · — · TEST-REVIEW-WYNIK §4, §12; 6a pkt 32; PANEL-WYNIK D1.
- **performance** — zostaje (ETAP1 ZASTĄP cofnięte; 7 trafień tylko jego) · — · PANEL-WYNIK §3 pkt 1, K6; `dane/pokretla-kosztu.txt` „wkład ról”.
- **security** — brzmienie i efort bez zmian do ślepego testu; warunek „faza z kodem”; advisors po profilu stacku · 4a, 7c · PANEL-WYNIK §3 pkt 2, K5, K9.
- **code-quality** — `high` + własny prompt; warn/knip jako wejście; prompt w jednym miejscu · 4a, 7c · PANEL-WYNIK §3 pkt 3, K3; §4a E.
- **correctness** — polecenia-listy L-COR (bez L-COR-6/7), własny plik agenta · 7a, 3a · K4; PANEL-WYNIK §4a D.
- **spec-compliance** — tylko fazy z kodem (+ teksty UI / prawne), listy L-SPC, `medium` · 7b · D4, K2, K9.
- **test-coverage** — zostaje osobno, `medium`, lista mutantów ułożona jak w C · 4b · D5, K1; TEST-REVIEW-WYNIK §7.
- **Sceptycy** — asymetryczni; P2 batch 4 niezależnie od pliku, P1 ×3 · 5 · D2, K11; `dane/pokretla-kosztu.txt` „weryfikacja”.
- **Dedup** — zostaje (haiku) · — · K13; PANEL-WEJSCIE §2a.
- **Packager / dossier** — skrypt uruchamiany przez domknięcie, bez mandatu · 3d · D3, K7, K8.
- **Pętla fix** — tylko P1/P2, P3 → known-issues/bot, zakaz zmian poza miejscem · 6 · PANEL-WYNIK It. 6; 6a pkt 15.
- **Kontrola po fixie** — kontrola diffu fixa wg katalogu A (K-1…K-7), `fix:pre-skan` i verify-fix znikają · 3 · D12 cz. 1; TEST-REVIEW-WYNIK §6.
- **Finding → nowa IU** — nie teraz; powrót przy ≥ 3 B P1/P2 w plikach dodanych przez fix w oknie 5 PR · — · D12 cz. 2; `dane/d12-nowe-pliki-fixa.txt`.
- **Bramki** — jeden skrypt w domknięciu (ESLint typowany, knip, size-limit, tsc, `vitest --typecheck`, `migrations.sum`, niezmienność migracji, advisors,
  Stryker diff-scoped, granice warstw), każda z testem porażki · 4a · D7, D5; TEST-REVIEW-WYNIK §7; 6a pkt 26 (d), (i).
- **Warstwy weryfikacji** — cztery (builder na plikach IU, domknięcie, fix, walidacja końcowa) · 4a + R1 · D7.
- **Efort** — jawny: reviewerzy `high`, sceptyk P2 `medium` / P1 `high`, mechaniczni haiku; potem test-coverage i spec `medium` · 3b, 4b, 7b · D6, K12.
- **Kontekst agentów** — allowlista `tools:` w plikach klas ról, `omitClaudeMd` u mechanicznych, CLAUDE.md u builderów i reviewerów, bypass zostaje
  (reguły `paths:` = bonus, mini-run (b) 0/3), MCP per agent (Figma tylko przy `figma_screens`), zdanie N1 · 3a · 6a pkt 10, 15, 18; MINI-RUN-WYNIK (b), (e);
  `dane/d4r-dzwignia-kontekstu.txt`.
- **Wiedza (learned-patterns)** — 3 poziomy, indeks generowany, wycinek po katalogach IU, 8 zabezpieczeń, konwersja skryptem · 8 · PANEL-WYNIK §4a A; 6a pkt 17.
- **Reguły builder ↔ reviewer** — zapobiegalne u buildera (zdanie „co robić zamiast”), wykrywalne u reviewera, mechaniczne w ESLint · 8 · D10.
- **Warstwa stała ról** — < 150 poleceń w oznaczonym bloku, test w `__tests__`, zasady 1–11 · 9 · PANEL-WEJSCIE §2 pkt 3, §2a; K10.
- **CLAUDE.md** — żaden skill nie dopisuje; uzgodnienie po merge'u w dev-pr; `docs/decisions/` · 3c · PANEL-WYNIK §4a A; 6a pkt 1, 11.
- **Planowanie** — scalony dev-plan (zadania generowane skryptem), research warunkowy przy „Lekka”, budżet pliku i rejestr stałych · R1, 8 · D8a, D8b; 6a pkt 8.
- **Skille** — `disable-model-invocation` dla 4 workflowów-dzieci, `skills:` builderów zostaje (treść dzielona) · 3c, 9 · D9; D6; 6a pkt 15.
- **Telemetria** — `zbierz.mjs` (skan pliku harnessu) + `raport.mjs`, agent telemetrii znika, `agent.effort`, `run.pr`, import historii · 1 · PANEL-WYNIK It. 1;
  `dane/d5-telemetria-rekord.txt`; `dane/d5b-mapa-walidacji.txt`.
- **E2E** — parametryzacja `.env.e2e`, STOP środowiskowy → [MANUAL] → smoke, Doctor przed startem, skill weryfikacji z mapą funkcji; regresja po
  funkcjach odłożona · 3e, R1 · 6a pkt 18 L11, 19, 26 (h); PANEL-WYNIK §4a J.
- **dev-pr** — 4 zmiany z ETAP1B §4, sufit 3 tur, `pr:zbierz` z klasą/osią/wagą na zamkniętym słowniku · 2 (+ słownik w 1) · PANEL-WYNIK §4a C; ETAP1B §4.
- **Bot (CodeRabbit)** — 8 zmian `.coderabbit.yaml` + generator `coderabbit-base.yaml` + opis w skillu; B0 po zmianie · 2 · ETAP1B §2; 6a pkt 18 L19.
- **Usunięcia** — code-review, code-quality, gemini, dev-docs-update, bugfix, dev-ideate, freshness-audit (+ wf), tryb ręczny execute/review (treść
  SKILL.md → workflowy), kieran/simplicity po wykorzystaniu treści; README, `learnings-researcher.md:256`; mobile osobno · 3c (kieran/simplicity: 7a) · 6a pkt 20; D6.
- **Ogrodnik, compound ze szczeblem, hook error-handling** — R1 po It. 3 · PANEL-WYNIK It. R1; 6a pkt 26 (a), (j); 6a pkt 18 L14.
- **coding-rules** — przepisanie wg ETAP2 + PA-26 (decyzja operatora, It. 8); wyjątek §2 (zielony test niefalsyfikowalny) w It. 4b · PANEL-WYNIK §4a F.
- **doctor / README / CI maszynerii** — doctor (narzędzia z projektu), sekcja „Wymagania”, `claude plugin validate --strict` + `eval` · 3c · §4a F.
- **Prompty maszynerii** — PA grupa (a) w 3c (PA-15 w It. 3), (b) PA-01, 02, 05, 06, 07 tylko po ślepym teście w 7c, (c) PA-25 i PA-26 decyzje operatora,
  PA-24 i PA-27 w It. 8; ponowny prompt-audit po iteracjach promptów · 3c, 7c · 6a pkt 25; PANEL-WYNIK §3 pkt 6, §4a H.
- **Porządki review i testy maszynerii** — precheck → env-up; wywołanie test-coverage bez `zEffortem`/`agentType` (`dev-docs-review-wf.js:904`) razem z 3b;
  duplikat fokusu spec (`REVIEWERZY:368`); seedy z właścicielem (tester L-E2E-2, security, bot); niezmienność migracji i `migrations.sum` w 4a; `__tests__`
  (74 testy) aktualizowane w każdej iteracji + test telemetrii (1), testy porażki bramek (4a), test budżetu (9); `templates/smoke-autopilot` po każdej iteracji
  · 3c, 4a · PANEL-WYNIK §4a E, F.
- **Kolejność wdrożenia** — It. 1–9 + R1; R1 równolegle, R2 tylko rozłączne osie, R3 okno 5 PR dla siebie; okno ≈ 1 tydzień przy 6,1 PR/tydzień, całość ≈ 2 miesiące
  (tempo oferty-online z września; dla nowych projektów nieznane — §2) · — · D11; `dane/tempo-pr.txt`.
- **Higiena konta = KROK 0 przed It. 1 (operator 2026-09-28; wcześniej „równolegle z It. 1”)** — decyzje per element z operatorem na podstawie
  inwentarza, konfiguracja zapisana przed usunięciem, pomiar przed/po narzędziem; kierunek: plugin/MCP „globalnie tylko to, co wszędzie”, reszta per projekt; pluginy z claude.ai (`<nazwa>@synced`) off w projektach kodu;
  `disableClaudeAiConnectors`; `cleanupPeriodDays` 120; hook error-handling z poziomu user; martwe wpisy · przed B0, równolegle z 1 · §4a I; §2a niżej;
  narzędzie `skrypty/konto_inwentarz.py`.
- **Szablon jako plugin** — nie teraz · — · 6a pkt 13.

## 2. Zmiana założenia (operator 2026-09-27): oferty-online = materiał do nauki, wdrożenie i pomiar na nowych projektach

Operator nie będzie w najbliższym czasie pracował w oferty-online — buduje nowe projekty. Żaden krok planu nie może wymagać pracy w tym projekcie.
Decyzje D1–D12 i pokrętła K1–K13 bez zmian (dotyczą szablonu); zmienia się miejsce pomiaru. Wpisane: HANDOFF 6a pkt 36, dopisek w PANEL-WYNIK §4. Krok 0 (higiena konta, widok globalny całego komputera): HANDOFF §8.

- **B0 (It. 2)** — pierwsze 2–3 zadania NOWEGO projektu na obecnym pipelinie + It. 1 + konfiguracja bota; per typ kodu. Ryzyko: pierwsze zadania = szkielet
  (L16 mocniej) → pierwsze okna czytać ostrożnie; formuła progów bez zmian: ≥ max(3, 2 × oczekiwana) względem B0 nowego projektu.
- **Kalibracja klasyfikatora `pr:zbierz`** — zostaje na starych PR-ach oferty-online vs klasyfikacja 1b (odczyt historii, zero pracy w projekcie).
- **Zadanie sprzątające ESLint w oferty-online** (188 błędów, 5 plików z klientem Supabase) — WYPADA. Warunek It. 4a („brak zastanych błędów lintu”)
  w nowym projekcie spełniony od startu, bo szablon wnosi ESLint z bramkami od pierwszego zadania. Reguła 6a pkt 26 (g) zostaje dla powrotu do starego projektu.
- **It. 3e parametryzacja E2E** — zostaje (nowe projekty też mogą mieć serwer Node zamiast Vite), ale nie blokuje niczego; sync oferty-online poza planem.
- **Tempo 6,1 PR/tydzień i „≈ 2 miesiące”** — tempo oferty-online z września; dla nowych projektów nieznane → czas planu = 7 okien × tempo nowego projektu.
- **Tło liczbowe mapy walidacji** (wrzesień 3,5/100, pliki fixa 14,0 vs 4,7, progi 4 i 12, osie 2 i 7 na 683 pliki) — tylko tło; progi odwrotu względem B0.
- **Import historii (It. 1)** — `agents.csv`, odzyskana telemetria, `skille.csv`, klasyfikacja 574 zostają jako archiwum (tło), nie baseline.
- **Ślepe testy promptów (I5, It. 7c, 9)** — materiał: kopie historycznych faz oferty-online (`~/test-review/kopie`, tylko odczyt) albo fazy nowego
  projektu, gdy będą; test review pokazał, że kopie działają bez pracy w samym projekcie.
- **Model kosztu i „koszt po” (§0)** — z runów oferty-online; porównanie względne stoi, liczby bezwzględne nowego projektu da telemetria.
- **Unieważnione:** rekomendacja „sync oferty-online przed B0” z pierwszej wersji tego raportu (fakt: workflowy oferty-online ostatnio zmienione
  2026-09-04 — patch E2E `a5e9b76`, `1de5a4c`; commity 16–25.09 tylko `learned-patterns.md`) — nieistotna, skoro pomiar idzie na nowych projektach.

### 2a. Konto: narzędzie i stan (L8, §4a I) — `skrypty/konto_inwentarz.py` → `dane/konto-inwentarz-workspace-template.txt`

- **Narzędzie:** tylko odczyt, stdlib, ~10 s; `python3 skrypty/konto_inwentarz.py <projekt> [--dni 30] [--koszt]`. Źródła: `~/.claude/settings.json`,
  `~/.claude.json` (MCP user + `projects[ścieżka]` = local, `disabledMcpServers`), `.claude/settings{,.local}.json` i `.mcp.json` projektu,
  `~/.claude/plugins/installed_plugins.json` + katalogi pluginów (skille/agenci/MCP/hooki), `~/.claude/{skills,plugins}/synced/<org>_<account>` (tylko
  aktywne konto z `oauthAccount`), transkrypty 30 dni (mcp__*, Skill, Agent, `<command-name>`), `claude plugin details` (Always-on). Reguły poziomów
  z docs: pluginy local > project > user; MCP local > project > user > plugin > claude.ai; skille user > project + plugin + claude.ai; `skillOverrides`
  (`on`/`name-only`/`user-invocable-only`/`off`); `disableClaudeAiConnectors` (true z dowolnego poziomu wygrywa); `syncClaudeAiSkills`/`syncClaudeAiPlugins`.
- **Stan (widok z workspace-template):** 15 aktywnych pluginów = ~41,9k tok always-on na sesję; posthog ~30,2k (164 skille, użyty w 3 proj.),
  aibiz ~2,8k, strona-przez-rozmowe@synced ~2,5k (hook PreToolUse = md-guard w każdym projekcie), figma ~2,1k; ~274 skille na liście; design@synced
  wnosi 9 MCP (8 bez użycia); MCP user 5 (context7, mobbin — 1 proj.; airtable, Fakturownia — 2 proj.; playwright wyłączony w /mcp); hooki user:
  `error-handling-reminder.sh` (Stop) i `skill-activation-prompt.sh` globalnie; 42/121 wpisów `~/.claude.json` bez katalogu; brak reguł hookify.
- **Stan docelowy — DO USTALENIA z operatorem w kroku 0** (operator: nie chce globalnie m.in. frontend-design; część pluginów do skasowania).
  Wstępny kierunek z danych: poziom user minimalny (claude-powerline = statusLine, zostaje, dopóki statusLine go używa); posthog/sentry/supabase/
  hostinger/figma/ccc-skills/hookify (bez reguł) → project/local albo usunięcie; `*@synced` kursowe → `false` w projektach kodu;
  MCP user → local tam, gdzie używane; szablon `.claude/settings.json` z `enabledPlugins` do budowy aplikacji, `false` dla pluginów kursowych
  z claude.ai i `disableClaudeAiConnectors: true` (It. 3c; sprawdzić w `/mcp`, czy aplikacja desktop respektuje klucz).
- **Relacja do allowlisty:** allowlista (It. 3a) zdejmuje konto z agentów pipeline'u; higiena zdejmuje je z sesji głównej operatora (dev-plan, dev-pr,
  rozmowy) — tego allowlista nie robi. Oszczędności się nie sumują dla agentów (po allowliście konto ich nie dotyczy).

## 3. Mapa plików analizy (`docs/reviews/2026-09-19-analiza-pipeline/`)

**Aktualne — czytać w tej kolejności przy wdrożeniu:**
1. `HANDOFF.md` §8 (instrukcja startowa), 6a pkt 1–35 (decyzje operatora), §7 (pułapki techniczne).
2. `PANEL-WYNIK.md` — decyzje D1–D12, pokrętła K1–K13, plan It. 1–9 + R1, §4a pełna lista 65 ustaleń; wersja operatora `PANEL-WYNIK-DLA-OPERATORA.md`.
3. `RAPORT-TECHNICZNY.md` (ten plik), `RAPORT-DLA-OPERATORA.md`.
4. `TEST-REVIEW-WYNIK.md` (+ wersja operatora) — wynik testu review: klucze, D5, D12, bramki, straty klucza 2 (§11).
5. `PANEL-WEJSCIE.md` — wymogi §2, twarde wejścia §2a, elementy §7, tezy §8, ograniczenia §9, lista zmian §10, rekord telemetrii §12 (z korektami D1–D6
   i mini-runu); wersja operatora `PANEL-WEJSCIE-DLA-OPERATORA.md`.
6. `dane/d5-telemetria-rekord.txt` (rekord), `dane/d5b-mapa-walidacji.txt` + `MAPA-WALIDACJI-DLA-OPERATORA.md` (metryka, baseline, horyzont, odwrót).
7. `PROMPT-AUDIT.md` + `dane/pa-proponowany.diff` (diff sprawdzony na HEAD 46e854b — przed naniesieniem `git apply --check` i `__tests__`).
8. `MINI-RUN-WYNIK.md` (a–f, N1–N3), `INSPIRACJE-POCOCK-PSTACK.md`, `POMIARY-ROZSTRZYGNIECIE.md`, `ETAP1B-ROZSTRZYGNIECIE.md` (bot, dev-pr).

**Historyczne (zapis przebiegu; aktualne tylko tam, gdzie PANEL-WYNIK/PANEL-WEJSCIE się na nie powołuje):** `ETAP1-ROZSTRZYGNIECIE.md`,
`ETAP2-ROZSTRZYGNIECIE.md` (+ wersja operatora), `ETAP3-ROZSTRZYGNIECIE.md` (+ wersja operatora), `PROPOZYCJA-POPRAWEK-DOMKNIEC.md`,
`PROPOZYCJA-POPRAWEK-MAPY-WALIDACJI.md`, `PRZEGLAD-D4/D6-DLA-OPERATORA.md`, `MINI-RUN-PLAN*.md`, `PANEL-PLAN*.md`, `TEST-REVIEW-PLAN*.md`,
`TEST-REVIEW-{PRZYGOTOWANIE,PILOT,ETAP}-DLA-OPERATORA.md`, `POMIARY-DLA-OPERATORA.md`, `dane/dane-digest.md` (wersja 2 + korekty).

**Zapisy NIEAKTUALNE — nie brać jako wejścia:**
- HANDOFF §4 — werdykty 6 osi z workflow-A (dane v1, zawyżone ~2×) → ETAP1 → PANEL-WYNIK D1/§3.
- HANDOFF §5 — hipotezy „po”: stan w PANEL-WEJSCIE §5; hip. 4 (powtórka po STOP = tester) i 7 (Read zamiast Bash) NIEAKTUALNE; hip. 3 (roster 6 → 4–5) odwrócona testem.
- HANDOFF §6 — dawna kolejność prac (panel projektowy, 3 projektantów, publikacja raportu jako artefaktu) → zastąpione 6a pkt 23, 28–35.
- HANDOFF §3 pkt 1 „output 2%” → 10,9% (1 293 M); pkt 6 „2–5% zadania” → 4–7%; „40% kontekst × tury” → dźwignia 40–50% (D4).
- ETAP1 §1 performance ZASTĄP → cofnięte (PANEL-WYNIK §3 pkt 1); security 191 → ~90 linii → wstrzymane do ślepego testu; code-quality „zakaz zgłaszania
  tego, co łapie lint” → lint jako wejście; „powtórka po STOP E2E = sam tester” → [MANUAL] (6a pkt 18).
- ETAP2 §6 „bot łapie nas linterami” → „modelem, nie linterami” (POMIARY §2, PANEL-WEJSCIE §9).
- ETAP3 §1.1 dźwignia 25–35% → 40–50% (D4r); POMIARY §5 pkt 1 (każdy agent `omitClaudeMd`, Read) → 6a pkt 15.
- POMIARY §4 „nowe findingi po fixie = review kodu naprawczego” → pół na pół (D1r).
- PANEL-WEJSCIE §6 zał. 2, 3, 6 → cofnięte / wstrzymane (PANEL-WYNIK §3); zał. 1 „60–70%” → obniżone, listy per oś.
- PANEL-PLAN — projekty A/B/C jako kandydaci; `dane/panel-run2-*` (ocena papierowa przecenia: 33% vs 0%); `skrypty/panel_run3_*` nieuruchomione.
- 6a pkt 19 „panel na Fable” → Opus 5.5 (6a pkt 22); D6 „retencja 7 tyg.” → ~30 dni; HANDOFF §2 wiersz 4 „panel projektowy” → panel decyzyjny + test.

## 4. Ograniczenia L5–L19 i tezy PANEL-WEJSCIE §8 — stan po teście review

**Ograniczenia (ETAP3 §2; do raportu PANEL-WEJSCIE §9):**
- **L5** Read vs Bash — rozstrzygnięte precedensem 6a pkt 15 (bypass zostaje).
- **L6** kill rate sceptyka niezmierzony — nadal; test: sceptycy A/B/C 0 prawdziwych skasowanych vs dziś 2 z 21 (małe N). Pomiar na archiwalnych findingach
  przed It. 5 · PANEL-WYNIK D2.
- **L7** model kosztu sprzed N1–N9 — uwaga, niska waga; `raport-koszt-po` dziedziczy ją (jednostki z runu 20.09).
- **L8** −50k to pusty agent CLI na koncie z pełnym MCP — desktop 54–77k (opus) / 37–53k (haiku), zależne od MCP w sesji; mini-run (e): reviewer 118,8k → T 53,5k
  → TOLk 29,7k (`dane/mr-kontekst.txt` §1) · opis dla operatora: RAPORT-DLA-OPERATORA cz. 4.
- **L9** pomiar 2 (97/200, ±3 linie, ERROR nie liczone) — wniosek zachowawczy stoi; test: bramki dołożyły złapania (C: 4 tylko bramką), żadna oś nie wypadła.
- **L10** advisors niezmierzone — nadal (chmura, Management API); pomiar przy It. 4a.
- **L11** E2E — rozstrzygnięte: [MANUAL] + parametryzacja (It. 3e); patrz §2 (kolejność synca).
- **L12** słownik klas — It. 1 (zamknięty słownik dla `pr:zbierz`).
- **L13** /bugfix — usunięty (6a pkt 20); miara jakości = bot (+ Sentry później).
- **L14** inwentarz poza rdzeniem — rozstrzygnięty (PANEL-WEJSCIE §7, 6a pkt 18, 20).
- **L15** mapa oś → plik → prompt — D3 zrobione (`dane/d3-mapa-rol-agentow.txt`).
- **L16** miara sukcesu zmienna bez zmian pipeline'u (12,8 → 5,2/100) — B0 per typ kodu po zmianie bota (It. 2), na nowym projekcie (§2).
- **L17** koszt wdrożenia nie jest kryterium — decyzja operatora (6a pkt 18).
- **L18** mandat dossier bez pomiaru — test: mandat bez efektu (K8: Bash 16,5 → 15,3 / 13,6 → 13,6) → odrzucony.
- **L19** generator coderabbit — It. 2.

**Ograniczenia decyzji (PANEL-WYNIK §6 pkt 1–8, obowiązują bez zmian):** pokrętła = górna granica (A zmieniał naraz efort, brzmienie, dossier); test
13 faz, jeden przebieg, jeden projekt (security i ogon bez wniosku); sceptycy B weryfikowali własne findingi; „nowy plik” ≈ nowa funkcjonalność; „≈ % zadania”
z małych faz; efort niezapisywany do It. 1; tempo września; `dane/pa-proponowany.diff` sprawdzony na 46e854b.

**Tezy na jednym filarze (PANEL-WEJSCIE §8):**
- Kontekst ≈ 40–50% kosztu fazy — potwierdzona (mini-run ≈48%, model S0 → S2 −51,2%); filar: jedno konto, jedno repo.
- Polecenia-listy domkną 60–70% uwag B — obalona w tej formie; test: zysk w correctness/spec, strata w security/code-quality → listy per oś (It. 7).
- Nowe findingi po fixie = review kodu naprawczego — pół na pół (D1r); test: kontrola diffu fixa łapie 15/30 urodzonych w fixie.
- Bramki nie kasują żadnej osi — stoi; bramki jako wejście, nie zastępstwo.
- Test-coverage do zdegradowania — obalona: zostaje, z mutantami 1/12 → 6/12 (C).
- Sceptyk asymetryczny ~4× — niezmierzony u nas (L6); przyjęty z warunkiem odwrotu.
- Model kosztu opisuje dzisiejszy szablon — niska waga (L7).

## 5. Szybkie zyski — najtańsze w It. 3c (R1, bez zmiany zachowania review)

Kolejność wg nakładu (najpierw zmiana jednej linii albo gotowy diff):
1. **D9** — `disable-model-invocation: true` we frontmatterze 4 workflowów-dzieci + skrócony opis autopilota; ~12k zn z każdej tury sesji głównej;
   warunek: test w doctor, że `workflow()` uruchamia dziecko.
2. **CLAUDE.md** — usunąć dopisywanie (`dev-docs-complete:115-116`, `complete-wf:160` wg 6a pkt 1 = PA-16).
3. **PA grupa (a)** — gotowe hunki w `dane/pa-proponowany.diff` (`git apply --include=<plik>`, najpierw `--check` na HEAD).
4. **Usunięcia 6a pkt 20** — pliki skilli + README + `learnings-researcher.md:256`; zero wpływu na koszt runów, mniej listy skilli operatora.
5. **Drobne z przeglądu runów** — bramka czystości (brudny tylko katalog zadania → commit, nie STOP), `complete` pomija `*.bak`, `fazyUkonczone` po stanie,
   stopka commita STOP; zielony main w bootstrapie; PR ≤ 150 plików.
6. **doctor + „Wymagania” w README + `claude plugin validate --strict` / `eval` w CI** — największy nakład w 3c.
7. **`.claude/settings.json` szablonu jako profil pluginów nowego projektu** — `enabledPlugins` do budowy aplikacji, `false` dla `*@synced` kursowych,
   `disableClaudeAiConnectors: true`; jedna zmiana pliku, działa od pierwszej sesji nowego projektu (§2a).

Poza 3c, też tanie: **3b efort jawny** (stała `TIERY_DOMYSLNE`, `dev-docs-review-wf.js:819`, + test `sceptycy-p2.test.mjs:157`) i **3a allowlista**
(pliki klas; największa dźwignia modelu: −40,2%).

## 6. Dane i skrypty (ścieżki względem katalogu analizy)

- **Koszt:** `skrypty/koszt_agentow.py` → `dane/agents.csv`, `dane/koszt_tabele.txt`, `dane/dane-digest.md`; korekta output `skrypty/d5r_koszt_output.py`;
  dźwignia `skrypty/d4r_dzwignia_kontekstu.py` → `dane/d4r-dzwignia-kontekstu.{txt,json}`; model panelu `skrypty/panel_koszt_{dane,model,projektu}.py`
  → `dane/panel-koszt-referencja.json`, `dane/panel-koszt.{txt,json}`, `dane/panel-projekt0-role.json`; **koszt po** `skrypty/raport_koszt_po.py` →
  `dane/raport-koszt-po.{txt,json}`.
- **Kontekst startu:** `skrypty/mr_kontekst.py` → `dane/mr-kontekst.{txt,json}` (dziś / T / TOL / TOLk per klasa).
- **Test review:** `skrypty/test_review_analiza*.py` → `dane/test-review/wynik*.{txt,json}`; pokrętła `skrypty/pokretla_kosztu.py` → `dane/pokretla-kosztu.{txt,json}`;
  D12 `skrypty/d12_nowe_pliki_fixa.py`; tempo `skrypty/tempo_pr.py` → `dane/tempo-pr.txt`.
- **Bot:** `dane/coderabbit/` (klasyfikacja 574), baseline jakości `skrypty/d5b_baseline_jakosci.py` → `dane/d5b-baseline-jakosci.txt`.
- **Skille:** `skrypty/d6_audyt_skilli.py`, `skrypty/d6r_rewizja_audytu.py` → `dane/d6*-*.txt`; `dane/skille.csv`.
- **Prompty:** `skrypty/pa_*.py` → `dane/pa-*`; **inspiracje:** `skrypty/insp_*.py` → `dane/insp-*.txt`.
- **Konto:** `skrypty/konto_inwentarz.py` → `dane/konto-inwentarz-workspace-template.txt` (tylko odczyt; §2a).
- **Kontrole kompletności:** `skrypty/d4_kontrola_odwrotna.py`, `skrypty/panel_wynik_pokrycie.py` (65/65), `skrypty/raporty_pokrycie.py` → `dane/raporty-pokrycie.txt`.
- **Pułapki techniczne:** HANDOFF §7 (md-guard, `usage` ostatni wpis per id, plik harnessu, `f-*` i `x-*` osobno, polskie znaki w `wc -c`).

## 7. Kontrola w obie strony

- **Raporty → źródła:** każda liczba z pliku danych albo dokumentu etapu wskazanego przy niej; sprawdzenie mechaniczne w `skrypty/raporty_pokrycie.py` (część „liczby”).
- **Źródła → raporty:** `skrypty/raporty_pokrycie.py` — pozycje z HANDOFF 6a pkt 1–35, PANEL-WEJSCIE §8–§9, PANEL-WYNIK §1–§6 → `dane/raporty-pokrycie.txt`.
