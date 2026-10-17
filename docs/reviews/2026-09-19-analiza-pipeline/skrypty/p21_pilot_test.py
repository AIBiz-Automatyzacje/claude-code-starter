"""Testy harnessu pilota P21 (bez agentów i bez kopii vibersi). Uruchomienie: python3 -m unittest skrypty/p21_pilot_test.py"""
import json, os, subprocess, sys, tempfile, unittest

TU = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TU)
import p21_pilot as P  # noqa: E402

GEN = os.path.join(TU, 'p21_pilot_generuj.mjs')


def node(kod):
    return subprocess.run(['node', '--input-type=module', '-e', kod], capture_output=True, text=True, cwd=TU)


class Koszt(unittest.TestCase):
    def test_jedna_wiadomosc_liczona_raz_i_ctx_max(self):
        u = {'input_tokens': 10, 'cache_read_input_tokens': 1000, 'cache_creation_input_tokens': 100, 'output_tokens': 20}
        linie = [{'type': 'assistant', 'message': {'id': 'm1', 'usage': u}}, {'type': 'assistant', 'message': {'id': 'm1', 'usage': u}},
                 {'type': 'assistant', 'message': {'id': 'm2', 'usage': dict(u, cache_read_input_tokens=3000)}}, {'type': 'user', 'message': {}}]
        with tempfile.NamedTemporaryFile('w', suffix='.jsonl', delete=False) as f:
            f.write('\n'.join(json.dumps(x) for x in linie))
        k = P.koszt_agenta(f.name)
        os.unlink(f.name)
        self.assertEqual(k['tury'], 2)
        self.assertEqual(k['ctx_max'], 3110)
        self.assertAlmostEqual(k['jedn'], round((4000 * 0.1 + 200 * 1.25 + 40 * 5 + 20) / 1e6, 3))

    def test_etap_fixa_porcje_sumowane_jako_fix(self):
        a = [{'etykieta': 'fix:faza-4:porcja-1', 'jedn': 0.5, 'tury': 10, 'ctx_max': 90000},
             {'etykieta': 'fix:faza-4:porcja-2', 'jedn': 0.4, 'tury': 8, 'ctx_max': 120000},
             {'etykieta': 'fix:kontrola:faza-4', 'jedn': 0.2, 'tury': 5, 'ctx_max': 80000},
             {'etykieta': 'fix:poprawka:faza-4', 'jedn': 0.3, 'tury': 9, 'ctx_max': 70000}]
        e = P.etap_fixa(a)
        self.assertEqual(e['fix'], {'agentow': 2, 'jedn': 0.9, 'ctx_max': 120000, 'tury': 18})
        self.assertEqual(sorted(e), ['fix', 'kontrola', 'poprawka'])


class Przygotowanie(unittest.TestCase):
    def test_komendy_scribea_przepisane_na_kopie(self):
        c = "cd %s/docs/active/x && python3 - <<'EOF'\nF=json.load(open('/tmp/scribe4/f.json'))\nEOF" % P.VIBERSI
        w = P.przepisz_komende(c, '/k/baza', '/k/scribe4')
        self.assertNotIn(P.VIBERSI, w)
        self.assertIn('cd /k/baza/docs/active/x', w)
        self.assertIn("open('/k/scribe4/f.json')", w)

    def test_atrapa_agent_browser_wiesza_tylko_pierwszy_zrzut_strony(self):
        d = tempfile.mkdtemp()
        ab = os.path.join(d, 'ab')
        open(ab, 'w').write(P.atrapa_agent_browser(os.path.join(d, 'z'), '/bin/echo', 3))
        os.chmod(ab, 0o755)
        run = lambda *a, t=None: subprocess.run(['perl', '-e', 'alarm %d; exec @ARGV' % (t or 10), ab, *a], capture_output=True, text=True).returncode
        self.assertEqual(run('--session', 's', 'open', 'about:blank'), 0)
        self.assertEqual(run('screenshot', 'a.png'), 0, 'zrzut about:blank nie wisi (próbny zrzut A1)')
        self.assertEqual(run('open', 'http://127.0.0.1:5199/smoke-a1.html'), 0)
        # SIGALRM: powłoka zwraca 142, subprocess w Pythonie -14
        self.assertIn(run('screenshot', 'b.png', t=1), (142, -14), 'pierwszy zrzut strony scenariusza przerwany limitem')
        self.assertEqual(run('screenshot', 'c.png'), 0, 'ponowienie po próbnym zrzucie przechodzi')


