# Pilot testu review — notatka dla operatora (2026-09-25)

Pilot przeszedł w całości: 3 fazy, powtórka fazy b26128d i 2 commity fixa. Dane w `dane/test-review/pilot*.json` i `pilot.txt` (liczone
skryptem `skrypty/test_review_pilot.py`), metryki w `dane/test-review/metryki.txt`. Na etap główny zgody jeszcze nie ma — ta notatka kończy się
decyzją, której potrzebuję od Ciebie.

## W skrócie

- **Koszt:** 43,7 M jedn. za sam pilot (+ 5,7 M straconej próby przy limicie konta) — szacowaliśmy 93 M (środek). Pilot kosztował ok. 47% szacunku (53% razem ze straconą próbą).
- **Sędzia:** 0 błędów na 20 sprawdzonych decyzji (próg 15%). Dwie permutacje dały ten sam wynik dla złapań „szeroko” w 100%.
- **Szczelność:** zero przecieków, zero zmian w kopiach, oferty-online i `.claude/` bez zmian (dowód: `stan-po.txt`).
- **Stabilność:** powtórka tej samej fazy dała prawie te same złapania w wariantach 0, B i C; wariant A zmienia się mocniej.
- **Jakość wariantów:** pierwsze liczby są, ale pilot ma za mało przypadków na wnioski (MDD pilota ~50 pkt).

## 1. Koszt: zmierzony zamiast szacunku

**Problem → przyczyna.** Plan liczył koszt z historycznych runów autopilota, w których agent review ciągnął duży kontekst sesji. W teście
każdy wariant startuje w czystej sesji z samym skryptem — dlatego agenci są tańsi niż w historii.

| Faza | Zmierzone | Szacunek (widełki) |
|---|---|---|
| f-b26128d | 10,5 M | 21,6–37,5 M |
| f-2634b67 | 7,8 M | 20,8–31,4 M |
| f-f3ee433 | 10,8 M (+5,7 M próba przerwana limitem konta) | 21,7–31,6 M |
| powtórka f-b26128d | 10,2 M | 21,6–37,5 M |
| 2 commity fixa | 2,2 + 2,1 M | 3,7–5,6 M każdy |

Warianty review kosztowały 34–50% szacunku „dziś” tych samych faz (średnio 43%). Narzut na fazę (sędzia, sceptycy, sesje) to ok. 1,9 M.

**Co to daje dla etapu głównego** (przeliczone tą samą proporcją, bez modułu fixa):

| Zakres | Faz | Szacunek przed pilotem | Po pilocie | Dokładność (MDD, 1 przebieg / 2 przebiegi) |
|---|---|---|---|---|
| 50% przypadków | 13 | 309 M | **~152 M** | 23,9 / 17,3 pkt |
| 75% przypadków | 21 | 508 M | **~250 M** | 20,1 / 14,6 pkt |
| pełny | 37 | 865 M | **~427 M** | 17,7 / 12,8 pkt |

Drugi przebieg (r=2) podwaja koszt wariantów. Moduł kontroli diffu fixa (24 commity) to wg pilota ok. 45–50 M.

**Limit konta.** Druga połowa pilota (~25 M jedn. razem z tą sesją) zużyła ok. 19% okna 5-godzinnego i 5% limitu tygodniowego konta
automatyzacje@aibiz.pl. W przybliżeniu: ~130 M jedn. na okno 5-godzinne, co najmniej ~500 M na tydzień. Zakres 75% to więc ~2 okna
5-godzinne i ok. połowy tygodnia, pełny — ~3–4 okna i większość tygodnia. To zgrubne liczby: odczyt limitu ma krok 1% i zawiera też
tę sesję.

## 2. Sędzia: czy można mu ufać

**Kalibracja.** Sprawdziłem 20 decyzji z permutacji p1 (ziarno stałe, `pilot-kalibracja-probka.txt`): 10 dopasowań PEŁNE/CZĘŚCIOWE
i 10 odmów, w których w tym samym pliku leżał niedopasowany finding najbliżej linii klucza — czyli najtrudniejsze przypadki na przeoczenie.
Wszystkie 20 decyzji jest zgodnych z definicjami z promptu sędziego. Wynik: **0% błędów przy progu 15%**.

Jedna rzecz do wiedzenia: granica **PEŁNE / CZĘŚCIOWE jest miękka**. Definicja pozwala na obie oceny, gdy finding opisuje ten sam brak testu,
ale wskazuje plik testu zamiast pliku kodu — sędzia raz daje PEŁNE, raz CZĘŚCIOWE (3 takie decyzje w próbce). Dlatego do porównań wariantów
bardziej wiarygodna jest miara „szeroko” (PEŁNE + CZĘŚCIOWE) niż samo PEŁNE.

Zastrzeżenie: kalibrację robiłem ja, a sędzia to ten sam model (Opus 5.5) — nasze błędy mogą być podobne. Jeśli chcesz niezależnego
sprawdzenia, wystarczy, że przejrzysz 3–5 pozycji z `pilot-kalibracja-probka.txt`.

**Dwie permutacje (ta sama pula findingów w innej kolejności):**

