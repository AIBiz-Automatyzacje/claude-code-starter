# MINI-RUN — wynik (część C)

**Data:** 2026-09-23. **Status:** WYNIK ZAAKCEPTOWANY przez operatora 2026-09-23; wpisany do PANEL-WEJSCIE (obie wersje), mapy walidacji (obie wersje) i HANDOFF (6a pkt 21).
**Wersja dla operatora:** `MINI-RUN-DLA-OPERATORA.md`. **Plan i kryteria zapisane przed startem:** `MINI-RUN-PLAN.md` §7.
**Dane (wszystko skryptami, zero agentów analizujących):** `dane/mr-markery-wynik.{txt,json}` (a–d, `mr_ocena.py`), `dane/mr-kontekst.{txt,json}` (e,
`mr_kontekst.py`), `dane/mr-harness.txt` (f, `mr_harness.py`), `dane/mr-dodatkowe.txt` (dotarcie R/S, narzędzia agentów E, koszt serii — `mr_dodatkowe.py`),
`dane/mr-krok0-model.txt`; zrzuty kodu builderów `dane/mr-surowe/wyniki/{D100-*,D400-*,A-*}`, wpisy hooka `dane/mr-surowe/stop-hook.jsonl`.

## 0. Przebieg, modele, koszt

| seria | run | gdzie | agenci | model (z transkryptu) | koszt [M jedn.] |
|---|---|---|---|---|---|
| krok 0 | `wf_ab0244a1-f3e` | sesja 86e1644e | 5 | opus-5-5 ×3, opus-5, haiku | 0,42 M tok (harness) |
| D | (seria D, 10 worktree) | sesja 86e1644e, worktree kopii | 10 | claude-opus-5-5 ×10 | 2,20 (100: 0,81, 400: 1,39) |
| F | `wf_e8db4d90-026`, `wf_75d849a3-0d0` (+2 nieważne próby) | `claude -p` w `mr-f/` | 4 | haiku | mały |
| E1 | `wf_11b9703a-88c` | sesja 32225565 otwarta w kopii | 16 | claude-opus-5-5 ×12, claude-haiku-4-5 ×4 | 1,58 |
| E2 | `wf_05f587d0-a37` | j.w. | 8 | claude-opus-5-5 ×6, claude-haiku-4-5 ×2 | 0,46 |
| A1–A3 | `wf_05c98a00-54e`, `wf_3f022ded-be5`, `wf_28d5e2da-917` | j.w. | 3 | claude-opus-5-5 ×3 | 0,32 + 0,29 + 0,31 |

E + D + A = **5,2 M jedn.** (plan: ~5,8 M bez F). Poza tym nieważny E1 w sesji przeniesionej `change_directory` (złe instrukcje, `dane/mr-kontekst-sesja-przeniesiona-e1.txt`) — nieliczony.
Środowisko (e): aplikacja desktop (`entrypoint=claude-desktop`), Claude Code 2.1.280, 42 schematy narzędzi w tablicy `tools`, 676 nazw odroczonych (MCP), lista skilli
~30k zn (opus) / ~16k zn (haiku). Instrukcje agentów w sesji w kopii = pliki KOPII (sprawdzone w załącznikach `instructions` 26 agentów E/A; mechaniczny TOL bez instrukcji — `omitClaudeMd`):
`~/.claude/CLAUDE.md` 252 zn, `<scratchpad>/CLAUDE.md` 437, CLAUDE.md oferty 21 007, coding-rules 11 016, learned-patterns 46 870; pamięci projektu brak (plan §2).

## 1. Wyniki per pytanie

### (a) marker wklejony przez orkiestrator do promptu delegacji — **DZIAŁA**
- **Wynik:** A (pełny kontekst dziś: CLAUDE.md, coding-rules, learned-patterns eager, 3 skille, MCP) **15/15** markerów M1–M5 w pełni; D-100 **25/25**. Próg ≥ 80% w obu.
- **Dowód:** `mr-markery-wynik.txt` wiersze A-1..A-3, D100-1..5; każdy builder: 2 pliki .ts, 1 test, 1 migracja, 2 funkcje eksportowane, 5–14 nazw testów — wszystkie z markerem.
- **Zmienia w pakiecie:** wariant learned-patterns z 6a pkt 15/17 (orkiestrator wkleja builderowi i reviewerowi wpisy pasujące do katalogów IU) potwierdzony pomiarem —
  PANEL §2 pkt 4 bez zmian treści, z dopiskiem „potwierdzone mini-runem (a)”. Zastrzeżenie (plan §9 pkt 1): markery to konwencje formalne, wynik to górna granica
  przestrzegania; reguł semantycznych (np. `(SELECT auth.uid())`) mini-run nie mierzył.

