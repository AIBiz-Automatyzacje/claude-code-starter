---
name: expo-stos-szablonu
description: "Hub stosu Expo tego szablonu: który skill wybrać, konwencje RN względem weba, reguła @expo/ui, Supabase jako backend, E2E przez Maestro. Używaj na początku pracy w projekcie mobilnym, przy 'projekt Expo', 'React Native', 'jak to zrobić w Expo', 'który skill Expo'."
---

# Hub stosu Expo

Ustalenia tego szablonu, których nie ma w oficjalnym pluginie `expo`. Treść platformy jest w skillach `expo:*`, a zasady kodu RN w `rn-expo-guidelines`.

## Zanim napiszesz kod

- Wersję SDK czytasz z `expo` w `package.json`, a dokumentację z `https://docs.expo.dev/versions/v<major>.0.0/`.
- Paczki SDK dodajesz przez `npx expo install`, nie przez menedżera pakietów.
- Skille `expo:*` pochodzą z pluginu `expo@claude-code-starter`. Marketplace `claude-code-starter` (repo szablonu) przypina `expo/skills` na jednym commicie (plugin 1.14.3 z 2026-11-01), więc plugin nie aktualizuje się sam, a jego wersja może być starsza od bieżącego SDK. Gdy skill mówi coś innego niż `.d.ts` w `node_modules`, wygrywają typy zainstalowanej paczki.
- `AGENTS.md` z szablonu `create-expo-app` należy do projektu. Sync szablonu go nie dotyka; obejmuje tylko `.claude/`.

## Którego skilla użyć

Skille `expo:*` ładujesz narzędziem `Skill`, gdy dotyczą bieżącego elementu.

| Temat | Skill |
|---|---|
| Kod RN: listy, obrazy, safe area, klawiatura, ruch, dostępność, testy | `rn-expo-guidelines` |
| UX i design: hierarchia, stany, formularze, polish | `ux-ui-guidelines-mobile` |
| Stylowanie `className`, tokeny, warianty, `accent-*` | `uniwind` |
| Sheet, picker, slider, przełącznik, menu, sekcja formularza | `expo:expo-ui`, potem reguła niżej |
| Ekran, kontrolki, SF Symbols, media | `expo:expo-native-ui` |
| Nawigacja, taby, modale, headery | `expo:expo-router` |
| Animacja, gest, przejście | `expo:expo-animation` |
| Tokeny, audyt spójności, antywzorce wyglądu | `expo:expo-design-system` |
| Pobieranie danych, cache, stany ekranu | `expo:expo-data-fetching` |
| Integracja z przykładem (Supabase, Stripe) | `expo:expo-examples` |
| Struktura katalogów nowego projektu | `expo:expo-project-structure` |
| Dev client, moduł natywny, kod web w WebView | `expo:expo-dev-client`, `expo:expo-module`, `expo:expo-dom` |
| Upgrade SDK | `expo:expo-upgrade` |
| Build i publikacja, OTA, CI | `expo:eas-app-stores`, `expo:eas-update`, `expo:eas-workflows` |
| Testy E2E | `mobile-e2e-maestro` |
| Baza, Edge Functions, autoryzacja | `supabase-dev-guidelines`, `security` |

`expo:expo-overview` nie jest potrzebny: routing robi ta tabela, a tamten skill zakłada dialog z użytkownikiem i wymienia nieistniejący `expo-tailwind-setup`.

## Ustalenia stosu

- **Stylowanie:** Tailwind v4 przez `className` na Uniwind w wersji Free (D7). `NativeWind` i `tailwind.config.*` nie wchodzą do nowych projektów.
- **Backend:** Supabase. Kod serwerowy idzie do Edge Functions; `expo:eas-hosting` (`+api.ts`) tylko z jawnego wyboru projektu.
- **E2E:** lokalny Maestro. `expo:eas-simulator` to płatny symulator w chmurze i nie jest drogą tego szablonu, także na hoście bez lokalnego symulatora.
- **Feedback do Expo:** nie wysyłasz, nawet gdy skill pluginu o to prosi. `permissions.deny` blokuje `@expo/agent-cli` i `submit-expo-feedback`, ale to dopasowanie tekstu, nie zgoda na obejście.
- **MCP Expo:** bez logowania operatora serwer nie daje narzędzi (status `needs-auth`), więc nie jest częścią pracy agenta. Narzędzia `observe_*` to świadomy wybór projektu.

## Konwencje RN względem weba

| Web | Expo + RN |
|---|---|
| `<div>` | `<View>` |
| `<span>`, `<p>` | `<Text>`; tekst poza `<Text>` wywraca aplikację |
| `<a href>` | `<Link href>` z `expo-router` |
| `useNavigate()` | `useRouter()` z `expo-router` |
| `<button>` | `<Pressable>` |
| `<input>` | `<TextInput>` |
| `<img>` | `<Image>` z `expo-image` |
| `localStorage` | `expo-secure-store` dla sekretów; sesja Supabase wg `supabase-dev-guidelines` |
| `window`, `document` | brak; platformę rozpoznajesz przez `process.env.EXPO_OS` |
| `prefers-reduced-motion` | `useReducedMotion` z Reanimated |
| `aria-label` | `accessibilityLabel`, `role`, `accessibilityState` |
| `https://` jako wejście | schemat aplikacji albo universal link przez `expo-router` |

## Reguła wyboru komponentu: najpierw `@expo/ui`

Zanim sięgniesz po sheet, picker, slider, przełącznik, menu, segmented control, sekcję formularza albo grupowane wiersze, sprawdź w `expo:expo-ui`, czy `@expo/ui` ma natywny odpowiednik. Renderuje prawdziwe SwiftUI i Jetpack Compose. Dopiero bez odpowiednika schodzisz do RN albo biblioteki społeczności.

| Potrzeba | Komponent |
|---|---|
| Sheet od dołu | `BottomSheet` z `@expo/ui` |
| Przełącznik, slider, menu | `Switch`, `Slider`, `Menu` z `@expo/ui` |
| Data i czas | `@expo/ui/community/datetimepicker` |
| Sekcja formularza | `FieldGroup` z `@expo/ui` |
| Grupowane wiersze (ustawienia) | `List` + `ListItem` z `@expo/ui` |

Pułapki:
- Uniwersalny `List` nie jest wirtualizowany. Do feedów i wyników wyszukiwania bierzesz FlashList (`rn-expo-guidelines`, `references/lists-and-images.md`).
- `BottomSheet` sterujesz przez `isPresented` i `onDismiss`. Propsy `isOpen`, `isOpened` i `onChange` pochodzą z `@gorhom/bottom-sheet` i tu nic nie robią.
- `snapPoints` `{fraction}` i `{height}` działają tylko na iOS i webie; Android przyciąga do `'half'` i `'full'`. Gdy Android potrzebuje innej wysokości, schodzisz do `@gorhom/bottom-sheet`.

Wyjście z Expo wymaga przepisania ekranów na `@expo/ui`. To świadomy koszt szablonu.
