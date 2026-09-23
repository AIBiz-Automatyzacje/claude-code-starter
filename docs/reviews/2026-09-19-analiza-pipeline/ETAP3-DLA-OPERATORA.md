# Etap 3 — czy panel może startować (wersja dla Kacpra)

Data: 2026-09-20. To jest ludzka wersja dokumentu `ETAP3-ROZSTRZYGNIECIE.md`. Tamten ma wszystkie dowody, ścieżki i liczby. Ten ma odpowiedzieć na jedno
pytanie i pokazać Ci każdą z dziewiętnastu luk, które znalazł krytyk, także te, które uznałem za mniej groźne.

## O co chodziło w tym etapie

Mamy za sobą model kosztu, ocenę każdego reviewera, analizę uwag bota, research zewnętrzny i cztery pomiary. Na tym wszystkim ma stanąć panel,
który zaprojektuje pipeline „po". Zanim panel ruszy, jeden agent dostał zadanie: znaleźć dziury. Czego nie sprawdziliśmy, gdzie wniosek stoi na jednym
pomiarze, gdzie dwa dokumenty mówią co innego, którego elementu nikt nie dotknął. Nie miał nic proponować i nie miał podważać Twoich decyzji.

## Odpowiedź

**Panel może startować, ale nie od razu.** Krytyk znalazł dziewiętnaście luk i cztery z nich uznał za blokujące. Sprawdziłem każdą z tych czterech
w dokumentach i w kodzie szablonu. Jedną zamknąłem od ręki przeliczeniem. Dwie zamykają się w około dwie godziny pracy skryptami, bez agentów.
Jedna wymaga jednego zdania od Ciebie. Pozostałe piętnaście to ryzyka, które panel dostanie jako jawne założenia i które trafią do raportu końcowego.

Nic z tego, co znalazł krytyk, nie unieważnia żadnej Twojej decyzji. Zmienia się jedna liczba i dochodzi kilka rzeczy, o których panel musi wiedzieć.

Każdą lukę opisuję tak samo: co znalazł krytyk, skąd to się bierze, co z tym robimy i co Ci to da. Przy każdej jest też mój werdykt:
czy zatrzymuje panel, czy idzie do raportu jako ryzyko.

---

## Część 1. Cztery luki, które krytyk uznał za blokujące

### Luka 1. Oszczędność na kontekście agentów była policzona dla wariantu, którego nie wybrałeś

**Co znalazł krytyk.** Pomiary mówiły: największa oszczędność to odchudzenie startu każdego agenta, trzydzieści do czterdziestu procent kosztu fazy.
Ta liczba zakładała, że każdy agent startuje z minimalnym kontekstem, bez CLAUDE.md i bez skilli.

**Skąd to się bierze.** Po pomiarach zdecydowałeś inaczej: buildery i reviewerzy mają dostawać CLAUDE.md, buildery zachowują skille, dochodzi wycinek
wiedzy z learned-patterns. To słuszne, ale nikt nie przeliczył, ile z oszczędności zostaje po tej decyzji. Druga rzecz: odchudzony start wymaga osobnego
pliku definicji dla każdej roli agenta, a taki plik ma dziś dziewięć ról z około trzydziestu. Reszta startuje jako agent ogólny i nie ma gdzie wpiąć
odchudzenia.

**Co z tym robimy.** Przeliczyłem to na liczbach z pomiarów. Zostaje dwadzieścia pięć do trzydziestu pięciu procent zamiast trzydziestu do czterdziestu.
*(Korekta z 23 września, przegląd D4, przyjęta: ta arytmetyka zaniżała wynik. Policzone agent po agencie na prawdziwych zapisach wychodzi około
czterdziestu do pięćdziesięciu procent kosztu fazy po ścięciu CLAUDE.md. Szczegóły w notatce z przeglądu D4.)*
Kolejność priorytetów się nie zmienia, bo następna zweryfikowana oszczędność to osiem do dziesięciu procent. Brakujące pliki agentów to praca do zrobienia,
nie problem z pomiarem, i panel dostanie to jako koszt wdrożenia.

**Co Ci to da.** Panel projektuje pod prawdziwą liczbę, a raport nie obieca więcej, niż da się dowieźć.

**Mój werdykt:** nie zatrzymuje panelu. Liczba poprawiona, reszta do raportu.

### Luka 2. Główny lek na ucieczki do bota nie ma żadnego pomiaru

