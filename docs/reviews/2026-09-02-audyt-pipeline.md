# Audyt pipeline'u dev-* — 2026-09-02

Zakres: `workspace-template` (skille, agenci, workflowy) skonfrontowany z realnymi runami w projekcie
`oferty-online` (7 zadań, 10 runów autopilota) oraz z upstreamami (compound-engineering v3.24.0,
mattpocock/skills 1.2.3). Dane ilościowe: globalna telemetria `~/.claude/telemetry/autopilot-runs.jsonl`
(39 runów, 5 projektów, 77 faz).

**Metoda i jej ograniczenia.** Audyt prowadziło 16 równoległych agentów-finderów; 6 z nich zdążyło
zwrócić wyniki (47 findingów, 24 propozycje adopcji), zanim run uderzył w limit sesji. Zaplanowana
adwersaryjna weryfikacja przez sceptyków **nie odbyła się** — dowody kluczowych findingów sprawdziłem
osobiście w plikach i oznaczam je niżej jako `[zweryfikowane]`. Findingi bez tego znacznika pochodzą
z jednego przebiegu i wymagają sprawdzenia przed wdrożeniem. Obszary **niepokryte**: pełny przegląd
wspólnych skilli compound-engineering, mattpocock poza szybkim skanem, osobny audyt toru E2E,
bezpieczeństwo autonomii (sprawdziłem tylko punktowo) i UX operatora.

---

## Liczby, od których zaczyna się każda decyzja

| Metryka | Wartość | Źródło |
|---|---|---|
| Rozkład tokenów fazy | execute 25 % · **review 66 %** · fix 9 % | telemetria, 33 fazy z rozbiciem |
| Mediana tokenów fazy | 320 k (execute 112 k / review 236 k / fix 34 k) | telemetria, n=44 |
| Rozrzut review | 109 k – 925 k (8,5×) | telemetria |
| Lejek review | 55 findingów → 31 po dedupie → 13 weryfikowanych → 2,5 obalonych | telemetria, 77 faz |
| Duplikaty semantyczne | 44 % findingów | telemetria |
| P3 w raportach | 741 na 1080 findingów (69 %), naprawianych w autopilocie: **0** | telemetria + `fixPrompt` |
| Runy zakończone STOP | 21 z 39 | telemetria |
| Najczęstszy STOP | „niezacommitowane zmiany" — 6× | telemetria |

Kluczowa uwaga metodologiczna: `budget.spent()` liczy **tokeny wyjściowe**. Koszt wejścia (8 reviewerów
czytających te same 50–90 k tokenów dokumentów) jest w telemetrii **niewidoczny**. Wszystkie decyzje
o progach podejmowane dotąd na podstawie tych liczb oceniały niepełną oś.

---

## 1. Bramki i STOP-y — tu ginie najwięcej pracy

### 1.1 Fałszywy STOP „bloker środowiska" z findingu o kodzie `[zweryfikowane]` — P1, wysiłek S

`dev-docs-review-wf.js:758` woła `wykryjBlokerSrodowiska(wszystkie)` — na **wszystkich** findingach,
także tych od reviewerów kodu. Sygnatura `:741` zawiera gołe `getaddrinfo`.

Skutek w realnym runie (`faza-6-cta-i-webhooki`, 2026-09-02 14:25): reviewer zgłosił poprawny finding P2
o tym, że `dns.lookup` w `deliver.ts:214` nie jest objęty limitem czasu. Detektor uznał słowo
`getaddrinfo` za awarię środowiska i zatrzymał run — mimo że faza 3 nie miała **ani jednego** checkboxa
`[E2E]`, a tester był pominięty przez routing. Run spalił 1 218 k tokenów i został przerwany.

Naprawa: skanuj wyłącznie findingi testera (`f._zrodlo === 'e2e'`), tylko przy `e2eTryb === 'przegladarka'`,
i zawęź regex do postaci komunikatów runtime (`getaddrinfo\s+(ENOTFOUND|EAI_AGAIN)`, `\bENOTFOUND\b`).
Dodatkowo wymagaj, by findingowi odpowiadał wpis FAIL/SKIP w `przebiegi[]` — bloker bez przebiegu to nie bloker.

