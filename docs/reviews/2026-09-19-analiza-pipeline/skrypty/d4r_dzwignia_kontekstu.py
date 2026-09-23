#!/usr/bin/env python3
"""Przeglad D4 (2026-09-23): przeliczenie dzwigni kontekstu startowego (ETAP3 §1.1: „25–35% kosztu fazy”) wprost z transkryptow.

ETAP3 §1.1 liczyl arytmetycznie: 62,0k (general-purpose w workspace-template) minus docelowy start per klasa → 86% z „30–40%”,
na koszcie etapu 0 (output zanizony, D5 popr. 6) i na epoce przed scieciem CLAUDE.md (D3). Tu liczymy to samo agent po agencie:

  oszczednosc agenta = Σ_skladnik Δ_skladnik [tok] × (waga 1. tury + Σ_kolejne tury 0,1, a 1,25 gdy prefiks zapisany od nowa)
  dzwignia = Σ oszczednosci / Σ kosztu (koszt z OSTATNIM wpisem usage per odpowiedz API — D5 popr. 6)

Skladniki (konfiguracja wg decyzji 6a pkt 15/17, ta sama co ETAP3 §1.1):
  T  allowlista tools: [Read, Bash, Edit, Write, StructuredOutput] — znikaja pozostale schematy w tablicy tools (prefiks), lista nazw
     narzedzi odroczonych (MCP), lista skilli i agentow (zalaczniki w 1. wiadomosci) — WSZYSCY agenci;
  O  omitClaudeMd — znikaja wszystkie pliki z zalacznika `instructions` (CLAUDE.md-y, rules, MEMORY.md) — TYLKO agenci mechaniczni
     z listy 6a pkt 15 (stan:zapis, telemetria, dedup, precheck, kontekst:diff) + ich odpowiedniki bez patrzenia na kod;
  L  learned-patterns poza ladowaniem eager, w zamian wycinek ~1,5k zn w prompcie — pozostali agenci.
  CLAUDE.md, coding-rules i `skills:` u builderow/reviewerow ZOSTAJA (6a pkt 15; ETAP3 tez je zostawil).

Tokeny ze znakow: stawki kalibrowane na pomiarze 1b (4 agentow sonnet-5, ta sama maszyna i konto, 2026-09-20; roznice miedzy
konfiguracjami = znane skladniki), potem jeden mnoznik per model dopasowany do ctx_start agentow oferty-online (tokenizery roznia sie).
Wyjscie: dane/d4r-dzwignia-kontekstu.{txt,json}. Czyta tylko ~/.claude/projects (odczyt)."""
import collections, glob, json, os, re, statistics

ROOT = os.path.expanduser('~/.claude/projects')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OFERTY = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-oferty-online')
WT = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template')
POMIAR1B = {'general': '9a6b396d-3668-44d9-b7f6-8a1a9b240996', 'allow': 'eef806cb-0643-4934-964c-c175edb1136f',
            'allow_omit': '06038ce3-2348-473b-9733-13c84dd3826c', 'bez_mcp': '6d0e485a-18b9-4af2-8b89-90d7216f870d'}
RUN_PO_SCIECIU = 'wf_e5c34cd8-66c'  # 2026-09-20, cookie-consent, CLAUDE.md 17,8k zn na galezi zadania (D5 popr. 7)
ZOSTAJA = {'Read', 'Bash', 'Edit', 'Write', 'StructuredOutput'}
WYCINEK_ZN = 1500
W_IN, W_CW, W_CR, W_OUT = 1.0, 1.25, 0.1, 5.0
OMIT = {'stan:zapis', 'telemetria', 'dedup:semantyczny', 'e2e:precheck', 'kontekst:diff',
        'zwin-do-poprawy', 'e2e:env-down', 'fix:pre-skan', 'stop:commit-artefaktow'}
SCEPT = {'verify', 'verify-batch', 'verify-fix'}
NAPR = {'fix', 'fix:poprawka'}


def rola(desc):
    """Jak koszt_agentow.py, ale z najdluzsza nazwa pierwsza (D5 porzadkowe: fix:kontrola/pre-skan/poprawka nie sklejaja sie w fix)."""
    d = desc or '?'
    d = re.sub(r'^(verify-batch|verify-fix|verify):.*$', r'\1', d)
    d = re.sub(r':faza-\d+$|:IU-\d+(\.\d+)?$|:\d+$', '', d)
    d = re.sub(r'^(fix:pre-skan|fix:kontrola|fix:poprawka|build|smoke-operatora|complete|compound|telemetria|stop|planner|domkniecie|'
               r'scribe|fix|zwin-do-poprawy|e2e:db-sync|kontekst:diff|stan:zapis):.*$', r'\1', d)
    return d


