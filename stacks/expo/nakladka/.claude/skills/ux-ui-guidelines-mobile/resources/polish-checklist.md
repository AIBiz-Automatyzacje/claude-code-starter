# Mobile Polish Checklist

Master checklist micro-detali które oddzielają **premium** od **amateur**. Każdy punkt to 1-2 sekundy decyzji w implementacji — ale zsumowane stanowią różnicę między apką, której user nie zauważa (good) a apką, której nie chce odinstalować (premium).

Format: `[ ]` checklist. Każdy punkt linkuje do pełnego pliku z kontekstem.

---

## Typography polish

- [ ] **System font dla body text**. Custom font tylko dla hero / brand moments. SF Pro / Roboto mają full Dynamic Type support. → patrz [accessibility-mobile.md](accessibility-mobile.md)
- [ ] **Tabular numbers na liczbach dynamicznych**. `fontVariant: ['tabular-nums']` na timer, score, kwoty, daty — eliminuje layout shift przy zmianie cyfr.
- [ ] **`allowFontScaling` zostaje `true`**. Nie wyłączaj Dynamic Type — 65% iOS userów go używa. Cap przez `maxFontSizeMultiplier: 1.5-2.0`. → patrz [accessibility-mobile.md](accessibility-mobile.md)
- [ ] **Line-height min 1.4 dla body**, 1.2 dla headings. Czytelność na małych ekranach.
- [ ] **Letter spacing nie wyższe niż 0** dla body. Tracking dodatni tylko dla all-caps labels (mikro 0.5-1px).
- [ ] **Hierarchia typograficzna 3 poziomy max** na ekranie. Więcej = chaos wizualny.
- [ ] **Text-wrap balance dla nagłówków** (jeśli platforma wspiera) — żaden nagłówek z osieroconym słowem.
- [ ] **Bold Text accessibility**. Jeśli używasz custom fontu, ładuj wariant Bold i podmieniaj gdy `isBoldTextEnabled`. → patrz [accessibility-mobile.md](accessibility-mobile.md)

---

## Spacing & layout polish

- [ ] **8pt grid bez wyjątków**. Wszystkie spacingi (padding, margin, gap) wielokrotności 4 lub 8 (4, 8, 12, 16, 24, 32, 48). Wyjątki = bug.
- [ ] **Concentric border radius**. Outer radius = inner radius + padding. Karta z `borderRadius: 16, padding: 12` ma children z `borderRadius: 4`.
- [ ] **Safe area respect**. `useSafeAreaInsets()` na każdym top/bottom screen. Nigdy nie pozwól treści zniknąć pod notch/Dynamic Island/home indicator.
- [ ] **Touch target 44pt iOS / 48dp Android**. Min wszystkich interactive elements. WCAG 2.2 AA hard floor = 24×24 CSS px (na mobile ≈ pt/dp) — nigdy poniżej. → patrz [accessibility-mobile.md](accessibility-mobile.md)
- [ ] **Visual rhythm — consistent gap między sekcjami**. Te same odstępy między cards w liście, między sekcjami formularza.

---

## Color & dark mode polish

- [ ] **Dark mode = redesign, nie inwersja**. `#000` na `#FFF` flip = horror dla oczu. Użyj osobnych tokenów per motyw (`@variant light` i `@variant dark` w `global.css`).
- [ ] **Semantic colors w roli**. Czerwony = destructive, zielony = success, żółty = warning. NIGDY odwrotnie. User czyta apkę przez kolor zanim przeczyta tekst.
- [ ] **Contrast min 4.5:1 dla tekstu** (3:1 dla large 18pt+). Test każdego ekranu — Apple Accessibility Inspector / Stark plugin. → patrz [accessibility-mobile.md](accessibility-mobile.md)
- [ ] **Reduce Transparency alternative**. Glass/blur surfaces muszą mieć solid fallback gdy `isReduceTransparencyEnabled`. Natywne `expo-blur` robi to automatycznie. → patrz [accessibility-mobile.md](accessibility-mobile.md)

---

## Animation polish

- [ ] **Scale 0.96 on press**. NIGDY 0.95 lub mniej (przesadnie). Subtelny wariant 0.98 dla małych elementów. → patrz [motion-microinteractions.md](motion-microinteractions.md)
- [ ] **Animuj tylko `transform` + `opacity`**. Layout properties (width, height, padding) wymuszają reflow = jank. → patrz [motion-microinteractions.md](motion-microinteractions.md)
- [ ] **600ms hard limit dla default interaction**. Powyżej user czuje opóźnienie. Wyjątek: świadome storytelling (onboarding intro). → patrz [motion-microinteractions.md](motion-microinteractions.md)
- [ ] **`Easing.out` jako default w 80% przypadków**. Wchodzące elementy decelerują — naturalna fizyka. → patrz [motion-microinteractions.md](motion-microinteractions.md)
- [ ] **Stagger 50ms, max 6-8 elementów**. Powyżej cumulative delay > 400ms = za długo. Reszta listy renderuje instant. → patrz [motion-microinteractions.md](motion-microinteractions.md)

---

## Haptics polish

- [ ] **Haptic na confirm, NIGDY na każdy tap**. User wibracja-na-każdy-button odinstalowuje apkę po dniu. → patrz [haptics-gestures.md](haptics-gestures.md)
- [ ] **Selection haptic na slider/picker snap**. Każdy "snap to value" daje rytm i potwierdza precyzję. → patrz [haptics-gestures.md](haptics-gestures.md)
- [ ] **Notification haptic dla async outcomes**. Success/Error/Warning po `await fetchData()` — nie po naciśnięciu submit. → patrz [haptics-gestures.md](haptics-gestures.md)

