#!/usr/bin/env python3
"""Test review (TEST-REVIEW-PLAN §5.3, §7) — koszt z transkryptów i metryki złapań po sędziu i sceptykach.

Użycie:
  python3 skrypty/test_review_wynik.py koszt <etykieta> [<etykieta> …]   — koszt każdej sesji testu kopii (transkrypty agentów, ostatni usage na
        message.id, cennik d4r: panel_koszt_dane.sklad) per krok i wariant, kolumny: ZMIERZONY i PRZELICZONY do bazy „po zmianie kontekstu”
        (Referencja.po_zmianie z klasą roli); sesje uruchamiające i sędzia = „koszt pomiaru”. Wyjście dane/test-review/koszt.{txt,json} (narastająco).
  python3 skrypty/test_review_wynik.py limit <zakres> <etykieta> [<etykieta> …]   — kod 3, gdy suma kosztu zmierzonego > twardy limit zakresu
        (pilot: 1,5 × górna z dane/test-review/koszt-pilota.json; etap główny 50%: 300 M wg HANDOFF 6a pkt 30(d)).
  python3 skrypty/test_review_wynik.py metryki [--etap] <etykieta> [<etykieta> …] — złapane PEŁNE / PEŁNE+CZĘŚCIOWE per wariant, osobno klucz 1 i 2
        (tylko K obecne = TAK), wkład bramek, szum (F poza kluczem: na fazę i na 100 linii diffu, P1/P2 osobno), złapane po weryfikacji
        → dane/test-review/metryki.txt. --etap (etap główny, r=1): tylko permutacja p1 (także w fazach pilota) i klucz 2 bez „po weryfikacji”
        (sceptycy na kluczu 2 tylko w pilocie, plan §6) → dane/test-review/metryki-etap.txt."""
import glob, json, os, re, sys

sys.dont_write_bytecode = True
import panel_koszt_dane as KD
import panel_koszt_model as KM
import test_review_sesja as T

TR = os.path.expanduser('~/test-review')
PROJ = os.path.expanduser('~/.claude/projects')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'dane', 'test-review')
# etap główny 50% (13 faz + moduł fixa, r=1): HANDOFF 6a pkt 30(d) = 1,5 × szacunek po pilocie (152 M fazy + ~48 M moduł fixa); liczy też
# jednostki pilota wchodzące do etapu. Stare limity planu (551 / 907 / 1549 M) zastąpione decyzją; pilot — z koszt-pilota.json (1,5 × górna).
LIMITY = {'50%': 300.0}
MAX_NULL = 0.10   # §11: > 10% agentów zwróciło null = twarde zatrzymanie


def klasa(etykieta):
    e = etykieta.lower()
    if re.search(r'haiku|dedup|agregator|pre-skan|kontekst:diff', e): return 'mechaniczny'
    if 'verify' in e: return 'sceptyk'
    if 'fix:kontrola' in e: return 'orkiestracyjny'
    return 'reviewer'


def sesje(et):
    meta = json.load(open(os.path.join(TR, 'meta', et + '.json')))
    kat = os.path.join(PROJ, re.sub(r'[^A-Za-z0-9]', '-', meta['kopia']))
    opis = {}
    for f in glob.glob(os.path.join(TR, 'wyniki', et, '*.json')):
        r = json.load(open(f)).get('_run') or {}
        if r.get('sesja'): opis[r['sesja']] = os.path.basename(f)[:-5]
    return kat, opis


