#!/usr/bin/env python3
"""Testy harnessu ślepego testu P11 (test_review_p11.py): wycinanie workflowu, nakładka .claude, pula sędziego, metryki.

Uruchomienie: python3 -m unittest skrypty/test_review_p11_test.py (z katalogu analizy) albo python3 skrypty/test_review_p11_test.py."""
import json, os, subprocess, sys, tempfile, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_review_p11 as P
import test_review_p11_wynik as W

SKRYPTY = os.path.dirname(os.path.abspath(__file__))
SZ = os.path.abspath(os.path.join(SKRYPTY, '..', '..', '..', '..'))
WORKFLOW = '.claude/workflows/dev-docs-review-wf.js'
DOSSIER = {'diffStat': '2 plikow, +40 −3', 'pliki': [{'plik': 'apps/server/src/a.ts', 'czegoDotyczy': 'zmieniony (+30 −3)'},
                                                    {'plik': 'apps/server/src/a.test.ts', 'czegoDotyczy': 'dodany (+10)'}],
           'warstwy': {'ui': False, 'dane': True, 'typowanie': True, 'nowyModul': False}, 'e2eCheckboxy': 2, 'figmaScreens': False,
           'diffPlik': '/x/review-diff.diff', 'diffZapisany': True, 'diffUciety': False, 'ctxPlik': '/x/review-ctx.md', 'ctxZapisany': True,
           'preSkan': []}
ARGS = {'sciezka': 'docs/active/zadanie', 'faza': 2, 'srodowiskoE2E': 'pominieto', 'baza': 'abc1234', 'dossier': DOSSIER}


def zrodlo(ref):
    """Workflow review z gałęzi albo z main (wariant stary) — ten sam plik, który harness tnie przed testem."""
    return subprocess.run(['git', '-C', SZ, 'show', '%s:%s' % (ref, WORKFLOW)], capture_output=True, text=True, check=True).stdout


def suchy_bieg(js):
    """Suchy bieg skryptu z atrapą agent() bez args sesji (args są wklejone w skrypt) → (etykiety agentów, liczba findingów)."""
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(js)
    try:
        out = subprocess.run(['node', os.path.join(SKRYPTY, 'test_review_suchy_bieg.mjs'), f.name], capture_output=True, text=True, check=True).stdout
    finally:
        os.unlink(f.name)
    agenci = out.split('agenci: ', 1)[1].split('\n', 1)[0].split(' | ')
    return agenci, int(out.split('findingów zwróconych ', 1)[1].split('\n', 1)[0])


class Wariant(unittest.TestCase):
    def test_nowy_wariant_konczy_sie_po_dedupie_bez_testera_e2e_i_bez_zapasowego_dossier(self):
        js, _ = P.wariant(zrodlo('popr/P11-reviewerzy'), ARGS, 'nowy')
        agenci, findingi = suchy_bieg(js)
        osie = sorted(a.split(' ')[0] for a in agenci if a.startswith('review:'))
        self.assertEqual(osie, ['review:code-quality', 'review:correctness', 'review:performance', 'review:security',
                                'review:spec-compliance', 'review:test-coverage'])
        self.assertIn('review:test-coverage effort=medium', agenci)
        self.assertEqual(agenci[-1], 'dedup:semantyczny')
        self.assertNotIn('verify', ' '.join(agenci))
        self.assertGreater(findingi, 0)

    def test_stary_wariant_z_main_ma_wlasny_sklad_i_efort(self):
        js, _ = P.wariant(zrodlo('main'), ARGS, 'stary')
        agenci, _ = suchy_bieg(js)
        self.assertIn('review:test-coverage effort=high', agenci)
        self.assertFalse(any(a.startswith(('dossier:zapas', 'review:e2e')) for a in agenci))

    def test_tresc_do_verify_bajt_w_bajt_poza_wylaczeniem_testera(self):
        src = zrodlo('popr/P11-reviewerzy')
        _, kontrola = P.wariant(src, ARGS, 'nowy')
        self.assertTrue(kontrola['przechodzi'], kontrola)
        self.assertEqual(kontrola['roznice'], [P.WYLACZ_TESTERA.strip()])
        self.assertEqual(kontrola['zrodlo_sha'], P.sha(src))

    def test_zrodlo_bez_verify_albo_bez_routingu_testera_odmawia(self):
        src = zrodlo('popr/P11-reviewerzy')
        with self.assertRaises(ValueError):
            P.wariant(src.replace("\nphase('Verify')\n", '\n'), ARGS, 'nowy')
        with self.assertRaises(ValueError):
            P.wariant(src.replace('function trybTesteraE2e(', 'function trybE2e('), ARGS, 'nowy')


