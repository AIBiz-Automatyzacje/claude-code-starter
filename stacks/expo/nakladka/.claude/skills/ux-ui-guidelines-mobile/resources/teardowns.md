# Teardowny premium mobile apek

Najlepsze indie apki osiągają wrażenie premium nie przez efekty specjalne, ale przez konsekwentne stosowanie zasad: dyscyplina typograficzna, ograniczona paleta, spójny spacing, przemyślany feedback i platform conventions. Ten plik to katalog konkretnych decyzji designerskich z apek które warto kopiować.

## Affordance vs embellishment — wzorzec wspólny

Wszystkie premium apki rozróżniają:

- **Affordance** = element który KOMUNIKUJE lub UMOŻLIWIA akcję (button z label, ikona z meaningiem, separator który grupuje)
- **Embellishment** = dekoracja dla estetyki bez funkcji (gradient na buttonie, animowany tło, "wow" intro)

Premium apki dają **hojne affordance, zero embellishment**. Custom animacje istnieją żeby komunikować zmiany stanu, nie żeby wyglądać sofistykowanie.

---

## Things 3 — powściągliwość jako sygnał jakości

Cultured Code, task management. App Store rating: 4.8.

**Co konkretnie robią dobrze:**

- **System font (San Francisco Pro)** zamiast custom — szanują inwestycję Apple w typografię, zyskują pełne wsparcie Dynamic Type za zero pracy
- **Paleta kolorów:** wyrafinowany niebieski jako primary + kolory semantyczne (czerwony = pilne, pomarańczowy = deadline, zielony = zrobione). **Zero dekoracji.**
- **Haptyki precyzyjnie skalibrowane** — silniejszy haptic przy destrukcyjnych akcjach (delete), subtelniejszy przy non-destructive (toggle, complete)
- **Empty state jako nauczyciel** — onboarding to praktycznie 1 ekran, potem empty state kontekstowo tłumaczy "dodaj swoje pierwsze zadanie"
- **Animowane przesuwanie listy** — kiedy task się przesuwa do innej sekcji, animacja TŁUMACZY tę zmianę

**Co indie dev może ukraść:** używaj system fontów. Dynamic Type za darmo, Apple updates za darmo, accessibility za darmo.

**Detail:** swipe na zadaniu odsłania action z bardzo wąskiego paska. Nie trzeba precyzji — działa od ledwo widocznego ruchu palca. To affordance: "tu jest akcja", nie "tu jest piękny button".

---

## Bear — typografia jako system

Shiny Frog, notatki. App Store rating: 4.7.

**Co konkretnie robią dobrze:**

- **Każdy element notatki ma odrębne traktowanie typograficzne** — tytuły, body, code blocks, cytaty, TODO. Hierarchia komunikuje funkcję bez dodatkowych kolorów.
- **Markdown-driven editor** — power userzy piszą syntaksem (`# Title`, `**bold**`), wizualny feedback pokazuje strukturę. Nie wymuszają ręcznej kontroli wyglądu.
- **Sidebar z micro-animations** — tagi/foldery rozjeżdżają się płynnie przy klik, ale animacja kończy się ZANIM user mógłby się zniecierpliwić (~200ms)
- **Dark mode dostaje RÓWNE traktowanie co light mode** — kolory komunikują te same znaczenia semantyczne, ale dostosowane do kontekstu słabego oświetlenia. Nie "light mode z dodanym ciemnym tłem".

**Co indie dev może ukraść:** zaprojektuj dark mode od razu, nie jako afterthought. Każdy semantic color musi mieć parę (light + dark) z tym samym znaczeniem.

**Detail:** tytuł notatki = pierwsze niepuste linia. Bez osobnego inputa. Mniej UI = mniej decyzji dla usera.

---

## Arc Search — content-first nawigacja

The Browser Company, mobile browser. Niche audience, ale design jest wzorcem.

**Co konkretnie robią dobrze:**