### 1.2 STOP blokera gubi metryki i otwarte findingi fazy `[zweryfikowane]` — P1, wysiłek S

Gałąź `dev-autopilot-wf.js:993-1001` robi `return await stopRun(...)` **bez** `zapiszStan()`, bez
`faza.metryki` i bez `faza.otwarteFindingi`. Sąsiednia gałąź `e2eTesterFail` (`:1008`) woła `zapiszStan()`,
a ścieżka normalna (`:1031-1036`) zapisuje jedno i drugie.

Skutek: `.autopilot-state.json` zadania `faza-6` ma dla fazy 3 `"metryki": null`, a telemetria pokazuje
`liczniki None`. Praca review (2,8 mln tokenów w dzienniku runu) przepadła jako dane, a kolejny run
musiał powtórzyć review od zera.

Naprawa: przed `stopRun` w tej gałęzi ustaw `faza.otwarteFindingi = otwartePoReview(review.findings)`,
`faza.metryki = { liczniki, przebieg }` i wywołaj `zapiszStan()`.

### 1.3 Artefakty pipeline'u nigdy nie są commitowane `[zweryfikowane]` — P1, wysiłek M

`zapiszStan()` (`:827-843`) tylko zapisuje plik; scribe zapisuje raport review bez commita. Bramka
czystości drzewa (`:814`) nie filtruje ścieżek. Każdy STOP zostawia więc niezacommitowany stan i raport,
a **następny run zatrzymuje się na „niezacommitowane zmiany"** — 6 razy na 39 runów, zawsze bezpośrednio
po innym STOP-ie. Operator ratował to ręcznie (`781cdde`, `b57f236`).

Naprawa: w `stopRun` tani commit pathspecem `docs/active/<zadanie>/`, albo bramka uznająca drzewo
brudne tylko poza tym katalogiem.

**Łączny zysk tematu 1:** eliminacja ~30 % wszystkich STOP-ów, ~2,8 mln tokenów dziennika unikniętego
re-review na każdy fałszywy bloker, 4–5 h czasu operatora na 39 runów.

---

## 2. Review — 66 % kosztu, największa dźwignia

### 2.1 Każdy reviewer czyta te same 150 KB dokumentów `[zweryfikowane]` — P1, wysiłek M

`reviewerPrompt` (`:369`) każe **każdemu** reviewerowi przeczytać requirements doc + plan techniczny +
`learned-patterns.md` + diff. W `oferty-online` to 63 KB + 76 KB + 11 KB, czyli 57–90 k tokenów wejścia
na reviewera, przy 7–8 reviewerach — 450–720 k tokenów, zanim ktokolwiek otworzy plik kodu. Ten koszt
nie jest widoczny w telemetrii.

Naprawa: packager (który i tak czyta wszystko) zapisuje **dossier fazy** obok zrzutu diffu — wycięte
bloki IU tej fazy, wiersze „Śledzenie wymagań" przywołane przez te IU, `learned-patterns.md` 1:1,
sekcja fazy z pliku zadań. `reviewerPrompt` wskazuje dossier; pełne dokumenty tylko, gdy IU odsyła do
czegoś, czego tam nie ma. Ten sam plik dostaje tester E2E i sceptycy.

### 2.2 Adversarial verify to 41 % tokenów review — P1, wysiłek M

Sceptyk jest odpalany per finding, bez dostępu do gotowego diffu, na modelu sesji. Findingi klastrują
się w plikach (19 findingów w 6 plikach w jednej fazie).

Naprawa: sceptycy P2 batchowani per plik (jeden sceptyk czyta plik raz, ocenia wszystkie findingi
w nim), `mapaBlok(kontekst)` w prompcie sceptyka, `effort: 'medium'` dla sceptyków P2 i packagera.
P1 zostaje na trzech niezależnych głosach. Szacunek: −35–45 % agentów verify.

