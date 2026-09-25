#!/usr/bin/env python3
"""Panel decyzyjny — kontrola runow po kazdym runie (PANEL-PLAN §8, §10): model z transkryptu, narzedzia zapisu (N1), koszt.

Uzycie: python3 skrypty/panel_modele.py <run_id> [<run_id> ...]  (runy workflowu tej sesji albo dowolnej sesji workspace-template)
Czyta ~/.claude/projects/<slug workspace-template>/*/subagents/workflows/<run>/agent-*.jsonl (+ journal.jsonl dla etykiet).
Dla kazdego agenta: modele z `message.model` (kazda odpowiedz API), koszt metoda d4r (ostatni usage na odpowiedz, cennik wzgledny),
wywolania narzedzi; STOP-y z §10: model != claude-opus-5-5, uzycie Write/Edit/NotebookEdit, Bash z git / przekierowaniem do pliku.
Wyjscie: dane/panel-modele.txt (nadpisywane — podaj wszystkie runy panelu naraz)."""
import glob, json, os, re, sys

ROOT = os.path.expanduser('~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = 'claude-opus-5-5'
ZAPIS = {'Write', 'Edit', 'NotebookEdit', 'MultiEdit'}
# przekierowanie do pliku (> / >> po spacji, z celem-sciezka), zapis z Pythona (open(..., 'w'/'a')), git zmieniajacy stan
# (git log/show/diff/grep to odczyt — run 2 dal na nich falszywy alarm), tee/mv/rm/cp;
# nie lapie porownan w kodzie (x>0, >=, 2>&1)
RE_BASH_ZAPIS = re.compile(r'(^|[;&|]\s*)git\s+(commit|add|mv|rm|checkout|reset|push|stash|apply|restore|switch|merge|rebase|branch\s+-[dD]|tag|worktree\s+add|clean)\b|(^|\s)>>?(?![=&>])\s*[\w/.~"$]|open\([^)]*[\'"][wa]b?[\'"]|\.write_text\(|\btee\s|\bmv\s|\brm\s|\bcp\s')
W_IN, W_CW, W_CR, W_OUT = 1.0, 1.25, 0.1, 5.0


# zaslepienie sedziego (run 2): odczyt plikow analizy albo maszynerii szablonu moglby zdradzic, ktory katalog jest ktory
RE_ZASLONA = re.compile(r'docs/reviews|workspace-template/\.claude|panel-(run|katalog|projekt0|koszt)|PANEL-')


def agent(jf):
    modele = set(); ids = {}; narz = []; alarmy = []; zaslona = []
    for line in open(jf, errors='ignore'):
        try: o = json.loads(line)
        except ValueError: continue
        if o.get('type') != 'assistant': continue
        m = o.get('message') or {}
        if m.get('model'): modele.add(m['model'])
        if m.get('usage'): ids.setdefault(m.get('id'), []).append(m['usage'])
        for b in m.get('content') or []:
            if not isinstance(b, dict) or b.get('type') != 'tool_use': continue
            n = b.get('name', ''); narz.append(n)
            wej = json.dumps(b.get('input') or {}, ensure_ascii=False)
            if RE_ZASLONA.search(wej): zaslona.append(n + ' ' + wej[:140])
            if n in ZAPIS: alarmy.append('%s %s' % (n, (b.get('input') or {}).get('file_path', '')))
            if n == 'Bash' and RE_BASH_ZAPIS.search((b.get('input') or {}).get('command', '')):
                alarmy.append('Bash: ' + (b['input']['command'][:120]).replace('\n', ' '))
    koszt = sum(u[0].get('input_tokens', 0) * W_IN + u[0].get('cache_creation_input_tokens', 0) * W_CW
                + u[0].get('cache_read_input_tokens', 0) * W_CR + u[-1].get('output_tokens', 0) * W_OUT for u in ids.values())
    return dict(modele=sorted(modele), koszt=koszt, wywolania=len(ids), narzedzia=len(narz), alarmy=alarmy, zaslona=zaslona)


def etykiety(run_dir):
    lab = {}
    jp = os.path.join(run_dir, 'journal.jsonl')
    if os.path.exists(jp):
        for line in open(jp, errors='ignore'):
            try: o = json.loads(line)
            except ValueError: continue
            if o.get('type') == 'started' and o.get('agentId'): lab[o['agentId']] = o.get('label') or ''
    return lab


def main(runy):
    if not runy: raise SystemExit('podaj identyfikatory runow')
    out = []; Q = out.append; stop = []
    for run in runy:
        dirs = glob.glob(os.path.join(ROOT, '*', 'subagents', 'workflows', run))
        if not dirs: stop.append('%s: brak katalogu transkryptow' % run); continue
        lab = etykiety(dirs[0]); razem = 0.0
        Q('=== %s (%s) ===' % (run, dirs[0].split('/')[-4]))
        for jf in sorted(glob.glob(os.path.join(dirs[0], 'agent-*.jsonl'))):
            aid = os.path.basename(jf)[6:-6]; a = agent(jf); razem += a['koszt']
            Q('  %-40s model %-22s koszt %6.2f M  wywolania API %3d  narzedzia %3d%s' % (
                lab.get(aid, aid)[:40], ','.join(a['modele']) or '?', a['koszt'] / 1e6, a['wywolania'], a['narzedzia'],
                ('  ALARM: ' + ' | '.join(a['alarmy'][:3])) if a['alarmy'] else ''))
            if a['modele'] != [MODEL]: stop.append('%s %s: model %s' % (run, lab.get(aid, aid), a['modele']))
            if a['alarmy']: stop.append('%s %s: narzedzia zapisu %s' % (run, lab.get(aid, aid), a['alarmy'][:3]))
            if a['zaslona'] and lab.get(aid, '').startswith('sedzia'):
                Q('    UWAGA zaslepienie (odczyt plikow analizy/maszynerii): ' + ' | '.join(a['zaslona'][:3]))
        Q('  RAZEM %.2f M jedn.' % (razem / 1e6))
    Q('')
    Q('STOP (PANEL-PLAN §10): ' + ('; '.join(stop) if stop else 'brak — wszyscy agenci na %s, zero narzedzi zapisu' % MODEL))
    open(os.path.join(BASE, 'dane', 'panel-modele.txt'), 'w').write('\n'.join(out) + '\n')
    print('\n'.join(out))


if __name__ == '__main__':
    main(sys.argv[1:])
