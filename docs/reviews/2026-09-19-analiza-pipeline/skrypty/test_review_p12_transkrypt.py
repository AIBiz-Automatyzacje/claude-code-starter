#!/usr/bin/env python3
"""Ślepy test P12 — przestrzeganie instrukcji z transkryptu buildera (HANDOFF 6a pkt 69 j): bloki promptu IU (D10, reguły, pliki innych IU,
stary blok „Wymagania wykonania”), odczyt coding-rules (Read i załącznik reguły z `paths:`), odczyt resources/ skilli (sekcjami = Read
z offset/limit; znaki wyniku; osobno odczyty Bashem — builder czyta też `cat`/`sed`), samosprawdzenie (tsc, vitest related / na plikach,
pełny zestaw, ESLint), pytanie „undefined” (heurystyka na blokach TEKSTU z „undefined” i „test” — myślenie jest w transkrypcie zredagowane,
więc miara zaniża), wynik BUILD_RESULT (status, pliki, odchylenia, pytanie), czas. Załącznik reguły: plik coding-rules w załączniku
(`path` albo `files[].path`), nie wzmianka w CLAUDE.md. Koszt i ctx_start liczy panel_koszt_dane.sklad (CLI). Testy: test_review_p12_transkrypt_test.py."""
import collections, json, re, unicodedata
from datetime import datetime

NAGLOWEK_D10 = 'Klasy błędów, które review znajduje w takich plikach — co robić zamiast:'
RE_KLASA = re.compile(r'^\s*- ([a-z0-9-]+): ')
RE_TSC = re.compile(r'\btsc\b[^|;&]*--noEmit|\btypecheck\b')
RE_VITEST_RELATED = re.compile(r'\bvitest\s+related\b')
RE_PNPM_TEST = re.compile(r'\bpnpm\s+(?:-r\s+|--filter\s+\S+\s+)*(?:run\s+)?test\b(?!:)')
RE_ESLINT = re.compile(r'\beslint\b')
RE_SEGMENTY = re.compile(r'&&|\|\||;|\||\n')


def _vitest(cmd):
    """Uruchomienia vitest run bez `related`: (na plikach, pełny zestaw) — po argumentach pozycyjnych po `run` (flagi, przekierowania
    i liczby pomijane). `pnpm test` bez argumentów = pełny zestaw."""
    pliki = pelny = 0
    for seg in RE_SEGMENTY.split(re.sub(r'\d?>>?&?\s*\S+', ' ', cmd)):
        if RE_PNPM_TEST.search(seg): pelny += 1; continue
        m = re.search(r'\bvitest\b(\s+run)?(.*)$', seg)
        if not m or re.search(r'\bvitest\s+related\b', seg): continue
        poz = [t for t in m.group(2).split() if not t.startswith('-') and not t.isdigit()]
        if poz: pliki += 1
        else: pelny += 1
    return pliki, pelny


def _norm(t):
    return unicodedata.normalize('NFKD', t.replace('ł', 'l').replace('Ł', 'L')).encode('ascii', 'ignore').decode().replace('*', '').lower()


def _wpisy(jf):
    with open(jf, errors='ignore') as f:
        for line in f:
            try: yield json.loads(line)
            except ValueError: continue


def _tekst(c):
    if isinstance(c, str): return c
    return ''.join(b.get('text', '') for b in c or [] if isinstance(b, dict) and b.get('type') == 'text')


def _prompt(wpisy):
    uzytk = [_tekst((o.get('message') or {}).get('content')) for o in wpisy if o.get('type') == 'user']
    for t in uzytk:
        if t.startswith('[Workflow harness — computed task]'): return t
    return uzytk[1] if len(uzytk) > 1 else (uzytk[0] if uzytk else '')


def bloki_promptu(p):
    klasy, w_bloku = [], False
    for l in p.split('\n'):
        if NAGLOWEK_D10 in l: w_bloku = True; continue
        if w_bloku:
            m = RE_KLASA.match(l)
            if not m: break
            klasy.append(m.group(1))
    n = _norm(p)
    return {'d10': NAGLOWEK_D10 in p, 'klasy_d10': klasy, 'pliki_innych_iu': 'pliki innych jednostek tej fazy' in n,
            'blok_regul': 'reguly projektu i klasy bledow dla plikow jednostki' in n or 'wyuczone reguly projektu' in n,
            'wymagania_wykonania': 'wymagania wykonania' in n, 'granice': 'czego zadanie nie obejmuje' in n, 'zn': len(p)}


def _zalacznik_regul(a):
    sciezki = [a.get('path') or ''] + [(f or {}).get('path') or '' for f in a.get('files') or []]
    return any(x.endswith('rules/coding-rules.md') for x in sciezki)


