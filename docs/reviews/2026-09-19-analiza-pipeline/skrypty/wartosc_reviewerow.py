#!/usr/bin/env python3
"""Wartosc reviewerow: (A) z journali runow z etykietami (>=2026-09-13): findingi per os review -> po dedup -> verify -> fix;
(B) z raportow review-faza-N w docs/completed (5 projektow): per finding severity/typ/zrodlo/sceptyk."""
import json, glob, os, re, collections, sys
ROOT = os.path.expanduser('~/.claude/projects')
KOD = '/Users/kacper_trzepiecinski/Documents/Kodowanie'
PROJS = ['oferty-online', 'claude-cron', 'Nawykometr', 'akademia-automatyzacji-dashboard', 'symulator-poczekalni']

# ---------- (A) journale ----------
print("########## (A) JOURNALE — findingi per os review (runy z etykietami) ##########")
per_os = collections.defaultdict(lambda: dict(agentow=0, findingi=0, p1=0, p2=0, p3=0, operator=0, e2e=0, pliki=collections.Counter()))
dedup_stats = []; verify_stats = collections.Counter(); fix_stats = collections.Counter(); runy = 0
verdicts = []
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
        runy += 1
        for lab, r in res:
            if lab.startswith('review:') and isinstance(r, dict) and isinstance(r.get('findings'), list):
                os_ = lab.split(':')[1]
                a = per_os[os_]; a['agentow'] += 1
                for f in r['findings']:
                    if not isinstance(f, dict): continue
                    a['findingi'] += 1
                    sev = (f.get('severity') or '').upper(); a[sev.lower() if sev.lower() in ('p1', 'p2', 'p3') else 'operator'] += 1
                    a['pliki'][(f.get('plik') or '?').split(':')[0].split('/')[-1]] += 1
            elif lab == 'dedup:semantyczny' and isinstance(r, dict):
                d = r.get('duplikaty') or []
                dedup_stats.append((sum(len(g) for g in d), len(d)))
            elif lab.startswith('verify') and isinstance(r, dict):
                for k in ('obalony', 'refuted', 'werdykt', 'wynik'):
                    if k in r: verify_stats[f"{k}={r[k]}"] += 1; break
                if 'werdykty' in r and isinstance(r['werdykty'], list):
                    for w in r['werdykty']:
                        if isinstance(w, dict): verify_stats[f"batch:{w.get('obalony', w.get('werdykt'))}"] += 1
            elif lab.startswith('fix:faza') and isinstance(r, dict):
                fix_stats['naprawione'] += r.get('naprawione') or 0; fix_stats['nierozwiazaneP2'] += r.get('nierozwiazaneP2') or 0; fix_stats['nierozwiazaneP1'] += r.get('nierozwiazaneP1') or 0
print("runow z etykietami:", runy)
print(f"{'os':18} {'agentow':>7} {'findingi':>8} {'na agenta':>9} {'P1':>4} {'P2':>4} {'P3':>4} {'OPER/E2E':>9} | top pliki")
for k, a in sorted(per_os.items(), key=lambda kv: -kv[1]['findingi']):
    print(f"{k:18} {a['agentow']:7} {a['findingi']:8} {a['findingi']/max(1,a['agentow']):9.1f} {a['p1']:4} {a['p2']:4} {a['p3']:4} {a['operator']:9} | {', '.join(f'{f}:{c}' for f, c in a['pliki'].most_common(3))}")
if dedup_stats:
    print(f"dedup: srednio {sum(x[0] for x in dedup_stats)/len(dedup_stats):.1f} findingow w {sum(x[1] for x in dedup_stats)/len(dedup_stats):.1f} grupach duplikatow per faza (n={len(dedup_stats)})")
print("verify:", dict(verify_stats.most_common(8)))
print("fix:", dict(fix_stats))

# ---------- (B) raporty review-faza-N w docs/completed ----------
print("\n########## (B) RAPORTY review-faza-N — zrodlo per finding ##########")
rx_new = re.compile(r'^#{3,4}\s+(P1|P2|P3|OPERATOR)\s*·\s*(KOD|TEST|E2E)?\s*·?\s*`([^`]+)`\s*(?:\(źródło: ([^)]*)\))?', re.M)
rx_old = re.compile(r'^#{3,4}\s+\d*\.?\s*\[(P1|P2|P3)/(KOD|TEST|E2E)\]\s*`([^`]+)`', re.M)
zrodla = collections.defaultdict(lambda: collections.Counter()); sceptyk = collections.Counter(); raporty = 0; findingi = 0; formaty = collections.Counter()
per_task = collections.defaultdict(lambda: collections.Counter())
for p in PROJS:
    for rp in glob.glob(os.path.join(KOD, p, 'docs', 'completed', '*', 'review-faza-*.md')):
        raporty += 1; txt = open(rp, errors='ignore').read()
        task = rp.split('/docs/completed/')[1].split('/')[0]
        n_new = 0
        for m in rx_new.finditer(txt):
            n_new += 1; findingi += 1; sev = m.group(1); src = (m.group(4) or 'brak').split(';')[0]
            for s in re.split(r',\s*', src):
                s = s.strip().replace('źródła: ', '').replace('źródło: ', '')
                s = re.sub(r'\s*\(.*', '', s)
                zrodla[s][sev] += 1; per_task[task][s] += 1
            if 'sceptyk sugerow' in (m.group(4) or ''): sceptyk[sev] += 1
        n_old = len(rx_old.findall(txt))
        findingi += n_old
        formaty['nowy(zrodlo)' if n_new else ('stary' if n_old else 'inny')] += 1
        if n_old:
            for m in rx_old.finditer(txt): zrodla['(bez zrodla — stary format)'][m.group(1)] += 1
print(f"raportow: {raporty}, findingow rozpoznanych: {findingi}, formaty: {dict(formaty)}")
print(f"{'zrodlo (reviewer)':40} {'P1':>4} {'P2':>4} {'P3':>4} {'razem':>6}")
for s, c in sorted(zrodla.items(), key=lambda kv: -sum(kv[1].values())):
    print(f"{s[:40]:40} {c['P1']:4} {c['P2']:4} {c['P3']:4} {sum(c.values()):6}")
print("sceptyk sugerowal inna severity (utrzymane):", dict(sceptyk))
print("\nper zadanie (nowy format):")
for t, c in per_task.items(): print(f"  {t[:36]:36} " + ', '.join(f"{s}:{n}" for s, n in c.most_common()))
