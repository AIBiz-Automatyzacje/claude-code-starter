"""Sekcja odczytu smoke'a P12 (buildery i reguły kodu) — importowana przez smoke_odczyt.py. Kryterium 6a pkt 67 (d).

coding-rules ma od P12 `paths:` (kod i SQL), więc nie wchodzi do kontekstu startowego: telemetryczne agent.kontekst.rules_zn liczy tylko
załącznik startowy `instructions` (eager) i po P12 ma być 0 u wszystkich. Odczyt reguł widać w transkrypcie: Read albo Bash pliku reguł
(builder czyta go jawnie) i załącznik `nested_memory` z `path` reguł (Claude Code dokleja regułę z `paths:` po Read/Edit pliku kodu).
Kryterium: eager 0 u wszystkich; rola bez kodu (agent, który nie czytał ani nie zmieniał pliku kodu) bez odczytu reguł; builder i fix
z odczytem; nikt z dwoma źródłami naraz (Read + załącznik = podwójny rozmiar); każdy builder z blokiem D10 w prompcie IU.
ctx_start buildera — sekcja 5 smoke_odczyt.py; błędy schematu — sekcja sceptyków (smoke_sceptycy.py).
"""
import collections, json, os, re

from test_review_p12_transkrypt import NAGLOWEK_D10, RE_KLASA

PLIK_REGUL = 'rules/coding-rules.md'
KOD = re.compile(r'\.(ts|tsx|js|jsx|mjs|cjs|sql)$')


def _z_kodem(rola):
    return rola in ('build', 'fix') or rola.startswith('fix:poprawka')


def reguly(katalog, agent_id):
    """{'read', 'bash', 'paths', 'kod', 'd10': [klasy]} z agent-<id>.jsonl; None, gdy brak pliku. kod = Read/Edit/Write pliku kodu."""
    plik = os.path.join(katalog, 'agent-%s.jsonl' % agent_id)
    if not os.path.exists(plik): return None
    r = {'read': 0, 'bash': 0, 'paths': 0, 'kod': 0, 'd10': []}
    for linia in open(plik, encoding='utf-8'):
        try: w = json.loads(linia)
        except ValueError: continue
        if w.get('type') == 'attachment':
            z = w.get('attachment') or {}
            r['paths'] += z.get('type') == 'nested_memory' and str(z.get('path') or '').endswith(PLIK_REGUL)
            continue
        tresc = (w.get('message') or {}).get('content')
        if w.get('type') == 'user' and isinstance(tresc, str) and NAGLOWEK_D10 in tresc and not r['d10']:
            for l in tresc.split(NAGLOWEK_D10, 1)[1].split('\n')[1:]:
                m = RE_KLASA.match(l)
                if not m: break
                r['d10'].append(m.group(1))
        if w.get('type') != 'assistant' or not isinstance(tresc, list): continue
        for b in tresc:
            if not isinstance(b, dict) or b.get('type') != 'tool_use': continue
            i = b.get('input') or {}
            sciezka = str(i.get('file_path') or '')
            if b.get('name') == 'Read' and sciezka.endswith(PLIK_REGUL): r['read'] += 1
            elif b.get('name') in ('Read', 'Edit', 'Write', 'MultiEdit') and KOD.search(sciezka): r['kod'] += 1
            elif b.get('name') == 'Bash' and PLIK_REGUL in str(i.get('command') or ''): r['bash'] += 1
    return r


def kryterium(agenci, katalog):
    k = {'eager': [], 'bez_kodu_z_regulami': [], 'kod_bez_regul': [], 'podwojny_odczyt': [], 'orkiestracja_z_kodem': [],
         'buildery': 0, 'buildery_bez_d10': 0, 'bez_transkryptu': 0}
    dodaj = lambda lista, x: x in lista or lista.append(x)
    for a in agenci:
        rola = a.get('rola') or '?'
        if ((a.get('kontekst') or {}).get('rules_zn') or 0) > 0: dodaj(k['eager'], rola)
        r = reguly(katalog, a['id']) if katalog else None
        if r is None: k['bez_transkryptu'] += 1; continue
        jawnie, odczyt = r['read'] + r['bash'], r['read'] + r['bash'] + r['paths']
        if jawnie and r['paths']: dodaj(k['podwojny_odczyt'], rola)
        if _z_kodem(rola):
            if not odczyt: dodaj(k['kod_bez_regul'], rola)
        elif r['kod']:
            if odczyt: dodaj(k['orkiestracja_z_kodem'], rola)
        elif odczyt: dodaj(k['bez_kodu_z_regulami'], rola)
        if rola == 'build':
            k['buildery'] += 1
            k['buildery_bez_d10'] += not r['d10']
    k['zielone'] = bool(k['buildery']) and not (k['eager'] or k['bez_kodu_z_regulami'] or k['kod_bez_regul'] or k['podwojny_odczyt']
                                                 or k['buildery_bez_d10'] or k['bez_transkryptu'])
    return k


def sekcja_p12(run, katalog):
    print('\n== 2i. Reguły kodu i D10 (P12; kryterium 6a pkt 67 d)')
    if katalog is None:
        print('  brak katalogu runu'); return
    grupy = collections.defaultdict(lambda: collections.Counter())
    for a in run['agenci']:
        r = reguly(katalog, a['id']) or {}
        g = grupy[a.get('rola') or '?']
        g['n'] += 1
        g['eager'] += ((a.get('kontekst') or {}).get('rules_zn') or 0) > 0
        g['jawnie'] += (r.get('read', 0) + r.get('bash', 0)) > 0
        g['paths'] += r.get('paths', 0) > 0
        g['kod'] += r.get('kod', 0) > 0
        g['d10'] += bool(r.get('d10'))
    print('  %-26s %3s %6s %7s %6s %4s %4s' % ('rola', 'n', 'eager', 'Read/sh', 'paths', 'kod', 'D10'))
    for rola in sorted(grupy):
        g = grupy[rola]
        print('  %-26s %3d %6d %7d %6d %4d %4d' % (rola, g['n'], g['eager'], g['jawnie'], g['paths'], g['kod'], g['d10']))
    for a in run['agenci']:
        if a.get('rola') == 'build':
            r = reguly(katalog, a['id']) or {}
            print('  build %s: D10 %s' % (a.get('etykieta') or a['id'], ', '.join(r.get('d10') or []) or 'BRAK'))
    k = kryterium(run['agenci'], katalog)
    print('  kryterium: %s | %s' % ('ZIELONE' if k['zielone'] else 'CZERWONE', {x: v for x, v in k.items() if x != 'zielone'}))
