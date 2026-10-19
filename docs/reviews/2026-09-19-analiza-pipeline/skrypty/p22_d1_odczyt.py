"""P22 D1: udział znaków wyników odczytu bez zakresu (cat, Read bez offset/limit) plików >= 200 linii w runie autopilota.

Pytanie z HANDOFF 6a pkt 91 (2): buildery i fix robią `cat` kilku plików naraz i Read bez `offset` — ile z tego to pliki
>= 200 linii (polecenie B4 z P21 pozwala czytać w całości plik < 200 linii). Próg decyzji (pkt 92 D1): poprawka polecenia
odczytu zakresami tylko przy udziale > 20% znaków wyników narzędzi ról, których dotyczy B4 (buildery i fix).

Użycie: python3 skrypty/p22_d1_odczyt.py <katalog runu wf_*> <katalog projektu> [--wyj dane/p22-d1-odczyt]
Wynik: <wyj>.json (liczby per rola i razem, lista największych odczytów) i <wyj>.txt (tabela).

Klasyfikacja wyniku narzędzia (tool_result połączony z tool_use po id):
- Read bez offset i limit: liczba linii pliku = liczba linii wyniku (format „N\\t…”, ucięcie Read do 2000 linii licz jako >= 200);
- Bash, którego każdy człon (&&, ;, nowa linia) to goły `cat <pliki>` (bez potoku, przekierowania, heredoca): liczba linii każdego
  pliku z projektu (`wc -l` dziś — pliki mogły się zmienić od runu; przybliżenie opisane w wyniku), znaki wyniku dzielone między
  pliki proporcjonalnie do ich linii;
- reszta (Read z zakresem, sed -n, grep, testy, git) — „inne”.
Rola = pierwszy człon etykiety agenta z `agent-*.meta.json` (description), np. build, fix, review. Role B4 wg klasy
(agentType): buildery (`feature-builder-*`) i `klasa-naprawiacz` (fix, fix:poprawka) — kontrola fixa (klasa-sceptyk) poza B4.
Cat jednego pliku: linie z wyniku (stan z chwili runu); cat kilku plików: linie z projektu dziś (przybliżenie).
Read z samym `limit` >= 200 linii wyniku liczony jak bez zakresu (zakres nie ogranicza odczytu).
"""
import glob, json, os, re, shlex, sys

KLASY_B4 = ('feature-builder-', 'klasa-naprawiacz')
PROG_LINII = 200


def tekst(blok):
    c = blok.get('content')
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return ''.join(x.get('text', '') for x in c if isinstance(x, dict) and x.get('type') == 'text')
    return ''


def linie_pliku(projekt, sciezka, pamiec):
    p = sciezka if os.path.isabs(sciezka) else os.path.join(projekt, sciezka)
    if p not in pamiec:
        try:
            with open(p, 'rb') as f:
                pamiec[p] = f.read().count(b'\n')
        except OSError:
            pamiec[p] = None
    return pamiec[p]


def pliki_cat(komenda):
    """Lista plików, gdy każdy człon komendy to goły cat; inaczej None."""
    czlony = [c.strip() for c in re.split(r'&&|;|\n', komenda) if c.strip()]
    pliki = []
    for c in czlony:
        if c.startswith('cd '):
            continue
        if not c.startswith('cat ') or re.search(r'[|<>]', c):
            return None
        try:
            slowa = shlex.split(c)[1:]
        except ValueError:
            return None
        pliki += [s for s in slowa if not s.startswith('-')]
    return pliki or None


