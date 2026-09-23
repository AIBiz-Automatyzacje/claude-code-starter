#!/usr/bin/env python3
"""Mini-run: ocena markerow w kodzie builderow (serie D i A) + dotarcie R/S do kontekstu + narzedzia na migracjach + test Fishera D100 vs D400.
Czyta: dane/mr-markery.json, scratchpad/mr/wyniki/<run>/pliki, transkrypty runow (katalogi podane w RUNY). Wyjscie: dane/mr-markery-wynik.{txt,json}"""
import glob, json, os, re
from math import comb
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WYN = '/private/tmp/claude-501/-Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template/86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f/scratchpad/mr/wyniki'
PROJ = os.path.expanduser('~/.claude/projects/-private-tmp-claude-501--Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template-86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f-scratchpad-oferty-kopia')
M = json.load(open(os.path.join(BASE, 'dane', 'mr-markery.json')))

def transkrypty():
    """etykieta mr-d:/mr-a: -> sciezka transkryptu (wszystkie sesje projektu kopii)"""
    out = {}
    for mf in glob.glob(os.path.join(PROJ, '*', 'subagents', 'workflows', 'wf_*', 'agent-*.meta.json')):
        d = json.load(open(mf)).get('description') or ''
        if d.startswith(('mr-d:', 'mr-a:')): out[d.split(':', 1)[1]] = mf[:-10] + '.jsonl'
    return out

def niepuste(t): return [l for l in t.splitlines() if l.strip()]

def ocen(rid, mk, pliki):
    ts = {p: t for p, t in pliki.items() if p.endswith('.ts')}
    testy = {p: t for p, t in ts.items() if p.endswith('.test.ts')}
    moduly = {p: t for p, t in ts.items() if not p.endswith('.test.ts')}
    sql = {p: t for p, t in pliki.items() if p.endswith('.sql')}
    w = {}
    def zbior(tr):  # lista bool -> pelne/czesciowe/brak/nd
        if not tr: return 'nd'
        return 'pelne' if all(tr) else ('czesciowe' if any(tr) else 'brak')
    pierwsza = lambda t: (niepuste(t) or [''])[0].strip()
    ostatnia = lambda t: (niepuste(t) or [''])[-1].strip()
    w['M1'] = zbior([pierwsza(t) == '// ' + mk['M1'] for t in ts.values()])
    w['M2'] = zbior([pierwsza(t) == '-- ' + mk['M2'] for t in sql.values()])
    fun = []
    for t in moduly.values():
        for m in re.finditer(r'^export\s+(?:async\s+)?function\s+\w+|^export\s+const\s+\w+\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>', t, re.M):
            przed = t[:m.start()].rstrip()
            doc = przed[przed.rfind('/**'):] if przed.endswith('*/') else ''
            fun.append(('@mr ' + mk['M3']) in doc)
    w['M3'] = zbior(fun)
    nazwy = [n for t in testy.values() for n in re.findall(r'\b(?:it|test)(?:\.\w+)?\(\s*[\'"`](.*?)[\'"`]', t)]
    w['M4'] = zbior([n.startswith(mk['M4'] + ':') for n in nazwy])
    w['M5'] = 'pelne' if any(re.search(r'export\s+const\s+MR_ZNACZNIK\b[^=]*=\s*[\'"]%s[\'"]' % mk['M5'], t) for t in moduly.values()) else 'brak'
    if 'R' in mk:
        w['R'] = zbior([ostatnia(t) == '-- ' + mk['R'] for t in sql.values()])
        w['S'] = zbior([ostatnia(t) == '// ' + mk['S'] for t in testy.values()])
    gdziekolwiek = {k: any(v in t for t in pliki.values()) for k, v in mk.items()}
    return w, dict(pliki_ts=len(ts), testy=len(testy), sql=len(sql), funkcje_eksport=len(fun), nazwy_testow=len(nazwy)), gdziekolwiek

