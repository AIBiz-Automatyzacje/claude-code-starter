---
name: dev-ideate
description: "Multi-agent generowanie i filtrowanie pomyslow na ulepszenia projektu."
argument-hint: "[opcjonalnie: temat, obszar lub ograniczenie]"
---

# Generowanie pomyslow na ulepszenia

**Uwaga: Aktualny rok to 2026.** Uzywaj tego przy datowaniu dokumentow ideacji i sprawdzaniu niedawnych artefaktow.

`/dev-ideate` poprzedza `/dev-brainstorm`.

- `/dev-ideate` odpowiada na pytanie: "Jakie sa najlepsze pomysly warte zbadania?"
- `/dev-brainstorm` odpowiada na pytanie: "Co dokladnie wybrany pomysl powinien oznaczac?"
- `/dev-plan` odpowiada na pytanie: "Jak to powinno byc zbudowane?"

Ten workflow produkuje rankingowany artefakt ideacji w `docs/ideation/`. **Nie** produkuje wymagan, planow ani kodu.

## Metoda interakcji

Uzywaj narzedzia pytan platformy gdy dostepne (`AskUserQuestion` w Claude Code). W przeciwnym razie prezentuj numerowane opcje w chacie i czekaj na odpowiedz uzytkownika przed kontynuacja.

Zadawaj jedno pytanie na raz. Preferuj zwiezle single-select choices gdy istnieja naturalne opcje.

## Wskazowka fokusowa

<focus_hint> #$ARGUMENTS </focus_hint>

Interpretuj podany argument jako opcjonalny kontekst. Moze to byc:

- koncept, np. `usprawnienia DX`
- sciezka, np. `src/components/`
- ograniczenie, np. `szybkie wygrane niskim kosztem`
- wskazowka ilosci, np. `top 3`, `100 pomyslow`, `podniesc poprzeczke`

Jesli nie podano argumentu, przeprowadz ideacje calego projektu autonomicznie.

## Glowne zasady

1. **Najpierw rozpoznanie** — przeskanuj faktyczny codebase zanim zaczniesz generowac pomysly. Nie generuj abstrakcyjnych porad produktowych oderwanych od repozytorium.
2. **Dywergencja przed ocena** — wygeneruj pelny zestaw pomyslow zanim zaczniesz oceniac ktorykolwiek z nich.
3. **Filtrowanie adversarialne** — mechanizmem jakosci jest explicite odrzucenie z uzasadnieniem, nie optymistyczny ranking.
4. **Zachowaj oryginalny mechanizm** — wygeneruj wiele pomyslow, skrytykuj cala liste, potem wyjasniaj tylko ocalale. Nie pozwol dodatkowym procesom zaciemnic tego wzorca.
5. **Roznorodnosc agentow ulepsza pule kandydatow** — rownolegle sub-agenty sa mechanizmem wspierajacym bogatsze generowanie i krytyczne, nie zastepuja glownego workflow.
6. **Zachowaj artefakt wczesnie** — zapisz dokument ideacji przed prezentacja wynikow, zeby praca przetrwala przerwania.
7. **Kieruj akcje do brainstormingu** — ideacja identyfikuje obiecujace kierunki; `/dev-brainstorm` definiuje wybrany kierunek wystarczajaco precyzyjnie do planowania.
8. **Każdy pomysł niesie podstawę (basis) i przechodzi meeting-test** — wymuś przy każdym pomyśle jawną podstawę (`direct` / `external` / `reasoned`), żeby odsiać puste podpowiedzi „dla zapełnienia". Próg odsiewu: czy ten pomysł zasługuje na osobną dyskusję w zespole? Jeśli nie — nie jest ocalałym.

## Przebieg

### Faza 0: Wznowienie i scope

#### 0.1 Sprawdz niedawne prace ideacyjne

Sprawdz `docs/ideation/` pod katem dokumentow ideacji utworzonych w ciagu ostatnich 30 dni.

