---
name: ux-ui-guidelines-mobile
description: Wytyczne UX/UI dla aplikacji mobilnych (Expo + React Native + Uniwind, ale stack-agnostic w pryncypiach). Platform conventions (iOS HIG vs Material 3), typografia natywna (SF Pro/Roboto, Dynamic Type, type scale), 8pt grid + safe areas, semantic colors + dark mode jako redesign, ikony (SF Symbols vs Lucide vs Material Symbols), motion i micro-interactions (Reanimated — aktualny major 4.x, wymaga New Architecture; 3.x legacy — easing, stagger), haptics + native gestures (expo-haptics, RNGH 3.x), stany loading/empty/error, formy + klawiatura mobilna, navigation patterns (tabs/drawer/stack/modal), bottom sheets i modale, listy (FlashList v2, swipe actions), accessibility (VoiceOver, TalkBack, Dynamic Type), pułapki AI-generowanego UI, teardowny premium apek (Things 3, Bear, Linear, Wellspoken), app icon i splash screen. Używaj przy projektowaniu ekranów mobilnych, budowie design system pod mobile, decyzjach iOS vs Android, "ekran wygląda tanio", "feels off na mobile", "native feel vs web feel", review designu mobilnego, mobile polish.
---

# UX/UI Guidelines — Mobile

## Cel

Uniwersalny przewodnik po projektowaniu aplikacji mobilnych. Pryncypia działają w każdym stacku (React Native, native iOS/Swift, native Android/Kotlin, Flutter). Przykłady kodu w **Expo + React Native + Uniwind** (default stack zespołu).

## Kiedy Używać Tego Skilla

- Projektowanie ekranu mobilnego (od zera lub redesign)
- Decyzje iOS vs Android (HIG vs Material 3)
- Budowa mobile design system (tokens, components, theme)
- Implementacja accessibility (VoiceOver, TalkBack, Dynamic Type)
- Animacje i micro-interactions (Reanimated 4.x/3.x legacy, haptyka, gesty)
- Stany dynamiczne (loading, empty, error, offline)
- Formy mobilne (klawiatura, autofill, biometria, validation)
- Navigation patterns (tabs, drawer, modal, sheet, deep linking)
- Listy z dużą ilością danych (FlashList, virtualization, swipe actions)
- App icon + splash screen
- Code review pod kątem polish ("dlaczego ten ekran wygląda tanio?")

---

## Quick Start

### Checklist Nowego Ekranu Mobilnego

- [ ] Platforma-specific decyzje świadome (HIG vs Material 3) — patrz [[resources/platform-conventions.md]]
- [ ] System font default (SF Pro / Roboto), custom font tylko hero/branding
- [ ] 8pt grid bez wyjątków (4pt half-step tylko dense UI)
- [ ] Safe area respect (`useSafeAreaInsets`) — żaden interaktywny element pod notch/Dynamic Island
- [ ] Touch target min 44pt iOS / 48dp Android (rekomendowane 48-56pt)
- [ ] Semantic colors w roli (red=destructive, green=success — NIGDY odwrotnie)
- [ ] Dark mode = redesign nie inwersja (kalibrowane warianty per rola)
- [ ] WCAG 2.2 AA: 4.5:1 body text, 3:1 large/non-text
- [ ] `accessibilityLabel` na każdym icon-only button
- [ ] Dynamic Type test na XXXL (layout adapt: row → column)
- [ ] Loading state: skeleton dla znanej struktury, spinner dla unknown, > 300ms zawsze visible feedback
- [ ] Empty state ma headline + description + CTA (NIE samo "Brak danych")
- [ ] Error states z konkretnym recovery action (retry / reload / contact)
- [ ] Animacje: konkretne `transitionProperty` (nigdy `'all'`), GPU-only (transform + opacity), 200-300ms standard
- [ ] Press feedback: `scale(0.96)` + opcjonalnie haptic na confirm (NIGDY na każdy tap)
- [ ] Concentric shapes — świadomy wybór typu (fixed/capsule/concentric, iOS 26 Apple official) — patrz [[resources/spacing-grid.md]]
- [ ] `tabular-nums` (`fontVariant: ['tabular-nums']`) na wszystkich dynamicznych liczbach
- [ ] Reduce Motion respect (decoration off, state-change feedback shorter/instant)

