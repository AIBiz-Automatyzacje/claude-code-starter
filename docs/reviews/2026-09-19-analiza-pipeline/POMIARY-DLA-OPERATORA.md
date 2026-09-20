# Cztery pomiary przed etapem 4 — wersja dla Kacpra

Data: 2026-09-20. Wersja techniczna z liczbami, ścieżkami i konfiguracjami: `POMIARY-ROZSTRZYGNIECIE.md`.

## Po co były te pomiary

Research w etapie 2 zostawił cztery pytania, na które dokumentacja nie odpowiadała, a od których zależy, co panel projektowy w etapie 4 będzie mógł
założyć. Zamiast projektować na domysłach, zmierzyliśmy je na Twoim realnym projekcie (oferty-online) i na małym repo testowym. Wszystko skryptami
i pojedynczymi uruchomieniami Claude'a w trybie poleceń, bez agentów analizujących. Twoje repo oferty-online nie zostało dotknięte: pracowaliśmy
na kopii roboczej w katalogu tymczasowym, tam też instalowaliśmy narzędzia.

---

## Pomiar 1. Czy odchudzenie kontekstu agentów naprawdę działa

**Pytanie.** Claude Code ma przełącznik, który nie ładuje CLAUDE.md do agenta pomocniczego, i reguły, które ładują się tylko przy dotknięciu
pasującego pliku. Dokumentacja nie mówiła, czy to działa w agentach, które uruchamia nasz pipeline.

**Jak sprawdziliśmy.** Zbudowaliśmy repo testowe, w którym każdy plik reguł i CLAUDE.md ma unikalny losowy „marker". Potem uruchamialiśmy
agentów różnych typów i prosiliśmy, żeby wypisali markery, które widzą. Agent nie może zgadnąć losowego ciągu, więc jeśli go podaje, znaczy że
naprawdę dostał tę regułę.

**Co wyszło.**
- Reguły warunkowe działają we wszystkich typach agentów: w sesji głównej, w agentach z narzędzia Agent i w agentach z Workflow. Ładują się,
  gdy agent otworzy pasujący plik narzędziem Read albo Edit.
- Nie ładują się, gdy agent czyta plik przez `cat` w Bashu, gdy tworzy nowy plik, ani gdy tylko listuje katalog. To ważne, bo nasi builderzy
  czytają w 78% przez Bash. W tym trybie reguły warunkowe są martwe.
- Przełącznik wyłączający CLAUDE.md działa, także w Workflow. Wycina CLAUDE.md i reguły bezwarunkowe, ale reguły warunkowe dalej działają.
- Największa niespodzianka: to nie CLAUDE.md jest najcięższy. Agent bez listy dozwolonych narzędzi startuje w Twoim środowisku z 62 tysiącami
  tokenów. Ten sam agent z krótką listą narzędzi (Read, Bash, Write, Edit) startuje z 11,6 tysiącami. Z dodatkowym wyłączeniem CLAUDE.md
  z 4,5 tysiącami. Różnica to głównie nazwy 900 narzędzi MCP i opisy narzędzi wbudowanych.
- Żaden z 16 agentów w szablonie nie ma tej listy. Każdy z 35 agentów fazy płaci pełną cenę.

**Co Ci to da.** Start każdego agenta pipeline'u może kosztować 4,5 tysiąca tokenów zamiast 62. Przy 35 agentach na fazę to ponad 10% kosztu
fazy z samego startu, a każda kolejna tura agenta też jest lżejsza. To jest ta dźwignia 30–40%, o której mówił etap 1, i teraz wiemy, że działa
i jak ją włączyć: lista narzędzi w definicji agenta, wyłączenie CLAUDE.md, reguły przez prompt i przez reguły warunkowe, a builderzy czytają
przez Read, nie przez `cat`.

---

## Pomiar 2. Ile z 195 realnych uwag bota złapałby sam linter

**Pytanie.** Etap 2 sugerował, że skoro CodeRabbit uruchamia 50 linterów, to część jego trafnych uwag to trafienia linterów, które my moglibyśmy
mieć za darmo. Jeśli tak, można by skasować kolejne osie review.

**Jak sprawdziliśmy.** Dla każdego z 19 PR-ów oferty-online cofnęliśmy kopię roboczą do stanu, który widział bot, uruchomiliśmy proponowaną
konfigurację lintera na plikach z uwagami i sprawdziliśmy, czy linter zgłosił coś w tej samej linii (z tolerancją 3 linii).

**Co wyszło.** Z 97 uwag, które mają numer linii, linter trafił w jedną. Nawet klasa „pusty catch" dała zero: bot zgłaszał połknięcie błędu
w sensie logicznym (blok robił tylko log), a nie pusty blok w sensie składniowym. Uwagi bota są semantyczne. Bot znalazł je modelem, nie linterami.

