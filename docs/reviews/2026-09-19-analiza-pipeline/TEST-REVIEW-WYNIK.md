# TEST-REVIEW-WYNIK — wynik prawdziwego testu review (dziś vs A vs B vs C, etap główny 50%)

**Data:** 2026-09-27. **Status:** ZAAKCEPTOWANY 2026-09-27 (HANDOFF 6a pkt 32): obecna architektura review zostaje + trzy dodatki (kontrola diffu fixa wg A,
bramki lint/knip, lista mutantów dla reviewera testów) + obniżanie kosztu po jednym pokrętle z pomiarem; A/B/C nie idą dalej jako osobne projekty
(rekomendacja §12 zawężona: „A + soczewka wydajności” nie jest osobnym kandydatem, tylko źródłem pokręteł optymalizacji). Zero agentów, zero sesji headless, zero zmian
w `.claude/`, CLAUDE.md i oferty-online (kopie, lustro i transkrypty tylko czytane). **Wersja dla operatora:** `TEST-REVIEW-WYNIK-DLA-OPERATORA.md`.
**Podstawa:** HANDOFF 6a pkt 29–31, §7, §8 „STAN PRZYGOTOWANIA ETAPU GŁÓWNEGO” / „ETAP GŁÓWNY ZROBIONY”; TEST-REVIEW-PLAN §5.2–§5.3, §6, §8–§11;
TEST-REVIEW-PILOT-DLA-OPERATORA; TEST-REVIEW-ETAP-DLA-OPERATORA.
**Liczby — wyłącznie skryptem:** `skrypty/test_review_analiza.py probka|wynik` (moduły `_kalibracja`, `_mechanizmy`, `_tekst`) →
`dane/test-review/wynik.txt` (§1–§8 poniżej odsyłają do jego sekcji) i `wynik-{zlapania,roznice,przekroje,bramki-weryfikacja,szum,koszt,klucz2-straty,kalibracja}.json`.
Wejście pisane w sesji głównej po lekturze: `wynik-kalibracja-oceny.json` (20 ocen), `wynik-klucz2-opisy.json` (30 zdań). Wynik deterministyczny
(ziarno próbki `etap-kalibracja`, ziarno bootstrapu 20260927, 10 000 losowań; dwa przebiegi `wynik` dają identyczny plik).

**Definicje (jak w planie i pilocie):** jednostki = 13 faz review (`f-*`) + 24 commity fixa (`x-*`, moduł §2.6), zawsze permutacja p1; liczą się tylko klucze
z obecnością TAK; **„szeroko” = PEŁNE + CZĘŚCIOWE — miara główna** (pilot: granica PEŁNE/CZĘŚCIOWE miękka). Różnice X − 0 sparowane po kluczu;
CI 95% = bootstrap po jednostkach (losowanie faz ze zwracaniem, percentyle). Koszt = kolumna PO („po zmianie kontekstu”, `panel_koszt_model.Referencja`)
bez sesji uruchamiającej, liczony `test_review_wynik.koszt` do katalogu tymczasowego (`dane/test-review/koszt.*` nietknięte).

## 0. W skrócie

1. **Sędzia etapu wiarygodny:** 0/20 błędów (próg 15%); 3/20 decyzji na granicy CZĘŚCIOWE/BRAK (definicja dopuszcza obie).
2. **Korekta notatki etapu:** „+24 pkt dla A” z `TEST-REVIEW-ETAP-DLA-OPERATORA.md` mieszało dwa różne pomiary. Prawie cała przewaga pochodzi z **modułu
   kontroli fixa**, gdzie dzisiejsza kontrola łapie 0/30. **W fazach review** (pytanie D1) żaden wariant nie jest istotnie lepszy od dziś na kluczu 1:
   A +9,4 pkt [−1,8; +22,0], B 0,0 [−10,7; +10,7], C +3,8 [−11,1; +17,6].
3. **Strata na kluczu 2 (fazy):** A −11,1 [−25,0; 0,0], B −12,7 [−23,1; 0,0], **C −25,4 [−39,1; −13,6] — istotna**. Bilans znanych defektów P1/P2
   (klucz 1 P1/P2 + klucz 2): A −4,0 [−16,4; +7,3], B −8,1 [−18,7; +3,3], **C −16,2 [−29,1; −5,4] — istotna strata**.