---

## Accessibility polish

- [ ] **VoiceOver test każdego ekranu PRZED merge**. Realne iOS device, nie symulator. → patrz [accessibility-mobile.md](accessibility-mobile.md)
- [ ] **TalkBack test każdego ekranu PRZED merge**. Realne Android device — różni się od VoiceOver. → patrz [accessibility-mobile.md](accessibility-mobile.md)
- [ ] **Dynamic Type test na XXXL**. 65% userów ma niestandardowy size — czy layout nie wybucha. → patrz [accessibility-mobile.md](accessibility-mobile.md)
- [ ] **Reduce Motion respect**. Min wyłącz decorative — zachowaj state change feedback (skróć do 0-100ms). → patrz [motion-microinteractions.md](motion-microinteractions.md)
- [ ] **Status nie samym kolorem**. Error/success ma kolor + ikonę + tekst. 8% mężczyzn = color blind. → patrz [accessibility-mobile.md](accessibility-mobile.md)

---

## Platform conventions polish

- [ ] **Native back button respect (Android)**. Hardware back button musi działać jak gesture back na iOS. `BackHandler` API.
- [ ] **Pull-to-refresh tylko na lists**. Nie na single-screen views. User testuje gest tam gdzie ma sens.
- [ ] **Tab navigation iOS / Drawer Android**. Nie wymuszaj identycznej nawigacji cross-platform — user oczekuje konwencji swojej platformy.
- [ ] **Sheet z bottom dla iOS**. Modal alerts pojawiają się top-center. Sheets (forms, pickers, share) — bottom-up. Material 3 Android — pełnoekranowe lub bottom sheet.

---

## Component patterns polish

- [ ] **Active state na każdy interactive element**. Color change + scale 0.96 minimum. Bez feedback user myśli że tap nie zadziałał.
- [ ] **Empty state ma headline + description + CTA**. NIE samo "No data". User po empty state musi wiedzieć "co teraz".
- [ ] **Loading > 300ms = pokaż spinner**. > 1s = pokaż skeleton (zachowuje layout). > 5s = pokaż progress %.
- [ ] **1 primary CTA per ekran**. Max 2 secondary actions. Powyżej user gubi hierarchię akcji.
- [ ] **Optical alignment ikon w buttonach**. Ikona musi być centrowana wizualnie (nie matematycznie) względem tekstu — strzałki, asymetryczne ikony.
- [ ] **Image outline 1px subtle border** (~rgba alpha 0.05-0.1). Premium feel, oddziela obrazek od tła nawet gdy tło jest podobne kolorystycznie.
- [ ] **Konkretne `transitionProperty`** w Reanimated 4, nigdy `'all'`, które dokumentacja odradza ze względu na wydajność. Animuj specyficzne properties.

---

## Sanity check

- [ ] **5-second test**. Pokaż screen userowi przez 5 sekund. Pyta "co kliknę żeby zrobić X?" Jeśli zgaduje — hierarchia zła.
- [ ] **Center-screen test**. Czy główne CTA są w środkowej części ekranu? **Steven Hoober (autor oryginalnego diagramu "thumb zone") sam go obalił** — primary research pokazuje, że środek ekranu jest dotykany **najczęściej, najszybciej i najdokładniej**. Górna 20% jest poza zasięgiem przy jednoręcznym użyciu na dużych telefonach (Pro Max, Ultra). Bottom tab bar OK jako nawigacja (przewidywalność), nie dlatego że "łatwy do kciuka". → Patrz [[resources/spacing-grid.md]] sekcja "Gdzie umieszczać główne CTA".
- [ ] **Brightness 30% test**. Kontrast jest OK przy słabym oświetleniu? Test apki w ciemnym pokoju z brightness slider niski.

---

## Pre-merge checklist (10-punktowa code review)

Przed mergem każdego PR z UI:

1. **TypeScript clean** — zero `any`, zero `!` non-null assertion
2. **Touch targets ≥ 44pt iOS / 48dp Android** wszystkie interactive
3. **VoiceOver przejście całego ekranu** — czy reading order ma sens, czy każdy element ma label
4. **Dynamic Type na XXXL** — czy layout nie pęka
5. **Reduce Motion ON test** — czy user nadal rozumie zmiany stanu
6. **Color contrast** każdego foreground/background ≥ 4.5:1 (3:1 dla large)
7. **60fps animations** — Performance Monitor (Reanimated devtools), animuj tylko transform + opacity
8. **Empty / loading / error states** zaimplementowane, nie tylko happy path
9. **Safe area respect** top + bottom + sides (iPad landscape też)
10. **Haptic tylko na świadome confirm**, nie na każdy press

---

## Powiązane (pełne pryncypia)

- [motion-microinteractions.md](motion-microinteractions.md) — pełna teoria animacji mobile
- [haptics-gestures.md](haptics-gestures.md) — haptyka i gesty natywne
- [accessibility-mobile.md](accessibility-mobile.md) — WCAG 2.2 AA, VoiceOver, Dynamic Type

---

*Źródła: synthesis z innych plików skilla, Things 3 / Linear Mobile / Bear teardown observations, Apple HIG (developer.apple.com/design/human-interface-guidelines), Material 3 (m3.material.io), Refactoring UI (refactoringui.com), Vercel Geist patterns. Update: 2026-11-05.*