### 2.3 Tester E2E startuje przy zerowej liczbie checkboxów `[zweryfikowane]` — P2, wysiłek S

`const domenaE2E = !warstwy || warstwy.ui || e2eCheckboxy > 0` — przy `ui=true` tester rusza także
wtedy, gdy faza nie ma **żadnego** scenariusza `[E2E]`. W danych: 10 z 18 uruchomień to no-op po ~95 k
tokenów. Poprawka to jedna linia: `warstwy.ui` zastąpić warunkiem na policzone checkboxy z fail-open,
gdy liczba nieznana.

### 2.4 Routing nie przycina, a packager kosztuje jak reviewer — P2, wysiłek M

W 77 fazach pominięcia to `typescript` 11×, `e2e` 12×, `architecture` 4×, `performance` 2×. W projekcie
TypeScript flaga `typowanie` jest praktycznie zawsze prawdziwa. Naprawa: packager zwraca **liczby**
(nowe katalogi, pliki kodu, trafienia wzorców danych i typów), a warunki routingu operują na progach;
sam packager schodzi na `haiku` (jego praca to `git diff`, `wc`, `grep`).

### 2.5 Konsolidacja reviewerów — P2, wysiłek M

44 % duplikatów bierze się stąd, że `architecture`, `simplicity` i `typescript` patrzą na ten sam diff
tym samym trybem rozumowania. Upstream skonsolidował 16 person do 6 dispatchy według kryterium: osobny
agent tylko wtedy, gdy wymaga **innego trybu rozumowania**. U nas: scal trzech w jednego `code-quality`,
a osobno dołóż brakującą oś **correctness** (prześledź wykonanie zmienionych ścieżek) — dziś nikt nie
szuka wprost błędów logiki.

### 2.6 Lite roster dla faz bez kodu — P3, wysiłek S

Pięć faz z zerem P1/P2 kosztowało 129–189 k tokenów review; jedna miała 13 plików, z tego 0 kodu, a
dostała pełny skład i testera w trybie przeglądarki. Gdy `plikiKodu === 0`: tylko spec-compliance
i simplicity, tester pominięty z jawnym powodem.

---

## 3. Fix i jakość — co pipeline przepuszcza

### 3.1 P3 są generowane i nigdy nie naprawiane `[zweryfikowane]` — P1, wysiłek M

`fixPrompt` mówi wprost: „Napraw WSZYSTKIE z listy (są to P1 blocking i P2 important; **P3 nie ma na
liście**)". W siedmiu zadaniach `oferty-online` P3 otwartych: 53/44/37/32/12/46/24; zamkniętych:
1/0/0/1/1/2/1. Jednocześnie CodeRabbit dzień później naprawia te same rzeczy jako realne błędy —
udokumentowane pary: asercja typu w `DEVICE_ORDER`, mylący `mobileLead`, test bez strażnika, asercja
na konkretnej wysokości 9498 px, krańce zakresu w `events.test.ts`.

To znaczy, że wytwarzamy 69 % findingów po to, żeby je wyrzucić, a potem płacimy za nie drugi raz
w turach CodeRabbita.

Naprawa (dwa ruchy, do wyboru): (a) do listy fixa dołączać P3 typu KOD/TEST, których plik jest już
na liście P1/P2 tej fazy — agent i tak ma go otwartego; (b) przekazywać `limitP3` z autopilota (0 lub 2),
a resztę zapisywać jako jedną linię w raporcie, nie jako wieczne `[ ]` w pliku zadań.

### 3.2 Fix nie ma re-review — regresje wchodzą do commita — P1, wysiłek M

Po fixie działa tylko „targeted verify" dla P1/KOD. Dowód regresji: fix fazy 2 dodał `loading="lazy"`
do `<iframe>` i pusty `catch` — jedno i drugie CodeRabbit usunął dzień później (`44a938e`), bo lazy
rozjeżdżało się z licznikiem timeoutu, a pusty catch łamał regułę §4.

