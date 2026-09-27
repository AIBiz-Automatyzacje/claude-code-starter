#!/usr/bin/env python3
"""Test review — etap główny (HANDOFF 6a pkt 30): lista jednostek i przegląd klucza 2 przed startem. Zero agentów, zero tokenów.

Użycie:
  python3 skrypty/test_review_etap.py lista        — 13 pierwszych faz z `kolejnosc` (dane/test-review-plan.json) + wszystkie commity fixa z `fix_modul`
        (moduł §2.6) → dane/test-review/etap.{json,txt}: etykieta, sha, zadanie (katalog docs/active), numer fazy, rodzaj, czy zrobione w pilocie
        (znacznik ~/test-review/wyniki/<et>/_faza-ok), liczba kluczy; kontrola w lustrze ~/test-review/_mirror (tylko odczyt): plan techniczny
        zadania istnieje w stanie commitu, etykiety bez kolizji przedrostków. Kod 2 = kontrola nie przeszła. Pole `raport_fazy` (tylko informacja):
        czy review-faza-N.md jest w stanie commitu fixa — zwykle NIE (scribe commituje raport po fixie; tak samo w pilocie), więc kontrola
        fixa we wszystkich wariantach pracuje na samym diffie, a zdanie A/B/C „Findingi … raport review-faza-N.md” wskazuje plik nieobecny.
  python3 skrypty/test_review_etap.py koszt        — szacunek kosztu nowych jednostek metodą z pilota i licznik limitu na końcu → dane/test-review/etap-koszt.{txt,json}
  python3 skrypty/test_review_etap.py pola <et>    — „<sha10> <zadanie>” dla test_review_uruchom.sh
  python3 skrypty/test_review_etap.py klucz2       — pozycje klucza 2 faz etapu spoza przeglądu pilota (dane/test-review/klucz2-przeglad.json)
        z sygnałami duplikatu (ten sam plik:linia, wiersz bez nagłówka) → dane/test-review/klucz2-etap.txt do przeglądu w sesji głównej.

Kolejność jednostek: najpierw fazy (wartość malejąco, jak `kolejnosc`), potem commity fixa — przy zatrzymaniu na limicie zostają pełne fazy.
Temat commitu fixa: „poprawki po review fazy N” albo „kontrola diffu naprawczego fazy N” (4 commity kontroli — replay tej samej kontroli na ich diffie)."""
import json, os, re, subprocess, sys

sys.dont_write_bytecode = True
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = os.path.expanduser('~/test-review')
MIR = os.path.join(TR, '_mirror')
OUT = os.path.join(BASE, 'dane', 'test-review')
LICZBA_FAZ = 13   # 6a pkt 30(a): zakres 50% przypadków = 13 pierwszych faz z `kolejnosc`
RE_NUMER = re.compile(r'(?:po review|kontrola diffu naprawczego) fazy (\d+)')
# zakres tematu commitu fixa → katalog zadania (jak test_review_klucz2.ZADANIA; „faza 8/N” i „samodzielna-rejestracja” to skróty z tematów)
ZADANIA = [('faza-1', 'faza-1-fundament'), ('faza-2', 'faza-2-publikacja-ofert'), ('faza-3', 'faza-3-konto-i-dashboard'),
           ('faza-4', 'faza-4-tracking-i-widok-oferty'), ('faza-5', 'faza-5-heatmapa'), ('siatka', 'siatka-heatmapy-proporcjonalna'),
           ('faza-6', 'faza-6-cta-i-webhooki'), ('faza-7', 'faza-7-szablony-i-grafiki'), ('faza 8', 'faza-8-connector-oauth-i-dashboard'),
           ('faza-9a', 'faza-9a-domena-mailer-limity'), ('faza-9b', 'faza-9b-wielu-uzytkownikow'), ('faza-9c', 'faza-9c-dokumenty-prawne'),
           ('samodzielna', 'samodzielna-rejestracja-czlonkow-aa')]


def git(*a):
    return subprocess.run(['git', '-C', MIR, *a], capture_output=True, text=True).stdout.strip()


def jest_w_commicie(sha, sciezka):
    return subprocess.run(['git', '-C', MIR, 'cat-file', '-e', '%s:%s' % (sha, sciezka)], capture_output=True).returncode == 0


def zadanie(temat):
    m = re.match(r'^fix\(([^)]*)\)', temat)
    zakres = m.group(1) if m else ''
    return next((kat for pref, kat in ZADANIA if zakres.startswith(pref)), None)


