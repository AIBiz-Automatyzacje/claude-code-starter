# Listy i obrazy

## Którą listę wybrać

| Dane | Lista |
|---|---|
| Długie albo o nieznanej długości (feed, wyniki) | FlashList v2 |
| Krótkie, stałe | `FlatList` |
| Grupowane wiersze ustawień | `List` z `@expo/ui`: nie jest wirtualizowany |

## FlashList v2

Działa na New Architecture i recykluje wiersze.
- `estimatedItemSize` nie jest już potrzebne.
- `masonry` to prop, nie osobny komponent.
- `maintainVisibleContentPosition` jest domyślnie włączone.
- Stan wewnątrz wiersza trzymasz przez `useRecyclingState`, bo zwykły `useState` przechodzi między elementami.
- Klucze w `.map()` wewnątrz wiersza daje `useMappingHelper`.

Na wierszu listy wirtualizowanej nie ma `entering`: animacja odpala się przy każdym recyklingu. Pełnoszerokim wierszom przy naciśnięciu zmieniasz tło, nie `scale`.

Dokumentacja: https://shopify.github.io/flash-list/docs/v2-changes

## `expo-image`

```tsx
<Image
  source={{ uri }}
  recyclingKey={element.id}
  contentFit="cover"
  placeholder={{ blurhash }}
  transition={{ duration: 150 }}
  accessibilityLabel={element.opis}
/>
```

- W FlashList `recyclingKey` jest obowiązkowy; bez niego miga poprzednie źródło.
- `contentFit` zamiast `resizeMode`, `placeholder` zamiast `defaultSource`.
- RN 0.88 deprecjonuje `ImageBackground`: używasz `View` z obrazem pozycjonowanym absolutnie.
- `className` działa po `withUniwind(Image)` (`styling-engine.md`).
