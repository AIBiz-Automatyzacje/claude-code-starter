# PANEL-WYNIK — decyzje D2–D12 i plan wdrożenia w iteracjach (etap 5)

**Data:** 2026-09-27. **Status:** ZAAKCEPTOWANY 2026-09-27 (HANDOFF 6a pkt 34) razem z §3 (cofnięte ustalenia) i allowlistą jako R1 w It. 3. Sesja główna na Opus 5.5, zero agentów, zero sesji headless, zero zmian w `.claude/`,
CLAUDE.md i oferty-online (lustro oferty-online czytane `git show`). **Wersja dla operatora:** `PANEL-WYNIK-DLA-OPERATORA.md`.
**Podstawa:** HANDOFF 6a pkt 19–33, §7; TEST-REVIEW-WYNIK (całość); PANEL-PLAN §1, §7 pkt 5; PANEL-WEJSCIE §2, §2a, §10, §12; mapa walidacji
(`dane/d5b-mapa-walidacji.txt`, wersja operatora); `dane/panel-koszt.{txt,json}`; katalog i decyzje projektów A/B/C (`dane/panel-run1-projekty.json`);
`dane/pa-proponowany.diff`. D1 i D12 cz. 1 są zamknięte (6a pkt 32); run 3 pominięty (6a pkt 33), więc rekordy nie mają pól sceptyka.
**Liczby — wyłącznie skryptem:**
- `skrypty/pokretla_kosztu.py` → `dane/pokretla-kosztu.{txt,json}`: koszt, tury, wyjście, polecenie i narzędzia każdej roli review w teście (13 faz, p1,
  warianty 0 i A), wkład ról w klucze, weryfikacja, pokrętła; kontrola: suma ról = `znajdowanie_po` z `wynik-koszt.json` (0: 34,17 / A: 19,46 M — zgodne).
- `skrypty/d12_nowe_pliki_fixa.py` → `dane/d12-nowe-pliki-fixa.{txt,json}`: nowe pliki w 24 commitach fixa i położenie 30 defektów urodzonych w fixie.
- `skrypty/tempo_pr.py` → `dane/tempo-pr.txt`: tempo PR-ów oferty-online (czas okien jakości).

**Konwencje.** „Znajdowanie” = etap szukania findingów w fazie review (bez weryfikacji), koszt PO („po zmianie kontekstu”, jak w teście). Udziały
w koszcie zadania z panelu (projekt 0, kolumna PO): review 28,5%, execute 25,2%, fix 14,8%, sceptycy 9,4%, E2E 7,3%, mechanika 7,1%, zamknięcie 4,0%,
orkiestracja 3,8%. „≈ % zadania” = % znajdowania × 28,5% (dla weryfikacji × 9,4%) — przybliżenie, bo test mierzył duże fazy, a panel małe (panel §3: −39%
na dużych fazach). Wkład w klucze = klucze obecne w 13 fazach złapane z udziałem findingu roli (klucz 1 = zysk, 53; klucz 2 = strata, 63).

---

## 0. W skrócie

1. **Z 43% oszczędności projektu A na etapie znajdowania ok. 20 pkt da się wziąć bez utraty trafień, a ok. 24 pkt A zapłacił zgubionymi trafieniami.**
   Role, w których A nie stracił (correctness, spec, test-coverage, packager): −19,5% kosztu znajdowania. Role, w których stracił (code-quality na
   `low`, krótszy security, brak performance): −23,6%. Bierzemy tylko pierwszą część, po jednym pokrętle, z metryką.
2. **Najmocniejsze pokrętła kosztu review z liczbą z testu:** efort test-coverage `high → medium` (−11% znajdowania, ≈ −3% zadania, trafień nie mniej),
   batch sceptyków po 4 (−42% kosztu weryfikacji, ≈ −4% zadania), polecenia-listy correctness z katalogu A (−5%, trafień więcej).
3. **Trzy pokrętła odrzucone przez test:** code-quality na `low` (dziś ten reviewer łapie 12 z 25 złapanych ucieczek, 10 wyłącznie on; A na `low` — 2),
   usunięcie performance (7 trafień tylko jego), skrócenie security (A: z 16 trafień klucza 2 zostało 8). To odwraca trzy wcześniejsze ustalenia z §2a (§3).
4. **Sama długość tekstu polecenia nie jest pokrętłem kosztu:** cały tekst polecenia reviewera to 2,6% kosztu roli. Koszt robią tury i wyjście.
5. **D12 cz. 2 („finding wymagający nowego pliku → nowa IU”) — nie teraz:** 16 z 24 fixów dodaje nowy plik produkcyjny, a leży w nich 1 z 21 defektów
   P1/P2 urodzonych w fixie. Reguła przeniosłaby 2/3 fixów do nowego cyklu, a trafiłaby w ułamek problemu. Kontrola diffu fixa wg A łapie 15 z 30.
6. **Każda uzgodniona w analizie zmiana ma miejsce w planie** (§4a — learned-patterns, CLAUDE.md, scalony plan, dev-pr, higiena konta, coding-rules,
   usunięcia i reszta; 65 pozycji sprawdzonych skryptem `panel_wynik_pokrycie.py`).
7. **Plan: 9 iteracji, 7 okien jakości po 5 PR.** It. 1 telemetria + import, It. 2 konfiguracja bota i B0, It. 3 kontrola diffu fixa (z R1: allowlista,
   efort jawny, porządki, E2E), It. 4 bramki lint/knip ‖ mutanty dla testów, It. 5 sceptyk asymetryczny + batch, It. 6 fix tylko P1/P2, It. 7 listy
   correctness ‖ spec, It. 8 wiedza u buildera (D10), It. 9 warstwa stała ról. Przy tempie września (6,1 PR/tydzień) okno ≈ 1 tydzień, całość ≈ 2 miesiące.

---

## 1. Pokrętła kosztu obecnego review (zadanie 1)

Źródło każdej liczby: `dane/pokretla-kosztu.txt` sekcje „wariant 0/A”, „POKRĘTŁA”, „wkład ról”, „weryfikacja”. Baza: znajdowanie wariantu 0 = 2,628 M
na fazę. Pokrętło = różnica jednej roli między A a dziś. W A zmieniało się naraz kilka rzeczy (efort, brzmienie, dossier), więc Δ to **górna granica**
efektu samego pokrętła, a jakość pokazuje, czy A w tej roli coś zgubił.

| # | pokrętło | Δ na fazę | % znajdowania | ≈ % zadania | jakość w teście (dziś → A) | przypisanie | werdykt |
|---|---|---|---|---|---|---|---|
| K1 | efort test-coverage `high → medium` (+ lista mutantów) | −0,290 M | −11,0 | −3,1 | klucz 1: 3 → 5; klucz 2: 13 → 15; tury 24,5 → 11,9; P1/P2 42 → 127 | D6 (+ D5) | **bierzemy** (It. 4b) |
| K2 | efort spec `high → medium` | −0,030 M | −1,1 | −0,3 | klucz 1: 3 → 10; klucz 2: 6 → 11 (z listami A i sekcją planu) | D6 | bierzemy z listami (It. 7b) |
| K3 | efort code-quality `high → low` | −0,249 M | −9,5 | −2,7 | klucz 1: **12 → 2**; klucz 2: **8 → 1**; P1/P2 35 → 12 | D6 | **odrzucone** |
| K4 | polecenia-listy correctness z katalogu A (ten sam efort `high`) | −0,136 M | −5,2 | −1,5 | klucz 1: 3 → 9; klucz 2: 9 → 15; tury 21,4 → 18,1 | nowa pozycja „listy per oś” (§2 pkt 11), obok D10 | **bierzemy** (It. 7a) |
| K5 | polecenia-listy security z katalogu A (ten sam efort) | −0,103 M | −3,9 | −1,1 | klucz 1: 5 → 3; klucz 2: **16 → 8**; P1/P2 41 → 11 | nowa pozycja „listy per oś” | **odrzucone** |
| K6 | usunięcie reviewera performance | −0,268 M | −10,2 | −2,9 | klucz 1: 3 → 0; klucz 2: 6 → 0; 7 trafień tylko jego | 6a pkt 32 (6 reviewerów zostaje) | **odrzucone** |
| K7 | packager → skrypt (dossier bez agenta) | −0,057 M | −2,2 | −0,6 | packager nie daje findingów | D3 (przesądzone §6) | bierzemy (It. 3d) |
| K8 | mandat dossier („czytaj tylko pliki z listy”) | ≈ 0 | — | — | Bash na agenta przy tym samym efortcie: correctness 16,5 → 15,3, security 13,6 → 13,6 | D3 | **odrzucone** (brak efektu) |
| K9 | warunek „faza z kodem” dla security / spec / test-coverage | −0,054 M | −2,0 | −0,6 | test nie mierzył (13/13 faz z kodem); fazy bez kodu 4% | D4 (+ ETAP1 security) | bierzemy (It. 7b) |
| K10 | długość tekstu polecenia (sam tekst) | cały tekst = 2,6% kosztu roli | ≤ 2,6 | ≤ 0,7 | — | nowa pozycja: **nie jest pokrętłem kosztu** | porządek (prompt-audit), nie oszczędność |
| K11 | batch sceptyków po 4 niezależnie od pliku (B) zamiast grupy po pliku | −0,343 M | — (weryfikacja −42,3%) | −4,0 | dziś zabił 2 prawdziwe B z 21; B i C — 0 | D2 | **bierzemy** (It. 5) |
| K12 | efort dziedziczony z sesji (dziś `high` albo `medium`, zależnie od sesji operatora) | ±15% (szacunek planu testu §2.3) | — | — | test mierzył dziś na `high` | D6 krok 1 | przypiąć jawnie (It. 3b) |
| K13 | dedup (haiku) | 0,066 → 0,067 M | 0 | 0 | — | — | brak pokrętła |

