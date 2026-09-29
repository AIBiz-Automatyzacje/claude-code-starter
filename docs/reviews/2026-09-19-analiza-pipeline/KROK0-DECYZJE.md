# KROK 0 — porządki konta Claude Code (cały komputer) — decyzje operatora

Stan: **KROK 0 ZAKOŃCZONY I ZAAKCEPTOWANY 2026-09-29 (N3; operator: „tak, visualize zostaje”): start sesji w aplikacji = 48 skilli (0 bez opisu), 87 narzędzi MCP z 14 serwerów (wbudowane + konektor `visualize` 2 narz.), 0 pluginów @inline, 0 hooków pluginów. Domknięte: skill `/konto` w W (commit `c6e4db3c3`), HANDOFF 6a pkt 37, pamięć projektu. Otwarte u operatora: token Airtable w W nadal stary (wyciekły).** Decyzje z 2026-09-28.
Dane: `dane/konto-inwentarz-globalny-przed.txt` i `.json` (`python3 skrypty/konto_inwentarz.py --globalnie [--json]`).
Decyzje operator zaznaczył na stronie „Porządki konta Claude Code” (https://claude.ai/artifact/KxmtpCkJRBuXfy6XgNE8dk, baza strony:
kolekcja `decyzje`) i wkleił jako tekst; doprecyzowania w czacie 2026-09-28: aibiz = tylko w workspace; dev-browser = zostaje w projektach,
które go mają; claude.ai = wyłączone tylko w Claude Code (na claude.ai wszystko zostaje); `CALLME_*` z env = usunąć.

Skróty: **W** = `~/Documents/kacper_trzepiecinski_workspace` (projekt, w którym zostaje to, co operator oznaczył „tylko w projektach”;
instalacje `--scope local`, spójnie z jego obecnym `.claude/settings.local.json`). **user** = `~/.claude/settings.json`, `~/.claude.json`,
`~/.claude/skills|agents`.

## Kopia przed zmianami (2026-09-28 21:57, poza repo, uprawnienia 700/600)

Katalog: `~/claude-konto-kopie/2026-09-28-przed-krok0/`

| Plik w kopii | Oryginał |
|---|---|
| `settings.json` | `~/.claude/settings.json` |
| `claude.json` | `~/.claude.json` (zawiera konfigurację MCP z kluczami — nie udostępniać) |
| `installed_plugins.json`, `known_marketplaces.json` | `~/.claude/plugins/` |
| `skills/`, `agents/`, `hooks/` | `~/.claude/skills`, `~/.claude/agents`, `~/.claude/hooks` (pełne katalogi) |
| `lista-skilli-user.txt`, `lista-agentow-user.txt`, `claude-plugin-list.txt` | listy stanu |

`krok0_ustawienia.py --wykonaj` dokłada tam jeszcze `settings.json.przed-krok0_ustawienia-<godzina>` (stan tuż przed swoją zmianą).
Przywrócenie całości: przy zamkniętych sesjach `cp -p` plików z kopii na miejsce oryginałów (`claude.json` → `~/.claude.json`).

## Jak uruchomić (operator)

1. Zamknij aplikację Claude i wszystkie sesje `claude` (sesje piszą `~/.claude.json` — równoległy zapis mógłby cofnąć zmiany).
2. W Terminal.app: `bash ~/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/skrypty/krok0_komendy.sh`
   (zatrzymuje się na pierwszym błędzie — wtedy wklej wynik w nowej sesji). Podgląd zmian ustawień bez zapisu:
   `python3 …/skrypty/krok0_ustawienia.py`.
3. `bash …/skrypty/krok0_usun.sh` (23 potwierdzone ścieżki — sekcja „Pliki do usunięcia”).
4. Otwórz aplikację Claude → Ustawienia → Rozszerzenia → usuń **airtable-mcp-server**.
5. Nowa sesja w workspace-template → instrukcja „N2” na końcu tego pliku.

## 1. Pluginy poziomu user

