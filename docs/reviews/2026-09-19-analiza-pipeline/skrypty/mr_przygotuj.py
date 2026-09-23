#!/usr/bin/env python3
"""Mini-run czesc B: markery, prompty serii A/D/E, pliki agentow testowych w kopii, skrypty workflowow.
Uzycie: mr_przygotuj.py <kopia oferty-online>
Wyjscie: dane/mr-markery.json, dane/mr-polecenia.txt, dane/mr-prompty/*.txt, skrypty/mr-workflow-*.js, pliki .claude/agents/mr-*.md w kopii."""
import json, os, random, re, secrets, subprocess, sys

K = sys.argv[1]
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DANE = os.path.join(BASE, 'dane'); PR = os.path.join(DANE, 'mr-prompty'); SK = os.path.join(BASE, 'skrypty')
MODEL_OPUS = 'claude-opus-5-5'
ZIARNO = 20260923
LISTA = re.compile(r'^\s*(?:[-*•]|\d+[.)]|\(\d+\)|\[[ x]\]|[a-z]\))\s+\S')
MARKERY_NAKAZU = re.compile(r"\b(NIGDY|ZAWSZE|MUSI|MUSISZ|nie wolno|zabronion|obowiazk|obowiązk|u[zż]yj|sprawd[zź]|wypisz|zg[lł]o[sś]|zwr[oó][cć]|nie r[oó]b|traktuj|uruchom|przeczytaj|zacznij|nie czytaj|nie zg[lł]aszaj|nie zapisuj|pomi[nń]|unikaj|wymaga|never|always|must|do not|don't|should|use |check|ensure|avoid|verify|report|prefer|include|require)", re.I)
KONFLIKT = re.compile(r'komentarz|comment|jsdoc|nagłów|naglow|header|pierwsz[aą] lini|first line|nazw|naming|prefiks|prefix|describe\(|\bit\(|test\(|stał|const |'
                      r'uruchom|\brun\b|npm|pnpm|bun |vitest|npx|supabase (db|gen|start|functions)|instal|build|deploy|commit', re.I)

def czytaj(p): return open(os.path.join(K, p), encoding='utf-8').read()

def policz_d2(tekst):
    """metoda d2_budzet_instrukcji.py: pozycje list + zdania prozy z markerem nakazu"""
    linie = tekst.splitlines(); listy = [l for l in linie if LISTA.match(l)]
    proza = ' '.join(l for l in linie if not LISTA.match(l) and not l.startswith('#') and not l.startswith('```'))
    zdania = [z for z in re.split(r'(?<=[.!?])\s+', proza) if len(z) > 15]
    return {'pozycje_list': len(listy), 'zdania_nakazowe': sum(1 for z in zdania if MARKERY_NAKAZU.search(z))}

# --- 1. pula prawdziwych polecen (to, co builder danych dostaje dzis) ---
# zestaw buildera fullstack (dostaje wszystkie te pliki dzis) + tresc buildera danych; pozycje list i zdania nakazowe prozy (jednostki D2)
ZRODLA = ['CLAUDE.md', '.claude/rules/coding-rules.md', '.claude/agents/feature-builder-data.md', '.claude/agents/feature-builder-fullstack.md',
          '.claude/skills/supabase-dev-guidelines/SKILL.md', '.claude/skills/security/SKILL.md', '.claude/skills/sentry-integration/SKILL.md',
          '.claude/skills/tailwind-react-guidelines/SKILL.md', '.claude/skills/ux-ui-guidelines/SKILL.md', '.claude/rules/learned-patterns.md']
pula, widziane, odrzut = [], set(), {'konflikt': 0, 'krotkie': 0, 'duplikat': 0}
for z in ZRODLA:
    w_kodzie = False; kandydaci = []; proza = []
    for l in re.sub(r'^---\n.*?\n---\n', '', czytaj(z), flags=re.S).splitlines():  # bez frontmattera
        if l.strip().startswith('```'): w_kodzie = not w_kodzie; continue
        if w_kodzie: continue
        if not LISTA.match(l):
            if not l.startswith(('#', '|', '---')): proza.append(l.strip())
            continue
        kandydaci.append(re.sub(r'^\s*(?:[-*•]|\d+[.)]|\(\d+\)|\[[ x]\]|[a-z]\))\s+', '', l).strip())
    kandydaci += [x for x in re.split(r'(?<=[.!?])\s+', ' '.join(proza)) if MARKERY_NAKAZU.search(x)]
    for t in kandydaci:
        if len(t) < 25: odrzut['krotkie'] += 1; continue
        if KONFLIKT.search(t): odrzut['konflikt'] += 1; continue
        n = re.sub(r'\W+', ' ', t.lower()).strip()
        if n in widziane: odrzut['duplikat'] += 1; continue
        widziane.add(n); pula.append((z, t))