Naprawa: dwustopniowy diff-check na `git diff <feat>..<fix>` — najpierw deterministyczny grep w JS
(pusty `catch`, ` as `, `: any`, `console.log`, `!`), zero tokenów; potem jeden tani agent
z zadaniem „zgłoś wyłącznie regresję wprowadzoną przez commit fix" i obowiązkiem wypisania wektorów
obejścia dla każdej nowej bramki walidacyjnej.

### 3.3 Reviewerzy nie mają właścicieli dwóch całych domen — P2, wysiłek S

Grep po `.claude/agents/security-sentinel.md` (156 linii): zero wystąpień „bypass", „obejście", „encja",
„clickjack", „frame-ancestors", „rate limit", „chunked", „srcset". CodeRabbit znalazł w tych obszarach
12+ uwag, w tym `X-Frame-Options` na dokumencie dashboardu, limit ciała omijany przez `chunked` i hasło
do bazy w `argv`. Osobno: **nikt** z ośmiu reviewerów nie jest właścicielem error-handlingu i async
z `coding-rules` §4/§13 — cztery odrzucone promise'y w dashboardzie wyszły dopiero w CodeRabbicie.

Naprawa: sekcja „tryb atakującego" w `security-sentinel` (dla każdej nowej bramki wypisz ≥5 wektorów
obejścia) i checklista §4/§13 w `kieran-typescript-reviewer`, wsparta deterministycznym pre-skanem
w packagerze.

### 3.4 `spec-flow-analyzer` w roli reviewera zgodności `[zweryfikowane]` — P2, wysiłek S

Agent jest zaprojektowany do analizy specyfikacji **przed** implementacją (sekcje „Map User Flows",
„Formulate Questions", output „Gaps / Questions"), a `review-wf:299` używa go jako reviewera zgodności
**po** implementacji. To najdroższy reviewer w zestawie (mediana 174 k tokenów, 295 s, 21 wywołań
narzędzi) i pracuje w niedopasowanej roli. Naprawa: osobny `spec-compliance-reviewer.md`, a
`spec-flow-analyzer` zostaje dla `/dev-plan`.

### 3.5 Obalone findingi znikają bez śladu — P2, wysiłek S

`review-wf:909` filtruje potwierdzone, a obalone przepadają — w raporcie zostaje sam licznik. Przy 18 %
obalanych nie da się ocenić, czy sceptycy mają rację, ani który reviewer produkuje fałszywe alarmy.
Dane już są; wystarczy dopisać do raportu sekcję „Obalone przez verify" po jednej linii.

---

## 4. Łańcuch dokumentów przed autopilotem

### 4.1 Bramka blokerów operatora nigdy nie zadziała `[zweryfikowane]` — P1, wysiłek M

`dev-prep` emituje marker **`[blokuje planowanie]`**, `dev-plan` dopisuje **`— blokuje Fazę N (IU-x)`**,
a `dev-docs:140` szuka **`[blokuje start]`**. Trzy różne markery. W `oferty-online` 5 z 7 checklist ma
zero wystąpień „blokuje start", więc bramka gotowości nigdy nikogo nie zatrzymała — a w fazie 6 trzy
nieodhaczone pozycje weszły do implementacji jako propozycje zamiast zatwierdzonych tekstów.

### 4.2 Planner czyta 120–175 KB, potrzebując ~18 KB — P2, wysiłek S

`plannerPrompt` każe czytać cztery pełne dokumenty co fazę, choć potrzebuje sekcji jednej fazy.
Naprawa: `grep -n` nagłówków + `Read` z offsetem. Szacunek: 25–40 k tokenów na fazę.

### 4.3 `kontekst.md` to w 75 % parafraza planu, której nikt nie czyta — P2, wysiłek S

Z siedmiu sekcji pliku workflowy używają dwóch („Designerski kontekst", „Dziennik"). Sekcje „Decyzje
techniczne" i „Odroczone" mają 1 na 23 i 0 na 10 linii wspólnych z planem — czyli są parafrazą, drugim
źródłem prawdy. Naprawa: zredukować do sekcji faktycznie konsumowanych plus wskaźnik do planu.