Traktuj poprzedni dokument ideacji jako relevantny gdy:
- temat pokrywa sie z zadanym fokusem
- sciezka lub podsystem pokrywa sie z zadanym fokusem
- zapytanie jest otwarte i istnieje oczywisty niedawny otwarty dokument ideacji

Jesli relevantny dokument istnieje, zapytaj czy:
1. kontynuowac od niego
2. zaczac od nowa

Jesli kontynuacja:
- przeczytaj dokument
- podsumuj co juz zostalo zbadane
- zachowaj poprzednie statusy pomyslow i wpisy logu sesji
- aktualizuj istniejacy plik zamiast tworzenia duplikatu

#### 0.2 Interpretuj fokus i ilosc

Wywnioskuj z argumentu:

- **Kontekst fokusowy** — koncept, sciezka, ograniczenie lub otwarty
- **Nadpisanie ilosci** — wskazowka zmieniajaca liczbe kandydatow lub ocalatych

Domyslna ilosc:
- kazdy sub-agent ideacji generuje ok. 7-8 pomyslow (daje 28-32 surowe pomysly z 4 agentow, ~20-25 po deduplikacji)
- zachowaj 5-7 najlepszych ocalatych

Honoruj wyrazne nadpisania jak:
- `top 3`
- `100 pomyslow`
- `idz glebiej`
- `podniesc poprzeczke`

Interpretuj rozsadnie zamiast formalnie parsowac.

### Faza 1: Skan codebase

Przed generowaniem pomyslow, zbierz kontekst codebase.

Uruchom agenty rownolegle na **pierwszym planie** (nie uzywaj dispatchowania w tle — wyniki sa potrzebne przed kontynuacja):

1. **Szybki skan kontekstu** — wyslij agenta eksploracyjnego (Agent tool, type: Explore) z nastepujacym promptem:

   > Przeczytaj CLAUDE.md projektu (potem README.md jesli nie istnieje), nastepnie odkryj uklad katalogow najwyzszego poziomu uzywajac narzedzia Glob (wzorzec `*` lub `*/*`). Zwroc zwiezle podsumowanie (do 30 linii) obejmujace:
   > - ksztalt projektu (jezyk, framework, uklad katalogow)
   > - widoczne wzorce lub konwencje
   > - oczywiste bolaczki lub luki
   > - prawdopodobne punkty dzwigni dla ulepszen
   >
   > Skan plytki — czytaj tylko dokumentacje najwyzszego poziomu i strukture katalogow. Nie rob glebokiego przeszukiwania kodu.
   >
   > Wskazowka fokusowa: {focus_hint}

2. **Skan TODO/FIXME i historia git** — wyslij agenta eksploracyjnego z promptem:

   > Przeskanuj codebase pod katem sygnalow jakosci:
   > - Wyszukaj komentarze `TODO` i `FIXME` (uzywajac Grep)
   > - Sprawdz `git log --oneline -30` dla niedawnych zmian i trendow
   > - Sprawdz `git log --oneline --since="30 days ago"` dla aktywnych obszarow
   > Zwroc zwiezle podsumowanie znalezionych sygnalow (do 20 linii).
   >
   > Wskazowka fokusowa: {focus_hint}

3. **Zewnetrzny grounding (opcjonalnie)** — gdy fokus lub kontekst codebase wskazuje na obszar z istotnym prior art, konkurencyjnymi wzorcami lub zewnetrznymi rozwiazaniami, uruchom agenta `web-research-specialist` (Agent tool, subagent_type: "web-research-specialist") z pytaniem o trendy i wzorce rozwiazan konkurencji dla tego obszaru. Pomin ten agent, gdy fokus jest czysto wewnetrzny (np. tech debt, refaktoryzacja) bez zewnetrznego punktu odniesienia.

Skonsoliduj wyniki w krotkie podsumowanie rozpoznania:

- **Kontekst codebase** — ksztalt projektu, widoczne wzorce, oczywiste bolaczki, punkty dzwigni
- **Sygnaly jakosci** — TODO/FIXME, aktywne obszary, niedawne trendy zmian
- **Zewnetrzny grounding** — trendy/wzorce konkurencji, jesli agent 3 zostal uruchomiony

Domyslnie **nie** rob dodatkowego zewnetrznego researchu poza agentem 3 — jesli fokus nie dotyka obszaru z prior art, pomin agenta 3 i ten punkt podsumowania.

### Faza 2: Dywergentna ideacja

Postepuj dokladnie wedlug tego mechanizmu:

1. Wygeneruj pelna liste kandydatow zanim zaczniesz krytykowac ktorykolwiek pomysl.
2. Kazdy sub-agent celuje w ok. 7-8 pomyslow. Z 4 agentami daje to 28-32 surowe pomysly, ktore po scaleniu i deduplikacji daja ok. 20-25 unikatowych kandydatow. Dostosuj cel per agent gdy obowiazuja nadpisania ilosci.
3. Przekraczaj bezpieczna oczywista warstwe. Pierwsze kilka pomyslow kazdego agenta jest zazwyczaj oczywiste — idz dalej.
4. Uziemiaj kazdy pomysl w skanie z Fazy 1.
5. Uzywaj tego wzorca promtpowania jako kregoslupa:
   - najpierw wygeneruj wiele pomyslow
   - potem zakwestionuj je systematycznie
   - potem wyjasniaj tylko ocalale szczegolowo
6. Uzywaj sub-agentow (Agent tool, type: Explore) zeby poprawic roznorodnosc puli kandydatow, nie zeby zastepowac glowny mechanizm.
7. Daj kazdemu sub-agentowi ideacji to samo:
   - podsumowanie rozpoznania
   - wskazowke fokusowa
   - cel ilosci per agent (~7-8 pomyslow domyslnie)
   - instrukcje generowania surowych kandydatow, nie krytyki
8. Przypisz kazdemu sub-agentowi inny frame ideacji jako **bias startowy, nie ograniczenie**. Instruuj kazdego agenta, zeby zaczynal ze swojej perspektywy ale podazal za kazdym obiecujacym watek gdziekolwiek prowadzi — pomysly cross-cutting obejmujace wiele frame'ow sa cenne, nie poza scope'm.

   **6 frame'ów ideacji** — 4 techniczne dostosowane do stacku React/TypeScript/Supabase/Tailwind/Vite + 2 kreatywne. Frame to bias startowy, nie ograniczenie; przy domyślnych 4 agentach rozdziel frame'y tak, by oba kreatywne (5-6) były reprezentowane jako biasy obok technicznych:

   1. **Tech Debt Scout** — szuka:
      - typy `any` w TypeScript
      - komentarze TODO/FIXME
      - pliki > 300 linii
      - brakujace testy
      - cykliczne zaleznosci (circular deps)
      - nieaktualne zaleznosci (outdated deps)
      - niespojne wzorce kodowania

   2. **UX Advocate** — szuka:
      - brak stanow empty/error/loading w komponentach React
      - problemy z dostepnoscia (WCAG) — brak aria-labels, slaby kontrast, brak obslug klawiatury
      - brak responsywnosci (Tailwind breakpoints)
      - brak onboardingu uzytkownika
      - niespojny design (niezgodnosc z Tailwind design system)

   3. **Performance Analyst** — szuka:
      - rozmiar bundle (brak code splitting)
      - brak lazy loading (`React.lazy()`, `Suspense`)
      - zapytania N+1 do Supabase
      - brak memoizacji (`useMemo`, `useCallback`, `React.memo`)
      - brak optymalizacji obrazow
      - nieefektywne re-rendery
      - brak indeksow w Supabase

   4. **Product Strategist** — szuka:
      - brakujace integracje (zewnetrzne API, webhooks)
      - brak analytics (zdarzenia uzytkownika, metryki)
      - brak monitoringu (Sentry, logowanie bledow)
      - brakujace feature'y wzgledem konkurencji
      - mozliwosci automatyzacji (cron joby, triggery Supabase)
      - brak internacjonalizacji (i18n)

   5. **Cross-Domain Analyst** — przenosi wzorce z niepowiązanych dziedzin:
      - jak inne branże lub systemy rozwiązują analogiczny problem (gry, finanse, logistyka, biologia, infrastruktura)
      - notuj analogię tylko gdy podobieństwo strukturalne się trzyma (te same ograniczenia, te same tryby awarii), nie gdy zgadza się samo słownictwo
      - pytanie wiodące: „kto na świecie rozwiązał to lepiej i co z tego da się przenieść?"

   6. **Constraint Flipper** — kwestionuje przyjęte ograniczenia:
      - co gdyby odwrócić założenie uznawane za stałe (koszt, kolejność kroków, kto coś robi, czy w ogóle to robić)
      - usuń ograniczenie i sprawdź, jaki lepszy projekt staje się możliwy
      - pytanie wiodące: „które »tak musi być« jest naprawdę wyborem, nie prawem?"

