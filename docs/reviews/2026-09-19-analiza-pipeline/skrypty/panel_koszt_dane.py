#!/usr/bin/env python3
"""Panel decyzyjny, krok 0 (c) — dane referencyjne dla skryptu kosztu projektu (PANEL-PLAN §3).

Czyta transkrypty i journale runow oferty-online od 2026-09-06 (tylko odczyt ~/.claude/projects) i zapisuje:
  dane/panel-koszt-referencja.json — agenci (rola, klasa, model, koszt, wywolania, start, sklad startu w znakach, faza)
                                      + fakty faz (warunki z mapy zmian packagera, IU, findingi, grupy sceptykow).
Koszt agenta = metoda d4r: ostatni wpis usage na odpowiedz API, cennik wzgledny in 1 / cache write 1,25 / cache read 0,1 / out 5.
Rola: jak rola() z d4r, ale z poprawka — `fix:pre-skan:faza-1` itd. nie zlewaja sie w `fix` (d4r mial ten blad: jego „naprawiacz haiku”
to fix:pre-skan). Etykieta: meta.description -> journal label -> rola z dane/agents.csv (klasyfikacja po poczatku promptu).
Faza agenta: plik harnessu `<sesja>/workflows/<run>.json` (najblizsza wczesniejsza grupa „Faza N”), jak fazy_runu() w d4r.
Warunki fazy: wynik packagera (`kontekst:diff`) — lista plikow diffu fazy, flagi warstw, liczba checkboxow [E2E];
regex plikow kodu = ten sam co w dev-docs-review-wf.js:851."""
import collections, csv, glob, json, os, re

ROOT = os.path.expanduser('~/.claude/projects')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OFERTY = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-oferty-online')
OD = '2026-09-06'
W_IN, W_CW, W_CR, W_OUT = 1.0, 1.25, 0.1, 5.0
ZOSTAJA = {'Read', 'Bash', 'Edit', 'Write', 'StructuredOutput'}
RE_KOD = re.compile(r'\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|go|rs|sh|sql)$', re.I)
RE_TEST = re.compile(r'(\.test\.|\.spec\.|/tests?/|__tests__)')
RE_UI = re.compile(r'\.(tsx|jsx|css|html)$', re.I)
PRZYROSTKI = ('fix:pre-skan', 'fix:kontrola', 'fix:poprawka', 'build', 'smoke-operatora', 'complete', 'compound-refresh', 'compound',
              'telemetria', 'stop', 'planner', 'domkniecie', 'scribe', 'fix', 'zwin-do-poprawy', 'e2e:db-sync', 'kontekst:diff', 'stan:zapis')
MECH = {'stan:zapis', 'telemetria', 'dedup:semantyczny', 'e2e:precheck', 'kontekst:diff', 'zwin-do-poprawy', 'e2e:env-down',
        'fix:pre-skan', 'stop:commit-artefaktow'}
SCEPT = {'verify', 'verify-batch', 'verify-fix'}
NAPR = {'fix', 'fix:poprawka'}


def rola(desc):
    d = desc or '?'
    d = re.sub(r'^(verify-batch|verify-fix|verify):.*$', r'\1', d)
    d = re.sub(r':faza-\d+$|:IU-\d+(\.\d+)?$|:\d+$', '', d)
    for p in PRZYROSTKI:
        if d == p or d.startswith(p + ':'):
            return p
    return d


def klasa(r):
    if r in MECH: return 'mechaniczny'
    if r in SCEPT: return 'sceptyk'
    if r == 'review:e2e': return 'tester'
    if r.startswith('review:'): return 'reviewer'
    if r == 'build': return 'builder'
    if r in NAPR: return 'naprawiacz'
    if r in ('?', '') or r.startswith('pr:'): return None
    return 'orkiestracyjny'


def sklad(jf):
    """Znaki skladnikow pierwszej tury + usage per odpowiedz API (ta sama metoda co d4r sklad())."""
    z = collections.Counter(); ids = collections.OrderedDict(); model = None; start = None; po = False; tools = None
    for line in open(jf, errors='ignore'):
        try: o = json.loads(line)
        except ValueError: continue
        t = o.get('type')
        if start is None and o.get('timestamp'): start = o['timestamp']
        if t == 'attachment':
            a = o.get('attachment') or {}; at = a.get('type')
            if at == 'prompt_snapshot':
                if a.get('tools') and tools is None: tools = a['tools']
                continue
            if po: continue
            if at == 'instructions':
                for f in a.get('files') or []:
                    n = len(f.get('content', '')); p = f.get('path', '')
                    z['instr'] += n
                    if p.endswith('learned-patterns.md'): z['learned'] += n
                    elif p.endswith('CLAUDE.md') and '/oferty-online/' in p: z['claude_proj'] += n
        elif t == 'assistant':
            m = o.get('message') or {}; u = m.get('usage')
            if not u: continue
            po = True; model = model or m.get('model')
            ids.setdefault(m.get('id'), []).append(u)
    if not ids: return None
    # starsze transkrypty (do ~09-07) nie maja prompt_snapshot — koszt liczymy, skladu startu nie
    z['tools_znikaja'] = None if tools is None else sum(len(json.dumps(x, ensure_ascii=False)) for x in tools if x.get('name') not in ZOSTAJA)
    us = list(ids.values())
    ctx = [u[0].get('input_tokens', 0) + u[0].get('cache_creation_input_tokens', 0) + u[0].get('cache_read_input_tokens', 0) for u in us]
    cr = [u[0].get('cache_read_input_tokens', 0) for u in us]
    koszt = sum(u[0].get('input_tokens', 0) * W_IN + u[0].get('cache_creation_input_tokens', 0) * W_CW
                + u[0].get('cache_read_input_tokens', 0) * W_CR + u[-1].get('output_tokens', 0) * W_OUT for u in us)
    return dict(start=start, model=model or '?', wywolania=len(us), ctx_start=ctx[0], cr_pierwsza=cr[0],
                przepisania=sum(1 for k in range(1, len(us)) if cr[k] < 0.5 * ctx[0]), koszt=koszt, zn=dict(z))