| Element | Poziom dziś | Decyzja | Komendy (`krok0_komendy.sh`) | Jak przywrócić |
|---|---|---|---|---|
| aibiz@aibiz | user on | TYLKO W PROJEKTACH: W | w W: `claude plugin install aibiz@aibiz --scope local`; `claude plugin disable aibiz@aibiz --scope user` | `claude plugin enable aibiz@aibiz --scope user` |
| ccc-skills@ccc | user on + local w W i 2 podprojektach W | USUŃ | `claude plugin uninstall ccc-skills@ccc --scope user`; w W, `W/Zadania/projekty/live/2026-09-17-claude-code-od-zera/materialy`, `W/Zadania/projekty/mapowanie-tworcow`: `… --scope local` | `claude plugin install ccc-skills@ccc --scope user` |
| claude-powerline@claude-powerline | user on | GLOBALNIE | — | — |
| dev-browser@dev-browser-marketplace | user on + 24 projekty (project) | TYLKO W PROJEKTACH: te, które mają wpis | `claude plugin disable dev-browser@dev-browser-marketplace --scope user` (W traci dev-browser) | `claude plugin enable … --scope user` |
| discord@claude-plugins-official | user off | USUŃ | `claude plugin uninstall … --scope user` | `claude plugin install … --scope user` |
| figma@claude-plugins-official | user on | TYLKO W PROJEKTACH: W | w W: `install --scope local`; `disable --scope user` | `enable --scope user`. **Uwaga: pipeline szablonu używa figmy (dev-plan, feature-builder-ui/fullstack) → punkt 8** |
| frontend-design@claude-plugins-official | user on | GLOBALNIE (lista projektów pominięta — nie dotyczy) | — | — |
| hookify@claude-plugins-official | user on | USUŃ | `uninstall --scope user` | `install --scope user` |
| hostinger@claude-plugins-official | user on | USUŃ | `uninstall --scope user` | `install --scope user` |
| posthog@claude-plugins-official | user on | TYLKO W PROJEKTACH: W | w W: `install --scope local`; `disable --scope user` | `enable --scope user` |
| security-guidance@claude-plugins-official | user on | USUŃ | `uninstall --scope user` | `install --scope user` |
| sentry@claude-plugins-official | user on | USUŃ | `uninstall --scope user` | `install --scope user` |
| skill-creator@claude-plugins-official | user on | TYLKO W PROJEKTACH: W | w W: `install --scope local`; `disable --scope user` | `enable --scope user` |
| supabase@claude-plugins-official | user on | USUŃ | `uninstall --scope user` | `install --scope user` |
| telegram@claude-plugins-official | user off | USUŃ | `uninstall --scope user` | `install --scope user` |

## 2. Pluginy z konta claude.ai

| Element | Poziom dziś | Decyzja | Zmiana | Jak przywrócić |
|---|---|---|---|---|
| cowork-plugin-management, design, strona-przez-rozmowe (@synced w terminalu, @inline w aplikacji) | konto claude.ai, każdy projekt | USUŃ — tylko w Claude Code | `"syncClaudeAiPlugins": false` w `~/.claude/settings.json` (`krok0_ustawienia.py`); na claude.ai bez zmian | usunąć klucz. **Do sprawdzenia w N2:** czy aplikacja desktop (@inline) też go respektuje — jeśli nie, `enabledPlugins` `"<nazwa>@inline": false` |

## 3. MCP poziomu user

| Element | Poziom dziś | Decyzja | Komendy | Jak przywrócić |
|---|---|---|---|---|
| airtable | user | TYLKO W PROJEKTACH: W | w W: `claude mcp add-json airtable "<konfiguracja z ~/.claude.json>" --scope local`; `claude mcp remove airtable --scope user` | to samo `add-json … --scope user` z `~/claude-konto-kopie/…/claude.json` |
| Fakturownia | user | TYLKO W PROJEKTACH: W | jak airtable (serwer http — możliwe ponowne logowanie w `/mcp`) | jw. |
| mobbin | user (+ identyczny local w W) | TYLKO W PROJEKTACH: W | `claude mcp remove mobbin --scope user` | jw. |
| context7 | user | USUŃ | `claude mcp remove context7 --scope user` | jw. |
| playwright | user | USUŃ | `claude mcp remove playwright --scope user` | jw. |
| airtable-mcp-server | rozszerzenie aplikacji desktop | USUŃ | ręcznie: aplikacja Claude → Ustawienia → Rozszerzenia | zainstalować z katalogu rozszerzeń |

## 4. Skille poziomu user i z claude.ai

