# Analiza etapu 5 vibersi (autopilot 6 faz, smoke, PR #8–#10) — 2026-10-26

Wejście: HANDOFF 6a pkt 95–99, telemetria, archiwum `vibersi/docs/completed/etap-5-interakcje-i-profil/`, PR #8–#10 (gh),
transkrypty sesji vibersi, feedback z ostatniej sesji vibersi. Nic nie wdrożone; lista poprawek na końcu (E5-1…E5-22) do planu
P27 + P29.

## Wnioski (najpierw)

1. **Run autopilota przeszedł bez STOP, ale na starym szablonie: P23 i P25 go nie objęły.** Sync w vibersi `015b61c`
   (19.10 17:30) zaciągnął stan `54d9fbd`, a P23 weszła do main szablonu 1,5 h później (`bcedb56`, 18:56); P25 powstała
   po runie (merge 21.10). W runie działały P22 i reguły recenzentów z pkt 94a. P25 zadziałała dopiero w smoke'u (sonda
   `E2E_HEALTH_TRESC` złapała `/healthz` poza proxy) — i retrospektywnie `plan.mjs blokery` zatrzymałby run przed fazą 3,
   czyli przed 7 scenariuszami zrzuconymi na `[Manual]`.
2. **Koszt +55% (84,7 M vs 54,6 M), prawie cały z liczby IU i rozmiaru faz, nie z rozrzutu.** Builder p50 bez zmian
   (1,33 vs 1,36 M), ale 24 IU zamiast 14 → execute 43,4 M (+23,6 M). Reviewerzy +64% (19,0 vs 11,6 M), bo diff fazy jest
   1,6× większy (średnio 323k vs 204k zn) i nie było P23. Fix stabilny (11,2 vs 12,4 M).
