# Lists & performance — listy mobile

FlatList vs FlashList vs SectionList vs ScrollView, virtualization, swipe actions, pull-to-refresh, infinite scroll. Kiedy co i jak nie zarżnąć FPS.

---

## Decision tree — która lista

| Komponent | Item count | Zachowanie | Kiedy wybrać |
|-----------|------------|------------|--------------|
| **ScrollView** | < 20 statycznych | Wszystkie items rendered always | Krótka statyczna lista (settings sections, profile fields) |
| **FlatList** | 20-200 dynamicznych | Built-in virtualization | Lista średnia, znana wysokość lub variable z `getItemLayout` |
| **FlashList** (`@shopify/flash-list`) | 200+ lub variable height | Reusable cell rendering | Duża lista, feed, search results, chat |
| **SectionList** | Grouped data | Built-in section headers | Contacts, settings z grupami, alfabetyczne listy |
| **LegendList** (alternatywa 2026) | Każda skala, variable height | Better than FlashList dla niektórych edge cases | Eksperyment dla listy z extreme variable heights |

**Pryncypium:** zaczynasz FlashList. Tylko jeśli to overkill (tab z 5 settingsami) → ScrollView. FlatList to "good enough fallback" gdy nie chcesz dependency.

**Performance cliff:** ScrollView z 100+ itemami = wszystkie rendered, JS thread tonie. To NIE jest "leniwa optymalizacja" — to bug. 100 itemów w ScrollView = freeze przy mount.

---

## Virtualization — mental model

Virtualization renderuje TYLKO to co widać w viewport + buffer. Lista 10 000 items wyświetla na raz może 15 cells. Reszta to placeholder (FlatList) lub recycled cell (FlashList).

**Co kontrolujesz:**

| Prop (FlatList) | Co robi | Default |
|-----------------|---------|---------|
| `windowSize` | Ile "ekranów" buffera dookoła viewport | 21 (= 10 ekranów w górę, 10 w dół) — często overkill |
| `initialNumToRender` | Ile renderowane przy mount | 10 |
| `maxToRenderPerBatch` | Ile per batch po scrollu | 10 |
| `updateCellsBatchingPeriod` | Co ile ms batch | 50 |
| `removeClippedSubviews` | Android: detach off-screen views | false (włącz na liście 100+) |

**Tuning na liście 1000+:**
- `windowSize={5}` (2.5 ekranu góra + 2.5 dół wystarcza dla normal scroll)
- `initialNumToRender={10}`
- `removeClippedSubviews={true}` na Androidzie
- `getItemLayout` jeśli wysokość znana

```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  windowSize={5}
  initialNumToRender={10}
  removeClippedSubviews
  getItemLayout={(_, index) => ({
    length: 80,
    offset: 80 * index,
    index,
  })}
/>
```

`getItemLayout` daje 5x szybszy scroll, ale TYLKO dla list ze znaną wysokością (tj. wszystkie items tego samego rozmiaru).

---

## FlashList — premium choice

FlashList Shopify używa cell recycling (jak iOS UITableView). Cells nie są niszczone, są reused dla nowego dataset itemu.

**Wersja: v2 (aktualna).** FlashList v2 wymaga **New Architecture** (Fabric) — sprawdź `newArchEnabled: true` w `app.json` przed migracją z v1.

```tsx
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={({ item }) => <Item data={item} />}
  keyExtractor={(item) => item.id}
  // BRAK estimatedItemSize — v2 mierzy automatycznie, prop jest "no longer used"
/>
```

**Co się zmieniło w v2:**
- `estimatedItemSize` / `estimatedListSize` — **nieużywane** (auto-sizing zamiast ręcznej estymaty)
- `MasonryFlashList` (osobny komponent w v1) → zastąpiony propem `masonry` na zwykłym `FlashList` (`<FlashList masonry numColumns={3} />`)
- Nowe hooki: `useRecyclingState` (lokalny stan itemu, resetowany po recyklingu — zamiast `useState` wewnątrz recyklowanego komponentu), `useLayoutState`, `useMappingHelper`, `useFlashListContext`

