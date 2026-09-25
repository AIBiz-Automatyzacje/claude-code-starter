#!/usr/bin/env python3
"""Panel decyzyjny, krok 0 (c) — koszt typowej fazy i zadania dla projektu 0 (dzisiejszy pipeline) i projektow panelu (PANEL-PLAN §3).

Uzycie: python3 skrypty/panel_koszt_projektu.py [projekt.json | dane/panel-run1-projekty.json ...]  (bez argumentow: projekt 0 + walidacja)
Wejscie projektu (JSON): {"nazwa", "role_koszt": [{rola, analog, klasa, model, effort, wywolania_na_faze (liczba albo {"per": "iu"|"finding", "x"}),
warunek (zawsze / faza_z_kodem / faza_z_testami / faza_z_ui / faza_z_migracja / faza_z_e2e / zadanie_z_e2e / raz_na_zadanie), czestosc (opcjonalnie,
0–1, zamiast czestosci warunku), mnoznik_tur, etap (opcjonalnie), uzasadnienie}], "bramki": [{nazwa, gdzie, sekundy, zrodlo}]}.
Dane: dane/panel-koszt-referencja.json (panel_koszt_dane.py), dane/d4r-dzwignia-kontekstu.json (stawki zn/tok).
Wyjscie: dane/panel-koszt.txt (+ .json). Walidacja (PANEL-PLAN §3) liczona przed projektami; bez niej projekty nie sa liczone."""
import collections, json, os, statistics, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from panel_koszt_model import (BASE, REF_RUN, WARUNKI, Referencja, czestosci, etap, fazy_unikalne, wywolania)  # noqa: E402

PROJEKT0 = os.path.join(BASE, 'dane', 'panel-projekt0-role.json')
DZWIGNIA_MR = 47.7   # mini-run (e), pelna metoda (MINI-RUN-WYNIK (e))
DZWIGNIA_D4R = 51.4  # d4r, pelna metoda, starty agentow runu 20.09 (dane/d4r-dzwignia-kontekstu.txt §2)
# Δ startu per komorka zmierzone w mini-runie (dane/mr-kontekst.txt §3, TOLk); mechaniczny opus = haiku / 0,759 jak w mini-runie
DELTA_MR = {('mechaniczny', 'haiku'): 76432, ('orkiestracyjny', 'opus'): 89068, ('reviewer', 'opus'): 89068, ('sceptyk', 'opus'): 89068,
            ('naprawiacz', 'opus'): 89068, ('naprawiacz', 'haiku'): 64090, ('builder', 'opus'): 89019, ('mechaniczny', 'opus'): 76432 / 0.759}
TOLERANCJA = 0.05
KLASY = ('mechaniczny', 'orkiestracyjny', 'reviewer', 'sceptyk', 'naprawiacz', 'builder', 'tester')
out = []; Q = out.append; J = {}


def z_formatu_projektanta(r):
    """Schemat run 1 (wywolania + per) -> format skryptu (wywolania_na_faze)."""
    if 'per' not in r: return r
    r = dict(r); per = r.pop('per'); n = r.pop('wywolania')
    r['wywolania_na_faze'] = {'per': per, 'x': n} if per in ('iu', 'finding') else n
    if per == 'zadanie': r['warunek'] = 'raz_na_zadanie'
    return r


def wczytaj_wiele(p):
    """Plik projektu albo wynik runu 1 ({A: projekt, B: ..., C: ...})."""
    d = json.load(open(p))
    if 'role_koszt' in d: return [wczytaj(p)]
    return [wczytaj_obiekt(dict(v, nazwa='projekt %s (architektura %s)' % (k, k)), p) for k, v in sorted(d.items()) if v]


def wczytaj(p):
    return wczytaj_obiekt(json.load(open(p)), p)


