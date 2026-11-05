# App icon & splash — pierwsza interakcja

App icon = jedna z 30 ikon na ekranie home. Splash = pierwsza klatka po tap. Jeśli te dwa elementy są przeciętne, reszta apki musi pracować dwa razy ciężej żeby naprawić wrażenie.

---

## App icon — pryncypia

### 1. Recognizable at 16px

**Test sylwetki:** zrenderuj ikonę 16x16 w grayscale. Czy dalej rozpoznajesz brand?

- **TAK** — sylwetka jest unikalna, focal point widoczny
- **NIE** — za dużo detali, generic gradient, brak focal point

**Dlaczego 16px:** spotlight search, notification grouping, app switcher na Androidzie low-density. Jeśli sylwetka działa w 16px, działa wszędzie.

### 2. No text — z wyjątkami

**Reguła:** ikona to symbol, nie billboard. 1024×1024 marketing asset to nie miejsce na slogan.

**Wyjątki gdzie tekst działa:**

| Brand | Tekst | Dlaczego działa |
|-------|-------|-----------------|
| Slack | "S" hashtag-style | Wordmark = ich logo, nie dodatkowy element |
| Tinder | Płomień + "tinder" | Niski profil, integralny z mark |
| Trello | "T" w boxie | Single letter, wzmocnione kolorem |

**Anti-wzorzec:** "MyApp" napisane małą czcionką pod logo. Nieczytelne w 60px (home screen na iPhonie SE), wygląda tanio.

### 3. Single focal point

Oko ma znaleźć "co to" w 1 sekundę. Wielo-elementowe ikony (3 obiekty + tło + gradient + tekst) → cognitive overload.

**Test:** pokaż ikonę komuś na 1 sekundę, schowaj. Co zapamiętali? Jeśli "kolor" lub "coś niebieskiego" — nie ma focal point.

### 4. Iconic, not photographic

Płaski symbol > zdjęcie produktu > realistyczna ilustracja.

**Powód:** photo na 60px traci szczegóły, wygląda mętnie. Płaski symbol skaluje się idealnie. Wszystkie premium apki (Things, Linear, Bear, Apollo) używają płaskich, abstrakcyjnych mark.

**Trend 2026:** subtle gradient + 1 element + soft shadow = premium feel. Zamiast realistyczny photo.

### 5. Scalable design

Wektor (Figma, Sketch, Affinity Designer) — nie raster. Test na każdym rozmiarze:

- 1024 (App Store)
- 180 (iPhone 3x home)
- 120 (iPhone 2x)
- 60 (iPhone settings)
- 40 (notifications)

Detal który ginie w 40px — usuń. Lepiej prosty, działający na każdym rozmiarze, niż "skomplikowany ale piękny w 1024px".

### 6. Brand consistency

Paleta kolorów ikony = dominująca paleta apki. User otwiera ikonę → splash → home. Wszystko to powinno wyglądać jak jedna myśl.

**Apple: "continuity from icon to splash to home screen"** — Linear robi to wzorcowo (purple gradient continuity).

---

## iOS specific

### Required sizes (rendered)

System wygeneruje wszystkie rozmiary z 1024×1024 source przez konfigurację `expo.icon` / `ios.icon` w `app.json` (Expo generuje Asset Catalog automatycznie przy buildzie). Source powinien być:

- 1024×1024px PNG
- bez alpha channel (App Store rejection)
- bez rounded corners (system applies mask)
- bez drop shadow (system applies)
- bez glossy effect (już od iOS 7+)

### iOS 18+ icon variants

iOS 18 wprowadziło 3 warianty wymagane dla premium feel:

| Wariant | Kiedy renderowane | Design challenge |
|---------|-------------------|------------------|
| **Light** | Default home screen, Light mode | Standard ikona |
| **Dark** | Dark mode home screen | NIE inwertuj kolory — manualnie zaprojektuj. Black/dark background, jasne details |
| **Tinted** | Tinted mode (Settings → Display) | System aplikuje user color tint. Design musi działać w monochrome — sylwetka, brak gradientów, light/transparent base |

