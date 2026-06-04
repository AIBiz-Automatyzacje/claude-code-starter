---
name: code-quality
description: "Audyt jakości kodu: architektura (SOLID, circular deps), performance (Big O, N+1, scalability), prostota (YAGNI, LOC reduction), wzorce (patterns, anti-patterns, duplikacja). Stack-agnostic. Używaj przy audycie jakości, po implementacji dużych features, przy refaktoryzacji, ocenie tech debt."
---

# Code Quality Audit

Skill do przeprowadzania glebokiego audytu jakosci kodu. Stack-agnostic -- dziala niezaleznie od technologii. Skupia sie na uniwersalnych zasadach inzynierii oprogramowania: architektura, wydajnosc, prostota, wzorce.

## Kiedy uzywac

- Audyt jakosci po implementacji duzego feature'a
- Przed planowan refaktoryzacja -- identyfikacja co naprawic
- Ocena tech debt i priorytetyzacja splaty
- Weryfikacja decyzji architektonicznych
- Review po polaczeniu kilku PR-ow (analiza calosciowa)
- Wejscie do nowego codebase -- zrozumienie stanu kodu

**Roznica vs code-review:** Code review sprawdza konkretne zmiany (diff). Code quality audit analizuje glebiej -- architekture, skalowanosc, zlozonosc calych modulow. To nie guardrails (od tego jest `coding-rules.md`), to gleboka analiza.

---

## Workflow -- 4 przebiegi analizy

Audyt sklada sie z 4 niezaleznych przebiegow. Kazdy ma inny fokus i moze byc uruchamiany osobno.

### Przebieg 1: SOLID + Architektura

**Cel:** Sprawdzenie czy kod jest dobrze zorganizowany strukturalnie.

**Co analizowac:**
1. **Single Responsibility** -- Czy kazdy modul/klasa/funkcja ma jeden powod do zmiany?
2. **Open/Closed** -- Czy mozna dodac nowa funkcjonalnosc bez modyfikacji istniejacego kodu?
3. **Liskov Substitution** -- Czy podtypy zachowuja sie jak typy bazowe?
4. **Interface Segregation** -- Czy konsumenci uzywaja wszystkich metod interfejsu?
5. **Dependency Inversion** -- Czy moduly zaleza od abstrakcji czy konkretnych implementacji?
6. **Circular dependencies** -- import graph, wzajemne zaleznosci miedzy modulami
7. **Layer boundaries** -- Czy warstwy sa prawidlowo oddzielone? Czy nie ma przeskakiwania warstw?
8. **API contracts** -- Czy interfejsy miedzy modulami sa stabilne i dobrze zdefiniowane?
9. **Deep vs shallow modules** -- czy moduł ma dużą dźwignię za małym interfejsem (deep), czy interfejs jest niemal tak złożony jak implementacja (shallow / pass-through)?

**Jak przeprowadzic:**
- Zbuduj mape zaleznosci (grep importow, przeanalizuj kto importuje kogo)
- Dla kazdego modulu odpowiedz: "jaki jest jeden powod do zmiany tego modulu?"
- Sprawdz czy sa cykliczne zaleznosci (A importuje B, B importuje A)
- Zweryfikuj ze warstwy nie sa naruszane (UI nie importuje data access, serwis nie zalezy od UI)
- **Deletion test** dla modułów podejrzanych o płytkość: wyobraź sobie usunięcie modułu. Jeśli złożoność znika — był pass-through (kandydat do konsolidacji). Jeśli złożoność pojawia się rozproszona u N callerów — zarabiał na siebie (zostaw)

**Szczegolowa dokumentacja:** [resources/architecture-analysis.md](resources/architecture-analysis.md)

---

### Przebieg 2: Performance

**Cel:** Identyfikacja problemow wydajnosciowych i ocena skalowalnosci.

**Co analizowac:**
1. **Big O** -- Zlozonosc obliczeniowa kluczowych operacji
2. **N+1** -- Zapytania/operacje w petli (fetch/query w loop, map z async)
3. **Scalability projection** -- Co sie stanie przy 10x, 100x, 1000x danych?
4. **Caching** -- Czy dane ktore mozna cachowac sa cachowane? Czy cache jest prawidlowo invalidowany?
5. **Memory** -- Czy sa wycieki pamieci, niepotrzebne kopie duzych struktur?

**Jak przeprowadzic:**
- Dla kazdej kluczowej operacji okresl zlozonosc Big O
- Szukaj petli z operacjami I/O wewnatrz (fetch, query, file read)
- Dla kazdej struktury danych zapytaj: "co jesli bedzie 1000x wieksza?"
- Sprawdz czy memoizacja/cache jest uzywana tam gdzie ma sens

**Szczegolowa dokumentacja:** [resources/performance-analysis.md](resources/performance-analysis.md)

---

### Przebieg 3: Simplicity (YAGNI)

**Cel:** Identyfikacja zbednej zlozonosci i mozliwosci uproszczenia.

**Co analizowac:**
1. **YAGNI** -- Czy kazdy element kodu jest explicite wymagany TERAZ?
2. **Abstraction challenge** -- Czy kazda abstrakcja ma uzasadnienie (2+ uzycia)? Reguła szwu: **jeden adapter = szew hipotetyczny (przedwczesna abstrakcja), dwa adaptery = szew realny**. Pojedynczy adapter za interfejsem to sygnał przedwczesnej abstrakcji
3. **Redundancy** -- Zduplikowana logika, powtorzony error handling, dead code
4. **Complexity** -- Deep nesting, dlugie funkcje, dlugie pliki
5. **LOC metrics** -- Ile linii logiki mozna usunac bez utraty funkcjonalnosci?

