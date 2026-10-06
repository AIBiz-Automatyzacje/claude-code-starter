#!/usr/bin/env python3
"""Testy harnessu ślepego testu P11 (test_review_p11.py): wycinanie workflowu, nakładka .claude, pula sędziego, metryki.

Uruchomienie: python3 -m unittest skrypty/test_review_p11_test.py (z katalogu analizy) albo python3 skrypty/test_review_p11_test.py."""
import json, os, subprocess, sys, tempfile, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_review_p11 as P
import test_review_sesja as T

SKRYPTY = os.path.dirname(os.path.abspath(__file__))
SZ = os.path.abspath(os.path.join(SKRYPTY, '..', '..', '..', '..'))
WORKFLOW = '.claude/workflows/dev-docs-review-wf.js'
STARY_P11 = '7b7cbcd'   # main sprzed merge'u P11 (HANDOFF 6a pkt 65 a) — dziś main ma już nowych reviewerów
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
        js, _ = P.wariant(zrodlo(STARY_P11), ARGS, 'stary')
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


class ZapisDrzewa(unittest.TestCase):
    def test_komenda_zmieniajaca_pliki_projektu_w_drzewie_roboczym(self):
        zapisuja = ["cp apps/server/src/routes/events.ts /tmp/e.bak && sed -i '' 's/>/>=/' apps/server/src/routes/events.ts && npx vitest run",
                    'cp /tmp/e.bak apps/server/src/routes/events.ts', "perl -pi -e 's/a/b/' src/a.ts", 'git stash', 'git checkout -- src/a.ts',
                    'git restore src/a.ts', "cat > apps/server/dist/__probe.mjs <<'X'", 'node -e 1 > apps/server/dist/__probe.mjs',
                    "cat > src/a.ts <<'EOF'\nconst a = 1\nEOF\nnpx vitest run"]
        czytaja = ['cp apps/server/src/a.ts /tmp/a.bak', "sed -n '1,20p' src/a.ts", "sed -i '' 's/a/b/' /tmp/kopia.ts",
                   'npx vitest run apps/server', 'git diff c349bd1 -- src/a.ts', 'cd /k; sed -n 195,250p docs/faza-6-cta-i-webhooki.md',
                   'npx vitest run 2>&1 > /tmp/out.txt', 'ls src > /dev/null', 'echo x 2>/dev/null', 'grep -n "total > max" src/a.ts',
                   'grep -n "routes.post\\|offer.expiresAt > now" src/a.ts; grep -rn "x" src | head',
                   'node -e "const s=1; for (const v of [1]) console.log(v > 0)"', 'cp src/a.ts /private/tmp/claude-501/a.bak',
                   'S=/private/tmp/claude-501/x/scratchpad; echo a > $S/dist/index.html',
                   'git stash list | head -2', "cd /private/tmp/claude-501/x/scratchpad/; sed -i '' 's/a/b/' events.ts",
                   "D=/private/tmp/x; cat > $D/t.html <<'EOF'\n<div style=\"a\"><p>x</p></div>\nEOF\nchrome --headless $D/t.html > /dev/null"]
        self.assertEqual([P.zapis_drzewa(c) for c in zapisuja], [True] * len(zapisuja))
        self.assertEqual([P.zapis_drzewa(c) for c in czytaja], [False] * len(czytaja))


class Sesja(unittest.TestCase):
    def test_sesja_headless_czeka_na_workflow_bez_limitu_czasu_i_dziedziczy_srodowisko(self):
        # claude -p kończy sesję po 600 s zadań w tle i zabija workflow (f-b8374c8: wariant nowy killed po 602 s)
        env = T.srodowisko()
        self.assertEqual(env['CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS'], '0')
        self.assertEqual(env['HOME'], os.environ['HOME'])


class Kolejnosc(unittest.TestCase):
    def test_kolejnosc_wariantow_powtarzalna_i_rozna_miedzy_fazami(self):
        fazy = ['f-b8374c8', 'f-303ff62', 'f-1de5a4c', 'f-32975a1', 'f-b26128d', 'f-2536643', 'f-46be55a']
        self.assertEqual(P.kolejnosc('f-x'), P.kolejnosc('f-x'))
        self.assertTrue(all(sorted(P.kolejnosc(et)) == sorted(P.WARIANTY) for et in fazy))
        self.assertEqual({P.kolejnosc(et)[0] for et in fazy}, set(P.WARIANTY))


if __name__ == '__main__':
    unittest.main()
