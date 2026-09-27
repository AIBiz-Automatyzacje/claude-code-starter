#!/usr/bin/env python3
"""Test review — tekst raportu liczb analizy (dane/test-review/wynik.txt). Moduł skryptu test_review_analiza.py: każda sekcja to funkcja
biorąca słownik części wyniku `d` (klucze: kal, zl, rz, prz, bram, st, ver, sz, ko, k2, obecnosc)."""
import json

WARIANTY = '0ABC'
NOWE = 'ABC'


def pct(a, n):
    return '%d/%d (%.0f%%)' % (a, n, 100 * a / n) if n else '0/0'


def sekcja_zlapania(d):
    L = ['\n§2 ZŁAPANIA I RÓŻNICE vs 0 (sparowane po kluczu)']
    for naz, z in d['zl'].items():
        L.append('  %s: n=%d | ' % (naz, z['sz']['n']) + ' | '.join('%s szeroko %s, PEŁNE %s' % (
            w, pct(z['sz'][w]['zlapane'], z['sz']['n']), pct(z['pe'][w]['zlapane'], z['pe']['n'])) for w in WARIANTY))
        L.append('      komplementarność: ' + json.dumps(z['kompl'], ensure_ascii=False))
        for w in NOWE:
            r = d['rz'][naz][w]
            L.append('      %s − 0: szeroko %+.1f pkt [%.1f; %.1f], PEŁNE %+.1f pkt [%.1f; %.1f]; pary: tylko %s %d, tylko 0 %d' % (
                w, r['szeroko']['roznica'], *r['szeroko']['ci95'], r['pelne']['roznica'], *r['pelne']['ci95'], w, r['tylko_' + w], r['tylko_0']))
    return L


def sekcja_przekroje(d):
    L = ['\n§3 PRZEKROJE (szeroko)']
    for g, grupy in d['prz'].items():
        L.append('  ' + g)
        for n, z in grupy.items():
            if z['n']: L.append('    %-40s n=%3d | ' % (n, z['n']) + ' | '.join('%s %d' % (w, z[w]['zlapane']) for w in WARIANTY))
    return L


def sekcja_bramki_weryfikacja(d):
    st = d['st']
    L = ['\n§4 WKŁAD BRAMEK (klucz 1): ' + json.dumps(d['bram'], ensure_ascii=False),
         '   D5 Stryker (fazy, rodzina test-niefalsyfikowalny): ' + json.dumps({k: v for k, v in st.items() if k != 'stan_strykera'}, ensure_ascii=False),
         '   stan Strykera per faza: ' + json.dumps(st['stan_strykera'], ensure_ascii=False),
         '\n§5 PO WERYFIKACJI (fazy, klucz 1, sceptycy wariantu tylko na dopasowanych P1/P2)']
    for w in WARIANTY:
        v = d['ver'][w]
        L.append('  %s: szeroko przed %d → po %d z %d; zabite prawdziwe B %d %s; złapanych P1/P2 przed %d' % (
            w, v['szeroko_przed'], v['szeroko_po'], v['n'], len(v['zabite_prawdziwe_B']), v['zabite_prawdziwe_B'], v['P1P2_przed']))
    return L


def sekcja_szum(d):
    L = ['\n§6 SZUM (findingi POZA KLUCZEM; agent = findingi reviewerów, bramka osobno)']
    for cz, r in d['sz']['razem'].items():
        L.append('  %s: jednostek %d, linii diffu kodu %d' % (cz, r['jednostek'], r['linie']))
        for w in WARIANTY:
            s = r[w]
            L.append('    %s: findingi agentów %d (P1/P2 %d, %.1f/jedn.) | POZA KLUCZEM agent %d (P1/P2 %d) = %.1f (P1/P2 %.1f) na jedn., '
                     '%.2f (P1/P2 %.2f) na 100 linii | bramka poza kluczem %d | inna uwaga bota %d' % (
                         w, s['findingi_agent'], s['findingi_agent_P1P2'], s['findingi_agent_P1P2_na_jednostke'], s['poza_agent'], s['poza_agent_P1P2'],
                         s['poza_agent_na_jednostke'], s['poza_agent_P1P2_na_jednostke'], s['poza_agent_na_100_linii'], s['poza_agent_P1P2_na_100_linii'],
                         s['poza_bramka'], s['inna_uwaga_bota']))
    return L


def sekcja_koszt(d):
    ko = d['ko']
    L = ['\n§7 KOSZT [M jedn., PO = po zmianie kontekstu, netto bez sesji uruchamiającej]; brutto zmierzony całego etapu (37 jednostek, p1+p2 pilota): %.2f'
         % ko['razem_zmierzony_brutto']]
    for cz, c in ko['czesci'].items():
        L.append('  %s (pomiar = sędzia %.2f):' % (cz, c['pomiar_po']))
        for w in WARIANTY:
            x = c[w]
            L.append('    %s: znajdowanie %.2f (zmierzony %.2f), na jednostkę %.2f, złapane klucz1 %d, na złapaną B %s%s | weryfikacja dopasowanych %.2f' % (
                w, x['znajdowanie_po'], x['znajdowanie_zmierzony'], x['na_jednostke_po'], x['zlapane_klucz1'], x['na_zlapana_B_po'],
                '' if w == '0' else ', przyrost vs 0: %+.2f M za %+d złapań' % (x['przyrost_kosztu_po'], x['przyrost_zlapan']), x['weryfikacja_dopasowanych_po']))
    return L


def sekcja_klucz2(d):
    k2 = d['k2']
    L = ['\n§8 KLUCZ 2 — trafienia dzisiejszego review gubione przez nowy wariant (i łapane tylko przez nowy)']
    for w in NOWE:
        g = [x for x in k2 if w in x['gubi']]
        L.append('  %s gubi %d (P1 %d), łapie ponad 0: %d' % (w, len(g), sum(x['waga'] == 'P1' for x in g), sum(w in x['lapie_tylko_nowy'] for x in k2)))
    for x in k2:
        L.append('  %s %s %s %s:%s | gubi %s | łapie tylko nowy %s | dziś łapie %s | %s' % (
            x['et'], x['przypadek'], x['waga'], x['plik'], x['linia'], ''.join(x['gubi']) or '-', ''.join(x['lapie_tylko_nowy']) or '-',
            ','.join(x['zrodlo_0']) or '-', x['opis'] or ('TREŚĆ: ' + x['tresc'][:300].replace('\n', ' '))))
    return L


def tekst(d, n_boot):
    L = ['test_review_analiza.py wynik — etap główny testu review (p1, szeroko = PEŁNE+CZĘŚCIOWE, tylko klucze obecne TAK); '
         'CI 95%% bootstrap po jednostkach, %d losowań' % n_boot,
         '\n§1 KALIBRACJA SĘDZIEGO ETAPU: ' + json.dumps({k: v for k, v in d['kal'].items() if k != 'niezgodne'}, ensure_ascii=False)]
    for sekcja in (sekcja_zlapania, sekcja_przekroje, sekcja_bramki_weryfikacja, sekcja_szum, sekcja_koszt, sekcja_klucz2):
        L += sekcja(d)
    L.append('\nobecność kluczy: %s' % d['obecnosc'])
    return '\n'.join(L) + '\n'