**Co znalazł krytyk.** Bot znajduje po naszym review około dwustu prawdziwych defektów. Naszą odpowiedzią są polecenia-listy w promptach reviewerów,
z szacunkiem, że domkną sześćdziesiąt do siedemdziesięciu procent tych ucieczek. Ten szacunek pochodzi z ocen agentów, nie z żadnego runu.

**Skąd to się bierze.** Research pokazał, że modele po cichu pomijają instrukcje, gdy jest ich dużo. To samo badanie uzasadnia polecenia-listy
i jednocześnie tłumaczy, dlaczego mogą nie zadziałać. Nikt nie policzył, ile instrukcji dostaje dziś jeden reviewer, licząc prompt, wspólne bloki,
CLAUDE.md, reguły kodowania i skille. To może być kilkadziesiąt, może być kilkaset. Mini-run zaplanowany przed panelem sprawdza tylko, czy jedna
instrukcja dociera, a nie czy trzydziesta jest wykonywana.

**Co z tym robimy.** Skuteczności poleceń-list nie da się zmierzyć przed ich wdrożeniem, więc panel nie może na to czekać. Dostanie je jako założenie
z warunkiem odwrotu: jeśli po pięciu zadaniach bot dalej znajduje defekty danej klasy, wracamy do poprzedniego mechanizmu. Liczbę instrukcji na agenta
policzę skryptem przed panelem, żeby każdy projekt miał twardy budżet.

**Co Ci to da.** Pipeline „po" nie będzie tańszy i gorszy jednocześnie, bo każda oszczędność na review ma wpisany bezpiecznik.

**Mój werdykt:** nie zatrzymuje panelu, ale to największe ryzyko całej analizy. Liczenie instrukcji robimy przed panelem.

### Luka 3. Nie wiemy, skąd biorą się nowe findingi po naprawie

**Co znalazł krytyk.** Gdy review powtarza się po naprawie, znajduje kilkanaście nowych rzeczy. Pomiar uznał, że to review kodu naprawczego,
bo prawie wszystkie nowe findingi leżą w plikach, które naprawa zmieniła.

**Skąd to się bierze.** Naprawa zmieniła dwadzieścia trzy pliki. Finding w takim pliku może być defektem, który naprawa wprowadziła, albo defektem,
który tam był od początku i pierwszy review go nie zauważył. To dwa różne problemy z dwoma różnymi rozwiązaniami, a pomiar ich nie rozróżnił.
W dwóch innych powtórkach połowa nowych findingów była w plikach nietkniętych, więc składnik „przeoczone" na pewno istnieje.

**Co z tym robimy.** Trzydzieści trzy findingi do przeczytania i przypisania: wprowadzone naprawą, istniały wcześniej, kod nietknięty.
Około godziny pracy w sesji głównej, bez agentów.

**Co Ci to da.** Panel dostanie prawdziwą odpowiedź na pytanie, czy pierwszy review za mało znajduje, czy naprawy psują. Od tego zależy,
czy warto płacić za równoległe próbki review, czy wystarczy mocniejszy sceptyk.

**Mój werdykt:** zatrzymuje panel, bo fakt jest tani i bez niego panel dostaje pytanie postawione na złym podziale.

### Luka 4. Dwa dokumenty mówią co innego o osi test-coverage

**Co znalazł krytyk.** Research z etapu 2 zapisał: trzy narzędzia mechaniczne przejmą klasę słabych testów, a agent zostaje tylko na resztki,
do scalenia z inną osią. Pomiary zapisały: żadnej dodatkowej osi nie da się skasować. Panel dostałby oba zdania naraz, a chodzi o oś, która daje
najwięcej findingów ze wszystkich.

**Skąd to się bierze.** Degradacja z researchu była warunkowa: miała sens, jeśli narzędzia przejmą klasę. Jedyne zmierzone narzędzie trafiło zero
z trzydziestu jeden przypadków. Dwa pozostałe nie mają pomiaru. Przesłanka zniknęła, ale zapis został.

**Co z tym robimy.** Moje odczytanie: obowiązują pomiary, bo są późniejsze i były pomyślane jako warunek wejścia. Oś zostaje, narzędzia to dodatki,
scalenie z inną osią jest opcją tylko z bezpiecznikiem i dopiero po pomiarze pozostałych narzędzi. Potrzebuję Twojego jednego zdania, że tak ma być.

**Co Ci to da.** Trzy projekty panelu dostaną jeden mandat zamiast dwóch i sędziowie będą mogli je porównać.