def wczytaj_obiekt(pr, p):
    pr['role_koszt'] = [z_formatu_projektanta(r) for r in pr['role_koszt']]
    for r in pr['role_koszt']:
        braki = [k for k in ('rola', 'analog', 'klasa', 'model', 'wywolania_na_faze', 'warunek') if k not in r]
        if braki: raise ValueError('%s: rola %s bez pol %s' % (p, r.get('rola'), braki))
        if r['warunek'] not in WARUNKI: raise ValueError('%s: nieznany warunek %r' % (p, r['warunek']))
        if r['klasa'] not in KLASY: raise ValueError('%s: nieznana klasa %r' % (p, r['klasa']))
    return pr


def koszt(ref, pr, fakty, cz, kontekst='po', effort_mn=1.0):
    """Koszt fazy i zadania projektu [jedn.] + rozbicie per etap i liczba agentow."""
    faza = collections.Counter(); zad = collections.Counter(); ag_f = 0.0; ag_z = 0.0
    for r in pr['role_koszt']:
        m = r.get('mnoznik_tur', 1.0)
        klasa, model = (None, None) if kontekst == 'dzis' else (r['klasa'], r['model'])
        j = ref.jednostka(r['analog'], klasa, model, m, kontekst, effort_mn if r.get('effort_zmieniony') else 1.0)
        e = r.get('etap') or etap(r['analog'])
        if r['warunek'] == 'raz_na_zadanie':
            n = r['wywolania_na_faze'] * (r['czestosc'] if r.get('czestosc') is not None else 1.0)
            zad[e] += n * j; ag_z += n
        else:
            n = wywolania(r, fakty, cz)
            faza[e] += n * j; ag_f += n
    fz = fakty['fazy_na_zadanie']
    return dict(faza=sum(faza.values()), zadanie=sum(faza.values()) * fz + sum(zad.values()), etapy_faza=dict(faza),
                etapy_zadanie={k: faza[k] * fz + zad[k] for k in set(faza) | set(zad)}, agenci_faza=ag_f, agenci_zadanie=ag_f * fz + ag_z)


def fakty_typowe(fazy_u):
    zad = collections.defaultdict(list)
    for f in fazy_u: zad[f['zadanie']].append(f)
    e2e = sum(1 for v in zad.values() if any(f['faza_z_e2e'] for f in v)) / len(zad)
    fk = dict(iu=statistics.mean(f['iu'] for f in fazy_u), findingi=statistics.mean(f['findingi'] for f in fazy_u),
              fazy_na_zadanie=len(fazy_u) / len(zad), zadan=len(zad), faz=len(fazy_u))
    return fk, czestosci(fazy_u, e2e)


def sekcja_dane(ref, fazy_u, fk, cz):
    Q('=== 1. Dane referencyjne (oferty-online od %s; fazy z wynikiem packagera) ===' % ref.dane['od'])
    Q('wykonan faz %d, faz unikalnych (zadanie, numer) %d, zadan %d, faz na zadanie %.2f; IU na faze %.2f; findingi reviewerow na faze %.1f' % (
        len(ref.dane['fazy']), fk['faz'], fk['zadan'], fk['fazy_na_zadanie'], fk['iu'], fk['findingi']))
    Q('czestosci warunkow (odsetek faz unikalnych): ' + ', '.join('%s %.2f' % (w, cz[w]) for w in WARUNKI if w in cz))
    Q('  zadanie_z_e2e = odsetek zadan z >= 1 faza z checkboxami [E2E]; faza_z_kodem = regex dev-docs-review-wf.js:851 na plikach diffu fazy')
    Q('wywolania na faze unikalna (srednia) i na zadanie, per rola — podstawa projektu 0:')
    per_f = collections.Counter(); per_z = collections.Counter()
    klucze = {(f['run'], f['faza']) for f in fazy_u}; zad_runy = collections.defaultdict(set)
    for f in ref.dane['fazy']: zad_runy[f['zadanie']].add(f['run'])
    runy = {r for v in zad_runy.values() for r in v}
    for a in ref.dane['agenci']:
        if a['poziom'] == 'faza' and (a['run'], a['faza']) in klucze: per_f[a['rola']] += 1
        elif a['poziom'] == 'zadanie' and a['run'] in runy: per_z[a['rola']] += 1
    for r, n in sorted(per_f.items(), key=lambda x: -x[1]):
        Q('  faza    %-22s %.2f  (jednostka %s)' % (r, n / fk['faz'], ref.zrodlo(r) if r in ref.agenci_roli else 'brak'))
    for r, n in sorted(per_z.items(), key=lambda x: -x[1]):
        Q('  zadanie %-22s %.2f  (jednostka %s)' % (r, n / fk['zadan'], ref.zrodlo(r) if r in ref.agenci_roli else 'brak'))
    J['dane'] = dict(fakty=fk, czestosci=cz, na_faze={r: n / fk['faz'] for r, n in per_f.items()}, na_zadanie={r: n / fk['zadan'] for r, n in per_z.items()})


