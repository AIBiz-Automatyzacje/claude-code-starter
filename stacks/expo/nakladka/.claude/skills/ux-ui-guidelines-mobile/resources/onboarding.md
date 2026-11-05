# Onboarding (Mobile)

Onboarding to jedyny obszar mobile UX gdzie mamy twarde dane retencji. Pierwsze 5 minut decyduje o day-30 retention. Domyślny instynkt — "dodajmy więcej ekranów żeby user się nauczył" — jest niemal zawsze błędny.

## Twarde liczby

| Liczba ekranów onboardingu | Completion rate |
|----------------------------|-----------------|
| 2 ekrany | 40-50% |
| 3-5 ekranów | 30-40% (sweet spot jeśli każdy ekran daje wartość) |
| 5+ ekranów | 20-30% |

**Case study (r/UXDesign, 468 głosów):** SaaS spędził 3 miesiące budując elaborate onboarding (tooltips + walkthroughs + welcome screens). Activation rate: **28%**. Dev przypadkowo wypuścił build BEZ onboardingu. Activation rate: **41%**. Plus 13 punktów procentowych z przypadku.

Cytat z dyskusji (189 głosów): *"If you need a manual the tool isn't intuitive enough — the answer is almost always to invest in the actual product UX rather than layers of instruction."*

**Wniosek:** zanim dodasz onboarding, popraw produkt.

---

## Decision framework: ile ekranów?

| Typ produktu | Onboarding | Powód |
|--------------|------------|-------|
| Tracker, social, utility, todo | 0-1 ekran | Model mentalny intuicyjny — od razu pokaż empty state |
| Productivity z personalizacją | 2-3 ekrany | Personalizacja boostuje retention (15-25%), ale max 3-5 wyborów |
| Skomplikowane narzędzie (3D, audio, finance) | 3-5 ekranów | Genuinely nowy model mentalny wymaga setup |
| Apka z kontem (auth wymagany) | 1 sign-in screen | Auth jako "onboarding" — zero dodatkowych |

**Czerwona flaga:** jeśli twój onboarding ma więcej niż 5 ekranów, prawdopodobnie próbujesz naprawić UX edukacją.

---

## Progressive disclosure vs upfront tutorial

**Upfront tutorial** (4 ekrany "tu są nasze funkcje") — anti-pattern. User klika "skip" lub button-mashe przez ekrany żeby dostać się do produktu. Nic nie zapamiętuje.

**Progressive disclosure** — informacje pojawiają się kontekstowo, kiedy user napotyka funkcję po raz pierwszy:

- Empty state jako nauczyciel (Things 3 pattern): user widzi pustą listę zadań i komunikat "Stuknij + żeby dodać pierwsze zadanie"
- Tooltip pojawia się przy nowej funkcji, ale TYLKO raz, z opcją "Don't show again"
- Coachmarks przy pierwszym wejściu na ekran (max 1-2 elementy zaznaczone, nie cała planszka)

Cytat z r/UXDesign: *"If the onboarding is a one shot thing they saw on first login and can never get back to, it's useless exactly when it would've been useful."* Onboarding musi być DOSTĘPNY na żądanie — nie tylko przy pierwszym uruchomieniu.

**Narzędzia progressive onboarding bez kodowania od zera:** Hopscotch, CommandBar.

---

## Empty state jako nauczyciel

Premium apki (Things 3, Linear, Notion mobile) traktują empty state jako pierwszy moment edukacyjny. Anty-pattern: "Brak danych" + nic więcej.

Co empty state powinien zawierać:

1. **Ilustracja lub ikona** — wizualny kotwica, ale nie obraz na pół ekranu
2. **Headline** — co tu będzie ("Twoje zadania na dziś")
3. **Description** — jak to wypełnić ("Stuknij + na dole żeby dodać")
4. **Primary CTA** — duży przycisk z akcją

```tsx
// Expo + Uniwind empty state
function EmptyTasks({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-4">
      <View className="size-16 rounded-full bg-muted items-center justify-center">
        <CheckCircle2 size={32} colorClassName="accent-muted-foreground" />
      </View>
      <Text className="text-xl font-semibold text-foreground">
        Brak zadań na dziś
      </Text>
      <Text className="text-sm text-muted-foreground text-center">
        Stuknij + na dole, żeby dodać pierwsze zadanie. Zobaczysz je tutaj.
      </Text>
      <Pressable
        onPress={onCreate}
        className="mt-2 px-6 py-3 rounded-full bg-primary active:scale-[0.97]"
      >
        <Text className="text-primary-foreground font-medium">Dodaj zadanie</Text>
      </Pressable>
    </View>
  );
}
```

---

## Just-in-time permissions

Proszenie o wszystkie uprawnienia na starcie = najszybsza droga do odrzucenia. App Store guidelines tego wymagają — just-in-time pattern.