**Mój werdykt:** zatrzymuje panel do Twojego słowa. Żadnego pomiaru nie trzeba.

---

## Część 2. Piętnaście luk, które idą do raportu jako ryzyka

### Luka 5. Pomiary i Twoje decyzje mówią co innego o CLAUDE.md i o czytaniu plików

**Co znalazł krytyk.** Dokument z pomiarów mówi: każdy agent bez CLAUDE.md, buildery czytają pliki narzędziem Read. Twoja decyzja po pomiarach mówi
odwrotnie: CLAUDE.md trafia do builderów, tryb bypass zostaje, więc czytanie Bashem zostaje. Do tego stara hipoteza „Read zamiast Bash" nadal siedzi
w pakiecie, który trafi do projektantów.

**Skąd to się bierze.** Pomiary spisano przed rozmową, decyzje po niej, a nikt nie dopisał do pomiarów, że część wniosków jest już nieaktualna.

**Co z tym robimy.** W pakiecie wejściowym panelu zapisuję wprost: obowiązuje Twoja decyzja, tamte dwa zdania są nieaktualne.

**Co Ci to da.** Trzy projekty nie rozstrzygną tej sprzeczności każdy inaczej, więc sędziowie będą porównywać to samo.

### Luka 6. Mocniejszy sceptyk przyjęty z literatury, a naszych własnych liczb są trzy różne

**Co znalazł krytyk.** Zdecydowałeś, że sceptyk dostaje sam zarzut bez uzasadnienia autora, bo badania mówią, że to obala cztery razy więcej
fałszywych findingów. Ale nasze dane o tym, ile dziś obalają sceptycy, dają trzy różne liczby zależnie od źródła, a rozbicia na osie nie ma wcale,
bo pole w danych okazało się artefaktem.

**Skąd to się bierze.** Nikt nie policzył obaleń jedną metodą na jednej próbie. Nie wiemy więc, która oś produkuje najwięcej fałszywych findingów,
czyli gdzie mocniejszy sceptyk pomoże, a gdzie zacznie kasować prawdziwe.

**Co z tym robimy.** Decyzja zostaje. Do raportu idzie zapis: mocniejszy sceptyk będzie stosowany jednakowo do wszystkich osi, a jego siła jest
z literatury. Po wdrożeniu puszczamy go na archiwalne findingi o znanych werdyktach i sprawdzamy, ile prawdziwych by skasował.

**Co Ci to da.** Będziesz wiedział, że bramki review po zmianie mogą oznaczać co innego niż dziś, i będzie jasny sposób, jak to sprawdzić.

### Luka 7. Model kosztu opisuje maszynerię, której w szablonie już nie ma

**Co znalazł krytyk.** Fundament analizy, czyli podział kosztu fazy na wykonanie, review, naprawę i resztę, pochodzi z runów w oferty-online.
To repo nie dostało wrześniowych napraw, bo synchronizacja szablonu jest tam zablokowana. Z trzynastu runów tylko jeden szedł na aktualnej wersji,
i to jedna faza bez testów E2E.

**Skąd to się bierze.** Chciałeś wniosków o szablonie, a dane są z jednego projektu na starej wersji.

**Co z tym robimy.** Naprawy wrześniowe dotyczyły raportowania, stanu i formatów, nie liczby agentów na fazę, więc podział kosztu prawdopodobnie
się broni. Do raportu idzie wyraźna uwaga, że liczby „przed" opisują wersję sprzed napraw.

**Co Ci to da.** Uczciwe porównanie „przed i po", bez udawania, że punkt odniesienia jest dokładniejszy, niż jest.

### Luka 8. Oszczędność pięćdziesięciu tysięcy tokenów jest oszczędnością na Twoim koncie, nie na każdym

**Co znalazł krytyk.** Największa zmierzona oszczędność, czyli lista dozwolonych narzędzi u agenta, wynika głównie z tego, że Twoje konto ma
około dziewięciuset narzędzi MCP i trzysta skilli. W czystym repo testowym różnica była wyraźnie mniejsza. Do tego audyt pluginów i MCP przeniosłeś
na osobny etap, więc część tej samej oszczędności policzymy dwa razy.

**Skąd to się bierze.** Pomiar był na Twoim koncie, a wnioski mają być o szablonie dla każdego.

**Co z tym robimy.** Kierunek zostaje, bo lista narzędzi jest największą pojedynczą dźwignią niezależnie od konta. W raporcie liczba dostaje dopisek
„konto z pełnym MCP", a przy audycie konta pilnujemy, żeby nie liczyć tego samego dwa razy.