| Element | Poziom dziś | Decyzja | Komendy | Jak przywrócić |
|---|---|---|---|---|
| puls, remotion-best-practices, skool | `~/.claude/skills` | TYLKO W PROJEKTACH: W | `mv ~/.claude/skills/<nazwa> W/.claude/skills/` (W jest repo git — trafią do repo przy commicie) | `mv` z powrotem |
| find-skills, graphify, ralph-tui-create-beads, ralph-tui-create-beads-rust, ralph-tui-create-json, ralph-tui-prd | `~/.claude/skills` | USUŃ | `krok0_usun.sh` po potwierdzeniu ścieżek. **graphify:** `~/.claude/CLAUDE.md` ma sekcję „# graphify” (linie 3–5) — po usunięciu skilla nieaktualna; edytuje operator | `cp -Rp ~/claude-konto-kopie/…/skills/<nazwa> ~/.claude/skills/` |
| docs, docx, import-memory, morning, pdf, pptx, skill-creator, xlsx | konto claude.ai | USUŃ — tylko w Claude Code | `"syncClaudeAiSkills": false` (`krok0_ustawienia.py`); na claude.ai zostają | usunąć klucz |

## 5. Agenci poziomu user

| Element | Poziom dziś | Decyzja | Komendy | Jak przywrócić |
|---|---|---|---|---|
| architecture-strategist, best-practices-researcher, code-simplicity-reviewer, framework-docs-researcher, kieran-typescript-reviewer, learnings-researcher, performance-oracle, repo-research-analyst, security-sentinel, spec-flow-analyzer, web-research-specialist | `~/.claude/agents` | USUŃ | `krok0_usun.sh` — każdy ma kopię w szablonie i w 17–21 projektach, więc projekty z szablonu nic nie tracą | `cp -p ~/claude-konto-kopie/…/agents/<nazwa>.md ~/.claude/agents/` |
| auto-error-resolver, e2e-browser-verifier | `~/.claude/agents` | USUŃ | jw. (nie ma ich w szablonie; są w 12 / 4 starszych projektach) | jw. |

## 6. Hooki poziomu user i env

