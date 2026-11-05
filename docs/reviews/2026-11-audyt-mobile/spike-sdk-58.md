# Spike Expo SDK 58 — wyniki

Data: 2026-11-05. Projekt testowy: `/Users/kacper_trzepiecinski/Documents/Kodowanie/spike-expo-58` (poza repo, zostaje na
dysku). Dowody: `spike-expo-58/dowody/` (raporty aplikacji z urządzeń, zrzuty ekranu, strumienie `claude -p`, skrypty).

Punkty 1–5 sprawdzone na symulatorze iOS 26.4 (iPhone 17) i emulatorze Android (AVD `Pixel_8`), dev-client budowany
lokalnie (`npx expo run:*`), bez EAS, kont i usług. Aplikacja wysyła wyniki do lokalnego serwera; wartości stylów pochodzą
z `useResolveClassNames` i `onLayout`, a wygląd ze zrzutów.

## Wyniki

| # | Punkt | iOS | Android | Decyzja |
|---|---|---|---|---|
| 1a | Uniwind: `TextInput` + `className` | PASS (z uwagą o `lineHeight`) | PASS | D7 potwierdzona |
| 1b | Uniwind: line-height | PASS | PASS | D7 potwierdzona |
| 1c | Uniwind: `translate` w % | PASS | PASS | D7 potwierdzona |
| 1d | Uniwind: `boxShadow` | PASS | PASS | D7 potwierdzona |
| 1e | Uniwind: `rem` vs „1 pt Figma = 1 px” | PASS | PASS | D7 potwierdzona |
| 2 | jest-expo + RNTL 14 + Jest 30 | PASS (runner w Node) | nie dotyczy | D8 potwierdzona, konfiguracja szersza niż w docs |
| 3 | `tsconfig` rdzenia z `expo/tsconfig.base` | PASS | PASS | bez wyjątku w `stack.md` |
| 4 | `AbortSignal.timeout` w RN 0.88/Hermes | PASS (Debug i Release) | PASS (Debug); Release niesprawdzone | reguła z A0.5 §2 jest błędna |
| 5a | Zmiana `.env` po reloadzie bez restartu Metro | PASS | PASS | D13: alternatywa istnieje |
| 5b | Env procesu Metro zamiast swapu | FAIL w trybie dev | FAIL w trybie dev | D13: wariant odpada |
| 5c | `.env.<mode>` zamiast swapu | FAIL | niesprawdzone (źródło i `expo start` to samo) | D13: wariant odpada |
| 5d | `.env.development.local` (kandydat ze spike'u) | PASS | niesprawdzone | **decyzja operatora** |
| 6a | `deny` dla `@expo/agent-cli feedback` przy `bypassPermissions` | PASS | nie dotyczy | D6 potwierdzona |
| 6b | Ta sama lista reguł przy pluginie z `claude-plugins-official` | FAIL | nie dotyczy | **rozjazd z D6** |
| 7 | `expo:*` przez `Skill` w builderze, po polsku | PASS | nie dotyczy | D6 potwierdzona; **źródło pluginu do decyzji** |

## Wersje

Sprawdzone 2026-11-05 w `node_modules` projektu testowego i `npm view`:

| Paczka | Wersja | Uwaga |
|---|---|---|
| `expo` | 58.0.23 (`latest`) | szablon `default@sdk-58`; `create-expo-app@latest` bez `--template` daje na razie SDK 57 ([docs](https://docs.expo.dev/get-started/create-a-project/), zmiana 2026-11-02) |
| `react-native` / `react` | 0.88.1 / 19.3.0 | |
| Hermes | Static Hermes, bytecode 99, OSS 260318099.0.5 | odczyt `HermesInternal.getRuntimeProperties()` na urządzeniu |
| `typescript` | 6.0.3 | |
| `uniwind` / `tailwindcss` | 1.13.1 (2026-10-28) / 4.3.4 | wersja Free |
| `jest` / `jest-expo` | 30.5.2 / 58.0.14 (2026-11-03) | |
| `@testing-library/react-native` / `test-renderer` | 14.1.0 / 1.3.0 | `test-renderer` to peer RNTL, npm dokłada go sam |
| `@react-native/jest-preset` | 0.88.1 | |
| Claude Code | 2.1.318 | modele prób: `sonnet` (pkt 7), `haiku` (pkt 6) |
| plugin `expo@claude-plugins-official` | 1.13.9, SHA `d4f4840` (2026-10-05) | upstream `expo/skills`: 1.14.3, `a9e5bd3` (2026-11-01), 10 commitów dalej |

`npx expo-doctor`: 20/20. Menedżer pakietów w spike'u: npm. pnpm i bun: niesprawdzone.

## 1. Uniwind (D7)

Konfiguracja wg [quickstartu](https://docs.uniwind.dev/quickstart): `npx expo install uniwind tailwindcss`,
`withUniwindConfig` w `metro.config.js`, `@import 'tailwindcss'; @import 'uniwind';` w `src/global.css`. Bez Babela.

- **`TextInput` + `className`.** Pisanie na obu platformach bez crasha, kontrolowana wartość wraca do `echo`, wysokość
  `h-12` = 48, kolory, ramka i `px-4` działają. `placeholderTextColorClassName`, `cursorColorClassName` i
  `selectionColorClassName` z prefiksem `accent-` działają, także z własnym tokenem (`accent-spike`).
  **Uwaga, tylko iOS:** klasa `text-lg` niesie `lineHeight: 28`, a przy `lineHeight` wpisany tekst siedzi w polu ok. 7 pt
  poniżej środka (placeholder ok. 3,5 pt). Pole `text-[18px]` bez `lineHeight` jest wyśrodkowane. Android bez przesunięcia.
  Nie rozdzielałem, czy to zachowanie RN, czy Uniwind: próby przez samo `style` nie było.
- **Line-height.** Działają: sufiks `--text-display--line-height` w `@theme` (48/52, zmierzone 52,3), `leading-[60px]`,
  `leading-6`, `text-sm leading-[30px]`, sufiks w `rem` (2rem/3rem → 32/48).
- **`translate` w %.** `-translate-x-1/2`, `translate-y-full` i `translate-x-[50%]` dają `transform` z procentami i właściwą
  pozycję; `translate-x-[50%]` jest na zrzucie w tym samym miejscu co próba kontrolna `style={{ transform: [{ translateX: '50%' }] }}`.
- **`boxShadow`.** `shadow-lg`, `shadow-[0_8px_16px_rgba(0,0,0,0.5)]`, `shadow-lg shadow-red-500` i `style={{ boxShadow }}`
  rysują się na obu platformach. Klasy kompilują się do `boxShadow`, nie `shadow*`/`elevation`.
- **`rem`.** `w-4` = `w-[1rem]` = `w-[16px]` = 16, `p-4` = 16, `text-sm` = 14/20. Domyślne `rem` to 16 ([metro-config](https://docs.uniwind.dev/api/metro-config.md)),
  skala jak na webie. Wartość arbitralna w `px` równa się pt, więc „1 pt Figma = 1 px” działa wprost.
- Tryb Release na iOS wygląda tak samo jak Debug (`dowody/ios-release-*.png`).

Skutek dla `rules/stack.md`: wypada blok „Tylko NativeWind v5” (A0.5 §2, grupa „Stylowanie”); dochodzi reguła o
`lineHeight` w `TextInput` i o prefiksie `accent-`. Reguła „Cień przez `boxShadow`” zostaje, A0.5 §7 pyt. 3 zamknięte.

## 2. jest-expo + RNTL 14 + Jest 30 (D8)

Wynik: `npx jest --watchAll=false` → 3 zestawy, 4 testy zielone, wszystkie w `__tests__/`, poza katalogiem tras:

- test komponentu: `await render`, `await fireEvent.press`, `getByRole`, `toBeOnTheScreen` bez dodatkowego setupu;
- nawigacja przez `renderRouter` z mapą tras i `testRouter.push/back`, `toHavePathname`, `toHaveSearchParams`, `initialUrl`;
- `renderRouter('./src/app')` na prawdziwym katalogu tras.

Kontrola negatywna: po zmianie `count + 1` na `count + 2` test komponentu pada („Unable to find… Punkty: 1”), a zły
`toHavePathname('/inna')` pada (`Received: "/profil"`).

Konfiguracja z [docs Expo](https://docs.expo.dev/develop/unit-testing/) (zmiana 2026-11-02) nie wystarcza. Kolejne błędy i naprawy:

| Objaw | Przyczyna | Naprawa |
|---|---|---|
| `Must use import to load ES Module: standard-navigation` | wzorzec `transformIgnorePatterns` z docs nie ma `standard-navigation`, a Expo Router 58 go wymaga | nie kopiować wzorca z docs; bez `uniwind` wystarcza domyślny preset |
| to samo dla `uniwind/src/index.ts` | kod testowany importuje z `uniwind` | wzorzec z `jest-expo/jest-preset.js` + `uniwind` |
| `SyntaxError` na `@import 'tailwindcss'` | `@/global.css` | `moduleNameMapper`: `"\\.css$"` → stub |
| `Could not locate @/assets/...` mapped to `src/$1` | `jest-expo` przepisuje `paths` z `tsconfig`, `@/*` wygrywa z `@/assets/*` | `moduleNameMapper`: `"^@/assets/(.*)$"` |
| `Cannot read properties of undefined (reading 'elastic')` | Reanimated w Jest | `resolver: "react-native-reanimated/jest/resolver"` ([docs](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/)); atrapa `react-native-worklets` nie była potrzebna w tych 4 testach |

Oraz:
- przy `experiments.typedRoutes: true` `<Link href="/profil/42">` w teście z fikcyjną trasą nie przechodzi `tsc` (TS2322);
  w teście nawigujesz przez `testRouter`;
- `render` i `fireEvent` w RNTL 14 też są asynchroniczne, nie tylko `renderRouter`;
- `@expo/env` nie ładuje `.env.local` w trybie `test` (kod `getEnvFiles`). Tego nie sprawdzałem testem.

Skutek: `walidacja.md` (IU-2.5) i szablon konfiguracji Jest niosą tę tabelę. Reguła w `stack.md` o `await` obejmuje też
`render` i `fireEvent`.

## 3. `tsconfig` rdzenia (A0.5 §7 pyt. 4)

Flagi: `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly` + `types: ["jest"]` na `expo/tsconfig.base`.

- `npx tsc --noEmit`: kod 0 (po poprawkach niżej).
- Kontrola negatywna: `enum` i `constructor(private ...)` dają TS1294, czyli flagi działają.
- Metro/Babel: `npx expo export --platform ios --platform android` daje `.hbc` na obie platformy, aplikacja działa w Debug
  (iOS, Android) i Release (iOS). W nieminifikowanej paczce nie ma modułu importowanego przez `import type` (marker
  `SPIKE_TYPE_ONLY_MARKER` nieobecny), a `import { x, type T }` działa.
- **Babel nie pilnuje tych flag:** `enum` i parameter property budują się i działają na urządzeniu. Jedyną bramką jest `tsc`.

Co trzeba zrobić, żeby `tsc` było zielone:
1. Szablon `default@sdk-58` ma 6 importów typów bez `type` (TS1484, 5 plików: `external-link`, `themed-text`, `themed-view`,
   `collapsible`, `app-tabs.web`). Naprawa mechaniczna.
2. `app-tabs.web.tsx(38)` daje TS2322 na `ref` także bez naszych flag (kontrola `tsconfig.kontrola-bazowa.json`): to defekt
   szablonu Expo, nie flag. W spike'u obejście przez wycięcie `ref` z propsów.
3. `expo-env.d.ts` i `.expo/types` są w `.gitignore` i powstają przy `expo start`. Bez nich TS2882/TS2307 na `.css`. Bez
   Metro generuje je `npx expo customize tsconfig.json` (sprawdzone po przeniesieniu obu i ponownym uruchomieniu).
4. `src/uniwind-types.d.ts` generuje Metro; bez niego każdy `className` to TS2322. Nie jest w `.gitignore`, więc commitujesz go.

Skutek: wyjątek w `stack.md` niepotrzebny. Rozgrzewka w `walidacja.md`: `expo customize tsconfig.json` przed typecheckiem na
czystym checkoucie.

## 4. `AbortSignal.timeout` w RN 0.88/Hermes (A0.5 §7 pyt. 5)

Wynik z urządzenia, `dowody/spike-report.jsonl` (iOS Debug, iOS Release z `Debugger Enabled: false`, Android Debug):

```
typeof AbortSignal.timeout = function, AbortSignal.any = function, throwIfAborted = function
AbortSignal.timeout(300) → aborted: true, reason.name: TimeoutError
fetch(/hang, { signal: AbortSignal.timeout(300) }) → odrzucone po ok. 310 ms:
  error.name = "Error", konstruktor FetchError, "fetch failed: Fetch request has been canceled"
  signal.reason = TimeoutError: signal timed out
AbortController + setTimeout → odrzucone po ok. 300 ms, ten sam FetchError, reason = AbortError
```

Implementacja jest w samym RN, nie w Expo: `react-native/src/private/webapis/dom/abort-api/AbortSignal.js`, instalowana w
`setUpXHR.js` bez warunku `__DEV__`. Weszła commitem `6f3375a` z 2026-06-30 („Replace abort-controller…”, [historia pliku](https://github.com/facebook/react-native/commits/main/packages/react-native/src/private/webapis/dom/abort-api/AbortSignal.js)).
[Issue #42042](https://github.com/facebook/react-native/issues/42042) jest nadal otwarte (2026-11-05), ale nieaktualne dla 0.88.

Skutek:
- reguła z A0.5 §2 („Limit czasu daje helper z `AbortController`, nie `AbortSignal.timeout`”) i propozycja wzorca hooka wypadają;
- w `stack.md` mobile, sekcja „Async i React”: limit daje `AbortSignal.timeout`, **a timeout rozpoznajesz po `signal.reason`,
  nie po `error.name`** — globalny `fetch` w Expo to `expo/fetch` i odrzuca `FetchError` o nazwie `Error`, nie
  `TimeoutError`/`AbortError` jak w przeglądarce;
- dotyczy projektów na RN 0.88. Starszych wersji nie sprawdzałem (`Nawykometr` jest na SDK 55).

## 5. Alternatywa dla swapu `.env.local` (D13)

[Dokumentacja](https://docs.expo.dev/guides/environment-variables/) (zmiana 2026-11-02) mówi: zmiana bez restartu CLI, nowe
wartości po pełnym reloadzie. Reload wysyłany przez `ws://localhost:8081/message` (jak klawisz `r`).

| Próba (Metro działa) | Wynik |
|---|---|
| zmiana wartości w `.env` i `.env.local`, reload | nowa wartość (iOS, Android) |
| zmiana w `.env`, **bez** reloadu | nowa wartość dotarła sama (aplikacja przysłała raport z nową wartością); docs wymagają reloadu, więc adapter i tak go wysyła |
| nowa zmienna dopisana po starcie Metro, reload | widoczna |
| zmienna usunięta z `.env.local`, reload | powrót do wartości z `.env` |
| **`.env.development.local` utworzony, reload** | wartość z tego pliku przykrywa `.env.local` |
| **`.env.development.local` usunięty, reload** | powrót do `.env.local`, plik `.env.local` nietknięty |
| `CI=1 npx expo start`, zmiana `.env.local`, reload | **stara wartość** (CLI: „`CI=1` turns off file watching”) |

| Inny wariant z D13 | Wynik |
|---|---|
| Restart Metro z `EXPO_PUBLIC_X=proces`, gdy `X` jest też w `.env.local`, dev | **plik wygrywa.** Przyczyna w `@expo/metro-config/.../transform-worker.js`: `{ ...process.env, ...[pliki] }` |
| To samo z `EXPO_NO_DOTENV=1` | `.env.local` dalej wygrywa z procesem (`.env` w tej próbie zniknął; jedna próba, przyczyny nie ustalałem) |
| Zmienna **nieobecna** w plikach, tylko w procesie, restart bez `--clear` | działa, bez starej wartości z cache |
| `.env.e2e` | nieładowany. [Docs](https://docs.expo.dev/guides/environment-variables/): od SDK 58 komendy ładują tylko pliki trybu; `expo start` nie ma `--env-file` |
| Release (`expo run:ios --configuration Release`) i `expo export` z tą samą zmienną w procesie i pliku | **proces wygrywa** (`envLocal: "proces-release"`, `"proces-export"`) |

Wniosek: dev i Release mają odwrotny priorytet proces/plik. Env procesu nie zastępuje swapu w trybie dev.

Kandydat: **adapter E2E zapisuje `.env.development.local` i usuwa go po przebiegu.** Plik ma najwyższy priorytet w dev, jest
w `.gitignore` szablonu (`.env*.local`), a `.env.local` operatora zostaje nietknięty, więc nie ma rollbacku pliku użytkownika. Warunki:
- jeśli `.env.development.local` istnieje, adapter go nie nadpisuje bez zachowania kopii;
- Metro nie może działać z `CI=1`;
- po zapisie adapter wysyła reload;
- sprzątanie przy awarii: pozostawiony plik przykrywa dev bez żadnego sygnału, więc doctor/start musi go wykrywać.

Na Androidzie sprawdzony sam reload po zmianie `.env`; próba z `.env.development.local` tylko na iOS. Mechanizm jest w
paczce JS, wspólnej dla platform, ale próby nie było.

## 6. Reguła `deny` dla feedbacku (D6, A0.2 §9 pyt. 3)

Układ próby: `claude -p --permission-mode bypassPermissions --setting-sources project,local`, reguły w `.claude/settings.json`
projektu, `npx`/`npm`/`pnpm`/`bunx` to atrapy w PATH zapisujące wywołanie, rejestr npm martwy, cache pusty. Do Expo nic nie wyszło.

| Komenda | Kontrola bez reguł | Lista z A0.2 | Lista + `submit-expo-feedback` |
|---|---|---|---|
| `npx --yes @expo/agent-cli@latest feedback …` | wykonana | **zablokowana** | zablokowana |
| `npx @expo/agent-cli feedback`, `npx -y …`, `npm exec`, `pnpm dlx`, `bunx` | wykonana | zablokowana | zablokowana |
| `env FOO=1 npx …`, `cd . && npx …`, `sh -c 'npx …'` | wykonana | zablokowana | zablokowana |
| `npx --yes @expo/agent-cli@latest --help` | wykonana | zablokowana | zablokowana |
| `npx --yes "@expo/agent"-cli@latest feedback` (rozcięcie cudzysłowem) | wykonana | **wykonana** | **wykonana** |
| `npx --yes submit-expo-feedback@latest …` | wykonana | **wykonana** | zablokowana |
| `echo kontrola-dozwolona` | wykonana | wykonana | wykonana |

Te same dwie komendy (`agent-cli`, `submit-expo-feedback`) zablokowane z listą rozszerzoną także w **subagencie** (`Agent`,
typ `builder-rn`) i w **agencie Workflow** (`agent()` z `agentType`, czyli ścieżka autopilota). Wpisy w `permission_denials` strumienia.

Dlaczego A0.2 nie wystarcza: instalowany dziś plugin (1.13.9) w każdym SKILL.md każe wołać
`npx --yes submit-expo-feedback@latest`, a nie `@expo/agent-cli`. Lista z A0.2 opisuje upstream `a9e5bd3`.

W tej wersji pluginu są też hooki `PostToolUse[Skill]` i `UserPromptExpansion` (`skill-event.cjs`, telemetria), wyłączone do
jawnego włączenia (`if (!args.dryRun && !telemetryActive()) return 0`). Ruchu sieciowego nie mierzyłem.

Skutek dla IU-2.7: do `deny` dochodzi `Bash(*submit-expo-feedback*)`. `deny` to dopasowanie tekstu: chroni przed instrukcją ze
skilla, nie przed celowym obejściem. W 8 próbach z punktu 7 nie było próby wysłania feedbacku: log atrapy pusty, `permission_denials` puste. Osiem krótkich prób bez porażki buildera nie sprawdza scenariusza „agent repeatedly fails”, w którym skill zachęca do zgłoszenia.

## 7. Skille `expo:*` przez `Skill` w builderze (D6)

Agent `builder-rn`: `tools: Read, Grep, Glob, Bash, Edit, Write, Skill`, bez preloadu, w treści ani słowa o skillach. Zapisy
zablokowane `--disallowedTools`. Model `sonnet`, plugin w zakresie projektu. Liczą się wywołania `Skill` ze strumienia.

| Ścieżka | Polecenie | Załadowany skill |
|---|---|---|
| `--agent builder-rn` | PL: ekran z własnym stosem i arkuszem | `expo:expo-router` |
| `--agent builder-rn` | PL: animacja karty | `expo:expo-animation` |
| `--agent builder-rn` | EN: ekran z własnym stosem i arkuszem | `expo:expo-router` |
| `--agent builder-rn-skille` (ze zdaniem o `expo:*`) | PL: ekran | `expo:expo-router` |
| `--agent builder-rn-skille` | PL: animacja | `expo:expo-animation` |
| subagent `Agent`, typ `builder-rn` | PL: ekran | `expo:expo-router` (`parent_tool_use_id` ustawiony) |
| agent Workflow, `agentType: 'builder-rn'` | PL: ekran | `expo:expo-router` (transkrypt agenta; pierwszy przebieg bez zapisu transkryptu, powtórzony) |

Jedna próba na komórkę, to nie jest pomiar częstości. Sformułowanie o skillach w treści buildera nie było w tych próbach potrzebne.

Uwaga: `builder-rn` przeczytał `expo-router/references/form-sheet.md` i sam zauważył „Skill opisuje API z SDK 55”, po czym
sprawdził `.d.ts` w `node_modules`. Wersja 1.13.9 nie ma w `SKILL.md` ani referencjach słów „SDK 58” (grep). Zdanie planu
„świeżość zapewnia upstream” ma granicę: oficjalny marketplace przypina SHA, który może być starszy od bieżącego SDK.

## Decyzje operatora (2026-11-05)

Przyjęte rekomendacje: D6 `expo@claude-plugins-official` + `deny` także dla `submit-expo-feedback`; D11 `zastap` zostaje z
powodem „obcy Metro może serwować paczkę innego projektu”; D13 `.env.development.local` zamiast swapu. Zapis:
`00-decyzje.md`, sekcja „Korekty po spike'u SDK 58”; plan: IU-2.3, IU-2.7, sekcja „Decyzje”. Sekcja niżej zostaje jako zapis
stanu przed decyzją.

## Rozjazdy z planem i audytem

1. **D6 / IU-2.7 / A0.2: nazwa pluginu.** Plan: `expo@expo-plugins`. [Dokumentacja Expo](https://docs.expo.dev/agents/claude/)
   (zmiana 2026-11-02) i szablon `default@sdk-58` (`.claude/settings.json`): `expo@claude-plugins-official`.

   | | `expo@claude-plugins-official` | `expo@expo-plugins` |
   |---|---|---|
   | Wersja dziś | 1.13.9, przypięty SHA z 2026-10-05 | 1.14.3, `main` |
   | Przypięcie | w marketplace (A0.2 §9 pyt. 2 zamknięte) | brak bez własnego marketplace'u |
   | Feedback | `submit-expo-feedback`, skill z warunkiem zgody i zakazem przy headless | `@expo/agent-cli`, bez warunku |
   | Hooki | są, telemetria domyślnie wyłączona | usunięte |
   | Instalacja | u operatora marketplace już skonfigurowany | trzeba dodać marketplace `expo/skills` |
   | W tym spike'u | sprawdzony | **niesprawdzony** (A0.2 sprawdzał na `a9e5bd3`) |

2. **D13:** warianty „env procesu Metro” i `.env.<mode>` odpadają na SDK 58. Nowy kandydat: `.env.development.local`.
3. **D11:** uzasadnienie „dev-client czyta env przy starcie Metro” nie jest dokładne: wartości z plików dochodzą przez paczkę,
   bez restartu Metro. Polityka `zastap` może być słuszna z innego powodu (obcy projekt na porcie), ale to trzeba nazwać.
4. **A0.5 §2:** reguła o helperze zamiast `AbortSignal.timeout` jest błędna dla RN 0.88.
5. **Układ katalogów:** szablon SDK 58 trzyma trasy w `src/app`, kod w `src/components`, `src/hooks`, `src/constants`, a CSS w
   `src/global.css`. Plan i A0.5 piszą `app/`, `components/`, `lib/`, `global.css`.
6. **Sekcje `rules/stack.md`:** projekt z A0.5 §2 nie ma sekcji, do których odsyła rdzeń (lista niżej).

## Proponowane korekty planu

Naniesione po decyzjach z 2026-11-05: logika env w IU-2.3 oraz nazwa pluginu i `deny` w IU-2.7. Reszta tej listy naniesiona w planie 2026-11-05 (gałąź `popr/korekty-po-spike`).

**`rules/stack.md` mobile (IU-2.8).** Rdzeń odsyła po nazwie do sekcji, których projekt A0.5 §2 nie ma. Doliczyć je obok grup
tematycznych, z treścią:

| Sekcja rdzenia | Treść | Podstawa |
|---|---|---|
| Organizacja kodu | testy poza katalogiem tras (`src/app` albo `app`), w `__tests__/` | pkt 2, docs |
| Zależności | `npx expo install` dla paczek SDK; preferencja z „Zależności natywne” | A0.5, `AGENTS.md` szablonu |
| Bezpieczeństwo | rozpoznanie konfiguracji lokalnej/e2e | **niesprawdzone**, do ustalenia w IU-2.8 |
| Type safety | wyjątki od `as`: bez zawężania DOM; lista do ustalenia | **niesprawdzone** |
| Performance | bez size-limit; budżet paczki i ładowanie leniwe do ustalenia | A0.5; **niesprawdzone** |
| Async i React | `AbortSignal.timeout`, rozpoznanie po `signal.reason`; Compiler: `experiments.reactCompiler: true` | pkt 4; log Metro „React Compiler enabled” |

Oraz: usunąć blok „Tylko NativeWind v5” i regułę o helperze; dodać `accent-*` dla `TextInput`, `lineHeight` w `TextInput`
na iOS, priorytet proces/plik dev vs Release; `paths:` `global.css` → `**/global.css`; „Testów nie kładziesz w `app/`” → też `src/app`.

**Etap 2:**
- IU-2.1: bez zdania o `expo:*` w treści buildera próby przeszły; `Skill` w `tools:` wystarcza, zdanie opcjonalne.
- IU-2.3: logika env wg decyzji o D13; reload przez `/message`; `CI` usunięte z env Metro; `LANG=en_US.UTF-8` dla
  `pod install` (bez tego CocoaPods pada na `Unicode Normalization not appropriate for ASCII-8BIT` w powłoce bez locale).
- IU-2.4: to samo `LANG` w bramce natywnej. Gradle sam dociąga platformę Android 37 przy pierwszym buildzie.
- IU-2.5: routing `buildery.md` dla `src/app`; `walidacja.md`: konfiguracja Jest z tabeli pkt 2, rozgrzewka
  `expo customize tsconfig.json`, commit `uniwind-types.d.ts`; `expo-doctor` przechodzi 20/20 na tym zestawie.
- IU-2.6/IU-2.3: na symulatorze z zalogowanym kontem Apple monit „Weryfikacja konta Apple” zasłania aplikację i nie zamyka się
  wstrzykniętym dotknięciem. Doctor albo adapter używa urządzenia bez konta. Pierwsze otwarcie deep linku pokazuje „Otworzyć w…”.
- IU-2.7: nazwa pluginu wg decyzji; `deny` + `Bash(*submit-expo-feedback*)`; `AGENTS.md` i `.claude/settings.json` przychodzą z
  szablonu Expo, więc nakładka musi ustalić, co z nimi przy syncu.
- Etap 5 (świeżość skilli): dopisać, że przypięty plugin może być starszy od SDK.

## Niesprawdzone

- Android w konfiguracji Release: `AbortSignal.timeout`, style, priorytet env (brak buildu; iOS Release i `.hbc` Androida przeszły).
- `.env.development.local` na Androidzie.
- Hermes na fizycznym urządzeniu: tylko symulator i emulator.
- pnpm i bun: `transformIgnorePatterns`, peer `test-renderer`, peery `metro*` Uniwind.
- `expo@expo-plugins` w tym spike'u: punkty 6 i 7 tylko na `expo@claude-plugins-official`.
- `deny` poza listą prób (skrypt z pliku, `node -e`) i w sesji interaktywnej.
- `withUniwind`, `dark:`/`Uniwind.setTheme`, `tailwind-merge`: poza zakresem spike'u.
- Punkty wymagające usług (Supabase, EAS): nie dotyczyły tej listy, niczego nie uruchamiano.

## Ślady poza folderem spike'u

- `~/.claude/settings.json`: bez zmian (SHA `575616f` przed i po).
- `~/.claude/plugins/installed_plugins.json`: wpis `expo@claude-plugins-official`, `scope: project`, `projectPath` spike'u.
  `known_marketplaces.json`: inny hash po instalacji, widoczny nowy `lastUpdated`; kopii sprzed nie mam, więc innych różnic nie
  wykluczam. Cache: `~/.claude/plugins/cache/claude-plugins-official/expo/1.13.9`. Cofnięcie: w folderze spike'u
  `claude plugin uninstall expo@claude-plugins-official --scope project`.
- `~/.claude/projects/-Users-…-spike-expo-58`: transkrypty sesji `claude -p`.
- Android SDK: dociągnięta platforma 37 (Gradle, licencja wcześniej zaakceptowana); `~/.gradle`: dystrybucja 9.4.1.
- Symulatory `iPhone 17 Pro`, `iPhone 17` i AVD `Pixel_8`: zainstalowana aplikacja spike'u; wszystkie wyłączone po testach.
- `vibersi`, `gramywpadla`, `Nawykometr`: tylko listing katalogu dwóch ostatnich (typ lockfile), bez zmian.
