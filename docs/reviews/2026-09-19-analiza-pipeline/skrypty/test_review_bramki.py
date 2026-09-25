#!/usr/bin/env python3
"""Test review (TEST-REVIEW-PLAN §5.1) — bramki projektów A/B/C uruchamiane NAPRAWDĘ na kopii fazy (zero agentów, zero tokenów).

Użycie: python3 skrypty/test_review_bramki.py <etykieta> [--bez-strykera]
  etykieta f-<sha7> = faza (baza z dane/test-review-fazy.json), x-<sha7> = commit fixa (baza = rodzic; moduł §2.6).
Wejście: ~/test-review/meta/<etykieta>.json (z test_review_kopia.sh), kopia ~/test-review/kopie/<etykieta>, narzędzia ~/test-review/_narzedzia.
Wyjście: dane/test-review/bramki-<etykieta>.json — per bramka: status (uruchomiona / nieuruchomiona z powodem / nie dotyczy), sekundy,
trafienia per projekt (A/B/C) na liniach DODANYCH w fazie (to idzie do puli sędziego jako BRAMKA), trafienia zastane (tylko liczba),
ostrzeżenia ESLint i knip (wejście list code-quality), przeżyte mutanty Strykera (wejście list test-coverage).

Konfiguracje ESLint = brzmienie pozycji `typ: bramka` z dane/panel-run1-projekty.json przepisane na flat config (REGULY_* niżej, id pozycji
przy każdej regule). Reguła bez implementacji albo bez danych w stanie historycznym = „nieuruchomiona” z powodem (np. advisors, migrations.sum,
vitest --typecheck bez plików *.test-d.ts). Kopia po bramkach musi mieć czysty `git status` (artefakty tylko w katalogach ignorowanych)."""
import json, os, re, subprocess, sys, time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = os.path.expanduser('~/test-review')
NARZ = os.path.join(TR, '_narzedzia')
BIN = os.path.join(NARZ, 'node_modules', '.bin')
KONFIG = os.path.join(NARZ, 'konfig')
OUT = os.path.join(BASE, 'dane', 'test-review')
RE_KOD = re.compile(r'\.(ts|tsx|js|jsx|mjs|cjs)$', re.I)
RE_TS = re.compile(r'\.(ts|tsx)$')
RE_TEST = re.compile(r'(\.test\.|\.spec\.|/tests?/|__tests__|^e2e/)')
TEST_GLOBY = ['**/*.test.*', '**/*.spec.*', 'e2e/**', 'supabase/tests/**', '**/tests/**']
SUFIT_STRYKERA = 900       # C: G-17 sufit 900 s; B-17: timeout 600 s (B dostaje wynik tylko przy czasie <= 600 s); A: G16 maks 3 pliki
SUFIT_B = 600
MAKS_PLIKOW_A = 3

# ── reguły z katalogów (id pozycji → konfiguracja); selektory no-restricted-syntax scalane per zakres plików, bo flat config nadpisuje regułę ──
SEL_CATCH_A = ("CatchClause:not(:has(ThrowStatement)):not(:has(CallExpression[callee.property.name=/^capture(Exception|Message)$/]))"
               ":not(:has(CallExpression[callee.object.name='logger']))")
