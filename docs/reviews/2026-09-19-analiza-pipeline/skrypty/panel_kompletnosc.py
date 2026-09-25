#!/usr/bin/env python3
"""Panel decyzyjny, po run 1 — kompletnosc projektow (PANEL-PLAN §7 pkt 1): decyzje D2–D12, wymogi §2 pkt 1–16, 8 zalozen §6,
14 wierszy §7, rekord §12, katalog z brzmieniem, role_koszt z analogiem znanym skryptowi kosztu, warstwa stala per klasa, wdrozenie.
Uzycie: python3 skrypty/panel_kompletnosc.py [dane/panel-run1-projekty.json]  ->  dane/panel-kompletnosc.txt
Dopasowanie zalozen i elementow po slowach kluczowych — pozycje niedopasowane sa wypisane do przeczytania, nie liczone jako brak."""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from panel_koszt_model import BASE, Referencja  # noqa: E402

DECYZJE = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8a', 'D8b', 'D9', 'D10', 'D11', 'D12']
ZALOZENIA = {'polecenia-listy': ('list',), 'performance ZASTĄP': ('performance', 'perf'), 'security warunkowe': ('security',),
             'packager -> JS': ('packager', 'js'), 'sceptyk asymetryczny': ('sceptyk', 'asymetr'), 'test-coverage scalone': ('test-coverage', 'scal'),
             'batch sceptyków': ('batch',), 'hook error-handling': ('hook', 'error-handling')}
ELEMENTY = {'kieran/simplicity': ('kieran', 'simplicity'), 'hooki Stop': ('hook', 'stop'), '/bugfix': ('bugfix',), 'coderabbit-base': ('coderabbit',),
            'agenci researchowi': ('research',), 'dev-ideate/brainstorm/docs-update': ('ideate', 'brainstorm', 'docs-update'),
            'wszystkie skille (D6)': ('wszystkie skille', 'audyt skilli', 'd6', 'skille szablonu'), 'skill code-review': ('code-review',),
            'freshness-audit': ('freshness',), 'templates e2e/smoke': ('templates', 'e2e-env', 'smoke-autopilot'), '__tests__': ('__tests__', 'testy workflow'),
            'treść skilli skills:': ('skills:', 'treść skilli', 'tresc skilli'), 'oś code-quality (2 miejsca)': ('code-quality', 'architecture-strategist'),
            'settings.json': ('settings',)}


def dopasuj(pozycje, wzorce, pole):
    brak = []
    for nazwa, klucze in wzorce.items():
        if not any(any(k.lower() in (p.get(pole) or '').lower() for k in klucze) for p in pozycje): brak.append(nazwa)
    return brak


def sprawdz(nazwa, p, ref, Q):
    braki = []
    ids = [d['id'] for d in p['decyzje']]
    braki += ['decyzja %s' % d for d in DECYZJE if d not in ids]
    nr = {w['nr'] for w in p['wymogi']}
    braki += ['wymog §2 pkt %d' % n for n in range(1, 17) if n not in nr]
    braki += ['pusty wymog %d' % w['nr'] for w in p['wymogi'] if len((w.get('jak_spelniony') or '').strip()) < 20]
    braki += ['decyzja %s bez metryki' % d['id'] for d in p['decyzje'] if not (d['metryka'].get('wpis_mapy') and d['metryka'].get('pole'))]
    braki += ['decyzja %s bez warunku odwrotu' % d['id'] for d in p['decyzje'] if len((d.get('warunek_odwrotu') or '').strip()) < 10]
    if len(p['zalozenia']) < 8: braki.append('zalozen %d < 8' % len(p['zalozenia']))
    if len(p['elementy']) < 14: braki.append('elementow %d < 14' % len(p['elementy']))
    if not p['rekord'].get('workflow_zwraca_status_i_powod'): braki.append('rekord: workflow nie zwraca statusu i powodu')
    braki += ['katalog %s bez brzmienia' % k['id'] for k in p['katalog'] if len((k.get('brzmienie') or '').strip()) < 15]
    braki += ['rola %s: analog %r nieznany skryptowi kosztu' % (r['rola'], r['analog']) for r in p['role_koszt'] if r['analog'] not in ref.agenci_roli]
    klasy_rol = {r['klasa'] for r in p['role_koszt']}
    # projektanci nazywaja klasy opisowo („reviewer — probka security”) — dopasowanie po prefiksie nazwy klasy
    braki += ['warstwa stala bez klasy %s' % k for k in sorted(klasy_rol) if not any(w['klasa'].lower().startswith(k) for w in p['warstwa_stala'])]
    braki += ['warstwa stala %s: %d polecen >= 150' % (w['klasa'], w['liczba_polecen_bloku']) for w in p['warstwa_stala'] if w['liczba_polecen_bloku'] >= 150]
    if not p['wdrozenie']: braki.append('wdrozenie puste')
    typy = {}
    for k in p['katalog']: typy[k['typ']] = typy.get(k['typ'], 0) + 1
    Q('--- projekt %s ---' % nazwa)
    Q('  decyzje %d, wymogi %d, zalozenia %d, elementy %d, katalog %d %s, role %d, warstwa stala %d klas, wdrozenie %d iteracji, ryzyka %d, niewiadome %d' % (
        len(p['decyzje']), len(p['wymogi']), len(p['zalozenia']), len(p['elementy']), len(p['katalog']), typy, len(p['role_koszt']),
        len(p['warstwa_stala']), len(p['wdrozenie']), len(p['ryzyka']), len(p['niewiadome'])))
    Q('  konflikty ze szkieletem: %d%s' % (len(p['architektura']['konflikty']), ''.join('\n    - ' + k[:220] for k in p['architektura']['konflikty'])))
    Q('  BRAKI: ' + ('; '.join(braki) if braki else 'brak'))
    Q('  do przeczytania (slowa kluczowe nie trafily): zalozenia %s; elementy %s' % (
        dopasuj(p['zalozenia'], ZALOZENIA, 'zalozenie') or '-', dopasuj(p['elementy'], ELEMENTY, 'element') or '-'))
    return braki


def main():
    zr = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'dane', 'panel-run1-projekty.json')
    projekty = json.load(open(zr)); ref = Referencja()
    out = []; Q = out.append; wynik = {}
    Q('panel_kompletnosc.py — %s' % os.path.basename(zr))
    for nazwa, p in sorted(projekty.items()):
        if p is None: Q('--- %s: BRAK WYNIKU (agent null) ---' % nazwa); wynik[nazwa] = ['brak wyniku']; continue
        wynik[nazwa] = sprawdz(nazwa, p, ref, Q)
    Q('')
    Q('KOMPLETNE: ' + ', '.join(n for n, b in sorted(wynik.items()) if not b) + ' | NIEKOMPLETNE: ' + (', '.join(n for n, b in sorted(wynik.items()) if b) or '-'))
    open(os.path.join(BASE, 'dane', 'panel-kompletnosc.txt'), 'w').write('\n'.join(out) + '\n')
    print('\n'.join(out))


if __name__ == '__main__':
    main()