- **Reorganizacja UI per tryb wyszukiwania** — web, obrazy, wideo dostają różne dominujące przestrzenie wizualne, nie tylko taby
- **Powściągliwa paleta** — content (wyniki) jest gwiazdą, interfejs schodzi w cień
- **Subtelne animacje** kierują uwagę gdzie jest najważniejsza informacja, nie tworzą szumu
- **Onboarding przez kontekstowe wskazówki** — zero długich instrukcji, wiara w intuicyjność produktu

**Co indie dev może ukraść:** kiedy user zmienia kontekst (typ wyszukiwania, mode, filtr) — zmień LAYOUT, nie tylko content. To komunikuje "jesteś w innym trybie" bez dodatkowych etykiet.

**Detail:** "Pinch to summarize" — gest pinch na artykule generuje AI summary. Nieoczywisty gest, ale raz odkryty staje się nawykiem. Power user feature ukryty pod intuicyjnym gestem.

---

## Linear Mobile — design system + native conventions

Linear, project management. Brand-strong + iOS-respectful.

**Co konkretnie robią dobrze:**

- **Balance między brandem a iOS conventions** — masz Linear's design language, ale pull-to-refresh, sheet detents, swipe back działają jak na każdej innej apce iOS
- **System fonts** ze starannie skalibrowanymi rozmiarami i wagami
- **Spacing creates visual rhythm** — 4/8/12/16/24/32px scale konsekwentnie w całej apce
- **Haptic confirmation** na każdej destrukcyjnej akcji (assign, delete, status change)

**Co indie dev może ukraść:** twój brand może istnieć BEZ łamania platform conventions. Custom button kolory ✓. Custom navigation patterns ✗.

**Detail:** sheet z action menu zawsze otwiera się w iOS native style (`.medium` detent najpierw, potem `.large`). User czuje że to natywne — bo JEST natywne, tylko z brand colors.

---

## Calorify — dane bez przeciążenia

Calorie tracker, niche productivity.

**Co konkretnie robią dobrze:**

- **Stopniowane wizualizacje** — top-level pokazuje 1 liczbę (kalorie dziś), tap odsłania breakdown (proteiny/węgle/tłuszcze), kolejny tap pełen wykres
- **Semantic colors w roli funkcjonalnej** — czerwony = deficyt, zielony = norma, pomarańczowy = nadwyżka. Status komunikowany BEZ tekstu.
- **Optymalizacja pod fast input** — najczęstsze akcje (dodaj posiłek, scan barcode) na 1 tap od home screen

**Co indie dev może ukraść:** Tracking apki wymagają **efficiency, nie piękna**. Każdy dodatkowy tap przed core akcją = mniej userów którzy faktycznie trackują.

**Detail:** "Recently logged" jako pierwsza sekcja w "add food" — bo userzy jedzą podobne rzeczy codziennie. ML nie potrzebny, prosty algorytm "most frequent in last 7 days" wystarczy.

---

## Wellspoken — solo dev, design jako differentiator

AI voice coach, React Native/Expo, **$18K/mies revenue**, zero paid ads (po wyłączeniu Meta Ads).

**Twórca jest product designerem.** Cytat: *"Don't look like any other vibecoded apps. I'm a product designer by training so I made sure my app looked distinct."*

**Co konkretnie robią dobrze:**

- **Onboarding z "commitment device"** — moment "sealing the commitment" gdzie user pieczętuje zobowiązanie (interactive haptic + animation). Komentarz usera: *"amazing onboarding experience."*
- **Custom animations z Lottie** — workflow: Figma → Jitter → Lottie eksport → React Native
- **Midjourney moodboard** — feature graphics wyróżniające się od templated stocków
- **Distinct visual language** — solo dev z designerskim okiem produkuje apkę nie do odróżnienia od studyjnej

**Designerski workflow (transparent z AMA):**

```
Figma         →  Jitter           →  Lottie eksport  →  React Native
(design)         (animacje 2D)       (JSON format)      (lottie-react-native)
```

Plus **Midjourney** dla moodboard / feature graphics (Hero illustrations, paywall screens, marketing assets w samej apce).

**Czemu ten workflow działa:**