**Skąd się wzięło −43% A** (`rozkład różnicy A − 0`): efort niższy w A (test-coverage, spec, code-quality) −7,38 M z −14,71 M = 50%; role usunięte
(performance, packager) −4,23 M = 29%; ten sam efort, inne brzmienie i dossier (correctness, security) −3,11 M = 21%. **Podział według jakości**
(`podział A − 0`): role bez straty trafień −6,65 M = **−19,5%**, role ze stratą −8,06 M = **−23,6%**.

**Mechanizm kosztu, który z tego wynika.** Tekst polecenia to 2–3% kosztu roli (zapis do cache + odczyt w każdej turze). Koszt robi liczba tur (każda
czyta cały kontekst) i wyjście z myśleniem (14–27% kosztu roli). Pokrętło działa, jeśli zmienia **zachowanie**: efort skraca tury i wyjście
(code-quality `low`: 12,2 → 5,1 tury, wyjście 14,9k → 2,7k), a listy zamiast ogólnego polecenia skracają szukanie (correctness: 21,4 → 18,1 tury przy
tym samym efortcie). Skracanie tekstu bez zmiany zachowania daje najwyżej 2–3%.

**Wkład dzisiejszych reviewerów (dlaczego K3, K5, K6 odpadają).** Z 25 ucieczek (klucz 1) złapanych dziś: code-quality 12 (10 tylko on), security 5 (3),
correctness 3 (3), performance 3 (2), spec 3 (2), test-coverage 3 (2). Z 53 dzisiejszych trafień (klucz 2): security 16 (16), test-coverage 13 (8),
correctness 9 (6), code-quality 8 (8), performance 6 (5), spec 6 (5). **Code-quality (plik `architecture-strategist`: granice, YAGNI, typy) jest dziś
największym łapaczem ucieczek**, a security — dzisiejszych trafień. W A te dwie role na krótszych listach złapały 2 + 1 i 3 + 8.

---

## 2. Rekordy per decyzja (zadanie 2)

Pola wg PANEL-PLAN §7 pkt 5 bez pól sceptyka. **Metryka** = wpis mapy walidacji (`dane/d5b-mapa-walidacji.txt`), pola rekordu telemetrii, baseline,
horyzont. **Baseline jakości zawsze = B0** (zbierany w It. 2 po zmianie konfiguracji bota); liczby wrześniowe podaję jako tło. Horyzont jakości = okno
5 PR względem B0; konfiguracja = 1 faza; koszt = 5 faz. **Pewność:** wysoka = pomiar testu wskazuje kierunek i odwrót jest tani; średnia = dane
częściowe albo splecione; niska = bez danych, decyduje pomiar po wdrożeniu.

### D1 — architektura review (ZAMKNIĘTA, 6a pkt 32)
Obecna architektura: 6 osobnych reviewerów + tester E2E zostaje i jest optymalizowana. A/B/C nie idą dalej; katalog A = źródło pokręteł (§1).

### D2 — grupowanie sceptyków
- **Wybór:** P2 — batch po 4 findingi niezależnie od pliku (jak B); P1 — bez zmian: 3 niezależnych sceptyków, kasacja przy 2/3. Wchodzi razem
  z sceptykiem asymetrycznym (§2 pkt 7), bo tak zmierzył test (sceptycy B byli asymetryczni i batchowani).
- **Odrzucone:** dziś (grupa po pliku) — 80% grup jednoelementowych, więc ~1 agent na finding (test: 30 agentów na 29 findingów), koszt 0,060 M na
  finding; per finding — to samo co dziś, bez argumentu jakościowego.
- **Dane:** weryfikacja w teście (tylko dopasowane P1/P2 klucza 1): 0 — 1,74 M / 29 findingów / 30 agentów; B — 0,90 M / 26 / 14 → **−42,3% na finding**;
  C (batch 4, P1 ×1) — 0,59 M / 20 / 10. Przy 13,5 findingu P1/P2 na fazę: −0,343 M/fazę ≈ −4,0% kosztu zadania. Dzisiejsza weryfikacja zabiła 2 prawdziwe
  B z 21 złapanych (obie „ścieżka błędu”), sceptycy A/B/C — żadnej (małe N; precyzji test nie mierzył).
- **Metryka:** zał. 7 + §2 pkt 7; pola `faza.przebieg.sceptycy`, `faza.sceptyk.{agree, disagree_evidence, disagree_concern}`, `agent.weryfikowane`,
  `agent.koszt_jedn` (sceptyk); baseline 8,8 sceptyka/fazę, obalenia 10,9%, degradacje P2→P3 23% (B0 z telemetrii It. 2); horyzont 5 faz (koszt,
  kill rate), okno 5 PR (kasowanie prawdziwych).
- **Warunek odwrotu:** obalenia < 5% albo degradacje > 35% przy batchu → P2 wraca do grupy po pliku (zał. 7); kill rate > 50% i ≥ 3 B P1/P2 w miejscach
  obalonych w oknie 5 PR → P1 wraca do promptu z uzasadnieniem autora (zał. 5).
- **Iteracja:** It. 5 (okno W3, R3). **Pewność:** średnia (koszt — wysoka; wpływ na jakość — małe N).

### D3 — dossier po przejściu packagera do skryptu
- **Wybór:** packager → skrypt (przesądzone, zał. 4): dossier (diff fazy do pliku, lista plików, sygnały diffu, liczba [E2E], `figma_screens`, dla spec
  sekcja planu) składa skrypt uruchamiany przez agenta domknięcia; **bez mandatu** „czytaj tylko pliki z listy”.
- **Odrzucone:** JS + mandat (A) — w teście mandat nie zmienił czytania: przy tym samym efortcie Bash na agenta correctness 16,5 → 15,3, security
  13,6 → 13,6; mandat zawęża czytanie, a część dzisiejszych trafień leży poza diffem fazy (np. kontrakt migracji z wcześniejszej fazy — jeden z P1
  zgubionych przez A; test nie rozdziela, czy przez mandat); bez dossier — każdy reviewer robi własny `git diff`, a routing E2E potrzebuje flag.
- **Dane:** packager 0,057 M/fazę = 2,2% znajdowania (≈ 0,6% zadania); ETAP1: 81 agentów, 230k/agent, 1,6%.
- **Metryka:** zał. 4; pola `agent.narzedzia.{bash, read}` i `agent.tury` (review:*), `faza.dossier_zn`; baseline B0 (w teście dziś Bash 7,5–21,1
  na rolę); horyzont 5 faz.
- **Warunek odwrotu:** findingi per oś −30% w tym samym typie kodu → wraca agent packager; Bash reviewerów p50 > 23 bez spadku findingów → dodać mandat.
- **Iteracja:** It. 3d (R1). **Pewność:** średnia.

