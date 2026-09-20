# Etap 2 — co znaleźliśmy w świecie zewnętrznym i co z tego wynika (wersja dla Kacpra)

Data: 2026-09-20. To jest ludzka wersja dokumentu `ETAP2-ROZSTRZYGNIECIE.md`. Tamten jest dla Claude'a i ma wszystkie linki, liczby i ścieżki.
Ten jest dla Ciebie: co nas boli, skąd to się bierze, co z tym zrobić i co na tym zyskasz.

## O co chodziło w tym etapie

Po etapach 0 i 1 wiedzieliśmy, co nas kosztuje i co nam ucieka. Nie wiedzieliśmy, czy nasze problemy są typowe i czy ktoś już je rozwiązał
lepiej. Więc wysłaliśmy sześciu agentów, żeby sprawdzili to w dokumentacji, badaniach naukowych i u firm, które robią przegląd kodu przez AI
zawodowo (Cursor, CodeRabbit, Google). Siódmy agent nałożył to na naszą listę elementów pipeline'u.

Wyszło sześć wniosków. Każdy zmienia coś w tym, jak zaprojektujemy pipeline „po".

---

## Wniosek 1. Reguły napisane tekstem są po cichu pomijane

**Gdzie był problem.** W etapie 1 zobaczyliśmy, że 45 z 68 defektów, które bot znalazł po naszym review, miało i właściciela, i regułę w prompcie.
Reguła była, agent ją dostał, defekt przeszedł.

**Co to powoduje.** Badanie na 20 modelach pokazuje, jak to działa. Przy 10 poleceniach model wykonuje prawie wszystkie. Przy 150 zaczyna
gubić. Przy 500 wykonuje około dwie trzecie. Nie przekręca reguł, tylko część z nich po prostu pomija, bez słowa. Nasze CLAUDE.md plus
coding-rules plus prompt reviewera to właśnie setki poleceń naraz.

A bot, który łapie nas po naszym review, nie jest mądrzejszy od nas. CodeRabbit uruchamia w tle ponad 50 zwykłych linterów i skanerów,
a ich wyniki wkłada do recenzji. To nie model znajduje pusty `catch` czy plik za długi. To narzędzie. My tę samą pracę zlecamy agentowi
za setki tysięcy tokenów i on ją w części pomija.

**Jak działa rozwiązanie.** Wszystko, co da się sprawdzić narzędziem, przenosimy do narzędzia w domknięciu fazy: linter (ESLint w nowej
wersji 10), wykrywacz martwego kodu (knip), budżet rozmiaru aplikacji (size-limit), sprawdzenie schematu bazy (Supabase advisors),
własne sprawdzenie, czy nikt nie zmienił już wdrożonej migracji. Agentowi zostają tylko krótkie polecenia typu „wypisz listę", których
narzędzie nie umie, i ma ich być kilkanaście, nie kilkaset.

**Co Ci to da.** Mniej defektów od bota po naszym review. Mniej tur agentów na rzeczy, które linter robi w sekundy za darmo.
Reguły, które zostaną w tekście, mają szansę być naprawdę wykonane, bo będzie ich mało.

---

## Wniosek 2. Powtarzanie review pogarsza wynik, ale równoległe próbki go poprawiają

**Gdzie był problem.** Powtórka review tej samej fazy dawała nam 12–18 nowych findingów. Wyglądało to tak, jakby review nigdy nie kończył pracy.

**Co to powoduje.** To normalna cecha modeli językowych jako recenzentów. Ten sam model, ten sam prompt, ten sam kod, a wynik za każdym razem
trochę inny. Zmierzono to: zgodność modelu z samym sobą wynosi od 0,33 do 0,79 w skali, gdzie 0,8 to minimum akceptowalne.

Ale kierunek powtarzania ma znaczenie. Druga runda PO pierwszej (tak jak u nas po STOP-ie E2E) pogarsza wynik: na jeden nowy prawdziwy
defekt wpada 4–5 fałszywych. Natomiast kilka rund RÓWNOLEGLE, z jednym agentem, który je zbiera i odsiewa to, co pojawiło się tylko raz,
podnosi wykrywalność ponad dwukrotnie. Tak robi Cursor: osiem równoległych przejść, głosowanie, osobny walidator.

**Jak działa rozwiązanie.** Nigdy nie powtarzamy pełnego review tej samej fazy. Po STOP-ie E2E wraca tylko tester. Jeśli w etapie 4 uznamy,
że chcemy wyższej wykrywalności, kupujemy ją równoległymi próbkami jednej osi, nie kolejną rundą i nie kolejnym specjalistą.

**Co Ci to da.** Koniec z ponad milionem tokenów na powtórki, które produkowały głównie szum. Mniej fałszywych findingów do naprawiania.

---

## Wniosek 3. Nasi sceptycy pracują na ćwierć możliwości

**Gdzie był problem.** Sceptycy sprawdzający findingi reviewerów obalają 12–19%. Płacimy za nich 6% fazy i zastanawialiśmy się, czy warto.

