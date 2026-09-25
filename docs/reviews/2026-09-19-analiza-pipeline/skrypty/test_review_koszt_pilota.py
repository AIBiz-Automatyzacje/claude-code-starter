#!/usr/bin/env python3
"""Test review — koszt pilota przed startem (TEST-REVIEW-PLAN §7, §11 pkt 1): środek, górna granica i twardy limit, w M jedn. (cennik d4r).

Użycie: python3 skrypty/test_review_koszt_pilota.py   → dane/test-review/koszt-pilota.{txt,json}
Źródła: dane/test-review-plan.json (koszt 4 wariantów per faza: dzis/po/dzis_max/po_min, sędzia), dane/test-review-plan.json fit (jednostki ról),
dane/test-review/warianty-<et>.json (faktyczna liczba ról w skryptach), ~/test-review/sedzia/<et>-klucze.json (liczba K dla sceptyków).
Dodatki względem planu (wynikają z przygotowania): sędzia 2× w pilocie (dwie permutacje), sceptycy także na kluczu 2 w pilocie, sesje uruchamiające
(koszt pomiaru), próba harnessu. Sceptycy: środek = połowa K dopasowana w każdym wariancie, batch 4; górna = każde K w każdym wariancie, 1 agent na
finding. Twardy limit = 1,5 × górna (jak PANEL-PLAN §10)."""
import json, math, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = os.path.expanduser('~/test-review')
PILOT = [('f-b26128d', 'b26128d294'), ('f-2634b67', '2634b6770a'), ('f-f3ee433', 'f3ee433811'), ('f-b26128d-r2', 'b26128d294')]
FIX = ['x-411a434', 'x-05dd804']
SESJA_START = 0.08      # sesja uruchamiająca: start ~50–60k tok (bez MCP) × 1,25 + kilka tur × 0,1 — założenie do zmierzenia w próbie
PROBA = 0.3             # dwie sesje próby harnessu (workflow bez agentów + odmowa odczytu)


def main():
    plan = json.load(open(os.path.join(BASE, 'dane', 'test-review-plan.json')))
    fazy = {f['faza']: f for f in plan['fazy']}
    vb = plan['fit']['verify-batch']; jv = vb['a']
    fk = plan['fit']['fix:kontrola']
    L = ['test_review_koszt_pilota.py — koszt pilota [M jedn.] (środek | górna); twardy limit = 1,5 × górna', '']
    razem = {'sr': 0.0, 'gor': 0.0}
    wiersze = []
    for et, sha in PILOT:
        f = fazy[sha]
        war_sr = sum(f['koszt'][w]['dzis'] for w in '0ABC'); war_g = sum(f['koszt'][w]['dzis_max'] for w in '0ABC')
        sed_sr, sed_g = 2 * f['sedzia'], 2 * f['sedzia'] * 1.5
        K = len(json.load(open(os.path.join(TR, 'sedzia', et + '-klucze.json')))['klucze'])
        sc_sr = 4 * math.ceil(K / 2 / 4) * jv; sc_g = 4 * K * jv * 1.2
        ses = 10 * SESJA_START
        sr = war_sr + sed_sr + sc_sr + ses; g = war_g + sed_g + sc_g + ses * 1.5
        razem['sr'] += sr; razem['gor'] += g
        wiersze.append({'et': et, 'warianty': [round(war_sr, 2), round(war_g, 2)], 'per_wariant_gorna': {w: round(f['koszt'][w]['dzis_max'], 2) for w in '0ABC'},
                        'sedzia_x2': [round(sed_sr, 2), round(sed_g, 2)], 'K': K, 'sceptycy': [round(sc_sr, 2), round(sc_g, 2)], 'sesje': round(ses, 2),
                        'razem': [round(sr, 2), round(g, 2)]})
        L.append('  %-13s pliki kodu %2d | warianty %5.1f | %5.1f (0 %.1f, A %.1f, B %.1f, C %.1f) | sędzia ×2 %.1f | %.1f | K %2d, sceptycy %.1f | %.1f | sesje %.1f'
                 ' | RAZEM %5.1f | %5.1f' % (et, f['kod'], war_sr, war_g, *[f['koszt'][w]['dzis_max'] for w in '0ABC'], sed_sr, sed_g, K, sc_sr, sc_g, ses, sr, g))
    for et in FIX:
        w0 = 0.15 + fk['mediana'] * 0.6                        # pre-skan haiku + kontrola effort low
        a_, b_, c_ = fk['mediana'] * 1.1, 2 * fk['mediana'], fk['mediana'] * 1.3 * 1.2   # A K-1..K-7; B 2 próbki; C +30% list, high
        sed = 0.5
        sr = w0 + a_ + b_ + c_ + 2 * sed + 6 * SESJA_START; g = sr * 1.5
        razem['sr'] += sr; razem['gor'] += g
        wiersze.append({'et': et, 'razem': [round(sr, 2), round(g, 2)]})
        L.append('  %-13s moduł §2.6: 0 %.2f, A %.2f, B %.2f, C %.2f, sędzia ×2 %.1f, sesje %.2f | RAZEM %4.1f | %4.1f' % (et, w0, a_, b_, c_, 2 * sed, 6 * SESJA_START, sr, g))
    razem['sr'] += PROBA; razem['gor'] += PROBA
    limit = 1.5 * razem['gor']
    L += ['', '  próba harnessu: %.1f' % PROBA,
          '  PILOT RAZEM: środek %.1f M jedn., górna %.1f M jedn., TWARDY LIMIT %.0f M jedn. (skrypt przerywa po fazie, która go przekroczy)' % (
              razem['sr'], razem['gor'], limit),
          '  skala: jeden run autopilota 20.09 (3 fazy, cały pipeline) = 35,3 M jedn.; plan §2.3: pilot 26..56..66 + powtórka 8..18..22 + moduł ~4 (bez 2. sędziego,',
          '  sceptyków na kluczu 2 i sesji uruchamiających)']
    json.dump({'fazy': wiersze, 'srodek': round(razem['sr'], 1), 'gorna': round(razem['gor'], 1), 'limit': round(limit)},
              open(os.path.join(BASE, 'dane', 'test-review', 'koszt-pilota.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(BASE, 'dane', 'test-review', 'koszt-pilota.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