def koszt(ets):
    ref = KM.Referencja()
    wiersze, suma = [], {}
    for et in ets:
        kat, opis = sesje(et)
        fazy = T.sesje_fazy(et)   # inne sesje w katalogu kopii (np. próba harnessu) to nie koszt fazy
        for sj in sorted(glob.glob(os.path.join(kat, '*.jsonl'))):
            sid = os.path.basename(sj)[:-6]; krok = opis.get(sid, sid[:8])
            if sid not in fazy: continue
            s = KD.sklad(sj)
            if s: wiersze.append({'et': et, 'krok': krok, 'rola': 'sesja-uruchamiajaca', 'pomiar': True, 'zmierzony': s['koszt'], 'po': s['koszt']})
            for rd in glob.glob(os.path.join(kat, sid, 'subagents', 'workflows', '*')):
                lab = {}
                if os.path.exists(os.path.join(rd, 'journal.jsonl')):
                    for line in open(os.path.join(rd, 'journal.jsonl'), errors='ignore'):
                        try: o = json.loads(line)
                        except ValueError: continue
                        if o.get('type') == 'started' and o.get('agentId'): lab[o['agentId']] = o.get('label') or ''
                for jf in glob.glob(os.path.join(rd, 'agent-*.jsonl')):
                    a = KD.sklad(jf)
                    if not a: continue
                    e = lab.get(os.path.basename(jf)[6:-6], '?')
                    a['klasa'] = klasa(e); a['model_k'] = KM.model_k(a['model'])
                    po = ref.po_zmianie(a) if a['zn'].get('tools_znikaja') is not None else a['koszt']
                    wiersze.append({'et': et, 'krok': krok, 'rola': e, 'pomiar': krok.startswith('sedzia'), 'zmierzony': a['koszt'], 'po': po})
        for proba in sorted(glob.glob(os.path.join(TR, 'odrzucone', et, '*'))):   # niedokończone próby (test_review_sesja.odrzuc): koszt poniesiony
            for jf in glob.glob(os.path.join(proba, '*.jsonl')) + glob.glob(os.path.join(proba, '*', 'subagents', 'workflows', '*', 'agent-*.jsonl')):
                a = KD.sklad(jf)
                if a: wiersze.append({'et': et, 'krok': 'odrzucone', 'rola': 'odrzucona-proba', 'pomiar': True, 'zmierzony': a['koszt'], 'po': a['koszt']})
    for w in wiersze:
        k = (w['et'], w['krok'])
        s = suma.setdefault(k, {'zmierzony': 0.0, 'po': 0.0, 'agentow': 0, 'pomiar': 0.0})
        s['zmierzony'] += w['zmierzony']; s['po'] += w['po']; s['agentow'] += 1
        if w['pomiar'] or w['rola'] == 'sesja-uruchamiajaca': s['pomiar'] += w['zmierzony']
    L = ['test_review_wynik.py koszt — M jedn. (cennik d4r); ZMIERZONY = środowisko testu, PO = przeliczony do bazy „po zmianie kontekstu”; '
         'POMIAR = sesje uruchamiające i sędzia (nie koszt wariantu)']
    razem = 0.0
    for (et, krok), s in sorted(suma.items()):
        razem += s['zmierzony']
        L.append('  %-11s %-16s agentów %3d  zmierzony %7.2f  po %7.2f  w tym pomiar %6.2f' % (et, krok, s['agentow'], s['zmierzony'] / 1e6,
                                                                                               s['po'] / 1e6, s['pomiar'] / 1e6))
    L.append('  RAZEM zmierzony %.2f M jedn.' % (razem / 1e6))
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, 'koszt.txt'), 'w').write('\n'.join(L) + '\n')
    json.dump({'%s|%s' % k: v for k, v in suma.items()}, open(os.path.join(OUT, 'koszt.json'), 'w'), indent=1)
    print('\n'.join(L))
    return razem / 1e6


def nulle(ets):
    """(ról agentów, ról z null) w runach Workflow sesji faz. Rola = etykieta agenta w runie; null = ŻADNE jej podejście nie dało wyniku
    (harness ponawia agenta, który utknął — „stalled … retrying” — porzucone podejście bez wpisu „result” to nie null roli)."""
    n = z = 0
    for et in ets:
        kat, _ = sesje(et)
        for sid in T.sesje_fazy(et):
            for jp in glob.glob(os.path.join(kat, sid, 'subagents', 'workflows', '*', 'journal.jsonl')):
                rola, wynik = {}, {}
                for line in open(jp, errors='ignore'):
                    try: o = json.loads(line)
                    except ValueError: continue
                    if o.get('type') == 'started' and o.get('agentId'): rola[o['agentId']] = o.get('label') or o['agentId']
                    if o.get('type') == 'result' and o.get('agentId'): wynik[o['agentId']] = o.get('result')
                role = {}
                for a, e in rola.items(): role[e] = role.get(e, False) or wynik.get(a) not in (None, 'null', '')
                n += len(role); z += sum(1 for ok in role.values() if not ok)
    return n, z


def limit(zakres, ets):
    """Po każdej fazie: koszt ≤ limit zakresu i ≤ 10% agentów z wynikiem null (§11) — inaczej kod 3."""
    if zakres == 'pilot': LIMITY['pilot'] = float(json.load(open(os.path.join(OUT, 'koszt-pilota.json')))['limit'])
    r = koszt(ets)
    if r > LIMITY[zakres]:
        print('STOP §11: koszt %.2f M > limit %s %.0f M — skrypt nie startuje następnej fazy' % (r, zakres, LIMITY[zakres])); return 3
    n, z = nulle(ets)
    if n and z > MAX_NULL * n:
        print('STOP §11: %d z %d agentów zwróciło null (> %d%%)' % (z, n, MAX_NULL * 100)); return 3
    print('limit %s: %.2f / %.0f M jedn., null %d / %d agentów — OK' % (zakres, r, LIMITY[zakres], z, n)); return 0


