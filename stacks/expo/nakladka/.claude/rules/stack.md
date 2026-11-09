---
paths:
  - "**/*.{ts,tsx,js,jsx}"
  - "app.json"
  - "app.config.{ts,js}"
  - "eas.json"
  - "**/global.css"
  - ".maestro/**/*.yaml"
---

# Reguły stacku: Expo / React Native

Mechanizmy stacku do reguł z `.claude/rules/coding-rules.md`; sekcje o tej samej nazwie uzupełniają tamte, a przy sprzeczności w kodzie aplikacji wygrywa ten plik. Tu stoi tylko „nigdy / zawsze”: jak to zrobić, mówią skille `rn-expo-guidelines`, `uniwind`, `expo:*`, `ux-ui-guidelines-mobile`, `supabase-dev-guidelines` i `mobile-e2e-maestro`. `(hook)` oznacza, że regułę sprawdza też hook `mobile-anti-pattern-check.sh` po każdej turze.

## Organizacja kodu

- Testy leżą obok plików źródłowych (`karta.test.tsx` obok `karta.tsx`; po tej parze bramka Stryker wybiera, co mutować). Wyjątek to katalog tras (`src/app` albo `app`), w którym każdy plik jest trasą: testy tras idą do `__tests__/`.
- Logika serwerowa idzie do Supabase Edge Functions, nie do Expo API Routes (`+api.ts`): szablon nie hostuje serwera Expo.
- Stałe i typy importujesz z modułu-liścia, nie z barrela, który ciągnie klienta Supabase albo moduły natywne: barrel wywraca loader testów.

## Zależności

- Paczkę z zestawu SDK instalujesz przez `npx expo install` i nie podbijasz jej ręcznie. Wersję inną niż wskazuje SDK przypinasz dokładnie i dopisujesz do `expo.install.exclude`, żeby `expo install --check` i expo-doctor jej nie cofały.
- Paczki spoza zestawu SDK przypinasz dokładnie.
- Jednostka, która dodaje paczkę z kodem natywnym albo zmienia plugin w app config, deklaruje rebuild dev-clienta: bez niego „Cannot find native module” to błąd środowiska, nie kodu.
- Wersja nightly nie wchodzi do projektu.

## Bezpieczeństwo

- Konfigurację lokalną albo e2e rozpoznajesz w aplikacji po `__DEV__`, a w Edge Function po jej zmiennej środowiska. Zmienna `EXPO_PUBLIC_*` nie jest rozpoznaniem: to tekst w paczce, a żądanie do funkcji może przyjść spoza aplikacji.
- W `EXPO_PUBLIC_*` nie ma sekretów (klucz sekretny Supabase, płatne klucze API): wartość trafia jawnym tekstem do paczki aplikacji, a sekret żyje w Edge Function.
- Parametry trasy i deep linku (`useLocalSearchParams`, URL schematu aplikacji) parsujesz schematem Zod jak każde wejście z zewnątrz; akcja z deep linku nie zakłada, że użytkownik jest już członkiem zasobu.

## Type safety

- Poza `as const` nie używasz `as`. Trasę z parametrem podajesz obiektem `{ pathname, params }`, który typed routes sprawdzają; `href as Href` wyłącza to sprawdzenie.
- `tsconfig` ma flagi rdzenia na `expo/tsconfig.base`. Babel nie pilnuje `erasableSyntaxOnly` (`enum` buduje się i działa), więc jedyną bramką jest `tsc`.

## Performance

- Budżetu paczki nie pilnuje bramka. Wpływ dużej zależności mierzysz przez Expo Atlas (`EXPO_ATLAS=true npx expo export`).
- Ładowania leniwego nie dodajesz na zapas; optymalizujesz po pomiarze.
- Lista długa albo o nieznanej długości to `FlashList` albo `FlatList`, nigdy `.map()` w `ScrollView`.
- Stan wiersza `FlashList` trzymasz w `useRecyclingState`, nie w `useState`: recyklowana komórka przenosi stan na inny element.

