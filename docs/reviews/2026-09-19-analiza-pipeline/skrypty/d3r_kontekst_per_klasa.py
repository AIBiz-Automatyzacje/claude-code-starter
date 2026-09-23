#!/usr/bin/env python3
"""D3 — rewizja (przeglad domkniec na Opus 5.5, 2026-09-23). Czy kontekst per klasa roli z D3 nadaje sie na punkt odniesienia po odchudzeniu.
D3 podaje mediane SREDNIEGO kontekstu na ture (ctx_sr) per klasa i przypisuje roznice reviewer vs mechaniczny (~120k) CLAUDE.md 89k zn.
Sprawdzam:
  1. Kontekst PIERWSZEJ tury (ctx_start = in + cache_w + cache_r pierwszej odpowiedzi API) per klasa — to jest miara konfiguracji
     (tools:, omitClaudeMd, CLAUDE.md), ctx_sr rosnie z liczba tur i czytanymi plikami.
  2. Rozklad w czasie: tydzien startu agenta vs rozmiar CLAUDE.md i learned-patterns w repo (git, stan na koniec dnia).
  3. Model: haiku vs opus przy tej samej klasie konfiguracji (general-purpose, bez pliku agenta).
Tylko oferty-online (repo, w ktorym znamy historie CLAUDE.md). Wyjscie: dane/d3r-kontekst-per-klasa.{txt,json}.
Uzycie: d3r_kontekst_per_klasa.py <repo_oferty_online>"""
import collections, csv, glob, json, os, statistics, subprocess, sys

REPO = sys.argv[1]
S = os.path.dirname(os.path.abspath(__file__)) + '/../dane/'
BASE = os.path.expanduser('~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-oferty-online')
MECH = {'stan:zapis', 'telemetria', 'e2e:precheck', 'fix:pre-skan', 'e2e:env-down', 'zwin-do-poprawy', 'dedup:semantyczny', 'stop:commit-artefaktow'}
SCEPT = {'verify', 'verify-batch'}
NAPR = {'fix', 'fix:poprawka'}


def klasa(rola):
    if rola in MECH:
        return 'mechaniczny'
    if rola in SCEPT:
        return 'sceptyk'
    if rola.startswith('review:'):
        return 'reviewer'
    if rola == 'build':
        return 'builder'
    if rola in NAPR:
        return 'naprawiacz'
    if rola in ('?', ''):
        return None
    return 'orkiestracyjny'


def pierwsza_tura(r):
    jf = glob.glob(os.path.join(BASE, '*', 'subagents', 'workflows', r['run'], f"agent-{r['agent']}.jsonl"))
    if not jf:
        return None
    for line in open(jf[0], errors='ignore'):
        o = json.loads(line)
        u = (o.get('message') or {}).get('usage') if o.get('type') == 'assistant' else None
        if u:
            return u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0)
    return None


def rozmiar(plik, dzien):
    sha = subprocess.run(['git', '-C', REPO, 'log', '-1', f'--before={dzien} 23:59', '--format=%h', '--', plik], capture_output=True, text=True).stdout.strip()
    if not sha:
        return 0
    return len(subprocess.run(['git', '-C', REPO, 'show', f'{sha}:{plik}'], capture_output=True, text=True).stdout)


def tydzien(ts):
    d = ts[:10]
    return '08-24..08-31' if d < '2026-09-01' else '09-01..09-07' if d < '2026-09-08' else '09-08..09-12' if d < '2026-09-13' else '09-13..09-17'


rows = [r for r in csv.DictReader(open(S + 'agents.csv')) if r['projekt'] == 'oferty-online']
dane = []
for r in rows:
    k = klasa(r['rola'])
    if not k:
        continue
    c = pierwsza_tura(r)
    if c is None:
        continue
    dane.append({'klasa': k, 'rola': r['rola'], 'model': 'haiku' if 'haiku' in r['model'] else 'opus' if 'opus' in r['model'] else r['model'],
                 'tydzien': tydzien(r['start']), 'ctx_start': c, 'ctx_sr': float(r['ctx_sr'] or 0), 'tury': int(r['tury'] or 0), 'dzien': r['start'][:10]})

