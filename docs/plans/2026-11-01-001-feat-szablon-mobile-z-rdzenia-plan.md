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
- Odbiór: pełne testy maszynerii zielone, diff zachowania zerowy (porównanie wygenerowanych promptów przed/po dla vibersi),
  jeden przebieg autopilota na małym zadaniu w projekcie web.

### Etap 2 — Nakładka Expo (w `stacks/expo/`)

- IU-2.1 Buildery `feature-builder-ui|data|fullstack` w wersji RN — treść z `feature-builder-mobile-*` dopasowana do
  **nowego kontraktu** builderów web (format zwrotu, test padający bez poprawki, granice IU, dossier). Warianty `-figma`
  z pluginem figma (jak web), lokalny `figma-design-to-code` usunięty.
- IU-2.2 Tester `feature-tester-e2e` w wersji Maestro — kontrakt wyniku identyczny jak web (PASS/FAIL/SKIP + przyczyna +
  dowód, format `ksiegowanie.mjs`), procedura z `mobile-e2e-maestro`; zrzut porównywany z makietą przez `takeScreenshot`.
- IU-2.3 Adapter E2E `scripts/e2e/adapter.mjs` dla Expo: logika z promptu env-up mobile (`dev-autopilot-wf.js` mobile
  l.463–701) **przeniesiona do skryptu** — swap `EXPO_PUBLIC_*` w `.env.local` z rollbackiem, Metro z PID na :8081,
  emulator iOS-first z fallbackiem Android, świeżość dev-clienta, canary `.maestro/_canary.yaml`, seedy `.maestro/*-seed.sql`.
  Deterministyczny skrypt zamiast promptu = mniej losowości niż w starym mobile.
- IU-2.4 Bramka natywna po fazie (prebuild / pod install przy zmianie warstwy natywnej, mobile l.1184–1242) jako slot
  `stack/po-fazie.md` + skrypt; rdzeń woła slot, web ma pusty.
- IU-2.5 Sloty tekstowe: `buildery.md` (routing po `app/`, `components/`, `lib/`, `supabase/`), `walidacja.md`
  (`expo-doctor`, jest/vitest, „nie eas build”), `plan-e2e.md` (Maestro, emulator), `fix-e2e.md`.
- IU-2.6 `weryfikacja-setup` wariant Maestro (Launch = dev-client + Metro, Drive = flow Maestro, Evidence = screenshoty)
  — wchłania `e2e-setup`.
- IU-2.7 Skille: dodać `expo-*`, `eas-*`, `mobile-e2e-maestro`, `ux-ui-guidelines-mobile`; usunąć (`usun.txt`) agent-browser,
  tailwind-react-guidelines, ux-ui-guidelines, coolify-manager, makieta + `scripts/makieta` (decyzja D2), `templates/e2e-env` web.
- IU-2.8 Reguły/hooki/settings: `rules/stack.md` RN (anti-patterny z hooka jako reguły), `mobile-anti-pattern-check.sh`
  w `settings.patch.json`, `learned-patterns` Maestro → `docs/learned-patterns.md` (format weba), bramki: eslint RN
  (`eslint-plugin-react-native` / `expo` config), bez size-limit.
- IU-2.9 Warianty mobile wspólnych skilli: `security`, `sentry-integration`, `supabase-dev-guidelines`, `dev-prep` —
  wziąć **aktualną wersję web** i nanieść różnice mobile (secure-store, deep link OAuth, `@sentry/react-native`, konsole sklepów).
  Jeśli różnica to kilka akapitów — rdzeń + `references/mobile.md` w slocie zamiast pełnej kopii skilla.
- Odbiór: `zbuduj.mjs expo` daje `.claude/`, na którym przechodzą testy rdzenia + testy nakładki.

### Etap 3 — Budowanie i publikacja

- IU-3.1 `stacks/zbuduj.mjs <stack> <katalog>`: kopia `.claude/` → usunięcia z `usun.txt` → podmiany i dodatki z nakładki →
  deep-merge `settings.patch.json` → plik `.claude/.rdzen-version` (SHA rdzenia). Bash-free, testowany.
- IU-3.2 `maszyneria.yml`: job `wariant-expo` — build + testy na wyniku + strażnik slotów.
- IU-3.3 `publikuj-mobile.yml`: push na `main` → build → commit `sync: rdzeń <sha>` do `workspace-template-mobile` (tylko
  `.claude/` i `output-styles/`; README/docs repo mobile nietknięte). Sekret: deploy key z prawem zapisu do repo mobile.
  Fallback ręczny: `node stacks/zbuduj.mjs expo ../workspace-template-mobile && git -C … commit`.