| Element | Poziom dziś | Decyzja | Zmiana | Jak przywrócić |
|---|---|---|---|---|
| Stop → hook_handler.py (dźwięk Hero) | user | GLOBALNIE | zostaje | — |
| Notification / SubagentStop / PostToolUse → hook_handler.py (dźwięki) | user | USUŃ | wpisy z `hooks` (`krok0_ustawienia.py`) | `cp` kopii `settings.json` |
| Stop → error-handling-reminder.sh | user | USUŃ | jw. (szablon ma ten hook u siebie, na poziomie projektu) | jw. |
| UserPromptSubmit → skill-activation-prompt.sh | user | USUŃ | jw. | jw. |
| PreToolUse → jq → bash-command-log.txt | user | USUŃ | jw. (plik logu 77 MB — osobna decyzja w „Pliki do usunięcia”) | jw. |
| env `CALLME_*` (7 kluczy starego pluginu callme) | user | USUŃ | `krok0_ustawienia.py`; zostaje `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | jw. |
| `cleanupPeriodDays: 120` | brak (30 dni) | z decyzji D6 (HANDOFF 6a pkt 20) | `krok0_ustawienia.py` | usunąć klucz |
| `~/.claude/CLAUDE.md` („Pisz zawsze po polsku” + sekcja graphify, 253 zn) | user, każda sesja | WYCZYŚĆ DO ZERA (operator 2026-09-29) | **ZROBIONE** przez Claude 2026-09-29 (plik 0 B); język polski dalej z `"language": "Polish"` w settings.json | kopia: `~/claude-konto-kopie/2026-09-28-przed-krok0/CLAUDE.md` |

## 7. Konektory claude.ai

| Element | Poziom dziś | Decyzja | Zmiana | Jak przywrócić |
|---|---|---|---|---|
| wszystkie (27 pozycji: Ahrefs, Neuronwriter, Supabase, Figma, Gmail, Google Drive, Replicate, Traferto, Cookieyes, Claude Docs, visualize, …) | konto claude.ai, każdy projekt | USUŃ — tylko w Claude Code | `"disableClaudeAiConnectors": true` (`krok0_ustawienia.py`); na claude.ai zostają. Ostatnio używane w Claude Code: Figma 189×, Ahrefs 64×, Neuronwriter 24×, Supabase 16× (głównie W) | usunąć klucz. **Do sprawdzenia w N2** w `/mcp` i pomiarze startu, czy aplikacja desktop respektuje klucz |

## 8. Wpisy w projektach

| Element | Poziom dziś | Decyzja | Zmiana |
|---|---|---|---|
| Kopie testowe i tymczasowe (39) | project | ZOSTAW | — |
| pozostałe grupy i projekty | project/local | ZOSTAW (bez zaznaczenia) | — |

## Pliki do usunięcia — ŚCIEŻKI POTWIERDZONE (operator 2026-09-28) → `skrypty/krok0_usun.sh`

23 ścieżki, wypisane jawnie w skrypcie (bez symboli wieloznacznych): 6 katalogów `~/.claude/skills/` (find-skills, graphify,
ralph-tui-create-beads, ralph-tui-create-beads-rust, ralph-tui-create-json, ralph-tui-prd), 13 plików `~/.claude/agents/*.md` (kat. 5),
3 nieużywane po zmianie skrypty `~/.claude/hooks/` (error-handling-reminder.sh, skill-activation-prompt.sh, stop-build-check-enhanced.sh)
i `~/.claude/bash-command-log.txt` (77 MB). Przywrócenie: skille, agenci, hooki z `~/claude-konto-kopie/2026-09-28-przed-krok0/`;
log nie ma kopii (decyzja operatora). `~/.claude/hooks/hook_handler.py` zostaje (hook Stop).

## Punkt 7 — gdzie ma żyć narzędzie inwentarza: skill `/konto` w W (operator 2026-09-28)

Skill `~/Documents/kacper_trzepiecinski_workspace/.claude/skills/konto/` — działa tam, gdzie operator zarządza kontem; zero kosztu
w innych projektach. Skrypty (`konto_inwentarz.py` + moduły `konto_*.py`) skopiowane do `konto/scripts/`, żeby skill był samodzielny.
Wykonanie: po akceptacji kroku 0 (N2), osobny commit w repo W — robi Claude na polecenie operatora.

## WYMÓG OPERATORA (2026-09-29): instrukcja instalacji szablonu, wszystko PER PROJEKT

„W naszym szablonie, jak go poprawimy, musi być instrukcja instalacji wraz z wszystkimi wymaganymi skillami, pluginami itp., i aby
instalowało się to per projekt, a nie globalnie jako user.” → zakres It. 3c razem z profilem niżej. Dziś README („Jak zacząć — 4 kroki”)
mówi tylko: sklonuj, skopiuj `.claude/`, włącz Dynamic Workflows, `/dev-brainstorm` — bez pluginów i narzędzi. Do instrukcji (inwentarz
z repo 2026-09-29, do sprawdzenia w It. 3c na czystym koncie):
- **pluginy** (per projekt, z profilu niżej): dev-browser (marketplace `sawyerhood/dev-browser`), figma (`anthropics/claude-plugins-official`);
- **skille i agenci**: w `.claude/` szablonu — już per projekt (kopiowane z folderem);
- **narzędzia systemowe**: agent-browser (dziś README skilla mówi `npm install -g` — do sprawdzenia wariant per projekt), jq (hooki), git, gh (dev-pr),
  node; supabase CLI / libpq tylko dla projektów z Supabase;
- **ustawienia**: Dynamic Workflows = true.
Mechanizm per projekt: `extraKnownMarketplaces` + `enabledPlugins` w `.claude/settings.json` projektu — Claude Code przy zaufaniu folderowi
proponuje instalację marketplace'ów i pluginów w tym projekcie (do potwierdzenia testem na czystym koncie w It. 3c).

## Punkt 8 — propozycja profilu `.claude/settings.json` szablonu (It. 3c, BEZ edycji)

Dziś szablon ma: `enabledPlugins` {dev-browser: true}, `hooks` Stop (stop-build-check-enhanced.sh, error-handling-reminder.sh), `statusLine`.
Propozycja (do wdrożenia w It. 3c, po akceptacji; hooki i statusLine bez zmian):

```json
{
  "extraKnownMarketplaces": {
    "dev-browser-marketplace": { "source": { "source": "github", "repo": "sawyerhood/dev-browser" } }
  },
  "enabledPlugins": {
    "dev-browser@dev-browser-marketplace": true,
    "figma@claude-plugins-official": true
  },
  "disableClaudeAiConnectors": true
}
```

- **figma: true** — pipeline szablonu woła `mcp__plugin_figma_figma__*` (dev-plan §Figma, feature-builder-ui, feature-builder-fullstack);
  po kroku 0 figma nie jest już globalna, więc bez tego wpisu nowe projekty z szablonu tracą Figmę.
- **disableClaudeAiConnectors: true** — chroni projekty kodu przed konektorami z konta u każdego, kto używa szablonu (kursanci mają swoje konta).
- Świadomie BEZ sentry/supabase/posthog: operator usunął je globalnie; jeśli nowy projekt ich potrzebuje, włącza je sam (`claude plugin install … --scope project`).
- Hooki i statusLine bez zmian (error-handling-reminder zostaje w szablonie do czasu bramki ESLint — It. 3).

## Wykonanie (2026-09-29)

Operator uruchomił `krok0_komendy.sh` i `krok0_usun.sh` — wszystkie kroki OK; usunął rozszerzenie airtable-mcp-server (lista rozszerzeń
pusta) oraz na claude.ai konektory Traferto i Ahrefs (Traferto zniknął z sesji). **Incydent:** `w_projekcie()` wypisał pełną komendę
`claude mcp add-json airtable …` razem z `AIRTABLE_API_KEY` (terminal + wklejka w czacie → transkrypt sesji 8d1f302f). Poprawione
(drukuje 4 pierwsze słowa); operator ma unieważnić token w Airtable i wpisać nowy w W (`claude mcp add … -s local`). Sygnał przed N2:
sesja wznowiona nadal widzi MCP pluginu design (asana, slack, notion…) → aplikacja desktop prawdopodobnie ignoruje `syncClaudeAiPlugins`
dla pluginów @inline.

## Wynik N2 (2026-09-29, sesja 9825ccd5, aplikacja desktop)

Dane: `dane/konto-inwentarz-globalny-po.txt` i `.json`. Pomiar startu = ten sam projekt (workspace-template) i ta sama aplikacja co „przed” (8d1f302f).

**Wniosek:** porządki poziomu user zadziałały w 100%; zostało to, co aplikacja desktop wstrzykuje sama z konta claude.ai
(4 pluginy @inline + 6 konektorów) — klucze `syncClaudeAiPlugins`, `syncClaudeAiSkills`, `disableClaudeAiConnectors` działają
tylko w terminalowym `claude`, aplikacja je omija. Poprawka: skrypt + przełączniki w aplikacji (niżej).

| Miara | Przed | Po | Uwagi |
|---|---|---|---|
| Always-on poziomu user (szacunek z plików, sekcja 0) | ~46 245 tok | ~113 tok | w aplikacji dochodzi jeszcze ~5 tys. tok z pluginów @inline (niżej) |
| Skille na liście startowej | 303 | 75 | tekst listy bez zmian (~30 000 zn — to stały budżet listy) |
| Skille BEZ OPISU (model widzi samą nazwę) | 248 | 2 | zostały `anthropic-skills:skill-creator`, `xlsx` |
| Narzędzia odroczone / w tym MCP / serwery MCP | 293 / 265 / 30 | 231 / 203 / 20 | tekst 11 883 → 9 629 zn |
| Instrukcje serwerów MCP | 5 100 zn | 6 554 zn | posthog, context7, Fakturownia zniknęły (−1 994); doszły Claude Docs 1 914 i Supabase 1 344 — konektory, które zdążyły się połączyć przed pierwszą wiadomością (pomiar zależny od momentu połączenia) |
| Hooki poziomu user | 6 wpisów + hooki 5 pluginów | 1 (Stop → hook_handler.py) | + PreToolUse ze strona-przez-rozmowe@inline (tylko aplikacja) |
| Skille / agenci user, MCP user, `~/.claude/CLAUDE.md` | 9 / 13, 5, 253 zn | 0 / 0, 0, 0 zn | rozszerzenie airtable-mcp-server — usunięte |

**Co aplikacja nadal ładuje i dlaczego.** Aplikacja przekazuje sesji (inicjalizacja SDK, nie pliki `~/.claude`):
- pluginy @inline z `~/Library/Application Support/Claude/local-agent-mode-sessions/…/rpm` (design, strona-przez-rozmowe,
  cowork-plugin-management) i `…/skills-plugin/…` (anthropic-skills: 8 skilli claude.ai + consolidate-memory, explain-usage,
  schedule, setup-claude, setup-cowork) — 27 skilli i 7 serwerów MCP pluginu design (figma 40 narzędzi + 6 czekających na logowanie);
- konektory claude.ai jako jawne `mcpServers` sesji (`remoteMcpServersConfig`): Cookieyes, Claude Docs, Mobbin, Replicate, Supabase,
  visualize (Neuronwriter przekazany, ale wszystkie narzędzia wyłączone). Opis klucza w CLI 2.1.284: `disableClaudeAiConnectors`
  „blokuje tylko konektory pobierane automatycznie — serwer przekazany jawnie (np. opcją SDK mcpServers) idzie zwykłą ścieżką”.
- Ahrefs i Traferto zniknęły (odłączone na claude.ai). Przełączniki narzędzi aplikacji są trwałe per konto
  (`mcp-user-tool-toggles.json`) — Neuronwriter i Ahrefs są tam wyłączone i nowe sesje to dziedziczą.

**Poprawka (uruchamia operator):**
1. `python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/krok0_n2_poprawka.py` (podgląd) → `… --wykonaj`: w `~/.claude/settings.json`
   `enabledPlugins` `"design@inline"`, `"strona-przez-rozmowe@inline"`, `"cowork-plugin-management@inline"`, `"anthropic-skills@inline"`: false
   (klucz `<nazwa>@inline` to mechanizm CLI dla pluginów claude.ai — w kodzie CLI; skutek potwierdzi pomiar startu). Kopia przed zmianą
   do katalogu kopii.
2. W aplikacji, w dowolnej sesji zakładki Code: menu konektorów → wyłącz Cookieyes, Claude Docs, Mobbin, Replicate, Supabase, visualize
   (konektor claude.ai; wbudowane `visualize` aplikacji zostaje). Nie edytujemy `mcp-user-tool-toggles.json` ręcznie — pisze go aplikacja.
3. Nowa sesja w workspace-template → `python3 …/konto_inwentarz.py --globalnie` → sekcja 7: oczekiwane ~48 skilli, 0 z prefiksem
   design/strona-przez-rozmowe/cowork-plugin-management/anthropic-skills, MCP ~85 narzędzi z ~13 serwerów (same wbudowane w aplikację).
   Jeśli pluginy @inline nadal są — przywrócić kopię i wyłączyć je w aplikacji (ustawienia pluginów; uwaga: może to wyłączyć je też w Cowork).

**Workspace (W) — tylko odczyt, wszystko na miejscu:** `settings.local.json` włącza aibiz, figma, posthog, skill-creator (+ traferto);
`installed_plugins.json` ma je jako `local` dla W; MCP local w `~/.claude.json`: airtable, Fakturownia, mobbin (+ apify, clickup,
easytools, whimsical-desktop); poziom user MCP pusty; skille puls, skool, remotion-best-practices w `W/.claude/skills/` i już
w repo W (commit „vault backup 2026-09-29 10:50”). `~/.claude/skills` i `~/.claude/agents` puste.

**Token Airtable:** w W nadal ten sam klucz co przed krokiem 0 (porównanie bez wypisywania) = wyciekły, NIEUNIEWAŻNIONY.

## N2 — instrukcja na nową sesję po zmianach (operator wkleja; pełna wersja podana w czacie 2026-09-29)

```
Kontynuujemy KROK 0 (porządki konta Claude Code) — sesja N2, nowa sesja PO moich zmianach na koncie. Opus 5.5.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.
BEZ agentów, BEZ zmian w .claude/ szablonu i w CLAUDE.md. Komendy zmieniające konto uruchamiam JA.

Przeczytaj: docs/reviews/2026-09-19-analiza-pipeline/KROK0-DECYZJE.md (decyzje, komendy, sekcja „Wykonanie”) — tam jest cały stan.
Krótko: uruchomiłem krok0_komendy.sh i krok0_usun.sh (wszystko OK), usunąłem rozszerzenie airtable-mcp-server w aplikacji,
na claude.ai odłączyłem konektory Traferto i Ahrefs. Sesja przed N2 nadal widziała MCP pluginu design (asana, slack, notion…).

Do zrobienia:
1. Inwentarz „po”: w katalogu workspace-template uruchom
   python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/konto_inwentarz.py --globalnie  → dane/konto-inwentarz-globalny-po.txt
   python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/konto_inwentarz.py --globalnie --json → dane/konto-inwentarz-globalny-po.json
   (pomiar startu bierze najnowszy transkrypt projektu = ta sesja).
2. Różnica przed/po (dane/konto-inwentarz-globalny-przed.txt): tokeny always-on na sesję, skille na liście i ile BEZ OPISU (przed: 248 z 303),
   narzędzia MCP i serwery na starcie (przed: 265 z 30), instrukcje MCP, hooki. Wynik dopisz do KROK0-DECYZJE.md (sekcja „Wynik N2”).
3. Sprawdź, czy aplikacja desktop respektuje nowe klucze w ~/.claude/settings.json: pluginy z claude.ai (@inline: design, strona-przez-rozmowe,
   cowork-plugin-management) i konektory claude.ai (Cookieyes, Claude Docs, Mobbin, Replicate, Supabase, visualize, Ahrefs, Traferto).
   Jeśli nadal się ładują — przygotuj poprawkę (np. enabledPlugins "<nazwa>@inline": false) jako komendę/skrypt dla mnie, nie wykonuj sam.
4. Sprawdź (tylko odczyt plików konfiguracji), czy w ~/Documents/kacper_trzepiecinski_workspace są: pluginy aibiz, figma, posthog,
   skill-creator (local), MCP airtable, Fakturownia, mobbin (local), skille puls, skool, remotion-best-practices.
5. Przypomnij mi o tokenie Airtable (wyciekł w poprzedniej sesji — unieważnić i wpisać nowy), jeśli jeszcze tego nie potwierdziłem.
6. Oddaj wynik (wniosek na początku) i CZEKAJ na akceptację. Po akceptacji: (a) skill /konto w workspace
   (~/Documents/kacper_trzepiecinski_workspace/.claude/skills/konto/, skrypty konto_*.py skopiowane do scripts/, osobny commit w tamtym repo);
   (b) HANDOFF (§2, 6a — w tym mój wymóg: instrukcja instalacji szablonu z pluginami/skillami PER PROJEKT → It. 3c, profil z KROK0-DECYZJE
   pkt 8; §8 → instrukcja startowa It. 1 telemetria, z planem do akceptacji przed pierwszą edycją .claude/); (c) pamięć projektu;
   (d) commit docs/reviews (bez skrypty/__pycache__/).
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

## Wykonanie poprawki N2 (2026-09-29 11:28)

Operator uruchomił `krok0_n2_poprawka.py --wykonaj` (4 wpisy `@inline: false` w `enabledPlugins`, kopia
`settings.json.przed-krok0_n2_poprawka-112819`) i wyłączył konektory w aplikacji. W bieżącej sesji N2 konektory Cookieyes, Claude Docs,
Mobbin, Replicate, Supabase odłączyły się od razu; w konfiguracji sesji został tylko `visualize`. Nie wiadomo, gdzie aplikacja zapisała
wyłączenie (`mcp-user-tool-toggles.json` ma nadal tylko Neuronwriter i Ahrefs) — trwałość i skutek `@inline: false` sprawdza N3.

## Wynik N3 (2026-09-29, sesja 3e95dbdd, aplikacja desktop)

Dane: `dane/konto-inwentarz-globalny-po-n3.txt` i `.json`. Pomiar startu = ten sam projekt i aplikacja co „przed” (8d1f302f) i „po N2” (9825ccd5).

**Wniosek:** poprawka N2 zadziałała. `"<nazwa>@inline": false` w `enabledPlugins` wyłącza pluginy claude.ai także w aplikacji
desktop (trwale, w nowej sesji); konektory wyłączone w menu aplikacji nie wróciły — poza `visualize` (niżej). Lista skilli przestała
być ucinana: model widzi opis każdego skilla.

| Miara | Przed (8d1f302f) | Po N2 (9825ccd5) | Po N3 (3e95dbdd) |
|---|---|---|---|
| Always-on poziomu user (szacunek z plików, sekcja 0) | ~46 245 tok | ~113 tok (+ ~5 tys. z pluginów @inline) | ~113 tok |
| Skille na liście startowej / tekst listy | 303 / 30 001 zn | 75 / 29 983 zn | **48 / 17 581 zn** |
| Skille BEZ OPISU (lista ucięta) | 248 | 2 | **0** |
| Narzędzia odroczone / w tym MCP / serwery MCP | 293 / 265 / 30 | 231 / 203 / 20 | **112 / 87 / 14** |
| Tekst listy narzędzi odroczonych | 11 883 zn | 9 629 zn | **3 422 zn** |
| Instrukcje serwerów MCP | 5 100 zn | 6 554 zn | **1 022 zn** (tylko claude-in-chrome) |
| Pluginy @inline (design, strona-przez-rozmowe, cowork-plugin-management, anthropic-skills) | ładowane | ładowane | **0** (sekcja 1a: `off`) |
| Konektory claude.ai (serwery z UUID na liście narzędzi) | 7 | 6 | **1** (`visualize`) |
| Hooki | 6 wpisów user + hooki 5 pluginów | Stop + PreToolUse md-guard (plugin @inline) | **Stop** (`hook_handler.py`); md-guard w transkrypcie tylko jako tekst rozmowy |

Serwery MCP po N3: claude-in-chrome 23, ccd_session_mgmt 20, ccd_sidebar 9, scheduled-tasks 6, ccd_pr 5, ccd_view 4, ccd_window 4,
terminal 4, ccd_connectors 3, mcp-registry 3, ccd_directory 2, Claude_Code_iOS_Simulator 1, ccd_session 1 — wszystkie wbudowane
w aplikację — oraz `6f616b42-…` = `visualize` 2. Lista skilli i narzędzi w kontekście samej sesji N3 zgadza się z pomiarem.

**Reszta: konektor `visualize`** (`6f616b42-0ed8-571e-823f-ee4aca6b7ce9`, `https://sandbox.claudemcpcontent.com/imagine_mcp`,
narzędzia `read_me`, `show_widget`). Aplikacja nadal przekazuje go w `remoteMcpServersConfig` każdej nowej sesji (N2 i N3 — ta sama
lista), mimo wyłączenia w menu. To funkcja wizualizacji Anthropic (UUID w wersji 5 = identyfikator nadany przez aplikację, jak
Claude Docs), nie konektor dodany przez operatora; dubluje wbudowane `mcp__visualize__*`. Koszt: 2 nazwy na liście odroczonej (~50 tok),
bez instrukcji. Decyzja proponowana: **zostawić** — trwałe wyłączenie wymagałoby wyłączenia funkcji na koncie claude.ai (operator:
na claude.ai wszystko zostaje) albo edycji plików aplikacji.

**Token Airtable:** w W nadal ten sam klucz co w kopii sprzed kroku 0 (porównanie skrótem SHA-256, bez wypisywania) = wyciekły,
NIEUNIEWAŻNIONY. Do zrobienia przez operatora: unieważnić w Airtable → nowy token → w W `claude mcp add-json airtable … -s local`.

## N3 — instrukcja na nową sesję (pomiar po poprawce + domknięcie kroku 0)

```
Kontynuujemy KROK 0 (porządki konta Claude Code) — sesja N3, nowa sesja PO poprawce N2. Opus 5.5.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.
BEZ agentów, BEZ zmian w .claude/ szablonu i w CLAUDE.md. Komendy zmieniające konto uruchamiam JA.

Przeczytaj: docs/reviews/2026-09-19-analiza-pipeline/KROK0-DECYZJE.md — sekcje „Wynik N2” i „Wykonanie poprawki N2”.
Krótko: uruchomiłem krok0_n2_poprawka.py --wykonaj (design, strona-przez-rozmowe, cowork-plugin-management, anthropic-skills
jako @inline: false) i wyłączyłem w aplikacji konektory Cookieyes, Claude Docs, Mobbin, Replicate, Supabase, visualize.

Do zrobienia:
1. Pomiar: w katalogu workspace-template uruchom
   python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/konto_inwentarz.py --globalnie  → dane/konto-inwentarz-globalny-po-n3.txt
   python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/konto_inwentarz.py --globalnie --json → dane/konto-inwentarz-globalny-po-n3.json
   (sekcja 7 = ta sesja). Oczekiwane: ~48 skilli, zero z prefiksem design:/strona-przez-rozmowe:/cowork-plugin-management:/anthropic-skills:,
   ~85 narzędzi MCP z ~13 serwerów (same wbudowane w aplikację), brak konektorów claude.ai (UUID) i brak hooka md-guard.
   Sprawdź też listę skilli i narzędzi w swoim własnym kontekście tej sesji.
2. Jeśli pluginy @inline nadal się ładują albo konektory wróciły — ustal przyczynę (tylko odczyt: ~/.claude/settings.json,
   ~/Library/Application Support/Claude/, konfiguracja sesji w claude-code-sessions/) i przygotuj poprawkę dla mnie, nie wykonuj sam.
3. Dopisz „Wynik N3” do KROK0-DECYZJE.md (tabela przed / po N2 / po N3) i zaktualizuj linię „Stan”.
4. Sprawdź bez wypisywania (porównanie z ~/claude-konto-kopie/2026-09-28-przed-krok0/claude.json), czy token Airtable w W jest już nowy;
   jeśli nie — przypomnij mi.
5. Oddaj wynik (wniosek na początku) i CZEKAJ na akceptację. Po akceptacji: (a) skill /konto w workspace
   (~/Documents/kacper_trzepiecinski_workspace/.claude/skills/konto/, skrypty konto_*.py skopiowane do scripts/, osobny commit w tamtym repo);
   (b) HANDOFF (§2, 6a — w tym mój wymóg: instrukcja instalacji szablonu z pluginami/skillami PER PROJEKT → It. 3c, profil z KROK0-DECYZJE
   pkt 8, plus wniosek z N2: aplikacja desktop omija klucze claude.ai w settings.json, więc profil szablonu nie wyłączy konektorów kursantom
   w aplikacji — do instrukcji instalacji; §8 → instrukcja startowa It. 1 telemetria, z planem do akceptacji przed pierwszą edycją .claude/);
   (c) pamięć projektu; (d) commit docs/reviews (bez skrypty/__pycache__/).
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```
