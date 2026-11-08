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
  i nie pisze do `.maestro/`; zrzuty z `takeScreenshot` w folderze zadania, a `--test-output-dir` poza repo, bo Maestro zapisuje tam wartości `-e`.
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
  `stack/po-fazie.md` + skrypt; rdzeń woła skrypt przez `e2e.mjs start` i `restart`, a slot niesie opis (web: nic do zrobienia). `LANG=en_US.UTF-8` dla `pod install` jak w IU-2.3. Gradle sam
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
- IU-2.7 Skille (D6, D7): plugin `expo@claude-plugins-official` w `settings.patch.json` (MCP Expo bez narzędzi do logowania
  operatora — D19, `deny` dla `@expo/agent-cli` i `Bash(*submit-expo-feedback*)`, bramka „plugin zainstalowany” w doctorze; hub
  ostrzega, że przypięty plugin może być starszy od SDK); lokalnie: hub stosu `expo-stos-szablonu` (przemianowany z
  `expo-overview`), skill Uniwind (przypięta kopia oficjalnego skilla autorów z audytem świeżości), nowy
  `rn-expo-guidelines` (A0.4 §7), `mobile-e2e-maestro` i `ux-ui-guidelines-mobile` po poprawkach P1/P2 z A0.3.
  `AGENTS.md` i `.claude/settings.json` przychodzą z szablonu `default@sdk-58`: `AGENTS.md` należy do projektu (sync obejmuje tylko
  `.claude/`), a `settings.json` nadpisuje sync wersją wariantu, która ma ten sam plugin.
  Usunąć (`usun.txt`): agent-browser, tailwind-react-guidelines, ux-ui-guidelines, coolify-manager, makieta +
  `scripts/makieta` (D2); nie przenosić `expo-tailwind-setup` (wadliwy pin NativeWind v5 preview).
  Zmiany w rdzeniu konieczne przy tych usunięciach (web bez zmian zachowania): zdania o `/makieta` i kontrola
  `makieta.mjs sprawdz` z `dev-docs-complete` (workflow i skill) do `dev-docs-complete/references/stack.md`, a asercje z
  `start-koniec.test.mjs` do `stacks/web/__tests__/`; slot Expo tego skilla (A0.1 #32): przegląd pary `-figma.png`/`-actual.png`
  ręcznie w smoke'u; odesłania do usuwanych skilli (`zapobieganie.mjs`, `doctor.sh`, `kontekst-designerski.md`, `skille-tresc.test.mjs`) do
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
  Stripe Checkout dla treści cyfrowych (D10). Slot Expo `dev-compound/references/stack.md`. Agenci badawczy `best-practices-researcher`, `framework-docs-researcher`,
  `repo-research-analyst`, `web-research-specialist`: stos web i przykłady do slotu, dosłownie dla webu, a ich wpisy strażnika
  znikają.
- Odbiór: `zbuduj.mjs expo` daje `.claude/`, na którym przechodzą testy rdzenia + testy nakładki.

**Stan Etapu 2.** Kolejność wg zależności: 2.0 → 2.7 → 2.8 → 2.3 → 2.4 → 2.5 → 2.2 → 2.1 → 2.6 → 2.9.

| IU | Gałąź / merge | Co powstało |
|---|---|---|
| 2.0 | `popr/zbuduj-wariant` / `fddd086` | `stacks/zbuduj.mjs` (walidacja przed zapisem, `usun.txt`, nakładka, deep-merge z `null` = usuń i tablicami bez powtórzeń, `.rdzen-version` z `-dirty`, cel z `.claude/` tylko z `--zastap`); `stacks/testuj-wariant.mjs` (ławka: wariant + `package.json`, `tsconfig`, rejestr, strażnik, `node_modules` pakietów; testy `.claude/**` i typecheck); puste `stacks/expo/usun.txt` i `settings.patch.json`; testy `stacks/__tests__/zbuduj.test.mjs`, `stacks/expo/__tests__/nakladka.test.mjs` z listą `ZALEGLE` (27 pozycji); `tsconfig` bez `stacks/*/nakladka`. Na wariancie bez nakładki: testy 1402/1402, typecheck 0 |
| 2.7 | `popr/expo-skille` / `9e01e65` | `usun.txt` (agent-browser, tailwind-react-guidelines, ux-ui-guidelines, coolify-manager, makieta + `scripts/makieta`); `settings.patch.json` (plugin `expo@claude-plugins-official`, 4 reguły `deny`); kolejność kluczy w `zbuduj.mjs` (`permissions` na początku, klucze pluginów na końcu: próba `plugin install` nie brudzi pliku); nowe skille w nakładce: hub `expo-stos-szablonu`, `rn-expo-guidelines` (10 referencji), przypięty `uniwind` (`66bac01`, `ZRODLO.md`), poprawiony `mobile-e2e-maestro` (M1–M7, kontrakt testera, lekcje A0.6), poprawiony `ux-ui-guidelines-mobile` (U1–U12, Uniwind); slot Expo `dev-docs-complete/references/stack.md`. Zmiany w rdzeniu: zdania o `/makieta` i kontrola do slotu web, sekcja „Punkty wizualne” (asercje do `stacks/web/__tests__/makieta.test.mjs`), `skille-tresc.test.mjs` do `stacks/web/__tests__/`, neutralne zdania w `kontekst-designerski.md` i `sync-template/SKILL.md`, warunkowy skrypt coolify w `doctor.sh`. Na wariancie: 1254/1257, 3 padnięcia na IU-2.1 (martwe `skills:` builderów web) |
| 2.8 | `popr/expo-reguly` / `984276d` | `rules/stack.md` Expo (sekcje rdzenia + grupy A0.5 §2, korekty po spike'u, D9); hook `mobile-anti-pattern-check.sh` (D25: filtr komentarzy, odesłanie do stack.md, wyjątki `.web.*`, `+html`, `supabase/functions`, nowe wzorce `SafeAreaView`, `process.env[`, `Permission: false`; dodane `stop_hook_active` i wyjątek dla polyfillu `expo-sqlite/localStorage`); bramki w nakładce: `eslint-plugin-jest`, `jest.mocked`, Stryker na jest z `ignorePatterns` katalogów natywnych, bez size-limit i `__tests__` web; testy na prawdziwych narzędziach (`stacks/expo/__tests__/bramki.test.mjs`, pakiet workspace `pakiet-bramek`), w tym porównanie configu ESLint z web. Stryker sprawdzony też na jest-expo w spike'u: 4/4 mutanty zabite. Na wariancie: 1247/1251, 3 padnięcia na IU-2.1, 1 na IU-2.6 (`wstaw-pakiet` z `.size-limit.json` fixture'u) |
| 2.3 | `popr/expo-adapter-e2e` / `10ab4f8` | Nakładka: `scripts/e2e/adapter.mjs` + `expo-env.mjs` (D13), `expo-urzadzenie.mjs` (iOS najpierw, odrzuca symulator z kontem Apple po bazie `Accounts*.sqlite`, świeżość i podpis dev-clienta, Android jako zapas), `expo-canary.mjs` (reload, Maestro, maskowanie hasła); `stack/profil.json`, `stack/e2e-srodowisko.md`, `templates/e2e-env/` (README, wzór `.env.e2e`, `_canary.yaml`). Zmiany w rdzeniu (web bez zmian zachowania): kontrakt adaptera `przedStartem`, `poStarcie`, `poZatrzymaniu`, `uwagaDoctora`, `SCIEZKA_ZDROWIA`, `SZKIELET_WERYFIKACJI.obcySerwer`, wywołania w `start.mjs` i `e2e.mjs stop`, wiersz doctora `uwaga-stacku.mjs`. Asercje web z testów rdzenia przeniesione do `stacks/web/__tests__/e2e-adapter.test.mjs`. Próby na `spike-expo-58`: iPhone 17 i Pixel_8. Na wariancie: 1238/1253, 2 pominięte, 13 padnięć: 8 na IU-2.1, 4 na IU-2.5, 1 na IU-2.6 |
| 2.4 | `popr/expo-bramka-natywna` / `99f7437` | Nakładka: `expo-natywne.mjs` (detektor mtime + diff od pierwszego commita nowszego niż binarka; natywność pakietu z dysku; lockfile npm, pnpm, yarn, bun; fail-closed), slot `stack/po-fazie.md` (web: nic do zrobienia, Expo: reguły i przebudowa), naprawa `prebuild --clean` + `run:*` z `LANG` i ostrzeżeniem, że `--clean` usuwa `ios/` i `android/` (`OSTRZEZENIE_CLEAN`: STOP ze startu, z restartu i z sygnatur blokera). Zmiany w rdzeniu: slot w `sloty.json`, `restartFazy` zwraca `krokStacku` i `przebudowa`, autopilot `decyzjaPrzebudowy` = STOP przed testerem, porażka kroku stacku idzie jako przyczyna poza kodem fazy (`przyczynaBezPrzegladarki`), nie jako `restartBlad`. Rdzeń woła skrypt przez `e2e.mjs start` i `restart`, a slot niesie opis: deterministycznie zamiast agenta i bez kosztu w webie. Próby: patrz akapit niżej. Na wariancie: 1239/1254, 2 pominięte, 13 padnięć bez zmian |
| 2.5 | `popr/expo-sloty-tekstowe` / `c20b2a2` | Sloty Expo: `buildery.md`, `walidacja.md` (jest-expo, konfiguracja Jest z tabeli spike'a, krok build `expo export`, typy na czystym checkoucie), `plan-e2e.md`, `fix-e2e.md`, `dev-plan/references/stack.md`; kopia `szablon-planu.md` z testem porównania z web (wyjątek strażnika z `staly` na `podmiana`); bramka `scripts/bramki/stack.mjs` z `expo-doctor` (D14); `scripts/e2e/expo-swiezosc.mjs` i kontrola w slocie smoke'u. Zmiany w rdzeniu (web bez zmian zachowania): nowy slot `scripts/bramki/stack.mjs` (web: `pominieta`) i nazwa `stack` w `NAZWY_BRAMEK`; `e2e.plikFlow` w profilu (web `null`) i błąd walidatora przy `[E2E]` bez pliku flow (D17); krok build bez warunku na skrypt w `dev-autopilot-wf.js` (warunek jest w slocie web); dwa zdania `dev-plan/SKILL.md` odsyłają do `plan-e2e.md`. Na wariancie: 1241/1254, 2 pominięte, 11 padnięć: 9 na IU-2.1, 2 na IU-2.6, 0 na IU-2.5 |
| 2.2 | `popr/expo-tester-maestro` / `869570e` | Rola `feature-tester-e2e` w wersji Maestro na szkielecie web, z testem porównania linii z wersją web; `scripts/e2e/expo-flow.mjs` (wybór urządzenia bez włączania, zmienne konta, maskowanie, limit czasu, zrzuty w folderze zadania, praca Maestro poza repo); `zmienneFlow` wspólne z canary, które też usuwa `commands-*.json`; `fix-e2e.md` woła ten skrypt. Bez zmian w rdzeniu poza testem `tester-porcje` (katalog runnera ze stacku). Na wariancie: 1241/1254, 2 pominięte, 11 padnięć bez zmian: 9 na IU-2.1, 2 na IU-2.6 |
| 2.4a (poprawka decyzją operatora) | `popr/expo-urzadzenie-bez-przebudowy` / `f7df3a4` | `expo-urzadzenie.mjs`: `przebudowa` tylko przy stwierdzonym braku dev-clienta; sam brak działającego urządzenia bez flagi i bez `prebuild` w naprawie. `sprawdzAndroid` rozdziela `bez-emulatora` od `bez-dev-clienta`, a naprawa dotyczy tylko platformy z `E2E_PLATFORMA`. Slot `po-fazie.md` i pozycja sekcji 0 w smoke'u dla `ok: false` bez przebudowy. Skutek: `e2e.mjs start` dalej daje STOP (`decyzjaSrodowiskaE2e` nie patrzy na flagę), a `restart` w trakcie runu już nie: scenariusze idą na `[Manual]` z powodem. Bez zmian w rdzeniu. Zmieniony test: w `naprawa przebudowy` przypadek `brak urządzenia do E2E` dostaje symulator bez dev-clienta, bo pusta lista urządzeń nie jest już przebudową. Na wariancie: 1241/1254, 2 pominięte, 11 padnięć bez zmian: 9 na IU-2.1, 2 na IU-2.6 |
| 2.1 | `popr/expo-buildery` / `f4798b4` | Buildery `feature-builder-ui\|data\|fullstack` i `-figma` w wersji RN na szkielecie web, z testem porównania linii z wersją web (`stacks/expo/__tests__/buildery.test.mjs`); `tools:` z `Skill`, `skills:` równe tabeli w `buildery.md`; samosprawdzenie `npx jest --watchAll=false --findRelatedTests`, `expo-doctor` zostaje w bramce `stack`, flow i seed jako deliverable buildera, `npx expo install` i wpis o warstwie natywnej. Poza planem, po próbach: `rn-expo-guidelines` i `ux-ui-guidelines-mobile` bez `paths:`, pułapka elementu przy dole ekranu w `mobile-e2e-maestro`. `ZALEGLE` bez 5 agentów, `ZALEGLE_ODESLANIA` bez 4 builderów. Bez zmian w rdzeniu. Na wariancie (rdzeń z `popr/znaleziska-szablonu`): 1280/1284, 2 pominięte, 2 padnięcia, oba na IU-2.6 |
| 2.6 | `popr/expo-weryfikacja-fixture` / `349ab5c` | Slot `weryfikacja-setup/references/stack.md` z przejściem na żywo przez `expo-flow.mjs` i wiedzą z `e2e-setup` (D24); `expo-trasy.mjs` (trasy z plików Expo Router przy `expo-router` w zależnościach); fixture `smoke-autopilot` RN (D18): plan z liniami na ekranie głównym i dwoma flow (D17), `przygotuj-kopie.sh` z menedżerem z lockfile, README. `usun.txt`: `__tests__/`, `pakiet/`, `wstaw-pakiet.mjs` fixture'u web, a kontrakt w `stacks/expo/__tests__/smoke-fixture.test.mjs` (wzór: `templates/bramki/__tests__/`). Zmiany w rdzeniu (web bez zmian zachowania): `szkielet.mjs` bierze z adaptera `SZKIELET_WERYFIKACJI.atrybutSelektora`, `gdzieJazda` i `trasyZPlikow`. Poprawki po próbach: `testPathIgnorePatterns` w `walidacja.md`, `evidence` Expo bez `--test-output-dir` w folderze zadania. `ZALEGLE` bez dwóch pozycji IU-2.6. Na wariancie: 1268/1270, 2 pominięte, 0 padnięć |
| 2.9 | `popr/expo-skille-wspolne` / `cc4e4ce` | Sloty `dev-prep` (Wymiar frame'a, `Target device`, safe area; A0.1 #30) i `dev-compound`. Kopie z testem porównania z web (`stacks/expo/__tests__/skille-wspolne.test.mjs`): `security` (SKILL i 3 resources), `sentry-integration` (SKILL), `supabase-dev-guidelines` (SKILL bez `paths:`, `klient-i-przeglad`, `edge-functions`, `database-patterns`, `security`, `auth-patterns`), 4 agenci badawczy. Nowe w nakładce: `references/stack.md` w trzech skillach (A0.3 §5, poprawki S1–S7, T1–T7, D1–D6), `react-native-sentry-patterns.md`. `usun.txt`: `react-sentry-patterns.md`. Strażnik: 7 wpisów `przejsciowy` zastąpionych 15 wpisami `podmiana` i `usun` per plik. Obie listy zaległych puste. Hook: strzałki w komunikatach bez `>`, więc doctor nie zgłasza zapisu. Bez zmian w rdzeniu i bez zmiany plików web. Na wariancie: 1268/1270, 2 pominięte, 0 padnięć |

Próby IU-2.9 (2026-11-07, kopia z IU-2.6, sonnet). `feature-builder-data` jako subagent dostał od pierwszego wywołania `supabase-dev-guidelines`, `security` i `sentry-integration`, napisał `src/lib/supabase.ts` według skilla (`expo-sqlite/localStorage/install`, `detectSessionInUrl: false`, `flowType: 'pkce'`, `EXPO_PUBLIC_*`, AppState), a `npx expo install` dopisał plugin do `app.json` i wpis „zmiana warstwy natywnej”. `tsc --noEmit` na wyniku: kod 0. Doctor kopii: `zapis hooków` OK. Sprawdzone na żywo 2026-11-07: dokumentacja Sentry (Expo, sourcemapy), `bundledNativeModules.json` SDK 58 (`@sentry/react-native` `~8.28.0`), npm (8.34.0), `eas env:set`, tutorial Supabase dla Expo.

Rozjazdy z IU-2.9. (1) Plan i A0.3 §5.0 mówią o neutralizacji rdzenia i slocie web w każdym skillu. Zamiast tego rdzeń i web są nietknięte, a Expo ma kopie z testem porównania i własny `references/stack.md`: przeniesienie reguł web ze `SKILL.md` do pliku czytanego na żądanie zmieniłoby zachowanie builderów web. Koszt: większa nakładka; zmiana web zatrzymuje test, dopóki ktoś jej nie przeniesie. Agenci badawczy tak samo, bez slotu. (2) `dev-browser@dev-browser-marketplace` zostaje w wariancie: `doctor.test.mjs` rdzenia wymaga tego wiersza, a test zmieniam tylko przy zamówionej zmianie. Doctor daje na nim `UWAGA`, bez blokady. (3) `@sentry/deno` 11 i `major_version` z A0.3 §4.4 dotyczą plików wspólnych z webem i nie weszły do tego IU. `edge-functions-sentry.md` wspomina `@sentry/react` w komentarzu o pinie: plik zostaje wspólny.

Próby IU-2.6 (2026-11-07, sonnet, Maestro 2.5.1). Wariant w osobnym repo i źródło z commitem, oba z klonu `spike-expo-58`. Prawdziwy `przygotuj-kopie.sh` (npm): sync, fixture, `expo customize tsconfig.json`, doctor z kodem 8 na `runner testów`, a po poprawce Jest w kopii doctor OK, typecheck 0, testy 8 zestawów i 24 testy. Prawdziwy `feature-builder-ui` jako subagent wykonał IU-2 fixture'u na `src/app/index.tsx`, a jego `.maestro/smoke-strona.yaml` przeszedł po `e2e.mjs start` na iPhone 17 i na Pixel_8 (Metro z tego startu; zrzut w folderze zadania, bez `commands-*.json`). `e2e.mjs weryfikacja --zapisz` na kopii: trasy `/`, `/explore`, `/smoke-autopilot`, 21 `testID`, opis „na urządzeniu”. Komenda przejścia na żywo ze slotu przeszła na iPhone 17. Metro zatrzymane, urządzenia wyłączone.

Rozjazdy z IU-2.6. (1) Fixture nie ma nowej trasy z A0.1/D18, tylko linie na ekranie głównym: `scheme://smoke-autopilot` nie przeniósł na ekran przy root layoucie z natywnymi kartami, ani z żywego procesu, ani ze stanu zatrzymanego, a `scheme://explore` (istniejąca karta) z żywego procesu przeszedł. To koryguje zapis z IU-2.2: link do trasy w żywym procesie nie wywraca dev-clienta; wywracanie dotyczy linku z adresem Metro. (2) `__expo_disable_onboarding=1` nie wchodzi do wzoru canary. Próba kontrolna bez flagi po `clearState: true` na iPhone 17 nie pokazała arkusza dev-menu, a canary bez flagi nie pokazał `Continue` też na Pixel_8, więc dziś nie ma czego wyłączać. Warunkowe zamknięcie zostaje, bo arkusz widziano w starszych przebiegach; kiedy wraca, nie ustalono. (3) Slot Jest nie wykluczał `.claude/`, więc każdy projekt idący za `walidacja.md` dostałby od doctora `BRAK`. (4) Wiersz `Linie dziś → po` ekranu liczy skrypt (`{{LINIE_EKRANU}}`), bo walidator planu wymaga liczby. (5) `wstaw-pakiet` i `pakiet/` wypadły zamiast łatki: projekt Expo nie ma tu pakietu workspace, więc bramki biegną te, które ma projekt. (6) Commit źródła nowszy od dev-clienta ze zmianą natywną daje STOP startu kopii; w próbie historia była sztuczna (jeden nowy commit) i została przedatowana, bo bramka słusznie ją zatrzymała. (7) Canary spike'a na Pixel_8 padł w kopii na `scrollUntilVisible` do `env-values`; przyczyny nie badano, flow fixture'u odpalono na Metro z tego startu.

Próby IU-2.1 (2026-11-06, klon `spike-expo-58`, sonnet, Maestro 2.5.1). Prawdziwe role przez `claude -p --agent`: UI 56 s, dane 36 s, fullstack 58 s, wszystkie `completed`, czytają `coding-rules.md` i `stack.md`, a brak ESLint w spike'u wpisują do `odchylenia`. Sprawdzone osobno: testy z `src/components` i `src/lib` (14) po trzech rolach, testy licznika po animacji, typecheck po IU-P.5; IU-P.6 tylko z raportu buildera. Wariant `-figma` jako prawdziwy subagent z pluginami w zakresie klonu (expo 1.13.9, figma 2.2.157): ładuje `figma:figma-use` i `figma:figma-design-to-code`, sam woła `expo:expo-animation`. iPhone 17 po `e2e.mjs start`, przez `expo-flow.mjs`: `proba-licznik` PASS przed animacją i po niej, `proba-przypomnienie` FAIL (niżej), `proba-kubek` PASS. Pluginy po próbie odinstalowane, urządzenia wyłączone, Metro zatrzymane.

Rozjazdy z IU-2.1. (1) Próba z trzema przebiegami subagenta: skill z `paths:` ładuje się ze `skills:` tylko wtedy, gdy sesja dotknęła wcześniej pasującego pliku. Bez dotknięcia: tylko `uniwind`; po `Read` pliku `.tsx`: wszystkie trzy; `rn-expo-guidelines` bez `paths:`: ładuje się od razu. Wynik buildera nie zgłasza braku. Po usunięciu `paths:` z obu skilli nakładki subagent dostaje wszystkie trzy od pierwszego wywołania. Dowód to wiadomości `<command-name>` w transkrypcie subagenta; w przebiegach `--agent` transkrypt ich nie miał, a powodu nie badano, więc preload sprawdzaj na subagencie. (2) `proba-przypomnienie` padł trzy razy na asercji stanu po dotknięciu przycisku przy dole ekranu, choć `scrollUntilVisible` uznał przycisk za widoczny. Zrzut z pierwszego padnięcia pokazuje pełnoekranowy log LogBox, czyli dotknięcie trafiło w dymek sondy spike'a. Zrzut z ostatniego, przy LogBox wyłączonym w klonie, pokazuje ekran przewinięty do góry; wniosek, że dotknięcie trafiło w pływający pasek kart, wynika z tego zrzutu i z poprawki, nie z obserwacji samego dotknięcia. Z `centerElement: true` ten flow przeszedł przy wyłączonym LogBox, a `proba-kubek` z tą opcją także przy włączonym. Pułapka jest w `mobile-e2e-maestro`, sekcja „Common gotchas”. (3) UI builder w pierwszym przebiegu nie otworzył `plan-e2e.md` ani skilla Maestro, choć rola kazała pisać flow według nich: polecenie przeszło na „przed napisaniem przeczytaj” ze ścieżką, a następny przebieg sam użył `centerElement: true`. (4) Preload zgodny z tabelą z tego IU, więc bez `expo:expo-data-fetching` z A0.7 §2.4: ładuje się przez `Skill` i jest nazwany w opisie wejścia. Lista antywzorców wyglądu z roli web zastąpiona odesłaniem do `resources/ai-pitfalls.md`, a przykład `bg-[#3B82F6]` usunięty, bo `stack.md` zakazuje dowolnych kolorów w klasach. (5) `tools:` wymienia `Grep` i `Glob` jak web, ale sesja `--agent` ich nie dostała (narzędzia startowe: Read, Bash, Edit, Write, Skill): buildery szukały przez Bash.

Próby IU-2.4a (2026-11-06, klon `spike-expo-58` z wariantem z tej gałęzi). Pixel_8 wyłączony: `expo-swiezosc.mjs` i prawdziwy `e2e.mjs restart` dają `przebudowa: false` i naprawę `emulator -avd` bez `prebuild`. Pixel_8 włączony: dev-client obecny daje `ok: true` na `emulator-5554`; `android.package` podmieniony w `app.json` klonu daje „działający emulator bez dev-clienta” i `przebudowa: true`. iOS z podmienionym `bundleIdentifier`, symulatory wyłączone: `brak dev-clienta` i `przebudowa: true`, bez komendy Androida. Niesprawdzone: zachowanie w prawdziwym runie autopilota (funkcje `decyzjaPrzebudowy` i `srodowiskoPoRestarcie` testowane osobno, `[Manual]` z opisu rdzenia); Android-only bez `E2E_PLATFORMA` na Macu z symulatorami bez dev-clienta i wyłączonym emulatorem daje `przebudowa: true`, choć dev-client może być na emulatorze: naprawa wymienia oba kroki.

Rozjazdy z audytem z IU-2.8: testy poza katalogiem tras nie idą do `__tests__/`, tylko obok plików źródłowych, bo bramka Stryker łączy parę `x.test.ts` ↔ `x.ts`; do `__tests__/` idą testy tras. Sekcje Bezpieczeństwo (`__DEV__`, zmienna funkcji), Type safety (bez wyjątków od `as`, trasa przez obiekt) i Performance (Expo Atlas) ustalone z dokumentacji, nie próbą. Docs Expo o typed routes dopuszczają `as Href`; szablon jest surowszy.

D19 po próbie (Claude Code 2.1.318): `disabledMcpServers` i `deny` w ustawieniach projektu nie usuwają serwera `plugin:expo:expo`, a przełącznik `/mcp` zapisuje wybór w `~/.claude.json`, czyli poza szablonem. Bez logowania serwer ma status `needs-auth` i nie daje narzędzi, więc nakładka nie dodaje reguły dla MCP. Logowanie operatora jest włączeniem z D19. A0.3 U2 nieaktualne: docs Expo (2026-11-03) wymagają `behavior="padding"` na obu platformach.

Zasady przyjęte w trakcie (obowiązują w kolejnych IU):
- Testy nakładki leżą w `stacks/<stack>/__tests__/` (build odrzuca `__tests__` w `nakladka/`) i moduły nakładki importują z ławki
  (`przygotujLawke`), bo w `nakladka/` względne importy do rdzenia się nie rozwiązują. Z tego samego powodu `nakladka/` jest poza
  głównym `tsconfig`; typy sprawdza `testuj-wariant.mjs`.
- Po każdym IU: `node stacks/testuj-wariant.mjs expo`, liczba padnięć w wierszu tabeli; na odbiorze zero i pusta lista `ZALEGLE`.
- Listy do opróżnienia: `ZALEGLE` w `stacks/expo/__tests__/nakladka.test.mjs` i `ZALEGLE_ODESLANIA` w `stacks/expo/__tests__/skille.test.mjs`; przy każdej pozycji stoi jej IU.
- Twierdzenia o narzędziach sprawdzasz na prawdziwym projekcie, nie tylko na fixture'ze: fixture nie pokazał kopiowania `ios/Pods` przez Strykera.
- W spike'u nie używasz `npm install --no-save --legacy-peer-deps`, bo wycina peery jest-expo. Paczki próbne: `--no-save` bez tej flagi, potem `npm install`.

Próby IU-2.3 na urządzeniach (2026-11-05, `spike-expo-58`, Maestro 2.5.1). iOS, iPhone 17: adapter odrzucił iPhone 17 Pro z kontem Apple, włączył iPhone 17 ze stanu Shutdown, wykrył dev-client starszy od `package-lock.json`, a po przebudowie `LANG=en_US.UTF-8 npx expo run:ios --no-bundler` podpis przeszedł. Monit „Otwórz” przy pierwszym deep linku Maestro zamknął dotknięciem. `.env.development.local` przykrył `.env.local`, którego hash się nie zmienił, a `e2e.mjs stop` usunął plik. Przy `CI=1` u rodzica proces Metro działał bez `CI`, a obce Metro na 8081 zostało zastąpione. Android, Pixel_8: `.env.development.local` działa w obie strony przy działającym Metro: usunięcie i reload przez `/message` usuwa wartość z paczki, przywrócenie i reload ją przywraca. To zamyka „niesprawdzone” ze spike'a. Hasło nie trafia do wyjścia startu.

Rozjazdy z IU-2.3: `--test-output-dir` działa już w Maestro 2.5.1 (`maestro test --help`), więc plan („Maestro ≥ 2.8”, IU-2.2) wymaga sprawdzenia; najnowsza wersja to 2.12.1 (GitHub, 2026-11-05). Sonda domyślnie pyta `/status`, bo żądanie `/` kazało Expo budować paczkę web. Przebudowa to `expo run:*`, nie `xcodebuild` z A0.1 #15: daje podpisany build i sama robi `pod install`.

Próby IU-2.4 (2026-11-05, klon `spike-expo-58` z jego `node_modules`, prawdziwe pakiety i iPhone 17). Sam nowszy mtime bez commitu: bez przebudowy. Podbity `typescript` i `lodash` w prawdziwym `package-lock.json`: bez przebudowy z nazwami. Podbity `expo-image`: przebudowa, dowód `expo-module.config.json`, a `przedStartem` na urządzeniu daje STOP z komendą naprawy. Komenda przebudowy na spike'u z prawdziwą paczką `expo-clipboard`: `LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios` dał `ExpoClipboard` w `Podfile.lock`, `run:ios` przeszedł. Paczka z `npm install --no-save` nie wchodzi do buildu, bo autolinking czyta `package.json`; próba wymagała tymczasowego wpisu, który wrócił z kopii, a po `npm install` jest 4/4. Android, Pixel_8: `npx expo prebuild --clean --platform android && npx expo run:android --no-bundler` przeszedł, ale już bez próbnej paczki natywnej. Ostrzeżenie o `--clean`: prawdziwe `e2e.mjs start` i `restart` wariantu na spike'u bez działającego emulatora dają STOP „brak urządzenia” z ostrzeżeniem w naprawie, a `restart` z `przebudowa: true`; pozostałe gałęzie sprawdza test na atrapach komend.

Rozjazdy z IU-2.4: bramka nie jest osobnym krokiem po execute: biegnie w `restart` przed testerem fazy ze scenariuszami, więc faza bez scenariuszy nie zatrzymuje runu, a jej zmianę natywną łapie pierwszy `restart` po niej. Bramka nie przebudowuje sama, tylko robi STOP (jak stary mobile, D12). Przebudowa to `prebuild --clean` + `run:*` zamiast samego `run:*` z IU-2.3, bo `run:*` robi prebuild tylko przy braku katalogu natywnego (docs Expo, CNG).

Próby IU-2.5 (2026-11-05, klon `spike-expo-58`, `expo-doctor` 1.21.6). `bramki.mjs` wariantu: zepsuty `app.json` i zainstalowana stara paczka SDK dają `stack: porazka` z trafieniem na każde sprawdzenie, a po przywróceniu `stack: ok`. Klucz `jest` wprost ze slotu, bez `setupFiles`: 3 zestawy, 4 testy przechodzą; bez cache 13 s, z cache 7 s. `expo export` na iOS i Androida: 8,6 s, `.hbc` na obie platformy. Bez `expo-env.d.ts` i `.expo/types` `tsc` daje kod 2, a po `expo customize tsconfig.json` kod 0 przy niezmienionym `tsconfig.json`. `expo-swiezosc.mjs` na iPhone 17: dev-client starszy niż `app.json` daje `przebudowa: true` z nazwami zmian i komendą naprawy; bez emulatora i z `E2E_PLATFORMA=android` daje „brak urządzenia”.

Rozjazdy z IU-2.5: linia scenariusza niesie identyfikator `<flow>`, a nie ścieżkę z A0.1 #29, bo rdzeń nazywa flow identyfikatorem kebab-case, a tester pisze do `$Z/maestro/<flow>`; plik to `.maestro/<flow>.yaml` wg `e2e.plikFlow`. Krok build to `expo export`, a nie `expo-doctor` z A0.1 #24, bo doktor jest bramką (D14). Zimny Jest na małym projekcie trwa 13 s, a „~16 min” ze starego mobile dotyczyło Vitesta. `expo-doctor` biegnie tylko po zmianie zależności albo konfiguracji i przez `npx`, bo szablon go nie ma w zależnościach. Sprawdzenie z IU-2.4: slot smoke'u miał tylko pozycję „dev-client aktualny” bez sposobu sprawdzenia, więc zmiana natywna z ostatniej fazy bez scenariuszy albo z fixa mogła przejść do smoke'u niezauważona; doszła kontrola `expo-swiezosc.mjs` przed zapisem sekcji 0. A0.1 #30 (wymiary frame'a, `Target device`): `dev-plan` nie odsyła do tych treści, więc idą do slotu `dev-prep` w IU-2.9.

Próby IU-2.2 (2026-11-05, klon `spike-expo-58`, Maestro 2.5.1). Prawdziwa rola przez `claude -p --agent feature-tester-e2e` (sonnet, 75 s) na iPhone 17 po `e2e.mjs start`, 4 scenariusze: flow z asercją dał PASS ze zrzutem; nietrafiona asercja FAIL i P2 z dosłownym komunikatem; brak pliku SKIP `scenariusz-niewykonalny` i P2 „brak flow”; flow bez asercji stanu z linii FAIL i P2. Tester nie zmienił pliku zadań ani `.maestro/`. Odchylenie modelu: przy braku flow pole `plik` wskazało `*-zadania.md`, a nie oczekiwaną ścieżkę. `expo-flow.mjs` na Pixel_8: `--urzadzenie` wybrało `emulator-5554`, flow przeszedł, zrzut w folderze zadania. Tymczasowy flow makiety z `--plik` przeszedł na iPhone 17.

Rozjazdy z IU-2.2: próba pokazała, że `commands-*.json` w `--test-output-dir` i w `~/.maestro/tests` zapisuje wartości `-e`, także hasło, nawet gdy flow go nie używa. Pierwsza wersja skryptu zostawiała ten plik w folderze zadania. Teraz Maestro pisze do katalogu tymczasowego (`--test-output-dir` i `--debug-output`), a do repo idą tylko zrzuty; po poprawce skan folderu dowodów nie znalazł hasła, a w `~/.maestro/tests` nie przybyło katalogów. Plan wskazywał `--test-output-dir` w folderze zadania i Maestro ≥ 2.8: opcja działa w 2.5.1, a zrzut trafia tam do `screenshots/`, nie do `takeScreenshot/` z A0.3. Tester woła skrypt zamiast `maestro test`, bo adapter nie zapisuje wyboru urządzenia między procesami, a ten sam wybór liczy się bez stanu. Wejście na ekran makiety idzie drogą z mapy funkcji albo flow tej funkcji, nie deep linkiem z A0.7: wejście linkiem do żywego procesu wywraca dev-client, a `<scheme>://<trasa>` ze stanu zatrzymanego nie było próbowane.

**Do kolejnych kroków (stan po odbiorze, 2026-11-07).** Etap 2 przyjęty. Odbiór w `docs/reviews/2026-11-odbior-etapu-2.md`: kryterium z planu spełnione, na wariancie 1268/1270, 2 pominięte, 0 padnięć, obie listy zaległych puste. Run autopilota na kopii: `wf_6272905b-2d8` oczekiwany STOP, `wf_e05c211e-938` status OK, punkt bramek z README niesprawdzony (spike nie ma ESLint ani migracji).
- Decyzje operatora (2026-11-07) wykonane: merge IU-2.9, run autopilota Expo na kopii, przebieg web na kopii bez regresji (`wf_78488c6d-20c`), D3 (merge `ea23fce`), `paths:` w skillach web (merge `3b5eede`).
- Otwarte z runów: D4 `ksiegowanie.mjs:18` ucina powód `[Manual]` i odsyła do `docs/active/` po archiwizacji; D5 `stan:zapis` odmawia nadpisania stanu (niska waga, nie z Etapu 2); punkt bramek ESLint i migracji w wariancie Expo do pilota w Etapie 4. Po D3: `ps -E`, Android, runner `.maestro/<etap>-run-all.sh`.
- Wariant `dev-browser@dev-browser-marketplace` zostaje do decyzji: zdjęcie wymaga zmiany `doctor.test.mjs` rdzenia.
- Niesprawdzone z IU-2.9: klient Supabase z `expo-sqlite/localStorage` na urządzeniu (typecheck przeszedł, dev-client bez przebudowy), OAuth PKCE z `expo-auth-session` i Universal Links, Sentry z pluginem na urządzeniu, `withUniwindConfig(getSentryExpoConfig(...))`, `autoWrapExpoRouterErrorBoundary` i `heartbeatCallback` (z A0.3, bez uruchomienia), `experimental_android` (pole potwierdzone w kodzie pluginu, działanie nie), przepływ Stripe mobile, role badawcze w działaniu, kopie resources poza `SKILL.md` przez builder.
- Niesprawdzone z IU-2.6: z runu autopilota na kopii defekty bramek, Android i sesja desktop (reszta przeszła w `wf_e05c211e-938`), `przygotuj-kopie.sh` na pnpm, yarn i bun, przejście `/weryfikacja-setup` przez agenta (komenda ze slotu sprawdzona ręcznie), ekran główny za logowaniem, IU-1 i IU-3 fixture'u przez builder, trasy w monorepo z aplikacją w podkatalogu (szkielet zostawia znacznik), `testPathIgnorePatterns` na projekcie z bramką Stryker.
- Naprawione po odbiorze (merge `3b5eede`): skille z `paths:` dostawały buildery web tylko czasem: `supabase-dev-guidelines`, `tailwind-react-guidelines` i `ux-ui-guidelines` (transkrypty vibersi z 2026-11-01 i 11-03). Zamówiona zmiana zachowania webu, test `skille-preload.test.mjs`. Niesprawdzone: role `-fullstack` i `-figma`, prawdziwy run web z tą zmianą.
- Niesprawdzone z IU-2.1: buildery w prawdziwym runie autopilota (`agentType` w Workflow), `get_design_context` przez wariant `-figma` z prawdziwą makietą, fullstack i dane z prawdziwą bazą, migracją i Deno, przebieg z `figma_screens`, flow z zimnego startu bez wcześniejszego `e2e.mjs start`, flow z `openLink` na Androidzie. Rola data nie dostała flow w próbie. `create_session` Figmy z A0.7 §4 dalej poza allowlistą, jak na webie.
- Zapis `<pm> expo run:*` w README używa `npx`; pnpm i bun niesprawdzone. Flow z linii to identyfikator, plik to `.maestro/<flow>.yaml`.
- Niesprawdzone z IU-2.7 i IU-2.8: snippety `ux-ui-guidelines-mobile` (subagent, bez kompilacji), `Uniwind.setTheme`, `@variant`, `withUniwind` z `colorClassName`, pełny `bramki.mjs` na jest-expo (Stryker przeszedł, reszta na fixture'ze), hook w sesji Claude Code.
- Do obserwacji: test „probny zrzut na starcie” w `srodowisko.test.mjs` padł raz w pełnym `pnpm test` i nie powtórzył się; przyczyna nieustalona.
- Niesprawdzone z IU-2.3: canary z prawdziwym logowaniem Supabase (wzór `_canary.yaml` przeszedł `check-syntax`, a na spike'u próbny wariant z polem tekstowym zamiast logowania), sygnatury blokera na prawdziwym błędzie modułu natywnego i entitlements, STOP przy niepodpisanym buildzie na prawdziwej binarce (atrapa `codesign`), `E2E_URZADZENIE` i fallback Androida bez `E2E_PLATFORMA` na urządzeniach (atrapy), kontrola świeżości na Androidzie przy starym buildzie, pnpm i bun w komendzie startu.
- Niesprawdzone z IU-2.4: STOP z autopilota w prawdziwym runie (funkcje i restart testowane osobno), diff lockfile'ów pnpm, yarn i bun na prawdziwym pliku (fixture z ręcznego zapisu), projekt z `ios/` i `android/` w repo (slot i naprawa każą pominąć `prebuild`).
- Niesprawdzone z IU-2.2: seedy i `psql` testera na prawdziwej bazie e2e, runner `.maestro/<etap>-run-all.sh`, raport `.ips` przy prawdziwym padzie, sygnatury blokera z dowodu testera, status `zawieszony` na prawdziwym flow (atrapa), tryb `bez-interakcji` i porcje w prawdziwym runie, makiety przez całą rolę (sam flow zrzutu przeszedł), Maestro nowszy niż 2.5.1 (najnowszy `cli-2.12.1`), rola po poprawce dowodów (skrypt sprawdzony osobno, wynik roli sprzed poprawki), pliki `commands-*.json` z wcześniejszych przebiegów w `~/.maestro/tests` zostają na dysku operatora.
- Niesprawdzone z IU-2.5: kontrola `expo-swiezosc.mjs` i slot smoke'u w prawdziwym runie, `expo-doctor` przy niedziałającej sieci (narzędzie albo API Expo) i na pnpm, yarn i bun, czas zimnego Jest na dużym projekcie, `maestro hierarchy --compact` na urządzeniu w naprawie (sprawdzone tylko `--help`), typecheck bramki na czystym checkoucie, gdy rozgrzewka nie biegła. `dowodNatywnosci` traktuje dev-paczkę z katalogiem `ios` (np. `jest-expo`) jak natywną: fałszywy STOP kosztuje jedną przebudowę.
- Stan `spike-expo-58`: `package-lock.json` zmieniony przez `npm install` po próbie Strykera, a treści zmiany nie oglądano. `node_modules` wg lockfile'a, jest 4/4, Strykera i tymczasowego `figma` nie ma. Z IU-2.3: `.env.e2e` ma `E2E_PLATFORMA=android` i próbne wartości, `.gitignore` ma `.env.e2e`, jest `.maestro/_canary.yaml`, dev-clienty przebudowane na obu platformach, urządzenia wyłączone.

Odbiór Etapu 2 (2026-11-07): testy na wariancie, CI i run autopilota na kopii (iOS) przeszły, wyniki i sprawy otwarte w
`docs/reviews/2026-11-odbior-etapu-2.md`. Etap 2 przyjęty przez operatora 2026-11-07, z zastrzeżeniami: punkt bramek ESLint i migracji
przechodzi do pilota w Etapie 4; D3 (`expo-canary.mjs`) naprawiane przed Etapem 3 (zrobione, `ea23fce`); przebieg autopilota web na kopii
(zrobiony, bez regresji, `d1ce766`); `paths:` w skillach web po odbiorze (zrobione, `3b5eede`). Etapu 3 nie zaczęto, czeka na zgodę operatora.

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

Decyzje operatora na start Etapu 3 (2026-11-08, wg rekomendacji): domyślny URL `sync-template` z `szablon.repo` w slocie
`profil.json`; przypięcie pluginu expo przez marketplace typu `settings` z `git-subdir` i `sha`, po próbie na klonie (inaczej
zostaje `claude-plugins-official`); strażnik repo mobile przez przebudowę z SHA w `.rdzen-version`; automat publikacji
wyłączony flagą w pliku workflowu, `workflow_dispatch` jako ręczna publikacja przez CI; README repo mobile napisane od nowa.

**Stan Etapu 3**

| IU | Gałąź / merge | Co powstało | Liczby |
|---|---|---|---|
| 3.2 | `popr/wariant-expo-ci` (`2533056`), bez merge'a | Job `wariant-expo` w `maszyneria.yml` (build, `stacks/sprawdz-wersje.mjs`, strażnik i nakładka, `testuj-wariant.mjs`); akcje: `pnpm/action-setup` v6.1.1, `setup-node` v7.1.0 | `pnpm -s test` 1723/1723; typecheck 0; lint 0; wariant 1273/1275, 2 pominięte, 0 padnięć, typecheck 0, 411 plików; kroki joba lokalnie: strażnik i nakładka 256/256; actionlint 0. Job na runnerze GitHuba niesprawdzony (bez pusha) |
| 3.3 | `popr/publikuj-mobile` (`67969dd`, `583dfaf`), bez merge'a; wymaga IU-3.2 na main; deploy key i sekret czekają na operatora | `.github/workflows/publikuj-mobile.yml` (workflow_run po `maszyneria` z `false` do pilota, `workflow_dispatch` z main, kontrola sekretu i zielonego `wariant-expo`, build `--zastap`, `sprawdz-wersje`, commit `sync: rdzeń <sha>` tylko z `.claude/` i `output-styles/`); `stacks/publikuj-mobile.mjs` (publikuj / bez-zmian / starszy względem `.rdzen-version`); `stacks/expo/PUBLIKACJA.md` (deploy key, `MOBILE_DEPLOY_KEY`) | `pnpm -s test` 1731/1731 (+14); typecheck 0; lint 0; wariant 1273/1275, 2 pominięte, 0 padnięć, typecheck 0; actionlint 0. Symulacja na fikcyjnym repo mobile (bare remote) z komendami z pliku workflowu: pierwsza publikacja, commit bota, README nietknięty, stary skill usunięty, druga decyzja `bez-zmian`; strażnik repo mobile na wyniku: 0 różnic. Niesprawdzone: bieg na GitHubie, push kluczem deploy, `gh run list` z tokenem Actions |

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
