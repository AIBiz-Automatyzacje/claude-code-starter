#!/usr/bin/env python3
"""D2 (etap 3 L2): ile instrukcji dostaje DZIS jeden reviewer i jeden builder w oferty-online.
Jednostka instrukcji = pozycja listy (-, *, 1., (1), checkbox) ALBO zdanie prozy z markerem nakazu
(NIGDY/ZAWSZE/MUSI/nie wolno/uzyj/sprawdz/wypisz/zglos/zwroc/never/always/must/do not/use/check...).
Dwie liczby per skladnik: pozycje list (dolna granica) i pozycje list + zdania nakazowe (gorna).
Uzycie: d2_budzet_instrukcji.py <repo oferty-online>  -> dane/pomiar6-budzet-instrukcji.{json,txt}"""
import csv, glob, json, os, re, sys

REPO = sys.argv[1]
S = os.path.dirname(os.path.abspath(__file__)) + '/../dane/'
ROOT = os.path.expanduser('~/.claude/projects')
MARKERY = re.compile(r"\b(NIGDY|ZAWSZE|MUSI|MUSISZ|nie wolno|zabronion|obowiazk|obowiązk|u[zż]yj|sprawd[zź]|wypisz|zg[lł]o[sś]|zwr[oó][cć]|nie r[oó]b|traktuj|uruchom|przeczytaj|zacznij|nie czytaj|nie zg[lł]aszaj|nie zapisuj|pomi[nń]|unikaj|wymaga|never|always|must|do not|don't|should|use |check|ensure|avoid|verify|report|prefer|include|require)", re.I)
LISTA = re.compile(r'^\s*(?:[-*•]|\d+[.)]|\(\d+\)|\[[ x]\]|[a-z]\))\s+\S')

def policz(tekst):
    linie = tekst.splitlines()
    listy = [l for l in linie if LISTA.match(l)]
    proza = ' '.join(l for l in linie if not LISTA.match(l) and not l.startswith('#') and not l.startswith('```'))
    zdania = [z for z in re.split(r'(?<=[.!?])\s+', proza) if len(z) > 15]
    nakazy = [z for z in zdania if MARKERY.search(z)]
    return {'znaki': len(tekst), 'tokeny_szac': round(len(tekst) / 3.5), 'linie': len(linie), 'pozycje_list': len(listy), 'zdania_nakazowe': len(nakazy),
            'instrukcje_gorna': len(listy) + len(nakazy)}

def plik(p):
    return open(p, encoding='utf-8', errors='ignore').read()

def blok_js(js, nazwa):
    m = re.search(r'const ' + nazwa + r' = `(.*?)`', js, re.S)
    return m.group(1) if m else ''

def funkcja_teksty(js, nazwa):
    """teksty w backtickach wewnatrz funkcji (przyblizenie: od 'function nazwa' do nastepnego 'function ' / 'const ' na poczatku linii)"""
    m = re.search(r'^function ' + nazwa + r'\b.*?(?=^function |^const |^// ──)', js, re.S | re.M)
    if not m:
        return ''
    return '\n'.join(re.findall(r'`(.*?)`', m.group(0), re.S))

wf_review = plik(f'{REPO}/.claude/workflows/dev-docs-review-wf.js')
wf_exec = plik(f'{REPO}/.claude/workflows/dev-docs-execute-wf.js')
fokusy = dict(re.findall(r"key: '([\w-]+)',.*?fokus: '(.*?)' \}", wf_review, re.S))

# realny prompt buildera (iu.prompt od plannera) z ostatniego runu oferty-online
def prompt_of(r):
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + r['projekt'])
    jfs = glob.glob(os.path.join(base, '*', 'subagents', 'workflows', r['run'], f"agent-{r['agent']}.jsonl"))
    if not jfs:
        return ''
    for line in open(jfs[0], errors='ignore'):
        try:
            o = json.loads(line)
        except Exception:
            continue
        if o.get('type') == 'user':
            c = (o.get('message') or {}).get('content')
            return c if isinstance(c, str) else ' '.join(b.get('text', '') for b in c if isinstance(b, dict))
    return ''
