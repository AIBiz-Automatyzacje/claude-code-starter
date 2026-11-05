# AI Pitfalls — wzorce tanioci AI-generowanego UI mobile

AI tools (GPT Image, Midjourney, generatory UI, vibecoded apki) potrafią przyspieszyć eksplorację, ale mają systematyczne słabości tworzące UI wyglądający tanio. Poniżej 10+ wzorców, jak je rozpoznać w 5 sekund i jak wziąć AI output i zrobić go premium.

---

## 5 patternów tanioci (z systematic research)

### 1. Nadmiar wizualny

**Co AI robi źle:** modele generatywne trenowane na obrazach produkują wizualnie gęste outputy — niepotrzebne elementy, skomplikowane patterny, przeładowane powierzchnie. Drop-shadows na każdym elemencie. Gradient backgrounds. Glow effects "for atmosphere". Dekoracyjne ikony obok każdego pola tekstu.

**Premium apki robią odwrotnie.** Negatywna przestrzeń jako element designu. Dekoracja TYLKO gdy służy konkretnemu celowi. Linear, Things 3, Bear — wszystkie robią max 2 wizualne elementy per ekran.

**Fix po generacji:** usuń wszystko co nie służy funkcji. Zacznij od pełnej redukcji — usuń wszystkie gradients, drop-shadows, glow effects. Dodaj z powrotem tylko te, które komunikują hierarchię lub stan (focus, hover, error).

### 2. Niespójny spacing i alignment

**Co AI robi źle:** generatory nie trzymają się grid systemu. Padding 16, 18, 22, 27 mieszane bez uzasadnienia. Gap'y między elementami arbitralne. Baseline'y tekstu nie wyrównują się poziomo między sekcjami. Wertykalny rytm pływa.

**Sygnatura AI:** padding `16px` w jednej karcie i `24px` w drugiej, choć obie mają tę samą funkcję. Margin-top `12px`, margin-bottom `18px` w tym samym komponencie.

**Fix:** narzuć 8pt grid na CAŁY output. Zaokrąglij każdą wartość do `4, 8, 12, 16, 24, 32`. Wszystko poza tą skalą = błąd. Patrz [[resources/spacing-grid.md]].

### 3. Dekoracyjna typografia

**Co AI robi źle:** generatory produkują stylizowane fonty — elaborowane scripty, skondensowane sans-serify, "ozdobne" display. Te fonty optymalizują wizualne zainteresowanie zamiast czytelności. Psują się przy małych rozmiarach. Renderują się różnie per platforma.

**Sygnatura AI:** custom font na BODY (nie tylko hero). 5+ różnych weight/style w jednej apce. Letter-spacing arbitralny ("looks cool"). Mieszanie serif + sans-serif bez systemu.

**Fix:** zastąp WSZYSTKO system font (SF Pro / Roboto). Custom font tylko na hero / branding (1-2 ekrany). Type scale spójny — jeden ratio (1.125 / 1.25 / 1.5). Patrz [[resources/typography.md]].

### 4. Chaotyczne kolory

**Co AI robi źle:** generatory aplikują kolory bez rozumienia semantic systems. Niedostateczny kontrast (tekst 3:1 na body). Odwrócone konwencje (czerwony na pozytywne, zielony na destrukcyjne). Gradienty z gorszymi właściwościami accessibility. Lawendowe akcenty, peach buttons, teal-pink mix.

**Sygnatura AI:** lawendowy gradient w background. 8+ różnych akcent colors w jednej apce. Pastele zamiast semantic colors. Brak dark mode lub naive inwersja.

**Fix:** overlayuj koherentny semantic system (primary, success, warning, error, info). WCAG AA minimum 4.5:1. Dark mode jako redesign, nie inwersja. Patrz [[resources/color-darkmode.md]].

### 5. Mieszanie konwencji platformowych

**Co AI robi źle:** modele trenowane na różnorodnych datasetach produkują interfejsy łączące iOS z Material Design. iOS-style hamburger menu na ekranie z Material FAB. Nav bar w stylu Material, ale buttony w stylu iOS. iOS Switch obok Material Card.

**Efekt:** cognitive friction. Użytkownik nie wie czy to apka iOS, Android, czy webview.