SEL_CATCH_C = "CatchClause:not(:has(ThrowStatement)):not(:has(CallExpression[callee.name=/^(captureException|captureError)$/]))"
SEL = {
    'G03': [{'selector': SEL_CATCH_A, 'message': 'catch rzuca dalej, zgłasza do Sentry albo loguje'}],
    'G04': [{'selector': "NewExpression[callee.name=/Error$/] MemberExpression[property.name='message']",
             'message': 'nie przenoś message cudzego błędu — przekaż kod i cause'}],
    'G10': [{'selector': "Literal[value=/^(x-forwarded-for|x-real-ip|forwarded)$/i]", 'message': 'IP klienta tylko z modułu client-ip'}],
    'G11': [{'selector': "CallExpression[callee.property.name=/^(query|raw|unsafe|execute|or|filter)$/] > TemplateLiteral[expressions.length>0]",
             'message': 'wartość do zapytania tylko parametrem'},
            {'selector': "CallExpression[callee.property.name=/^(query|raw|unsafe|execute|or|filter)$/] > BinaryExpression[operator='+']",
             'message': 'wartość do zapytania tylko parametrem'}],
    'G12': [{'selector': "CallExpression[callee.name='fetch']:not(:has(Property[key.name='signal']))",
             'message': 'fetch wymaga signal: AbortSignal.timeout(ms)'}],
    'G13': [{'selector': "JSXAttribute[name.name='dangerouslySetInnerHTML']", 'message': 'dangerouslySetInnerHTML tylko z sanitizerem'}],
    'B-09': [{'selector': "CallExpression[callee.name='fetch'][arguments.length<2]", 'message': 'dodaj signal: AbortSignal.timeout(ms)'},
             {'selector': "CallExpression[callee.name='fetch'] > ObjectExpression:not(:has(Property[key.name='signal']))",
              'message': 'dodaj signal: AbortSignal.timeout(ms)'},
             {'selector': "NewExpression[callee.name=/Error$/] > MemberExpression[property.name='message']", 'message': 'zredaguj treść przed Sentry'},
             {'selector': "CallExpression[callee.property.name='captureException'] > MemberExpression[property.name='message']",
              'message': 'zredaguj treść przed Sentry'}],
    'B-10': [{'selector': "CallExpression[callee.object.name='z'][callee.property.name='object']",
              'message': 'na granicy tylko z.strictObject z limitami długości pól'}],
    'G-07': [{'selector': SEL_CATCH_C, 'message': 'catch rzuca dalej albo zgłasza do Sentry'}],
    'G-08': [{'selector': "CallExpression[callee.name='fetch'][arguments.length<2]", 'message': 'fetch z signal: AbortSignal.timeout(ms)'},
             {'selector': "CallExpression[callee.name='fetch'] > ObjectExpression:not(:has(Property[key.name='signal']))",
              'message': 'fetch z signal: AbortSignal.timeout(ms)'}],
    'G-09': [{'selector': "CallExpression[callee.object.name='z'][callee.property.name='object']",
              'message': 'na granicy API z.strictObject obejmujący całą kopertę'}],
}
HOOKS6 = ['rules-of-hooks', 'exhaustive-deps', 'set-state-in-effect', 'refs', 'purity', 'immutability']
IMPORTY_UI = {'group': ['@supabase/supabase-js', '**/lib/supabase*', '**/supabase/client*'], 'message': 'klient bazy tylko w hookach, lib/ i providerze sesji'}
UI_GLOBY = ['**/src/components/**', '**/src/pages/**', '**/src/screens/**']
MAXL = {'max-lines': ['error', {'max': 360, 'skipBlankLines': True, 'skipComments': True}],
        'max-lines-per-function': ['error', {'max': 60, 'skipBlankLines': True, 'skipComments': True}]}
VITEST4 = {'vitest/expect-expect': 'error', 'vitest/valid-expect': 'error', 'vitest/no-conditional-expect': 'error', 'vitest/prefer-called-with': 'error'}