4. **Koszt etapu znajdowania w fazach (PO):** dziś 2,63 M jedn./fazę, A 1,50 (−43%), B 1,92 (−27%), C 0,44 (−83%). Szum P1/P2 poza kluczem na fazę:
   dziś 7,8, A 11,0 (+41%), B 8,8, C 7,4.
5. **Kontrola diffu fixa (D12) — rozstrzygnięta:** dziś 0/30, A 15/30, B 16/30, C 15/30 (+50 do +53 pkt, dolne granice CI ≥ +30); koszt A +0,34 M na 24 commity.
6. **Mechanizmy z dowodem:** (a) lista przeżytych mutantów w projekcie C: 6/12 testów niefalsyfikowalnych (5 findingów powołuje się na mutanta)
   vs dziś 1/12 (A i B dostały tę samą listę — ich findingi się na nią nie powołują); (b) bramki lint/knip dały C 4 złapania, których nie dał żaden reviewer; (c) A/B/C gubią głównie to, co dziś łapie reviewer
   **performance** (A: 4 z 11 strat) i **security** (C: 7 z 19) — A nie ma soczewki wydajności.
7. **Wniosek dla D1:** test odrzuca C jako jedyny reviewer faz (istotna strata) i nie daje B żadnej przewagi; A jest nieodróżnialny od dziś w jakości
   (±12 pkt), tańszy w znajdowaniu, głośniejszy. Rekomendacja do run 3 — §12.

## 1. Problem → przyczyna → co zrobiłem → co to daje

**Problem.** Etap główny dał surowe odsetki (notatka etapu), bez kalibracji sędziego, bez CI i bez rozdzielenia faz review od kontroli fixa. Na takich
liczbach nie da się wybrać architektury review (D1) ani ocenić, czy strata na dzisiejszych trafieniach boli.
**Przyczyna.** Metryki `test_review_wynik.py metryki --etap` sumowały wszystkie jednostki razem, a w kluczu 1 fazy fixa (30 kluczy, dziś 0/30) i fazy review
(53 klucze) to dwa różne mechanizmy: kontrola wąskiego diffu fixa vs review całej fazy.
**Co zrobiłem.** Skrypt analizy: kalibracja sędziego na próbce z nowych jednostek; różnice sparowane z CI osobno dla faz review i fixa, osobno klucz 1
(zysk) i klucz 2 (strata) oraz ich bilans na P1/P2; przekroje; szum na fazę i na 100 linii; koszt PO na fazę i na złapaną uwagę B; lista trafień
klucza 2, które każdy wariant gubi, z reviewerem, który je dziś łapie.
**Co to daje.** Odpowiedź na D1, D2, D5 i D12 z liczbami z prawdziwego przebiegu (plan §8) i lista konkretnych dziur nowych projektów.

## 2. Dwa klucze — zysk i strata względem dziś, każdy stronniczy w inną stronę

- **Klucz 1 = zysk.** Uwagi bota (B), które historyczne review tych faz **przepuściło**. Selekcja działa **na korzyść A/B/C**: to lista porażek
  review podobnego do dzisiejszego (sierpniowe/wrześniowe prompty ≈ dzisiejsze), więc wariant 0 z definicji ma tu słabą pozycję wyjściową
  (plan §10 „selekcja klucza 1”). Dodatkowo bot też nie widzi wszystkiego — klucz 1 to nie pełna lista ucieczek.
- **Klucz 2 = strata.** Potwierdzone P1/P2 z ostatniego przebiegu historycznego review tych faz — to, co review **podobne do dzisiejszego samo znalazło**.
  Selekcja działa **na korzyść wariantu 0**: uruchomiony drugi raz na tym samym kodzie w dużej mierze odnajduje własne dawne trafienia. Wysoki wynik 0
  (84%) to głównie ta powtórka, nie przewaga jakości. Klucz 2 jest dolną granicą (tylko ostatni przebieg review fazy).
