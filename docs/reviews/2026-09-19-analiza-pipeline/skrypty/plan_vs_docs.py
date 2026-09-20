#!/usr/bin/env python3
"""Ile tresci artefaktow dev-docs (zadania/kontekst/plan faz) jest kopia planu technicznego z dev-plan — dla zadan oferty-online."""
import os, re, glob, difflib
OO = '/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online'
def linie(p):
    return [l.strip() for l in open(p, errors='ignore') if len(l.strip()) > 25]
for zad in ['faza-9a-domena-mailer-limity', 'faza-9b-wielu-uzytkownikow', 'samodzielna-rejestracja-czlonkow-aa', 'faza-9c-dokumenty-prawne']:
    d = os.path.join(OO, 'docs', 'completed', zad)
    plan_doc = [p for p in glob.glob(os.path.join(d, '*-plan.md'))]
    zadania = glob.glob(os.path.join(d, '*-zadania.md')); kontekst = glob.glob(os.path.join(d, '*-kontekst.md'))
    # plan techniczny z docs/plans (zrodlo dev-plan): dopasuj po nazwie zadania
    tech = [p for p in glob.glob(os.path.join(OO, 'docs', 'plans', '*.md')) if zad.replace('faza-', '').split('-')[0] in os.path.basename(p) and 'plan' in os.path.basename(p)]
    tech = sorted(tech, key=lambda p: -len(os.path.basename(p)))
    tech_p = None
    for p in tech:
        if all(tok in os.path.basename(p) for tok in zad.split('-')[:2]): tech_p = p; break
    if not tech_p and tech: tech_p = tech[0]
    if not (tech_p and zadania): print(zad, 'brak plikow'); continue
    T = linie(tech_p); Z = linie(zadania[0]); K = linie(kontekst[0]) if kontekst else []; P = linie(plan_doc[0]) if plan_doc else []
    tset = set(T)
    def pokrycie(X):
        if not X: return (0, 0, 0.0)
        kop = sum(1 for l in X if l in tset)
        # podobne (ratio > 0.85) — kosztowne, ogranicz do 400 linii
        sim = 0
        for l in X[:400]:
            if l in tset: continue
            if difflib.get_close_matches(l, T, n=1, cutoff=0.85): sim += 1
        return (kop, sim, 100.0 * (kop + sim * (len(X) / max(1, min(400, len(X))))) / len(X))
    print(f"\n== {zad} ==\n  plan techniczny (dev-plan): {os.path.basename(tech_p)} — {len(T)} linii tresci, {os.path.getsize(tech_p)//1000} kB")
    for nazwa, X, p in [('zadania (dev-docs)', Z, zadania[0]), ('kontekst (dev-docs)', K, kontekst[0] if kontekst else ''), ('plan faz (dev-docs)', P, plan_doc[0] if plan_doc else '')]:
        if not X: continue
        kop, sim, proc = pokrycie(X)
        print(f"  {nazwa:22} {len(X):4} linii, {os.path.getsize(p)//1000:3} kB — identycznych z planem: {kop}, prawie identycznych: ~{sim} => ~{proc:.0f}% tresci pochodzi z planu")
