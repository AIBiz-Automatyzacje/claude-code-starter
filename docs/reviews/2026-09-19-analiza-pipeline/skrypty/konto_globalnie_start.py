#!/usr/bin/env python3
"""Pomiar startu sesji głównej z transkryptu (bez uruchamiania czegokolwiek): lista skilli (`skill_listing`), nazwy narzędzi
odroczonych per serwer MCP (`deferred_tools_delta`), instrukcje serwerów MCP (`mcp_instructions_delta`) — wpisy przed pierwszą
odpowiedzią modelu. Porównywalne przed/po tylko dla sesji z TEGO SAMEGO projektu i tej samej aplikacji (desktop vs terminal)."""
import collections, glob, json, os

from konto_wspolne import CL, slug


def najnowszy_transkrypt(projekt):
    kat = os.path.join(CL, 'projects', slug(projekt))
    pliki = sorted(glob.glob(os.path.join(kat, '*.jsonl')), key=os.path.getmtime)
    return pliki[-1] if pliki else None


def serwer_narzedzia(nazwa):
    return nazwa.split('__')[1] if nazwa.startswith('mcp__') else '(wbudowane)'


def bez_opisu(lista):
    """Skille, którym budżet listy uciął opis (linia „- nazwa” bez „: opis”) → źródło (prefiks pluginu) → nazwy."""
    wyn = collections.defaultdict(list)
    for x in (l[2:] for l in lista.split('\n') if l.startswith('- ') and ': ' not in l):
        wyn[x.split(':')[0] if ':' in x else '(user / projekt)'].append(x.split(':')[-1])
    return wyn


def pomiar_startu(plik):
    """Lista skilli z pierwszego wpisu `isInitial`; narzędzia i instrukcje MCP = suma delt z całej sesji (serwery łączą się
    z opóźnieniem, także po pierwszej odpowiedzi), bez usuniętych."""
    wyn = dict(plik=plik, skille=0, skille_zn=0, narzedzia=collections.Counter(), narzedzia_zn=0, instrukcje=collections.Counter())
    nazwy = {}; instr = {}
    with open(plik, encoding='utf-8', errors='replace') as f:
        for linia in f:
            if '"attachment"' not in linia: continue
            try: a = json.loads(linia).get('attachment') or {}
            except ValueError: continue
            if a.get('type') == 'skill_listing' and a.get('isInitial') and not wyn['skille']:
                wyn['skille'] = a.get('skillCount') or len(a.get('names') or []); wyn['skille_zn'] = len(a.get('content') or '')
                wyn['bez_opisu'] = bez_opisu(a.get('content') or '')
            elif a.get('type') == 'deferred_tools_delta':
                linie = a.get('addedLines') or a.get('addedNames') or []
                nazwy.update(zip(a.get('addedNames') or [], [len(x) for x in linie]))
                for n in a.get('removedNames') or []: nazwy.pop(n, None)
            elif a.get('type') == 'mcp_instructions_delta':
                instr.update((n, len(b)) for n, b in zip(a.get('addedNames') or [], a.get('addedBlocks') or []))
                for n in a.get('removedNames') or []: instr.pop(n, None)
    for n, zn in nazwy.items(): wyn['narzedzia'][serwer_narzedzia(n)] += 1; wyn['narzedzia_zn'] += zn
    wyn['instrukcje'].update(instr)
    return wyn


def sekcja_start(Q, projekt):
    plik = najnowszy_transkrypt(projekt)
    Q('=== 7. POMIAR STARTU najnowszej sesji głównej w %s (z transkryptu; porównuj przed/po w tym samym projekcie i aplikacji) ===' % projekt)
    if not plik: return Q('  brak transkryptu')
    p = pomiar_startu(plik)
    mcp = {k: v for k, v in p['narzedzia'].items() if k != '(wbudowane)'}
    Q('  transkrypt: %s' % os.path.basename(plik))
    bo = p.get('bez_opisu') or {}
    Q('  skille na liście: %d, tekst listy %d zn; BEZ OPISU (budżet listy ucięty): %d — model widzi tylko nazwę, więc sam ich nie wywoła' % (
        p['skille'], p['skille_zn'], sum(len(v) for v in bo.values())))
    for zr, n in sorted(bo.items(), key=lambda x: -len(x[1])):
        Q('     %-28s %3d: %s' % (zr, len(n), ', '.join(n[:12]) + (' …' if len(n) > 12 else '')))
    Q('  narzędzia odroczone (same nazwy): %d, w tym MCP %d z %d serwerów; tekst %d zn' % (
        sum(p['narzedzia'].values()), sum(mcp.values()), len(mcp), p['narzedzia_zn']))
    Q('  serwery MCP wg liczby narzędzi: %s' % ', '.join('%s %d' % kv for kv in sorted(mcp.items(), key=lambda x: -x[1])))
    Q('  instrukcje serwerów MCP: %d zn (%s)' % (sum(p['instrukcje'].values()), ', '.join('%s %d' % kv for kv in p['instrukcje'].most_common())))
