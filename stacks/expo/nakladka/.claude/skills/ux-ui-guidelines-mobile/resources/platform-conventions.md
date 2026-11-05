# Platform Conventions — iOS HIG vs Material 3

Decision framework: kiedy unifikować iOS i Android, kiedy różnicować. Filozofie obu platform, tabela porównawcza, `Platform.select()` w praktyce, najczęstsze błędy cross-platform.

---

## Filozofie platform

Apple HIG i Material 3 wyrastają z różnych pryncypiów. Kto je miesza w jednym ekranie, dostaje "webview feel" — interfejs ani iOS, ani Android.

| Wymiar | iOS HIG | Material 3 |
|--------|---------|------------|
| **Pryncypium** | Clarity through constraint | Expressive customization |
| **Kontrola dewelopera** | Niska — system narzuca | Wysoka — dynamic color, dynamic theming |
| **Branding** | Subtelny, system-first | Może być silny (M3 Expressive 2025+) |
| **Konsekwencja** | Apka wygląda jak "część iOS" | Apka wygląda jak "twoja apka na Androidzie" |
| **Egzekwowanie** | App Review odrzuca naruszenia | Brak twardych blokad od Google |

Apple traktuje HIG jako filozofię, nie checklistę. Każda decyzja UX sprowadza się do "czy użytkownik intuicyjnie rozumie co może zrobić, zanim przeczyta tekst?". Material 3 daje deweloperom system tokenów (typografia, kolor, kształt, elewacja), z którego budują własny język wizualny — z zachowaniem reguł.

W 2026 Apple zaostrza review — apki ignorujące HIG (custom hamburger menu na iOS, brak Dynamic Type, ignorowane safe areas) coraz częściej dostają odrzucenia. Google nie blokuje, ale użytkownicy Android oczekują Material patterns (FAB, ripple, bottom sheet).

---

## iOS 26/27 — Liquid Glass jako nowy design language

W 2025 (WWDC25, iOS 26) Apple wprowadził **Liquid Glass** — translucentny język wizualny zastępujący solid surfaces na wszystkich platformach Apple. Na **WWDC26 (czerwiec 2026, iOS 27)** Apple przebudował jego fundamenty, reagując na feedback: szkło **skuteczniej dyfunduje złożoną treść pod spodem**, daje **większą głębię i separację** (czytelność), a użytkownik dostał **suwak intensywności przezroczystości** (Settings → Appearance → Liquid Glass; pojawia się też na ekranie setupu, z podglądem czytelności) — do pełnej nieprzezroczystości włącznie. Domyślne szkło w iOS 27 jest mniej przezroczyste niż w iOS 26. Ikony aplikacji dostały osobne warstwy Liquid Glass (ostrzejsze) plus wybór Clear/Tinted w customizacji Home Screen.

**Co to znaczy dla buildera:** większość zmian aplikuje się automatycznie do apek używających komponentów systemowych po rekompilacji — ale **nie zakładaj konkretnego ustawienia suwaka**; kontrast testuj w obu skrajnościach (patrz [[color-darkmode.md]]).

Pełna oficjalna specyfikacja: sesje WWDC25 ("Meet Liquid Glass", "Get to know the new design system") + WWDC26, dokumentacja na developer.apple.com oraz **Apple Design Resources** — design kits Figma/Sketch dla iOS/iPadOS/macOS **27** wydane 23.06.2026 (aktualizacje Liquid Glass, rozszerzone komponenty i stany, nazewnictwo zbieżne z kodem, lepszy resizing).

**Co to jest mechanicznie:** soczewka zaginająca i koncentrująca światło zamiast rozpraszania (klasyczny blur). Dotyk podświetla powierzchnię od miejsca tapnięcia na zewnątrz, ruch urządzenia przesuwa wirtualne źródła światła. Dwa warianty:
- **Regular** — adaptacyjny, auto-flips light/dark, działa wszędzie. Default.
- **Clear** — permanentna przezroczystość, wymaga **dimming layer** pod spodem. Tylko nad media-rich contentem.

