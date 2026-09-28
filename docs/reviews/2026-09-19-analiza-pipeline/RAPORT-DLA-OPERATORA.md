# Raport końcowy analizy pipeline'u dev-* — dla operatora (2026-09-27)

**Status:** ZAAKCEPTOWANY 2026-09-28 (HANDOFF 6a pkt 36). Forma skrócona (HANDOFF 6a pkt 35): ten raport w pełni, wersja techniczna jako spis — `RAPORT-TECHNICZNY.md`.
Decyzje i plan, na których stoi, zaakceptowałeś wcześniej (`PANEL-WYNIK-DLA-OPERATORA.md`). Jedyną nową liczbę, koszt „po całym planie”, policzył
skrypt (`skrypty/raport_koszt_po.py` → `dane/raport-koszt-po.txt`). Pozostałe liczby pochodzą z plików etapów, które podaję przy każdej.

**Jak czytać koszty.** Koszt podaję w jednostkach cennika tokenów (M = milion jednostek), nie w złotówkach. Model liczy na małych fazach jednego
runu z 20.09. Duże fazy kosztują więcej, o około 39% w porównaniu z tym, co pokazuje model. Dlatego **każda liczba bezwzględna to dolna granica**.
**Procenty „dziś → po” są wiarygodniejsze**, bo obie strony liczy ten sam model na tej samej bazie.

**oferty-online to materiał do nauki, nie miejsce wdrożenia.** Wszystkie dane analizy pochodzą z historii tego projektu, bo tam pipeline pracował
najwięcej. Wnioski dotyczą jednak szablonu. Wdrożenie i pomiar robimy na nowych projektach, a żaden krok planu nie wymaga pracy w oferty-online
(część 3 i `RAPORT-TECHNICZNY.md` §2).

---

## Wniosek

**Po całym planie typowe zadanie autopilota kosztuje o około 57% mniej niż dziś, przy jakości co najmniej takiej jak dziś.
Zyskujemy też dwie rzeczy, których dziś nie ma: kontrolę błędów rodzących się w poprawkach i miarę, która za miesiąc powie, co zadziałało.**

1. **Największa oszczędność nie pochodzi z recenzji, tylko z tego, co każdy agent dostaje na start.** Dziś każdy agent zaczyna pracę z listą
   ~970 narzędzi i ~310 skilli z Twojego konta oraz z całym plikiem learned-patterns. Po zmianie dostaje tylko to, czego używa. Samo to daje około
   **−51%** kosztu zadania, z czego sama lista narzędzi (allowlista) około **−40%**.
2. **Pokrętła recenzji i sprzątanie drobnych agentów dokładają około −12% tego, co zostanie.** Razem z kontekstem daje to −57%, a nie −64%, bo
   oszczędności nie sumują się: im tańszy agent na starcie, tym mniej zyskujemy na usunięciu kolejnego.
3. **Sześciu recenzentów zostaje.** Test na prawdziwych fazach pokazał, że każdy z nich łapie coś, czego nie łapie nikt inny.
4. **Nowa kontrola poprawek łapie połowę błędów, które dziś rodzą się w poprawkach po review (dziś zero), a kosztuje tyle co obecna.**
5. **Dochodzą trzy tanie, sprawdzone w teście dodatki:** automatyczne bramki (lint, knip), lista „przeżytych mutantów” dla recenzenta testów
   i listy kontrolne dla recenzentów poprawności i specyfikacji.
6. **Każdą zmianę mierzymy na nowych projektach.** Telemetria bez agentów, punkt odniesienia z pierwszych 2–3 zadań nowego projektu i warunek
   cofnięcia przy każdej zmianie. Plan to 7 okien po 5 PR. Ile to potrwa, zależy od tempa nowych projektów: przy tempie z września byłyby to
   około dwa miesiące.
7. **Twoje konto dokłada ~42 tys. tokenów do każdej sesji, a sam jeden plugin (posthog) ~30 tys.** Jest teraz narzędzie, które to pokazuje per
   poziom (user / project / local). Porządki robimy jako **krok 0, przed resztą planu** (część 4).

---

## 1. Dziś i po — w ośmiu punktach