## Async i React

- Limit czasu wywołania sieciowego daje `AbortSignal.timeout`. Timeout rozpoznajesz po `signal.reason`, nie po `error.name`: globalny `fetch` to `expo/fetch` i odrzuca `FetchError` o nazwie `Error`. Dotyczy RN 0.88; na starszym RN sprawdzasz, czy API istnieje.
- Włączony React Compiler rozpoznajesz po `experiments.reactCompiler: true` w app config.
- `render`, `fireEvent` i `renderRouter` z RNTL 14 oraz metody `testRouter` wymagają `await`.
- `SharedValue` nie trafia do zależności efektu; tylko prymitywy.

## Prymitywy RN zamiast DOM i Web API

- Bez elementów HTML (`div`, `span`, `button`, `input`, `a`, `img`, `p`): `View`, `Text`, `Pressable`, `TextInput`, `Link` z `expo-router`, `Image` z `expo-image`. Element HTML wywraca render. (hook: bez `img` i `p`)
- Każdy tekst stoi w `<Text>`; goły string w `View` to crash.
- Bez `window.*` i `document.*`; kod tylko dla webu trzymasz w pliku `.web.tsx` albo za `process.env.EXPO_OS === 'web'`. (hook)
- Bez `sessionStorage` i bez `localStorage` poza klientem Supabase z `expo-sqlite/localStorage/install` (sekcja „Dane i sieć”). Sekrety trzymasz w `expo-secure-store`, zwykły cache w `AsyncStorage`. (hook)
- Nawigacja tylko przez `expo-router` (`useRouter`, `usePathname`, `useLocalSearchParams`, `Link`); bez `react-router`, `useNavigate`, `useLocation`. (hook)
- Platformę rozpoznajesz przez `process.env.EXPO_OS` zamiast `Platform.OS`, bo martwa gałąź wypada wtedy z paczki. Duży rozjazd platform to osobny plik `.ios.tsx` albo `.android.tsx`.
- Nie zakładasz API przeglądarki ani Node w Hermesie (`Buffer`, `crypto.subtle`, `Blob` z `fetch`): bierzesz moduł Expo (`expo-crypto`) albo helper projektu.

## Konfiguracja, env i build

- Zmienne klienta tylko jako `process.env.EXPO_PUBLIC_*` czytane statycznie przez kropkę: destrukturyzacji i `process.env[...]` Expo nie podstawi; bez `import.meta.env`. (hook: `import.meta.env`, `process.env[`)
- Priorytet env jest odwrotny w dev i w Release: w dev plik `.env*` wygrywa ze zmienną procesu, w `expo run --configuration Release` i `expo export` wygrywa proces.
- Przy CNG (`ios/` i `android/` poza repo) nie edytujesz katalogów natywnych ręcznie: zmiana idzie przez config plugin w `app.json` albo `app.config.ts`, bo `prebuild` ją nadpisze.
- W config pluginie nie ustawiasz uprawnienia na `false` (`cameraPermission: false`): kasuje klucz `Info.plist` globalnie, także dodany przez inny plugin. Po zmianie pluginów `npx expo prebuild --clean` i sprawdzenie `UsageDescription` w wyniku. (hook)
- `app.json` nie podstawia zmiennych środowiska: wymagany prop config pluginu ma placeholder podmieniany przed buildem, nie pustą wartość.
- `eas build`, `eas submit` i `eas update` uruchamiasz tylko na polecenie operatora: kosztują kredyty albo publikują aplikację użytkownikom.

## Stylowanie