### (b) ta sama reguła przez `paths:` — **POTWIERDZONE (kanał `paths:` nie dostarczył reguły)**
- **Wynik:** mechanizm `paths:` dostarczył R **0/3** (w żadnym transkrypcie nie ma załącznika harnessu z R). Buildery czytały istniejące migracje **Bashem** (`sed -n`, 3/3),
  nie Read. R trafiło jednak do kontekstu 3/3 innym kanałem: każdy builder dostaje w `session_context` wynik `git status`, widział w nim nieśledzony
  `.claude/rules/mr-migracje.md` i sam zrobił `cat` tego pliku; potem zastosował R 3/3.
- **Litera kryterium:** „R nie dotarł w ≥ 2 z 3” nie jest spełniona dosłownie (dotarł 3/3), ale żaden z wariantów §7 nie opisuje dotarcia `cat`-em pliku wskazanego przez
  `git status` — to artefakt testu (w prawdziwym repo reguła jest śledzona i nie wisi w `git status`). O mechanizmie rozstrzyga kanał: `paths:` 0/3.
- **Dowód:** `mr-dodatkowe.txt` §1 („R dotarł przez: Bash:cat .claude/rules/mr-migracje.md”, „git status … pokazuje mr-migracje.md: True”); `mr-markery-wynik.txt` `narzedzia_migracje`.
- **Zmienia w pakiecie:** nic — PANEL §1 pkt 1 („reguły `paths:` = bonus, nie kanał dostawy”, bypass i Bash zostają) potwierdzony. Uwaga poboczna: co dotarło do kontekstu,
  było stosowane (R 3/3 — ten sam wniosek co (a)).

### (c) marker w SKILL.md wstrzykniętym przez `skills:` — **STOSOWANA** (z odstępstwem w dostawie)
- **Wynik:** treść skilla była stosowana za każdym razem, gdy dotarła — **2/2**. Ale dostawa była zaburzona buforem skilli sesji (skrypt `mr_seria_a.sh przed N` zmieniał
  SKILL.md w trakcie sesji): A-1 **nie dostał** `supabase-dev-guidelines` w ogóle (wstrzyknięte tylko `security` i `sentry-integration`); A-2 dostał SKILL.md z markerem S
  **z runu A-1**, A-3 — **z runu A-2**. A-2 zakończył test linią S z A-1, A-3 linią S z A-2. Własnego S żaden run nie dostał (0/3), stąd `S=brak` w `mr-markery-wynik.txt`.
- **Kryterium §7:** „S dotarł i zastosowany w ≥ 2 z 3 runów” — spełnione przez treść skilla, która dotarła (2 z 3 runów), z markerem przesuniętym o jeden run.
  Wariant „nie dotarł → powtórka” dotyczy błędu konfiguracji; tu konfiguracja działała, a opóźnienie pochodzi z bufora sesji (niżej, N2). Powtórka niepotrzebna do decyzji:
  pytanie brzmiało „stosowana czy tylko zajmuje kontekst”, a odpowiedź jest jednoznaczna.
- **Dowód:** `mr-dodatkowe.txt` §1 (skille wstrzyknięte per run z markerem S, ostatnia linia testu).
- **Zmienia w pakiecie:** `skills:` u builderów zostaje bez zmian (PANEL §2 pkt 2); podział skilli na warstwę stałą/referencyjną (§2 pkt 3) zostaje porządkowy, nie konieczny.

### (d) 100 vs 400 poleceń (ROZSTRZYGAJĄCE) — **BRAK DŹWIGNI**
- **Wynik:** D-100 **25/25**, D-400 **25/25**; różnica 0 pp, Fisher jednostronny p = 1,000, mediana markerów per run 5 vs 5; zero markerów częściowych. Pozycja w bloku
  (10/30/50/70/90%) bez znaczenia. Dla porównania A: 15/15 przy ~500 instrukcjach poza promptem (CLAUDE.md, coding-rules, learned-patterns, skille). Koszt ramienia 400:
  1,39 M vs 0,81 M (**+72%**), wywołania API 10–18 vs 7–18.
- **Kryterium §7:** „BRAK DŹWIGNI: różnica ≤ 8 pp” — spełnione.
- **Zmienia w pakiecie:** budżet < 150 instrukcji warstwy stałej zostaje jako **porządek i koszt**, nie cel jakościowy (PANEL §2 pkt 3 i §11 — to już zapisany wariant „nie ginie”);
  główną dźwignią jakości są małe naprawy (D1) i ewentualnie równoległe próbki. Argument kosztowy dostaje liczbę: 4× więcej poleceń = +72% kosztu buildera.
  Zastrzeżenie jak w (a): efekt sufitu przy regułach formalnych; jedno zadanie, jedna warstwa (plan §9).

