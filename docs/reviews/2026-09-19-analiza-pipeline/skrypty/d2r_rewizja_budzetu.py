#!/usr/bin/env python3
"""D2 — rewizja (przeglad domkniec na Opus 5.5, 2026-09-23). Czy licznik instrukcji z d2_budzet_instrukcji.py mierzy to, co IFScale.
IFScale (arXiv 2507.11538): instrukcja = "Include the exact word {keyword}" — atomowa, zawsze obowiazujaca, sprawdzana regexem.
Kroki:
  1. Te same skladniki co D2 dla reviewera security i buildera danych (stan plikow DZIS w repo oferty-online).
  2. Jednostki licznika D2 (pozycje list + zdania z markerem nakazu) wypisane i LOSOWA probka (seed 7) po 30 na role do recznej oceny:
     P = polecenie dzialania, ktore agent ma wykonac w tym zadaniu; W = warunkowe (dotyczy tylko okreslonej sytuacji / technologii);
     N = nie polecenie (opis, lista plikow, przyklad, uzasadnienie, linia kodu). Oceny w slowniku OCENY (sesja 2026-09-23).
  3. Artefakty: linie list wewnatrz blokow ``` (kod liczony jako instrukcje), dubel learned-patterns (eager + dossier), pozycje list bez
     markera (te same tresci zapisane proza nie bylyby liczone — licznik zalezy od formy zapisu).
  4. iu.prompt buildera: mediana z 5 ostatnich buildow zamiast maksimum.
Wyjscie: dane/d2r-rewizja-budzetu.{txt,json}. Uzycie: d2r_rewizja_budzetu.py <repo_oferty_online>"""
import csv, glob, json, os, random, re, statistics, sys

REPO = sys.argv[1]
S = os.path.dirname(os.path.abspath(__file__)) + '/../dane/'
ROOT = os.path.expanduser('~/.claude/projects')
# identyczne z d2_budzet_instrukcji.py
MARKERY = re.compile(r"\b(NIGDY|ZAWSZE|MUSI|MUSISZ|nie wolno|zabronion|obowiazk|obowiązk|u[zż]yj|sprawd[zź]|wypisz|zg[lł]o[sś]|zwr[oó][cć]|nie r[oó]b|traktuj|uruchom|przeczytaj|zacznij|nie czytaj|nie zg[lł]aszaj|nie zapisuj|pomi[nń]|unikaj|wymaga|never|always|must|do not|don't|should|use |check|ensure|avoid|verify|report|prefer|include|require)", re.I)
LISTA = re.compile(r'^\s*(?:[-*•]|\d+[.)]|\(\d+\)|\[[ x]\]|[a-z]\))\s+\S')


def jednostki(tekst, zrodlo):
    """Jednostki dokladnie tak, jak liczy D2, z flaga 'w_kodzie' dla pozycji list lezacych w bloku ```."""
    out, w_kodzie, proza = [], False, []
    for l in tekst.splitlines():
        if l.lstrip().startswith('```'):
            w_kodzie = not w_kodzie
            continue
        if LISTA.match(l):
            out.append({'zrodlo': zrodlo, 'typ': 'lista', 'tekst': l.strip()[:220], 'w_kodzie': w_kodzie, 'marker': bool(MARKERY.search(l))})
        elif not l.startswith('#'):
            proza.append(l)
    for z in re.split(r'(?<=[.!?])\s+', ' '.join(proza)):
        if len(z) > 15 and MARKERY.search(z):
            out.append({'zrodlo': zrodlo, 'typ': 'zdanie', 'tekst': z.strip()[:220], 'w_kodzie': False, 'marker': True})
    return out


def plik(p):
    return open(p, encoding='utf-8', errors='ignore').read()


def teksty_funkcji(js, nazwa):
    m = re.search(r'^function ' + nazwa + r'\b.*?(?=^function |^const |^// ──)', js, re.S | re.M)
    return '\n'.join(re.findall(r'`(.*?)`', m.group(0), re.S)) if m else ''


def blok(js, nazwa):
    m = re.search(r'const ' + nazwa + r' = `(.*?)`', js, re.S)
    return m.group(1) if m else ''


def prompt_of(r):
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + r['projekt'])
    jfs = glob.glob(os.path.join(base, '*', 'subagents', 'workflows', r['run'], f"agent-{r['agent']}.jsonl"))
    for line in open(jfs[0], errors='ignore'):
        o = json.loads(line)
        if o.get('type') == 'user':
            c = o['message']['content']
            return c if isinstance(c, str) else ' '.join(b.get('text', '') for b in c if isinstance(b, dict))
    raise RuntimeError(r['agent'])


