#!/usr/bin/env python3
"""Koszt wywolan skilli w sesji glownej (dev-brainstorm, dev-prep, dev-plan, dev-docs, dev-docs-complete, dev-pr, dev-compound, dev-autopilot-wf...).
Heurystyka: wiadomosc usera z <command-name>X</command-name> otwiera epizod; epizod trwa do nastepnej wiadomosci usera,
ktora NIE jest tool_result (czyli do nastepnego realnego wejscia czlowieka). Sumujemy usage asystenta w epizodzie."""
import json, glob, os, re, collections, datetime, csv, sys
ROOT = os.path.expanduser('~/.claude/projects')
PROJS = ['oferty-online', 'claude-cron', 'Nawykometr', 'akademia-automatyzacji-dashboard', 'symulator-poczekalni']
W_IN, W_CW, W_CR, W_OUT = 1.0, 1.25, 0.1, 5.0
def ts(s):
    try: return datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except Exception: return None
def tekst(content):
    if isinstance(content, str): return content
    if isinstance(content, list): return ' '.join(b.get('text', '') for b in content if isinstance(b, dict) and b.get('type') == 'text')
    return ''
def czy_tool_result(content):
    return isinstance(content, list) and any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in content)
epizody = []
for p in PROJS:
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + p)
    for jf in glob.glob(os.path.join(base, '*.jsonl')):
        cur = None
        for line in open(jf, errors='ignore'):
            try: o = json.loads(line)
            except Exception: continue
            t = o.get('type'); msg = o.get('message') or {}; c = msg.get('content')
            if t == 'user':
                if czy_tool_result(c) or o.get('isMeta'): continue
                txt = tekst(c)
                if cur: epizody.append(cur); cur = None
                m = re.search(r'<command-name>/?([\w:-]+)</command-name>', txt)
                if m:
                    cur = dict(projekt=p, sesja=os.path.basename(jf)[:8], skill=m.group(1), zrodlo='slash', start=o.get('timestamp', ''), koniec='', tury=0, in_tok=0, cache_w=0, cache_r=0, out_tok=0, tool_calls=0, agent_calls=0, workflow_calls=0, ctx_max=0)
            elif t == 'assistant':
                if not cur and isinstance(c, list):
                    for b in c:
                        if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('name') == 'Skill':
                            cur = dict(projekt=p, sesja=os.path.basename(jf)[:8], skill=str((b.get('input') or {}).get('skill', '?')), zrodlo='Skill-tool', start=o.get('timestamp', ''), koniec='', tury=0, in_tok=0, cache_w=0, cache_r=0, out_tok=0, tool_calls=0, agent_calls=0, workflow_calls=0, ctx_max=0)
                            break
                if not cur: continue
                u = msg.get('usage')
                mid = msg.get('id')
                if u and mid:
                    if mid in cur.setdefault('_ids', set()): u = None
                    else: cur['_ids'].add(mid)
                if u:
                    cur['tury'] += 1; cur['in_tok'] += u.get('input_tokens', 0); cur['cache_w'] += u.get('cache_creation_input_tokens', 0); cur['cache_r'] += u.get('cache_read_input_tokens', 0); cur['out_tok'] += u.get('output_tokens', 0)
                    cur['ctx_max'] = max(cur['ctx_max'], u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0))
                if isinstance(c, list):
                    for b in c:
                        if isinstance(b, dict) and b.get('type') == 'tool_use':
                            cur['tool_calls'] += 1
                            n = b.get('name') or ''
                            if n == 'Agent': cur['agent_calls'] += 1
                            if n == 'Workflow': cur['workflow_calls'] += 1
                if o.get('timestamp'): cur['koniec'] = o['timestamp']
        if cur: epizody.append(cur)
for e in epizody:
    e['koszt'] = round(e['in_tok'] * W_IN + e['cache_w'] * W_CW + e['cache_r'] * W_CR + e['out_tok'] * W_OUT)
    a, b = ts(e['start']), ts(e['koniec'])
    e['minuty'] = round((b - a).total_seconds() / 60, 1) if a and b else 0
for e in epizody: e.pop('_ids', None)
print("epizodow przed filtrem:", len(epizody), "| z turami:", sum(1 for e in epizody if e['tury'] > 0))
epizody = [e for e in epizody if e['tury'] > 0]
if not epizody: sys.exit("brak epizodow")
with open(sys.argv[1] if len(sys.argv) > 1 else 'skille.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(epizody[0].keys())); w.writeheader(); w.writerows(epizody)
agg = collections.defaultdict(lambda: dict(n=0, tury=0, out=0, cr=0, cw=0, koszt=0, minuty=0, tools=0, agents=0, wf=0, ctx=[]))
for e in epizody:
    a = agg[e['skill']]; a['n'] += 1; a['tury'] += e['tury']; a['out'] += e['out_tok']; a['cr'] += e['cache_r']; a['cw'] += e['cache_w']; a['koszt'] += e['koszt']; a['minuty'] += e['minuty']; a['tools'] += e['tool_calls']; a['agents'] += e['agent_calls']; a['wf'] += e['workflow_calls']; a['ctx'].append(e['ctx_max'])
print("epizodow:", len(epizody))
print(f"{'skill':28} {'n':>3} {'tury/ep':>8} {'out k/ep':>9} {'cacheR M/ep':>12} {'koszt/ep':>9} {'min/ep':>7} {'tools/ep':>9} {'Agent/ep':>9} {'Workflow/ep':>12} {'ctx_max p50':>12}")
for k, a in sorted(agg.items(), key=lambda kv: -kv[1]['koszt'] / kv[1]['n'])[:30]:
    n = a['n']; ctx = sorted(a['ctx'])[n // 2]
    print(f"{k[:28]:28} {n:3} {a['tury']/n:8.0f} {a['out']/n/1000:9.0f} {a['cr']/n/1e6:12.2f} {a['koszt']/n/1000:8.0f}k {a['minuty']/n:7.0f} {a['tools']/n:9.0f} {a['agents']/n:9.1f} {a['wf']/n:12.1f} {ctx//1000:11}k")
print("\n=== oferty-online: epizody dev-* chronologicznie (ostatnie 40) ===")
for e in sorted([e for e in epizody if e['projekt'] == 'oferty-online' and e['skill'].startswith('dev-')], key=lambda e: e['start'])[-40:]:
    print(f"{e['start'][:16]} {e['skill']:22} tury={e['tury']:4} out={e['out_tok']//1000:4}k cacheR={e['cache_r']/1e6:5.1f}M koszt={e['koszt']//1000:6}k min={e['minuty']:5} Agent={e['agent_calls']} Workflow={e['workflow_calls']}")
