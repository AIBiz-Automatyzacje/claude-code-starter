---
title: "feat: Szablon mobile budowany z rdzenia claude-code-starter + nakładka Expo"
type: feat
status: draft
date: 2026-11-01
origin: rozmowa 2026-11-01 (przegląd poprawek vibersi → pytanie o szablon mobile)
---

# feat: Szablon mobile budowany z rdzenia + nakładka Expo

## Przegląd

`workspace-template-mobile` (Expo / React Native + NativeWind + Supabase, E2E przez Maestro) jest ostatnio zrównany z webem
na commicie `456cd9b` (2026-09-01). Od tego czasu web (`claude-code-starter`) dostał **645 commitów**: audyt pipeline'u, serie
P0–P27, klasy agentów, nowych reviewerów, bramki, dossier, telemetrię, dev-pr, weryfikację, makietę. `.claude/` weba ma 408
plików, mobile 171. Ręczny port co kilka miesięcy (dotąd 3 razy) nie nadąża.

Cel planu:
1. Przenieść przebudowę na mobile, dopasowaną do Expo/Maestro/EAS.
2. Odświeżyć skille mobile (techniczne Expo i wspólne z wariantem mobile).
3. **Sprawić, żeby każda zmiana w webie sama trafiała do mobile** — bez ręcznych portów.

## Diagnoza (stan na 2026-11-01)

Z inwentaryzacji obu repo (241 plików nietestowych weba):

| Kategoria | Ile | Co |
|---|---|---|
| RDZEŃ (bez założeń o stacku) | ~120 | agenci `klasa-*`, reviewerzy (correctness, spec-compliance, test-coverage), skrypty `pr`, `telemetria`, `wiedza`, `ogrod`, większość `plan` i `dossier`, `e2e/scenariusze|ksiegowanie|mapa|weryfikacja`, dev-brainstorm, dev-compound-refresh, dev-pr, zroastuj-mnie, sync-template |
| RDZEŃ + wtręty webowe | ~50 | 6 workflowów (prompty: warmup vitest, fix E2E przez agent-browser, opis „vite build”), `bramki`, `doctor`, dev-plan (tabela builderów §3.5, sekcja E2E), dev-docs-complete, dev-prep, coding-rules, settings.json, templates/bramki, security-sentinel, performance-oracle |
| TYLKO WEB | ~70 | buildery UI/fullstack (+figma), `feature-tester-e2e`, skille agent-browser, tailwind-react-guidelines, ux-ui-guidelines, makieta, coolify-manager, `scripts/e2e/srodowisko|start|serwer|zrzuty|szkielet`, `doctor/port-e2e`, `templates/e2e-env` |

Wiedza tylko-mobile do zachowania: buildery `feature-builder-mobile-{ui,data,fullstack}`, tester Maestro, skille `expo-*` (14),
`eas-*` (4), `mobile-e2e-maestro`, `e2e-setup`, `ux-ui-guidelines-mobile`, hook `mobile-anti-pattern-check.sh`,
`rules/learned-patterns.md` (2 reguły Maestro), `templates/e2e-env` (Metro, canary), oraz ok. 400 linii logiki env-up
zaszytej w promptach `dev-autopilot-wf.js` mobile (Metro :8081, emulator iOS-first, świeżość dev-clienta, prebuild, seedy `.maestro`).

Rzeczy, które mobile ma, a web **świadomie usunął** (z następcą): skille `dev-autopilot`, `dev-docs*`, `bugfix`, `code-review`,
`code-quality`, `dev-ideate`, `gemini`, `freshness-audit`; agenci `kieran-typescript-reviewer`, `code-simplicity-reviewer`;
lokalny `figma-design-to-code`. Mobile idzie za decyzjami weba — nie przenosimy ich dalej.

Już istniejące „szwy”, na których budujemy: komendy walidacji z `package.json` + lockfile (nie zgadywane), bramki
uruchamiane tylko gdy narzędzie jest w projekcie, doctor warunkowy, `dossier/profil.mjs` zna `expo`/`react-native`,
skill `weryfikacja` per projekt (sekcje Launch/Doctor/Drive/Evidence), parametry `.env.e2e` w `srodowisko.mjs`.
Brak: deklarowanego profilu stacku i rozróżnienia plików wspólnych od stackowych w `sync-template.sh`.

## Decyzja architektoniczna (rekomendacja)

**Jedno źródło prawdy: `claude-code-starter` = rdzeń + warstwa web. Mobile = ten sam rdzeń + nakładka Expo, budowany
automatycznie i publikowany do `workspace-template-mobile`.**

```
claude-code-starter/
  .claude/                  ← rdzeń + warstwa web (jak dziś; projekty web bez zmian)
  stacks/
    sloty.json              ← rejestr slotów stackowych (pliki web, które stack może podmienić/usunąć)
    expo/
      nakladka/.claude/...  ← pliki mobile: podmiany slotów + pliki dodatkowe
      usun.txt              ← pliki web do usunięcia w wariancie mobile
      settings.patch.json   ← deep-merge do settings.json (hooki mobile, pluginy)
      __tests__/            ← testy kontraktu nakładki
    zbuduj.mjs              ← skleja wariant: rdzeń + nakładka → katalog wyjściowy
.github/workflows/
  maszyneria.yml            ← + job: zbuduj expo i uruchom testy na wyniku
  publikuj-mobile.yml       ← push na main → zbuduj expo → commit do workspace-template-mobile
```

Zasady, które robią z tego mechanizm bezkonfliktowy:
1. **Nakładka podmienia tylko całe pliki, nigdy nie łata.** Łatki na workflowy rozjechałyby się przy pierwszej zmianie rdzenia.
2. **Tekst zależny od stacku nie siedzi w rdzeniu.** Workflowy i skille rdzenia odsyłają do plików-slotów
   (np. „wykonaj kroki z `.claude/stack/e2e-srodowisko.md`”, „tabela builderów: `.claude/stack/buildery.md`”).
   Web dostarcza wersję web, Expo — swoją.
3. **Te same nazwy ról agentów.** `feature-builder-ui|data|fullstack` i `feature-tester-e2e` istnieją w obu wariantach;
   w mobile mają treść RN/Maestro. Enumy i routing w workflowach się nie zmieniają. Nazwy `feature-builder-mobile-*` znikają.
4. **Strażnik w CI** (test w `maszyneria.yml`):
   - pliki rdzenia (poza `sloty.json`) nie zawierają słów stacku (`vite`, `agent-browser`, `tailwind`, `shadcn`, `5173`, `pnpm dev`…)
     — lista wyjątków jawna;
   - każdy slot ma w nakładce Expo podmianę albo wpis w `usun.txt`;
   - wariant Expo się buduje, workflowy parsują się (`skladnia-workflowow.test.mjs`), testy rdzenia przechodzą na wyniku.
   Zmiana w webie, która psuje mobile, zatrzymuje się w tym samym commicie, a nie miesiące później.