9. Popros kazdego sub-agenta o zwrocenie ustandaryzowanej struktury dla kazdego pomyslu:
   - title
   - summary
   - why_it_matters
   - evidence (dowody / punkty uziemienia)
   - basis (podstawa pomysłu: `direct` — wprost z kodu/skanu repo | `external` — z wzorca zewnętrznego lub innej domeny | `reasoned` — z rozumowania bez twardego dowodu)
   - boldness (odwaga: low / medium / high)
   - focus_fit (dopasowanie do fokusa: jesli podano)
10. Scal i zdeduplikuj outputy sub-agentow w jedna glowna liste kandydatow.
11. **Syntezuj kombinacje cross-cutting.** Po deduplikacji przeskanuj scalona liste pod katem pomyslow z roznych frame'ow ktore razem sugeruja cos silniejszego niz kazdy osobno. Jesli dwa lub wiecej pomyslow naturalnie laczy sie w propozycje o wyzszej dzwigni, dodaj polaczony pomysl do listy (oczekuj 3-5 dodatkow maksymalnie).
12. Rozkladaj pomysly na wiele wymiarow gdy uzasadnione:
    - workflow/DX
    - niezawodnosc
    - rozszerzalnosc
    - brakujace mozliwosci
    - dokumentacja / kumulowanie wiedzy
    - jakosc i utrzymanie
    - dzwignia na przyszla prace
13. Jesli podano fokus, przekaz go kazdemu sub-agentowi i wazyj scalona liste w jego kierunku, nie wykluczajac silniejszych sasiadujacych pomyslow.

Mechanizm do zachowania:
- najpierw wygeneruj wiele pomyslow
- potem skrytykuj pelna polaczona liste
- potem wyjasniaj tylko ocalale szczegolowo

Wzorzec sub-agentow do zachowania:
- niezalezna ideacja z frame'ami jako biasami startowymi
- scalenie, deduplikacja i synteza cross-cutting przez orkiestratora
- krytyka dopiero po istnieniu polaczonej i zsyntezowanej listy

### Faza 3: Filtrowanie adversarialne

Przejrzyj kazdy wygenerowany pomysl krytycznie.

Preferuj dwuwarstwowa krytyke:
1. Jeden lub wiecej skeptycznych sub-agentow (Agent tool, type: Explore) atakuje scalona liste z roznych katow.
2. Orkiestrator syntezuje te krytyki, stosuje rubryke spojnie, punktuje ocalale i decyduje o finalnym rankingu.

Nie pozwalaj agentom krytykujacym generowac pomyslow zastepcych w tej fazie, chyba ze explicite dopracowuja.