def jednostki():
    plan = json.load(open(os.path.join(BASE, 'dane', 'test-review-plan.json')))
    fazy = json.load(open(os.path.join(BASE, 'dane', 'test-review-fazy.json')))['fazy']
    k2 = json.load(open(os.path.join(BASE, 'dane', 'test-review-klucz2.json')))
    wyn = []
    for sha in plan['kolejnosc'][:LICZBA_FAZ]:
        f = fazy[sha]
        wyn.append({'et': 'f-' + sha[:7], 'sha': sha, 'rodzaj': 'faza', 'temat_fix': f['temat_fix'], 'zadanie': zadanie(f['temat_fix']),
                    'numer': f['numer'], 'klucz1': len(f['przypadki']), 'klucz2': len(k2[sha]['p12'])})
    for sha, ids in plan['fix_modul'].items():
        temat = git('log', '-1', '--format=%s', sha)
        m = RE_NUMER.search(temat)
        wyn.append({'et': 'x-' + sha[:7], 'sha': sha, 'rodzaj': 'kontrola' if 'kontrola diffu' in temat else 'fix', 'temat_fix': temat,
                    'zadanie': zadanie(temat), 'numer': int(m.group(1)) if m else None, 'klucz1': len(ids), 'klucz2': 0})
    return wyn


def kontrola(j, wszystkie):
    bledy = []
    if not j['zadanie']: bledy.append('brak zadania dla tematu')
    if j['numer'] is None: bledy.append('brak numeru fazy w temacie')
    if bledy: return bledy
    kat = 'docs/active/%s/' % j['zadanie']
    if not jest_w_commicie(j['sha'], kat + j['zadanie'] + '-plan.md'): bledy.append('brak planu %s w stanie commitu' % kat)
    if j['rodzaj'] != 'faza': j['raport_fazy'] = jest_w_commicie(j['sha'], kat + 'review-faza-%d.md' % j['numer'])
    kolizje = [o['et'] for o in wszystkie if o['et'] != j['et'] and o['et'].startswith(j['et'])]
    if kolizje: bledy.append('etykieta jest przedrostkiem %s' % kolizje)
    return bledy