3. **Bot: 7 uwag P1/P2 na 577 plików trzech PR (1,2 na 100; etap 4: 3 na 338 = 0,9) — raport telemetrii podaje 2,7 vs 1,5,
   bo dzieli przez największą część zamiast sumy (E5-16). Połowę uwag pipeline już znał albo sam wyprodukował.**
   Z 13 wątków bota (PR #9: 9, PR #10: 4) i 2 uwag poza diffem: 8 to jedna klasa seedów e2e, która rozlewała się po kolejnych
   plikach przez 4 rundy; 2 były w review fazy jako P3 i leżały w known-issues (limit ciała 8 kB, kursor powiadomień); 2 urodziły
   się w commicie fixa fazy 5 (+852 linii, oglądanym tylko listami K-1…K-7); reszta to następstwo poprawki (surogaty),
   duplikacja i PATCH z migawki. Wszystkie klasy bota miały już regułę u recenzentów
   (`ma_regule: true` 7/7) — brakuje nie reguł, tylko trafienia i wagi.
4. **Dwa realne braki procesu PR:** poprawka bezpieczeństwa (Turnstile) wypadła z PR, bo część 3 przekroczyła limit 150 plików
   bota — nikt nie przeliczył rozmiaru po commitach ze smoke'u; a wątek bota „Major” z PR #9 odłożony „do cz. 3” został
   otwarty na zmergowanym PR, bo nic go nie przeniosło.
5. **P22 działa:** pytanie przed PR, `/clear` między częściami (sesje PR 2,3 M łącznie vs 4,49 M jednej sesji w etapie 4),
   krótkie review commitów po archiwum (znalazło P2 Turnstile), fix bez odczytu PNG, `--projekt vibersi` w telemetrii.

**Co robimy:** do planu P27 + P29 dochodzi 14 pozycji (koniec raportu); najważniejsze to E5-2 (P3 z realnym scenariuszem →
przed PR), E5-3 (kod fixa pod listy correctness), E5-5/E5-6 (wątki i rozmiar części w `/dev-pr`), E5-7 (klucz testowy tylko
lokalnie). **Co Ci to da:** mniej tur bota (cel: PR bez rund „szerzej”), żadna poprawka bezpieczeństwa nie zostaje poza main,
reviewerzy tańsi o ~1/3 po P23.

## 1. Telemetria (`raport.mjs --od 2026-10-20 --do 2026-10-26 --projekt vibersi`)

Skan: `zbierz.mjs --skan` → `runow: 600, sesji: 2663, dopisanych: 0, bledow: 0`. Raporty:
`docs/reviews/telemetria/raport-2026-10-20_2026-10-26-vibersi{.txt,-role.csv}`, porównanie
`raport-2026-10-17_2026-10-19-vibersi*` (etap 4, `--bez-skanu`). Runy: `skrypty/e5_runy.py`.

| | etap 4 | etap 5 |
|---|---|---|
| razem | 54,6 M | 84,7 M |
| execute | 19,8 M (14 builderów) | 43,4 M (24 buildery) |
| review | 11,6 M | 19,0 M |
| fix | 16,7 M (fix 12,4 + poprawka 2,75) | 13,8 M (fix 11,2 + poprawka 1,0) |
| sceptycy | 1,8 M | 1,4 M |
| dev-pr (runy) | 1,83 M / 16 | 3,49 M / 25 |
| P1 / P2 / P3 review | 5 / 77 / 51 | 0 / 90 / 63 |
| bot P1/P2 na 100 plików (suma plików PR) | 0,9 (3/338) | 1,2 (7/577); raport.mjs: 1,5 i 2,7 (mianownik = największa część, E5-16) |
| niezawodność | autopilot OK, dev-pr 1 STOP | autopilot OK, dev-pr 1 STOP (czystość) |

- **Per rola (p50 agenta):** build 1360k → 1325k; correctness 392k → 727k; test-coverage 354k → 595k; code-quality 296k → 496k;
  security 215k → 405k; spec 187k → 400k. Wzrost reviewerów zgodny z rozmiarem diffu faz:
  `git diff --shortstat <baza N> <baza N+1> -- . ':!docs/active'` → etap 4: 176–226k zn, etap 5: 216–400k zn (fazy 1, 3, 4
  powyżej 350k).
- **Anomalie:** 5 builderów 2,7–3,3 M (IU-23, IU-3, IU-10, IU-11, IU-14) — po ~100 tur i kontekst do ~300k
  (transkrypty `wf_e17cca34-115`); PNG nie jest przyczyną (IU-3 i IU-4 bez PNG kosztują tyle samo).
- **Findingi per oś:** test-coverage P2 61 z 107 P2 (57%; etap 4: 45). Sceptyk: obalone 0 z 92 weryfikowanych (etap 4: 0 z 81)
  — `skrypty/e5_stan.py` na `.autopilot-state.json`.
- **ctx_start** w normie (builder 27k, naprawiacz 31k, reviewer 16k, sceptyk 14k).
- **Sesje główne** (`skrypty/e5_sesje.py`): dev-plan `f7366375` 2,93 M (+agenci = 7,2 M, etap 4: 2,96 M; 24 IU);
  autopilot+smoke+sync `c2bba459` 6,75 M (ctx do 478k); smoke z przeprojektowaniem powiadomień `d0e2b514` 8,35 M (ctx do 485k);
  makieta `63665ff7` 2,86 M; PR: 0,41 / 0,82 / 1,07 M. Raport przypisuje 6,6 M do `sync-template`, bo epizod skilla trwa do
  następnego skilla — to smoke, nie sync.

## 2. Autopilot etapu 5 — czy wdrożone paczki działały

Run `wf_e17cca34-115`: start 20.10 07:28, 10,1 h, 163 agentów, OK, 6 faz (plan miał 5 — faza 1 podzielona po analizie planu),
archiwum `9cb5741`.

| Paczka | W runie? | Dowód | Wynik |
|---|---|---|---|
| P22 A3 zrzuty | tak | `ls vibersi/*.png` — brak; 32 PNG w archiwum | działa |
| P22 B1 pytanie przed PR | tak | sesja `64f31598` 07:21 `AskUserQuestion` „Wysłać PR … część 3?” | działa |
| P22 B2 `/clear` między częściami | tak | 3 sesje PR: 0,41 / 0,82 / 1,07 M | działa |
| P22 B4 commity po archiwum | tak | „20 commitów ze smoke'u (11 z kodem, 52 pliki)” → krótkie review → P2 Turnstile + 3×P3 | działa; P3 bez śladu (E5-9) |
| P22 C1 rejestr z IU-źródło | tak | plan `:146` | działa |
| P22 D2 fix bez PNG | tak | Read `.png` w transkryptach fixa: 0 (build 33, review:e2e 19 — zgodnie z rolą) | działa |
| P22 F1 `--projekt` | tak | 26 runów vibersi w raporcie | działa |
| P23 diff bez `docs/active/**` | **nie** | `git show 0c94f2a:.claude/scripts/dossier/zmiany.mjs` — wyklucza tylko stan autopilota | brak efektu (E5-1) |
| P25 blokery per faza | **nie** (po runie) | retrospektywnie `plan.mjs blokery docs/completed/etap-5-… --projekt .` → `faza 3, linia 110` | zatrzymałby przed fazą 3 |
| P25 `E2E_HEALTH_TRESC` | w smoke'u | pkt 97(1): STOP startu na fallbacku SPA → `c018f4d` proxy `/healthz` | działa |
| P25 uwagi rozmiaru faz / warstwy | nie (plan 20.10) | plan po poprawkach ma fazy ≤ 5 IU; `sprawdz` dziś: `uwagi: []` | bez danych |

E2E w runie: 17 checkboxów, PASS 10, SKIP→`[Manual]` 7 (fazy 3, 4, 6) — przyczyna opisana w pkt 96 (Vite bez serwera), naprawiona
P25 i odegrana w smoke'u (7/7).

## 3. PR #8–#10

| PR | pliki GitHub | do recenzji bota | wątki bota | tury | wynik |
|---|---|---|---|---|---|
| #8 fazy 1–2 | 176 (51 `.claude/` z syncu P22) | 61 | 0 | 0 | merge |
| #9 fazy 3–4 | 141 | 130 (+7/+7/+4 przyrostowo) | 9 (6 seedy, 2 limit ciała, 1 duplikacja) + 2 uwagi poza diffem (seedy) | 3 + 1 wątek po sufitcie | merge, 1 wątek otwarty |
| #10 fazy 5–6 | 260 (61 PNG, 28 `.claude/` z syncu P25) | 148 (po wyjęciu Turnstile; z nim 152 → recenzja pominięta) | 4 + 1 powtórka | 2 | merge |

Komendy: `gh pr diff N --name-only` + klasyfikacja ścieżek; `gh api …/pulls/N/reviews` („Files selected for processing”);
`gh api graphql … reviewThreads` (stan wątków); klasy z rekordów `pr` w `pipeline.jsonl`.

**Klasy i skąd się wzięły (PR #9 i #10, 13 wątków):**

| Wątek | Klasa | Czy pipeline mógł złapać |
|---|---|---|
| `server/komentarze.ts:25` limit ciała 8 kB | wartosc-graniczna | **złapał** — review fazy 4 P3 `server/komentarze.ts:25` (ta sama liczba, ta sama poprawka), w known-issues |
| `server/komentarze.ts:29` surogaty 12 B | wartosc-graniczna | następstwo poprawki z tury 1 |
| `use-powiadomienia.ts:139/177` kursor po przegrupowaniu | spojnosc-dwoch-systemow | **złapał** — review fazy 5 P3 `use-powiadomienia.ts:37` („strona 2 pokazuje go drugi raz”), known-issues |
| `komentarze-projektu.tsx:111` kotwica „obsłużona” przy błędzie | sciezka-bledu | kod z fixa fazy 5 (`5901dc3`, `useRef przewinieta`) — poza osiami review |
| `watek-komentarza.tsx:101` rozwinięcie wątku | cykl-zycia-ui | kod z fixa fazy 5 (`5901dc3`, `useRozwiniecieWatku`) — poza osiami review |
| `profil.ts:199` PATCH z migawką zgód | wyscig-i-wspolbieznosc | review fazy 5/6 nie zgłosiło; kod z fazy 5 i smoke'u (`842f718`) |
| `okno-zaloz-konto.tsx:41` kopia zamykania okna | duplikacja | P3 code-quality, trywialny |
| 8 × `e2e/seeds/*` (5 plików, 4 rundy) | seed-e2e | review faz 3–4: 0 findingów o seedach, choć seedy były w diffie |

**Dlaczego tyle plików do poprawy (przyczyny):**
1. **Seedy rozlewały się rundami.** Tura 1: `\getenv` nadpisuje `-v` (2 seedy) → „szerzej” na bliźniaki → bot recenzuje
   przyrostowo nowo dotknięte pliki, w tym seedy z etapu 4 (`etap-4-moderacja-seed`, `moje-projekty-seed`) → tura 2: upsert bez
   kontroli właściciela → tura 3: `DELETE … slug LIKE 'prefiks-%'` szerszy niż lista kontrolowanych slugów (3 seedy, P2 Major)
   → po sufitcie: reset głosów prawdziwych kont (`moje-projekty-seed.sql:182`). Każde poszerzenie wpuszczało do recenzji pliki,
   których bot wcześniej nie oglądał, a naprawa szła po jednym zarzucie, nie po całej regule „seed dotyka tylko swoich wierszy”.
   Reguła seeda u recenzenta (`security-sentinel.md:41`) sprawdza, czy strażnik istnieje, nie czy operacja niszcząca ma ten sam
   zakres co strażnik.
2. **P3 z realnym scenariuszem użytkownika odkładane do known-issues.** Reguła wagi (`correctness-reviewer.md:32`: P3 tylko „gdy
   ścieżka wymaga mało prawdopodobnego zbiegu warunków”) nie była przestrzegana — duplikat na liście po „Oznacz jako przeczytane”
   i 413 na poprawnym komentarzu to zwykłe ścieżki. Sceptyk tylko obniża wagę (degradacje), nigdy nie podnosi.
3. **Kod fixa omija osie review.** Fix fazy 5 dopisał +852 linii (kotwice, przewijanie, rozwijanie — de facto brakująca
   funkcja z findingu SPEC). Kontrola fixa (`dev-autopilot-wf.js` `kontrolaFixaPrompt`, K-3) ma 3 listy correctness: drogi do
   zapisu, odrzucenie `await`, wartość sprzed `await` — nie ma efektów, jednorazowych znaczników ani stanu wyliczanego.
4. **Część 3 rozdęta przez smoke.** Tabela części przy archiwum: część 3 = 122 pliki do recenzji; po smoke'u (20 commitów,
   w tym przeprojektowanie powiadomień `842f718`: 41 plików) — 149; poprawka P2 z krótkiego review dołożyła 4 → 152 → bot
   pominął recenzję. `dev-pr-wf.js:586` tylko loguje UWAGĘ z liczby z tabeli, nie przelicza zakresu przed pushem.

**Co dopisał compound:** 8 wpisów `docs/solutions/` (`07a3795`, `9180398`), 6 propozycji do recenzentów
(`vibersi/docs/reviews/propozycje-do-reviewerow.md`: correctness ×5, security ×1), 2 propozycje bramek `[kod]` (unia stanu
efektu, PATCH tylko ze zmienionych pól). Ocena: propozycje trafne merytorycznie, ale correctness ma już 16 pozycji list
(`correctness-reviewer.md:16-31`) i 7/7 klas bota miało regułę — dopisanie 5 kolejnych linii nie celuje w przyczynę (trafienie
i waga). Zalecenie: wpiąć je w istniejące pozycje (E5-12), nie jako nowe.

## 4. Feedback sesji vibersi — problem → przyczyna w szablonie → poprawka

1. **Poprawka Turnstile poza main.** Przyczyna (a): `dev-pr-wf.js:586` + `skills/dev-pr/SKILL.md:54-75` — rozmiar części liczony
   przy archiwum, commity po archiwum (smoke + poprawki z krótkiego review) wchodzą do ostatniej części bez ponownego pomiaru;
   bot pomija PR > 150. (b) Sama dziura powstała w smoke'u (`0dd8f3b` „testowy sekret bez sprawdzenia akcji”, 21.10), po naszej
   analizie pkt 97(3), która opisała poprawkę bez warunku środowiska — reguła P27(3) mówi tylko o atrapie, nie o tym, gdzie klucz
   testowy wolno przyjąć. Poprawka: E5-6 i E5-7. W vibersi: osobny PR z `b954014` (Twoja decyzja, propozycja sesji jest dobra).
2. **Trzy P3 z krótkiego review nienaprawione.** Przyczyna: `skills/dev-pr/SKILL.md:71-75` — „Bez P1/P2 → etap start”, P3 nie
   mają nośnika poza raportem. Poprawka E5-9: P3 do `docs/completed/<zadanie>/known-issues.md` (commit artefaktu).
3. **Dwa testy padają poza PR.** `start-e2e.test.mjs:278` — smoke dopisał `/healthz` do proxy (`c018f4d`), test `deepEqual` mapy
   proxy nie został uruchomiony: walidacja `/dev-pr` i autopilota bierze tylko skrypt `test` (`dev-pr-wf.js:20-26`
   `BLOK_KOMEND_PROJEKTU`, kopia w autopilocie), a vibersi ma też `test:scripts`. `e2e/serwer-smoke.sh` (CSP `img-src`) — runnery
   shell biegają tylko w fazie, która ma je w linii `[E2E]`; commita, który zepsuł asercję, nie ustalałem. Poprawka E5-8.
4. **CLAUDE.md: `TURNSTILE_SECRET_KEY` jako opcjonalna.** Przyczyna: etap `claude-md` (`dev-pr-wf.js:939-963`) opisuje zmienne
   z listy, bez warunku z walidatora konfiguracji (`server/konfiguracja.ts:141`). Poprawka E5-10 (niski priorytet).
5. **Propozycje bramek `[kod]` i reviewerów** — decyzja Twoja; rekomendacja w E5-12.

## Lista poprawek do planu P27 + P29

Kolejność wg wpływu. Każda pozycja w planie dostanie test padający bez poprawki.

| # | Problem | Przyczyna (plik:linia) | Poprawka | Co da |
|---|---|---|---|---|
| E5-1 | Run bez P23 (sync przed merge'em) | brak sprawdzenia wersji szablonu przed planem/autopilotem | `plan.mjs gotowosc` pozycja „szablon”: `.claude/.template-version` vs czubek main szablonu (`git ls-remote`) → uwaga „szablon nowszy o N commitów” | paczki działają w runie, na który były robione |
| E5-2 | P3 z realnym scenariuszem wraca od bota jako P2 | `correctness-reviewer.md:32` nieprzestrzegane; P3 → known-issues bez przeglądu przed PR | (a) w `correctness-reviewer.md:32` przykład: zły widoczny wynik na zwykłej ścieżce = P2; (b) `/dev-pr` krok 1: P3 osi correctness/security z known-issues dla plików części → pytanie „naprawić przed PR (N)” | −2 wątki bota/etap, mniej tur |
| E5-3 | Bugi urodzone w fixie | `dev-autopilot-wf.js` `kontrolaFixaPrompt` K-3: tylko L-COR-1…3 | K-3 + lista efektów/znaczników (z `correctness-reviewer.md:21`) i ścieżki błędu, gdy fix dodaje hook, efekt albo nową funkcję; próg rozmiaru fixa do zmierzenia na etapach 3–5 | 2/4 P2 PR #10 złapane przed PR |
| E5-4 | Seedy w 4 rundach bota | `security-sentinel.md:41` (strażnik istnieje, nie zakres); `dev-pr-wf` „napraw-szerzej” poprawia zarzut, nie regułę | (a) `:41` dopisek: filtr każdej operacji niszczącej = lista ze strażnika, zmienna z otoczenia nie nadpisuje jawnego `-v`; (b) naprawa „szerzej” przechodzi pełną regułę klasy (z compoundu) na każdym bliźniaku przed pushem | PR #9: 1 tura zamiast 3+1 |
| E5-5 | Wątek „do cz. 3” zgubiony (`moje-projekty-seed.sql:182`, Major, otwarty na PR #9) | `skills/dev-pr/SKILL.md:42-43` — po sufitcie brak nośnika | otwarte wątki po sufitcie / odłożone → known-issues zadania z linkiem; `/dev-pr --czesc N+1` krok 1 pokazuje otwarte wątki poprzednich części (gh graphql `isResolved:false`) | nic nie znika między częściami |
| E5-6 | Część 3 > 150 plików bota po smoke'u | `dev-pr-wf.js:586` (tylko log z tabeli), skill krok 1 | przed `start` pomiar plików do recenzji zakresu części (filtry `.coderabbit.yaml`, jak `pr/rozmiar.mjs`); ≥ 150 → pytanie: commity po archiwum osobnym PR / dodatkowa część | poprawka bezpieczeństwa nie wypada z PR |
| E5-7 | Klucz testowy dostawcy przyjmowany w produkcji | P27(3) (`coding-rules.md:34`, `test-coverage-reviewer.md`) mówi tylko o atrapie | do P27(3): kod przyjmujący klucz testowy działa tylko w konfiguracji lokalnej/e2e (warunek z trybu albo `SITE_URL`), test odmowy w konfiguracji produkcyjnej; `security-sentinel`: klucz testowy bez warunku środowiska = P1 | brak dziury jak `0dd8f3b` |
| E5-8 | `test:scripts` i runnery shell poza walidacją | `dev-pr-wf.js:20-26` `BLOK_KOMEND_PROJEKTU` (+ kopia w autopilocie) | walidacja = `test` + każdy `test:*` z `package.json` (bez `e2e` w nazwie); do rozważenia: walidacja końcowa autopilota odpala runnery shell z linii `[E2E]` wszystkich faz | zmiany ze smoke'u nie psują testów po cichu |
| E5-9 | P3 z krótkiego review tylko w opisie PR | `skills/dev-pr/SKILL.md:71-75` | P3 → `known-issues.md` zadania | ślad do etapu 6 |
| E5-10 | CLAUDE.md: zmienna wymagana warunkowo jako opcjonalna | `dev-pr-wf.js:939-963` | polecenie `claude-md`: wymagalność zmiennych z walidatora konfiguracji, z warunkiem trybu | dokładny CLAUDE.md |
| E5-11 | STOP czystości `/dev-pr` na `docs/operator/zrzuty-zgloszenie/` | zrzuty zgłoszeń narzędzia makiet nie mają miejsca | do P29(1): zrzuty w `visual-diff/zgloszenia/` katalogu zadania + commit artefaktu | brak STOP na starcie PR |
| E5-12 | 6 propozycji do recenzentów | `correctness-reviewer.md:16-31` ma 16 pozycji; 7/7 klas bota z regułą | wpiąć w istniejące pozycje: ścieżka błędu i cykl życia → `:21`, kursor → `:25`, bodyLimit → `:24`, PATCH z migawki → `:17`, seed → `security-sentinel.md:41` (E5-4); 0 nowych linii | reguły bez rozrostu listy |
| E5-13 | Smoke z dużą zmianą funkcji w sesji 300–480k | `dev-docs-complete` smoke bez progu zmiany | gdy smoke zmienia funkcję (> ~10 plików kodu): `/clear` + osobne mini-zadanie (plan → faza autopilota) zamiast w sesji smoke'u | 8,35 M sesji → koszt fazy; zmiana przechodzi review osi |
| E5-14 | Builder ~100 tur / 300k kontekstu (5 IU) | rozmiar IU w planie bez progu | najpierw pomiar: tury builderów vs liczba plików/linii IU (etapy 3–5); próg w `dev-plan` 3.3 dopiero przy korelacji | — (pomiar) |
| E5-15 | Wiedza projektu ucinana limitem wycinka | `wiedza/wycinek.mjs:11` `MAKS_WYCINEK_ZN = 2000` (~4 reguły po 300–465 zn); kolejność `wpisy.mjs:42` przy równej wadze i ucieczkach = alfabet nazwy klasy (`cykl-zycia-ui` przed `sciezka-bledu`); baza 28 wpisów, 4 reguły `sciezka-bledu` osobno | (a) kolejność: dopasowanie najwęższym globem i liczba ucieczek do bota przed alfabetem; (b) linia wycinka = klasa + zdanie skrócone (pole `regula_krotka`, ≤ 160 zn), pełna reguła linkiem; (c) limit ~5000 zn (+~1 tys. tokenów na start buildera, < 0,1 M na etap); (d) `/dev-compound-refresh` scala reguły jednej klasy w jedną; (e) klasa z ≥ 3 ucieczkami → propozycja bramki mechanicznej (lint/ast-grep/test) zamiast kolejnej linii; test na etapie 5: IU-10/14/19/23 dostają `sciezka-bledu` i `cykl-zycia-ui` | wiedza dociera tam, gdzie bot później znajduje błędy |
| E5-16 | Telemetria: jakość bota zawyżona przy PR w częściach | `telemetria/raport-sekcje.mjs:93` `Math.max` plików części | suma plików do recenzji wszystkich części (z „Files selected for processing” albo filtrów `.coderabbit.yaml`) | porównywalna miara jakości między etapami |
| E5-17 | Telemetria: pełny skan nadpisuje stare rekordy stanem z dnia skanu | `run.szablon` (marker z `.template-version` w chwili skanu: run 12.10 ma marker P25 z 21.10), `instrukcje_stale` (`zrodla.mjs:148`, plik roli czytany przy skanie) | pola wersji zamrożone przy pierwszym rekordzie runu (nie nadpisywać przy ponownym skanie) albo liczone z gita na czas końca runu | wiadomo, która wersja szablonu się wykonała (sprawdzian E5-1) |
| E5-18 | Telemetria: `narzedzia_n` puste u wszystkich 200 agentów etapu 5 | `transkrypt.mjs:164-170` czyta załączniki `deferred_tools_*`, których transkrypty już nie mają | odczyt z nowego formatu albo usunięcie pola z raportu | raport bez martwej kolumny |
| E5-19 | Telemetria: koszt epizodu skilla do następnego skilla | `sync-template` 6,6 M w etapie 5 to w większości smoke | koniec epizodu na `/clear` i na kolejnym poleceniu operatora spoza skilla; osobna pozycja „sesja główna bez skilla” | koszt smoke'u widoczny osobno |
| E5-20 | Telemetria: brak sekcji „ucieczki” | pochodzenie wątku bota liczone w tej analizie ręcznie | sekcja raportu: wątek bota → był w review fazy (P3/known-issues) / plik z commitu fixa / plik ze smoke'u / nowy | główna miara skuteczności architektury liczona skryptem |
| E5-21 | Sceptyk P2: 0 obaleń z 173 (etapy 4–5; etapy 1–3: 1 z 163), jedyny skutek to obniżenia P2 → P3 (które trafiają do known-issues — dziura E5-2) | nie wiemy, czy reviewerzy przestali się mylić, czy sceptyk przytakuje | najpierw test kanarkowy: do partii weryfikacji 3–5 podłożonych fałszywych findingów (teza sprzeczna z kodem, z plik:linia); sceptyk obala kanarki → zostaje, 0 obaleń jest prawdą; przytakuje → wymiana promptu albo przeniesienie budżetu na E5-3 | decyzja na danych, nie na przeczuciu |
| E5-22 | Z PR #12 vibersi (`efdbc33`): test wyścigu nie odtwarzał trwającego pobrania; atrapa sprawdzana tylko liczbą wywołań | `vitest/prefer-called-with` nie obejmuje `toHaveBeenCalledTimes`; test-coverage bez punktu o kolejności obietnic w teście wyścigu | (a) reguła ESLint w konfiguracji szablonu: `toHaveBeenCalledTimes` bez `toHaveBeenCalledWith` tej samej atrapy; (b) propozycja do `test-coverage-reviewer` wpięta w istniejący punkt o testach niefalsyfikowalnych (jak E5-12), bez nowej linii | test wyścigu, który naprawdę pada bez poprawki |

Obserwacje bez poprawki teraz: P3 z pkt 96 (M9, M10, M14, M15, M22, wykrywanie serwera `api/`) — zostają w planie P27 jak ustalono.

## Decyzje operatora (2026-10-26, po raporcie)

- **E5-15 (wiedza) — wchodzi do paczki.**
- **E5-1 i E5-13 (granice procesu) — odrzucone:** sync przed merge'em paczki i duża zmiana funkcji w smoke'u uznane za wyjątek.
- **E5-16…E5-20 (telemetria) — wchodzą do paczki.** E5-20 dostaje pierwowzór: `skrypty/ucieczki_bota.py` (niżej).
- E5-21 — test kanarkowy sceptyka: zaakceptowany.
- E5-2, E5-3, E5-4 — zaakceptowane po wyjaśnieniu. E5-3 obejmuje też: finding SPEC „brak zachowania” powyżej progu rozmiaru fixa idzie jak budowa (review następnej fazy albo operator), nie przez fix. E5-4: „szerzej” = lista kontrolna całej reguły klasy, wszystkie pliki klasy w repo (nie tylko z PR), odpowiedź w wątku wymienia sprawdzone pliki.
- E5-2 nie zmienia decyzji P8 (fix tylko P1/P2): P3 dalej bez automatycznej naprawy; zmiana to kalibracja wagi i pytanie przed PR.
- E5-3 nie przywraca re-review po fixie (odrzucone 2026-09-20: review nie zbiega); to dwie listy więcej w tej samej jednej kontroli fixa.

## Ucieczki do bota — skrypt i wynik dla etapów 3–5

`python3 skrypty/ucieczki_bota.py --repo ../vibersi --zadanie <zadanie> --pr <N,M>` (w katalogu analizy) — dla każdego wątku
bota: `git blame` linii na commicie, który bot skomentował (fix fazy / tura PR / smoke / build / sprzed zadania) i kandydat
„był w review fazy” (finding w ±10 liniach, tylko gdy kod istniał w czasie review). Wynik i ręczna weryfikacja kandydatów:
`dane/e5-ucieczki-etapy-3-5.txt`.

| Etap | Wątki | P1/P2 | P1/P2 znane z review jako P3 (potwierdzone) | z kodu fixa | z tur PR | ze smoke'u |
|---|---|---|---|---|---|---|
| 3 | 3 | 3 | 1 (`akcje-auth.ts`) | 0 | 0 | 0 |
| 4 | 6 | 3 | 1 — bot dał **P1** (`migracja :196`, review-faza-1 P3 `:193`) | 0 | 0 | 2 (P3) |
| 5 | 13 | 7 | 1 (`use-powiadomienia.ts`, dopasowane ręcznie) | 2 | 3 (kaskada seedów) | 0 |

Wniosek: w każdym etapie co najmniej jeden P1/P2 bota leżał w review fazy jako P3 — E5-2 ma dane z trzech etapów, nie z jednego.
Skrypt myli się w dwie strony: 2 fałszywe kandydaty (inny defekt w sąsiedniej linii) i 1 przeoczony (linia przesunięta
w smoke'u); dlatego kandydat ma znak „?” i podpowiedź „ten plik w review” do ręcznego sprawdzenia. W E5-20 dopasowanie dostanie
klasę findingu z review (dziś review nie zapisuje klasy) zamiast samej odległości linii.
