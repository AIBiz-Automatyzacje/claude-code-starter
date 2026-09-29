# Iteracja 1 — telemetria: plan w prostych słowach

Wersja techniczna: `IT1-PLAN.md`. Ten plik mówi, co zrobimy, po co i o czym decydujesz.

## Stan na 30 września: wdrożone, czeka na sprawdzenie jednym runem

Wszystkie dziesięć kroków jest zrobione i zapisane w gicie. Telemetria zbiera się już sama po każdej odpowiedzi Claude'a, w dziesiątą część
sekundy, bez żadnego agenta. Zanim cokolwiek uznałem za gotowe, każdy kawałek przeliczył prawdziwą historię i musiał dać te same liczby co
analiza — i dał: ten sam koszt co do dziesiątej części procenta, te same statusy runów, te same mediany skilli, ten sam kontekst startowy
agentów, ta sama miara jakości z pull requestów oferty-online. Cała historia komputera jest już zapisana, zanim stare transkrypty wygasną.
Listę klas błędów sprawdził niezależny agent; znalazł kilkanaście rzeczy do poprawy i wszystkie są wprowadzone. Po drodze wyszła jedna pomyłka
w moim planie: jako wzór kontekstu startowego wpisałem cele na przyszłość zamiast stanu dzisiejszego — sprawdzian liczy już z właściwym wzorem.
Został ostatni krok: jeden mały run testowy w nowej sesji, żeby zobaczyć, że hook zapisuje nowy run sam. Instrukcja jest w HANDOFF.

## Najważniejsze na początek

Plan jest gotowy: dziesięć małych kroków, każdy osobnym commitem, w każdym najpierw test, potem kod. Po drodze wyszły dwie dobre wiadomości,
które upraszczają robotę. Pierwsza: Claude Code już zapisuje efort każdego agenta w jego transkrypcie, więc nie musimy przerabiać nazw agentów
w workflowach, żeby go poznać. Druga: wszystkie stare dane, które mieliśmy „importować” z plików CSV analizy, nadal leżą na dysku w oryginale —
bo w kroku 0 wydłużyłeś przechowywanie historii do 120 dni. Zamiast więc przepisywać CSV, nowy skrypt policzy wszystko od zera ze źródeł,
a stare liczby z analizy posłużą jako sprawdzian, czy liczy dobrze.

Czekam na Twoją decyzję w dziewięciu punktach (na końcu). Przy każdym jest rekomendacja — jeśli się zgadzasz, wystarczy „akceptuję”.

## Problem

Dziś o każdym runie autopilota dowiadujemy się od agenta haiku, który na końcu dopisuje jedną linię do pliku. Ten agent dwa razy skasował
cały plik. Do tego jedyna liczba kosztu, jaką zapisuje, to tokeny wyjściowe — około jednej dziesiątej prawdziwego kosztu. Nie wiemy, ile
kosztował konkretny agent, jaki miał efort, z jakim kontekstem wystartował ani jakie uwagi bot zostawił po naszym review. Bez tych danych
żadna z następnych iteracji nie ma czym zmierzyć, czy coś poprawiła.

## Przyczyna

Skrypt workflowu nie ma dostępu do plików, więc orkiestrator musiał prosić agenta o zapis. Tymczasem Claude Code sam zostawia po każdym runie
komplet danych: plik ze statusem i wynikiem runu, dziennik agentów i pełny transkrypt każdego z nich, z kosztami. Wystarczy je przeczytać
zwykłym skryptem po zakończeniu runu — bez żadnego agenta.

## Co robimy

Najpierw piszemy skrypt, który czyta te pliki i dla każdego runu tworzy trzy rodzaje wpisów: o całym runie (status, powód zatrzymania, koszt,
która wersja szablonu się wykonała), o każdej fazie (uwagi reviewerów per oś, co zmienił fix — które pliki dodał, a które tylko poprawił)
i o każdym agencie (koszt w pełnym cenniku, efort, kontekst startowy, liczba narzędzi, ile miał CLAUDE.md). Czwarty rodzaj opisuje skille
uruchamiane w Twojej sesji, na przykład dev-plan, żeby było widać ich koszt razem z agentami researchu.

Skrypt uruchamia się sam: dopinamy go do hooka Stop, który już dziś odpala się po każdej odpowiedzi Claude'a. Działa w ciszy, nie dokłada
tokenów i nigdy nie blokuje sesji — jeśli coś pójdzie nie tak, zapisuje błąd do osobnego logu. Drugi skrypt robi raport miesięczny: koszt,
udziały etapów, kontekst startowy agentów, efort, uwagi bota i anomalie.

Potem sprzątamy: agent telemetrii znika z autopilota razem z mylącymi licznikami tokenów. Etap zbierania uwag w dev-pr dostaje trzy nowe
pola — klasę błędu, oś (security, correctness, spec…) i wagę — oraz liczbę plików pull requesta. Klasy pochodzą z jednej zamkniętej listy,
bo dziś ta sama wada bywa nazwana na trzy sposoby i nie da się tego porównywać. Tę listę ułożę skryptem z 574 uwag bota, a zanim
trafi do kodu, sprawdzi ją niezależny agent. Na koniec sync-template zaczyna zapisywać odcisk każdego pliku, żeby było wiadomo, czy run wykonał
dokładnie wersję z szablonu — dziś 33 z 55 runów autopilota (głównie w oferty-online) wykonały skrypt, którego w historii szablonu nie było.

