#!/usr/bin/env python3
"""Testy harnessu ślepego testu P12 (test_review_p12.py): wariant execute-wf, kopia na bazie fazy, ustawienia sesji, sędzia obecności defektu.

Uruchomienie: python3 -m unittest skrypty/test_review_p12_test.py (z katalogu analizy)."""
import json, os, re, subprocess, sys, tempfile, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_review_p12 as P

SKRYPTY = os.path.dirname(os.path.abspath(__file__))
SZ = os.path.abspath(os.path.join(SKRYPTY, '..', '..', '..', '..'))
ARGS = {'sciezka': 'docs/active/zadanie', 'faza': 2}


def zapisz(p, t):
    with open(p, 'w') as f: f.write(t)


def zrodlo(ref, plik='.claude/workflows/dev-docs-execute-wf.js'):
    return subprocess.run(['git', '-C', SZ, 'show', '%s:%s' % (ref, plik)], capture_output=True, text=True, check=True).stdout


def suchy_bieg(js):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(js)
    try:
        return subprocess.run(['node', os.path.join(SKRYPTY, 'test_review_p12_suchy_bieg.mjs'), f.name], capture_output=True, text=True, check=True).stdout
    finally:
        os.unlink(f.name)


class WariantBuild(unittest.TestCase):
    def test_cialo_workflowu_bajt_w_bajt_z_args_wklejonymi(self):
        for ref in ('main', 'HEAD'):
            js, k = P.wariant_build(zrodlo(ref), ARGS, 'x')
            self.assertTrue(k['przechodzi'], ref)
            self.assertIn('const ARGS_TESTU = ' + json.dumps(ARGS), js)
            self.assertTrue(js.startswith('export const meta = {'))

    def test_suchy_bieg_planner_buildery_domkniecie_z_args_testu(self):
        for ref in ('main', 'HEAD'):
            out = suchy_bieg(P.wariant_build(zrodlo(ref), ARGS, 'x')[0])
            self.assertIn('planner:faza-2 effort=medium | build:IU-1 effort=high | build:IU-2 effort=high | domkniecie:faza-2 effort=medium', out, ref)
            self.assertIn('"status":"completed"', out)

    def test_bez_jednego_bloku_meta_odmawia(self):
        with self.assertRaises(ValueError):
            P.wariant_build('const x = 1\n', ARGS, 'x')


class WariantReview(unittest.TestCase):
    def test_review_z_main_uciety_przed_verify_z_nazwa_testu_p12(self):
        js, k = P.wariant_review(zrodlo('main', '.claude/workflows/dev-docs-review-wf.js'), dict(ARGS, baza='abc1234', srodowiskoE2E='pominieto',
                                                                                            dossier={'pliki': []}), 'stary')
        self.assertTrue(k['przechodzi'])
        self.assertIn("name: 'test-review-p12-review-stary'", js)
        self.assertNotIn('P11', js.split('\n}\n', 1)[0])


def repo(tmp):
    """Repo z bazą, commitem fazy na gałęzi, drugą gałęzią, tagiem, stashem i artefaktami builda z przyszłości."""
    g = lambda *a: subprocess.run(['git', '-C', tmp, *a], capture_output=True, text=True, check=True).stdout.strip()
    g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't')
    zapisz(os.path.join(tmp, '.gitignore'), 'dist/\nnode_modules/\n*.tsbuildinfo\n.env\n')
    os.makedirs(os.path.join(tmp, 'packages/shared/src')); zapisz(os.path.join(tmp, 'packages/shared/src/a.ts'), 'export const a = 1\n')
    g('add', '-A'); g('commit', '-q', '-m', 'baza')
    baza = g('rev-parse', 'HEAD')
    g('checkout', '-q', '-b', 'feature/x')
    zapisz(os.path.join(tmp, 'packages/shared/src/b.ts'), 'export const przyszlosc = 2\n')
    g('add', '-A'); g('commit', '-q', '-m', 'feat(x): faza')
    sha = g('rev-parse', 'HEAD')
    g('tag', 'v1'); g('branch', 'inna')
    zapisz(os.path.join(tmp, 'packages/shared/src/a.ts'), 'export const a = 3\n'); g('stash', '-q')
    for d in ('packages/shared/dist', 'apps/web/dist', 'node_modules/.vite/vitest', 'node_modules/pkg'):
        os.makedirs(os.path.join(tmp, d))
    zapisz(os.path.join(tmp, 'packages/shared/dist/b.js'), 'przyszlosc')
    zapisz(os.path.join(tmp, 'node_modules/.vite/vitest/results.json'), '{"b.test.ts": 1}')
    os.makedirs(os.path.join(tmp, 'node_modules/.cache/jiti')); zapisz(os.path.join(tmp, 'node_modules/.cache/jiti/vite.config.mjs'), 'przyszly config')
    zapisz(os.path.join(tmp, 'node_modules/pkg/index.js'), 'x')
    zapisz(os.path.join(tmp, 'tsconfig.tsbuildinfo'), 'x')
    zapisz(os.path.join(tmp, '.env'), 'X=1')
    return g, baza, sha