def lista():
    wyn = jednostki()
    L = ['test_review_etap.py lista — etap główny: %d faz + %d commitów fixa (moduł §2.6); pilot = znacznik _faza-ok w ~/test-review/wyniki'
         % (sum(j['rodzaj'] == 'faza' for j in wyn), sum(j['rodzaj'] != 'faza' for j in wyn))]
    zle = 0
    for j in wyn:
        j['z_pilota'] = os.path.exists(os.path.join(TR, 'wyniki', j['et'], '_faza-ok'))
        j['bledy'] = kontrola(j, wyn)
        zle += bool(j['bledy'])
        L.append('  %-10s %-8s faza %-2s %-38s klucz1 %d klucz2 %2d%s%s%s' % (
            j['et'], j['rodzaj'], j['numer'], j['zadanie'], j['klucz1'], j['klucz2'],
            '' if j['rodzaj'] == 'faza' else ('  raport fazy: ' + ('jest' if j.get('raport_fazy') else 'brak')),
            '  [pilot — pomijana]' if j['z_pilota'] else '',
            ('  BŁĄD: ' + '; '.join(j['bledy'])) if j['bledy'] else ''))
    nowe = [j for j in wyn if not j['z_pilota']]
    L.append('RAZEM: jednostek %d, z pilota %d, do uruchomienia %d (faz %d, fixa %d); klucz1 %d (nowe %d), klucz2 %d (nowe %d); '
             'commity fixa z raportem fazy w stanie commitu %d z %d; błędów kontroli %d' % (
        len(wyn), len(wyn) - len(nowe), len(nowe), sum(j['rodzaj'] == 'faza' for j in nowe), sum(j['rodzaj'] != 'faza' for j in nowe),
        sum(j['klucz1'] for j in wyn), sum(j['klucz1'] for j in nowe), sum(j['klucz2'] for j in wyn), sum(j['klucz2'] for j in nowe),
        sum(bool(j.get('raport_fazy')) for j in wyn), sum(j['rodzaj'] != 'faza' for j in wyn), zle))
    os.makedirs(OUT, exist_ok=True)
    json.dump(wyn, open(os.path.join(OUT, 'etap.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, 'etap.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))
    return 2 if zle else 0


def koszt():
    """Szacunek przed startem metodą z pilota (test_review_pilot.przeliczenie): faza = szacunek „dziś” wariantów × proporcja zmierzona w pilocie
    + narzut na fazę; commit fixa = średni koszt commitu fixa w pilocie. Środek = średnia proporcja, górna = największa proporcja i narzut ×1,5.
    Licznik limitu (test_review_wynik.py limit) liczy też jednostki pilota ze zmierzonym kosztem (w tym druga permutacja i odrzucona próba)."""
    plan = {f['faza']: f for f in json.load(open(os.path.join(BASE, 'dane', 'test-review-plan.json')))['fazy']}
    pk = json.load(open(os.path.join(OUT, 'pilot-koszt.json')))
    eg = pk['etap_glowny']
    p_sr, p_max, narzut = eg['srednia_proporcja'], max(eg['proporcja_wariantow']), eg['narzut_na_faze']
    zmierzone = {f['et']: f['zmierzony'] for f in pk['fazy']}
    fix_sr = sum(v for et, v in zmierzone.items() if et.startswith('x-')) / sum(et.startswith('x-') for et in zmierzone)
    wyn, sr, gora, pilot = [], 0.0, 0.0, 0.0
    for j in json.load(open(os.path.join(OUT, 'etap.json'))):
        if j['z_pilota']:
            pilot += zmierzone[j['et']]; wyn.append({'et': j['et'], 'pilot': zmierzone[j['et']]}); continue
        if j['rodzaj'] == 'faza':
            dzis = sum(v['dzis'] for v in plan[j['sha']]['koszt'].values())
            s, g = dzis * p_sr + narzut, dzis * p_max + 1.5 * narzut
        else:
            s, g = fix_sr, 1.5 * fix_sr
        sr += s; gora += g
        wyn.append({'et': j['et'], 'srodek': round(s, 2), 'gorna': round(g, 2)})
    import test_review_wynik
    LIMIT = test_review_wynik.LIMITY['50%']
    L =['test_review_etap.py koszt — szacunek etapu głównego [M jedn., cennik d4r] metodą z pilota (dane/test-review/pilot-koszt.json)',
         '  proporcja wariantów do szacunku „dziś”: średnia %.3f, największa %.3f; narzut na fazę %.2f M; commit fixa (średnia pilota) %.2f M'
         % (p_sr, p_max, narzut, fix_sr)]
    L += ['  %-10s %s' % (x['et'], ('pilot: zmierzone %.2f' % x['pilot']) if 'pilot' in x else ('środek %.2f  górna %.2f' % (x['srodek'], x['gorna'])))
          for x in wyn]
    L.append('NOWE jednostki: środek %.1f, górna %.1f M; jednostki pilota w liczniku limitu %.1f M' % (sr, gora, pilot))
    L.append('LICZNIK LIMITU na końcu etapu: środek %.1f, górna %.1f M vs limit %.0f M (6a pkt 30(d))' % (sr + pilot, gora + pilot, LIMIT))
    json.dump({'jednostki': wyn, 'nowe_srodek': round(sr, 1), 'nowe_gorna': round(gora, 1), 'pilot_w_liczniku': round(pilot, 1),
               'licznik_srodek': round(sr + pilot, 1), 'licznik_gorna': round(gora + pilot, 1), 'limit': LIMIT},
              open(os.path.join(OUT, 'etap-koszt.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, 'etap-koszt.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))


def pola(et):
    j = [x for x in json.load(open(os.path.join(OUT, 'etap.json'))) if x['et'] == et]
    if not j: raise SystemExit('brak %s w dane/test-review/etap.json' % et)
    print(j[0]['sha'], j[0]['zadanie'])


def klucz2():
    przeglad = json.load(open(os.path.join(OUT, 'klucz2-przeglad.json')))
    k2 = json.load(open(os.path.join(BASE, 'dane', 'test-review-klucz2.json')))
    L = ['test_review_etap.py klucz2 — pozycje klucza 2 do przeglądu (fazy etapu poza przejrzanymi w pilocie); '
         'sygnały: DUPLIKAT_MIEJSCA = ten sam plik:linia co wcześniejsza pozycja, BEZ_NAGLOWKA = wiersz spoza nagłówka ###/####']
    n = 0
    for j in json.load(open(os.path.join(OUT, 'etap.json'))):
        if j['rodzaj'] != 'faza' or j['sha'] in przeglad['przejrzane_fazy']: continue
        r = k2[j['sha']]
        L.append('\n== %s (%s) — %s' % (j['et'], j['sha'], r['raport']))
        widziane = {}
        for i, x in enumerate(r['p12']):
            syg = []
            if x['plik'] in widziane: syg.append('DUPLIKAT_MIEJSCA #%d' % widziane[x['plik']])
            if not x['wiersz'].startswith('#'): syg.append('BEZ_NAGLOWKA')
            widziane.setdefault(x['plik'], i + 1)
            L.append('  %s#%d %s %s | %s%s' % (j['sha'], i + 1, x['waga'], x['plik'], x['wiersz'][:160], ('  <<' + ', '.join(syg)) if syg else ''))
            n += 1
    L.append('\nRAZEM pozycji do przeglądu: %d' % n)
    open(os.path.join(OUT, 'klucz2-etap.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    t = sys.argv[1] if len(sys.argv) > 1 else ''
    if t == 'lista': sys.exit(lista())
    elif t == 'koszt': koszt()
    elif t == 'pola': pola(sys.argv[2])
    elif t == 'klucz2': klucz2()
    else: raise SystemExit(__doc__)