Agenci krytykujacy moga dostarczac lokalne oceny, ale finalna wladza punktowania nalezy do orkiestratora, zeby ranking byl spojny miedzy roznymi frame'ami i perspektywami.

Dla kazdego odrzuconego pomyslu napisz jednoliniowe uzasadnienie.

Kryteria odrzucania:
- zbyt ogolnikowy
- nie do zrealizowania
- duplikuje silniejszy pomysl
- nie uziemiony w aktualnym codebase
- zbyt kosztowny wzgledem prawdopodobnej wartosci
- juz pokryty przez istniejace workflow lub dokumentacje
- ciekawy ale lepiej obsluzony jako wariant brainstormu, nie ulepszenie produktu
- **nie przechodzi meeting-testu** — nie zasługuje na osobną dyskusję w zespole
- **słaba podstawa (basis)** — oznaczony `reasoned` bez wiarygodnego rozumowania, albo `direct`/`external` bez realnego pokrycia w dowodach

Spojna rubryka ocalatych wazaca:
- uziemienie w aktualnym repo
- oczekiwana wartosc
- nowatorstwo
- pragmatyzm
- dzwignia na przyszla prace
- obciazenie implementacyjne
- pokrywanie sie z silniejszymi pomyslami
- siła i typ podstawy (basis): przy równej reszcie `direct` > `external` > `reasoned`

Docelowy output:
- zachowaj 5-7 ocalatych domyslnie
- jesli zbyt wielu przezywa, uruchom drugi, surowszy przebieg
- jesli mniej niz 5 przezywa, raportuj to uczciwie zamiast obnizac poprzeczke

Verdicts (werdykty) do przypisania ocalatym:
- **RECOMMENDED** — silny pomysl, wysokie uziemienie, jasna wartosc
- **WORTH_EXPLORING** — obiecujacy, wymaga glebszego zbadania
- **DEFER** — wartosc istnieje ale nie teraz (np. za wczesnie, zalezy od innej pracy)
- **REJECTED** — odrzucony z uzasadnieniem (tylko w tabeli odrzucen)

### Faza 4: Prezentacja ocalatych

Zaprezentuj ocalale pomysly uzytkownikowi przed zapisem trwalego artefaktu.

Ta pierwsza prezentacja jest checkpointem review, nie finalnym zarchiwizowanym wynikiem.

Prezentuj tylko ocalale pomysly w ustrukturyzowanej formie:

- tytul
- opis
- uzasadnienie
- wady / ryzyka
- confidence score (0-100%)
- szacowana zlozonosc (Low / Medium / High)
- werdykt (RECOMMENDED / WORTH_EXPLORING / DEFER)

Nastepnie dolacz krotkie podsumowanie odrzucen zeby uzytkownik widzial co bylo rozwazone i odciete.

Utrzymuj prezentacje zwiezla. Trwaly artefakt trzyma pelny rekord.

Pozwol na krotkie pytania uzupelniajace i lekkie wyjasnienia przed zapisem artefaktu.

Nie zapisuj dokumentu ideacji jeszcze, chyba ze:
- uzytkownik wskazuje ze zestaw kandydatow jest wystarczajaco dobry do zachowania
- uzytkownik prosi o dopracowanie i kontynuacje w sposob ktory powinien byc zapisany
- workflow zamierza przekazac do `/dev-brainstorm` lub zakonczyc sesje

### Faza 5: Zapis artefaktu ideacji

Zapisz artefakt ideacji po przeglądnieciu zestawu kandydatow.

Zawsze zapisz lub zaktualizuj artefakt przed:
- przekazaniem do `/dev-brainstorm`
- zakonczeniem sesji

Aby zapisac artefakt:

1. Upewnij sie ze `docs/ideation/` istnieje (`mkdir -p docs/ideation/`)
2. Wybierz sciezke pliku:
   - `docs/ideation/YYYY-MM-DD-<temat>-ideation.md`
   - `docs/ideation/YYYY-MM-DD-open-ideation.md` gdy brak fokusa
3. Zapisz lub zaktualizuj dokument ideacji

Uzyj tej struktury i pomijaj wyraznie nieistotne pola tylko gdy konieczne:

```markdown
---
date: YYYY-MM-DD
topic: <kebab-case-topic>
focus: <opcjonalna wskazowka fokusowa>
---

# Ideacja: <Tytul>

## Kontekst codebase
[Podsumowanie rozpoznania z Fazy 1]

## Pomysly w rankingu

### 1. <Tytul pomyslu>
**Werdykt:** [RECOMMENDED / WORTH_EXPLORING / DEFER]
**Opis:** [Konkretne wyjasnienie]
**Uzasadnienie:** [Dlaczego to ulepsza projekt]
**Wady:** [Kompromisy lub koszty]
**Confidence:** [0-100%]
**Zlozonosc:** [Low / Medium / High]
**Status:** [Unexplored / Explored]

## Podsumowanie odrzucen

| # | Pomysl | Powod odrzucenia |
|---|--------|------------------|
| 1 | <Pomysl> | <Powod odrzucenia> |

## Log sesji
- YYYY-MM-DD: Poczatkowa ideacja — <liczba kandydatow> wygenerowanych, <liczba ocalatych> ocalalo
```

Jesli wznawianie:
- aktualizuj istniejacy plik w miejscu
- dopisz do logu sesji
- zachowaj znaczniki Explored

### Faza 6: Dopracowanie lub przekazanie

Po prezentacji wynikow zapytaj co powinno sie wydarzyc dalej.

Oferuj te opcje:
1. brainstorm wybranego pomyslu
2. dopracuj ideacje
3. zakoncz sesje

#### 6.1 Brainstorm wybranego pomyslu

Jesli uzytkownik wybiera pomysl:
- zapisz lub zaktualizuj dokument ideacji najpierw
- oznacz ten pomysl jako `Explored`
- odnotuj date brainstormu w logu sesji
- wywolaj `/dev-brainstorm` z wybranym pomyslem jako ziarnem

**Nie** pomijaj brainstormingu i nie przechodzi prosto do planowania z outputu ideacji.

#### 6.2 Dopracuj ideacje

Kieruj dopracowanie wedlug intencji:

- `dodaj wiecej pomyslow` lub `zbadaj nowe katy` -> wroc do Fazy 2
- `ponowna ocena` lub `podniesc poprzeczke` -> wroc do Fazy 3
- `kop glebiej w pomysl #N` -> rozwin analize tylko tego pomyslu

Po kazdym dopracowaniu:
- zaktualizuj dokument ideacji przed jakimkolwiek przekazaniem lub zakonczeniem sesji
- dopisz wpis do logu sesji

#### 6.3 Zakoncz sesje

Przy konczeniu:
- zaproponuj commitowanie samego dokumentu ideacji
- nie tworzgalezi
- nie pushuj
- jesli uzytkownik odmawia, zostaw plik niezcommitowany

## Kontrola jakosci

Przed zakonczeniem sprawdz:

- zestaw pomyslow jest uziemiony w aktualnym repo
- lista kandydatow zostala wygenerowana przed filtrowaniem
- oryginalny mechanizm wiele-pomyslow -> krytyka -> ocalale zostal zachowany
- jesli uzyto sub-agentow, poprawili roznorodnosc bez zastepowania glownego workflow
- kazdy odrzucony pomysl ma uzasadnienie
- ocalale sa materialnie lepsze niz naiwna lista "daj mi pomysly"
- artefakt zostal zapisany przed jakimkolwiek przekazaniem lub zakonczeniem sesji
- dzialanie na pomysle kieruje do `/dev-brainstorm`, nie bezposrednio do implementacji