**Praktyka:** dark = 90% apek robi źle (auto-invert wygląda tanio). Manualnie zaprojektowany dark daje feel premium.

**Tinted:** najtrudniejszy. Test: zrender ikonę w 100% white na transparentnym tle. Działa? OK. Nie działa? Tinted wariant będzie rozmazany.

### iOS 26/27 Liquid Glass — obowiązkowe nowe zasady ikon

Apple na WWDC25 (sesja "Design app icons for Liquid Glass", 312K views, plus oficjalna dokumentacja) opublikował **zaktualizowane zasady ikonowe wymagane dla iOS 26**. Zasady obowiązują dalej; **iOS 27 (WWDC26)** poszedł krok dalej — ikony dostały osobne warstwy Liquid Glass (ostrzejszy, lepiej zdefiniowany render), a użytkownik wybiera wygląd Clear/Tinted w customizacji Home Screen.

**Pobieraj najnowsze Apple Design Resources** — design kits Figma/Sketch dla iOS/iPadOS/macOS **27**, wydane 23.06.2026 (aktualizacje Liquid Glass, rozszerzone komponenty i stany, nazewnictwo zbieżne z kodem, lepszy resizing). Starsze templates dla 26 nie mają tych zmian.

**Reguły (oficjalne, nie sugestie):**

| Reguła | Co robić | Co usunąć |
|--------|----------|-----------|
| **Layering** | Minimum tło + 1 front layer. Więcej warstw = bogatszy efekt material | Płaskie pojedyncze warstwy |
| **Statyczne efekty** | Pozwól materiałowi LG je dodać dynamicznie | **Drop shadows, bevele, perspektywa 3D** — Apple ostrzega: dublują efekt material |
| **Tło** | **Soft gradient light-to-dark** | Czyste białe lub czyste czarne tło |
| **Krawędzie** | Zaokrąglone — lepiej przewodzą światło | Cienkie linie i ostre krawędzie |
| **Forma** | Uproszczone kształty | Skomplikowane ilustracje, dużo małych detali |

**Dlaczego te reguły:** material Liquid Glass sam dodaje dynamiczne efekty (refrakcja światła, shadow, podświetlenie od dotyku, paralax od ruchu urządzenia). Statyczne efekty na ikonie **dublują się z dynamicznymi systemowymi** — wynik wygląda przeładowane i "off". To dokładnie odwrotny problem do iOS 7 flat era.

**Praktyczne workflow:**

1. Pobierz oficjalny template Apple z developer.apple.com (Figma lub Sketch) — **kity dla 27, wydane 23.06.2026**
2. Zaprojektuj **bez statycznych efektów** — material doda je przy renderowaniu
3. Test w **Icon Composer** — darmowej apce Apple dostarczanej z Xcode (od Xcode 26; aktualna wersja wymaga macOS Tahoe 26.4+). Jeden plik warstwowy, live preview trybów renderowania (Default / Dark / Mono, z wariantami Clear i Tinted) i przełączanie iPhone / iPad / Mac / Watch. Gotowy plik `.icon` wrzucasz do projektu Xcode — sam generuje wymagane rozmiary; da się też wyeksportować spłaszczoną wersję pod marketing. Nazwa „Liquid Glass simulator" nie istnieje jako narzędzie Apple
4. Audyt: ikona wygląda OK statycznie? Material doda właściwą głębię. Wygląda już "głęboko" statycznie? **Usuń efekty** — będzie podwójnie głęboka po renderze

**Wpływ na istniejące apki:** po rekompilacji z Xcode 26 stare ikony **nadal działają**, ale **nie zyskują pełnego efektu LG**. Jeśli adoptujesz Liquid Glass jako design language (patrz [[platform-conventions.md]] sekcja iOS 26), ikona wymaga redesignu pod nowe templates.

### iOS tools

- **`expo.icon` / `ios.icon` w `app.json`** — konfiguracja natywna (light/dark/tinted), bez dodatkowego config pluginu
- **Bakery** (Mac app) — visual editor wariantów iOS 18
- **Icon Set Creator** (Mac App Store) — exporty
- **Figma Apple icon template** — community plugin