1. **Figma** — single source of truth dla designu statycznego. Wszystkie ekrany, komponenty, tokens.
2. **Jitter** — zamiast Lottie/After Effects (krzywa nauki), Jitter to web-based animator z bezpośrednim importem Figma frames. Animacja in-and-out w godziny, nie dni.
3. **Lottie eksport** — vector-based animacja, mała wagowo (KB nie MB), 60fps na wszystkich urządzeniach, działa offline.
4. **Midjourney moodboard** — odróżnia od stockowych ilustracji (Unsplash, Undraw) które krzyczą "templated apka".

**Caveat:** Wellspoken to n=1 case study (jeden product designer, jedna apka). Workflow jest powtarzalny i dokumentowany, ale finansowy success mógł zależeć od innych czynników (timing AI hype, ASO, viralowy Reddit post). Designerski workflow sam w sobie = solidny baseline dla solo devów chcących premium feel.

**Liczby (transparent z AMA):**

| Pozycja | Kwota/mies |
|---------|------------|
| Revenue gross | $18K |
| API costs (LLM) | -$1K |
| AI coding tools | -$500 |
| Servers | -$200 |
| RevenueCat (1%) | -$180 |
| App Store cut (15%) | -$2.7K |
| **Take-home** | **~$10K** |

Android = ~10% revenue z **zero dodatkowego nakładu** dzięki React Native cross-platform.

**Co indie dev może ukraść:** custom animations Lottie >> generic Reanimated transitions, kiedy chcesz wyróżnić moment. Zachowaj ich na 2-3 kluczowe momenty (onboarding, success, achievement) — nie spamuj.

---

## Duolingo — emocjonalne postacie jako mechanizm retencji (verified data)

Duolingo, language learning. **Najsilniejsze dane retention w mobile design**: po wprowadzeniu pełnych animacji postaci w 2022, **DAU wzrosło z 14.2M do 34M w ciągu 2 lat** (publicznie ujawnione przez Duolingo, potwierdzone w wielu raportach inwestorskich).

**Mechanizm — emocjonalna pętla feedbacku (framework Don Normana):**

1. User wykonuje akcję (poprawna odpowiedź / błąd / streak milestone)
2. Postać reaguje **emocjonalnie** (radość, smutek, doping, zachęta)
3. User czuje się **widziany** przez apkę — jak przez nauczyciela, nie algorytm
4. Pętla zamyka się: powrót następnego dnia, bo "obiecałem to mojej maskotce"

**To nie ozdoba — to mechanizm konwersji wsparty twardymi danymi.**

### Wzorzec potwierdzony przez inne premium apki

| Apka | Mechanizm | Wynik |
|------|-----------|-------|
| **Phantom** (crypto wallet) | Maskotka humanizująca crypto | **#2 US App Store utilities** (verifiable App Store ranking) |
| **Revolut** (fintech) | Tactile responsive charts (drag = glow) zamiast maskotki | "Premium feel" jako differentiator vs banki |
| **Duolingo** (language) | Animowane postacie reagujące emocjonalnie | DAU 14.2M → 34M w 2 lata |

**Insight kluczowy:** Apple **celowo ogranicza haptics i animacje** żeby obsłużyć 1B userów (system musi działać dla wszystkich, włącznie z najsłabszymi telefonami i osobami z motion sensitivity). **Indie apki mogą iść dalej — i właśnie w tym leży ich przewaga**. Niedoinwestowane warstwy systemu = miejsce gdzie indie dev może wygrać z gigantami.

### Co indie dev może ukraść

1. **Maskotka nie musi być figuralna** — Revolut udowodnił że **tactile responsive elements** (drag = visual feedback, swipe = haptic) tworzą ten sam efekt "apka mnie widzi"
2. **Reaguj na sukces I porażkę** — większość apek reaguje tylko na sukces (confetti). Reakcja na porażkę (subtle, empatyczna) buduje silniejszą więź emocjonalną
3. **Streak milestones jako emotional anchors** — 7, 30, 100 dni → subtle celebration moment (nie infomercial)
4. **Bez animacji haptyka też działa** — confirm/error/selection patterns z `expo-haptics` to "emotional feedback" w mikroskopowej skali

