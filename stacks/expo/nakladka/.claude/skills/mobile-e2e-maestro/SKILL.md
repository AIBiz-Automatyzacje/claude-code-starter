---
name: mobile-e2e-maestro
description: "Automatyzacja testów E2E mobile przez Maestro CLI. Nawigacja, tap, scroll, gesty (swipe, long press, pinch), input, asercje, screenshoty na emulatorze iOS/Android. Deep linking, OAuth flow, biometry. Używaj przy 'testuj UI mobilne', 'zrób screenshot apki', 'agent-mobile', 'E2E mobile', sprawdzaniu scenariuszy [E2E] w fazie review."
---

# Mobile E2E Testing with Maestro

CLI do automatyzacji testów E2E aplikacji mobilnych iOS/Android. Działa na zbudowanej aplikacji w emulatorze albo symulatorze i testuje to, co użytkownik widzi i klika.

## Setup Check

```bash
command -v maestro >/dev/null 2>&1 && echo "Installed: $(maestro --version)" || echo "NOT INSTALLED — instalacja: curl -fsSL 'https://get.maestro.mobile.dev' | bash"
```

**Wymagania platformowe:**
- **Java 17+** wymagane przez CLI — `JAVA_HOME` musi wskazywać na instalację Java 17+ (sprawdź: `java -version`)
- **iOS:** macOS + Xcode + iOS Simulator (otwarte: `open -a Simulator`)
- **Android:** Android Studio + emulator AVD (uruchomiony: `emulator -avd <name>`)
- Aplikacja zbudowana i zainstalowana: dev-client z `expo run:ios` / `expo run:android` (Maestro wspiera development buildy i Expo Go)

## Core Workflow

1. **Launch:** uruchom emulator + zainstaluj aplikację (build z dev clienta wystarczy)
2. **Flow YAML:** zapisz scenariusz w pliku `.yaml` (folder `.maestro/`)
3. **Run:** `maestro test .maestro/login-flow.yaml`
4. **Inspect:** artefakty domyślnie w `~/.maestro/tests`; lokalizację zmienia `maestro test --test-output-dir=<dir>`. `takeScreenshot: nazwa` zapisuje zrzut w podkatalogu tego katalogu (Maestro 2.5.1: `screenshots/`), a od Maestro 2.8 ścieżki poza katalogiem artefaktów są odrzucane (`Invalid path`). Pliki `commands-*.json` z tego katalogu i z `~/.maestro/tests` zapisują wartości zmiennych `-e`, także hasła, więc nie kopiujesz ich do repo ani do raportu. Wideo powstaje tylko przy jawnym `startRecording`/`stopRecording` (albo `maestro record`)

```yaml
# .maestro/login-flow.yaml
appId: com.example.myapp     # iOS bundle ID albo Android package name
---
- launchApp
- assertVisible: "Zaloguj się"
- tapOn: "Email"
- inputText: "test@example.com"
- tapOn: "Hasło"
- inputText: "haslo123"
- tapOn:
    text: "Zaloguj"
    enabled: true
- waitForAnimationToEnd
- assertVisible: "Witaj, Test"
- takeScreenshot: login-success
```

```bash
maestro test .maestro/login-flow.yaml
```

## Common Commands (cheat sheet)

```yaml
# Nawigacja
- launchApp
- launchApp:
    arguments:
      isFirstLaunch: true
- stopApp
- pressKey: back
- pressKey: home

# Interakcje
- tapOn: "Submit"
- tapOn:
    id: "submit-button"      # testID prop w RN
- tapOn:
    text: "Submit"
    index: 1                 # gdy wiele matchy
- doubleTapOn: "Item"
- longPressOn: "Item"
- inputText: "hello world"
- eraseText                  # kasuje do 50 znaków; dłuższa wartość zostaje w polu
- eraseText: 100             # maksimum komendy
- copyTextFrom: "Item"       # zapisuje do pamięci Maestro (${maestro.copiedText}), nie do schowka systemu

# Gesty
- swipe:
    direction: UP
    duration: 500
- swipe:
    from:
      id: "card-1"
    direction: LEFT          # swipe-to-delete
- scroll
- scrollUntilVisible:
    element:
      text: "Footer"

# Asercje
- assertVisible: "Welcome"
- assertNotVisible: "Loading"
- assertVisible:
    id: "user-avatar"

# Wait
- waitForAnimationToEnd
- waitForAnimationToEnd:
    timeout: 5000
- extendedWaitUntil:
    visible: "Loaded"
    timeout: 10000

# Screenshot / Video
- takeScreenshot: name-without-extension
- startRecording: my-flow
- stopRecording

# Deep linking (KRYTYCZNE dla OAuth flow)
- openLink: "myapp://auth/callback?code=xyz"

# Permissions (system dialogs iOS/Android): patrz „Zgody systemowe”
- launchApp:
    permissions:
      all: deny              # albo unset; domyślnie allow
```