def z_transkryptu(jf, mk):
    """dotarcie R/S (ciag w tresci spoza wlasnych zapisow agenta), narzedzia na istniejacych migracjach, tury, model, koszt"""
    dotarlo = {k: False for k in ('R', 'S') if k in mk}; narz = []; ids = {}; model = None
    for l in open(jf):
        o = json.loads(l); t = o.get('type')
        if t == 'assistant':
            m = o['message']; model = model or m.get('model'); ids[m.get('id')] = m.get('usage') or {}
            for b in m.get('content') or []:
                if b.get('type') != 'tool_use': continue
                inp = b.get('input') or {}; s = json.dumps(inp, ensure_ascii=False)
                if 'supabase/migrations' in s and '20260923120000' not in s:
                    narz.append(b['name'] + (':' + inp.get('command', '')[:60] if b['name'] == 'Bash' else ''))
        else:
            s = json.dumps(o, ensure_ascii=False)
            for k in dotarlo:
                if mk[k] in s: dotarlo[k] = True
    koszt = sum(u.get('input_tokens', 0) + 1.25 * u.get('cache_creation_input_tokens', 0) + 0.1 * u.get('cache_read_input_tokens', 0) + 5 * u.get('output_tokens', 0) for u in ids.values())
    return dict(dotarlo=dotarlo, narzedzia_migracje=narz, wywolania=len(ids), koszt_jedn=round(koszt), model=model)

def fisher(a, n1, b, n2):  # P(X >= a) jednostronny
    K = a + b; N = n1 + n2
    return sum(comb(n1, x) * comb(n2, K - x) for x in range(a, min(n1, K) + 1)) / comb(N, K)

TR = transkrypty(); wyniki = {}; linie = []
for rid, r in sorted(M['runy'].items()):
    kat = os.path.join(WYN, rid, 'pliki')
    if not os.path.isdir(kat): continue
    pliki = {os.path.relpath(p, kat): open(p, encoding='utf-8').read() for p in glob.glob(kat + '/**/*', recursive=True) if os.path.isfile(p)}
    w, info, gdzie = ocen(rid, r['markery'], pliki)
    tr = z_transkryptu(TR[rid], r['markery']) if rid in TR else {}
    wyniki[rid] = dict(ocena=w, info=info, gdziekolwiek=gdzie, transkrypt=tr, pozycje=r.get('pozycje'))
    linie.append('%-7s %s | %s | ciag gdziekolwiek: %s | %s' % (rid, ' '.join('%s=%s' % kv for kv in w.items()), info, [k for k, v in gdzie.items() if v], tr))

sumy = []
for ram in ('D100', 'D400', 'A'):
    rs = [v for k, v in wyniki.items() if k.startswith(ram)]
    if not rs: continue
    obs = [v['ocena'][m] for v in rs for m in ('M1', 'M2', 'M3', 'M4', 'M5')]
    per_run = sorted(sum(v['ocena'][m] == 'pelne' for m in ('M1', 'M2', 'M3', 'M4', 'M5')) for v in rs)
    per_m = {m: sum(v['ocena'][m] == 'pelne' for v in rs) for m in ('M1', 'M2', 'M3', 'M4', 'M5')}
    sumy.append((ram, obs.count('pelne'), len(obs), per_run, per_m, obs.count('czesciowe')))
    linie.append('%s: pelne %d/%d (%.0f%%), czesciowe %d | markery pelne per run %s | per marker %s | koszt jedn. razem %d, wywolania %s' % (
        ram, obs.count('pelne'), len(obs), 100 * obs.count('pelne') / len(obs), obs.count('czesciowe'), per_run, per_m,
        sum(v['transkrypt'].get('koszt_jedn', 0) for v in rs), [v['transkrypt'].get('wywolania') for v in rs]))
s = {x[0]: x for x in sumy}
if 'D100' in s and 'D400' in s:
    a, n1 = s['D100'][1], s['D100'][2]; b, n2 = s['D400'][1], s['D400'][2]
    p = fisher(a, n1, b, n2); rozn = 100 * (a / n1 - b / n2)
    med = lambda x: x[len(x) // 2]
    linie.append('D100 vs D400: roznica %.0f pp, Fisher jednostronny p = %.3f, mediana markerow per run %d vs %d' % (rozn, p, med(s['D100'][3]), med(s['D400'][3])))
    kryt = 'DZWIGNIA' if (rozn >= 20 and p < 0.05 and med(s['D100'][3]) - med(s['D400'][3]) >= 1) else ('BRAK DZWIGNI' if rozn <= 8 else 'NIEJEDNOZNACZNE')
    linie.append('kryterium (d) z planu §7: ' + kryt)
open(os.path.join(BASE, 'dane', 'mr-markery-wynik.txt'), 'w').write('\n'.join(linie) + '\n')
json.dump(wyniki, open(os.path.join(BASE, 'dane', 'mr-markery-wynik.json'), 'w'), ensure_ascii=False, indent=1)
print('\n'.join(linie))
