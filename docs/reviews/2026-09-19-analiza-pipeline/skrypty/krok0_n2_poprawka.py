#!/usr/bin/env python3
"""KROK 0 / N2 — wyłącza w Claude Code pluginy z konta claude.ai, które aplikacja desktop wstrzykuje jako @inline.

Dlaczego: aplikacja desktop przekazuje te pluginy sesji sama (inicjalizacja SDK), więc `syncClaudeAiPlugins: false`
i `syncClaudeAiSkills: false` ich nie dotyczą (działają tylko w terminalowym `claude`). Klucz `enabledPlugins`
"<nazwa>@inline": false to mechanizm, którego CLI używa dla pluginów claude.ai (sprawdzone w kodzie CLI 2.1.284;
skutek do potwierdzenia pomiarem startu w nowej sesji).

Użycie: python3 krok0_n2_poprawka.py            → tylko pokazuje plan
        python3 krok0_n2_poprawka.py --wykonaj  → kopia pliku do katalogu kopii, potem zmiana
Zmienia wyłącznie `enabledPlugins` w ~/.claude/settings.json. Działa od następnej NOWEJ sesji.
Przywrócenie: usunąć te wpisy albo `cp -p` kopii wypisanej po zapisie."""
import json, os, shutil, sys, time

PLIK = os.path.expanduser('~/.claude/settings.json')
KOPIE = os.path.expanduser('~/claude-konto-kopie/2026-09-28-przed-krok0')
WYLACZ = [
    'design@inline',                    # kat. 2: 7 skilli + 7 serwerów MCP (figma, asana, slack, notion, linear, atlassian, intercom)
    'strona-przez-rozmowe@inline',      # kat. 2: 6 skilli + hook PreToolUse
    'cowork-plugin-management@inline',  # kat. 2: 2 skille
    'anthropic-skills@inline',          # kat. 4: skille claude.ai (docs, docx, pdf, pptx, xlsx, morning, import-memory, skill-creator)
                                        #         + 5 dodatków aplikacji (consolidate-memory, explain-usage, schedule, setup-claude, setup-cowork)
]


def main():
    with open(PLIK, encoding='utf-8') as f: ust = json.load(f)
    ep = dict(ust.get('enabledPlugins') or {})
    print('Plan zmian w %s (enabledPlugins):' % PLIK)
    for k in WYLACZ:
        print('  - %s: %s → false' % (k, json.dumps(ep.get(k))))
        ep[k] = False
    if '--wykonaj' not in sys.argv:
        return print('\nNic nie zmieniono. Uruchom z --wykonaj, żeby zapisać.')
    os.makedirs(KOPIE, exist_ok=True)
    kopia = os.path.join(KOPIE, 'settings.json.przed-krok0_n2_poprawka-%s' % time.strftime('%H%M%S'))
    shutil.copy2(PLIK, kopia)
    with open(PLIK + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(dict(ust, enabledPlugins=ep), f, ensure_ascii=False, indent=2); f.write('\n')
    os.replace(PLIK + '.tmp', PLIK)
    print('\nZapisano. Kopia sprzed zmiany: %s' % kopia)


if __name__ == '__main__':
    main()