1. **Start agenta.** Dziś recenzent zaczyna od ~118 tys. tokenów: ~970 narzędzi, ~310 skilli i całe learned-patterns. Po zmianie zaczyna od ~30 tys.:
   kilka narzędzi, bez listy skilli, a wiedzę dostaje tylko dla plików, które zmienia.
2. **Koszt zadania.** Dziś 52,0 M†, po całym planie 22,4 M†, czyli −57%.
3. **Liczba agentów.** Dziś około 123 na zadanie, po zmianie około 99. Znikają: packager, zapis stanu, pre-skan, osobna weryfikacja fixa i agent telemetrii.
4. **Recenzja.** Dziś 6 recenzentów z wysiłkiem myślenia zależnym od tego, jaką sesję otworzyłeś. Po zmianie ci sami recenzenci, z przypiętym wysiłkiem
   i z listami kontrolnymi tam, gdzie test pokazał zysk.
5. **Sprawdzanie zgłoszeń.** Dziś prawie jeden sprawdzający na zgłoszenie. Po zmianie zgłoszenia P2 idą w paczkach po cztery, a sprawdzający
   nie widzi uzasadnienia autora. P1 zostaje jak dziś.
6. **Po poprawce.** Dziś działa wąska kontrola, która w teście nie złapała żadnego z 30 błędów zrodzonych w poprawkach. Nowa kontrola diffu
   poprawki złapała 15 z 30.
7. **Bramki.** Dziś typecheck i testy uruchamia agent. Po zmianie jeden skrypt odpala lint, knip, typy, migracje i Strykera: do ~2,5 minuty
   na fazę i zero tokenów.
8. **Pomiar.** Dziś telemetrię zapisuje agent haiku, który dwa razy ją skasował, a liczy tylko ~11% kosztu. Po zmianie robi to skrypt po każdym
   runie, z pełnym kosztem i z klasą każdej uwagi bota w PR-ze.

† dolna granica — patrz „Jak czytać koszty” wyżej.

## 2. Co zyskam

**Koszt.** Typowe zadanie autopilota kosztuje dziś 52,0 M†, a po całym planie 22,4 M† (−57%). Typowa faza: 12,75 → 5,65 M†. Źródło:
`dane/raport-koszt-po.txt` §2–§3. Planowanie przed autopilotem (dev-plan) liczy się osobno i dziś to około 4–7% kosztu zadania.

- **Problem.** Każdy agent czyta w każdej turze wszystko, co dostał na start. Większość tego startu to rzeczy, których nie używa.
- **Przyczyna.** Agenci szablonu nie mają listy dozwolonych narzędzi, więc dziedziczą całe Twoje konto. Do tego learned-patterns ładuje się do każdego
  agenta w całości.
- **Co robimy.** Krok 3 planu wprowadza allowlistę, a krok 8 wiedzę podawaną po plikach.
- **Co to daje.** Około −40% za samą allowlistę i jeszcze −18% tego, co zostanie, za wyjście learned-patterns ze startu. Pokrętła recenzji, paczki
  sceptyków i usunięcie drobnych agentów dokładają razem −12%.
  Zmiana fixa na „tylko P1/P2” może dodać około −2%, ale ta liczba jest założeniem, a nie pomiarem, więc nie wliczam jej do −57%.

**Czas.**
- Scalone dev-plan i dev-docs: jedno przekazanie mniej. Oszczędza to Twój czas, około 1–2 godzin przekazań na zadanie (HANDOFF §3 pkt 6), a nie tokeny.
- Test w przeglądarce, który nie może się wykonać, przechodzi na ręczny i trafia do Twojego smoke'a, zamiast zatrzymywać run. Dziś prawie
  wszystkie zatrzymania autopilota to E2E.
- Stryker w teście trwał od 7 sekund do 2 minut na fazę, a nie 5–15 minut, jak zakładaliśmy. Wszystkie bramki razem mieszczą się w około 2,5 minuty
  (TEST-REVIEW-WYNIK §7).

