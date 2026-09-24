# Przegląd promptów szablonu pod Opus 5.5 — wersja dla operatora

**Stan: przyjęty w całości 24 września.** Prompty szablonu są od teraz osobnym obszarem zmian, obok pozostałych porządków w szablonie. Poprawki wejdą w iteracjach wdrożenia, każda z miarą w telemetrii, a sam przegląd powtarzamy przy każdej zmianie modelu i po wdrożeniu nowych plików ról.

Sprawdziłem wszystko, co szablon mówi modelowi: skille, pliki agentów, polecenia wpisane w workflowy, reguły, komunikaty hooków. Metodą z przewodnika Anthropic (skill `claude-api`, polecenie `prompt-audit`). Szukałem jednej rzeczy: zdań napisanych pod starsze modele, które na Opus 5.5 i Haiku 4.5 zaczynają szkodzić. Nie chodziło o skracanie — mini-run pokazał, że liczba poleceń nie pogarsza jakości. Chodziło o polecenia, które dziś prowadzą model w złą stronę albo odwołują się do rzeczy, których model nie widzi.

Niczego nie zmieniłem w szablonie. Jest raport techniczny i gotowy zestaw poprawek do przejrzenia — każda poprawka osobno, więc możesz wziąć część. Zestaw sprawdziłem: nakłada się czysto na obecny stan repo, wszystkie 74 testy workflowów przechodzą.

Numery w nawiasach (np. PA-03) to odnośniki do raportu technicznego — tam jest dokładne miejsce, cytat i dowód.

## Najkrócej

Znalazłem 44 rzeczy. 21 ma gotową poprawkę, 8 to decyzje — Twoje albo panelu — reszta to drobiazgi do wiadomości. Trzy są naprawdę ważne:

1. Trzech reviewerów (security, performance, jakość kodu) mówi do modelu językiem czatu i krzyku sprzed pół roku, a dwóch z nich ma polecenia sprzeczne z resztą szablonu.
2. Polecenia uruchamiane w każdej fazie są napisane jak dziennik zmian — „teraz już nie”, „jak dotąd”, „w opisanym runie” — a model nigdy nie widział, jak było wcześniej.
3. Proste role mechaniczne dostają niejasne zadanie i przepalają na nim tury; ustawienia wysiłku myślenia (efort) są dobrane pod poprzedni model.

## 1. Reviewerzy mówią jak z czatu i krzyczą

**Problem.** Pliki reviewerów security, performance i jakości kodu zaczynają się od przykładowych rozmów w rodzaju „użytkownik: skończyłem logowanie, sprawdzisz bezpieczeństwo?”, przedstawiają agenta jako „elitarnego eksperta” i kończą wezwaniem „jesteś ostatnią linią obrony, bądź paranoiczny, nie zostawiaj kamienia na kamieniu”. Każą też oddać raport z podsumowaniem dla zarządu i macierzą ryzyka — a workflow przyjmuje wyłącznie listę findingów (PA-01, PA-02, PA-05). Reviewer jakości dostaje na start polecenie „najpierw zrozum całą architekturę systemu, przeczytaj dokumentację i README” — choć ma ocenić diff jednej fazy (PA-07).

**Przyczyna.** Te pliki przyszły w marcu z projektu compound-engineering, gdzie agenci byli wołani z czatu przez człowieka, a modele trzeba było popychać, żeby w ogóle coś zgłosiły. U nas reviewera woła workflow z konkretnym zadaniem, a Opus 5.5 wykonuje polecenia dosłownie i sam z siebie jest dokładny. Krzyk „bądź paranoiczny” daje dziś więcej zgłoszeń, które potem sceptycy muszą obalać — a nie więcej złapanych błędów. Z domknięcia D1 wiemy, że połowa błędów znalezionych dopiero po fixie to rzeczy przeoczone w pierwszym review, a na przeoczenia pomaga zasięg (więcej próbek, polecenia-listy), nie ton.