```json
// app.json (Expo)
{
  "expo": {
    "icon": "./assets/icon.png",
    "ios": {
      "icon": {
        "light": "./assets/icon-light.png",
        "dark": "./assets/icon-dark.png",
        "tinted": "./assets/icon-tinted.png"
      }
    }
  }
}
```

---

## Android specific

### Adaptive icons (Android 8+)

Android masks ikonę do shape ustawionej przez user / OEM (Pixel = circle, Samsung = squircle, OnePlus = teardrop). Ikona musi mieć **2 warstwy:**

| Layer | Rozmiar | Co zawiera |
|-------|---------|------------|
| **Foreground** | 108×108 dp (centralne 72×72 dp visible after mask) | Logo, mark — **safe zone = 66dp central** |
| **Background** | 108×108 dp (fills shape) | Solid color, gradient, lub simple pattern |

**Anti-pattern:** logo w foreground extending to edges → system mask cropuje krawędzie → logo wygląda obcięte na Pixel circle mask.

**Safe zone:** trzymaj wszystko ważne w centralnym 66dp circle of foreground layer. Reszta = decoration acceptable to crop.

### Monochrome (Android 13+)

Android 13+ "themed icons" — system rendering w monochrome user-tint. Pełny zestaw to **3 warstwy:**

| Layer | Cel |
|-------|-----|
| Foreground | Color version |
| Background | Color version |
| Monochrome | **Single color silhouette** dla theme system |

> **Warstwa `monochrome` jest formalnie opcjonalna.** Od **Android 16 QPR 2** system sam generuje themed icon dla aplikacji, które własnej warstwy nie dostarczają — ale wynik jest wygenerowany automatycznie i nie masz nad nim kontroli. Własny `monochrome` to jedyna droga do przewidywalnego wyglądu **i jedyna droga do themed icon na Android 13–16 (przed QPR 2)**. Themed icon i tak się nie pokaże, jeśli użytkownik nie włączy themed app icons albo launcher ich nie wspiera.

```json
// app.json
{
  "expo": {
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon-fg.png",
        "backgroundColor": "#0f172a",
        "monochromeImage": "./assets/icon-mono.png"
      }
    }
  }
}
```

### Tools

- **Android Asset Studio** (romannurik.github.io/AndroidAssetStudio) — preview adaptive icon w shape masks
- **Material Icon Generator** w Android Studio
- **Figma plugin "Adaptive Icon"** — Foreground + Background preview

### Legacy fallback (Android 7-)

PNG icons w mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi sizes. Expo handle to automatycznie z `icon` source.

---

## Common mistakes

- Same icon as competitor → user confusion. Research category top 20
- Detail invisible at 60px → smudge. Simplify
- Cropped logo by Android mask → trzymaj się safe zone 66dp central
- Photorealistic 3D → dated (skeuomorphism). Flat lub soft shadow
- Generic AI-gradient → looks like every 2024 startup
- Pure white/black background → disappears na home screen
- Identical to favicon → mobile icon ma inne wymagania

---

## App Store / Play Store optimization

