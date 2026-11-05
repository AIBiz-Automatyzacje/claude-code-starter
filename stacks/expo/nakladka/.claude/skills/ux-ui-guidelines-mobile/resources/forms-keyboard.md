# Forms & Keyboard (Mobile)

Formularze na mobile to obszar gdzie 70% apek psuje basics. Zła klawiatura, validation onChange, brak autofill, KeyboardAvoidingView psujący layout. Premium feel zaczyna się od formularza który "po prostu działa".

## Anatomia input fielda

Jeden input = 4 elementy:

```
[Label]               ← above field, never inside placeholder long-term
┌─────────────────┐
│  [Input]        │   ← min 44pt height, 16px font (no zoom)
└─────────────────┘
[Helper text]        ← optional, hint about format
[Error text]         ← only when error, replaces helper
```

### Label placement

| Wzorzec | Kiedy |
|---------|-------|
| **Static label above** | Default. Material 3 "outlined" + iOS forms. Najbezpieczniejsze. |
| **Floating label** | Material 3 "filled" — label animuje na top przy focus |
| **Placeholder-as-label** | **Anti-pattern** — znika gdy user pisze, traci kontekst |

**Reguła:** placeholder NIGDY nie jest jedynym labelem. Placeholder = przykład wartości ("np. anna@firma.pl"), label = co to za pole ("Email").

### Floating labels: Material vs HIG

| iOS HIG | Material 3 |
|---------|------------|
| Static label powyżej | Floating label (animuje on focus) |
| Subtelny border lub bez | Underline or full outline |
| Caret blink prosty | Ripple on tap |

**Cross-platform decyzja:** static label above działa wszędzie. Floating label = native feel jeśli stosujesz konsekwentnie.

---

## Input states

Każdy input MUSI obsłużyć 6 stanów:

| Stan | Visual |
|------|--------|
| **Default** | Border subtle, label normal |
| **Focus** | Border accent, ring lub thicker border |
| **Filled** | Wartość widoczna, label może być smaller |
| **Disabled** | Reduced opacity, no interaction |
| **Error** | Border destructive, error text below |
| **Success** | Border accent (green) lub check icon — używaj tylko gdy ma sens (verified email, password strength) |

```tsx
// Uniwind: kompletne klasy per stan, bez składania nazw w locie
function Input({ value, onChangeText, label, error, helper, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = !!error;

  useEffect(() => {
    // iOS nie ma live regionów; na Androidzie ogłasza aria-live niżej
    if (error && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(error);
    }
  }, [error]);

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholderTextColorClassName="accent-muted-foreground"
        selectionColorClassName="accent-primary"
        cursorColorClassName="accent-primary"
        className={`rounded-md px-3 py-3 text-[16px] text-foreground border
          ${hasError ? "border-destructive" : isFocused ? "border-primary" : "border-border"}
          ${props.editable === false ? "opacity-50" : ""}`}
        {...props}
      />
      {hasError ? (
        <Text className="text-sm text-destructive" role="alert" aria-live="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text className="text-sm text-muted-foreground">{helper}</Text>
      ) : null}
    </View>
  );
}
```

**`TextInput` w Uniwind:**

- Kolory spoza `style` idą przez propsy `*ClassName` z prefiksem `accent-`: `placeholderTextColorClassName`, `selectionColorClassName`, `cursorColorClassName`. Zwykła klasa `text-*` ich nie ustawi. Własny token działa tak samo (`accent-primary`).
- Rozmiar tekstu podawaj bez `lineHeight`: `text-[16px]`, nie `text-base` ani `text-lg`. Klasy ze skali niosą `lineHeight` (`text-lg` = 28), a przy nim wpisany tekst siedzi na iOS poniżej środka pola, przy `text-lg` o ok. 7 pt. Android tego przesunięcia nie ma.
- `aria-live` działa tylko na Androidzie, dlatego na iOS ten sam błąd ogłasza `AccessibilityInfo.announceForAccessibility`.

---

## `keyboardType` matrix

Klawiatura MUSI matchować typ pola. User wpisujący email na full keyboard = drobny ból, ale `123` razem ze SHIFT przed zalogowaniem = duży ból.

| Pole | `keyboardType` | iOS keyboard | Android keyboard |
|------|---------------|--------------|------------------|
| Imię, ogólny tekst | `default` | Pełna QWERTY | Pełna QWERTY |
| Email | `email-address` | Pełna z `@.` | Pełna z `@.` |
| Telefon | `phone-pad` | Numpad telefoniczny | Numpad telefoniczny |
| PIN, kod weryfikacyjny | `number-pad` | Numpad bez `.` | Numpad bez `.` |
| Cena, decimal | `decimal-pad` | Numpad z `.` | Numpad z `.` |
| URL | `url` | Pełna z `/` `.com` | Pełna z `/` |
| Search field | `web-search` | Pełna z "Go" key | Pełna z search action |
| Hasło | `default` | (textContentType=password robi resztę) | Same |