**Jakość** (test na 13 prawdziwych fazach, `TEST-REVIEW-WYNIK-DLA-OPERATORA.md`):
- Kontrola poprawek: 0 → 15 z 30 błędów, które rodzą się w poprawkach, w tym oba P1.
- Testy „na niby”: dziś łapiemy 1 z 12, a z listą mutantów w układzie projektu C — 6 z 12.
- Listy kontrolne poprawności: ucieczek złapanych 3 → 9, a przy specyfikacji 3 → 10.
- Bramki: w teście złapały 4 błędy, których nie znalazł żaden recenzent.
- Zachowujemy to, co działa: recenzent jakości kodu łapie 12 z 25 złapanych ucieczek (10 tylko on), bezpieczeństwa 16 dzisiejszych trafień,
  wydajności 7 trafień, których nie ma nikt inny.

## 3. Czego to wymaga ode mnie

1. **Akceptacji planu każdej iteracji przed pierwszą zmianą w `.claude/`.** Najbliższa jest iteracja 1, czyli telemetria. Robię ją w osobnej sesji.
2. **Nowej sesji po każdej zmianie w `.claude/`, zanim uruchomisz autopilota.** Claude trzyma instrukcje i skille w pamięci sesji, więc stara sesja
   pracowałaby na starej wersji (mini-run, N2).
3. **Dwóch–trzech pierwszych zadań nowego projektu na obecnym pipelinie** (z telemetrią i nową konfiguracją bota, bez innych zmian). To punkt
   odniesienia (B0). Bez niego nie wiemy, czy zmiana coś poprawiła, bo liczba uwag bota zmienia się też z samym rodzajem kodu (L16). Uwaga: pierwsze
   zadania nowego projektu to zwykle szkielet, więc pierwszy odczyt jakości traktujemy ostrożnie i porównujemy w tym samym typie kodu.
4. **Nic nie sprzątamy w starych projektach.** W nowym projekcie lint z bramkami działa od pierwszego zadania, więc nie ma zastanych błędów, które
   blokowałyby krok 4. Zasada, którą przyjąłeś, zostaje na przyszłość: jeśli wrócisz do starego projektu, najpierw jedno zadanie sprzątające,
   a nowa reguła lintu zawsze wchodzi razem z posprzątaniem.
5. **Porządków na koncie jako kroku 0, przed krokiem 1** (część 4). To są Twoje ustawienia, nie szablon: decyzje podejmujesz Ty i Ty
   uruchamiasz komendy.
6. **Kilku decyzji przy wdrożeniu:** przepisanie Twoich coding-rules (krok 8), kopia skilla Figmy (krok 3), szablon mobilny (osobno, poza planem).
7. **Co zmienia rezygnacja z oferty-online** (szczegóły: `RAPORT-TECHNICZNY.md` §2):
   - **Problem.** Plan zakładał pomiar na oferty-online: punkt odniesienia, okna po 5 PR i tempo PR-ów stamtąd. Ten projekt ma w dodatku stary
     szablon z lokalną poprawką E2E.
   - **Co robimy.** Punkt odniesienia i okna liczymy na nowych projektach. Zadanie sprzątające w oferty-online wypada. Parametryzacja E2E zostaje
     w kroku 3, bo nowe projekty też mogą mieć serwer inny niż Vite, ale nie blokuje już niczego. Historia oferty-online zostaje jako archiwum:
     tło liczb i materiał do ślepych testów promptów, tylko do odczytu.
   - **Co to daje.** Plan nie wymaga, żebyś wracał do oferty-online. Cena: czas planu zależy od tempa nowych projektów, a pierwsze odczyty
     jakości są mniej pewne, dopóki nowy projekt nie urośnie.

## 4. Konto: dużo MCP, skilli i pluginów — narzędzie i plan naprawy (L8)

**Problem.** Nie widzisz, co masz zainstalowane i na którym poziomie. To samo jest rozrzucone po sześciu miejscach: `~/.claude/settings.json`,
`~/.claude.json` (tu siedzą MCP poziomu user i local), `.claude/settings.json` i `.claude/settings.local.json` projektu, `.mcp.json`, katalogi
skilli, a do tego pluginy i skille synchronizowane z konta claude.ai. Wbudowane komendy pokazują po kawałku. `claude plugin list` wypisuje na
przykład dev-browser kilkadziesiąt razy, po wpisie na każdą kopię z testu review.
**Przyczyna, dla której to kosztuje.** Wszystko, co jest włączone globalnie, ładuje się do każdej Twojej sesji i do każdego agenta bez allowlisty,
w każdym projekcie, także tam, gdzie tego nie używasz. W mini-runie recenzent dostawał na start 137 tys. znaków schematów narzędzi, 37 tys. znaków
nazw MCP i 30 tys. znaków listy skilli, zanim przeczytał linijkę kodu (`dane/mr-kontekst.txt` §1). Tymczasem 498 z 514 agentów pipeline'u nigdy
nie użyło MCP (6a pkt 15).