**Jak przeprowadzic:**
- Dla kazdej abstrakcji (interfejs, klasa bazowa, factory, wrapper) zapytaj: "ile implementacji/konsumentow?"
- Szukaj dead code: nieuzywane importy, zmienne, funkcje, eksporty
- Szukaj duplikatow: ta sama walidacja w 3 miejscach, powtorzony error handling
- Mierz: ile linii logiki mozna usunac?

**Szczegolowa dokumentacja:** [resources/simplicity-audit.md](resources/simplicity-audit.md)

---

### Przebieg 4: Pattern Consistency

**Cel:** Sprawdzenie spojnosci wzorcow, nazewnictwa i konwencji.

**Co analizowac:**
1. **Design patterns** -- Czy wzorce sa uzywane poprawnie i spojnie?
2. **Anti-patterns** -- God Object, Feature Envy, Shotgun Surgery, Inappropriate Intimacy
3. **Naming** -- Czy nazewnictwo jest spojne w calym codebase?
4. **Duplikacja** -- Nie duplikacja kodu (to przebieg 3), ale duplikacja koncepcji i odpowiedzialnosci
5. **Konwencje** -- Czy caly codebase stosuje te same konwencje (error handling, logging, walidacja)?

**Jak przeprowadzic:**
- Porownaj podobne moduly -- czy stosuja te same wzorce?
- Sprawdz nazewnictwo: czy booleany maja prefix `is/has/should`? Czy handlery maja `handle`?
- Szukaj anti-patternow z katalogu (patrz architecture-analysis.md)
- Sprawdz czy error handling jest ustandaryzowany w calym projekcie

---

## Klasyfikacja problemow

Uzyj tego samego systemu co code-review, aby raporty byly spojne:

```
[blocking] KRYTYCZNE -- wymaga natychmiastowej naprawy
  - Circular dependencies blokujace rozwoj
  - Algorytm O(n^3) na danych produkcyjnych
  - Brak walidacji na granicy API
  - Wyciek pamieci w petli glownej

[important] POWAZNE -- wymaga naprawy
  - Naruszenie SRP (modul z 5+ odpowiedzialnosciami)
  - N+1 w gorących sciezkach
  - Zbedna abstrakcja komplikujaca kod
  - Niespojne wzorce miedzy modulami

[nit] DROBNE -- zalecane
  - Niespojne nazewnictwo
  - Brak early return (deep nesting)
  - Magic numbers bez named constants
  - Zbedne komentarze

[suggestion] SUGESTIE -- opcjonalne
  - Alternatywna architektura
  - Propozycja uproszczenia
  - Potencjalna optymalizacja (nie krytyczna)
```

---

## Format raportu

```markdown
## Code Quality Audit: [nazwa modulu/projektu]

### Podsumowanie
[1-3 zdania: ogolna ocena, glowne problemy, rekomendacja]

### Statystyki
- Modulow/plikow przeanalizowanych: X
- [blocking]: X
- [important]: X
- [nit]: X
- [suggestion]: X
- LOC przeanalizowanych: ~X
- LOC do potencjalnego usuniecia: ~X

---

### Przebieg 1: SOLID + Architektura
[wyniki analizy, problemy z klasyfikacja]

### Przebieg 2: Performance
[wyniki analizy, problemy z klasyfikacja]

### Przebieg 3: Simplicity (YAGNI)
[wyniki analizy, problemy z klasyfikacja]

### Przebieg 4: Pattern Consistency
[wyniki analizy, problemy z klasyfikacja]

---

### Complexity Score
- Low (< 10 issues) / Medium (10-25 issues) / High (> 25 issues)

### Top 5 priorytetow do naprawy
Przy każdym priorytecie dodaj **badge siły rekomendacji** (ortogonalny do severity — mówi o pewności, nie o wadze): `Strong` / `Worth exploring` / `Speculative`.
1. [najwazniejszy problem + uzasadnienie] — `Strong`
2. ...

### Co zrobiono dobrze
- [pozytywne aspekty]

### Rekomendacja
- [ ] Kod w dobrym stanie -- brak pilnych zmian
- [ ] Wymaga punktowych poprawek (tech debt niski)
- [ ] Wymaga zaplanowanej refaktoryzacji (tech debt sredni)
- [ ] Wymaga znaczacej przebudowy (tech debt wysoki)
```

---

## Zasady

1. **Stack-agnostic** -- ten skill nie zaklada zadnej technologii. Zasady sa uniwersalne
2. **Gleboka analiza, nie guardrails** -- `coding-rules.md` definiuje zasady codziennej pracy. Ten skill robi gleboka analize architektonalna
3. **Fakty, nie opinie** -- kazdy finding musi byc uzasadniony (Big O, liczba zaleznosci, LOC)
4. **Priorytetyzacja** -- nie wszystko trzeba naprawic naraz. Raport musi zawierac "Top 5 priorytetow"
5. **Doceniaj** -- zauważaj dobre rozwiazania, nie tylko problemy
6. **Kontekst** -- uwzgledniaj faze projektu (MVP vs mature), deadline, rozmiar zespolu
7. **Nie duplikuj coding-rules.md** -- te reguly sa znane. Skup sie na rzeczach ktorych coding-rules nie pokrywa

---

## Dokumentacja referencyjna

| Potrzebujesz... | Przeczytaj |
|-----------------|------------|
| SOLID, circular deps, layer boundaries, anti-patterns | [architecture-analysis.md](resources/architecture-analysis.md) |
| Big O, N+1, scalability, caching, benchmarks | [performance-analysis.md](resources/performance-analysis.md) |
| YAGNI, abstrakcje, redundancja, LOC metrics | [simplicity-audit.md](resources/simplicity-audit.md) |
