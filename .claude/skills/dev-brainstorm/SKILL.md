---
name: dev-brainstorm
description: 'Walidacja i doprecyzowanie pomysłu przed planowaniem. Interaktywny dialog, pressure test, eksploracja podejść, requirements doc. Używaj przy "mam pomysł", "zróbmy brainstorm", "co myślisz o", "pomóż mi przemyśleć", "chcę zbudować", niejasny scope, wiele możliwych rozwiązań.'
argument-hint: "[pomysł na feature lub problem do zbadania]"
---

# Brainstorm — walidacja pomysłu

**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu dokumentów.

Brainstorming odpowiada na pytanie **CO** budować poprzez dialog. Poprzedza `/dev-plan`, który odpowiada na pytanie **JAK** to zbudować.

Trwałym wynikiem tego workflow jest **dokument wymagań** (requirements doc). Dokument musi być na tyle konkretny, żeby planowanie nie musiało wymyślać zachowań produktu, granic scope'u ani kryteriów sukcesu.

Ten skill nie implementuje kodu. Eksploruje, doprecyzowuje i dokumentuje decyzje do późniejszego planowania lub wykonania.

## Główne zasady

1. **Najpierw oceń scope** — dopasuj poziom formalności do rozmiaru i niejednoznaczności pracy.
2. **Bądź partnerem do myślenia** — proponuj alternatywy, kwestionuj założenia, eksploruj "co jeśli" zamiast tylko wyciągać wymagania.
3. **Rozstrzygaj decyzje produktowe tutaj** — zachowania użytkownika, granice scope'u i kryteria sukcesu należą do tego workflow. Szczegóły implementacji należą do planowania.
4. **Nie wkładaj implementacji do requirements doc** — nie umieszczaj bibliotek, schematów, endpointów, layoutów plików ani designu kodu, chyba że brainstorm dotyczy decyzji technicznej/architektonicznej.
5. **Dopasuj artefakt do potrzeb** — prosta praca dostaje kompaktowy doc lub krótkie potwierdzenie. Większa praca dostaje pełniejszy dokument. Nie dodawaj ceremoniału, który nie pomaga planowaniu.
6. **YAGNI na koszt utrzymania, nie na wysiłek kodowania** — preferuj najprostsze podejście dające realną wartość. Unikaj spekulacyjnej złożoności, ale nie odrzucaj taniego polishu, który łatwo utrzymać.
7. **Weryfikuj, zanim stwierdzisz** — nie twierdź, że czegoś brakuje, że coś jest zduplikowane lub że dany wzorzec już istnieje, bez sprawdzenia w kodzie. Niezweryfikowane założenie zgłoś jako pytanie, nie jako fakt.

## Zasady interakcji

1. **Jedno pytanie na raz** — nie łącz kilku niepowiązanych pytań w jednej wiadomości.
2. **Preferuj single-select multiple choice** — użyj single-select przy wyborze jednego kierunku, jednego priorytetu lub następnego kroku.
3. **Multi-select rzadko i świadomie** — używaj tylko dla kompatybilnych zbiorów (cele, ograniczenia, non-goals, kryteria sukcesu). Jeśli priorytetyzacja ma znaczenie, dopytaj który wybrany element jest główny.
4. **Używaj narzędzia pytań platformy** — preferuj `AskUserQuestion` w Claude Code. W przeciwnym razie prezentuj numerowane opcje w chacie i czekaj na odpowiedź.

## Wytyczne do outputu

- **Zwięzłe outputy** — krótkie sekcje, zwięzłe bullet pointy, tylko tyle szczegółów ile potrzeba do następnej decyzji.

## Opis feature'a

<feature_description> #$ARGUMENTS </feature_description>

**Jeśli opis powyżej jest pusty, zapytaj:** "Co chciałbyś zbadać? Opisz feature, problem lub usprawnienie, o którym myślisz."

Nie kontynuuj dopóki nie masz opisu od użytkownika.

## Przebieg

### Faza 0: Wznowienie, ocena i routing

#### 0.1 Wznów istniejącą pracę gdy to sensowne

Jeśli użytkownik odnosi się do istniejącego tematu brainstormu lub dokumentu, lub istnieje niedawny plik `*-requirements.md` w `docs/brainstorms/`:
- Przeczytaj dokument
- Potwierdź z użytkownikiem: "Znalazłem istniejący requirements doc dla [temat]. Kontynuuję od tego, czy zaczynamy od nowa?"
- Przy wznawianiu: streść aktualny stan, kontynuuj od istniejących decyzji i otwartych pytań, aktualizuj istniejący dokument zamiast tworzyć duplikat

