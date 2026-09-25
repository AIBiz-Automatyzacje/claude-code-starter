# Prawdziwy test review — plan w prostych słowach

Wersja techniczna: `TEST-REVIEW-PLAN.md`. Tu jest to samo bez tabel i ścieżek: co test sprawdzi, na czym, ile kosztuje, czego nie powie i gdzie się zatrzyma.
**Plan zaakceptowany 2026-09-25** — Twoje odpowiedzi są na końcu. Nic jeszcze nie zostało uruchomione — ani jeden agent. Wszystkie liczby poniżej policzyły skrypty na danych, które już mamy.

## Gdzie jesteśmy

Run 2 pokazał, że ocena na papierze nie działa: sędzia czytający opisy mechanizmów dał dzisiejszemu pipeline'owi około jednej trzeciej złapanych uwag bota, a
naprawdę było zero. Zdecydowałeś, że żadna koncepcja nie odpada, dopóki nie sprawdzimy jej na prawdziwym kodzie. Ten plan opisuje, jak to zrobić uczciwie i za ile.

## 1. Na jakim kodzie

**Problem.** Uwagi bota dotyczą kodu z pull requesta, czyli kodu już po naszym review i po poprawkach. Żeby sprawdzić review, trzeba dać mu kod w takim stanie,
w jakim widział go wtedy — tuż przed review fazy, w której błąd powstał.

**Przyczyna.** Nie każda uwaga bota urodziła się w fazie, którą nasze review oglądało. Część powstała w poprawkach po recenzji bota, część w poprawkach po naszym
review, część w dopiskach po autopilocie. Na takich uwagach żaden wariant review nie miał szansy — liczenie ich zamazałoby wynik.

**Co zrobiłem.** Skrypt przeszedł wszystkie 195 uwag: dla każdej znalazł wątek bota, commit, na który bot patrzył, i przez historię gita commit, który napisał
te linie. Wynik: **104 uwagi powstały w fazie, którą nasze review oglądało** — rozłożone na 37 faz z siedemnastu PR-ów. Pozostałe 91 odpadają z testu: 27 urodziło się
w poprawkach po recenzji bota, 27 w poprawkach po naszym review, 18 w dopiskach po autopilocie, 11 w ręcznych poprawkach, a ostatnie osiem to kontrola poprawek, kod bez odnalezionego źródła i jeden wątek bez dopasowania. Wśród
tych 104 jest 67 poważnych (P1 i P2), 13 z „ogona” (klas, których projektanci nie widzieli po nazwie) i 27 z września. Sprawdziłem czytaniem piętnaście losowych
przypadków — pierwsza wersja skryptu myliła się, gdy uwaga bota kończyła się na zamykającym nawiasie, więc teraz liczy dwiema regułami, a obecność błędu w kodzie
fazy potwierdza jeszcze sędzia.

**Druga miarka.** Same ucieczki to miarka stronnicza: dzisiejsze review na tych przypadkach już raz przegrało, więc każdy nowy wariant ma tu fory. Dlatego dokładam
drugą listę — 210 poważnych zgłoszeń, które dzisiejsze review w tych samych fazach znalazło i które przeszły weryfikację (z raportów review w zamkniętych zadaniach).
Pierwsza lista mówi, ile wariant zyskuje, druga — ile gubi z tego, co dziś działa. Dopiero obie razem dają uczciwy obraz, szczególnie dla projektu C z jednym reviewerem.

**Co to da.** Test mierzy review na dokładnie tym kodzie, który review wtedy widziało, i na obu stronach wagi: zysk i stratę.

## 2. Jak odtworzyć kod, niczego nie ruszając

Dla każdej fazy robię kopię repo poza oferty-online i poza katalogiem z projektami. Kopia ma historię uciętą dokładnie na chwili przed review — agent nie zobaczy
ani jednego przyszłego commita, poprawki bota ani późniejszej wiedzy projektu. Do kopii wkładam dzisiejszą maszynerię szablonu bez zmian, a wiedzę projektu (plik
wyuczonych wzorców i CLAUDE.md) zostawiam z tamtej chwili — nowsze wersje opisują te same błędy, byłaby to ściąga. Kopia jest ustawiona tak, że dla reviewera
wygląda jak czysta gałąź zadania. Skrypt zapisuje stan oferty-online i szablonu przed testem i po nim; każda różnica zatrzymuje test.