N400, N100 = 400, 100
assert len(pula) >= N400 - 5, 'pula za mala: %d' % len(pula)
rng = random.Random(ZIARNO)
wyb400 = sorted(rng.sample(range(len(pula)), N400 - 5)) if len(pula) > N400 - 5 else list(range(len(pula)))
wyb100 = sorted(rng.sample(wyb400, N100 - 5))

# --- 2. tresci wspolne ---
IU = """IU-MR: Notatki handlowca do oferty (warstwa danych)

Folder zadania: docs/active/mr-notatki-oferty, Implementation Unit IU-MR.

Cel: handlowiec zapisuje prywatne notatki do swojej opublikowanej oferty (np. „klient pytał o rabat”). Notatki widzi tylko właściciel oferty.

Wymagania:
- Tabela public.mr_notatki_oferty: id uuid (PK, gen_random_uuid()), oferta_id uuid (FK → public.offers(id), on delete cascade), autor_id uuid (FK → auth.users(id)), tresc text not null (1–2000 znaków, check w bazie), created_at timestamptz not null default now().
- RLS włączony; polityki select/insert/delete tylko dla właściciela oferty (owner_id z public.offers = (select auth.uid())) i autor_id = (select auth.uid()) przy insert. Brak update — notatka jest niemutowalna.
- Indeks na (oferta_id, created_at desc).
- Moduł serwera: schemat Zod wejścia (oferta_id: uuid, tresc: string po trim 1–2000), funkcja walidacji zwracająca wynik albo błąd z komunikatem po polsku nazywającym problem, funkcja budująca wiersz do insertu z (wejście, autor_id).

Pliki:
- supabase/migrations/20260923120000_mr_notatki_oferty.sql (nowy)
- apps/server/src/offer/mr-notatki.ts (nowy)
- apps/server/src/offer/mr-notatki.test.ts (nowy)

Podejście: wzoruj migrację na supabase/migrations/20260824171406_init_profiles_offers.sql (tabela offers i jej polityki), moduł na apps/server/src/offer/validation.ts (Zod, odmowa z komunikatem zamiast cichej korekty).

Scenariusze testowe:
- Test: poprawne wejście przechodzi walidację i daje wiersz z autor_id.
- Test: pusta treść po trim jest odrzucona z komunikatem.
- Test: treść 2001 znaków jest odrzucona z komunikatem.
- Test: oferta_id, który nie jest uuid, jest odrzucony.

Weryfikacja: migracja, moduł i test istnieją; testy jednostkowe opisują zachowanie z listy scenariuszy."""
WYMAGANIA = """Wymagania wykonania: zaimplementuj kod dla checkboxow implementacyjnych (POMIJAJ: Weryfikacja:,
Operator:, [E2E], [Manual] — to dla review/operatora). Testy dla checkboxow Test: pisz RAZEM z kodem.
Jesli dodajesz zaleznosc (bun add / npm install) — odnotuj to w odchyleniach.
Kopia bez zależności i bez połączenia z bazą: nie uruchamiaj testów, instalacji, buildów ani komend supabase; napisz kod i testy."""
wf = czytaj('.claude/workflows/dev-docs-execute-wf.js')
BLOK = re.search(r'const BLOK_DLUGIE_KOMENDY = `(.*?)`', wf, re.S).group(1)
RAMA = 'To jest Twoje jedyne zadanie w tym przebiegu: wykonaj IU opisane poniżej.\n\n'

def markery():
    h = lambda: secrets.token_hex(3)
    return {'M1': 'MR-' + h(), 'M2': 'MR-' + h(), 'M3': h(), 'M4': h(), 'M5': h()}