# Projekt → lista bloków (files, ignores, rules, selektory, id pozycji). Kolejność ma znaczenie tylko dla no-restricted-syntax (scalane niżej).
PROJEKTY = {
    'A': [
        ('**/*.{ts,tsx}', None, {'@typescript-eslint/no-floating-promises': 'error', '@typescript-eslint/no-misused-promises': 'error'}, [], 'G01'),
        ('**/*.tsx', None, {'react-hooks/' + r: 'error' for r in HOOKS6}, [], 'G02'),
        ('**/*.{ts,tsx}', TEST_GLOBY, {'no-empty': ['error', {'allowEmptyCatch': False}], 'no-console': 'error'}, ['G03'], 'G03'),
        ('**/*.{ts,tsx}', TEST_GLOBY, {}, ['G04'], 'G04'),
        (UI_GLOBY, None, {'no-restricted-imports': ['error', {'patterns': [IMPORTY_UI]}]}, [], 'G05'),
        ('**/*.{ts,tsx}', None, {'import-x/no-cycle': ['error', {'maxDepth': 'INF'}]}, [], 'G05'),
        ('**/*.{ts,tsx}', TEST_GLOBY + ['**/texts.ts'], dict(MAXL), [], 'G06'),
        ('**/*.{ts,tsx}', TEST_GLOBY, {'@typescript-eslint/no-explicit-any': ['error', {'fixToUnknown': True}],
                                       '@typescript-eslint/no-non-null-assertion': 'error',
                                       '@typescript-eslint/consistent-type-assertions': ['error', {'assertionStyle': 'never'}],
                                       '@typescript-eslint/switch-exhaustiveness-check': 'error'}, [], 'G07'),
        (['**/*.test.*'], None, dict(VITEST4, **{'vitest/no-standalone-expect': 'error'}), [], 'G08'),
        ('**/*.{ts,tsx}', None, {'@typescript-eslint/no-unused-vars': 'error', 'no-unreachable': 'error'}, [], 'G09'),
        (['apps/server/**/*.ts'], TEST_GLOBY, {}, ['G10'], 'G10'),
        ('**/*.{ts,tsx}', None, {}, ['G11', 'G12'], 'G11/G12'),
        ('**/*.tsx', None, {}, ['G13'], 'G13'),
    ],
    'B': [
        ('**/*.{ts,tsx}', None, {'@typescript-eslint/no-floating-promises': 'error',
                                 '@typescript-eslint/no-misused-promises': ['error', {'checksVoidReturn': {'attributes': False}}]}, [], 'B-02'),
        ('**/*.{tsx,jsx}', None, {'react-hooks/' + r: 'error' for r in HOOKS6}, [], 'B-03'),
        ('**/*.{ts,tsx}', None, {'no-empty': ['error', {'allowEmptyCatch': False}], 'no-unreachable': 'error',
                                 '@typescript-eslint/no-unused-vars': 'error', 'no-console': 'error'}, [], 'B-04'),
        ('**/*.{ts,tsx}', None, dict(MAXL), [], 'B-05'),
        ('**/*.{ts,tsx}', None, {'RECOMMENDED_TYPE_CHECKED': 'error', 'STRICT_TYPE_CHECKED': 'warn',
                                 '@typescript-eslint/no-explicit-any': ['error', {'fixToUnknown': True}],
                                 '@typescript-eslint/no-non-null-assertion': 'error', '@typescript-eslint/consistent-type-imports': 'error',
                                 '@typescript-eslint/switch-exhaustiveness-check': ['error', {'requireDefaultForNonUnion': True}],
                                 'import-x/order': 'error'}, [], 'B-06'),
        (UI_GLOBY + ['**/src/app/**'], None, {'no-restricted-imports': ['error', {'patterns': [
            {'group': ['@supabase/supabase-js', '@supabase/ssr', '**/lib/supabase*'], 'message': 'Baza i auth tylko przez hook z src/hooks albo lib/'}]}]}, [], 'B-07'),
        (['**/src/**/*.{ts,tsx}'], None, {'import-x/no-cycle': ['error', {'ignoreExternal': True}]}, [], 'B-07'),
        (['**/*.test.ts', '**/*.test.tsx'], None, dict(VITEST4), [], 'B-08'),
        ('**/*.{ts,tsx}', None, {}, ['B-09'], 'B-09'),
        (['**/server/**/*.ts', 'supabase/functions/**', '**/src/**/api/**'], None, {}, ['B-10'], 'B-10'),
    ],
    'C': [
        ('**/*.{ts,tsx}', None, {'RECOMMENDED_TYPE_CHECKED': 'error', 'STRICT_TYPE_CHECKED': 'warn', 'import-x/order': 'error'}, [], 'G-03'),
        ('**/*.{ts,tsx}', None, {'@typescript-eslint/no-floating-promises': ['error', {'ignoreVoid': False}],
                                 '@typescript-eslint/no-misused-promises': 'error'}, [], 'G-04'),
        (['apps/dashboard/**/*.{ts,tsx}'], None, {'REACT_HOOKS_RECOMMENDED': 'error', **{'react-hooks/' + r: 'error' for r in
                                                  ['set-state-in-effect', 'refs', 'purity', 'immutability', 'exhaustive-deps']}}, [], 'G-05'),
        ('**/*.{ts,tsx}', None, {'no-empty': ['error', {'allowEmptyCatch': False}], 'no-unreachable': 'error',
                                 '@typescript-eslint/no-unused-vars': 'error'}, [], 'G-06'),
        (['**/src/**/*.{ts,tsx}', '**/server/**/*.ts'], TEST_GLOBY + ['scripts/**'], {'no-console': 'error'}, ['G-07'], 'G-07'),
        ('**/*.{ts,tsx}', None, {}, ['G-08'], 'G-08'),
        (['**/server/**/*.ts', '**/src/**/api/**'], None, {}, ['G-09'], 'G-09'),
        ('**/*.{ts,tsx}', None, dict(MAXL), [], 'G-10'),
        (['**/*.test.ts', '**/*.test.tsx'], None, dict(VITEST4), [], 'G-11'),
        (UI_GLOBY, None, {'no-restricted-imports': ['error', {'patterns': [IMPORTY_UI]}]}, [], 'G-12'),
        ('**/*.{ts,tsx}', None, {'import-x/no-cycle': ['error', {'ignoreExternal': True}]}, [], 'G-12'),
    ],
}
# Moduł §2.6 (kontrola diffu fixa): A — G01 „fix na plikach fixa”; B — K-04 = B-02…B-15 na plikach fixa; C — G-02..G-12 „koniec fixa”.
FIX_A = {'G01'}


def js(v):
    return json.dumps(v, ensure_ascii=False).replace('"INF"', 'Infinity')