- **Pytanie, na które odpowiada para:** ile nowy wariant **zyskuje** na tym, co dziś ucieka, i ile **gubi** z tego, co dziś działa.
- **Bilans P1/P2** (pomocniczo): klucz 1 P1/P2 (36) + klucz 2 (63, wszystkie P1/P2) w fazach review = 99 znanych defektów P1/P2 tych faz. Obie stronniczości
  wchodzą naraz; proporcja 36:63 odpowiada temu, ile defektów danego rodzaju historia zostawiła, więc bilans ≈ „odsetek znanych defektów P1/P2 fazy,
  które wariant łapie”. Nadal lekko faworyzuje 0 (63 z 99 znalazł reviewer podobny do 0).

## 3. Kalibracja sędziego etapu (`wynik.txt` §1, `wynik-kalibracja*.json`)

Próbka (ziarno stałe, tylko 32 nowe jednostki, p1): 10 dopasowań z 350 (PEŁNE/CZĘŚCIOWE) + 10 par BRAK z 96 (klucz obecny + niedopasowany do niego finding
z tego samego pliku, najbliżej linii klucza). Przeczytane na kopiach (`~/test-review/kopie/*`) i w mapowaniach p1. **Wynik: 20/20 zgodnych z definicjami
promptu sędziego — 0% błędów (próg 15%), bez eskalacji.** Szara strefa CZĘŚCIOWE/BRAK: #2 (ten sam test, finding widzi luźną asercję wysokości, ale
proponuje inną naprawę), #7 (ta sama bramka nagłówka JWT i skutek, inny wektor), #16 (BRAK, choć finding wspomina wspólne wiadro limitera jako kontekst).
Ta granica dotyczy miary „szeroko”; sędzia jest ślepy na wariant, więc szara strefa nie powinna przesuwać różnic w jedną stronę. Przykład z lektury:
#1 — bramka `no-floating-promises` na linii 46 dopasowana PEŁNE do uwagi z kotwicą 67: to ten sam IIFE odczytu (46 = początek, 67 = koniec), decyzja słuszna.
Zastrzeżenie jak w pilocie: kalibrację robi ten sam model co sędzia.

Obecność kluczy: fazy — klucz 1 53 TAK / 4 NIE / 1 NIEPEWNE, klucz 2 63 TAK; fix — klucz 1 30 TAK / 1 NIE.

## 4. Wynik główny — fazy review (D1) (`wynik.txt` §2)

| miara (fazy review, szeroko) | n | 0 dziś | A | B | C |
|---|---|---|---|---|---|
| klucz 1 — zysk (złapane ucieczki) | 53 | 25 (47%) | 30 (57%) | 25 (47%) | 27 (51%) |
| różnica vs 0 [CI 95%] | | — | **+9,4** [−1,8; +22,0] | 0,0 [−10,7; +10,7] | +3,8 [−11,1; +17,6] |
| pary: łapie tylko X / tylko 0 | | — | 11 / 6 | 6 / 6 | 8 / 6 |
| klucz 2 — strata (utrzymane dzisiejsze trafienia) | 63 | 53 (84%) | 46 (73%) | 45 (71%) | 37 (59%) |
| różnica vs 0 [CI 95%] | | — | **−11,1** [−25,0; 0,0] | **−12,7** [−23,1; 0,0] | **−25,4** [−39,1; −13,6] |
| pary: łapie tylko X / tylko 0 | | — | 4 / 11 | 6 / 14 | 3 / 19 |
| bilans P1/P2 | 99 | 74 (75%) | 70 (71%) | 66 (67%) | 58 (59%) |
| różnica vs 0 [CI 95%] | | — | −4,0 [−16,4; +7,3] | −8,1 [−18,7; +3,3] | **−16,2** [−29,1; −5,4] |

PEŁNE (dla porządku): klucz 1 0 38% / A 45% / B 40% / C 45% (A +7,5 [−3,4; +19,3], C +7,5 [−5,3; +22,6]); klucz 2 0 70% / A 63% / B 62% / C 46%
(C −23,8 [−36,6; −11,1]); bilans C −13,1 [−24,2; −1,8]. Kierunek i istotność te same co „szeroko”.

**Co z tego wynika.** Na zysku żaden wariant nie przekracza szumu pomiaru (połowa szerokości CI ~±11–12 pkt przy 53 parach — zgodnie z MDD ~24 pkt
zakresu 50%). Na stracie C traci istotnie, A i B na granicy (górna granica CI = 0). Na bilansie tylko C jest istotnie gorszy od dziś.
Test **wyklucza duże zyski** w fazach review: A najwyżej +22 pkt, C +18, B +11 na kluczu 1.

