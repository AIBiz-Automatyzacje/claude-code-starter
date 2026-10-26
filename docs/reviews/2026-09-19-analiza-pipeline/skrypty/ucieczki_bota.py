#!/usr/bin/env python3
"""Ucieczki do bota: skad pochodzi kazdy watek recenzji bota w PR-ach zadania (pierwowzor sekcji raportu, E5-20).

Dla kazdego watku (gh graphql reviewThreads) dwie niezalezne odpowiedzi:
  1. ZNANE — czy review fazy juz to mialo: naglowek `### P<n> · <OS> · `plik:linia`` w review-faza-*.md albo wpis
     w known-issues.md z tym samym plikiem i linia w odleglosci <= --okno, domyslnie 10 (linie dryfuja miedzy faza a PR — heurystyka,
     wiersz pokazuje dopasowany finding do recznego sprawdzenia).
  2. POCHODZENIE kodu — `git blame` linii watku na commicie, na ktorym bot ja skomentowal (originalCommit), i temat
     commitu: fix fazy / kontrola fixa / build (feat) / tura PR / smoke (po commicie archiwum) / sprzed zadania.
Kubelek ucieczki (pierwszy pasujacy): znane-P3? > znane-P2-wrocilo? > kod-fixa > kod-smoke > kod-tury-PR > kod-buildu >
sprzed-zadania > nieustalone.

Uzycie: python3 ucieczki_bota.py --repo ../vibersi --zadanie etap-5-interakcje-i-profil --pr 8,9,10 [--okno 25] [--json plik]
Wymaga: gh (zalogowany), git; repo z remote origin na GitHubie. Pobiera refs/pull/<N>/head do refs/ucieczki/pr<N>.
Waga i klasa z naszej klasyfikacji: ~/.claude/telemetry/pipeline.jsonl (rekordy run.pr.klasy po id watku).
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
from collections import Counter

ZAPYTANIE = """query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){
headRefOid reviewThreads(first:100){nodes{id isResolved path line originalLine
comments(first:1){nodes{createdAt body author{login} originalCommit{oid}}}}}}}}"""
WAGA_BOTA = re.compile(r'\*\*\s*(Critical|Major|Minor|Trivial)\*\*|\b(Critical|Major|Minor|Trivial)\*\*')
NAGLOWEK = re.compile(r'^### (P[123]|OPERATOR)(?: · (\w+))? · `([^`:]+):?(\d+)?')
WPIS_KI = re.compile(r'^- \S+ \[(P[123])\] ([^\s:]+):(\d+)')
KOLEJNOSC = ['znane-P3?', 'znane-P2-wrocilo?', 'kod-fixa', 'kod-smoke', 'kod-tury-PR', 'kod-buildu', 'sprzed-zadania', 'nieustalone']


def sh(args, cwd, check=True):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"{' '.join(args)}: {r.stderr.strip()[:300]}")
    return r.stdout


def repo_github(repo):
    url = sh(['git', 'remote', 'get-url', 'origin'], repo).strip()
    m = re.search(r'github\.com[:/]([^/]+)/([^/.]+)', url)
    if not m:
        raise RuntimeError(f'origin nie wskazuje GitHuba: {url}')
    return m.group(1), m.group(2)


def watki_pr(repo, wlasciciel, nazwa, numer):
    out = sh(['gh', 'api', 'graphql', '-f', f'query={ZAPYTANIE}', '-f', f'o={wlasciciel}', '-f', f'r={nazwa}',
              '-F', f'n={numer}'], repo)
    pr = json.loads(out)['data']['repository']['pullRequest']
    return pr['headRefOid'], pr['reviewThreads']['nodes']


def klasyfikacja_nasza():
    """id watku -> {severity, klasa, decyzja} z ostatniego rekordu run.pr, ktory go klasyfikowal."""
    plik = os.path.expanduser('~/.claude/telemetry/pipeline.jsonl')
    wynik = {}
    if not os.path.exists(plik):
        return wynik
    for linia in open(plik, encoding='utf8'):
        try:
            r = json.loads(linia)
        except json.JSONDecodeError:
            continue
        for k in ((r.get('pr') or {}).get('klasy') or []) if r.get('typ') == 'run' else []:
            if isinstance(k, dict) and k.get('id'):
                wynik[k['id']] = k
    return wynik


def findingi_review(repo, zadanie):
    """Lista (zrodlo, waga, os, plik, linia) z review-faza-*.md i known-issues.md archiwum (albo docs/active)."""
    wynik = []
    for katalog in (f'docs/completed/{zadanie}', f'docs/active/{zadanie}'):
        for p in sorted(glob.glob(os.path.join(repo, katalog, 'review-faza-*.md'))):
            for l in open(p, encoding='utf8'):
                m = NAGLOWEK.match(l)
                if m and m.group(4):
                    wynik.append((os.path.basename(p), m.group(1), m.group(2) or '', m.group(3), int(m.group(4))))
        ki = os.path.join(repo, katalog, 'known-issues.md')
        if os.path.exists(ki):
            for l in open(ki, encoding='utf8'):
                m = WPIS_KI.match(l)
                if m:
                    wynik.append(('known-issues.md', m.group(1), '', m.group(2), int(m.group(3))))
    return wynik


def dopasuj(plik, linia, findingi, okno):
    trafienia = [f for f in findingi if f[3] == plik and linia is not None and abs(f[4] - linia) <= okno]
    # Najblizszy wiersz; przy rownej odleglosci finding z review przed known-issues (ma os).
    return min(trafienia, key=lambda f: (abs(f[4] - linia), f[0] == 'known-issues.md')) if trafienia else None


def commit_archiwum(repo, rewizja, zadanie):
    out = sh(['git', 'log', rewizja, '--format=%H %ct', '--fixed-strings', f'--grep=docs({zadanie}): archiwum', '-1'], repo, check=False).split()
    return (out[0], int(out[1])) if len(out) == 2 else (None, None)


def blame(repo, rewizja, plik, linia):
    out = sh(['git', 'blame', '--porcelain', '-L', f'{linia},{linia}', rewizja, '--', plik], repo, check=False)
    if not out:
        return None
    sha = out.split()[0]
    temat = re.search(r'^summary (.*)$', out, re.M)
    czas = re.search(r'^committer-time (\d+)$', out, re.M)
    return sha, (temat.group(1) if temat else ''), (int(czas.group(1)) if czas else 0)


def pochodzenie(temat, czas, zadanie, czas_archiwum):
    z = re.escape(zadanie)
    if re.match(rf'fix\({z}\): (poprawki po review fazy|kontrola diffu naprawczego)', temat):
        return 'kod-fixa'
    if re.match(r'fix\(pr\): tura', temat):
        return 'kod-tury-PR'
    if re.match(rf'feat\({z}\)', temat):
        return 'kod-buildu'
    if czas_archiwum and czas > czas_archiwum:
        return 'kod-smoke'
    if zadanie in temat:
        return 'kod-buildu'
    return 'sprzed-zadania'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--zadanie', required=True)
    ap.add_argument('--pr', required=True, help='numery PR po przecinku (czesci zadania)')
    ap.add_argument('--okno', type=int, default=10, help='tolerancja linii przy dopasowaniu do findingu review')
    ap.add_argument('--json')
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    wlasciciel, nazwa = repo_github(repo)
    nasze = klasyfikacja_nasza()
    findingi = findingi_review(repo, a.zadanie)
    wiersze = []
    for numer in [int(x) for x in a.pr.split(',') if x.strip()]:
        sh(['git', 'fetch', '-q', 'origin', f'+refs/pull/{numer}/head:refs/ucieczki/pr{numer}'], repo, check=False)
        glowa, watki = watki_pr(repo, wlasciciel, nazwa, numer)
        archiwum, czas_archiwum = commit_archiwum(repo, f'refs/ucieczki/pr{numer}', a.zadanie)
        for w in watki:
            k = (w['comments']['nodes'] or [{}])[0]
            if not (k.get('author') or {}).get('login', '').startswith('coderabbit'):
                continue
            linia = w['originalLine'] or w['line']
            rewizja = (k.get('originalCommit') or {}).get('oid') or glowa
            b = blame(repo, rewizja, w['path'], linia) if linia else None
            pocho = pochodzenie(b[1], b[2], a.zadanie, czas_archiwum) if b else 'nieustalone'
            # Finding review moze dotyczyc tej linii tylko wtedy, gdy kod istnial w czasie review (build albo sprzed zadania);
            # linia przepisana pozniej przez fix, ture PR albo smoke to nowy kod, nawet gdy sasiaduje z findingiem.
            znane = dopasuj(w['path'], linia, findingi, a.okno) if pocho in ('kod-buildu', 'sprzed-zadania', 'nieustalone') else None
            ten_plik = [f for f in findingi if f[3] == w['path']] if not znane else []
            if znane and (znane[1] == 'P3' or znane[0] == 'known-issues.md'):
                kubelek = 'znane-P3?'
            elif znane and znane[1] in ('P1', 'P2'):
                kubelek = 'znane-P2-wrocilo?'
            else:
                kubelek = pocho
            m = WAGA_BOTA.search(k.get('body') or '')
            nk = nasze.get(w['id'], {})
            wiersze.append({
                'pr': numer, 'watek': w['id'], 'plik': f"{w['path']}:{linia}", 'rozwiazany': w['isResolved'],
                'waga_bota': (m.group(1) or m.group(2)) if m else None, 'waga': nk.get('severity'), 'klasa': nk.get('klasa'),
                'kubelek': kubelek, 'pochodzenie': pocho, 'commit': (b[0][:8] + ' ' + b[1][:70]) if b else None,
                'znane': f'{znane[0]} {znane[1]} {znane[2]} {znane[3]}:{znane[4]}'.replace('  ', ' ') if znane else None,
                'plik_w_review': [f'{f[0]} {f[1]} :{f[4]}' for f in ten_plik],
            })
    for w in wiersze:
        print(f"#{w['pr']} {w['plik']:<58} {str(w['waga']):<4} {str(w['klasa']):<24} {w['kubelek']:<17} "
              f"{'' if w['rozwiazany'] else 'OTWARTY '}| {w['commit'] or '-'}" + (f" | review: {w['znane']}" if w['znane'] else '')
              + (f" | ten plik w review (inna linia, sprawdz recznie): {', '.join(w['plik_w_review'])}" if w['plik_w_review'] else ''))
    licz = Counter(w['kubelek'] for w in wiersze)
    p12 = Counter(w['kubelek'] for w in wiersze if w['waga'] in ('P1', 'P2'))
    print(f"\nWatki bota: {len(wiersze)} (P1/P2 wg naszej klasyfikacji: {sum(p12.values())})")
    for k in KOLEJNOSC:
        if licz[k]:
            print(f'  {k:<17} {licz[k]:>3}   P1/P2: {p12[k]}')
    print('Uwagi bota poza diffem (w tresci recenzji, bez watku) nie sa liczone. „znane?” = finding review w okolicy linii — KANDYDAT, potwierdz trescia;')
    print('„ten plik w review” to podpowiedz do recznego sprawdzenia — ten sam defekt bywa opisany w innej linii po zmianach pliku.')
    if a.json:
        with open(a.json, 'w', encoding='utf8') as f:
            json.dump(wiersze, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as e:
        print(f'ucieczki_bota: {e}', file=sys.stderr)
        sys.exit(1)