**Co Ci to da.** Realna oczekiwana oszczędność dla nowego projektu, nie najlepszy przypadek.

### Luka 9. Pomiar „linter łapie jedną uwagę na dziewięćdziesiąt siedem" mówi o metodzie tyle co o linterze

**Co znalazł krytyk.** Z dwustu uwag bota ponad sto nie ma numeru linii i wypadło z pomiaru. Trafienie liczyliśmy tylko wtedy, gdy linter zgłosił
problem w tej samej linii plus minus trzy. Reguła, która zgłasza ten sam problem na początku funkcji zamiast w jej środku, liczy się jako pudło,
choć w praktyce zapobiegłaby uwadze. Sam pomiar pokazuje, że reguły lintera odpaliły w tych plikach kilkadziesiąt razy.

**Skąd to się bierze.** Dopasowanie po linii jest proste do policzenia skryptem, ale zbyt surowe dla tego pytania.

**Co z tym robimy.** Wniosek z pomiaru jest ostrożny, czyli nie kasujemy osi review, więc nie grozi nam błąd nieodwracalny. W raporcie liczba
„jedna na dziewięćdziesiąt siedem" idzie zawsze razem z metodą i zakresem próby.

**Co Ci to da.** Nie podasz nikomu, ani sobie, złego powodu, dla którego bot znajduje więcej niż my.

### Luka 10. Zastąpienie osi performance stoi na narzędziu, którego nie uruchomiliśmy ani razu

**Co znalazł krytyk.** Oś performance ma zniknąć na rzecz trzech rzeczy: budżetu rozmiaru aplikacji, doradcy Supabase i pięciu linijek w innej osi.
Część reguł bezpieczeństwa też ma przejąć doradca Supabase. Doradcy nie zmierzyliśmy, bo Docker był wyłączony, a budżet rozmiaru nie ma jeszcze
ani jednego trafienia w szablonie.

**Skąd to się bierze.** Uznałeś, że zmierzymy to przy wdrożeniu bramki, i to jest w porządku, ale panel musi wiedzieć, że to założenie.

**Co z tym robimy.** Etap 1 zapisał już bezpiecznik: jeśli bot znajdzie więcej niż jeden poważny defekt tej klasy na pięć faz, oś wraca.
Panel dostaje to jako założenie z bezpiecznikiem, nie jako fakt.

**Co Ci to da.** Błąd, jeśli się zdarzy, będzie odwracalny i wykryty po pięciu fazach, nie po roku.

### Luka 11. Testy E2E to jedyny element bez zamiennika i główne źródło zatrzymań, a nikt nie rozstrzygnął, co z nimi

**Co znalazł krytyk.** Research potwierdził, że E2E nie da się zastąpić narzędziem, i na tym się zatrzymał. Tymczasem prawie każde zatrzymanie
autopilota to E2E, a powtórki po tych zatrzymaniach kosztowały ponad milion tokenów w dwóch zadaniach. Przegląd runów dał trzy konkretne
rekomendacje: parametryzacja środowiska E2E w szablonie, traktowanie plików zadania jako własnych zamiast zatrzymywania, rozróżnianie przyczyn
pominięcia testu. Żadna nie weszła do żadnej decyzji.

**Skąd to się bierze.** Analiza skupiła się na koszcie agentów, a E2E to koszt zatrzymań i powtórek, który liczy się inaczej.

**Co z tym robimy.** Każdy z trzech projektów panelu ma powiedzieć, co robi z zatrzymaniami E2E. Parametryzacja E2E idzie na listę zmian szablonu
niezależnie od panelu, bo bez niej oferty-online nie dostanie żadnej naprawy.

**Co Ci to da.** Mniej zatrzymań w środku runu i koniec z milionem tokenów na powtórki, które nic nowego nie znalazły.

### Luka 12. Nie mamy słownika klas defektów, a trzy mechanizmy mają być po nim kluczowane

**Co znalazł krytyk.** Etap 1b sam stwierdził, że trzej klasyfikatorzy nazwali tę samą klasę na trzy sposoby i że bez słownika następny pomiar
będzie nieporównywalny. Etap 1 i etap 1b już się rozjeżdżają: jeden ma klasę „cykl życia i współbieżność", drugi dzieli ją na dwie. Twoja decyzja
o zamkniętym słowniku dotyczy wpisów wiedzy, a nie klas uwag bota ani klas ucieczek w dossier buildera. To trzy słowniki traktowane jak jeden.