def klasa(r):
    if r in OMIT: return 'mechaniczny'
    if r in SCEPT: return 'sceptyk'
    if r.startswith('review:'): return 'reviewer'
    if r == 'build': return 'builder'
    if r in NAPR: return 'naprawiacz'
    if r in ('?', ''): return None
    return 'orkiestracyjny'


def sklad(jf):
    """Znaki skladnikow pierwszej tury + usage per odpowiedz API."""
    z = collections.Counter(); ids = collections.OrderedDict(); model = None; start = None; po_pierwszej = False; tools = None; sysp = 0
    for line in open(jf, errors='ignore'):
        try: o = json.loads(line)
        except Exception: continue
        t = o.get('type')
        if start is None and o.get('timestamp'): start = o['timestamp']
        if t == 'attachment':
            a = o.get('attachment') or {}; at = a.get('type')
            if at == 'prompt_snapshot':
                if a.get('tools') and tools is None: tools = a['tools']
                if a.get('systemPrompt') and not sysp: sysp = sum(len(x) if isinstance(x, str) else len(json.dumps(x, ensure_ascii=False)) for x in a['systemPrompt'])
                continue
            if po_pierwszej: continue
            if at == 'instructions':
                for f in a.get('files') or []:
                    n = len(f.get('content', '')); p = f.get('path', '')
                    z['instr'] += n
                    if p.endswith('learned-patterns.md'): z['learned'] += n
                    elif p.endswith('coding-rules.md'): z['coding'] += n
                    elif p.endswith('CLAUDE.md') and ('/oferty-online/' in p or '/workspace-template/' in p): z['claude_proj'] += n
            elif at == 'deferred_tools_delta': z['odroczone'] += len('\n'.join(a.get('addedLines') or []))
            elif at == 'skill_listing': z['skille'] += len(a.get('content') or '')
            elif at == 'agent_listing_delta': z['agenci'] += len(json.dumps(a, ensure_ascii=False))
            else: z['zal_inne'] += len(json.dumps(a, ensure_ascii=False))
        elif t == 'user' and not po_pierwszej:
            c = (o.get('message') or {}).get('content')
            z['prompt'] += len(c) if isinstance(c, str) else sum(len(b.get('text', '')) for b in c if isinstance(b, dict))
        elif t == 'assistant':
            m = o.get('message') or {}; u = m.get('usage')
            if not u: continue
            po_pierwszej = True; model = model or m.get('model')
            ids.setdefault(m.get('id'), []).append(u)
    if not ids or tools is None: return None
    z['sys'] = sysp
    z['tools_zostaja'] = sum(len(json.dumps(x, ensure_ascii=False)) for x in tools if x.get('name') in ZOSTAJA)
    z['tools_znikaja'] = sum(len(json.dumps(x, ensure_ascii=False)) for x in tools if x.get('name') not in ZOSTAJA)
    us = list(ids.values())
    ctx = [u[0].get('input_tokens', 0) + u[0].get('cache_creation_input_tokens', 0) + u[0].get('cache_read_input_tokens', 0) for u in us]
    cr = [u[0].get('cache_read_input_tokens', 0) for u in us]
    base = sum(u[0].get('input_tokens', 0) * W_IN + u[0].get('cache_creation_input_tokens', 0) * W_CW + u[0].get('cache_read_input_tokens', 0) * W_CR for u in us)
    return dict(start=start, model=model or '?', wywolania=len(us), ctx_start=ctx[0], cr_pierwsza=cr[0],
                przepisania=sum(1 for k in range(1, len(us)) if cr[k] < 0.5 * ctx[0]),
                koszt_pierwszy=base + W_OUT * sum(u[0].get('output_tokens', 0) for u in us),
                koszt=base + W_OUT * sum(u[-1].get('output_tokens', 0) for u in us), zn=dict(z))