- Projekt na NativeWind (`nativewind` w `package.json`, bez `uniwind`) zostaje na nim: mechanizmy Uniwind z tej sekcji (`Uniwind.setTheme`, `withUniwind`, `accent-*` i `{prop}ClassName`) oraz skill `uniwind` go nie dotyczą, a motyw, owijanie komponentów i kolory propsów bierzesz z istniejącego kodu projektu. Reguły tokenów i klas pełnych nazw obowiązują tak samo; migracja na Uniwind to decyzja operatora.
- Kolor, odstęp i typografia pochodzą z tokenów `@theme` w `global.css`; klasę z planu przed użyciem sprawdzasz grepem w `@theme`, bo klasa bez tokenu to cichy no-op przy zielonym typechecku, linterze i testach. Nie ma `tailwind.config.*`.
- Bez dowolnych kolorów w klasach (`bg-[#hex]`) i bez klas sklejanych z fragmentów (`bg-${x}`): kompilator ich nie widzi. Wariant wybierasz z mapy pełnych nazw klas albo przez `cn()`.
- Ciemny motyw przez warianty `dark:` i `Uniwind.setTheme`, nigdy przez `:root.dark`.
- Komponent spoza RN core (`SafeAreaView` z safe-area-context, `expo-image`, Lottie, mapa) przyjmuje `className` dopiero po owinięciu `withUniwind`. Komponentów `react-native` i Reanimated nie owijasz.
- Prop koloru spoza `style` (`ActivityIndicator.color`, `Switch.thumbColor`, kolory `TextInput`, kolor ikony) dostaje klasę `accent-*` przez `{prop}ClassName`.
- W `TextInput` na iOS nie używasz `lineHeight`: klasa `text-lg` niesie go i przesuwa wpisany tekst poniżej środka pola; piszesz `text-[18px]`.
- Cień przez `boxShadow`, nie `shadow*` ani `elevation`.

## Układ, listy, obrazy, klawiatura, dostępność

- Safe area z `react-native-safe-area-context` (`SafeAreaView` albo `useSafeAreaInsets`), nigdy `SafeAreaView` z `react-native`. Na ekranie stosu przewijany kontener stoi pierwszy, z `contentInsetAdjustmentBehavior="automatic"`. (hook: import z `react-native`)
- `List` z `@expo/ui` tylko dla krótkich list ustawień, bo nie wirtualizuje. Wiersz listy wirtualizowanej nie dostaje animacji `entering`.
- Obraz przez `expo-image`; w liście wirtualizowanej z `recyclingKey`, inaczej mignie poprzednie źródło. Bez `ImageBackground`: `View` i obraz pozycjonowany absolutnie.
- Formularz z klawiaturą stoi w `KeyboardAwareScrollView` z `react-native-keyboard-controller`, z `keyboardShouldPersistTaps="handled"`; główna akcja nie chowa się pod klawiaturą; bez `Keyboard.addListener` z ręczną animacją.
- Zanim napiszesz arkusz, picker, slider, przełącznik albo menu, sprawdzasz odpowiednik w `@expo/ui`.
- Nie wyłączasz `allowFontScaling`; `maxFontSizeMultiplier` stawiasz tylko tam, gdzie układ nie ma wyjścia (pasek kart).
- Element interaktywny bez widocznego tekstu ma `role` albo `accessibilityRole` i `accessibilityLabel`.

## Nawigacja i cykl życia ekranu (Expo Router)

- Przekierowanie po logowaniu i rejestracji wynika z efektu na stanie sesji (guard w layoucie), nie z `router.replace` po `await` w handlerze: przy sesji, która jeszcze nie dotarła, powstaje pętla przekierowań.
- Autoryzację trasy niesie layout grupy: przeniesienie trasy do innej grupy albo stosu wymaga przeglądu guardów.
- Ekran pod stosem zostaje zamontowany: dane po powrocie odświeżasz w `useFocusEffect`, hook danych wystawia `refetch` także w stanie `ready`, a odświeżenie pokazuje ostatni wynik zamiast pustego stanu.
- `visible` natywnego `<Modal>` zależy od jawnie potwierdzonej wartości, nigdy od negacji stanu async (`!isGranted` obejmuje też `null`): osierocony modal zjada dotyk całego ekranu.
- Nawigację po zamknięciu modala robisz w `onDismiss`; przed `router.push` zamykasz stanem wszystkie przezroczyste modale.

## Uprawnienia