### D4 — spec-compliance tylko w fazach z kodem
- **Wybór:** spec w fazach z kodem; w fazie bez kodu tylko, gdy dotyka plików tekstów UI albo dokumentu prawnego (A). Ten sam warunek „faza z kodem”
  dla security (ETAP1) i test-coverage.
- **Odrzucone:** zawsze (dziś) — płaci za fazy dokumentacyjne, a bot ma `!docs/**`; tylko fazy z tekstami UI / prawnymi — spec łapie w fazach kodu
  (test: dziś 3 + 6 trafień, A z listami 10 + 11).
- **Dane:** fazy z kodem 96% (panel) → pokrętło K9 −0,054 M/fazę dla trzech ról (−2,0% znajdowania); 27% wyjścia spec to `.md` (ETAP1); test nie
  mierzył (13/13 faz z kodem).
- **Metryka:** P3 (§7 mapy) + miara jakości oś spec; pola `agent.koszt_jedn` (review:spec-compliance), `faza.findingi_per_os.spec`, `run.pr.klasy[].os`;
  baseline B0 (tło: wrzesień 2 B P1/P2 na 683 pliki, próg odwrotu 4); horyzont okno 5 PR.
- **Warunek odwrotu:** B P1/P2 osi spec ≥ 4 w oknie 5 PR z klasą w plikach faz pominiętych → spec w każdej fazie.
- **Iteracja:** It. 7b (razem z listami spec). **Pewność:** wysoka co do ryzyka, zysk mały.

### D5 — Stryker: gdzie
- **Wybór:** w domknięciu fazy, w skrypcie bramek: Stryker diff-scoped (`--mutate plik:od-do` z `git diff -U0` bazy fazy, pliki produkcyjne, których
  testy faza dotknęła); lista przeżytych mutantów = **osobny blok wejścia reviewera test-coverage, ułożony jak w C**: dla każdego mutanta wskaż istniejący
  test, który powinien go zabić, i powód, dla którego nie zabija; test niefalsyfikowalny = finding z id mutanta dla buildera fixa. Mutation score nie jest
  celem. Reviewer test-coverage na efort `medium` (tak mierzył C; K1).
- **Odrzucone:** przed dev-pr raz na zadanie — czas nie jest problemem (test: 7–126 s na fazę, wszystkie bramki razem ≤ 143 s, nie 5–15 min z POMIARY §3),
  a przed dev-pr nie ma już pętli fix fazy; poza runem — rodzina „test niefalsyfikowalny” bez wejścia mechanicznego; ułożenie A („wypisz test, który
  zabije mutanta; brak = P2”) — ta sama lista w A nie dała złapań z mutantem, a test-coverage A zgłosił 127 P1/P2 na 13 faz (dziś 42) — szum dla fixa.
- **Dane:** rodzina test-niefalsyfikowalny (12 kluczy w fazach): dziś 1, A 4, B 3, **C 6 (5 findingów powołuje się na mutanta)**; lista była w promptach A/B/C
  w 11–12 z 13 faz.
- **Metryka:** I2 (§8 mapy) + zał. 6 + P4; pola `faza.bramki.stryker.{status, sekundy}`, findingi test-coverage z id mutanta, `run.pr.klasy[].os ==
  test-coverage`; baseline B0 (tło: wrzesień 7 B P1/P2 osi test na 683 pliki, próg 12); horyzont 1 faza (czas), okno 5 PR (jakość).
- **Warunek odwrotu:** p50 Strykera > 300 s w 5 fazach → raz na zadanie przed dev-pr; zero findingów z mutantem w 5 fazach z listą → poprawić ułożenie
  wejścia (dlaczego nie zadziałało u A i B, test nie rozstrzyga); B P1/P2 osi test ≥ próg w oknie 5 PR → wyłączyć listę i efort `medium` tej roli.
- **Iteracja:** It. 4b (okno W2, R2 — oś test). **Pewność:** średnia.

### D6 — efort i model per klasa roli
- **Wybór (po jednym kroku):**
  1. **Efort jawny** (It. 3b): dziś reviewerzy i sceptyk P1 dziedziczą efort sesji (`TIERY_DOMYSLNE` z `reviewer: null`, `sceptykP1: null`, `dev-docs-review-wf.js:819`), a operator
     uruchamia sesje na `high` i `medium` — koszt i jakość review zależą od tego, jaką sesję akurat otwarto. Przypinamy reviewerów na `high` (tak test
     mierzył dzisiejszy pipeline), sceptyk P2 `medium`, P1 `high`, mechaniczni haiku; efort trafia do etykiety agenta → `agent.effort`.
  2. **test-coverage `medium`** (It. 4b, z mutantami — K1).
  3. **spec `medium`** (It. 7b, z listami spec — K2).
  4. Klasy poza review (orkiestracyjne `low`/`medium`, scribe `low`) — po jednym, jako R1, dopiero po It. 3; builder i naprawiacz `high` bez zmian.
- **Odrzucone:** code-quality `low` (K3: 12 → 2 i 8 → 1 trafień), wszystko `medium` (PA-22; brak pomiaru dla correctness/security/performance, a A na
  tych rolach został na `high`), mechaniczni na opusie (w USD haiku ~4× tańszy; N1 gasi zdanie w poleceniu startu).
- **Dane:** §1 K1–K3, K12; koszt `medium` vs `high` dla dzisiejszego review ~15% (szacunek planu testu §2.3, niezmierzony).
- **Metryka:** P4 (§7 mapy); pola `agent.effort` (nowe), `agent.koszt_jedn`, `agent.tury`; baseline B0 per rola; horyzont 5 faz (koszt), okno 5 PR
  (jakość osi).
- **Warunek odwrotu:** B P1/P2 osi ≥ próg odwrotu po obniżeniu → poziom wyżej; koszt klasy > +30% bez spadku B P1/P2 osi → poziom niżej.
- **Iteracja:** It. 3b, 4b, 7b, R1 po It. 3. **Pewność:** wysoka (krok 1, test-coverage), średnia (spec), niska (klasy poza review).

### D7 — warstwy weryfikacji
- **Wybór:** cztery warstwy (A, B): (1) builder — samosprawdzenie zawężone do plików IU (`tsc --noEmit`, `vitest related --run`); (2) domknięcie — jeden
  skrypt bramek z wynikiem JSON (ESLint, knip, size-limit, tsc, `vitest --typecheck`, `migrations.sum`, niezmienność migracji, advisors w fazie z migracją,
  Stryker — D5); agent domknięcia uruchamia i naprawia wskazane, nie gra lintera; (3) fix — te same bramki na plikach fixa; (4) walidacja końcowa raz na
  zadanie (pełne testy, build, audyt testów po fixach, completion-gate E2E). Hook `tsc` w sesji głównej bez zmian (poza decyzją).
- **Odrzucone:** pięć warstw jak dziś — domknięcie ma medianę 32 wywołań narzędzi (PA-29); walidacja końcowa scalona z domknięciem ostatniej fazy (C) —
  walidacja niesie completion-gate E2E i audyt testów po fixach, których domknięcie nie ma.
- **Dane:** bramki w teście ≤ 143 s na fazę razem ze Strykerem; tsc 10 s na 585 plikach (POMIARY §3); domknięcie 636k/agent, 4,0% fazy.
- **Metryka:** P1/P4 (§7 mapy); pola `agent.narzedzia.razem` i `agent.koszt_jedn` (domknięcie, build, fix), `faza.bramki.*.sekundy`; baseline B0
  (tło: mediana 32 wywołań, 636k); horyzont 5 faz.
- **Warunek odwrotu:** walidacja końcowa znajduje błąd typów albo testów przy PASS bramek w ≥ 2 z 5 zadań → builder wraca do pełnego zestawu testów.
- **Iteracja:** skrypt bramek — It. 4a; zawężenie buildera i fixa — R1 po oknie W2. **Pewność:** średnia.

### D8a — kształt scalonego dev-plan + dev-docs (wymóg §2 pkt 12)
- **Wybór (A):** jeden skill `dev-plan`: plan z fazami → IU; każda IU z tabelą plików (długość, przyrost, powody zmiany, próg 360 linii → krok „wydziel
  moduł”) i rejestrem stałych; checkboxy Test:/[E2E]; na końcu skill tworzy branch i `docs/active/<zadanie>/`, `*-zadania.md` **generowany skryptem**
  z checkboxów planu (odnośniki do IU, bez kopii treści); bramka gotowości jako skrypt.