**Co to powoduje.** Dajemy sceptykowi finding razem z całym uzasadnieniem autora. Czyta gotową argumentację i trudno mu się z nią nie zgodzić.
W badaniu, gdzie sceptyk dostawał SAM zarzut, bez uzasadnienia, obalał 63–83% kandydatów. Drugie badanie: kiedy sceptyk musi odpowiedzieć
jedną z trzech etykiet (zgadzam się / nie zgadzam, bo kod mówi inaczej / nie zgadzam, bo mam obawę) zamiast swobodnej narracji, jakość rośnie.
Oba badania mówią to samo: o tym, czy defekt jest prawdziwy, rozstrzyga test, nie zgoda dwóch modeli.

**Jak działa rozwiązanie.** Zmieniamy prompt sceptyka: dostaje sam zarzut, odpowiada etykietą, a „nie zgadzam się" musi wskazać linię kodu
albo test. Dla defektów krytycznych naprawa ma zawierać test, który pada przed poprawką. Zero nowych agentów.

**Co Ci to da.** Mniej fałszywych findingów dochodzi do pętli naprawczej, więc mniej napraw, które same wprowadzają regresje (mieliśmy takie).

---

## Wniosek 4. Największa dźwignia oszczędności jest potwierdzona tylko w połowie

**Gdzie był problem.** Etap 1 pokazał, że prawdziwa oszczędność (30–40%) leży w tym, ile kontekstu dostaje każdy agent na start: CLAUDE.md,
reguły, lista 900 narzędzi MCP, opisy 300 skilli. Każdy z 35 agentów fazy niesie to w każdej turze.

**Co wiemy na pewno.** Claude Code ma wbudowany przełącznik `omitClaudeMd`, który wyłącza ładowanie CLAUDE.md do agenta. Ma też pola,
które wycinają narzędzia MCP i opisy skilli. To potwierdzone w dokumentacji.

**Czego dokumentacja nie mówi.** Trzy rzeczy: czy ten przełącznik wyłącza też pliki z `.claude/rules/` (a tam siedzi połowa objętości),
czy reguły warunkowe „ładuj tylko przy dotknięciu pliku X" działają w agentach pomocniczych, i czy to wszystko działa dla agentów
uruchamianych przez Workflow. Jeśli nie, oszczędność jest o połowę mniejsza, niż zakładamy.

**Jak działa rozwiązanie.** Zanim panel projektowy zacznie coś projektować na tym założeniu, robimy mały pomiar na małym repo:
kilka agentów z regułami-markerami i sprawdzamy w transkryptach, co realnie dotarło. To jeden z czterech pomiarów, które musimy
zrobić przed etapem 4.

**Co Ci to da.** Nie zaprojektujemy pipeline'u na obietnicy. Będziemy wiedzieć, ile ta dźwignia daje naprawdę, zanim ją wdrożymy.

---

## Wniosek 5. Testy „na kształt" da się wykrywać narzędziem, ale nie jednym

**Gdzie był problem.** 31 uwag bota to testy, które przechodzą niezależnie od tego, czy kod działa: asercja, która nie może paść;
atrapa, która nie sprawdza argumentów; schemat danych luźniejszy od kontraktu. Agent test-coverage miał to łapać i nie łapał.

**Co to powoduje.** Model piszący testy asertuje to, co pamięta o zadaniu, nie to, co robi kod. Badania pokazują zestawy testów
ze 100% pokrycia, które nie wykrywają 96% sztucznie wprowadzonych błędów. Pokrycie nic nie mówi o tym, czy test może paść.

**Jak działa rozwiązanie.** Trzy warstwy, od najtańszej:
1. Reguły lintera dla testów: łapią pustą asercję i atrapę bez argumentów w milisekundy.
2. Test typów: porównuje schemat danych z kontraktem i pada, gdy schemat jest luźniejszy. To jedyne znalezione narzędzie na tę klasę.
3. Mutation testing (Stryker): narzędzie celowo psuje kod w miejscach zmienionych w fazie i sprawdza, czy testy to zauważą. Test, który
   nie zauważa żadnej zmiany, jest testem na kształt. Google robi to produkcyjnie od lat, tylko na zmienionym kodzie, więc koszt jest
   proporcjonalny do fazy, nie do repozytorium.

Ważny szczegół: wynik mutacji idzie do buildera jako lista „te miejsca nie są chronione", nie do reviewera. Badanie pokazuje, że model
z takim sprzężeniem zwrotnym pisze testy prawie dwa razy lepsze. I nie ustawiamy wyniku mutacji jako celu liczbowego, bo agent zacznie
pisać testy pod metrykę.

**Co Ci to da.** Klasa „test niefalsyfikowalny" znika z uwag bota. Agent test-coverage zostaje tylko na pytanie „czego testu nie ma w ogóle".

---

## Wniosek 6. Dwie nasze reguły są sprzeczne z oficjalną dokumentacją

