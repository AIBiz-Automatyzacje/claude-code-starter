# Etap główny testu review — notatka dla operatora (2026-09-26)

Etap główny przeszedł w całości, bez żadnego zatrzymania. To jest notatka o tym, **jak test przebiegł i czy jego wyniki są czyste**.
Werdyktu, który wariant review jest lepszy, jeszcze tu nie ma. Ten przyjdzie w raporcie z wyniku, po Twojej zgodzie na analizę.

## W skrócie

- **Zakres:** 13 faz oferty-online i 24 commity fixa. 5 z nich mieliśmy już z pilota, więc uruchomiłem 32 nowe.
- **Koszt:** 184 M jedn. z limitu 300 M. Same nowe jednostki kosztowały ok. 147 M, a szacowałem 171 M.
- **Czas:** 15:35–18:50, jedna jednostka po drugiej, bez przerwy na limit konta.
- **Szczelność:** żaden agent nie zmienił kodu kopii, nie zajrzał tam, gdzie nie wolno, i nie wykonał Twojej wiadomości startowej.
  oferty-online i `.claude/` są dokładnie takie jak przed startem.
- **Pierwsze liczby:** nowe warianty łapią wyraźnie więcej uwag bota niż dzisiejszy pipeline, ale gubią część tego, co dziś łapiemy.
  To są surowe liczby, jeszcze bez sprawdzenia.

## 1. Co zrobiłem przed startem

**Problem → przyczyna.** Pilot sprawdził mechanizm na 6 jednostkach. Etap główny to 37 jednostek, w tym 4 commity innego typu,
tzw. „kontrola diffu naprawczego”. Przygotowanie wyłapało trzy rzeczy, które zatrzymałyby run albo po cichu zepsuły wynik.

**Co naprawiłem:**
1. **Commity kontroli miały inny tytuł niż zwykłe commity fixa.** Skrypt nie umiał odczytać z nich numeru fazy i przerwałby pracę na pierwszym takim commicie.
2. **Jedna historyczna uwaga nie miała numeru linii** (dotyczyła obrazka). Przez to sędzia dostawał pustą ścieżkę pliku, a przygotowanie się wysypywało.
3. **Po wyczerpaniu limitu konta sędzia mógł ruszyć na niepełnym komplecie wyników.** Przy wznowieniu skrypt uznałby jego pracę za zrobioną,
   choć ocenił tylko część wariantów. Teraz skrypt w takiej sytuacji staje i czeka na wznowienie. W tym runie limit konta nie wypadł ani razu.

Do tego przejrzałem 52 historyczne trafienia review z nowych faz. Usunąłem 2 pozycje, które nie były prawdziwymi znaleziskami:
jedna była powtórzeniem innej, druga była zdaniem „wymaganie spełnione”.

**Co to daje:** wynik nie ma ukrytych dziur, a każdy wariant był oceniany na tym samym, pełnym materiale.

## 2. Koszt

| | Szacunek | Zmierzone |
|---|---|---|
| 10 nowych faz | 124 M | 95 M |
| 22 nowe commity fixa | 48 M | 51 M |
| Jednostki z pilota (wliczone w limit) | 39 M | 37 M |
| **Razem w liczniku** | **211 M** | **184 M** |

Fazy wyszły o ok. ¼ taniej niż szacunek. Commity fixa zgodnie z szacunkiem: średnio 2,3 M na commit, przy szacunku 2,2 M.
Do limitu zostało 116 M zapasu. Liczby pochodzą z `dane/test-review/koszt.json`, zsumowane skryptem.

## 3. Szczelność — czy wynikom można ufać

- **Twarde alarmy:** zero we wszystkich 37 jednostkach. Model zawsze był właściwy, nie było przecieku ani zmian w kopii.
- **Agenci bez wyniku:** 0 na 593 role.
- **Stan po teście:** oferty-online, `.claude/` i CLAUDE.md szablonu są identyczne jak przed startem.
- **126 drobnych uwag, wszystkie niegroźne.** Najczęściej agenci zapisywali notatki do swoich plików roboczych w katalogu tymczasowym.
  Mniejsze agenty (Haiku) sięgały po narzędzia, choć ich rola tego nie wymagała. Jedna próba zapisu została zablokowana.
