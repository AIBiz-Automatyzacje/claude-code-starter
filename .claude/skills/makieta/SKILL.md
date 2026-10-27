---
name: makieta
description: "Narzędzie „makieta obok aplikacji” w smoke'u operatora: aplikacja w ramkach kilku urządzeń obok makiety bieżącego ekranu, decyzje operatora zapisywane do linii checklisty, zgłoszenia błędów dostarczane do sesji smoke'u na koniec przeglądu i dokument ustaleń z operatorem. Używaj, gdy operator mówi „odpalamy narzędzie makiet”, „makieta obok aplikacji”, „przejdźmy punkty wizualne”, wpisuje /makieta albo smoke ma punkty z `visual-diff/<ekran>-figma.png`."
argument-hint: "[plik smoke'u] | stop | stan"
---

# `/makieta` — punkty wizualne smoke'u obok makiet

Operator przechodzi punkty wizualne smoke'u w jednym widoku: po lewej aplikacja w ramkach kilku urządzeń, po prawej makieta
ekranu 1:1. Decyzje „Zgodne” i „Odstępstwo OK” narzędzie zapisuje samo do linii punktu w checkliście. „Zgłoś błąd” zapisuje
zgłoszenie w linii punktu, a „Zakończ przegląd” przekazuje tej sesji wszystkie zgłoszenia naraz: sesja przygotowuje z operatorem
dokument ustaleń, potem naprawia uzgodnione usterki z testem i daje znać narzędziu, że jest poprawka. Operator przechodzi
wszystkie ekrany bez przerw na naprawy w połowie przeglądu.
Serwer narzędzia działa w tle na `http://127.0.0.1:5180` i jest zarazem proxy do aplikacji; klucz API nie jest potrzebny.

## Start

1. Plik smoke'u: argument polecenia, a bez niego checklista bieżącej sesji smoke'u (`docs/operator/<data>-<zadanie>-smoke.md`).
2. Adres aplikacji z sekcji „0. Przygotowanie” smoke'u, ze schematem `http://` (domyślnie `http://localhost:5173`).
   Aplikacja ma działać przed startem.
3. Uruchom:
   ```
   node .claude/scripts/makieta/makieta.mjs start --smoke <plik> --aplikacja <adres>
   ```
   Zgłoszenia idą do sesji na koniec przeglądu (domyślne `--zgloszenia na-koniec`). `--zgloszenia od-razu` — każde
   zgłoszenie od razu, tylko gdy operator o to prosi (np. jeden ekran do poprawki).
   Wynik to JSON. Operatorowi podaj `link` (jedyne miejsce z tokenem narzędzia), liczbę punktów i ekranów, `bezMakiety`,
   `pominiete` (ekrany SPEC bez punktu w checkliście), `ostrzezenia` i `hosty` — usługi, w których operator dopisuje adres
   narzędzia przed logowaniem w ramkach (Redirect URLs Supabase, hosty widgetu Cloudflare Turnstile). `aplikacjaOdpowiada: false` — poproś operatora
   o uruchomienie aplikacji; ramki pokażą stronę „Aplikacja nie odpowiada”, dopóki nie wstanie.
   - Kod 1 z polem `blad`: port zajęty przez inny proces, brak katalogu zadania, nazwa pliku spoza
     `<data>-<zadanie>-smoke.md` albo smoke poza projektem — przekaż operatorowi treść błędu.
   - Kod 2: złe argumenty (komunikat na stderr), np. adres aplikacji spoza localhost.
   - Kod 3: serwer nie wystartował albo wyjątek — przekaż operatorowi `blad` / `wyjatek` ze ścieżką logu serwera.
4. Logowanie: hasłem w dowolnej ramce — jedna sesja obejmuje wszystkie ramki (wspólny origin). Dostawca OAuth: przycisk
   „Otwórz w karcie”, logowanie w karcie, potem „Przeładuj ramki” — kliknięty w ramce dostawca daje „zawartość
   zablokowana”, bo jego strona nie daje się osadzić. OAuth wymaga wpisu `http://127.0.0.1:5180/**` w Redirect URLs
   projektu Supabase dev; bez wpisu działa logowanie hasłem. Captcha Cloudflare Turnstile wymaga `127.0.0.1` w hostach
   widgetu. Po zmianie konta: „Przeładuj ramki”.
