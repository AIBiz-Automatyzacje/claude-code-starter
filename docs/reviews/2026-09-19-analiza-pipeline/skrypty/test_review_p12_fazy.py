#!/usr/bin/env python3
"""Ślepy test P12 — wybór faz (HANDOFF 6a pkt 69 j): fazy oferty-online, których klucz 2 (P1/P2 historycznego review) leży w klasach ze zdaniem
D10 (`ZDANIA` w .claude/scripts/wiedza/zapobieganie.mjs) i które mają IU UI albo fullstack. Kandydaci = kopie `~/test-review/kopie/f-*`
(tylko one mają node_modules z epoki; powtórka `-r2` pominięta).

Klasy: klucz 1 (uwagi bota) — słownik It. 1 (`it1_slownik_klas`: klasyfikacja-574 + nadpisania); klucz 2 — dane/test-review/p12-klucz2-klasy.json
(subagent na tym samym słowniku, bo raporty review klas nie mają). IU fazy — z planu technicznego na commicie bazy fazy (`**Delegate to:**`,
bez pola: typ po plikach, jak planner). Ranking: faza z IU UI/fullstack przed fazą bez nich → klucz 2 w klasach D10 → klucz 2 w klasach
pokrytych warstwą stałą i regułami (`POKRYTE`) → mniejszy diff (koszt buildu).

Użycie (z katalogu analizy): python3 skrypty/test_review_p12_fazy.py → dane/test-review/p12-fazy.{txt,json}. Testy: test_review_p12_fazy_test.py."""
import csv, glob, json, os, re, subprocess, sys

sys.dont_write_bytecode = True
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = os.path.abspath(os.path.join(BASE, '..', '..', '..'))
TR = os.path.expanduser('~/test-review')
OUT = os.path.join(BASE, 'dane', 'test-review')
UI = ('feature-builder-ui', 'feature-builder-fullstack', 'feature-builder-ui-figma', 'feature-builder-fullstack-figma')
RE_IU = re.compile(r'^- \[[ xX]\] \*\*(IU-[\w.]+)\b', re.M)
RE_DELEGACJA = re.compile(r'^\*\*Delegate to:\*\*\s*`?([\w-]+)`?', re.M)
RE_SCIEZKA = re.compile(r'`([\w@./-]+\.[A-Za-z]{1,5}|[\w@./-]+/)`')
RE_PREZENTACJA = re.compile(r'(^|/)(components|features|pages)/.*\.(tsx|jsx|css)$|\.css$')


def sekcja_fazy(plan, numer):
    """Tekst `### Faza N` do następnego nagłówka poziomu 2 albo 3 o fazie."""
    m = re.search(r'^### Faza %d\b.*$' % numer, plan, re.M)
    if not m: return ''
    reszta = plan[m.end():]
    k = re.search(r'^(### Faza \d|## )', reszta, re.M)
    return reszta[:k.start()] if k else reszta


def typ_po_plikach(pliki):
    """Jak planner przy IU bez `Delegate to:`: tylko prezentacja → ui, tylko dane → data, obie → fullstack."""
    ui = [p for p in pliki if RE_PREZENTACJA.search(p) and not re.search(r'\.(test|spec)\.', p)]
    reszta = [p for p in pliki if p not in ui and not re.search(r'\.(test|spec)\.', p)]
    if ui and reszta: return 'feature-builder-fullstack'
    return 'feature-builder-ui' if ui else 'feature-builder-data'


def iu_fazy(plan, numer):
    sek = sekcja_fazy(plan, numer)
    starty = list(RE_IU.finditer(sek))
    wynik = []
    for i, m in enumerate(starty):
        blok = sek[m.start():starty[i + 1].start() if i + 1 < len(starty) else len(sek)]
        pliki_blok = blok.split('**Pliki:**', 1)[1] if '**Pliki:**' in blok else ''
        pliki_blok = re.split(r'\n\s*\n\*\*', pliki_blok, maxsplit=1)[0]
        pliki = list(dict.fromkeys(RE_SCIEZKA.findall(pliki_blok)))
        d = RE_DELEGACJA.search(blok)
        wynik.append({'id': m.group(1), 'agentType': d.group(1) if d else typ_po_plikach(pliki), 'delegacja': bool(d), 'pliki': pliki})
    return wynik


def commit_fazy(log):
    """Commit implementacji fazy = ostatni `feat` w zakresie baza review..sha fazy (`git log --oneline`, od najnowszego). Zakres bywa szerszy
    niż faza: review obejmował wtedy dwie fazy (f-32975a1) albo po implementacji przyszły commity docs i .claude (f-1de5a4c, f-b26128d)."""
    for l in log:
        sha, temat = l.split(' ', 1)
        if temat.startswith('feat'): return sha
    return None


def w_zakresie(klucz, zmienione):
    """Klucz dotyczy kodu, który pisze builder fazy: jego plik zmienił się między bazą buildu a sha fazy."""
    return re.sub(r':\d+(-\d+)?$', '', klucz.get('plik') or '') in zmienione


