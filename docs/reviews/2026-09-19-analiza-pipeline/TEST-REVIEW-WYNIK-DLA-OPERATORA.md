# Wynik testu review — notatka dla operatora (2026-09-27)

To jest werdykt z prawdziwego testu: ten sam kod z 13 historycznych faz oferty-online sprawdzony czterema sposobami — dzisiejszym pipeline'em
i projektami A, B, C. Wersja techniczna z liczbami i przedziałami ufności: `TEST-REVIEW-WYNIK.md`. Wszystkie liczby liczy skrypt
(`skrypty/test_review_analiza.py`), nie ja z głowy.

## Wniosek (zaakceptowany 2026-09-27)

**Żaden z trzech nowych pomysłów nie jest lepszy od obecnego pipeline'u w szukaniu błędów w fazie. Obecny zostaje i go optymalizujemy.**

1. **Obecny broni się.** Nowe projekty łapią trochę więcej tego, co dziś ucieka, ale gubią mniej więcej tyle samo tego, co dziś działa.
   Sześciu osobnych recenzentów to mocny układ: bez recenzenta wydajności (A) znikają błędy wydajności, z jednym recenzentem (C) — bezpieczeństwo.
2. **Prawdziwa dziura to kontrola poprawek po review.** Dziś nie łapie żadnego z 30 błędów, które rodzą się w poprawkach; nowa łapie połowę prawie za darmo.
3. **Trzy tanie dodatki z dowodem działania:** nowa kontrola poprawek (według A), automatyczne bramki lint/knip, lista przeżytych mutantów dla recenzenta testów.
4. **Obecny prawdopodobnie przepłaca.** A dał podobną jakość o 43% taniej, ale test nie mówi, które pokrętło to dało. Koszt obniżamy po jednym pokrętle,
   z pomiarem i warunkiem odwrotu.
5. **A, B i C nie idą dalej jako osobne projekty.** A służy jako źródło pomysłów na optymalizację obecnego pipeline'u.

Szczegóły, z których wynika ten wniosek, są poniżej.

## Gdzie jesteśmy

Test się odbył, sędzia jest wiarygodny, liczby są policzone. Decyzja zapadła (wyżej). Następny krok opisuje pkt 8.

## W skrócie

- **Sędzia:** sprawdziłem 20 jego decyzji z etapu — wszystkie poprawne (próg błędu 15%, wyszło 0%).
- **Muszę poprawić poprzednią notatkę.** Pisałem, że A łapie o 24 punkty więcej niż dziś. To prawda tylko dla wszystkiego razem. Prawie cała ta przewaga
  pochodzi z **kontroli poprawek po review (fixa)**, gdzie dzisiejszy pipeline nie łapie nic. **W zwykłym review fazy nowe projekty nie są wyraźnie lepsze od dziś.**
- **C traci wyraźnie:** gubi co czwarte trafienie, które dziś działa, w tym 2 z 8 najpoważniejszych (P1). To nie jest przypadek — test to wykazuje.
- **A jest mniej więcej tak dobry jak dziś** i ok. 43% tańszy na etapie szukania błędów. Za to zgłasza więcej fałszywych alarmów i nie ma nikogo od wydajności.
- **B nic nie zyskuje**, a też gubi część dzisiejszych trafień.
- **Kontrola fixa to czysty zysk:** nowe projekty łapią połowę błędów, które powstają w poprawkach. Dziś — zero. Koszt prawie żaden.
- **Trzy tanie rzeczy dają dowodne złapania i da się je dołożyć do dzisiejszego pipeline'u:** automatyczne bramki (lint), lista „przeżytych mutantów”
  dla recenzenta testów i nowa kontrola fixa.

## 1. Jak czytać ten test: zysk i strata

**Problem.** Chcemy wiedzieć, czy nowy projekt review jest lepszy od dzisiejszego. Nie mamy jednej idealnej listy wszystkich błędów w kodzie.
**Przyczyna.** Mamy dwie listy i każda jest stronnicza — w przeciwną stronę.
**Co robimy.** Mierzymy na obu naraz i patrzymy na nie jako na **zysk** i **stratę** względem dziś.

