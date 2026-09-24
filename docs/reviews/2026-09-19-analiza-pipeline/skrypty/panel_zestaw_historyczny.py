#!/usr/bin/env python3
"""Panel decyzyjny, krok 0 (b): zestaw historyczny dla sędziego jakości (run 2).

Źródła (tylko odczyt):
  - dane/coderabbit/klasyfikacja-574.csv — uwagi bota z koszykiem; bierzemy koszyk B bez klasy `test-kruchy` (ETAP1B §1: 200 → 195);
  - ~/Documents/Kodowanie/oferty-online/docs/solutions/**.md — compoundy dokumentujące uwagi bota po naszym review
    (ETAP1 §3: 80 uwag z 19 compoundów, 68 realnych). Compound daje kontekst (przyczyna, fragment kodu), więc przypadek
    z B dopasowany do compoundu dostaje ścieżkę do niego.
Dopasowanie compound → B: ten sam PR (tag `pr-NN` albo „PR #N”), ta sama nazwa pliku w backtickach, |linia| ≤ 3, gdy obie strony ją podają.
Compound nie jest osobnym źródłem przypadków: dokumentuje te same wątki bota (ETAP1 §3 liczył je na poziomie klas), więc jego rola to kontekst.
Rodzina klas: 69 surowych klas B → rodziny z ETAP1 §3 / ETAP1B §3 (nazwane w dokumentach, które czytają projektanci) albo „ogon”
(klasy spoza tych tabel — quasi-hold-out: projektant nie widzi ich po nazwie, więc pokrycie ogona mierzy uogólnienie, nie dopasowanie).
Wyjście: dane/panel-zestaw-historyczny.jsonl (jeden przypadek na linię) + dane/panel-zestaw-historyczny.txt (podsumowanie).
"""
import collections, csv, glob, json, os, re, unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(BASE, 'dane', 'coderabbit', 'klasyfikacja-574.csv')
SOL = os.path.expanduser('~/Documents/Kodowanie/oferty-online/docs/solutions')
BOT = os.path.join(BASE, 'dane', 'coderabbit', 'bot-comments.jsonl')
TRESC_ZN = 900  # początek treści wątku bota (sędzia widzi defekt, nie tylko streszczenie klasyfikatora)
OUT_JSONL = os.path.join(BASE, 'dane', 'panel-zestaw-historyczny.jsonl')
OUT_TXT = os.path.join(BASE, 'dane', 'panel-zestaw-historyczny.txt')
EPOKA_WRZESIEN = set(range(13, 20))  # d5b v2: baseline = PR 13–19

# rodzina -> surowe klasy B; rodziny nazwane w ETAP1 §3 / ETAP1B §3 (widoczne dla projektantów)
RODZINY = {
    'test-niefalsyfikowalny': ['test-niefalsyfikowalny', 'luka-pokrycia', 'straznik-negatywny', 'test-brak-pokrycia'],
    'cykl-zycia-wspolbieznosc': ['cykl-zycia-react', 'bramka-na-jednej-z-dwoch-drog', 'wszystkie-drogi-do-operacji', 'cykl-zycia-wspolbieznosc',
                                 'wyscig-rownolegly', 'wartosc-po-await', 'petla-ponowien-bez-sufitu', 'stan-ui-nieczyszczony'],
    'sciezka-bledu': ['sciezka-bledu', 'sciezka-bledu-bez-obslugi', 'pusty-catch', 'blad-polkniety', 'nieobsluzone-odrzucenie',
                      'granica-try-catch', 'utrata-danych-przy-bledzie'],
    'bramka-czarna-lista': ['bramka-czarna-lista', 'asymetria-bramek', 'dopasowanie-fragmentu'],
    'pii-sekret-w-bledzie': ['pii-w-message', 'pii-do-sentry', 'pii-w-repo', 'pii-w-logu', 'sekret-do-sentry', 'sekret-w-argv'],
    'walidacja-granicy': ['walidacja-granicy-api', 'walidacja-granicy', 'zod-granica'],
    'tekst-ui': ['tekst-ui'],
    'parser-regexem': ['parser-regexem', 'parser-html-regexem', 'parser-tokenizer'],
    'granica-wartosci-migracja': ['granica-wartosci-migracja'],
    'brak-timeoutu': ['brak-timeoutu'],
    'seed-vs-kontrakt': ['seed-niezgodny-z-kontraktem', 'seed-dane-zrodlowe'],
    'dokument-sterujacy': ['wada-dokumentu-sterujacego'],
    'kontrakt-duplikacja': ['kontrakt-shared', 'duplikacja-logiki', 'kontrakt-vs-implementacja', 'martwa-galaz'],
    'spojnosc-dwoch-systemow': ['spojnosc-dwoch-systemow', 'wspolne-wiadro-limitu'],
}
KLASA_RODZINA = {k: r for r, ks in RODZINY.items() for k in ks}
OS_NORM = [('correctness', 'correctness'), ('test-coverage', 'test-coverage'), ('security', 'security'), ('spec-compliance', 'spec'),
           ('code-quality', 'code-quality'), ('performance', 'performance'), ('e2e', 'e2e'), ('domkniecie', 'domkniecie/kontrola-fixa'),
           ('kontrola diffu', 'domkniecie/kontrola-fixa')]


