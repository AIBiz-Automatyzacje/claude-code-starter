#!/usr/bin/env python3
"""Tempo PR-ów oferty-online (do szacunku czasu okien jakości planu wdrożenia: okno = 5 PR).

Użycie: python3 skrypty/tempo_pr.py → dane/tempo-pr.txt
Źródło: dane/coderabbit/pr-N-reviews.json (pierwsza recenzja bota = data PR-a w obiegu). PR bez recenzji pomijany."""
import datetime, glob, json, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    daty = {}
    for f in glob.glob(os.path.join(BASE, 'dane', 'coderabbit', 'pr-*-reviews.json')):
        n = int(re.search(r'pr-(\d+)-reviews', f).group(1))
        ts = [r.get('submitted_at') for r in json.load(open(f)) if r.get('submitted_at')]
        if ts: daty[n] = datetime.datetime.fromisoformat(min(ts).replace('Z', '+00:00')).date()
    prs = sorted(daty.items(), key=lambda x: x[1])
    L = ['tempo_pr.py — pierwsza recenzja bota per PR (oferty-online)'] + ['  PR %2d  %s' % (n, d) for n, d in prs]
    dni = (prs[-1][1] - prs[0][1]).days or 1
    wrzesien = [d for _, d in prs if d.month == 9]
    L.append('  PR-ów %d w %d dni → %.1f PR/tydzień; wrzesień: %d PR (%s … %s) → %.1f PR/tydzień' % (
        len(prs), dni, 7 * len(prs) / dni, len(wrzesien), min(wrzesien), max(wrzesien),
        7 * len(wrzesien) / max(1, (max(wrzesien) - min(wrzesien)).days)))
    open(os.path.join(BASE, 'dane', 'tempo-pr.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
