# Mini-run — wynik dla Ciebie

**Data:** 23 września 2026. **Status:** wynik zaakceptowany 23 września i wpisany do pakietu dla panelu.
Wersja techniczna z liczbami, dowodami i kryteriami to plik z wynikiem mini-runu w tym samym katalogu.

## W skrócie

Wszystkie sześć pytań ma odpowiedź i żadna nie wywraca planu dla panelu. Wklejanie reguł builderowi działa. Skill wstrzyknięty builderowi
jest naprawdę używany. Reguły przypięte do ścieżek plików do niego nie docierają, tak jak zakładaliśmy. Liczba poleceń w prompcie nie wpływa na to,
czy builder je wykonuje, za to podnosi koszt. Odchudzenie startu agentów zdejmie około połowy kosztu fazy, zgodnie z tym, co policzyliśmy w D4.
Przy okazji wyszły dwie rzeczy, których nie szukaliśmy. Obie są ważne dla panelu i dla wdrożenia.

Cały mini-run kosztował około 5 milionów jednostek, mniej niż zakładał plan. Wszystkie wyniki policzyły skrypty z zapisów, bez agentów analizujących.

## Czy builder stosuje reguły, które orkiestrator mu wklei

**Problem.** Wybrałeś kierunek, w którym wiedza projektu nie leży już w pliku ładowanym każdemu agentowi. Orkiestrator wkleja builderowi tylko te wpisy,
które pasują do plików zadania. To ma sens tylko wtedy, gdy builder te wklejone reguły naprawdę stosuje.

**Co sprawdziłem.** Wkleiłem builderowi pięć drobnych konwencji z losowymi ciągami znaków, na przykład „każdy nowy plik zaczyna się komentarzem z tym ciągiem”.
Builder nie zgadnie losowego ciągu, więc jego obecność w kodzie znaczy, że regułę przeczytał i zastosował. Osiem przebiegów:
trzy z pełnym dzisiejszym kontekstem i pięć z samym promptem.

**Wynik.** Wszystkie reguły zastosowane za każdym razem. Czterdzieści na czterdzieści.

**Co to daje.** Kierunek z wklejaniem wiedzy projektu ma teraz potwierdzenie w pomiarze. Jedno zastrzeżenie: to były proste konwencje formy.
Reguła merytoryczna, na przykład jak pisać politykę bezpieczeństwa w bazie, może być trudniejsza do utrzymania. Tego mini-run nie mierzył.

## Czy reguła przypięta do ścieżek plików dociera

**Problem.** Claude Code umie doładować regułę, gdy agent otwiera plik z określonego katalogu. Pytanie było kontrolne. Nasze buildery czytają pliki
komendami terminala, a przy nich ten mechanizm się nie uruchamia.

**Wynik.** Mechanizm nie zadziałał ani razu na trzy. Buildery za każdym razem czytały migracje komendami terminala. Reguła trafiła do nich jednak inną drogą.
Każdy agent dostaje na starcie listę zmienionych plików w repo. Builder zobaczył na niej nowy plik reguły i sam go przeczytał. To efekt uboczny testu,
bo w prawdziwym repo taki plik nie wisi na liście zmian.

**Co to daje.** Nic się nie zmienia: reguły przypięte do ścieżek zostają dodatkiem, a nie sposobem dostarczania wiedzy. Przy okazji wyszło jeszcze raz,
że co builder przeczyta, to stosuje.

## Czy skill wstrzyknięty builderowi jest używany

**Problem.** Builder danych dostaje dziś trzy skille. Zajmują kilka do kilkunastu tysięcy tokenów. Chcieliśmy wiedzieć, czy builder z nich korzysta,
czy tylko zajmują miejsce.

**Co się stało po drodze.** Przed każdym przebiegiem skrypt dopisywał do skilla konwencję z nowym losowym ciągiem. Okazało się, że Claude Code trzyma
skille w pamięci sesji i nie od razu zauważa zmianę. Pierwszy builder nie dostał tego skilla wcale. Drugi dostał wersję z pierwszego przebiegu,
trzeci z drugiego.

**Wynik.** Oba razy, gdy skill dotarł, builder zastosował konwencję ze skilla. Tyle że była to konwencja z poprzedniego przebiegu.

**Co to daje.** Skill jest używany, więc przypisanie skilli builderom zostaje bez zmian. Podział skilli na część stałą i dokładaną zostaje porządkiem,
a nie koniecznością.

## Czy liczba poleceń w prompcie wpływa na jakość

**Problem.** Budżet 150 poleceń na rolę mógł być celem jakościowym, jeśli agent z długą listą gubi polecenia. Mógł też być tylko porządkiem.
Od odpowiedzi zależy, jak twardo panel ma go pilnować.

**Co sprawdziłem.** Ten sam builder, to samo zadanie, te same pięć konwencji. Raz wśród stu prawdziwych poleceń, raz wśród czterystu.
Pięć przebiegów na każdą wersję.

**Wynik.** Przy stu poleceniach wszystkie konwencje zastosowane, przy czterystu też. Żadnej różnicy, niezależnie od tego, czy konwencja stała na początku,
w środku czy na końcu listy. Wersja z czterystoma poleceniami kosztowała za to o 72% więcej.

