---
date: 2026-10-19
topic: makieta-obok-aplikacji
---

# Narzędzie „makieta obok aplikacji” w smoke'u operatora

Źródło: HANDOFF 6a pkt 91 poz. 7 i pkt 92 (`docs/reviews/2026-09-19-analiza-pipeline/HANDOFF.md`).

## Problem

W smoke'u etapu 4 vibersi było około 25 punktów wizualnych w 3 sesjach. Najwięcej czasu zajmowało samo wypatrywanie różnic
między aplikacją a makietą. Operator otwierał `visual-diff/<ekran>-figma.png`, obok aplikację w DevTools ustawioną na szerokość
makiety, a decyzje dyktował sesji. Do części ekranów tester nie zrobił zrzutu aplikacji (`agent-browser screenshot` > 30 s).
Operator prosił też sesję: „sam zestaw makietę z aplikacją i pokaż mi tylko rozjazdy”. Narzędzie ma pokazać aplikację na kilku
urządzeniach naraz obok makiety, a decyzje i zgłoszenia błędów obsługiwać w tej samej sesji smoke'u, bez przepisywania.

## Wymagania

**Uruchomienie i dane**
- R1. Narzędzie uruchamia sesja smoke'u na polecenie operatora (np. „odpalamy narzędzie” przy sekcji makiet). Działa w tle i daje
  link na localhost, który operator otwiera we własnej przeglądarce. Nie wymaga klucza API, działa na subskrypcji Claude Code.
- R2. Lista ekranów pochodzi z punktów checklisty smoke'u, które wskazują `visual-diff/<ekran>-figma.png`. Makieta to ten PNG,
  a gdy go nie ma, PNG z katalogu SPEC planu (`figma_spec`). Wymiary makiety (W×H) są podane w SPEC i w punkcie checklisty.
  Każdy ekran pokazuje treść i status swojego punktu (otwarty, zgodny, odstępstwo, błąd zgłoszony).
- R3. Ramki startują na trasie z punktu checklisty, jeśli punkt ją podaje (np. `/konto/projekty`), a w przeciwnym razie na `/`.
  W ramkach da się klikać i nawigować, żeby wywołać stany (okno, arkusz, błąd).

**Widok**
- R4. Lewa część to aplikacja w ramkach kilku urządzeń naraz. Prawa część to makieta bieżącego ekranu w skali 1:1
  (z możliwością dopasowania do wysokości), z przyciskami „poprzedni” i „następny” ekran.
- R5. Urządzenia wybiera się z biblioteki z nazwanymi presetami (np. iPhone SE, iPhone 15, Pixel, iPad, laptop 1280,
  desktop 1440) albo podaje własny wymiar. Domyślnie zaznaczone są urządzenia, których szerokość pasuje do szerokości makiety.
  Wybór urządzeń pamięta się między ekranami.
- R6. Wszystkie ramki korzystają z jednej sesji logowania. Operator loguje się raz, a zmiana konta (np. twórca → admin) obejmuje
  wszystkie ramki.

**Decyzje i zgłoszenia**
- R7. Przycisk „Zgodne” odhacza punkt w checkliście smoke'u i dopisuje adnotację w obecnym formacie
  `*(RRRR-MM-DD: zgodne)*`.
- R8. Przycisk „Odstępstwo OK” z obowiązkową notatką odhacza punkt i dopisuje adnotację
  `*(RRRR-MM-DD: <notatka> — zatwierdzone)*`.
- R9. „Zgłoś błąd” zbiera opis, urządzenie i szerokość, na której błąd widać, a następnie:
  (a) trafia do sesji smoke'u w ciągu kilku sekund, a sesja go naprawia (z testem, zgodnie z ramką „Jak kontynuować”);
  (b) zapisuje się w punkcie checklisty jako notatka, punkt zostaje `[ ]`, więc zgłoszenie nie ginie, gdy sesja go nie odebrała;
  (c) po poprawce ramki się przeładowują, a punkt wraca do oceny ze statusem „poprawione, do sprawdzenia”.
- R10. Narzędzie zmienia w checkliście tylko linię punktu, którego decyzja dotyczy. Nie rusza reszty pliku i nie nadpisuje
  równoległych zmian sesji.

**Integracja z pipeline'em**
- R11. Smoke generowany przez `dev-docs-complete` wymienia narzędzie przy sekcji makiet (jak je uruchomić). Punkty wizualne
  podają ekran, trasę i viewport w formacie, który narzędzie umie odczytać.
- R12. Narzędzie jest częścią szablonu (`.claude/`), trafia do projektów przez `/sync-template` i nie wymaga zmian w kodzie
  projektu.

## Kryteria sukcesu

- W następnym smoke'u z makietami (vibersi etap 5) operator przechodzi wszystkie punkty wizualne w narzędziu bez otwierania
  PNG i DevTools osobno.