def fakty_fazy(f, fk):
    d = dict(fk); d.update(iu=f['iu'], findingi=f['findingi'], fazy_na_zadanie=1)
    return d, dict({w: 1.0 if f[w] else 0.0 for w in WARUNKI if w.startswith('faza_')}, zawsze=1.0, zadanie_z_e2e=0.0)


def sekcja_walidacja(ref, p0, fk):
    """PANEL-PLAN §3: projekt 0 odtwarza koszt faz runu 20.09 w ±5% i dzwignie ≈48% (mini-run (e))."""
    Q('=== 2. Walidacja projektu 0 na runie 20.09 (%s) ===' % REF_RUN)
    fazy = sorted((f for f in ref.dane['fazy'] if f['run'] == REF_RUN), key=lambda f: f['faza'])
    ok = True; pred = rzecz = pred_po = 0.0
    for f in fazy:
        fa, cz = fakty_fazy(f, fk)
        k = koszt(ref, p0, fa, cz, 'dzis'); kp = koszt(ref, p0, fa, cz, 'po')
        rz = sum(a['koszt'] for a in ref.dane['agenci'] if a['run'] == REF_RUN and a['faza'] == f['faza'] and a['poziom'] == 'faza')
        pred += k['faza']; rzecz += rz; pred_po += kp['faza']
        Q('  %s: rzeczywisty %.2f M, projekt 0 %.2f M (%+.1f%%), agentow %d vs %.1f' % (
            f['faza'], rz / 1e6, k['faza'] / 1e6, 100 * (k['faza'] / rz - 1), sum(1 for a in ref.dane['agenci'] if a['run'] == REF_RUN and a['faza'] == f['faza'] and a['poziom'] == 'faza'), k['agenci_faza']))
    odch = pred / rzecz - 1
    Q('  RAZEM fazy: rzeczywisty %.2f M, projekt 0 %.2f M (%+.1f%%) — kryterium ±%.0f%%: %s' % (rzecz / 1e6, pred / 1e6, 100 * odch, 100 * TOLERANCJA, 'OK' if abs(odch) <= TOLERANCJA else 'NIE'))
    ok &= abs(odch) <= TOLERANCJA
    rz_z = sum(a['koszt'] for a in ref.dane['agenci'] if a['run'] == REF_RUN and a['poziom'] == 'zadanie')
    kz = koszt(ref, p0, fakty_fazy(fazy[0], fk)[0], fakty_fazy(fazy[0], fk)[1], 'dzis')
    pz = kz['zadanie'] - kz['faza']
    Q('  poziom zadania (bootstrap, zamkniecie): rzeczywisty %.2f M, projekt 0 %.2f M (%+.1f%%)' % (rz_z / 1e6, pz / 1e6, 100 * (pz / rz_z - 1)))
    dz = 100 * (1 - pred_po / pred)
    ag = [a for a in ref.dane['agenci'] if a['run'] == REF_RUN]
    ref.delta_klasy = DELTA_MR
    kontrola = 100 * sum(a['koszt'] - ref.po_zmianie(a) for a in ag) / sum(a['koszt'] for a in ag)
    ref.delta_klasy = None
    wlasny = 100 * sum(a['koszt'] - ref.po_zmianie(a) for a in ag) / sum(a['koszt'] for a in ag)
    ok_dz = abs(kontrola / DZWIGNIA_MR - 1) <= TOLERANCJA
    Q('  dzwignia kontekstu — kontrola mechaniki (85 agentow runu 20.09, Δ startu z komorek mini-runu): %.1f%% vs mini-run (e) %.1f%%, kryterium ±%.0f%% wzgl.: %s' % (
        kontrola, DZWIGNIA_MR, 100 * TOLERANCJA, 'OK' if ok_dz else 'NIE'))
    Q('  dzwignia na startach agentow z transkryptu (tryb liczenia projektow): %.1f%% (d4r ta sama metoda: %.1f%%); projekt 0, fazy runu 20.09: %.1f%%' % (wlasny, DZWIGNIA_D4R, dz))
    Q('  roznica 47,7 vs ~51%: start „dzis” w kopii mini-runu byl ~5% nizszy niz w runie 20.09 (inny zestaw MCP) — Δ mniejsza; projekty licza Δ od startu agenta')
    ok &= ok_dz
    J['walidacja'] = dict(fazy_rzeczywisty=rzecz, fazy_projekt0=pred, odchylenie=odch, dzwignia_kontrola=kontrola, dzwignia_starty=wlasny, dzwignia_projekt0=dz, ok=ok)
    return ok


