---
name: makieta
description: "Narzędzie „makieta obok aplikacji” w smoke'u operatora: aplikacja w ramkach kilku urządzeń obok makiety bieżącego ekranu, decyzje operatora zapisywane do linii checklisty, zgłoszenia błędów dostarczane do sesji smoke'u. Używaj, gdy operator mówi „odpalamy narzędzie makiet”, „makieta obok aplikacji”, „przejdźmy punkty wizualne”, wpisuje /makieta albo smoke ma punkty z `visual-diff/<ekran>-figma.png`."
argument-hint: "[plik smoke'u] | stop | stan"
---

# `/makieta` — punkty wizualne smoke'u obok makiet

Operator przechodzi punkty wizualne smoke'u w jednym widoku: po lewej aplikacja w ramkach kilku urządzeń, po prawej makieta
ekranu 1:1. Decyzje „Zgodne” i „Odstępstwo OK” narzędzie zapisuje samo do linii punktu w checkliście. „Zgłoś błąd” zapisuje
zgłoszenie w linii punktu i przekazuje je tej sesji — sesja naprawia usterkę z testem i daje znać narzędziu, że jest poprawka.
Serwer narzędzia działa w tle na `http://127.0.0.1:5180` i jest zarazem proxy do aplikacji; klucz API nie jest potrzebny.

## Start

1. Plik smoke'u: argument polecenia, a bez niego checklista bieżącej sesji smoke'u (`docs/operator/<data>-<zadanie>-smoke.md`).
2. Adres aplikacji: z sekcji „0. Przygotowanie” smoke'u (domyślnie `http://localhost:5173`). Aplikacja ma działać przed startem.
3. Uruchom:
   ```
   node .claude/scripts/makieta/makieta.mjs start --smoke <plik> --aplikacja <adres>
   ```
   Wynik to JSON. Operatorowi podaj `link` (jedyne miejsce z tokenem narzędzia), liczbę punktów i ekranów, `bezMakiety`,
   `pominiete` (ekrany SPEC bez punktu w checkliście) i `aplikacjaOdpowiada`. Kod 1 z polem `blad` (port zajęty przez inny
   proces, brak katalogu zadania) — przekaż operatorowi treść błędu; kod 2 — złe argumenty (adres aplikacji spoza localhost).
4. Logowanie: hasłem w dowolnej ramce — jedna sesja obejmuje wszystkie ramki (wspólny origin). Dostawca OAuth: przycisk
   „Otwórz w karcie”, logowanie w karcie, potem „Przeładuj ramki”. OAuth wymaga wpisu `http://127.0.0.1:5180/**`
   w Redirect URLs projektu Supabase dev; bez wpisu działa logowanie hasłem. Po zmianie konta: „Przeładuj ramki”.

## Zgłoszenia z narzędzia

Zgłoszenia przychodzą przez `Monitor` — każda linia JSON to jedno zdarzenie:

```
Monitor({command: "node .claude/scripts/makieta/makieta.mjs czekaj --limit-min 25",
         description: "zgłoszenia z narzędzia makiet", timeout_ms: 1800000})
```

`--limit-min` wynosi najwyżej 25, bo `Monitor` żyje najwyżej 30 minut. Zdarzenie `limit` = uruchom `Monitor` jeszcze raz
z tą samą komendą. `serwer-zatrzymany` = narzędzie nie działa; zapytaj operatora, czy uruchomić je od nowa (`start`).

Zdarzenie `zgloszenie` ma pola `punkt`, `ekran`, `trasa`, `viewport`, `urzadzenie`, `szerokosc`, `opis`, `spec`, `makieta`.
Obsługa jednego zgłoszenia:

1. Przeczytaj SPEC ekranu z pola `spec` (`ekrany/<ekran>.md`). PNG makiety z pola `makieta` podajesz tylko ścieżką i nie
   otwierasz obrazu — jeden zrzut w kontekście to ok. 2,5 tys. tokenów w każdej kolejnej turze.
2. Odtwórz usterkę w aplikacji na trasie punktu przy szerokości `szerokosc` (pomiar bez zrzutu: `snapshot`, `get box`,
   `get styles`), napraw ją z testem i commitem, jak mówi ramka „Jak kontynuować” smoke'u. Przy zbudowanym serwerze
   (nie Vite dev) przebuduj aplikację i uruchom serwer od nowa.
3. Daj znać narzędziu:
   ```
   node .claude/scripts/makieta/makieta.mjs poprawione --punkt <punkt> --commit <sha>
   ```
   Linia punktu dostaje adnotację „poprawione w <sha>, do sprawdzenia”, narzędzie czeka do 60 s na odpowiedź aplikacji
   i przeładowuje ramki. Punkt zostaje `[ ]` — ocenia go znów operator. Kod 1 z `konflikt` = sesja albo operator zmienili
   linię w międzyczasie: przeczytaj ją i uruchom polecenie jeszcze raz.

Linię punktu zmieniają decyzje w narzędziu. Sesja zmienia plik smoke'u narzędziem Edit (odmawia zapisu, gdy plik zmienił
się od odczytu), punkt po punkcie, bez przepisywania całego pliku.

## Droga awaryjna

Gdy operator pisze „zgłoszenia” albo zdarzenie nie przyszło (sesja czekała na wiadomość, `/clear`, wygasły `Monitor`):

```
node .claude/scripts/makieta/makieta.mjs zgloszenia
```

Wynik to otwarte zgłoszenia z checklisty (status „błąd zgłoszony”) z ekranami, SPEC i PNG — obsłuż je jak wyżej.

## Stan i zatrzymanie

`node .claude/scripts/makieta/makieta.mjs stan` mówi, czy narzędzie działa. Przed `/clear` i na koniec smoke'u zatrzymaj je:

```
node .claude/scripts/makieta/makieta.mjs stop
```

Decyzje żyją wyłącznie w checkliście, więc start w nowej sesji wraca tam, gdzie operator skończył (z nowym linkiem).

## Status punktu w checkliście

Narzędzie liczy status z checkboxa i pierwszej adnotacji `*(…)*` zaraz po nim; nowa adnotacja wchodzi przed starsze.

| Linia | Status na stronie |
|---|---|
| `- [x] *(RRRR-MM-DD: zgodne)* …` | zgodny |
| `- [x] *(RRRR-MM-DD: <notatka> — zatwierdzone)* …` | odstępstwo |
| `- [ ] *(RRRR-MM-DD: błąd zgłoszony — <urządzenie> <szerokość> px: <opis>)* …` | błąd zgłoszony |
| `- [ ] *(RRRR-MM-DD: poprawione w <sha>, do sprawdzenia)* …` | poprawione, do sprawdzenia |
| `- [ ] …` (bez takiej adnotacji) | otwarty |

Format punktu wizualnego, który narzędzie czyta: ``- [ ] <Urządzenie>[, <stan>]: `<trasa>` obok `visual-diff/<ekran>-figma.png` (viewport <W>×<H>) → <oczekiwany wynik>``. Kontrola formatu:
`node .claude/scripts/makieta/makieta.mjs sprawdz --smoke <plik>`.
