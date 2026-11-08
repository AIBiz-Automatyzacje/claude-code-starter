# Publikacja wariantu Expo do workspace-template-mobile

Wariant Expo trafia do [`AIBiz-Automatyzacje/workspace-template-mobile`](https://github.com/AIBiz-Automatyzacje/workspace-template-mobile)
commitem `sync: rdzeń <sha>`, który zmienia tylko `.claude/` i `output-styles/` (plan szablonu mobile z rdzenia, Etap 3, D4).

## Sposoby publikacji

| Sposób | Kiedy | Co robi |
|---|---|---|
| Ręcznie lokalnie | do udanego pilota (Etap 4) i jako zapas | `node stacks/zbuduj.mjs expo ../workspace-template-mobile --zastap`, potem commit `sync: rdzeń <sha>` w repo mobile i push |
| `workflow_dispatch` workflowu `publikuj-mobile` | po założeniu deploy key, za zgodą operatora | to samo na runnerze, dla bieżącego `main` |
| Automat po pushu na `main` | po udanym pilocie | `publikuj-mobile` po zielonym biegu `maszyneria` (z jobem `wariant-expo`); włączenie: usuń `false &&` z warunku joba |

Lokalny build odmawia SHA z `-dirty`, gdy drzewo ma zmiany w `.claude/`, `output-styles/` albo `stacks/`; strażnik repo mobile takiej
publikacji nie przepuści. Publikuj z czystego `main`.

Workflow publikuje tylko wtedy, gdy od SHA zapisanego w `.claude/.rdzen-version` repo mobile zmieniło się coś w `.claude/`,
`output-styles/` albo `stacks/`, i nie nadpisuje nowszej publikacji starszą (`stacks/publikuj-mobile.mjs`).

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