| Permission | Kiedy prosić |
|------------|--------------|
| Lokalizacja | Kiedy user uruchamia funkcję wymagającą lokalizacji (np. "Znajdź w pobliżu") |
| Powiadomienia | Po pierwszym "aha moment" — kiedy user widzi VALUE którą notyfikacje dadzą |
| Kontakty | Tylko jeśli core funkcją jest social — i tylko w momencie zapraszania |
| Aparat | W momencie kliknięcia "Dodaj zdjęcie" |
| Mikrofon | W momencie kliknięcia "Nagraj" |

**Pre-permission priming** — pokaż własny modal WYJAŚNIAJĄCY dlaczego prosisz, ZANIM odpalisz natywny prompt. Użytkownik klika "OK" → wtedy odpalasz natywny prompt danego modułu (`Notifications.requestPermissionsAsync()`, `Camera.requestCameraPermissionsAsync()`, itd. — pakiet `expo-permissions` został usunięty z SDK, każdy moduł ma własne API uprawnień). Jeśli kliknie "Nie teraz" — nie zużywasz native promptu (drugi raz user musi iść do ustawień).

```tsx
// Pre-permission priming
async function requestNotifications() {
  const userOptIn = await showPrePermissionModal({
    title: "Powiadomienia o zadaniach",
    body: "Wyślemy ci subtelne przypomnienia, żebyś nie zapomniał o ważnych terminach. Nigdy spam.",
    primaryCta: "Włącz powiadomienia",
    secondaryCta: "Może później",
  });

  if (!userOptIn) return;

  const { status } = await Notifications.requestPermissionsAsync();
  // jeśli denied — nie pytaj ponownie, daj link do ustawień przy następnej okazji
}
```

---

## Personalizacja w onboardingu

Userzy którzy personalizują apkę podczas onboardingu wykazują **15-25% wyższą retencję w pierwszym tygodniu**.

**Sweet spot: 3-5 wyborów.** Więcej = decision fatigue (paraliż). Mniej = brak poczucia własności.

Każdy wybór musi mieć **bezpośredni wpływ na UX** — nie zbieraj danych "do bazy". Jeśli user wybiera "poziom zaawansowany", widzi inne treści. Jeśli wybiera "preferowana pora" — push notification idzie wtedy.

| Krok | Pytanie | Wpływ na UX |
|------|---------|-------------|
| 1 | Jak masz na imię? | Personalizacja headlines |
| 2 | Co jest twoim głównym celem? | Filtruje content discovery |
| 3 | Kiedy zwykle używasz? | Timing notyfikacji |

**Anti-pattern:** 12-pytaniowy quiz "żeby lepiej cię poznać". User dropuje na pytaniu 5.

---

## Paywall placement

Paywall PRZED zademonstrowaną wartością konwertuje **2-3x gorzej** niż paywall po pierwszym "aha moment".

| Strategia | Konwersja | Kiedy używać |
|-----------|-----------|--------------|
| Hard paywall przed onboardingiem | Niska | Tylko przy bardzo silnym brandzie / produkty B2B |
| Soft paywall po pierwszej wartości | 2-3x lepsza | Default — pokaż user co umie produkt, potem proś |
| Free trial bez karty | Najwyższa | Apki z drogim sub (>$10/mies) |
| Reverse trial (premium → downgrade) | Wysoka long-term | Productivity apki |

**Rule of thumb:** user musi PRZED paywallem wykonać minimum 1 akcję która daje mu wartość. Inaczej "value-first" = pusty slogan.

### Case study: indie iOS $2600/mies — paywall na końcu = **2× konwersja**

Z r/iosdev (237↑, 57 komentarzy, AMA): autor robi **$2600 revenue / $1.9k net** w pierwszy miesiąc po launch. 2/3 sprzedaży przez Apple Search Ads (CPA $0.20), 1/3 przez ASO. Free trial conversion **~15%**.

Kluczowa decyzja designerska: *"Paywall na końcu onboardingu zamiast natychmiast prawie podwoił konwersję."* Onboarding zawiera video demo + images + animations + haptics, **żadnego "AI slop looking stuff"** (bezpośredni cytat). 95% komentarzy konsensus pozytywny.

**Co to potwierdza:** soft paywall po pierwszej demonstracji wartości > hard paywall przed onboardingiem. Twarda walidacja z liczbami, nie wishful thinking.

---

## Anti-pattern: "Welcome back, [imię]" greeting

Dribbble trend ostatnich miesięcy: greeting screen *"Welcome back, [user_name]"* jako pierwszy ekran po loginie. **Konsensus ~80% przeciw** (r/FigmaDesign).

Cytat z dyskusji: *"I know my own name, and the greeting is fluff. Regain the vertical space and you'll see an increase in engagement and spend. This dribbble trend of 'welcome back [insert long name]' which developers will absolutely hate needs to just die."*

**Mechanizm pomyłki:** designerzy mylą "personalizację" z "powtarzaniem czego user już wie". Imię w headline nie boostuje retention — boostuje go **kontekstowa wartość** ("3 nowe wiadomości", "twój streak: 12 dni", "do końca tygodnia: 4 nawyki").

**Reguła:** pierwszy ekran po loginie = **utility focus**, nie ego stroke. Pokaż stan/akcję/wartość, nie greeting.