**Komplementarność** (`komplementarność` w §2 `wynik.txt`): z 53 kluczy 1 nikt nie łapie 13, wszyscy 12, ktokolwiek 40; pary 0 ∪ A 36 (68%), 0 ∪ B 31,
0 ∪ C 33. Klucz 2: nikt 3, 0 ∪ X 56–59 z 63. Warianty łapią w dużej części **co innego** — ale suma dwóch przebiegów zawiera też zwykły efekt „drugiej
pary oczu” (pilot: dwa przebiegi 0 na tej samej fazie dały 8 zamiast 7–8 złapań), więc sama suma nie jest dowodem na hybrydę. Dowodem są tylko
mechanizmy z §7.

**Korekta notatki etapu.** Notatka po etapie podała klucz 1 razem z fixem (83 klucze): A +24 pkt, B +19, C +21 — to jest prawdziwe
(A +24,1 [+12,6; +38,2], B +19,3 [+7,3; +33,9], C +20,5 [+8,0; +34,9]), ale z nadwyżki złapań nad dziś moduł fixa daje A 15 z 20, B 16 z 16,
C 15 z 17 (§6). Zdanie „przewaga A nad dzisiejszym
pipeline'em leży dokładnie na tej granicy” dotyczyło sumy; dla faz review przewaga A (+9) jest poniżej granicy wykrywalności.

## 5. Przekroje (`wynik.txt` §3; małe N — tylko kierunek)

**Klucz 1, fazy review (złapane szeroko: 0 / A / B / C):** P1/P2 (36) 21 / 24 / 21 / 21; P3 (17) 4 / 6 / 4 / 6; P1 — brak w fazach;
ogon (7) 2 / 3 / 3 / 1; wrzesień (9) 3 / 3 / 3 / 3.
Osie: correctness (18) 10 / 8 / 11 / 10; **test-coverage (12) 1 / 4 / 3 / 6**; security (5) 4 / 5 / 4 / 3; spec (5) 4 / 5 / 3 / 2; code-quality (5) 1 / 2 / 1 / 1;
performance (5) 3 / 3 / 3 / 3; e2e (3) 2 / 3 / 0 / 2.
Rodziny: **test-niefalsyfikowalny (12) 1 / 4 / 3 / 6**; cykl-życia-współbieżność (9) 5 / 5 / 6 / 5; ścieżka-błędu (6) 4 / 2 / 3 / 4; tekst-ui (4) 3 / 4 / 2 / 1;
kontrakt-duplikacja (4) 1 / 2 / 1 / 2; reszta rodzin n ≤ 3.
Jedyna wyraźna różnica osi: **testy niefalsyfikowalne** — tam dzisiejszy review prawie nic nie łapie (1/12), a wszystkie nowe warianty coś (§7 — mechanizm).
Security i ogon: za mało przypadków na wniosek (operator świadomie, 6a pkt 30(a)).

**Klucz 2 wg wagi:** P1 (8) 7 / 5 / 6 / 5; P2 (55) 46 / 41 / 39 / 32. Każdy nowy wariant gubi 1–2 z 8 dzisiejszych trafień P1 (lista §11).

## 6. Moduł kontroli diffu fixa — D12 (`wynik.txt` §2 `klucz1|fix`, §3, §6, §7)

| | 0 dziś | A | B | C |
|---|---|---|---|---|
| klucz 1 fixa (30), szeroko | 0 (0%) | 15 (50%) | 16 (53%) | 15 (50%) |
| różnica vs 0 [CI 95%] | — | +50,0 [+30,0; +67,9] | +53,3 [+36,0; +69,2] | +50,0 [+33,3; +66,7] |
| P1/P2 (21) / P1 (2) | 0 / 0 | 13 / 2 | 12 / 2 | 12 / 2 |
| security (7) / bramka-czarna-lista (6) | 0 / 0 | 6 / 6 | 6 / 6 | 5 / 5 |
| findingi P1/P2 poza kluczem na commit | 8,5* | 1,7 | 3,5 | 1,8 |
| koszt PO na commit / razem 24 commity | 0,21 / 5,15 M | 0,23 / 5,49 M | 0,49 / 11,84 M | 0,34 / 8,20 M |