- **Odrzucone:** dwa skille (kopia planu 22–46%, przekazanie przez operatora); jeden artefakt bez pliku zadań (B, C) — scribe, fix i walidacja odznaczają
  checkboxy w `*-zadania.md`, więc to zmiana kontraktu trzech workflowów bez zysku.
- **Dane:** mediany pełnego epizodu dev-plan 2,39 M + dev-docs 0,56 M; wiadomości operatora 1 + 0; plan 57–137 kB (przegląd D6).
- **Metryka:** §2 pkt 12; pola `skill.koszt_jedn`, `skill.wiadomosci_operatora`, `skill.artefakty`; baseline 2,39 + 0,56 M; horyzont 5 zadań.
- **Warunek odwrotu:** mediana epizodu > 2,95 M albo bramka gotowości odrzuca > 1 z 5 planów → generowanie zadań jako osobny krok skilla.
- **Iteracja:** scalenie — R1 po It. 3; budżet pliku i rejestr stałych (elementy wpływające na jakość kodu) — w oknie It. 8 razem z D10.
  **Pewność:** średnia.

### D8b — research w dev-plan przy głębokości „Lekka”
- **Wybór:** warunkowy (zbieżne A/B/C): przy „Lekka” subagenci researchu tylko gdy (a) IU wprowadza zależność, usługę albo API spoza `package.json` lub
  zmianę wersji głównej, albo (b) katalogi IU nie mają wpisu w indeksie learned-patterns ani w `docs/solutions/`; „Standardowa”/„Głęboka” bez zmian;
  badacze z allowlistą.
- **Odrzucone:** obowiązkowy (dziś) — subagenci researchu to 18,6 M z 55,6 M (33%) w 19 epizodach, największa pozycja dev-plan; wyłączony — nowa
  zależność planowana z pamięci modelu (ETAP2: konfiguracja eslintrc martwa w ESLint 10).
- **Metryka:** §2 pkt 12; pola `skill.subagenci_n`, `skill.subagenci_jedn`; baseline 18,6 / 55,6 M; horyzont 5 zadań.
- **Warunek odwrotu:** ≥ 2 B P1/P2 klasy „API / wersja biblioteki niezgodne z dokumentacją” w zadaniach bez researchu w oknie 5 PR → research obowiązkowy.
- **Iteracja:** razem z D8a (R1). **Pewność:** średnia.

### D9 — opisy workflowów-dzieci w liście skilli
- **Wybór (zbieżne A/B/C):** `disable-model-invocation: true` dla `dev-docs-execute-wf`, `dev-docs-review-wf`, `dev-compound-wf`, `dev-docs-complete-wf`;
  opis `dev-autopilot-wf` skrócony do routingu (tryby wznowienia w treści SKILL.md). **Warunek wstępny:** test w doctor, że `workflow()` autopilota
  uruchamia dziecko z tą flagą (ryzyko zgłoszone przez B).
- **Odrzucone:** skrócić opisy dzieci — model ich nie wybiera, każdy znak to koszt każdej tury sesji głównej; zostawić — ~12k zn w starcie (PA-31).
- **Metryka:** §2 pkt 1(e); pole `agent.kontekst.skille_zn` sesji głównej; baseline ~12k zn; horyzont 1 sesja.
- **Warunek odwrotu:** `workflow()` nie uruchamia dziecka albo operator traci komendę → skrócone opisy bez flagi.
- **Iteracja:** It. 3c (R1). **Pewność:** wysoka co do kierunku, średnia co do mechaniki (sprawdzić przed).

### D10 — rozkład reguł zachowaniowych builder ↔ reviewer
- **Wybór (zbieżne A/B/C):** podział per klasa. Klasy **zapobiegalne** (jest konkretna konstrukcja: timeout, `strictObject` na kopercie, numer generacji
  zamiast flagi, redakcja przed Sentry, parser zamiast regexu, nowa migracja zamiast edycji, pytanie „undefined” o test) → builder, jedno zdanie „co robić
  zamiast” w warstwie referencyjnej doklejanej przez orkiestrator po plikach IU (≤ 2k zn). Klasy **wykrywalne** tylko przejściem wielu ścieżek (drogi do
  operacji z bramką, gałąź domyślna, wartość przed/po `await`) → polecenia-listy reviewera. Reguły mechaniczne → ESLint.
- **Odrzucone:** wszystko u buildera — ~480–490 instrukcji, mini-run (d): 400 poleceń +72% kosztu bez zysku; wszystko u reviewera (Matt `retro`) — przez
  buildera przechodzi 100% B, każdy finding to tura fixa, a reguły wklejone do promptu builder stosuje (mini-run (a) 40/40).
- **Dane:** test: listy wykrywające correctness z katalogu A złapały więcej przy tym samym efortcie (K4); ETAP1 45/68 ucieczek miało regułę w kontekście.
- **Metryka:** 6a pkt 26 (k); pola `faza.findingi_per_os` (P1/P2 na fazę), `agent.tury` (fix), `agent.ctx_start` (builder); baseline B0 (tło: 26,7
  findingu na fazę, fix 37 tur p50, builder 38,6k po allowliście); horyzont 5 faz + okno 5 PR.
- **Warunek odwrotu:** klasa ze zdaniem u buildera nadal ≥ 3 B P1/P2 w oknie 5 PR → lista u reviewera albo reguła lint; `ctx_start` buildera +10% bez
  spadku P1/P2 na fazę → skrócić wycinek.
- **Iteracja:** It. 8 (okno W6, R3, razem z learned-patterns §2 pkt 4). **Pewność:** średnia.

### D11 — kolejność wdrożenia
- **Wybór:** plan z §4 — It. 1 telemetria + import, It. 2 konfiguracja bota + kalibracja + B0, potem najpewniejszy zysk (kontrola diffu fixa), bramki
  i mutanty, sceptyk, fix tylko P1/P2, listy per oś, wiedza u buildera, warstwa stała. Zmiany R1 (ustawienia, koszt) biegną równolegle z oknami jakości;
  dwie zmiany R3 nigdy w jednym oknie; zmiany R2 tylko na rozłącznych osiach.
- **Odrzucone:** kolejność A/B/C (zaczynały od pełnych pakietów swojej architektury, której nie ma); jedna zmiana na okno (~12 okien); wszystkie listy
  naraz we wszystkich osiach (R3, gubi atrybucję per oś — a test pokazał, że listy działają w correctness i spec, a szkodzą w security).
- **Dane:** tempo września 6,1 PR/tydzień (`dane/tempo-pr.txt`) → okno 5 PR ≈ 1 tydzień; 7 okien + B0 ≈ 2 miesiące.
- **Metryka:** mapa §5–§6; pole `run.szablon.skrypt_sha` (epoki); baseline B0; horyzont per iteracja.
- **Warunek odwrotu:** odczyt przekracza próg odwrotu → cofnięcie przed startem kolejnej iteracji R3; < 5 PR w 3 tygodnie → łączyć okna R2 (It. 4 i 7).
- **Pewność:** średnia (tempo po analizie nieznane).

### D12 — kontrola po fixie
- **Cz. 1 (ZAMKNIĘTA, 6a pkt 32):** kontrola diffu fixa wg katalogu A (K-1…K-7, w tym K-4/K-5 sprzątanie nazw i opisów) — dziś 0/30, A 15/30, +0,34 M
  na 24 commity. Rekord wdrożeniowy: It. 3.
- **Cz. 2 — „finding wymagający nowej funkcjonalności → nowa IU z własnym review”:**
  - **Wybór:** **nie wdrażać teraz**; nowe pliki fixa przechodzą kontrolę diffu fixa jak reszta.
  - **Odrzucone:** nowa IU dla findingu z nowym plikiem / trasą / eksportem (A, B, C) — w 24 commitach fixa z testu 16 dodaje nowy plik produkcyjny
    (np. `markup-hidden.ts`, `routes/admin-invitations.ts`, migracje), a z 30 defektów urodzonych w fixie w nowych plikach produkcyjnych leżą 3,
    z czego P1/P2 — **1 z 21**; 27 leży w plikach tylko zmienionych. Reguła przeniosłaby ~2/3 fixów do dodatkowego execute + review, a celuje w ~5% defektów
    P1/P2. Wariant „tylko nowa trasa / eksport” niezmierzony (wymaga czytania diffu).
  - **Dane:** `dane/d12-nowe-pliki-fixa.txt`; D1r: łańcuch 4 defektów fixa w run 2→3 (argument za cz. 2) — pojedynczy przypadek.
  - **Metryka:** §2 pkt 9(a) z podziałem na pliki dodane i zmienione przez fix; pole `faza.fix.pliki[]` **ze statusem A/M** (WYMAGA ZMIANY: rekord D5,
    dziś pole bez statusu); baseline test 1/21 P1/P2 w nowych plikach produkcyjnych; horyzont okno 5 PR po It. 3.
  - **Warunek powrotu:** ≥ 3 B P1/P2 bota w plikach dodanych przez fix w oknie 5 PR → nowa IU dla nowych plików produkcyjnych.
  - **Pewność:** średnia (N = 30, jeden projekt).

