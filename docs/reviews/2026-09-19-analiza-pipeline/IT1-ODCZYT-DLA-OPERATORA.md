# It. 1 — odczyt telemetrii (dla operatora)

**Wniosek:** telemetria działa. Run smoke skończył się OK i sam zostawił po sobie pełny ślad, bez agenta i bez żadnej Twojej komendy.
Po drodze znalazłem jeden błąd w skanie i od razu go poprawiłem. Znalazłem też trzy wady w raporcie. Po Twojej akceptacji poprawiłem
je bez ponownego skanu.

## Gdzie jesteśmy

It. 1 miała dać pipeline'owi „czarną skrzynkę”: każdy run ma się zapisać sam, z prawdziwym statusem i kosztem każdego agenta. Dziś to
sprawdziłem na prawdziwym runie. Zadanie było tanie: kosztowało 4,8 M jednostek i trwało 19 minut. Szacowałem 5–10 M i 30–45 minut.

## Co działa

Hook zapisał run pół minuty po jego końcu. Każdy z 31 agentów ma swój rekord, a u każdego agenta opus jest efort. Nie ma już agenta
telemetrii ani starych liczników tokenów. Skan całej maszyny znalazł rekord dla każdego z 427 runów i żadnego runu o nieznanym statusie.
Plik smoke'a dla operatora powstał i trafił do commita archiwizacji.

## Błąd, który poprawiłem

**Problem:** żaden z 57 runów autopilota nie miał w telemetrii wyniku walidacji końcowej. Pole było puste, nawet gdy walidacja padła.

**Przyczyna:** autopilot oddaje walidację jako cały obiekt (typecheck, testy, build, wynik). Skan umiał przeczytać tylko pojedynczy napis,
więc wszystko inne wyrzucał.

**Co zrobiłem:** najpierw test na prawdziwym kształcie danych (najpierw się wysypał, zgodnie z oczekiwaniem), potem poprawka w skanie.
Wszystkie testy, typy i lint są zielone. Pełny skan przeliczył historię: 22 runy PASS, 4 FAIL, 31 bez walidacji. Zgadza się to co do sztuki
z plikami runów.

**Co Ci to da:** w It. 2 i dalej zobaczysz, jak często walidacja końcowa łapie to, co przepuściły fazy. Bez tego ta liczba była niewidoczna.

## Trzy wady raportu — poprawione

Raport liczy dobrze, ale w trzech miejscach wprowadza w błąd:

1. **Kontekst startowy agentów wygląda na ścięty o połowę, a nie jest.** Raport wrzuca do jednego worka agentów pipeline'u i agentów naszych
   analiz, którzy mają prawie pustą konfigurację. Prawdziwe liczby pipeline'u we wrześniu to 114–136k. W dzisiejszym smoke'u było już 73–84k,
   bo porządki konta z KROKU 0 zdjęły ze startu ~640 narzędzi. To realny zysk około 40k na agenta, ale jeszcze nie jest to It. 3a.
2. **Uwagi bota pokazują „0 P1/P2” tam, gdzie po prostu nie ma wagi.** Stare runy dev-pr powstały przed słownikiem klas i wag nie zapisywały.
   Raport pokazuje to jako zero, a powinien napisać „bez klasyfikacji”.
3. **Trzy stare wpisy udają skille** (`exit`, `copy`). Nowa wersja skanu już ich nie tworzy, ale stare zostały w pliku.

**Poprawione po Twojej akceptacji, wszystkie trzy.** Każda wada ma test, który najpierw się wysypał, a po poprawce przechodzi. Ponowny
skan nie był potrzebny: raport tylko inaczej filtruje dane, które już leżą w pliku telemetrii. Sprawdziłem to na danych, zanim zacząłem.
Pewność dają dwa niezależne sprawdzenia. Stary test akceptacyjny raportu z It. 1 (porównanie z analizą z września) daje co do liczby ten
sam wynik. Kontekst per klasa w raporcie zgadza się z osobnym skryptem odczytu. Po poprawce raport pokazuje: pipeline we wrześniu to
1 013 M z 1 319 M, reszta to nasze analizy. Kontekst agentów pipeline'u to 114–136k. Wszystkie wrześniowe uwagi bota są „bez klasyfikacji”,
bo powstały przed słownikiem klas. Pierwszą prawdziwą liczbę da pierwszy run dev-pr w It. 2.

Jedno zostaje otwarte. Gdy nowa wersja skanu przestaje tworzyć jakiś rekord, stary zostaje w pliku. Dziś to tylko te trzy wpisy i raport
je pomija. Ogólne rozwiązanie zrobimy, gdy pojawi się drugi taki przypadek.

## Drobiazgi na później (nie blokują)

Zadanie smoke'a zakłada katalog `src/lib`, którego w monorepo nie obejmują testy. Pipeline to wyłapał i naprawił, ale kosztuje to dodatkowy
cykl poprawki. Commit archiwizacji dostaje opis commita funkcji. Szablon trzyma w gicie śmieciowy plik `.DS_Store`.

## Co dalej

Po Twojej akceptacji: (ewentualnie poprawki raportu), commit poprawki skanu i dokumentów, HANDOFF z instrukcją It. 2 (bot, dev-pr i B0),
pamięć projektu. Kopia `~/Documents/Kodowanie/_smoke-it1-oferty-online` zostaje, dopóki nie zgodzisz się na jej usunięcie.