**Fix:** audytuj output pod kątem platform guidelines. Wybierz JEDNĄ platformę, trzymaj jej patternu konsekwentnie. Patrz [[resources/platform-conventions.md]].

---

## Dodatkowe pułapki (rozszerzenie)

### 6. Brak stanów interaktywnych

**Co AI robi źle:** generuje statyczne layouty — buttony bez pressed state, formularze bez focus state, switche bez transition. Element wygląda jak przycisk, ale nie zachowuje się jak przycisk.

**Sygnatura AI:** wszystkie elementy w "default" state. Brak `:hover`, `:active`, `:focus`, `:disabled`. Brak loading state na buttonach. Brak optimistic UI po tap.

**Fix:** każdy interaktywny element musi mieć MIN 4 stany: default, pressed, disabled, focus. Buttony = `active:scale-[0.96]` na press. Inputs = `focus:ring-2 focus:ring-primary`. Loading na każdym async button.

### 7. Animacje bez celu

**Co AI robi źle:** AI + animation tools produkują efekty "looking cool" bez celu komunikacyjnego. Bouncy entrance animations dla każdego elementu. 800ms transitions. Spinning loaders na natychmiastowych akcjach.

**Sygnatura AI:** każde mount = animation. Każdy tap = ripple + shake + glow. Animacje > 400ms na zwykłych transitions.

**Fix:** każda animacja musi odpowiadać na pytanie "co komunikujesz użytkownikowi?". Jeśli odpowiedź to "wygląda fajnie" — usuń. Standardowy timing: 150-300ms. `prefers-reduced-motion` always respected.

### 8. Mieszanie filled + outline buttons bez hierarchii

**Co AI robi źle:** AI generuje 3 buttony w jednym ekranie — wszystkie w innym stylu (filled, outlined, text), ale wszystkie tej samej wagi. Użytkownik nie wie, który jest primary.

**Sygnatura AI:** ekran z "Save" filled, "Cancel" outlined, "Delete" filled red — bez rozumienia że primary action = JEDEN per ekran.

**Fix:** hierarchia button styles:
- 1 primary action per ekran (filled)
- 1-2 secondary actions (outlined lub text)
- Destructive akcent (text z error color, w menu lub action sheet)

### 9. Arbitrary border radius

**Co AI robi źle:** każda karta ma inny radius. `rounded-md` (6px) na buttonie, `rounded-2xl` (16px) na karcie inside, `rounded-3xl` (24px) na modal. Brak concentric logic.

**Sygnatura AI:** card 12px, button inside 8px (random), wewnętrzny avatar `rounded-full`. Niespójność.

**Fix:** zdefiniuj radius scale (`sm: 6, md: 10, lg: 14, xl: 20, 2xl: 28`). Concentric reguła: `outerRadius = innerRadius + padding`.

### 10. Generic icon library overuse

**Co AI robi źle:** lucide / heroicons / phosphor — używanie wszystkich ikon z jednej biblioteki, bez kuracji. Każdy element ma ikonę. Ikony losowo dobrane (czasem outlined, czasem filled, czasem duotone).

**Sygnatura AI:** ekran z 12 ikonami w 3 stylach. Brand wrażenia: zero — bo to ikony Tailwind/Lucide, jak każda inna apka.

**Fix:** wybierz JEDNĄ rodzinę ikon, JEDEN weight (outlined LUB filled, nie mix). Maksymalnie 6-8 ikon na ekran. Custom ikony na hero/branding (gdy budżet pozwala).

### 11. Drop-shadows everywhere

**Co AI robi źle:** każdy element ma `shadow-md` lub większy. Cards lift, buttons lift, modals lift, tooltips lift. Efekt: wszystko jest "ważne" = nic nie jest ważne.

**Sygnatura AI:** `shadow-xl` na bocznej karcie. `shadow-2xl` na buttonie.

**Fix:** używaj cieni HIERARCHICZNIE. Resting state — minimum lub zero. Elevated states (modal, sheet, dropdown) — wyraźniejszy cień. Patrz [[resources/polish-checklist.md]] sekcja Component patterns polish — "Image outline 1px subtle border" to konkretny wzorzec zamiany shadow na subtelny border w resting state.

### 12. Lavender gradient w background