def konfiguracja(projekt, tylko=None):
    """Tekst eslint.config .mjs dla projektu; tylko = zbiór id pozycji (moduł fixa)."""
    bloki = [b for b in PROJEKTY[projekt] if not tylko or b[4] in tylko]
    wyj = []
    for files, ignores, rules, sel_ids, pid in bloki:
        files = [files] if isinstance(files, str) else files
        r = {k: v for k, v in rules.items() if k not in ('RECOMMENDED_TYPE_CHECKED', 'STRICT_TYPE_CHECKED', 'REACT_HOOKS_RECOMMENDED')}
        pre = ''
        if 'RECOMMENDED_TYPE_CHECKED' in rules:
            pre += '...rtc(%s, %s, "error"),\n  ' % (js(files), js(ignores or []))
        if 'STRICT_TYPE_CHECKED' in rules:
            pre += '...rtc(%s, %s, "warn", true),\n  ' % (js(files), js(ignores or []))
        if 'REACT_HOOKS_RECOMMENDED' in rules:
            r = dict({'_RH_': 1}, **r)
        blok = {'files': files, 'rules': r}
        if ignores: blok['ignores'] = ignores
        tekst = js(blok)
        if '_RH_' in r:
            tekst = tekst.replace('"_RH_": 1,', '...reactHooks.configs["recommended-latest"].rules,').replace('"_RH_": 1', '...reactHooks.configs["recommended-latest"].rules')
        wyj.append('%s{ ...WSPOLNE, ...%s }, // %s' % (pre, tekst, pid))
    # no-restricted-syntax: jeden wpis na zakres plików = suma selektorów wszystkich bloków, których zakres go obejmuje (flat config nadpisuje regułę)
    sel_bloki = [b for b in bloki if b[3]]
    for files, ignores, _, sel_ids, pid in sel_bloki:
        files = [files] if isinstance(files, str) else files
        wszystkie = []
        for f2, i2, _, s2, _ in sel_bloki:
            if pokrywa(f2, i2, files, ignores):
                for s in s2: wszystkie += SEL[s]
        blok = {'files': files, 'rules': {'no-restricted-syntax': ['error'] + wszystkie}}
        if ignores: blok['ignores'] = ignores
        wyj.append('{ ...WSPOLNE, ...%s }, // %s (selektory scalone)' % (js(blok), pid))
    return NAGLOWEK + '\n  '.join(wyj) + '\n]\n'


def pokrywa(f_ogolny, i_ogolny, f_szczeg, i_szczeg):
    """Czy blok ogólny obejmuje pliki bloku szczegółowego (heurystyka na znanych globach katalogów)."""
    f_ogolny = [f_ogolny] if isinstance(f_ogolny, str) else f_ogolny
    if f_ogolny == f_szczeg and (i_ogolny or []) == (i_szczeg or []): return True
    ogolne = {'**/*.{ts,tsx}'}
    if not any(f in ogolne for f in f_ogolny):
        return False
    if i_ogolny and not i_szczeg:   # ogólny wyklucza testy, szczegółowy nie — nie scalaj (testy dostałyby cudze selektory)
        return False
    return True


NAGLOWEK = '''// wygenerowane przez skrypty/test_review_bramki.py z pozycji `typ: bramka` katalogu projektu (dane/panel-run1-projekty.json)
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import vitest from '@vitest/eslint-plugin'
import importX from 'eslint-plugin-import-x'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
const WSPOLNE = {
  languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: process.cwd() } },
  plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooks, vitest, 'import-x': importX },
  settings: { 'import-x/resolver-next': [createTypeScriptImportResolver({ project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'] })] },
  linterOptions: { reportUnusedDisableDirectives: 'off' },
}
// strict jako warn obejmuje TYLKO reguły spoza recommended — inaczej późniejszy blok warn nadpisałby recommended error (flat config)
const REC = new Set(tseslint.configs.recommendedTypeChecked.flatMap((c) => Object.keys(c.rules || {})))
const rtc = (files, ignores, poziom, strict) => (strict ? tseslint.configs.strictTypeChecked : tseslint.configs.recommendedTypeChecked)
  .filter((c) => c.rules).map((c) => ({ ...WSPOLNE, files, ignores, rules: Object.fromEntries(Object.entries(c.rules)
    .filter(([k, v]) => v !== 'off' && !(Array.isArray(v) && v[0] === 'off') && !(strict && REC.has(k)))
    .map(([k, v]) => [k, Array.isArray(v) ? [poziom, ...v.slice(1)] : poziom])) }))
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/*.d.ts', '.stryker-tmp/**', '**/.stryker-tmp/**', '**/database.types.ts'] },
  '''


def sh(cmd, cwd, timeout=900, env=None):
    t = time.time()
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=env, shell=isinstance(cmd, str))
        return p.returncode, p.stdout, p.stderr, round(time.time() - t, 1)
    except subprocess.TimeoutExpired as e:
        return 'timeout', (e.stdout or b'').decode(errors='ignore') if isinstance(e.stdout, bytes) else (e.stdout or ''), '', round(time.time() - t, 1)


