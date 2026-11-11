# dev-smoke — fragmenty stacku Expo (React Native + Maestro)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Czym sesja smoke'u klika i jak przechodzi punkty wizualne; przebieg
sesji, decyzje i wyjątki dla człowieka są w SKILL.md.

## Narzędzie sesji

- Aplikację uruchamiasz wg sekcji „0. Przygotowanie” smoke'u (Metro, dev-client na symulatorze).
- Symulator: narzędzia symulatora iOS w sesji, gdy są (operator widzi panel obok rozmowy); klikanie i odczyt ekranu przez
  Maestro (skill `mobile-e2e-maestro`), także jednorazowym flow dla pojedynczej pozycji.
- Czego symulator i Maestro nie obsłużą (natywne okna systemu, haptyka, biometria, powiadomienia push, czytnik ekranu),
  oddajesz operatorowi jak wyjątek dla człowieka: krok po kroku, wynik od operatora wpisujesz przy pozycji.
- Logowanie hasłem robi operator na symulatorze; potem Ty klikasz dalej.

## Punkty wizualne

- Punkty wizualne (pozycje obok `visual-diff/<ekran>-figma.png`) ocenia operator ręcznie: zrób zrzut ekranu z symulatora,
  podaj ścieżkę makiety i poproś o decyzję („zgodne”, „odstępstwo OK”, „błąd: …”); decyzję wpisz w linii punktu.
- Błąd z oceny naprawiasz z testem i commitem jak usterki z listy, potem prosisz o ocenę jeszcze raz.
