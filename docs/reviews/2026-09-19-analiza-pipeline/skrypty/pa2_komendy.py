#!/usr/bin/env python3
"""Ponowny prompt-audit (P16), Group 2 „Volatile specifics”: komendy skryptow szablonu w promptach.

Kazde `node .claude/scripts/<obszar>/<plik>.mjs [podkomenda] [--flaga ...]` w workflowach, agentach, skillach i templates:
skrypt istnieje, podkomenda (pierwsze slowo po skrypcie, bez myslnika i bez <...>/${...}) i kazda `--flaga` wystepuja
w zrodle skryptu albo modulow z jego katalogu (parseArgs, tablice podkomend, komunikat uzycia). Tylko odczyt — nic nie uruchamia.
Uzycie: pa2_komendy.py <repo> -> dane/pa2-komendy.txt"""
import os, re, sys

REPO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
K = os.path.dirname(os.path.abspath(__file__)) + '/..'
C = os.path.join(REPO, '.claude')
RX = re.compile(r'node\s+(?:"\$CLAUDE_PROJECT_DIR"/|\$CLAUDE_PROJECT_DIR/)?(\.claude/scripts/[\w./-]+\.mjs)([^`\n|;&>)]*)')


def zrodla(skrypt):
    katalog = os.path.dirname(os.path.join(REPO, skrypt))
    tekst = ''
    for f in os.listdir(katalog):
        if f.endswith('.mjs'):
            tekst += open(os.path.join(katalog, f), encoding='utf-8').read()
    return tekst


wpisy, bledy = [], []
for root, dirs, fs in os.walk(C):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '__tests__', 'scripts')]
    for f in fs:
        if not f.endswith(('.md', '.js', '.sh', '.yaml')):
            continue
        p = os.path.join(root, f)
        rel = os.path.relpath(p, REPO)
        for nr, linia in enumerate(open(p, encoding='utf-8', errors='ignore'), 1):
            for m in RX.finditer(linia):
                skrypt, reszta = m.group(1), m.group(2)
                wpisy.append((rel, nr, skrypt, reszta.strip()))
                if not os.path.isfile(os.path.join(REPO, skrypt)):
                    bledy.append(f'{rel}:{nr}: brak skryptu {skrypt}')
                    continue
                zr = zrodla(skrypt)
                slowa = reszta.split()
                if slowa and re.fullmatch(r'[a-z][a-z-]+', slowa[0]) and f"'{slowa[0]}'" not in zr and f'"{slowa[0]}"' not in zr and f' {slowa[0]} ' not in zr:
                    bledy.append(f'{rel}:{nr}: {skrypt}: podkomenda "{slowa[0]}" nie wystepuje w zrodle')
                for fl in re.findall(r'(?<![\w-])--([a-z][a-z0-9-]*)', reszta):
                    if f"'{fl}'" not in zr and f'"{fl}"' not in zr and f'--{fl}' not in zr and f'{fl}:' not in zr:
                        bledy.append(f'{rel}:{nr}: {skrypt}: flaga --{fl} nie wystepuje w zrodle')

o = ['# Ponowny prompt-audit (P16): komendy skryptow szablonu w promptach (pa2_komendy.py)', f'repo: {REPO}', '',
     f'wywolan: {len(wpisy)}, skryptow: {len({w[2] for w in wpisy})}, bledow: {len(bledy)}', '', '## bledy'] + (bledy or ['(brak)'])
o += ['', '## wywolania (plik:linia skrypt argumenty)'] + [f'{r}:{n} {s} {a[:120]}' for r, n, s, a in wpisy]
open(f'{K}/dane/pa2-komendy.txt', 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('\n'.join(o[3:6 + len(bledy)]))