### Checklist Formularza Mobile

- [ ] Label nad inputem (NIE w placeholder long-term)
- [ ] `keyboardType` properly set (number-pad / email-address / phone-pad / etc.)
- [ ] `textContentType` (iOS) + `autoComplete` (Android) dla autofill
- [ ] `KeyboardAvoidingView` z `behavior="padding"` na obu platformach; dłuższy formularz: `KeyboardAwareScrollView` z `react-native-keyboard-controller`
- [ ] Validation `onBlur` (sweet spot — NIE onChange real-time, NIE tylko onSubmit)
- [ ] Error display inline pod fieldem, ogłaszany na obu platformach: `aria-live="polite"` (Android) + `AccessibilityInfo.announceForAccessibility` (iOS)
- [ ] Submit button states: default → loading (spinner inside) → success/error
- [ ] Tap-outside-to-dismiss keyboard (`Keyboard.dismiss()`)
- [ ] Multi-step form: split przy >5 polach + step indicator + save progress
- [ ] Biometric auth (`expo-local-authentication`) jako alternatywa hasła

### Checklist Pre-Merge

- [ ] VoiceOver test na real device (czytaj cały flow przez screen reader)
- [ ] TalkBack test na Android (jeśli cross-platform)
- [ ] Dynamic Type maxed (Extra Extra Large) — layout still working?
- [ ] Reduce Motion ON — animations stopped lub skrócone
- [ ] Dark mode + light mode oba audyt (NIE inwersja)
- [ ] Contrast checker (4.5:1 body, 3:1 large) — każdy tekst, każda ikona
- [ ] 5-second test: pokaż screen 5s — czy wiadomo co kliknąć?
- [ ] **Center-screen test:** czy główne CTA w środkowej części ekranu? (Steven Hoober, autor "thumb zone" diagramu, sam go obalił — środek ekranu jest dotykany najczęściej i najdokładniej, NIE krawędzie. Patrz [[resources/spacing-grid.md]])
- [ ] Brightness 30% test: czy ekran czytelny w słońcu?
- [ ] Performance: 60fps na scroll i animacjach

→ Pełna lista: [[resources/polish-checklist.md]]

---

## Główne Zasady 2026

1. **Default to native first** — custom UI tylko gdy native ma realne braki lub brand wymaga unique behavior
2. **Platform conventions wygrywają** — iOS HIG na iOS, Material 3 na Android, NIE forsuj jednego designu na obu
3. **System fonts default** — SF Pro / Roboto. Custom font tylko hero/branding (Dynamic Type, accessibility, performance)
4. **8pt grid bezwzględnie** — żadnego inline spacingu. Tokeny `xs/sm/md/lg/xl/2xl/3xl/4xl`
5. **Semantic colors + dark mode jako redesign** — każda rola ma własne specyfikacje light/dark
6. **WCAG 2.2 AA jako minimum** — Target Size, Focus Not Obscured, Resize Text 200%
7. **Touch targets** — 44pt iOS / 48dp Android minimum, 48-56pt rekomendowane
8. **Just-in-time permissions** — proś gdy user widzi wartość, NIE na onboardingu hurtem
9. **Less is more na onboardingu** — 0-3 ekrany sweet spot (badania: 5 ekranów = 20-30% completion vs 2 ekrany = 40-50%)
10. **Animations communicate state** — dekoracja bez celu = NIE. Każda animacja odpowiada "co komunikuje?"
11. **Haptyka na outcome, nie action** — confirm/error/selection tak, każdy tap NIE
12. **GPU-only animations** — `transform` + `opacity` + `filter`. NIGDY `width/height/top/left`
13. **Tabular nums** na wszystkich dynamicznych liczbach (timer, score, kwota)
14. **Concentric shapes (iOS 26 Apple official)** — 3 typy: `fixed` / `capsule` / `concentric` (radius rodzica minus padding). Każdy zagnieżdżony element MUSI być koncentryczny.
15. **Scale 0.96 on press** (nigdy poniżej 0.95) dla tactile feedback
16. **`Platform.select` to intencja, nie hack** — wspólny kod biznesowy, platform-specific UI
17. **Empty state jako nauczyciel** — Things 3 pattern (headline + description + CTA)
18. **5-sekundowy test** — daj komuś screen 5s, czy wie co kliknąć? Jeśli nie — redesign hierarchy