5. **Projekty mobile bez zmian w mechanice:** dalej robią `/sync-template` z `workspace-template-mobile` (ten repo staje się
   wyjściem builda + własny README/docs). `.template-manifest` sam usunie wycofane pliki, backup w `.claude/.backups/`.

### Zasady rozjazdów web ↔ mobile

Każda różnica między wariantami jest jawna i pilnowana przez CI. Cztery poziomy, od najczęstszego:

| Poziom | Kiedy | Mechanizm | Przykład |
|---|---|---|---|
| 1. Podmiana pliku | ta sama rola, inna treść | plik w nakładce zastępuje plik web; **kontrakt wejścia/wyjścia identyczny** (test kontraktu w CI) | `feature-builder-ui` (React DOM → RN), `feature-tester-e2e` (agent-browser → Maestro, ten sam format PASS/FAIL/SKIP dla `ksiegowanie.mjs`) |
| 2. Fragment stackowy | wspólny plik, inny kawałek | rdzeń odsyła do `.claude/stack/<slot>.md` albo `references/stack.md` skilla | krok „uruchom aplikację do E2E” w autopilocie; różnice mobile w `security` |
| 3. Punkt rozszerzenia | mobile potrzebuje kroku, którego web nie ma | stały slot w rdzeniu, web ma wersję „nic do zrobienia” | `stack/po-fazie.md`: prebuild + pod install po zmianie warstwy natywnej |
| 4. Fork pilnowany | naprawdę inny przebieg, nie da się rozbić | pełna kopia w nakładce + w `sloty.json` hasz wersji rdzenia, z której powstała; zmiana tego pliku w rdzeniu **zatrzymuje CI**, dopóki ktoś nie zdecyduje „przenoszę” albo „nie dotyczy” i nie zaktualizuje hasza | wyjście awaryjne; częsty fork pliku = sygnał, żeby rozbić go na fragmenty (poziom 2) |

Do tego: rzeczy tylko-web → `usun.txt` (z adnotacją „do zrobienia: wariant mobile”, jeśli mobile ma je dostać później); rzeczy
tylko-mobile → dodatkowe pliki w nakładce.

Odrzucone warianty:
- *Dwa niezależne repo + okresowe porty* — stan obecny, 645 commitów zaległości.
- *Nakładka w repo mobile, rdzeń ciągnięty przy syncu z dwóch źródeł* — zmiana rdzenia, która psuje mobile, nie jest widoczna
  w CI weba; dwa źródła komplikują `sync-template.sh` w każdym projekcie.
- *Łatki (patch) na workflowy* — kruche, patrz zasada 1.

## Etapy

### Etap 0 — Audyt treści mobile (przed jakąkolwiek infrastrukturą)

Cel: ustalić **co** ma być w wariancie mobile, zanim zbudujemy **jak** to dostarczać. Wyniki audytu decydują o kształcie slotów,
zawartości nakładki i `usun.txt`. Bez zmian w kodzie — wynik to raport z tabelą decyzji per skill/agent/reguła.

Fakty zebrane 2026-11-01, które audyt musi rozstrzygnąć:
- **Upstream Expo to oficjalny marketplace pluginów Claude Code** (`expo/skills`, marketplace `expo-plugins`, pluginy `expo`
  i `expo-experiments`). Nasze 16 skilli `expo-*`/`eas-*` to kopie z `472d040` (2026-08-23); upstream ma od tego czasu
  ~30 commitów (HEAD `a9e5bd3`, 2026-11-01).
- **Upstream usunął skill NativeWind** (`a8f0b6c`, „[expo] remove NativeWind skill”), a nasz stack to NativeWind — lokalny
  `expo-tailwind-setup` jest osierocony.
- Nowe skille upstream poza naszą kopią: `eas-update`, `eas-observe` (błędy, crashe), `eas-simulator` (symulator w chmurze —
  potencjalnie istotny dla E2E), `expo-app-clip`, `expo-brownfield`, `expo-web-to-native`, `expo-examples`.
- `rules/coding-rules.md` w mobile to stara kopia reguł web bez treści RN; web przepisał reguły (`6da298e`) z sekcją
  „Async i React” pisaną pod React DOM.
- Projekty mobile mają realne lekcje: `gramywpadla` — 56 wpisów `docs/solutions/`, 32 ukończone zadania, własne
  `learned-patterns.md`; `Nawykometr` — 7 wpisów.

Ścieżki audytu (każda kończy się wierszami w tabeli decyzji: zostaw / aktualizuj / zastąp / usuń / nowy):

- **A0.1 Delty mobilne w plikach pipeline'u (mechaniczne).** Diff każdego wspólnego pliku mobile względem weba w punkcie
  wyrównania `456cd9b`. Wynik: lista dokładnie tych zmian, które mobile wprowadził przy porcie (Maestro, expo-doctor, env-up,
  bramka natywna…). To jest wsad do slotów z Etapu 1–2; reszta treści pipeline'u przychodzi z rdzenia.
  Skille, które web świadomie usunął (`dev-docs*`, `bugfix`, `code-review`, `code-quality`, `dev-ideate`, `gemini`,
  `freshness-audit`, agenci `kieran-*`, `code-simplicity-*`) — potwierdzić usunięcie, wyłowić tylko mobilne treści.
- **A0.2 Skille Expo: plugin oficjalny czy kopia.** Próba: instalacja `expo@expo-plugins`, sprawdzenie wyzwalania przy
  polskich poleceniach (tracimy nasze polskie opisy), zachowania feedbacku/telemetrii upstreamu (wcześniej wycinaliśmy
  „Submitting Feedback”), nazw `expo:<skill>` w polu `skills:` agentów. Rekomendacja wstępna: **plugin**, tak jak `figma`
  na webie — znika sync kopii i ryzyko starzenia. Decyzja o zakresie: które z nowych (`eas-update`, `eas-observe`,
  `eas-simulator`) wchodzą do builderów/testera.
- **A0.3 Własne skille techniczne mobile — świeżość w żywych źródłach** (metoda z web audytu 2026-07 i `freshness-audit`:
  twierdzenia → weryfikacja w docs/changelogach/npm, zakaz pamięci modelu, sceptyk P1/P2): `mobile-e2e-maestro`,
  `e2e-setup`, `ux-ui-guidelines-mobile`, oraz warianty mobile `security`, `sentry-integration`
  (`@sentry/react-native`), `supabase-dev-guidelines` (secure-store, deep link OAuth). Przy wspólnych skillach dodatkowo
  diff z **aktualną** wersją web — wziąć poprawki weba, a różnice mobile wydzielić do `references/stack.md`.
