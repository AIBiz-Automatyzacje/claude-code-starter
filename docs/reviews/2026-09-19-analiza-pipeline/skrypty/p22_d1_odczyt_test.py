"""Test pomiaru P22 D1 na fixturze runu. Uruchomienie: python3 -m unittest skrypty/p22_d1_odczyt_test.py"""
import json, os, subprocess, sys, tempfile, unittest

TU = os.path.dirname(os.path.abspath(__file__))


def wpis(tresc):
    return json.dumps({'message': {'content': tresc}}) + '\n'


class Pomiar(unittest.TestCase):
    def test_udzial_odczytow_bez_zakresu_plikow_od_200_linii(self):
        with tempfile.TemporaryDirectory() as k:
            projekt, run = os.path.join(k, 'projekt'), os.path.join(k, 'wf_x')
            os.makedirs(projekt)
            os.makedirs(run)
            open(os.path.join(projekt, 'duzy.ts'), 'w').write('x\n' * 300)
            open(os.path.join(projekt, 'maly.ts'), 'w').write('x\n' * 100)
            numerowane = lambda n: ''.join(f'{i}\tx\n' for i in range(1, n + 1))
            uzycia = [
                {'type': 'tool_use', 'id': 'r1', 'name': 'Read', 'input': {'file_path': 'duzy.ts'}},
                {'type': 'tool_use', 'id': 'r2', 'name': 'Read', 'input': {'file_path': 'duzy.ts', 'offset': 1, 'limit': 50}},
                {'type': 'tool_use', 'id': 'r3', 'name': 'Read', 'input': {'file_path': 'maly.ts'}},
                {'type': 'tool_use', 'id': 'b1', 'name': 'Bash', 'input': {'command': 'cat duzy.ts maly.ts'}},
                {'type': 'tool_use', 'id': 'b2', 'name': 'Bash', 'input': {'command': 'cat duzy.ts | head -5'}},
            ]
            wyniki = [
                {'type': 'tool_result', 'tool_use_id': 'r1', 'content': numerowane(300)},
                {'type': 'tool_result', 'tool_use_id': 'r2', 'content': numerowane(50)},
                {'type': 'tool_result', 'tool_use_id': 'r3', 'content': numerowane(100)},
                {'type': 'tool_result', 'tool_use_id': 'b1', 'content': [{'type': 'text', 'text': 'y' * 400}]},
                {'type': 'tool_result', 'tool_use_id': 'b2', 'content': 'z' * 100},
            ]
            with open(os.path.join(run, 'agent-a.jsonl'), 'w') as f:
                f.write(wpis(uzycia) + wpis(wyniki) + wpis(wyniki[:1]))  # powtorzony wpis tool_result liczony raz
            json.dump({'description': 'build:IU-1', 'agentType': 'feature-builder-ui'}, open(os.path.join(run, 'agent-a.meta.json'), 'w'))
            wyj = os.path.join(k, 'wynik')
            subprocess.run([sys.executable, os.path.join(TU, 'p22_d1_odczyt.py'), run, projekt, '--wyj', wyj], check=True, capture_output=True)
            w = json.load(open(wyj + '.json'))
            rola = w['per_rola']['build*']
            r1, r2, r3 = (len(numerowane(n)) for n in (300, 50, 100))
            self.assertEqual(rola['wyniki_zn'], r1 + r2 + r3 + 400 + 100)
            self.assertEqual(rola['read_bez_zakresu_200_zn'], r1)
            self.assertEqual(rola['cat_200_zn'], 300)  # 400 zn * 300 / (300 + 100) linii (cat kilku plikow — linie z projektu)
            self.assertEqual(w['role_b4']['bez_zakresu_200_zn'], r1 + 300)


if __name__ == '__main__':
    unittest.main()