| Co porównuję | Zgodne |
|---|---|
| obecność klucza w kodzie | 40 z 41 (97,6%) |
| złapanie „szeroko” (para klucz × wariant) | 148 z 148 (100%) |
| złapanie PEŁNE | 142 z 148 (95,9%) — różnice tylko na miękkiej granicy PEŁNE/CZĘŚCIOWE |
| finding przypisany do tych samych kluczy z tą samą oceną | 102 z 112 (91,1%) |

Wniosek praktyczny: druga permutacja prawie nic nie wnosi. W etapie głównym zostaje jedna — tak jak planowaliśmy.

## 3. Szczelność: czy agenci widzieli coś, czego nie powinni

- Końcowe skany wszystkich 6 faz: **0 twardych alarmów** (model, przeciek, zmiana kopii, wykonanie wiadomości startowej).
- Kopie faz bez zmian (HEAD, `git status`, odcisk plików `.claude/`). oferty-online i `.claude/CLAUDE.md` szablonu bez zmian.
- 5 uwag bez zatrzymania — wszystkie to agenci Haiku używający narzędzi w swojej roli (notatki w scratchpadzie, czytanie diffu fixa,
  plik roboczy w `/tmp`). Nic z tego nie dotyka kopii ani wyników.
- 0 ról agentów bez wyniku na 194. Harness 4 razy ponowił agenta, który utknął — każda rola ma wynik.

## 4. Stabilność: powtórka tej samej fazy (f-b26128d dwa razy)

| Wariant | Złapane klucze (przebieg 1 / 2) | W obu przebiegach | Findingów (1 / 2) |
|---|---|---|---|
| 0 | 7 / 8 | 7 | 24 / 25 |
| A | 8 / 7 | 5 | 21 / 30 |
| B | 9 / 10 | 9 | 28 / 27 |
| C | 7 / 8 | 7 | 33 / 24 |

Warianty 0, B i C łapią w powtórce prawie te same klucze; A zmienia ~⅓ złapań. Plan zakładał powtarzalność ~50% — jeśli wyższa
powtarzalność 0/B/C utrzyma się w etapie głównym, dokładność (MDD) będzie lepsza niż w tabeli z pkt 1. To jedna faza, 11 kluczy — tylko sygnał.

## 5. Pierwsze liczby złapań (bez wniosków)

Suma ze wszystkich faz i obu permutacji (`metryki.txt`); klucz 1 = uwagi bota z historii, klucz 2 = potwierdzone P1/P2 historycznego review:

| Wariant | Klucz 1: PEŁNE / szeroko | Klucz 2: PEŁNE / szeroko |
|---|---|---|
| 0 (dzisiejszy pipeline) | 23% / 34% | 68% / 85% |
| A | 46% / 51% | 75% / 75% |
| B | 49% / 57% | 88% / 95% |
| C | 60% / 63% | 75% / 75% |

**Tego nie wolno jeszcze czytać jako rankingu.** Pilot ma za mało przypadków: MDD pilota to ~50 pkt (plan §5, N=13), a wszystkie różnice
są mniejsze. Sumy liczą też obie permutacje i powtórkę tej samej fazy, więc te same klucze wchodzą kilka razy. Dopiero etap główny rozstrzyga.

## 6. Co się po drodze zepsuło i jak to naprawiłem

1. **Skaner zatrzymywał na normalnej pracy agentów** (notatki Haiku, `>/dev/null`, odczyt własnych wyników narzędzi). Przyczyna: skaner
   był ostrzejszy niż definicje §11 planu. Teraz zatrzymuje dokładnie wg §11, resztę wypisuje jako uwagi; 20 sztucznych naruszeń łapie.
2. **Limit tygodniowy konta** (faza f-f3ee433): CLI `claude` było zalogowane na inne konto niż aplikacja. Po Twoim przelogowaniu na
   automatyzacje@aibiz.pl wszystko poszło. Nieudana próba trafiła do `~/test-review/odrzucone/`, jej koszt jest wliczony.
3. **Wznowienie po przerwie** pomijało kroki z błędem jak gotowe. Teraz krok liczy się jako zrobiony tylko bez błędu sesji i bez błędu API.
4. **Fałszywy przeciek w powtórce** (nazwa `f-b26128d` jest początkiem `f-b26128d-r2`) i **fałszywe „puste wyniki”** (porzucone
   podejścia agentów, które harness ponowił) — poprawione, faza powtórki dokończona.
5. **Metryki padały na fazach fixa** (tam nie ma sceptyków) — poprawione.

## 7. Twoja decyzja

1. **Zakres etapu głównego** — 50% (~152 M), 75% (~250 M, rekomendacja planu: cały ogon przypadków, MDD ~20 pkt) albo pełny (~427 M);
   opcjonalnie drugi przebieg (r=2, koszt wariantów ×2) i moduł kontroli diffu fixa (~45–50 M).
2. **Limit kosztu etapu** — proponuję 1,5 × szacunek po pilocie (50%: ~230 M, 75%: ~375 M, pełny: ~640 M) zamiast starych 551 / 907 / 1549 M.
   Niższy limit szybciej złapie coś nietypowego.
3. **Konto** — etap główny na automatyzacje@aibiz.pl (tam, gdzie teraz jest CLI).