def zabite(et, w):
    """F zabite przez sceptyków wariantu w (None = sceptycy nieuruchomieni). Wariant 0 zwraca plik+opis — łączone z F przez sceptycy0.fids.json."""
    sc = os.path.join(TR, 'wyniki', et, 'sceptycy%s.json' % w)
    if not os.path.exists(sc): return None
    dec = json.load(open(sc)).get('decyzje') or []
    if w != '0': return {d['f'] for d in dec if d.get('zabity')}
    fids = json.load(open(os.path.join(TR, 'skrypty', et, 'sceptycy0.fids.json')))
    return {fids.get((d.get('opis') or '')[:200]) for d in dec if d.get('zabity')} - {None}


def metryki(ets, etap=False):
    L, pod = ['test_review_wynik.py metryki%s — tylko K obecne (TAK); PEŁNE / PEŁNE+CZĘŚCIOWE; F = findingi agentów i bramek'
              % (' --etap (p1, klucz 2 bez weryfikacji)' if etap else '')], {}
    for et in ets:
        for sp in sorted(glob.glob(os.path.join(TR, 'wyniki', et, 'sedzia-p1.json' if etap else 'sedzia-p*.json'))):
            perm = re.search(r'sedzia-p(\d+)', sp).group(1)
            sed = json.load(open(sp)); mp = json.load(open(os.path.join(TR, 'sedzia', '%s-p%s-mapowanie.json' % (et, perm))))
            br = json.load(open(os.path.join(OUT, 'bramki-%s.json' % et)))
            obecne = [k for k in sed.get('klucze', []) if k.get('obecny') == 'TAK']
            for w in '0ABC':
                for zr in ('klucz1', 'klucz2'):
                    ks = [k for k in obecne if mp['K'][k['id']]['zrodlo'] == zr]
                    pel = sum(any(d['ocena'] == 'PEŁNE' and w in mp['F'].get(d['f'], {}).get('wlasciciele', []) for d in k['dopasowania']) for k in ks)
                    sz = sum(any(w in mp['F'].get(d['f'], {}).get('wlasciciele', []) for d in k['dopasowania']) for k in ks)
                    bram = sum(any(w in mp['F'].get(d['f'], {}).get('wlasciciele', []) and mp['F'][d['f']]['rodzaj'] == 'bramka' for d in k['dopasowania']) for k in ks)
                    zab = zabite(et, w)   # None w fazach fix (x-*): plan nie przewiduje tam sceptyków
                    po_ver = 'brak sceptyków' if zab is None or (etap and zr == 'klucz2') else sum(
                        any(w in mp['F'].get(d['f'], {}).get('wlasciciele', []) and d['f'] not in zab for d in k['dopasowania']) for k in ks)
                    L.append('  %-10s p%s wariant %s %s: K obecne %2d | PEŁNE %2d | szeroko %2d | przez bramki %d | szeroko po weryfikacji %s' % (
                        et, perm, w, zr, len(ks), pel, sz, bram, po_ver))
                    t = pod.setdefault((w, zr), [0, 0, 0]); t[0] += len(ks); t[1] += pel; t[2] += sz
                szum = [f for f in sed.get('bez_dopasowania', []) if f['kategoria'] == 'POZA_KLUCZEM' and w in mp['F'].get(f['f'], {}).get('wlasciciele', [])]
                p12 = [f for f in szum if mp['F'][f['f']]['waga'] in ('P1', 'P2')]
                L.append('  %-10s p%s wariant %s szum: POZA KLUCZEM %d (P1/P2 %d) na %d plików kodu' % (et, perm, w, len(szum), len(p12), br['pliki_kodu']))
    L.append('RAZEM (wszystkie fazy i permutacje):')
    for (w, zr), (n, p, s) in sorted(pod.items()):
        L.append('  wariant %s %s: %d/%d PEŁNE (%.0f%%), %d/%d szeroko (%.0f%%)' % (w, zr, p, n, 100 * p / n if n else 0, s, n, 100 * s / n if n else 0))
    open(os.path.join(OUT, 'metryki-etap.txt' if etap else 'metryki.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    t = sys.argv[1]
    if t == 'koszt': koszt(sys.argv[2:])
    elif t == 'limit': sys.exit(limit(sys.argv[2], sys.argv[3:]))
    elif t == 'metryki': metryki([a for a in sys.argv[2:] if a != '--etap'], '--etap' in sys.argv)
    else: raise SystemExit(__doc__)