def tekst_markera(k, v):
    return {'M1': 'Każdy nowy plik .ts zaczyna się linią `// %s`.' % v,
            'M2': 'Każda nowa migracja SQL zaczyna się linią `-- %s`.' % v,
            'M3': 'Każda eksportowana funkcja w nowym module ma w komentarzu JSDoc tag `@mr %s`.' % v,
            'M4': 'Nazwa każdego nowego testu (`it`/`test`) zaczyna się od `%s:`.' % v,
            'M5': 'Nowy moduł eksportuje stałą `MR_ZNACZNIK = \'%s\'`.' % v}[k]

def blok(wybor, mk, n):
    pozycje = {round(p * n): k for p, k in zip((0.1, 0.3, 0.5, 0.7, 0.9), ('M1', 'M2', 'M3', 'M4', 'M5'))}
    filler = iter(pula[i][1] for i in wybor); out = []
    for nr in range(1, n + 1):
        out.append('- ' + (tekst_markera(pozycje[nr], mk[pozycje[nr]]) if nr in pozycje else next(filler)))
    return '=== POLECENIA (stosuj wszystkie) ===\n' + '\n'.join(out) + '\n=== KONIEC POLECEŃ ===', pozycje

# --- 3. seria D ---
M = {'ziarno': ZIARNO, 'runy': {}}; licz = []
os.makedirs(PR, exist_ok=True)
D = []
for n, wybor in ((100, wyb100), (400, wyb400)):
    for i in range(1, 6):
        mk = markery(); b, poz = blok(wybor, mk, n)
        p = RAMA + IU + '\n\n' + b + '\n\n' + WYMAGANIA + '\n' + BLOK
        rid = 'D%d-%d' % (n, i); open(os.path.join(PR, rid + '.txt'), 'w').write(p)
        M['runy'][rid] = {'seria': 'D', 'ramie': n, 'markery': mk, 'pozycje': {v: k for k, v in poz.items()}}
        D.append({'id': rid, 'prompt': p})
        c = policz_d2(p); licz.append('%s: blok %d pozycji (markery na %s) | caly prompt: %d zn, metoda D2 %d pozycji list + %d zdan nakazowych' % (
            rid, n, sorted(poz), len(p), c['pozycje_list'], c['zdania_nakazowe']))

# --- 4. seria A ---
LP = [t for z, t in pula if z.endswith('learned-patterns.md')]
DANE_RE = r'baz|zaufania|Limity|trigger|migrac|RLS|polity'  # wpisy o warstwie danych
lp = ([t for t in LP if re.search(DANE_RE, t)] + [t for t in LP if not re.search(DANE_RE, t)])[:3]
A = []
for i in range(1, 4):
    mk = markery(); mk['R'] = 'MR-R-' + secrets.token_hex(3); mk['S'] = 'MR-S-' + secrets.token_hex(3)
    reg = [lp[0], tekst_markera('M1', mk['M1']), tekst_markera('M2', mk['M2']), lp[1], tekst_markera('M3', mk['M3']),
           tekst_markera('M4', mk['M4']), lp[2], tekst_markera('M5', mk['M5'])]
    p = RAMA + IU + '\n\nWyuczone reguly projektu:\n' + '\n'.join('- ' + r for r in reg) + '\n\n' + WYMAGANIA + '\n' + BLOK
    rid = 'A-%d' % i; open(os.path.join(PR, rid + '.txt'), 'w').write(p)
    M['runy'][rid] = {'seria': 'A', 'markery': mk,
                      'regula_R': '---\npaths:\n  - "supabase/migrations/**"\n---\n\n# Migracje\n\n- Każda nowa migracja kończy się linią `-- %s`.\n' % mk['R'],
                      'skill_S': '8. **Znacznik Testów**: Każdy nowy plik testu kończy się linią `// %s`' % mk['S']}
    A.append({'id': rid, 'prompt': p})
    c = policz_d2(p); licz.append('%s: caly prompt %d zn, metoda D2 %d pozycji list + %d zdan nakazowych' % (rid, len(p), c['pozycje_list'], c['zdania_nakazowe']))

# --- 5. seria E ---
E = json.load(open(os.path.join(PR, 'e-prompty.json')))
KOM = ['mechaniczny-haiku', 'orkiestracyjny-opus', 'reviewer-opus-plik', 'reviewer-opus-bezpliku', 'sceptyk-opus', 'naprawiacz-opus', 'naprawiacz-haiku', 'builder-opus']
wyc, ile = [], 0
for z, t in pula:
    if z.endswith('learned-patterns.md') and re.search(DANE_RE, t) and ile + len(t) <= 1500:
        wyc.append('- ' + t); ile += len(t) + 3