**Narzędzie.** `skrypty/konto_inwentarz.py` działa tylko do odczytu: niczego nie zmienia i wypisuje same nazwy, nigdy klucze. Dla wskazanego projektu
pokazuje:
- każdy plugin ze stanem na poziomie user / project / local, stanem efektywnym (local wygrywa z project, project z user), tym, co wnosi
  (skille, agenci, MCP, hooki), użyciem z ostatnich 30 dni i tokenami, które dokłada do każdej sesji;
- serwery MCP według poziomu i użycia;
- skille według źródła, z liczbą użytych;
- hooki według poziomu;
- listę komend porządkujących.

```bash
python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/konto_inwentarz.py <ścieżka projektu> --koszt
```

Wbudowane komendy uzupełniają to narzędzie, ale każda pokazuje tylko kawałek:
- `/plugin`: zakładka Installed z grupą „Not used recently”;
- `claude plugin details <plugin>`: ile tokenów plugin dokłada do każdej sesji;
- `/mcp`: serwery i ich stan, także konektory claude.ai;
- `/doctor` i `/skill-doctor`: koszt nieużywanych skilli, MCP i pluginów.

**Co pokazało na Twoim koncie** (`dane/konto-inwentarz-workspace-template.txt`, widok z tego repo):
- **15 aktywnych pluginów dokłada ~42 tys. tokenów do każdej sesji.** Sam **posthog ~30 tys.** (164 skille), a był używany w 3 projektach.
  Dalej aibiz ~2,8 tys., strona-przez-rozmowe ~2,5 tys., figma ~2,1 tys.
- **Na liście modelu jest ~274 skilli** w każdej sesji: 28 z szablonu, 9 Twoich, 8 z konta claude.ai, reszta z pluginów.
- **Plugin z konta claude.ai (strona-przez-rozmowe) działa w każdym projekcie ze swoim hookiem.** To on blokował mi dziś zapisy przez Bash.
  Pluginy kursowe przychodzą z konta i nie pytają o projekt.
- **Plugin design z claude.ai wnosi 9 serwerów MCP** (asana, slack, gmail…), z których 8 nie było użytych ani razu.
- **Globalnie masz 5 serwerów MCP.** Context7 i mobbin były używane w jednym projekcie, a airtable i Fakturownia w dwóch.
- **Hook `error-handling-reminder.sh` jest na poziomie user,** więc odpala w każdym projekcie, nie tylko tam, gdzie jest szablon.
- **42 ze 121 wpisów projektów w `~/.claude.json` wskazuje na katalogi, których już nie ma.** To tylko szum, nie koszt.

**Plan naprawy: KROK 0, przed krokiem 1 (operator 2026-09-28).** Porządki na koncie robimy jako pierwszy krok wdrożenia, w osobnej sesji.
Każdy element przechodzimy razem, a Ty decydujesz, czy zostaje globalnie, schodzi do projektu, czy wypada. Kasujemy dopiero po zapisaniu
konfiguracji, żeby dało się ją przywrócić. Stan przed i po mierzy narzędzie inwentarza.

Dlaczego jako pierwszy krok:
- punkt odniesienia musi powstać już na uporządkowanym koncie;
- to największy zysk na wejściu, około 42 tys. tokenów w każdej Twojej sesji;
- nie dotyka szablonu ani kodu, a zmiany łatwo odwrócić.

