#!/usr/bin/env python3
"""Podglad runu mini-runu: etykieta, model, cwd, ctx_start, liczba narzedzi w tablicy tools, pliki instrukcji. Uzycie: mr_szybki_podglad.py <katalog runu>"""
import glob, json, os, sys
for mf in sorted(glob.glob(os.path.join(sys.argv[1], 'agent-*.meta.json'))):
    meta = json.load(open(mf)); jf = mf[:-10] + '.jsonl'
    cwd = model = ctx = None; ntools = None; instr = []; tury = 0; narz = 0
    for l in open(jf):
        o = json.loads(l); cwd = cwd or o.get('cwd')
        if o.get('type') == 'attachment':
            a = o.get('attachment') or {}
            if a.get('type') == 'prompt_snapshot' and a.get('tools') and ntools is None: ntools = len(a['tools'])
            if a.get('type') == 'instructions' and not instr: instr = ['%s (%d zn)' % (f['path'].replace(os.path.expanduser('~'), '~'), len(f.get('content', ''))) for f in a.get('files') or []]
        if o.get('type') == 'assistant':
            m = o['message']; model = model or m.get('model'); u = m.get('usage') or {}
            if ctx is None: ctx = u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0)
            narz += sum(1 for b in m.get('content') or [] if b.get('type') == 'tool_use')
    print('%-34s %-26s ctx=%6s tools=%s narz=%d cwd=...%s instr=%s' % (meta.get('description'), model, ctx, ntools, narz, (cwd or '')[-30:], instr))
