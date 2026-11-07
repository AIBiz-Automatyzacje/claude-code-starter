# React Native Sentry Patterns

Wzorce integracji Sentry z Expo Router. Zasady i wersja minimalna: `references/stack.md`. Źródła (sprawdzone 2026-11-07): https://docs.sentry.io/platforms/react-native/manual-setup/expo/ , https://docs.sentry.io/platforms/react-native/sourcemaps/uploading/expo/ .

## Instalacja

```bash
npx expo install @sentry/react-native
```

Kreator (`npx @sentry/wizard@latest -i reactNative`) dodaje plugin, Metro i kod; snippet `Sentry.init` weryfikujesz potem według tej strony, bo domyślnie włącza `sendDefaultPii: true`.

## Plugin Expo

```json
{
  "expo": {
    "plugins": [
      [
        "@sentry/react-native/expo",
        {
          "organization": "<slug-organizacji>",
          "project": "<slug-projektu>",
          "url": "https://sentry.io/"
        }
      ]
    ]
  }
}
```

Android: plugin Gradle jest opcjonalny i ustawiasz go jawnie. ProGuard/R8 i symbole NDK wysyła dopiero `experimental_android: { enableAndroidGradlePlugin: true }` w opcjach pluginu. iOS wysyła dSYM sam.

## Metro

```javascript
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
```

Projekt z Uniwind: `module.exports = withUniwindConfig(getSentryExpoConfig(__dirname), { cssEntryFile: './global.css' })`, bo Uniwind musi być zewnętrzny (skill uniwind). Tego zestawienia nie sprawdzano na urządzeniu.

## Inicjalizacja

```typescript
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import { Stack } from 'expo-router';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.expoRouterIntegration({ enableTimeToInitialDisplay: !isRunningInExpoGo() }),
    Sentry.mobileReplayIntegration(),
  ],
  beforeSend(event) {
    if (event.user?.email) delete event.user.email;
    return event;
  },
});

function RootLayout() {
  return <Stack />;
}

export default Sentry.wrap(RootLayout);
```

SDK sam wyłącza warstwę natywną w Expo Go, a sesje są śledzone domyślnie, więc tych opcji nie ustawiasz.

## Error Boundary

Od 8.17.2 opcja `autoWrapExpoRouterErrorBoundary` w `getSentryExpoConfig` zgłasza błędy tras bez ręcznego wrappera. `Sentry.ErrorBoundary` dodajesz tylko dla własnego fallbacku:

```tsx
<Sentry.ErrorBoundary fallback={({ resetError }) => <EkranBledu onRetry={resetError} />}>
  {children}
</Sentry.ErrorBoundary>
```

Stoi wewnątrz `RootLayout`, bo `Sentry.wrap` opakowuje cały komponent główny.

## Crashe natywne a środowisko

| Środowisko | Błędy JS | Crashe natywne |
|---|---|---|
| Expo Go | tak | nie |
| Dev-client | tak | tak |
| Build preview i release | tak | tak |

Zgłaszanie crashy sprawdzasz na dev-cliencie albo buildzie, nie w Expo Go.

## Sourcemapy

```bash
eas env:set --name SENTRY_AUTH_TOKEN --value "$TOKEN" --visibility secret --environment production
```

EAS Build wysyła sourcemapy sam. EAS Update nie:

```bash
npx expo export --dump-sourcemap
eas update
npx @sentry/expo-upload-sourcemaps dist
```

Bez tego kroku crash po OTA ma zminifikowany stos. Komend `eas` używasz tylko na polecenie operatora.

## Session Replay

Maskowanie jest domyślnie włączone. Wyłączasz je tylko na ekranie bez danych osobowych:

```typescript
Sentry.mobileReplayIntegration({ maskAllText: false, maskAllImages: false, maskAllVectors: false });
```

## Kontekst urządzenia

```typescript
import * as Application from 'expo-application';
import * as Device from 'expo-device';

Sentry.setContext('device', {
  model: Device.modelName,
  osVersion: Device.osVersion,
  appVersion: Application.nativeApplicationVersion,
  buildNumber: Application.nativeBuildVersion,
});
```

## Zmienne

`EXPO_PUBLIC_SENTRY_DSN` jest w paczce i to dopuszczalne. `SENTRY_AUTH_TOKEN` to sekret builda: lokalnie `.env.local` poza repo, w EAS sekret, nigdy z prefiksem `EXPO_PUBLIC_`.

## Ignorowane błędy

W `ignoreErrors` dajesz tylko szum zaobserwowany w projekcie, zwykle `Network request failed` przy braku sieci i `AbortError` przy świadomym anulowaniu.