def sekcja_kontrola_poza_proba(ref, p0, fk):
    """Informacyjnie: te same jednostki (run 20.09) na innych runach — run 23.09 (Opus 5.5) i epoka (kontrfakt CLAUDE.md)."""
    Q('=== 3. Kontrola poza proba (informacyjnie, nie kryterium) ===')
    for opis, filtr in (('run 23.09 wf_cf14fe26-014 (Opus 5.5, CLAUDE.md 21k zn)', lambda f: f['run'] == 'wf_cf14fe26-014'),
                        ('epoka 09-08..09-17, fazy z builderami (kontrfakt CLAUDE.md 17 810 zn)', lambda f: '2026-09-08' <= f['start'][:10] <= '2026-09-17' and f['iu'] > 0)):
        pred = rz = 0.0; n = 0
        for f in (f for f in ref.dane['fazy'] if filtr(f)):
            fa, cz = fakty_fazy(f, fk)
            pred += koszt(ref, p0, fa, cz, 'dzis')['faza']; n += 1
            ag = [a for a in ref.dane['agenci'] if a['run'] == f['run'] and a['faza'] == f['faza'] and a['poziom'] == 'faza']
            rz += sum((ref.kontrfakt(a) if a['zn'].get('tools_znikaja') is not None else a)['koszt'] for a in ag)
        Q('  %s: faz %d, rzeczywisty %.1f M, projekt 0 (jednostki 20.09) %.1f M (%+.0f%%)' % (opis, n, rz / 1e6, pred / 1e6, 100 * (pred / rz - 1)))
    Q('  Wniosek: jednostki z runu 20.09 (male fazy: 8/7/0 plikow kodu) zanizaja koszt duzych faz epoki (34–75 plikow kodu) — liczby bezwzgledne')
    Q('  projektow sa dolna granica; porownanie projekt vs projekt 0 (ta sama baza jednostek) jest wzgledne i tego bledu nie dziedziczy w calosci.')