**Gdzie był problem.** Prosiłeś, żeby sprawdzić coding-rules.md tak, jakbyśmy pisali go dziś od zera.

**Co znaleźliśmy.** Dwie reguły mówią coś innego niż dokumentacja frameworka:
- Reguła o React („zawsze AbortController w useEffect") jest sprzeczna z zaleceniem React, które odradza pobieranie danych w useEffect
  i gasi wyścigi inaczej. Co gorsza, jedna z trzech regresji złapanych przez kontrolę diffu naprawczego to był właśnie dołożony
  AbortSignal. Nasza reguła wyprodukowała defekt, którego potem szukaliśmy agentem.
- Reguła o Supabase zaleca trzymać rolę w `app_metadata`. Oficjalny przewodnik prowadzi do tabeli ról i auth hooka. Zakaz `user_metadata`
  się broni, zalecenie nie.

Do tego: dwie sekcje sobie przeczą (§3 „wyciągaj wspólną logikę" kontra §11 „duplikacja lepsza niż złożoność"), katalog „10 anty-patternów AI
z procentami 80–90%" nie ma żadnego źródła, a kilka sekcji to po prostu reguły lintera zapisane prozą.

Brakuje natomiast rzeczy, które w 2026 są standardem: nowsze flagi TypeScript, `satisfies` zamiast zakazu `as`, cztery konkretne reguły
RLS w Supabase, walidacja i obsługa błędów w Hono, timeout na każdym wywołaniu sieciowym jedną linią, limity rozmiaru zapytań wg OWASP,
nowe API React 19.

**Jak działa rozwiązanie.** Dokument przepisujemy w etapie 4 lub 5 z tabelą: usuń / zmień / dodaj / przenieś do lintera. Każda zmiana z linkiem
do źródła. Właścicielem jest szablon.

**Co Ci to da.** Reguły, które nie generują defektów, mniej tekstu w kontekście każdego agenta, i dokument, którego reviewer nie będzie
interpretował na dwa sposoby.

---

## Co z tego wynika dla naszej listy elementów

Agent nałożył wnioski na 22 elementy pipeline'u. Skrót:

- **Da się zastąpić narzędziem w całości lub w dużej części:** oś performance, oś code-quality, oś test-coverage (trzy warstwy wyżej),
  pre-skan fixa (do skasowania), packager (dobór plików liczy skrypt, nie agent), precheck (skrypt sprawdzający narzędzia).
- **Zostaje agentem, ale z mechanicznym wsparciem:** security (advisors bazy zdejmują część), correctness (linter łapie dwie największe
  klasy: nieobsłużone ścieżki błędu i cykl życia React), sceptycy (nowy prompt), kontrola diffu naprawczego.
- **Bez zamiennika, zostaje w całości agentem:** spec-compliance (nikt nie porównuje intencji dokumentu z kodem narzędziem) i tester E2E.
- **Natywne mechanizmy Claude Code:** odchudzenie kontekstu startowego agentów i warstwowanie wiedzy z dev-compound. Oba warunkowo,
  do pomiaru.

## Cztery pomiary, które trzeba zrobić przed etapem 4

To skrypty i jeden mały run testowy, nie agenci analizujący.

1. **Czy odchudzenie kontekstu naprawdę działa w agentach pomocniczych** (wniosek 4). Bez tego panel projektuje na założeniu.
2. **Ile z 195 realnych uwag bota złapałby sam linter.** Przepuszczamy dzisiejszy kod oferty-online przez proponowaną konfigurację
   i porównujemy z listą uwag. Ta jedna liczba mówi, ile osi review można skasować.
3. **Ile czasu zajmą bramki narzędziowe** na projekcie wielkości oferty-online. Nikt nie podaje liczb dla naszej skali. Jeśli za długo,
   jest plan B (szybszy linter).
4. **Ile z 12–18 findingów powtórki to te same findingi, a ile nowe.** Rozstrzyga, czy jesteśmy w reżimie „powtórka szkodzi" czy „za mało próbek".

## Czego ten etap nie rozstrzygnął

- Nie ma badania porównującego dokładnie nasze 6 osi z jednym reviewerem o tym samym budżecie. Jest badanie mówiące, że przy równym
  budżecie jeden agent zwykle dorównuje zespołowi. Czy to dotyczy nas, powie jeden run kontrolny w etapie 4.
- Nie wiadomo, jak Anthropic robi swój `/code-review`, ani jak robią to Copilot i Greptile. Brak publicznych źródeł.
- Wszystkie oszczędności czasu bramek są szacunkami do zmierzenia.

## Jedno zdanie na koniec

Nasz pipeline ma problem ze znajdowaniem, nie z naprawianiem, a znajdowanie poprawia się nie przez więcej reguł i więcej agentów,
tylko przez narzędzia tam, gdzie się da, krótkie listy tam, gdzie się nie da, i sceptyka, który dostaje pytanie bez odpowiedzi.