---

## Topic Guides

### Foundation

| Plik | Co zawiera |
|------|------------|
| [[resources/platform-conventions.md]] | iOS HIG vs Material 3, `Platform.select`, hybrid vs platform-specific design |
| [[resources/typography.md]] | SF Pro/Roboto, type scale (1.125/1.25/1.5), Dynamic Type, custom fonts w Expo |
| [[resources/spacing-grid.md]] | 8pt grid, tokeny spacingowe, safe areas, touch targets, tokeny w `@theme` |
| [[resources/color-darkmode.md]] | Semantic colors, dark mode jako redesign, layering, WCAG, color blindness |
| [[resources/icons.md]] | SF Symbols vs Lucide vs Material Symbols, sizing matrix, optical alignment |

### Interaction

| Plik | Co zawiera |
|------|------------|
| [[resources/motion-microinteractions.md]] | Kiedy animować, timing matrix, easing, stagger, Reanimated 4.x patterns (3.x legacy) |
| [[resources/haptics-gestures.md]] | expo-haptics matrix, native gestures, RNGH 3.x, gesture conflicts |
| [[resources/forms-keyboard.md]] | Input states, keyboardType, autofill, KeyboardAvoidingView, keyboard-controller, react-hook-form + zod |

### States & Feedback

| Plik | Co zawiera |
|------|------------|
| [[resources/states-loading-empty-error.md]] | Skeleton vs spinner, empty state typology, error recovery, offline-first |
| [[resources/onboarding.md]] | Ile ekranów onboardingu, progressive disclosure, just-in-time permissions, paywall placement |

### Architecture

| Plik | Co zawiera |
|------|------------|
| [[resources/navigation-patterns.md]] | Bottom tabs vs drawer vs stack, modal vs sheet vs full-screen, deep linking |
| [[resources/sheets-modals.md]] | Bottom sheet (Gorhom + iOS native detents), alerts, toasts, popovers |
| [[resources/lists-performance.md]] | FlashList vs FlatList, virtualization, swipe actions, pull-to-refresh |

### Quality

| Plik | Co zawiera |
|------|------------|
| [[resources/accessibility-mobile.md]] | VoiceOver, TalkBack, Dynamic Type, color blindness, Reduce Motion, testing |
| [[resources/polish-checklist.md]] | Master checklist 30+ punktów polish + pre-merge code review checklist |
| [[resources/ai-pitfalls.md]] | 5 wzorców tanioci AI-UI + workflow recovery |

### Inspiration

| Plik | Co zawiera |
|------|------------|
| [[resources/teardowns.md]] | Things 3, Bear, Arc Search, Linear Mobile, Calorify, Wellspoken — co konkretnie robią dobrze |
| [[resources/app-icon-splash.md]] | App icon principles (iOS 18 light/dark/tinted, Android adaptive), splash screen |

---

## Navigation Guide — Po Czym Wybrać

