#!/usr/bin/env python3
"""Przeglad D5 (2026-09-23): czy model kosztu etapu 0 liczy output poprawnie.
Fakt: jedna odpowiedz API = kilka wpisow `assistant` z tym samym message.id; w 51% odpowiedzi wpisy maja ROZNE usage.output_tokens
(pierwszy wpis = czesciowy stan strumienia, ostatni = wartosc koncowa; pola input/cache sa identyczne). koszt_agentow.py bierze PIERWSZY.
Skrypt: dla tych samych agentow co agents.csv liczy koszt z pierwszym i z ostatnim wpisem; porownuje z budget.spent() (result.tokeny runu).
Wynik: dane/d5r-koszt-output.txt. Czyta tylko ~/.claude/projects (odczyt)."""
import collections, csv, glob, json, os, re

ROOT = os.path.expanduser('~/.claude/projects')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJS = ['oferty-online', 'akademia-automatyzacji-dashboard', 'claude-cron', 'Nawykometr', 'symulator-poczekalni']
W_IN, W_CW, W_CR, W_OUT = 1.0, 1.25, 0.1, 5.0
agents = {(a['run'], a['agent']): a for a in csv.DictReader(open(os.path.join(BASE, 'dane', 'agents.csv')))}

def usage_per_id(jf):
    by = collections.OrderedDict()
    for line in open(jf, errors='ignore'):
        try: o = json.loads(line)
        except Exception: continue
        if o.get('type') != 'assistant': continue
        m = o.get('message') or {}
        u = m.get('usage')
        if u: by.setdefault(m.get('id'), []).append(u)
    return by

wiersze = []; odp = rozne = 0; rozne_pola = collections.Counter(); per_run = collections.defaultdict(lambda: [0, 0])
for p in PROJS:
    for jf in glob.glob(os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + p, '*', 'subagents', 'workflows', 'wf_*', 'agent-*.jsonl')):
        run = jf.split('/subagents/workflows/')[1].split('/')[0]; aid = os.path.basename(jf)[6:-6]
        a = agents.get((run, aid))
        if not a: continue
        by = usage_per_id(jf)
        i = cw = cr = o1 = o2 = 0
        for mid, us in by.items():
            odp += 1
            if len(us) > 1:
                for k in ('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'):
                    if len(set(u.get(k, 0) for u in us)) > 1: rozne_pola[k] += 1
                if len(set(u.get('output_tokens', 0) for u in us)) > 1: rozne += 1
            i += us[0].get('input_tokens', 0); cw += us[0].get('cache_creation_input_tokens', 0); cr += us[0].get('cache_read_input_tokens', 0)
            o1 += us[0].get('output_tokens', 0); o2 += us[-1].get('output_tokens', 0)
        k1 = i * W_IN + cw * W_CW + cr * W_CR + o1 * W_OUT; k2 = k1 + (o2 - o1) * W_OUT
        per_run[run][0] += o1; per_run[run][1] += o2
        wiersze.append(dict(projekt=p, run=run, rola=a['rola'], start=a['start'], cw=cw, cr=cr, i=i, o1=o1, o2=o2, k1=k1, k2=k2, koszt_csv=float(a['koszt'])))

out = []
P = out.append
P('D5r — output w modelu kosztu: pierwszy vs ostatni wpis usage per message.id (przeglad D5, 2026-09-23)')
P('Agenci: %d (te same co dane/agents.csv), odpowiedzi API: %d, odpowiedzi z roznym output_tokens w obrebie id: %d (%.0f%%)' % (len(wiersze), odp, rozne, 100 * rozne / odp))
P('Pola rozne w obrebie jednego id: %s  (input/cache identyczne -> tylko output jest niedoliczony)' % dict(rozne_pola))
zg = sum(1 for w in wiersze if abs(w['k1'] - w['koszt_csv']) <= 1)
P('Kontrola: koszt z pierwszym wpisem == koszt w agents.csv u %d/%d agentow (odtwarza etap 0)' % (zg, len(wiersze)))
T = collections.Counter()
for w in wiersze:
    for k in ('cw', 'cr', 'i', 'o1', 'o2', 'k1', 'k2'): T[k] += w[k]
