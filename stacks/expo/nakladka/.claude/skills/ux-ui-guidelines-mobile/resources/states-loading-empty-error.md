# Loading, Empty, Error States

Stany dynamiczne to obszar gdzie 80% mobile apek wpada na anti-patterny. Spinner fatigue, empty states bez akcji, error messages bez recovery, offline-first traktowany jako "potem". Ten plik daje decision frameworks per kontekst.

## Reguła kompletności stanów

Każdy ekran który ładuje dane MUSI obsłużyć minimum 4 stany:

| Stan | Co user widzi |
|------|---------------|
| `loading` | Skeleton albo spinner |
| `empty` | Brak danych, ale user nauczył się jak je dodać |
| `error` | Co się stało + jak to naprawić |
| `success` | Content |

**Brak któregokolwiek = bug.** Większość mobile apek ma 4 stany dla "happy path" (success), ale trzy pozostałe są half-assed.

---

## Loading: skeleton vs spinner vs progressive

### Decision matrix

| Kontekst | Wzorzec | Powód |
|----------|---------|-------|
| Lista (feed, taski, search results) | **Skeleton** | Znamy strukturę zawartości — kafelki w identycznych slotach |
| Profil użytkownika | **Skeleton** | Avatar placeholder + name placeholder + bio placeholder |
| Pojedynczy artykuł / długi content | **Progressive** | Title + meta najpierw, body później, comments na końcu |
| Search query (computation) | **Spinner** | Nie wiemy ile będzie wyników ani jakiej długości |
| Single button action | **Spinner inside button** | Zachowuje kontekst i prevent double-tap |
| Page navigation (cały ekran) | **Skeleton** lub **Optimistic** | Skeleton jeśli >300ms, optimistic jeśli z high success rate |
| Image upload / file processing | **Progress bar (deterministyczny)** | Mamy %, więc to pokazujemy |

**Reguła progu:** jeśli operacja kończy się <100ms — nie pokazuj NIC (spinner-blink jest gorszy niż brak). 100-300ms — subtle indicator. >300ms — pełny loading state.

---

### Skeleton design rules

1. **Same dimensions as content** — skeleton musi mieć rozmiary docelowego elementu. Inaczej layout shift przy load.
2. **No animation faster than 1.5s** — shimmer 800ms-1.5s. Szybciej = stresujące.
3. **No rainbow gradients** — szary z subtle highlight, nie tęcza.
4. **No more than 5-7 visible items** — nie generuj 30 skeleton items. User się tego nie spodziewa po load.
5. **Match shape, not detail** — skeleton avatara = krąg, nie krąg z fake oczami.

```tsx
// Skeleton w Expo z Reanimated shimmer
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { View } from "react-native";

export function Skeleton({ className }: { className?: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000 }),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={style}
      className={`bg-muted rounded-md ${className ?? ""}`}
    />
  );
}

// Użycie: lista user cards
function UserListSkeleton() {
  return (
    <View className="gap-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} className="flex-row gap-3 items-center">
          <Skeleton className="size-12 rounded-full" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </View>
        </View>
      ))}
    </View>
  );
}
```

---

### Optimistic UI — kiedy

Optimistic UI = pokazujesz wynik akcji ZANIM serwer odpowie. Roll-back jeśli error.

**Kiedy używać:**

| Akcja | Optimistic? | Powód |
|-------|-------------|-------|
| Like / unlike | TAK | High success rate, low cost rollback |
| Send message | TAK | User oczekuje natychmiastowej odpowiedzi |
| Mark task done | TAK | Trywialna mutation |
| Submit form | NIE | User oczekuje walidacji od serwera |
| Payment | NIE | Cost rollback = utrata zaufania |
| Delete (irreversible) | NIE | Rollback po delete jest UX-confusing |
| Create new resource | Częściowo | Pokaż placeholder, dopisz ID po response |

**Pattern:** Tanstack Query `useMutation` z `onMutate` + `onError` rollback.

```tsx
const likeMutation = useMutation({
  mutationFn: (postId: string) => api.likePost(postId),
  onMutate: async (postId) => {
    await queryClient.cancelQueries({ queryKey: ["post", postId] });
    const previous = queryClient.getQueryData<Post>(["post", postId]);
    queryClient.setQueryData<Post>(["post", postId], (old) =>
      old ? { ...old, liked: true, likeCount: old.likeCount + 1 } : old,
    );
    return { previous };
  },
  onError: (_err, postId, context) => {
    if (context?.previous) {
      queryClient.setQueryData(["post", postId], context.previous);
    }
  },
});
```

---

## Empty state: jako nauczyciel, nie jako problem

Anti-pattern: `<Text>Brak danych</Text>` na środku ekranu.