## 3. Cztery warianty review

**Dzisiejszy** — prawdziwy skrypt review z szablonu. Jedyna zmiana to ucięcie go przed weryfikacją i bez testera E2E; skrypt przygotowawczy sprawdza bajt po bajcie,
że wszystkie prompty i reguły wyboru reviewerów są identyczne ze źródłem, inaczej test nie ruszy.

**A, B, C** — review złożone skryptem z tego, co projektanci zapisali w katalogach: ten sam skład ról, te same warunki uruchomienia, dosłowne brzmienie poleceń-list,
ten sam model i ten sam poziom myślenia, ta sama paczka kontekstu i to samo łączenie wyników co w projekcie. B dostaje swoje trzy próbki poprawności z różną
kolejnością plików, C swojego jednego reviewera z czterema blokami poleceń i osobnego reviewera testów.

Wszyscy dostają te same bramki, uruchomione naprawdę na kodzie fazy: lint z regułami danego projektu, szukanie martwego kodu, rozmiar paczki, testy mutacyjne
tam, gdzie faza zmieniła testy, i pilnowanie niezmienności migracji. Jedyna bramka, której nie da się puścić, to doradca bazy w chmurze — nie ma bazy w stanie
sprzed kilku tygodni.

## 4. Kto ocenia

**Problem.** Ktoś musi orzec, czy zgłoszenie wariantu to ta sama rzecz, którą znalazł bot albo wcześniejsze review.

**Co robimy.** Jeden sędzia na fazę dostaje wszystkie zgłoszenia czterech wariantów wymieszane i bez podpisów oraz obie listy znanych problemów, też wymieszane
i bez informacji, która pochodzi od bota. Dla każdego znanego problemu mówi: czy błąd w ogóle jest w kodzie tej fazy, które zgłoszenie go trafia w całości, które
częściowo. Zgłoszenia, które niczego nie trafiły, dzieli na „inna uwaga bota” i „spoza obu list” — to drugie to górna granica szumu. Zanim użyjemy jego ocen,
czytam dwadzieścia jego decyzji; jeśli nie zgadzam się z więcej niż trzema z dwudziestu, sędzia idzie jeszcze raz z mocniejszym myśleniem, a gdy znowu — zatrzymuję się.

Trafione poważne zgłoszenia przechodzą jeszcze przez sceptyków danego wariantu, tak jak w projekcie. Dzięki temu widać, czy weryfikacja nie zabija prawdziwych
błędów — to ta część testu, która coś mówi o sposobie grupowania sceptyków.

**Co to da.** Dla każdego wariantu: ile ucieczek łapie, ile dzisiejszych trafień gubi, ile dokłada szumu, jak bardzo się różni między dwoma przebiegami i ile kosztuje
jedno złapanie.

## 5. Ile faz i czy powtarzać

**Problem.** Review jest losowe — ten sam kod przejrzany drugi raz daje mniej więcej połowę tych samych zgłoszeń. Na kilku przypadkach różnica między wariantami
może być czystym przypadkiem.

**Co policzyłem.** Przy wszystkich 37 fazach test rozróżni warianty, które dzieli około 18 punktów procentowych złapanych uwag; przy 21 fazach — około 20; przy 13 —
około 24. Druga runda na tych samych fazach poprawia precyzję mniej więcej tak samo jak podwojenie liczby faz, ale faz z przypadkami jest tylko 37, a więcej faz
daje też szerszy przekrój rodzajów błędów. Dlatego najpierw fazy, a powtórka tylko jedna — cała jedna faza drugi raz we wszystkich wariantach, żeby zobaczyć, jak
stabilny jest każdy. To jest też bezpośredni test obietnicy projektu B, że trzy próbki podnoszą stabilność.