P('')
P('=== 1. Sklad kosztu (5 projektow, wszystkie runy) ===')
for nazwa, o, k in (('etap 0 (pierwszy wpis)', 'o1', 'k1'), ('poprawione (ostatni wpis)', 'o2', 'k2')):
    P('%-27s razem %6.0f M jedn. | cache read %4.1f%% | cache write %4.1f%% | output %4.1f%% (%.1f M tok) | input %.2f%%' % (
        nazwa, T[k] / 1e6, 100 * T['cr'] * W_CR / T[k], 100 * T['cw'] * W_CW / T[k], 100 * T[o] * W_OUT / T[k], T[o] / 1e6, 100 * T['i'] / T[k]))
P('Udzialy liczone na koszcie etapu 0 (np. oplata za powolanie 22%%, kontekst x tury 40%%) maja licznik z cache -> po poprawce x %.3f' % (T['k1'] / T['k2']))
P('   22%% -> %.1f%% | 40%% -> %.1f%% | 26%% -> %.1f%%' % (22 * T['k1'] / T['k2'], 40 * T['k1'] / T['k2'], 26 * T['k1'] / T['k2']))

GRUPY = [('execute (planner+build+domkniecie)', lambda r: r in ('build', 'planner', 'domkniecie', 'warmup:vitest')),
         ('reviewerzy (review:*)', lambda r: r.startswith('review:')),
         ('sceptycy (verify*)', lambda r: r.startswith('verify')),
         ('mechanika review (kontekst:diff+dedup+scribe)', lambda r: r in ('kontekst:diff', 'dedup:semantyczny', 'scribe')),
         ('petla fix (fix*, zwin)', lambda r: r.startswith('fix') or r == 'zwin-do-poprawy'),
         ('orkiestracja+e2e-env+zakonczenie', lambda r: r in ('stan:zapis', 'bootstrap', 'telemetria', 'stop', 'e2e:precheck', 'e2e:env-up', 'e2e:env-down', 'e2e:db-sync', 'walidacja-koncowa', 'compound', 'compound-refresh', 'complete', 'smoke-operatora'))]
sub = [w for w in wiersze if w['projekt'] == 'oferty-online' and w['start'] >= '2026-09-06']
S1 = sum(w['k1'] for w in sub); S2 = sum(w['k2'] for w in sub)
P('')
P('=== 2. Udzialy per etap fazy — oferty-online po 06.09 (%d agentow; digest §1: execute 28, reviewerzy 25, fix 17, orkiestracja 12, sceptycy 6, mechanika 5) ===' % len(sub))
P('%-46s %8s %8s %8s' % ('etap', 'etap 0', 'popr.', 'zmiana'))
for nazwa, f in GRUPY:
    a1 = sum(w['k1'] for w in sub if f(w['rola'])) / S1 * 100; a2 = sum(w['k2'] for w in sub if f(w['rola'])) / S2 * 100
    P('%-46s %7.1f%% %7.1f%% %+7.1f pp' % (nazwa, a1, a2, a2 - a1))
P('output w tym podzbiorze: etap 0 %.1f%% -> poprawione %.1f%%' % (sum(w['o1'] for w in sub) * 5 / S1 * 100, sum(w['o2'] for w in sub) * 5 / S2 * 100))
per_rola = collections.defaultdict(lambda: [0, 0, 0])
for w in sub: per_rola[w['rola']][0] += w['k1']; per_rola[w['rola']][1] += w['k2']; per_rola[w['rola']][2] += 1
P('Role z najwiekszym przesunieciem udzialu (pp):')
for r, (a, b, n) in sorted(per_rola.items(), key=lambda x: -abs(x[1][1] / S2 - x[1][0] / S1))[:8]:
    P('  %-24s n=%3d  %5.1f%% -> %5.1f%%  (output/koszt po poprawce %.0f%%)' % (r, n, a / S1 * 100, b / S2 * 100, 100 * (b - a + sum(w['o1'] for w in sub if w['rola'] == r) * 5) / b if b else 0))

