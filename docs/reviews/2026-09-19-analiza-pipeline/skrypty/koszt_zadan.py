#!/usr/bin/env python3
"""Koszt zadania end-to-end: runy autopilota (run -> zadanie z bootstrapu w journalu) + epizody skilli w sesji glownej
(przypisane do zadania po czasie: epizod dev-* miedzy startem zadania a nastepnym). Plus czas zegarowy runow."""
import json, glob, os, csv, collections, datetime
S = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/dane/'
ROOT = os.path.expanduser('~/.claude/projects')
agents = list(csv.DictReader(open(S + 'agents.csv')))
skille = list(csv.DictReader(open(S + 'skille.csv')))
# run -> zadanie
run_task = {}
for p in set(a['projekt'] for a in agents):
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + p)
    for jp in glob.glob(os.path.join(base, '*', 'subagents', 'workflows', 'wf_*', 'journal.jsonl')):
        run = jp.split('/subagents/workflows/')[1].split('/')[0]
        for line in open(jp, errors='ignore'):
            try: o = json.loads(line)
            except Exception: continue
            if o.get('type') == 'result' and isinstance(o.get('result'), dict) and o['result'].get('nazwaZadania'):
                run_task[(p, run)] = o['result']['nazwaZadania']; break
            if o.get('type') == 'result' and isinstance(o.get('result'), dict) and o['result'].get('bramka') and o['result'].get('branch'):
                run_task[(p, run)] = 'PR:' + str(o['result']['branch']).replace('feature/', ''); break
# koszt per zadanie per etap
ETAP = {
    'build': 'execute', 'planner': 'execute', 'domkniecie': 'execute', 'warmup:vitest': 'execute',
    'review:test-coverage': 'review', 'review:security': 'review', 'review:performance': 'review', 'review:code-quality': 'review', 'review:correctness': 'review', 'review:spec-compliance': 'review', 'review:e2e': 'review', 'review:e2e:retry': 'review', 'review:simplicity': 'review', 'review:architecture': 'review', 'review:typescript': 'review', 'kontekst:diff': 'review', 'dedup:semantyczny': 'review', 'scribe': 'review',
    'verify': 'verify', 'verify-batch': 'verify', 'verify-fix': 'verify',
    'fix': 'fix', 'fix:pre-skan': 'fix', 'fix:kontrola': 'fix', 'fix:poprawka': 'fix', 'zwin-do-poprawy': 'fix',
    'stan:zapis': 'orkiestracja', 'bootstrap': 'orkiestracja', 'telemetria': 'orkiestracja', 'stop': 'orkiestracja',
    'e2e:precheck': 'e2e-env', 'e2e:env-up': 'e2e-env', 'e2e:env-down': 'e2e-env', 'e2e:db-sync': 'e2e-env',
    'walidacja-koncowa': 'zakonczenie', 'compound': 'zakonczenie', 'compound-refresh': 'zakonczenie', 'complete': 'zakonczenie', 'smoke-operatora': 'zakonczenie',
}
koszt = collections.defaultdict(lambda: collections.Counter()); czas = collections.defaultdict(list); runy = collections.defaultdict(set)
for a in agents:
    t = run_task.get((a['projekt'], a['run']), '?')
    if t == '?': continue
    key = (a['projekt'], t)
    et = ETAP.get(a['rola'], 'pr' if a['rola'].startswith('pr:') else 'inne')
    koszt[key][et] += float(a['koszt']); koszt[key]['RAZEM'] += float(a['koszt']); koszt[key]['out'] += float(a['out_tok'])
    runy[key].add(a['run'])
    if a['start'] and a['koniec']: czas[key].append((a['start'], a['koniec']))
# epizody skilli -> zadanie po czasie: dev-plan/dev-docs/dev-prep/dev-brainstorm przed pierwszym runem zadania, dev-pr/dev-compound po
starty = {}
for key, cz in czas.items(): starty[key] = (min(c[0] for c in cz), max(c[1] for c in cz))
def ts(s):
    try: return datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except Exception: return None
skill_koszt = collections.defaultdict(lambda: collections.Counter())
for e in skille:
    if not e['skill'].startswith('dev-') or e['skill'] == 'dev-autopilot-wf': continue
    st = ts(e['start'])
    if not st: continue
    kand = [(key, ts(s[0]), ts(s[1])) for key, s in starty.items() if key[0] == e['projekt']]
    if e['skill'] in ('dev-prep', 'dev-brainstorm', 'dev-plan', 'dev-docs', 'dev-ideate'):
        nast = [(k, a) for k, a, b in kand if a and a > st and (a - st).days <= 7]
        if nast: k = min(nast, key=lambda x: x[1])[0]; skill_koszt[k][e['skill']] += float(e['koszt'])
    else:
        poprz = [(k, b) for k, a, b in kand if b and b < st and (st - b).days <= 7]
        if poprz: k = max(poprz, key=lambda x: x[1])[0]; skill_koszt[k][e['skill']] += float(e['koszt'])
print(f"{'projekt / zadanie':48} {'runy':>4} {'h zegar':>7} {'RAZEM M':>8} {'skille M':>8} {'exec%':>6} {'review%':>8} {'verify%':>7} {'fix%':>5} {'e2e-env%':>8} {'orkiestr%':>9} {'zakoncz%':>8}")
for key in sorted(koszt, key=lambda k: starty.get(k, ('', ''))[0]):
    c = koszt[key]; sk = sum(skill_koszt[key].values()); tot = c['RAZEM'] + sk
    cz = czas[key]; h = sum((ts(b) - ts(a)).total_seconds() for a, b in cz if ts(a) and ts(b)) / 3600  # suma czasu agentow (nie zegar)
    st = starty.get(key); zegar = ((ts(st[1]) - ts(st[0])).total_seconds() / 3600) if st else 0
    pct = lambda e: f"{100*c[e]/tot:5.0f}%"
    print(f"{(key[0][:12]+' / '+key[1])[:48]:48} {len(runy[key]):4} {zegar:7.1f} {tot/1e6:8.1f} {sk/1e6:8.1f} {pct('execute'):>6} {pct('review'):>8} {pct('verify'):>7} {pct('fix'):>5} {pct('e2e-env'):>8} {pct('orkiestracja'):>9} {pct('zakonczenie'):>8}")
    if skill_koszt[key]: print(f"{'':48}      skille: " + ', '.join(f"{k}={v/1e6:.1f}M" for k, v in skill_koszt[key].most_common()))