**Skąd to się bierze.** Klasy powstawały w trzech etapach niezależnie i nikt ich nie zszył.

**Co z tym robimy.** To praca wdrożeniowa, nie panelowa: jedna lista nazw z odwzorowaniem między etapami i decyzja, czy jeden słownik obsłuży
trzy zastosowania. Do raportu jako ograniczenie miar.

**Co Ci to da.** Za pół roku będziesz mógł porównać liczbę defektów danej klasy z dzisiejszą, bo nazwy będą te same.

### Luka 13. Połowa Twojej miary jakości nie dostarczyła ani jednej liczby

**Co znalazł krytyk.** Zdefiniowałeś jakość kodu jako to, ile poważnych defektów znajdą po naszym review bot oraz skill bugfix. Bota zmierzyliśmy
bardzo dokładnie. Słowo bugfix nie pada w żadnym rozstrzygnięciu ani razu poza zdaniem z definicją. Nie wiemy, ile defektów trafia do bugfixa po
wdrożeniu, jakich klas i czy pokrywają się z tym, co łapie bot.

**Skąd to się bierze.** Dane o bocie leżały w jednym miejscu na GitHubie, dane o bugfixie są rozproszone po gicie, Sentry i dokumentach zadań.

**Co z tym robimy.** Do raportu: miara jakości to dziś w praktyce tylko bot. Przy pierwszym pomiarze po wdrożeniu zliczamy też zgłoszenia bugfixa
w tych samych zadaniach i sprawdzamy, czy to ta sama populacja defektów.

**Co Ci to da.** Dowiesz się, czy defekty widoczne dopiero w działającej aplikacji to ta sama klasa, co ucieczki do bota, czy zupełnie inna,
której żadne review diffu nie złapie.

### Luka 14. Spora część maszynerii szablonu nie została przez nikogo dotknięta

**Co znalazł krytyk.** Osiem plików agentów nie jest wołanych przez żaden workflow, a dwa z nich nie są wołane nigdzie, zostały po dawnym scaleniu
osi. Trzy skille dev, w tym wieloagentowy dev-ideate, nie pojawiają się w żadnym rozstrzygnięciu. Skill code-review ma własny, drugi roster review
poza pipeline'em. Skill freshness-audit to gotowy mechanizm sprawdzania, czy reviewer jest aktualny, o co pytałeś na początku, i nikt go nie użył.
Dwa hooki nakładają się na projektowaną bramkę domknięcia fazy. Siedemdziesiąt cztery testy workflowów przypinają dzisiejsze zachowanie orkiestratora.

**Skąd to się bierze.** Analiza szła po kosztach fazy autopilota, a te elementy do kosztu fazy nie wchodzą.

**Co z tym robimy.** Panel dostaje listę z poleceniem: każdy projekt albo obejmuje element, albo jawnie go zostawia. Martwe agenty idą na listę
zmian szablonu.

**Co Ci to da.** Po przeprojektowaniu nie zostanie w repo stara maszyneria, która rozjedzie się z nowym pipeline'em i będzie mylić.

### Luka 15. Nikt nie zapisał, który plik agenta realizuje którą oś review

**Co znalazł krytyk.** Wszystkie rozstrzygnięcia mówią o osiach po nazwie. W kodzie oś code-quality realizuje plik nazwany „architecture-strategist",
po angielsku, z doklejonym w workflowie długim opisem trzech osi naraz. Osie correctness i test-coverage nie mają własnego pliku wcale, startują jako
agent ogólny z pełnym, najdroższym kontekstem. Polecenie „odchudź prompt osi o połowę" nie mówi, o który z tych dwóch miejsc chodzi.

**Skąd to się bierze.** Prompt osi żyje w dwóch miejscach naraz, w pliku agenta i w workflowie, a analiza patrzyła na osie, nie na pliki.

**Co z tym robimy.** Przed panelem robię tabelę: oś, plik agenta albo jego brak, gdzie żyje prompt, ile kosztuje start dziś. Dwadzieścia minut.

**Co Ci to da.** Projekty panelu będą mówić o rzeczach, które da się wskazać palcem w repo, a szacunki oszczędności per oś nie rozjadą się z kodem.

### Luka 16. Miara sukcesu potrafi spaść o połowę bez żadnej zmiany w pipeline

