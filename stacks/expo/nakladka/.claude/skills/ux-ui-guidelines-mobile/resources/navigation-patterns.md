# Navigation Patterns (Mobile)

Architektura nawigacji to decyzja którą podejmujesz raz, a refaktoryzacja kosztuje dni. Ten plik daje decision frameworks: bottom tabs vs drawer, stack depth, modal vs full-screen vs sheet, deep linking.

## Decyzja #1: Top-level navigation

| Wzorzec | Liczba sekcji | Platforma | Kiedy |
|---------|--------------|-----------|-------|
| **Bottom tabs** | 3-5 | iOS + Android | **Default dla 90% apek**. User trzyma kciukiem. |
| **Drawer (hamburger)** | 5-15 sekcji | Android primarily | Apki z dużą ilością sekcji (productivity, B2B) |
| **Hybrid (tabs + drawer)** | >5 sekcji | Android | 4 najczęstsze taby + "More" do drawera |
| **Stack-only (single tab)** | 1 sekcja | Both | Single-purpose apki (kalkulator, timer) |

**Reguła:** wybierasz drawer TYLKO jeśli >5 sekcji najwyższego poziomu. Drawer na iOS to anti-pattern (Apple HIG odradza), ale czasem nieunikniony przy cross-platform B2B.

---

## Bottom tabs — szczegóły

### Sweet spot: 3-5 elementów

Research-backed: 3-5 tabów to optimum użyteczności. 6+ → stuczamy się w "More" tab albo hybrid.

| Liczba tabów | Rekomendacja |
|--------------|--------------|
| 1-2 | Stack-only, nie używaj tabów |
| **3-5** | **Sweet spot** |
| 6 | Akceptowalne (ostatni tab = "More") |
| 7+ | Drawer lub hybrid |

### Iconography: filled vs outline

| Konwencja | Active | Inactive |
|-----------|--------|----------|
| **iOS** | Filled icon | Outline icon |
| **Material 3** | Filled (z pill background) | Outline |
| **Cross-platform** | Filled | Outline (działa na obu) |

**Filled active + outline inactive** = uniwersalna konwencja. Userzy intuicyjnie rozumieją.

### Labels — zawsze pokazuj

Research (NN/g, Apple HIG): icon-only tab bars **obniżają usability o ~30%**. User musi zgadywać co dany ikonka znaczy.

Wyjątek: jeśli user spędził >100h w apce, ikonki się "wgrywają" i labels stają się redundant. Ale **default = always show labels**, nawet jeśli "wygląda zaglądkowo".

### Expo Router tabs

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Home, Search, Bell, User } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#000",
        tabBarInactiveTintColor: "#888",
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Home color={color} fill={focused ? color : "transparent"} />
          ),
        }}
      />
      <Tabs.Screen name="search" options={{ title: "Search" /* ... */ }} />
      <Tabs.Screen name="notifications" options={{ title: "Bell" /* ... */ }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" /* ... */ }} />
    </Tabs>
  );
}
```

### Native tabs

Od SDK 58 `NativeTabs` z `expo-router/native-tabs` są stabilne (`expo-router/unstable-native-tabs` dotyczy SDK 54–57). Używają systemowego tab bara, więc zgodnie z zasadą „default to native first” to punkt wyjścia. JavaScript `Tabs` wyżej bierzesz, gdy projekt już stoi na tabach React Navigation, a custom tabs, gdy pasek wymaga wyglądu niemożliwego w systemowym.

```tsx
// src/app/_layout.tsx
import { NativeTabs } from "expo-router/native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gear" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

Ikona `md` na Androidzie wymaga zainstalowanego `expo-symbols`, od SDK 58 opcjonalnej zależności. Implementację prowadzi skill `expo:expo-native-ui`.

### Tab bar persistence

| Sytuacja | Hide on scroll? |
|----------|-----------------|
| Lista feed (długi scroll) | TAK — daje miejsce na content |
| Settings / form | NIE — user może chcieć szybko skoczyć indziej |
| Detail screen (push z taba) | TAK — `tabBarStyle: { display: 'none' }` w nested screen |
| Modal | NIE — modal pokrywa tab bar |

