# Etap 1b — rozstrzygnięcie: uwagi CodeRabbita z GitHuba (574) i skill dev-pr

**Data:** 2026-09-20. **Rozstrzyga:** sesja główna (Fable 5.1) na wynikach 6 agentów Opus, run `wf_daf2b119-3c4`.
**Źródła:** `dane/coderabbit/bot-comments.jsonl` (574 uwagi inline z 20 PR-ów oferty-online, pobrane `gh api`), `dane/coderabbit/klasyfikacja-574.csv`
(każda uwaga z koszykiem, klasą, severity, etapem), `dane/workflow-C-etap1b-wyniki.json` (pełne wyniki), `dane/etap1-spory/12-synteza-uwag-bota.txt`,
`dane/etap1-spory/11-dev-pr.txt`.

## 1. Bilans 574 uwag bota

| koszyk | liczba | po korekcie | co to jest |
|---|---|---|---|
| A — szum konfiguracyjny bota | 157 | 162 | progi rozmiaru, styl, `as const`, rzutowania w testach, nitpicki; do wyłączenia w `.coderabbit.yaml` |
| B — do uniknięcia przez nasz pipeline | 200 | 195 | realne defekty z właścicielem-etapem; 5 uwag „test kruchy" przenoszę z B do A (higiena, nie defekt) |
| C — realna luka bez właściciela | 28 | 28 | zostaje botowi |
| D — odpowiedzi w wątkach, podsumowania | 189 | ~189 | niepewne: klasyfikator PR 1–8 zaliczył do D 9% linii, pozostali 40–50%; nie wpływa na A/B/C |

**Dwa wnioski nadrzędne:**

1. **Konfiguracja bota jest naprawialna w 85%.** Osiem zmian w `.coderabbit.yaml` usuwa ~133 z 157 uwag A, nie ruszając ani jednej uwagi B (§2).
2. **Pipeline nie ma problemu z naprawianiem, ma problem ze znajdowaniem.** Zero uwag B przypisano do fixa i sceptyków; 98% findingów jest
   naprawianych. 195 uwag B to defekty, których nasze review nie zgłosiło. Prawie wszystkie mają właściciela i regułę. Lekiem są polecenia-listy
   w promptach właścicieli (§3), nie nowe reguły ani agenci. Potwierdza to §3 ETAP1-ROZSTRZYGNIECIE na 2,5× większej próbie.

## 2. Konfiguracja bota — 8 zmian w `.coderabbit.yaml` oferty-online (koszyk A)

| zmiana | uwag mniej | dowód |
|---|---|---|
| usunąć „pliki > 300 / funkcje > 50 linii" z path_instructions `**/*.{ts,tsx}` (linie 66–67); próg przenieść do ESLint max-lines z tolerancją | 80 | 24 / 22 / 34 uwag w trzech oknach PR — klasa ROŚNIE mimo napraw pipeline'u |
| jeśli próg zostaje: 360 / 60 linii (tolerancja 20%) | 14 | przekroczenia o <20%, np. use-consent.ts 305 vs 300; bot sam wycofał większość po kontrze operatora |
| powtórzyć wyjątek testowy w bloku głównym: instrukcje per glob SUMUJĄ się, nie nadpisują — wyjątek „progi nie dotyczą `*.test.ts`" (linie 69–79) nie działa | ~12 | template-assets.test.ts 1185 linii zgłoszony mimo wyjątku |
| to samo dla `**/texts.ts` (linie 81–88) | 3 | texts.ts 515 linii zgłoszony, potem wycofany |
| dopisać „`as const` i `satisfies` nie są type assertion" (linia 65) | ~20 | bot sam wycofał tezę po kontrze; `database.types.ts` jest w path_filters, a i tak dostał uwagę → filtr do sprawdzenia |
| rzutowania w atrapach i fixture'ach testowych poza uwagą | 17 | `as unknown as Session`, `as never` w `*.test.ts` |
| „jeden eksport per plik" zawęzić do komponentów-ekranów; kolekcje (ikony, kafle, typy propsów) wyjątkiem (linia 96) | 8 | nav-icons.tsx zgłoszony w PR 1 i ponownie 9 PR-ów później |
| `tone_instructions`: nie zgłaszać układu Arrange-Act-Assert, docstringów, DRY w testach | ~8 | preferencje bota bez wpływu na wykrywalność regresji |