Poniżej jest tylko **wstępny kierunek**, nie lista decyzji. Zasada: globalnie tylko to, czego używasz wszędzie. Komendy uruchamiasz Ty:
1. **Poziom user zostawiamy chudy.** Który plugin zostaje globalnie, ustalimy w kroku 0. Dane dla każdego pluginu (użycie, projekty, tokeny) są
   w pliku inwentarza. Plugin schodzi z globalnego komendą `claude plugin disable <plugin> --scope user`, a wypada całkiem przez
   `claude plugin uninstall`. Hookify nie ma żadnych reguł, więc można go wyłączyć bez skutków.
2. **Pluginy do budowania aplikacji włączamy per projekt.** W projekcie, który ich używa: `claude plugin install <plugin> --scope project`
   (wpis trafia do `.claude/settings.json`) albo `--scope local` (tylko dla Ciebie). Posthog tylko tam, gdzie jest analityka.
3. **Pluginy z konta claude.ai wyłączamy w projektach kodu.** Chodzi o strona-przez-rozmowe, cowork-plugin-management i design (jeśli nie
   potrzebujesz jego MCP): `"enabledPlugins": {"strona-przez-rozmowe@synced": false, …}` w `.claude/settings.json` projektu. Alternatywa to
   wyłączenie ich na claude.ai, jeśli nie są Ci potrzebne nigdzie w Claude Code.
4. **MCP z poziomu user przenosimy tam, gdzie są używane.** `claude mcp get <nazwa>` pokazuje konfigurację, potem `claude mcp add … --scope local`
   w projekcie i `claude mcp remove <nazwa> --scope user`.
5. **Konektory claude.ai wyłączamy w projektach kodu:** `"disableClaudeAiConnectors": true` w `.claude/settings.json`. Aplikacja desktop rejestruje
   je inaczej niż terminal, więc po zmianie sprawdzamy w `/mcp`, czy zniknęły.
6. **Porządki:** `cleanupPeriodDays: 120`, hook error-handling przeniesiony z poziomu user do szablonu (a docelowo wycofany po bramce ESLint),
   martwe wpisy pluginów i projektów usunięte.

**Co z tego wejdzie do szablonu, żeby nowe projekty startowały czyste** (propozycja do kroku 3c planu): `.claude/settings.json` szablonu z listą
pluginów potrzebnych do budowy aplikacji, z wyłączonymi pluginami kursowymi z claude.ai i z `disableClaudeAiConnectors`. Każdy nowy projekt dostanie
wtedy dobry zestaw bez ręcznej roboty.

**Co to daje.** Posthog sam zdejmuje ~30 tys. tokenów z każdej sesji we wszystkich projektach poza tymi 3, a porządki na poziomie user dokładają
kolejne tysiące. To oszczędność w Twoich własnych sesjach (dev-plan, rozmowy, dev-pr), której allowlista agentów nie da. Allowlista (krok 3) chroni
agentów pipeline'u, a higiena konta chroni Ciebie. Potrzebne są obie.

**Wiedza do przekazania dalej (L8).** Dawne „−50 tys. tokenów na agenta” zmierzyliśmy na pustym agencie w terminalu przy pełnym MCP. W runach z aplikacji
wychodziło 54–77 tys. (opus) i 37–53 tys. (haiku), zależnie od podłączonych serwerów. Wielkość zależy od konta, ale kierunek jest pewny: **kto ma dużo
MCP i skilli, powinien najpierw zrobić dwie rzeczy: dać agentom allowlistę i zejść z pluginami do poziomu projektu. Dopiero potem ma sens cięcie instrukcji.**

## 5. Trzy lekcje z analizy

1. **Reguła zapisana w tekście nie znaczy, że zostanie zastosowana, a bot łapie nas modelem, nie linterem.** 45 z 68 ucieczek do bota miało swoją regułę
   w kontekście agenta (ETAP1). ESLint trafił tylko 1 z 97 uwag bota (POMIARY §2). Dlatego mechaniczne rzeczy idą do lintu, a na resztę dajemy krótkie
   listy przy konkretnym recenzencie. Samo dopisywanie reguł nie pomaga: 100 i 400 poleceń dało w mini-runie ten sam wynik przy +72% kosztu.