Dwa miejsca są wprost sprzeczne z resztą szablonu (PA-03, PA-04). Reviewer performance ma szukać brakującego `useMemo` i `useCallback`, a builder ma React Compiler i zakaz ręcznej memoizacji — w etapie 2 ustaliliśmy wprost, że brak memoizacji przy Compilerze nie jest błędem. Reviewer security przepuszcza `getSession()` na serwerze, „jeśli używane poprawnie”, a skille security i Supabase uznają to za poważną lukę.

**Co proponuję.** Usunąć przykładowe rozmowy, tytuły i wezwania; zostawić konkretne punkty kontroli. Dopisać w dwóch plikach, że w review fazy obowiązuje format z workflowu, a raport z macierzą ryzyka jest tylko do audytu wołanego ręcznie. Reviewerowi jakości ustawić zakres na diff i pliki, których dotyka. Sprzeczności wyrównać do tego, co mówią skille builderów.

**Co to daje.** Reviewer robi to, o co go prosi workflow, a nie to, co opisywał czat. Mniej fałszywych zgłoszeń do obalania, mniej tur na czytanie dokumentacji całego projektu, zero przypadków, w których builder robi dobrze, a reviewer każe to zepsuć.

## 2. Prompty napisane jak dziennik zmian

**Problem.** W poleceniach review i fixa, które idą w każdej fazie, są zdania typu „P3 idą TERAZ do naprawy, nie są JUŻ notatką”, „zrób git diff dokładnie jak dotąd”, „P3 są tu od 3 września”, „to dokładnie ten moment, w którym poprzednio poszło źle”, „w opisanym runie wszystkie trzy miejsca czytały pole źle” (PA-08, PA-09). Tester E2E dostaje „historyczny bug, regresja etap-12b, mobile” (PA-10). Reviewer jakości kodu dowiaduje się, że „od 3 września przejął role” dwóch innych agentów, o których nic nie wie (PA-06).

**Przyczyna.** Każda poprawka pipeline'u dopisywała zdanie, które mówiło, co się zmieniło — dla nas, czytających zmianę. Model nie zna poprzedniej wersji, więc „jak dotąd” nic mu nie mówi, a „opisany run” wisi w próżni: opis tamtego zdarzenia z turniejem i złą kwotą jest w komentarzu programisty, którego model nie dostaje.

Z tej samej rodziny jest compound w autopilocie (PA-14). Ma „wyciągnąć kontekst z sesji i z git diff”. Tyle że jako agent workflowu nie widzi żadnej sesji — co najwyżej ma w kontekście przekazaną wiadomość, którą uruchomiłeś run (tę samą, którą haiku w mini-runie wykonał jak polecenie). A `git diff` w chwili compoundu jest pusty, bo autopilot wszystko już zacommitował.

**Co proponuję.** Każde takie zdanie przepisać na zwykłą regułę w czasie teraźniejszym, zostawiając powód. „P3 idzie do naprawy, więc nit bez konkretnej akcji to zmarnowana tura fixa”. „Nazwa `price` nie mówi, czy to kwota za całość, czy za osobę”. Compoundowi wskazać prawdziwy materiał: raporty review, known-issues, dziennik zadania i commity z poprawkami — i napisać wprost, że rozmowy sesji nie widzi.

**Co to daje.** Każde lekarstwo z historii zostaje, ale model rozumie je bez archeologii. Compound dokumentuje to, co się w runie wydarzyło, a nie treść Twojej wiadomości albo pustkę.

## 3. Fakty, które się zestarzały

**Problem i przyczyna.** Kilka zdań było prawdziwych, kiedy je pisano:

- Dwanaście miejsc wpisuje modelowi rok 2026 na sztywno, zwykle jako „aktualny rok to 2026” (PA-11). Od stycznia każde z nich zacznie datować pliki i zapytania na zły rok.
- Buildery i dev-plan wołają narzędzie Figmy po pełnej nazwie z jednej instalacji (PA-12). U Ciebie Figma jest podłączona inaczej i tej nazwy nie ma — builder nie znajdzie narzędzia i wróci do zgadywania wymiarów, przed czym ta reguła miała chronić. To samo trafi w allowlistę narzędzi, którą panel ma wprowadzić.
- Planner mówi, że plik wyuczonych reguł ma „około 11 KB” i że buildery „nie mają dostępu do reguł projektu” (PA-13). W oferty-online ten plik ma dziś 47 tysięcy znaków, a reguły do builderów docierają. Prawdziwy powód wklejania jest lepszy i zmierzony w mini-runie: reguła wklejona do polecenia jest stosowana, a czekająca w pliku bywa pomijana.
- Reviewer zgodności ze specyfikacją odsyła do osi „architecture” i „typescript”, które zniknęły we wrześniowej konsolidacji (PA-20). Builder fullstack ma „zrobić smoke test przez dev-docs-execute”, czego jako agent nie może (PA-19).
- Archiwizacja dopisuje decyzje do CLAUDE.md (PA-16) — wbrew Twojej decyzji, że żaden skill tego nie robi, a CLAUDE.md uzgadnia się po merge'u.
- Hook od obsługi błędów sprawdza tylko stary sposób pisania funkcji Supabase i żąda `flush()`, którego skill Sentry nie wymaga (PA-18). Nowe funkcje w ogóle nie są sprawdzane. Skill Sentry krzyczy „NIGDY NIE ŁAMIESZ TYCH ZASAD” i „ALL ERRORS MUST BE CAPTURED” (PA-17) — reguły dobre, ton ze stycznia.

**Co proponuję.** Datę brać z komendy `date`. Narzędzie Figmy nazywać po funkcji, z przykładami pełnych nazw. Poprawić rozmiar i powód w plannerze, nazwę osi, usunąć niewykonalny krok. Archiwizacja: nie edytuje CLAUDE.md ani reguł. Hook: sprawdza oba sposoby pisania funkcji i ostrzega o `captureError` bez `await`, zgodnie ze skillem — do czasu, aż zastąpi go bramka ESLint. Zasady Sentry: te same pięć, normalnym zdaniem, każda z powodem.

**Co to daje.** Polecenia przestają kłamać o świecie. Każda z tych poprawek usuwa miejsce, w którym model robi coś złego, bo uczciwie wykonał nieaktualną instrukcję.

## 4. Tury przepalane na prostych rolach

**Problem.** Po fixie haiku ma przejrzeć dodane linie „commitów fixa tej fazy” i wyłapać pusty `catch`, `any`, `console.log`. W historii runów robi to w medianie 20 wywołań narzędzi, rekord 42 (PA-15). To zadanie na jedno polecenie gita.

**Przyczyna.** Polecenie każe mu samemu ustalić, które commity są „tej fazy”, a wyszukiwanie zwraca poprawki ze wszystkich faz. Tymczasem fix w swoim raporcie podaje dokładne hashe commitów — orkiestrator je ma, tylko ich nie przekazuje.

Podobnie dev-plan wysyła agenta badającego repozytorium bez wskazania zakresu, więc ten przechodzi też konwencje zgłoszeń na GitHubie i szablony PR — rzeczy, które planu nie zasilają (PA-21). Research to największa pozycja kosztu dev-plan.

**Co proponuję.** Orkiestrator podaje hashe z raportu fixa wprost; gdy ich nie ma, zostaje obecna instrukcja. Dev-plan dopisuje zakres: technologia, architektura, wzorce, konwencje.

**Co to daje.** Kontrola po fixie kosztuje ułamek obecnego, a działa tak samo. Research planowania nie płaci za pracę, której nikt nie czyta. Po pierwszym runie telemetria pokaże, czy mediana wywołań spadła do kilku.

## 5. Co zostawiam panelowi

Kilka rzeczy nie powinno iść osobną poprawką, bo zależą od decyzji, które panel i tak podejmie:

- **Efort myślenia per rola (PA-22).** Ustawienia dobrano, gdy pipeline jechał na Opus 5 (około 94% historii agentów). Opus 5.5 ma inny domyślny poziom i przy tym samym poziomie myśli dłużej. Trzeba to zmierzyć, a telemetria dziś efortu w ogóle nie zapisuje — proponuję dopisać to pole do rekordu.
- **Skill security u builderów (PA-24).** Builder danych dostaje skill, który jest protokołem audytu z raportem i hasłem „myśl jak atakujący, zakładaj najgorsze”. Builderowi potrzebne są reguły, nie audyt — to naturalny kandydat do podziału na warstwę stałą i referencyjną.
- **Wyuczone reguły trzema kanałami (PA-27)** — już przesądzone, przy wdrożeniu trzeba usunąć też polecenie „przeczytaj plik” z plików builderów.
- **Ile warstw weryfikacji (PA-29).** Builder, domknięcie fazy, fix, walidacja końcowa i hook uruchamiają te same sprawdzenia. Przewodnik wskazuje polecenia weryfikacji jako rzecz do ponownego przetestowania na nowym modelu. To bramki, nie proza — do decyzji z pomiarem, nie do wycięcia.
- **Obowiązkowy research w dev-plan także przy małych planach (PA-30)** i **przepisanie reviewera security z 191 do około 90 linii (PA-39)** — to już jest w planie panelu.
- **Kopia skilla Figmy (PA-25)** jest starsza niż wersja w pluginie — brakuje w niej zasad o ikonach i obrazach. To tekst Figmy, nie nasz: do odświeżenia, nie do przerabiania.
- **Twoje coding-rules (PA-26)** — tylko do wiadomości, bez poprawek. Najważniejsze: tabela „10 anty-patternów AI z częstościami” opisuje modelowi jego rzekome skłonności i powtarza reguły z akapitu wyżej; zdanie „nie modyfikuj swoich reguł” gryzie się z compoundem, który do reguł pisze; dwa razy jest „uruchom testy przed gotowe”.

Dla panelu z tego audytu wynikają też proste zasady pisania stałej części promptu każdej roli: pisać od zera, a nie przerabiać plików z compound-engineering; jeden format wyjścia (ten z workflowu); powód przy każdej regule; zero dat, numerów poprawek i nazw incydentów; rolom mechanicznym dawać dokładne polecenie i dane, nie zadanie do rozgryzienia; nazwy narzędzi brać z instalacji.

## 6. Co jest w porządku

Sporo rzeczy przewodnik uznaje za typowe błędy, a u nas ich nie ma: próśb o „myślenie krok po kroku”, każących modelowi pisać rozumowanie w odpowiedzi (na Opus 5.5 to może skończyć się odmową), zakazów formatowania, tłumienia komentarzy w trakcie pracy, przypomnień wstawianych co kilka tur. Polecenia dla haiku są krótkie i konkretne. Bloki o długich komendach, pracy z GitHubem, granicach zaufania, plikach binarnych i zakazie osłabiania testów mają powód przy każdym zdaniu — zostają w całości, łącznie z mocnymi słowami tam, gdzie stoi za nimi realna awaria.

## Co teraz

Do Twojej decyzji jedna rzecz: które poprawki brać i kiedy. Moja rekomendacja:

- **Od razu, niezależnie od panelu:** sprzeczności, nieaktualne fakty, zdania-dziennik, compound, zakres fixa, zakres researchu w dev-plan i hook (rozdziały 2–4 i sprzeczności z rozdziału 1). Każdy projekt panelu i tak by je przyjął.
- **Przykłady, tytuły i wezwania w plikach reviewerów (reszta rozdziału 1):** tanie i zgodne z kierunkiem panelu, ale panel i tak zastąpi te pliki nowymi plikami klas ról. Brać teraz tylko, jeśli wdrożenie panelu jest dalej niż jedna iteracja.
- Po naniesieniu czegokolwiek w szablonie: nowa sesja przed autopilotem (bufor instrukcji z mini-runu).

Zmiany w tekście reviewerów warto sprawdzić przed i po na jednej historycznej fazie — ile findingów, ile obalonych przez sceptyków, ile potwierdzonych. Resztę sprawdzi pierwszy run w telemetrii.