**Kluczowa zasada Apple — najczęściej łamana:** glass jest **wyłącznie dla warstwy nawigacji**. Nigdy w warstwie contentu, nigdy glass na glass. Tab bar kurczy się przy scrollu w dół i wraca przy scrollu w górę — priorytet contentu. Alerty spawnują się z punktu tapnięcia zamiast pełnoekranowego takeover.

**iOS 26 typografia update:** w alertach i onboardingu **grubsza i wyrównana do lewej** (lepsza czytelność). Tab bar default zawiera dedykowaną zakładkę Search.

### Trzy strategie buildera

| Strategia | Pros | Cons | Kiedy wybrać |
|-----------|------|------|--------------|
| **Pełna adopcja Liquid Glass** | "Modern iOS 26 native feel", App Store featuring boost | Krzywa nauki, wymaga audytu kontrastu na każdym ekranie | Apka z dużym budżetem i zespołem QA |
| **Świadome odrzucenie** (solid surfaces) | Defensible jako accessibility-first, czytelność, brand identity | Może wyglądać "dated" za 2-3 lata na iOS. **Nie da się utrzymać systemowym opt-outem** — `UIDesignRequiresCompatibility` jest ignorowany od SDK 27+. Realne odrzucenie = własne solid surfaces w warstwie CONTENTU + akceptacja, że chrome systemowy będzie szklany | Apki z silnym brand color (np. burgundowy heritage), apki accessibility-critical |
| **Hybryda** | Best of both — premium feel tylko gdzie ma sens | Wymaga dyscypliny: glass tylko w warstwach z kontrolowanym tłem | Większość premium apek 2026 |

**Praktyczna reguła z migracji wczesnych adopters:** nie mieszaj Liquid Glass z flat design w jednym ekranie. Albo cały ekran jest "glassy" (z kontrolą kontrastu), albo cały solid.

### Migracja techniczna (escape hatch Apple)

Glass aktywuje się **tylko po rekompilacji z Xcode 26** — sam update iOS nie zmienia apki. `UIDesignRequiresCompatibility = YES` w Info.plist to oficjalny escape hatch dla buildów z SDK 26 — apka pozostaje w starym design language.

> ⚠️ **UWAGA — hatch ma datę ważności.** Apple: *„The system ignores this key when you build for iOS 27 or later, iPadOS 27 or later, Mac Catalyst 27 or later, macOS 27 or later, or tvOS 27 or later."* (klucz jest dostępny od iOS/iPadOS/macOS/tvOS 26.0). Działa **wyłącznie w buildach z SDK 26**; po przejściu na SDK 27 jest cicho ignorowany — bez ostrzeżenia kompilatora. Expo SDK 58 buduje na iOS 27 SDK, więc w tym stosie klucz już nie działa i nie planuj na nim wyjścia z Liquid Glass. Bywa nieszczelny już na iOS 26 (por. `dotnet/maui#32814`).
>
> **Próg SDK w App Store:** potwierdzony jest próg *od 28.04.2026 uploady muszą być budowane min. z SDK 26*. Analogiczny próg dla SDK 27 należy zaplanować, ale **nie cytuj konkretnej daty jako faktu** — nie było oficjalnego ogłoszenia.

Po rekompilacji wszystkie buttony auto-capsulify, **tylko vibrant tinty przetrwają szklane overlaye** (pastele znikają). Unikaj ikon circle-in-circle — kontener już zapewnia zaokrąglenie.

→ Patrz [[resources/accessibility-mobile.md]] dla Reduce Transparency i fallback strategies.

→ Patrz [[resources/app-icon-splash.md]] dla nowych zasad ikon Apple iOS 26/27.

### iOS 27: aplikacje iPhone o zmiennym rozmiarze

Od iOS 27 okno aplikacji iPhone może zmieniać rozmiar, np. w iPhone Mirroring na macOS albo przy uruchomieniu na iPadzie. Dostaje to automatycznie każdy build z iOS 27 SDK, czyli też Expo SDK 58. Skutki dla layoutu:

- `requireFullScreen` nie wyłącza już zmiany rozmiaru, więc nie blokuje orientacji.
- `ScreenOrientation.lockAsync` może nic nie zrobić, bo system traktuje obsługiwaną orientację jako preferencję. W buildach debug biblioteka loguje ostrzeżenie przy odmowie blokady; po nim znajdziesz ekrany, które od niej zależą.
- `getOrientationAsync` może nie opisywać kształtu okna: iPhone Mirroring zawsze zgłasza portret.

Projektuj ekrany pod dostępną przestrzeń (flex, `useWindowDimensions`), a nie pod stałą orientację i proporcję urządzenia.

---

## Material 3 Expressive — design wsparty danymi

W 2025 Google przed projektowaniem M3 Expressive przeprowadził **46 badań z 18 000+ uczestników** (oficjalna prezentacja Google Android Developers). To największy peer-reviewed dataset w historii Material Design. Wyniki:

- Elementy UI w wersjach Expressive są znajdowane **do 4× szybciej** niż w nie-Expressive ekranach
- **87% userów w grupie 18-24 preferuje** Expressive nad standardowym MD3

**Android 17 (stabilny 16.06.2026, API 37) rozszerza M3 Expressive** — blur i translucencja wychodzą poza notyfikacje/quick settings (dodane w Android 16 QPR1) na suwak i panel głośności, power menu, widget picker, menu launchera oraz przejścia startu aplikacji. Kierunek jest ten sam co u Apple (warstwy przepuszczające treść), więc te same zasady kontrastu obowiązują po obu stronach.

**Kluczowe zmiany architektoniczne (Compose Material3 1.4 stable — API expressive nadal za `@OptIn(ExperimentalMaterial3ExpressiveApi::class)`):**
- **Physics-based spring motion tokens** zastępują krzywe easingowe — wybierasz `standard` lub `expressive` motion scheme zamiast ręcznie dobierać parametry (status API — patrz ramka pod listą)
- **Shape morphing wbudowany w buttony** — koło transformuje się w kwadrat przy nacisku przez parametr `shapes`
- **Bouncy animations** — powiadomienia reagują na odrzucenia
- **Variable fonts** i personalizowalne palety
- Navigation rail zastępuje drawer jednym adaptywnym komponentem reagującym na szerokość ekranu

> ⚠️ **Status API, nie tylko nazwy.** Schematy `standard` / `expressive` są poprawne, ale w stabilnym
> `androidx.compose.material3` **1.4.0** API expressive (`MotionScheme`, `MaterialExpressiveTheme`,
> `expressiveLightColorScheme`) są **wciąż eksperymentalne** — w kodzie produkcyjnym każdy komponent
> i motion scheme Expressive wymaga adnotacji `@OptIn(ExperimentalMaterial3ExpressiveApi::class)`.
> Graduacja idzie dopiero w linii `1.5.0-alpha`: `MotionScheme` od alpha15 (25.02.2026),
> `MaterialExpressiveTheme` / `expressiveLightColorScheme` od alpha19 (06.05.2026), `FloatingToolbar`
> od alpha22. Linia 1.5.0 na 12.08.2026 wciąż jest w alpha (`1.5.0-alpha26`).

### Co to znaczy dla cross-platform buildera

**Strategia M3E na Androidzie + HIG na iOS jest teraz wsparta nauką**, nie kompromisem. Google ma twarde dane uzasadniające expressive design. Apple ma Liquid Glass jako brand-driven moat. **Hybrydowa unifikacja ("ten sam design na obu") tracona w obu kierunkach** — bo każda platforma optymalizuje pod inny vector (Apple = premium feel + spatial computing, Google = mierzalna użyteczność).

**Kontekst fragmentacji:** M3E istnieje głównie w apkach Google i na Pixelach (większość OEM nadal używa starszych warstw Material). Liquid Glass jest obowiązkowy dla wszystkich iOS devów po rekompilacji Xcode 26.

