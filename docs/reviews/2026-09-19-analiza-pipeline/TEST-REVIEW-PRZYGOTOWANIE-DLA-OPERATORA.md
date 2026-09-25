# Test review — przygotowanie pilota (dla operatora)

**Data:** 2026-09-25. **Stan:** przygotowanie ZROBIONE, pilot NIEURUCHOMIONY — czekam na Twoją zgodę. Zero agentów i zero sesji headless w tej sesji.
Oferty-online i `.claude`/CLAUDE.md szablonu bez zmian (dowód: `dane/test-review/stan-przed.txt` = `stan-po.txt`).

## Co masz do przejrzenia

Najważniejsze są trzy pliki. **Prompty A/B/C** dla każdej kopii pilota leżą w `dane/test-review/prompty-<etykieta>.txt` — najlepiej zacząć od
`prompty-f-b26128d.txt` (faza 2 zadania trackingu, najmniejsza). Bloki z pełnym kodem oferty-online w dossier projektu C są tam skrócone do liczby
znaków, pełne wersje leżą poza repo w `~/test-review/prompty/`. **Prompty wariantu 0**, czyli dzisiejszego pipeline'u, są w
`dane/test-review/prompty-wariant0.txt`. Wyrenderowałem je z dzisiejszych funkcji bez modeli, więc mapa zmian packagera ma tam znaczniki `<…>`.
**Mapowanie warunków** z katalogów na sygnały diffu jest w `dane/test-review-warunki.json`. Z niego wynika, które listy trafiają do którego
reviewera w danej fazie. Przejrzyj zwłaszcza pozycje oznaczone „nierozstrzygalny”. Zgodnie z planem są zawsze aktywne (fail-open).

## Co zrobiłem

**Kopie.** Problem: reviewer testu nie może zobaczyć przyszłości fazy, a kopia nie może ruszyć repo. Zrobiłem lustro oferty-online i z niego klony
ucięte na commicie „tuż przed review”, w `~/test-review/kopie/`, poza `Documents/Kodowanie`. Każda kopia ma w historii wyłącznie przodków fazy
(skrypt to sprawdza liczbą commitów). `main` wskazuje na main z epoki, a gałąź robocza to `feature/<zadanie>`, jak w prawdziwym runie. Na kopię
nałożyłem `.claude/` szablonu z HEAD. `learned-patterns.md` i CLAUDE.md zostały z epoki. Po instalacji `git status` jest pusty. Kopii jest sześć:
trzy fazy pilota (b26128d, 2634b67, f3ee433), osobna kopia na powtórkę b26128d i dwa commity fixa do modułu kontroli diffu fixa. Commity fixa to
411a434, czyli fix fazy pilota b26128d, i wrześniowy 05dd804. Co ci to da: diff widziany przez reviewerów to dokładnie diff fazy, a przecieku
przyszłości nie ma już w samym kodzie.

**Bramki uruchomione naprawdę.** Trzy konfiguracje ESLint wygenerowałem z brzmienia pozycji `bramka` katalogów A, B i C. Do tego knip, typecheck,
size-limit, Stryker diff-scoped i niezmienność migracji. Na wszystkich sześciu kopiach bramki wstają i kopia zostaje czysta. Stryker trwał
9–36 s na fazę, więc sufit 600 s z projektu B niczego w pilocie nie ucina. Znalazłem i naprawiłem jedną rzecz ważną dla całego testu: typowany ESLint
puszczony przed buildem `packages/shared` widział importy wspólnego pakietu jako `any`. W świeżej kopii dawał przez to dziesiątki fałszywych
trafień (faza f3ee433: 65 zamiast 4). Teraz build idzie przed ESLint, a powtórka tej samej fazy daje identyczny wynik jak oryginał.
Nieuruchomione, z powodem zapisanym w danych: `vitest --typecheck` (w kodzie historycznym nie ma plików `*.test-d.ts`), `migrations.sum` (plik
powstaje dopiero przy wdrożeniu bramki) i advisors (wymagają projektu Supabase w stanie historycznym).

**Wariant 0 z kontrolą bajtową.** To prawdziwy `dev-docs-review-wf.js` ucięty przed weryfikacją. Generator porównuje go ze źródłem. Różni się
w 27 liniach i każda jest dozwolona: meta, jedna linia wyłączająca testera E2E i dopięty zwrot wyniku. 18 z 18 wycinków jest bajt w bajt
(bloki, schematy, prompty, routing, dedup, limit P3). Ta sama kontrola objęła kontrolę diffu fixa z autopilota (5/5) i krok weryfikacji do
sceptyków (12/12). Testera wyłączam stałą, a nie usunięciem thunka. Skutek jest ten sam, a w ten sposób nie rozjeżdżają się indeksy etykiet
i nie odpala się retry testera.