def zapisz(katalog, pliki):
    for sciezka, tresc in pliki.items():
        p = os.path.join(katalog, sciezka)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w') as f: f.write(tresc)


def git(k, *a):
    return subprocess.run(['git', '-C', k, *a], capture_output=True, text=True, check=True).stdout


class Nakladka(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.kopia = os.path.join(self.tmp.name, 'kopia')
        zapisz(self.kopia, {'.claude/agents/security.md': 'epoka', '.claude/agents/kieran.md': 'epoka',
                            '.claude/rules/learned-patterns.md': 'wiedza epoki', 'src/a.ts': 'kod'})
        git(self.kopia, 'init', '-q')
        git(self.kopia, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.')
        git(self.kopia, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'epoka')
        self.stary, self.nowy = os.path.join(self.tmp.name, 'stary'), os.path.join(self.tmp.name, 'nowy')
        zapisz(self.stary, {'.claude/agents/security.md': 'stary', '.claude/agents/simplicity.md': 'stary',
                            '.claude/rules/learned-patterns.md': 'wiedza z przyszlosci'})
        zapisz(self.nowy, {'.claude/agents/security.md': 'nowy', '.claude/agents/correctness.md': 'nowy'})

    def tearDown(self):
        self.tmp.cleanup()

    def czytaj(self, sciezka):
        p = os.path.join(self.kopia, sciezka)
        if not os.path.exists(p): return None
        with open(p) as f: return f.read()

    def test_kolejne_nakladki_daja_dokladnie_claude_wariantu_przy_czystym_git_status(self):
        P.nakladka(self.kopia, self.stary)
        self.assertEqual(git(self.kopia, 'status', '--porcelain'), '')
        self.assertEqual([self.czytaj('.claude/agents/' + n) for n in ('security.md', 'simplicity.md', 'kieran.md')], ['stary', 'stary', None])
        wynik = P.nakladka(self.kopia, self.nowy)
        self.assertEqual(git(self.kopia, 'status', '--porcelain'), '')
        self.assertEqual([self.czytaj('.claude/agents/' + n) for n in ('security.md', 'correctness.md', 'simplicity.md')], ['nowy', 'nowy', None])
        self.assertEqual(self.czytaj('.claude/rules/learned-patterns.md'), 'wiedza epoki')
        self.assertEqual(wynik['agenci'], ['correctness.md', 'security.md'])

    def test_brak_katalogu_wariantu_odmawia_bez_ruszania_kopii(self):
        with self.assertRaises(FileNotFoundError):
            P.nakladka(self.kopia, os.path.join(self.tmp.name, 'brak'))
        self.assertEqual(self.czytaj('.claude/agents/kieran.md'), 'epoka')


KLUCZE = {'klucze': [{'id': 'K1', 'zrodlo': 'klucz1', 'przypadek': 'B-1', 'waga': 'P2', 'plik': 'src/a.ts', 'linia': 12, 'wycinek': '', 'streszczenie': 's',
                      'tresc': 't'}], 'inne_uwagi_bota': []}


def finding(i, os_):
    return {'severity': 'P2', 'typ': 'KOD', 'plik': 'src/a.ts:%d' % (10 + i), 'opis': 'defekt %d' % i, 'scenariusz': 'wejscie %d' % i, '_zrodlo': os_}


WYNIKI = {'stary': [finding(i, 'security') for i in range(6)], 'nowy': [finding(i + 6, 'performance') for i in range(6)]}


class Pula(unittest.TestCase):
    def test_kazdy_finding_obu_wariantow_raz_z_neutralnym_id_bez_sladu_wariantu(self):
        F, mapowanie, prompt = P.pula_sedziego(KLUCZE, WYNIKI, 'f-x', 1)
        self.assertEqual([f['id'] for f in F], ['F%d' % i for i in range(1, 13)])
        self.assertEqual(sorted((m['wariant'], m['indeks']) for m in mapowanie['F'].values()),
                         sorted((w, i) for w in P.WARIANTY for i in range(6)))
        self.assertEqual({k for f in F for k in f if k != 'id'}, {'plik', 'linia', 'waga', 'opis', 'scenariusz'})
        for slad in ('stary', 'nowy', 'security', 'performance', 'wariant'):
            self.assertNotIn(slad, prompt.split('=== PULA F ===')[1])
        self.assertEqual(mapowanie['F']['F1']['linia'], F[0]['linia'])

    def test_permutacja_z_ziarnem_miesza_warianty_i_jest_powtarzalna(self):
        kolejnosc = lambda perm: [mp['wariant'] + str(mp['indeks']) for _, mp in sorted(P.pula_sedziego(KLUCZE, WYNIKI, 'f-x', perm)[1]['F'].items(),
                                                                                         key=lambda x: int(x[0][1:]))]
        self.assertEqual(kolejnosc(1), kolejnosc(1))
        self.assertNotEqual(kolejnosc(1), kolejnosc(2))
        self.assertNotEqual(kolejnosc(1)[:6], ['stary%d' % i for i in range(6)])

    def test_brak_wyniku_wariantu_odmawia(self):
        with self.assertRaises(ValueError):
            P.pula_sedziego(KLUCZE, {'stary': WYNIKI['stary']}, 'f-x', 1)


MAPOWANIE = {'F': {'F1': {'wariant': 'stary', 'os': 'security', 'waga': 'P2'}, 'F2': {'wariant': 'nowy', 'os': 'security', 'waga': 'P2'},
                   'F3': {'wariant': 'stary', 'os': 'performance', 'waga': 'P2'}, 'F4': {'wariant': 'nowy', 'os': 'code-quality', 'waga': 'P2'},
                   'F5': {'wariant': 'stary', 'os': 'code-quality', 'waga': 'P3'}},
             'K': {'K1': {'zrodlo': 'klucz1', 'waga': 'P2'}, 'K2': {'zrodlo': 'klucz2', 'waga': 'P1'}, 'K3': {'zrodlo': 'klucz1', 'waga': 'P2'}}}
SEDZIA = {'klucze': [{'id': 'K1', 'obecny': 'TAK', 'dopasowania': [{'f': 'F1', 'ocena': 'PEŁNE'}, {'f': 'F2', 'ocena': 'CZĘŚCIOWE'}]},
                     {'id': 'K2', 'obecny': 'TAK', 'dopasowania': [{'f': 'F3', 'ocena': 'PEŁNE'}]},
                     {'id': 'K3', 'obecny': 'NIE', 'dopasowania': [{'f': 'F4', 'ocena': 'PEŁNE'}]}],
          'bez_dopasowania': [{'f': 'F4', 'kategoria': 'POZA_KLUCZEM', 'uwaga': None}, {'f': 'F5', 'kategoria': 'POZA_KLUCZEM', 'uwaga': None}]}


class Zlapania(unittest.TestCase):
    def test_zlapania_per_wariant_i_os_tylko_na_kluczach_obecnych(self):
        z = P.zlapania(SEDZIA, MAPOWANIE)
        self.assertEqual(z['stary']['klucz1'], {'obecne': 1, 'pelne': 1, 'szeroko': 1})
        self.assertEqual(z['nowy']['klucz1'], {'obecne': 1, 'pelne': 0, 'szeroko': 1})
        self.assertEqual((z['stary']['klucz2']['szeroko'], z['nowy']['klucz2']['szeroko']), (1, 0))
        self.assertEqual(z['pary']['klucz2'], {'tylko_stary': ['K2'], 'tylko_nowy': [], 'oba': []})
        self.assertEqual(z['pary']['klucz1']['oba'], ['K1'])
        self.assertEqual(z['stary']['osie_klucz2'], {'performance': 1})
        self.assertEqual(z['nowy']['szum'], {'poza_kluczem': 1, 'p1p2': 1})
        self.assertEqual(z['stary']['szum'], {'poza_kluczem': 1, 'p1p2': 0})

    def test_osie_per_klucz_i_szum_per_os(self):
        z = P.zlapania(SEDZIA, MAPOWANIE)
        self.assertEqual(z['klucze']['K1'], {'zrodlo': 'klucz1', 'stary': ['security'], 'nowy': ['security']})
        self.assertEqual(z['klucze']['K2'], {'zrodlo': 'klucz2', 'stary': ['performance'], 'nowy': None})
        self.assertNotIn('K3', z['klucze'])
        self.assertEqual(z['nowy']['szum_osie'], {'code-quality': {'poza_kluczem': 1, 'p1p2': 1}})
        self.assertEqual(z['stary']['szum_osie'], {'code-quality': {'poza_kluczem': 1, 'p1p2': 0}})

    def test_klucz_spoza_mapowania_odmawia(self):
        with self.assertRaises(KeyError):
            P.zlapania({'klucze': [{'id': 'K9', 'obecny': 'TAK', 'dopasowania': []}], 'bez_dopasowania': []}, MAPOWANIE)


def faza_testu(k2_stary, k2_nowy, k1=(1, 1)):
    """Złapania jednej fazy w kształcie P.zlapania: klucz 2 jako lista osi per klucz (None = wariant nie łapie)."""
    z = {w: {'klucz1': {'obecne': 2, 'pelne': k1[i], 'szeroko': k1[i]}, 'klucz2': {'obecne': len(k2_stary), 'pelne': 0, 'szeroko': 0},
             'szum_osie': {}} for i, w in enumerate(P.WARIANTY)}
    z['klucze'] = {}
    for n, (s, nw) in enumerate(zip(k2_stary, k2_nowy)):
        z['klucze']['K%d' % n] = {'zrodlo': 'klucz2', 'stary': s, 'nowy': nw}
        for w, osie in (('stary', s), ('nowy', nw)):
            z[w]['klucz2']['szeroko'] += osie is not None
    return z


class Wynik(unittest.TestCase):
    def test_sumy_po_fazach_per_wariant_i_klucz(self):
        fazy = {'f-a': faza_testu([['security'], None], [['security'], ['correctness']], k1=(0, 1)),
                'f-b': faza_testu([['performance']], [None], k1=(2, 1))}
        s = W.sumy(fazy)
        self.assertEqual(s['stary']['klucz1'], {'obecne': 4, 'pelne': 2, 'szeroko': 2})
        self.assertEqual(s['nowy']['klucz2'], {'obecne': 3, 'pelne': 0, 'szeroko': 2})
        self.assertEqual(s['stary']['klucz2']['szeroko'], 2)

    def test_roznica_nowy_minus_stary_w_pkt_z_ci_bootstrapem_po_fazach(self):
        # fazy (obecne, stary, nowy): łącznie 10 kluczy, stary 6, nowy 4 → −20 pkt
        r = W.roznica([(5, 4, 2), (3, 1, 1), (2, 1, 1)])
        self.assertEqual(r['roznica'], -20.0)
        self.assertEqual(r['fazy'], 3)
        self.assertLessEqual(r['ci95'][0], r['roznica'])
        self.assertGreaterEqual(r['ci95'][1], r['roznica'])
        self.assertLess(r['ci95'][0], r['ci95'][1])
        self.assertEqual(r, W.roznica([(5, 4, 2), (3, 1, 1), (2, 1, 1)]))

    def test_klucz2_per_os_odroznia_strate_realna_od_przeniesienia_do_innej_osi(self):
        fazy = {'f-a': faza_testu([['security'], ['security'], ['performance'], None],
                                  [['security', 'correctness'], ['correctness'], None, ['performance']]),
                'f-b': faza_testu([['security']], [None])}
        o = W.klucz2_osie(fazy)
        self.assertEqual({k: o['security'][k] for k in ('klucze', 'stary', 'nowy', 'strata_realna', 'przeniesione', 'zysk_realny')},
                         {'klucze': 3, 'stary': 3, 'nowy': 1, 'strata_realna': 1, 'przeniesione': 1, 'zysk_realny': 0})
        self.assertEqual(o['security']['roznica']['roznica'], round(100 * (1 - 3) / 3, 1))
        self.assertEqual({k: o['performance'][k] for k in ('klucze', 'stary', 'nowy', 'strata_realna', 'zysk_realny')},
                         {'klucze': 2, 'stary': 1, 'nowy': 1, 'strata_realna': 1, 'zysk_realny': 1})
        self.assertEqual((o['correctness']['stary'], o['correctness']['nowy'], o['correctness']['zysk_realny']), (0, 2, 0))

    def test_szum_per_os_sumowany_po_fazach(self):
        a, b = faza_testu([], []), faza_testu([], [])
        a['nowy']['szum_osie'] = {'test-coverage': {'poza_kluczem': 3, 'p1p2': 2}}
        b['nowy']['szum_osie'] = {'test-coverage': {'poza_kluczem': 1, 'p1p2': 1}, 'security': {'poza_kluczem': 2, 'p1p2': 0}}
        s = W.szum_osie({'f-a': a, 'f-b': b})
        self.assertEqual(s['nowy'], {'security': {'poza_kluczem': 2, 'p1p2': 0}, 'test-coverage': {'poza_kluczem': 4, 'p1p2': 3}})
        self.assertEqual(s['stary'], {})

    def test_szum_z_mutantow_to_p1_p2_test_coverage_poza_kluczem_z_id_mutanta_w_opisie(self):
        mapowanie = {'F': {'F1': {'wariant': 'nowy', 'indeks': 0, 'os': 'test-coverage', 'waga': 'P2'},
                           'F2': {'wariant': 'nowy', 'indeks': 1, 'os': 'test-coverage', 'waga': 'P2'},
                           'F3': {'wariant': 'nowy', 'indeks': 2, 'os': 'test-coverage', 'waga': 'P3'},
                           'F4': {'wariant': 'stary', 'indeks': 0, 'os': 'security', 'waga': 'P2'},
                           'F5': {'wariant': 'stary', 'indeks': 1, 'os': 'test-coverage', 'waga': 'P2'}}}
        sedzia = {'bez_dopasowania': [{'f': f, 'kategoria': 'POZA_KLUCZEM'} for f in ('F1', 'F2', 'F3', 'F4')]
                  + [{'f': 'F5', 'kategoria': 'DUPLIKAT'}]}
        wyniki = {'nowy': [{'opis': 'Mutanty M30–M68 są NoCoverage'}, {'opis': 'Test sprawdza tylko kształt'}, {'opis': 'Mutant M19 przeżył'}],
                  'stary': [{'opis': 'Mutant M2 w bramce'}, {'opis': 'M11 przeżywa'}]}
        self.assertEqual(W.szum_mutantow(sedzia, mapowanie, wyniki), {'stary': 0, 'nowy': 1})

    def test_koszt_znajdowania_razem_per_os_i_na_zlapany_klucz(self):
        koszt = lambda cq, sec, dedup: {'agenci': cq + sec + dedup, 'role': {'review:code-quality': cq, 'review:security': sec, 'dedup:semantyczny': dedup}}
        fazy = {'f-a': faza_testu([['security']], [['security']], k1=(1, 0)), 'f-b': faza_testu([None], [['security']], k1=(0, 1))}
        koszty = {'f-a': {'stary': koszt(0.5, 0.3, 0.2), 'nowy': koszt(0.4, 0.2, 0.1)}, 'f-b': {'stary': koszt(0.5, 0.3, 0.2), 'nowy': koszt(0.4, 0.2, 0.1)}}
        k = W.koszt(fazy, koszty)
        self.assertEqual((k['stary']['znajdowanie'], k['nowy']['znajdowanie']), (2.0, 1.4))
        self.assertEqual(k['nowy']['osie'], {'code-quality': 0.8, 'security': 0.4})
        self.assertEqual((k['stary']['na_zlapany_klucz'], k['nowy']['na_zlapany_klucz']), (round(2.0 / 2, 3), round(1.4 / 3, 3)))
        self.assertEqual(k['zmiana_procent'], -30.0)

    def test_podsumowanie_roznice_kluczy_szeroko_i_pelne_z_jednostek_faz(self):
        fazy = {'f-a': faza_testu([['security'], ['security']], [['security'], None], k1=(0, 1)), 'f-b': faza_testu([None], [['security']], k1=(1, 1))}
        fazy['f-a']['nowy']['klucz2']['pelne'] = 1
        p = W.podsumowanie(fazy)
        self.assertEqual(p['roznice']['klucz2']['szeroko'], W.roznica([(2, 2, 1), (1, 0, 1)]))
        self.assertEqual(p['roznice']['klucz2']['pelne'], W.roznica([(2, 0, 1), (1, 0, 0)]))
        self.assertEqual(p['roznice']['klucz1']['szeroko']['roznica'], 25.0)
        self.assertEqual(sorted(p), ['klucz2_osie', 'roznice', 'sumy', 'szum_osie'])

    def test_roznica_bez_rozrzutu_miedzy_fazami_ma_ci_w_punkcie_a_bez_kluczy_brak_wyniku(self):
        self.assertEqual(W.roznica([(2, 2, 1), (2, 2, 1)])['ci95'], [-50.0, -50.0])
        self.assertIsNone(W.roznica([(0, 0, 0)]))


class Kolejnosc(unittest.TestCase):
    def test_kolejnosc_wariantow_powtarzalna_i_rozna_miedzy_fazami(self):
        fazy = ['f-b8374c8', 'f-303ff62', 'f-1de5a4c', 'f-32975a1', 'f-b26128d', 'f-2536643', 'f-46be55a']
        self.assertEqual(P.kolejnosc('f-x'), P.kolejnosc('f-x'))
        self.assertTrue(all(sorted(P.kolejnosc(et)) == sorted(P.WARIANTY) for et in fazy))
        self.assertEqual({P.kolejnosc(et)[0] for et in fazy}, set(P.WARIANTY))


if __name__ == '__main__':
    unittest.main()