def git(k, *a):
    return subprocess.run(['git', '-C', k, *a], capture_output=True, text=True).stdout


def dodane_linie(k, baza):
    """{plik: set(numery linii dodanych/zmienionych w stanie po)} z git diff -U0."""
    wyn, plik = {}, None
    for l in git(k, 'diff', '-U0', '--no-color', baza + '..HEAD').splitlines():
        if l.startswith('+++ '):
            plik = l[6:] if l.startswith('+++ b/') else None
            if plik: wyn.setdefault(plik, set())
        elif l.startswith('@@') and plik:
            m = re.search(r'\+(\d+)(?:,(\d+))?', l)
            start, n = int(m.group(1)), int(m.group(2) if m.group(2) is not None else 1)
            wyn[plik].update(range(start, start + n))
    return wyn


def eslint(k, projekt, pliki, dod, tylko=None, etykieta=''):
    cfg = os.path.join(KONFIG, 'eslint-%s%s.mjs' % (projekt, '-fix' if tylko else ''))
    open(cfg, 'w').write(konfiguracja(projekt, tylko))
    if not pliki: return {'status': 'nie dotyczy: brak plików .ts/.tsx w diffie'}
    kod, out, err, s = sh([os.path.join(BIN, 'eslint'), '-c', cfg, '--no-config-lookup', '-f', 'json', *pliki], k, timeout=600)
    try:
        dane = json.loads(out)
    except ValueError:
        return {'status': 'nieuruchomiona: ESLint nie zwrócił JSON (kod %s): %s' % (kod, (err or out)[:300]), 'sekundy': s}
    traf, zastane, ostrz, nieobj = [], 0, [], []
    for f in dane:
        rel = os.path.relpath(f['filePath'], k)
        for m in f['messages']:
            if m.get('fatal') or not m.get('ruleId'):
                nieobj.append('%s: %s' % (rel, m['message'][:120])); continue
            w = {'plik': rel, 'linia': m.get('line'), 'regula': m['ruleId'], 'opis': m['message'][:300]}
            if m['severity'] == 1:
                if m.get('line') in dod.get(rel, ()): ostrz.append(w)
                continue
            if m.get('line') in dod.get(rel, ()): traf.append(w)
            else: zastane += 1
    return {'status': 'uruchomiona', 'sekundy': s, 'konfiguracja': os.path.relpath(cfg, TR), 'trafienia': traf, 'zastane_poza_liniami_fazy': zastane,
            'ostrzezenia_na_liniach_fazy': ostrz, 'nieobjete': nieobj[:20], 'nieobjete_n': len(nieobj)}


# --production liczy tylko wpisy oznaczone „!” (dokumentacja knip: production mode)
KNIP = {'$schema': 'https://unpkg.com/knip@6/schema.json', 'workspaces': {
    '.': {'entry': ['scripts/**/*.{ts,mjs}!', 'e2e/**/*.ts'], 'project': ['scripts/**/*.{ts,mjs}!']},
    'apps/server': {'entry': ['src/index.ts!'], 'project': ['src/**/*.ts!']},
    'apps/dashboard': {'entry': ['src/main.tsx!'], 'project': ['src/**/*.{ts,tsx}!']},
    'packages/shared': {'entry': ['src/index.ts!'], 'project': ['src/**/*.ts!']}},
    'ignore': ['.claude/**', 'szablony/**', '**/database.types.ts', '.design/**']}


def knip(k, pliki_fazy, dod, dodane_pliki):
    cfg = os.path.join(KONFIG, 'knip.json')
    json.dump(KNIP, open(cfg, 'w'), indent=1)
    kod, out, err, s = sh([os.path.join(BIN, 'knip'), '--production', '--reporter', 'json', '--no-progress', '--config', cfg], k, timeout=300)
    try:
        dane = json.loads(out)
    except ValueError:
        return {'status': 'nieuruchomiona: knip bez JSON (kod %s): %s' % (kod, (err or out)[:300]), 'sekundy': s}
    traf, poza = [], 0
    for i in dane.get('issues', []):
        f = i['file']
        for typ in ('files', 'exports', 'types', 'dependencies', 'devDependencies', 'unlisted', 'unresolved', 'duplicates', 'enumMembers'):
            for e in i.get(typ, []):
                grupa = e if isinstance(e, list) else [e]   # duplicates = lista eksportów-duplikatów
                linia = grupa[0].get('line')
                nazwa = ', '.join(str(x.get('name')) for x in grupa)
                nowe = (f in dodane_pliki) or (linia in dod.get(f, ())) or (typ in ('dependencies', 'devDependencies') and f in pliki_fazy)
                if nowe: traf.append({'plik': f, 'linia': linia, 'regula': 'knip/' + typ, 'opis': '%s: %s' % (typ, nazwa)})
                else: poza += 1
    return {'status': 'uruchomiona', 'sekundy': s, 'trafienia': traf, 'zastane': poza}