---

## 3. Skutki testu dla wcześniejszych ustaleń (§2a i założeń §6) — do potwierdzenia przez operatora

6a pkt 32 („6 reviewerów zostaje i jest optymalizowana”) jest nowsze od wejść §2a z etapów 1–2 i od założeń §6. Test daje liczby przeciw trzem z nich:

1. **Performance ZASTĄP** (§2a ETAP1, zał. 2) → **wypada.** Performance to 10% kosztu znajdowania i 7 trafień tylko jego (2 z klucza 1, 5 z klucza 2);
   A bez tej roli zgubił 4 z 11 strat. Performance zostaje jako reviewer; PA-03 (memoizacja przy React Compilerze) nadal obowiązuje.
2. **Security 191 → ~90 linii** (§2a ETAP1, zał. 3) → **wstrzymane do ślepego testu (6a pkt 26 f).** Security A (krótsze listy L-SEC) złapał 3 + 8
   zamiast 5 + 16. Zostaje: warunek „faza z kodem”, advisors po profilu stacku (§2 pkt 8), usunięcie sprzeczności PA-04 i duplikatów PA-39.
3. **Code-quality → lint + zakaz zgłaszania tego, co łapie lint** (§2a ETAP1) → **zmienione:** bramki lint dochodzą jako **wejście** code-quality
   (warn/knip), prompt code-quality i efort `high` zostają. Code-quality łapie dziś najwięcej ucieczek (12 z 25).
4. **Test-coverage scalone z correctness** (zał. 6) → **wypada** (architektura zostaje; test-coverage osobno z mutantami — D5).
5. **Polecenia-listy domkną 60–70% uwag B** (zał. 1) → oczekiwanie obniżone jeszcze raz: listy A dały w fazach +9 pkt klucza 1 (w granicach szumu),
   zysk w correctness i spec, stratę w security i code-quality. Listy wchodzą **per oś** (It. 7), nie naraz.
6. **Prompt-audit (b) — pliki reviewerów PA-01, 02, 05, 06, 07** (`architecture-strategist`, `performance-oracle`, `security-sentinel`) — dotyczą dokładnie
   tych trzech ról, w których dzisiejsze brzmienie wygrało z A. Wchodzą tylko po ślepym teście na jednej historycznej fazie (I5), w oknie R2 (It. 7c).

---

## 4. Plan wdrożenia w iteracjach (zadanie 3)

Reguły kolejności z mapy §6: **R1** ustawienia i koszt — równolegle bez ograniczeń (odczyt 1 / 5 faz); **R2** zmiany jakościowe rozłącznych osi —
równolegle w jednym oknie; **R3** zmiany przekrojowe — okno 5 PR dla siebie. Każda iteracja = para (zmiana, wpis mapy). Po każdej zmianie w `.claude/`
nowa sesja przed autopilotem (N2). Zmiany promptów reviewerów i builderów — ślepy test przed/po na jednej historycznej fazie (6a pkt 26 f, I5).

| it. | zmiana | wpis mapy (pola) | odczyt | okno / reguła | warunek odwrotu |
|---|---|---|---|---|---|
| **1** | **Telemetria + import:** `zbierz.mjs` (skan pliku harnessu, hook Stop jako wyzwalacz, skan w doctor), `raport.mjs`; agent telemetrii i `tokenyRazemK` znikają; efort w etykietach agentów → `agent.effort`; `pr:zbierz` z klasą/osią/wagą → `run.pr`; `faza.fix.pliki[]` ze statusem A/M (D12); zamknięty słownik klas dla klasyfikatora (§4a C); sync-template zapisuje hash per plik (`run.szablon.skrypt_sha`); import `agents.csv` (przeliczony), odzyskanej telemetrii, `skille.csv`, `klasyfikacja-574.csv`. Równolegle poza szablonem: **higiena konta** (§4a I), zakończona przed B0. | §2 pkt 5; §4 importu; P4 (pole) | 1 run: każdy run ma rekord z prawdziwym statusem, 0 agentów telemetrii | przed wszystkim | — (bez niej nic nie ma odczytu) |
| **2** | **Bot i B0:** generator `coderabbit-base.yaml` + 8 zmian `.coderabbit.yaml`; 4 zmiany dev-pr i sufit 3 tur (§4a C); kalibracja klasyfikatora na 2–3 starych PR vs 1b; 2–3 zadania **bez zmian pipeline'u** → B0 jakości (per oś, per typ kodu, stosunek pliki fixa / reszta) i B0 kosztu (per rola z efortem). **Poza pipeline'em, równolegle:** zadanie sprzątające ESLint w oferty-online (188 zastanych błędów + 5 plików z importem klienta Supabase) — warunek It. 4a. | miara jakości (nagłówek mapy); §2 pkt 9(a) | 2–3 zadania | przed pierwszą zmianą pipeline'u | kalibracja niezgodna z 1b → poprawić schemat `pr:zbierz` przed B0 |
| **3** | **Kontrola diffu fixa wg katalogu A (D12 cz. 1):** `fix:kontrola` z listami K-1…K-7 (K-6 zastępuje verify-fix; K-4/K-5 sprzątanie nazw i opisów); zakres fixa podany przez orkiestrator (PA-15); `fix:pre-skan` znika (199 findingów wzorca bez trafień). | §2 pkt 9(a)(d); P1 (§7) | 5 faz (regresje i koszt na commit; test: 0,23 M, 1,7 P1/P2 poza kluczem); okno 5 PR (stosunek) | **W1** (R3, pętla fix) | stosunek pliki fixa / reszta ≥ B0 w oknie → dzisiejsza kontrola + analiza; koszt kontroli > 0,46 M/commit (2× test) → skrócić listy |
| 3a | Allowlista `tools:` + pliki klas ról + `omitClaudeMd` dla mechanicznych + zdanie N1 w poleceniu startu (§2 pkt 1–2). Reviewerzy i buildery zachowują CLAUDE.md, więc dla nich zmienia się tylko zestaw narzędzi → traktuję jako R1. | §2 pkt 1(a)(b)(c), pkt 2 | 1 faza (`narzedzia_n` 972 → kilkanaście; `ctx_start` vs cele 9–10k / 25–26k / 29k / 38k); 5 faz koszt | R1 w W1 | cel `ctx_start` nieosiągnięty → poprawić plik klasy; spadek findingów osi > 30% → przywrócić narzędzia |
| 3b | Efort jawny (D6 krok 1): reviewerzy `high`, sceptyk P2 `medium`, P1 `high`, mechaniczni haiku. | P4 | 5 faz | R1 w W1 | — (przypięcie stanu testowanego) |
| 3c | Porządki bez zmiany zachowania review: CLAUDE.md tylko po merge'u + `docs/decisions/` (§4a A); doctor + „Wymagania” w README, bramka CI `validate` (§4a F); usunięcia z 6a pkt 20 (z przeniesieniem treści SKILL.md execute/review do workflowów, §4a G), D9 (+ test w doctor), porządki review (§4a E), prompt-audit grupa (a) (PA-03, 04, 08–14, 16–21; PA-15 w It. 3), drobne z §10 (PR ≤ 150 plików, zielony main, bramka czystości, rek. 7). | §7 mapy (ponowny prompt-audit = zero trafień); §2 pkt 1(e) | 1 faza / 1 sesja | R1 w W1 | jak w D9 |
| 3d | Packager → skrypt (D3, K7), stan fazy w prompcie następcy zamiast `stan:zapis`. | zał. 4 | 5 faz | R1 w W1 | jak w D3 |
| 3e | E2E: parametryzacja `.env.e2e`, E2E → [MANUAL] z przejściem do smoke, sekcja Doctor przed startem (§2 pkt 6; część §2 pkt 14). | §2 pkt 6; I6(a)(b) | 5 zadań | R1 w W1 | STOP E2E nadal > 0 na zadanie → przegląd kategorii SKIP |
| **4a** | **Bramki lint/knip w domknięciu** (skrypt bramek = D7 warstwa 2): ESLint (typowany; error → naprawa w domknięciu, warn → wejście code-quality), knip, size-limit, tsc, `vitest --typecheck`, `migrations.sum`, niezmienność migracji, advisors; granice warstw (§2 pkt 15); każda bramka odebrana testem porażki (I3). | zał. 8 (bramka); I3; I7; `faza.bramki.*` | 1 faza (status, czas ≤ 143 s w teście); okno 5 PR (osie correctness i code-quality) | **W2** (R2: correctness + code-quality) | bramka > 300 s albo fałszywe STOP-y → reguła do warn; B P1/P2 osi ≥ próg → przegląd reguł |
| **4b** | **Mutanty dla reviewera testów (D5)** + efort test-coverage `medium` (K1), ułożenie wejścia jak w C. | I2; zał. 6; P4 | 1 faza (czas); okno 5 PR (oś test) | **W2** (R2: oś test, równolegle z 4a) | jak w D5 |
| **5** | **Sceptyk asymetryczny (§2 pkt 7) + batch 4 dla P2 (D2)**. Przed wdrożeniem: kill rate na archiwalnych findingach (mapa „PRZED wdrożeniem”). | §2 pkt 7; zał. 5; zał. 7 | 5 faz (kill rate, koszt); okno 5 PR (kasowanie prawdziwych) | **W3** (R3) | jak w D2 |
| **6** | **Fix tylko P1/P2**, P3 → known-issues/bot, zakaz zmian poza zgłoszonym miejscem (§2 pkt 9 (2)). Dziś fix naprawia 98% findingów łącznie z P3 (P3 138 z 225); fix = 14,8% kosztu zadania. | §2 pkt 9(a)(b)(c)(e) | 5 faz (koszt fixa, `p3Pominiete`, diff fixa); okno 5 PR | **W4** (R3) | stosunek pliki fixa / reszta rośnie albo B P3 → P1/P2 w oknie → P3 wraca do fixa |
| **7a** | **Polecenia-listy correctness z katalogu A** (K4) bez L-COR-6/7 (performance zostaje). Ślepy test przed. | zał. 1 per oś; §2 pkt 11 | 5 faz (koszt, tury); okno 5 PR (oś correctness) | **W5** (R2) | B P1/P2 osi correctness ≥ próg → wraca dzisiejsze polecenie |
| **7b** | **Spec:** listy L-SPC z sekcją planu + efort `medium` (K2) + warunek D4 (K9 dla spec, security, test-coverage). Ślepy test przed. | P3; zał. 1 per oś | jw. (oś spec) | **W5** (R2, równolegle z 7a) | jak w D4 |
| 7c | Pliki reviewerów security / performance / code-quality wg PA-01, 02, 05, 06, 07 — **tylko jeśli ślepy test nie pokaże straty** (§3 pkt 6). | P3 (§7 mapy) | okno 5 PR per oś | W5 (R2) albo osobne okno | P3: spadek potwierdzonych P1/P2 osi → minimalna forma usuniętej reguły |
| **8** | **Wiedza u buildera:** learned-patterns w trzech poziomach + wycinek od orkiestratora (§2 pkt 4) + D10 (zapobiegalne jako zdania w warstwie referencyjnej) + budżet pliku i rejestr stałych w planie (D8a). Usunięcie kroku 1.7 z plików builderów (PA-27), skill `security` jako reguły (PA-24). | §2 pkt 4; 6a pkt 26 (k) | 1 faza (rozmiary); 5 faz; okno 5 PR | **W6** (R3) | jak w D10 |
| **9** | **Warstwa stała ról < 150** (§2 pkt 3) — pliki klas pisane wg zasad 1–11 (§2a), test budżetu w `__tests__`. Ślepy test przed. | §2 pkt 3 | test szablonu od razu; okno 5 PR | **W7** (R3) | oś traci ≥ próg → przywrócić brzmienie tej roli |
| R1 | Po It. 3, po jednym, bez okna jakości: scalony dev-plan (D8a/D8b); zawężenie samosprawdzenia buildera i fixa (D7, po W2); compound ze szczeblem (I1); skill weryfikacji z mapą funkcji (I6); ogrodnik (I8); hook error-handling wycofany po bramce ESLint (zał. 8 — jakość grupy error-handling w oknie W2 lub później); efort klas poza review (D6 krok 4). | wg rekordów | 1 / 5 faz / 5 zadań | R1 | wg rekordów |