def cwd_z_komendy(komenda, projekt):
    m = re.match(r'\s*cd\s+(\S+)', komenda)
    return m.group(1).strip('"\'') if m else projekt


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    run, projekt = sys.argv[1], sys.argv[2]
    wyj = sys.argv[sys.argv.index('--wyj') + 1] if '--wyj' in sys.argv else None
    pamiec = {}
    role = {}
    role_b4 = set()
    najwieksze = []
    for meta in sorted(glob.glob(os.path.join(run, 'agent-*.meta.json'))):
        dane_meta = json.load(open(meta))
        etykieta = dane_meta.get('description', '?')
        rola = etykieta.split(':')[0]
        if str(dane_meta.get('agentType', '')).startswith(KLASY_B4):
            role_b4.add(rola)
            rola = f'{rola}*'
        uzycia = {}
        # Transkrypt agenta powtarza wpisy (ten sam tool_result w kilku wierszach) — kazdy wynik liczony raz po tool_use_id.
        policzone = set()
        r = role.setdefault(rola, {'agentow': 0, 'wyniki_zn': 0, 'read_bez_zakresu_zn': 0, 'read_bez_zakresu_200_zn': 0,
                                   'cat_zn': 0, 'cat_200_zn': 0, 'cat_bez_pliku_zn': 0, 'odczytow_200': 0})
        r['agentow'] += 1
        for linia in open(meta[:-len('.meta.json')] + '.jsonl'):
            try:
                w = json.loads(linia)
            except ValueError:
                continue
            tresc = (w.get('message') or {}).get('content')
            if not isinstance(tresc, list):
                continue
            for b in tresc:
                if not isinstance(b, dict):
                    continue
                if b.get('type') == 'tool_use':
                    uzycia[b.get('id')] = (b.get('name'), b.get('input') or {})
                if b.get('type') != 'tool_result' or b.get('tool_use_id') in policzone:
                    continue
                policzone.add(b.get('tool_use_id'))
                zn = len(tekst(b))
                r['wyniki_zn'] += zn
                nazwa, wej = uzycia.get(b.get('tool_use_id'), (None, {}))
                n_wyniku = len(re.findall(r'^\s*\d+\t', tekst(b), re.M))
                if nazwa == 'Read' and wej.get('offset') is None and (wej.get('limit') is None or n_wyniku >= PROG_LINII):
                    r['read_bez_zakresu_zn'] += zn
                    n = n_wyniku
                    if n >= PROG_LINII:
                        r['read_bez_zakresu_200_zn'] += zn
                        r['odczytow_200'] += 1
                        najwieksze.append((zn, etykieta, 'Read', wej.get('file_path', ''), n))
                elif nazwa == 'Bash' and (pliki := pliki_cat(wej.get('command', ''))):
                    r['cat_zn'] += zn
                    baza = cwd_z_komendy(wej.get('command', ''), projekt)
                    linie = [tekst(b).count('\n') + 1] if len(pliki) == 1 else [linie_pliku(baza, p, pamiec) for p in pliki]
                    if any(l is None for l in linie):
                        r['cat_bez_pliku_zn'] += zn
                        continue
                    razem = sum(linie) or 1
                    duze = sum(l for l in linie if l >= PROG_LINII)
                    udzial = zn * duze / razem
                    r['cat_200_zn'] += udzial
                    if duze:
                        r['odczytow_200'] += 1
                        najwieksze.append((zn, etykieta, 'cat', ' '.join(pliki)[:120], max(linie)))
    suma = lambda klucz, zbior=None: sum(v[klucz] for k, v in role.items() if zbior is None or k in zbior)
    def udzial(zbior):
        wyn = suma('wyniki_zn', zbior)
        duze = suma('read_bez_zakresu_200_zn', zbior) + suma('cat_200_zn', zbior)
        return {'wyniki_zn': wyn, 'bez_zakresu_200_zn': round(duze), 'udzial': round(duze / wyn, 4) if wyn else None,
                'read_bez_zakresu_zn': suma('read_bez_zakresu_zn', zbior), 'cat_zn': suma('cat_zn', zbior),
                'cat_bez_pliku_zn': suma('cat_bez_pliku_zn', zbior)}
    wynik = {
        'run': os.path.basename(run.rstrip('/')), 'projekt': projekt, 'prog_linii': PROG_LINII, 'prog_decyzji': 0.2,
        'uwaga': 'linie plikow cat z projektu dzis (wc -l), nie z chwili runu; Read: linie wyniku',
        'role_b4': udzial({f'{r}*' for r in role_b4}), 'wszystkie_role': udzial(None),
        'per_rola': {k: {**v, 'cat_200_zn': round(v['cat_200_zn'])} for k, v in sorted(role.items())},
        'najwieksze': [dict(zip(['zn', 'agent', 'narzedzie', 'plik', 'linie'], x)) for x in sorted(najwieksze, reverse=True)[:15]],
    }
    b4 = wynik['role_b4']
    wiersze = [f"P22 D1 — run {wynik['run']} ({projekt}); próg pliku {PROG_LINII} linii, próg decyzji 20%",
               '', f"{'rola':<12}{'agentów':>8}{'wyniki [zn]':>14}{'Read bez zakr. ≥200':>22}{'cat ≥200':>12}{'udział':>9}"]
    for k, v in sorted(role.items(), key=lambda kv: -kv[1]['wyniki_zn']):
        duze = v['read_bez_zakresu_200_zn'] + v['cat_200_zn']
        wiersze.append(f"{k:<12}{v['agentow']:>8}{v['wyniki_zn']:>14,}{v['read_bez_zakresu_200_zn']:>22,}{round(v['cat_200_zn']):>12,}"
                       f"{(duze / v['wyniki_zn'] if v['wyniki_zn'] else 0):>9.1%}")
    wiersze += ['', f"role B4 (* — buildery i klasa-naprawiacz): {b4['bez_zakresu_200_zn']:,} z {b4['wyniki_zn']:,} zn = {b4['udzial']:.1%}"
                f" → {'POPRAWKA polecenia (udział > 20%)' if b4['udzial'] > 0.2 else 'bez zmiany polecenia (udział ≤ 20%)'}",
                f"wszystkie role: {wynik['wszystkie_role']['udzial']:.1%}", '', 'Największe odczyty bez zakresu (≥ 200 linii):']
    wiersze += [f"  {x['zn']:>8,} zn  {x['agent']:<22} {x['narzedzie']:<5} {x['linie']:>5} l.  {x['plik']}" for x in wynik['najwieksze']]
    print('\n'.join(wiersze))
    if wyj:
        json.dump(wynik, open(wyj + '.json', 'w'), ensure_ascii=False, indent=1)
        open(wyj + '.txt', 'w').write('\n'.join(wiersze) + '\n')


if __name__ == '__main__':
    main()