```tsx
<TextInput
  keyboardType="email-address"
  autoCapitalize="none"
  autoCorrect={false}
  textContentType="emailAddress"
  autoComplete="email"
/>
```

---

## Autofill — iOS i Android

iOS autofill (od iOS 11+) sugeruje wartości z keychain, contacts, SMS. Android ma `autoComplete` jako odpowiednik.

| Pole | iOS `textContentType` | Android `autoComplete` |
|------|----------------------|------------------------|
| Imię / nazwisko | `name`, `givenName`, `familyName` | `name`, `given-name`, `family-name` |
| Email | `emailAddress` | `email` |
| Username | `username` | `username` |
| Hasło (login) | `password` | `password` |
| Hasło (rejestracja) | `newPassword` (sugeruje strong) | `new-password` |
| OTP / 2FA | `oneTimeCode` (auto-fill z SMS) | `sms-otp` |
| Telefon | `telephoneNumber` | `tel` |
| Adres / kod | `streetAddressLine1`, `postalCode` | `street-address`, `postal-code` |
| Karta kredytowa | `creditCardNumber/Expiration/SecurityCode` | `cc-number`, `cc-exp`, `cc-csc` |
| URL | `URL` | `url` |

```tsx
// Combo iOS + Android
<TextInput
  textContentType="oneTimeCode"      // iOS
  autoComplete="sms-otp"              // Android
  keyboardType="number-pad"
/>
```

### Smart defaults per typ pola

| Pole | autoCapitalize | autoCorrect | secureTextEntry |
|------|----------------|-------------|-----------------|
| Email | `none` | `false` | `false` |
| Username | `none` | `false` | `false` |
| Password | `none` | `false` | `true` |
| Imię | `words` | `false` | `false` |
| Body text (post, message) | `sentences` | `true` | `false` |
| URL | `none` | `false` | `false` |

---

## Password input

**Reguły:**
- Show/hide toggle = standard, nie luxury (`secureTextEntry` toggle z eye icon)
- `textContentType="newPassword"` przy rejestracji → iOS sugeruje strong password z keychain
- `secureTextEntry={true}` ZAWSZE jako default
- `autoComplete="new-password"` (rejestracja) lub `"current-password"` (login) na Androidzie
- Niektóre konteksty (banking, password manager) — disable copy, ale nie nadużywaj

---

## Biometric authentication

Hasło na każdym uruchomieniu = friction. Biometry (Face ID, Touch ID, Android fingerprint) = premium feel.

```tsx
import * as LocalAuthentication from "expo-local-authentication";

async function authenticateWithBiometry(): Promise<boolean> {
  if (!(await LocalAuthentication.hasHardwareAsync())) return false;
  if (!(await LocalAuthentication.isEnrolledAsync())) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Zaloguj się",
    fallbackLabel: "Użyj hasła",
  });
  return result.success;
}
```

**Kiedy:** re-auth returning user (token w SecureStore + biometric unlock), sensitive actions (payment, delete account), quick app unlock (banking, password managers).

**Kiedy NIE:** pierwszy login (potrzebny prawdziwy auth), apki bez wrażliwych danych (friction).

**Fallback:** zawsze daj opcję hasła. User może mieć brudne palce / makijaż / okulary.

---

## KeyboardAvoidingView

Najczęstszy bug: input ukryty pod klawiaturą.

```tsx
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, ScrollView } from "react-native";

function FormScreen() {
  const headerHeight = useHeaderHeight();

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1"
      keyboardVerticalOffset={headerHeight} // gdy ekran jest pod nagłówkiem nawigacji; wartość zawiera status bar
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* form */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

| Prop | iOS | Android |
|------|-----|---------|
| `behavior` | `"padding"` | `"padding"`: aplikacje Expo są edge-to-edge, okno nie zmienia rozmiaru pod klawiaturą, a widok bez `behavior` zostaje pod nią |
| `keyboardVerticalOffset` | `useHeaderHeight()` pod nagłówkiem nawigacji | tak samo |

Na Androidzie nie łącz `softwareKeyboardLayoutMode: "pan"` z `behavior="padding"`: okno się przesuwa, widok dodaje padding i pole jedzie w górę podwójnie.

**Kiedy NIE używać:**
- Modal full-screen — masz natywny system handling
- Bottom sheet — sheet obsługuje klawiaturę sam: `BottomSheet` z `@expo/ui` (domyślny wybór, patrz `expo:expo-ui`) robi to natywnie, a `@gorhom/bottom-sheet` ma własny `BottomSheetTextInput`

### Dłuższy formularz: `react-native-keyboard-controller`

Expo zaleca tę bibliotekę do większych przewijanych formularzy z wieloma polami: daje spójne zachowanie na obu platformach i natywne wrażenie przy minimalnej konfiguracji. Wymaga development builda (nie ma jej w Expo Go) oraz `react-native-reanimated`. Na SDK 58 instalujesz przez `npx expo install react-native-keyboard-controller` (1.22.7).

```tsx
// app/_layout.tsx
import { Stack } from "expo-router";
import { KeyboardProvider } from "react-native-keyboard-controller";

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <Stack />
    </KeyboardProvider>
  );
}
```

```tsx
// Ekran formularza
import { TextInput } from "react-native";
import { KeyboardAwareScrollView, KeyboardToolbar } from "react-native-keyboard-controller";