**Co Ci to da.** Uczciwą odpowiedź: bramki narzędziowe nie zastępują review dla realnych defektów i nie uzasadniają kasowania kolejnych osi
poza tym, co już postanowiliśmy (performance i code-quality). Ich rola to co innego: gaszą 157 uwag szumu u źródła, zapobiegają klasom, które
w Twoim kodzie realnie występują (linter znalazł 11 miejsc ustawiania stanu w efekcie, 8 nieprawidłowych asercji, 5 atrap bez sprawdzenia
argumentów) i zdejmują z agenta pracę stylistyczną.

---

## Pomiar 3. Ile czasu zajmą bramki narzędziowe

**Pytanie.** Nikt nie podawał czasów dla projektu naszej wielkości. Gdyby bramka trwała kilka minut, potrzebny byłby szybszy linter.

**Co wyszło** na 585 plikach oferty-online: sprawdzenie typów 10 sekund, linter z regułami typowanymi 24 sekundy na zimno i 1,3 sekundy
z cache, wykrywacz martwego kodu 2 sekundy, budżet rozmiaru aplikacji poniżej sekundy. Mutation testing na trzech plikach z ostatniego fixa:
370 mutantów w 2 minuty, testy zabiły 81% z nich, 61 przeżyło. Przeżyte mutanty to dokładnie klasa „gałąź warunkowa bez asercji", czyli ta,
którą bot nam wytykał.

**Co Ci to da.** Linter, knip i budżet rozmiaru mieszczą się w domknięciu każdej fazy bez żadnego planu B. Mutation testing nie: 2 minuty na
3 pliki to przy fazie na 10–30 plików kwadrans. Jego miejsce jest raczej przed wysłaniem PR-a niż po każdej fazie. Jedyny realny koszt to pierwsze wdrożenie: linter zgłasza dziś
188 błędów w istniejącym kodzie, z czego 96 to funkcje dłuższe niż 60 linii. Trzeba jedną turę na wyciszenie albo naprawę zastanych naruszeń.
Dwa drobiazgi po drodze: sprawdzenia bazy Supabase nie zmierzyliśmy, bo Docker był wyłączony, a na gałęzi głównej oferty-online są cztery
czerwone testy (strona szczegółów oferty), które trzeba było wykluczyć, żeby mutation testing w ogóle ruszył.

---

## Pomiar 4. Czy powtórka review znajduje to samo

**Pytanie.** Powtórka review tej samej fazy dawała 12–18 nowych findingów. Czy to te same rzeczy inaczej opisane, przypadkowy szum, czy nowe
prawdziwe defekty?

**Jak sprawdziliśmy.** Znaleźliśmy 6 par runów, w których ta sama faza tego samego zadania przeszła review dwa razy. Porównaliśmy listy
findingów po pliku i linii oraz sprawdziliśmy w gicie, czy między runami zmienił się kod.

**Co wyszło.** To są dwa różne zjawiska.
- Gdy kod się nie zmienił, powtórka odtwarza około połowy findingów i dokłada 8–13 nowych, głównie drobnych, ale nie tylko: w claude-cron
  drugie przejście znalazło 3 realne defekty średniej wagi, których pierwsze nie widziało. To jest zwykła niestabilność modelu, zgodna z badaniami.
- Gdy między runami był fix, powtórka nie odtwarza prawie nic i daje 14–19 nowych findingów, z których większość dotyczy plików zmienionych
  przez ten fix (w fazie 9b: 17 z 19). To nie jest niezbieganie. To review kodu naprawczego, którego dziś nikt poza lekką kontrolą diffu nie ogląda.
  Kontrola diffu znalazła w tym samym kodzie 3 regresje, pełny review 17 findingów.

**Co Ci to da.** Decyzja „po STOP-ie E2E wraca tylko tester" stoi. Ale po dużym fixie warto puścić jedną lekką rundę correctness na samym diffie
naprawczym, bo tam są nowe defekty. A na niestabilność odpowiedzią jest lepszy sceptyk lub równoległe próbki, nie druga runda.

---

## Co z tego idzie do etapu 4

Trzy rzeczy stają się twardymi wejściami dla panelu, a nie hipotezami:

1. Każdy agent pipeline'u dostaje krótką listę narzędzi i nie ładuje CLAUDE.md. Reguły trafiają do niego przez prompt i reguły warunkowe.
   Builderzy czytają przez Read. To jest największa pojedyncza oszczędność w całej analizie.
2. Bramka narzędziowa w domknięciu fazy trwa kilkanaście sekund i gasi szum, ale nie zwalnia review z pracy nad realnymi defektami.
3. Review kodu naprawczego to luka: po fixie zmieniającym wiele plików potrzebna jest lekka runda na diffie fixa.

Czekam na Twój znak, żeby ruszyć z etapem 3 (krytyk kompletności).
