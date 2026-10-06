---
name: ux-ui-guidelines
description: Wytyczne UX/UI dla React 19 + Tailwind v4. Design system (OKLCH colors), dostępność (WCAG 2.2, ARIA), responsive design (mobile-first, container queries), animacje (Motion, View Transitions, prefers-reduced-motion), UI patterns (navigation, tables, search, onboarding), interface polish (concentric radius, optical alignment, tabular numbers, scale 0.96 on press, font smoothing, image outlines, interruptible animations, shadow-as-border). Używaj przy projektowaniu UI, dostępności, animacjach, mobile UX oraz micro-detalach polish — "feels off", "interface polish", "border radius polish", "stagger animations", "tabular numbers", "scale on press".
paths:
  - "**/*.tsx"
  - "**/*.css"
---

# UX/UI Guidelines

## Cel

Przewodnik projektowania interfejsu: design system, dostępność, responsywność, animacje, wzorce UI i dopracowanie detali. Ten plik to checklisty i zasady stałe; palety, skale, przykłady kodu i szczegóły są w `resources/` (tabela na końcu). Wartości w przykładach są punktem wyjścia — tokeny projektu (`DESIGN.md`, `@theme`) i pomiary z makiety mają pierwszeństwo. Reguły pisania kodu są w `.claude/rules/coding-rules.md`.

## Kiedy Używać Tego Skilla

- Projektowanie nowych komponentów UI
- Implementacja dostępności (WCAG 2.2, ARIA)
- Responsive design i container queries
- Animacje i przejścia
- Formularze i modale
- Mobile UX
- Nawigacja, tabele, wyszukiwanie, onboarding
- Dopracowanie detali interfejsu („coś tu nie gra”)

---

## Checklisty

### Dostępność (WCAG 2.2 AA)

- [ ] Etykieta: każdy element interaktywny ma nazwę dostępną — widoczny `<label htmlFor>` albo `aria-label` przy przycisku z samą ikoną (ikona z `aria-hidden="true"`)
- [ ] Fokus: widoczny (`focus-visible:`) i niezasłonięty przez przyklejony nagłówek, baner ani dialog (2.4.11)
- [ ] Klawiatura: każda akcja dostępna z Tab, Enter i Spacji; Escape zamyka dialog i menu, a fokus wraca do elementu, który je otworzył
- [ ] Kontrast: tekst min 4,5:1, duży tekst i elementy interfejsu (obramowanie pola, ikona) min 3:1
- [ ] Rozmiar celu: min 24×24 px (2.5.8, AA); kontrolki dotykowe 44×44 px (`min-h-11 min-w-11`), a mniejszy widoczny element rozszerzasz pseudo-elementem
- [ ] Ruch: animacja ma wariant `motion-reduce:` albo warunek `prefers-reduced-motion`
- [ ] Ogłaszanie: błąd z `role="alert"`, zmiana statusu w regionie `aria-live="polite"`
- [ ] Struktura: nagłówki bez przeskoków poziomu, `<search>` dla obszaru wyszukiwania, landmarki (`<main>`, `<nav>`)
- [ ] Dialog: `Dialog` z shadcn/ui (Radix) albo natywny `<dialog>` z `showModal()` — oba trzymają fokus w środku i zwracają go po zamknięciu

### Nowy komponent UI

- [ ] Style od mobile, szersze widoki przez breakpointy (`md:`, `lg:`)
- [ ] Container queries (`@container`, `@md:`) dla komponentu, który żyje w kontenerach różnej szerokości
- [ ] Wysokość pełnego ekranu w jednostkach dynamicznych (`min-h-dvh`)
- [ ] Zaokrąglenie zagnieżdżone koncentrycznie: zewnętrzne = wewnętrzne + padding
- [ ] `tabular-nums` na liczbach, które się zmieniają (licznik, timer, cena)
- [ ] `active:scale-[0.96]` na klikalnym przycisku, gdy ruch nie rozprasza
- [ ] Przejście z wymienionymi właściwościami (`transition-colors`, `transition-transform`) zamiast `transition: all`

### Formularz

