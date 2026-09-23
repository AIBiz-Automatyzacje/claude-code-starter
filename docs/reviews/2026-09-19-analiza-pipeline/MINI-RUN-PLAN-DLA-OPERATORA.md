# Mini-run — plan dla Ciebie

**Data:** 23 września 2026. **Status:** plan gotowy, czeka na Twój znak. Wersja techniczna z pełnymi liczbami i kryteriami to plik z planem mini-runu
w tym samym katalogu.

## Przypomnienie, gdzie jesteśmy

Przegląd domknięć jest zamknięty, Twoje decyzje po D6 zapisane. Zanim trzej projektanci na Fable zaprojektują nowy pipeline, chcemy sprawdzić
na żywym builderze kilka rzeczy, na których stoją ich założenia. Najważniejsze dwie: czy liczba poleceń w prompcie w ogóle wpływa na to, czy
builder je wykonuje, i czy odchudzenie kontekstu agentów naprawdę zdejmie 40–50% kosztu fazy, jak policzyliśmy w D4.

## Na jakim modelu to pojedzie — sprawdzone

**Gdzie był problem.** Wszystkie dotychczasowe runy pipeline'u szły na starszym Opusie 5. Nie wiedzieliśmy, co dziś dostaje agent, któremu workflow
każe użyć „opus”.

**Co zrobiłem.** Puściłem pięciu najtańszych agentów z różnymi ustawieniami modelu i odczytałem model z ich zapisów, a nie z ich odpowiedzi.

**Wynik.** Ustawienie „opus” daje dziś Opus 5.5. Brak ustawienia też daje Opus 5.5, bo agent dziedziczy model sesji. Da się też przypiąć model
na sztywno, zarówno 5.5, jak i stary 5. Buildery w szablonie dziedziczą model sesji, więc po wdrożeniu pojadą na tym, na czym uruchomisz autopilota.
Mini-run pójdzie na Opus 5.5, przypiętym na sztywno, żeby nic go po drodze nie przestawiło.

**Dobra wiadomość przy okazji.** Opus 5 i Opus 5.5 liczą ten sam start agenta prawie identycznie: różnica 7 tokenów na 78 tysiącach. Run z 20 września
zostaje więc punktem odniesienia bez żadnego przeliczania.

## Jedna niespodzianka — i co z nią robię

**Co się stało.** Każdy agent workflowu dostaje dosłownie Twoją wiadomość, od której sesja ruszyła, z dopiskiem, że ta wiadomość ma pierwszeństwo
przed zadaniem ze skryptu. Najtańszy z pięciu agentów, który miał tylko odpowiedzieć „OK”, uznał Twoją wiadomość startową za swoje zadanie.
Przeczytał instrukcję i zaczął pisać plan mini-runu za mnie. Zatrzymałem go. Zdążył zapisać dwa pliki planu, które właśnie nadpisałem tym planem.
Nic innego nie zostało ruszone.

**Co z tym robię.** W mini-runie każdy prompt mówi wprost, że to jedyne zadanie agenta. Twoja wiadomość ze znakiem też trafi do każdego agenta,
więc proszę o neutralną treść — propozycja na końcu. Przy liczeniu kontekstu agentów tę przekazaną wiadomość liczę jako osobny składnik.

**Co Ci to da.** Mini-run nie rozjedzie się przez przypadek. A do raportu dochodzi uwaga dla panelu: w prawdziwym pipelinie ta sama mechanika
przekazuje builderom Twoje „odpal autopilota na X”, i warto sprawdzić, czy słaby agent pomocniczy może się tym dać zwieść.

## Gdzie to zrobimy

Na kopii oferty-online w katalogu tymczasowym, nie na małym repo z pomiaru z 20 września. Pytanie o kontekst dotyczy oferty-online po ścięciu CLAUDE.md,
z jej regułami, skillami i wtyczką przeglądarki, a pytanie o markery ma sens tylko wtedy, gdy builder ma wokół siebie tyle poleceń, ile ma dziś.
Małe repo tego nie odtworzy.