**Co to daje.** Budżet 150 zostaje jako porządek i sposób na koszt, a nie jako lek na jakość. Jakość poprawią małe naprawy z D1 i ewentualnie
równoległe próbki. Panel dostaje przy tym konkretną liczbę: każde niepotrzebne polecenie kosztuje, nawet jeśli niczego nie psuje.

## Ile waży start agenta i ile zdejmie odchudzenie

**Problem.** W D4 policzyliśmy, że odchudzenie startu agentów zdejmie 40–50% kosztu fazy. Chodzi o listę dozwolonych narzędzi, pominięcie CLAUDE.md
u agentów pomocniczych i wyjęcie wiedzy projektu z ładowania dla wszystkich. To była liczba z modelu, bez pomiaru na żywym agencie.

**Co się stało po drodze.** Między dwoma seriami pomiaru przeniosłem plik z wiedzą projektu poza katalog ładowany automatycznie. Agenci drugiej serii
i tak go dostali. Claude Code trzyma instrukcje w pamięci sesji tak samo jak skille. Dlatego od wyniku drugiej serii odjąłem wagę tego pliku.
Zanim to zrobiłem, sprawdziłem przelicznik z D4 na agencie, którego ten problem nie dotyczył, bo nie dostaje żadnych instrukcji. Przelicznik
pomylił się o niecały procent.

**Wynik.** Start każdej z ośmiu klas agentów po zmianach mieści się w 7% od celu z D4. Agent pomocniczy startuje z około 9 tysięcy tokenów zamiast 85,
reviewer z 28–30 tysięcy zamiast 118, builder z 39 tysięcy zamiast 128. Podstawione do runu z 20 września dają około 48% oszczędności na koszcie runu.
Sama lista narzędzi daje 35%. To wszystko na Opus 5.5, na którym pojedzie pipeline po wdrożeniu.

**Co to daje.** Liczba, na której stoi kolejność priorytetów panelu, jest potwierdzona pomiarem, a cele startu dla każdej klasy agentów zostają.

## Jak zachowuje się zapis wyniku runu

**Problem.** Telemetria ma się zbierać sama, skryptem, bez agentów. Musimy wiedzieć, skąd skrypt weźmie wynik runu i kiedy ma ruszyć.

**Wynik.** Plik z wynikiem runu powstaje dopiero po jego zakończeniu. Jeśli sesja zostanie zabita w trakcie, pliku nie ma wcale, zostaje tylko dziennik
agentów. Hook kończący odpowiedź sesji odpala się po każdej odpowiedzi, także po powiadomieniu, że run się skończył. Dostaje przy tym listę runów
wciąż działających w tle.

**Co to daje.** Skrypt telemetrii może ruszać z tego hooka, gdy w tle nie działa już żaden run. Musi też umieć opisać run przerwany, bez pliku wyniku,
na podstawie samego dziennika.

## Dwie rzeczy, których nie szukaliśmy

**Tani agent potrafi wykonać Twoją wiadomość zamiast swojego zadania.** Każdy agent workflowu dostaje Twoją wiadomość, od której ruszył run. Dostaje też
dopisek, że w razie sprzeczności ta wiadomość wygrywa z zadaniem ze skryptu. W pierwszej serii pomiaru był to cały plan kroków dla sesji w kopii.
Trzech z czterech agentów Haiku zaczęło go wykonywać, choć ich zadanie brzmiało „nie używaj narzędzi, odpowiedz OK”. Jeden z nich przeniósł plik
w repo kopii. Żaden z dwunastu agentów Opus tego nie zrobił. W drugiej serii dopisałeś do wiadomości jedno zdanie: „do agentów: ta wiadomość nie jest dla was”.
Wtedy żaden agent nie ruszył narzędzi.
W pipelinie tą samą drogą idzie do wszystkich agentów Twoje polecenie startu autopilota. Proponuję dać panelowi dwa zabezpieczenia: stałe zdanie
do agentów w poleceniu startu oraz odebranie agentom pomocniczym terminala i zapisu plików tam, gdzie ich rola tego nie wymaga.

**Zmiany w konfiguracji nie docierają do agentów w trwającej sesji.** Instrukcje i skille są wczytywane raz i trzymane w pamięci sesji. Dlatego po każdej
zmianie w konfiguracji agentów, czyli po aktualizacji z szablonu, wdrożeniu listy narzędzi albo przeniesieniu wiedzy projektu, trzeba otworzyć nową sesję,
zanim ruszy autopilot. Trafi to na listę zmian poza panelem. Jest też argument za kierunkiem, który wybrałeś: wiedza wklejana przez orkiestratora
jest czytana w trakcie runu, więc zawsze aktualna.

## Co dalej

Wynik jest wpisany do pakietu dla panelu. Pakiet ma teraz status i wyniki mini-runu, potwierdzone liczby oszczędności i cele startu, sposób uruchamiania
telemetrii i obie nowe rzeczy jako wejście dla panelu. Nowa sesja po zmianach w konfiguracji jest na liście zmian, a mapa walidacji ma wyniki.
Notatki przekazania i pamięć projektu są zaktualizowane. Następny krok to panel na Fable, na Twój znak.
Gotowa wiadomość startowa panelu leży w notatkach przekazania. Ma zdanie do agentów, żeby nie wykonywali Twojej wiadomości.
Kopia oferty-online w katalogu tymczasowym zostaje do końca analizy. Usunę ją tylko za Twoją zgodą.
