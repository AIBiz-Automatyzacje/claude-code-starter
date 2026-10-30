#!/usr/bin/env python3
"""Pomiar kandydata do bramki plan.mjs (6a pkt 111 (3)): nazwy w cudzysłowie „…” ze scenariusza [E2E] z (seed: X)
muszą występować w X. Plan = wersja zadań z commitu inicjalizacji planu (to widzi bramka); seed = wersja z tego
commitu (gdy istniał) albo z main (nowy w etapie). Klasy alarmu: tekst-ui (fraza jest w src/ na main), dane (brak w src/).
Uruchomienie: python3 -I pomiar.py <repo-vibersi>"""
import re, subprocess, sys
from collections import Counter

REPO = sys.argv[1]
ETAPY = [
    ('etap-3-konto-i-auth', '30a75c5'),
    ('etap-4-dodawanie-i-moderacja', 'd3d9005'),
    ('etap-5-interakcje-i-profil', '0c94f2a'),
    ('etap-6a-admin-i-zgody', '597fc36'),
    ('etap-6b-start', 'f998a00'),
]


def git(*a):
    r = subprocess.run(['git', '-C', REPO, *a], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def cytaty(linia):
    """Wszystkie spany „…” (także zagnieżdżone) — parser głębokości."""
    wynik, stos = [], []
    for i, z in enumerate(linia):
        if z == '„':
            stos.append(i)
        elif z == '”' and stos:
            s = stos.pop()
            wynik.append(linia[s + 1:i])
    return wynik


norm = lambda t: re.sub(r'\s+', ' ', t).strip().lower()
pliki_src = (git('ls-files', 'src') or '').split()
src = norm('\n'.join(git('show', f'main:{p}') or '' for p in pliki_src if re.search(r'\.(tsx?|json|md)$', p) and not re.search(r'(\.test\.|/test/|__tests__)', p)))

suma = Counter()
for etap, commit in ETAPY:
    plan = git('show', f'{commit}:docs/active/{etap}/{etap}-zadania.md') or ''
    licz = Counter()
    for nr, linia in enumerate(plan.splitlines(), 1):
        if '[E2E]' not in linia:
            continue
        licz['e2e'] += 1
        m = re.search(r'\(seed: ([^)]+)\)', linia)
        if not m:
            continue
        licz['e2e_z_seedem'] += 1
        sciezka = m.group(1).strip()
        seed_plan = git('show', f'{commit}:{sciezka}')
        seed = seed_plan if seed_plan is not None else (git('show', f'main:{sciezka}') or '')
        zrodlo = 'seed-z-planu' if seed_plan is not None else 'seed-nowy'
        ns = norm(seed)
        nazwa = re.search(r'`([^`]+)`', linia)
        for c in cytaty(linia):
            nc = norm(c)
            if len(nc) < 2:
                continue
            licz['cytaty'] += 1
            if nc in ns:
                licz['w_seedzie'] += 1
                continue
            klasa = 'tekst-ui' if nc in src else 'dane'
            licz[f'alarm_{klasa}'] += 1
            licz[f'alarm_{zrodlo}'] += 1
            print(f'{etap}:{nr}\t{nazwa.group(1) if nazwa else "?"}\t{zrodlo}\t{klasa}\t„{c}”\t{sciezka.split("/")[-1]}')
    print(f'## {etap}: ' + ', '.join(f'{k}={v}' for k, v in sorted(licz.items())))
    suma.update(licz)
print('## SUMA: ' + ', '.join(f'{k}={v}' for k, v in sorted(suma.items())))