**Warianty A/B/C.** Każdy prompt składa się ze wspólnego szkieletu (zadanie, N1, „pliki tylko czytasz”, format wyniku), mandatu soczewki,
przykładów warstwy stałej oraz list, wiedzy i mandatów danej roli dosłownie z katalogu. Aktywne są tylko pozycje, których warunek pasuje do fazy.
Model i efort biorę z projektu: A correctness/security high, test i spec medium, code-quality low i dedup haiku. B ma wszystko na medium, trzy
próbki correctness z inną kolejnością plików i listami od C-01, C-05 i C-09, security ×3 przy warstwie danych i agregator haiku z progiem k ≥ 2.
C to reviewer kodu na high z czterema blokami soczewek plus reviewer testów na medium, łączenie w JS. Suchy bieg z atrapą agenta (bez modeli)
przeszedł przez wszystkie skrypty.

**Sędzia i sceptycy.** Klucze są gotowe: 13, 7 i 6 pozycji dla trzech faz, wymieszane i z neutralnymi id. Pulę findingów skrypt złoży po
wariantach, bez nazw wariantów. Przy przeglądzie klucza 2 wykluczyłem jedną pozycję (f3ee433 #4). To duplikat wiersza podsumowania, czyli ten
artefakt parsera, który plan przewidywał. Sceptyków generuję osobno dla każdego wariantu według jego projektu.

## Na co zwrócić uwagę przed zgodą

1. **Koszt pilota** (`dane/test-review/koszt-pilota.txt`): środek 93 M jedn., górna granica 149 M, **twardy limit 224 M**. Skrypt przerywa po
   fazie, która przekroczy limit. Plan podawał około 78 M środka. Różnica wynika z trzech rzeczy, które plan przewidział (§5.2, §6), ale
   których nie wliczył: drugiej permutacji sędziego, sceptyków także na kluczu 2 oraz dziesięciu sesji uruchamiających na fazę. Dla skali: jeden
   run autopilota z 20.09 to 35 M jedn. Każda sesja ma dodatkowo bezpiecznik `--max-budget-usd` równy dwukrotności górnej granicy jej kroku.
2. **Efort wariantu 0 = high.** Proszę o potwierdzenie (6a pkt 29 c). Sesja headless ustawia go flagą `--effort high`.
3. **Najpierw próba harnessu** (`test_review_uruchom.sh proba`, około 0,3 M). Nie wiem na pewno dwóch rzeczy. Pierwsza: czy `claude -p` czeka na
   koniec Workflow, który startuje w tle. Druga: czy reguły deny z `--settings` działają (w trybie `-p` błędny plik ustawień jest cicho
   ignorowany). Próba to dwie krótkie sesje: workflow bez agentów i odczyt pliku z `Documents`, który ma zostać odrzucony. Pilot rusza dopiero po
   dobrym wyniku próby.
4. **Szczelność sesji.** Każda sesja startuje z katalogu kopii, bez serwerów MCP i z wyłączonymi hookami (jednakowo dla wszystkich wariantów).
   Ma około 40 reguł deny: Documents, transkrypty, lustro, inne kopie i ich dossier, wyniki i mapowania sędziego, zapis plików, sieć i `gh`.
   Rozstrzyga i tak skan transkryptów po każdym kroku. Skaner sprawdziłem na prawdziwym runie panelu i poprawnie oznacza odczyt oferty-online.
5. **Przybliżenia, które przyjąłem** (wszystkie opisane w skryptach i jednakowe dla wariantów):
   - wycinek wiedzy to wpisy learned-patterns z epoki dobrane po nazwie katalogu i pliku fazy, bo format z globami jeszcze nie istnieje; w dwóch
     z trzech faz pilota wycinek wyszedł pusty;
   - konfigurację knip (punkty wejścia) napisałem sam;
   - size-limit ma stałe progi z pomiaru 3;
   - Stryker idzie raz na aplikację; A bierze z wyniku trzy pliki z największym diffem, a B dostaje wynik tylko wtedy, gdy bieg zmieścił się
     w 600 s;
   - polecenia z list kontroli fixa, które uruchamiają nieistniejące dziś skrypty (`gates:faza`, G-19), zastąpiłem wynikiem bramek
     uruchomionych przez skrypt;
   - blok MANDAT w A i C to dosłowne pole `soczewka` z projektu, więc miejscami zawiera opis projektanta („listy doklejane przez JS”), a nie
     polecenie; tak brzmi katalog i tego nie poprawiałem.
6. **Pliki robocze poza repo.** Na dysku jest `~/test-review` (1,7 GB: lustro, kopie z `node_modules`, narzędzia). Są też trzy katalogi
   `/tmp/tr-f-*`, które zostały po pierwszej wersji generatora dossier. Sesje mają zakaz ich czytania. Po Twojej zgodzie usunę je razem
   z `~/test-review/robocze`.

## Co dalej

Po Twojej zgodzie: próba harnessu, potem pilot jednym poleceniem `skrypty/test_review_uruchom.sh pilot` puszczonym w tle. Przebieg idzie fazami:
kopia i bramki, cztery warianty naraz, sędzia ×2, sceptycy, skan i koszt po każdej fazie. Potem kalibracja sędziego (czytam 20 decyzji)
i notatka `TEST-REVIEW-PILOT-DLA-OPERATORA.md` z kosztem zmierzonym, zgodnością sędziego, szczelnością i stabilnością. Na koniec Twoja decyzja
o zakresie etapu głównego (rekomendacja 75%).