def migracje(k, baza):
    zm = [l for l in git(k, 'diff', '--name-only', '--diff-filter=MDR', baza + '..HEAD', '--', 'supabase/migrations').split() if l]
    w_bazie = set(git(k, 'ls-tree', '-r', '--name-only', baza, '--', 'supabase/migrations').split())
    przec = [p for p in zm if p in w_bazie]
    return {'status': 'uruchomiona', 'trafienia': [{'plik': p, 'linia': None, 'regula': 'niezmiennosc-migracji',
                                                    'opis': 'zmieniona migracja obecna w bazie — popraw nową migracją'} for p in przec]}


def typecheck(k):
    kod, out, err, s = sh('pnpm -s typecheck', k, timeout=600)
    bledy = re.findall(r'^(\S+\.tsx?)\((\d+),\d+\): error (TS\d+: .*)$', out + err, re.M)
    return {'status': 'uruchomiona', 'sekundy': s, 'kod_wyjscia': kod, 'bledy_ts': len(bledy),
            'trafienia': [{'plik': p, 'linia': int(l), 'regula': 'tsc', 'opis': o[:300]} for p, l, o in bledy]}


def stryker(k, pliki_fazy, dod):
    """Diff-scoped: pliki produkcyjne, których test (x.test.ts obok x.ts) faza zmieniła, zakresy = linie dodane. Jeden bieg na aplikację
    (sufit 900 s = C); B dostaje wynik tylko, gdy bieg zmieścił się w 600 s; A — podzbiór maks 3 plików o największej liczbie linii dodanych."""
    testy = [p for p in pliki_fazy if re.search(r'\.test\.tsx?$', p)]
    prod = {}
    for t in testy:
        p = re.sub(r'\.test\.(tsx?)$', r'.\1', t)
        if p in pliki_fazy and dod.get(p): prod[p] = sorted(dod[p])
    if not prod:
        return {'status': 'nie dotyczy: faza nie zmieniła pary test ↔ plik produkcyjny z liniami dodanymi', 'wyniki': {}}
    wyniki, plugin = {}, os.path.join(NARZ, 'node_modules', '@stryker-mutator', 'vitest-runner', 'dist', 'src', 'index.js')
    robocze = os.path.join(TR, 'robocze', os.path.basename(k)); os.makedirs(robocze, exist_ok=True)
    for app in sorted({'/'.join(p.split('/')[:2]) for p in prod}):
        pliki = {p: l for p, l in prod.items() if p.startswith(app + '/')}
        mutate = []
        for p, linie in pliki.items():
            for a, b in zakresy(linie): mutate.append('%s:%d-%d' % (os.path.relpath(p, app), a, b))
        cfg = {'testRunner': 'vitest', 'plugins': [plugin], 'mutate': mutate, 'reporters': ['json'], 'coverageAnalysis': 'perTest',
               'jsonReporter': {'fileName': os.path.join(robocze, 'stryker-%s.json' % app.replace('/', '-'))},
               'tempDirName': '.stryker-tmp', 'cleanTempDir': 'always', 'incremental': False, 'concurrency': 4, 'timeoutMS': 10000}
        if os.path.exists(os.path.join(k, app, 'vite.config.ts')): cfg['vitest'] = {'configFile': 'vite.config.ts'}
        pc = os.path.join(robocze, 'stryker-%s.conf.json' % app.replace('/', '-'))
        json.dump(cfg, open(pc, 'w'), indent=1)
        kod, out, err, s = sh([os.path.join(BIN, 'stryker'), 'run', pc], os.path.join(k, app), timeout=SUFIT_STRYKERA + 60)
        rap = cfg['jsonReporter']['fileName']
        if kod != 0 or not os.path.exists(rap):
            wyniki[app] = {'status': 'nieuruchomiona: kod %s — %s' % (kod, ((err or '') + (out or ''))[-400:].replace('\n', ' ')), 'sekundy': s}
            continue
        r = json.load(open(rap)); przez, licz = [], {}
        for plik, dane in r.get('files', {}).items():
            relp = os.path.relpath(os.path.join(k, app, plik), k) if not plik.startswith('/') else os.path.relpath(plik, k)
            for m in dane.get('mutants', []):
                licz[m['status']] = licz.get(m['status'], 0) + 1
                if m['status'] in ('Survived', 'NoCoverage'):
                    przez.append({'plik': relp, 'linia': m['location']['start']['line'], 'regula': 'stryker/' + m['mutatorName'],
                                  'opis': '%s: %s → %s' % (m['status'], m['mutatorName'], (m.get('replacement') or '')[:80])})
        wyniki[app] = {'status': 'uruchomiona', 'sekundy': s, 'statusy': licz, 'przezyte': przez}
    top_a = [p for p, _ in sorted(prod.items(), key=lambda kv: -len(kv[1]))[:MAKS_PLIKOW_A]]
    return {'status': 'uruchomiona', 'pliki': prod and {p: len(l) for p, l in prod.items()}, 'pliki_A': top_a, 'wyniki': wyniki}