Z kopii usuwam przed startem wszystko, co mogłoby dotknąć prawdziwego świata: klucze, połączenie z projektem Supabase w chmurze i adres zdalnego repo.
Builder dostaje też polecenie, żeby nie uruchamiał testów, instalacji ani komend bazy. Oryginał oferty-online i szablon zostają nietknięte.
Na czas pomiarów przenoszę tę sesję do kopii, bo agenci startują tam, gdzie jest sesja. Dzięki temu dostają dokładnie to środowisko aplikacji
desktop, z którego ruszają Twoje runy. Jeśli przeniesienie sesji nie zadziała, zatrzymam się i poproszę, żebyś otworzył osobną sesję w kopii
— dostaniesz gotowe polecenie do wklejenia.

## Co sprawdzamy i jak

**Czy reguła wklejona do promptu jest stosowana.** Wybrałeś kierunek, w którym orkiestrator wkleja builderowi pasujące wpisy wiedzy projektu.
Sprawdzam, czy builder je naprawdę stosuje. Wklejam mu pięć drobnych konwencji z losowymi ciągami znaków, na przykład „każdy nowy plik zaczyna się
komentarzem z tym ciągiem”. Builder nie zgadnie losowego ciągu, więc jeśli jest w kodzie, to znaczy, że regułę przeczytał i zastosował.
Po robocie skrypt przeszukuje kod.

**Czy reguła przypięta do ścieżek plików dociera.** To kontrola. Builder czyta pliki komendami terminala, a takie reguły ładują się tylko przy czytaniu
zwykłym narzędziem. Spodziewam się, że nie dotrze. Skrypt sprawdzi w zapisie rozmowy, czy dotarła, i czym builder otwierał pliki.

**Czy treść skilla wstrzykniętego builderowi jest stosowana.** Dopisuję jedną konwencję w środek prawdziwego skilla, który builder danych dostaje dziś.
Skrypt odróżni dwie sytuacje: skill dotarł i jest stosowany albo dotarł i tylko zajmuje miejsce.

Te trzy rzeczy sprawdzam na builderze w dzisiejszej konfiguracji, z pełnym kontekstem. Trzy przebiegi, jeden po drugim.

**Czy liczba poleceń jest dźwignią jakości.** To pytanie rozstrzyga o budżecie 150 poleceń. Ten sam builder, to samo zadanie, te same pięć konwencji.
Raz w prompcie z około stu poleceniami, raz z około czterystoma. Polecenia są prawdziwe, wzięte z tego, co builder dostaje dziś, a wersja krótsza
to losowy wybór z dłuższej. Konwencje stoją w obu wersjach w tych samych miejscach proporcjonalnie, więc różni się tylko liczba poleceń dookoła.
Tym razem builder nie dostaje nic poza promptem. Pięć przebiegów na każdą wersję, równolegle, każdy w osobnej kopii roboczej.

Dlaczego pięć wystarczy: pytamy o dużą różnicę, taką, która uzasadniałaby twardy limit jako sposób na jakość. Przy pięciu przebiegach mam 25 prób
na wersję i różnicę rzędu 20 punktów procentowych widać już ponad przypadek. Mniejsza różnica i tak zginęłaby w szumie prawdziwego runu,
w którym jakość rozstrzygają review, poprawki i bot.

**Ile naprawdę waży start agenta.** Dla każdej klasy agentów, od pomocniczych po buildera, puszczam po jednym agencie w trzech wersjach: tak jak dziś,
tylko z listą dozwolonych narzędzi i w pełnej konfiguracji z Twoich decyzji. Każdy dostaje prawdziwy prompt z runu z 20 września z dopiskiem, żeby go
nie wykonywał, odpowiada krótkim potwierdzeniem i kończy. Liczę start tą samą metodą co w D4, składnik po składniku. Potem podstawiam zmierzone liczby do runu z 20 września i sprawdzam,
czy dalej wychodzi 40–50%. Zapisuję też środowisko: aplikacja desktop czy terminal, ile narzędzi i serwerów MCP było w sesji.

