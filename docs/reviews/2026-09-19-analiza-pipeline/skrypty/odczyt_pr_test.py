#!/usr/bin/env python3
"""Testy filtra runów PR w odczyt_pr.py (P20 S2). Uruchomienie: python3 -m unittest skrypty/odczyt_pr_test.py (z katalogu analizy)."""
import os, sys, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import odczyt_pr as O


def zbierz(run, numer, czesc=None):
    return {'run': run, 'pr': {'numer': numer, 'czesc': czesc, 'tura': 1}}


class RunyPr(unittest.TestCase):
    # vibersi etap 3: PR #3 (cz. 1) i PR #4 (cz. 2) w jednej sesji /dev-pr.
    def test_zbierz_tylko_z_numerem_tego_pr_bez_numeru_osobno(self):
        runy = [zbierz('a', 3, 1), zbierz('b', 4, 2), zbierz('c', None), {'run': 'd', 'pr': None}]
        z, bez, czesc, _ = O.runy_pr(runy, {}, 4)
        self.assertEqual(([r['run'] for r in z], [r['run'] for r in bez], czesc), (['b'], ['c'], 2))

    def test_koszt_po_czesci_z_args_runu_a_bez_czesci_cala_sesja(self):
        runy = [zbierz('a', 3, 1), zbierz('b', 4, 2), {'run': 'n', 'pr': None}, {'run': 'm', 'pr': None}]
        wyniki = {'a': {'args': {'czesc': 1}}, 'b': {'args': {'czesc': 2}}, 'n': {'args': {'etap': 'napraw', 'czesc': 2}},
                  'm': {'args': {'etap': 'merge'}}}
        self.assertEqual([r['run'] for r in O.runy_pr(runy, wyniki, 4)[3]], ['b', 'n'])
        jeden = [zbierz('x', 7), {'run': 'y', 'pr': None}]
        self.assertEqual([r['run'] for r in O.runy_pr(jeden, {}, 7)[3]], ['x', 'y'])


if __name__ == '__main__':
    unittest.main()