Pozostałe ~24 A to klasy jednorazowe i 8 tez, które bot sam wycofał — konfiguracja ich nie zatrzyma. **Osobno:** seedy `e2e/seeds/*.sql` nie mają
path_instructions (instrukcja dla `scripts/**/*.ts` ich nie obejmuje) — dopisać jako granicę zaufania (uwaga P1: strażnik seeda nie potwierdza
pochodzenia konta przed `delete from auth.users`).

## 3. Mapa luk pipeline'u (koszyk B, 195 uwag) — kto powinien złapać i jak

| etap | B | główne klasy | ruch (polecenie-lista w prompcie, wynik do raportu także gdy pusty) | szac. domknięcie |
|---|---|---|---|---|
| **correctness** | 77 | ścieżka błędu bez obsługi 12, cykl życia React 11, parser regexem 9, bramka na jednej z dwóch dróg 8, wyścigi 6, granica wartości w migracji 4 (3× P1) | (1) każda operacja zmieniająca stan + WSZYSTKIE drogi do niej + bramka na każdej; (2) każdy `await` w ścieżce zapisu: co widzi użytkownik przy odrzuceniu, co zostaje rozjechane; (3) każda wartość czytana przed `await` i użyta po nim; sygnał stopu = numer generacji; (4) jeśli diff rusza migrację: długość każdego generowanego literału vs constraint | 33–38 |
| **test-coverage** | 44→39 | test niefalsyfikowalny 31, luka pokrycia 6, strażnik negatywny 2 | kryterium falsyfikowalności jako kolumna raportu („jaka zmiana implementacji sprawi, że test padnie"); (1) każda atrapa: które argumenty sprawdza, żaden = finding; (2) każda asercja przechodząca dla pustej/undefined/obu gałęzi; (3) `grep z.object(` w testach ładunku → strictObject | 31 |
| **security** | 38 | bramka czarną listą 13, PII/sekret w message/Sentry 10, walidacja koperty 7, dokument sterujący 1 (P1) | (1) każda bramka w diffie: co blokuje / gałąź domyślna / 3 ładunki, które ta gałąź przepuszcza; (2) `grep 'Error(.*\.message\|captureException\|new .*Error('` + co wyląduje w Sentry, redakcja rekurencyjna; (3) Zod na całej kopercie, strictObject; (4) diff w CLAUDE.md/.claude/README z poleceniami powłoki: co wyląduje w transkrypcie | 23–30 |
| **spec-compliance** | 15 | tekst UI obiecuje czynność, której kod nie robi 12 | (1) każdy literał tekstowy w diffie + linia kodu, która go realizuje; (2) dokument prawny vs kolumny migracji w tym samym diffie + data obowiązywania; (3) `grep -nE '\bTy\b|\bTwoj'` vs docs/design.md | 11–12 |
| **code-quality** | 12 | pusty catch 2, martwa gałąź 1, duplikacja 3, kontrakt shared 3 | ESLint `no-empty`, `no-unreachable`, `no-unused-vars` + knip w domknięciu; wynik lintera jako WEJŚCIE do promptu („przy każdym trafieniu: defekt czy świadoma decyzja"); grep powtórzonych regexów/stałych między plikami fazy | 8 (5 bez agenta) |
| **performance** | 8 | brak timeoutu 4 | do correctness jako 5. polecenie: każde wywołanie sieciowe/klienta bazy + limit czasu; grep `fetch(\|.from(\|.rpc(\|auth.` jako bramka. Potwierdza ZASTĄP z etapu 1 | 5–6 |
| **e2e** | 4 | seed niezgodny z kontraktem 3 | każdy seed w diffie: kolumny wstawiane vs wymagane przez migrację; DEFAULT i wartości nieosiągalne w produkcji = finding | 3 |
| **domknięcie fazy / kontrola diffu fixa** | 2 | pusty catch bez lintera; poprawka w JUŻ WYPCHNIĘTEJ migracji (P1) | ESLint jak wyżej; **bramka niezmienności migracji**: `git diff --name-only base..HEAD -- supabase/migrations/` ∩ pliki obecne w base ≠ ∅ → STOP „popraw nową migracją"; ta sama bramka w kontroli diffu naprawczego | 2 (na zawsze) |
| **planner (dev-plan/docs)** | 0 przypisanych, ale źródło 80 A + 5 B | próg rozmiaru; ta sama stała w 2–4 miejscach | (1) **budżet pliku w IU**: bieżąca długość + decyzja „zostaje / dzieli się" PRZED pisaniem; kryterium = liczba powodów do zmiany, nie linie (app.ts: konfiguracja + limiter + host-guard + trasy → dzielić; texts.ts 5300 linii jednej odpowiedzialności → nie); (2) **rejestr stałych**: IU wprowadzające liczbę/literał istniejący w repo wskazuje jedno źródło i konsumentów | 80 A + 5 B |
| **builder** | 0 przypisanych, ale przez niego przechodzi 100% B | powtórki tej samej klasy u tego samego buildera (parser regexem 4× w PR4, 3× w PR9; ścieżka błędu 5× w PR3, 7× w PR9–10) | **dossier klas ucieczek** w prompcie buildera: tabela 8–10 klas z jednym zdaniem „co robić zamiast", regenerowana z compoundów | ~20 |
| **fix + sceptycy** | 0 | — | nic nie dokładać; jedyny etap działający zgodnie z założeniem. Powtórka po STOP-ie E2E = sam tester | 0 |

**Razem szacowane domknięcie: ~120–135 z 195 uwag B (60–70%) przy zerze nowych agentów.** Reszta to klasy wymagające całego repo lub
uruchomienia (28 C + część B).

**Rozstrzygnięcia niespójności klasyfikatorów:** (a) migracje i granice wartości w SQL → zakres correctness (B), stąd polecenie (4); (b) seedy →
właściciel e2e dla kontraktu, security dla strażników; (c) pusty catch → domknięcie (lint), nie reviewer; (d) „test kruchy" → A; (e) potrzebny
**słownik klas** (jedna nazwa na klasę), bo trzej klasyfikatorzy użyli 3 nazw na parser regexem, 2 na ścieżkę błędu itd. — bez słownika następny
pomiar będzie nieporównywalny.

**Trend uwag B na 100 zmienionych plików:** PR 1–8: 12,8 → PR 9–13: 11,2 → PR 14–20: 5,2. Spadek NIE jest dowodem skuteczności napraw pipeline'u:
oferty-online nie ma napraw N1–N9, a dwie najliczniejsze klasy (próg rozmiaru 80, test niefalsyfikowalny 31) są płaskie przez cały okres.
Spadek wynika ze zmiany charakteru pracy (panel, teksty zamiast walidacji HTML i migracji). Pomiar rozstrzygający: PR z warstwy walidacji/migracji
po wdrożeniu poleceń-list, porównany z PR 2, 4, 9.

## 4. dev-pr — rozstrzygnięcie sporu

**Werdykt: PRZEBUDUJ, ale wąsko** (analityk: przebuduj 8 zmian; sceptyk: werdykt się broni, lista do połowy). Dev-pr to 0,74% kosztu pipeline'u,
3,5–6 M jednostek na epizod — nie jest celem oszczędności. Cel: jakość decyzji operatora.

**Odpowiedzi na pytania operatora:**

1. **Czy naprawia to, co powinien?** W turze 1 tak: pokrycie odpowiedziami na wątki bota skoczyło z 0–11% (PR 1–7, ręcznie) do 100% (PR 10–15, 19).
   Ale **tury 2 i 3 omijają etap klasyfikacji**: w agents.csv są 3 agenty `zbierz` (wszystkie tura 1) i 7 agentów `napraw` (tury 1–3). Uwagi rundy 2
   bota na PR 14 (10:58) dostały odpowiedź z agenta `napraw:tura-3` (11:38) bez rubryki, bez `wpływNaProjekt` i bez jedynego twardego guarda w kodzie.
   Ponadto guard (dev-pr-wf.js:278) uznaje za „cytat ze źródła decyzji" dowolny backtick, więc odrzucenie z fragmentem kodu przechodzi jako uzasadnione.
   Realnych podtrzymań zarzutu przez bota po naszej odpowiedzi jest 9–10 (~5%), nie 21 jak twierdził analityk.
2. **Dlaczego nie ma raportu per tura?** Workflow jest bezstanowy, licznik tur trzyma rozmowa, schemat naprawy zwraca same ID wątków GraphQL,
   a szablon raportu (SKILL.md:149) prosi o cztery liczby. Dane do tabeli plik:linia | zarzut | decyzja | uzasadnienie już istnieją w `watki[]` z etapu
   zbierz — brakuje złączenia po id w szablonie. Nie potrzeba nowego agenta ani pliku na dysku: GitHub jest trwalszym nośnikiem (każdy wątek ma
   plik:linię, naszą odpowiedź i commit), a commit raportu po każdej turze przy `auto_incremental_review: true` wywołałby kolejną recenzję bota.
3. **Dlaczego nie ma „merguj / nie merguj"?** Bramka zwraca listę faktów („mergeStateStatus = BEHIND"), a JS nie rozróżnia warunku naprawialnego
   kolejną turą (wątki `napraw` > 0) od wymagającego człowieka (wątki do operatora, CI, konflikt). Żaden epizod nie doszedł do autonomicznego merge'a
   (0 agentów `pr:merge:`) — każdy kończył się decyzją operatora bez werdyktu.
4. **Ile tur?** Rozkład uwag per runda bota: 17,1 / 2,1 / 2,3 / 1,5 / 2,0 (325 / 31 / 16 / 9 / 4). Po turze 1 krzywa spada z klifu i stoi płasko na ~2,
   nie zbiega do zera. ALE rundy 3+ mają 69% uwag Major wobec 40% w rundzie 1 — późne uwagi są rzadsze i cięższe. Dlatego: **sufit 3 tur, domyślnie
   tryb interaktywny zostaje** (gołe `/dev-pr` = operator wybiera), bez sztywnego „2". Warunek wcześniejszego wyjścia po czystej turze już istnieje
   (SKILL.md:38, wf:303–306).

**Zmiany do wdrożenia (4, zero nowych agentów):**

1. `zbierz` obowiązkowy w KAŻDEJ turze; etap `napraw` odrzuca wątki, które nie przeszły przez `zbierz` w tej samej turze (token tury zwracany przez zbierz, sprawdzany w JS, wf:296).
2. Regex guarda wf:278: usunąć alternatywę z backtickiem, wymagać nazwy dokumentu (CLAUDE.md / docs/plans/ / docs/CONCEPTS.md) + min. 20 znaków uzasadnienia.
3. Pole `rekomendacja` liczone w JS po wf:399: MERGUJ / NIE MERGUJ — <warunek> / KOLEJNA TURA / DECYZJA OPERATORA — jako pierwszy wiersz raportu; w prompcie `zbierz` jedno zdanie: „przeczytaj ostatni komentarz bota w wątku; gdy podtrzymuje zarzut, nie klasyfikuj jako `odrzuc`".
4. Raport: szablon SKILL.md:149 → tabela per tura złączona po id z `watki[]`; `propozycjeDoReviewerow` zapisywane do `docs/reviews/propozycje-do-reviewerow.md` i commitowane w compoundzie (wf:443–444) — dziś zero artefaktów w repo mimo 19 działających compoundów.

**Odrzucone:** nowa klasa `bot-podtrzymuje` (dubluje ścieżkę `isResolved:false` → zbierz po naprawie 1), przebudowa schematu na obiekty (złączenie
po id wystarczy), etap `raport` z plikiem na dysku (karmi pętlę recenzji, koszt 0,6–0,7 M), domyślne 2 tury (kasuje tryb interaktywny; severity
późnych rund temu przeczy), „warunek wcześniejszego wyjścia" (istnieje).

**Aktualizacja CLAUDE.md na końcu brancha** (uzupełnienie operatora nr 1): wchodzi do dev-pr dopiero PO tych 4 zmianach, jako krok w etapie compound,
z bramką rozmiaru liczoną w JS.

## 5. Co idzie dalej

- **Do researchu (etap 2):** mutation testing / falsyfikowalność testów jako narzędzie (Stryker) vs prompt; ESLint flat config + knip + size-limit
  jako standardowa bramka domknięcia; „review nie zbiega" u innych; kontekst subagentów (`tools:`, `omitClaudeMd`, `paths:` — do potwierdzenia
  runem); coding-rules 2026 od zera.
- **Do krytyka (etap 3):** słownik klas; brak pomiaru „dossier zastępuje czytanie"; brak PR-a porównawczego po wdrożeniu poleceń-list.
- **Do panelu (etap 4), twarde wejścia z 1b:** polecenia-listy per oś (§3), budżet pliku i rejestr stałych w plannerze, dossier klas ucieczek u buildera,
  bramka niezmienności migracji, 8 zmian w `.coderabbit.yaml`, 4 zmiany w dev-pr, seedy z właścicielem.
