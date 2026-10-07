#!/usr/bin/env python3
"""Testy skanu transkryptów ślepych testów (test_review_skan.py): sieć poza pętlą lokalną = przeciek.

Uruchomienie: python3 -m unittest skrypty/test_review_skan_test.py (z katalogu analizy)."""
import os, sys, unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_review_skan as SK


class Siec(unittest.TestCase):
    def test_curl_gh_wget_poza_petla_lokalna_to_siec(self):
        for cmd in ('curl -s https://github.com/x/y', 'gh pr view 3', 'wget http://example.com/a', 'curl example.com', 'gh api http://localhost/x',
                    'curl -s http://127.0.0.1:3000/a && curl https://raw.githubusercontent.com/x', 'x; curl -H "Host: a" http://10.0.0.1/', 'U=https://example.com; curl -s $U', 'echo "$(curl -s https://example.com/x)"'):
            self.assertTrue(SK.siec(cmd), cmd)

    def test_curl_tylko_na_petle_lokalna_to_nie_siec(self):
        for cmd in ('curl -s -o /dev/null http://127.0.0.1:3917/healthz', "curl -H 'Host: app.localhost:3917' http://localhost:3917/o/x",
                    'curl http://[::1]:8080/ ; curl http://oferta.localhost:3917/', 'ls',
                    "cat > s.mjs <<'EOF'\nconst m = 'https://akademiaautomatyzacji.com'\nEOF\nnode s.mjs & sleep 1; curl -sI http://127.0.0.1:4567/f/a.woff2 | head -8; curl -s http://127.0.0.1:4567/ | head -c 300"):
            self.assertFalse(SK.siec(cmd), cmd)


if __name__ == '__main__':
    unittest.main()