class Sedzia(unittest.TestCase):
    def test_kolejnosc_stala_dla_katalogu_i_obie_litery(self):
        self.assertEqual(P.kolejnosc('/a/b'), P.kolejnosc('/a/b'))
        self.assertEqual(sorted(P.kolejnosc('/a/b')), ['nowy', 'stary'])
        self.assertEqual({P.kolejnosc('/x/%d' % i) for i in range(20)}, {('stary', 'nowy'), ('nowy', 'stary')})

    def test_porcje_po_4(self):
        self.assertEqual([len(p) for p in P.porcje_sedziego(list(range(16)))], [4, 4, 4, 4])
        self.assertEqual([len(p) for p in P.porcje_sedziego(list(range(6)))], [4, 2])

    def test_szablon_ma_jeden_znacznik_i_parsuje_sie_po_wstawieniu(self):
        s = open(os.path.join(TU, 'p21_sedzia_szablon.js')).read()
        self.assertEqual(s.count('__PORCJE__'), 1)
        cialo = s.replace('__PORCJE__', '[["F1","F2"],["F3"]]')
        r = node("import { suchyBieg } from %s; const w = await suchyBieg(%s); console.log(JSON.stringify(w.agenci.map((a) => a.label)))"
                 % (json.dumps(GEN), json.dumps(cialo)))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout), ['sedzia:oceny:0', 'sedzia:oceny:1', 'sedzia:regresje:A', 'sedzia:regresje:B'])


class Generator(unittest.TestCase):
    ZRODLO = '''
const A = 6
const B = { x: 1 }
const SZABLON = `
linia \\`kod\\`
koniec`
const OBIEKT = {
  a: 1,
}
function f(x) {
  return x + A
}
'''

    def test_definicja_jednolinijkowa_obiekt_szablon_funkcja(self):
        r = node('import { definicja } from %s; const z = %s; console.log(JSON.stringify(["A","B","SZABLON","OBIEKT","f","brak"].map((n) => definicja(z, n))))'
                 % (json.dumps(GEN), json.dumps(self.ZRODLO)))
        self.assertEqual(r.returncode, 0, r.stderr)
        a, b, sz, ob, f, brak = json.loads(r.stdout)
        self.assertEqual((a, b), ('const A = 6', 'const B = { x: 1 }'))
        self.assertEqual(sz, 'const SZABLON = `\nlinia \\`kod\\`\nkoniec`', 'escapowany backtick nie konczy szablonu')
        self.assertEqual(ob, 'const OBIEKT = {\n  a: 1,\n}')
        self.assertEqual(f, 'function f(x) {\n  return x + A\n}')
        self.assertIsNone(brak)

    def test_skrypt_fixa_z_zrodla_szablonu_przechodzi_suchy_bieg(self):
        zrodlo = os.path.join(P.REPO, '.claude/workflows/dev-autopilot-wf.js')
        f = [{'severity': 'P2', 'typ': 'KOD', 'plik': 'src/a.ts:%d' % i, 'opis': 'd'} for i in range(3)] + \
            [{'severity': 'P2', 'typ': 'TEST', 'plik': 'src/b%d.ts:1' % i, 'opis': 'd'} for i in range(5)]
        r = node('import { skryptFixa, suchyBieg } from %s; import { readFileSync } from "node:fs";'
                 'const w = await suchyBieg(skryptFixa(readFileSync(%s, "utf8"), %s, "nowy"));'
                 'console.log(JSON.stringify({ l: w.agenci.map((a) => a.label), wynik: w.wynik }))' % (json.dumps(GEN), json.dumps(zrodlo), json.dumps(f)))
        self.assertEqual(r.returncode, 0, r.stderr)
        d = json.loads(r.stdout)
        self.assertEqual(d['l'], ['fix:faza-4:porcja-1', 'fix:faza-4:porcja-2', 'fix:kontrola:faza-4', 'fix:poprawka:faza-4'])
        self.assertEqual(d['wynik']['status'], 'OK')


class Ustawienia(unittest.TestCase):
    def test_deny_obejmuje_drugi_wariant_i_pliki_harnessu_a_nie_wlasne(self):
        k = tempfile.mkdtemp()
        for x in ('stary', 'nowy', 'stary-pliki', 'nowy-pliki', 'wyniki', 'sedzia', 'baza'):
            os.makedirs(os.path.join(k, x))
        deny = P.ustawienia(k, 'fix-nowy')['permissions']['deny']
        self.assertIn('Read(/%s/**)' % os.path.join(k, 'stary'), deny)
        self.assertIn('Read(/%s/**)' % os.path.join(k, 'stary-pliki'), deny)
        self.assertIn('Read(/%s/**)' % os.path.join(k, 'wyniki'), deny)
        self.assertNotIn('Read(/%s/**)' % os.path.join(k, 'nowy'), deny)
        self.assertNotIn('Read(/%s/**)' % os.path.join(k, 'nowy-pliki'), deny)
        self.assertIn('Read(//Users/kacper_trzepiecinski/Documents/**)', deny)
        self.assertIn('Bash(curl:*)', deny)
        self.assertNotIn('Bash(curl:*)', P.ustawienia(k, 'smoke')['permissions']['deny'], 'tester A1 robi curl E2E_URL')
        self.assertIn('Write', P.ustawienia(k, 'sedzia')['permissions']['deny'])


if __name__ == '__main__':
    unittest.main()