def etykiety(run_dir):
    m = {}
    jp = os.path.join(run_dir, 'journal.jsonl')
    if os.path.exists(jp):
        for line in open(jp, errors='ignore'):
            try: o = json.loads(line)
            except Exception: continue
            if o.get('type') == 'started' and o.get('agentId') and o.get('label'): m[o['agentId']] = o['label']
    return m


def fazy_runu(run):
    """agentId -> 'Faza N' / 'run' z pliku harnessu (najblizsza wczesniejsza grupa „Faza N”; Bootstrap/Zakonczenie = run)."""
    for f in glob.glob(os.path.join(OFERTY, '*', 'workflows', run + '.json')):
        w = json.load(open(f)); cur = 'run'; out = {}
        for x in w.get('workflowProgress') or []:
            if x.get('type') == 'workflow_phase' and not x.get('kind'):
                cur = x['title'] if x['title'].startswith('Faza') else 'run'
            elif x.get('type') == 'workflow_agent':
                out[x['agentId']] = cur if not x.get('phaseTitle', '').startswith(('Bootstrap', 'Zakonczenie')) else 'run'
        return out
    return {}


# --- 1. kalibracja stawek (pomiar 1b, sonnet-5) ---
P = {}
for k, s in POMIAR1B.items():
    P[k] = sklad(glob.glob(os.path.join(WT, s, 'subagents', 'agent-*.jsonl'))[0])
g, b, a, o = (P[x] for x in ('general', 'bez_mcp', 'allow', 'allow_omit'))
zn = lambda r, k: r['zn'].get(k, 0)
r_t = r_def = 3.6; r_i = 2.0
for _ in range(50):  # uklad trzech roznic, rozwiazywany iteracyjnie; drobne skladniki (sys, zal_inne) po stawce r_t
    r_i = (zn(a, 'instr')) / (a['ctx_start'] - o['ctx_start'] - (zn(a, 'zal_inne') - zn(o, 'zal_inne')) / r_t)
    r_def = (zn(g, 'odroczone') - zn(b, 'odroczone')) / (g['ctx_start'] - b['ctx_start'] - (zn(g, 'sys') - zn(b, 'sys') + zn(g, 'zal_inne') - zn(b, 'zal_inne') + zn(g, 'agenci') - zn(b, 'agenci')) / r_t)
    r_t = (zn(b, 'tools_zostaja') + zn(b, 'tools_znikaja') - zn(a, 'tools_zostaja') - zn(a, 'tools_znikaja') + zn(b, 'skille') - zn(a, 'skille') + zn(b, 'agenci') - zn(a, 'agenci') + zn(b, 'sys') - zn(a, 'sys') + zn(b, 'zal_inne') - zn(a, 'zal_inne')) / \
          (b['ctx_start'] - a['ctx_start'] - (zn(b, 'odroczone') - zn(a, 'odroczone')) / r_def)


def tok_sonnet(r):
    z = r['zn']
    return ((z.get('tools_zostaja', 0) + z.get('tools_znikaja', 0) + z.get('skille', 0) + z.get('agenci', 0) + z.get('sys', 0) + z.get('zal_inne', 0)) / r_t
            + z.get('odroczone', 0) / r_def + (z.get('instr', 0) + z.get('prompt', 0)) / r_i)


# --- 2. agenci oferty-online z zalacznikiem instructions (od ~09-06) ---
rows = []
for mf in glob.glob(os.path.join(OFERTY, '*', 'subagents', 'workflows', 'wf_*', 'agent-*.meta.json')):
    jf = mf[:-10] + '.jsonl'
    if not os.path.exists(jf): continue
    run_dir = os.path.dirname(mf); run = os.path.basename(run_dir); aid = os.path.basename(jf)[6:-6]
    r = sklad(jf)
    if not r or not r['zn'].get('instr'): continue
    meta = json.load(open(mf))
    desc = meta.get('description') or etykiety(run_dir).get(aid, '')
    r.update(run=run, agent=aid, rola=rola(desc)); r['klasa'] = klasa(r['rola'])
    if not r['klasa']: continue
    r['model_k'] = 'haiku' if 'haiku' in r['model'] else 'opus' if 'opus' in r['model'] else 'sonnet' if 'sonnet' in r['model'] else r['model']
    r['pred_sonnet'] = tok_sonnet(r)
    rows.append(r)