Jednorazowo dopiszemy dwie rzeczy, których nie da się odtworzyć z plików: klasyfikację 574 uwag bota z 19 pull requestów oferty-online
i 40 starych wpisów telemetrii. Oferty-online zostaje tłem i materiałem do nauki, tak jak ustaliliśmy.

## Jak sprawdzimy, że działa

Każdy krok ma test na małych, sztucznych danych. Ważniejszy jest drugi sprawdzian: skrypt przeliczy prawdziwą historię i musi wyjść ta sama
liczba, którą policzyliśmy w analizie — 1 293 mln jednostek kosztu dla tych samych 2 941 agentów, te same udziały etapów, te same mediany
dev-plan, dev-docs i dev-prep. Jeśli się rozjedzie, poprawiamy skrypt, a nie próg.

Na koniec, w nowej sesji, puszczamy mały run testowy autopilota (smoke) w katalogu roboczym poza szablonem. Zaliczony, gdy bez żadnej komendy
z Twojej strony w pliku telemetrii pojawi się rekord z prawdziwym statusem, rekordy każdej fazy i każdego agenta, a w runie nie będzie ani
jednego agenta telemetrii. Do tego pełny skan całego komputera: każdy z ponad 400 runów ma rekord i żaden nie ma statusu „nieznany”.

## Jak to cofnąć

Każdy krok to osobny commit, więc cofnięcie to jego revert. Plik z danymi jest nowy i tylko dopisywany — stary plik telemetrii zostaje
nietknięty. Hook to jeden wpis w ustawieniach. Nic nie kasuję bez Twojego potwierdzenia ścieżki.

## Co Ci to da

Od następnego runu każda liczba, o którą pytałeś w analizie — koszt agenta, efort, kontekst, uwagi bota po naszym review — będzie zapisana
sama, bez agenta i bez tokenów. Iteracja 2 (bot i pomiar wyjściowy B0 na nowym projekcie) zbierze B0 już z pełnymi danymi, a każda kolejna
iteracja będzie miała czym pokazać, czy pomogła.

## Twoje decyzje

**Stan 2026-09-29: wszystkie decyzje podjęte, plan zamknięty.** Punkty 1, 4, 5, 6 i 8 przyjąłeś zgodnie z rekomendacją. Agent haiku, który dziś
zapisuje telemetrię, znika; inni agenci haiku w pipeline'ie (sprzątanie duplikatów uwag, zapis stanu) zostają do iteracji 3.

0. **Narzędzia jakości — ZDECYDOWANE.** Dodajemy do szablonu `package.json`, sprawdzanie typów TypeScriptem i ESLint. Zanim ruszy telemetria,
   osobny krok 0 przepuszcza przez nie istniejący kod i naprawia to, co znajdą. Jeśli poprawek wyjdzie dużo albo któraś zmieniałaby zachowanie
   pipeline'u, zatrzymam się i pokażę Ci listę.

1. **Efort.** Rekomenduję czytać go z transkryptu agenta, gdzie już jest, zamiast dopisywać do nazw agentów w workflowach.
2. **Stare dane agentów i skilli — ZDECYDOWANE: pełny skan.** Rekomendowałem policzyć je od nowa ze źródeł, a pliki CSV z analizy użyć jako sprawdzianu. Uwaga: to trzeba
   zrobić przed grudniem, bo najstarsze transkrypty z 5 sierpnia znikną około 3 grudnia.
3. **Liczniki tokenów w autopilocie — ZDECYDOWANE: usuwamy wszystkie trzy.** Rekomendowałem usunąć wszystkie, nie tylko sumę runu — pokazują jedną dziesiątą kosztu i mylą; prawdziwy
   koszt faz i etapów da skrypt.
4. **Plik danych.** Rekomenduję jeden wspólny plik dla całego komputera, obok starego pliku telemetrii.
5. **Skan w doctor.** Doctor jeszcze nie istnieje (powstaje w iteracji 3c). Rekomenduję dopiąć skan wtedy; do tego czasu wystarczy hook i skan
   na starcie raportu.
6. **Run przerwany razem z sesją.** Rekomenduję oznaczać go jako zabity, gdy przez 3 godziny nic się w nim nie dzieje i żadna sesja go nie
   prowadzi. Najdłuższy agent w historii pracował 1 godzinę 40 minut, więc to bezpieczny margines.
7. **Lista klas błędów — ZDECYDOWANE: 25–35 klas plus „inna”, bez Twojego czytania.** Zamiast Ciebie listę sprawdzi niezależny agent:
   czy klasy się nie nakładają, czy żadna nie jest workiem na wszystko i czy nazwy są zrozumiałe. Jego poprawki wprowadzę, a Ty dostaniesz
   jedno zdanie o wyniku.
8. **Odciski plików szablonu.** Rekomenduję osobny plik, żeby nie ruszać dzisiejszego manifestu, na którym opiera się usuwanie starych plików.
9. **Run sprawdzający — ZDECYDOWANE: smoke teraz.** Rekomendowałem mały run testowy teraz, zamiast czekać na pierwszy run nowego projektu — błąd skryptu wyjdzie od razu,
   a nie na danych B0.