WYCINEK = 'Wyuczone reguly projektu (wycinek):\n' + '\n'.join(wyc)
POMIAR = '=== POMIAR KONTEKSTU (mini-run) === To jest tylko pomiar kontekstu startowego. Nie wykonuj zadania ponizej i nie uzywaj narzedzi; od razu zwroc {"ok": true}.'
POMIAR_K = '=== KONIEC — przypomnienie: nie wykonuj zadania, zwroc od razu {"ok": true}. ==='
PLIK_T = {'mechaniczny-haiku': 'mr-mechaniczny', 'orkiestracyjny-opus': 'mr-orkiestracyjny', 'reviewer-opus-plik': 'mr-reviewer-plik',
          'reviewer-opus-bezpliku': 'mr-reviewer', 'sceptyk-opus': 'mr-sceptyk', 'naprawiacz-opus': 'mr-naprawiacz', 'naprawiacz-haiku': 'mr-naprawiacz', 'builder-opus': 'mr-builder'}
e1, e2 = [], []
for k in KOM:
    e = E[k]; model = 'haiku' if k.endswith('haiku') else MODEL_OPUS
    dzis_at = e['agentType'] if e['agentType'] != 'workflow-subagent' else None
    e1.append({'id': k + ':dzis', 'agentType': dzis_at, 'model': model, 'prompt': POMIAR + '\n\n' + e['prompt'] + '\n\n' + POMIAR_K})
    e1.append({'id': k + ':T', 'agentType': PLIK_T[k], 'model': model, 'prompt': POMIAR + '\n\n' + e['prompt'] + '\n\n' + POMIAR_K})
    mech = k.startswith('mechaniczny')
    e2.append({'id': k + ':TOL', 'agentType': 'mr-mechaniczny-o' if mech else PLIK_T[k], 'model': model,
               'prompt': POMIAR + '\n\n' + e['prompt'] + ('' if mech else '\n\n' + WYCINEK) + '\n\n' + POMIAR_K})
M['wycinek_zn'] = len(WYCINEK)

# --- 6. pliki agentow w kopii ---
AG = os.path.join(K, '.claude', 'agents')
def fm(tresc): return re.match(r'^---\n(.*?)\n---\n(.*)$', tresc, re.S).groups()
def plik_agenta(nazwa, opis, cialo, extra=''):
    open(os.path.join(AG, nazwa + '.md'), 'w').write('---\nname: %s\ndescription: "%s"\ntools: Read, Bash, Edit, Write\n%s---\n\n%s' % (nazwa, opis, extra, cialo))
MIN = 'Wykonaj zadanie z promptu. Pracujesz w biezacym katalogu roboczym.\n'
plik_agenta('mr-mechaniczny', 'Mini-run: klasa mechaniczna, sama allowlista', MIN)
plik_agenta('mr-mechaniczny-o', 'Mini-run: klasa mechaniczna, allowlista + omitClaudeMd', MIN, 'omitClaudeMd: true\n')
plik_agenta('mr-orkiestracyjny', 'Mini-run: klasa orkiestracyjna, allowlista', MIN)
plik_agenta('mr-reviewer', 'Mini-run: reviewer bez pliku roli, allowlista', MIN)
plik_agenta('mr-sceptyk', 'Mini-run: sceptyk, allowlista', MIN)
plik_agenta('mr-naprawiacz', 'Mini-run: naprawiacz, allowlista', MIN)
f, cialo = fm(czytaj('.claude/agents/spec-compliance-reviewer.md')); plik_agenta('mr-reviewer-plik', 'Mini-run: spec-compliance-reviewer z allowlista', cialo)
f, cialo = fm(czytaj('.claude/agents/feature-builder-data.md'))
sk = re.search(r'^skills:.*$', f, re.M).group(0)
plik_agenta('mr-builder', 'Mini-run: feature-builder-data z allowlista', cialo, sk + '\n')
open(os.path.join(AG, 'mr-builder-czysty.md'), 'w').write('---\nname: mr-builder-czysty\ndescription: "Mini-run seria D: builder bez kontekstu projektu"\n'
    'tools: Read, Bash, Edit, Write, Glob, Grep\nomitClaudeMd: true\n---\n\nImplementujesz jedna jednostke (IU) opisana w prompcie. Pracujesz w biezacym katalogu roboczym.\n')