# mnoznik per model: mediana ctx_start / przewidywanie sonnet
mn = {}
for m in sorted(set(r['model_k'] for r in rows)):
    xs = sorted(r['ctx_start'] / r['pred_sonnet'] for r in rows if r['model_k'] == m)
    mn[m] = dict(s=statistics.median(xs), n=len(xs), p10=xs[len(xs) // 10], p90=xs[len(xs) * 9 // 10])


def wagi(r):
    """(waga prefiksu tablicy tools, waga tresci 1. wiadomosci): 1. tura + kolejne wywolania (0,1; 1,25 gdy prefiks zapisany od nowa)."""
    n = r['wywolania']; p = r['przepisania']
    kolejne = (n - 1 - p) * W_CR + p * W_CW
    return (W_CR if r['cr_pierwsza'] > 0 else W_CW) + kolejne, W_CW + kolejne


def oszczednosc(r, skladniki=('T', 'O', 'L'), skala_stawek=1.0):
    s = mn[r['model_k']]['s'] / skala_stawek; z = r['zn']
    prefiks = 0.0; wiad = 0.0
    if 'T' in skladniki:
        prefiks += z.get('tools_znikaja', 0) / r_t * s
        wiad += (z.get('odroczone', 0) / r_def + (z.get('skille', 0) + z.get('agenci', 0)) / r_t) * s
    if 'O' in skladniki and r['klasa'] == 'mechaniczny':
        wiad += z.get('instr', 0) / r_i * s
    if 'L' in skladniki and r['klasa'] != 'mechaniczny':
        wiad += max(0, z.get('learned', 0) - WYCINEK_ZN) / r_i * s
    if 'C' in skladniki and r['klasa'] != 'mechaniczny':  # wariant: coding-rules do warstwy referencyjnej (6a pkt 18 po D2), wycinek jak L
        wiad += max(0, z.get('coding', 0) - WYCINEK_ZN) / r_i * s
    wp, ww = wagi(r)
    return prefiks * wp + wiad * ww, prefiks + wiad


def dzwignia(grp, claude_zn=None, **kw):
    """claude_zn: kontrfakt — CLAUDE.md projektu przyciety do claude_zn znakow (koszt i oszczednosc O przeliczone tymi samymi wagami)."""
    k = 0.0; o = 0.0
    for r in grp:
        kr = r['koszt']; orr = oszczednosc(r, **kw)[0]
        if claude_zn is not None:
            ubytek = max(0, r['zn'].get('claude_proj', 0) - claude_zn) / r_i * mn[r['model_k']]['s'] * wagi(r)[1]
            kr -= ubytek
            if r['klasa'] == 'mechaniczny' and 'O' in kw.get('skladniki', ('T', 'O', 'L')): orr -= ubytek
        k += kr; o += orr
    return 100 * o / k if k else 0


out = []; Q = out.append; J = {}
Q('D4r — dzwignia kontekstu startowego przeliczona agent po agencie (przeglad D4, 2026-09-23)')
Q('Konfiguracja wg 6a pkt 15/17 (jak ETAP3 §1.1): T = allowlista tools: u wszystkich; O = omitClaudeMd u mechanicznych; L = learned-patterns poza eager')
Q('(wycinek %d zn w zamian) u pozostalych; CLAUDE.md, coding-rules, skills: zostaja. Roster bez zmian (agenci znikajacy = dzwignia rosteru, osobno).' % WYCINEK_ZN)
Q('')
Q('=== 1. Kalibracja: znaki -> tokeny (pomiar 1b, sonnet-5; roznice miedzy 4 konfiguracjami) ===')
for k in ('general', 'bez_mcp', 'allow', 'allow_omit'):
    Q('  %-10s ctx_start %6d | przewidziane %6.0f' % (k, P[k]['ctx_start'], tok_sonnet(P[k])))
Q('  stawki: schematy narzedzi/lista skilli/agentow %.2f zn/tok | nazwy narzedzi odroczonych (MCP, UUID) %.2f zn/tok | instrukcje i prompt (PL) %.2f zn/tok' % (r_t, r_def, r_i))
Q('  (ETAP3 §1.1 przyjmowal CLAUDE.md 20,6k zn ~6k tok = 3,4 zn/tok, coding-rules ~3k tok = 3,7 zn/tok — tekst polski kosztuje ~1,7x wiecej tokenow)')
Q('  mnoznik per model (ctx_start / przewidywanie sonnet, agenci oferty-online z zalacznikiem):')
for m, v in mn.items():
    Q('    %-7s n=%4d  mediana %.3f  (p10 %.3f, p90 %.3f)' % (m, v['n'], v['s'], v['p10'], v['p90']))
J['kalibracja'] = dict(r_t=r_t, r_def=r_def, r_i=r_i, mnoznik=mn)

po = [r for r in rows if r['run'] == RUN_PO_SCIECIU]
przed = [r for r in rows if '2026-09-08' <= r['start'][:10] <= '2026-09-17' and r['run'] != RUN_PO_SCIECIU]
EPOKI = [('przed scieciem CLAUDE.md (oferty-online 09-08..09-17)', przed), ('po scieciu: run 20.09 %s' % RUN_PO_SCIECIU, po)]
Q('')
Q('=== 2. Dzwignia per epoka (%% kosztu; koszt z ostatnim wpisem usage, w nawiasie z pierwszym = etap 0) ===')
J['epoki'] = {}
for nazwa, grp in EPOKI:
    k_last = sum(r['koszt'] for r in grp); k_first = sum(r['koszt_pierwszy'] for r in grp)
    osz = sum(oszczednosc(r)[0] for r in grp)
    cl = statistics.median(r['zn'].get('claude_proj', 0) for r in grp); lp = statistics.median(r['zn'].get('learned', 0) for r in grp)
    Q('%s: %d agentow, %d runow, koszt %.1f M jedn.; CLAUDE.md p50 %d zn, learned-patterns p50 %d zn' % (nazwa, len(grp), len(set(r['run'] for r in grp)), k_last / 1e6, cl, lp))
    Q('  RAZEM %.1f%% (%.1f%% na koszcie etapu 0) | T allowlista %.1f%% | O omitClaudeMd %.1f%% | L learned-patterns %.1f%%' % (
        100 * osz / k_last, 100 * osz / k_first, dzwignia(grp, skladniki=('T',)), dzwignia(grp, skladniki=('O',)), dzwignia(grp, skladniki=('L',))))
    Q('  wrazliwosc na stawki zn/tok +-15%%: %.1f%% .. %.1f%%' % (dzwignia(grp, skala_stawek=1.15), dzwignia(grp, skala_stawek=0.85)))
    Q('  wariant + C (coding-rules do warstwy referencyjnej, 6a pkt 18 po D2): %.1f%%' % dzwignia(grp, skladniki=('T', 'O', 'L', 'C')))
    Q('  kontrfakt: te same agenty z CLAUDE.md przycietym do 17 810 zn (stan runu 20.09): %.1f%%' % dzwignia(grp, claude_zn=17810))
    duze = collections.defaultdict(list)
    for r in grp: duze[r['run']].append(r)
    duze = {k: v for k, v in duze.items() if len(v) >= 20}
    if len(duze) > 1:
        Q('  runy >= 20 agentow: ' + ', '.join('%s %s n=%d %.1f%% (wywolania/agent %.0f)' % (k, min(r['start'] for r in v)[5:10], len(v), dzwignia(v), sum(r['wywolania'] for r in v) / len(v)) for k, v in sorted(duze.items(), key=lambda x: min(r['start'] for r in x[1]))))
    Q('  wywolania/agent %.1f; udzial „start x wywolania” w koszcie %.1f%%' % (sum(r['wywolania'] for r in grp) / len(grp),
        100 * sum(r['ctx_start'] * ((W_CR if r['cr_pierwsza'] > 0 else W_CW) + W_CR * (r['wywolania'] - 1)) for r in grp) / k_last))
    e = J['epoki'][nazwa] = dict(agenci=len(grp), koszt_M=k_last / 1e6, razem=100 * osz / k_last, razem_etap0=100 * osz / k_first,
                                  T=dzwignia(grp, skladniki=('T',)), O=dzwignia(grp, skladniki=('O',)), L=dzwignia(grp, skladniki=('L',)),
                                  wariant_C=dzwignia(grp, skladniki=('T', 'O', 'L', 'C')), kontrfakt_claude_17810=dzwignia(grp, claude_zn=17810),
                                  stawki_pm15=[dzwignia(grp, skala_stawek=1.15), dzwignia(grp, skala_stawek=0.85)])
    Q('  per klasa: udzial w koszcie | dzwignia w klasie | Δ startu p50 [k tok] | start dzis p50 -> po zmianie p50 [k tok] (per model)')
    for kl in ('mechaniczny', 'orkiestracyjny', 'reviewer', 'sceptyk', 'naprawiacz', 'builder'):
        kg = [r for r in grp if r['klasa'] == kl]
        if not kg: continue
        for m in sorted(set(r['model_k'] for r in kg)):
            mg = [r for r in kg if r['model_k'] == m]
            d = [oszczednosc(r)[1] for r in mg]
            Q('    %-15s %-6s n=%3d  %5.1f%% | %5.1f%% | %5.1fk | %5.1fk -> %5.1fk' % (
                kl, m, len(mg), 100 * sum(r['koszt'] for r in mg) / k_last, dzwignia(mg), statistics.median(d) / 1e3,
                statistics.median(r['ctx_start'] for r in mg) / 1e3, statistics.median(r['ctx_start'] - x for r, x in zip(mg, d)) / 1e3))
    if grp is po:
        fz = fazy_runu(RUN_PO_SCIECIU)
        Q('  per faza (agenci poziomu runu — bootstrap, zakonczenie — osobno):')
        for f in sorted(set(fz.get(r['agent'], 'run') for r in grp)):
            fg = [r for r in grp if fz.get(r['agent'], 'run') == f]
            Q('    %-8s n=%3d koszt %5.1f M  dzwignia %.1f%%' % (f, len(fg), sum(r['koszt'] for r in fg) / 1e6, dzwignia(fg)))
    Q('  przepisania prefiksu w trakcie agenta (cache_read < 50%% startu): %d z %d wywolan; pierwsza tura czyta prefiks z cache u %d/%d agentow' % (
        sum(r['przepisania'] for r in grp), sum(r['wywolania'] for r in grp), sum(1 for r in grp if r['cr_pierwsza'] > 0), len(grp)))
    Q('')

Q('=== 3. Kontrola metody ETAP3 §1.1 na tych samych danych ===')
for nazwa, grp in EPOKI:
    st = [oszczednosc(r)[1] for r in grp]
    Q('%s: sredni Δ startu %.1fk tok/agent (ETAP3: 49k), start dzis sredni %.1fk (ETAP3 zakladal 62k), udzial samej 1. tury w oszczednosci %.0f%%' % (
        nazwa[:40], statistics.mean(st) / 1e3, statistics.mean(r['ctx_start'] for r in grp) / 1e3,
        100 * sum(d * W_CW for d in st) / sum(oszczednosc(r)[0] for r in grp)))
Q('')
Q('=== 4. Sklad kontekstu 1. tury (p50 tokenow per skladnik; stawki z §1 x mnoznik modelu) — do HANDOFF §3 pkt 2 („107k = system 44k + CLAUDE.md+rules 33k + MCP 27k + skille 10k”) ===')
SKL = [('schematy narzedzi (tablica tools)', lambda z: (z.get('tools_zostaja', 0) + z.get('tools_znikaja', 0)) / r_t), ('nazwy narzedzi odroczonych (MCP)', lambda z: z.get('odroczone', 0) / r_def),
       ('lista skilli + agentow', lambda z: (z.get('skille', 0) + z.get('agenci', 0)) / r_t), ('CLAUDE.md projektu', lambda z: z.get('claude_proj', 0) / r_i),
       ('learned-patterns', lambda z: z.get('learned', 0) / r_i), ('coding-rules', lambda z: z.get('coding', 0) / r_i),
       ('pozostale instrukcje (CLAUDE.md nadrzedne, MEMORY)', lambda z: (z.get('instr', 0) - z.get('claude_proj', 0) - z.get('learned', 0) - z.get('coding', 0)) / r_i),
       ('prompt zadania', lambda z: z.get('prompt', 0) / r_i), ('system + inne zalaczniki', lambda z: (z.get('sys', 0) + z.get('zal_inne', 0)) / r_t)]
for nazwa, grp in EPOKI:
    for m in ('opus', 'haiku'):
        mg = [r for r in grp if r['model_k'] == m]
        if not mg: continue
        Q('%s | %s n=%d | ctx_start p50 %.1fk: ' % (nazwa[:30], m, len(mg), statistics.median(r['ctx_start'] for r in mg) / 1e3) +
          ', '.join('%s %.1fk' % (n, statistics.median(f(r['zn']) * mn[m]['s'] for r in mg) / 1e3) for n, f in SKL))
Q('')
Q('=== 5. Kontrole i liczby pomocnicze (cytowane w PROPOZYCJA §D4) ===')
op = [r for r in rows if r['model_k'] == 'opus']
x = sorted(abs(r['ctx_start'] / r['pred_sonnet'] / mn['opus']['s'] - 1) for r in op)
Q('dokladnosc modelu: u 80%% agentow opusa |ctx_start / przewidywanie - 1| <= %.1f%%; CLAUDE.md projektu u opusa %d..%d zn' % (
    100 * x[int(len(x) * 0.8)], min(r['zn'].get('claude_proj', 0) for r in op), max(r['zn'].get('claude_proj', 0) for r in op)))
wsz = [r for _, grp in EPOKI for r in grp]
Q('tablica tools (wszystkie schematy) %d..%d zn; nazwy narzedzi odroczonych %d..%d zn (pomiar 1b CLI: %d i %d zn)' % (
    min(r['zn'].get('tools_zostaja', 0) + r['zn'].get('tools_znikaja', 0) for r in wsz), max(r['zn'].get('tools_zostaja', 0) + r['zn'].get('tools_znikaja', 0) for r in wsz),
    min(r['zn'].get('odroczone', 0) for r in wsz), max(r['zn'].get('odroczone', 0) for r in wsz), zn(g, 'tools_zostaja') + zn(g, 'tools_znikaja'), zn(g, 'odroczone')))
for nazwa, grp in EPOKI:
    for m in ('opus', 'haiku'):
        T = sorted(oszczednosc(r, skladniki=('T',))[1] for r in grp if r['model_k'] == m)
        if T: Q('%s | %s: sama allowlista zdejmuje ze startu p10 %.1fk / p50 %.1fk / p90 %.1fk tok' % (nazwa[:30], m, T[len(T) // 10] / 1e3, T[len(T) // 2] / 1e3, T[len(T) * 9 // 10] / 1e3))
    for opis, f in (('stan:zapis', lambda r: r['rola'] == 'stan:zapis'), ('sceptyk', lambda r: r['klasa'] == 'sceptyk'), ('mechaniczny', lambda r: r['klasa'] == 'mechaniczny'), ('reviewer', lambda r: r['klasa'] == 'reviewer')):
        kg = [r for r in grp if f(r)]
        if kg: Q('%s | %s: sredni koszt agenta %.0fk -> po zmianie %.0fk jedn. (zostaje %.0f%%)' % (nazwa[:30], opis, statistics.mean(r['koszt'] for r in kg) / 1e3,
                 statistics.mean(r['koszt'] - oszczednosc(r)[0] for r in kg) / 1e3, 100 * sum(r['koszt'] - oszczednosc(r)[0] for r in kg) / sum(r['koszt'] for r in kg)))
Q('kontrola niezalezna stawki dla instrukcji: r_i, przy ktorym iloraz ctx_start / przewidywanie ma najmniejszy rozrzut na agentach oferty-online')
Q('(CLAUDE.md 18–87k zn — zla stawka dalaby iloraz rosnacy albo malejacy z rozmiarem instrukcji); pomiar 1b dal %.2f zn/tok:' % r_i)
for m in ('opus', 'haiku'):
    mg = [r for r in rows if r['model_k'] == m]; naj = None
    for k in range(150, 261, 5):
        ri = k / 100
        ys = [r['ctx_start'] / (r['pred_sonnet'] - (r['zn'].get('instr', 0) + r['zn'].get('prompt', 0)) * (1 / r_i - 1 / ri)) for r in mg]
        sd = statistics.pstdev(ys) / statistics.mean(ys)
        if naj is None or sd < naj[1]: naj = (ri, sd)
    Q('  %-6s n=%d: najmniejszy rozrzut przy %.2f zn/tok (%.2f%%)' % (m, len(mg), naj[0], 100 * naj[1]))
Q('')
Q('Wniosek metody: ETAP3 mnozyl „30–40%” (HANDOFF §5 hip. 1, bez wyliczenia) przez 49/57; tu liczba wychodzi wprost z Δ × wywolania.')
open(os.path.join(BASE, 'dane', 'd4r-dzwignia-kontekstu.txt'), 'w').write('\n'.join(out) + '\n')
json.dump(J, open(os.path.join(BASE, 'dane', 'd4r-dzwignia-kontekstu.json'), 'w'), ensure_ascii=False, indent=1)
print('\n'.join(out))