\* Dzisiejsza kontrola fixa dała 223 findingi (`kontrola_fixa_dzis` w §4 `wynik.txt`): 199 z pre-skanu wzorca `type-assertion`, 18 „bramka bez testu
odmowy”, 6 „regresja” — wszystkie z wagą P2, zwykle bez linii; finding w pliku któregokolwiek klucza miała przy 1 z 30 kluczy. Wynik 0/30 nie jest artefaktem formatu — dzisiejsza kontrola nie szuka nowych defektów w diffie fixa.
**Wniosek:** kontrola diffu fixa według katalogów A/B/C łapie połowę defektów urodzonych w fixie (w tym oba P1), dziś — żadnego. A robi to najtaniej
(+0,34 M na 24 commity) i z najmniejszym szumem; B najdroższy i najgłośniejszy (23,5 findingu poza kluczem na commit).
Nie zmierzone: druga połowa D12 (finding wymagający nowej funkcjonalności → nowa IU).

## 7. Bramki i Stryker — D5 (`wynik.txt` §4)

- **Bramki (zero tokenów):** w fazach review złapały klucz 1 dla A 3 (2 tylko bramką), B 1 (0), C 5 (**4 tylko bramką**). Bez bramek C miałby 23/53
  — mniej niż dziś (25). Wariant 0 bramek lint nie ma, ale nic nie stoi na przeszkodzie, żeby je dostał — bramki są niezależne od architektury reviewerów.
  Koszt szumu: 75 (A) / 197 (B) / 199 (C) trafień bramek poza kluczem na 13 faz (B i C mają szersze zestawy reguł).
- **Stryker:** uruchomiony w 12 z 13 faz (w 3 tylko część aplikacji; 1 faza „nie dotyczy”), **7–126 s na fazę, wszystkie bramki razem ≤ 143 s** —
  znacznie mniej niż 5–15 min z POMIARY §3. Rodzina test-niefalsyfikowalny (12 kluczy w fazach): dziś 1, A 4, B 3, **C 6, z czego 5 findingów powołuje się
  na przeżyty mutant**. A i B też dostały listę mutantów z poleceniem, co z nią zrobić (`mutanty_w_promptach`: lista w promptach 11 / 12 / 12 z 13 faz,
  665 / 746 / 1 294 linii dla A / B / C), ale żaden ich złapany finding się na nią nie powołuje. Lista mutantów zadziałała więc tylko u C (osobny reviewer
  testów z całym wynikiem bramek w dossier); dlaczego nie u A i B, test nie rozstrzyga. Wniosek ostrożny: mutanty dają dowodne złapania w rodzinie,
  w której dziś review prawie nic nie łapie — ale tylko przy odpowiednim ułożeniu wejścia reviewera.

## 8. Weryfikacja — D2 (`wynik.txt` §5)

Sceptycy każdego wariantu dostali tylko findingi P1/P2 dopasowane do klucza 1 (plan §6). Złapane szeroko przed → po weryfikacji: 0 25 → **23**
(zabite 2 prawdziwe B: B-03-55 i B-03-58, obie rodziny ścieżka-błędu — odrzucony promise porzucony w `handleLogout` / `void handleSubmit`), A 30 → 30,
B 25 → 25, C 27 → 27. Dzisiejsza weryfikacja zabiła 2 z 21 złapanych P1/P2 (~10%); sceptycy A (P2 po pliku, P1 ×3), B i C (batch 4) — żadnego.
Małe N; precyzji (zabijania fałszywych) test nie mierzy.

## 9. Szum (`wynik.txt` §6)

Fazy review (13 faz, 29 385 linii diffu kodu — zgodne 13/13 z `linie_diff` w `dane/test-review-fazy.json`):

| | 0 | A | B | C |
|---|---|---|---|---|
| findingi reviewerów P1/P2 na fazę | 13,5 | 15,3 | 13,2 | 10,7 |
| POZA KLUCZEM na fazę (P1/P2) | 16,5 (7,8) | 18,2 (**11,0**) | 21,8 (8,8) | 20,5 (7,4) |
| POZA KLUCZEM na 100 linii (P1/P2) | 0,73 (0,35) | 0,80 (0,49) | 0,97 (0,39) | 0,91 (0,33) |
| trafienia bramek poza kluczem (13 faz) | 0 | 75 | 197 | 199 |
| dopasowane do innej uwagi bota | 10 | 11 | 9 | 7 |