### 4.4 Decyzje D1–D23 nie docierają do buildera — P2, wysiłek S

IU odwołują się do „D2", „D1", „sekcji 3.1 checkliszy" bez treści. Builder w fazie 6 sam odnalazł plik
checklisty, żeby zdobyć teksty (`cta-section.ts:26`). Naprawa: `dev-plan` wkleja jedno zdanie treści
decyzji przy każdym odwołaniu i teksty verbatim do IU.

### 4.5 Agenci researchu w `dev-plan` odpalani jako `type: Explore` `[zweryfikowane]` — P2, wysiłek S

Pięć miejsc (`:167, :168, :217, :218, :233`) mówi „Agent tool (type: Explore) z promptem
z `.claude/agents/....md`". To znaczy: wbudowany agent read-only, a plik agenta przepisywany jako prompt
(54 KB), z pominięciem jego frontmattera i narzędzi. `dev-brainstorm:108` robi to poprawnie
(`subagent_type: "web-research-specialist"`). Naprawa: pięć podmian.

### 4.6 `dev-brainstorm` nie zna `dev-prep` — P2, wysiłek S

Handoff prowadzi wyłącznie do `/dev-plan`, mimo że `dev-prep` deklaruje się jako krok pośredni,
a README opisuje to w dwóch miejscach niespójnie.

---

## 5. Po zadaniu — luka między autopilotem a merge'em

