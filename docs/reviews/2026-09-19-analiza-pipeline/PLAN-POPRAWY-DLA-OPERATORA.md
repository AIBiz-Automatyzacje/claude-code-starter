# Plan poprawy szablonu — wersja dla operatora

**Data:** 2026-09-30. **Status:** zaakceptowany 2026-09-30, trzy decyzje według rekomendacji. Wersja techniczna (dla Claude'a, z plikami i numerami linii): `PLAN-POPRAWY.md`.

## Wniosek

Wszystko, co ustaliliśmy w analizie, da się wdrożyć w **17 paczkach**, jedna po drugiej, w około **32–38 sesjach**. Każda paczka to osobna gałąź:
najpierw testy, potem kod, potem sprawdzenie typów, testów i lintera, na końcu smoke autopilota na kopii oferty-online. Dopiero zielony smoke wpuszcza
paczkę do głównej gałęzi. Jeśli coś pójdzie źle, wyrzucamy jedną paczkę, a nie pół szablonu.

Skrypt sprawdził plan w obie strony względem całej historii ustaleń: **395 pozycji, każda ma paczkę albo jawne „wypada” z powodem, zero braków**.
Sam skrypt też został sprawdzony — na siedmiu celowo zepsutych wersjach planu wyłapał każdy błąd. Niezależny recenzent sprawdził plan na kodzie: pierwsza wersja
nie nadawała się do przyjęcia (jedna paczka była niewykonalna w tej postaci, kilka miało niepełne listy plików i testów) — wszystkie 25 uwag naniosłem.

Potrzebuję od Ciebie trzech decyzji (na końcu), każda z moją rekomendacją.

## Jak to jest ułożone i dlaczego w tej kolejności

**Grupa I — porządek i koszt (paczki 0–5).** Najpierw rzeczy, które niczego nie psują, a dużo dają. Paczka 0 to siatka bezpieczeństwa: skrypt,
który sam przygotowuje kopię projektu do smoke'a (dziś to kilkanaście ręcznych kroków), i test, który krzyczy, gdy jakiś plik odwołuje się do nieistniejącego
skilla albo agenta. Paczka 1 usuwa dziewięć nieużywanych skilli i martwy workflow. Paczka 2 daje doctora i instrukcję instalacji wszystkiego per projekt —
o braku Supabase CLI dowiesz się przed startem, a nie w środku runu. Paczka 3 to **największa oszczędność całego planu**: każdy agent dostaje tylko te
narzędzia, których używa. Dziś agent startuje z 73–84 tysiącami tokenów, z czego większość to opisy narzędzi, których nigdy nie woła; cel to 10–40 tysięcy.
W modelu kosztu sama ta zmiana dawała około 40% taniej za typowe zadanie — część tego zysku zabrały już porządki konta (start spadł ze 115–135 do 73–84 tysięcy),
resztę pokaże smoke. Paczka 4 porządkuje start i koniec runu: CLAUDE.md przestaje puchnąć (w oferty urósł ponad dwudziestokrotnie w miesiąc,
a czyta go każdy builder i reviewer), a run nie wystartuje na czerwonym main. Paczka 5 to dev-pr i bot: mniej szumu w uwagach, jasna rekomendacja
„merguj / nie merguj / kolejna tura” po każdej turze.

**Grupa II — mechanika fazy (paczki 6–9).** Tu zmienia się to, jak faza się domyka i naprawia. Paczka 6 zastępuje agenta, który „udaje lintera”,
jednym skryptem bramek (ESLint, knip, typy, migracje, mutanty dla testów). Paczka 7 każe skryptowi, a nie agentowi, składać paczkę informacji dla reviewerów.
Paczka 8 to pętla naprawcza: dziś kontrola po poprawkach łapie zero z trzydziestu błędów, które poprawki wprowadzają — po zmianie połowę; poprawiane są
już tylko poważne uwagi, drobne idą do listy znanych problemów i do bota. Paczka 9 to tańsi i uczciwsi sceptycy: dostają sam zarzut, bez tłumaczenia autora,
i sprawdzają po cztery naraz.

**Grupa III — prompty i wiedza (paczki 10–12).** Najbardziej ryzykowna część, bo zmienia to, co agenci czytają. Paczka 10 wyjmuje wyuczone reguły projektu
z pliku ładowanego każdemu agentowi i daje builderowi tylko te, które dotyczą jego plików; lekcje, które da się wymusić lintem, trafiają do Ciebie jako
propozycja bramki. Paczka 11 pisze od nowa pliki sześciu reviewerów — ale tylko tam, gdzie test review pokazał zysk; tam, gdzie pokazał stratę (security,
code-quality), zostaje dzisiejsza długość list. Paczka 12 robi to samo dla builderów i przepisuje coding-rules (tu każdy wiersz zatwierdzasz Ty).

**Grupa IV — planowanie, E2E, ogrodnik, zamknięcie (paczki 13–16).** Paczka 13 łączy dev-plan z dev-docs w jedną komendę, z budżetem rozmiaru pliku
przed pisaniem kodu. Paczka 14 kończy ze STOP-ami E2E w środku runu: brak środowiska wychodzi przed startem, a test, którego nie da się wykonać w trakcie, idzie na Twoją listę
do sprawdzenia ręcznego, a projekt
dostaje własny skill weryfikacji z mapą funkcji. Paczka 15 to ogrodnik — po każdym zadaniu liczy obejścia i wyciszenia w kodzie i daje znać, gdy przybywa.
Paczka 16 to ponowny prompt-audit całości i karta odczytu: co i kiedy sprawdzić w telemetrii na pierwszym nowym projekcie.

## Jedna rzecz, o którą prosiłeś wprost

Pliki reviewerów i builderów są pisane **raz** — od zera w paczkach 11 i 12. Wcześniej zmieniamy w nich tylko listę narzędzi i kilka jednolinijkowych łat.
Jedną rzecz zrobiłem inaczej, niż sugerowałeś, i chcę, żebyś to wiedział: cztery poprawki faktów w plikach reviewerów (na przykład reviewer wydajności każe
szukać braku `useMemo`, którego builder ma nie pisać) wchodzą łatą już w paczce 1. Problem: gdyby czekały do paczki 11, każdy z dziesięciu smoke'ów po drodze
płaciłby za fałszywe uwagi i fałszywe poprawki. To kilka linii, a paczka 11 i tak przepisuje te pliki, zachowując poprawki. Pozostałe poprawki prompt-auditu
trafiają do paczki, która przebudowuje dany fragment pliku.

## Co się zmieni dla Ciebie w trakcie

Po każdej paczce zmieniającej autopilota otwierasz jedną sesję w kopii projektu (skrypt ją przygotuje) i wklejasz jedno polecenie — około 25 minut,
z czego większość to czekanie. Raz, w paczce 2, potrzebuję testu instalacji na czystym koncie.

Jedno odstępstwo od ustaleń, o którym musisz wiedzieć: w analizie zapisaliśmy, że agent zapisujący stan autopilota (`stan:zapis`) znika. Recenzent pokazał,
że autopilot zapisuje stan w 13 miejscach, a workflow sam nie umie pisać plików. W paczce 7 zapis przejmą agenci, którzy w danym miejscu i tak startują;
tam, gdzie takiego agenta nie ma, `stan:zapis` zostanie. Listę tych miejsc zapiszę w HANDOFF. W paczce 12 zatwierdzasz zmiany w coding-rules wiersz po wierszu.
Katalogu `~/test-review` nie kasujemy do końca paczki 12 — jest potrzebny do ślepych testów.

Wyniki odczytujemy potem telemetrią na Twoim pierwszym nowym projekcie. Każda paczka ma zapisany próg, przy którym wiadomo, że zmianę trzeba cofnąć albo
poprawić — to nie są bramki wdrożenia, tylko ściąga do późniejszego odczytu.

## Trzy decyzje

**1. Czy zostają ślepe testy przed i po zmianie promptów reviewerów i builderów?**
Moja rekomendacja: **tak, ale jako dwa testy, a nie osobno dla każdej zmiany.** Problem: telemetria na nowym projekcie pokaże ewentualną stratę dopiero po
tygodniach i nie powie, która zmiana ją spowodowała, bo wszystkie paczki wejdą razem. Przyczyna ostrożności: test review już raz pokazał, że skrócone
brzmienie potrafi zgubić połowę trafień — security z szesnastu do ośmiu, code-quality z dwunastu do dwóch — i to dokładnie w rolach, które paczka 11 przepisuje.
Co robimy: stare i nowe pliki reviewerów puszczamy na tym samym, już poprawionym pipelinie, na siedmiu fazach z testu review (tych, gdzie security, code-quality
i performance miały najwięcej trafień), a jeden sędzia ocenia oba warianty naraz, nie wiedząc, który jest który. Wrześniowego wyniku nie da się użyć jako „przed”,
bo jechał na starym pipelinie. Koszt około 30–40 milionów jednostek i dwie sesje. Builderów sprawdzamy na jednej–dwóch fazach (około 10–15 milionów). Razem około
45–60 milionów, czyli mniej więcej jedno dzisiejsze zadanie. Osobno i tanio (2–4 miliony) sprawdzamy nowych sceptyków na starych findingach, zanim wejdą. Co Ci to da: nie wypuścisz do nowych projektów reviewerów, którzy cicho przestali łapać błędy bezpieczeństwa.
Inne możliwości: tylko test reviewerów (około 30–40 milionów; buildery sprawdzi telemetria) albo bez testów (najszybciej, ale z ryzykiem cichej straty).

**2. Kiedy wysyłamy szablon na GitHuba?**
Moja rekomendacja: **po każdej zamkniętej grupie — cztery razy — i zawsze po zielonym smoke'u.** Problem: projekty i kursanci dostają zmiany dopiero po wysłaniu
i synchronizacji. Wysyłka w środku grupy dałaby im stan przejściowy (na przykład nowych reviewerów bez nowych builderów). Co Ci to da: cztery spójne wersje
zamiast siedemnastu, każda sprawdzona; telemetria z pierwszej iteracji pojedzie razem z grupą I. Inne możliwości: jedna wysyłka na końcu (najmniej zamieszania,
ale wszystkie projekty czekają do końca serii) albo po każdej paczce (najszybciej, najwięcej stanów przejściowych).

**3. Smoke po każdej paczce czy po grupie?**
Moja rekomendacja: **po każdej paczce, która zmienia autopilota — 15 razy, około 75–80 milionów jednostek łącznie.** Problem: jeśli smoke po grupie się
wysypie, trzeba szukać, która z trzech–czterech paczek zawiniła, a każdy dodatkowy smoke to kolejne 5 milionów i Twoja sesja. Po każdej paczce winny jest
znany od razu, a cofnięcie to wyrzucenie jednej gałęzi. Tak zresztą zapisałeś założenia przy zmianie planu. Co Ci to da: spokój, że główna gałąź szablonu
zawsze działa. Inna możliwość: smoke po grupie — około pięciu razy, 25–30 milionów, ale z ryzykiem szukania winnego.

## Co dalej po Twojej akceptacji

Zapiszę decyzje w HANDOFF, przygotuję instrukcję na pierwszą sesję wdrożenia (paczka 0 — siatka bezpieczeństwa), uzupełnię pamięć projektu i zacommituję
katalog analizy. Wdrażanie zaczyna się w nowej sesji.
