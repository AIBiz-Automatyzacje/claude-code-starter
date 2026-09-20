#!/usr/bin/env python3
"""Przezywalnosc findingow per os review: ile zglosil reviewer -> ile przeszlo dedup+verify (scribe.findings[].zrodlo) -> P1/P2 vs P3."""
import json, glob, os, collections
ROOT = os.path.expanduser('~/.claude/projects')
PROJS = ['oferty-online', 'claude-cron', 'Nawykometr', 'akademia-automatyzacji-dashboard', 'symulator-poczekalni']
zgl = collections.defaultdict(lambda: collections.Counter()); prz = collections.defaultdict(lambda: collections.Counter())
fazy = 0; klucze_scribe = collections.Counter(); zrodla_scribe = collections.Counter(); multi = 0
for p in PROJS:
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + p)
    for jp in glob.glob(os.path.join(base, '*', 'subagents', 'workflows', 'wf_*', 'journal.jsonl')):
        labels = {}; res = []
        for line in open(jp, errors='ignore'):
            try: o = json.loads(line)
            except Exception: continue
            if o.get('type') == 'started' and o.get('label'): labels[o['key']] = o['label']
            elif o.get('type') == 'result': res.append((labels.get(o.get('key'), '?'), o.get('result')))
        if not labels: continue
        # grupuj po fazie: kolejne review:* az do scribe:faza-N
        biezace = collections.Counter()
        for lab, r in res:
            if lab.startswith('review:') and isinstance(r, dict) and isinstance(r.get('findings'), list):
                ax = lab.split(':')[1]
                for f in r['findings']:
                    if isinstance(f, dict): biezace[(ax, (f.get('severity') or '?').upper())] += 1
            elif lab.startswith('scribe:') and isinstance(r, dict):
                fazy += 1
                for (ax, sev), n in biezace.items(): zgl[ax][sev] += n
                biezace = collections.Counter()
                for f in r.get('findings') or []:
                    if not isinstance(f, dict): continue
                    klucze_scribe.update(f.keys())
                    z = f.get('zrodlo') or f.get('_zrodlo') or 'brak'
                    zrodla_scribe[str(z)[:40]] += 1
                    srcs = z if isinstance(z, list) else [s.strip() for s in str(z).replace('+', ',').split(',')]
                    if len(srcs) > 1: multi += 1
                    for s in srcs: prz[s][(f.get('severity') or '?').upper()] += 1
print("faz z review+scribe:", fazy, "| klucze findingow scribe:", dict(klucze_scribe))
print("zrodla w scribe (top):", zrodla_scribe.most_common(12), "| findingow z >1 zrodlem:", multi)
print(f"\n{'os':16} {'zglosil':>8} {'P1+P2 zgl':>10} {'przeszlo':>9} {'P1+P2 przeszlo':>15} {'przezyw. %':>11} {'P3 zgl':>7} {'P3 przeszlo':>12}")
for ax in sorted(zgl, key=lambda a: -sum(zgl[a].values())):
    z = zgl[ax]; q = prz.get(ax, collections.Counter())
    zs = sum(z.values()); qs = sum(q.values())
    print(f"{ax:16} {zs:8} {z['P1']+z['P2']:10} {qs:9} {q['P1']+q['P2']:15} {100*qs/max(1,zs):10.0f}% {z['P3']:7} {q['P3']:12}")
print("\nzrodla w scribe nieznane osiom:", {k: sum(v.values()) for k, v in prz.items() if k not in zgl})
