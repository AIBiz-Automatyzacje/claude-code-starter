#!/usr/bin/env python3
"""Mini-run, krok 0 (2026-09-23): jaki model dostaje agent workflowu przy roznych ustawieniach `model` w agent().
Czyta transkrypty runu wf_ab0244a1-f3e (model z message.model, ctx_start z pierwszego usage) i plik harnessu.
Wyjscie: dane/mr-krok0-model.txt"""
import glob, json, os
S = os.path.expanduser('~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template/86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f')
RUN = 'wf_ab0244a1-f3e'
out = ['Mini-run krok 0 — model agenta workflowu (run %s, sesja desktop Opus 5.5)' % RUN, '']
for jf in sorted(glob.glob(os.path.join(S, 'subagents', 'workflows', RUN, 'agent-*.jsonl'))):
    meta = json.load(open(jf[:-6] + '.meta.json'))
    modele, ctx, narz, entry, wer = set(), None, 0, None, None
    for line in open(jf):
        o = json.loads(line)
        entry = entry or o.get('entrypoint'); wer = wer or o.get('version')
        if o.get('type') == 'assistant':
            m = o['message']; modele.add(m.get('model'))
            u = m.get('usage') or {}
            if ctx is None: ctx = u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0)
            narz += sum(1 for b in m.get('content') or [] if b.get('type') == 'tool_use')
    out.append('%-28s model=%s ctx_start=%s narzedzia_uzyte=%d entrypoint=%s cc=%s' % (meta.get('description'), ','.join(sorted(modele)), ctx, narz, entry, wer))
w = json.load(open(os.path.join(S, 'workflows', RUN + '.json')))
out += ['', 'plik harnessu: status=%s defaultModel=%s agentCount=%s durationMs=%s totalTokens=%s timestamp=%s' % (
    w['status'], w.get('defaultModel'), w.get('agentCount'), w.get('durationMs'), w.get('totalTokens'), w.get('timestamp')),
    'obserwacja f1: w trakcie runu (16:38:41) katalog workflows/ mial tylko scripts/; plik harnessu powstal po TaskStop (16:41).',
    'uwaga: agent haiku potraktowal przekazana wiadomosc operatora jako zadanie (7 narzedzi, zapisal 2 pliki planu) — zatrzymany TaskStop.']
open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dane', 'mr-krok0-model.txt'), 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))
