#!/usr/bin/env python3
"""Prompt-audit: kontrola w obie strony (HANDOFF §7 — kompilacja z wielu zrodel sprawdzana w obie strony).
(1) raport -> zrodla: kazdy cytat z pola „Cytat:” istnieje w pliku z „Lokalizacja:”, kazdy numer linii miesci sie w pliku;
(2) diff <-> raport: zbior ID i numerow hunkow w naglowku diffu == zbior z pol „Hunki:” raportu, kazdy hunk ma ID;
(3) raport <-> wersja operatora: wszystkie ID z diffu i flag sa w wersji operatora, wersja operatora nie ma ID spoza raportu;
(4) liczby: suma tabeli per grupa, liczba hunkow, liczba ustalen.
Uzycie: pa_kontrola.py <repo> -> dane/pa-kontrola.txt"""
import os, re, sys

REPO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
K = os.path.dirname(os.path.abspath(__file__)) + '/..'
raport = open(f'{K}/PROMPT-AUDIT.md', encoding='utf-8').read()
oper = open(f'{K}/PROMPT-AUDIT-DLA-OPERATORA.md', encoding='utf-8').read()
diff = open(f'{K}/dane/pa-proponowany.diff', encoding='utf-8').read()
o, bledy = [], 0


def plik_repo(sciezka):
    s = re.sub(r'^\./', '', sciezka.strip('`'))
    for kand in (s, '.claude/' + s, '.claude/skills/' + s, '.claude/agents/' + s, '.claude/workflows/' + s):
        p = os.path.join(REPO, kand)
        if os.path.isfile(p):
            return p
    return None


def norm(t):
    t = t.replace('\\`', '`').replace('„', '"').replace('”', '"')
    return re.sub(r'\s+', ' ', t).strip()


# (1) raport -> zrodla
bloki = re.split(r'\n\*\*(PA-\d\d) — ', raport)
cytaty_ok = cytaty_zle = linie_ok = linie_zle = 0
for i in range(1, len(bloki), 2):
    pid, tresc = bloki[i], bloki[i + 1].split('\n**PA-')[0]
    lok = re.search(r'Lokalizacja: (.*)', tresc)
    pliki = []
    if lok:
        # rozwin {a,b}/SKILL.md -> a/SKILL.md, b/SKILL.md
        tekst_lok = re.sub(r'`([^`]*)\{([^}]+)\}([^`]*)`', lambda m: ', '.join(f'`{m.group(1)}{x}{m.group(3)}`' for x in m.group(2).split(',')), lok.group(1))
        for m in re.finditer(r'`([^`]+?\.(?:md|js|sh))(?::(\d+)(?:-(\d+))?)?`((?:, `:\d+(?:-\d+)?`)*)', tekst_lok):
            p = plik_repo(m.group(1))
            if not p:
                bledy += 1; o.append(f'  SCIEZKA NIEROZWIAZANA: {pid} {m.group(1)}')
                continue
            pliki.append(p)
            n = sum(1 for _ in open(p, encoding='utf-8', errors='ignore'))
            nums = [int(x) for x in re.findall(r'(\d+)', (m.group(2) or '') + ' ' + (m.group(3) or '') + ' ' + (m.group(4) or ''))]
            for x in nums:
                if x <= n:
                    linie_ok += 1
                else:
                    linie_zle += 1; bledy += 1; o.append(f'  LINIA POZA PLIKIEM: {pid} {m.group(1)}:{x} (plik ma {n})')
    cyt = re.search(r'Cytat(?: \(przyklady\)| \(przykłady\))?: (.*)', tresc)
    if cyt and pliki:
        zrodlo = norm(' '.join(open(p, encoding='utf-8', errors='ignore').read() for p in pliki))
        for frag in re.findall(r'„([^”]{12,})”', cyt.group(1)):
            f = norm(frag).rstrip('.…').replace('…', ' ')
            klucz = [k for k in re.split(r' ', f) if k][:6]
            if norm(' '.join(klucz)) in zrodlo:
                cytaty_ok += 1
            else:
                cytaty_zle += 1; bledy += 1; o.append(f'  CYTAT NIEZNALEZIONY: {pid} „{frag[:70]}”')