buildy = [r for r in csv.DictReader(open(S + 'agents.csv')) if r['projekt'] == 'oferty-online' and r['opis'].startswith('build:')]
buildy.sort(key=lambda r: r['start'])
prompty_build = [prompt_of(r) for r in buildy[-5:]]
prompty_build = [p for p in prompty_build if p]
iu_prompt = max(prompty_build, key=len) if prompty_build else ''
iu_med = sorted(prompty_build, key=len)[len(prompty_build) // 2] if prompty_build else ''

WSPOLNE = {
    'CLAUDE.md (oferty-online)': plik(f'{REPO}/CLAUDE.md'),
    'rules/coding-rules.md (eager)': plik(f'{REPO}/.claude/rules/coding-rules.md'),
    'rules/learned-patterns.md (eager)': plik(f'{REPO}/.claude/rules/learned-patterns.md'),
}
ROLE = {
    'reviewer security': {
        'plik agenta security-sentinel.md': plik(f'{REPO}/.claude/agents/security-sentinel.md'),
        'fokus osi (workflow)': fokusy.get('security', ''),
        'reviewerPrompt naglowek + zrodlaBlok': funkcja_teksty(wf_review, 'reviewerPrompt') + funkcja_teksty(wf_review, 'zrodlaBlok'),
        'BLOK_ZAUFANIE': blok_js(wf_review, 'BLOK_ZAUFANIE'),
        'BLOK_LIMIT_P3': blok_js(wf_review, 'BLOK_LIMIT_P3'),
        'mapaBlok (diff + dossier + pre-skan, tekst staly)': funkcja_teksty(wf_review, 'mapaBlok'),
        'dossier: learned-patterns.md DRUGI RAZ (w calosci)': plik(f'{REPO}/.claude/rules/learned-patterns.md'),
        **WSPOLNE,
    },
    'reviewer code-quality (architecture-strategist, fokus 3 osi)': {
        'plik agenta architecture-strategist.md': plik(f'{REPO}/.claude/agents/architecture-strategist.md'),
        'fokus osi (workflow)': fokusy.get('code-quality', ''),
        'reviewerPrompt naglowek + zrodlaBlok': funkcja_teksty(wf_review, 'reviewerPrompt') + funkcja_teksty(wf_review, 'zrodlaBlok'),
        'BLOK_ZAUFANIE': blok_js(wf_review, 'BLOK_ZAUFANIE'),
        'BLOK_LIMIT_P3': blok_js(wf_review, 'BLOK_LIMIT_P3'),
        'mapaBlok (diff + dossier + pre-skan, tekst staly)': funkcja_teksty(wf_review, 'mapaBlok'),
        'dossier: learned-patterns.md DRUGI RAZ (w calosci)': plik(f'{REPO}/.claude/rules/learned-patterns.md'),
        **WSPOLNE,
    },
    'reviewer spec-compliance (+BLOK_SEMANTYKA)': {
        'plik agenta spec-compliance-reviewer.md': plik(f'{REPO}/.claude/agents/spec-compliance-reviewer.md'),
        'fokus osi (workflow)': fokusy.get('spec-compliance', ''),
        'reviewerPrompt naglowek + zrodlaBlok': funkcja_teksty(wf_review, 'reviewerPrompt') + funkcja_teksty(wf_review, 'zrodlaBlok'),
        'BLOK_ZAUFANIE': blok_js(wf_review, 'BLOK_ZAUFANIE'),
        'BLOK_SEMANTYKA': blok_js(wf_review, 'BLOK_SEMANTYKA'),
        'BLOK_LIMIT_P3': blok_js(wf_review, 'BLOK_LIMIT_P3'),
        'mapaBlok (diff + dossier + pre-skan, tekst staly)': funkcja_teksty(wf_review, 'mapaBlok'),
        'dossier: learned-patterns.md DRUGI RAZ (w calosci)': plik(f'{REPO}/.claude/rules/learned-patterns.md'),
        **WSPOLNE,
    },
    'builder feature-builder-data': {
        'plik agenta feature-builder-data.md': plik(f'{REPO}/.claude/agents/feature-builder-data.md'),
        'iu.prompt od plannera (najdluzszy z 5 ostatnich buildow)': iu_prompt,
        'BLOK_DLUGIE_KOMENDY': blok_js(wf_exec, 'BLOK_DLUGIE_KOMENDY'),
        'skills: supabase-dev-guidelines': plik(f'{REPO}/.claude/skills/supabase-dev-guidelines/SKILL.md'),
        'skills: security': plik(f'{REPO}/.claude/skills/security/SKILL.md'),
        'skills: sentry-integration': plik(f'{REPO}/.claude/skills/sentry-integration/SKILL.md'),
        **WSPOLNE,
    },
}
wyn = {}
out = []
for rola, sklad in ROLE.items():
    out.append(f'\n=== {rola} ===')
    suma = {'znaki': 0, 'tokeny_szac': 0, 'pozycje_list': 0, 'zdania_nakazowe': 0, 'instrukcje_gorna': 0}
    wyn[rola] = {'skladniki': {}, 'suma': None}
    for nazwa, tekst in sklad.items():
        p = policz(tekst)
        wyn[rola]['skladniki'][nazwa] = p
        for k in suma:
            suma[k] += p[k]
        out.append(f"  {nazwa:58s} {p['znaki']:7d} zn ~{p['tokeny_szac']:6d} tok | list {p['pozycje_list']:4d} | zdan nakaz {p['zdania_nakazowe']:4d} | razem {p['instrukcje_gorna']:4d}")
    wyn[rola]['suma'] = suma
    out.append(f"  {'SUMA':58s} {suma['znaki']:7d} zn ~{suma['tokeny_szac']:6d} tok | list {suma['pozycje_list']:4d} | zdan nakaz {suma['zdania_nakazowe']:4d} | RAZEM {suma['instrukcje_gorna']:4d}")
if iu_med:
    out.append(f"\n(iu.prompt buildera: {len(prompty_build)} probek z 5 ostatnich buildow, mediana {len(iu_med)} zn, max {len(iu_prompt)} zn)")
out.append('\nProgi IFScale (ETAP2 §0 pkt 1): 10 instrukcji -> 98-100%; 150 -> 84-99%; 500 -> ~68% (blad = ciche pominiecie).')
txt = '\n'.join(out)
print(txt)
json.dump(wyn, open(S + 'pomiar6-budzet-instrukcji.json', 'w'), ensure_ascii=False, indent=1)
open(S + 'pomiar6-budzet-instrukcji.txt', 'w').write('D2 — budzet instrukcji per rola (oferty-online, ' + REPO + ')\nSkrypt: skrypty/d2_budzet_instrukcji.py\n' + txt + '\n')
