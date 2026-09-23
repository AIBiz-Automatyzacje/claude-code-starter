#!/usr/bin/env python3
"""Mini-run pytanie (f): plik harnessu workflows/<run>.json (kiedy powstaje, co zostaje po zabiciu sesji) i hook Stop po task-notification.
Czyta pliki sesji w ~/.claude/projects (projekty kopii i mr-f) oraz scratchpad/mr/stop-hook.jsonl. Wyjscie: dane/mr-harness.txt"""
import glob, json, os
from datetime import datetime
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PR = os.path.expanduser('~/.claude/projects')
SP = '/private/tmp/claude-501/-Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template/86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f/scratchpad'
PROJ = [p for p in glob.glob(os.path.join(PR, '*86e1644e*scratchpad*'))]
ts = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
L = ['=== f1/f2: runy workflow w projektach kopii i mr-f — plik harnessu vs journal ===']
for proj in sorted(PROJ):
    for run_dir in sorted(glob.glob(os.path.join(proj, '*', 'subagents', 'workflows', 'wf_*'))):
        sesja = run_dir.split('/subagents/')[0]; run = os.path.basename(run_dir)
        j = [json.loads(l) for l in open(os.path.join(run_dir, 'journal.jsonl'))] if os.path.exists(os.path.join(run_dir, 'journal.jsonl')) else []
        st = sum(1 for x in j if x.get('type') == 'started'); rs = sum(1 for x in j if x.get('type') == 'result')
        hp = os.path.join(sesja, 'workflows', run + '.json')
        ostatni_zapis = max(os.path.getmtime(f) for f in glob.glob(run_dir + '/*'))
        if os.path.exists(hp):
            w = json.load(open(hp)); start = int(w['startTime']) / 1000; koniec = start + w['durationMs'] / 1000
            opis = 'harness: %s, %s, mtime - (start+durationMs) = %+.1f s, mtime - ostatni zapis transkryptu = %+.1f s' % (
                w['status'], w['workflowName'], os.path.getmtime(hp) - koniec, os.path.getmtime(hp) - ostatni_zapis)
        else:
            opis = 'BRAK pliku harnessu'
        L.append('%-40s %-17s journal: started %d / result %d | %s' % (os.path.basename(proj)[-40:], run, st, rs, opis))
L.append('\n=== f3: hook Stop (testowy, w .claude/settings.json kopii) — kazde zakonczenie odpowiedzi sesji ===')
for l in open(os.path.join(SP, 'mr', 'stop-hook.jsonl')):
    o = json.loads(l); w = json.loads(o['wejscie'])
    L.append('%s sesja %s | zadania w tle: %s | koniec odpowiedzi: %s' % (datetime.fromtimestamp(o['t']).strftime('%H:%M:%S'), w['session_id'][:8],
             [(b.get('id'), b.get('type'), b.get('status')) for b in w.get('background_tasks') or []], w.get('last_assistant_message', '')[:70].replace('\n', ' ')))
L.append('pola wejscia hooka: %s' % sorted(json.loads(json.loads(open(os.path.join(SP, 'mr', 'stop-hook.jsonl')).readline())['wejscie']).keys()))
open(os.path.join(BASE, 'dane', 'mr-harness.txt'), 'w').write('\n'.join(L) + '\n')
print('\n'.join(L))