**Czas.** It. 1 — do zrobienia w szablonie przed pierwszym zadaniem; It. 2 — 2–3 zadania; okna W1–W7 po 5 PR. Tempo września 6,1 PR/tydzień →
okno ≈ 1 tydzień, całość ≈ 2 miesiące od B0, jeśli zadania idą jak we wrześniu. R1 nie wydłuża planu.

### 4a. Pełna lista uzgodnionych zmian → miejsce w planie

Tabela iteracji wyżej niesie zmiany z decyzji D2–D12 i dodatków z testu. Tu jest **cała reszta uzgodniona w analizie** (HANDOFF 6a pkt 1–33,
PANEL-WEJSCIE §2, §2a, §7, §9, §10) z przypisaniem do iteracji albo jawnym „poza planem”. Kontrola kompletności: `skrypty/panel_wynik_pokrycie.py`
→ `dane/panel-wynik-pokrycie.txt` (65 pozycji; pierwsza wersja tego dokumentu miała miejsce dla 31 — braki dopisane tutaj).

**A. Wiedza projektu: learned-patterns, CLAUDE.md, decyzje (6a pkt 1, 4, 11, 15, 17; §2 pkt 4).**
- **learned-patterns — It. 8 (W6, R3).** Trzy poziomy: (0) CLAUDE.md — jedna linia wskazująca indeks; (1) `docs/learned-patterns.md` — indeks
  generowany przez dev-compound-refresh z frontmatteru solutions (klasa | reguła 2 zdania | wzorce plików | waga | link), format klasa → reguła →
  źródło, bramka rozmiaru i dedup w JS, nikt nie edytuje ręcznie; (2) `docs/solutions/*.md` — jedyne źródło prawdy, bez limitu. Plik wychodzi
  z `.claude/rules/` (koniec ładowania eager do każdego agenta; dziś ~47k zn, reviewerom drugi raz przez dossier). Orkiestrator dokleja builderowi
  i reviewerowi wycinek 1–2k zn dopasowany po katalogach IU; dev-plan czyta indeks w całości. Limit dotyczy tylko warstwy zawsze ładowanej, nie wiedzy
  (odpowiedź na pytanie o projekt rozwijany latami). **8 zabezpieczeń** (walidacja globów; zamknięty słownik klas; koszyk „zawsze” z twardym limitem;
  walidacja frontmatteru w JS — compound odmawia zapisu bez pól; ten sam wycinek dla reviewerów; data + źródło + licznik ucieczek per wpis;
  dopasowanie po katalogach) i **jednorazowa konwersja** obecnych wpisów skryptem z listą odrzutów dla operatora. Compound ze szczeblem (I1) wchodzi
  wcześniej jako R1 — do pliku idzie tylko szczebel `reguła`. Uwaga kosztowa: wyjście learned-patterns z ładowania eager to też duża oszczędność
  startu agenta; jeśli po It. 3 okaże się większa od zysku z It. 7, It. 8 może zamienić się miejscem z It. 7 (obie mają okno dla siebie).
  Metryka: §2 pkt 4(a)–(e) (`faza.wiedza.{indeks_zn, claude_md_zn, wycinek_*}`, `run.pr.klasy[].ma_regule`).
- **CLAUDE.md — It. 3c (R1):** żaden skill nie dopisuje do CLAUDE.md (usunąć dev-docs-complete:115-116, complete-wf:160 — PA-16); aktualizacja =
  krok „uzgodnij z rzeczywistością” w dev-pr **po potwierdzonym merge'u** z bramką rozmiaru liczoną w JS; decyzje fazowe → `docs/decisions/` + jedna
  linia indeksu; bootstrap autopilota na main sprawdza, czy ostatni merge ma wpis w `docs/decisions/` (brak → uzgodnienie przed startem runu).
  Metryka: §2 pkt 4(a) `faza.wiedza.claude_md_zn` (oferty-online urósł 3,4k → 89,7k zn w 4 tygodnie bez tej zasady).