P('')
P('=== 3. Kontrola: ostatni wpis vs budget.spent() runu (result.tokeny w pliku workflows/<run>.json harnessu) ===')
zgodne = 0; razem = 0
for jf in glob.glob(os.path.join(ROOT, '*', '*', 'workflows', 'wf_*.json')):
    run = os.path.basename(jf)[:-5]
    if run not in per_run: continue
    try: w = json.load(open(jf))
    except Exception: continue
    r = w.get('result'); tk = r.get('tokeny') if isinstance(r, dict) else None
    if not tk or w.get('workflowName') != 'dev-autopilot-wf': continue
    m = re.match(r'([\d.,]+)\s*([kM]?)', str(tk))
    if not m: continue
    v = float(m.group(1).replace(',', '.')) * {'k': 1e3, 'M': 1e6, '': 1}[m.group(2)]
    o1, o2 = per_run[run]; razem += 1; zgodne += 0.85 <= o2 / v <= 1.15
    P('  %s tokeny=%-6s pierwszy %8d (%.2f)  ostatni %8d (%.2f)' % (run, tk, o1, o1 / v, o2, o2 / v))
P('Ostatni wpis w +-15%% od budget.spent(): %d/%d runow (pozostale 4: runy 08-27..09-07, oba wpisy ponizej budzetu — przyczyna NIESPRAWDZONA; w kazdym runie ostatni wpis blizej budzetu niz pierwszy)' % (zgodne, razem))
# === 4. Epizody skilli w sesji glownej (ta sama heurystyka co koszt_skilli.py; pierwszy vs ostatni wpis) ===
def tekst(content):
    if isinstance(content, str): return content
    if isinstance(content, list): return ' '.join(b.get('text', '') for b in content if isinstance(b, dict) and b.get('type') == 'text')
    return ''
def czy_tool_result(content):
    return isinstance(content, list) and any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in content)
epizody = []
for p in PROJS:
    for jf in glob.glob(os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + p, '*.jsonl')):
        cur = None
        for line in open(jf, errors='ignore'):
            try: o = json.loads(line)
            except Exception: continue
            t = o.get('type'); msg = o.get('message') or {}; c = msg.get('content')
            if t == 'user':
                if czy_tool_result(c) or o.get('isMeta'): continue
                if cur: epizody.append(cur); cur = None
                m = re.search(r'<command-name>/?([\w:-]+)</command-name>', tekst(c))
                if m: cur = dict(skill=m.group(1), ids=collections.OrderedDict())
            elif t == 'assistant':
                if not cur and isinstance(c, list):
                    for b in c:
                        if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('name') == 'Skill':
                            cur = dict(skill=str((b.get('input') or {}).get('skill', '?')), ids=collections.OrderedDict()); break
                if not cur: continue
                u = msg.get('usage'); mid = msg.get('id')
                if u and mid: cur['ids'].setdefault(mid, []).append(u)
        if cur: epizody.append(cur)
agg = collections.defaultdict(lambda: [0, 0.0, 0.0, 0, 0])
for e in epizody:
    if not e['ids']: continue
    base = sum(us[0].get('input_tokens', 0) * W_IN + us[0].get('cache_creation_input_tokens', 0) * W_CW + us[0].get('cache_read_input_tokens', 0) * W_CR for us in e['ids'].values())
    o1 = sum(us[0].get('output_tokens', 0) for us in e['ids'].values()); o2 = sum(us[-1].get('output_tokens', 0) for us in e['ids'].values())
    a = agg[e['skill']]; a[0] += 1; a[1] += base + o1 * W_OUT; a[2] += base + o2 * W_OUT; a[3] += o1; a[4] += o2
P('')
P('=== 4. Epizody skilli w sesji glownej (koszt_skilli.py bierze tez pierwszy wpis — sprawdzenie, czy to ma znaczenie w sesji glownej) ===')
P('%-22s %4s %12s %12s %8s %14s' % ('skill', 'ep.', 'koszt/ep e0', 'koszt/ep pop', 'zmiana', 'output/koszt'))
for k in ('dev-prep', 'dev-plan', 'dev-docs', 'dev-pr', 'dev-compound', 'dev-docs-complete', 'dev-brainstorm'):
    if k not in agg: continue
    n, k1, k2, o1, o2 = agg[k]
    P('%-22s %4d %11.0fk %11.0fk %+7.0f%% %6.0f%% -> %3.0f%%' % (k, n, k1 / n / 1e3, k2 / n / 1e3, 100 * (k2 - k1) / k1, 100 * o1 * W_OUT / k1, 100 * o2 * W_OUT / k2))
P('Wniosek sekcji 4: w transkryptach SESJI GLOWNEJ wpisy jednego id maja to samo usage — rozjazd dotyczy tylko transkryptow agentow workflowow; baseline skilli bez zmian.')
open(os.path.join(BASE, 'dane', 'd5r-koszt-output.txt'), 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))
