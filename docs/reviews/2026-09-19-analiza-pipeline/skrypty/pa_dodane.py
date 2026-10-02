"""Kontrola wzorcow prompt-auditu na DODANYCH liniach diffu (HANDOFF §7: P1, P4, P5).

Użycie: python3 skrypty/pa_dodane.py <ref-bazy, np. main> <plik> [<plik> ...]   (ścieżki względem korzenia repo)
Wzorce RX z pa_inwentarz.py (import bez uruchamiania main — nic nie pisze do dane/). W plikach .js pomija linie komentarza.
Linia przeniesiona (np. zmiana numeracji kroku) liczy się jako dodana — trafienie na niej też trzeba poprawić.
"""
import importlib.util, os, subprocess, sys

TU = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('pa_inwentarz', os.path.join(TU, 'pa_inwentarz.py'))
pa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pa)

if len(sys.argv) < 3:
    sys.exit(__doc__)
baza, pliki = sys.argv[1], sys.argv[2:]
repo = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, cwd=TU).stdout.strip()
razem = 0
for p in pliki:
    diff = subprocess.run(['git', '-C', repo, 'diff', '-U0', baza, '--', p], capture_output=True, text=True).stdout
    for l in diff.splitlines():
        if not l.startswith('+') or l.startswith('+++'):
            continue
        tresc = l[1:]
        if p.endswith(('.js', '.mjs')) and tresc.strip().startswith('//'):
            continue
        for k, rx in pa.RX.items():
            for m in rx.finditer(tresc):
                razem += 1
                print(f'{p} [{k}] {m.group(0)!r} :: {tresc.strip()[:150]}')
print('TRAFIEN:', razem)