def journal(run_dir):
    lab, wyn = {}, {}
    jp = os.path.join(run_dir, 'journal.jsonl')
    if not os.path.exists(jp): return lab, wyn
    for line in open(jp, errors='ignore'):
        try: o = json.loads(line)
        except ValueError: continue
        if o.get('type') == 'started' and o.get('agentId'): lab[o['agentId']] = o.get('label') or ''
        elif o.get('type') == 'result' and o.get('agentId'): wyn[o['agentId']] = o.get('result')
    return lab, wyn


def harness(run):
    """agentId -> 'Faza N' / 'run' oraz kolejnosc agentow z pliku harnessu."""
    for f in glob.glob(os.path.join(OFERTY, '*', 'workflows', run + '.json')):
        w = json.load(open(f)); cur = 'run'; out = {}
        for x in w.get('workflowProgress') or []:
            if x.get('type') == 'workflow_phase' and not x.get('kind'):
                cur = x['title'] if x['title'].startswith('Faza') else 'run'
            elif x.get('type') == 'workflow_agent':
                out[x['agentId']] = cur if not x.get('phaseTitle', '').startswith(('Bootstrap', 'Zakonczenie')) else 'run'
        return out
    return None


def fakty_fazy(agenci, wyn):
    """Warunki i liczniki jednej fazy z wynikow jej agentow."""
    f = dict(pliki=[], e2e_checkboxy=None, warstwy=None, iu=0, findingi=0, grupy_sceptykow=0, zadanie_e2e=None)
    for a in agenci:
        r = wyn.get(a['agent'])
        if a['rola'] == 'build': f['iu'] += 1
        if a['rola'] in ('verify', 'verify-batch'): f['grupy_sceptykow'] += 1
        if not isinstance(r, dict): continue
        if a['rola'] == 'kontekst:diff' or ('diffStat' in r and 'pliki' in r):
            f['pliki'] = [p.get('plik') if isinstance(p, dict) else p for p in r.get('pliki') or []]
            f['e2e_checkboxy'] = r.get('e2eCheckboxy'); f['warstwy'] = r.get('warstwy')
        if a['klasa'] in ('reviewer', 'tester') and isinstance(r.get('findings'), list):
            f['findingi'] += len(r['findings'])
    kod = [p for p in f['pliki'] if p and RE_KOD.search(p)]
    f.update(pliki_n=len(f['pliki']), pliki_kodu=len(kod),
             faza_z_kodem=len(kod) > 0, faza_z_testami=any(RE_TEST.search(p or '') for p in f['pliki']),
             faza_z_ui=any(RE_UI.search(p or '') for p in f['pliki']),
             faza_z_migracja=any('supabase/migrations/' in (p or '') for p in f['pliki']),
             faza_z_e2e=bool(f['e2e_checkboxy']))
    del f['pliki']
    return f


def main():
    csv_rola = {}
    p = os.path.join(BASE, 'dane', 'agents.csv')
    for x in csv.DictReader(open(p)):
        if x['projekt'] == 'oferty-online': csv_rola[x['agent']] = x['opis'] or x['rola']
    agenci, fazy, bez_harnessu = [], [], []
    for run_dir in sorted(glob.glob(os.path.join(OFERTY, '*', 'subagents', 'workflows', 'wf_*'))):
        run = os.path.basename(run_dir); lab, wyn = journal(run_dir); fz = None; ra = []
        for jf in glob.glob(os.path.join(run_dir, 'agent-*.jsonl')):
            aid = os.path.basename(jf)[6:-6]; r = sklad(jf)
            if not r or r['start'][:10] < OD: continue
            mf = jf[:-6] + '.meta.json'
            meta = json.load(open(mf)) if os.path.exists(mf) else {}
            desc = meta.get('description') or lab.get(aid) or csv_rola.get(aid, '')
            r.update(run=run, agent=aid, etykieta=desc, rola=rola(desc), agentType=meta.get('agentType', ''))
            r['klasa'] = klasa(r['rola'])
            if not r['klasa']: continue
            if fz is None: fz = harness(run)
            if fz is None: bez_harnessu.append(run); fz = {}
            r['faza'] = fz.get(aid, 'run')
            ra.append(r)
        agenci += ra
        zad = next((w.get('nazwaZadania') for w in wyn.values() if isinstance(w, dict) and w.get('nazwaZadania')), None)
        for fn in sorted({a['faza'] for a in ra if a['faza'] != 'run'}):
            fa = [a for a in ra if a['faza'] == fn]
            if not any(a['rola'] == 'kontekst:diff' for a in fa): continue
            f = fakty_fazy(fa, wyn); f.update(run=run, faza=fn, zadanie=zad, start=min(a['start'] for a in fa),
                                              koszt=sum(a['koszt'] for a in fa), agentow=len(fa))
            fazy.append(f)
    json.dump(dict(od=OD, agenci=agenci, fazy=fazy, bez_harnessu=sorted(set(bez_harnessu))),
              open(os.path.join(BASE, 'dane', 'panel-koszt-referencja.json'), 'w'), ensure_ascii=False, indent=0)
    print('agentow %d, runow %d, faz z packagerem %d, runy bez pliku harnessu %d' % (
        len(agenci), len({a['run'] for a in agenci}), len(fazy), len(set(bez_harnessu))))


if __name__ == '__main__':
    main()
