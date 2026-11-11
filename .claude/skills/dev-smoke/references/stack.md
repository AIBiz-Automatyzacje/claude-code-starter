# dev-smoke — fragmenty stacku web (React + Vite + Tailwind)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Czym sesja smoke'u klika i jak przechodzi punkty wizualne; przebieg
sesji, decyzje i wyjątki dla człowieka są w SKILL.md.

## Narzędzie sesji

- Aplikację uruchamiasz wg sekcji „0. Przygotowanie” smoke'u (dev server, adres z tej sekcji).
- Przeglądarka: wbudowana w sesję (narzędzia przeglądarki aplikacji Claude, gdy są w sesji). Operator widzi ją obok rozmowy
  i może przejąć klikanie.
- Bez przeglądarki wbudowanej: `agent-browser --headed` (okno widoczne dla operatora; skill `agent-browser`). Bez `--headed`
  operator nie widzi, co klikasz, a pozycje z logowaniem hasłem musi wykonać w tym samym oknie.
- Logowanie hasłem robi operator w tym samym oknie przeglądarki; potem Ty klikasz dalej.
- Odczyt strony: tekst i drzewo dostępności przed zrzutem ekranu; zrzut tylko jako dowód usterki.

## Punkty wizualne

- Punkty wizualne (pozycje obok `visual-diff/<ekran>-figma.png`) przechodzi operator narzędziem makiet: zaproponuj `/makieta`
  i czekaj na jego decyzje; usterki z narzędzia naprawiasz z testem i commitem jak usterki z listy.
- Przed `/clear` zatrzymaj narzędzie: `node .claude/scripts/makieta/makieta.mjs stop`.
