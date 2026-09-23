#!/usr/bin/env python3
"""Mini-run: ustalenia poboczne z transkryptow sesji w kopii (bez agentow).
1. Seria A: skad R i S trafily do kontekstu buildera (zalacznik harnessu / wynik narzedzia / wstrzykniety skill), ktory marker S niosl
   wstrzykniety SKILL.md (bufor skilli sesji), git status w session_context, markery S w napisanych testach.
2. Serie E1/E2: agenci, ktorzy mimo polecenia „nie uzywaj narzedzi” wywolali narzedzia (przekazana wiadomosc operatora).
Wyjscie: dane/mr-dodatkowe.txt"""
import glob, json, os, re
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SES = os.path.expanduser('~/.claude/projects/-private-tmp-claude-501--Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template-'
                         '86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f-scratchpad-oferty-kopia/32225565-a320-43e1-b104-ee94a89cc80c/subagents/workflows')
WYN = os.path.join(BASE, 'dane', 'mr-surowe', 'wyniki')
M = json.load(open(os.path.join(BASE, 'dane', 'mr-markery.json')))['runy']
A = {'A-1': 'wf_05c98a00-54e', 'A-2': 'wf_3f022ded-be5', 'A-3': 'wf_28d5e2da-917'}
E = {'E1': 'wf_11b9703a-88c', 'E2': 'wf_05f587d0-a37'}
WSZYSTKIE_S = {r: M[r]['markery']['S'] for r in A}

def tekst(c):
    return c if isinstance(c, str) else ''.join(b.get('text', '') for b in c if isinstance(b, dict) and b.get('type') == 'text')

def seria_a(rid, run):
    jf = glob.glob(os.path.join(SES, run, 'agent-*.jsonl'))[0]; R = M[rid]['markery']['R']
    skille, r_zrodla, uses, status_git = [], [], {}, None
    for l in open(jf):
        o = json.loads(l); t = o.get('type'); a = o.get('attachment') or {}
        if t == 'attachment' and a.get('type') == 'session_context':
            s = json.dumps(a, ensure_ascii=False); status_git = 'mr-migracje.md' in s
        if t == 'attachment' and R in json.dumps(a, ensure_ascii=False) and a.get('type') != 'structured_output':
            r_zrodla.append('zalacznik:' + a.get('type', '?'))
        if t == 'assistant':
            for b in o['message'].get('content') or []:
                if b.get('type') == 'tool_use': uses[b['id']] = b
        if t == 'user':
            c = o['message']['content']; tx = tekst(c)
            m = re.search(r'<command-name>([\w-]+)</command-name>', tx)
            if m: skille.append((m.group(1), [k for k, v in WSZYSTKIE_S.items() if v in tx]))
            if isinstance(c, list):
                for b in c:
                    if b.get('type') == 'tool_result' and R in json.dumps(b, ensure_ascii=False):
                        u = uses.get(b['tool_use_id'], {}); cmd = (u.get('input') or {}).get('command', '')
                        r_zrodla.append('%s:%s' % (u.get('name'), 'cat .claude/rules/mr-migracje.md' if 'rules/mr-migracje.md' in cmd else cmd[:60]))
    test = ''.join(open(p).read() for p in glob.glob(os.path.join(WYN, rid, 'pliki', '**', '*.test.ts'), recursive=True))
    ostatnia = [l for l in test.splitlines() if l.strip()][-1].strip() if test.strip() else ''
    s_w_tescie = [k for k, v in WSZYSTKIE_S.items() if v in ostatnia]
    return ('%s  skille wstrzykniete (marker S ze SKILL.md z runu): %s | R dotarl przez: %s | git status w session_context pokazuje mr-migracje.md: %s | '
            'ostatnia linia testu = marker S z runu: %s' % (rid, skille, r_zrodla or ['brak'], status_git, s_w_tescie or ['brak']))

def narzedzia_e(seria, run):
    out = []
    for mf in sorted(glob.glob(os.path.join(SES, run, 'agent-*.meta.json'))):
        d = json.load(open(mf)).get('description'); n = []; model = None
        for l in open(mf[:-10] + '.jsonl'):
            o = json.loads(l)
            if o.get('type') == 'assistant':
                model = model or o['message'].get('model')
                n += [b['name'] + (':' + b['input'].get('command', '')[:70] if b['name'] == 'Bash' else '') for b in o['message'].get('content') or []
                      if b.get('type') == 'tool_use' and b['name'] != 'StructuredOutput']
        if n: out.append('%s %s %s: %s' % (seria, d, model, n))
    return out or ['%s: zaden agent nie uzyl narzedzi poza StructuredOutput' % seria]

L = ['=== 1. Seria A: dotarcie R i S, bufor skilli sesji ===']
L += [seria_a(r, w) for r, w in A.items()]
L.append('markery S per run: %s' % WSZYSTKIE_S)
L.append('\n=== 2. Serie E: narzedzia wywolane mimo „nie uzywaj narzedzi” (przekazana wiadomosc operatora) ===')
for s, w in E.items(): L += narzedzia_e(s, w)
L.append('\n=== 3. Koszt serii z sesji w kopii [M jedn.: input 1, cache write 1,25, cache read 0,1, output 5] i modele agentow ===')
for s, w in list(E.items()) + list(A.items()):
    koszt = 0.0; modele = {}
    for jf in glob.glob(os.path.join(SES, w, 'agent-*.jsonl')):
        ids = {}; model = None
        for l in open(jf):
            o = json.loads(l)
            if o.get('type') == 'assistant': model = model or o['message'].get('model'); ids[o['message'].get('id')] = o['message'].get('usage') or {}
        koszt += sum(u.get('input_tokens', 0) + 1.25 * u.get('cache_creation_input_tokens', 0) + 0.1 * u.get('cache_read_input_tokens', 0) + 5 * u.get('output_tokens', 0) for u in ids.values())
        modele[model] = modele.get(model, 0) + 1
    L.append('%-4s %s  %.2f M  modele %s' % (s, w, koszt / 1e6, modele))
open(os.path.join(BASE, 'dane', 'mr-dodatkowe.txt'), 'w').write('\n'.join(L) + '\n')
print('\n'.join(L))
