#!/usr/bin/env python3
"""Kontekst PIERWSZEJ tury per agent = staly narzut (system prompt + instrukcje projektu + reguly + schematy narzedzi + prompt zadania)."""
import json, glob, os, collections, csv
S = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/dane/'
rows = list(csv.DictReader(open(S + 'agents.csv')))
idx = {(r['projekt'], r['run'], r['agent']): r for r in rows}
ROOT = os.path.expanduser('~/.claude/projects')
first_ctx = collections.defaultdict(list); first_ctx_proj = collections.defaultdict(list); first_ctx_date = collections.defaultdict(list)
prompt_len = collections.defaultdict(list)
per_agent_first = {}
for p in ['oferty-online', 'claude-cron', 'Nawykometr', 'akademia-automatyzacji-dashboard', 'symulator-poczekalni']:
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + p)
    for jf in glob.glob(os.path.join(base, '*', 'subagents', 'workflows', 'wf_*', 'agent-*.jsonl')):
        run = jf.split('/subagents/workflows/')[1].split('/')[0]; aid = os.path.basename(jf)[6:-6]
        r = idx.get((p, run, aid))
        if not r: continue
        plen = None
        for line in open(jf, errors='ignore'):
            try: o = json.loads(line)
            except Exception: continue
            if plen is None and o.get('type') == 'user':
                c = (o.get('message') or {}).get('content')
                plen = len(c) if isinstance(c, str) else sum(len(b.get('text', '')) for b in c if isinstance(b, dict)) if isinstance(c, list) else 0
            if o.get('type') == 'assistant':
                u = (o.get('message') or {}).get('usage')
                if u:
                    ctx = u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0)
                    first_ctx[r['rola']].append(ctx); first_ctx_proj[p].append(ctx); first_ctx_date[r['start'][:7]].append(ctx)
                    prompt_len[r['rola']].append(plen or 0); per_agent_first[(p, run, aid)] = ctx
                    break
def q(v, p):
    v = sorted(v); return v[min(len(v) - 1, int(p * len(v)))] if v else 0
print("=== KONTEKST 1. TURY (k tokenow) per rola: p10 / p50 / p90 | dlugosc promptu zadania (znaki, p50) ===")
for k, v in sorted(first_ctx.items(), key=lambda kv: -len(kv[1]))[:26]:
    print(f"{k:24} n={len(v):4}  {q(v,.1)//1000:4}k / {q(v,.5)//1000:4}k / {q(v,.9)//1000:4}k | prompt {q(prompt_len[k],.5):6} zn")
print("\n=== per projekt (1. tura) ===")
for k, v in first_ctx_proj.items(): print(f"{k:34} n={len(v):4} p10={q(v,.1)//1000}k p50={q(v,.5)//1000}k")
print("\n=== per miesiac startu (1. tura) ===")
for k, v in sorted(first_ctx_date.items()): print(f"{k} n={len(v):4} p10={q(v,.1)//1000}k p50={q(v,.5)//1000}k")
tot = 0; base = 0; base_p10 = 0
p10p = {p: q(v, .1) for p, v in first_ctx_proj.items()}
for r in rows:
    tot += float(r['koszt'])
    f = per_agent_first.get((r['projekt'], r['run'], r['agent']), 0)
    base += f * int(r['tury']) * 0.1
    base_p10 += p10p.get(r['projekt'], 0) * int(r['tury']) * 0.1
print(f"\nKoszt 'kontekstu startowego x tury' (cache read 0.1): {base/1e6:.0f}M z {tot/1e6:.0f}M jedn. = {base/tot*100:.0f}% calosci")
print(f"W tym czysty staly narzut (p10 projektu, czyli bez promptu zadania): {base_p10/1e6:.0f}M = {base_p10/tot*100:.0f}% calosci")
