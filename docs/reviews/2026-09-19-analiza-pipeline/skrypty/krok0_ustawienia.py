#!/usr/bin/env python3
"""KROK 0 — zmiany w ~/.claude/settings.json z decyzji operatora (KROK0-DECYZJE.md, kategorie 2, 4, 6, 7 i env).

Użycie: python3 krok0_ustawienia.py            → tylko pokazuje plan (nazwy kluczy, bez wartości)
        python3 krok0_ustawienia.py --wykonaj  → zapisuje kopię pliku do katalogu kopii, potem zmienia plik
Uruchamia operator, przy zamkniętych sesjach Claude Code, PO komendach `claude plugin …` (one też piszą ten plik).
Zmienia wyłącznie: hooks (zostaje tylko Stop → hook_handler.py), env (znikają CALLME_*), syncClaudeAiPlugins,
syncClaudeAiSkills, disableClaudeAiConnectors, cleanupPeriodDays. Resztę pliku zostawia bez zmian."""
import json, os, shutil, sys, time

PLIK = os.path.expanduser('~/.claude/settings.json')
KOPIE = os.path.expanduser('~/claude-konto-kopie/2026-09-28-przed-krok0')
HOOK_ZOSTAJE = ('Stop', 'hook_handler.py')          # decyzja kat. 6: tylko dźwięk na koniec odpowiedzi
PREFIKS_ENV_DO_USUNIECIA = 'CALLME_'                 # decyzja: 7 zmiennych starego pluginu callme
NOWE_KLUCZE = {
    'syncClaudeAiPlugins': False,        # kat. 2: pluginy z claude.ai (cowork-plugin-management, design, strona-przez-rozmowe) — tylko w Claude Code
    'syncClaudeAiSkills': False,         # kat. 4: skille z claude.ai (docs, docx, import-memory, morning, pdf, pptx, skill-creator, xlsx)
    'disableClaudeAiConnectors': True,   # kat. 7: wszystkie konektory claude.ai — tylko w Claude Code, na claude.ai zostają
    'cleanupPeriodDays': 120,            # decyzja D6 (HANDOFF 6a pkt 20): transkrypty trzymane 120 dni zamiast 30
}


def nowe_hooki(hooks):
    """Zostawia tylko wpis Stop, którego komenda uruchamia hook_handler.py."""
    zd, skrypt = HOOK_ZOSTAJE
    zostaje = [m for m in hooks.get(zd) or [] if any(skrypt in (h.get('command') or '') for h in m.get('hooks') or [])]
    return {zd: zostaje} if zostaje else {}


def plan(ust):
    zmiany = []
    stare_h = {zd: len(v) for zd, v in (ust.get('hooks') or {}).items()}
    nh = nowe_hooki(ust.get('hooks') or {})
    zmiany.append('hooks: %s → %s' % (stare_h, {zd: len(v) for zd, v in nh.items()}))
    env = ust.get('env') or {}
    usun = sorted(k for k in env if k.startswith(PREFIKS_ENV_DO_USUNIECIA))
    zmiany.append('env: usuwam %d kluczy (%s); zostają: %s' % (len(usun), ', '.join(usun), ', '.join(sorted(set(env) - set(usun))) or '-'))
    for k, v in NOWE_KLUCZE.items():
        zmiany.append('%s: %s → %s' % (k, json.dumps(ust.get(k)), json.dumps(v)))
    nowy = dict(ust, hooks=nh, env={k: v for k, v in env.items() if k not in usun}, **NOWE_KLUCZE)
    if not nowy['hooks']: nowy.pop('hooks')
    return zmiany, nowy


def main():
    with open(PLIK, encoding='utf-8') as f: ust = json.load(f)
    zmiany, nowy = plan(ust)
    print('Plan zmian w %s:' % PLIK); print('\n'.join('  - ' + z for z in zmiany))
    if '--wykonaj' not in sys.argv:
        return print('\nNic nie zmieniono. Uruchom z --wykonaj, żeby zapisać.')
    os.makedirs(KOPIE, exist_ok=True)
    kopia = os.path.join(KOPIE, 'settings.json.przed-krok0_ustawienia-%s' % time.strftime('%H%M%S'))
    shutil.copy2(PLIK, kopia)
    with open(PLIK + '.tmp', 'w', encoding='utf-8') as f: json.dump(nowy, f, ensure_ascii=False, indent=2); f.write('\n')
    os.replace(PLIK + '.tmp', PLIK)
    print('\nZapisano. Kopia sprzed zmiany: %s' % kopia)


if __name__ == '__main__':
    main()