**Pierwsza impresja = 60% decyzji w 7 sekund** (Apple's own UX research, Google Play data). Icon + screenshot 1 = 90% wpływu.

**A/B testing:**

| Platform | Tool |
|----------|------|
| iOS | Apple App Store Connect — Product Page Optimization (do 3 wariantów, traffic split) |
| Android | Google Play Console — Store Listing Experiments |

**Seasonal variants** (Apollo dla Reddit, Halide camera): subtle zmiana per holiday/event. Buduje engagement, ale drogie utrzymanie.

**iOS 10.3+ alternate icons** API: user może zmienić icon w app settings. Nice-to-have feature dla premium apek.

W Expo używaj `expo-alternate-app-icons` (latest 8.0.0, peer `expo >= 53`). Config plugin w `app.json`:

```json
["expo-alternate-app-icons", [
  {
    "name": "IconA",
    "ios": "./assets/icon-a.png",
    "android": {
      "foregroundImage": "./assets/icon-a-foreground.png",
      "backgroundColor": "#ffffff"
    }
  }
]]
```

```tsx
import {
  setAlternateAppIcon,
  getAppIconName,
  resetAppIcon,
  supportsAlternateIcons,
} from 'expo-alternate-app-icons';

if (supportsAlternateIcons) {
  await setAlternateAppIcon('IconA');
}
```

**Wymaga** `npx expo install expo-alternate-app-icons` + `npx expo prebuild --clean`; **nie działa w Expo Go**.

> ⚠️ **Nie używaj `react-native-dynamic-app-icon`** — pakiet stoi na 1.1.0 z 2019 (peer `react-native >= 0.41.2`), bez config plugina Expo i bez New Architecture. W projekcie Expo nie zadziała bez ręcznego patchowania natywnych projektów.

---

## Splash screen — pryncypia

### Cel splash

**NIE jest:** branding showcase, marketing moment, animation playground.

**JEST:** smooth transition while app loads. Tap → splash → content. Im krótszy, tym lepszy.

### Duration

| Czas | Akcja |
|------|-------|
| **<1s** | Idealne. User nie zauważa "loadingu" |
| **1-2s** | Akceptowalne. Bez loading indicator |
| **2-3s** | Show subtle progress. Inaczej user myśli że apka się zawiesiła |
| **>3s** | Problem. Dlaczego load tak długo? Optimize fonts, code splitting, lazy initial screen |

**Reguła Apple:** splash w app review > 3s = rejection (lub conditional approval).

### Design rules

- **Logo only, centered.** Bez wersji, bez slogana, bez "Loading..."
- **Brand color background** — kontynuacja z app icon
- **Match home screen entry** — co user zobaczy po splash, splash powinien tonalnie pasować
- **Match dark/light mode** — system mode → odpowiedni splash variant

**Anti-patterns:**

- Loading bar — sugeruje że apka jest slow
- Marketing copy ("Welcome to MyApp") — cheap, trash UX
- Version number — irrelevant, user nie potrzebuje
- Different style than app — splash pomarańczowy + app niebieski = jarring

---

## expo-splash-screen — implementation

```ts
// app.json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen",
        {
          "image": "./assets/splash-icon.png",
          "imageWidth": 200,
          "backgroundColor": "#0f172a",
          "dark": {
            "image": "./assets/splash-icon-dark.png",
            "backgroundColor": "#020617"
          }
        }
      ]
    ]
  }
}
```

**Image guidelines:**

- `image` to ikona albo logo, nie pełny ekran: 1024×1024, przezroczyste tło. Szerokość na ekranie ustawia `imageWidth` (domyślnie 100).
- `resizeMode` skaluje obraz w kontenerze o szerokości `imageWidth`: `contain`, `cover` albo `native`.
- Pełnoekranowy obraz działa tylko na iOS przez `enableFullScreenImage_legacy`, opcję przejściową, którą Expo zapowiada do usunięcia. Nie buduj na niej nowego splasha.
- Od SDK 52 obowiązuje aktualne Android Splash API, więc Expo Go i development buildy nie odtwarzają splasha w pełni. Sprawdzasz go na buildzie release.

### Programmatic hide

Splash by default hides after JS bundle loaded. Ale **Twoje data nie są jeszcze ready** — fonty, initial query, auth check.

Pattern: `preventAutoHideAsync` → load critical resources → `hide`.

```tsx
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

// Prevent auto-hide TYLKO RAZ przy app load
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('./assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('./assets/fonts/Inter-SemiBold.ttf'),
  });

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Load auth, prefetch critical data
        await checkAuthState();
        await prefetchInitialData();
      } catch (error) {
        console.error('Splash prep failed', error);
      } finally {
        setIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (fontsLoaded && isReady) {
      SplashScreen.hide();
    }
  }, [fontsLoaded, isReady]);

  if (!fontsLoaded || !isReady) {
    return null; // Splash still showing
  }

  return <RootNavigator />;
}
```

**Pamiętaj:** `preventAutoHideAsync` ZAWSZE z `hide` w `finally`. Inaczej user trapped na splash forever przy error. `hideAsync` zostaje tylko dla zgodności wstecznej.

---

## Animated splash

**Kiedy YES:**
- Brand commitment (Wellspoken, Headspace, Linear)
- Continuity z app icon (icon zoom out → splash → home)
- Wartość >>> koszt (animacja musi być excellent, nie OK)

**Kiedy NO:**
- Twoja apka ma 5 minut content i splash trwa 3s — overinvestment
- Zwykle splash > 1s = problem, nie feature

### Reanimated entry

Pattern: `useSharedValue` dla scale (0.8 → 1.05 → 1) + opacity (0 → 1), `withSequence` w `useEffect`. Logo uses `Animated.Image` z `useAnimatedStyle` mapping shared values na `transform: scale` i `opacity`. Total duration 600-900ms, callback w finalnym `withTiming` dispatchuje `onAnimationComplete` i hide splash.

### Lottie

Dla complex animation (Headspace flowing shapes). `lottie-react-native` package. Trzymaj animation 800-1200ms. Powyżej = irritating na cold start.

---

## Splash anti-patterns

- 5s branded video → uninstall przed app load
- Loading bar 0-100% → sugeruje "slow app"
- Wersja apki / build number → nie potrzebne
- Marketing copy ("Welcome to MyApp") → cheap
- Animowana 1.5s przy każdym cold start → po 3 razach denerwuje
- Splash z innym layoutem niż home → jarring transition
- Audio na splash → **NIGDY** (głośnik w autobusie = self-trauma)

---

## Premium examples

- **Things 3** — minimal logo, splash <500ms
- **Linear** — gradient continuity icon → splash → home (same purple, same direction)
- **Apollo** — subtle bounce 800ms, tactile feel
- **Bear** — same silhouette icon i splash, perfect continuity
- **Headspace** — Lottie 1s, bo brand JEST animacją

---

---

## Checklist — icon + splash

### App icon

- [ ] 1024×1024 source bez alpha, bez rounded corners, bez shadow
- [ ] Test 16px sylwetka — rozpoznawalne?
- [ ] Test 60px home screen — czysty focal point?
- [ ] iOS dark variant — manualnie zaprojektowany (nie auto-invert)
- [ ] iOS tinted variant — działa w monochrome
- [ ] **iOS 26 Liquid Glass — minimum 2 warstwy, BEZ drop shadow / bevel / 3D perspektywy** (jeśli adoptujesz LG)
- [ ] **iOS 26 Liquid Glass — soft gradient tło, zaokrąglone krawędzie, uproszczona forma**
- [ ] Android adaptive: foreground + background warstwy
- [ ] Android safe zone: ważny content w 66dp central
- [ ] Android monochrome variant
- [ ] Brand color = home screen entry color
- [ ] Test w App Store category — różni się od konkurencji?

### Splash

- [ ] <1s ideally, <3s maximum
- [ ] Logo only — bez tekstu, bez wersji
- [ ] Brand color background
- [ ] Dark mode variant
- [ ] `preventAutoHideAsync` + `hide` w finally
- [ ] Match style entry screen (color, mood)
- [ ] Brak loading bar
- [ ] Brak audio
- [ ] Test cold start na low-end Android

---

## Powiązane

- `[[icons.md]]` — UI icons (różne pryncypia od app icon)
- `[[platform-conventions.md]]` — iOS vs Android visual language
- `[[typography.md]]` — font loading w splash screen flow
- `[[states-loading-empty-error.md]]` — co po splash gdy data nie loaded

---

## Źródła

- Apple HIG — App Icons (developer.apple.com/design/human-interface-guidelines/app-icons)
- Apple HIG — Launching (developer.apple.com/design/human-interface-guidelines/launching)
- Material 3 — Adaptive Icons (m3.material.io/styles/icons/designing-icons)
- Android Asset Studio (romannurik.github.io/AndroidAssetStudio)
- expo-splash-screen (docs.expo.dev/versions/latest/sdk/splash-screen)
- Expo app config — `icon` / `ios.icon` / `android.adaptiveIcon` (docs.expo.dev/versions/latest/config/app)
- iOS 18 icon variants — Apple WWDC24 sessions
- iOS 26 Liquid Glass icon rules — Apple WWDC25 "Design app icons for Liquid Glass" (312K views) + oficjalne templates Figma/Sketch na developer.apple.com
