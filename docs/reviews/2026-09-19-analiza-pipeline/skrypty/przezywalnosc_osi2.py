#!/usr/bin/env python3
"""Per-os: potwierdzone (po dedup+verify) i obalone — z promptow scribe'ow (Findings (JSON) z polem zrodlo + lista obalonych)."""
import json, glob, os, re, collections, csv
S = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/dane/'
rows = [r for r in csv.DictReader(open(S + 'agents.csv')) if r['rola'] == 'scribe']
ROOT = os.path.expanduser('~/.claude/projects')
dec = json.JSONDecoder()
potw = collections.defaultdict(lambda: collections.Counter()); obal = collections.defaultdict(lambda: collections.Counter())
potw_m = collections.defaultdict(lambda: collections.Counter()); obal_m = collections.defaultdict(lambda: collections.Counter())
n_ok = n_bad = 0; typy = collections.Counter()
def arr_po(txt, marker):
    i = txt.find(marker)
    if i < 0: return None
    j = txt.find('[', i)
    if j < 0: return None
    try: v, _ = dec.raw_decode(txt[j:]); return v
    except Exception: return None
for r in rows:
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + r['projekt'])
    jfs = glob.glob(os.path.join(base, '*', 'subagents', 'workflows', r['run'], f"agent-{r['agent']}.jsonl"))
    if not jfs: continue
    prompt = None
    for line in open(jfs[0], errors='ignore'):
        try: o = json.loads(line)
        except Exception: continue
        if o.get('type') == 'user':
            c = (o.get('message') or {}).get('content')
            prompt = c if isinstance(c, str) else ' '.join(b.get('text', '') for b in c if isinstance(b, dict)) if isinstance(c, list) else ''
            break
    if not prompt: continue
    fs = arr_po(prompt, 'Findings (JSON)')
    ob = arr_po(prompt, 'balone') or arr_po(prompt, 'OBALONE') or []
    if fs is None: n_bad += 1; continue
    n_ok += 1; mies = r['start'][:7]
    for f in fs:
        if not isinstance(f, dict): continue
        z = str(f.get('zrodlo') or f.get('_zrodlo') or 'brak'); sev = (f.get('severity') or '?').upper()
        typy[f.get('typ')] += 1
        for s in re.split(r'\s*[,+/]\s*', z): potw[s.strip()][sev] += 1; potw_m[mies][s.strip()] += 1
    for f in ob:
        if not isinstance(f, dict): continue
        z = str(f.get('zrodlo') or f.get('_zrodlo') or 'brak'); sev = (f.get('severity') or '?').upper()
        for s in re.split(r'\s*[,+/]\s*', z): obal[s.strip()][sev] += 1; obal_m[mies][s.strip()] += 1
print(f"scribe'ow z Findings (JSON): {n_ok}, bez: {n_bad} | typy potwierdzonych: {dict(typy)}")
print(f"\n{'os (zrodlo)':22} {'potw. P1':>8} {'potw. P2':>8} {'potw. P3':>8} {'potw. razem':>11} {'obalone':>8} {'% obalonych':>12}")
osie = sorted(set(potw) | set(obal), key=lambda a: -(sum(potw[a].values()) + sum(obal[a].values())))
for a in osie:
    p = potw[a]; o = obal[a]; ps = sum(p.values()); os_ = sum(o.values())
    print(f"{a[:22]:22} {p['P1']:8} {p['P2']:8} {p['P3']:8} {ps:11} {os_:8} {100*os_/max(1,ps+os_):11.0f}%")
print("\nper miesiac (potwierdzone per os):")
for m in sorted(potw_m): print(f"  {m}: " + ', '.join(f"{k}:{v}" for k, v in potw_m[m].most_common()))