---

## Tabela porównawcza (cheat sheet)

| Element | iOS HIG | Material 3 |
|---------|---------|------------|
| **Główna nawigacja** | Tab bar dolny, max 5 zakładek | Bottom navigation bar lub navigation rail (tablet) |
| **Sekundarna nawigacja** | Push (slide right→left), modal (slide up) | Drawer (hamburger) lub destinations w nav bar |
| **Back button** | Górny lewy `< Title`, swipe-from-edge | Hardware back + górny lewy arrow |
| **Primary action** | System blue button, plain | Filled button (M3) lub Floating Action Button (FAB) |
| **Secondary action** | Plain blue text button | Outlined button |
| **Destructive** | Red text, czasami w Action Sheet | Red filled lub red outlined |
| **Alerts (krytyczne)** | UIAlertController — wycentrowany, native | Material Dialog — może być customizowany |
| **Modal sheets** | UISheetPresentationController — drag handle, detents | Bottom Sheet — drag handle, modal/standard |
| **Form pickers** | Native picker (wheel, modal) | Dropdown, dialog z radio |
| **Switch/Toggle** | iOS Switch (zielony/szary) | Material Switch (track + thumb, kolor primary) |
| **Loading** | UIActivityIndicator (spinner) | CircularProgressIndicator |
| **Pull-to-refresh** | UIRefreshControl (gumkowy spinner) | SwipeRefreshLayout (Material spinner) |
| **Long press** | Context menu (preview + actions, iOS 13+) | Context menu lub Material dropdown |
| **Typography** | SF Pro / SF Display / SF Mono | Roboto / Roboto Flex |
| **Touch target** | 44pt minimum | 48dp minimum |
| **Animations** | Spring physics, easing-out, ~250ms | Material motion, 200-300ms, emphasized easing |
| **Haptics** | UIImpactFeedbackGenerator (light/medium/heavy) | `View.performHapticFeedback()` + `HapticFeedbackConstants` (od API 3); bogatsze efekty przez `VibrationEffect` (API 26+), predefiniowane `EFFECT_CLICK`/`EFFECT_TICK` od Android 10 (API 29, wymaga `VIBRATE`); w Compose `LocalHapticFeedback` |
| **Status bar** | Część designu, transparent overlay | Często solid color matching app bar |

---

## Hybrid vs platform-specific — research jasno wskazuje

Cross-platform devowie często stoją przed wyborem: jeden design system na obie platformy (efektywność), czy dwa systemy (jakość). Research mówi jednoznacznie — **platform-specific wygrywa**.

**Dlaczego unifikacja zawodzi:**
- iOS-style hamburger menu na iOS = anti-pattern. Użytkownicy iOS oczekują tab bara
- Material FAB na iOS = obco. Apple promuje akcje w nav bar lub w content
- iOS-style nav bar na Androidzie = brak Material elevation, brak ripple, "płaska" apka

**Dlaczego platform-specific wygrywa:**
- Użytkownicy budują model mentalny per platforma (iOS user wie gdzie szukać back button)
- Patterns są testowane przez miliardy interakcji — nie wymyślaj koła
- Native widgets dostają darmowe accessibility (Dynamic Type, TalkBack, Reduce Motion)

**Kompromis świadomy — tylko gdy brand to priority.** Linear Mobile, Wellspoken, Things 3 mają silny brand i częściowo łamią konwencje — ale ROBIĄ TO ŚWIADOMIE i tylko w warstwie wizualnej (kolor, typografia), nie w warstwie patternów (nawigacja, gestures, alerts).

---

## Decision framework

| Sytuacja | Rekomendacja |
|----------|--------------|
| Aplikacja produktowa (utility, productivity) | Platform-specific patterns end-to-end |
| Aplikacja konsumencka z silnym brandem | Brand colors + brand typography, ale platform patterns dla nawigacji/alerts |
| Aplikacja korporacyjna B2B | Platform-specific (zwiększa przyswajalność dla tech-savvy users) |
| Game / kreatywna apka | Custom design może łamać konwencje, ale akceptuj review push-back |
| MVP / prototyp | Wybierz JEDNĄ platformę i zrób ją dobrze, zamiast dwóch średnio |