Pipeline kończy się na archiwizacji i „→ PR". Dalej dzieje się rzecz, której szablon w ogóle nie widzi:
**CodeRabbit zostawia 127 komentarzy inline w 6 PR-ach, a operator odpala 2–5 ręcznych sesji poprawek**
(14 commitów typu „poprawki po review CodeRabbit"). Żadna z tych napraw nie wraca do `docs/solutions/`
(grep po „coderabbit" → 0 trafień), więc wiedza z najskuteczniejszego zewnętrznego reviewera nie
wchodzi do bazy, na której stoi cały compound.

To jest największa pojedyncza luka procesu i jednocześnie najlepiej udokumentowana propozycja
z upstreamu (patrz §7.1).

Powiązany drobiazg: podsumowanie zadania utrwala jako „kluczową decyzję" szczegół, który dzień później
zostaje usunięty (`loading="lazy"` w podsumowaniu fazy 5) — bo po archiwizacji nic już nie aktualizuje
`docs/completed/`.

---

## 6. Fundamenty: portowalność, hooki, telemetria

### 6.1 Vite i port 5173 zaszyte w 9 plikach `[zweryfikowane]` — P2, wysiłek M

28 wystąpień w agencie testera, obu workflowach, trzech skillach, szablonie `.env.e2e` i README.
`oferty-online` (Hono + Node, bez dev servera Vite) musiał **spatchować workflow lokalnie** — a
`/sync-template` deklaruje „szablon zawsze wygrywa", więc pierwsza synchronizacja skasuje ten patch
i zepsuje tor E2E.

Naprawa: `E2E_BASE_URL`, `E2E_HEALTH_PATH`, `E2E_DEV_CMD` (i opcjonalnie `E2E_SHARED_DB`) w `.env.e2e`,
czytane przez `e2eEnvUpPrompt`, z fallbackiem na obecne wartości Vite; `baseUrl` przekazywany do
testera i do komunikatów naprawczych.

### 6.2 Hooki: `tsc` po każdej odpowiedzi, martwe w monorepo `[zweryfikowane]` — P2, wysiłek S

`stop-build-check-enhanced.sh` uruchamia `npx tsc --noEmit` po **każdej** odpowiedzi, bez sprawdzenia,
czy cokolwiek się zmieniło (jest tylko bramka na istnienie `tsconfig.json`). W `oferty-online` nie ma
ani `tsconfig.json` w korzeniu, ani `src/`, ani `supabase/functions/` — oba hooki są martwe, a README
opisuje je jako „hooki harnessa przy wywołaniach narzędzi", czym nie są.

### 6.3 Legacy skill `/dev-autopilot` (501 linii) — P2, wysiłek S

Opisuje 5 agentów review, `MAX_FIX_CYKLI: 2`, „Agent 4/5", pełny re-review w pętli i deklaruje „nie
wymaga żadnego pliku stanu" — wszystko sprzeczne z workflowem. Ma aktywne triggery w opisie, więc
model może go odpalić zamiast workflowu. Usunąć albo przemianować na `-legacy` bez triggerów.

### 6.4 `dev-docs-update` robi `git add .` `[zweryfikowane]` — P3, wysiłek S

Jedyne miejsce w szablonie łamiące własną regułę powtórzoną w czterech innych plikach. Ryzyko wciągnięcia
`.env.local` i artefaktów builda do commita WIP.

### 6.5 Telemetria mierzy złą oś — P2, wysiłek S

Pola `tokeny`/`tokenyEtapy` to **tokeny wyjściowe** (`budget.spent()`), a README opisuje je jako „rozbicie
tokenów na etapy". Do tego dane mają uszkodzenia: jeden wpis z dosłownym `'$TS'`/`'$PROJEKT'` (agent
haiku zapisał szablon powłoki bez podstawienia), jeden run z ujemnymi tokenami (`-1808 k`), metryki
`null` po resume. Naprawa: przemianować pola, dodać czas ścienny etapów (agent czyta `date -Iseconds`,
JS liczy deltę), raportować mediany.

### 6.6 Brak pętli strojenia — P2, wysiłek M

Progi (`LIMIT_P3_GLOBALNY = 8`, `LIMIT_DIFFU_B`, routing v2) były wdrażane z komentarzem „HIPOTEZA —
następny run pokaże". Przy rozrzucie review 8,5× na tym samym pipelinie żadna pojedyncza obserwacja
niczego nie dowodzi. Upstream ma na to gotowy wzorzec: parowany A/B na korpusie **odwróconych commitów
fix** (znasz tożsamość defektu, bo znasz commit, który go naprawił) — a my mamy ~25 takich commitów
w `oferty-online`.

---

## 7. Do przejęcia z upstreamów

Z 24 propozycji (compound-engineering v3.24.0, mattpocock 1.2.3) warte wdrożenia:

### 7.1 `ce-resolve-pr-feedback` → nowy skill `/pr-feedback` — P1, wysiłek M

Pobiera nierozwiązane wątki PR przez GraphQL, ocenia każdy według rubryki (domyślnie napraw; odstępstwo
tylko na konkretny sygnał → `needs-human`), klastruje po wspólnym błędnym założeniu bota i rozszerza
zaakceptowany finding na bliźniacze miejsca. Zamyka lukę z §5. Port: rubryka + trzy skrypty `gh`
przeniesione 1:1, bramka jakości jak w fixie autopilota.

### 7.2 Dossier dowodowe + tiery modeli + harness ewaluacyjny — P1

To trzy pozycje metodologiczne, które adresują wprost §2.1, §2.2 i §6.6. Wynik z ewaluacji upstreamu:
obniżenie tieru rozumowania u adwersaryjnego weryfikatora z „high" na „medium" dało remis jakości
(detekcja 94→92 %, n=150) przy 31 % mniej tokenów w medianie. To jedyna pozycja w całym zestawie
z twardym dowodem eksperymentalnym.

### 7.3 `ce-doc-review` → review planu przed autopilotem — P2, wysiłek M

Dwie persony: coherence (sprzeczności między sekcjami, zepsute referencje) i feasibility (co już istnieje
w repo, ścieżki błędu per przepływ). Dziś wady planu wychodzą dopiero w execute jako „Odchylenie (IU-x)" —
w fazie 4 było ich 12, w tym checkbox mówiący jednocześnie „fikstura 5 wizyt" i „kafle 7/4".

### 7.4 `wizard` (mattpocock) → checklista operatora jako skrypt — P2, wysiłek M

Generuje interaktywny skrypt bash, który przeprowadza człowieka przez kroki tylko dla niego: otwiera URL-e,
mówi co kliknąć, przechwytuje wartości i zapisuje je do `.env` oraz sekretów CI. Nasz `/dev-prep`
produkuje 42 KB checklisty do ręcznego odhaczania — to jest dokładnie ten problem, tylko rozwiązany
tekstem zamiast narzędziem.

### 7.5 Pozostałe warte uwagi

`ce-commit` (jeden kontrakt commita: `-F` plik, jawne ścieżki, zakaz `add .`), `ce-handoff` (rozszerzenie
`dev-docs-update` o tryb bez zadania → `docs/sesje/`), `ce-commit-push-pr` (krok PR z checklistą świadomie
odrzuconych findingów), `ce-simplify-code` (przepisanie promptu `code-simplicity-reviewer` na trzy rubryki
bez metryki LOC), kotwice pewności 25/50/75/100 zamiast samego severity.

**Odrzucone świadomie:** `ce-sweep` (brak zewnętrznych źródeł feedbacku), `ce-pov`, `ce-promote`,
`ce-proof`, `ce-riffrec`, `ce-setup`, `ce-test-xcode`, phase-loaded kernels i limit 8 KB na SKILL.md
(dotyczy hostów, które tną prompt — Claude Code nie tnie). Do obserwacji: `ce-worktree`, `ce-prototype`,
cross-model verify.

---

## Plan wdrożenia

### Tura 1 — poprawki jednodniowe (wszystkie wysiłek S)

1. Filtr blokera środowiska + zaostrzenie regexu (§1.1)
2. Zapis stanu przed STOP-em blokera (§1.2)
3. Tester E2E tylko przy policzonych checkboxach (§2.3)
4. `dev-plan`: `type: Explore` → `subagent_type` w pięciu miejscach (§4.5)
5. Ujednolicenie markera blokerów operatora (§4.1)
6. `dev-docs-update`: `git add .` → jawne ścieżki (§6.4)
7. Pojedynczy sceptyk P2 nie zmienia severity (kod przeczy własnemu komentarzowi)
8. Legacy skill `/dev-autopilot` — usunąć lub oznaczyć (§6.3)
9. Hook `tsc`: bramka na zmienione pliki (§6.2)
10. README: poprawić zdania o detekcji blokera „w findingach E2E", teście 12 przypadków (nie istnieje)
    i „8 reviewerów na każdą fazę" (routing bywa węższy)

### Tura 2 — koszt i jakość (wysiłek M)

11. Commit artefaktów w `stopRun` (§1.3)
12. Dossier fazy dla reviewerów, testera i sceptyków (§2.1)
13. Sceptycy P2 batchowani per plik + tiery effort (§2.2)
14. Decyzja o P3: naprawiać z otwartych plików albo nie generować (§3.1)
15. Diff-check po fixie (§3.2)
16. Parametryzacja toru E2E przez `.env.e2e` (§6.1)

### Tura 3 — nowe zdolności

17. `/pr-feedback` — domknięcie toru PR (§7.1)
18. Harness ewaluacyjny na odwróconych commitach fix (§6.6, §7.2)
19. Review planu przed autopilotem (§7.3)
20. Konsolidacja reviewerów + oś correctness (§2.5)

---

## Czego nie ruszać

Te elementy dowody pokazują jako działające:

- **Sterowanie w JS zamiast w prompcie.** Bramki, limity i kolejność faz w workflowach są tym, co
  odróżnia ten pipeline od „poproś model, żeby zrobił review". Wszystkie znalezione błędy to błędy
  *w* tej logice, nie argument przeciw niej.
- **Dedup dwuprzebiegowy.** Ścina 44 % findingów przed kosztownym verify.
- **Bramka E2E z `.env.e2e` i guard tożsamości bazy.** Zatrzymała realne runy przed pracą na złej bazie.
- **Compound.** `docs/solutions/` i `learned-patterns.md` w `oferty-online` zawierają reguły, które
  faktycznie opisują nietrywialne pułapki tego projektu — to nie jest wypełniacz.
- **Smoke operatora i archiwizacja** — dają operatorowi listę do odklikania, która wyłapuje rzeczy
  niewidoczne dla automatu.