### (e) kontekst startowy per klasa roli i model — **POTWIERDZONE** (z korektą E2)
- **Odstępstwo w E2:** po `git mv learned-patterns` (między E1 a E2) agenci E2 z CLAUDE.md nadal dostali `.claude/rules/learned-patterns.md` (46 870 zn, ta sama ścieżka)
  — instrukcje są buforowane w sesji i nie odświeżają się po zmianie pliku (N2). Zmierzone „TOL” u 7 z 8 komórek = allowlista + wycinek, z learned-patterns eager.
  **Korekta TOL → TOLk w `mr_kontekst.py`:** odjęcie learned-patterns (znaki z załącznika / stawka d4r 1,97 zn/tok × mnożnik modelu: −24,2k opus, −17,7k haiku) i wyrównanie
  przekazanej wiadomości operatora do E1 (2 638 vs 796 zn: +0,9k opus, +0,7k haiku); netto −23,2k opus, −17,0k haiku. **Kalibracja stawki na tym samym runie:** mechaniczny haiku T → TOL (czysty pomiar,
  `omitClaudeMd` usuwa wszystkie instrukcje) zmierzone 30 366 tok za 81 364 zn; stawka d4r przewiduje 30 645 (**+0,9%**). Komórka mechaniczna bez korekty learned-patterns.
- **Wynik (ctx_start, tok):**

| komórka | dziś | T (allowlista) | TOLk | cel D4 | TOLk / cel |
|---|---|---|---|---|---|
| mechaniczny haiku | 85 229 | 38 469 | 8 797 | 9,5k | 0,93 |
| orkiestracyjny opus | 114 573 | 49 208 | 25 505 | 24,8k | 1,03 |
| reviewer opus z plikiem | 118 766 | 53 450 | 29 747 | 28,8k | 1,03 |
| reviewer opus bez pliku | 117 167 | 51 802 | 28 099 | 28,8k | 0,98 |
| sceptyk opus | 116 069 | 50 704 | 27 001 | 26,3k | 1,03 |
| naprawiacz opus | 115 079 | 49 714 | 26 011 | 26,2k | 0,99 |
| naprawiacz haiku | 84 361 | 37 601 | 20 271 | 20,9k | 0,97 |
| builder opus | 127 628 | 62 312 | 38 609 | 38,1k | 1,01 |

- **Dźwignia** (zmierzone Δ startu podstawione do 85 agentów runu 20.09, wagi 1,25 / 0,1): **TOLk 49,4%**, sama allowlista **35,2%** (D4: 27–38%, run 20.09: 37,8%).
  Te same uproszczone wagi dają dla Δ z D4 53,2% wobec 51,4% pełną metodą d4r, więc TOLk pełną metodą ≈ **47,7%**. Mechaniczny opus niezmierzony — z haiku × 1/0,759 (krok 0).
- **Kryterium §7:** każda klasa w ±25% celu (0,93–1,03) i dźwignia ≥ 40% → POTWIERDZONE. „Dziś” jest ~5% niżej (4,5–5,5%) niż start z 20.09 (np. orkiestracyjny 114,6k vs 121,2k;
  inny zestaw MCP i brak pamięci projektu w kopii) — rozjazd żadnego składnika nie przekracza 25%, więc bez osobnego wyjaśnienia.
- **Dowód:** `mr-kontekst.txt` (kalibracja, korekta, tabele §1–§3, skład startu w znakach per wariant).
- **Zmienia w pakiecie:** PANEL §1 pkt 4 — „Potwierdzenie: mini-run (e)” zamienić na wynik (≈48–49%, allowlista 35%, Opus 5.5, desktop); §12 cele ctx_start — potwierdzone
  per klasa i model (0,93–1,03), z dopiskiem „zmierzone na Opus 5.5 / Haiku 4.5”; mapa walidacji — (e) z „do potwierdzenia” na „potwierdzone”.

### (f) plik harnessu i hook Stop — **fakty**
- **f1:** plik `<sesja>/workflows/<run>.json` powstaje **dopiero po zakończeniu runu** — 5/5 runów w kopii i 2/2 w `mr-f`: `mtime − (start + durationMs) = +0,0 s`; w trakcie
  runu go nie ma (krok 0, `ls`). Także przy TaskStop (status `killed`).