**Lista 1 — zysk.** Błędy, które dzisiejszy pipeline kiedyś **przepuścił**, a złapał je dopiero bot na PR-ze. To lista porażek dzisiejszego podejścia,
więc **z założenia sprzyja nowym projektom**. Pytanie: ile z tych ucieczek nowy projekt by złapał?

**Lista 2 — strata.** Błędy, które dzisiejszy pipeline kiedyś **sam znalazł**. W teście puściliśmy go drugi raz na tym samym kodzie, więc w dużej części
odnajduje własne dawne znaleziska. Ta lista **z założenia sprzyja dzisiejszemu pipeline'owi**. Pytanie: czy nowy projekt nie zgubi tego, co dziś działa?

Dopiero obie listy razem mówią, czy zmiana się opłaca. Do tego liczę jeszcze **bilans**: wszystkie znane poważne błędy (P1/P2) z obu list naraz.

## 2. Wynik w zwykłym review fazy (13 faz)

| | Dziś | A | B | C |
|---|---|---|---|---|
| Zysk: ucieczki złapane (z 53) | 25 | 30 | 25 | 27 |
| Strata: dzisiejsze trafienia utrzymane (z 63) | 53 | 46 | 45 | 37 |
| Bilans poważnych błędów (z 99) | 74 | 70 | 66 | 58 |
| Koszt szukania na fazę | 2,6 M | 1,5 M | 1,9 M | 0,4 M |

**Jak to czytać.** Przy tej liczbie przypadków różnica rzędu 10–12 punktów procentowych to jeszcze szum. Liczby niżej to saldo: ile trafień wariant
zgubił, minus te, które złapał ponad dziś. Dlatego:
- **A:** łapie 5 ucieczek więcej, per saldo gubi 7 dzisiejszych trafień (zgubił 11, dołożył 4). Bilans: 4 błędy mniej na 99 — w granicach szumu.
  Wniosek: **jakość jak dziś, koszt niższy.**
- **B:** łapie tyle samo ucieczek co dziś, per saldo gubi 8 dzisiejszych trafień (14 minus 6). **Nic nie zyskuje.**
- **C:** łapie 2 ucieczki więcej, per saldo gubi 16 dzisiejszych trafień (19 minus 3). **Strata jest prawdziwa** — test wyklucza, że to przypadek.

**Co to znaczy dla wyboru.** C jest bardzo tani (o ok. 2,2 M jedn. mniej na fazę na samym szukaniu), ale płaci za to co czwartym dzisiejszym trafieniem.
Pamiętam, że koszty wiążą nas silniej niż efekt. Tutaj jednak oszczędność idzie wprost w przepuszczone poważne błędy, w tym dwa P1.

## 3. Czego nowe projekty nie widzą

Przejrzałem każde dzisiejsze trafienie, które nowy projekt zgubił. Są między nimi trzy P1, jedno zdanie każde:

- **„Czas czytania” oferty liczony jako suma sekcji mierzonych równolegle** — pokazuje czas kilka razy dłuższy od prawdziwego. Gubią go A, B i C.
- **Token MCP dostaje datę z zegara przeglądarki**, choć umowa z bazą mówi inaczej. Gubi go A.
- **Karta „Decyzje klienta” nie pokazuje się, gdy nie ma wizyt**, więc handlowiec nie widzi pytania klienta. Gubi go C.

Są tam też powtarzalne wzory:
- **A gubi głównie problemy z wydajnością** (ciężkie przeliczenia przy każdym odświeżeniu ekranu, logo 80 kB zamiast 5 kB, wolniejsze pierwsze wejście).
  Dziś łapie je osobny recenzent wydajności, a projekt A takiego nie ma.
- **C gubi głównie bezpieczeństwo** (np. brak ochrony przed skryptami w dokumencie oferty, możliwość odtworzenia adresów IP czytelników).
  Jeden recenzent z „blokiem bezpieczeństwa” nie zastępuje osobnego recenzenta.

Pełna lista (23 pozycje) jest w wersji technicznej, §11.

## 4. Kontrola poprawek po review (fix)