| Anti-pattern | Pattern |
|--------------|---------|
| "Welcome back, Kacper" + pusty stan | "3 zadania na dziś" + lista |
| "Hi, [name]!" + decorative illustration | Direct content + primary CTA |
| Greeting + "What would you like to do?" | Default ekran z najczęstszą akcją |

Szerszy sygnał: **dribbble trends ≠ user value**. Zanim skopiujesz coś z hot shotów, zapytaj: "co konkretnie user zyskuje z tego elementu?". Jeśli odpowiedź to "wygląda dobrze" — to nie zysk dla usera.

---

## Commitment device pattern

Wellspoken (AI voice coach, $18K/mies revenue, solo dev) ma onboarding z momentem "sealing the commitment" — interaktywnym ekranem gdzie user pisze swoje zobowiązanie i je "pieczętuje" (haptic + animacja).

Cytat usera: *"amazing onboarding experience, the UI interaction around 'sealing the commitment' was great."*

**Mechanizm:** kiedy user fizycznie wykonuje gest deklaracji (kliknięcie + animacja + haptic), buduje **psychologiczny ownership** wobec produktu. Cognitive dissonance theory — porzucenie produktu po publicznym zobowiązaniu boli bardziej.

**Kiedy stosować:** habit trackers, fitness, learning, coaching, jakikolwiek produkt z elementem dyscypliny.

**Implementacja:**
- User wpisuje cel/zobowiązanie własnymi słowami (nie wybór z listy)
- Visual feedback: animacja + haptic w momencie "submit"
- Personalizowany feedback ("Dobra robota, [imię]. Twoje zobowiązanie zostało zapisane.")

---

## Skip option — kiedy DAĆ, kiedy NIE

| Sytuacja | Skip? |
|----------|-------|
| Welcome screen z brandem | TAK (zawsze, mały link "Skip") |
| Personalizacja (3-5 pytań) | TAK na każdym kroku, ale małym fontem |
| Permission requests | TAK ("Może później" jako równoważne ze "Włącz") |
| Login/sign-up | NIE jeśli auth required, TAK jeśli "Continue as guest" jest OK |
| Tutorial fundamental concept | TAK — i tak go zignorują, lepiej kontekstowo |
| Commitment device | NIE — to JEST core wartości |

**Reguła:** skip option pokazuje **szacunek dla użytkownika**. Brak skipu = "musisz to zobaczyć" = paternalizm = niższy NPS.

---

## Progress save (resume onboarding)

User instaluje apkę, zaczyna onboarding, dzwoni telefon, zamyka. Wraca za godzinę. Co widzi?

**Anti-pattern:** restart od ekranu 1.

**Pattern:** zapis progress w `expo-secure-store` (lub `AsyncStorage`), wznowienie z ostatniego kroku.

```tsx
// Hook do multi-step onboardingu z resume
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

const ONBOARDING_KEY = "onboarding_step";

export function useOnboarding(totalSteps: number) {
  const [step, setStep] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDING_KEY).then((saved) => {
      if (saved) setStep(parseInt(saved, 10));
      setIsReady(true);
    });
  }, []);

  const goNext = async () => {
    const next = step + 1;
    if (next >= totalSteps) {
      await SecureStore.deleteItemAsync(ONBOARDING_KEY);
      return { done: true };
    }
    await SecureStore.setItemAsync(ONBOARDING_KEY, next.toString());
    setStep(next);
    return { done: false };
  };

  return { step, totalSteps, goNext, isReady };
}
```

---

## Multi-step wizard (Expo Router modals)

```tsx
// app/(onboarding)/_layout.tsx
import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false, // user nie może swipe back z onboardingu
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="permissions" />
    </Stack>
  );
}
```

Każdy ekran:
1. Header: progress indicator (kropki lub pasek)
2. Treść: 1 pytanie / 1 wartość
3. Footer: primary CTA + skip link

---

## Metryki do śledzenia

| Metryka | Co mierzy | Cel |
|---------|-----------|-----|
| First-week retention | % wracających w 7 dni | >40% (mediana branżowa) |
| Day-30 retention | % aktywnych po 30 dniach | >20% |
| Onboarding completion rate (per ekran) | Drop-off każdego ekranu | <15% drop-off na ekran |
| Time to first meaningful action | Sekundy od install do core akcji | <60s dla utility, <180s dla produktów z auth |
| Permission grant rate | % zgód per permission | Lokalizacja >60%, push >40% |

**Channel split:** mierz osobno organic vs paid. Paid traffic ma niższą retention z definicji.

---

## Powiązane

- `forms-keyboard.md` — input fields w onboardingu (personalizacja, profil)
- `states-loading-empty-error.md` — empty state jako nauczyciel
- `navigation-patterns.md` — modal vs full-screen vs sheet dla onboardingu
- `teardowns.md` — Wellspoken commitment device, Things 3 minimal onboarding

---

*Źródła: r/UXDesign "stopped adding onboarding" (468 głosów, case 28%→41%), r/reactnative Wellspoken AMA (610 głosów, $18K/mies), Useronboard.com teardowny, Apple HIG Onboarding Guidelines, Material Design Onboarding (m3.material.io).*