class KopiaBazy(unittest.TestCase):
    def test_kopia_na_bazie_bez_przyszlosci_z_node_modules(self):
        with tempfile.TemporaryDirectory() as d:
            zr = os.path.join(d, 'zrodlo'); os.makedirs(zr)
            _, baza, sha = repo(zr)
            cel = os.path.join(d, 'kopia')
            w = P.kopia_bazy(zr, cel, baza, sha)
            g = lambda *a: subprocess.run(['git', '-C', cel, *a], capture_output=True, text=True)
            self.assertEqual(g('rev-parse', 'HEAD').stdout.strip(), baza)
            self.assertNotEqual(g('cat-file', '-e', sha).returncode, 0)
            self.assertEqual(g('for-each-ref', '--format=%(refname)').stdout.split(), ['refs/heads/' + P.GALAZ])
            self.assertEqual(g('status', '--porcelain', '--untracked-files=all').stdout, '')
            self.assertFalse(os.path.exists(os.path.join(cel, 'packages/shared/src/b.ts')))
            for p in ('packages/shared/dist', 'apps/web/dist', 'node_modules/.vite', 'tsconfig.tsbuildinfo'):
                self.assertFalse(os.path.exists(os.path.join(cel, p)), p)
            for p in ('node_modules/pkg/index.js', '.env'):
                self.assertTrue(os.path.exists(os.path.join(cel, p)), p)
            self.assertEqual(w['biblioteki'], ['packages/shared'])
            self.assertFalse(os.path.exists(os.path.join(cel, 'node_modules/.cache')))
            self.assertTrue(os.path.exists(os.path.join(zr, 'packages/shared/dist/b.js')))   # źródło nietknięte

    def test_istniejacy_cel_odmawia(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(FileExistsError):
                P.kopia_bazy(d, d, 'x', 'y')


class NakladkaPoBuildzie(unittest.TestCase):
    def test_nakladka_na_kopii_po_buildzie_zachowuje_jej_stan_poza_claude(self):
        with tempfile.TemporaryDirectory() as d:
            k = os.path.join(d, 'k'); os.makedirs(os.path.join(k, '.claude/agents'))
            g = lambda *a: subprocess.run(['git', '-C', k, *a], capture_output=True, text=True, check=True).stdout
            g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't')
            zapisz(os.path.join(k, '.claude/agents/a.md'), 'epoka'); zapisz(os.path.join(k, 'a.ts'), '1')
            g('add', '-A'); g('commit', '-q', '-m', 'b')
            zapisz(os.path.join(k, 'a.ts'), '2'); zapisz(os.path.join(k, 'nowy.ts'), 'x')   # build bez commita
            z = os.path.join(d, 'z'); os.makedirs(os.path.join(z, '.claude/agents'))
            zapisz(os.path.join(z, '.claude/agents/a.md'), 'wariant'); zapisz(os.path.join(z, '.claude/agents/b.md'), 'nowy plik roli')
            przed = g('status', '--porcelain')
            P.P11.nakladka(k, z)
            self.assertEqual(g('status', '--porcelain'), przed)
            self.assertEqual(open(os.path.join(k, '.claude/agents/a.md')).read(), 'wariant')