**Caveat dla designera:** Duolingo cofnął niektóre animacje po feedbacku userów ("agresywne notyfikacje od smutnej sowy"). **Emocjonalny feedback to broń obosieczna** — przekroczenie linii staje się emotional manipulation, nie design. Reguła: postać reaguje, nie żebrze.

→ Patrz [[resources/haptics-gestures.md]] dla `expo-haptics` jako mikro-skali emotional feedback.

→ Patrz [[resources/onboarding.md]] dla commitment device pattern (Wellspoken) jako podobnego mechanizmu emocjonalnego.

---

## Apollo Reddit (legacy, ale wzorzec) — gestures w roli first-class

Christian Selig, RIP po Reddit API price hike (2023). Wzorzec wciąż relevant.

**Co konkretnie robili dobrze:**

- **Customizable swipe actions** — user mógł przypisać gesty do akcji per kierunek (left/right + short/long)
- **Haptic per akcja** — różne haptic patterns per akcja (upvote ≠ save ≠ hide)
- **Power user features ukryte pod gestami** — long press na komentarzu = quick reply, force touch (legacy) = preview

**Co indie dev może ukraść:** gesty to second-class UI w większości apek. Premium = gesty są first-class, każda akcja ma gestureowy odpowiednik.

---

## Streaks — pojedyncza koncepcja, dopracowana w 100%

Crunchy Bagel, habit tracker. App Store editorial frequent feature.

**Co konkretnie robią dobrze:**

- **Limit 12 habitów** — twórcy świadomie ograniczyli, żeby user nie skończył z 50 habitami z których nic nie robi. Less is more = better retention.
- **Single tap to complete** — żaden szczegółowy log, żaden modal. Tap = done.
- **Spring animations on complete** — physical-feeling feedback (Reanimated `withSpring`)
- **Confetti haptic** na completion streak milestone (7, 30, 100 dni)

**Co indie dev może ukraść:** **constraint jako feature**. Limit ilości czegoś (12 habitów, 5 priorytetów, 3 cele dziennie) wymusza user'a do refleksji "co jest najważniejsze". User dostaje wartość Z TEGO ograniczenia, nie pomimo niego.

---

## 5 detali które się sumują (pattern across apek)

Te detale pojawiają się w każdej premium apce — pojedynczo małe decyzje, razem tworzą skumulowane wrażenie jakości:

1. **Spójne paddingi/marginesy tworzące rytm** — scale 4/8/12/16/24/32, nie random `15px` tu, `17px` tam
2. **Starannie dobrane rozmiary elementów** — large hero text vs small metadata, kontrast wagi
3. **Paleta ograniczona do 3-5 kolorów + warianty semantyczne** — nie 47 odcieni
4. **Hierarchia typograficzna jasno komunikująca priorytet** — H1 wyraźnie >>> body, body wyraźnie >>> caption
5. **Touch targets min 44pt (iOS) / 48dp (Android)** — nawet jeśli ikona wyglada na 24px, hitarea ma 44

Każdy z tych detali z osobna to mała decyzja. Razem w całej apce = "premium feel".

---

## Cal.com mobile — open-source jako benchmark

Cal.com (kalendarz/booking, open-source). Mobile experience zbliżony do natywnych konkurentów.

**Co konkretnie robią dobrze:**

- **Booking flow w 3 tap** — wybierz typ → wybierz slot → potwierdź. Nie ma 12-step wizardu.
- **Smart defaults** — strefa czasowa wykrywana, dostępność predefiniowana, język z device
- **Native sharing** — booking link generowany przez native share sheet (iOS/Android), nie custom modal

**Co indie dev może ukraść:** **smart defaults > step-by-step config**. Każde pole które user MUSI wypełnić = drop-off. Detect z device co tylko możesz.

---

## Common bullshit do uniknięcia (anti-patterns z teardownów)