def os_wlasciciel(etap):
    for k, v in OS_NORM:
        if k in (etap or ''):
            return v
    return 'brak'


def plik_linia(p):
    m = re.match(r'^(.*?):(\d+)(?:-\d+)?$', p or '')
    return (os.path.basename(m.group(1)), int(m.group(2))) if m else (os.path.basename(p or ''), None)


def slowa(t):
    t = unicodedata.normalize('NFKD', (t or '').lower()).encode('ascii', 'ignore').decode()
    return {w for w in re.findall(r'[a-z0-9_]{4,}', t)}


def tresc_watku(kand, linia, streszczenie):
    """Wątek bota dla przypadku: przy numerze linii najbliższy (|Δ| ≤ 3), bez linii — największe pokrycie słów streszczenia
    (id w CSV nadawali klasyfikatorzy etapu 1b niespójnie, więc nie służą do złączenia)."""
    if not kand:
        return None, 'brak'
    if linia is not None:
        k = min(kand, key=lambda o: abs((o.get('line') or 0) - linia))
        return (k['body'], 'linia') if abs((k.get('line') or 0) - linia) <= 3 else (None, 'brak')
    s = slowa(streszczenie)
    oc = sorted(((len(s & slowa(o['body'])) / max(1, len(s)), o) for o in kand), key=lambda x: -x[0])
    if len(oc) == 1:
        return oc[0][1]['body'], 'jedyny'
    return (oc[0][1]['body'], 'slowa') if oc[0][0] >= 0.3 and oc[0][0] > oc[1][0] else (None, 'niejednoznaczne')


def compoundy():
    """Compoundy z tagiem pr-NN i wzmianką o bocie; zwraca listę (ścieżka, pr, [(plik, linia)])."""
    out = []
    for f in sorted(glob.glob(os.path.join(SOL, '**', '*.md'), recursive=True)):
        t = open(f, encoding='utf-8', errors='ignore').read()
        if not re.search(r'CodeRabbit|coderabbit|\bbot', t):
            continue
        prs = sorted({int(a or b) for a, b in re.findall(r'\bpr-(\d+)\b|PR ?#(\d+)', t)})
        refs = {(os.path.basename(a), int(b) if b else None)
                for a, b in re.findall(r'`([\w./@-]+\.(?:tsx?|sql|mjs|js|ya?ml|json))(?::(\d+))?`', t)}
        out.append((os.path.relpath(f, SOL), prs, sorted(refs, key=lambda r: (r[0], r[1] or 0))))
    return out


