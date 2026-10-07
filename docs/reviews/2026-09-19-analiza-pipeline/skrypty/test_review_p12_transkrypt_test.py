#!/usr/bin/env python3
"""Testy metryk przestrzegania instrukcji z transkryptu buildera (test_review_p12_transkrypt.py).

Uruchomienie: python3 -m unittest skrypty/test_review_p12_transkrypt_test.py (z katalogu analizy)."""
import json, os, sys, tempfile, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_review_p12_transkrypt as TT

PROMPT = '''[Workflow harness — computed task] The task text below was computed at runtime.
  IU-3: Hook
  Pliki innych jednostek tej fazy:
  IU-2: apps/a/src/lib/api.ts
  **Reguły projektu i klasy błędów dla plików jednostki:**
  Klasy błędów, które review znajduje w takich plikach — co robić zamiast:
  - wartosc-graniczna: Długość i zakres każdej generowanej wartości liczysz pod ograniczenie.
  - sciezka-bledu: Operację w kilku krokach zamykasz w transakcji.
'''


def wpis(typ, tresc, ts='2026-10-07T10:00:00.000Z', **inne):
    m = {'role': 'user' if typ == 'user' else 'assistant', 'content': tresc}
    if typ == 'assistant': m.update(id=inne.pop('mid', 'm1'), model='claude-opus-5-5', usage={'input_tokens': 10, 'output_tokens': 5})
    return dict({'type': typ, 'timestamp': ts, 'message': m}, **inne)


def uzycie(i, nazwa, wejscie):
    return {'type': 'tool_use', 'id': 't%d' % i, 'name': nazwa, 'input': wejscie}


def wynik(i, tekst):
    return {'type': 'tool_result', 'tool_use_id': 't%d' % i, 'content': [{'type': 'text', 'text': tekst}]}


TRANSKRYPT = [
    wpis('user', '[Workflow harness — user request] uruchom'),
    wpis('user', PROMPT),
    {'type': 'attachment', 'timestamp': '2026-10-07T10:00:01.000Z', 'attachment': {'type': 'nested_memory', 'path': '/k/.claude/rules/coding-rules.md', 'content': 'x' * 50}},
    {'type': 'attachment', 'attachment': {'type': 'instructions', 'files': [{'path': '/k/CLAUDE.md', 'content': 'czytaj .claude/rules/coding-rules.md'},
                                                                           {'path': '/k/.claude/rules/learned-patterns.md', 'content': 'x'}]}},
    {'type': 'attachment', 'attachment': {'type': 'prompt_snapshot', 'systemPrompt': 'coding-rules.md'}},
    wpis('assistant', [uzycie(1, 'Read', {'file_path': '/k/.claude/rules/coding-rules.md'}),
                       uzycie(2, 'Read', {'file_path': '/k/.claude/skills/ux-ui-guidelines/resources/forms.md', 'offset': 100, 'limit': 80}),
                       uzycie(3, 'Read', {'file_path': '/k/.claude/skills/tailwind-react-guidelines/resources/data.md'})], mid='m1'),
    wpis('user', [wynik(1, 'r' * 1000), wynik(2, 'a' * 300), wynik(3, 'b' * 4000)]),
    wpis('assistant', [{'type': 'thinking', 'thinking': '', 'signature': 'x'},
                       {'type': 'text', 'text': 'Gdyby hook zwracał undefined, czy test padnie? Tak, asercja na wartości.'},
                       uzycie(9, 'Bash', {'command': 'sed -n 1,80p .claude/rules/coding-rules.md; grep -n "^## " .claude/skills/ux-ui-guidelines/resources/forms.md'}),
                       uzycie(10, 'Bash', {'command': 'cd apps/server && npx vitest run --reporter=dot src/a.test.ts src/b 2>&1 | tail -5'}),
                       uzycie(11, 'Bash', {'command': 'npx vitest run 2>&1; ls vitest*; cat vitest.config.ts; grep -n "from \'vitest\'" src/a.test.ts'}),
                       uzycie(12, 'Bash', {'command': 'cat > notatka.md <<EOF\nuruchom pnpm test po zmianie\nEOF'}),
                       uzycie(4, 'Bash', {'command': 'cd apps/a && pnpm exec tsc --noEmit -p tsconfig.json'}),
                       uzycie(5, 'Bash', {'command': 'pnpm exec vitest related --run src/hooks/use-a.ts'}),
                       uzycie(6, 'Bash', {'command': 'pnpm test 2>&1 | tail -5'}),
                       uzycie(7, 'Bash', {'command': 'pnpm exec vitest run src/hooks/use-a.test.ts --reporter=dot'})], mid='m2'),
    wpis('user', [wynik(4, 'ok'), wynik(5, 'ok'), wynik(6, 'ok'), wynik(7, 'ok')]),
    wpis('assistant', [uzycie(8, 'StructuredOutput', {'id': 'IU-3', 'status': 'completed', 'pliki': ['a.ts', 'b.ts'],
                                                       'odchylenia': ['brak lokalnej bazy'], 'nastepneKroki': None, 'pytanie': None})],
         ts='2026-10-07T10:05:00.000Z', mid='m3'),
]


