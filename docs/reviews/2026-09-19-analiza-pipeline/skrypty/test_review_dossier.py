#!/usr/bin/env python3
"""Test review (TEST-REVIEW-PLAN §4.2) — sygnały diffu fazy, warunki katalogów i dossier projektów A/B/C (biblioteka dla test_review_warianty.py).

Liczone skryptem z kopii fazy (Python ma dostęp do plików, skrypt Workflow nie):
- sygnały: grep po liniach DODANYCH w diffie baza..HEAD + klasy plików (definicje w dane/test-review-warunki.json → _sygnaly);
- warunki: predykat z test-review-warunki.json na sygnałach (składnia a&b|c, !x; 'nierozstrzygalny' = true, fail-open);
- sekcja planu: `### Faza N` planu technicznego (ścieżka z docs/active/<zadanie>/<zadanie>-plan.md, pole „Plan techniczny”) + wiersze
  „Śledzenie wymagań”, których ID (R\\d+ / F\\d+ / A\\d+ itp.) występują w sekcji;
- wycinek wiedzy (1–2k zn): wpisy .claude/rules/learned-patterns.md Z EPOKI, w których pada nazwa ostatniego katalogu albo rdzeń nazwy pliku
  fazy (≥ 4 znaki) — learned-patterns epoki nie ma globów plików (format docelowy §2 pkt 4 nie istnieje), to najbliższe brzmieniu W-01/W-LP;
- dossier: A — pliki w ~/test-review/dossier/<etykieta>/A/ (diff, lista plików, sygnały, sekcja planu dla spec); B — blok w prompcie (lista plików w kolejności
  próbki z numstat, sekcja planu jako kontrakty IU, wycinek, profil stacku); C — blok w prompcie (pełne pliki kodu do 60k zn, diff reszty,
  kontrakty, wynik bramek, wycinek, sekcja planu)."""
import json, os, re, subprocess

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RE_KOD = re.compile(r'\.(ts|tsx|js|jsx|mjs|cjs|sql|sh)$', re.I)
RE_TEST = re.compile(r'(\.test\.|\.spec\.|/tests?/|__tests__|^e2e/)')
LIMIT_C_PELNE = 60000
LIMIT_C_DIFF = 80000
LIMIT_WIEDZY = 2000

WZORCE = {
    'await': r'\bawait\s', 'hooki': r'\buse(Effect|LayoutEffect|State|Ref|SyncExternalStore)\b',
    'regex': r'RegExp|\.match(All)?\(|\.replace\(|\.split\(|/[^/\s]+/[gimsuy]*\.test\(', 'indexof': r'\.indexOf\(',
    'zapytania': r'\.(from|rpc|select|range|limit|order)\(', 'sql_rpc_l': r'\.rpc\(|\bformat\(',
    'cache': r'cache|staleTime|invalidate|useMemo|\bmemo\(|localStorage|Cache-Control',
    'zod': r'\bz\.(object|strictObject|string|enum|array|union|discriminatedUnion)\(',
    'atrapy': r'vi\.(fn|mock|spyOn)\(|mockResolvedValue|mockReturnValue', 'export': r'^\s*export\s',
    'middleware': r'\.use\(|\.route\(|\bapp\.(get|post|put|delete|all)\(', 'ponawialna': r'webhook|retry|\bjob\b|upsert|onConflict|idempot',
    'fetch': r'\bfetch\(',
}


def git(k, *a):
    return subprocess.run(['git', '-C', k, *a], capture_output=True, text=True).stdout


def dodane(k, baza):
    """{plik: [(nr, tekst)]} linii dodanych w baza..HEAD."""
    wyn, plik, nr = {}, None, 0
    for l in git(k, 'diff', '-U0', '--no-color', baza + '..HEAD').splitlines():
        if l.startswith('+++ '):
            plik = l[6:] if l.startswith('+++ b/') else None
        elif l.startswith('@@') and plik:
            nr = int(re.search(r'\+(\d+)', l).group(1))
        elif plik and l.startswith('+'):
            wyn.setdefault(plik, []).append((nr, l[1:])); nr += 1
    return wyn