def sekcja_projekt(ref, pr, fk, cz, baza=None):
    wyn = {k: koszt(ref, pr, fk, cz, k) for k in ('dzis', 'po')}
    wyn['effort_minus'] = koszt(ref, pr, fk, cz, 'po', 0.8); wyn['effort_plus'] = koszt(ref, pr, fk, cz, 'po', 1.2)
    p = wyn['po']
    Q('--- %s ---' % pr['nazwa'])
    Q('  typowa faza %.2f M jedn. (dzisiejszy kontekst %.2f M), zadanie %.2f M (%.2f faz); agentow na faze %.1f, na zadanie %.1f' % (
        p['faza'] / 1e6, wyn['dzis']['faza'] / 1e6, p['zadanie'] / 1e6, fk['fazy_na_zadanie'], p['agenci_faza'], p['agenci_zadanie']))
    if baza:
        Q('  vs projekt 0 po zmianie kontekstu: faza %+.1f%%, zadanie %+.1f%%; vs dzis: zadanie %+.1f%%' % (
            100 * (p['faza'] / baza['po']['faza'] - 1), 100 * (p['zadanie'] / baza['po']['zadanie'] - 1), 100 * (p['zadanie'] / baza['dzis']['zadanie'] - 1)))
    if any(r.get('effort_zmieniony') for r in pr['role_koszt']):
        Q('  efort (praca rol ze zmienionym efortem ±20%%): zadanie %.2f .. %.2f M' % (wyn['effort_minus']['zadanie'] / 1e6, wyn['effort_plus']['zadanie'] / 1e6))
    tot = p['zadanie']
    Q('  udzial etapow w zadaniu: ' + ', '.join('%s %.1f%%' % (k, 100 * v / tot) for k, v in sorted(p['etapy_zadanie'].items(), key=lambda x: -x[1])))
    br = pr.get('bramki') or []
    if br: Q('  bramki: ' + ', '.join('%s %s s (%s)' % (b['nazwa'], b.get('sekundy'), b.get('gdzie')) for b in br) + ' — razem %s s' % sum(b.get('sekundy') or 0 for b in br))
    return wyn


def main():
    ref = Referencja()
    fazy_u = fazy_unikalne(ref.dane['fazy'])
    fk, cz = fakty_typowe(fazy_u)
    Q('panel_koszt_projektu.py — koszt fazy i zadania w jednostkach cennika wzglednego (in 1 / cw 1,25 / cr 0,1 / out 5), metoda d4r')
    Q('')
    sekcja_dane(ref, fazy_u, fk, cz); Q('')
    if not os.path.exists(PROJEKT0):
        print('\n'.join(out)); return
    p0 = wczytaj(PROJEKT0)
    ok = sekcja_walidacja(ref, p0, fk); Q('')
    sekcja_kontrola_poza_proba(ref, p0, fk); Q('')
    Q('=== 4. Projekty (typowa faza z czestosci warunkow; wszystkie po zmianie kontekstu z PANEL-WEJSCIE §2 pkt 1) ===')
    Q('Nie liczy: efortu wprost (harness go nie zapisuje — wariant ±20% pracy rol ze zmienionym efortem), kosztu falszywych alarmow nowych list')
    Q('w petli fix, kosztu wdrozenia; jednostki licza token haiku jak opusa (w USD haiku 4x tanszy per token — skill claude-api).')
    baza = sekcja_projekt(ref, p0, fk, cz)
    J['projekty'] = {p0['nazwa']: baza}
    ef0 = {r['analog']: r.get('effort') for r in p0['role_koszt']}
    if ok:
        for pr in (x for p in sys.argv[1:] for x in wczytaj_wiele(p)):
            for r in pr['role_koszt']: r['effort_zmieniony'] = r.get('effort') != ef0.get(r['analog'])
            J['projekty'][pr['nazwa']] = sekcja_projekt(ref, pr, fk, cz, baza)
    elif sys.argv[1:]:
        Q('WALIDACJA NIE PRZESZLA — projekty nie sa liczone (PANEL-PLAN §3, §10).')
    open(os.path.join(BASE, 'dane', 'panel-koszt.txt'), 'w').write('\n'.join(out) + '\n')
    json.dump(J, open(os.path.join(BASE, 'dane', 'panel-koszt.json'), 'w'), ensure_ascii=False, indent=1)
    print('\n'.join(out))


if __name__ == '__main__':
    main()