**Co AI robi źle:** to konkretna sygnatura. AI generators kochają `from-purple-400 to-pink-300` background. Estetycznie "AI-aesthetic" — łatwo rozpoznawalny.

**Sygnatura AI:** każdy ekran ma multi-color gradient background. Background gradient dominuje nad contentem.

**Fix:** background = jeden semantic color (`bg-background`). Gradient TYLKO świadomie, na hero (jeden ekran), z brand colors, nie generic purple-pink.

---

## "5 sekund test" — jak rozpoznać AI-generated UI

Pokaż screen komuś przez 5 sekund. Pytanie: "co to jest?" i "co tu kliknąć żeby [main action]?".

**AI signs (jeśli odpowiedzi są "nie wiem"):**
- ✗ Nie wie co kliknąć (3+ elementy o tej samej wadze wizualnej)
- ✗ Nie wie czego ten ekran dotyczy (nadmiar dekoracji nad contentem)
- ✗ Mówi "wygląda jak [generic product]" (brak personality)
- ✗ Komentuje "fajne kolory" zamiast funkcji (estetyka > funkcjonalność)

**Premium signs:**
- ✓ Od razu wskazuje primary action
- ✓ Rozumie kontekst (apka do X)
- ✓ Komentuje content, nie estetykę

---

## Workflow recovery — jak wziąć AI output i zrobić premium

Jeśli masz output AI i chcesz go uratować, wykonaj te kroki w kolejności:

### Krok 1: overlay grid (audit)

Nałóż 8pt grid na screen. Każdy element NIE w gridzie = problem. Podlicz problemy.

### Krok 2: normalize spacing

Zaokrąglij wszystkie paddings/margins do `4, 8, 12, 16, 24, 32`. Usuń arbitralne wartości.

### Krok 3: replace fonts

Zastąp wszystkie custom fonty system font (SF Pro / Roboto). Zostaw custom TYLKO na hero (1 element). Zredukuj weighty do 3 max (regular, semibold, bold).

### Krok 4: audit colors

Wyrzuć wszystkie hex inline. Zdefiniuj 10 semantic tokens. Sprawdź każdy tekst pod WCAG AA. Usuń wszystkie gradients. Dodaj z powrotem tylko hero gradient (jeśli pasuje).

### Krok 5: remove decoration

Usuń: drop-shadows na elementach które nie są elevated, glow effects, dekoracyjne ikony, niepotrzebne dividers, gradient overlays.

### Krok 6: hierarchy buttons

Wybierz primary action per ekran. Reszta = secondary (outlined) lub tertiary (text). Maksymalnie 1 filled button per ekran.

### Krok 7: radius scale

Zdefiniuj `sm: 6, md: 10, lg: 14, xl: 20`. Wszystkie elementy mappują na tę skalę. Concentric reguła zastosowana.

### Krok 8: states

Dla każdego interaktywnego elementu dodaj 4 states (default, pressed, disabled, focus). Sprawdź animacje — usuń te > 300ms bez uzasadnienia.

### Krok 9: platform check

Sprawdź czy patterny są spójne z jedną platformą. Usuń mieszanie iOS+Material.

### Krok 10: 5-second test

Pokaż komuś. Czy wskaże primary action w 5s?

---

## Tools które pomagają

| Narzędzie | Co robi |
|-----------|---------|
| **Figma plugin: Style Audit** | Lista wszystkich nieużywanych styles, custom values poza grid |
| **Figma plugin: Contrast** | Wizualizacja contrast ratios per element |
| **Figma plugin: Spacing Linter** | Detekcja paddingów poza 8pt grid |
| **eslint-plugin-tailwindcss** | Lintuje arbitrary values, sugeruje tokens |
| **stylelint + custom config** | Wymusza używanie CSS custom properties (tokens) zamiast hex |
| **react-native-style-clean** | Wyrzuca duplicates / unused styles |

---

## Studium przypadku — before/after (opis tekstowy)

### Screen: Profile (przed redesignem)

**Before (AI output):**
- Background: lavender-pink gradient
- Hero: avatar 80x80 z shadow-2xl, border 4px gradient
- Username: custom serif font 28px regular weight, letter-spacing -1px
- Stats row: 3 metrics, każda w innej kolorystyce (teal, coral, lime), font weight 300
- "Edit Profile" button: filled lavender, rounded-3xl, shadow-xl, 120% opacity
- "Settings" button: outlined hot-pink, rounded-md, dotted border
- Lista akcji: 5 elementów z ikonami w różnych weights (outlined, filled, duotone, mix)
- Każdy item ma chevron + ikonę + tekst + drugi tekst, 5 paddingów innych

