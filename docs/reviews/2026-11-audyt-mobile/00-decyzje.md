# Audyt mobile (Etap 0) — decyzje i wnioski

Data: 2026-11-02. Raporty: A0.1 (delty pipeline'u), A0.2 (plugin Expo), A0.3 (świeżość skilli mobile), A0.4 (wytyczne RN
i stylowanie), A0.5 (reguły kodu), A0.6 (lekcje z `gramywpadla` i `Nawykometr`), A0.7 (agenci mobile a kontrakt web).

## Wniosek ogólny

Stary szablon mobile nie nadaje się do „aktualizacji” — w kilku miejscach prowadzi prosto do udokumentowanych bugów
(`expo-tailwind-setup` przypina wadliwy NativeWind v5 preview + nightly; `mobile-e2e-maestro` zakazuje dev-clienta
i zaleca `permissions: all: allow`, które na iOS 26.4 nie działa; skille Supabase/Sentry mobile mają 11 błędów P1).
Z mobile przechodzi **wiedza** (34 adaptacje pipeline'u, ~60 reguł RN, lekcje projektów), a **forma** (agenci, skille
wspólne, workflowy) przychodzi z rdzenia web. To potwierdza architekturę planu: rdzeń + nakładka.

## Decyzje (rekomendacja → do potwierdzenia)

Kluczowe — wymagają Twojego zdania:

| # | Decyzja | Rekomendacja | Źródło |
|---|---|---|---|
| D6 | Skille Expo | **Oficjalny plugin `expo@expo-plugins`** + lokalnie tylko hub stosu (przemianowany z `expo-overview`) i skill silnika stylowania. Ładowanie `expo:*` na żądanie (builderzy dostają narzędzie `Skill`), preload tylko wytycznych. Blokada `npx @expo/agent-cli feedback` regułą `deny` + bramka „plugin zainstalowany” w doctorze. Kopia jest już merytorycznie błędna, wyzwalanie 8/8 po polsku i angielsku. | A0.2, A0.7 |
| D7 | Stylowanie | **Tailwind v4 przez `className` na Uniwind** (stabilny na TW v4, oficjalny skill autorów, w docs i przykładach Expo), po **jednej sesji spike'u na SDK 58**; NativeWind v5 jako zapas po wydaniu stabilnej. Ryzyka: młodszy projekt, wersja Pro, `rem` 14 px. | A0.4 |
| D8 | Runner testów mobile | **jest-expo + RNTL 14 + Jest 30** — jedyna ścieżka wspierana przez Expo na SDK 58, wymagana przez `expo-router/testing-library`. Komenda testów i rozgrzewka w slocie `stack/walidacja.md`; projekty na Vitest (`gramywpadla`) działają przez ten slot. | A0.5, A0.6 |
| D9 | Storage sesji Supabase | **Domyślny wariant Supabase** (`expo-sqlite/localStorage`) + `LargeSecureStore` jako opcja dla aplikacji z danymi wrażliwymi — do potwierdzenia, od tego zależy waga reguły „token w AsyncStorage = CRITICAL”. | A0.3 |
| D10 | Płatności w mobile | Zastąpić przykład Stripe Checkout odesłaniem do IAP/RevenueCat; Stripe tylko dla treści niecyfrowych (zasady App Store 3.1.1 / Google Play). | A0.3 |

Techniczne — przyjmuję rekomendację, chyba że zmienisz:

| # | Decyzja | Rekomendacja |
|---|---|---|
| D11 | Obcy proces na porcie E2E | Polityka per adapter: web `stop`, mobile `zastap` (dev-client czyta env przy starcie Metro). |
| D12 | Bloker środowiska w trakcie runu | Polityka per sygnatura: web `[Manual]` + restart; mobile (brak modułu natywnego, entitlements) STOP + rebuild. |
| D13 | Swap `.env.local` | Najpierw sprawdzić w spike'u alternatywę (env procesu Metro / `.env.<mode>`); bez niej — swap 1:1 z rollbackiem. |
| D14 | `expo-doctor` | Deterministyczna bramka w `scripts/bramki/`. |
| D15 | Dane dla skryptów | Jeden slot danych `.claude/stack/profil.json` obok slotów `.md`. |
| D16 | Login canary kontem e2e | Do rdzenia (web też korzysta). |
| D17 | `[E2E]` w planie mobile | Walidator wymaga pliku flow jako deliverable buildera; brak pliku → przyczyna SKIP `scenariusz-niewykonalny` (bez nowej przyczyny w rdzeniu). |
| D18 | Smoke autopilota mobile | Nowy fixture RN z jednym ekranem i flow Maestro. |
| D19 | MCP Expo | Wyłączony w szablonie; projekt może włączyć (narzędzia `observe_*`). |
| D20 | Pliki stackowe w skillach | Jedna nazwa `references/stack.md`; frontmatter skilli wspólnych neutralny (suma `paths:`). |
| D21 | `learned-patterns.md` | Nie przenosimy z szablonu (to indeks projektu). Pilot: najpierw konwersja reguł projektu do `docs/solutions/`/`stack.md`, potem sync — inaczej sync usunie edytowany plik (49 reguł w `gramywpadla`). |
| D22 | Testy CI plików ról | W Etapie 1 rozdzielić na rdzeń i stack (dziś wymagają literalnie `vitest related --run`). |
| D23 | Warianty `-figma` | Mobile je ma (rdzeń je wybiera i CI wymaga), na skillach z pluginu `figma`. |
| D24 | `e2e-setup` | Wchłonąć w wariant Maestro `weryfikacja-setup`, potem usunąć. |
| D25 | Hook antywzorców | Naprawić 3 defekty (filtr komentarzy, odesłanie, `*.web.tsx`/`+html`/`supabase/functions`), dodać 3 wzorce: `SafeAreaView` z `react-native`, `process.env[`, `Permission: false`. |

## Spike (jedna sesja, przed Etapem 2)

Na świeżym projekcie Expo SDK 58: Uniwind (TextInput + className, line-height, `translate` w %, `boxShadow` na Androidzie,
`rem` vs „1 pt Figma = 1 px”); `tsconfig` rdzenia (`verbatimModuleSyntax`, `erasableSyntaxOnly`) z `expo/tsconfig.base`;
`AbortSignal.timeout` w RN 0.88/Hermes; alternatywa dla swapu `.env.local`; reguła `deny` dla feedbacku Expo w trybie
autopilota; jest-expo + RNTL na Expo Router.

## Pilne poza planem

1. **Supabase CLI 3.0.0** (wydany 2026-11-02, tag `latest`): nieinteraktywny `db push` bez `--yes` kończy się błędem,
   `--db-url` przestarzałe. Dotyczy db-sync weba (`dev-autopilot-wf.js:597`), `templates/e2e-env` i smoke vibersi.
   Operator ma lokalnie 2.106.0 — nie aktualizować przed migracjami prod vibersi; szablon dostosować osobną poprawką
   (`popr/*`) albo przypiąć v2 w doctorze.
2. **Projekty mobile na wadliwym zestawie NativeWind** (`5.0.0-preview.2` + nightly `react-native-css`) — sprawdzić
   `gramywpadla` i `Nawykometr`; nie powielać w nowych projektach.
3. **Błędy w skillach web** (A0.3 §4.4, A0.5 §3): limit Realtime 100 kanałów (nie 500), `@sentry/deno` 11 ma integrację
   z `Deno.serve`, przykład `auth-patterns.md` sprzeczny z regułą zależności efektu na `user?.id`. Osobna `popr/*`
   przed Etapem 1.

## Korekty planu wynikające z audytu

- IU-2.1: „test padający bez poprawki” to reguła fixa P1, nie kontrakt builderów — usunąć z IU-2.1.
- IU-2.8: `learned-patterns` nie przenosimy do szablonu (D21).
- Etap 1: dojść testy CI ról (D22), slot `profil.json` (D15), polityki adaptera E2E (D11, D12), przyczyna SKIP (D17),
  login canary (D16), podział `coding-rules.md` (~93% rdzeń; 8 reguł neutralnych z odesłaniem do `stack.md`; 3 dziś
  psują mobile: `AbortSignal.timeout`, wykrywanie React Compilera, „testy obok źródeł” vs Expo Router) i 6 nowych reguł
  rdzenia z lekcji projektów (A0.5 §4).
- Etap 2: lista skilli i agentów wg tabel A0.3 i A0.7; nowy skill `rn-expo-guidelines` (A0.4 §7); `rules/stack.md`
  mobile z projektu w A0.5 §2.
