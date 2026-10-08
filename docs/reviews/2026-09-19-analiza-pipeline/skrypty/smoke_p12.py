"""Sekcja odczytu smoke'a P12 (buildery i reguły kodu) — importowana przez smoke_odczyt.py. Kryterium 6a pkt 67 (d).

coding-rules ma od P12 `paths:` (kod i SQL), więc nie wchodzi do kontekstu startowego: telemetryczne agent.kontekst.rules_zn liczy tylko
załącznik startowy `instructions` (eager) i po P12 ma być 0 u wszystkich. Odczyt reguł widać w transkrypcie: Read albo Bash pliku reguł
(builder czyta go jawnie) i załącznik `nested_memory` z `path` reguł (Claude Code dokleja regułę z `paths:` po Read/Edit pliku kodu).
Kryterium: eager 0 u wszystkich; rola bez kodu (agent, który nie czytał ani nie zmieniał pliku kodu) bez odczytu reguł; builder i fix
z odczytem; nikt z dwoma źródłami naraz (Read + załącznik = podwójny rozmiar); prompt każdego buildera zawiera blok, który planner
policzył `wiedza.mjs wycinek --zapobieganie` (reguły projektu najpierw, zdania D10 w reszcie limitu — w projekcie z wiedzą reguły mogą
zająć cały limit i D10 jest wtedy puste; smoke P12: IU z migracją, 4 reguły SQL 1864 zn, D10 0).
ctx_start buildera — sekcja 5 smoke_odczyt.py; błędy schematu — sekcja sceptyków (smoke_sceptycy.py).
"""
import collections, json, os, re

from test_review_p12_transkrypt import NAGLOWEK_D10, RE_KLASA

PLIK_REGUL = 'rules/coding-rules.md'
KOD = re.compile(r'\.(ts|tsx|js|jsx|mjs|cjs|sql)$')


def _z_kodem(rola):
    return rola in ('build', 'fix') or rola.startswith('fix:poprawka')


def reguly(katalog, agent_id):
    """{'read', 'bash', 'paths', 'kod', 'd10': [klasy], 'prompt'} z agent-<id>.jsonl; None, gdy brak pliku. kod = Read/Edit/Write
    pliku kodu; prompt = polecenie od workflowu (wiadomość harnessu)."""
    plik = os.path.join(katalog, 'agent-%s.jsonl' % agent_id)
    if not os.path.exists(plik): return None
    r = {'read': 0, 'bash': 0, 'paths': 0, 'kod': 0, 'd10': [], 'prompt': ''}
    for linia in open(plik, encoding='utf-8'):
        try: w = json.loads(linia)
        except ValueError: continue
        if w.get('type') == 'attachment':
            z = w.get('attachment') or {}
            r['paths'] += z.get('type') == 'nested_memory' and str(z.get('path') or '').endswith(PLIK_REGUL)
            continue
        tresc = (w.get('message') or {}).get('content')
        if w.get('type') == 'user' and isinstance(tresc, str) and tresc.startswith('[Workflow harness'): r['prompt'] = tresc
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


def _tekst_wyniku(c):
    return c if isinstance(c, str) else ''.join(b.get('text', '') for b in c or [] if isinstance(b, dict))


def wycinki_plannera(katalog, agent_id):
    """Wyniki `wiedza.mjs wycinek` z transkryptu agenta (JSON na początku wyniku Bash — komenda bywa sklejona z inną, np. `; ls`)."""
    plik = os.path.join(katalog, 'agent-%s.jsonl' % agent_id)
    if not os.path.exists(plik): return []
    wpisy = [json.loads(l) for l in open(plik, encoding='utf-8') if l.strip()]
    ids = {b.get('id') for w in wpisy if w.get('type') == 'assistant' for b in (w.get('message') or {}).get('content') or []
           if isinstance(b, dict) and b.get('type') == 'tool_use' and 'wiedza.mjs wycinek' in str((b.get('input') or {}).get('command'))}
    wyniki = []
    for w in wpisy:
        for b in (w.get('message') or {}).get('content') or [] if w.get('type') == 'user' else []:
            if isinstance(b, dict) and b.get('type') == 'tool_result' and b.get('tool_use_id') in ids:
                try: wynik = json.JSONDecoder().raw_decode(_tekst_wyniku(b.get('content')).lstrip())[0]
                except ValueError: continue
                # Wynik zaczynajacy sie liczba (np. `wc -l` sklejone z wycinkiem) to nie JSON wycinka.
                if isinstance(wynik, dict): wyniki.append(wynik)
    return wyniki


def blok_w_prompcie(prompt, wycinki):
    """Prompt zawiera każdą linię któregoś niepustego wycinka (harness wcina linie); bez niepustych wycinków nie ma czego szukać."""
    linie = {l.strip() for l in prompt.split('\n')}
    pelne = [w for w in wycinki if (w.get('tresc') or '').strip()]
    return not pelne or any(all(l.strip() in linie for l in w['tresc'].split('\n') if l.strip()) for w in pelne)


def kryterium(agenci, katalog):
    k = {'eager': [], 'bez_kodu_z_regulami': [], 'kod_bez_regul': [], 'podwojny_odczyt': [], 'orkiestracja_z_kodem': [],
         'buildery': 0, 'buildery_bez_bloku': 0, 'buildery_z_d10': 0, 'bez_transkryptu': 0}
    wycinki = [x for a in agenci if a.get('rola') == 'planner' and katalog for x in wycinki_plannera(katalog, a['id'])]
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
            k['buildery_z_d10'] += bool(r['d10'])
            k['buildery_bez_bloku'] += not blok_w_prompcie(r['prompt'], wycinki)
    k['wycinki_plannera'] = [{'zn': w.get('zn'), 'reguly': w.get('wpisy'), 'd10': (w.get('zapobieganie') or {}).get('klasy'),
                              'd10_pominiete': (w.get('zapobieganie') or {}).get('pominiete')} for w in wycinki]
    k['zielone'] = bool(k['buildery']) and not (k['eager'] or k['bez_kodu_z_regulami'] or k['kod_bez_regul'] or k['podwojny_odczyt']
                                                 or k['buildery_bez_bloku'] or k['bez_transkryptu'])
    return k


def testy_usuniete(wyniki):
    """{etykieta domknięcia: lista testyUsuniete albo None} z wyników journala — bramka cofa test usunięty bez funkcji (pilot P12:
    builder fullstack usunął 2 działające testy, domknięcie przywróciło)."""
    return {e: (r.get('testyUsuniete') if isinstance(r, dict) else None) for e, _, r in wyniki if e.startswith('domkniecie:')}


def sekcja_p12(run, wyniki, katalog):
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
    print('  testyUsuniete (domknięcie): %s' % testy_usuniete(wyniki))
    k = kryterium(run['agenci'], katalog)
    print('  kryterium: %s | %s' % ('ZIELONE' if k['zielone'] else 'CZERWONE', {x: v for x, v in k.items() if x != 'zielone'}))