| Potrzebujesz... | Czytaj |
|-----------------|--------|
| "iOS czy Android first? Czy unifikować?" | [[resources/platform-conventions.md]] |
| Skala typograficzna, custom font w Expo | [[resources/typography.md]] |
| 8pt grid, safe areas, tokeny w `@theme` | [[resources/spacing-grid.md]] |
| Semantic colors + dark mode + WCAG | [[resources/color-darkmode.md]] |
| Wybrać ikony (SF Symbols vs Lucide) | [[resources/icons.md]] |
| Animować — kiedy, jak, czas, easing | [[resources/motion-microinteractions.md]] |
| Haptyka — kiedy, jaka intensywność | [[resources/haptics-gestures.md]] |
| Form mobile (klawiatura, autofill, validation) | [[resources/forms-keyboard.md]] |
| Loading/empty/error/offline states | [[resources/states-loading-empty-error.md]] |
| Tabs vs drawer vs stack vs modal | [[resources/navigation-patterns.md]] |
| Bottom sheet (Gorhom vs native iOS) | [[resources/sheets-modals.md]] |
| Lista 1000+ items, swipe-to-delete | [[resources/lists-performance.md]] |
| VoiceOver, TalkBack, Dynamic Type test | [[resources/accessibility-mobile.md]] |
| Onboarding — ile ekranów, kiedy permissions | [[resources/onboarding.md]] |
| "Ekran wygląda tanio — co poprawić?" | [[resources/ai-pitfalls.md]] + [[resources/polish-checklist.md]] |
| Premium app teardowny dla inspiracji | [[resources/teardowns.md]] |
| App icon + splash design | [[resources/app-icon-splash.md]] |
| Pre-merge review (code review polish) | [[resources/polish-checklist.md]] |

---

## Powiązane Skills

Ten skill mówi **co i dlaczego** (pryncypia UX, platform conventions, wzorce wizualne). O tym, **czym
to zaimplementować**, decydują skille Expo — i to one są źródłem prawdy przy rozbieżności:

- **expo-stos-szablonu** — hub stosu tego szablonu: od niego zaczynasz, gdy nie wiesz, po który skill sięgnąć
- **rn-expo-guidelines** — reguły pisania kodu RN i Expo; ten skill zostaje od UX i designu
- **expo:expo-ui** — **sprawdzaj pierwszy przy wyborze komponentu**: sheet, picker, slider, toggle, menu,
  sekcja formularza, grouped rows. Natywne SwiftUI / Jetpack Compose, od SDK 56+ w Expo Go.
  Wbudowane komponenty RN i biblioteki community dopiero, gdy `@expo/ui` nie ma odpowiednika
- **expo:expo-animation** — implementacja ruchu i gestów (Reanimated worklety, Gesture Handler, haptics,
  przejścia ekranów). Tutejszy `motion-microinteractions.md` mówi *kiedy i co animować*; tamten skill
  mówi *jak to napisać, żeby nie tnęło na urządzeniu*
- **expo:expo-design-system** — gdzie żyją tokeny (kolor, spacing, typografia, radius, shadow, motion),
  konwencje wariantów komponentów, audyt driftu. Tutejsze pliki dają wartości i uzasadnienie, tamten
  skill — strukturę, w której mają mieszkać
- **expo:expo-native-ui** — platformowe UI w Expo Router (native tabs, semantic colors, SF Symbols, blur)
- **expo:expo-router** — nawigacja plikowa, stacki, native tabs, sheety jako ekrany
- **uniwind** — Tailwind v4 w React Native: setup, tokeny w `@theme`, motywy, propsy `accent-*`
- **mobile-e2e-maestro** — automatyzacja testów E2E mobile

---

*Skill universal pod każdą aplikację mobilną. 18 plików w `resources/`, ~7100 linii. Stan: 2026-11-05 (Expo SDK 58: RN 0.88, iOS 27 SDK; stylowanie Uniwind + Tailwind v4 CSS-first; Reanimated 4.7.1, Worklets 0.13.0, RNGH ~3.3.0, FlashList 2.3.2, keyboard-controller 1.22.7; wcześniej: iOS 27 — rewizja Liquid Glass pod czytelność + użytkownicki suwak przezroczystości, WWDC 2026-06-08; Android 17 stabilny 16.06.2026/API 37 — M3 Expressive z blur/translucencją w menu, sliderach i quick settings; Apple Design Resources dla iOS/iPadOS/macOS 27 (23.06.2026) + Icon Composer zamiast nieistniejącego „Liquid Glass simulatora"; `expo-glass-effect` dla powierzchni szklanych; monochrome opcjonalny od Android 16 QPR 2; odświeżone wersje bibliotek — Reanimated 4, RNGH 3, gorhom 5.2.x, SF Symbols 7000+, Lucide ISC/1776; wcześniej: iOS 26 Liquid Glass + M3 Expressive 18K data + concentric shapes 3 typy + thumb zone myth busted + Duolingo retention case + Christine Rode platform-native).*