**Spacing audit:** 6 różnych paddingów (12, 16, 18, 22, 24, 28). Brak grid.
**Font audit:** 3 custom fonts (serif, condensed, script), 5 weighty.
**Color audit:** 8 unique colors w UI, 0 semantic tokens, contrast 3.2:1 na body.
**5-sec test:** "...nie wiem co tu jest, co kliknąć?"

### After (premium redesign)

- Background: `bg-background` (single semantic color)
- Hero: avatar 64x64, no shadow, 1px border `border-border` z 10% opacity
- Username: SF Pro Display 28px Semibold (600), letter-spacing -0.5
- Stats row: 3 metrics, każda `text-headline text-foreground`, label `text-footnote text-muted-foreground`
- "Edit Profile" button: filled primary, rounded-xl (14px), no shadow, h-12 (48pt touch target)
- "Settings": text button, `text-foreground` z chevron, no border
- Lista akcji: 5 elementów, jeden weight ikon (outlined 24x24), jeden padding (`p-4`), gap-3 między ikoną a tekstem
- Vertical rhythm: hero `pt-8`, stats `mt-6`, lista `mt-8`, każdy item `py-3`

**Spacing audit:** wszystko w `4, 8, 12, 16, 24, 32` ✓
**Font audit:** 1 font family (SF Pro), 2 weighty (regular, semibold) ✓
**Color audit:** 5 semantic tokens, contrast 7.2:1 na body, 4.6:1 na muted ✓
**5-sec test:** "to profil, kliknę 'Edit Profile' żeby zmienić" ✓

**Co się zmieniło konkretnie:**
1. Usunięto 3 custom fonty → SF Pro
2. Zredukowano 8 unique colors → 5 semantic tokens
3. Znormalizowano 6 paddingów → 4 wartości (8, 12, 16, 24)
4. Wyrzucono drop-shadows z 4 elementów → 0
5. Zhierarchizowano 2 buttony (filled primary + text secondary) zamiast 2 filled
6. Standardowy radius scale (`xl` na buttonach, `2xl` na cards)
7. Touch target 48pt (było 36pt)
8. Dark mode redesign zamiast inwersji

---

## Checklist anti-AI-tanioć

- [ ] Brak gradient background (poza świadomym hero)
- [ ] Brak drop-shadows na elementach które nie są elevated
- [ ] Maksymalnie 2 dekoracje per ekran
- [ ] System font (SF Pro / Roboto) na body, custom tylko na hero
- [ ] Maksymalnie 3 weighty fonts w apce
- [ ] Wszystkie spacingi w `4, 8, 12, 16, 24, 32` (8pt grid)
- [ ] 1 primary action per ekran (filled), reszta secondary/tertiary
- [ ] Radius scale spójny (concentric reguła)
- [ ] Maksymalnie 1 rodzina ikon, jeden weight
- [ ] Zero hex inline — tylko semantic tokens
- [ ] WCAG AA: contrast 4.5:1 body, 3:1 large text
- [ ] Dark mode jako redesign (osobne wartości), nie inwersja
- [ ] 4 stany na interaktywnych elementach (default, pressed, disabled, focus)
- [ ] Animacje 150-300ms, każda z celem komunikacyjnym
- [ ] `prefers-reduced-motion` respected
- [ ] 5-sec test przeszedł — primary action obvious

---

## Powiązane

- [[resources/platform-conventions.md]] — mieszanie iOS+Material jako AI signature
- [[resources/typography.md]] — system fonts vs decorative
- [[resources/spacing-grid.md]] — 8pt grid jako fundament
- [[resources/color-darkmode.md]] — semantic tokens vs arbitrary colors

*Źródła: wiki/pulapki-ai-ui (case Padlement), web research "AI generated UI design mistakes 2025-2026", "vibecoded app design", Vercel design blog, Rauno Freiberg patterns (rauno.me), refactoring.fm "AI design tells", Figma community AI audit threads. Ostatni update: 2026-05-10.*