```tsx
<Stack.Screen
  name="post/[id]"
  options={{
    tabBarStyle: { display: "none" }, // hide tab bar w detail
  }}
/>
```

---

## Drawer (hamburger menu)

### Kiedy OK, kiedy NIE

**OK:**
- Android primarily (Material 3 wspiera natywnie)
- Apki z 5-15 sekcjami które user rzadko zmienia
- B2B / productivity z głębokim navigation tree
- Settings, account, secondary actions ukryte w drawerze przy hybrid pattern

**NIE:**
- Główne taski apki (user musi mieć je 1 tap od home)
- iOS jako jedyna nawigacja (anti-pattern, Apple HIG odradza)
- Apki konsumenckie (social, e-commerce, utility)

**Cytat z UX research:** "Hidden navigation = forgotten navigation". User z drawerem klika w połowie tych sekcji co z bottom tabs.

### Hybrid pattern (cross-platform)

4 najczęstsze sekcje w bottom tabs, reszta (Settings, Help, About, Premium) w drawerze dostępnym z avatara w headerze.

```tsx
// app/(tabs)/_layout.tsx z drawer button w headerze
<Tabs
  screenOptions={({ navigation }) => ({
    headerLeft: () => (
      <Pressable onPress={() => navigation.openDrawer?.()}>
        <Menu size={24} className="ml-3" colorClassName="accent-foreground" />
      </Pressable>
    ),
  })}
>
  {/* tabs */}
</Tabs>
```

---

## Stack navigation

### Hierarchy depth

| Głębokość | OK? |
|-----------|-----|
| 1-2 levels | Optimum |
| 3-4 levels | Akceptowalne (common np. Settings → Privacy → Notifications → Email) |
| 5+ levels | Anti-pattern, refaktoruj |

**Reguła:** jeśli user zgubi się "gdzie jestem", masz za głęboki stack. Breadcrumbs na mobile się nie sprawdzają — lepiej spłaszczyć hierarchię.

### Back button conventions

| Platforma | Back |
|-----------|------|
| **iOS** | Swipe gesture od lewej krawędzi + arrow w headerze |
| **Android** | Hardware back button + arrow w headerze |
| **Both** | Header arrow (Expo Router default) |

Kluczowe: NIGDY nie blokuj swipe-back na iOS bez bardzo dobrego powodu (np. multi-step form gdzie back zniszczy progress — wtedy `gestureEnabled: false` + custom back z confirm).

### Header customization

```tsx
<Stack.Screen
  name="settings"
  options={{
    title: "Settings",
    headerLargeTitle: true, // iOS large title style
    headerTransparent: false,
    headerBackButtonDisplayMode: "minimal", // bez "Back" text przy strzałce iOS (React Navigation v7+; `headerBackTitleVisible` usunięte)
  }}
/>
```

---

## Decyzja #2: Modal vs Full-screen vs Sheet

Najczęstsza pomyłka: użycie modal kiedy powinien być full-screen, albo full-screen kiedy powinien być sheet.

### Decision tree

| Typ akcji | UI |
|-----------|-----|
| Skupione zadanie 1-2 fields, wymaga focus | **Modal** (centered) |
| Wymaga dużo input (form 5+ fields), navigation | **Full-screen modal** (push) |
| Selekcja z opcji, quick action, preview | **Bottom sheet** (iOS) / **Modal bottom sheet** (Android) |
| Confirmation (yes/no) | **Native Alert** (`Alert.alert`) |
| Action menu (3-5 akcji) | **Action sheet** / **Context menu** |
| Ostrzeżenie o destrukcyjnej akcji | **Native Alert** z destructive style |

### Modal — small focused

```tsx
// app/(modal)/_layout.tsx
import { Stack } from "expo-router";

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: "modal", // iOS card modal style
        animation: "slide_from_bottom",
      }}
    >
      <Stack.Screen name="edit-profile" />
    </Stack>
  );
}
```