- **Jedna rzecz do wiadomości.** W jednej fazie recenzent testów z **dzisiejszego** pipeline'u dopisał w kopii tymczasowe testy, uruchomił je i usunął.
  Kopia na końcu była czysta. To zachowanie dzisiejszej maszynerii, nie błąd testu. Warto jednak o tym pamiętać: dzisiejszy reviewer
  potrafi eksperymentować na kodzie, a nie tylko go czytać.

## 4. Pierwsze liczby — tylko do wglądu

Odsetek złapanych uwag liczę **„szeroko”**: dopasowanie pełne albo częściowe, bo tak ustaliliśmy po pilocie.

| Wariant | Uwagi bota, które dziś uciekły (83) | Trafienia, które dziś łapiemy (63) |
|---|---|---|
| 0 — dzisiejszy pipeline | 30% | 84% |
| A | 54% | 73% |
| B | 49% | 71% |
| C | 51% | 59% |

**Jak to czytać — dzisiejszy pipeline NIE jest „lepszy” w prawej kolumnie:**
- **Obie kolumny są z założenia stronnicze, każda w inną stronę.** Dlatego mierzymy na obu naraz.
- **Lewa kolumna** to błędy, które dzisiejszy pipeline kiedyś **przepuścił**, a złapał je bot na PR-ze. Z założenia sprzyja
  nowym projektom, bo to lista porażek dzisiejszego pipeline'u.
- **Prawa kolumna** to błędy, które dzisiejszy pipeline kiedyś **sam znalazł** w tych fazach. W teście uruchomiliśmy go drugi raz
  na tym samym kodzie, z tymi samymi promptami, więc w dużej mierze odnajduje swoje własne dawne trafienia. 84% to głównie ta powtórka,
  a nie przewaga.
- **Pytanie, na które odpowiada tabela:** ile nowy projekt **zyskuje** na tym, co dziś ucieka, i ile **gubi** z tego, co dziś działa?
  Wariant A: +24 pkt (54% zamiast 30%) i −11 pkt (73% zamiast 84%). B jest podobny: +19 i −13. C traci najwięcej: +21 i −25.
- **Czy strata boli, jeszcze nie wiadomo.** −11 pkt to 7 trafień, które A pominął. Jeśli to drobiazgi, strata jest mała. Jeśli poważne błędy P1,
  to jest realny problem. To rozstrzygnie raport z wyniku.
- **To nie jest jeszcze ranking.** Przy tej liczbie przypadków dopiero różnica ok. 24 punktów jest pewna. Przewaga A nad dzisiejszym pipeline'em
  leży dokładnie na tej granicy. Brakuje też sprawdzenia sędziego na próbce z etapu, przedziałów ufności i podziału na rodzaje uwag.

## 5. Co dalej i czego od Ciebie potrzebuję

**Następny krok: raport z wyniku testu.** Robię go bez agentów, na danych, które już są:
1. Sprawdzę sędziego na 20 decyzjach z etapu, tak jak w pilocie.
2. Policzę przedziały ufności dla różnic między wariantami.
3. Rozbiję wynik na przekroje: najważniejsze uwagi (P1/P2), rzadkie przypadki, wrzesień, osie review, kontrolę fixa.
4. Policzę szum, czyli ile fałszywych znalezisk daje każdy wariant, oraz koszt jednej złapanej uwagi.
5. Oddam dwa pliki: techniczny i Twoją wersję. Z nich wyjdą wnioski dla decyzji D2–D12.

**Twoje decyzje:**
1. **Zgoda na analizę i raport.** Rekomenduję tak.
2. **Commit teraz czy po raporcie?** Rekomenduję teraz: skrypty i dane etapu są gotowe i sprawdzone, a commit zabezpiecza je przed utratą.