2. **Powtarzanie recenzji nie jest sposobem na jakość.** Druga runda na tym samym kodzie odtwarza około połowy, a po poprawce prawie nic. Nowe znaleziska
   to w połowie przeoczenia, a w połowie błędy urodzone w poprawce (D1r). Stąd zamiast kolejnej rundy mamy wąską kontrolę samej poprawki, a ona w teście
   złapała połowę tych błędów.
3. **Sprawdzający nie powinien znać odpowiedzi autora.** Kiedy sceptyk dostaje zarzut razem z uzasadnieniem autora, łatwiej się z nim zgadza. Literatura
   mówi o czterokrotnej różnicy. U nas to jeszcze niezmierzone: w teście sceptycy bez uzasadnienia autora nie skasowali żadnego prawdziwego błędu,
   a dzisiejsi skasowali dwa, ale przypadków było mało. Dlatego przed wdrożeniem (krok 5) sprawdzamy to na starych zgłoszeniach o znanym wyniku.

## 6. Co może się nie udać

- **Oszczędność na starcie może być mniejsza na innym koncie.** Wszystko zmierzyliśmy na jednym koncie i jednym repo. Mini-run potwierdził około 48%,
  a model daje 51%, ale na koncie z mniejszą liczbą MCP zysk będzie mniejszy. Pierwszy odczyt (start agenta po jednej fazie) pokaże to od razu.
- **Listy kontrolne mogą nie zadziałać wszędzie.** W teście pomogły poprawności i specyfikacji, a zaszkodziły bezpieczeństwu i jakości kodu. Dlatego
  wchodzą po jednej osi, z warunkiem cofnięcia, a oczekiwanie „domkną 60–70% uwag bota” już skreśliliśmy.
- **Pokrętła z testu to górna granica.** Projekt A zmieniał naraz wysiłek, brzmienie i materiał, więc prawdziwy zysk z pojedynczego pokrętła może być mniejszy.
- **Test to 13 faz jednego projektu, każda raz.** Przy bezpieczeństwie i rzadkich błędach przypadków jest za mało na wniosek, stąd bezpieczeństwa
  nie skracamy bez osobnego ślepego testu.
- **Sceptyk bez uzasadnienia autora może kasować prawdziwe błędy.** Sprawdzamy to przed wdrożeniem, a warunek cofnięcia jest zapisany.
- **Liczba uwag bota spada też bez naszych zmian,** bo zależy od rodzaju kodu: z 12,8 do 5,2 na 100 plików, bez zmiany pipeline'u. Dlatego porównujemy
  z punktem odniesienia w tym samym typie kodu, a nie z sierpniem.
- **Bramki Supabase (advisors) są niezmierzone.** Działają tylko na chmurze, bez Dockera, i zmierzymy je przy wdrożeniu.
- **Czas planu zależy od tempa nowych projektów.** Wrzesień w oferty-online dawał około 6 PR-ów tygodniowo, ale nowe projekty mogą iść wolniej.
  Jeśli PR-ów będzie mniej, okna się wydłużą, a plan przewiduje łączenie okien.
- **Nowy projekt to inny kod niż ten, na którym się uczyliśmy.** Liczby z analizy (koszt, trafienia, progi) pochodzą z jednego dojrzałego projektu.
  Nowy projekt zaczyna od szkieletu, więc jego pierwsze fazy mogą wyglądać inaczej. Dlatego każdy próg liczymy względem punktu odniesienia
  nowego projektu, a nie liczb z oferty-online.
- **Model kosztu opisuje maszynerię sprzed napraw N1–N9.** Nadałeś temu niską wagę, bo N1–N9 nie zmieniały liczby agentów. Zostaje jako uwaga.

## 7. Jak za miesiąc czytać pierwszy pomiar

**Kiedy.** Za około miesiąc, jeśli nowy projekt będzie szedł w tempie zbliżonym do września, będą gotowe: krok 1 (telemetria), krok 2 (bot
i punkt odniesienia z pierwszych 2–3 zadań nowego projektu) i trwające okno kroku 3. Liczby w nawiasach niżej to tło z historii oferty-online.
Próg zawsze liczymy względem punktu odniesienia nowego projektu.

**Gdzie.** Jeden plik `~/.claude/telemetry/pipeline.jsonl` (rekord per agent, faza, run, PR) i raport miesięczny `raport.mjs`. Pełna mapa „co mierzy
która liczba”: `MAPA-WALIDACJI-DLA-OPERATORA.md`.