**Problem.** Część błędów rodzi się dopiero w poprawkach po review. Dziś po poprawce działa tylko wąska kontrola: skan wzorców (np. asercji typów)
i sprawdzenie regresji oraz brakującego testu odmowy. Nowych błędów w samej poprawce nie szuka.
**Wynik.** Na 30 takich błędach dzisiejsza kontrola nie złapała żadnego. Kontrole z projektów A, B i C złapały po 15–16, w tym oba najpoważniejsze (P1).
**Koszt.** Kontrola A kosztowała o 0,34 M jedn. więcej niż dziś na wszystkie 24 poprawki razem, czyli praktycznie nic. B był najdroższy i najbardziej „gadatliwy”.
**Co Ci to da.** Połowa błędów z poprawek wyłapana przed PR-em, bez odczuwalnego kosztu. To jest decyzja D12 i test ją rozstrzyga.

## 5. Trzy tanie rzeczy, które działają

1. **Automatyczne bramki (lint, knip).** Nic nie kosztują w tokenach i trwają do 2,5 minuty na fazę. W projekcie C złapały 4 błędy, których nie znalazł
   żaden recenzent. Dziś ich nie mamy, a można je dołożyć do obecnego pipeline'u.
2. **Lista „przeżytych mutantów” dla recenzenta testów.** Stryker psuje kod na próbę i sprawdza, czy testy to zauważą. Czego nie zauważą, to test „na niby”.
   Dziś takich testów prawie nie łapiemy (1 z 12). Projekt C z tą listą złapał 6 z 12, a 5 z tych znalezisk powołuje się wprost na mutanta. Stryker trwał 7 s–2 min
   na fazę, a nie 5–15 minut, jak zakładaliśmy. Uwaga: A i B dostały tę samą listę i z niej nie skorzystały — liczy się, jak podamy ją recenzentowi.
3. **Nowa kontrola fixa** — pkt 4.

## 6. Fałszywe alarmy

A zgłasza ok. 11 poważnych uwag na fazę spoza obu list, dziś ok. 8. To nie zawsze fałszywe alarmy — bot też nie widzi wszystkiego. Ale każda taka
uwaga idzie potem do sprawdzenia i poprawki, więc A oszczędza na szukaniu, a część tej oszczędności oddaje później. Tego kosztu test nie mierzył.

## 7. Czego ten test nie mówi

- Przy 13 fazach różnica mniejsza niż ok. 12 punktów jest niewidoczna. Bezpieczeństwo i rzadkie przypadki mają za mało przykładów na wniosek.
- Każda faza szła raz. Z pilota wiemy, że A jest mniej powtarzalny od pozostałych.
- Dzisiejszy pipeline ma dopracowane prompty, a A, B i C są złożone z opisów projektów. Nowe projekty mogą więc być trochę niedoszacowane.
- Sędziego sprawdzałem ja, czyli ten sam model. 3 z 20 decyzji były na granicy, gdzie obie oceny są do obrony.

## 8. Co dalej i czego od Ciebie potrzebuję

**Decyzja (2026-09-27, HANDOFF 6a pkt 32):** zostaje obecna architektura review. Dokładamy trzy dodatki z dowodem działania: nową kontrolę poprawek
według A, bramki lint/knip i listę mutantów dla recenzenta testów. Koszt obniżamy po jednym pokrętle, z pomiarem. A, B i C nie idą dalej jako osobne
projekty. Po dodaniu recenzenta wydajności A byłby w praktyce obecnym pipeline'em z niższym wysiłkiem i listami kontrolnymi, więc służy jako źródło
pomysłów na optymalizację.

**Co dalej:** w nowej sesji, bez agentów — wstępne wybory dla pozostałych decyzji (D2–D11) z liczbami z testu i przygotowanie run 3 (sceptycy).
Lista pokręteł kosztu obecnego review idzie tam jako opcje. Run 3 uruchomię dopiero po Twojej zgodzie i po pokazaniu kosztu.
Instrukcja startowa: HANDOFF §8 „WSTĘPNE WYBORY I PRZYGOTOWANIE RUN 3”.
