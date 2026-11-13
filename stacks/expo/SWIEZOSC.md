# Świeżość źródeł wariantu Expo

Wariant Expo opiera się na czterech źródłach, które starzeją się niezależnie od rdzenia. Plan szablonu mobile z rdzenia, Etap 5.

| Źródło | Gdzie przypięte | Kto aktualizuje |
|---|---|---|
| Plugin `expo` (skille `expo:*`, upstream `expo/skills`, `plugins/expo`) | `sha` w `.claude-plugin/marketplace.json` | szablon, po przeglądzie treści |
| Skill `uniwind` (upstream `uni-stack/uniwind`, `skills/uniwind`) | `stacks/expo/nakladka/.claude/skills/uniwind/ZRODLO.md` | szablon, kopia bajt w bajt |
| Expo SDK | tabela „Wersje stosu” w `rn-expo-guidelines` | szablon, przy każdym nowym SDK |
| Maestro | nie przypięte; wersja na maszynie operatora | operator (`curl -fsSL https://get.maestro.mobile.dev \| bash`) |

## Sprawdzenie

Z korzenia repo szablonu (potrzebne `gh` i `npm`):

```bash
node stacks/expo/swiezosc.mjs
```

Wynik to JSON z pozycją na źródło: `przypiete`, `upstream`, `aktualne` i co przejrzeć. Skrypt niczego nie zmienia. Uruchamiaj go:

- przy każdym nowym SDK Expo (wydania mniej więcej co 3–4 miesiące; tag `latest` w `npm view expo dist-tags`),
- raz na kwartał,
- przed publikacją, która zmienia skille mobile.

## Plugin expo

Podbicie `sha` zmienia kontekst każdego buildera mobile, więc wchodzi tylko po przeglądzie różnicy:

```bash
gh api "repos/expo/skills/compare/<przypięty sha>...main" --jq '.files[] | select(.filename | startswith("plugins/expo/")) | .filename'
```

Przy przeglądzie sprawdzasz, czy nowa treść nie kłóci się z ustaleniami `expo-stos-szablonu` (Uniwind, Supabase, lokalny Maestro,
blokada `@expo/agent-cli` w `settings.patch.json`). Kłócąca się treść to powód, żeby zostać na starym `sha`, albo dopisać ustalenie
do `expo-stos-szablonu` przed podbiciem. Po podbiciu: wersję i datę pluginu w `expo-stos-szablonu` („Zanim napiszesz kod”).

**Stan 2026-11-13: zostajemy na `a9e5bd3` (plugin 1.14.3, 2026-11-01).** Upstream (1.15.1, `cd91460`) każe uruchamiać każdą komendę
Expo przez `npx --yes @expo/agent-cli@latest` (eksperymentalne CLI, wersja `latest` z npm, bez przypięcia), także `expo install`.
Szablon blokuje `@expo/agent-cli` w `permissions.deny`, więc agent po podbiciu dostawałby odmowę przy każdej komendzie. Reszta zmian to
skill `eas-simulator` (płatny symulator w chmurze, poza drogą szablonu) i stopki z poleceniem wysyłki opinii do Expo (szablon jej
zabrania). Podbicie dopiero, gdy `@expo/agent-cli` wyjdzie z fazy eksperymentalnej i da się go przypiąć do wersji — wtedy decyzja,
czy odblokować go w `settings.patch.json`.

## Skill uniwind

Pobierz katalog `skills/uniwind` z nowego commita, porównaj z kopią (`diff -r`), podmień bajt w bajt poza `ZRODLO.md` i popraw tam
commit, datę i wersję Uniwind. Stan 2026-11-13: kopia `66bac01` jest najnowszym commitem skilla (Uniwind 1.13.2).

## Nowy SDK

Nowy SDK zmienia skille własne wariantu, których upstream nie aktualizuje:

- `rn-expo-guidelines`: tabela „Wersje stosu” z `bundledNativeModules.json` gałęzi `sdk-<N>` repo `expo/expo`, reguły z release notes,
- `mobile-e2e-maestro`: zmiany w dev-cliencie, deep linkach i ekranie startowym (canary i `_session-bootstrap`),
- `ux-ui-guidelines-mobile`: zmiany w `expo-router` i `@expo/ui`,
- `expo-stos-szablonu` i `references/stack.md` skilli wspólnych: nazwy paczek i ścieżek,
- `.claude/stack/profil.json` nakładki: komendy CLI.

Spike na czystym projekcie z nowym SDK (wzór: `docs/reviews/2026-11-audyt-mobile/spike-sdk-58.md`) przed zmianą tabeli wersji.

## Maestro

Szablon nie przypina Maestro, ale skrypty E2E (`expo-canary.mjs`, `expo-flow.mjs`) zakładają jego zachowanie. Pilot (2026-11-09…13)
szedł na Maestro 2.5.1, a najnowsze wydanie to 2.12.1: przed kolejnym runem na kopii zaktualizuj Maestro i sprawdź canary.