export default function FormScreen() {
  return (
    <>
      <KeyboardAwareScrollView bottomOffset={62} contentContainerStyle={{ gap: 16, padding: 16 }}>
        <TextInput placeholder="Imię" />
        <TextInput placeholder="Email" />
      </KeyboardAwareScrollView>
      <KeyboardToolbar />
    </>
  );
}
```

`KeyboardAwareScrollView` sam przewija do aktywnego pola, a `KeyboardToolbar` dodaje przejścia między polami i przycisk zamknięcia klawiatury.

---

## Keyboard dismiss patterns

User skończył pisać. Jak chowa klawiaturę?

| Pattern | Kiedy |
|---------|-------|
| **Tap outside** | Default. Wrap form w `Pressable onPress={Keyboard.dismiss}` |
| **Submit button** | User klika "Zapisz" → keyboard znika + akcja |
| **Return key (action)** | `returnKeyType="next"` → focus next field, `"done"` → dismiss |
| **Scroll** | `keyboardShouldPersistTaps="handled"` + scroll dismisses (Android default) |
| **Toolbar Done button** | iOS — `InputAccessoryView` z "Gotowe" |

```tsx
import { Keyboard, Pressable } from "react-native";

<Pressable onPress={Keyboard.dismiss} className="flex-1">
  {/* form content */}
</Pressable>
```

### Return key navigation (next/done)

`returnKeyType="next"` + `onSubmitEditing={() => nextRef.current?.focus()}` + `submitBehavior="submit"` (zastępuje deprecated `blurOnSubmit={false}` — wysyła submit event bez blurowania inputa) na non-last fields. Last field: `returnKeyType="done"` + `onSubmitEditing={handleSubmit}`. Daje natywny flow: user wpisuje, klika Next na klawiaturze, fokus skacze do kolejnego pola.

---

## Validation timing

| Timing | Kiedy |
|--------|-------|
| **onChange** | **Anti-pattern** — annoying, user widzi error przy literce 1 |
| **onBlur** | **Sweet spot** — user wyszedł z fielda, ale nie submitował |
| **onSubmit** | Late — user dowiaduje się po kliknięciu, marnuje submit |
| **Hybrid** | onBlur dla pierwszego sprawdzenia, onChange JEŚLI był error (real-time correction) |

**Reguła:** **show error onBlur, clear error onChange jeśli już był**. To wzorzec Material i Apple.

```tsx
const [error, setError] = useState<string | null>(null);

const validate = (val: string): string | null => {
  if (!val.includes("@")) return "Wpisz poprawny email";
  return null;
};

<TextInput
  onChangeText={(v) => {
    setEmail(v);
    if (error) setError(validate(v)); // clear error w real-time po pierwszym sprawdzeniu
  }}
  onBlur={() => setError(validate(email))}
