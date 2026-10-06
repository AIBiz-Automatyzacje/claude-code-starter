# Polish Checklist

Pryncypia, częste błędy i checklista review do dopracowywania interfejsu — synteza zasad z pozostałych plików polish.

---

## 16 pryncypiów polish

### 1. Concentric Border Radius

Outer radius = inner radius + padding. Niedopasowane radii w zagnieżdżonych elementach to najczęstsza rzecz, która sprawia, że interfejs wygląda "off". → [surfaces.md](surfaces.md)

### 2. Optical Over Geometric Alignment

Gdy geometryczne wycentrowanie wygląda źle, wyrównuj optycznie. Przyciski z ikonami, trójkąty Play i asymetryczne ikony wszystkie wymagają ręcznej korekty. → [surfaces.md](surfaces.md)

### 3. Shadows Over Borders

Warstwuj wiele transparentnych `box-shadow` dla naturalnej głębi. Cienie adaptują się do każdego tła; solidne bordery nie. → [surfaces.md](surfaces.md)

### 4. Interruptible Animations

Używaj CSS transitions dla zmian stanu interaktywnego — można je przerwać w trakcie. Rezerwuj keyframes dla stage'owanych sekwencji uruchamianych raz. → [animation-polish.md](animation-polish.md)

### 5. Split and Stagger Enter Animations

Nie animuj pojedynczego kontenera. Podziel zawartość na semantyczne kawałki i stagger każdego z ~100ms opóźnieniem. → [animation-polish.md](animation-polish.md)

### 6. Subtle Exit Animations

Używaj małego stałego `translateY` zamiast pełnej wysokości. Wyjścia powinny być subtelniejsze niż wejścia. → [animation-polish.md](animation-polish.md)

### 7. Contextual Icon Animations

Animuj ikony z `opacity`, `scale` i `blur` zamiast przełączać visibility — przełączenie ikony to zmiana stanu, więc rozmycie (`filter`) jest tu dopuszczone; wejścia i wyjścia sekcji zostają przy `transform` i `opacity` ([animations.md](animations.md), sekcja „Które właściwości animujesz”). Dokładne wartości: scale od `0.25` do `1`, opacity od `0` do `1`, blur od `4px` do `0px`. Jeśli projekt ma `motion` lub `framer-motion` w `package.json`, użyj `transition: { type: "spring", duration: 0.3, bounce: 0 }` — bounce zawsze `0`. Bez biblioteki motion — keep both icons in the DOM (one absolute-positioned) i cross-fade z CSS transitions używając `cubic-bezier(0.2, 0, 0, 1)` (w Tailwind klasa `ease-[cubic-bezier(0.2,0,0,1)]`). → [animation-polish.md](animation-polish.md)

### 8. Font Smoothing

Zastosuj `-webkit-font-smoothing: antialiased` do root layout na macOS dla ostrzejszego tekstu. → [typography-polish.md](typography-polish.md)

### 9. Tabular Numbers

Używaj `font-variant-numeric: tabular-nums` dla każdej dynamicznie aktualizowanej liczby, żeby zapobiec layout shift. → [typography-polish.md](typography-polish.md)

### 10. Text Wrapping

Używaj `text-wrap: balance` na nagłówkach. Używaj `text-wrap: pretty` dla body text, żeby uniknąć orphans. → [typography-polish.md](typography-polish.md)

### 11. Image Outlines

Dodawaj subtelny `1px` outline z niską przezroczystością do obrazów dla spójnej głębi. Kolor bierzesz z tokenu `--outline-image` (klasa `outline-outline-image`): w `:root` czysta czerń 10% (`rgb(0 0 0 / 0.1)`), w `.dark` czysta biel 10% (`rgb(255 255 255 / 0.1)`) — nie near-black jak slate, zinc czy zabarwiony neutral. Zabarwiony outline podchwytuje kolor powierzchni i czyta się jak brud na krawędzi obrazu. Wartość koloru stoi tylko w definicji tokenu, nie w komponencie (zasada „Kolory tylko przez tokeny” w [design-system.md](design-system.md)). → [surfaces.md](surfaces.md)

### 12. Scale on Press

Subtelne `scale(0.96)` na klik daje przyciskom dotykowy feedback. Zawsze używaj `0.96` (Tailwind: `active:scale-[0.96]`). Nigdy wartości mniejszej niż `0.95` — cokolwiek poniżej wygląda przesadnie. Dodaj prop `isStatic`, żeby wyłączyć gdy ruch byłby rozpraszający. → [animation-polish.md](animation-polish.md)

### 13. Skip Animation on Page Load

Używaj `initial={false}` na `AnimatePresence`, żeby zapobiec enter animacjom na pierwszym renderze. Zweryfikuj, że nie psuje to celowych entrance animations. → [animation-polish.md](animation-polish.md)

### 14. Never Use `transition: all`

Zawsze specyfikuj konkretne properties: `transition-property: scale, opacity` (Tailwind: `transition-[scale,opacity]`). Tailwindowe `transition-transform` pokrywa `transform, translate, scale, rotate`. Gołe `transition` w v4 to stała, szeroka lista właściwości (kolory, cień, transformacje, filtry) — też animuje więcej, niż się zmienia. → [performance.md](performance.md)

### 15. Use `will-change` Sparingly

Tylko dla `transform`, `opacity`, `filter` — properties, które GPU może komponować. Nigdy `will-change: all`. Dodawaj tylko gdy zauważysz first-frame stutter. → [performance.md](performance.md)

### 16. Minimum Hit Area