**Legacy (v1, `@shopify/flash-list` < 2.0):** `estimatedItemSize` był MANDATORY prop. Projekty wciąż na v1 powinny go zostawić, ale zaplanować upgrade do v2 (wymaga New Architecture).

**Variable height + typ itemu:**

```tsx
<FlashList
  data={items}
  renderItem={renderItem}
  // Daj typ itemu — FlashList trzyma osobne pule recyclingu per typ
  getItemType={(item) => item.type} // 'message' | 'system' | 'date-divider'
/>
```

Bez `getItemType`, FlashList recycluje text-message cell jako date-divider — nieprzyjemne flickery.

**Drawbacks FlashList:**
- Migracja v1 → v2 wymaga New Architecture (jednorazowy koszt jeśli projekt jeszcze na Old Architecture)
- Cell recycling = item musi być stateless lub state via `useRecyclingState`, nie plain `useState`

---

## Common perf killers

### 1. Anonymous functions w `renderItem`

```tsx
// ŹLE — re-created every render, każdy Item re-mountuje
<FlatList
  renderItem={({ item }) => <Item onPress={() => doSomething(item.id)} />}
/>

// DOBRZE — stable reference
const renderItem = useCallback(({ item }: { item: Item }) => (
  <ItemRow item={item} onPress={handleItemPress} />
), [handleItemPress]);

<FlatList renderItem={renderItem} />
```

### 2. Inline styles w renderItem

```tsx
// ŹLE — new object every render
<View style={{ padding: 16, flexDirection: 'row' }} />

// DOBRZE — Uniwind kompiluje className przy budowaniu
<View className="p-4 flex-row" />
```

### 3. Heavy computations w render

Sortowanie / filtrowanie / mapowanie array w render = O(n) per scroll frame. Zawsze `useMemo` z dependency na surowe dane: `useMemo(() => [...items].sort(...), [items])`.

### 4. Nieoptymalne obrazy

```tsx
// ŹLE — RN <Image>, brak cache, full size load
<Image source={{ uri: item.avatar }} style={{ width: 40, height: 40 }} />

// DOBRZE — expo-image z cache
import { Image } from 'expo-image';

<Image
  source={{ uri: item.avatar }}
  style={{ width: 40, height: 40 }}
  cachePolicy="memory-disk"
  transition={150}
/>
```

### 5. Animacje + re-render

Animacja na każdym item = 50 visible × animated value updates per frame = jank. Animuj TYLKO visible items lub `LayoutAnimation` (one-shot). Item komponent zawsze w `memo` — inaczej parent state change re-renderuje całą listę.

---

## Pull-to-refresh

**Kiedy YES:**
- Listy z często zmieniającymi się danymi (feed, inbox, notifications)
- User intuicyjnie oczekuje refresh (Twitter, Mail, Inbox)
- Realtime data ale chcesz dać user manual control

**Kiedy NO:**
- Settings, profile, static lists — nic do refreshowania
- Listy gdzie nowy content przychodzi push (chat — auto-scroll do bottom wystarczy)
- Listy gdzie refresh = re-fetch ALL = drogie + nie ma sensu

```tsx
import { useState, useCallback } from 'react';
import { FlatList, RefreshControl } from 'react-native';

export function FeedList() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchFeed();
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#6b7280" // iOS spinner color
          progressViewOffset={64} // Android — distance from top (account for header)
        />
      }
    />
  );
}
```

**Anti-pattern:** disable iOS bounce. Bounce = część native UX. Disable = "this app feels off". Zostaw bounce nawet gdy lista nie ma refresh.

---

## Infinite scroll vs pagination vs load more

| Pattern | Kiedy | Plus | Minus |
|---------|-------|------|-------|
| **Infinite scroll** | Content discovery (feed, search results, gallery) | Continuous experience, user doesn't think about it | Trudna nawigacja "wróć do tego co widziałem", footer niedostępny, accessibility issue |
| **Pagination** (1, 2, 3 buttons) | Discrete navigation, archive, search results gdzie user może chcieć "page 5" | Predictability, footer dostępny | Mobile-unfriendly, więcej tap dla content |
| **Load more button** | Moderate amount, kontrolowany flow | User control, predictability, footer accessible | Wymaga tap żeby dostać więcej content |