# (1b) wszystkie odwolania plik:linia w calym raporcie (takze we flagach i pozycjach niskich)
ref_ok = ref_zle = 0
for m in re.finditer(r'`((?:\.claude/|~/)?[\w./{},-]+?\.(?:md|js|sh|mjs)):(\d+)(?:-(\d+))?`', raport):
    if m.group(1).startswith('~') or '{' in m.group(1):
        continue
    p = plik_repo(m.group(1))
    if not p:
        continue
    n = sum(1 for _ in open(p, encoding='utf-8', errors='ignore'))
    for x in [int(v) for v in (m.group(2), m.group(3)) if v]:
        if x <= n:
            ref_ok += 1
        else:
            ref_zle += 1; bledy += 1; o.append(f'  ODWOLANIE POZA PLIKIEM: {m.group(0)} (plik ma {n})')
o.insert(0, f'(1b) wszystkie odwolania plik:linia w raporcie: OK {ref_ok}, poza plikiem {ref_zle}')
o.insert(0, f'(1) raport -> zrodla: cytaty OK {cytaty_ok}, bledne {cytaty_zle}; numery linii OK {linie_ok}, poza plikiem {linie_zle}')

# (2) diff <-> raport
mapa_diff = {int(n): pid for n, pid in re.findall(r'^#\s+(\d+)\s+(PA-\d\d)\s', diff, re.M)}
hunkow = len(re.findall(r'^@@', diff, re.M))
raport_hunki = {}
for pid, lista in re.findall(r'\*\*(PA-\d\d) — [^\n]*\n(?:(?!\n\*\*PA-).)*?Hunk(?:i)?: ([\d, ]+)\.', raport, re.S):
    for n in re.findall(r'\d+', lista):
        raport_hunki[int(n)] = pid
rozne = {n for n in set(mapa_diff) | set(raport_hunki) if mapa_diff.get(n) != raport_hunki.get(n)}
o.append(f'(2) diff <-> raport: hunkow w diffie {hunkow}, w mapie naglowka {len(mapa_diff)}, w polach „Hunki:” raportu {len(raport_hunki)}; '
         f'ID w diffie {len(set(mapa_diff.values()))}; rozbieznosci {len(rozne)}')
for n in sorted(rozne):
    bledy += 1; o.append(f'  HUNK {n}: diff={mapa_diff.get(n)} raport={raport_hunki.get(n)}')
if hunkow != len(mapa_diff):
    bledy += 1; o.append('  LICZBA HUNKOW != MAPA')

# (3) raport <-> operator
id_raport = set(re.findall(r'PA-\d\d', raport))
id_oper = set(re.findall(r'PA-\d\d', oper))
id_diff = set(mapa_diff.values())
flagi = set(re.findall(r'\*\*(PA-\d\d) — ', raport.split('### Pewność średnia — flagi')[1].split('### Pewność niska')[0]))
brak_w_oper = sorted((id_diff | flagi) - id_oper)
spoza = sorted(id_oper - id_raport)
o.append(f'(3) raport <-> operator: ID w raporcie {len(id_raport)}, w diffie {len(id_diff)}, flag {len(flagi)}, w wersji operatora {len(id_oper)}; '
         f'diff+flagi bez wzmianki u operatora: {brak_w_oper or "brak"}; ID operatora spoza raportu: {spoza or "brak"}')
bledy += len(brak_w_oper) + len(spoza)

# (4) liczby
wiersz = re.search(r'\| \*\*Razem\*\* \| \*\*(\d+)\*\* \| \*\*(\d+) / (\d+) = (\d+) w diffie\*\* \| \*\*(\d+)\*\* \| \*\*(\d+)\*\* \|', raport)
razem, wys, sr, wdiff, fl, nis = map(int, wiersz.groups())
niskie = set(re.findall(r'\n- \*\*(PA-\d\d)', raport.split('### Pewność niska')[1].split('## 4.')[0]))
zgodne = (wys + sr == wdiff == len(id_diff) and fl == len(flagi) and razem == wdiff + fl + nis and len(niskie) == nis + 1)
o.append(f'(4) liczby: tabela Razem={razem}, diff {wys}+{sr}={wdiff} (w mapie {len(id_diff)}), flagi {fl} (w raporcie {len(flagi)}), niskie {nis} '
         f'(+PA-44 „add” = {len(niskie)} wpisow); operator: „44 rzeczy, 21 poprawek, 8 decyzji” -> {"zgodne" if zgodne else "NIEZGODNE"}')
if not zgodne or not re.search(r'Znalazłem 44 rzeczy\. 21 ma gotową poprawkę, 8 to decyzje', oper):
    bledy += 1; o.append('  LICZBY NIEZGODNE')

o.append(f'\nBLEDOW: {bledy}')
open(f'{K}/dane/pa-kontrola.txt', 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('\n'.join(o))