def _bez_linii(plik):
    return re.sub(r':\d+(-\d+)?$', '', plik or '')


def iu_klucza(plik, iu):
    """IU, których pole Pliki obejmuje plik klucza (ten sam plik albo katalog nad nim) — ich blok D10 dostaje builder tego pliku."""
    p = _bez_linii(plik)
    return [x['id'] for x in iu if any(p == q or (q.endswith('/') and p.startswith(q)) for q in x['pliki'])]


def ma_ui(iu):
    return any(x['agentType'] in UI for x in iu)


def klasa_klucza1(przypadek, uwagi, mapa, nadpisania):
    """B-<pr>-<id> → klasa słownika It. 1 (nadpisanie per uwaga ma pierwszeństwo przed mapą starej nazwy); brak uwagi = None."""
    m = re.match(r'^B-0*(\d+)-0*(\d+)$', przypadek or '')
    if not m: return None
    k = (m.group(1), m.group(2))
    if k in nadpisania: return nadpisania[k]
    return mapa.get(uwagi[k]) if k in uwagi else None


def ranking(fazy, d10):
    zd, pk = set(d10['zdania']), set(d10['pokryte'])
    wynik = []
    for f in fazy:
        k2 = [x['klasa'] for x in f['klucz2'] if x.get('w_zakresie', True)]
        k1 = [x['klasa'] for x in f['klucz1'] if x.get('w_zakresie', True)]
        osiag = lambda ks: sum(x['klasa'] in zd and x.get('w_zakresie', True) and x.get('osiagalny', True) for x in ks)
        wynik.append(dict(f, k2_d10=sum(k in zd for k in k2), k2_pokryte=sum(k in pk for k in k2), k1_d10=sum(k in zd for k in k1),
                          k1_pokryte=sum(k in pk for k in k1), k2_d10_osiagalne=osiag(f['klucz2']), k1_d10_osiagalne=osiag(f['klucz1'])))
    return sorted(wynik, key=lambda x: (not x['ui'], -x['k2_d10_osiagalne'], -x['k2_d10'], -x['k2_pokryte'], x['linie_diff']))