Premium pattern: empty state to pierwszy moment edukacyjny.

### Co empty state musi zawierać

1. **Ilustracja lub ikona** — wizualna kotwica (nie obraz na pół ekranu)
2. **Headline** — co tu będzie ("Brak rozmów")
3. **Description** — JAK to wypełnić ("Zacznij rozmowę przez +")
4. **Primary CTA** — duży przycisk z akcją

### Typy empty states

| Typ | Kiedy | Treść |
|-----|-------|-------|
| **First-time empty** | User nigdy nie miał danych | Edukacyjny — "Witaj, dodaj pierwsze X" |
| **Filter empty** | User filtrowanie zwraca 0 | "Brak wyników dla '{query}'" + CTA "Wyczyść filtry" |
| **All-done empty** | User skończył wszystkie zadania | Pozytywny — "Wszystko zrobione, dobra robota" |
| **Error-empty** | Failed to load, treat jako empty | NIE — to error state, patrz niżej |

```tsx
function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  onCtaPress,
}: {
  icon: React.ComponentType<{ size?: number; colorClassName?: string }>; // ikona owinięta w withUniwind, patrz icons.md
  title: string;
  description: string;
  cta?: string;
  onCtaPress?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-3">
      <View className="size-16 rounded-full bg-muted items-center justify-center mb-2">
        <Icon size={32} colorClassName="accent-muted-foreground" />
      </View>
      <Text className="text-xl font-semibold text-foreground text-center">
        {title}
      </Text>
      <Text className="text-sm text-muted-foreground text-center max-w-xs">
        {description}
      </Text>
      {cta && onCtaPress && (
        <Pressable
          onPress={onCtaPress}
          className="mt-4 px-6 py-3 rounded-full bg-primary active:scale-[0.97]"
        >
          <Text className="text-primary-foreground font-medium">{cta}</Text>
        </Pressable>
      )}
    </View>
  );
}
```

---

## Error states: typology

Wszystkie błędy to nie ten sam error. Każdy typ wymaga innego recovery patternu.

### Typy errorów

| Typ | HTTP / cause | Pattern UI | Recovery |
|-----|-------------|------------|----------|
| **Network error** | offline, timeout | Banner persistent + inline retry | Auto-retry on reconnect |
| **Server error** | 5xx | Full-screen error + retry button | Manual retry, contact support |
| **Validation error** | 4xx (forma niepoprawna) | Inline pod fieldem | User corrects + resubmit |
| **Permission error** | 401, 403 | Modal lub inline + link to settings | Re-login lub permission grant |
| **Not found** | 404 | Empty-state-like screen | Navigation back |
| **Empty due to filter** | filter applied returns 0 | Empty state + clear filters CTA | Clear / change filter |

### Network error — banner pattern

Persistent banner u góry ekranu, dopóki online nie wraca:

```tsx
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <View className="bg-destructive px-4 py-2 flex-row items-center gap-2">
      <WifiOff size={16} colorClassName="accent-destructive-foreground" />
      <Text className="text-destructive-foreground text-sm font-medium">
        Brak połączenia
      </Text>
    </View>
  );
}
```

### Validation error — inline

NIE alert, NIE toast. **Inline pod fieldem.**

```tsx
<View className="gap-1.5">
  <Text className="text-sm font-medium text-foreground">Email</Text>
  <TextInput
    value={email}
    onChangeText={setEmail}
    keyboardType="email-address"
    autoCapitalize="none"
    className={`border rounded-md px-3 py-2 ${
      error ? "border-destructive" : "border-border"
    }`}
  />
  {error && (
    <Text
      className="text-sm text-destructive"
      role="alert"
      aria-live="polite"
    >
      {error}
    </Text>
  )}
</View>
```

**Reguły:**
- Focus na pierwszym błędzie po submit
- `aria-live="polite"` na błędach działa tylko na Androidzie; na iOS ogłoś pojawienie się błędu przez `AccessibilityInfo.announceForAccessibility(error)` (przykład w `forms-keyboard.md`)
- Komunikat = co user MA ZROBIĆ ("Wpisz poprawny email"), nie co spierdolił ("Invalid email")

### Server error — full screen z retry

```tsx
function ErrorScreen({
  onRetry,
  message = "Coś poszło nie tak. Spróbuj ponownie.",
}: { onRetry: () => void; message?: string }) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-3">
      <AlertCircle size={48} colorClassName="accent-destructive" />
      <Text className="text-lg font-semibold text-foreground">{message}</Text>
      <Pressable
        onPress={onRetry}
        className="mt-2 px-6 py-3 rounded-full bg-primary active:scale-[0.97]"
      >
        <Text className="text-primary-foreground font-medium">
          Spróbuj ponownie
        </Text>
      </Pressable>
    </View>
  );
}
```