### Bottom sheet z detents (iOS native)

iOS supports natively `formSheet` + detents od iOS 15+. Po stronie Expo Routera propsy `sheet*` są od **SDK 51**, ale tam (react-native-screens 3.31) działają **tylko na iOS** i wyłącznie ze stringowymi detentami (`'medium' | 'large' | 'all'`). **Detenty numeryczne** (`[0.5, 1]`, `'fitToContents'`) oraz **`formSheet` na Androidzie** wymagają RNS 4.0, czyli **Expo SDK 52+**. `flex: 1` w sheecie z numerycznymi detentami działa poprawnie na iOS dopiero od **SDK 55** (i nie działa z `fitToContents` — tam podaj jawny rozmiar treści, bo sheet musi znać realną wysokość contentu).

```tsx
<Stack.Screen
  name="filter"
  options={{
    presentation: "formSheet",
    sheetAllowedDetents: [0.5, 1], // SDK 52+ (RNS 4.0) — liczby 0-1 lub 'fitToContents'; stringi 'medium'/'large' to legacy z RNS 3.x
    sheetGrabberVisible: true, // pokaż grabber u góry — iOS-only
    sheetCornerRadius: 16,
  }}
/>
```

Android obsługuje maks. 3 detenty (dotyczy SDK 52+, gdzie `formSheet` w ogóle działa na Androidzie), iOS dowolną liczbę. Detenty muszą być posortowane rosnąco.

**Kiedy `0.5` (medium) first:**
- Selekcja z listy 3-7 opcji
- Quick action (share, save, delete)
- Filter / sort options

**Kiedy `1` (large) first:**
- Form który może wymagać scroll
- Preview z możliwością edit

**Android equivalent:** `BottomSheet` z `@expo/ui` — natywny Jetpack Compose, `snapPoints` zamiast detents, jeden komponent na obie platformy (patrz skill `expo:expo-ui`). `@gorhom/bottom-sheet` dopiero jako fallback — kryteria w `sheets-modals.md`.

---

## Tab w tab — anti-pattern

NIE rób tabów wewnątrz screen który JUŻ jest w bottom tab. User ma poznawczy chaos: "który tab z których tabów?".

**Wyjątek:** segmented control (iOS) jako filtr listy, nie nawigacja:

```tsx
// OK — segmented control, nie nawigacja
<View className="flex-row gap-1 bg-muted rounded-full p-1">
  {["Wszystkie", "Aktywne", "Zakończone"].map((opt) => (
    <Pressable
      key={opt}
      onPress={() => setFilter(opt)}
      className={`flex-1 py-2 rounded-full ${
        filter === opt ? "bg-background" : ""
      }`}
    >
      <Text className="text-center text-sm">{opt}</Text>
    </Pressable>
  ))}
</View>
```

Filter zmienia DANE w liście, nie ekran. To OK.

---

## Modal w modal — anti-pattern kombinatoryjny

Modal na modal na modal = labyrinth. User zapomina jak wyjść.

**Reguła:** max 1 modal na ekranie. Jeśli z modal A potrzebujesz modal B, **wyjdź z A pierwsze, otwórz B**.

**Wyjątek:** native Alert MOŻE pojawić się nad modalem (confirmation, destructive action) — bo Alert to system UI, nie modal.

---

## Deep linking (expo-router)

Expo Router daje URL-based navigation natywnie. Każdy plik w `app/` to URL.

### Linki uniwersalne

| Platform | Mechanism | Setup |
|----------|-----------|-------|
| **iOS** | Universal Links | `apple-app-site-association` na domenie + entitlements |
| **Android** | App Links | `assetlinks.json` na domenie + `android:autoVerify="true"` |
| **Cross** | `expo-linking` | Konfig w `app.json` `scheme` + `intentFilters` |

```json
// app.json
{
  "expo": {
    "scheme": "myapp",
    "ios": {
      "associatedDomains": ["applinks:example.com"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{ "scheme": "https", "host": "example.com" }],
          "category": ["BROWSABLE", "DEFAULT"],
          "autoVerify": true
        }
      ]
    }
  }
}
```

