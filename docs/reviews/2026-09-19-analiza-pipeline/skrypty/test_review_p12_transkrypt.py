#!/usr/bin/env python3
"""Ślepy test P12 — przestrzeganie instrukcji z transkryptu buildera (HANDOFF 6a pkt 69 j): bloki promptu IU (D10, reguły, pliki innych IU,
stary blok „Wymagania wykonania”), odczyt coding-rules (Read i załącznik reguły z `paths:`), odczyt resources/ skilli (sekcjami = Read
z offset/limit; znaki wyniku), samosprawdzenie (tsc, vitest related / na plikach, pełny zestaw, ESLint), pytanie „undefined” (heurystyka:
blok tekstu albo myślenia z „undefined” i „test”), wynik BUILD_RESULT (status, pliki, odchylenia, pytanie), czas. Koszt i ctx_start liczy
panel_koszt_dane.sklad (CLI). Testy: test_review_p12_transkrypt_test.py."""
import collections, json, re
from datetime import datetime

NAGLOWEK_D10 = 'Klasy błędów, które review znajduje w takich plikach — co robić zamiast:'
RE_KLASA = re.compile(r'^\s*- ([a-z0-9-]+): ')
RE_TSC = re.compile(r'\btsc\b[^|;&]*--noEmit|\btypecheck\b')
RE_VITEST_RELATED = re.compile(r'\bvitest\s+related\b')
RE_VITEST_PLIKI = re.compile(r'\bvitest\s+run\s+(?:-\S+\s+)*[\w./@-]+\.(?:test|spec)\.[jt]sx?\b')
RE_PELNY = re.compile(r'\bpnpm\s+(?:-r\s+)?(?:run\s+)?test\b(?!:)|\bvitest\s+run\s*(?:$|[|;&>]|--reporter)')
RE_ESLINT = re.compile(r'\beslint\b')


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
    return {'d10': NAGLOWEK_D10 in p, 'klasy_d10': klasy, 'pliki_innych_iu': 'Pliki innych jednostek tej fazy' in p,
            'blok_regul': 'Reguly projektu i klasy bledow dla plikow jednostki' in p or 'Wyuczone reguly projektu' in p,
            'wymagania_wykonania': 'Wymagania wykonania' in p, 'zn': len(p)}


def builder(jf):
    wpisy = list(_wpisy(jf))
    uzycia, wyniki, czasy = [], {}, [o['timestamp'] for o in wpisy if o.get('timestamp')]
    zal, undef, so = 0, 0, None
    for o in wpisy:
        t = o.get('type')
        if t == 'attachment' and 'rules/coding-rules.md' in json.dumps(o.get('attachment') or {}, ensure_ascii=False): zal += 1
        c = (o.get('message') or {}).get('content')
        if not isinstance(c, list): continue
        for b in c:
            if not isinstance(b, dict): continue
            if t == 'user' and b.get('type') == 'tool_result':
                tr = b.get('content')
                wyniki[b.get('tool_use_id')] = len(tr) if isinstance(tr, str) else len(_tekst(tr))
            if t != 'assistant': continue
            if b.get('type') in ('text', 'thinking'):
                x = b.get('text') or b.get('thinking') or ''
                undef += 'undefined' in x and 'test' in x
            if b.get('type') == 'tool_use':
                uzycia.append(b)
                if b.get('name') == 'StructuredOutput': so = b.get('input') or {}
    reads = [u for u in uzycia if u.get('name') == 'Read']
    res = [u for u in reads if re.search(r'\.claude/skills/[^/]+/resources/', (u.get('input') or {}).get('file_path', ''))]
    komendy = [(u.get('input') or {}).get('command', '') for u in uzycia if u.get('name') == 'Bash']
    licz = lambda rx: sum(bool(rx.search(k)) for k in komendy)
    sek = lambda ts: datetime.fromisoformat(ts.replace('Z', '+00:00'))
    return {
        'prompt': bloki_promptu(_prompt(wpisy)),
        'coding_rules': {'read': sum((u.get('input') or {}).get('file_path', '').endswith('rules/coding-rules.md') for u in reads), 'zalacznik': zal},
        'resources': {'odczyty': len(res), 'sekcjami': sum(bool({'offset', 'limit'} & set(u.get('input') or {})) for u in res),
                      'zn': sum(wyniki.get(u.get('id'), 0) for u in res)},
        'samosprawdzenie': {'tsc': licz(RE_TSC), 'vitest_related': licz(RE_VITEST_RELATED), 'vitest_pliki': licz(RE_VITEST_PLIKI),
                            'pelny_zestaw': licz(RE_PELNY), 'eslint': licz(RE_ESLINT)},
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
             'tsc': lambda b: b['samosprawdzenie']['tsc'] > 0,
             'vitest_na_plikach': lambda b: b['samosprawdzenie']['vitest_related'] + b['samosprawdzenie']['vitest_pliki'] > 0,
             'pelny_zestaw': lambda b: b['samosprawdzenie']['pelny_zestaw'] > 0, 'eslint': lambda b: b['samosprawdzenie']['eslint'] > 0,
             'undefined': lambda b: b['undefined'] > 0, 'resources': lambda b: b['resources']['odczyty'] > 0,
             'odchylenia': lambda b: bool(b['wynik'] and b['wynik']['odchylenia'])}
    return {'builderow': len(buildery), 'z_cecha': {k: sum(bool(f(b)) for b in buildery) for k, f in cechy.items()},
            'statusy': dict(collections.Counter((b['wynik'] or {}).get('status') or 'brak wyniku' for b in buildery)),
            'klasy_d10': dict(collections.Counter(k for b in buildery for k in b['prompt']['klasy_d10'])),
            'resources_zn': sum(b['resources']['zn'] for b in buildery), 'resources_odczyty': sum(b['resources']['odczyty'] for b in buildery),
            'prompt_zn': sum(b['prompt']['zn'] for b in buildery), 'czas_s': sum(b['czas_s'] or 0 for b in buildery)}