„Poza kluczem” ≠ fałszywy alarm (plan §9 pkt 6) — to górna granica szumu. P1/P2 idą do sceptyków i fixa, więc A dokłada ~3 findingi P1/P2 na fazę do
weryfikacji i naprawy (+41%); koszt tej pętli test pomija (plan §9 pkt 5).

## 10. Koszt (`wynik.txt` §7, `wynik-koszt.json`)

Etap znajdowania (warianty bez sesji uruchamiającej), fazy review, PO / zmierzony, M jedn.:

| | 0 | A | B | C |
|---|---|---|---|---|
| razem 13 faz PO (zmierzony) | 34,17 (41,36) | 19,46 (23,84) | 24,96 (30,70) | 5,77 (10,43) |
| na fazę PO | 2,63 | 1,50 (−43%) | 1,92 (−27%) | 0,44 (−83%) |
| na złapaną uwagę B (klucz 1) | 1,37 | 0,65 | 1,00 | 0,21 |
| weryfikacja dopasowanych (tylko klucz 1) | 1,74 | 1,50 | 0,90 | 0,59 |

Wariant 0 w teście ma efort `high` (6a pkt 29(c)) — przy `medium` byłby ~15% tańszy (plan §2.3). Koszt pomiaru: sędzia 2,71 M (fazy) + 3,70 M (fix).
Cały etap brutto (37 jednostek, z p2 i odrzuconą próbą pilota): 185,70 M — licznik z notatki etapu 183,6 M + jednostka pilota x-05dd804 (2,12 M), której
brakowało w ostatnim `koszt.json`. Model panelu (koszt całego zadania) dawał A −15%, B +3%, C −27% — kierunek zgodny; test mierzy sam etap znajdowania,
w którym B wychodzi taniej, niż zakładał model.

## 11. Klucz 2 — trafienia, które każdy wariant gubi względem dziś (`wynik.txt` §8, `wynik-klucz2-straty.json`)

A gubi **11 (P1 2)**, łapie ponad dziś 4; B gubi **14 (P1 1)**, łapie ponad dziś 6; C gubi **19 (P1 2)**, łapie ponad dziś 3. Kolumna „dziś łapie” = reviewer
wariantu 0, którego finding sędzia dopasował.