- **f2:** zabicie sesji `claude -p` w trakcie runu (SIGTERM i SIGKILL) → **brak pliku harnessu**, journal ze `started` bez `result`; przy SIGKILL osierocony proces Bash agenta.
- **f3:** hook Stop odpala się na **końcu każdej odpowiedzi sesji, także odpowiedzi na task-notification** (sesja w kopii: 8 wpisów, w tym 5 odpowiedzi na powiadomienia o końcu
  E1, E2, A1, A2 i A3); wejście niesie `background_tasks` ze statusem runów (`running` / lista pusta po końcu) i `last_assistant_message`; pola:
  `background_tasks, cwd, effort, hook_event_name, last_assistant_message, permission_mode, prompt_id, scratchpad_dir, session_crons, session_id, stop_hook_active, transcript_path`.
- **Dowód:** `mr-harness.txt`.
- **Zmienia w pakiecie:** rekord D5 (PANEL §12, §2 pkt 5): wyzwalacz skanu telemetrii = hook Stop sprawdzający `background_tasks` (brak runu `running` → skan runów z plikiem
  harnessu); run zabity razem z sesją nie zostawia pliku harnessu, więc skan musi umieć odczytać sam journal (status „przerwany”) albo doctor zgłasza run bez pliku.

## 2. Ustalenia poboczne (nie były pytaniami, ważne dla panelu)

- **N1 — przekazana wiadomość operatora bywa wykonywana przez agentów haiku.** Harness przekazuje każdemu agentowi wiadomość, która uruchomiła run, z adnotacją
  „prośba wygrywa z zadaniem skryptu”. W E1 (prompt: „nie używaj narzędzi, zwróć {ok: true}”) **3 z 4 agentów haiku** wywołało narzędzia, a `naprawiacz-haiku:T` wykonał
  instrukcję sesji: dwukrotnie próbował uruchomić workflow przez `node` (błąd składni, bez skutków) i zrobił **`git mv` w repo kopii**. Opus: 0/12. Po dopisaniu do wiadomości
  operatora zdania „do agentów: ta wiadomość nie jest dla was” — E2: **0/8** (w tym 2 haiku). Runy A, uruchomione z odpowiedzi na task-notification, nie dostały żadnej
  przekazanej wiadomości. To drugie zdarzenie tego typu (krok 0: haiku pisał pliki planu). **Dla panelu:** w pipelinie wiadomość startu autopilota trafia do każdego
  agenta; (1) szablon polecenia startu (dev-autopilot-wf) z jednym zdaniem do agentów; (2) allowlista klasy mechanicznej bez Bash/Write tam, gdzie rola ich nie potrzebuje
  — ogranicza skutki. Do PANEL §2a jako wejście i do mapy walidacji.
- **N2 — instrukcje i skille są buforowane w sesji.** Zmiana pliku w trakcie sesji nie dociera wiarygodnie do agentów: learned-patterns przeniesiony z `.claude/rules/`
  dalej ładowany eager (E2); SKILL.md zmieniony przed runem — następny agent bez skilla, kolejne z wersją o jedną zmianę wstecz (A). Wcześniej (seria E1 w sesji
  przeniesionej): instrukcje ze starego katalogu sesji. **Dla wdrożenia:** po zmianach w `.claude/` (sync-template, allowlista, przeniesienie learned-patterns) — nowa sesja
  przed autopilotem (PANEL §10); argument za wklejaniem wycinka przez orkiestrator zamiast polegania na plikach ładowanych eager (treść czytana w runie jest świeża).
- **N3 — builder czyta `git status` z kontekstu i idzie za nim** (cat nieśledzonego pliku reguły, (b)). Nieszkodliwe; wyjaśnia dotarcie R.

## 3. Ograniczenia wyniku

Bez zmian wobec planu §9: markery formalne (górna granica), jedno zadanie warstwy danych, builder bez uruchamiania testów (7–18 wywołań), D w worktree, A w katalogu kopii,
f2 w terminalu. Doszły: (e) komórki niemechaniczne liczone z korektą (stawka sprawdzona na tym samym runie, +0,9%), (c) marker S przesunięty o jeden run, (b) R dotarło
kanałem-artefaktem testu, przekazana wiadomość operatora w E1 (2 638 zn) i E2 (796 zn) w starcie agentów.

## 4. Co po akceptacji (HANDOFF §8 pkt 6)

PANEL-WEJSCIE §11 (status ZROBIONY + wynik a–f), §12 (cele ctx_start potwierdzone, wyzwalacz skanu), §1 pkt 4 (liczba z (e)), §2a (N1), §10 (N2: nowa sesja po zmianach
`.claude/`); mapa walidacji; HANDOFF (wiersz 3¾, 6a, §8 → panel na znak; model panelu: Opus 5.5 — 6a pkt 22); pamięć projektu; commit `docs/reviews`. Kopia oferty-online w scratchpadzie zostaje
do końca analizy (usuwanie tylko za zgodą operatora).