**B. Planowanie (6a pkt 8, 19; D8a/D8b).** Scalony dev-plan — R1 po It. 3 (rekord D8a). Budżet pliku w IU z pełnymi wymiarami: długość, przyrost,
liczba powodów do zmiany, eksporty konsumowane przez różne warstwy, importy z wielu domen, test-lustro rosnący szybciej niż kod, reguła 5 sekund;
linie = wyzwalacz pytania z tolerancją 20%, wymiary = werdykt; ten sam próg z tolerancją w ESLint (`max-lines`, It. 4a) i w `.coderabbit.yaml` (It. 2).
Budżet pliku i rejestr stałych czytane jakościowo w oknie It. 8. dev-prep bez zmian.

**C. dev-pr i bot (6a pkt 2, 11; L19; ETAP1B).** It. 2, przed B0: generator `coderabbit-base.yaml` + opis w skillu, jak konfigurować bota bez szumu;
8 zmian `.coderabbit.yaml`; `e2e/seeds/*.sql` jako granica zaufania w instrukcjach bota. **dev-pr — 4 zmiany (zero nowych agentów):** (1) etap `zbierz`
obowiązkowy w każdej turze, `napraw` odrzuca wątki bez niego; (2) guard uzasadnień: nazwa dokumentu + 20 zn, bez alternatywy z backtickiem;
(3) `rekomendacja` liczona w JS (MERGUJ / NIE MERGUJ / KOLEJNA TURA / DECYZJA OPERATORA) jako pierwszy wiersz raportu; (4) raport = tabela per tura
złączona po id z `watki[]` + `propozycjeDoReviewerow` commitowane w compoundzie. Sufit 3 tur, tryb interaktywny zostaje. Klasyfikacja uwag w `pr:zbierz`
(klasa, oś, waga) na **zamkniętym słowniku klas** (L12: dziś trzy słowniki; jedna lista z odwzorowaniem ETAP1 ↔ ETAP1B) — It. 1, bo bez niego pomiar
jakości nie jest porównywalny. Metryka: `run.pr.{klasy[], rekomendacja}`, liczba tur na PR.

**D. Kontekst agentów (6a pkt 7, 10, 15; §2 pkt 1–2) — It. 3a.** Allowlista `tools:` w plikach klas ról; MCP per agent: Figma tylko builder UI,
builder fullstack i tester E2E przy zadaniu z `figma_screens`, Supabase MCP tylko w sesji głównej, reszta `disallowedTools: mcp__*`; CLAUDE.md zostaje
u builderów i reviewerów, `omitClaudeMd` tylko u mechanicznych; tryb bypass i czytanie Bashem zostają (reguły `paths:` to bonus, nie kanał dostawy);
`skills:` u builderów zostaje (treść dzielona na stałą i referencyjną — It. 9); 6 agentów researchowych w klasie „badacz” z allowlistą; correctness
dostaje własny plik agenta (dziś prompt tylko w workflowie).

**E. Porządki review bez zmiany zachowania — It. 3c (R1)**, chyba że zaznaczono: precheck → env-up; dedup zostaje; poprawka wywołania test-coverage bez
`zEffortem`/`agentType` (`dev-docs-review-wf.js:904`) — razem z It. 3b; spec-compliance: martwe odwołania (PA-20) i duplikat fokusu (`REVIEWERZY:368`);
prompt osi code-quality dziś w dwóch miejscach (plik + fokus w workflowie) → jedno miejsce — w It. 7c, bo zmienia brzmienie tej osi;
`kieran-typescript-reviewer.md` i `code-simplicity-reviewer.md` — treść (kieran §4b async i błędy, §5 usunięcia i regresje, §7 sygnały ekstrakcji;
simplicity: YAGNI) jako materiał do list correctness w It. 7a, pliki usunięte po wykorzystaniu (ścieżka odwrotu konsolidacji straciła sens).

**F. Bramki, testy, reguły kodu.**
- Bramka niezmienności migracji (domknięcie i kontrola fixa) i `migrations.sum` przed env-up — It. 4a; zielony main w bootstrapie — It. 3c.
- **Seedy z właścicielem:** tester E2E sprawdza seed vs kontrakt migracji (lista L-E2E-2), security — strażników w seedach — It. 3e; w bocie — It. 2.
- **coding-rules.md:** przepisanie wg tabeli USUŃ / ZMIEŃ / DODAJ / PRZENIEŚ-DO-LINTERA z ETAP2 i PA-26 (sprzeczność §3/§11, zbyt absolutne NIGDY/ZAWSZE,
  część do ESLint) — decyzja operatora przy wdrożeniu, w It. 8 (coding-rules przechodzi do warstwy referencyjnej po typie pliku). **Wyjątek w §2**
  (usunąć wolno tylko zielony test niefalsyfikowalny, gdy nie da się przepisać asercji; czerwonego nigdy; wpis w raporcie fazy) — It. 4b, razem
  z pytaniem „undefined” i mutantami; pole `faza.testy_usuniete[]` (I2).
- **`.claude/workflows/__tests__` (74 testy):** każda iteracja aktualizuje testy, które przypinają zmieniane zachowanie (np. `sceptycy-p2.test.mjs:157`
  przypina `TIERY_DOMYSLNE` — It. 3b i It. 5); dochodzą test telemetrii (It. 1), testy porażki bramek (It. 4a), test budżetu instrukcji (It. 9).
  `templates/smoke-autopilot` zostaje jako scenariusz sprawdzający maszynerię po każdej iteracji.
- **Bramka CI zmian maszynerii:** `claude plugin validate --strict` + `claude plugin eval` — It. 3c (niezależnie od decyzji o pluginie).
- **doctor:** skrypt bash, lista narzędzi wyliczana z projektu (git, gh + auth, node + menedżer z lockfile, supabase CLI przy `supabase/`, agent-browser
  przy checkboxach E2E, coolify, docker), tabela brak / wersja + komenda instalacji; wołany w sync-template, dev-prep i bootstrapie (STOP przed pierwszą
  fazą); sekcja „Wymagania” w README — It. 3c.

**G. Usunięcia (6a pkt 20) — It. 3c.** Razem z usunięciem: poprawki README i `learnings-researcher.md:256`; treść SKILL.md dev-docs-execute i dev-docs-review
czytana przez agentów w runie przeniesiona do workflowów; opisy trzech builderów „wywoływany przez dev-docs-execute” przepięte na workflow. **Szablon
mobile** — osobna decyzja operatora, poza planem (ma własne, zmienione kopie).

**H. Prompt-audit (6a pkt 25).** (a) It. 3c; (b) It. 7c po ślepym teście; **(c) decyzje operatora przy wdrożeniu:** PA-25 — odświeżyć kopię
`figma-design-to-code` z pluginu albo przejść na `figma:figma-design-to-code` (It. 3c), PA-26 — coding-rules (F wyżej). PA-24 (skill `security`
u builderów → reguły) i PA-27 (usunąć krok 1.7 z builderów) — It. 8. Ponowny prompt-audit po każdej iteracji dotykającej promptów.

**I. Higiena konta — osobny etap poza szablonem (6a pkt 3, 17, 18 L8), równolegle z It. 1, zakończony przed B0** (zmienia kontekst startu, więc
B0 kosztu ma go już zawierać): MCP i pluginy per projekt (`enabledPlugins` w `.claude/settings.json` projektu), audyt zainstalowanych pluginów
(`/doctor`, `/skill-doctor`, `/plugin stats`), `cleanupPeriodDays` = 120, `enabledPlugins dev-browser` w `settings.json` vs `settings.local.json`,
statusLine `npx -y …@latest`. **L8** — w raporcie dla operatora opis „jak radzić sobie z dużą liczbą MCP i skilli na koncie” (allowlista `tools:`) jako
wiedza do podzielenia się.

**J. Poza planem / odłożone z warunkiem.** Szablon jako plugin — nie teraz (6a pkt 13; pomysł zapisany, bramka `validate` wchodzi niezależnie).
Przejście regresyjne po funkcjach z mapy — odłożone; warunek powrotu: uwagi bota albo Sentry w funkcjach, których plan nie dotykał (I6 c). D12 cz. 2 —
§2. Tryb ręczny execute/review — usunięty (6a pkt 20).