- **A0.4 Brakujący skill: wytyczne RN/NativeWind** (odpowiednik `tailwind-react-guidelines`). Research: aktualna wersja
  NativeWind i jej status po wycofaniu skilla upstream, alternatywy (np. podejście upstream `expo-design-system`),
  Reanimated, listy (FlashList/FlatList), `expo-image`, safe areas, klawiatura. Decyzja: zostajemy przy NativeWind
  czy zmieniamy domyślny stack stylowania szablonu.
- **A0.5 Reguły kodu mobile.** Podział sekcji web `coding-rules.md` na rdzeń (testy, błędy, nazewnictwo, bezpieczeństwo,
  type safety…) i stack (React DOM). Nowe `rules/stack.md` dla RN: brak DOM i `localStorage`, `Platform`, secure storage,
  `EXPO_PUBLIC_*`, listy i re-rendery, Hermes, uprawnienia natywne, praca offline. Antywzorce z hooka
  `mobile-anti-pattern-check.sh` jako reguły (hook zostaje jako strażnik).
- **A0.6 Lekcje z projektów mobile.** Przegląd `docs/solutions/` i `learned-patterns.md` w `gramywpadla` i `Nawykometr`:
  co jest regułą (→ A0.5), co wiedzą dla skilla (→ A0.3/A0.4), co problemem pipeline'u (→ slot/tester/env-up).
- **A0.7 Agenci mobile.** Buildery i tester mobile względem **nowego** kontraktu builderów/testera web (format zwrotu,
  test padający bez poprawki, dossier, księgowanie E2E) — lista różnic do Etapu 2.

Prowadzenie: kolejność A0.1 → A0.2 → (A0.3, A0.4, A0.6 równolegle) → A0.5 → A0.7. Research w żywych źródłach przez
agentów badawczych, każde twierdzenie z linkiem; mechaniczne diffy skryptem. Wynik:
`docs/reviews/2026-11-audyt-mobile/` z raportem per ścieżka i jedną tabelą decyzji, potem decyzje operatora i aktualizacja
Etapów 1–5 tego planu. Szacunek: 3–4 sesje.

