# Publikacja wariantu Expo do workspace-template-mobile

Wariant Expo trafia do [`AIBiz-Automatyzacje/workspace-template-mobile`](https://github.com/AIBiz-Automatyzacje/workspace-template-mobile)
commitem `sync: rdzeń <sha>`, który zmienia tylko `.claude/` i `output-styles/` (plan szablonu mobile z rdzenia, Etap 3, D4).

## Sposoby publikacji

| Sposób | Kiedy | Co robi |
|---|---|---|
| Ręcznie lokalnie | jako zapas | `node stacks/zbuduj.mjs expo ../workspace-template-mobile --zastap`, potem commit `sync: rdzeń <sha>` w repo mobile i push |
| `workflow_dispatch` workflowu `publikuj-mobile` | jako zapas, za zgodą operatora | to samo na runnerze, dla bieżącego `main` |
| Automat po pushu na `main` | włączony 2026-11-13, po runie 5 pilota | `publikuj-mobile` po zielonym biegu `maszyneria` (z jobem `wariant-expo`); wyłączenie: dopisz `false &&` na początku gałęzi `workflow_run` w warunku joba |

Lokalny build odmawia SHA z `-dirty`, gdy drzewo ma zmiany w `.claude/`, `output-styles/` albo `stacks/`; strażnik repo mobile takiej
publikacji nie przepuści. Publikuj z czystego `main`.

Workflow publikuje tylko wtedy, gdy od SHA zapisanego w `.claude/.rdzen-version` repo mobile zmieniło się coś w `.claude/`,
`output-styles/` albo `stacks/`, i nie nadpisuje nowszej publikacji starszą (`stacks/publikuj-mobile.mjs`).

## Co nie przechodzi do mobile samo

Publikacja niesie do mobile każdą zmianę w rdzeniu (`.claude/`, `output-styles/`) z wyjątkiem plików, które nakładka Expo
podmienia w całości albo które wariant usuwa. Zmiana logiki w takim pliku rdzenia nie dotrze do mobile: trzeba ją przenieść
ręcznie do kopii w `stacks/expo/nakladka/` (ta sama ścieżka względna). Żaden test nie wykrywa rozjazdu treści między plikiem
rdzenia a jego kopią w nakładce, więc przy każdej zmianie pliku z listy poniżej sprawdź kopię mobilną.

**Podmieniane w całości** (zmieniasz plik rdzenia → popraw też `stacks/expo/nakladka/<ta sama ścieżka>`):

- Agenci budujący i tester E2E: `.claude/agents/feature-builder-ui.md`, `feature-builder-ui-figma.md`,
  `feature-builder-fullstack.md`, `feature-builder-fullstack-figma.md`, `feature-builder-data.md`, `feature-tester-e2e.md`.
- Agenci researchu: `.claude/agents/best-practices-researcher.md`, `framework-docs-researcher.md`, `repo-research-analyst.md`,
  `web-research-specialist.md`.
- Sloty stacku (`stacks/sloty.json`): wszystkie pliki `.claude/stack/` (`buildery.md`, `e2e-srodowisko.md`, `fix-e2e.md`,
  `plan-e2e.md`, `po-fazie.md`, `profil.json`, `walidacja.md`) oraz `references/stack.md` skilli `dev-compound`,
  `dev-docs-complete`, `dev-plan`, `dev-prep`, `dev-smoke`, `weryfikacja-setup`.
- Szablon planu: `.claude/skills/dev-plan/references/szablon-planu.md`.
- Reguły i skrypty: `.claude/rules/stack.md`, `.claude/scripts/bramki/stack.mjs`, `.claude/scripts/e2e/adapter.mjs`.
- Skille techniczne: `security` (`SKILL.md` i `resources/`), `sentry-integration/SKILL.md`, `supabase-dev-guidelines`
  (`SKILL.md` i `resources/`).
- Szablony: `.claude/templates/bramki/` (`eslint.config.szablon.ts`, `package.json`, `stryker.config.json`),
  `.claude/templates/e2e-env/` (`.env.e2e.example`, `README.md`), `.claude/templates/smoke-autopilot/` (`README.md`,
  `przygotuj-kopie.sh` i pliki `*.md`).

**Usuwane z wariantu** (`stacks/expo/usun.txt`; zmiana nie dotyczy mobile): skille `agent-browser`,
`tailwind-react-guidelines`, `ux-ui-guidelines`, `coolify-manager`, `makieta` ze skryptami `.claude/scripts/makieta/`,
`sentry-integration/resources/react-sentry-patterns.md`, `templates/bramki/.size-limit.json` i testy szablonów bramek
oraz smoke'u autopilota. Gdy zmiana dotyczy zachowania, które mobile też potrzebuje, opisz je w odpowiedniku mobilnym
(np. `mobile-e2e-maestro`, `rn-expo-guidelines`, `ux-ui-guidelines-mobile`).

**`.claude/settings.json`** nie jest podmieniany, tylko scalany z `stacks/expo/settings.patch.json`: nowe hooki i uprawnienia
rdzenia przechodzą same, ale klucz, który patch nadpisuje albo usuwa (`null`), zostaje w mobile w wersji z patcha.

Lista odzwierciedla stan z 2026-11-15. Aktualne pliki podmieniane wypisze polecenie z katalogu repo:

```bash
cd stacks/expo/nakladka && find .claude -type f | while read f; do [ -e "../../../$f" ] && echo "$f"; done | sort
```

Projekty już założone z szablonu mobile dostają opublikowane zmiany dopiero po `/sync-template` w danym projekcie.

## Deploy key i sekret (jednorazowo, robi operator)

Workflow wchodzi do repo mobile kluczem SSH z prawem zapisu tylko do tego jednego repo. Klucz prywatny leży w sekrecie
`MOBILE_DEPLOY_KEY` repo `claude-code-starter`.

1. Wygeneruj parę kluczy poza repozytoriami, bez hasła (runner nie poda hasła):
   ```bash
   ssh-keygen -t ed25519 -N "" -C "publikuj-mobile (claude-code-starter)" -f ~/publikuj-mobile
   ```
2. Dodaj klucz publiczny jako deploy key repo mobile z prawem zapisu: GitHub → `workspace-template-mobile` → Settings → Deploy keys →
   Add deploy key. Tytuł `publikuj-mobile (claude-code-starter)`, treść z `~/publikuj-mobile.pub`, zaznacz **Allow write access**.
   To samo z terminala:
   ```bash
   gh repo deploy-key add ~/publikuj-mobile.pub --repo AIBiz-Automatyzacje/workspace-template-mobile --title "publikuj-mobile (claude-code-starter)" --allow-write
   ```
   Klucz dodany przez `gh` jest powiązany z tokenem `gh`: gdy cofniesz autoryzację GitHub CLI, GitHub usunie też ten klucz.
   Dodanie w przeglądarce tego wiązania nie ma.
3. Zapisz klucz prywatny jako sekret Actions repo `claude-code-starter`: Settings → Secrets and variables → Actions →
   New repository secret, nazwa `MOBILE_DEPLOY_KEY`, wartość: cała zawartość `~/publikuj-mobile` (z liniami `BEGIN`/`END`).
   Z terminala:
   ```bash
   gh secret set MOBILE_DEPLOY_KEY --repo AIBiz-Automatyzacje/claude-code-starter < ~/publikuj-mobile
   ```
4. Usuń lokalne pliki klucza:
   ```bash
   rm ~/publikuj-mobile ~/publikuj-mobile.pub
   ```
5. Sprawdź bez wartości: `gh secret list --repo AIBiz-Automatyzacje/claude-code-starter` pokazuje `MOBILE_DEPLOY_KEY`, a
   `gh repo deploy-key list --repo AIBiz-Automatyzacje/workspace-template-mobile --json title,readOnly` pokazuje klucz
   z `"readOnly": false`.

Jeśli `main` repo mobile dostanie ochronę gałęzi albo ruleset wymagający PR, push deploy key zostanie odrzucony; trzeba wtedy
dodać deploy key do wyjątków reguły.

## Strażnik w repo mobile

`stacks/expo/repo-mobile/.github/workflows/straznik-claude.yml` buduje wariant z SHA w `.claude/.rdzen-version` i porównuje go
z `.claude/` i `output-styles/` repo mobile. Wgraj go do repo mobile razem z pierwszą publikacją albo po niej: na dzisiejszym stanie
repo (bez `.rdzen-version`) strażnik pada z komunikatem o braku pliku.