- IU-3.4 `sync-template` w wariancie Expo ma domyślny URL repo mobile (podmiana slotu albo zmienna w `settings.patch.json`).
- IU-3.5 README mobile: sekcja „skąd pochodzi `.claude/`” + „nie edytuj `.claude/` w tym repo — zmiany idą do
  `claude-code-starter/stacks/expo`”. Strażnik: CI w repo mobile odrzuca commit zmieniający `.claude/` spoza bota publikacji.

### Etap 4 — Pilot na projekcie mobile

- `Nawykometr` (dziś na mobile `6fbd49d`): `/sync-template --dry-run`, potem sync; doctor; jedno małe zadanie przez
  `/dev-plan` → autopilot → smoke → `/dev-pr`. Sprawdzić: env-up na emulatorze, tester Maestro, księgowanie [E2E], bramka natywna.
- Wnioski → poprawki w `stacks/expo/` (publikują się same). Potem `gramywpadla` (dziś `23e0d92`, starszy — najpierw dry-run).

### Etap 5 — Świeżość skilli technicznych Expo

- Zależnie od decyzji A0.2: przy pluginie `expo@expo-plugins` świeżość zapewnia upstream (nakładka deklaruje plugin
  w `settings.patch.json`, jak `figma` na webie). Przy kopii: skrypt `stacks/expo/odswiez-expo-skills.sh` (klon płytki,
  podmiana 1:1, raport różnic) i wpis w `ZRODLA-SZABLONU.md`, odpalany ręcznie albo raz w miesiącu przez cron w CI z PR-em.
- Własne skille mobile (A0.3/A0.4) wchodzą do cyklicznego audytu świeżości razem z webowymi.

## Decyzje do potwierdzenia

- **D1** Nakładka Expo w `claude-code-starter/stacks/expo/` (rekomendacja), a nie w repo mobile.
- **D2** `makieta` w mobile: usunąć na start (proxy z iframe nie obsłuży aplikacji natywnej); ewentualny wariant „zrzut z
  emulatora obok makiety” jako osobne zadanie po pilocie.
- **D3** Wspólne nazwy ról agentów (`feature-builder-ui` itd.) w obu wariantach zamiast `feature-builder-mobile-*`.
- **D4** Publikacja automatyczna przy każdym pushu na `main` (rekomendacja) vs. ręczna komenda po paczce zmian.
- **D5** Kolejność: Etap 0 (audyt) → Etap 1 (szwy) → reszta. Audyt nie zmienia kodu, więc może iść równolegle z
  przygotowaniem Etapu 1, ale sloty projektujemy dopiero z jego wynikami.
- **D6** Skille Expo z oficjalnego pluginu upstream zamiast kopii (do potwierdzenia próbą A0.2).
- **D7** Stylowanie mobile: NativeWind dalej domyślny mimo wycofania skilla upstream? (rozstrzyga A0.4).

## Ryzyka

- **Etap 1 dotyka workflowów działających w produkcji (vibersi i inne).** Mitigacja: porównanie promptów przed/po,
  przebieg autopilota na małym zadaniu, gałąź `popr/*` jak przy P22–P27.
- **Logika env-up mobile była dotąd promptem** — przeniesienie do skryptu to nowa implementacja, nie kopia. Pilot (Etap 4)
  jest obowiązkowy przed ogłoszeniem wersji.
- **Pierwszy sync projektów mobile usunie dużo plików** (stare skille `dev-docs*` itd.). Backup jest automatyczny, ale
  operator powinien zrobić `--dry-run` i commit przed syncem.
- **Testy rdzenia mogą zakładać webowe sloty** (np. fixtures z Vite). Strażnik z IU-1.5 wyłapie je w Etapie 1.

## Szacunek

Etap 0: 3–4 sesje. Etap 1: 3–4 sesje (największe ryzyko). Etap 2: 3–4 sesje. Etap 3: 1 sesja. Etap 4: 1–2 sesje z emulatorem. Etap 5: pół sesji.
Wykonanie ręczne sesjami na gałęziach `popr/*` (jak P22–P27), commit per IU — nie autopilotem, bo zmieniamy sam autopilot.