- [ ] Etykieta powiązana z polem (`htmlFor`)
- [ ] Komunikat błędu z `role="alert"`, podpięty do pola przez `aria-describedby`
- [ ] Walidacja przy polu, nie tylko po wysłaniu
- [ ] Stan wysyłki z `useActionState`, `useTransition` albo mutacji
- [ ] Informacja zwrotna o sukcesie i błędzie (toast Sonner)
- [ ] Fokus na pierwszym polu z błędem po nieudanej wysyłce

---

## Główne zasady

1. **Mobile-first i container queries** — bo większość ruchu jest mobilna, a komponent reagujący na kontener działa w każdym układzie, do którego go włożysz.
2. **WCAG 2.2 AA jako minimum** — w tym fokus niezasłonięty (2.4.11) i rozmiar celu (2.5.8), bo bez nich interfejs nie działa z klawiaturą i czytnikiem ekranu, a dla wielu usług w UE to wymóg European Accessibility Act.
3. **Kolory OKLCH w tokenach `@theme`** — bo OKLCH zachowuje postrzeganą jasność między odcieniami, więc kontrast skali jest przewidywalny.
4. **Jednostki dynamiczne (`dvh`) zamiast `vh`** — bo `100vh` na telefonie chowa dół strony pod paskiem przeglądarki.
5. **Animacja 150–300 ms, tylko `transform` i `opacity`, z wariantem dla `prefers-reduced-motion`** — bo animacja układu przesuwa treść (CLS), a długa albo wymuszona animacja męczy i szkodzi osobom z zaburzeniami przedsionkowymi.
6. **Stan oczekiwania przez `useTransition` albo `useActionState`** — zamiast flagi `useState`, bo React sam zamyka stan po zakończeniu akcji.
7. **View Transitions dla nawigacji, z ścieżką bez API** — bo przejście poprawia ciągłość, a przeglądarka bez `startViewTransition` ma nawigować bez niego.
8. **Popover API i `<search>` zamiast własnych odpowiedników** — bo element natywny ma dostępność, warstwę i zamykanie klawiaturą bez dodatkowego kodu.
9. **Zaokrąglenie koncentryczne, `tabular-nums`, konkretne przejścia, `scale(0.96)` przy naciśnięciu (nie mniej niż `0.95`)** — bo te detale usuwają wrażenie, że „coś jest nie tak”, a mocniejsze skalowanie wygląda na usterkę.

---

## Navigation Guide

| Potrzebujesz... | Przeczytaj |
|-----------------|------------|
| Kolory (paleta OKLCH), typografia, spacing, ikony | [design-system.md](resources/design-system.md) |
| WCAG 2.2, ARIA, dostępność | [accessibility.md](resources/accessibility.md) |
| Mobile-first, breakpointy, container queries, `dvh`, mobile patterns | [responsive-design.md](resources/responsive-design.md) |
| Motion, View Transitions, stagger, `AnimatePresence` | [animations.md](resources/animations.md) |
| Modale, formularze, toasty, stany ładowania, optimistic updates, przycisk z `useTransition` | [component-ux.md](resources/component-ux.md) |
| Tabs, breadcrumbs, tabele, wyszukiwanie, filtry, onboarding | [patterns.md](resources/patterns.md) |
| Concentric radius, optical alignment, shadow-as-border, image outlines, hit area | [surfaces.md](resources/surfaces.md) |
| Interruptible animations, subtelne wyjścia, icon crossfade, scale on press | [animation-polish.md](resources/animation-polish.md) |
| `text-wrap` balance/pretty, font smoothing, tabular nums | [typography-polish.md](resources/typography-polish.md) |
| Właściwości przejść, `will-change` | [performance.md](resources/performance.md) |
| Pryncypia polish i checklista przeglądu | [polish-checklist.md](resources/polish-checklist.md) |

Przewodnik tematu czytasz, zanim zaczniesz projektować ten element, bo każdy niesie wartości i pułapki, których nie widać w samej klasie Tailwind (kontener z nazwą dla zagnieżdżonych container queries, fokus po zamknięciu dialogu, różnica `svh` / `dvh` / `lvh`).

Powiązany skill: **tailwind-react-guidelines** — komponenty React, Tailwind v4, formularze, testy.