wf_r = plik(f'{REPO}/.claude/workflows/dev-docs-review-wf.js')
wf_e = plik(f'{REPO}/.claude/workflows/dev-docs-execute-wf.js')
fokus = dict(re.findall(r"key: '([\w-]+)',.*?fokus: '(.*?)' \}", wf_r, re.S))
buildy = sorted((r for r in csv.DictReader(open(S + 'agents.csv')) if r['projekt'] == 'oferty-online' and r['opis'].startswith('build:')), key=lambda r: r['start'])[-5:]
iu = sorted((prompt_of(r) for r in buildy), key=len)
LP = plik(f'{REPO}/.claude/rules/learned-patterns.md')
WSP = {'CLAUDE.md': plik(f'{REPO}/CLAUDE.md'), 'coding-rules': plik(f'{REPO}/.claude/rules/coding-rules.md'), 'learned-patterns (eager)': LP}
ROLE = {
    'reviewer security': {'agent security-sentinel': plik(f'{REPO}/.claude/agents/security-sentinel.md'),
                          'bloki workflow': fokus.get('security', '') + '\n' + teksty_funkcji(wf_r, 'reviewerPrompt') + '\n' + teksty_funkcji(wf_r, 'zrodlaBlok')
                          + '\n' + blok(wf_r, 'BLOK_ZAUFANIE') + '\n' + blok(wf_r, 'BLOK_LIMIT_P3') + '\n' + teksty_funkcji(wf_r, 'mapaBlok'),
                          'learned-patterns (dossier, DUBEL)': LP, **WSP},
    'builder data': {'agent feature-builder-data': plik(f'{REPO}/.claude/agents/feature-builder-data.md'),
                     'iu.prompt (mediana z 5)': iu[len(iu) // 2], 'BLOK_DLUGIE_KOMENDY': blok(wf_e, 'BLOK_DLUGIE_KOMENDY'),
                     'skill supabase-dev-guidelines': plik(f'{REPO}/.claude/skills/supabase-dev-guidelines/SKILL.md'),
                     'skill security': plik(f'{REPO}/.claude/skills/security/SKILL.md'),
                     'skill sentry-integration': plik(f'{REPO}/.claude/skills/sentry-integration/SKILL.md'), **WSP},
}

# Reczne oceny probki (klucz: rola, indeks w probce) -> P / W / N. Wypelnione po przeczytaniu probki (sesja 2026-09-23).
OCENY = json.load(open(S + 'd2r-oceny-probki.json')) if os.path.exists(S + 'd2r-oceny-probki.json') else {}

raport, wyn = [], {}
for rola, sklad in ROLE.items():
    wsz = [j for n, t in sklad.items() for j in jednostki(t, n)]
    kod = sum(1 for j in wsz if j['w_kodzie'])
    dubel = sum(1 for j in wsz if j['zrodlo'] == 'learned-patterns (dossier, DUBEL)')
    bez_markera = sum(1 for j in wsz if j['typ'] == 'lista' and not j['marker'] and not j['w_kodzie'])
    raport.append(f'\n=== {rola} ===')
    for n in sklad:
        js = [j for j in wsz if j['zrodlo'] == n]
        raport.append(f"  {n:40s} {len(js):4d} (lista {sum(1 for j in js if j['typ'] == 'lista'):4d}, w kodzie {sum(1 for j in js if j['w_kodzie']):3d}, "
                      f"lista bez markera {sum(1 for j in js if j['typ'] == 'lista' and not j['marker'] and not j['w_kodzie']):4d})")
    raport.append(f'  RAZEM jak D2: {len(wsz)} | w blokach kodu: {kod} | dubel learned-patterns: {dubel} | pozycje list bez markera (poza kodem): {bez_markera}')
    raport.append(f'  bez kodu i bez dubla: {len(wsz) - kod - dubel}')
    random.seed(7)
    kandydaci = [j for j in wsz if not j['w_kodzie'] and j['zrodlo'] != 'learned-patterns (dossier, DUBEL)']
    probka = random.sample(kandydaci, 30)
    oc = OCENY.get(rola, {})
    raport.append('  PROBKA 30 (bez kodu i dubla) z ocena reczna P/W/N:')
    for i, j in enumerate(probka):
        raport.append(f"   [{i:2d}] {oc.get(str(i), '?')} <{j['zrodlo']}> {j['tekst'][:160]}")
    if oc:
        c = {k: sum(1 for v in oc.values() if v == k) for k in 'PWN'}
        prec = (c['P'] + c['W']) / 30
        raport.append(f"  OCENA: P {c['P']}, W {c['W']}, N {c['N']} -> precyzja licznika (P+W)/30 = {prec:.0%}; "
                      f"szacunek polecen w roli (bez kodu i dubla) = {round((len(wsz) - kod - dubel) * prec)}, "
                      f"w tym zawsze obowiazujacych (P) ~{round((len(wsz) - kod - dubel) * c['P'] / 30)}")
        wyn[rola] = {'jak_d2': len(wsz), 'kod': kod, 'dubel': dubel, 'bez_markera': bez_markera, 'P': c['P'], 'W': c['W'], 'N': c['N']}
    json.dump([{**j, 'i': i} for i, j in enumerate(probka)], open(S + f"d2r-probka-{rola.replace(' ', '-')}.json", 'w'), ensure_ascii=False, indent=1)
LP_NAKAZY = 211  # nakazy wewnatrz 37 regul learned-patterns (D2, uzupelnienie)
raport.append('\n=== GORNA GRANICA BEZ PODWOJNEGO LICZENIA (te same zdania learned-patterns liczone RAZ) ===')
for rola, w in wyn.items():
    gorna = w['jak_d2'] - w['dubel'] - 38 + LP_NAKAZY
    raport.append(f"  {rola}: {w['jak_d2']} - dubel {w['dubel']} - 38 pozycji LP + {LP_NAKAZY} nakazow LP = {gorna} (D2: reviewer ~711, builder ~710)")
raport.append(f"\n(iu.prompt buildera: dlugosci 5 ostatnich {[len(p) for p in iu]} zn; D2 bralo maksimum)")
open(S + 'd2r-rewizja-budzetu.txt', 'w').write('\n'.join(raport) + '\n')
json.dump(wyn, open(S + 'd2r-rewizja-budzetu.json', 'w'), ensure_ascii=False, indent=1)
print('\n'.join(raport))