**Co znalazł krytyk.** Prawie każde rozstrzygnięcie mierzy skutek liczbą uwag bota danej klasy po wdrożeniu. Etap 1b pokazał, że ta liczba spadła
z prawie trzynastu do pięciu na sto zmienionych plików bez żadnej zmiany w pipeline, tylko dlatego, że zmienił się rodzaj pisanego kodu.

**Skąd to się bierze.** Kod walidacji i migracji generuje więcej uwag niż kod interfejsu i tekstów. Bez podziału po typie kodu każdy przyszły
pomiar może pokazać dowolny wynik.

**Co z tym robimy.** Do raportu jako ograniczenie. Przy pierwszym pomiarze po wdrożeniu liczymy punkt odniesienia osobno dla każdego typu kodu
i porównujemy w tej samej warstwie.

**Co Ci to da.** Nie uwierzysz w poprawę, która jest tylko zmianą tematu zadań, i nie przegapisz pogorszenia z tego samego powodu.

### Luka 17. Koszt wdrożenia nie jest kryterium wyboru między projektami

**Co znalazł krytyk.** Panel ma wybrać najlepszy z trzech projektów po koszcie runu i jakości. Nikt nie oszacował, ile pracy wymaga wdrożenie.
Rdzeń to dwa pliki workflowów po sto i sto dwadzieścia kilobajtów, siedemdziesiąt cztery testy do przepisania, około dwudziestu czterech nowych
plików agentów, nowe reguły kodowania, konfiguracja czterech narzędzi i wyciszenie prawie dwustu zastanych błędów lintera.

**Skąd to się bierze.** Analiza mierzyła koszt runu, bo to było pytanie. Koszt wdrożenia dla jednej osoby to inne pytanie.

**Co z tym robimy.** Proponuję, żeby sędziowie w panelu dostali czwarty wymiar: koszt wdrożenia i utrzymania przez jedną osobę. To wymaga Twojej zgody.

**Co Ci to da.** Nie wygra projekt, którego nie da się dowieźć w pojedynkę.

### Luka 18. Agent pakujący kontekst dla reviewerów ma zniknąć na podstawie literatury, a nasz jedyny pomiar mówi coś przeciwnego

**Co znalazł krytyk.** Etap 1 zostawił packagera jako sprawę otwartą: kosztuje więcej, niż daje, a jedyny pomiar przed i po pokazał, że reviewerzy
po dostaniu dossier czytają dwa razy więcej Bashem, nie mniej. Etap 2 rozstrzygnął, że dobór plików robi skrypt, a agent znika, opierając się
na cudzej pracy. Pomiaru „szeroko czy wąsko" nie dodano do warunków wejścia.

**Skąd to się bierze.** Kierunek jest tani i odwracalny, więc łatwo było go przyjąć bez własnego dowodu.

**Co z tym robimy.** Panel może go przyjąć, bo cofnięcie jest tanie. Do raportu jako założenie. Pomiar liczby tur czytania z dossier i bez robimy
po wdrożeniu, na tej samej wersji maszynerii.

**Co Ci to da.** Będziesz wiedział, czy dossier w ogóle oszczędza czytanie, zamiast zakładać, że tak.

### Luka 19. Osiem poprawek konfiguracji bota zapisano dla jednego projektu, a źródło szumu siedzi w szablonie

**Co znalazł krytyk.** Największa klasa szumu od bota, osiemdziesiąt uwag, to progi trzystu linii na plik i pięćdziesięciu na funkcję. Osiem poprawek
z etapu 1b opisano dla pliku w oferty-online. Tymczasem w nowych projektach ten plik generuje skill coderabbit-setup, a jego szablon zawiera dokładnie
te dwie linijki. Każda nowa instalacja odtworzy problem.

**Skąd to się bierze.** Analiza patrzyła na konfigurację projektu, nie na generator w szablonie.

**Co z tym robimy.** Na listę zmian szablonu, dziesięć minut: przenieść osiem poprawek do generatora, nie tylko do oferty-online.

**Co Ci to da.** Następny projekt zacznie bez osiemdziesięciu bezwartościowych uwag od bota.

---

## Co teraz

Przed panelem: godzina na klasyfikację trzydziestu trzech findingów, pół godziny na policzenie instrukcji per agent, dwadzieścia minut na mapę osi
do plików agentów. Zero agentów, wszystko w sesji głównej. I dwie rzeczy od Ciebie: jedno zdanie, że oś test-coverage zostaje, oraz tak lub nie
dla czwartego wymiaru oceny dla sędziów.

Potem panel.
