#!/usr/bin/env python3
"""Testy wyniku ślepego testu P11 po fazach (test_review_p11_wynik.py): sumy, CI bootstrapem po fazach, klucz 2 i szum per oś, koszt.

Uruchomienie: python3 -m unittest skrypty/test_review_p11_wynik_test.py (z katalogu analizy) albo python3 skrypty/test_review_p11_wynik_test.py."""
import os, sys, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_review_p11 as P
import test_review_p11_wynik as W


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


if __name__ == '__main__':
    unittest.main()