def builder(jf):
    wpisy = list(_wpisy(jf))
    uzycia, wyniki, czasy = [], {}, [o['timestamp'] for o in wpisy if o.get('timestamp')]
    zal, undef, so = 0, 0, None
    for o in wpisy:
        t = o.get('type')
        if t == 'attachment' and _zalacznik_regul(o.get('attachment') or {}): zal += 1
        c = (o.get('message') or {}).get('content')
        if not isinstance(c, list): continue
        for b in c:
            if not isinstance(b, dict): continue
            if t == 'user' and b.get('type') == 'tool_result':
                tr = b.get('content')
                wyniki[b.get('tool_use_id')] = len(tr) if isinstance(tr, str) else len(_tekst(tr))
            if t != 'assistant': continue
            if b.get('type') == 'text':
                x = b.get('text') or ''
                undef += 'undefined' in x and 'test' in x
            if b.get('type') == 'tool_use':
                uzycia.append(b)
                if b.get('name') == 'StructuredOutput': so = b.get('input') or {}
    reads = [u for u in uzycia if u.get('name') == 'Read']
    res = [u for u in reads if re.search(r'\.claude/skills/[^/]+/resources/', (u.get('input') or {}).get('file_path', ''))]
    komendy = [(u.get('input') or {}).get('command', '') for u in uzycia if u.get('name') == 'Bash']
    licz = lambda rx: sum(bool(rx.search(k)) for k in komendy)
    vitest = [_vitest(k) for k in komendy]
    sek = lambda ts: datetime.fromisoformat(ts.replace('Z', '+00:00'))
    return {
        'prompt': bloki_promptu(_prompt(wpisy)),
        'coding_rules': {'read': sum((u.get('input') or {}).get('file_path', '').endswith('rules/coding-rules.md') for u in reads),
                         'bash': sum('rules/coding-rules.md' in k for k in komendy), 'zalacznik': zal},
        'resources': {'odczyty': len(res), 'sekcjami': sum(bool({'offset', 'limit'} & set(u.get('input') or {})) for u in res),
                      'zn': sum(wyniki.get(u.get('id'), 0) for u in res), 'bash': sum(bool(re.search(r'\.claude/skills/[^/\s]+/resources/', k)) for k in komendy)},
        'samosprawdzenie': {'tsc': licz(RE_TSC), 'vitest_related': licz(RE_VITEST_RELATED), 'vitest_pliki': sum(v[0] for v in vitest),
                            'pelny_zestaw': sum(v[1] for v in vitest), 'eslint': licz(RE_ESLINT)},
        'undefined': undef,
        'wynik': None if so is None else {'status': so.get('status'), 'pliki': len(so.get('pliki') or []), 'odchylenia': so.get('odchylenia') or [],
                                          'pytanie': so.get('pytanie')},
        'czas_s': round((sek(czasy[-1]) - sek(czasy[0])).total_seconds()) if czasy else None,
    }


def agregat(buildery):
    """Podsumowanie wariantu: ilu builderów ma daną cechę (miary przestrzegania), statusy, sumy znaków i komend."""
    cechy = {'d10_w_prompcie': lambda b: b['prompt']['d10'], 'blok_regul': lambda b: b['prompt']['blok_regul'],
             'pliki_innych_iu': lambda b: b['prompt']['pliki_innych_iu'], 'wymagania_wykonania': lambda b: b['prompt']['wymagania_wykonania'],
             'coding_rules_read': lambda b: b['coding_rules']['read'] > 0, 'coding_rules_zalacznik': lambda b: b['coding_rules']['zalacznik'] > 0,
             'coding_rules_odczyt': lambda b: b['coding_rules']['read'] + b['coding_rules']['bash'] + b['coding_rules']['zalacznik'] > 0,
             'granice': lambda b: b['prompt'].get('granice'),
             'tsc': lambda b: b['samosprawdzenie']['tsc'] > 0,
             'vitest_na_plikach': lambda b: b['samosprawdzenie']['vitest_related'] + b['samosprawdzenie']['vitest_pliki'] > 0,
             'pelny_zestaw': lambda b: b['samosprawdzenie']['pelny_zestaw'] > 0, 'eslint': lambda b: b['samosprawdzenie']['eslint'] > 0,
             'undefined': lambda b: b['undefined'] > 0, 'resources': lambda b: b['resources']['odczyty'] + b['resources']['bash'] > 0,
             'odchylenia': lambda b: bool(b['wynik'] and b['wynik']['odchylenia'])}
    return {'builderow': len(buildery), 'z_cecha': {k: sum(bool(f(b)) for b in buildery) for k, f in cechy.items()},
            'statusy': dict(collections.Counter((b['wynik'] or {}).get('status') or 'brak wyniku' for b in buildery)),
            'klasy_d10': dict(collections.Counter(k for b in buildery for k in b['prompt']['klasy_d10'])),
            'resources_zn': sum(b['resources']['zn'] for b in buildery), 'resources_odczyty': sum(b['resources']['odczyty'] for b in buildery),
            'prompt_zn': sum(b['prompt']['zn'] for b in buildery), 'czas_s': sum(b['czas_s'] or 0 for b in buildery)}