subprocess.run(['git', '-C', K, 'add', '.claude/agents'], check=True)
subprocess.run(['git', '-C', K, '-c', 'user.name=mini-run', '-c', 'user.email=mr@local', 'commit', '-q', '-m', 'mini-run: agenci testowi'], check=True)

# --- 7. skrypty workflowow (prompty jako literal JSON; meta czysty literal) ---
BUILD = {'type': 'object', 'additionalProperties': False, 'properties': {'id': {'type': 'string'}, 'status': {'type': 'string', 'enum': ['completed', 'partial', 'blocked']},
         'pliki': {'type': 'array', 'items': {'type': 'string'}}, 'odchylenia': {'type': 'array', 'items': {'type': 'string'}},
         'nastepneKroki': {'type': ['string', 'null']}, 'pytanie': {'type': ['string', 'null']}}, 'required': ['id', 'status']}
OK = {'type': 'object', 'properties': {'ok': {'type': 'boolean'}}, 'required': ['ok']}
def js(nazwa, opis, faza, ciało):
    open(os.path.join(SK, 'mr-workflow-%s.js' % nazwa), 'w').write(
        "export const meta = { name: 'mr-%s', description: '%s', phases: [{ title: '%s' }] }\n" % (nazwa.lower(), opis, faza) + ciało)
E_CIALO = """const A = %s
const OK = %s
phase('%s')
const w = await parallel(A.map(a => () => agent(a.prompt, Object.assign({ label: 'mr-%s:' + a.id, phase: '%s', schema: OK, model: a.model, effort: 'low' }, a.agentType ? { agentType: a.agentType } : {}))
  .then(r => ({ id: a.id, wynik: r }))))
return w
"""
js('E1', 'Mini-run seria E1: kontekst startowy dzis i z sama allowlista (16 agentow, 1 tura)', 'E1', E_CIALO % (json.dumps(e1, ensure_ascii=False), json.dumps(OK), 'E1', 'e1', 'E1'))
js('E2', 'Mini-run seria E2: kontekst startowy allowlista + omitClaudeMd + learned-patterns poza eager (8 agentow, 1 tura)', 'E2', E_CIALO % (json.dumps(e2, ensure_ascii=False), json.dumps(OK), 'E2', 'e2', 'E2'))
js('D', 'Mini-run seria D: 100 vs 400 polecen, 10 builderow w worktree', 'D', """const A = %s
const S = %s
phase('D')
const w = await parallel(A.map(a => () => agent(a.prompt, { label: 'mr-d:' + a.id, phase: 'D', schema: S, model: '%s', agentType: 'mr-builder-czysty', isolation: 'worktree' })
  .then(r => ({ id: a.id, wynik: r }))))
return w
""" % (json.dumps(D, ensure_ascii=False), json.dumps(BUILD), MODEL_OPUS))
for a in A:
    js(a['id'].replace('-', ''), 'Mini-run seria A: builder danych dzis, przebieg ' + a['id'], 'A', """const P = %s
const S = %s
phase('A')
const r = await agent(P, { label: 'mr-a:%s', phase: 'A', schema: S, model: '%s', agentType: 'feature-builder-data' })
return { id: '%s', wynik: r }
""" % (json.dumps(a['prompt'], ensure_ascii=False), json.dumps(BUILD), a['id'], MODEL_OPUS, a['id']))

json.dump(M, open(os.path.join(DANE, 'mr-markery.json'), 'w'), ensure_ascii=False, indent=1)
zr = {}
for z, t in pula: zr[z] = zr.get(z, 0) + 1
with open(os.path.join(DANE, 'mr-polecenia.txt'), 'w') as o:
    o.write('Pula prawdziwych polecen buildera danych (z kopii oferty-online): %d pozycji; odrzucone %s\n' % (len(pula), odrzut))
    o.write('per zrodlo: %s\n' % zr)
    o.write('ramie 400: %d z puli + 5 markerow; ramie 100: %d (losowy podzbior ramienia 400, ziarno %d) + 5 markerow\n' % (len(wyb400), len(wyb100), ZIARNO))
    o.write('wycinek learned-patterns do E2: %d zn\nwpisy learned-patterns w A: %s\n\n' % (len(WYCINEK), [t[:60] for t in lp]))
    o.write('\n'.join(licz) + '\n')
print(open(os.path.join(DANE, 'mr-polecenia.txt')).read())