**Reguła 80/20:** 80% interfejsu = platform-specific. 20% = brand layer (kolory akcentowe, hero typography, custom illustrations).

---

## `Platform.select()` w React Native — jak używać

React Native daje brama do natywności przez `Platform.select()`, `Platform.OS` i `.ios.tsx` / `.android.tsx` resolverów.

### Wzorzec 1: różne komponenty per platforma

```tsx
// navigation.tsx
import { Platform } from "react-native";
import { IosTabBar } from "./ios-tab-bar";
import { AndroidNavBar } from "./android-nav-bar";

export const Navigation = Platform.select({
  ios: IosTabBar,
  android: AndroidNavBar,
})!;
```

### Wzorzec 2: różne style per platforma

```tsx
import { Platform, View } from "react-native";

<View
  className={Platform.select({
    ios: "pt-safe shadow-md rounded-2xl",
    android: "pt-2 shadow-md rounded-xl",
  })}
/>
```

### Wzorzec 3: platform extensions w nazwie pliku

```
// Metro automatycznie wybiera plik per platforma
button.ios.tsx
button.android.tsx
button.tsx          // fallback (np. dla web)

import { Button } from "./button"; // resolver wybiera odpowiedni
```

### Kiedy `Platform.select()` ma sens

- Nawigacja (tab bar vs drawer, back button conventions)
- Animacje (spring vs Material easing)
- Haptyki (różne API)
- Cienie, gdy wartość ma się różnić per platforma (klasy `shadow-*` kompilują się do `boxShadow`, który rysuje się na obu)
- Form controls (native picker vs Material dropdown)

### Kiedy NIE używać

- Kolory semantyczne — definiuj raz, używaj wszędzie
- Spacing, type scale — chyba że świadomie różnicujesz
- Logika biznesowa — to ZAWSZE współdzielone

---

## Expo UI — SwiftUI primitives w React Native (2026)

Oficjalny moduł od zespołu Expo (Brent Vatne) eksponuje **natywne komponenty SwiftUI bezpośrednio w RN**. To zmienia kalkulację cross-platform: dotąd custom screen replikujący iOS-native pattern w RN = setki linii (np. NavigationSplitView na iPadzie = ~1000 linii w RN, "design system za darmo" w SwiftUI). Z Expo UI dostajesz natywne `Form`, `List`, picker, sheet detents i **Liquid Glass modifier out of the box** — bez przepisywania apki.

