#!/usr/bin/env python3
"""Mini-run seria D: zrzut plikow z worktree kazdego buildera do scratchpad/mr/wyniki/<run>/ (mapowanie etykieta -> cwd z transkryptu)."""
import glob, json, os, shutil, subprocess
RUN = os.path.expanduser('~/.claude/projects/-private-tmp-claude-501--Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template-86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f-scratchpad-oferty-kopia/86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f/subagents/workflows/wf_11a1eb5d-342')
WYN = '/private/tmp/claude-501/-Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template/86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f/scratchpad/mr/wyniki'
for mf in sorted(glob.glob(os.path.join(RUN, 'agent-*.meta.json'))):
    rid = json.load(open(mf))['description'].split(':', 1)[1]
    cwd = next(json.loads(l)['cwd'] for l in open(mf[:-10] + '.jsonl') if '"cwd"' in l)
    out = os.path.join(WYN, rid); os.makedirs(os.path.join(out, 'pliki'), exist_ok=True)
    st = subprocess.run(['git', '-C', cwd, 'status', '--porcelain', '--untracked-files=all'], capture_output=True, text=True).stdout
    open(os.path.join(out, 'status.txt'), 'w').write(st); open(os.path.join(out, 'worktree.txt'), 'w').write(cwd + '\n')
    for l in st.splitlines():
        f = l[3:]
        os.makedirs(os.path.join(out, 'pliki', os.path.dirname(f)), exist_ok=True)
        shutil.copy2(os.path.join(cwd, f), os.path.join(out, 'pliki', f))
    print(rid, os.path.basename(cwd), [l for l in st.splitlines()])