/>
```

---

## Error display

Po submit z błędami:

1. **Inline errors pod fieldami** — gdzie błąd występuje
2. **Focus na pierwszym błędnym polu** — `firstErrorRef.current?.focus()`
3. **Scroll to first error** — żeby user widział błąd
4. **Ogłoszenie błędu** — na Androidzie `aria-live="polite"` na tekście błędu, na iOS `AccessibilityInfo.announceForAccessibility(error)`, bo `aria-live` działa tylko na Androidzie
5. **NIE alert "Are you sure?"** dla validation
6. **NIE toast** — toast znika, error pod polem zostaje

```tsx
function FormScreen() {
  const refs = {
    email: useRef<TextInput>(null),
    password: useRef<TextInput>(null),
  };

  const handleSubmit = () => {
    const errors = validate(values);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.keys(errors)[0] as keyof typeof refs;
      refs[firstError].current?.focus();
      return;
    }
    submitForm(values);
  };
}
```

---

## Multi-step forms

Kiedy split form na kroki?

| Pól | Strategia |
|-----|-----------|
| 1-4 | Single screen |
| 5-8 | Single screen z sections lub progressive (1 hero pole na ekranie) |
| 9+ | Multi-step wizard z step indicator |

### Step indicator patterns

- **Progress bar** — `[████░░░░] 50%` — dla long forms
- **Dots** — `● ● ○ ○` — 3-5 kroków
- **Numbered** — "Krok 2 z 4" — formy biznesowe
- **Stepper z checkmarks** — `✓ ✓ ● ○` — pokazuje historię

### Save progress

User zamknął apkę w połowie formularza. Progress musi się zapisać. Persist do `expo-secure-store` (sensitive data) lub `AsyncStorage` (non-sensitive) na każdym `onBlur` lub przy nawigacji między krokami. Clear po success submit.

---

## Submit button states

| Stan | Visual |
|------|--------|
| **Default** | Primary color, tekst akcji |
| **Disabled** | Reduced opacity, no haptic — gdy form invalid |
| **Loading** | Spinner inside, tekst "Wysyłam..." LUB spinner only |
| **Success** | Check icon + "Wysłano" — krótko (1-2s) przed nawigacją |
| **Error** | Wracaj do default, error pokazuje się pod fieldem (NIE w buttonie) |

```tsx
<Pressable
  onPress={onPress}
  disabled={isLoading || disabled}
  className={`flex-row items-center justify-center gap-2 rounded-full py-3 px-6 min-h-12
    ${disabled || isLoading ? "bg-muted" : "bg-primary active:scale-[0.97]"}`}
  accessibilityRole="button"
  accessibilityState={{ busy: isLoading, disabled }}
>
  {isLoading && <ActivityIndicator size="small" color="white" />}
  <Text className={`font-medium ${disabled || isLoading ? "text-muted-foreground" : "text-primary-foreground"}`}>
    {isLoading ? "Wysyłam..." : children}
  </Text>
</Pressable>
```

---

## react-hook-form + zod

Standard stack dla form management w RN. Type-safe walidacja, minimal re-renders, integration ze zod schema.

> **Zod 4:** formaty stringów są top-level — `z.email()`, `z.url()`, `z.uuid()`. Formy metodowe
> (`z.string().email()`) nadal działają, ale są **deprecated** (changelog Zod 4) i gorzej się
> tree-shake'ują. W nowym kodzie używaj wyłącznie top-level.

```tsx
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.email("Wpisz poprawny email"),
  password: z.string().min(8, "Minimum 8 znaków"),
});

type FormValues = z.infer<typeof schema>;

function SignInForm() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur", // validation onBlur, jak rekomenduję wyżej
  });

  const onSubmit = async (data: FormValues) => {
    await api.signIn(data);
  };

  return (
    <View className="gap-4">
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Input
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            autoComplete="email"
            error={errors.email?.message}
          />
        )}
      />
      {/* Controller na password analogicznie z secureTextEntry + textContentType="password" */}
      <SubmitButton onPress={handleSubmit(onSubmit)} isLoading={isSubmitting}>
        Zaloguj się
      </SubmitButton>
    </View>
  );
}
```

---

## Anti-patterns

| Anti-pattern | Co zamiast |
|--------------|------------|
| Placeholder jako jedyny label | Label above field |
| Wrong `keyboardType` | Match per typ pola |
| Brak `textContentType` / `autoComplete` | Zawsze ustawiaj — autofill = premium feel |
| Validation `onChange` od pierwszej literki | `onBlur`, clear error `onChange` po pierwszym błędzie |
| Error w toast lub alert | Inline pod fieldem |
| Submit button bez loading state | Loading spinner + disabled |
| Brak focus na pierwszym błędzie po submit | `firstErrorRef.current?.focus()` |
| `secureTextEntry` bez show/hide toggle | Toggle = standard |
| Hasło bez `textContentType="newPassword"` | iOS autofill suggeruje strong password |
| Form 12 pól na 1 ekranie | Multi-step wizard |
| Brak save progress w długim formularzu | SecureStore lub AsyncStorage |
| `KeyboardAvoidingView` bez `keyboardVerticalOffset` na iOS | Offset = wysokość headera |

---

## Powiązane

- `onboarding.md` — personalizacja jako form (3-5 wyborów sweet spot)
- `states-loading-empty-error.md` — error inline pattern, recovery
- `navigation-patterns.md` — full-screen vs modal vs bottom sheet dla formularzy
- `teardowns.md` — Calorify fast input optimization

---

*Źródła: Apple HIG Text Fields, Material 3 Text Fields, expo-local-authentication docs, react-hook-form RN docs, zod docs, react-native-keyboard-controller docs, web search "mobile form UX research 2026", "keyboard avoiding view best practices react native".*