def sygnaly(k, baza, bramki=None, fix=False, fix_p1=False):
    pliki = [p for p in git(k, 'diff', '--name-only', '--diff-filter=AMR', baza + '..HEAD').split() if p]
    dod = dodane(k, baza)
    linie = [t for p, ls in dod.items() if RE_KOD.search(p) for _, t in ls]
    ile = {n: sum(1 for t in linie if re.search(w, t)) for n, w in WZORCE.items()}
    kod = [p for p in pliki if RE_KOD.search(p)]
    s = {
        'kod': bool(kod), 'testy': any(RE_TEST.search(p) for p in pliki), 'tsx': any(re.search(r'\.(tsx|jsx)$', p) for p in pliki),
        'klient': any(p.startswith('apps/dashboard/') for p in kod),
        'serwer': any(p.startswith(('apps/server/', 'supabase/functions/')) for p in kod),
        'granica': any(re.match(r'apps/server/src/(routes|mcp|webhooks)/|supabase/functions/', p) for p in kod),
        'teksty': any(re.search(r'(^|/)texts\.ts$|\.tsx$|apps/server/.*-page\.ts$|\.html$', p) for p in pliki if not RE_TEST.search(p)),
        'migracja': any(p.startswith('supabase/migrations/') for p in pliki),
        'dok_sterujace': any(re.match(r'CLAUDE\.md$|\.claude/|README|scripts/', p) for p in pliki),
        'dok_prawny': any(re.search(r'privacy|terms|regulamin|polityk|legal|dpa', p, re.I) for p in pliki),
        'zmiana_eksportu': any(p.startswith('packages/shared/') and any(re.search(WZORCE['export'], t) for _, t in dod.get(p, [])) for p in pliki),
        'seed': any(re.match(r'e2e/seeds/.*\.sql$', p) for p in pliki),
        'profil_supabase': os.path.isdir(os.path.join(k, 'supabase')), 'fix': fix, 'fix_p1': fix_p1, 'nierozstrzygalny': True,
    }
    for n in ('await', 'hooki', 'regex', 'zapytania', 'cache', 'zod', 'atrapy', 'middleware', 'ponawialna'):
        s[n] = ile[n] > 0
    s['parser'] = s['regex'] or ile['indexof'] > 0
    s['sql_rpc'] = ile['sql_rpc_l'] > 0 or any(p.endswith('.sql') for p in pliki)
    s['ui'] = s['teksty'] or any(re.search(r'\.(css|html)$', p) for p in pliki)
    s['dane'] = s['serwer'] or s['migracja'] or s['zapytania'] or ile['fetch'] > 0   # B: flaga warstwy `dane` (próbki security #2–#3)
    for p in 'ABC':
        pr = ((bramki or {}).get('projekty') or {}).get(p) or {}
        s['mutanty_' + p] = bool(pr.get('mutanty_przezyte'))
        if p == 'A': s['lint_A'] = bool(pr.get('ostrzezenia_eslint') or pr.get('knip'))
    return {'pliki': pliki, 'pliki_kodu': kod, 'sygnaly': s, 'liczniki': ile, 'dodane': {p: len(v) for p, v in dod.items()}}


def aktywny(predykat, s):
    for skladnik in predykat.split('|'):
        if all((not s.get(t[1:], True)) if t.startswith('!') else s.get(t, True) for t in [x.strip() for x in skladnik.split('&')]):
            return True
    return False


def warunki():
    return json.load(open(os.path.join(BASE, 'dane', 'test-review-warunki.json')))


def plan_techniczny(k, zadanie):
    mapa = os.path.join(k, 'docs', 'active', zadanie, zadanie + '-plan.md')
    if not os.path.exists(mapa): return None
    m = re.search(r'Plan techniczny:\s*`([^`]+)`', open(mapa, encoding='utf-8').read())
    return m.group(1) if m and os.path.exists(os.path.join(k, m.group(1))) else None


def sekcja_planu(k, zadanie, faza):
    """Sekcja `### Faza N` planu technicznego + wiersze „Śledzenie wymagań” z ID przywołanymi w sekcji."""
    p = plan_techniczny(k, zadanie)
    if not p: return '', None
    t = open(os.path.join(k, p), encoding='utf-8').read()
    m = re.search(r'^### Faza %d\b.*?(?=^#{2,3} )' % faza, t, re.M | re.S)
    sek = m.group(0).strip() if m else ''
    tab = re.search(r'^## Śledzenie wymagań\n(.*?)(?=^## )', t, re.M | re.S)
    wiersze = ''
    if tab and sek:
        ids = set(re.findall(r'\b([A-Z]{1,3}\d{1,3}(?:\.\d+)?)\b', sek))
        # format oferty-online: lista „- **R1.** …” (albo tabela „| R1 | …”); bierzemy wpisy, których ID przywołuje sekcja fazy
        trafione = [l for l in tab.group(1).strip().splitlines()
                    if (m := re.match(r'^\s*(?:- \*\*|\|\s*)([A-Z]{1,3}\d{1,3}(?:\.\d+)?)\b', l)) and m.group(1) in ids]
        if trafione: wiersze = '\n'.join(trafione)
    return sek + ('\n\n## Śledzenie wymagań — wiersze tej fazy\n' + wiersze if wiersze else ''), p


def wycinek_wiedzy(k, pliki):
    lp = os.path.join(k, '.claude', 'rules', 'learned-patterns.md')
    if not os.path.exists(lp): return ''
    wpisy = re.split(r'\n(?=- \*\*)', open(lp, encoding='utf-8').read())[1:]
    tokeny, OGOLNE = set(), {'server', 'index', 'package', 'apps', 'dashboard', 'shared', 'packages', 'types', 'utils', 'test', 'tests',
                              'json', 'lock', 'yaml', 'config', 'routes', 'pages', 'components', 'features', 'supabase', 'migrations'}
    for p in [x for x in pliki if RE_KOD.search(x)]:   # tylko pliki kodu — docs/ dawały tokeny typu „2026”, „review”
        czesci = p.split('/')
        if len(czesci) > 1 and len(czesci[-2]) >= 4: tokeny.add(czesci[-2].lower())
        rdzen = re.sub(r'(\.test|\.spec)?\.[a-z]+$', '', czesci[-1]).lower()
        tokeny.update(x for x in re.split(r'[-_.]', rdzen) if len(x) >= 4 and x.isalpha())
    tokeny -= OGOLNE
    wyn = []
    for w in wpisy:
        if any(re.search(r'\b%s\b' % re.escape(t), w.lower()) for t in tokeny) and sum(map(len, wyn)) + len(w) <= LIMIT_WIEDZY:
            wyn.append(w.strip())
    return '\n'.join(wyn)