#### 0.2 Oceń czy brainstorming jest potrzebny

**Wskaźniki jasnych wymagań:**
- Podane konkretne kryteria akceptacji
- Odwołanie do istniejących wzorców
- Opisane dokładne oczekiwane zachowanie
- Ograniczony, dobrze zdefiniowany scope

**Jeśli wymagania są już jasne:**
Ogranicz interakcję. Potwierdź zrozumienie i przedstaw zwięzłe opcje następnych kroków zamiast wymuszać długi brainstorm. Pomiń fazę 1.1 i 1.2 — przejdź od razu do fazy 1.3 lub fazy 3.

#### 0.3 Oceń scope

Na podstawie opisu feature'a i lekkiego skanu repo sklasyfikuj pracę:
- **Lekka** — mała, dobrze ograniczona, mała niejednoznaczność
- **Standardowa** — typowy feature lub bounded refactor z kilkoma decyzjami do podjęcia
- **Głęboka** — cross-cutting, strategiczna lub bardzo niejednoznaczna

Jeśli scope jest niejasny, zadaj jedno celowane pytanie i kontynuuj.

### Faza 1: Zrozum pomysł

#### 1.1 Skan istniejącego kontekstu

Przeskanuj repo przed merytorycznym brainstormingiem. Dopasuj głębokość do scope'u:

**Lekka** — wyszukaj temat, sprawdź czy coś podobnego już istnieje, idź dalej.

**Standardowa i Głęboka** — trzy przejścia:

*Sprawdzenie ograniczeń* — sprawdź pliki instrukcji projektu (`CLAUDE.md`, coding rules) pod kątem ograniczeń workflow, produktu lub scope'u wpływających na brainstorm. Jeśli nic nie wnoszą, idź dalej.

*Skan tematu* — wyszukaj powiązane terminy. Przeczytaj najbardziej relevantny istniejący artefakt (brainstorm, plan, spec, skill, feature doc). Przejrzyj pobliskie przykłady pokrywające podobne zachowanie.

*Zewnętrzny research (prior art)* — gdy pomysł dotyka obszaru, gdzie istnieje prior art, konkurencja lub zewnętrzne wzorce rozwiązań, URUCHOM agenta `web-research-specialist` (Agent tool, subagent_type: "web-research-specialist") z pytaniem o prior art i wzorce rozwiązań dla tego obszaru. Wpleć wyniki w Product Pressure Test (1.2) i, jeśli materialnie istotne, w dokument wymagań (Faza 3).

Jeśli nic oczywistego nie pojawi się po krótkim skanie, powiedz o tym i kontynuuj. Nie dryfuj w planowanie techniczne — unikaj inspekcji testów, migracji, deploymentu czy niskopoziomowej architektury, chyba że brainstorm dotyczy decyzji technicznej.

#### 1.2 Product Pressure Test

Przed generowaniem podejść, zakwestionuj request żeby wyłapać błędne ujęcie problemu. Dopasuj głębokość do scope'u:

**Lekka:**
- Czy to rozwiązuje prawdziwy problem użytkownika?
- Czy duplikujemy coś, co już to pokrywa?
- Czy istnieje wyraźnie lepsze ujęcie przy niemal zerowym dodatkowym koszcie?

**Standardowa:**
- Czy to właściwy problem, czy proxy dla ważniejszego?
- Jaki wynik dla użytkownika lub biznesu naprawdę się liczy?
- Co się stanie jeśli nic nie zrobimy?
- Czy istnieje pobliskie ujęcie tworzące więcej wartości bez większego kosztu utrzymania? Jeśli tak, jaką złożoność dodaje?
- Biorąc pod uwagę aktualny stan projektu, cel użytkownika i ograniczenia — jaki jest najwyżej dźwigniowy ruch teraz: request tak jak jest, przeformułowanie, jedno sąsiednie rozszerzenie, uproszczenie, czy nie robienie nic?
- Preferuj ruchy kumulujące wartość, redukujące przyszły koszt utrzymania lub czyniące produkt istotnie bardziej użytecznym
- Użyj wyniku do wyostrzenia rozmowy, nie do narzucania kierunku

**Głęboka** — pytania standardowe plus:
- Jaką trwałą zdolność to powinno stworzyć w ciągu 6-12 miesięcy?
- Czy to przesuwa produkt w tym kierunku, czy to tylko lokalny plaster?

**Soczewki luk (named lenses) — dla Standardowej i Głębokiej:** przepuść request przez pięć soczewek, każdą jako osobny, otwarty probe (nie pytanie zamknięte). Każda celuje w inny typ słabości w ujęciu problemu:

- **evidence (dowód)** — jaki konkretny dowód mamy, że ten problem jest realny? Czy to obserwacja, czy założenie?
- **specificity (konkretność)** — czy problem jest dość konkretny, żeby dało się poznać, że został rozwiązany? Ogólnikowe ujęcie = czerwona flaga.
- **counterfactual (kontrfakt)** — co dokładnie się stanie, jeśli nie zrobimy nic? Jeśli odpowiedź brzmi „niewiele" — przemyśl priorytet.
- **attachment (przywiązanie)** — czy jesteśmy przywiązani do konkretnego rozwiązania, zamiast do problemu? Nazwij rozwiązanie, którego bronimy bez dowodu.
- **durability (trwałość)** — czy to tworzy trwałą wartość, czy chwilowy plaster, który wróci jako dług?

Użyj wyniku do wyostrzenia rozmowy, nie do narzucenia werdyktu.

#### 1.3 Dialog

Używaj narzędzia pytań platformy gdy dostępne (patrz Zasady interakcji). W przeciwnym razie prezentuj numerowane opcje i czekaj na odpowiedź.

**Wytyczne:**
- Pytaj **jedno na raz**
- Preferuj multiple choice gdy istnieją naturalne opcje
- Preferuj **single-select** przy wyborze jednego kierunku, priorytetu lub kroku
- **Multi-select** tylko dla kompatybilnych zbiorów; jeśli priorytetyzacja ma znaczenie, dopytaj który jest główny
- Zacznij szeroko (problem, użytkownicy, wartość) potem zawężaj (ograniczenia, wykluczenia, edge cases)
- Doprecyzuj problem frame, zwaliduj założenia, zapytaj o kryteria sukcesu
- Zrób wymagania wystarczająco konkretnymi, żeby planowanie nie musiało wymyślać zachowań
- Surfuj zależności lub prerequisites tylko gdy materialnie wpływają na scope
- Rozstrzygaj decyzje produktowe tutaj; zostaw wybory implementacji technicznych na planowanie
- Przynoś pomysły, alternatywy i wyzwania zamiast tylko przeprowadzać wywiad