def zakresy(linie):
    wyn, a = [], None
    for n in linie:
        if a is None: a = b = n
        elif n == b + 1: b = n
        else: wyn.append((a, b)); a = b = n
    if a is not None: wyn.append((a, b))
    return wyn


def main():
    et = sys.argv[1]; bez_strykera = '--bez-strykera' in sys.argv
    meta = json.load(open(os.path.join(TR, 'meta', et + '.json'))); k = meta['kopia']
    fix = et.startswith('x-')
    if fix:
        baza = git(k, 'rev-parse', 'HEAD^').strip()
    else:
        fazy = json.load(open(os.path.join(BASE, 'dane', 'test-review-fazy.json')))['fazy']
        baza = [f['baza'] for s, f in fazy.items() if meta['sha'].startswith(s)][0]
    os.makedirs(KONFIG, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    ex = os.path.join(k, '.git', 'info', 'exclude')
    if '.stryker-tmp/' not in open(ex).read(): open(ex, 'a').write('.stryker-tmp/\nreports/\n')
    pliki = [p for p in git(k, 'diff', '--name-only', '--diff-filter=AMR', baza + '..HEAD').split() if p]
    dodane_pliki = set(p for p in git(k, 'diff', '--name-only', '--diff-filter=A', baza + '..HEAD').split() if p)
    dod = dodane_linie(k, baza)
    ts = [p for p in pliki if RE_TS.search(p) and not p.endswith('.d.ts') and 'database.types' not in p and os.path.exists(os.path.join(k, p))]
    wyn = {'etykieta': et, 'sha': meta['sha'], 'baza': baza, 'modul_fixa': fix, 'pliki': len(pliki),
           'pliki_kodu': len([p for p in pliki if RE_KOD.search(p)]), 'pliki_ts': ts, 'bramki': {}}
    B = wyn['bramki']
    # typecheck PRZED ESLint: skrypt projektu buduje packages/shared (dist) — bez tego reguły typowane widzą importy @oferty/shared jako any
    # (świeża kopia dawała fałszywe no-unsafe-*; wynik ESLint zależał od tego, czy build już był)
    B['typecheck'] = typecheck(k)
    for p in 'ABC':
        B['eslint-' + p] = eslint(k, p, ts, dod, FIX_A if (fix and p == 'A') else None)
    B['knip'] = knip(k, set(pliki), dod, dodane_pliki)
    if fix: B['knip']['projekty'] = 'B (K-04: B-11 na plikach fixa)'
    B['vitest-typecheck'] = {'status': 'nieuruchomiona: brak plików *.test-d.ts w stanie historycznym (bramka zakłada testy typów dodawane przez IU)'
                             if not git(k, 'ls-files', '*.test-d.ts').strip() else 'do uruchomienia: są pliki *.test-d.ts'}
    ui = [p for p in pliki if p.startswith('apps/dashboard/') and re.search(r'\.(tsx|css|html)$', p)]
    B['size-limit'] = {'status': 'nie dotyczy: faza bez plików UI dashboardu'} if not ui else size_limit(k)
    B['migracje-niezmiennosc'] = migracje(k, baza)
    B['migrations-sum'] = {'status': 'nieuruchomiona: brak supabase/migrations.sum w stanie historycznym (plik tworzy wdrożenie bramki)'}
    B['advisors'] = {'status': 'nieuruchomiona: wymaga projektu Supabase w stanie historycznym na chmurze (6a: zero Dockera)'}
    if fix or bez_strykera:
        B['stryker'] = {'status': 'nie dotyczy: moduł fixa' if fix else 'pominięta flagą --bez-strykera'}
    else:
        B['stryker'] = stryker(k, set(pliki), dod)
    brud = git(k, 'status', '--porcelain').strip()
    wyn['git_status_po_bramkach'] = brud.splitlines()[:20]
    wyn['projekty'] = podsumuj(wyn, fix)
    json.dump(wyn, open(os.path.join(OUT, 'bramki-%s.json' % et), 'w'), ensure_ascii=False, indent=1)
    print(raport(wyn))
    if brud: raise SystemExit('STOP: kopia brudna po bramkach:\n' + brud)


def size_limit(k):
    kod, out, err, s1 = sh('pnpm -s --filter @oferty/dashboard run build', k, timeout=600)
    if kod != 0: return {'status': 'nieuruchomiona: build dashboardu kod %s — %s' % (kod, (err or out)[-300:])}
    # size-limit wymaga package.json z pluginem w katalogu uruchomienia -> katalog roboczy w _narzedzia z dowiązaniem node_modules
    rob = os.path.join(NARZ, 'size-limit', os.path.basename(k)); os.makedirs(rob, exist_ok=True)
    json.dump({'name': 'sl', 'private': True, 'devDependencies': {'size-limit': '14.0.1', '@size-limit/file': '14.0.1'}},
              open(os.path.join(rob, 'package.json'), 'w'))
    if not os.path.lexists(os.path.join(rob, 'node_modules')): os.symlink(os.path.join(NARZ, 'node_modules'), os.path.join(rob, 'node_modules'))
    json.dump([{'name': 'dashboard js', 'path': os.path.join(k, 'apps/dashboard/dist/assets/*.js'), 'limit': '600 kB', 'gzip': True},
               {'name': 'dashboard css', 'path': os.path.join(k, 'apps/dashboard/dist/assets/*.css'), 'limit': '60 kB', 'gzip': True}],
              open(os.path.join(rob, '.size-limit.json'), 'w'))
    kod, out, err, s2 = sh([os.path.join(BIN, 'size-limit'), '--json'], rob, timeout=120)
    try: dane = json.loads(out)
    except ValueError: return {'status': 'nieuruchomiona: size-limit bez JSON — ' + (err or out)[:300]}
    if isinstance(dane, dict): return {'status': 'nieuruchomiona: size-limit — ' + str(dane.get('error'))[:300]}
    traf = [{'plik': 'apps/dashboard', 'linia': None, 'regula': 'size-limit', 'opis': '%s: %s B > limit' % (d['name'], d['size'])}
            for d in dane if not d.get('passed', True)]
    return {'status': 'uruchomiona', 'sekundy': s1 + s2, 'wyniki': dane, 'trafienia': traf}


def podsumuj(w, fix):
    """Trafienia na liniach fazy per projekt (do puli sędziego) + wejścia dla reviewerów."""
    B, out = w['bramki'], {}
    wspolne = (B['migracje-niezmiennosc'].get('trafienia') or []) + (B['typecheck'].get('trafienia') or [])
    size = B['size-limit'].get('trafienia') or []
    stryk = B['stryker'].get('wyniki') or {}
    for p in 'ABC':
        tr = list(B['eslint-' + p].get('trafienia') or []) + wspolne
        if not fix or p == 'B': tr += B['knip'].get('trafienia') or []
        if not fix: tr += size
        mut = []
        for app, r in stryk.items():
            if r.get('status') != 'uruchomiona': continue
            if p == 'B' and r['sekundy'] > SUFIT_B: continue
            for m in r['przezyte']:
                if p == 'A' and m['plik'] not in (B['stryker'].get('pliki_A') or []): continue
                mut.append(m)
        out[p] = {'trafienia': tr, 'mutanty_przezyte': mut, 'ostrzezenia_eslint': B['eslint-' + p].get('ostrzezenia_na_liniach_fazy') or [],
                  'knip': B['knip'].get('trafienia') or []}
    return out


def raport(w):
    L = ['bramki %s (baza %s, plików %d, kodu %d, ts %d%s)' % (w['etykieta'], w['baza'][:10], w['pliki'], w['pliki_kodu'], len(w['pliki_ts']),
                                                               ', moduł fixa' if w['modul_fixa'] else '')]
    for n, b in w['bramki'].items():
        extra = ''
        if 'trafienia' in b: extra += ' trafienia %d' % len(b['trafienia'])
        if 'zastane_poza_liniami_fazy' in b: extra += ' zastane %d nieobjęte %d ostrz. %d' % (b['zastane_poza_liniami_fazy'], b['nieobjete_n'],
                                                                                               len(b['ostrzezenia_na_liniach_fazy']))
        if n == 'stryker' and b.get('wyniki'):
            extra += ' ' + '; '.join('%s: %s %ss %s' % (a, r['status'][:40], r.get('sekundy'), r.get('statusy', '')) for a, r in b['wyniki'].items())
        L.append('  %-22s %s%s%s' % (n, b['status'][:110], (' (%s s)' % b['sekundy']) if b.get('sekundy') is not None else '', extra))
    for p, r in w['projekty'].items():
        L.append('  projekt %s: do puli %d, mutanty %d, ostrz. ESLint %d' % (p, len(r['trafienia']), len(r['mutanty_przezyte']), len(r['ostrzezenia_eslint'])))
    L.append('  git status po bramkach: %s' % ('czysty' if not w['git_status_po_bramkach'] else w['git_status_po_bramkach'][:5]))
    return '\n'.join(L)


if __name__ == '__main__':
    main()