class Skan(unittest.TestCase):
    def test_werdykt_skanu_zapisany_i_krok_zrobiony_tylko_przy_zerze(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertIsNone(P.werdykt_skanu('f-a', 'p12-build', 'nowy', p12=d))
            P.zapisz_werdykt('f-a', 'p12-build', 'nowy', 4, ['PRZECIEK x'], p12=d)
            self.assertEqual(P.werdykt_skanu('f-a', 'p12-build', 'nowy', p12=d)['kod'], 4)


class Ustawienia(unittest.TestCase):
    def drzewo(self, d):
        for p in ('kopie/f-a', 'kopie/f-b', 'p11/f-a', 'wyniki', 'sedzia', 'p12/claude-stary', 'p12/f-a/sedzia', 'p12/f-b',
                  'p12-kopie/f-a/stary', 'p12-kopie/f-a/stary-pliki', 'p12-kopie/f-a/nowy', 'p12-kopie/f-a/nowy-pliki', 'p12-kopie/f-b/stary'):
            os.makedirs(os.path.join(d, p))
        zapisz(os.path.join(d, 'p12/f-a/args.json'), '{}')

    def test_build_widzi_tylko_swoja_kopie_i_pliki_wariantu_a_zapisuje_w_kopii(self):
        with tempfile.TemporaryDirectory() as d:
            self.drzewo(d)
            u = P.ustawienia('f-a', 'p12-build', 'nowy', tr=d)
            deny = u['permissions']['deny']
            for p in ('kopie', 'p11', 'wyniki', 'sedzia', 'p12', 'p12-kopie/f-b', 'p12-kopie/f-a/stary', 'p12-kopie/f-a/stary-pliki'):
                self.assertIn('Read(/%s/%s/**)' % (d, p), deny, p)
                self.assertIn('Edit(/%s/%s/**)' % (d, p), deny, p)
            self.assertFalse([x for x in deny if '/p12-kopie/f-a/nowy' in x])
            self.assertNotIn('Edit', deny); self.assertNotIn('Write', deny)
            self.assertNotIn('Bash(git commit:*)', deny)
            for x in ('Edit(//Users/kacper_trzepiecinski/Documents/**)', 'Write(~/.claude/**)', 'Bash(git push:*)', 'Read(//tmp/review-*)'):
                self.assertIn(x, deny)
            self.assertTrue(u['disableAllHooks'])

    def test_review_bez_zapisu_i_sedzia_tylko_w_swoim_katalogu(self):
        with tempfile.TemporaryDirectory() as d:
            self.drzewo(d)
            deny = P.ustawienia('f-a', 'p12-review', 'stary', tr=d)['permissions']['deny']
            self.assertIn('Edit', deny); self.assertIn('Bash(git commit:*)', deny)
            deny = P.ustawienia('f-a', 'p12-sedzia-p1', 'S', tr=d)['permissions']['deny']
            for p in ('p12-kopie', 'p12/claude-stary', 'p12/f-b', 'p12/f-a/args.json'):
                self.assertTrue(any(x.startswith('Read(/%s/%s' % (d, p)) for x in deny), p)
            self.assertFalse([x for x in deny if '/p12/f-a/sedzia' in x])
            self.assertIn('Write', deny)

    def test_regex_przecieku_sciezki_wzgledne_dom_i_slug_drugiego_wariantu(self):
        with tempfile.TemporaryDirectory() as d:
            self.drzewo(d)
            rp = P.zakazane_re('f-a', 'p12-build', 'nowy', tr=d, zadanie='docs-active-z', faza=2)
            for zle in ('cat ../stary/apps/x.ts', 'ls ../../f-b26128d', 'ls ../../../kopie', 'ls ~/test-review/kopie', 'cat $HOME/test-review/p11/x',
                        'cat /private/tmp/claude-501/-Users-x-test-review-p12-kopie-f-a-stary/s/scratchpad/a', 'ls ~/.claude/file-history/',
                        'cat /tmp/review-diff-docs-active-inne-faza-1.diff'):
                self.assertTrue(rp.search(zle), zle)
            for dobre in ('cat /tmp/review-diff-docs-active-z-faza-2.diff', 'cat /tmp/bramki-docs-active-z-faza-2.json', 'cd ../ && ls',
                          'cat %s/p12-kopie/f-a/nowy/../nowy-pliki/x' % d):
                self.assertFalse(rp.search(dobre), dobre)

    def test_regex_przecieku_z_listy_deny(self):
        with tempfile.TemporaryDirectory() as d:
            self.drzewo(d)
            rp = P.zakazane_re('f-a', 'p12-build', 'nowy', tr=d)
            self.assertTrue(rp.search('cat %s/p12-kopie/f-a/stary/apps/x.ts' % d))
            self.assertTrue(rp.search('git -C %s/kopie/f-a log' % d))
            self.assertTrue(rp.search('/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online/x'))
            self.assertFalse(rp.search('cat %s/p12-kopie/f-a/nowy/apps/x.ts' % d))
            self.assertFalse(rp.search('ls %s/p12-kopie/f-a/nowy-pliki/' % d))


class Sesja(unittest.TestCase):
    """Kroki P12 w test_review_sesja: katalog roboczy, skrypt, wynik, budżet, ustawienia."""
    def test_kroki_p12(self):
        import test_review_sesja as T
        self.assertEqual(T.katalog_kroku('f-a', 'p12-build', 'nowy'), os.path.join(P.TR, 'p12-kopie', 'f-a', 'nowy'))
        self.assertEqual(T.katalog_kroku('f-a', 'p12-sedzia-p1', 'S'), os.path.join(P.TR, 'p12', 'f-a', 'sedzia'))
        self.assertEqual(T.skrypt_i_args('f-a', 'p12-build', 'nowy'), (os.path.join(P.TR, 'p12-kopie', 'f-a', 'nowy-pliki', 'wariant-build.js'), {}))
        self.assertEqual(T.skrypt_i_args('f-a', 'p12-review', 'stary')[0], os.path.join(P.TR, 'p12-kopie', 'f-a', 'stary-pliki', 'wariant-review.js'))
        self.assertEqual(T.skrypt_i_args('f-a', 'p12-sedzia-p1', 'S')[0], os.path.join(P.TR, 'p12', 'f-a', 'sedzia', 'sedzia-p1.js'))
        self.assertEqual([T.nazwa_wyniku(k, w) for k, w in (('p12-build', 'nowy'), ('p12-review', 'stary'), ('p12-sedzia-p1', 'S'))],
                         ['p12-build-nowy.json', 'p12-review-stary.json', 'p12-sedzia-p1.json'])
        self.assertEqual((T.budzet('f-a', 'p12-build', 'nowy'), T.budzet('f-a', 'p12-sedzia-p1', 'S')), (60.0, 15.0))
        self.assertTrue({T.id_sesji('f-a', 'p12-build', 'stary'), T.id_sesji('f-a', 'p12-sedzia-p1', 'S')} <= T.sesje_fazy('f-a'))


KLUCZE = {'klucze': [{'id': 'K1', 'zrodlo': 'klucz2', 'waga': 'P2', 'plik': 'apps/a.ts', 'linia': 10, 'streszczenie': 's1', 'tresc': 't1', 'wycinek': 'WYCINEK_KODU'},
                     {'id': 'K2', 'zrodlo': 'klucz1', 'przypadek': 'B-1-2', 'waga': 'P3', 'plik': 'apps/b.ts', 'linia': 5, 'streszczenie': 's2', 'tresc': 't2'}]}


class Sedzia(unittest.TestCase):
    def test_permutacja_deterministyczna_i_rozna_miedzy_fazami(self):
        a = P.permutacja('f-a')
        self.assertEqual(a, P.permutacja('f-a'))
        self.assertEqual(sorted(a), list(P.ETYKIETY)); self.assertEqual(sorted(a.values()), sorted(P.WARIANTY_SEDZIEGO))
        self.assertTrue(any(P.permutacja('f-%d' % i) != a for i in range(5)))

    def test_prompt_bez_nazw_wariantow_i_zrodla_klucza(self):
        p = P.prompt_sedziego(KLUCZE, '/x/sedzia')
        for zakazane in ('stary', 'nowy', 'historyczny', 'klucz1', 'klucz2', 'B-1-2', 'WYCINEK_KODU'):
            self.assertNotIn(zakazane, p)
        for jest in ('K1', 'K2', 'apps/a.ts', '/x/sedzia/A', 'OBECNY', 'ZAPOBIEZONY', 'BRAK_ODPOWIEDNIKA'):
            self.assertIn(jest, p)

    def test_tresc_klucza_bez_sladow_implementacji_historycznej(self):
        t = ('NADAL OTWARTE (brak commita naprawczego). W `apps/server/static/c.js:36` (linie 49–57) po a2a296a brak komunikatu.\n'
             '✅ Confirmed as addressed in commit edfbca8\n#### 5. Drugi finding\nnie dla tego klucza')
        c = P.czysc_tresc(t)
        for zle in (':36', '49', 'a2a296a', 'edfbca8', 'Confirmed', 'NADAL OTWARTE', 'Drugi finding'):
            self.assertNotIn(zle, c)
        self.assertIn('`apps/server/static/c.js`', c)
        self.assertIn('brak komunikatu', c)

    def test_prompt_bez_linii_klucza(self):
        p = P.prompt_sedziego(KLUCZE, '/x/sedzia')
        self.assertNotIn('apps/a.ts:10', p)
        self.assertIn('K1, K2', p)

    def test_wynik_per_wariant_klucz_i_grupa_klas_z_czuloscia_na_historycznym(self):
        mp = {'warianty': {'A': 'nowy', 'B': 'historyczny', 'C': 'stary'},
              'K': {'K1': {'zrodlo': 'klucz2', 'klasa': 'wartosc-graniczna', 'grupa': 'd10'}, 'K2': {'zrodlo': 'klucz1', 'klasa': 'tekst-ui', 'grupa': 'pokryte'}}}
        oc = lambda k, e, o: {'id': k, 'wariant': e, 'ocena': o, 'dowod': 'x', 'uzasadnienie': 'u'}
        sed = {'oceny': [oc('K1', 'A', 'ZAPOBIEZONY'), oc('K1', 'B', 'OBECNY'), oc('K1', 'C', 'OBECNY'),
                         oc('K2', 'A', 'BRAK_ODPOWIEDNIKA'), oc('K2', 'B', 'OBECNY'), oc('K2', 'C', 'ZAPOBIEZONY')]}
        w = P.wynik_sedziego(sed, mp)
        self.assertEqual(w['nowy']['klucz2'], {'OBECNY': 0, 'ZAPOBIEZONY': 1, 'BRAK_ODPOWIEDNIKA': 0, 'brak_oceny': 0})
        self.assertEqual(w['stary']['grupy']['pokryte']['ZAPOBIEZONY'], 1)
        self.assertEqual(w['historyczny']['razem']['OBECNY'], 2)
        self.assertEqual(w['czulosc_historycznego'], 1.0)
        self.assertEqual(w['pary']['tylko_nowy'], ['K1'])
        self.assertEqual(w['pary']['tylko_stary'], [])
        self.assertEqual(w['pary']['brak_odpowiednika'], ['K2'])

    def test_brakujaca_ocena_liczona_osobno(self):
        mp = {'warianty': {'A': 'nowy', 'B': 'historyczny', 'C': 'stary'}, 'K': {'K1': {'zrodlo': 'klucz2', 'klasa': 'x', 'grupa': 'inne'}}}
        w = P.wynik_sedziego({'oceny': [{'id': 'K1', 'wariant': 'A', 'ocena': 'OBECNY', 'dowod': '', 'uzasadnienie': ''}]}, mp)
        self.assertEqual(w['stary']['klucz2']['brak_oceny'], 1)
        self.assertEqual(w['czulosc_historycznego'], 0.0)


if __name__ == '__main__':
    unittest.main()