**Status (SDK 56+ — Expo UI jest STABILNE, production-ready):**
- ✅ **iOS** — `@expo/ui/swift-ui` (SwiftUI); też tvOS
- ✅ **Android** — `@expo/ui/jetpack-compose` (Jetpack Compose). **Nie potrzebujesz już osobnego komponentu** — od SDK 56 jest warstwa uniwersalna `@expo/ui`: jeden import, który na iOS renderuje wersję SwiftUI, a na Androidzie Compose (`Host`, `Row`, `Column`, `ScrollView`, komponenty tekstowe, kontrolki `Switch` / `Slider`, sheety)
- 🟡 **Web** — wspierany, ale **eksperymentalnie** („not at the same quality bar as native yet") — weryfikuj wizualnie
- ✅ **Expo Go** — Expo UI jest bundlowane w Expo Go i w domyślnym szablonie `create-expo-app`
- Komponenty spoza warstwy uniwersalnej (drop-iny za popularne pakiety) żyją pod `@expo/ui/community/*`

**Kiedy używać:**
- Form-heavy ekrany (settings, profile, preferences) — natywny SwiftUI Form == "natywny feel" za darmo
- Ekrany z iOS-only patternami (NavigationSplitView dla iPada, sheet detents)
- Kiedy chcesz Liquid Glass świadomie i bezpiecznie (oficjalny modifier, fallback przez Reduce Transparency)

**Kiedy NIE używać:**
- Custom design language, w którym natywne defaults (SwiftUI / Compose) Ci ciążą
- Świadoma platform-divergence, gdy chcesz jeden identyczny wygląd brandowy na obu platformach — warstwa uniwersalna renderuje natywnie per platforma, więc iOS i Android BĘDĄ się różnić

**Inne biblioteki w ekosystemie 2026** (copy-paste shadcn-style w RN):
- **NativeMotion** (164↑) — animowane komponenty, Reanimated 3 + RNGH, **świadomie bez NativeWind**
- **BNA UI** (227↑) — shadcn-inspired
- **React Native Reusables** (104↑) — kanoniczny port shadcn/ui do RN, dziś pod organizacją **founded-labs** (`github.com/founded-labs/react-native-reusables`, ~8.6k⭐; stare linki do `mrzachnugent/*` nie są już kanoniczne). Komponenty copy-paste przez CLI, stylowanie do wyboru: **NativeWind lub Uniwind** (w tym stosie Uniwind)
- **Neobrutalist for RN** (288↑) — neobrutalist style

**Nie myl z tym zestawem:** **GLOW UI** = pakiet `react-native-animated-glow` (v3.1.0) — to **nie** biblioteka komponentów shadcn-style, tylko biblioteka jednego efektu wizualnego (animowany glow/neon na Skia + Reanimated; peery: `@shopify/react-native-skia`, `react-native-reanimated >=3`, RNGH). Instalujesz ją jako zwykłą zależność, nie kopiujesz kodu przez CLI. Uwaga: domena `reactnativeglow.com` z package.json nie działa (parking) — dokumentacja jest w README na npm/GitHubie (`realimposter/react-native-animated-glow`).

Trend: zamiast instalować dependency, **kopiujesz kod komponentu** i dostajesz pełną kontrolę. Sprawdź compatybilność z aktualnym stabilnym SDK Expo w projekcie.

---

## Najczęstsze błędy cross-platform (anti-patterns)

### 🔴 Tab bar = akcje zamiast nawigacji

**Najczęściej mylona reguła HIG.** Tab bar służy **WYŁĄCZNIE do nawigacji** między głównymi sekcjami apki — nigdy do akcji (dodaj, udostępnij, filtruj).

```tsx
// ZŁE — "Dodaj" w tab barze to akcja, nie nawigacja
<Tabs>
  <Tab name="Home" />
  <Tab name="Add" /> {/* ← anti-pattern */}
  <Tab name="Profile" />
</Tabs>
```

**Praktyczny test:**
- Tap przenosi do innego ekranu/sekcji = **tab bar OK**
- Tap wywołuje akcję w bieżącym kontekście = **toolbar / inline button**, NIE tab bar

**iOS 26 — HIG podtrzymuje: tab bar = wyłącznie nawigacja, nigdy akcje.** Apple na WWDC25 ("Get to know the new design system") nie promuje FAB jako oficjalnego wzorca iOS — FAB pozostaje Material-specific. Zamiast tego iOS 26 wprowadza dwa nowe natywne wzorce nawigacyjne (nie akcyjne):

- **Search tab role** — wydzielona zakładka wyszukiwania po trailing stronie tab bara (osobna rola, nie zwykły tab), domyślna w wielu natywnych apkach Apple
- **Tab bar accessory view** — widok nad tab barem (np. mini-player, kontekstowy pasek), który minimalizuje się przy scrollu razem z tab barem

**Akcję (dodaj, udostępnij, filtruj) trzymaj w toolbarze nawigacyjnym lub w treści ekranu** — nie w tab barze i nie jako FAB. To spójne z regułą HIG "tabs = nawigacja, nie akcje" z sekcji wyżej.

```tsx
// DOBRZE iOS 26 — akcja w toolbarze/content, tab bar tylko nawigacja
<View>
  <Tabs>{/* tylko nawigacja, ew. dedykowany Search tab */}</Tabs>
  {/* akcja "Dodaj" jako header button lub inline w treści ekranu — NIE FAB */}
</View>
```

→ Patrz [[resources/navigation-patterns.md]] dla placement akcji i konfliktów z tab barem.

---

### 🔴 Hamburger menu na iOS

```tsx
// ZŁE — iOS user nie spodziewa się hamburgera
<Header>
  <Pressable onPress={openDrawer}>
    <MenuIcon /> {/* hamburger */}
  </Pressable>
</Header>
```

**Fix:** Tab bar dolny (max 5 zakładek), albo `> More` jako 5-ta zakładka dla overflow.

### 🔴 Material FAB na iOS

```tsx
// ZŁE — FAB to Material pattern, na iOS wygląda obco
<View className="absolute bottom-4 right-4">
  <Pressable className="w-14 h-14 rounded-full bg-primary shadow-xl">
    <PlusIcon />
  </Pressable>
</View>
```

**Fix iOS:** primary action w nav bar (`+` w prawym górnym), albo button w content.

### 🔴 Identyczna nawigacja na obu platformach

```tsx
// ZŁE — wymuszony tab bar wszędzie
<Tabs>
  <Tab name="Home" />
  <Tab name="Search" />
  <Tab name="Settings" />
</Tabs>
```

**Fix:** użyj `@react-navigation/bottom-tabs` ale konfiguruj per platforma (iOS = native blur, Android = elevation + ripple).

### 🔴 Ten sam Switch/Toggle wizualnie

iOS Switch (zielony, mniejszy, pełen track) i Material Switch (większy, track + thumb, kolor primary) wyglądają fundamentalnie inaczej. Custom toggle, który nie pasuje do żadnego, daje "obco" feel na obu platformach.

**Fix:** użyj `Switch` z `react-native` — automatycznie renderuje native per platforma.

### 🔴 iOS push transition na Androidzie

```tsx
// ZŁE — slide right-to-left to iOS convention
<Stack.Screen options={{ animation: "slide_from_right" }} />
```

Android oczekuje `slide_from_bottom` lub `fade` dla większości push transitions.

**Fix:** `Platform.select` w nawigatorze.

### 🔴 Ignorowanie safe area i Dynamic Island

```tsx
// ZŁE — content pod notchem
<View className="h-screen bg-white">
  <Text>Hello</Text>
</View>
```

**Fix:** `useSafeAreaInsets` z `react-native-safe-area-context`, albo `SafeAreaView` (z biblioteki, NIE wbudowany — nie obsługuje Dynamic Island).

---

## Case studies — gdy brand jest priority

### Linear Mobile

**Co robią dobrze:** silny brand (typography, kolor accent purple), ALE konwencje nawigacji są platform-specific. Tab bar dolny iOS, drawer Android. Modal sheets respektują iOS detents API.

**Lekcja:** brand layer (typography, kolor, ikony) może być unified. Pattern layer (nawigacja, gestures, alerts) — platform-specific.

### Things 3 (iOS only)

**Co robią dobrze:** wzorcowe użycie iOS HIG. Magic Plus button (custom), ale opiera się na native gestures (drag, long press, swipe). Haptyki tylko na świadome akcje (zaznaczenie zadania, dodanie). Dynamic Type wsparte na 100%.

**Lekcja:** custom UI tylko gdy native ma realne braki. Reszta = system widgets.

### Wellspoken

**Co robią dobrze:** brand color jako akcent, NIE jako system blue. iOS-style sheet presentations. Custom typography (custom font na hero, SF Pro na body).

**Lekcja:** brand color ≠ semantic action color. Możesz mieć burgundowy brand i niebieski "Continue" — to jest OK.

### Arc Search — platform-native specifics (Christine Rode talk, Config London)

> *Single talk credible source — Christine Rode, designerka Arc Search z track record Facebook + WhatsApp + Deliveroo. Konkretne przykłady, nie uniwersalna zasada.*

Christine Rode na Config London (Figma's annual conference) pokazała jak Arc Search **różnicuje konkretne komponenty per platforma**, mimo że logika jest wspólna. WhatsApp wymieniony jako gold standard "ten sam produkt, natywny per platforma".

**Konkretne decyzje z Arc Search:**

| Komponent | iOS | Android |
|-----------|-----|---------|
| **Voice search overlay** | Gradient + blur (premium feel) | Flat overlapping colors (Material flat) |
| **Toggle / Switch** | Prosty iOS Switch | Material fluid squish shapes (deformacja przy interakcji) |
| **Tab switcher** | Mirror native iOS app switcher | Mirror native Android app switcher |

**Ogólna reguła wyciągnięta z prezentacji (potwierdzona przez Apple HIG i Material 3):**

| Wymiar | iOS | Android |
|--------|-----|---------|
| **Blury** | Heavy, częste | Rzadkie, delikatne |
| **Drop shadows** | Duże, miękkie | Tylko dla floating elements |
| **Zaokrąglenia** | Rounded rectangles standardowo | Większa swoboda, square OK |
| **Kolory** | Gradient + transparency | Solid colors |

**Lekcja:** "platform-native" to nie tylko nawigacja — to **decyzje wizualne per komponent**. Twój przycisk voice search może wyglądać inaczej na każdej platformie i to jest właściwe podejście, nie kompromis.

---

## React Native — file structure suggestion

```
components/
├── primitives/              # Platform-agnostic atoms
│   ├── text.tsx
│   ├── view.tsx
│   └── pressable.tsx
├── platform/                # Platform-specific
│   ├── tab-bar.ios.tsx
│   ├── tab-bar.android.tsx
│   ├── back-button.ios.tsx
│   └── back-button.android.tsx
└── ui/                      # Brand layer (cross-platform)
    ├── button.tsx
    ├── card.tsx
    └── input.tsx
```

---

## Checklist platform-aware

- [ ] Nawigacja używa platform-specific patternu (tab bar iOS, bottom nav lub drawer Android)
- [ ] Back button respektuje platform conventions (iOS — swipe + nav bar back; Android — hardware + nav bar)
- [ ] Alerts używają native — `Alert` z RN, nie custom modal
- [ ] Form controls (Switch, Picker, Slider, Menu) idą z `@expo/ui` (skill `expo:expo-ui`) — wbudowane RN lub platform-mimicking libs tylko gdy `@expo/ui` nie ma odpowiednika
- [ ] Animacje w nawigacji są per platforma (`Platform.select`)
- [ ] Cienie przez klasy `shadow-*` albo `boxShadow`, które działają na obu platformach
- [ ] Żaden ekran nie zależy od blokady orientacji ani stałej proporcji (iOS 27: zmienny rozmiar okna)
- [ ] Haptyki świadomie — tylko świadome akcje, nie każdy tap
- [ ] Touch target 44pt iOS / 48dp Android (recommended 48-56)
- [ ] Safe area i Dynamic Island traktowane jako część designu
- [ ] Brand layer (kolor, typography) może być unified — patterns NIE

---

## Powiązane

- [[resources/typography.md]] — SF Pro vs Roboto, Dynamic Type
- [[resources/spacing-grid.md]] — safe areas, touch targets
- [[resources/color-darkmode.md]] — iOS Dynamic Color vs Material You
- [[resources/ai-pitfalls.md]] — mieszanie konwencji platformowych jako AI signature

*Źródła: Apple Human Interface Guidelines (developer.apple.com/design/human-interface-guidelines), Apple WWDC25 sesje "Meet Liquid Glass" + "Get to know the new design system" (oficjalne specs), Material Design 3 (m3.material.io), Google Android Developers M3 Expressive prezentacja (46 badań / 18K uczestników — peer-reviewed dataset), Christine Rode @ Config London (Figma annual conference), wiki/ios-hig, wiki/material-design-3, wiki/react-native-expo. Ostatni update: 2026-11-05.*