Cel interakcji ma co najmniej 24×24 px (WCAG 2.2 AA, 2.5.8 — próg twardy), a kontrolka dotykowa 44×44 px (`min-h-11 min-w-11`, Apple HIG / WCAG AAA 2.5.5). Jeśli widoczny element jest mniejszy, rozszerz obszar pseudo-elementem do 24 px, a przy wskaźniku dotykowym do 44 px (dla elementu 20 px: `after:-inset-0.5 pointer-coarse:after:-inset-3`). Nigdy nie pozwól, żeby hit areas dwóch elementów się nakładały. Źródło progów: [accessibility.md](accessibility.md#rozmiar-celu) (sekcja „Rozmiar celu”); technika pseudo-elementu → [surfaces.md](surfaces.md)

---

## Częste błędy

| Błąd | Fix |
| --- | --- |
| Ten sam border radius na rodzicu i dziecku | Policz `outerRadius = innerRadius + padding` |
| Ikony wyglądają off-center | Wyrównaj optycznie z padding lub fix SVG bezpośrednio |
| Twarde bordery między sekcjami | Użyj warstwowego `box-shadow` z przezroczystością |
| Drażniące enter/exit animacje | Podziel, stagger i trzymaj exits subtelne |
| Liczby powodują layout shift | Zastosuj `tabular-nums` |
| Ciężki tekst na macOS | Zastosuj `antialiased` do root |
| Animacja gra przy załadowaniu strony | Dodaj `initial={false}` do `AnimatePresence` |
| `transition: all` na elementach | Specyfikuj konkretne properties |
| First-frame stutter animacji | Dodaj `will-change: transform` (oszczędnie) |
| Tiny hit areas na małych kontrolkach | Rozszerz pseudo-elementem do 24×24 px, a na dotyku (`pointer-coarse:`) do 44×44 px ([accessibility.md](accessibility.md#rozmiar-celu)) |

---

## Review Output Format

Ten format dotyczy tylko przeglądu polish na prośbę operatora (np. „przejrzyj polish tego ekranu”). Builder w workflowie zwraca wynik w schemacie raportu ze swojej definicji, a nie w tabelach Before/After.

W przeglądzie polish na prośbę operatora prezentujesz zmiany jako tabelę markdown z kolumnami **Before** i **After**. Uwzględnij każdą zmianę, którą zrobiłeś — nie tylko podzbiór — i nie listuj findings jako osobnych linii "Before:" / "After:" poza tabelą, bo rozbita lista utrudnia porównanie. Grupuj zmiany według pryncypium z nagłówkiem nad każdą tabelą i trzymaj każdy wiersz skupiony na pojedynczej zmianie, żeby czytelnik mógł przeskanować całą listę szybko.

### Przykład

#### Concentric border radius
| Before | After |
| --- | --- |
| `rounded-xl` na karcie + `rounded-xl` na inner button (`p-2`) | `rounded-2xl` na karcie (16 px = `8 + 8`), `rounded-lg` (8 px) na inner button |
| `border-radius: 16px` na obu zagnieżdżonych powierzchniach | Zewnętrzny `24px`, wewnętrzny `16px` z `8px` padding |

#### Tabular numbers
| Before | After |
| --- | --- |
| `<span>{count}</span>` na animowanym counterze | `<span className="tabular-nums">{count}</span>` |
| Default numerals na timer | Dodano `font-variant-numeric: tabular-nums` do root |

#### Scale on press
| Before | After |
| --- | --- |
| `<button className="...">` | Dodano `active:scale-[0.96] transition-transform` |
| `scale(0.9)` on press | Podniesiono do `scale(0.96)` — cokolwiek poniżej `0.95` wygląda przesadnie |

Wiersze powinny cytować konkretny plik i konkretną property, która się zmieniła, gdy nie jest to oczywiste ze snippetu. Jeśli pryncypium było review-owane, ale nic nie wymagało zmiany, pomiń tę tabelę całkowicie — puste tabele dodają szumu.

---

## Review Checklist

- [ ] Zagnieżdżone zaokrąglone elementy używają concentric border radius
- [ ] Ikony są wyrównane optycznie, nie tylko geometrycznie
- [ ] Shadows używane zamiast borders gdzie sensowne
- [ ] Enter animacje są podzielone i staggerowane
- [ ] Exit animacje są subtelne
- [ ] Dynamiczne liczby używają tabular-nums
- [ ] Font smoothing jest zastosowany na root
- [ ] Nagłówki używają text-wrap: balance
- [ ] Obrazy mają subtelne outlines z tokenu `--outline-image` (czerń 10% w `:root`, biel 10% w `.dark`)
- [ ] Przyciski używają scale(0.96) on press gdzie sensowne
- [ ] AnimatePresence używa `initial={false}` dla default-state elementów
- [ ] Brak `transition: all` — tylko konkretne properties
- [ ] Animacje mają wariant dla `prefers-reduced-motion` (Motion: `MotionConfig reducedMotion="user"` albo `useReducedMotion`) → [animations.md](animations.md)
- [ ] `will-change` tylko na transform/opacity/filter, nigdy `all`
- [ ] Interaktywne elementy mają co najmniej 24×24 px hit area, kontrolki dotykowe 44×44 px ([accessibility.md](accessibility.md))

---

## Zobacz Także

- [accessibility.md](accessibility.md) — rozmiar celu (Target Size), kontrast, reduced motion
- [typography-polish.md](typography-polish.md) — text wrapping, font smoothing, tabular numbers
- [surfaces.md](surfaces.md) — concentric radius, optical alignment, shadows, image outlines, hit area
- [animation-polish.md](animation-polish.md) — interruptible, subtle exits, icon crossfade, scale on press
- [performance.md](performance.md) — transition specificity, will-change
