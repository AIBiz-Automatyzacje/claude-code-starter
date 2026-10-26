#!/usr/bin/env python3
"""E5-3 — pomiar progu fixa (plan paczki P27-P29-E5, S2): rozmiar commitów fixa faz etapów 3–5 vibersi (`git log --shortstat`,
tematy „poprawki po review fazy N” i „kontrola diffu naprawczego fazy N”) vs wątki bota z kodu fixa (`dane/e5-ucieczki-etapy-3-5.txt`,
klasa `kod-fixa`, dopasowanie po skróconym sha commitu).

Użycie: python3 skrypty/e5_3_fixy.py [repo vibersi]  → dane/e5-3-fixy.txt"""
import os, re, subprocess, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Documents/Kodowanie/vibersi')
ETAPY = ('etap-3-konto-i-auth', 'etap-4-dodawanie-i-moderacja', 'etap-5-interakcje-i-profil')
TEMAT = re.compile(r'^fix\((?P<etap>etap-[^)]+)\): (?P<rodzaj>poprawki po review|kontrola diffu naprawczego) fazy (?P<faza>\d+)$')


def git(*a):
    return subprocess.run(['git', '-C', REPO] + list(a), capture_output=True, text=True, check=True).stdout


def commity_fixa():
    wynik = []
    for linia in git('log', '--all', '--format=%H%x09%s').splitlines():
        sha, temat = linia.split('\t', 1)
        m = TEMAT.match(temat)
        if not m or m['etap'] not in ETAPY: continue
        st = git('show', '--shortstat', '--format=', sha).strip()
        plus = int((re.search(r'(\d+) insertion', st) or [0, 0])[1])
        minus = int((re.search(r'(\d+) deletion', st) or [0, 0])[1])
        pliki = int((re.search(r'(\d+) files? changed', st) or [0, 0])[1])
        # pliki kodu (bez docs/): liczba linii dodanych w kodzie — to ją czyta K-3
        num = git('show', '--numstat', '--format=', sha)
        plus_kod = sum(int(p) for p, _, f in (l.split('\t') for l in num.splitlines() if l.strip()) if p.isdigit() and not f.startswith('docs/'))
        # wyzwalacz L-COR-4/5 z planu: fix dodaje hook/efekt albo funkcję (linie dodane w kodzie poza testami i docs/)
        diff = git('show', '--format=', '--unified=0', sha, '--', '.', ':!docs', ':!**/*.test.*', ':!e2e')
        dod = [l[1:] for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++')]
        hooki = sum(1 for l in dod if re.search(r'\buse(Effect|LayoutEffect|Ref|State|Callback|Memo)\(', l))
        funkcje = sum(1 for l in dod if re.match(r'\s*(export )?(async )?function \w+', l))
        wynik.append({'sha': sha, 'etap': m['etap'], 'faza': int(m['faza']), 'rodzaj': m['rodzaj'], 'plus': plus, 'minus': minus,
                      'pliki': pliki, 'plus_kod': plus_kod, 'hooki': hooki, 'funkcje': funkcje})
    return wynik


def ucieczki_fixa():
    """Wątki bota sklasyfikowane jako `kod-fixa` → {skrócony sha: [wiersze]}."""
    out = {}
    for l in open(os.path.join(BASE, 'dane', 'e5-ucieczki-etapy-3-5.txt'), encoding='utf-8'):
        if 'kod-fixa' not in l or '|' not in l: continue
        m = re.search(r'\| ([0-9a-f]{7,8}) ', l)
        if m: out.setdefault(m[1][:7], []).append(l.split('|')[0].strip())
    return out


def main():
    fixy = commity_fixa()
    ucieczki = ucieczki_fixa()
    # faza = fix + kontrola diffu tej samej fazy
    fazy = {}
    for c in fixy:
        k = (c['etap'], c['faza'])
        f = fazy.setdefault(k, {'plus': 0, 'minus': 0, 'plus_kod': 0, 'hooki': 0, 'funkcje': 0, 'sha': [], 'ucieczki': []})
        for p in ('plus', 'minus', 'plus_kod', 'hooki', 'funkcje'): f[p] += c[p]
        f['sha'].append(c['sha'][:7])
        f['ucieczki'] += ucieczki.get(c['sha'][:7], [])
    L = ['E5-3 pomiar progu fixa — vibersi etapy 3–5 (skrypty/e5_3_fixy.py). Fix fazy = „poprawki po review” + „kontrola diffu naprawczego”.',
         'plus_kod = linie dodane poza docs/. Ucieczki = wątki bota z kodu fixa (dane/e5-ucieczki-etapy-3-5.txt, klasa kod-fixa).', '',
         '%-30s %4s %7s %7s %8s %6s %6s  %s' % ('etap', 'faza', '+', '-', '+kod', 'hooki', 'funkc', 'ucieczki bota z fixa')]
    for (etap, faza), f in sorted(fazy.items(), key=lambda kv: -kv[1]['plus_kod']):
        L.append('%-30s %4d %7d %7d %8d %6d %6d  %d %s' % (etap, faza, f['plus'], f['minus'], f['plus_kod'], f['hooki'], f['funkcje'], len(f['ucieczki']),
                                                         '; '.join(' '.join(u.split()[:2]) for u in f['ucieczki'])))
    z = [f['plus_kod'] for f in fazy.values() if f['ucieczki']]
    bez = sorted(f['plus_kod'] for f in fazy.values() if not f['ucieczki'])
    L += ['', 'Fazy z fixem: %d; z ucieczką z fixa: %d (+kod: %s); bez ucieczki: %d (+kod max %d, mediana %d).'
          % (len(fazy), len(z), z, len(bez), bez[-1] if bez else 0, bez[len(bez) // 2] if bez else 0)]
    nad = lambda prog: (sum(1 for f in fazy.values() if f['plus_kod'] > prog), sum(1 for f in fazy.values() if f['plus_kod'] > prog and f['ucieczki']))
    for prog in (200, 300, 400, 500, 600):
        n, u = nad(prog)
        L.append('próg %d: fixów powyżej %d, z nich z ucieczką %d' % (prog, n, u))
    wyzw = sum(1 for f in fazy.values() if f['hooki'] or f['funkcje'])
    L.append('wyzwalacz L-COR-4/5 (fix dodaje hook albo funkcję poza testami): %d z %d fixów' % (wyzw, len(fazy)))
    open(os.path.join(BASE, 'dane', 'e5-3-fixy.txt'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print('\n'.join(L))


main()