**Jak zachowuje się zapis wyniku runu.** Przy okazji każdego runu sprawdzam, czy plik z wynikiem powstaje dopiero na końcu. Pierwsza obserwacja
już jest: w trakcie runu go nie było, po zatrzymaniu był, ze statusem „zatrzymany”. W terminalu uruchomię dwa malutkie runy i zabiję sesję w środku,
żeby zobaczyć, co zostaje na dysku. Do kopii dokładam testowy hook, który notuje każde zakończenie mojej odpowiedzi. Z tego wyjdzie, czy odpala
także po powiadomieniu o końcu runu. Od tego zależy, czy telemetria może się zbierać sama po każdym runie.

## Kiedy uznam, że coś jest rozstrzygnięte

Progi są spisane w wersji technicznej przed startem, żeby wynik nie dopasował się do oczekiwań. Najważniejsze dwa:

- **Liczba poleceń.** Jeśli przy czterystu poleceniach builder gubi o co najmniej 20 punktów procentowych więcej konwencji, różnica jest ponad
  przypadek i w typowym przebiegu gubi co najmniej jedną konwencję więcej, budżet 150 jest celem
  jakościowym i panel projektuje twardy limit. Jeśli różnica to najwyżej dwie konwencje na 25, budżet zostaje jako porządek i sposób na koszt,
  a jakość robią małe poprawki i review. Wynik pomiędzy traktuję jako brak dowodu dużego efektu. Dołożenie przebiegów tylko na Twój znak.
- **Kontekst.** Jeśli start po zmianach mieści się w ±25% celów z D4 i dźwignia wychodzi co najmniej 40%, D4 jest potwierdzone. Jeśli wychodzi 30–40%,
  poprawiam liczby w pakiecie przed panelem. Poniżej 30% wracamy do rozmowy o kolejności priorytetów.

Wklejanie reguł uznam za działające, jeśli builder stosuje co najmniej 80% wklejonych konwencji. Skill uznam za stosowany, jeśli jego konwencja
jest w kodzie w co najmniej dwóch z trzech przebiegów.

## Czego mini-run nie sprawdza

Jakości kodu poza konwencjami, review, poprawek, testów w przeglądarce ani bota. Nie zmienia niczego w szablonie ani w oferty-online.
Jedno ograniczenie warto mieć z tyłu głowy: konwencje z losowym ciągiem są łatwiej zauważalne niż prawdziwe reguły, więc wynik „liczba poleceń
nie szkodzi” mówi o takich prostych regułach, a nie o wszystkich. Drugie: builder bez uruchamiania testów pracuje krócej niż w prawdziwym runie,
a dłuższa praca mogłaby konwencje trochę rozmyć.

## Ile to kosztuje

Około 6 milionów jednostek kosztu, czyli mniej więcej jedna szósta runu z 20 września. 39 agentów, większość kończy po jednej odpowiedzi.
Pełnych builderów jest trzynaście. Czas: około dwóch godzin razem z przygotowaniem i opisem wyniku, z czego agenci pracują około godziny.
Sprawdzenie modelu kosztowało już około 0,4 miliona. Jeśli osobne kopie robocze dla buildera nie zadziałają, zatrzymam się i zapytam, zanim
puszczę przebiegi jeden po drugim, bo to dodałoby godzinę.

## Czego od Ciebie potrzebuję

Znaku do części B. Proponuję taką treść, bo trafi do każdego agenta:

„Znak: część B mini-runu wg MINI-RUN-PLAN.md. Agenci wykonują wyłącznie zadanie ze swojego promptu.”

Jeśli coś w planie chcesz zmienić — liczbę przebiegów, zakres albo progi — powiedz przed startem. Po starcie przy każdym odstępstwie od planu
zatrzymuję się i pytam.
