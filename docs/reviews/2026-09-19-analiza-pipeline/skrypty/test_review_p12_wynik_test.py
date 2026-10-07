#!/usr/bin/env python3
"""Testy sum wyniku ślepego testu P12 po fazach (test_review_p12_wynik.py).

Uruchomienie: python3 -m unittest skrypty/test_review_p12_wynik_test.py (z katalogu analizy)."""
import json, os, sys, tempfile, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_review_p12 as P
import test_review_p12_wynik as W

MP = {'warianty': {'A': 'nowy', 'B': 'historyczny', 'C': 'stary'},
      'K': {'K1': {'zrodlo': 'klucz2', 'klasa': 'wartosc-graniczna', 'grupa': 'd10'}, 'K2': {'zrodlo': 'klucz1', 'klasa': 'tekst-ui', 'grupa': 'pokryte'},
            'K3': {'zrodlo': 'klucz1', 'klasa': 'x', 'grupa': 'inne'}}}


def sedzia(oceny):
    return P.wynik_sedziego({'oceny': [{'id': k, 'wariant': e, 'ocena': o, 'dowod': '', 'uzasadnienie': ''} for k, e, o in oceny]}, MP)


class SumaFaz(unittest.TestCase):
    def test_suma_razem_kluczy_i_grup_oraz_pary_z_etykieta_fazy(self):
        a = sedzia([('K1', 'A', 'ZAPOBIEZONY'), ('K1', 'C', 'OBECNY'), ('K2', 'A', 'OBECNY'), ('K2', 'C', 'OBECNY'), ('K3', 'A', 'ZAPOBIEZONY'), ('K3', 'C', 'ZAPOBIEZONY')])
        b = sedzia([('K1', 'A', 'OBECNY'), ('K1', 'C', 'ZAPOBIEZONY'), ('K2', 'A', 'ZAPOBIEZONY'), ('K2', 'C', 'ZAPOBIEZONY'), ('K3', 'A', 'BRAK_ODPOWIEDNIKA')])
        s = W.suma_faz({'f-a': a, 'f-b': b})
        self.assertEqual(s['nowy']['razem']['ZAPOBIEZONY'], 3)
        self.assertEqual(s['stary']['grupy']['d10'], {'OBECNY': 1, 'ZAPOBIEZONY': 1, 'BRAK_ODPOWIEDNIKA': 0, 'brak_oceny': 0})
        self.assertEqual(s['stary']['grupy']['inne']['brak_oceny'], 1)
        self.assertEqual(s['nowy']['klucz1']['ZAPOBIEZONY'], 2)
        self.assertEqual(s['pary']['tylko_nowy'], ['f-a K1'])
        self.assertEqual(s['pary']['tylko_stary'], ['f-b K1'])
        self.assertEqual(s['pary']['brak_odpowiednika'], ['f-b K3'])
        self.assertEqual(s['klucze'], 6)

    def test_linia_grup_ma_wszystkie_trzy_grupy_takze_pusta(self):
        s = W.suma_faz({'f-a': sedzia([('K1', 'A', 'ZAPOBIEZONY')])})
        self.assertEqual(W.linia_grup(s['nowy']), 'D10 0/1/0 | pokryte 0/0/0 | inne 0/0/0')


class Drzewa(unittest.TestCase):
    def test_drzewa_z_katalogu_fazy_albo_brak(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, 'f-a'))
            self.assertEqual(W.drzewa(d, 'f-a'), 'drzewa .claude: brak zapisu')
            with open(os.path.join(d, 'f-a', 'claude.json'), 'w') as f:
                json.dump({'stary': '81b755632ee3', 'nowy': '7bdab43f65c3', 'nowy_commit': '529408b0000', 'uwaga': 'D10 z c7598cf'}, f)
            self.assertEqual(W.drzewa(d, 'f-a'), 'drzewa .claude: stary 81b7556, nowy 7bdab43 (gałąź przy 529408b; D10 z c7598cf)')


if __name__ == '__main__':
    unittest.main()