**Mobile pragmatic mix:** infinite scroll dla 90% zastosowań + "Load more" button na końcu jako accessibility fallback dla użytkowników którzy nie scrollują continuously.

```tsx
const [isLoading, setIsLoading] = useState(false);

const handleEndReached = useCallback(async () => {
  if (isLoading) return;
  setIsLoading(true);
  try {
    await fetchNextPage();
  } finally {
    setIsLoading(false);
  }
}, [isLoading]);

<FlashList
  data={items}
  renderItem={renderItem}
  onEndReached={handleEndReached}
  onEndReachedThreshold={0.5} // 50% before bottom
  ListFooterComponent={isLoading ? <LoadingFooter /> : null}
/>
```

`onEndReachedThreshold`:
- `0.1` (10%) — late, ale less network spam
- `0.5` (50%) — eager, smooth UX, więcej requestów
- `1.0` (100%) — fire when last visible

---

## Sticky section headers

```tsx
<FlatList
  data={items}
  renderItem={renderItem}
  stickyHeaderIndices={headerIndices} // array of indices
/>

// Lub SectionList — built-in
<SectionList
  sections={sections}
  renderItem={renderItem}
  renderSectionHeader={({ section }) => (
    <Text className="bg-background px-4 py-2 font-semibold">
      {section.title}
    </Text>
  )}
  stickySectionHeadersEnabled
/>
```

**Reguła:** maks 1-2 sticky headers visible. Każdy sticky = compose pass per scroll frame. Lista z 50 sticky headers visible = jank.

---

## Swipe actions — list interactions

Pattern Things 3, Apple Mail, Gmail.

**Kierunki:**
- **Right-to-left** (swipe-left) — destructive (delete, archive)
- **Left-to-right** (swipe-right) — positive (mark read, complete, snooze)

**Thresholds:**
- ~30% width — reveal action button (no commit)
- ~80% width — full action commit (auto-execute)
- Haptic feedback przy 80% threshold cross — sygnalizuje "release = commit"

**Library: `ReanimatedSwipeable`** z `react-native-gesture-handler/ReanimatedSwipeable` (RNGH 3.x) — następca legacy `Swipeable`, przepisany na Reanimated.

> **Legacy `Swipeable` został USUNIĘTY w RNGH 3.x.** `import { Swipeable } from 'react-native-gesture-handler'`
> daje dziś `undefined` w runtime i błąd kompilacji w TS — w `index.d.ts` wersji 3.2.1 nie ma ani
> jednego wystąpienia `Swipeable` (w 2.32.0 był eksportowany razem z `SwipeableProps`). To nie jest
> deprecacja z okresem przejściowym: na 3.x jedyną drogą jest subpath
> `react-native-gesture-handler/ReanimatedSwipeable`. Przy migracji z 2.x podmiana importu nie
> wystarczy — `ReanimatedSwipeable` przekazuje do `renderRightActions` `SharedValue`, nie
> `Animated.AnimatedInterpolation`.

```tsx
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

function renderRightActions(
  _progress: SharedValue<number>,
  translation: SharedValue<number>,
  onDelete: () => void,
) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + 80 }],
  }));

  return (
    <Reanimated.View style={style}>
      <Pressable
        onPress={onDelete}
        className="bg-destructive justify-center items-center w-20 h-full"
        accessibilityLabel="Usuń"
      >
        <Text className="text-white">Usuń</Text>
      </Pressable>
    </Reanimated.View>
  );
}

export function SwipeableRow({ item, onDelete }: Props) {
  const handleSwipeOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <Swipeable
      renderRightActions={(progress, translation) =>
        renderRightActions(progress, translation, () => onDelete(item.id))
      }
      onSwipeableOpen={handleSwipeOpen}
      friction={2}
      rightThreshold={40}
    >
      <View className="bg-background p-4">
        <Text>{item.title}</Text>
      </View>
    </Swipeable>
  );
}
```

**Accessibility:** swipe action ZAWSZE ma alternative non-gesture access. Long press → context menu z tymi samymi akcjami. Bez tego VoiceOver users nie wykonają akcji.