## 6. Ile to kosztuje

Fazy ułożyłem od najbardziej opłacalnej: najwięcej poważnych przypadków na jednostkę kosztu. Liczby w jednostkach cennika takich jak w całej analizie; dla skali —
jeden cały run autopilota z 20 września kosztował około 35 milionów.

Najpierw **pilot na trzech fazach** (dwie sierpniowe, jedna wrześniowa): od 26 do 66 milionów, środek około 56, plus powtórka jednej fazy od 8 do 22 milionów.
Pilot nie powie jeszcze nic o tym, który wariant jest lepszy — jest za mały. Pokaże, ile naprawdę kosztuje faza, czy sędzia jest wiarygodny i czy kopie są szczelne.

Potem **etap główny** — zakres wybierasz po pilocie. Trzynaście faz to środek około 310 milionów (od 141 do 367), dwadzieścia jeden faz — około 510 (od 232 do 605),
wszystkie 37 — około 865 (od 395 do 1033). Do tego moduł sprzątania po poprawce, około 44 miliony. Dolna granica to warunki po odchudzeniu kontekstu agentów, górna to dzisiejszy kontekst i mocniejsze myślenie.
Uruchamiam agentów bez serwerów MCP, których reviewerzy i tak nie używają, więc spodziewam się wyniku bliżej dolnej połowy; pilot to zmierzy. Czasowo pilot to
około trzech–czterech godzin pracy agentów, dwadzieścia jeden faz — kilkanaście godzin, rozłożone na kilka sesji.

Z czterech wariantów najdroższy w teście jest B (jego istotą są dodatkowe próbki), najtańszy C. Każdy etap ma twardy limit równy półtorej górnej granicy;
skrypt liczy koszt z zapisów agentów po każdej fazie i nie uruchamia następnej po przekroczeniu. Po teście koszt każdego wariantu przeliczam tą samą metodą co
w panelu, żeby dało się go porównać z wcześniejszymi liczbami.

**Moja rekomendacja na etap główny: dwadzieścia jeden faz.** To jedyny zakres, w którym jest cały ogon i sensowna liczba przypadków bezpieczeństwa, a kosztuje
niecałe sześć dziesiątych pełnego. Trzynaście faz jest tańsze o dwie piąte, ale bezpieczeństwo i ogon nie dają tam żadnego wniosku. Pełny zakres tylko wtedy, gdy
po dwudziestu jeden fazach dwa najlepsze warianty będą się różnić mniej niż próg wykrywalności, a wybór między nimi zmienia koszt zadania o więcej niż jedną dziesiątą.

## 7. Które decyzje test rozstrzyga

**Rozstrzyga kształt review** — to jest jego cel. **Częściowo** pomaga w trzech innych: grupowaniu sceptyków (ile prawdziwych błędów zabija weryfikacja w każdym
układzie), miejscu testów mutacyjnych (ile przypadków „test, który przejdzie zawsze” łapią przeżyte mutanty i ile to trwa na fazę) i sprzątaniu po poprawce —
ale to ostatnie tylko z dodatkowym modułem, o który pytam niżej.

**Nie rozstrzyga** paczki kontekstu dla reviewerów (u każdego projektu jest inna i splata się z resztą), osi specyfikacji w fazach bez kodu (w teście wszystkie
fazy mają kod), poziomów myślenia per klasa, liczby warstw sprawdzania, kształtu planu, opisów skilli, podziału reguł między builderem a reviewerem ani kolejności
wdrożenia. Te sprawy idą przez run 3 sceptyków tak jak w planie panelu, każda z warunkiem odwrotu i pomiarem po wdrożeniu. Run 3 czeka na wynik testu — sceptycy
dostaną wtedy przy kształcie review, grupowaniu i testach mutacyjnych liczby z testu zamiast opisów.

## 8. Czego test nie powie