## Maestro Studio (interactive recording)

Od CLI 2.6.0 Studio **nie jest już częścią CLI** — to osobna aplikacja desktopowa. Pobranie: https://studio.maestro.dev (macOS: `MaestroStudio.dmg`, Windows: `MaestroStudio.exe`, Linux: `MaestroStudio.AppImage`). Otwierasz aplikację, wybierasz workspace i device w GUI — każdy tap/swipe/input generuje live preview YAML, który kopiujesz do flow file.

Używaj przy projektowaniu nowego flow: to szybsze niż pisanie YAML ręcznie.

**Legacy:** na CLI <= 2.5.x komenda `maestro studio` (otwierająca `localhost:9999`) jeszcze działa — w 2.6.0 usunięta z binarki na rzecz osobnej aplikacji.

## Deep Linking (OAuth, push notifications)

```yaml
appId: com.example.myapp
---
- launchApp
- tapOn: "Zaloguj przez Google"
# Symulujemy redirect z OAuth providera (zamiast prawdziwego browser flow)
- openLink: "myapp://auth/callback?code=mock-auth-code-123"
- waitForAnimationToEnd
- assertVisible: "Witaj, Test"
```

To kluczowy use case mobile, którego **nie da się przetestować** w expo-router-testing (in-process) — Maestro woła OS przez `xcrun simctl openurl` / `adb shell am start`, więc deep link idzie przez prawdziwy router OS.

## iOS vs Android — różnice

| Aspekt | iOS | Android |
|---|---|---|
| `appId` | `com.example.myapp` (bundle ID z Xcode) | `com.example.myapp` (package name z `app.json` android.package) |
| Emulator setup | iOS Simulator (Xcode) | AVD przez Android Studio / `emulator` CLI |
| System dialogs | patrz „Zgody systemowe” | `permissions:` w `launchApp` |
| Back gesture | `pressKey: back` no-op (iOS bez Back) | `pressKey: back` działa |
| Status bar | Maestro ignoruje | Maestro ignoruje |

Pisz flow **cross-platform** gdy się da. Gdy musisz różnicować, użyj osobnych plików `.maestro/ios/` i `.maestro/android/`.

## Cloud vs Local

**Local (default):**
- Twój sprzęt (macOS dla iOS), emulator/symulator otwarty
- Free, ale wolne (~30s-2min per flow)
- Idealne do pracy lokalnej i przed-commit verification

**Maestro Cloud (`maestro cloud`):**
- Build apki + flow uploadowane do chmury
- Equal devices, parallel runs
- Płatne (po free tier)
- Dla CI / cross-device matrix

```bash
# Local
maestro test .maestro/

# Cloud (cały folder testów)
maestro cloud --apiKey "$MAESTRO_API_KEY" build/MyApp.app .maestro/
```

W tym repo **default = local**. Cloud rozważ dopiero gdy masz CI pipeline.

## Integracja z testerem E2E

Tester `feature-tester-e2e` używa tego skilla w fazie review. Listę scenariuszy podaje `e2e.mjs scenariusze` (oba prefiksy, flow, seed), a format wyniku należy do agenta. Przed scenariuszem czytasz skill weryfikacji projektu (`.claude/skills/weryfikacja/SKILL.md`) i wpis mapy funkcji (`testID`, droga).

Jeden flow to jeden przebieg, także gdy pokrywa kilka linii scenariuszy; każda linia dostaje ten sam wynik.

W runie tester i naprawa E2E wołają flow przez `node .claude/scripts/e2e/expo-flow.mjs --zadanie <folder> --flow <flow>`: skrypt wybiera urządzenie adaptera, podaje zmienne i maskuje hasło. Pod spodem biegnie:

```bash
MAESTRO_KLUCZ=wartosc maestro --device <id> test --test-output-dir "$Z/maestro/<flow>" -e JAWNY=wartosc .maestro/<flow>.yaml; echo "kod=$?"
```

Dowodem jest kod wyjścia (0 tylko wtedy, gdy wszystkie flow przeszły), ostatnia linia wyjścia i ścieżka zrzutu z bundla pod `--test-output-dir`. `--format JUNIT` albo `HTML` z `--output` daje raport, gdy jest potrzebny.

Słownik sytuacji dla przyczyn SKIP:

| Sytuacja | Przyczyna |
|---|---|
| Emulator, Metro albo dev-client niedostępny | `srodowisko` |
| Sterownik Maestro padł, `Timed out snapshotting`, natywna powierzchnia napotkana w trakcie (Alert, picker, OAuth w przeglądarce systemowej) | `harness` |
| HTTP 429, limit maili | `limit-zewnetrzny` |
| Brak `.maestro/<flow>-seed.sql` | `brak-seeda` |
| Brak pliku `.maestro/<flow>.yaml` albo scenariusz nie do wykonania | `scenariusz-niewykonalny` |

Konwencja nazw: `.maestro/<feature>-<scenariusz>.yaml`, np. `.maestro/auth-login-success.yaml`.

## Granica możliwości Maestro — natywne powierzchnie OS (KRYTYCZNE przy planowaniu E2E)

Maestro steruje WYŁĄCZNIE elementami w accessibility tree **Twojej aplikacji**. Natywnych powierzchni systemu (renderowanych przez OS, nie przez RN) **nie dotknie** — flow oparty o nie zawiesi się na timeout. To najczęstszy błąd autora scenariusza E2E. W planie taki krok to `[Manual]`, a napotkany w trakcie przebiegu daje SKIP z przyczyną `harness`.

| Natywna powierzchnia OS | Maestro steruje? | Wzorzec zamiast tego |
|---|---|---|
| Picker zdjęć / kamera / picker dokumentów | ❌ NIE | Dane, które wpadłyby tą drogą → **wstrzyknij kluczem sekretnym** (`runScript: .maestro/inject-*.js`, szablon niżej) i asertuj **RENDER** (siatka/miniatura/teaser) |
| Natywny `Alert` / `ActionSheet` (confirm, destructive „Usuń") | ❌ NIE | Krok → `Operator checklist` jako `[Manual]` |
| Share sheet, picker kontaktów / kalendarza | ❌ NIE | inject danych lub `[Manual]` |
| Biometria (Face ID / Touch ID enrollment) | ❌ NIE | `[Manual]` (mock biometrii = poza harnessem) |
| Pełnoekranowy viewer obrazów w natywnym `<Modal>` (swipe między zdjęciami, ✕, delete) | ❌ NIE | OPEN viewera + asercje (licznik, ✕ widoczny) OK; **gesty wewnątrz Modala → `[Manual]`** |
| Permission dialogs (kamera/geo/powiadomienia) | ⚠️ częściowo | patrz „Zgody systemowe” |
| Arkusz iOS 26 „Strong Password” i dialog Keychain „Zapisać hasło?” | ❌ NIE | pełny signUp w `[Manual]`; dialog Keychain gasisz warunkowo we flow z logowaniem |
| Tap / scroll / swipe / input / deep link w UI apki | ✅ TAK | normalny flow Maestro |

**Reguła autora E2E:** zanim napiszesz `[E2E]`, prześledź flow krok po kroku — jeśli któryś krok wymaga natywnej powierzchni z kolumny ❌, NIE pisz flow który ją tapuje. Wstrzyknij dane (service_role) i asertuj render, albo przenieś krok do `[Manual]`. **Inject** to REST insert kluczem sekretnym: omija RLS i natywne UI, a trigger realtime daje realny dowód toru danych. Minimalny szablon niżej.

**Skrypt `runScript`/inject leci w GraalJS Maestro, NIE w Node**:
- **Brak `fs` i `require`.** `body` przekazujesz inline jako string albo base64. Plik wysyłasz wyłącznie przez `multipartForm` z `filePath`.
- Tylko czysty REST (`http`), bez modułów Node.
- Sekrety (URL i klucz sekretny Supabase, ID rekordu itp.) **NIGDY jako wartości w bloku `env:` pliku flow** (plik leży w repo) ani jako `maestro test -e KEY="wartość"` (argumenty widać w `ps` i `pgrep -fl`) — przekaż przez zmienną środowiskową z prefiksem `MAESTRO_` (`export MAESTRO_SUPABASE_URL=...`, np. wczytane z `.env.e2e`); Maestro sam udostępnia ją flow. Wewnątrz `.js` skryptu zmienna jest dostępna jako goły identyfikator JS (np. `MAESTRO_SUPABASE_URL`), w YAML flow wyłącznie jako referencja `${KEY}`.

**Minimalny szablon inline** (`.maestro/inject-example.js`):

```javascript
// GraalJS (Maestro), nie Node: bez fs i require, body inline
const response = http.post(MAESTRO_SUPABASE_URL + "/rest/v1/messages", {
  headers: {
    // Klucz sb_secret_… nie jest JWT i idzie tylko w apikey. Legacy service_role dostaje też:
    // Authorization: "Bearer " + MAESTRO_SUPABASE_SECRET_KEY,
    apikey: MAESTRO_SUPABASE_SECRET_KEY,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({
    conversation_id: MAESTRO_CONVERSATION_ID,
    content: "E2E seed message",
  }),
});

if (response.status !== 201) {
  throw new Error("Inject failed: " + response.status + " " + response.body);
}
```

## Zgody systemowe

`launchApp: permissions:` nie jest dowodem zgody. Na iOS 26.4 `applesimutils` kończy się kodem 0 i nic nie zapisuje, a `clearState` kasuje zgodę. Zgodę na powiadomienia nadaje prolog flow: tapnięcie natywnego dialogu i asercja skutku w aplikacji.

## Środowisko

Autonomiczne E2E działa na osobnym projekcie Supabase z `.env.e2e`, nigdy na dev ani prod. Konto testowe, seedy i start aplikacji opisuje skill weryfikacji projektu oraz `.claude/templates/e2e-env/README.md`. Sekrety przechodzą przez środowisko procesu (`MAESTRO_*`), nigdy przez `-e`, w YAML ani JS. Konto e2e w flow to `${MAESTRO_E2E_EMAIL}` i `${MAESTRO_E2E_PASSWORD}`.

## Common gotchas

- **Tekst polski:** Maestro obsługuje UTF-8, nie escape'uj diakrytyków. `tapOn: "Zaloguj się"` działa.
- **Animacje:** `waitForAnimationToEnd` dodajesz przed zrzutem animowanej warstwy, nie po każdej nawigacji. Na pojawienie się elementu czekasz przez `extendedWaitUntil`.
- **Toast / alerty:** zniknią same — łap je przez `extendedWaitUntil: visible: "..." timeout: 3000`.
- **`testID`:** w RN dodawaj `testID="submit-button"` na komponentach żeby `id:` matchowało. Inaczej Maestro polega na tekście, co łamie się przy tłumaczeniach.
- **Dev-client:** testy biegną na dev-cliencie z Metro. Build `preview` odpada, gdy logowanie e2e stoi za bramką `__DEV__`.
- **Restart aplikacji:** `stopApp` + `openLink`, nigdy `launchApp` + `openLink`. Gorące wejście daje SIGSEGV w teardownie JSI, który Maestro raportuje jako asercję albo `Timed out snapshotting`.
- **`runFlow when: visible`** sprawdza drzewo raz i bez elementu kosztuje ok. 5 s, czyli przepala okno toastu.
- **`hideKeyboard`** na iOS jest niedeterministyczne; używaj `pressKey: Enter`.
- **`assertVisible` po tekście** to dopasowanie całego tekstu. Fragment sprawdzasz regexem `.*fragment.*` albo przez `testID`.
- **Drzewo a11y na iOS:** `accessible` z `accessibilityLabel` skleja poddrzewo i pojedyncze `Text` znikają. `accessibilityElementsHidden` na kontenerze ukrywa `testID` dzieci, a `accessibilityViewIsModal` zdejmuje cały ekran pod modalem. Przy fałszywej asercji na widocznym elemencie najpierw podejrzewasz warstwę modalną.
- **`testID`:** kontener natywnego `<Modal>` i wheel-picker iOS nie mają go w drzewie, więc celujesz w dzieci modala. `testID` na nieinteraktywnym wrapperze nie nadaje się na cel `scrollUntilVisible`.
- **Element przy dole ekranu:** `scrollUntilVisible` uznaje go za widoczny także pod pływającym paskiem kart albo dymkiem LogBox, a dotknięcie trafia w tę warstwę: aktualna karta przewija ekran do góry, a dymek otwiera pełnoekranowy log. Przed `tapOn` ustawiasz `centerElement: true`.

## Quick reference

```bash
# Health check
maestro --version

# Run single flow
maestro test .maestro/login.yaml

# Run wszystkie w folderze
maestro test .maestro/

# Interactive recording — osobna aplikacja desktopowa (studio.maestro.dev), NIE komenda CLI od 2.6.0

# Hierarchia UI (debugging) — od 2.6.0 output wyłącznie JSON; podgląd na żywo: Maestro Viewer w desktop Studio
maestro hierarchy

# List local devices
maestro list-devices

# Narzędzia dla agenta przez MCP (stdio): list_devices, inspect_screen, take_screenshot, run, cheat_sheet
maestro mcp

# Start emulator/symulator gdy nic nie jest uruchomione
maestro start-device --platform ios   # albo --platform android
```
