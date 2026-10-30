# Wariant wąski: alarm tylko, gdy fraza jest w atrapach testów (src/test, *.test.*) i nie ma jej w src produkcyjnym ani w seedzie.
import re, subprocess, sys
REPO = sys.argv[1]
def git(*a):
    r = subprocess.run(['git', '-C', REPO, *a], capture_output=True, text=True); return r.stdout if r.returncode == 0 else ''
norm = lambda t: re.sub(r'\s+', ' ', t).strip().lower()
pl = git('ls-files', 'src').split()
testy = norm('\n'.join(git('show', f'main:{p}') for p in pl if re.search(r'(\.test\.|/test/|__tests__)', p)))
n = 0
for wiersz in open(sys.argv[2], encoding='utf8'):
    if wiersz.startswith('##'): continue
    pola = wiersz.rstrip('\n').split('\t')
    if pola[3] != 'dane': continue
    fraza = norm(pola[4][1:-1])
    if fraza in testy:
        n += 1; print('WASKI', wiersz.strip())
print('alarmy wariantu waskiego:', n)