### Link navigation w expo-router

```tsx
import { Link } from "expo-router";

<Link href="/posts/123">Otwórz post</Link>
<Link href={{ pathname: "/posts/[id]", params: { id: 123 } }}>
  Otwórz post
</Link>

// Programowo
import { router } from "expo-router";
router.push("/posts/123");
router.replace("/login");
router.back();
```

### URL state — co cache'ować

URL = source of truth dla:
- Current screen (route)
- Filters (`?filter=active`)
- Sort (`?sort=date`)
- Selected tab w segmented control (`?tab=settings`)
- Modal open state (`?modal=edit`)

```tsx
import { useLocalSearchParams, router } from "expo-router";

const { filter = "all" } = useLocalSearchParams<{ filter?: string }>();

const setFilter = (newFilter: string) => {
  router.setParams({ filter: newFilter });
};
```

URL state PRZEŻYWA app reload + share + deep link.

---

## Anti-patterns

| Anti-pattern | Dlaczego źle | Co zamiast |
|--------------|--------------|------------|
| Tab w tab (deep tab nesting) | Cognitive load | Segmented control jako filter |
| Modal w modal | Labyrinth | Wyjdź z A, otwórz B |
| Back button na home screen | User klika i exit z apki | Brak back na top-level |
| Hamburger jako jedyna nawigacja iOS | iOS users tego nie znajdują | Bottom tabs |
| Bottom tabs >6 elementów | Touch targets za małe | Hybrid lub drawer |
| Custom navigation gestures (np. swipe up to back) | Łamie iOS conventions | Native swipe back |
| Stack 5+ levels deep | User się gubi | Spłaszcz hierarchię |
| Hide tab bar randomly | Inconsistent navigation | Hide tylko na detail screens |
| Modal full-screen z X w prawym górnym + back arrow | Dwa wyjścia konfundują | Wybierz jeden pattern |
| `presentation: "transparentModal"` jako default | Trudniej dismiss | Tylko dla overlay/loading |

---

## Setup template (expo-router)

```
app/
├── _layout.tsx              # Root stack
├── index.tsx                # Splash / redirect
├── (auth)/
│   ├── _layout.tsx          # Auth stack (sign-in, sign-up)
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── (tabs)/
│   ├── _layout.tsx          # Bottom tabs
│   ├── index.tsx            # Home
│   ├── search.tsx
│   ├── notifications.tsx
│   └── profile.tsx
├── (modal)/
│   ├── _layout.tsx          # Modal stack (presentation: 'modal')
│   ├── edit-profile.tsx
│   └── filter.tsx
└── post/
    └── [id].tsx             # Detail (push z dowolnego taba)
```

```tsx
// app/_layout.tsx — root
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="(modal)"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen name="post/[id]" options={{ headerShown: true }} />
    </Stack>
  );
}
```

---

## Checklist nowej apki

- [ ] Bottom tabs z 3-5 elementami, labels visible
- [ ] Filled active / outline inactive icons
- [ ] Stack max 3-4 levels deep
- [ ] Modal vs full-screen vs sheet — decision per use case
- [ ] Native swipe back na iOS NIE blokowany bez powodu
- [ ] Deep linking setup (`scheme` + universal links)
- [ ] URL state dla filters/sort/modal
- [ ] Hide tab bar tylko na detail screens
- [ ] Brak modal w modal
- [ ] Brak tab w tab
- [ ] Back button NIE na home screen

---

## Powiązane

- `forms-keyboard.md` — full-screen modal vs bottom sheet dla formularzy
- `states-loading-empty-error.md` — error screens vs banners vs modals
- `onboarding.md` — modal vs full-screen dla onboarding flow
- `teardowns.md` — Linear native conventions z brand identity

---

*Źródła: Apple HIG Navigation, Material 3 Navigation, expo-router docs, react-navigation v7 docs, NN/g "Hamburger vs Tabs" research, web search "mobile navigation patterns 2026", "bottom tabs vs drawer research", `@gorhom/bottom-sheet` docs.*