| Anti-pattern | Dlaczego źle | Co zamiast |
|--------------|--------------|------------|
| Splash screen 3 sekundy | User chce produkt, nie brand reveal | <1s, tylko logo + tło |
| 4-screen tutorial intro | 60-70% userów klika skip | Empty state + progressive disclosure |
| Modal w modal w modal | Nawigacja staje się labyrintem | Push to stack, nie modal stacking |
| Custom navigation gestures (np. swipe up to back) | Łamie iOS conventions | Native swipe back left edge |
| Branded loading spinner | Loading powinien znikać szybko | Skeleton + optimistic UI |
| Floating "Premium" badge na wszystkim | User wyłącza świadomość | Premium feature pokazany w kontekście |
| Toast "Sukces!" po każdej akcji | Toast fatigue | Subtelny haptic + state change |

---

## Tot — minimalizm jako feature

The Iconfactory, scratchpad app. 7 dotów = 7 notatek, koniec. App Store rating: 4.6.

**Co konkretnie robią dobrze:**

- **Hard limit 7 notatek** — nie ma "save", nie ma listy, nie ma folderów. 7 dotów na top, każdy = 1 notatka.
- **Brak save buttona** — type → auto-save. User nigdy nie traci treści.
- **Color-coded tabs** — każdy dot ma swój kolor. Memory anchor dla "ten czerwony to lista zakupów".
- **Konsekwentnie ten sam typeface across całej apki** — IBM Plex Mono lub system mono jako single source of truth.

**Co indie dev może ukraść:** **constraint as differentiator**. Konkurencja (Apple Notes, Notion, Bear) ma unlimited. Tot wygrywa userów którzy mają decision paralysis przy "którego foldera użyć".

**Detail:** kiedy user wraca do Tot po dniach, ostatnio aktywny dot świeci subtle accent — apka pamięta gdzie użytkownik skończył.

---

## Fantastical — calendar jako wzorzec gestów

Flexibits, calendar app. Power user favorite.

**Co konkretnie robią dobrze:**

- **Natural language input** — user wpisuje "Lunch z Kate jutro 12" → parser tworzy event z properly filled polami
- **Pinch to zoom** — między day/week/month view płynne przejście, nie tap-tab-tap
- **Long press = preview** — event preview bez otwierania detail screen
- **Differentiated event types przez visual hierarchy** — meeting (default), all-day (banner), travel (timeline range), birthday (icon)

**Co indie dev może ukraść:** dla power user features, **gesty > buttony**. Pinch-to-zoom dla view switching = mniej UI, więcej intuicji.

**Detail:** kiedy user dotyka i przeciąga event w day view, godziny pokazują się jako floating tooltip. Precyzja bez visual noise.

---

## Co indie dev musi przyjąć

Wellspoken twórca: *"You don't need to be a studio for an app to look premium — but you must THINK like a designer, not like a dev who 'also does UI'."*

**Praktycznie:**

1. **Mocna typografia > custom efekty** — zacznij od dyscypliny typograficznej (Things, Bear). Custom rzeczy przyjdą później.
2. **Konsekwencja > różnorodność** — limit do 3-5 kolorów, 6 spacing values, 4 text sizes. Spojność > kreatywność.
3. **Haptyki na wszystkim co znaczące** — bezpłatny premium feel. `expo-haptics` zajmuje 5 minut setup.
4. **Empty states zaprojektuj jako pierwsze** — bo user widzi je najczęściej w pierwszych 24h.
5. **Test na slow network + low battery** — premium feel znika gdy apka mrozi się 5 sekund.

---

## Powiązane

- `onboarding.md` — Wellspoken commitment device szczegółowo
- `states-loading-empty-error.md` — Things 3 empty state pattern
- `navigation-patterns.md` — Linear native conventions + brand
- `forms-keyboard.md` — fast input patterns z Calorify

---

*Źródła: r/reactnative Wellspoken AMA (610 głosów, 180 komentarzy, $18K/mies transparent — n=1 case study z transparent revenue), Duolingo publicznie ujawnione DAU (14.2M → 34M 2022-2024, raporty inwestorskie), Phantom #2 US App Store utilities (verifiable App Store ranking), Mobbin.com case studies, Page Flows teardowns, Built For Mars mobile reviews, App Store editorial features 2025/2026, raport Perplexity mobile design best practices. Ostatni update: 2026-05-15.*