| faza | waga | gubi | dziś łapie | czego dotyczy |
|---|---|---|---|---|
| f-5af000f | **P1** | A B C | test-coverage | „Czas czytania” wizyty liczony jako suma sekund sekcji mierzonych równolegle — zawyża czas wielokrotnie. |
| f-46be55a | **P1** | A | correctness | Rotacja tokenu MCP wysyła `created_at` z zegara przeglądarki wbrew kontraktowi migracji z fazy 1. |
| f-303ff62 | **P1** | C | performance, test-coverage | Karta „Decyzje klienta” renderuje się dopiero za bramką liczby wizyt — bez wizyt decyzje są niewidoczne. |
| f-31491bc | P2 | A B C | performance | Kosztowne przeliczenia mapy w ciele komponentu bez `useMemo` — przy każdym renderze. |
| f-1de5a4c | P2 | A B C | performance | Logo AA w .webp waży 80 kB przy wyświetlaniu ~20 px (zastąpiło SVG 5 kB). |
| f-1de5a4c | P2 | A B C | performance | Dynamiczny import App bez `modulepreload` — dodatkowy round trip przy zimnym wejściu. |
| f-5af000f | P2 | A B C | code-quality | Ręczny interfejs w `maybeSingle<OfferDetailsRow>()` zamiast typu z `Database` — typecheck nie pilnuje kolumn. |
| f-303ff62 | P2 | A B C | code-quality | Błąd odczytu `profiles` w hooku webhooka połykany bez Sentry. |
| f-32975a1 | P2 | A B | performance | Zwinięcie mapy na telefonie tylko w CSS — iframe i duży canvas i tak się montują. |
| f-1de5a4c | P2 | A C | security | Test CTA zawsze buduje HTML bieżącym rendererem — ścieżka starszych ofert niepokryta. |
| f-2536643 | P2 | A C | spec, test-coverage | Zmiana poza zakresem: usunięta cała pigułka pochodzenia szablonu zamiast tylko „WBUDOWANY”. |
| f-f3ee433 | P2 | A | test-coverage | Test siedmiu sekcji strony prawnej nie sprawdza ich kolejności. |
| f-b26128d | P2 | B C | security | Deanonimizacja IP: rola `authenticated` czyta sól `offers.ip_salt`. |
| f-32975a1 | P2 | B C | test-coverage | Podpis mapy obiecuje czas zatrzymania, a waga to licznik próbek. |
| f-46be55a | P2 | B C | spec | Formatter daty dashboardu bez strefy Europe/Warsaw — rozjazd z serwerem. |
| f-b8374c8 | P2 | B C | security | Brak testu klucza limitera; limit obejmuje statykę — wielu odbiorców dostaje 429. |
| f-b8374c8 | P2 | B C | security | Kolumna `offers.html` bez limitu rozmiaru. |
| f-67f5f2c | P2 | B C | spec | Serwer z IU-4 nie startuje (`ERR_MODULE_NOT_FOUND`). |
| f-303ff62 | P2 | B | security | Migracja dodaje ograniczenie pary bez backfillu i bez `NOT VALID` — push padnie. |
| f-9d40529 | P2 | C | security | Scalanie wizyt w bazie bez sufitu kluczy — stan wizyty rośnie bez końca. |
| f-b8374c8 | P2 | C | security | Jedyne CSP originu ofert to `frame-ancestors` — HTML oferty bez ochrony przed skryptami. |
| f-1de5a4c | P2 | C | security | Gałąź „oferta wygasła” w `c.js` zakłada węzeł, którego starsze oferty nie mają. |
| f-67f5f2c | P2 | C | correctness | Host-guard zwraca 404 dla 127.0.0.1 — health check kontenera oznaczy deploy jako niezdrowy. |

Łapane tylko przez nowe warianty (zysk na kluczu 2): kontrakt siatki zduplikowany (A B C), test `Sentry.init` bez asercji opcji (A B C), brak testu zużycia
wiadra przez `POST /e` (A B), canvas w pełnej rozdzielczości (A C), budżet limitera na odsłonę (B), hook mapy pobiera dane bez rysowania (B),
test „dokładnie pola kontraktu” niefalsyfikowalny (B).
**Wzór strat** (`zrodla_0` w §4 `wynik.txt`): A gubi głównie to, co dziś łapie reviewer **performance** (4 z 11) — A nie ma soczewki wydajności;
C gubi głównie **security** (7 z 19) — jeden reviewer z blokiem security nie zastępuje osobnego reviewera; B — security i performance po 4.

## 12. Wnioski dla D1–D12 (plan §8)

| decyzja | co test rozstrzyga | co idzie z warunkiem odwrotu |
|---|---|---|
| **D1 architektura review** | **C jako jedyny reviewer faz — odpada** (klucz 2 −25 pkt, bilans −16 pkt, oba istotne; gubi 2 z 8 P1). **B — brak przewagi** (klucz 1 ±0, klucz 2 −13, droższy od A, najgłośniejszy w fixie). **A ≈ dziś w jakości** (bilans −4 [−16; +7]), −43% kosztu znajdowania, +41% szumu P1/P2, brak soczewki wydajności. | Wybór między „dziś + dodatki z testu” a „A + soczewka wydajności” — test ich nie rozróżnia (różnica w granicach ±12 pkt). |
| **D2 grupowanie sceptyków** | Częściowo: żaden układ A/B/C nie zabił prawdziwej B; dzisiejsza weryfikacja zabiła 2 z 21 (ścieżka błędu). | Precyzja i koszt grupowania — pomiar po wdrożeniu. |
| D3 dossier i mandat | Nie rozstrzyga (splecione z architekturą); tury Bash/Read per wariant nie liczone w tej analizie. | Run 3 wg PANEL-PLAN §6. |
| D4 spec tylko w fazach z kodem | Nie (wszystkie fazy mają kod). Oś spec: 5 kluczy, 0 4 / A 5 / B 3 / C 2. | Run 3. |
| **D5 Stryker — gdzie** | Czas: 7–126 s na fazę (Stryker nie jest powodem, by go odsuwać do dev-pr). Skuteczność: mutanty jako jawne wejście reviewera testów — C 6/12 testów niefalsyfikowalnych, dziś 1/12. | Miejsce „w domknięciu” vs „w review” — do run 3 z tymi liczbami. |
| D6 efort i model | Nie (jeden zestaw per wariant). | Run 3. |
| D7–D11 | Nie (poza zasięgiem testu, plan §8). | Run 3, każda z wpisem mapy walidacji. |
| **D12 kontrola fixa** | **TAK — nowa kontrola diffu fixa**: 0/30 → 15–16/30 (CI dolna granica ≥ +30 pkt), oba P1; A najtańszy (+0,34 M na 24 commity) i najcichszy. | Druga część D12 (finding → nowa IU) — niezmierzona. |