Nie powie nic o 91 uwagach, które urodziły się poza oglądaną fazą — w tym o sześciu z dziewięciu najpoważniejszych (P1). Nie zmierzy zapobiegania: projekty
zmieniają też buildera, a kod w teście napisał dzisiejszy builder. Nie sprawdzi E2E ani doradcy bazy. Nie policzy, ile kosztowałyby w pętli poprawek zgłoszenia
„spoza obu list” — policzy tylko, ile ich jest; nie każde z nich jest fałszywe, bo bot też nie widzi wszystkiego. Wiedzę projektu dostają warianty w dzisiejszej
formie, nie w docelowej.

## 9. Ryzyka i zatrzymania

Największe ryzyko to nierówne prompty: dzisiejsze są produkcyjne i dopracowane, A, B i C złożone z katalogów. Pokażę Ci złożone prompty przed pilotem.
Drugie to przeciek — agent, który przeczyta coś z przyszłości albo nasze notatki z analizy. Kopie są ucięte i odseparowane, ale i tak po każdym runie skrypt
przegląda zapisy agentów: odczyt spoza kopii, sięgnięcie do GitHuba albo internetu wyklucza fazę, a przy więcej niż jednej zatrzymuje test. Zatrzymuję się też sam,
gdy agent jedzie na innym modelu niż projektowany, gdy coś zmieniło się w oferty-online albo w szablonie, gdy sprawdzenie promptów dzisiejszego wariantu nie przejdzie,
gdy przekroczony jest limit kosztu, gdy sędzia dwa razy nie przejdzie kalibracji, gdy więcej niż co dziesiąty agent nie odda wyniku, gdy bramki nie wstaną w więcej
niż co trzeciej fazie albo gdy któryś agent wykona polecenie z wiadomości startowej zamiast swojego zadania.

## 10. Jak przebiega uruchomienie

Idziemy fazami, nie wariantami. Każda faza przechodzi kolejno pięć kroków: skrypt robi kopię kodu i uruchamia bramki, bez agentów; potem cztery warianty
jednocześnie na tej samej kopii, każdy w osobnej sesji; potem sędzia, gdy wszystkie cztery skończą; potem sceptycy na trafionych zgłoszeniach; na końcu skrypt
liczy koszt i decyduje, czy wolno zacząć następną fazę. Tak jest, bo sędzia potrzebuje kompletu czterech wariantów, bo przerwanie w dowolnym miejscu zostawia
pełne porównania dla skończonych faz, i bo wszystkie warianty jadą w tych samych warunkach. W pilocie puszczam jedną fazę naraz — to około 25 agentów jednocześnie
— żeby zobaczyć, jak znoszą to limity konta; w etapie głównym dwie–trzy fazy naraz, jeśli się da. Wszystko uruchamia jeden skrypt, który odpalam dopiero po Twojej zgodzie.

## 11. Twoje decyzje (2026-09-25)

1. **Plan zaakceptowany.** W nowej sesji piszę skrypty przygotowawcze, bez agentów. Przed pilotem pokazuję Ci złożone prompty A, B, C i koszt pilota.
2. **Moduł sprzątania po poprawce wchodzi.** 44 miliony to koszt samego pomiaru, nie problemu: tyle kosztuje odtworzenie 24 historycznych poprawek i sprawdzenie,
   czy kontrola poprawki w każdym wariancie złapałaby 31 błędów, które w nich powstały. Dwie poprawki idą już w pilocie jako próba, reszta w etapie głównym.
3. **Dzisiejszy wariant myśli na poziomie „high”.** To ustawienie nie przechodzi samo z mojej sesji — sesje testu uruchamiam osobno i poziom podaję im wprost.
   Skoro Twoje sesje chodzą i na „high”, i na „medium”, biorę „high”: dzisiejszy pipeline dostaje najlepsze realne ustawienie, więc jeśli A, B albo C i tak go
   wyprzedzą, wniosek jest pewny. Kosztuje to około jednej szóstej więcej w samym dzisiejszym wariancie (przy pełnym zakresie 251 zamiast 214 milionów). Potwierdzisz to przy zgodzie na pilot.