- Każda decyzja wizualna ląduje w checkliście bez dyktowania jej sesji.
- Zgłoszony błąd zostaje naprawiony i ponownie oceniony w narzędziu bez przełączania się do terminala, poza akceptacją zmian.
- Sesja smoke'u nie wczytuje PNG makiet do kontekstu, żeby oceniać zgodność.

## Granice scope'u

- Brak nakładki makiety na ramkę z suwakiem przezroczystości i brak trybu „różnica”. Operator wybrał porównanie obok siebie.
- Brak algorytmicznej różnicy pikseli (pixelmatch, odiff). Ewentualnie w etapie 2, gdy porównanie obok nie wystarczy.
  Uzasadnienie: fonty i antyaliasing dają fałszywe różnice (z tego samego powodu tester tego nie robi).
- Brak samodzielnego naprawiania przez osobny proces `claude -p`. Naprawia wyłącznie bieżąca sesja smoke'u.
- Brak zmian w testerze E2E i w formacie `visual-diff/`.
- Brak wsparcia dla fizycznych urządzeń. Punkty **[fizyczne urządzenie]** przechodzi się po staremu.

## Kluczowe decyzje

- **Nagłówki bezpieczeństwa: proxy narzędzia zamiast zmian w aplikacji.** Zbudowany serwer vibersi daje
  `X-Frame-Options: DENY` i `frame-ancestors 'none'`, a smoke szedł właśnie na nim (potrzebne `/api`). Narzędzie stawia lokalne
  proxy do aplikacji, które zdejmuje te nagłówki tylko w swoich odpowiedziach, i serwuje stronę narzędzia z tego samego originu.
  Kod bezpieczeństwa projektu zostaje nietknięty, więc nic nie wycieknie na produkcję.
- **Logowanie: raz, w originie proxy.** Konsekwencja proxy: sesja aplikacji z `localhost:5173` nie przechodzi na port proxy,
  dlatego operator loguje się raz w karcie narzędzia. Logowanie OAuth (Facebook, Google) nie działa w ramce, więc odbywa się
  w karcie lub w popupie. Wymaga to, żeby port proxy był na liście dozwolonych przekierowań Supabase dev.
- **Szerokości z biblioteki urządzeń, nie stałe 390/820/1440.** Makiety etapu 4 miały 390 i 1440, ale też okna i komponenty
  o szerokości 358–1104, a 820 nie wystąpiło ani razu.
- **Zapis wprost do checklisty.** Plik checklisty jest jedynym źródłem stanu smoke'u. Narzędzie zmienia w nim tylko linię
  punktu (R10).

## Zależności / Założenia

- Punkty wizualne smoke'u mają spójny format z `visual-diff/<ekran>-figma.png` i `(viewport W×H)`. Tak było w etapie 4,
  a R11 to utrwala.
- PNG makiet są eksportowane w skali @1x (sprawdzone: `wyslano-telefon-figma.png` ma 390×896, tyle samo co ramka).
- Zgłoszenie z przeglądarki da się dostarczyć do działającej sesji Claude Code. Narzędzie uruchomione przez sesję w tle
  wypisuje zgłoszenie, a sesja je obserwuje.

## Otwarte pytania

### Do rozwiązania przed planowaniem
(brak)

### Odroczone do planowania
- [Dotyczy R9][Techniczne][Wymaga researchu] Mechanizm dostarczenia zgłoszenia do sesji: obserwacja wyjścia procesu
  w tle (Monitor) czy plik i powiadomienie. Do sprawdzenia, czy sesja reaguje, gdy czeka na operatora.
- [Dotyczy R9c][Techniczne] Przeładowanie po poprawce: przy Vite dev wystarczy HMR, przy zbudowanym serwerze potrzebny jest
  rebuild i restart. Do ustalenia, kto daje sygnał „przeładuj”.
- [Dotyczy R6][Techniczne] Proxy a logowanie OAuth: przekierowanie wraca na `SITE_URL` (5173), a nie na port proxy. Do
  sprawdzenia, czy wystarczy `redirectTo` = origin proxy i wpis `http://localhost:*` w Supabase dev, czy potrzebne jest
  logowanie hasłem lub magic linkiem.
- [Dotyczy R2][Techniczne] Ekrany SPEC bez punktu w checkliście (np. stan wysyłania bez zrzutu): pokazywać jako „bez punktu”
  czy pomijać.
- [Dotyczy R5][Techniczne] Lista presetów urządzeń (wymiary CSS) i reguła „pasuje do szerokości makiety” dla komponentów
  (np. okno 480 px → desktop 1440 czy telefon).
- [Dotyczy R10][Techniczne] Bezpieczna edycja jednej linii przy równoległych edycjach sesji: zapis atomowy i odrzucenie zapisu,
  gdy linia się zmieniła.

## Następne kroki

→ `/dev-plan`: planowanie techniczne implementacji (zmiana w szablonie, gałąź według konwencji `popr/…` albo `feature/…`).