5. Zaraz po starcie uruchom `Monitor` z sekcji „Zgłoszenia z narzędzia” (narzędzie odroczone — najpierw ToolSearch
   `select:Monitor`). Powiedz operatorowi: „Zgłoszenia zbieram do końca przeglądu — po ostatnim ekranie kliknij »Zakończ
   przegląd«; gdy w minutę nie odpowiem, napisz: zgłoszenia”. Do zgłoszenia operator dołącza zrzut (Cmd+V albo plik
   w formularzu „Zgłoś błąd”, prostokąt zaznacza fragment) — narzędzie zapisuje go w `visual-diff/zgloszenia/` katalogu
   zadania, nie w `docs/operator/`. „Ramki razem” (domyślnie włączone) przenosi nawigację jednej ramki na pozostałe.

## Zgłoszenia z narzędzia

Zgłoszenia przychodzą przez `Monitor` — każda linia JSON to jedno zdarzenie:

```
Monitor({command: "node .claude/scripts/makieta/makieta.mjs czekaj --limit-min 25",
         description: "zgłoszenia z narzędzia makiet", timeout_ms: 1800000})
```

`--limit-min` wynosi najwyżej 25, bo `Monitor` żyje najwyżej 30 minut. Zdarzenie `limit` = uruchom `Monitor` jeszcze raz
z tą samą komendą. `serwer-zatrzymany` = narzędzie nie działa; zapytaj operatora, czy uruchomić je od nowa (`start`).

Zdarzenie `przeglad-zakonczony` (tryb „na koniec”) ma pola `smoke`, `podsumowanie` (liczba punktów według statusu)
i `zgloszenia` — lista jak w wyniku `makieta.mjs zgloszenia` (`punkt`, `linia`, `zgloszenie`, `zrzut`, `tresc`, `trasa`,
`ekrany[]` ze `spec`, `makieta`, `wymiary`). Obsługa w sekcji „Koniec przeglądu”.

Zdarzenie `zgloszenie` (tryb „od razu”) ma pola `punkt`, `ekran`, `trasa`, `viewport`, `urzadzenie`, `szerokosc`, `opis`,
`spec`, `makieta`, `zrzut`. Obsługa jednego zgłoszenia:

1. Przeczytaj SPEC z pola `spec` (zwykle `ekrany/<ekran>.md`, bez niego cały SPEC.md; `null` — opis wyłącznie z treści
   punktu). PNG makiety z pola `makieta` podajesz tylko ścieżką i nie otwierasz obrazu — jeden zrzut w kontekście to
   ok. 2,5 tys. tokenów w każdej kolejnej turze. Wyjątek: zrzut operatora z pola `zrzut` (`null` = bez zrzutu) to dowód
   usterki — otwórz go narzędziem Read przy obsłudze tego zgłoszenia, jeden naraz, i nie otwieraj go drugi raz. Zrzuty
   z `visual-diff/zgloszenia/` commitujesz z artefaktami zadania (razem ze smoke'iem albo dokumentem ustaleń) — nieśledzony
   plik zatrzymałby `/dev-pr` na kontroli czystości drzewa.
2. Odtwórz usterkę w aplikacji na trasie punktu przy szerokości `szerokosc` (pomiar agent-browserem bez zrzutu: `snapshot`,
   `get box`, `get styles`), napraw ją z testem i commitem, jak mówi ramka „Jak kontynuować” smoke'u. Przy zbudowanym
   serwerze (nie Vite dev) przebuduj aplikację i uruchom serwer od nowa.
3. Daj znać narzędziu:
   ```
   node .claude/scripts/makieta/makieta.mjs poprawione --punkt <punkt> --commit <sha>
   ```
   Linia punktu dostaje adnotację „poprawione w <sha>, do sprawdzenia”, narzędzie czeka do 60 s na odpowiedź aplikacji
   i przeładowuje ramki. Punkt zostaje `[ ]` — ocenia go znów operator. Wynik:
   - kod 1, `konflikt: linia-zmieniona` — linia zmieniła się w międzyczasie, uruchom polecenie jeszcze raz;
   - kod 1, `konflikt: brak-punktu` albo `blad` „brak punktu” — treść punktu się zmieniła, weź nowy `punkt`
     z `makieta.mjs zgloszenia`;
   - kod 1, `konflikt: niejednoznaczny` — ta sama treść stoi w checkliście dwa razy, popraw jedną z linii narzędziem Edit;
   - kod 1, `konflikt: status` — punkt nie ma otwartego zgłoszenia (już poprawiony albo oceniony), nie ponawiaj;
   - kod 0 z `przeladowano: false` — linia zapisana, poproś operatora o „Przeładuj ramki”.

## Koniec przeglądu

Po zdarzeniu `przeglad-zakonczony` (albo po „zgłoszenia” operatora na końcu przeglądu) przygotuj z operatorem dokument
ustaleń, zanim zmienisz kod:

1. Dla każdego zgłoszenia przeczytaj SPEC ekranu i odtwórz stan w aplikacji jak w krokach 1–2 obsługi zgłoszenia, bez
   poprawiania. Zgłoszenie bez usterki w kodzie (aplikacja zgodna z makietą, a operator chce innego układu) to zmiana
   decyzji, nie błąd.
2. Zapisz `docs/operator/<data>-<zadanie>-makiety-ustalenia.md` (data i zadanie z nazwy smoke'u): podsumowanie z pola
   `podsumowanie`, potem tabela — nr, ekran, urządzenie i szerokość, opis operatora, zrzut (ścieżka), co mówi SPEC, przyczyna w kodzie
   (`plik:linia`), propozycja (poprawka / zmiana decyzji z nowym układem / odstępstwo), pusta kolumna „Decyzja”.
3. Pokaż operatorowi tabelę i zbierz decyzję dla każdego wiersza; wpisz je do dokumentu.
4. Poprawki zrób jedna po drugiej, każda z testem i commitem, potem `poprawione` dla jej punktu. Odstępstwo zaznacza operator
   w narzędziu („Odstępstwo OK”). Dokument commitujesz razem ze smoke'iem.
5. Operator sprawdza w narzędziu tylko punkty ze statusem „poprawione, do sprawdzenia”.

Kolejne `przeglad-zakonczony` (operator dokończył punkty bez decyzji albo kliknął „Zakończ przegląd” jeszcze raz) aktualizuje
ten sam dokument ustaleń: dopisujesz nowe zgłoszenia, wiersze już rozstrzygnięte zostają.

Linii punktów wizualnych sesja nie odhacza i nie zmienia ich treści — zmieniają je decyzje w narzędziu i `poprawione`
(identyfikator punktu to skrót treści linii). Pozostałe punkty smoke'u sesja odhacza narzędziem Edit, punkt po punkcie.

## Droga awaryjna

Gdy operator pisze „zgłoszenia” albo zdarzenie nie przyszło (sesja czekała na wiadomość, wygasły `Monitor`):

```
node .claude/scripts/makieta/makieta.mjs zgloszenia --smoke <plik>
```

Wynik to otwarte zgłoszenia z checklisty (status „błąd zgłoszony”): `punkt`, `linia`, `zgloszenie` (adnotacja z urządzeniem,
szerokością i opisem), `zrzut` (ścieżka zrzutu operatora albo `null`), `tresc`, `trasa`, `ekrany[]` z `spec`, `makieta` i `wymiary`. W trybie „na koniec” po przeglądzie
obsłuż je jak w sekcji „Koniec przeglądu” (dokument ustaleń), w trybie „od razu” — każde jak pojedyncze zgłoszenie.
Po `/clear` narzędzie nie działa: `start` od nowa (nowy link), `Monitor`, potem `zgloszenia`.

## Stan i zatrzymanie

`node .claude/scripts/makieta/makieta.mjs stan` mówi, czy narzędzie działa. Przed `/clear` i na koniec smoke'u zatrzymaj je:

```
node .claude/scripts/makieta/makieta.mjs stop
```

Decyzje żyją wyłącznie w checkliście, więc start w nowej sesji wraca tam, gdzie operator skończył.

## Status punktu w checkliście

Narzędzie liczy status z checkboxa i pierwszej adnotacji `*(…)*` zaraz po nim; nowa adnotacja wchodzi przed starsze.

| Linia | Status na stronie |
|---|---|
| `- [x] *(RRRR-MM-DD: zgodne)* …` albo `- [x] …` bez adnotacji | zgodny |
| `- [x] *(RRRR-MM-DD: <notatka> — zatwierdzone)* …` | odstępstwo |
| `- [ ] *(RRRR-MM-DD: błąd zgłoszony — <urządzenie> <szerokość> px: <opis>)* …` | błąd zgłoszony |
| `- [ ] *(RRRR-MM-DD: poprawione w <sha>, do sprawdzenia)* …` | poprawione, do sprawdzenia |
| `- [ ] …` (bez takiej adnotacji) | otwarty |

Format punktu wizualnego i jego kontrolę opisuje `dev-docs-complete`, krok 3 („Punkty wizualne”).