def main():
    wiersze = [r for r in csv.DictReader(open(CSV, encoding='utf-8')) if r['koszyk'] == 'B']
    b = [r for r in wiersze if r['klasa'] != 'test-kruchy']
    comp = compoundy()
    bot = collections.defaultdict(list)
    for l in open(BOT, encoding='utf-8'):
        o = json.loads(l)
        if o.get('in_reply_to') is None:
            bot[(o['pr'], os.path.basename(o.get('path') or ''))].append(o)
    przypadki = []
    for r in b:
        pr = int(r['pr']); plik, linia = plik_linia(r['plik'])
        dop = [c for c, prs, refs in comp if pr in prs and any(p == plik and (linia is None or l is None or abs(l - linia) <= 3) for p, l in refs)]
        rodz = KLASA_RODZINA.get(r['klasa'])
        tresc, jak = tresc_watku(bot.get((pr, plik), []), linia, r['streszczenie'])
        tresc = re.sub(r'<details>.*?</details>', '', tresc, flags=re.S).strip()[:TRESC_ZN] if tresc else None  # bez zwiniętych skryptów bota
        przypadki.append(dict(
            id='B-%02d-%s' % (pr, r['id']), pr=pr, epoka='wrzesien' if pr in EPOKA_WRZESIEN else 'sierpien', plik=r['plik'],
            klasa=r['klasa'], rodzina=rodz or 'ogon:' + r['klasa'], widoczna_dla_projektantow=rodz is not None,
            waga=r['severity'], os_wlasciciel=os_wlasciciel(r['etap']), etap_surowy=r['etap'], dlaczego=r['dlaczegoPrzeszlo'],
            streszczenie=r['streszczenie'], tresc_bota=tresc, tresc_dopasowanie=jak, compound=dop[0] if dop else None))
    with open(OUT_JSONL, 'w', encoding='utf-8') as f:
        for p in przypadki:
            f.write(json.dumps(p, ensure_ascii=False) + '\n')

    L = []; C = collections.Counter
    L.append('Panel decyzyjny — krok 0 (b): zestaw historyczny (skrypt panel_zestaw_historyczny.py)')
    L.append('koszyk B w CSV: %d; bez test-kruchy: %d (ETAP1B §1: 195)' % (len(wiersze), len(przypadki)))
    L.append('waga: %s' % dict(C(p['waga'] for p in przypadki)))
    L.append('P1/P2: %d' % sum(p['waga'] in ('P1', 'P2') for p in przypadki))
    L.append('epoka: %s' % dict(C(p['epoka'] for p in przypadki)))
    L.append('os_wlasciciel: %s' % C(p['os_wlasciciel'] for p in przypadki).most_common())
    L.append('dlaczego: %s' % C(p['dlaczego'] for p in przypadki).most_common())
    wid = [p for p in przypadki if p['widoczna_dla_projektantow']]
    L.append('rodziny widoczne dla projektantów (ETAP1 §3 / ETAP1B §3): %d przypadków, ogon: %d (%d klas)'
             % (len(wid), len(przypadki) - len(wid), len({p['klasa'] for p in przypadki if not p['widoczna_dla_projektantow']})))
    L.append('ogon P1/P2: %d' % sum(1 for p in przypadki if not p['widoczna_dla_projektantow'] and p['waga'] in ('P1', 'P2')))
    L.append('rodziny: %s' % C(p['rodzina'] for p in przypadki if p['widoczna_dla_projektantow']).most_common())
    L.append('treść wątku bota — sposób dopasowania: %s' % dict(C(p['tresc_dopasowanie'] for p in przypadki)))
    L.append('')
    L.append('compoundy z wzmianką o bocie: %d; z tagiem pr-NN: %d' % (len(comp), sum(1 for c in comp if c[1])))
    ref_n = sum(len(c[2]) for c in comp)
    z_comp = [p for p in przypadki if p['compound']]
    L.append('przypadki B z dopasowanym compoundem: %d (odwołań plik:linia w compoundach: %d)' % (len(z_comp), ref_n))
    L.append('PR przypadków z compoundem: %s' % dict(C(p['pr'] for p in z_comp)))
    for c, prs, refs in comp:
        n = sum(1 for p in przypadki if p['compound'] == c)
        L.append('  %-110s pr=%s refs=%d dopasowane_B=%d' % (c[:110], prs, len(refs), n))
    open(OUT_TXT, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