class Builder(unittest.TestCase):
    def setUp(self):
        self.f = tempfile.NamedTemporaryFile('w', suffix='.jsonl', delete=False)
        self.f.write('\n'.join(json.dumps(w, ensure_ascii=False) for w in TRANSKRYPT) + '\n'); self.f.close()
        self.m = TT.builder(self.f.name)

    def tearDown(self):
        os.unlink(self.f.name)

    def test_bloki_promptu_iu(self):
        self.assertTrue(self.m['prompt']['d10'])
        self.assertEqual(self.m['prompt']['klasy_d10'], ['wartosc-graniczna', 'sciezka-bledu'])
        self.assertTrue(self.m['prompt']['pliki_innych_iu'])
        self.assertTrue(self.m['prompt']['blok_regul'])
        self.assertFalse(self.m['prompt']['wymagania_wykonania'])

    def test_odczyt_regul_jawny_i_z_zalacznika(self):
        self.assertEqual(self.m['coding_rules'], {'read': 1, 'bash': 1, 'zalacznik': 1})

    def test_resources_sekcjami_i_znaki(self):
        self.assertEqual(self.m['resources'], {'odczyty': 2, 'sekcjami': 1, 'zn': 4300, 'bash': 1})

    def test_samosprawdzenie_na_plikach_iu_i_pelny_zestaw(self):
        s = self.m['samosprawdzenie']
        self.assertEqual((s['tsc'], s['vitest_related'], s['vitest_pliki'], s['pelny_zestaw']), (1, 1, 2, 2))

    def test_pytanie_undefined_heurystyka(self):
        self.assertEqual(self.m['undefined'], 1)

    def test_wynik_buildera_i_czas(self):
        self.assertEqual(self.m['wynik'], {'status': 'completed', 'pliki': 2, 'odchylenia': ['brak lokalnej bazy'], 'pytanie': None})
        self.assertEqual(self.m['czas_s'], 300)


class Agregat(unittest.TestCase):
    def test_sumy_i_liczba_builderow_z_cecha(self):
        a = {'prompt': {'d10': True, 'klasy_d10': ['x'], 'pliki_innych_iu': False, 'blok_regul': True, 'wymagania_wykonania': False, 'zn': 10},
             'coding_rules': {'read': 1, 'bash': 0, 'zalacznik': 0}, 'resources': {'odczyty': 2, 'sekcjami': 1, 'zn': 100, 'bash': 0},
             'samosprawdzenie': {'tsc': 1, 'vitest_related': 0, 'vitest_pliki': 1, 'pelny_zestaw': 0, 'eslint': 0}, 'undefined': 0,
             'wynik': {'status': 'completed', 'pliki': 1, 'odchylenia': [], 'pytanie': None}, 'czas_s': 10}
        b = json.loads(json.dumps(a)); b['coding_rules']['read'] = 0; b['coding_rules']['bash'] = 1; b['wynik']['status'] = 'partial'; b['prompt']['d10'] = False
        g = TT.agregat([a, b])
        self.assertEqual(g['builderow'], 2)
        self.assertEqual(g['z_cecha']['coding_rules_read'], 1)
        self.assertEqual(g['z_cecha']['coding_rules_odczyt'], 2)
        self.assertEqual(g['z_cecha']['d10_w_prompcie'], 1)
        self.assertEqual(g['statusy'], {'completed': 1, 'partial': 1})
        self.assertEqual(g['resources_zn'], 200)


if __name__ == '__main__':
    unittest.main()
