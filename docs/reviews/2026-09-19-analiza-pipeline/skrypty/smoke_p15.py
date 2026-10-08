"""Sekcja odczytu smoke'a P15 (ogrodnik) — importowana przez smoke_odczyt.py.

Smoke P15 (PLAN-POPRAWY §3 P15): 1 agent pomiaru `ogrod:pomiar` (klasa bez Edit/Write) po compound-refresh, przed
archiwizacją; `ogrod:ocena` tylko przy decyzji skryptu; sekcja „## Ogród” w podsumowaniu zadania w archiwum kopii;
0 zmian w kodzie od ogrodnika (narzędzia agentów z transkryptu: bez Edit/Write, Bash tylko odczyt; drzewo kopii czyste);
telemetria `run.ogrod`.
"""
import json
import os
import subprocess

from smoke_p14 import KODOWANIE, narzedzia

NARZEDZIA_ZAPISU = {'Edit', 'Write', 'NotebookEdit', 'MultiEdit'}
# Bash agenta oceny: odczyt kodu (grep, sed -n, cat, wc, git log/show/grep) — wszystko inne zgłaszamy do przeczytania.
BASH_ODCZYT = ('node .claude/scripts/ogrod/ogrod.mjs pomiar', 'grep', 'rg', 'sed -n', 'cat', 'head', 'tail', 'wc', 'ls',
               'git log', 'git show', 'git grep', 'git diff', 'find', 'nl', 'awk')


def bash_tylko_odczyt(komenda):
    return all(any(c.strip().startswith(p) for p in BASH_ODCZYT) for c in komenda.replace('&&', '|').replace(';', '|').split('|') if c.strip())


def agenci_w_kolejnosci(run):
    return sorted(run['agenci'], key=lambda a: a.get('start') or '')


def sekcja_p15(run, wyniki, katalog):
    print('\n== 2l. Ogrodnik (P15)')
    kolejnosc = [a.get('etykieta') or '' for a in agenci_w_kolejnosci(run)]
    ogrod = [a for a in agenci_w_kolejnosci(run) if (a.get('etykieta') or '').startswith('ogrod:')]
    print('  agenci ogrodnika: %d (%s)' % (len(ogrod), ', '.join(a['etykieta'] for a in ogrod) or 'brak'))
    pozycja = {e: i for i, e in enumerate(kolejnosc)}
    refresh = next((i for e, i in pozycja.items() if e == 'compound-refresh'), None)
    smoke = next((i for e, i in pozycja.items() if e.startswith('smoke-operatora')), None)
    pomiar = pozycja.get('ogrod:pomiar')
    print('  kolejność: compound-refresh %s < ogrod:pomiar %s < smoke-operatora %s → %s' % (
        refresh, pomiar, smoke, 'OK' if pomiar is not None and (refresh is None or refresh < pomiar) and smoke is not None and pomiar < smoke else 'ZŁA'))
    for a in ogrod:
        _, uzycia = narzedzia(katalog, a['id']) if katalog else ('', [])
        zapis = [n for n, _ in uzycia if n in NARZEDZIA_ZAPISU]
        bash = [arg for n, arg in uzycia if n == 'Bash']
        inne = [b for b in bash if not bash_tylko_odczyt(b)]
        print('  %s: koszt %.3f M, ctx_start %s, model %s, %s s; narzędzia %s; zapis %s; Bash poza odczytem %d' % (
            a['etykieta'], (a.get('koszt_jedn') or 0) / 1e6, a.get('ctx_start'), a.get('model'), a.get('sekundy'),
            dict((n, sum(1 for x, _ in uzycia if x == n)) for n in sorted({x for x, _ in uzycia})), zapis or 'brak', len(inne)))
        for b in inne:
            print('    Bash: %s' % b.replace('\n', ' ')[:200])
    for etykieta, _, w in wyniki:
        if etykieta == 'ogrod:pomiar' and isinstance(w, dict):
            try:
                dane = json.loads(w.get('stdout') or '')
            except ValueError:
                dane = None
            print('  wynik pomiaru: kod %s, %s' % (w.get('kod'), 'JSON OK' if dane else 'stdout nie jest JSON: %s' % (w.get('stdout') or '')[:200]))
            if dane:
                print('    liczby %s; decyzja: ocena %s, źródło %s, %s' % (
                    json.dumps(dane.get('liczby')), dane['decyzja'].get('ocena'), dane['decyzja'].get('zrodlo'), dane['decyzja'].get('powod')))
                print('    nowe %s: %s' % (dane.get('noweRazem'), ', '.join('%s %s:%s' % (n['kategoria'], n['plik'], n['linia']) for n in dane.get('nowe') or [])))
        if etykieta == 'ogrod:ocena':
            print('  wynik oceny: %s' % json.dumps(w, ensure_ascii=False)[:600])
    print('  telemetria run.ogrod: %s' % json.dumps(run['run'].get('ogrod'), ensure_ascii=False))
    kopia = os.path.join(KODOWANIE, run['run']['projekt'])
    zadanie = run['run']['zadanie']
    podsumowanie = os.path.join(kopia, 'docs/completed', zadanie, '%s-podsumowanie.md' % zadanie)
    if not os.path.exists(podsumowanie):
        print('  podsumowanie: BRAK %s' % podsumowanie)
    else:
        tresc = open(podsumowanie, encoding='utf-8').read()
        sekcja = tresc.split('## Ogród', 1)[1] if '## Ogród' in tresc else None
        print('  sekcja „## Ogród” w podsumowaniu: %s' % ('BRAK' if sekcja is None else 'jest'))
        if sekcja is not None:
            print('    ## Ogród%s' % sekcja.rstrip().replace('\n', '\n    '))
    if os.path.isdir(kopia):
        stan = subprocess.run(['git', '-C', kopia, 'status', '--porcelain'], capture_output=True, text=True).stdout.strip()
        print('  drzewo kopii po runie: %s' % ('czyste' if not stan else 'BRUDNE:\n    ' + stan.replace('\n', '\n    ')))