**Status: zakończony 2026-11-02.** Raporty A0.1–A0.7 i zbiorcze decyzje: `docs/reviews/2026-11-audyt-mobile/`
(`00-decyzje.md`). Wniosek: z mobile przechodzi wiedza (34 adaptacje pipeline'u, ~60 reguł RN, 112 lekcji projektów),
forma (agenci, skille wspólne, workflowy) przychodzi z rdzenia. Decyzje D6–D10 zaakceptowane przez operatora,
D11–D25 przyjęte wg rekomendacji (sekcja „Decyzje”).

### Poprawki poprzedzające (osobna gałąź `popr/*`, przed Etapem 1)

- Supabase CLI 3.0.0 (2026-11-02): nieinteraktywny `db push` wymaga `--yes`, `--db-url` przestarzałe — db-sync
  w `dev-autopilot-wf.js:597`, `templates/e2e-env`, doctor (przypięcie v2 albo przejście na składnię v3, potwierdzone na v3).
- Błędy w skillach web z A0.3 §4.4 i A0.5 §3: limit Realtime 100 kanałów, `@sentry/deno` 11 z integracją `Deno.serve`,
  przykład `supabase-dev-guidelines/auth-patterns.md` vs zależność efektu na `user?.id`.

### Spike Expo SDK 58 (jedna sesja, przed Etapem 2, poza repo szablonu)

Świeży projekt Expo SDK 58: Uniwind (D7: `TextInput` + `className`, line-height, `translate` w %, `boxShadow` na Androidzie,
`rem` vs „1 pt Figma = 1 px”); jest-expo + RNTL 14 na Expo Router (D8); `tsconfig` rdzenia (`verbatimModuleSyntax`,
`erasableSyntaxOnly`) z `expo/tsconfig.base`; `AbortSignal.timeout` w RN 0.88/Hermes; alternatywa dla swapu `.env.local`
(D13); reguła `deny` dla `@expo/agent-cli feedback` w trybie autopilota (D6); `expo:*` przez narzędzie `Skill` w builderze.
Wynik: notatka z PASS/FAIL per punkt → korekty `rules/stack.md` mobile i Etapu 2.

**Stan (2026-11-05):** spike zrobiony, wyniki i proponowane korekty w
[`docs/reviews/2026-11-audyt-mobile/spike-sdk-58.md`](../reviews/2026-11-audyt-mobile/spike-sdk-58.md). D7 i D8 potwierdzone;
korekty D6, D11 i D13 przyjęte przez operatora (sekcja „Decyzje”) i naniesione w IU-2.3 i IU-2.7. Pozostałe korekty z notatki
naniesione w IU-2.1, 2.3–2.8 i Etapie 5.

### Etap 1 — Szwy w rdzeniu (repo web, zachowanie web bez zmian)

Cel: wyciągnąć tekst stackowy z rdzenia do slotów. Projekty web po syncu dostają identyczne zachowanie.

- IU-1.1 `stacks/sloty.json` + katalog `.claude/stack/` (sloty web): `buildery.md` (tabela §3.5 z dev-plan),
  `e2e-srodowisko.md` (start/sonda/narzędzie jazdy), `walidacja.md` (warmup testów, opis builda, długie komendy),
  `fix-e2e.md` (diagnoza przez narzędzie jazdy), `plan-e2e.md` (sekcja E2E szablonu planu).
- IU-1.2 Workflowy: `dev-autopilot-wf.js` (l.28–47, 537–560, 686–715, 985–992), `dev-docs-execute-wf.js` (l.18–30, 237, 335),
  `dev-docs-review-wf.js` (l.257–264, 836–865), `dev-pr-wf.js` (l.22–29), `dev-docs-complete-wf.js` (l.196) — inline tekst → odesłanie do slotu.
  Enum `e2eTryb` z `przegladarka` → neutralne `interaktywny | bez-interakcji | pominiety` (z mapą zgodności dla starych stanów).
- IU-1.3 Skrypty: `scripts/e2e/srodowisko.mjs` rozdzielić na rdzeń (konfiguracja, kontrakt start/stop/zdrowie/dowód)
  i adapter `scripts/e2e/adapter.mjs` (slot web: Vite + agent-browser). `doctor.sh` — sekcja narzędzi stacku z pliku slotu.
  `plan/walidacja-planu.mjs` (`BUILDERZY`, `KOMENDY_CLI`) i `plan/makiety.mjs` czytają listy ze slotu.
- IU-1.4 Skille i reguły: dev-plan, dev-docs-complete, dev-prep, dev-compound, weryfikacja-setup — fragmenty stackowe do
  `references/` w slocie; `rules/coding-rules.md` → rdzeń + `rules/stack.md` (React DOM/Vite).
- IU-1.5 Strażnik słów stacku w CI (test z listą wyjątków) + test „każdy slot istnieje w wariancie web”.
- IU-1.6 Testy CI plików ról (`szkielet-buildera`, `warstwa-stala`, `klasy-rol`, `odczyt-zakresami`, `tester-e2e`)
  rozdzielić na asercje rdzenia i asercje stacku — dziś wymagają literalnie m.in. `vitest related --run` (D22, A0.7).
- IU-1.7 Slot danych `.claude/stack/profil.json` (D15) dla skryptów i hooków: klucze env (`VITE_*`/`EXPO_PUBLIC_*`), wzorzec
  seedów (`plan/pola-iu.mjs`, `plan/walidacja-planu.mjs`), globy źródeł (`error-handling-reminder.sh`), komenda testów.
- IU-1.8 Kontrakt adaptera E2E z politykami per stack: obcy proces na porcie (`stop` | `zastap`, D11), bloker środowiska
  w trakcie runu (`manual-restart` | `stop-rebuild`, D12); login canary kontem e2e w rdzeniu (D16).
- IU-1.9 Reguły: `coding-rules.md` → rdzeń (~93%) + `rules/stack.md` web (`React.lazy`, size-limit); 8 reguł dostaje
  neutralne brzmienie z odesłaniem do `stack.md` (m.in. `AbortSignal.timeout`, wykrywanie React Compilera, położenie
  testów vs Expo Router, przypinanie wersji vs `npx expo install`); 6 nowych reguł rdzenia i 3 rozszerzenia z lekcji
  projektów (A0.5 §1, §4).
- Odbiór: pełne testy maszynerii zielone, diff zachowania zerowy (porównanie wygenerowanych promptów przed/po dla vibersi),
  jeden przebieg autopilota na małym zadaniu w projekcie web.

**Stan Etapu 1 (2026-11-03, sesja „Szablon mobile z rdzenia — Etap 1”).** Zrobione IU-1.1–1.9, każda na gałęzi `popr/*`
zmergowanej `--no-ff` do main, CI zielone do IU-1.9 i poprawki canary (`746d862`) włącznie:

| IU | Gałąź / merge | Co powstało |
|---|---|---|
| 1.1 | `popr/sloty-stacku` / `c9da5c9` | `stacks/sloty.json`, sloty web `.claude/stack/{buildery,walidacja,e2e-srodowisko,fix-e2e,plan-e2e}.md`, test `stacks/__tests__/sloty.test.mjs`; globy `test` i `typecheck` obejmują `stacks/` |
| 1.2 | `popr/sloty-workflowy` / `33d09d3` | workflowy odsyłają do sekcji slotów (blok długich komend, rozgrzewka, walidacja końcowa, fix E2E, opisy dossier); tryb testera `interaktywny \| bez-interakcji \| pominiety`, `skrotPrzebiegu` mapuje dawne nazwy; test `workflows/__tests__/sloty-stacku.test.mjs` |
| 1.3 | `popr/adapter-e2e` / `f8a9b53` | `scripts/e2e/adapter.mjs` (slot plikowy: port, komenda startu, narzędzie jazdy, próbny zrzut, uwagi Vite) + `adres.mjs`; `srodowisko`, `start`, `gotowosc`, doctor (`doctor/narzedzie-jazdy.mjs`, `port-e2e`) przez adapter; kontrakt `e2e/__tests__/adapter.test.mjs` |
| 1.4 | `popr/sloty-skille` / `46faa0e` | `references/stack.md` w dev-plan, dev-docs-complete, dev-prep, dev-compound, weryfikacja-setup (D20); dev-plan odsyła do `buildery.md`/`plan-e2e.md`; `szkielet.mjs` bierze teksty z `SZKIELET_WERYFIKACJI` adaptera; test `workflows/__tests__/sloty-skilli.test.mjs` |
| 1.5 | `popr/straznik-stacku` / `7f7c2c3` | `stacks/straznik.mjs` + `stacks/straznik.json` (10 słów stacku web, 59 wyjątków: `usun` 6, `podmiana` 8, `przejsciowy` z IU 23, `staly` 22); wyjątek bez trafień zatrzymuje test; drugi strażnik: odesłania rdzenia (`.claude/stack/*`, `references/stack.md`, import adaptera) ⊆ rejestr slotów i każdy slot ma odesłanie; test `stacks/__tests__/straznik.test.mjs` |
| 1.6 | `popr/testy-rol` / `c616f21` | `szkielet-buildera` i `tester-e2e` w rdzeniu = kontrakt każdego stacku (samosprawdzenie plików jednostki zamiast `vitest related --run`, skille wspólne); asercje web (runner Vitest, skille web, preflight/zrzuty/`$Z`/`wait --text` agent-browser) dosłownie w `stacks/web/__tests__/role.test.mjs`; `warstwa-stala`, `klasy-rol`, `odczyt-zakresami` neutralne bez zmian; opis `E2E_RESULT.flow` w review odsyła do `plan-e2e.md`, sekcja „Linia scenariusza” (wyjątek strażnika usunięty) |
| 1.7 | `popr/profil-stacku` / `a4b1a3e` | slot danych `.claude/stack/profil.json` (D15; `env`: prefiks publiczny, adres i klucz Supabase klienta, pliki env bazy dev, plik e2e o najwyższym priorytecie, zmienne wbudowane; `e2e`: katalogi seedów i runnerów; `zrodla.frontend`; `testy.powiazane`; `komendyCli`) + odczyt `scripts/stack/profil.mjs`; z profilu: strażnik bazy dev i `KLUCZE_BAZY`, oba advisors, `ZAPIS_SEEDA`, wzorzec seeda i runnera oraz `KOMENDY_CLI` w walidacji planu, zmienne wbudowane smoke'u, glob frontendu hooka; prompty (scribe, db-sync, fix E2E, execute, schemat flow) i security-sentinel odsyłają do profilu; 8 wpisów strażnika usuniętych; kontrakt `stack/__tests__/profil.test.mjs`, testy rdzenia z literałami web przepięte na profil |
| 1.8 | `popr/polityki-adaptera` / `8ef651c` | kontrakt adaptera: `POLITYKA_OBCEGO` (D11; web `stop`, przy `zastap` `serwer.mjs` zatrzymuje obcy proces z PID-em i stawia swój serwer) i `SYGNATURY_BLOKERA` z polityką `manual-restart` \| `stop-rebuild` (D12; web `[]`, sygnatury rdzenia zostają w review); sygnatury płyną JSON-em `e2e.mjs restart` → autopilot (`sygnaturyZRestartu`) → `args.sygnaturyBlokera` review; `stop-rebuild` = scribe bez księgowania `[E2E]`, STOP przed zamknięciem review z naprawą adaptera (`decyzjaBlokeraSrodowiska`); login canary kontem e2e w `e2e.mjs start` z bazą e2e (D16, `scripts/e2e/konto.mjs`: password grant, brak konta → admin API, zły login = STOP startu) — dla webu nowy krok startu zamówiony w D16 |
| 1.9 | `popr/reguly-stacku` / `ff20ead` | slot `.claude/rules/stack.md` (web: testy obok źródeł, dokładne wersje, tryb aplikacji albo `SITE_URL`, `as` przy zawężaniu DOM, size-limit, `React.lazy` > 50 KB, `AbortSignal.timeout`, `babel-plugin-react-compiler`; `paths:` jak rdzeń); `coding-rules.md` odsyła do sekcji stack.md o tej samej nazwie (8 reguł) i ma 3 przeformułowania bez mechanizmu (interfejs zamiast DOM, logowanie serwer/klient, „trasa (strona albo ekran)”); 6 nowych reguł i 3 rozszerzenia z A0.5 §3 (zamówione); buildery i klasa naprawiacza czytają Read-em też stack.md; reviewerzy, hook stop, dev-pr i coderabbit-setup (`STACK_RULES`) odsyłają do stack.md; 6 wpisów strażnika usuniętych; kontrakt `workflows/__tests__/reguly-stacku.test.mjs`, treść web `stacks/web/__tests__/reguly.test.mjs`; testy rdzenia sprawdzone na próbnym stack.md Expo |

Zasady przyjęte w trakcie (obowiązują w kolejnych IU):
- Odesłanie w rdzeniu ma postać „`<plik slotu>`, sekcja „<nagłówek ##>””; testy sprawdzają, że nagłówek istnieje.
  Treść web przenosi się do slotu dosłownie, zasady wspólne zostają w rdzeniu.
- Sloty: tekstowe w `.claude/stack/` (wspólne dla workflowów i skilli) albo `references/stack.md` skilla; plikowe = moduł
  podmieniany w całości (`scripts/e2e/adapter.mjs`). Każdy slot jest w `stacks/sloty.json`.
- Zmiana istniejącego testu tylko przy zamówionej zmianie (przeniesienie treści, nazwy trybu) i z nazwaniem w commicie.
- Od IU-1.5 każde IU, które czyści słowa stacku, usuwa albo zawęża swoje wpisy `przejsciowy` w `stacks/straznik.json`
  (test zatrzymuje się na wyjątku bez trafień); nowy tekst stackowy w rdzeniu idzie do slotu, nie do listy wyjątków.

Przesunięcia zakresu względem listy IU wyżej:
- Podział `coding-rules.md` na rdzeń + `rules/stack.md` (wpisany w IU-1.4) robi IU-1.9 według A0.5 §1.
- Do IU-1.7 (`profil.json`): strażnik bazy dev i klucze `VITE_*` w `scripts/e2e/srodowisko.mjs` (komunikat „Vite w trybie
  e2e doczyta bazę dev”) i `e2e/advisors.mjs`, `KOMENDY_CLI` w `plan/walidacja-planu.mjs` (+ lista CLI w prompcie scribe'a
  `dev-docs-review-wf.js`, zgodność pilnuje `kontrakt-docs-active.test.mjs`), ścieżki `e2e/seeds/` w prompcie execute
  i `e2e/<etap>-run-all.sh` w schemacie review. `BUILDERZY`/`BUILDERZY_UI` bez zmian (D3).
- Wyjątki dla strażnika IU-1.5: klasyfikator linii „Weryfikacja:” w `dev-docs-review-wf.js` (listy `vitest`,
  `agent-browser` obok `symulator`/`emulator`), przykładowy plan `dev-plan/references/szablon-planu.md` (ścieżki `src/…`),
  etykieta agenta `warmup:vitest` (klucz telemetrii), komentarze z historią vibersi.
  Zrealizowane w `stacks/straznik.json` jako wyjątki `staly`, razem z rozpoznawaniem wielu stacków (vitest/jest w doctorze,
  sync-template, dev-plan; `dossier/profil.mjs`, bramki warunkowe, coderabbit-setup) i nazwami skilli w telemetrii.
- Wpisy strażnika bez IU w planie: agenci badawczy `best-practices-researcher`, `framework-docs-researcher`,
  `repo-research-analyst`, `web-research-specialist` (stos web wpisany w treść; przypisani do IU-2.9) oraz fixture
  `templates/smoke-autopilot` (D18; przypisany do IU-2.6).
- Asercje stacku plików ról: web w `stacks/web/__tests__/`, Expo w `stacks/expo/__tests__/` (Etap 2, IU-2.1/2.2);
  testy w `.claude/**/__tests__/` muszą przejść na każdym wariancie.
- Zostaje na Etap 2 (IU-2.6): wykrywanie tras routera w `szkielet.mjs`.
- Uwaga techniczna: glob `test` (`.claude/**/__tests__`) w głównym katalogu łapie też testy z `.claude/worktrees/*` — liczba
  testów na main jest wtedy wyższa niż w worktree; nic to nie psuje.
- Z IU-1.7: testy rdzenia sprawdzone na próbnym profilu Expo (podmieniony `profil.json`) — przechodzą poza dwiema grupami
  na Etap 2: szkielet builderów (komenda testów z profilu vs buildery web, IU-2.1) i przykład planu
  `dev-plan/references/szablon-planu.md` ze ścieżkami seedów i runnera web (4 testy `skill-dev-plan`; przykład do slotu
  albo wariantu razem z wyjątkiem `staly` przykładowego planu). `feature-tester-e2e.md` wciąż wymienia `e2e/<etap>-run-all.sh`
  (plik `podmiana`, IU-2.2).

- Z IU-1.8 dla IU-2.3 (adapter Expo): `POLITYKA_OBCEGO = 'zastap'`, `SYGNATURY_BLOKERA` z `brak-modulu-natywnego`
  i `brak-entitlements` (`stop-rebuild`, naprawa = komenda rebuildu z A0.1 #15); dowód Maestro (`_canary.yaml`) zostaje
  w adapterze, login REST kontem e2e robi już rdzeń. Krok 4 db-sync (konto testowe) został w prompcie bez zmian.

- Z IU-1.9 dla Etapu 2 (`rules/stack.md` Expo z A0.5 §2): te same nazwy sekcji, do których odsyła rdzeń (Organizacja
  kodu, Zależności, Bezpieczeństwo, Type safety, Performance, Async i React) — sprawdza je `reguly-stacku.test.mjs`.
  „6 nowych reguł i 3 rozszerzenia” są w A0.5 §3 (tabela reguł R z A0.6), nie w §1/§4. `performance-oracle` stracił
  web-owe „`React.lazy()` z `Suspense`” na rzecz odesłania do sekcji „Performance” (stack.md web ma `React.lazy`).

- Z odbioru: login canary przy captcha Auth daje `pominieto` zamiast STOP-u (`popr/canary-captcha` / `746d862`, regresja IU-1.8). Dla IU-2.3:
  adapter Expo dziedziczy to zachowanie z rdzenia.

Odbiór Etapu 1 (2026-11-04): testy, diff instrukcji i przebieg autopilota w vibersi przeszły, wyniki i sprawy otwarte w
`docs/reviews/2026-11-odbior-etapu-1.md`. Etap 1 przyjęty przez operatora 2026-11-04.

### Etap 2 — Nakładka Expo (w `stacks/expo/`)

- IU-2.0 `stacks/zbuduj.mjs <stack> <katalog>` (przeniesione z Etapu 3, dawne IU-3.1): kopia `.claude/` → usunięcia z
  `usun.txt` → podmiany i dodatki z nakładki → deep-merge `settings.patch.json` → plik `.claude/.rdzen-version` (SHA rdzenia).
  Bash-free, testowany, bez CI, sekretów i publikacji. Od tego IU testy rdzenia biegną na zbudowanym wariancie, a liczba
  padnięć spada do zera na odbiorze. Test „każdy slot ma w nakładce podmianę albo wpis w `usun.txt`” ma listę zaległych slotów,
  z której każde IU usuwa swoje (pusta na odbiorze).
- IU-2.1 Buildery `feature-builder-ui|data|fullstack` (+ `-figma`, D23) w wersji RN — **napisane od nowa na szkielecie
  web** (schemat zwrotu, `tools:`, `completed` + `odchylenia`, granice IU, dossier; A0.7 §5). Zasady RN idą do
  `rules/stack.md`, `rn-expo-guidelines` i skilli, nie do agentów. `tools:` z narzędziem `Skill` (ładowanie `expo:*` na
  żądanie; w próbach spike'u `Skill` w `tools:` wystarczył, zdanie o `expo:*` w treści buildera opcjonalne); preload:
  `rn-expo-guidelines`, `ux-ui-guidelines-mobile`, skill silnika stylowania (D6, D7).
- IU-2.2 Tester `feature-tester-e2e` w wersji Maestro — schemat wyniku web bez zmian: pole `przyczyna`, SKIP środowiskowy
  bez findingu OPERATOR, `flow` z linii także przy braku pliku (→ `scenariusz-niewykonalny`, D17), nie bootuje urządzeń
  i nie pisze do `.maestro/`; `--test-output-dir` w folderze zadania (Maestro ≥ 2.8), dowody z `takeScreenshot`.
- IU-2.3 Adapter E2E `scripts/e2e/adapter.mjs` dla Expo: logika z promptu env-up mobile (`dev-autopilot-wf.js` mobile
  l.463–701) **przeniesiona do skryptu** — `EXPO_PUBLIC_*` e2e w `.env.development.local` zapisywanym i usuwanym przez
  adapter (D13: `.env.local` nietknięty, reload po zapisie, Metro bez `CI=1`, pozostawiony plik wykrywa doctor albo start;
  istniejącego pliku nie nadpisuje bez kopii), reload przez `ws://localhost:8081/message`, Metro z PID na :8081 i `CI` usuniętym
  z env procesu, `LANG=en_US.UTF-8` dla `pod install` (bez tego CocoaPods pada na `Unicode Normalization not appropriate for
  ASCII-8BIT`), emulator iOS-first z fallbackiem Android, urządzenie bez zalogowanego konta Apple (monit „Weryfikacja konta
  Apple” zasłania aplikację i nie zamyka się wstrzykniętym dotknięciem; wykrywa doctor albo adapter), obsługa monitu
  „Otworzyć w…” przy pierwszym deep linku, świeżość dev-clienta, canary `.maestro/_canary.yaml`, seedy `.maestro/*-seed.sql`.
  Podmiana `templates/e2e-env` na wersję Expo (Metro, canary), z sekcją „Aplikacja z osobnym serwerem API”: rdzeń odsyła do
  tego README (`srodowisko`, `start`, `szkielet`, `advisors`, dev-plan, dev-prep), więc nie może zniknąć. Sloty Expo tego IU:
  `.claude/stack/e2e-srodowisko.md` i `.claude/stack/profil.json` (klucze `EXPO_PUBLIC_*`, katalogi `.maestro`, komenda testów).
  Deterministyczny skrypt zamiast promptu = mniej losowości niż w starym mobile.
- IU-2.4 Bramka natywna po fazie (prebuild / pod install przy zmianie warstwy natywnej, mobile l.1184–1242) jako slot
  `stack/po-fazie.md` + skrypt; rdzeń woła slot, web ma pusty. `LANG=en_US.UTF-8` dla `pod install` jak w IU-2.3. Gradle sam
  dociąga platformę Android 37 przy pierwszym buildzie.
- IU-2.5 Sloty tekstowe: `buildery.md` (routing po `src/app/` albo `app/`, `src/components/`, `src/hooks/`, `lib/`, `supabase/`;
  układ szablonu SDK 58 to `src/`), `walidacja.md` (jest-expo + RNTL 14 + Jest 30 — D8, konfiguracja Jest z tabeli w
  `spike-sdk-58.md` pkt 2, rozgrzewka z `expo customize tsconfig.json` przed typecheckiem na czystym checkoucie, commit
  `uniwind-types.d.ts`, „nie eas build”), `plan-e2e.md` (Maestro, emulator, plik flow jako deliverable buildera — D17),
  `fix-e2e.md`, `dev-plan/references/stack.md` oraz przykład `dev-plan/references/szablon-planu.md` ze ścieżkami seedów i runnera
  (4 testy `skill-dev-plan` z IU-1.7). `expo-doctor` jako bramka w `scripts/bramki/` (D14; 20/20 na zestawie ze spike'u).
- IU-2.6 `weryfikacja-setup` wariant Maestro (Launch = dev-client + Metro, Drive = flow Maestro, Evidence = screenshoty)
  — wchłania `e2e-setup` (D24; zostaje wiedza o dev-clientcie, pułapki 6–8, 10, 11, para `EXPO_PUBLIC_E2E_TEST_USER_*`,
  monit konta Apple i „Otworzyć w…” jak w IU-2.3). Wykrywanie tras routera w `szkielet.mjs`. Fixture `templates/smoke-autopilot`
  w wersji RN (D18): jeden ekran i flow Maestro, zamiast łatki na fixture web (A0.1).
- IU-2.7 Skille (D6, D7): plugin `expo@claude-plugins-official` w `settings.patch.json` (MCP Expo wyłączony — D19, `deny`
  dla `@expo/agent-cli` i `Bash(*submit-expo-feedback*)`, bramka „plugin zainstalowany” w doctorze; hub ostrzega, że przypięty
  plugin może być starszy od SDK); lokalnie: hub stosu (przemianowany z
  `expo-overview`), skill Uniwind (przypięta kopia oficjalnego skilla autorów z audytem świeżości), nowy
  `rn-expo-guidelines` (A0.4 §7), `mobile-e2e-maestro` i `ux-ui-guidelines-mobile` po poprawkach P1/P2 z A0.3.
  `AGENTS.md` i `.claude/settings.json` przychodzą z szablonu `default@sdk-58`: nakładka ustala, co z nimi przy syncu.
  Usunąć (`usun.txt`): agent-browser, tailwind-react-guidelines, ux-ui-guidelines, coolify-manager, makieta +
  `scripts/makieta` (D2); nie przenosić `expo-tailwind-setup` (wadliwy pin NativeWind v5 preview).
  Zmiany w rdzeniu konieczne przy tych usunięciach (web bez zmian zachowania): zdania o `/makieta` i kontrola
  `makieta.mjs sprawdz` z `dev-docs-complete` (workflow i skill) do `dev-docs-complete/references/stack.md`, a asercje z
  `start-koniec.test.mjs` do `stacks/web/__tests__/`; wariant Expo: przegląd pary `-figma.png`/`-actual.png` ręcznie w smoke'u;
  odesłania do usuwanych skilli (`zapobieganie.mjs`, `doctor.sh`, `kontekst-designerski.md`, `skille-tresc.test.mjs`) do
  slotu albo testów web. Nowy test: rdzeń po usunięciach nie odsyła do plików z `usun.txt`.
- IU-2.8 Reguły/hooki/settings: `rules/stack.md` mobile z projektu w A0.5 §2 (~60 reguł, 10 grup) i korekt po spike'u;
  `mobile-anti-pattern-check.sh` naprawiony i rozszerzony (D25) w `settings.patch.json`; `learned-patterns.md` **nie**
  przechodzi do szablonu (D21 — indeks projektu); bramki: `eslint-plugin-jest` zamiast `@vitest/eslint-plugin`, runner
  jest dla Strykera, reguła lokalna rozpoznaje `jest.mocked`, bez size-limit.

  Sekcje, do których odsyła rdzeń (obok grup tematycznych A0.5 §2; sprawdza je `reguly-stacku.test.mjs`):

  | Sekcja | Treść | Podstawa |
  |---|---|---|
  | Organizacja kodu | testy poza katalogiem tras (`src/app` albo `app`), w `__tests__/` | spike pkt 2, docs |
  | Zależności | `npx expo install` dla paczek SDK; preferencja z „Zależności natywne” | A0.5, `AGENTS.md` szablonu |
  | Bezpieczeństwo | rozpoznanie konfiguracji lokalnej/e2e | niesprawdzone, ustalić w tym IU |
  | Type safety | wyjątki od `as`: bez zawężania DOM; lista do ustalenia | niesprawdzone, ustalić w tym IU |
  | Performance | bez size-limit; budżet paczki i ładowanie leniwe do ustalenia | A0.5; niesprawdzone, ustalić w tym IU |
  | Async i React | `AbortSignal.timeout`, timeout rozpoznawany po `signal.reason`, nie po `error.name`; Compiler: `experiments.reactCompiler: true`; `await` także przy `render` i `fireEvent` RNTL 14 | spike pkt 2, 4; log Metro |

  Korekty projektu A0.5 §2: wypada blok „Tylko NativeWind v5” i reguła o helperze zamiast `AbortSignal.timeout` (dotyczy RN 0.88;
  starsze wersje niesprawdzone). Dochodzą: prefiks `accent-*` dla kolorów `TextInput`, unikanie `lineHeight` w `TextInput` na iOS,
  priorytet env proces/plik (dev: plik wygrywa, Release i `expo export`: proces wygrywa). `paths:` `global.css` → `**/global.css`;
  „Testów nie kładziesz w `app/`” obejmuje też `src/app`.
- IU-2.9 Wspólne skille `security`, `sentry-integration`, `supabase-dev-guidelines`, `dev-prep` — rdzeń = aktualna
  wersja web, różnice mobile (10–14 akapitów na skill wg A0.3) w `references/stack.md` (D20), z poprawkami P1 z A0.3.
  Storage sesji: domyślny wariant Supabase, `LargeSecureStore` jako opcja (D9). Płatności: IAP/RevenueCat zamiast
  Stripe Checkout dla treści cyfrowych (D10). Sloty Expo `dev-docs-complete/references/stack.md` (A0.1 #32, ręczny przegląd
  makiet z IU-2.7) i `dev-compound/references/stack.md`. Agenci badawczy `best-practices-researcher`, `framework-docs-researcher`,
  `repo-research-analyst`, `web-research-specialist`: stos web i przykłady do slotu, dosłownie dla webu, a ich wpisy strażnika
  znikają.
- Odbiór: `zbuduj.mjs expo` daje `.claude/`, na którym przechodzą testy rdzenia + testy nakładki.

**Stan Etapu 2.** Kolejność wg zależności: 2.0 → 2.7 → 2.8 → 2.3 → 2.4 → 2.5 → 2.2 → 2.1 → 2.6 → 2.9.

| IU | Gałąź / merge | Co powstało |
|---|---|---|
| 2.0 | `popr/zbuduj-wariant` | `stacks/zbuduj.mjs` (walidacja przed zapisem, `usun.txt`, nakładka, deep-merge z `null` = usuń i tablicami bez powtórzeń, `.rdzen-version` z `-dirty`, cel z `.claude/` tylko z `--zastap`); `stacks/testuj-wariant.mjs` (ławka: wariant + `package.json`, `tsconfig`, rejestr, strażnik, `node_modules` pakietów; testy `.claude/**` i typecheck); puste `stacks/expo/usun.txt` i `settings.patch.json`; testy `stacks/__tests__/zbuduj.test.mjs`, `stacks/expo/__tests__/nakladka.test.mjs` z listą `ZALEGLE` (27 pozycji); `tsconfig` bez `stacks/*/nakladka`. Na wariancie bez nakładki: testy 1402/1402, typecheck 0 |

Zasady przyjęte w trakcie (obowiązują w kolejnych IU):
- Testy nakładki leżą w `stacks/<stack>/__tests__/` (build odrzuca `__tests__` w `nakladka/`) i moduły nakładki importują z ławki
  (`przygotujLawke`), bo w `nakladka/` względne importy do rdzenia się nie rozwiązują. Z tego samego powodu `nakladka/` jest poza
  głównym `tsconfig`; typy sprawdza `testuj-wariant.mjs`.
- Po każdym IU: `node stacks/testuj-wariant.mjs expo`, liczba padnięć w wierszu tabeli; na odbiorze zero i pusta lista `ZALEGLE`.

### Etap 3 — Budowanie i publikacja

- IU-3.1 przeniesione do Etapu 2 jako IU-2.0 (`stacks/zbuduj.mjs`).
- IU-3.2 `maszyneria.yml`: job `wariant-expo` — build + testy na wyniku + strażnik slotów.
- IU-3.3 `publikuj-mobile.yml` (D4): push na `main` ze zmianą w `.claude/`, `stacks/` albo `output-styles/`, po zielonym jobie
  `wariant-expo` → build → commit `sync: rdzeń <sha>` do `workspace-template-mobile` (tylko
  `.claude/` i `output-styles/`; README/docs repo mobile nietknięte). Sekret: deploy key z prawem zapisu do repo mobile.
  Automat włączony dopiero po udanym pilocie (Etap 4). Do tego czasu i jako fallback publikacja ręczna, za zgodą operatora:
  `node stacks/zbuduj.mjs expo ../workspace-template-mobile --zastap && git -C … commit`.
- IU-3.4 `sync-template` w wariancie Expo ma domyślny URL repo mobile (podmiana slotu albo zmienna w `settings.patch.json`).
- IU-3.5 README mobile: sekcja „skąd pochodzi `.claude/`” + „nie edytuj `.claude/` w tym repo — zmiany idą do
  `claude-code-starter/stacks/expo`”. Strażnik: CI w repo mobile odrzuca commit zmieniający `.claude/` spoza bota publikacji.

### Etap 4 — Pilot na projekcie mobile

- Przed syncem każdego projektu: konwersja jego `.claude/rules/learned-patterns.md` (gramywpadla 49 reguł, Nawykometr 7)
  do `docs/solutions/` / reguł projektu i commit — inaczej sync usunie edytowany plik (D21). Sprawdzić, czy projekt stoi
  na wadliwym NativeWind v5 preview + nightly `react-native-css`.
- `Nawykometr` (dziś na mobile `6fbd49d`): `/sync-template --dry-run`, potem sync; doctor; jedno małe zadanie przez
  `/dev-plan` → autopilot → smoke → `/dev-pr`. Sprawdzić: env-up na emulatorze, tester Maestro, księgowanie [E2E], bramka natywna.
- Wnioski → poprawki w `stacks/expo/` (publikacja ręczna do końca pilotu, D4). Potem `gramywpadla` (dziś `23e0d92`, starszy —
  najpierw dry-run). Po udanym pilocie: włączenie automatu z IU-3.3.

### Etap 5 — Świeżość skilli technicznych Expo

- Skille `expo:*` z pluginu (D6) — świeżość zapewnia upstream, ale z granicą: marketplace przypina SHA, więc plugin może być
  starszy od bieżącego SDK (1.13.9 z 2026-10-05 nie wspomina SDK 58, spike pkt 7). W `ZRODLA-SZABLONU.md` wpis o pluginie i
  decyzji o przypięciu wersji (źródło `git-subdir` z `sha` we własnym marketplace vs wersja z `claude-plugins-official` — do
  rozstrzygnięcia w Etapie 3).
- Skill Uniwind: przypięta kopia oficjalnego skilla autorów, odświeżana procedurą jak agent-browser.
- Własne skille mobile (`rn-expo-guidelines`, `mobile-e2e-maestro`, `ux-ui-guidelines-mobile`, `references/stack.md`
  skilli wspólnych) wchodzą do cyklicznego audytu świeżości razem z webowymi.

## Decyzje

Przyjęte (operator, 2026-11-01/02):
- **D1** Jedno repo: nakładka Expo w `claude-code-starter/stacks/expo/`, wynik publikowany do `workspace-template-mobile`.
- **D3** Wspólne nazwy ról agentów (`feature-builder-ui` itd.) w obu wariantach zamiast `feature-builder-mobile-*`.
- **D5** Kolejność: Etap 0 (audyt, zakończony) → poprawki poprzedzające i spike → Etap 1 → reszta.
- **D6–D10** (zaakceptowane 2026-11-02): skille Expo z oficjalnego pluginu + lokalny hub i skill stylowania; stylowanie
  Tailwind v4 przez `className` na Uniwind (po spike'u SDK 58, NativeWind v5 jako zapas); testy jest-expo + RNTL 14 +
  Jest 30; storage sesji domyślny Supabase + `LargeSecureStore` jako opcja; IAP/RevenueCat zamiast Stripe Checkout dla
  treści cyfrowych.
- **D11–D25** — przyjęte wg rekomendacji z `docs/reviews/2026-11-audyt-mobile/00-decyzje.md` (polityki adaptera E2E,
  swap `.env.local` po sprawdzeniu alternatywy, `expo-doctor` jako bramka, `profil.json`, login canary w rdzeniu,
  `[E2E]` z plikiem flow, fixture smoke RN, MCP Expo wyłączony, `references/stack.md`, `learned-patterns` poza szablonem,
  podział testów CI ról, warianty `-figma`, `e2e-setup` → `weryfikacja-setup`, naprawa hooka).
- **Korekty po spike'u SDK 58** (operator, 2026-11-05; `00-decyzje.md`, `spike-sdk-58.md`): D6 — plugin
  `expo@claude-plugins-official`, `deny` także dla `submit-expo-feedback`; D11 — `zastap` zostaje, bo obcy Metro może serwować
  paczkę innego projektu; D13 — `.env.development.local` zamiast swapu `.env.local`.
- **D2** (operator, 2026-11-05) `makieta` w mobile usunięta na start, bo proxy z iframe nie obsłuży aplikacji natywnej; punkty
  wizualne zostają jako ręczny przegląd pary plików w smoke'u. Rdzeń woła narzędzie wprost, więc IU-2.7 przenosi te odesłania do
  slotu. Ewentualny wariant „zrzut z emulatora obok makiety” jako osobne zadanie po pilocie.
- **D4** (operator, 2026-11-05) Publikacja automatyczna przy pushu na `main`, po zielonym jobie `wariant-expo`, z filtrem ścieżek,
  włączona dopiero po udanym pilocie. Do tego czasu publikacja ręczna za zgodą operatora.
- **Kolejność** (operator, 2026-11-05): `zbuduj.mjs` powstaje przed nakładką jako IU-2.0 (dawne IU-3.1), bo wymaga go odbiór
  Etapu 2.

## Ryzyka

- **Etap 1 dotyka workflowów działających w produkcji (vibersi i inne).** Mitigacja: porównanie promptów przed/po,
  przebieg autopilota na małym zadaniu, gałąź `popr/*` jak przy P22–P27.
- **Logika env-up mobile była dotąd promptem** — przeniesienie do skryptu to nowa implementacja, nie kopia. Pilot (Etap 4)
  jest obowiązkowy przed ogłoszeniem wersji.
- **Pierwszy sync projektów mobile usunie dużo plików** (stare skille `dev-docs*` itd.). Backup jest automatyczny, ale
  operator powinien zrobić `--dry-run` i commit przed syncem.
- **Testy rdzenia mogą zakładać webowe sloty** (np. fixtures z Vite). Strażnik z IU-1.5 wyłapie je w Etapie 1.

## Szacunek

Etap 0: zrobiony. Poprawki poprzedzające: pół sesji. Spike: 1 sesja. Etap 1: 3–4 sesje (największe ryzyko). Etap 2: 3–4 sesje. Etap 3: 1 sesja. Etap 4: 1–2 sesje z emulatorem. Etap 5: pół sesji.
Wykonanie ręczne sesjami na gałęziach `popr/*` (jak P22–P27), commit per IU — nie autopilotem, bo zmieniamy sam autopilot.