def klasy_zdan_iu(iu_lista):
    """Klasy w bloku D10, który planner wkleiłby jednostce: moduł gałęzi na polu Pliki IU (katalogi jak w planie), limit 2000 zn jak
    `wiedza.mjs wycinek`, bez reguł projektu (kopie faz ich nie mają). Wejście: [[pliki IU], …] → [[klasy], …]."""
    mod = os.path.join(SZ, '.claude', 'scripts', 'wiedza', 'zapobieganie.mjs')
    out = subprocess.run(['node', '--input-type=module', '-e', "const m = await import(%s); console.log(JSON.stringify(%s.map((p) => "
                          "m.zapobieganie([], p, { limitZn: 2000 }).klasy)))" % (json.dumps(mod), json.dumps(iu_lista))],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def klasy_d10():
    """Klasy ze zdaniem i pokryte — z modułu D10 gałęzi (drzewo robocze szablonu)."""
    mod = os.path.join(SZ, '.claude', 'scripts', 'wiedza', 'zapobieganie.mjs')
    out = subprocess.run(['node', '--input-type=module', '-e', "const m = await import(%s); console.log(JSON.stringify({zdania: m.ZDANIA.map((z) => z.klasa), "
                          "pokryte: Object.keys(m.POKRYTE)}))" % json.dumps(mod)], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def _slownik_it1():
    import it1_slownik_klas as S
    uwagi = {(u['pr'], u['id']): u['klasa'] for u in csv.DictReader(open(os.path.join(BASE, 'dane', 'coderabbit', 'klasyfikacja-574.csv')))}
    mapa = {stara: nowa for nowa, (_, _, stare, _) in S.SLOWNIK.items() for stara in stare}
    return uwagi, mapa, S.NADPISANIA


def dane_fazy(et, klasy2, slownik):
    meta = json.load(open(os.path.join(TR, 'meta', et + '.json')))
    fz = [v for s, v in json.load(open(os.path.join(BASE, 'dane', 'test-review-fazy.json')))['fazy'].items() if meta['sha'].startswith(s)][0]
    git = lambda *a: subprocess.run(['git', '-C', meta['kopia'], *a], capture_output=True, text=True, check=True).stdout
    feat = commit_fazy(git('log', '--oneline', '%s..%s' % (fz['baza'], meta['sha'])).splitlines())
    baza = git('rev-parse', feat + '^').strip()
    zmienione = set(git('diff', '--name-only', baza, meta['sha']).split())
    linie = sum(int(a) + int(b) for a, b, _ in (l.split('\t', 2) for l in git('diff', '--numstat', baza, meta['sha'], '--', '.', ':!docs', ':!.claude').splitlines()) if a != '-')
    plany = [p for p in git('ls-tree', '--name-only', baza, 'docs/plans/').split() if p.endswith(meta['zadanie'] + '-plan.md')]
    iu = iu_fazy(git('show', '%s:%s' % (baza, plany[0])), fz['numer']) if plany else []
    klucze = json.load(open(os.path.join(TR, 'sedzia', et + '-klucze.json')))['klucze']
    poz = lambda k, klasa: {'id': k['id'], 'klasa': klasa, 'waga': k['waga'], 'plik': k.get('plik'), 'w_zakresie': w_zakresie(k, zmienione)}
    k1 = [poz(k, klasa_klucza1(k['przypadek'], *slownik) or '?') for k in klucze if k['zrodlo'] == 'klucz1']
    k2 = [poz(k, klasy2.get((et, k['id']), '?')) for k in klucze if k['zrodlo'] == 'klucz2']
    return {'et': et, 'zadanie': meta['zadanie'], 'faza': fz['numer'], 'sha': meta['sha'], 'baza_review': fz['baza'], 'baza': baza, 'commit_fazy': feat,
            'plan': plany[0] if plany else None, 'iu': iu, 'ui': ma_ui(iu), 'linie_diff': linie, 'klucz1': k1, 'klucz2': k2}


def main():
    klasy2 = {(x['et'], x['id']): x['klasa'] for x in json.load(open(os.path.join(OUT, 'p12-klucz2-klasy.json')))}
    slownik, d10 = _slownik_it1(), klasy_d10()
    ets = sorted(os.path.basename(p) for p in glob.glob(os.path.join(TR, 'kopie', 'f-*')) if not p.endswith('-r2'))
    fazy = [dane_fazy(et, klasy2, slownik) for et in ets]
    for f in fazy:
        for iu, klasy in zip(f['iu'], klasy_zdan_iu([x['pliki'] for x in f['iu']]) if f['iu'] else []): iu['klasy_d10'] = klasy
        for k in f['klucz1'] + f['klucz2']:
            k['iu'] = iu_klucza(k['plik'], f['iu'])
            k['osiagalny'] = any(k['klasa'] in x['klasy_d10'] for x in f['iu'] if x['id'] in k['iu'])
    r = ranking(fazy, d10)
    zd = set(d10['zdania'])
    L = ['test_review_p12_fazy.py — wybór faz ślepego testu P12 (kandydaci: %d kopii f-*); D10 = klasy ze zdaniem (%d), pokryte = warstwa stała i reguły (%d)'
         % (len(r), len(d10['zdania']), len(d10['pokryte'])),
         'kolejność: IU UI/fullstack → klucz 2 w D10 osiągalny → klucz 2 w D10 → w pokrytych → mniejszy diff',
         'osiągalny = IU, którego pole Pliki obejmuje plik klucza, dostaje zdanie klasy klucza (blok D10 z pola Pliki, limit 2000 zn); plik spoza planu = nieosiągalny',
         'klucz w zakresie = plik klucza zmieniony między bazą buildu (rodzic commita feat fazy) a sha fazy; diff = linie kodu bez docs/ i .claude/',
         '%-10s %-34s %2s | %-28s | k2 %2s D10 %2s osiąg %2s pokr %2s | k1 %2s D10 %2s osiąg %2s | diff %5s' % ('faza', 'zadanie', 'nr', 'IU (typ)', 'n', '', '', '', 'n', '', '', 'linii')]
    skrot = lambda t: t.replace('feature-builder-', '')
    for f in r:
        L.append('%-10s %-34s %2d | %-28s | k2 %2d D10 %2d osiąg %2d pokr %2d | k1 %2d D10 %2d osiąg %2d | diff %5d' % (
            f['et'], f['zadanie'][:34], f['faza'], ' '.join('%s:%s' % (x['id'].replace('IU-', ''), skrot(x['agentType'])) for x in f['iu'])[:28],
            sum(k['w_zakresie'] for k in f['klucz2']), f['k2_d10'], f['k2_d10_osiagalne'], f['k2_pokryte'], sum(k['w_zakresie'] for k in f['klucz1']),
            f['k1_d10'], f['k1_d10_osiagalne'], f['linie_diff']))
        poza = [k['id'] for k in f['klucz1'] + f['klucz2'] if not k['w_zakresie']]
        L.append('           baza buildu %s (commit fazy %s) | klucz2 D10: %s | klucz1 D10: %s%s' % (f['baza'][:7], f['commit_fazy'], ', '.join(
            '%s %s %s%s' % (k['id'], k['waga'], k['klasa'], '' if k['osiagalny'] else ' (nieosiągalny)') for k in f['klucz2'] if k['klasa'] in zd and k['w_zakresie']) or '—', ', '.join(
            '%s %s%s' % (k['id'], k['klasa'], '' if k['osiagalny'] else ' (nieosiągalny)') for k in f['klucz1'] if k['klasa'] in zd and k['w_zakresie']) or '—', (' | poza zakresem: ' + ' '.join(poza)) if poza else ''))
    with open(os.path.join(OUT, 'p12-fazy.json'), 'w') as fo: json.dump({'d10': d10, 'fazy': r}, fo, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'p12-fazy.txt'), 'w') as fo: fo.write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