**K. Raport etapu 5 (HANDOFF §2 wiersz 5, §6 pkt 6).** PANEL-WYNIK to decyzje i plan. Dwa raporty etapu 5 (`RAPORT-TECHNICZNY.md` i
`RAPORT-DLA-OPERATORA.md`: mapa kosztów przed/po, decyzje per element z dowodem, docelowy pipeline, plan, ograniczenia L6–L18 z PANEL-WEJSCIE §9, trzy
zdania z ETAP2 §6, L8) są osobnym, ostatnim krokiem analizy — po akceptacji tego dokumentu, składane z niego i z wcześniejszych rozstrzygnięć.

---

## 5. Docelowy pipeline jako całość

- **Przed autopilotem:** dev-prep bez zmian; scalony `dev-plan` (plan → IU z budżetem pliku i rejestrem stałych, zadania generowane skryptem, research
  warunkowy przy „Lekka”); bramka gotowości: doctor, zielony main, Doctor skilla weryfikacji.
- **Start runu:** polecenie startu ze zdaniem N1; agenci z plików klas (allowlista, `omitClaudeMd` u mechanicznych, efort jawny); telemetria bez agentów
  (skan pliku harnessu po runie).
- **Faza:** planner → build (IU) z wycinkiem wiedzy i zdaniami „co robić zamiast” dla swoich plików, samosprawdzenie na plikach IU → domknięcie: skrypt
  bramek (ESLint, knip, size-limit, tsc, `vitest --typecheck`, migracje, advisors, Stryker diff-scoped) + dossier ze skryptu → **review: 6 osobnych
  reviewerów** (security, performance, code-quality, correctness, spec, test-coverage) + tester E2E wg skilla weryfikacji; wejścia: dossier, warn/knip
  dla code-quality, mutanty dla test-coverage; efort `high`, test-coverage i spec `medium`; correctness i spec z poleceniami-listami → dedup (JS + haiku)
  → sceptycy asymetryczni (P2 batch 4, P1 ×3) → scribe → fix tylko P1/P2 → **kontrola diffu fixa wg A** (K-1…K-7) → poprawka warunkowo; bez re-review.
- **Zamknięcie zadania:** walidacja końcowa (pełne testy, build, audyt testów po fixach, completion-gate E2E), compound ze szczeblem, compound-refresh,
  ogrodnik, smoke operatora z pozycjami [MANUAL], complete (PR ≤ 150 plików); CLAUDE.md aktualizowany po merge'u.
- **dev-pr:** bot z nową konfiguracją; `pr:zbierz` klasyfikuje uwagi → `run.pr` (miara jakości).
- **Znika:** agent packager, `stan:zapis`, `fix:pre-skan`, verify-fix, agent telemetrii, skille koszyka D, dev-ideate, freshness-audit, tryb ręczny
  execute/review jako skille.
- **Zostaje wbrew wcześniejszym zapisom:** reviewer performance, prompt i efort code-quality, długość security (do ślepego testu) — §3.
- **Koszt:** pokrętła review przyjęte w §1 (K1, K2, K4, K7, K9) ≈ −20% kosztu znajdowania; batch sceptyków ≈ −4% zadania; allowlista i kontekst —
  największa dźwignia (≈ 40–50% kosztu fazy, przegląd D4). **Dźwignie nie sumują się** (przegląd D4): odczyt każdej osobno z telemetrii.

---

## 6. Ograniczenia

1. Pokrętła z §1 to różnice ról między A a dziś, gdzie zmieniało się naraz kilka rzeczy (efort, brzmienie, dossier) — górna granica efektu jednego
   pokrętła; potwierdza je dopiero odczyt po wdrożeniu (każde z metryką).
2. Test: 13 faz, jeden przebieg, jeden projekt; wkład ról w klucze na małych liczbach (np. performance 3 + 6). Security i ogon bez wniosku (6a pkt 30 a).
3. D2: sceptycy B weryfikowali własne findingi B (inne niż dzisiejsze) i byli asymetryczni — koszt na finding porównywalny, jakość weryfikacji na małym N.
4. D12 cz. 2: „nowy plik” jako przybliżenie „nowej funkcjonalności”; nowa trasa albo eksport w istniejącym pliku niepoliczone.
5. „≈ % zadania” liczone udziałem review z panelu (małe fazy runu 20.09) — dla dużych faz udział review jest inny.
6. Efort dziś zależy od sesji operatora (`high`/`medium`), a harness go nie zapisuje — B0 kosztu zbierany po It. 1 (efort w etykietach).
7. Czas planu zakłada tempo września; po analizie tempo nieznane.
8. `dane/pa-proponowany.diff` sprawdzony na HEAD 46e854b — przed naniesieniem ponowne `git apply --check` i testy `__tests__`.

---

## 7. Kontrola w obie strony

- **Dokument → źródła:** §0–§1 i rekordy: liczby ról, pokrętła, podział A − 0, wkład ról, weryfikacja — `dane/pokretla-kosztu.txt` (sekcje wariant 0/A,
  POKRĘTŁA, podział, wkład, weryfikacja); D12 cz. 2 — `dane/d12-nowe-pliki-fixa.txt`; tempo — `dane/tempo-pr.txt`; udziały zadania — `dane/pokretla-kosztu.json`
  `panel.udzialy_zadania_po` (z `panel-koszt.json`); wyniki testu (klucze, D5, D12 cz. 1, szum, koszt 2,63 / 1,50 M) — `dane/test-review/wynik.txt`,
  TEST-REVIEW-WYNIK §4–§11; baseline mapy (8,8 / 10,9% / 23%, 14,0 vs 4,7, wrzesień 2 i 7 na 683, progi 4 i 12, 2,39 + 0,56 M, 18,6 / 55,6 M, mediana 32,
  636k) — `dane/d5b-mapa-walidacji.txt`, MAPA-WALIDACJI-DLA-OPERATORA; wybory i odrzucenia A/B/C — `dane/panel-run1-projekty.json` `decyzje[]`;
  `TIERY_DOMYSLNE` — `dev-docs-review-wf.js:819`; ~15% `medium` — TEST-REVIEW-PLAN §2.3; ≤ 143 s i 7–126 s — TEST-REVIEW-WYNIK §7.
- **Źródła → dokument (mechanicznie):** `skrypty/panel_wynik_pokrycie.py` — 65 pozycji z HANDOFF 6a pkt 1–33 i PANEL-WEJSCIE §2, §2a, §7, §9, §10;
  wynik `dane/panel-wynik-pokrycie.txt`: 65/65 ma miejsce (pierwsza wersja dokumentu: 31/65 — braki dopisane w §4a).
- **Źródła → dokument:** zadanie 1 (pokrętła: efort per rola — K1–K3, K12; długość i kształt poleceń — K4, K5, K10; warunki uruchamiania — K6, K9;
  dossier — K7, K8; przypisanie do D3/D6/D10 lub nowa pozycja) → §1; zadanie 2 (D2–D11, D12 cz. 2, pola rekordu, liczby testu dla D2 i D5) → §2;
  zadanie 3 (iteracja 1 = telemetria + import; kontrola fixa; bramki; mutanty; pokrętła po jednym; para zmiana–wpis mapy) → §4; zadanie 4 (rekordy,
  pipeline jako całość, iteracje, ograniczenia) → §2, §5, §4, §6. PANEL-WEJSCIE §2 pkt 1–16: pkt 1–2 → It. 3a; 3 → It. 9; 4 → It. 8; 5 → It. 1;
  6 → It. 3e; 7 → It. 5; 8 → §3 pkt 2 i It. 4a (advisors); 9 → It. 3, 6; 10 → §5 (bez re-review); 11 → It. 7; 12 → D8a/D8b; 13 → każda iteracja ma wpis
  mapy; 14 → It. 3e + R1 (I6); 15 → It. 4a; 16 → R1 (I8). §10: usunięcia, prompt-audit (a), drobne, bot → It. 2, 3c; prompt-audit (b) → It. 7c;
  inspiracje (szczebel, odbiór bramek, lint po sprzątaniu, wyjątek coding-rules §2) → R1, It. 4a, It. 2, It. 4b/8. Założenia §6: 1 → It. 7; 2, 3, 6 → §3;
  4 → D3; 5, 7 → D2; 8 → R1.