def numstat(k, baza):
    wyn = {}
    for l in git(k, 'diff', '--numstat', baza + '..HEAD').splitlines():
        a, u, p = l.split('\t', 2)
        wyn[p] = (int(a) if a.isdigit() else 0, int(u) if u.isdigit() else 0)
    return wyn


def kolejnosc_B(pliki, ns):
    """Próbki B: #1 kolejność diffu, #2 odwrócona, #3 malejąco po liczbie zmienionych linii (numstat)."""
    return [list(pliki), list(reversed(pliki)), sorted(pliki, key=lambda p: -sum(ns.get(p, (0, 0))))]


def kontrakty(pliki, k):
    """Pliki kontraktu dotknięte fazą: pakiet wspólny, migracje, pliki ze schematami Zod (A/B: ścieżki; C: w dossier)."""
    wyn = []
    for p in pliki:
        if p.startswith(('packages/shared/', 'supabase/migrations/')): wyn.append(p)
        elif RE_KOD.search(p) and not RE_TEST.search(p) and os.path.exists(os.path.join(k, p)):
            if re.search(WZORCE['zod'], open(os.path.join(k, p), encoding='utf-8', errors='ignore').read()): wyn.append(p)
    return wyn


def dossier_A(k, et, baza, info, sek_planu):
    # poza /tmp: katalog per faza, żeby deny w sesjach innych faz blokował odczyt (diff późniejszej fazy = przeciek przyszłości)
    d = os.path.join(os.path.expanduser('~/test-review'), 'dossier', et, 'A')
    os.makedirs(d, exist_ok=True)
    open(d + '/faza.diff', 'w').write(git(k, 'diff', baza + '..HEAD'))
    open(d + '/pliki.txt', 'w').write('\n'.join(info['pliki']) + '\n')
    s, c = info['sygnaly'], info['liczniki']
    open(d + '/sygnaly.txt', 'w').write('\n'.join('%s: %s' % (n, c.get(n, s.get(n))) for n in
                                                  ('await', 'hooki', 'regex', 'zapytania', 'cache', 'zod', 'atrapy', 'fetch', 'middleware')) + '\n')
    if sek_planu: open(d + '/plan-fazy.md', 'w').write(sek_planu + '\n')
    return {'katalog': d, 'diff_bajty': os.path.getsize(d + '/faza.diff')}


def dossier_C(k, baza, info, bramki_C, sek_planu, wiedza):
    ns = numstat(k, baza)
    kod = [p for p in info['pliki_kodu'] if os.path.exists(os.path.join(k, p))]
    kod.sort(key=lambda p: -sum(ns.get(p, (0, 0))))
    pelne, reszta, zn = [], [], 0
    for p in kod:
        t = open(os.path.join(k, p), encoding='utf-8', errors='ignore').read()
        if zn + len(t) <= LIMIT_C_PELNE: pelne.append((p, t)); zn += len(t)
        else: reszta.append(p)
    diff_reszty = git(k, 'diff', baza + '..HEAD', '--', *reszta) if reszta else ''
    if len(diff_reszty) > LIMIT_C_DIFF: diff_reszty = diff_reszty[:LIMIT_C_DIFF] + '\n=== DIFF PRZYCIĘTY (limit %d zn) ===' % LIMIT_C_DIFF
    L = ['## Pliki fazy (warstwa z listy zmian)'] + ['- %s (+%d/-%d)' % (p, *ns.get(p, (0, 0))) for p in info['pliki']]
    L.append('\n## Pełne pliki kodu (do %d zn)' % LIMIT_C_PELNE)
    for p, t in pelne: L += ['### %s' % p, '```', t, '```']
    if reszta: L += ['\n## Diff pozostałych plików kodu (git diff %s..HEAD)' % baza[:10], '```diff', diff_reszty, '```']
    L += ['\n## Kontrakty dotknięte fazą', *(['- ' + p for p in kontrakty(info['pliki'], k)] or ['- brak'])]
    L += ['\n## Wynik bramek (JSON)', '```json', json.dumps(bramki_C, ensure_ascii=False, indent=0)[:20000], '```']
    L += ['\n## Profil stacku', 'TypeScript, pnpm workspace (apps/server — Hono/Node, apps/dashboard — React 19/Vite, packages/shared), supabase/ (migracje, RLS)']
    if wiedza: L += ['\n## WIEDZA DLA TWOICH PLIKÓW (learned-patterns, wycinek)', wiedza]
    if sek_planu: L += ['\n## IU fazy z wymaganiami (plan techniczny)', sek_planu]
    return '\n'.join(L)