### Error Boundary RN

Owijaj cały app w `ErrorBoundary` z `getDerivedStateFromError` + `componentDidCatch` (loguj do Sentry). Fallback: `ErrorScreen` z retry button który wywołuje `setState({ hasError: false })`. React od 19 ma natywne wsparcie przez `<ErrorBoundary>` w niektórych frameworkach — w RN nadal piszesz class component.

---

## Recovery patterns

| Pattern | Kiedy używać |
|---------|--------------|
| **Auto-retry** | Network error (powrót online) — react-query `retry: 3, retryDelay: exponentialBackoff` |
| **Manual retry button** | Server error (5xx) — user decyduje kiedy ponowić |
| **Go back** | 404, permission denied — bo user zboczył gdzie nie powinien |
| **Contact support** | Persistent error po 3 retry |
| **Clear filters** | Empty due to filter |
| **Re-login** | 401 (token wygasł) |
| **Open settings (deep link)** | Permission denied (camera, location, notifications) |

```tsx
// Deep link do settings (camera permission)
import * as Linking from "expo-linking";

async function openSettings() {
  await Linking.openSettings();
}
```

---

## Offline-first design

Mobile != stable internet. Premium apki traktują offline jako default state, nie edge case.

### Co cache'ować

| Data type | Cache strategy | Library |
|-----------|----------------|---------|
| Read-only content (articles, feeds) | Stale-while-revalidate | Tanstack Query `staleTime` + `gcTime` |
| User-generated mutations | Queue + retry on online | Tanstack Query mutations + `onlineManager` |
| Images | Disk cache | `expo-image` (built-in) |
| User session/auth | Persistent | `expo-secure-store` |
| App state (offline) | Persistent | `@tanstack/query-async-storage-persister` |

### Komunikacja offline status

1. **Banner** — persistent na top jeśli offline (patrz pattern wyżej)
2. **Optimistic UI z indicator** — mutation queued, ikonka "wyśle się jak będzie sieć"
3. **Disabled actions** — które wymagają online (np. "Search users") disable z tooltipem
4. **Cached badge** — kiedy user widzi stare dane, pokaż "Ostatnia aktualizacja: 5 min temu"

### Sync po powrocie

```tsx
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";

export function useNetworkSync() {
  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      onlineManager.setOnline(!!state.isConnected);
      // Tanstack Query auto-refetches stale queries gdy online
    });
  }, []);
}
```

---

## Pull-to-refresh — kiedy DAĆ, kiedy NIE

| Kontekst | Pull-to-refresh? |
|----------|------------------|
| Feed / lista (chronological) | TAK — user oczekuje świeżych danych |
| Detail screen (single item) | NIE — refresh przez navigation back |
| Form screen | NIE — gest zniszczy progress |
| Static content | NIE — nie ma czego refreshować |
| Search results | TAK — user może chcieć ponowić search |
| Settings | NIE |

```tsx
import { RefreshControl, ScrollView } from "react-native";
import { useState } from "react";

function FeedScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { refetch } = useQuery({ queryKey: ["feed"], queryFn: fetchFeed });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* feed items */}
    </ScrollView>
  );
}
```

---

## Anti-patterns

| Anti-pattern | Dlaczego źle | Co zamiast |
|--------------|--------------|------------|
| Spinner na 50ms operacji | Spinner-blink stresuje | Nie pokazuj nic <100ms |
| Empty state "No data" + nic | User nie wie co zrobić | CTA + opis akcji |
| Error toast bez recovery | User klika OK i co dalej? | Inline error + retry button |
| `try { } catch { /* nic */ }` | Silent failure = bug invisible | Always log + show user-facing message |
| Network error = full-screen error | Tracimy cały ekran przy momentary disconnect | Banner persistent + cached UI |
| Pull-to-refresh na single screen | Gesture confusion | Tylko na listach |
| Skeleton z 30 itemami | User nie spodziewa się 30 | Max 5-7 |
| Validation onChange | Annoying podczas pisania | Validation onBlur |

---

## Powiązane

- `forms-keyboard.md` — validation timing, error inline pod fieldem
- `navigation-patterns.md` — full-screen error vs modal vs banner
- `onboarding.md` — empty state jako nauczyciel (Things 3 pattern)
- `teardowns.md` — Calorify progressive data viz, Things 3 empty states

---

*Źródła: Tanstack Query offline-first docs, react-native-skeleton-placeholder, Apple HIG Loading + Empty States, Material 3 Loading indicators, NN/g "Skeleton Screens" research, web search "loading state design patterns mobile 2026", "offline first mobile design".*
