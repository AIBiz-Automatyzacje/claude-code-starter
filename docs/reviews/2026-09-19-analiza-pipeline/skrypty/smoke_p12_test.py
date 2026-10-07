#!/usr/bin/env python3
"""Testy sekcji odczytu smoke'a P12 (smoke_p12.py). Uruchomienie: python3 -m unittest skrypty/smoke_p12_test.py (z katalogu analizy)."""
import json, os, sys, tempfile, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import smoke_p12 as S

REGULY = '/k/.claude/rules/coding-rules.md'


def transkrypt(katalog, aid, prompt, uzycia=(), zalaczniki=()):
    w = [{'type': 'user', 'message': {'content': 'start'}}, {'type': 'user', 'message': {'content': prompt}}]
    w += [{'type': 'attachment', 'attachment': z} for z in zalaczniki]
    w += [{'type': 'assistant', 'message': {'content': [{'type': 'tool_use', 'name': n, 'input': i}]}} for n, i in uzycia]
    with open(os.path.join(katalog, 'agent-%s.jsonl' % aid), 'w') as f: f.write('\n'.join(json.dumps(x) for x in w))


def agent(aid, rola, klasa, rules_zn=0, ctx=1000):
    return {'id': aid, 'rola': rola, 'klasa_roli': klasa, 'kontekst': {'rules_zn': rules_zn}, 'ctx_start': ctx}


class Reguly(unittest.TestCase):
    def test_odczyt_regul_read_bash_i_zalacznik_paths_oraz_kod(self):
        with tempfile.TemporaryDirectory() as d:
            transkrypt(d, 'b', 'IU\n' + S.NAGLOWEK_D10 + '\n- wyscig-i-wspolbieznosc: x\n- pii-i-sekrety: y\n\nkoniec',
                       [('Read', {'file_path': REGULY}), ('Edit', {'file_path': '/k/src/a.ts'}), ('Bash', {'command': 'sed -n 1,5p .claude/rules/coding-rules.md'})],
                       [{'type': 'nested_memory', 'path': REGULY, 'content': {'content': 'x'}}])
            r = S.reguly(d, 'b')
            self.assertEqual((r['read'], r['bash'], r['paths'], r['kod']), (1, 1, 1, 1))
            self.assertEqual(r['d10'], ['wyscig-i-wspolbieznosc', 'pii-i-sekrety'])
            self.assertIsNone(S.reguly(d, 'brak'))

    def test_kryterium_67d(self):
        with tempfile.TemporaryDirectory() as d:
            transkrypt(d, 'b1', S.NAGLOWEK_D10 + '\n- seed-e2e: x', [('Read', {'file_path': REGULY})])
            transkrypt(d, 'b2', 'bez bloku', [('Read', {'file_path': REGULY})], [{'type': 'nested_memory', 'path': REGULY}])
            transkrypt(d, 'f', 'fix', [], [{'type': 'nested_memory', 'path': REGULY}])
            transkrypt(d, 's', 'scribe', [])
            transkrypt(d, 'h', 'haiku', [('Read', {'file_path': REGULY})])
            agenci = [agent('b1', 'build', 'builder'), agent('b2', 'build', 'builder'), agent('f', 'fix', 'naprawiacz'),
                      agent('s', 'scribe', 'orkiestracyjny'), agent('h', 'dedup:semantyczny', 'mechaniczny', rules_zn=500)]
            k = S.kryterium(agenci, d)
            self.assertEqual(k['eager'], ['dedup:semantyczny'])
            self.assertEqual(k['bez_kodu_z_regulami'], ['dedup:semantyczny'])
            self.assertEqual(k['kod_bez_regul'], [])
            self.assertEqual(k['podwojny_odczyt'], ['build'])
            self.assertEqual(k['buildery_bez_d10'], 1)
            self.assertFalse(k['zielone'])
            k2 = S.kryterium([a for a in agenci if a['id'] in ('b1', 'f', 's')], d)
            self.assertTrue(k2['zielone'], k2)

    def test_rola_z_kodem_bez_odczytu_regul_to_czerwone(self):
        with tempfile.TemporaryDirectory() as d:
            transkrypt(d, 'f', 'fix', [])
            self.assertEqual(S.kryterium([agent('f', 'fix', 'naprawiacz')], d)['kod_bez_regul'], ['fix'])


if __name__ == '__main__':
    unittest.main()
