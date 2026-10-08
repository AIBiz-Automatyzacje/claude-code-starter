# KARTA-ODCZYTU — co i kiedy sprawdzić w telemetrii pierwszego nowego projektu po poprawie

**Data:** 2026-10-08 (P16). **Źródło progów:** PLAN-POPRAWY §3 „Progi do odczytu” P1–P15, HANDOFF 6a pkt 76 (g) i 77 (g), mapa walidacji
v2 (`dane/d5b-mapa-walidacji.txt`). Progi to materiał do odczytu, nie bramki wdrożenia (PLAN §1): przekroczenie = przegląd
i decyzja operatora, nie automatyczne cofnięcie.

## 0. Wniosek

Trzy odczyty, każdy po swoim horyzoncie (konwencja mapy walidacji):

| odczyt | kiedy | czym | co rozstrzyga |
|---|---|---|---|
| **A. konfiguracja** | po **pierwszej fazie** (pierwszy run autopilota) | `smoke_odczyt.py <wf_id>` + raport §2, §5 | czy maszyneria działa jak w smoke'ach: start agentów, reguły kodu, STOP-y |
| **B. koszt i tury** | po **5 fazach** | raport §1–§3, §6 + pola faz | koszt etapów, sceptycy, bramki, wiedza, dev-plan |
| **C. jakość** | po **5 PR** (5 pull requestów z uwagami bota) | raport §4 (uwagi bota) + rekordy `run.pr` | progi odwrotu per oś; jedyne źródło miary jakości |

5 faz ≠ 5 PR: zadanie ma średnio ~3,7 fazy, więc B przychodzi zwykle po drugim zadaniu, C po piątym.

## 1. Komendy

**Raport telemetrii** (z katalogu szablonu; `--wyj` poza repozytoria, żeby drzewo projektu zostało czyste — brudne drzewo zatrzymuje
bootstrap autopilota):

```bash
cd ~/Documents/Kodowanie/workspace-template && node .claude/scripts/telemetria/raport.mjs --od <data pierwszego runu> --do <dziś> --projekt <nazwa katalogu projektu> --wyj ~/Documents/Kodowanie/telemetria-odczyty
```

`--projekt` = nazwa katalogu projektu (pole `projekt` rekordów). Raport najpierw skanuje transkrypty (żaden run nie ginie), potem liczy
sekcje: 1 koszt per etap, 2 `ctx_start` per klasa i model, 3 efort, 4 jakość (findingi per oś, uwagi bota), 5 niezawodność i STOP per
kategoria, 6 skille sesji głównej (dev-plan, dev-pr), 7 anomalie.

**Odczyt jednego runu** (odczyt A; porównanie z referencją R-P15):

```bash
cd ~/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/skrypty && python3 smoke_odczyt.py <wf_id runu> --ref wf_3be2589b-ce3
```

Sekcje: 1 run, 2 fazy (gate, review, fix, koszt etapów), 2b kontrola fixa, 2c sceptycy, 2f wiedza, 2i reguły kodu (kryterium P12),
4 model/efort, 5 `ctx_start` per klasa. Sekcje 2e/2i czytają kopię smoke'a — dla prawdziwego projektu część wierszy będzie pusta.

**Pola faz i runów spoza raportu** (bramki, sceptyk, wiedza, E2E, ogrodnik — ostatnia wersja każdego rekordu):

```bash
node -e 'const P=process.argv[1],o=new Map();for(const l of require("fs").readFileSync(require("os").homedir()+"/.claude/telemetry/pipeline.jsonl","utf8").split("\n")){if(!l)continue;const r=JSON.parse(l);if(r.projekt===P&&(r.typ==="faza"||r.typ==="run"))o.set(r.klucz,r)}for(const r of o.values())console.log(r.typ==="faza"?JSON.stringify({run:r.run,faza:r.faza,bramki:Object.fromEntries(Object.entries(r.bramki||{}).map(([k,v])=>[k,v.status+"/"+v.sekundy+"s"])),sceptyk:r.sceptyk,wiedza:r.wiedza,e2e:r.e2e,review_rundy:r.review_rundy}):JSON.stringify({run:r.run,zadanie:r.zadanie,status:r.status,stop:r.stop_kategoria,manual:r.manual_razem,ogrod:r.ogrod&&{status:r.ogrod.status,ocena:r.ogrod.ocena,propozycje:r.ogrod.propozycje},pr:r.pr&&{numer:r.pr.numer,tura:r.pr.tura,pliki:r.pr.pliki,p1:r.pr.p1,p2:r.pr.p2,rekomendacja:r.pr.rekomendacja}}))' <nazwa katalogu projektu>
```

## 2. Punkty odniesienia