out = []
p50 = lambda xs: round(statistics.median(xs) / 1000) if xs else None
out.append('=== ROZMIAR PLIKOW STALEGO KONTEKSTU W REPO (znaki, koniec dnia) ===')
for d in ('2026-08-31', '2026-09-07', '2026-09-12', '2026-09-17', '2026-09-22'):
    out.append(f"  {d}: CLAUDE.md {rozmiar('CLAUDE.md', d):6d} | learned-patterns {rozmiar('.claude/rules/learned-patterns.md', d):6d} | coding-rules {rozmiar('.claude/rules/coding-rules.md', d):6d}")
out.append('  (po 2026-09-21 ~12:30 CLAUDE.md = 21 008 zn; ostatni agent w agents.csv: ' + max(x['dzien'] for x in dane) + ' — ZERO agentow w epoce po odchudzeniu)')

out.append('\n=== KONTEKST PIERWSZEJ TURY (p50, k tok) per klasa x tydzien  [n] ===')
tyg = ['08-24..08-31', '09-01..09-07', '09-08..09-12', '09-13..09-17']
out.append('  klasa            ' + ' | '.join(f'{t:>13s}' for t in tyg) + ' | ctx_sr p50 (D3) | tury p50')
wyn = {}
for k in ('mechaniczny', 'orkiestracyjny', 'sceptyk', 'reviewer', 'naprawiacz', 'builder'):
    kom = []
    for t in tyg:
        xs = [x['ctx_start'] for x in dane if x['klasa'] == k and x['tydzien'] == t]
        kom.append(f"{str(p50(xs)) + 'k':>6s} [{len(xs):3d}]")
        wyn.setdefault(k, {})[t] = {'p50_k': p50(xs), 'n': len(xs)}
    sr = [x['ctx_sr'] for x in dane if x['klasa'] == k and x['tydzien'] >= '09-08']
    tu = [x['tury'] for x in dane if x['klasa'] == k and x['tydzien'] >= '09-08']
    out.append(f'  {k:16s} ' + ' | '.join(kom) + f' | {p50(sr)}k (od 09-08) | {statistics.median(tu) if tu else None}')

out.append('\n=== MODEL przy tej samej konfiguracji (general-purpose, bez pliku agenta), pierwsza tura p50 od 09-08 ===')
for k in ('mechaniczny', 'orkiestracyjny', 'sceptyk'):
    for m in ('haiku', 'opus'):
        xs = [x['ctx_start'] for x in dane if x['klasa'] == k and x['model'] == m and x['tydzien'] >= '09-08']
        if xs:
            out.append(f'  {k:16s} {m:6s} n={len(xs):4d} p50={p50(xs)}k')

rev = [x for x in dane if x['klasa'] == 'reviewer' and x['tydzien'] >= '09-08']
mech = [x for x in dane if x['klasa'] == 'mechaniczny' and x['tydzien'] >= '09-08']
out.append('\n=== SKAD ROZNICA reviewer vs mechaniczny (od 09-08) ===')
out.append(f"  ctx_sr p50: reviewer {p50([x['ctx_sr'] for x in rev])}k, mechaniczny {p50([x['ctx_sr'] for x in mech])}k")
out.append(f"  ctx_start p50: reviewer {p50([x['ctx_start'] for x in rev])}k, mechaniczny {p50([x['ctx_start'] for x in mech])}k")
out.append('  -> CLAUDE.md laduje sie OBU klasom (zaden agent nie ma dzis omitClaudeMd), wiec nie tlumaczy roznicy; roznica na starcie to model + prompt,')
out.append('     reszta narasta w trakcie pracy (tury x czytane pliki).')
open(S + 'd3r-kontekst-per-klasa.txt', 'w').write('\n'.join(out) + '\n')
json.dump(wyn, open(S + 'd3r-kontekst-per-klasa.json', 'w'), ensure_ascii=False, indent=1)
print('\n'.join(out))