---

## Loading skeleton dla list

Skeleton > spinner. Sygnał "tu zaraz będzie content", layout się nie skacze gdy data dotrą.

**Reguły:**
- Match item height — gdy data load, layout zostaje
- 5-7 skeleton items wystarczy
- Subtle pulse animation (opacity 0.5 → 1.0 over 1.5s)
- Match shape — avatar circle? skeleton też circle

Implementacja: array 6 elementów, każdy z `bg-muted` placeholder w kształcie itemu (circle avatar + 2 linie z gradient). Toggle `{isLoading ? <Skeleton /> : <FlashList ... />}`.

---

## Header / Footer / Empty / Multi-column

`ListHeaderComponent`, `ListFooterComponent`, `ListEmptyComponent` — zawsze rendered (poza virtualization buffer). Trzymaj prostotę, bez heavy logic. `numColumns={2}` dla grid layout (cards). Mobile portrait: maks 3 kolumny, inaczej fat finger.

---

## Code patterns

### FlashList z optimal config

```tsx
import { useCallback, memo } from 'react';
import { FlashList, ListRenderItem } from '@shopify/flash-list';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';

interface Item {
  id: string;
  title: string;
  subtitle: string;
  avatar: string;
}

const ItemRow = memo(function ItemRow({ item, onPress }: { item: Item; onPress: (id: string) => void }) {
  return (
    <Pressable
      onPress={() => onPress(item.id)}
      className="flex-row items-center px-4 py-3 active:bg-muted"
    >
      <Image
        source={{ uri: item.avatar }}
        style={{ width: 40, height: 40, borderRadius: 20 }}
        cachePolicy="memory-disk"
      />
      <View className="ml-3 flex-1">
        <Text className="text-base font-medium">{item.title}</Text>
        <Text className="text-sm text-muted-foreground">{item.subtitle}</Text>
      </View>
    </Pressable>
  );
});

export function ItemList({ items, onItemPress }: { items: Item[]; onItemPress: (id: string) => void }) {
  const renderItem: ListRenderItem<Item> = useCallback(
    ({ item }) => <ItemRow item={item} onPress={onItemPress} />,
    [onItemPress],
  );

  return (
    <FlashList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      // v2: bez estimatedItemSize — auto-sizing
    />
  );
}
```

---

## Checklist — list performance review

- [ ] FlashList dla > 50 items (lub FlatList z `getItemLayout`)
- [ ] FlashList v2 + New Architecture włączona (lub v1 legacy z `estimatedItemSize` ustawionym)
- [ ] `keyExtractor` używa stable ID, NIE index
- [ ] `renderItem` w `useCallback`
- [ ] Item komponent w `memo`
- [ ] Brak inline styles w `renderItem`
- [ ] Brak inline funkcji w props itemu
- [ ] `expo-image` zamiast `<Image>` dla avatarów
- [ ] `removeClippedSubviews` na Androidzie dla long lists
- [ ] Pull-to-refresh tylko gdzie ma sens
- [ ] Empty state component
- [ ] Loading skeleton (nie spinner)
- [ ] Infinite scroll z fallback "Load more" button (a11y)
- [ ] Swipe action ma non-gesture alternative (long press menu)
- [ ] Test na 1000+ items — czy scroll płynny
- [ ] Test na slow device — Android low-end (Pixel 4a level)

---

## Powiązane

- `[[states-loading-empty-error.md]]` — empty list, loading, error states
- `[[icons.md]]` — chevron right, swipe action icons
- `[[sheets-modals.md]]` — bottom sheet z action list jako alternative dla swipe
- `[[platform-conventions.md]]` — iOS bounce, Android material refresh

---

## Źródła

- Shopify FlashList docs (shopify.github.io/flash-list)
- React Native FlatList (reactnative.dev/docs/flatlist)
- React Native Gesture Handler — Swipeable (docs.swmansion.com/react-native-gesture-handler)
- expo-image (docs.expo.dev/versions/latest/sdk/image)
- Apple HIG — Lists (developer.apple.com/design/human-interface-guidelines/lists-and-tables)
- Material 3 — Lists (m3.material.io/components/lists)