- **Referencja R-P15** `wf_3be2589b-ce3` (fixture smoke'a, 2 fazy, ogrodnik): 2,43 M, 38 agentów, gate CZYSTE; `ctx_start` p50: builder
  24k, naprawiacz 30k, orkiestracyjny opus 20k, reviewer 22k, sceptyk 20k, tester E2E 33k, mechaniczny haiku 7k. Fixture jest mały —
  koszt i `ctx_start` prawdziwych faz będą wyższe (większy plan, dossier, wycinek wiedzy); porównuj kształt, nie liczby bezwzględne.
- **Model haiku zmienił się w trakcie serii:** od R-P14 alias `haiku` trafia na Claude Haiku 5.5 (wcześniej 4.5): tokenizer liczy ten
  sam tekst ~30% więcej, a efort domyślny to `medium`. Cele `ctx_start` w nagłówku sekcji 2 raportu (mechaniczny ~9–10k) liczono na
  Haiku 4.5 — dla klas haiku porównuj z R-P15, nie z celem. Raport §3 opisuje brak efortu jako „model bez efortu, np. haiku” — na
  Haiku 5.5 brak = efort domyślny `medium`.
- **Tło jakości** (epoka wrześniowa oferty-online, PR 13–19): 3,5 B P1/P2 bota na 100 plików PR; sierpień 9,3; pliki fixa 14,0 vs reszta
  4,7 na 100 plików (≈3×). Progi „względem B0” liczysz względem pierwszych 5 PR nowego projektu, wrzesień jest tłem (PLAN §1).
- **Próg odwrotu per oś** (mapa v2): w oknie 5 PR liczba B P1/P2 osi ≥ max(3, 2 × oczekiwana), oczekiwana = stopa bazowa na 100 plików ×
  pliki w oknie / 100. Przy ~570 plikach w oknie (wrzesień): correctness 14, test 12, security 10, spec 4, perf 3, grupa obsługi błędów 3.
  Klasa pojedynczego defektu to diagnoza, nie cofnięcie.

## 3. Odczyt A — po pierwszej fazie

| paczka | co sprawdzić | gdzie | przekroczone → |
|---|---|---|---|
| P1 | lista skilli sesji bez usuniętych (−9 pozycji); 0 odwołań do usuniętych plików | `/sync-template` w projekcie, lista skilli nowej sesji | brak progu odwrotu — popraw sync |
| P2 | STOP „brak narzędzia” w środku runu = 0 | raport §5 (STOP per kategoria), `smoke_odczyt` §1 | doctor nie łapie narzędzia → dopisz do doctora |
| P3 | `ctx_start` klasy blisko R-P15 (skala, nie liczba); `workflow()` uruchamia dzieci; operator ma komendę | raport §2, `smoke_odczyt` §5 | cel nieosiągnięty → popraw plik klasy; dziecko nie startuje → opisy bez flagi |
| P4 | `faza.wiedza.claude_md_zn` stałe w runie; STOP środowiska w środku runu = 0 | pola faz (wiedza), raport §5 | rośnie poza krokiem po merge'u → szukaj kroku, który dopisuje CLAUDE.md |
| P12 + P16 | reguły kodu: `kod_bez_regul` i `podwojny_odczyt` puste u builderów i fixa; każdy builder z blokiem wycinka | `smoke_odczyt` §2i | fix bez reguł mimo polecenia w klasie naprawiacza (P16) → reguły wklejane do promptu fixa |
| P14 | STOP E2E w trakcie runu = 0 (cel 0); STOP na starcie tylko z naprawą | raport §5, `run.stop_kategoria`, `faza.e2e` | > 0 → przegląd kategorii SKIP |
| P15 | `run.ogrod.status` = ok, koszt pomiaru ~0,01 M, sekcja „## Ogród” w podsumowaniu zadania | pola runu (ogrod), archiwum zadania | pomiar nie powstał → log runu „UWAGA: ogrod” |

## 4. Odczyt B — po 5 fazach

| paczka | próg | gdzie | przekroczone → |
|---|---|---|---|
| P3 | koszt klasy > +30% bez spadku B P1/P2 osi | raport §1, CSV ról | efort klasy poziom niżej |
| P3 | spadek findingów osi > 30% | raport §4 (findingi per oś) | przywrócić narzędzia osi |
| P6 | bramka > 300 s albo fałszywe STOP-y | pola faz (`bramki.*` status/sekundy) | reguła do `warn` |
| P6 | p50 Strykera > 300 s w 5 fazach | pola faz (`bramki.stryker`) | Stryker raz na zadanie przed dev-pr (D5) |
| P7 | findingi per oś −30% w tym samym typie kodu | raport §4 | wraca agent packager |
| P7 | Bash reviewerów p50 > 23 bez spadku findingów | CSV ról / rekordy agentów (`narzedzia`) | dodać mandat (D3) |
| P8 | koszt kontroli fixa > 0,46 M na commit | raport §1 (etap fix), `smoke_odczyt` §2b | skrócić listy K |
| P9 | obalenia < 5% albo degradacje > 35% (tło: 8,8 sceptyka/fazę, obalenia 10,9%, degradacje 23%) | pola faz (`sceptyk`) | P2 wraca do grupy po pliku |
| P10, P12 | `ctx_start` buildera +10% bez spadku P1/P2 na fazę | raport §2, §4 | skrócić wycinek wiedzy |
| P10 | wpisy indeksu na zadanie, propozycje bramek, odsetek wdrożonych | pola faz (`wiedza`), wynik compoundu w podsumowaniu zadania | brak progu — trend do decyzji |
| P11 | zero findingów z mutantem w 5 fazach | raport review fazy (sekcja mutantów), dossier | poprawić ułożenie wejścia test-coverage |
| P13 | mediana epizodu dev-plan > 2,95 M albo bramka gotowości odrzuca > 1 z 5 planów | raport §6 (dev-plan), log `plan.mjs gotowosc` | generowanie zadań jako osobny krok |
| P15 | oceny ogrodnika ~25% zadań (symulacja); koszt pomiaru 0,01 M | pola runu (`ogrod`) | — (odczyt) |

## 5. Odczyt C — po 5 PR

| paczka | próg (okno 5 PR) | gdzie | przekroczone → |
|---|---|---|---|
| P5 | B P1/P2 bota na 100 plików vs pierwsze PR projektu (tło 3,5); tury na PR ≤ 3; `run.pr.rekomendacja` w każdej turze | raport §4 (uwagi bota), pola runu (`pr`) | kalibracja niezgodna z 1b → poprawić schemat `pr:zbierz` |
| P3, P11 | B P1/P2 osi ≥ próg odwrotu (§2) | raport §4 + klasy uwag w `run.pr` | efort osi poziom wyżej; correctness → dzisiejsze polecenie; spadek potwierdzonych P1/P2 → minimalna forma usuniętej reguły / brzmienie roli |
| P11 | B P1/P2 osi spec ≥ 4 z klasą w plikach faz, w których spec pominięto | raport §4 + `run.pr` | spec w każdej fazie |
| P11 | B P1/P2 osi test ≥ 12 | raport §4 + `run.pr` | wyłączyć listę i `medium` u test-coverage |
| P6 | B P1/P2 osi correctness i code-quality ≥ próg | jw. | przegląd reguł bramek |
| P6, P12 | walidacja końcowa znajduje błąd typów/testów przy PASS bramek w ≥ 2 z 5 zadań | pola runu (`walidacja`) + pola faz (`bramki`) | builder wraca do pełnego zestawu testów (D7) |
| P8 | B P1/P2 w plikach fixa / reszta ≥ tło (≈3×) | `run.pr` (pliki uwag) vs commity `fix(` | dzisiejsza kontrola + analiza |
| P8 | stosunek rośnie albo B P3 → P1/P2 | jw. | P3 wraca do fixa |
| P8 | ≥ 3 B P1/P2 w plikach dodanych przez fix | jw. | D12 cz. 2 (nowa IU dla findingu z nowym plikiem) |
| P9 | kill rate > 50% i ≥ 3 B P1/P2 w miejscach obalonych | `smoke_odczyt` §2c + `run.pr` | P1 z uzasadnieniem autora |
| P12 | klasa ze zdaniem u buildera nadal ≥ 3 B P1/P2 (tylko projekty z małą liczbą reguł) | `run.pr` (klasy) + blok wycinka w promptach | lista u reviewera albo reguła lint |
| P13 | ≥ 2 B P1/P2 klasy „API / wersja biblioteki niezgodne z dokumentacją” w zadaniach bez researchu | `run.pr` (klasy) + plan zadania | research obowiązkowy w dev-plan |
| P14 | uwagi bota / Sentry w funkcjach nietkniętych planem | `run.pr` + mapa funkcji skilla weryfikacji | wraca przejście regresyjne (odłożone) |
| P15 | kilka zadań bez przyjętej propozycji ogrodnika | sekcja „## Ogród” w podsumowaniach zadań | wyłączyć ogrodnika (revert 944aefe) |

## 6. Kolejność odczytów (mapa walidacji)

Ustawienia i koszt czytasz równolegle; rozłączne osie równolegle; zmiany przekrojowe (pętla fix, sceptycy, wiedza) mają okno 5 PR dla
siebie — gdy dwie przekrojowe przekroczą próg w tym samym oknie, cofasz jedną i czytasz następne okno. Każda decyzja z odczytu idzie
jako punkt HANDOFF 6a z liczbą, która ją uzasadniła.