**Które liczby i kiedy cofamy:**

1. **Czy telemetria działa — po pierwszym runie.** Każdy run ma rekord z prawdziwym statusem, a agentów telemetrii jest zero. Bez tego nie czytamy
   niczego dalej.
2. **Czy allowlista weszła — po jednej fazie.** Porównaj start agenta z celem jego klasy: mechaniczni ~9–10 tys., orkiestrujący i sceptycy ~25–26 tys.,
   recenzent ~29 tys., builder ~38 tys. Narzędzi powinno być kilkanaście, nie ~970. Gdy cel nie jest osiągnięty, poprawiamy plik klasy. Gdy któryś
   recenzent znajduje o 30% mniej, przywracamy mu narzędzia.
3. **Czy faza tanieje — po pięciu fazach.** Porównaj koszt fazy z punktem odniesienia w tym samym typie kodu. To informacja, bez progu cofnięcia.
4. **Czy nowa kontrola poprawek działa — po oknie pięciu PR.** Porównaj uwagi bota w plikach zmienionych przez poprawki z uwagami w reszcie plików.
   W historii oferty-online w plikach poprawek było ich około trzy razy więcej (14,0 vs 4,7 na 100 plików). Jeśli ten stosunek nie spadnie poniżej punktu odniesienia,
   wraca dzisiejsza kontrola i robimy analizę. Jeśli kontrola kosztuje ponad 0,46 M na poprawkę, skracamy jej listy.
5. **Jakość ogólnie — po oknie pięciu PR.** Licz poważne uwagi bota (P1/P2) na 100 plików PR, osobno dla każdej osi (tło: wrzesień
   w oferty-online 3,5 na 100). Zmianę danej osi cofamy, gdy przekroczy próg: 3 uwagi albo dwa razy więcej niż oczekiwane, zależnie od tego, która
   liczba jest większa.

**Zasada czytania.** Ustawienia i koszt czytasz od razu (1 faza, 5 faz). Jakość czytasz dopiero po 5 PR i zawsze względem punktu odniesienia.
Dwie zmiany dotykające wszystkich recenzentów nigdy nie dzielą jednego okna, więc wiadomo, która zadziałała.

**Jedna rzecz do obserwacji:** model pokazuje, że wyjęcie learned-patterns ze startu (krok 8) daje więcej niż listy kontrolne (krok 7). W planie jest
już zasada: jeśli pomiar po kroku 3 to potwierdzi, kroki 7 i 8 zamieniają się miejscami. To nie jest decyzja na dziś.

---

## Gdzie jesteśmy, co dalej, czego od Ciebie chcę

**Gdzie jesteśmy.** Analiza jest skończona. Mamy decyzje, plan w dziewięciu krokach, koszt „po” i ten raport. Nic w `.claude/` nie zostało jeszcze zmienione.

**Co dalej.** Po Twojej akceptacji dopisuję wynik do HANDOFF, aktualizuję pamięć projektu i robię commit `docs/reviews`. Następna sesja zaczyna
**krok 0, czyli porządki na koncie**:
1. robimy inwentarz całego komputera (wszystkie projekty, nie jeden), przechodzimy przez niego razem, a Ty dajesz wytyczne: co zostaje
   globalnie, co schodzi do projektu, a co kasujemy;
2. zapisuję konfigurację do przywrócenia;
3. Ty uruchamiasz komendy;
4. narzędzie mierzy stan przed i po.

Dopiero potem krok 1 (telemetria), z planem do Twojej akceptacji przed pierwszą edycją `.claude/`.

**Czego od Ciebie chcę.**
1. **Akceptacji obu raportów** albo poprawek.
2. **Potwierdzenia kolejności:** krok 0 (porządki na koncie) przed krokiem 1. Rekomenduję: tak.
3. **Gdzie ma żyć narzędzie do przeglądania konta** — do rozstrzygnięcia na początku kroku 0. Dziś to skrypt w katalogu analizy. Rekomenduję osobny
   skill na Twoim koncie (np. `/konto`), żeby działał w każdym projekcie, także nowym.