**Co test sugeruje poza samym wyborem A/B/C** (z mechanizmem, nie tylko z sumy przebiegów): bramki lint/knip jako darmowe wejście review (C: 4 unikalne
złapania), lista przeżytych mutantów jako wejście reviewera testów ułożone jak w C (5 z 6 złapań C w tej rodzinie; u A i B ta sama lista nie zadziałała),
kontrola diffu fixa według katalogu A. Wszystkie trzy da się dołożyć do dzisiejszego pipeline'u bez zmiany jego architektury reviewerów — w run 3 jako
kandydat „dziś + dodatki” obok „A + soczewka wydajności”, z warunkiem odwrotu i pomiarem po wdrożeniu (okno 5 PR względem B0).

## 13. Ograniczenia

1. N: 53 pary klucza 1 i 63 klucza 2 w fazach — CI ~±11–12 pkt; security (5) i ogon (7) bez wniosku (6a pkt 30(a)).
2. Jeden przebieg (r=1); stabilność tylko z pilota (0/B/C stabilne, A zmienia ~⅓ złapań na jednej fazie).
3. Asymetria promptów: 0 = dopracowane produkcyjne, A/B/C = złożone z katalogów (plan §10) — nowe warianty mogą być niedoszacowane.
4. Warianty bez testera E2E, fixa i scribe'a; koszt pętli fix wywołanej szumem niepoliczony (plan §9).
5. Kalibracja 20 decyzji przez ten sam model co sędzia; szara strefa CZĘŚCIOWE/BRAK 3/20.
6. W kontroli fixa raport `review-faza-N.md` był w stanie commitu tylko w 2 z 24 commitów — wszystkie warianty pracowały na samym diffie (HANDOFF §8).

## 14. Kontrola w obie strony

- **Raport → źródła:** każda liczba §0–§12 jest w `dane/test-review/wynik.txt` (sekcje §1–§8) lub w `wynik-*.json`; 183,6 M i 37/37 — HANDOFF §8
  „ETAP GŁÓWNY ZROBIONY”; MDD ~24 pkt — 6a pkt 30(a); stabilność pilota — `TEST-REVIEW-PILOT-DLA-OPERATORA.md` §4; model panelu A −15% / B +3% / C −27% —
  HANDOFF §8 „STAN … PO RUN 1”; −15% przy `medium` — plan §2.3; 5–15 min Strykera — PANEL-PLAN D5 (POMIARY §3); mutanty w promptach A/B/C
  i skład dzisiejszej kontroli fixa — `wynik.txt` §4 (`mutanty_w_promptach`, `kontrola_fixa_dzis`); skład reviewerów wariantu 0 (`_zrodlo`) — `zrodla_0` tamże.
- **Źródła → raport (pozycje zadania):** 1. kalibracja → §3; 2. różnice sparowane z CI, osobno klucz 1 i 2, „szeroko” główna → §4 (+ PEŁNE); 3. przekroje P1/P2,
  ogon, wrzesień, oś, rodzina → §5; moduł fixa osobno → §6; wkład bramek → §7; szum na fazę i na 100 linii, P1/P2 → §9; po weryfikacji (tylko klucz 1) → §8;
  koszt na fazę i na złapaną B, kolumna PO → §10; 4. lista strat klucza 2 z wagą i zdaniem → §11; 5. D2–D12 → §12. Oba klucze jako zysk i strata ze
  stronniczością → §2.