**Integration check przed wyjściem z dialogu:** zanim uznasz pomysł za jasny, świadomie **połącz** odpowiedzi użytkownika i sonduj nieoczywiste konsekwencje ich kombinacji (np. „jeśli chcemy X i Y, a domyślnie zakładamy Z, to wynika z tego, że...?"). Wyłap konflikty między decyzjami, których użytkownik mógł nie zauważyć, podejmując je osobno. To często ujawnia ukryte wymaganie albo sprzeczność w scope.

**Warunek wyjścia:** Kontynuuj aż pomysł jest jasny LUB użytkownik explicite chce przejść dalej.

### Faza 2: Eksploruj podejścia

Jeśli pozostaje wiele wiarygodnych kierunków, zaproponuj **2-3 konkretne podejścia** na podstawie researchu i rozmowy. W przeciwnym razie przedstaw rekomendowany kierunek bezpośrednio.

Gdy przydatne, dołącz jedną celowo ambitniejszą alternatywę:
- Zidentyfikuj jakie sąsiednie rozszerzenie lub przeformułowanie najbardziej zwiększyłoby użyteczność, kumulowaną wartość lub trwałość bez nieproporcjonalnego kosztu utrzymania. Przedstaw jako challenger option obok baseline'u, nie jako domyślną opcję. Pomiń gdy praca jest już jawnie over-scoped.

Dla każdego podejścia podaj:
- Krótki opis (2-3 zdania)
- Zalety i wady
- Kluczowe ryzyka lub niewiadome
- Kiedy jest najlepiej dopasowane

Prowadź z rekomendacją i wyjaśnij dlaczego. Preferuj prostsze rozwiązania gdy dodana złożoność tworzy realny koszt utrzymania, ale nie odrzucaj taniego polishu o wysokiej wartości.

Jeśli jedno podejście jest wyraźnie najlepsze a alternatywy nie są sensowne, pomiń menu i przedstaw rekomendację bezpośrednio.

Gdy relevantne, zaznacz czy wybór to:
- Reużycie istniejącego wzorca
- Rozszerzenie istniejącej zdolności
- Budowa czegoś zupełnie nowego

### Faza 3: Zapisz wymagania

Napisz lub zaktualizuj dokument wymagań tylko gdy rozmowa wyprodukowała trwałe decyzje warte zachowania.

Dokument powinien zachowywać się jak lekkie PRD bez ceremoniału PRD. Zawrzyj to czego planowanie potrzebuje do dobrego wykonania, i pomiń sekcje nie wnoszące wartości.

Dokument wymagań służy definicji produktu i kontroli scope'u. **Nie** umieszczaj szczegółów implementacji (biblioteki, schematy, endpointy, layouty plików, struktura kodu) chyba że brainstorm jest inherentnie techniczny i te szczegóły same są przedmiotem decyzji.

**Wymagana treść dla nietrywialnej pracy:**
- Problem frame
- Konkretne wymagania lub zamierzone zachowanie ze stabilnymi ID
- Granice scope'u
- Kryteria sukcesu

**Dołącz gdy materialnie przydatne:**
- Kluczowe decyzje i uzasadnienie
- Zależności lub założenia
- Otwarte pytania
- Rozważone alternatywy
- High-level kierunek techniczny tylko gdy praca jest inherentnie techniczna

**Struktura dokumentu:** Użyj tego szablonu i pomiń sekcje niepasujące do scope'u:

```markdown
---
date: YYYY-MM-DD
topic: <kebab-case-topic>
---

# <Tytuł tematu>

## Problem
[Kogo dotyczy, co się zmienia i dlaczego to ważne]

## Wymagania
- R1. [Konkretne zachowanie lub wymaganie od strony użytkownika]
- R2. [Konkretne zachowanie lub wymaganie od strony użytkownika]

## Kryteria sukcesu
- [Po czym poznamy, że to rozwiązało właściwy problem]

## Granice scope'u
- [Świadomy non-goal lub wykluczenie]

## Kluczowe decyzje
- [Decyzja]: [Uzasadnienie]

## Zależności / Założenia
- [Tylko gdy materialne]

## Otwarte pytania

### Do rozwiązania przed planowaniem
- [Dotyczy R1][Decyzja użytkownika] [Pytanie które musi być odpowiedziane przed planowaniem]

### Odroczone do planowania
- [Dotyczy R2][Techniczne] [Pytanie do odpowiedzenia podczas planowania lub eksploracji codebase]
- [Dotyczy R2][Wymaga researchu] [Pytanie wymagające prawdopodobnie researchu podczas planowania]

## Następne kroki
[Jeśli `Do rozwiązania przed planowaniem` jest pusty: `→ /dev-plan` do planowania technicznego implementacji]
[Jeśli `Do rozwiązania przed planowaniem` nie jest pusty: `→ Wznów /dev-brainstorm` żeby rozwiązać blokujące pytania]
```

Dla brainstormów **Standardowych** i **Głębokich** dokument wymagań jest zazwyczaj uzasadniony.

Dla brainstormów **Lekkich** ogranicz dokument. Pomiń tworzenie dokumentu gdy użytkownik potrzebuje tylko krótkiego potwierdzenia i żadne trwałe decyzje nie wymagają zachowania.

Dla bardzo małych docs z 1-3 prostymi wymaganiami, zwykłe bullet pointy są akceptowalne. Dla docs **Standardowych** i **Głębokich** używaj stabilnych ID jak `R1`, `R2`, `R3` żeby planowanie i review mogły się do nich jednoznacznie odwoływać.

Gdy praca jest prosta, łącz sekcje zamiast je nadmuchiwać. Krótki requirements doc jest lepszy od rozdętego.

Przed finalizacją sprawdź:
- Co planowanie musiałoby jeszcze wymyślić gdyby ten brainstorm się teraz skończył?
- Czy jakieś wymagania zależą od czegoś uznanego za out of scope?
- Czy jakieś nierozwiązane elementy to w rzeczywistości decyzje produktowe, nie pytania planistyczne?
- Czy szczegóły implementacji wkradły się gdy nie powinny?
- Czy istnieje tania zmiana, która uczyniłaby to materialnie bardziej użytecznym?

Jeśli planowanie musiałoby wymyślić zachowania produktu, granice scope'u lub kryteria sukcesu — brainstorm nie jest jeszcze ukończony.

Upewnij się że katalog `docs/brainstorms/` istnieje przed zapisem.

Jeśli dokument zawiera otwarte pytania:
- Używaj `Do rozwiązania przed planowaniem` tylko dla pytań które naprawdę blokują planowanie
- Jeśli `Do rozwiązania przed planowaniem` jest niepusty, kontynuuj pracę nad tymi pytaniami domyślnie
- Jeśli użytkownik explicite chce przejść dalej, przekonwertuj każdy pozostały element w explicite decyzję, założenie lub pytanie `Odroczone do planowania`
- Nie wymuszaj rozstrzygania pytań technicznych podczas brainstormingu tylko żeby usunąć niepewność
- Pytania techniczne lub wymagające walidacji/researchu umieszczaj pod `Odroczone do planowania`
- Używaj tagów jak `[Wymaga researchu]` gdy planner powinien prawdopodobnie zbadać pytanie
- Przenoś odroczone pytania explicite zamiast traktować je jako porażkę w ukończeniu doc

### Faza 4: Handoff

#### 4.1 Przedstaw opcje następnych kroków

Przedstaw następne kroki używając narzędzia pytań platformy gdy dostępne. W przeciwnym razie prezentuj numerowane opcje w chacie i zakończ turę.

Jeśli `Do rozwiązania przed planowaniem` zawiera elementy:
- Zadaj blokujące pytania teraz, jedno na raz, domyślnie
- Jeśli użytkownik explicite chce przejść dalej, najpierw przekonwertuj każdy pozostały element w explicite decyzję, założenie lub pytanie `Odroczone do planowania`
- Jeśli użytkownik chce się zatrzymać, przedstaw handoff jako wstrzymany lub zablokowany
- Nie oferuj `Przejdź do planowania` ani `Przejdź do pracy` gdy `Do rozwiązania przed planowaniem` jest niepusty

**Pytanie gdy nie ma blokujących pytań:** "Brainstorm ukończony. Co chciałbyś zrobić dalej?"

**Pytanie gdy blokujące pytania pozostają i użytkownik chce pauzę:** "Brainstorm wstrzymany. Planowanie jest zablokowane do rozwiązania pozostałych pytań. Co chciałbyś zrobić dalej?"

Przedstaw tylko pasujące opcje:
- **Przejdź do planowania (Rekomendowane)** — uruchom `/dev-plan` do planowania technicznego implementacji
- **Przejdź bezpośrednio do pracy** — oferuj tylko gdy scope jest lekki, kryteria sukcesu jasne, granice scope'u jasne i nie pozostają istotne pytania techniczne
- **Przejrzyj i dopracuj** — oferuj tylko gdy istnieje dokument wymagań do poprawy
- **Zadaj więcej pytań** — kontynuuj doprecyzowywanie scope'u, preferencji lub edge cases
- **Gotowe na teraz** — wróć później

Jeśli gate do bezpośredniej pracy nie jest spełniony, pomiń tę opcję.

#### 4.2 Obsłuż wybraną opcję

**Jeśli użytkownik wybiera "Przejdź do planowania (Rekomendowane)":**

Natychmiast uruchom `/dev-plan` w bieżącej sesji. Przekaż ścieżkę do requirements doc gdy istnieje; w przeciwnym razie przekaż zwięzłe podsumowanie sfinalizowanych decyzji brainstormu. Nie drukuj podsumowania końcowego.

**Jeśli użytkownik wybiera "Przejdź bezpośrednio do pracy":**

Natychmiast uruchom `/dev-docs-execute` w bieżącej sesji używając sfinalizowanego outputu brainstormu jako kontekst. Nie drukuj podsumowania końcowego.

**Jeśli użytkownik wybiera "Zadaj więcej pytań":** Wróć do fazy 1.3 (Dialog) i kontynuuj zadawanie pytań jedno na raz. Sonduj głębiej edge cases, ograniczenia, preferencje lub niezbadane obszary. Kontynuuj aż użytkownik jest zadowolony, potem wróć do fazy 4.

**Jeśli użytkownik wybiera "Przejrzyj i dopracuj":**

Przeczytaj requirements doc krytycznie, zaproponuj poprawki i zastosuj je po akceptacji użytkownika. Po zakończeniu review, wróć do opcji fazy 4.

#### 4.3 Podsumowanie końcowe

Używaj podsumowania końcowego tylko gdy ten przebieg workflow się kończy lub przekazuje dalej, nie gdy wracasz do opcji fazy 4.

Gdy ukończony i gotowy do planowania:

```text
Brainstorm ukończony!

Requirements doc: docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md  # jeśli został stworzony

Kluczowe decyzje:
- [Decyzja 1]
- [Decyzja 2]

Rekomendowany następny krok: `/dev-plan`
```

Jeśli użytkownik pauzuje z niepustym `Do rozwiązania przed planowaniem`:

```text
Brainstorm wstrzymany.

Requirements doc: docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md  # jeśli został stworzony

Planowanie jest zablokowane przez:
- [Blokujące pytanie 1]
- [Blokujące pytanie 2]

Wznów `/dev-brainstorm` gdy będziesz gotowy rozwiązać te pytania.
```
