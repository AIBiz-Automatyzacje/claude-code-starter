# supabase-dev-guidelines — fragmenty stacku Expo

Klient Supabase w aplikacji natywnej. Rdzeń skilla (baza, polityki, Edge Functions, CLI) działa tak samo.

## Instalacja i klient

- Wariant domyślny (D9): `npx expo install @supabase/supabase-js react-native-url-polyfill expo-sqlite`. Kod klienta: `resources/klient-i-przeglad.md`.
- `LargeSecureStore` to opcja dla aplikacji z danymi wrażliwymi, a wybór i powód zapisujesz w planie: dodatkowo `npx expo install expo-secure-store @react-native-async-storage/async-storage`, `aes-js` i `react-native-get-random-values`. Wzór klasy jest w tutorialu Supabase dla Expo, a `SecureStoreOptions` (np. `WHEN_UNLOCKED`) dobierasz do aplikacji.
- `expo-sqlite` i `expo-secure-store` to paczki natywne: przebudowa dev-clienta (`.claude/stack/po-fazie.md`, sekcja „Przebudowa”).
- `EXPO_PUBLIC_*` jest w paczce jawnym tekstem: wolno tam publishable key. Secret key żyje tylko w Edge Functions.

## Auto-refresh i AppState

RN nie ma zdarzeń okna, więc odświeżanie tokenu podpinasz raz, poza komponentem:

```typescript
import { AppState } from 'react-native';

AppState.addEventListener('change', (stan) => {
  if (stan === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

## Realtime w cyklu życia aplikacji

- Przy przejściu w tło nie odpinasz kanału: socket sam wraca z backoffem. Po powrocie do `active` pobierasz dane od nowa, bo zdarzenia z czasu uśpienia przepadły.
- Ponowne `subscribe` po `unsubscribe` na tym samym obiekcie rzuca „tried to join multiple times”: gdy musisz odpiąć, robisz `removeChannel` i tworzysz nowy kanał.
- Ciche rozłączenia wykrywa `heartbeatCallback` w konfiguracji klienta Realtime.

## Dane offline

- Cache między uruchomieniami dodajesz tylko, gdy jednostka go zamawia: `PersistQueryClientProvider` z `createAsyncStoragePersister`. `focusManager` i `onlineManager` opisuje `.claude/rules/stack.md`, sekcja „Dane i sieć”.

## Logika serwerowa

- Kod serwerowy idzie do Edge Functions, nie do Expo API Routes. Wywołanie z aplikacji i płatności: `resources/edge-functions.md`.

## Typy

- `supabase gen types --lang typescript --local > src/types/database.types.ts` (projekt bez `src/`: `types/database.types.ts`).