- Status uprawnienia `null` znaczy „nie wiem” i nie pokazuje żadnego UI; sprawdzenie bez promptu robisz przez `get*PermissionsAsync`, a błąd przejściowy (np. timeout lokalizacji) to nie `denied`.
- O uprawnienie prosisz przy akcji, która go potrzebuje, nie na starcie; odmowa ma ścieżkę do ustawień systemu.

## Dane i sieć

- Sesję Supabase trzymasz w domyślnym wariancie z `expo-sqlite/localStorage/install`, z `detectSessionInUrl: false`. `LargeSecureStore` to opcja dla aplikacji z danymi wrażliwymi: wybór i powód zapisujesz w planie zadania.
- Upload binarki do Storage idzie przez `ArrayBuffer` albo `Uint8Array` (z base64), nigdy przez `Blob` z `fetch().blob()`: RN wysyła wtedy plik 0 B z odpowiedzią 200. Sukces potwierdzasz rozmiarem obiektu > 0.
- Z TanStack Query podpinasz `focusManager` do `AppState` i `onlineManager` do NetInfo: RN nie ma zdarzeń okna, więc bez tego nie ma odświeżenia po powrocie z tła ani po odzyskaniu sieci.
- Brak sieci to stan normalny: ekran pokazuje ostatnie dane z informacją o błędzie, a zapis bez sieci kończy się jawnym błędem albo kolejką, nie spinnerem bez końca.

## Animacje i haptyka

- Animowana lista to `Animated.FlatList<T>` z Reanimated, nie `createAnimatedComponent(FlatList)`: ten gubi generyk.
- Krzywą podajesz helperem `cubicBezier`, nie surowym stringiem; do stylów Reanimated nie przekazujesz `PlatformColor`.
- Animacja respektuje ograniczenie ruchu (`useReducedMotion`, `ReduceMotion.System`).
- Haptyka komunikuje wynik (`notificationAsync` w kodzie wywołującym, po zatwierdzeniu), atomy UI nie wołają `Haptics`; haptyka nigdy nie niesie jedynej informacji.

## Testowanie

- Komponent testujesz przez `@testing-library/react-native`; szczegóły w sekcji niżej.

## Testy jednostkowe (jest-expo + React Native Testing Library)

- Komponent testujesz przez `@testing-library/react-native` (zapytania po roli i tekście, `testID` na końcu); asercja dotyczy zachowania, nigdy `className` ani snapshotu stylów: wygląd sprawdza smoke na urządzeniu.
- Nawigację testujesz przez `renderRouter` z `expo-router/testing-library`. Przy `experiments.typedRoutes` nawigujesz przez `testRouter`, bo `<Link>` z fikcyjną trasą nie przechodzi `tsc`.
- Moduły natywne (Reanimated, worklets, kamera, Skia, Sentry, powiadomienia) mają globalne atrapy w setupie runnera; nowe API dopisujesz do globalnej atrapy, a lokalny `jest.mock` tych modułów jest zakazany: pusta lokalna atrapa wybucha, gdy dziecko zacznie animować.
- Komponent, który pośrednio wpina transport realtime, ma w teście stub na granicy hooka transportu.
- Po `jest.useFakeTimers()` z renderem odmontowujesz drzewo przed `jest.useRealTimers()`: inaczej timery wyciekają do losowego następnego pliku.
- Preset testów raportuje jedną platformę: kod z gałęzią `EXPO_OS` albo `Platform.OS` ma test drugiej gałęzi albo punkt w smoke'u operatora.

## Selektory E2E a dostępność

- `testID` stoi na elemencie widocznym w drzewie dostępności: nie na kontenerze z `accessibilityElementsHidden`, nie na kontenerze natywnego `<Modal>` ani pod węzłem z `accessible` i `accessibilityLabel` (iOS skleja poddrzewo). Element z dynamicznym tekstem dostaje `testID`.
- `testID` użyty w kroku `[E2E]` planu istnieje w kodzie albo powstaje w tej samej jednostce.
