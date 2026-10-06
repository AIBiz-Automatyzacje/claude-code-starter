#!/usr/bin/env python3
"""Ślepy test P12 (PLAN-POPRAWY §3 P12, HANDOFF 6a pkt 67 a, 69 j) — stare vs nowe buildery na kopii fazy cofniętej do bazy buildu.

Warianty: „stary” = .claude z main (buildery sprzed P12), „nowy” = .claude z gałęzi P12. Każdy wariant buduje fazę w SWOJEJ kopii
(klon kopii fazy z ~/test-review/kopie, HEAD = rodzic commita feat fazy, przyszłe refy i obiekty usunięte, artefakty builda z przyszłości
skasowane) skryptem dev-docs-execute-wf.js SWOJEGO .claude z args wklejonymi (ciało bajt w bajt). Wynik każdego wariantu przegląda TEN SAM
review z main (dev-docs-review-wf.js ucięty przed Verify, jak w P11). Sędzia w jednym przebiegu ocenia na kluczu fazy (klucz 1 + klucz 2
z P11), czy defekt jest w kodzie implementacji A, B, C — trzecia to kod historyczny fazy (wszystkie klucze były w nim obecne: czułość sędziego).

Logika z testami (test_review_p12_test.py); wejście-wyjście: test_review_p12_cli.py, przebieg fazy: test_review_p12.sh."""
import glob, hashlib, json, os, random, re, shutil, subprocess

import test_review_p11 as P11

TR = os.path.expanduser('~/test-review')
P12 = os.path.join(TR, 'p12')
WARIANTY = ('stary', 'nowy')
WARIANTY_SEDZIEGO = ('stary', 'nowy', 'historyczny')
ETYKIETY = ('A', 'B', 'C')
OCENY = ('OBECNY', 'ZAPOBIEZONY', 'BRAK_ODPOWIEDNIKA')
GALAZ = 'test-p12'
# katalogi i pliki ignorowane przez gita, które build zostawił w kopii fazy (kod z przyszłości: dist, cache transformacji, raporty)
ARTEFAKTY = {'dist', 'build', 'coverage', '.vite', '.turbo', '.stryker-tmp', 'reports'}
DOCUMENTS = '//Users/kacper_trzepiecinski/Documents/**'


def sha(t):
    return hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]


META_BUILD = ("export const meta = {\n  name: 'test-review-p12-build-%s',\n  description: 'Slepy test P12: dev-docs-execute-wf.js wariantu %s, args wklejone, "
              "cialo bez zmian',\n  phases: [{ title: 'Plan IU' }, { title: 'Build' }, { title: 'Domkniecie' }],\n}\n")
META_REVIEW = ("export const meta = {\n  name: 'test-review-p12-review-%s',\n  description: 'Slepy test P12: review z main na wyniku buildu wariantu %s, uciety "
               "przed Verify (findingi po dedupie), tester E2E wylaczony',\n  phases: [{ title: 'Review', detail: 'reviewerzy wg routingu + dedup' }],\n}\n")
OTWARCIE = 'const wynikTestu = await (async (args) => {\n'
ZAMKNIECIE = '\n})(ARGS_TESTU)\nreturn wynikTestu\n'


def wariant_build(src, args, nazwa):
    """Skrypt buildu wariantu: meta testu + args wklejone + CAŁE ciało execute-wf w funkcji z parametrem `args`. Zwraca (js, kontrola)."""
    if not src.startswith('export const meta = {') or '\n}\n' not in src: raise ValueError('workflow bez bloku meta na początku — źródło do przeglądu')
    cialo = src[src.index('\n}\n') + 3:]
    js = (META_BUILD % (nazwa, nazwa) + '// TEST P12: args wklejone w skrypt (sesja przepisujaca JSON myli nawiasy)\n'
          + 'const ARGS_TESTU = ' + json.dumps(args, ensure_ascii=False) + '\n' + OTWARCIE + cialo + ZAMKNIECIE)
    odtworzone = js.split(OTWARCIE, 1)[1][:-len(ZAMKNIECIE)]
    return js, {'zrodlo_sha': sha(src), 'cialo_sha': sha(cialo), 'przechodzi': odtworzone == cialo}


def wariant_review(src, args, w):
    """Review z main ucięty przed Verify — skrypt P11 (kontrola bajtowa tam) z meta testu P12."""
    js, kontrola = P11.wariant(src, args, w)
    return META_REVIEW % (w, w) + js[js.index('\n}\n') + 3:], kontrola


def kolejnosc(et):
    """Kolejność buildów (i review) w fazie z hasha fazy — żaden wariant nie startuje zawsze pierwszy (wspólna maszyna, cache pnpm i Vite)."""
    return sorted(WARIANTY, key=lambda w: sha('p12:%s:%s' % (et, w)))


def _g(kopia, *a, wejscie=None):
    return subprocess.run(['git', '-C', kopia, *a], input=wejscie, capture_output=True, text=True, check=True).stdout


def kopia_bazy(zrodlo, cel, baza, sha_fazy):
    """Kopia wariantu: klon APFS kopii fazy, HEAD = baza buildu na gałęzi GALAZ, bez innych refów, reflogu i obiektów nieosiągalnych
    (commit fazy nie istnieje — `git log --all` nie pokaże implementacji), bez artefaktów builda (dist z kodem fazy). node_modules i .env zostają.
    Zwraca usunięte artefakty i biblioteki workspace'u, których dist trzeba zbudować na bazie (aplikacje importują je z dist)."""
    if os.path.exists(cel): raise FileExistsError(cel)
    os.makedirs(os.path.dirname(cel), exist_ok=True)
    if subprocess.run(['cp', '-c', '-R', zrodlo, cel], capture_output=True).returncode:
        shutil.rmtree(cel, ignore_errors=True)
        subprocess.run(['cp', '-R', zrodlo, cel], check=True)
    sledzone = [p for p in _g(cel, 'ls-files', '-z').split('\0') if p]
    if sledzone: _g(cel, 'update-index', '--no-skip-worktree', '--stdin', wejscie='\n'.join(sledzone))   # nakładka P11 na kopii fazy
    _g(cel, 'checkout', '-q', '-f', '-B', GALAZ, baza)
    for ref in _g(cel, 'for-each-ref', '--format=%(refname)').split():
        if ref != 'refs/heads/' + GALAZ: _g(cel, 'update-ref', '-d', ref)
    _g(cel, 'reflog', 'expire', '--expire=now', '--all')
    _g(cel, 'gc', '--prune=now', '-q')
    obecne = przyszle_w_kopii(cel, _g(zrodlo, 'rev-list', '%s..%s' % (baza, sha_fazy)).split())
    if obecne: raise RuntimeError('commity z przyszłości osiągalne w kopii po czyszczeniu: %s' % ' '.join(c[:10] for c in obecne))
    usuniete = czysc_artefakty(cel)
    status = _g(cel, 'status', '--porcelain', '--untracked-files=all')
    if status: raise RuntimeError('kopia brudna po przygotowaniu:\n' + status[:2000])
    return {'head': _g(cel, 'rev-parse', 'HEAD').strip(), 'usuniete': usuniete, 'biblioteki': biblioteki(usuniete)}


def przyszle_w_kopii(cel, commity):
    """Commity zakresu baza..sha fazy (implementacja i wszystko po niej), które istnieją w kopii — powinna być pusta lista."""
    return [c for c in commity if subprocess.run(['git', '-C', cel, 'cat-file', '-e', c], capture_output=True).returncode == 0]


def czysc_artefakty(cel):
    """Usuwa ignorowane artefakty builda (ARTEFAKTY, *.tsbuildinfo, cache Vite w node_modules); node_modules, .env i nakładka .claude zostają."""
    usuniete = []
    for p in _g(cel, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z').split('\0'):
        p = p.rstrip('/')
        if not p or 'node_modules' in p.split('/') or p.startswith('.claude/'): continue
        if os.path.basename(p) in ARTEFAKTY or p.endswith('.tsbuildinfo'):
            full = os.path.join(cel, p)
            shutil.rmtree(full) if os.path.isdir(full) and not os.path.islink(full) else os.unlink(full)
            usuniete.append(p)
    for d in ('', '*', '*/*'):   # cache transformacji: Vite (wyniki testów), jiti (skompilowany vite.config z późniejszego stanu)
        for c in ('.vite', '.vite-temp', '.cache'):
            for v in glob.glob(os.path.join(cel, d, 'node_modules', c)):
                shutil.rmtree(v); usuniete.append(os.path.relpath(v, cel))
    return sorted(usuniete)


def biblioteki(usuniete):
    """Pakiety workspace'u ze skasowanym dist — aplikacje importują je z dist, więc harness buduje je na bazie przed buildem wariantu."""
    return sorted({os.path.dirname(p) for p in usuniete if p.startswith('packages/') and os.path.basename(p) == 'dist'})


def katalog(et, krok, w, tr=TR):
    """Katalog roboczy sesji kroku: build i review — kopia wariantu, sędzia — katalog z implementacjami A, B, C."""
    if krok.startswith('p12-sedzia'): return os.path.join(tr, 'p12', et, 'sedzia')
    return os.path.join(tr, 'p12-kopie', et, w)


def dozwolone(et, krok, w, tr=TR):
    """Ścieżki pod ~/test-review, które sesja kroku może czytać: kopia wariantu i jej pliki (skrypt, dossier, bramki) albo katalog sędziego."""
    if krok.startswith('p12-sedzia'): return [katalog(et, krok, w, tr)]
    return [katalog(et, krok, w, tr), katalog(et, krok, w, tr) + '-pliki']


def deny_poza(tr, dozw):
    """Wszystko pod `tr` poza dozwolonymi ścieżkami i ich przodkami — rodzeństwo na każdym poziomie (katalog: /**)."""
    wynik = []

    def rek(d):
        for n in sorted(os.listdir(d)):
            p = os.path.join(d, n)
            if p in dozw: continue
            if os.path.isdir(p) and any(x.startswith(p + os.sep) for x in dozw): rek(p)
            else: wynik.append(p + ('/**' if os.path.isdir(p) else ''))
    rek(tr)
    return wynik


SIEC = ['WebFetch', 'WebSearch', 'Bash(gh:*)', 'Bash(curl:*)', 'Bash(wget:*)', 'Bash(git push:*)', 'Bash(git fetch:*)', 'Bash(git pull:*)', 'Bash(git remote:*)']
BEZ_ZAPISU = ['Edit', 'Write', 'NotebookEdit', 'Bash(git commit:*)', 'Bash(git checkout:*)', 'Bash(git reset:*)', 'Bash(git stash:*)']


def ustawienia(et, krok, w, tr=TR):
    """--settings sesji kroku: odczyt (i zapis) tylko w dozwolonych miejscach testu, bez sieci, hooki wyłączone. Build zapisuje w kopii
    (buildery, domknięcie z commitem) — zapis zabroniony w Documents, ~/.claude i reszcie testu; review i sędzia nie zapisują wcale."""
    poza = deny_poza(tr, dozwolone(et, krok, w, tr))
    deny = ['Read(%s)' % DOCUMENTS, 'Read(~/.claude/**)', 'Read(//tmp/tr-*/**)'] + ['Read(/%s)' % p for p in poza]
    if not krok.startswith('p12-sedzia'):   # scratchpad sesji drugiego wariantu (slug jego kopii)
        inny = [x for x in WARIANTY if x != w][0]
        deny += ['Read(/%s/claude-*/*p12-kopie-%s-%s/**)' % (t, et, inny) for t in ('/tmp', '/private/tmp')]
    if krok == 'p12-build':
        deny += ['Read(//tmp/review-*)', 'Read(//private/tmp/review-*)', 'Edit(%s)' % DOCUMENTS, 'Write(%s)' % DOCUMENTS, 'Edit(~/.claude/**)', 'Write(~/.claude/**)']
        deny += ['%s(/%s)' % (n, p) for p in poza for n in ('Edit', 'Write')]
    else:
        deny += BEZ_ZAPISU
    return {'disableAllHooks': True, 'permissions': {'deny': deny + SIEC}}


def zakazane_re(et, krok, w, tr=TR, zadanie=None, faza=None):
    """Przeciek w skanie transkryptów: miejsca z listy deny ścieżką absolutną (także przez Bash), przez ~ i $HOME, przez ../ do drugiego
    wariantu i katalogów testu, scratchpad drugiego wariantu, transkrypty i historia plików ~/.claude, Documents, zrzuty review w /tmp
    (build: poza zrzutami własnej fazy — domknięcie pisze je samo; przed buildem harness przenosi stare). Względne `../..` wewnątrz kopii
    są zwykłą pracą (importy, cd do pakietu) — drugi wariant i kopię historyczną zamyka na czas buildu chmod (test_review_p12_cli.zamknij)."""
    wlasne = r'p12-kopie/%s/%s(?:-pliki)?(?![\w.-])' % (re.escape(et), re.escape(w))
    wzorce = [r'/Documents/', r'\.claude/(projects|file-history)', r'/tmp/tr-', r'(~|\$HOME|\$\{HOME\})/test-review(?!/%s)' % wlasne,
              r'\.\./(?:\.\./)*(?:kopie|p11|p12|sedzia|wyniki|odrzucone|[fx]-[0-9a-f]{7})(?![\w.-])']
    wzorce += [re.escape(p[:-3] if p.endswith('/**') else p) + r'(?![\w.-])' for p in deny_poza(tr, dozwolone(et, krok, w, tr))]
    if not krok.startswith('p12-sedzia'):
        inny = [x for x in WARIANTY if x != w][0]
        wzorce += [r'\.\./%s(?:-pliki)?(?![\w.-])' % inny, r'-p12-kopie-%s-%s(?![\w.-])' % (re.escape(et), inny)]
    if krok == 'p12-build' and zadanie: wzorce.append(r'/tmp/review-(?!(?:diff|ctx)-%s-faza-%s\.)' % (re.escape(zadanie), faza))
    else: wzorce.append(r'/tmp/review-')
    return re.compile('|'.join(wzorce))


def plik_werdyktu(et, krok, w, p12=P12):
    return os.path.join(p12, et, 'skan-%s-%s.json' % (krok, w))


def zapisz_werdykt(et, krok, w, kod, zdarzenia, p12=P12):
    """Werdykt skanu kroku: wznowienie uznaje krok za zrobiony tylko przy kodzie 0 (STOP i przeciek wymagają decyzji, nie powtórki)."""
    os.makedirs(os.path.join(p12, et), exist_ok=True)
    with open(plik_werdyktu(et, krok, w, p12), 'w') as f: json.dump({'kod': kod, 'zdarzenia': zdarzenia}, f, ensure_ascii=False, indent=1)


def werdykt_skanu(et, krok, w, p12=P12):
    p = plik_werdyktu(et, krok, w, p12)
    if not os.path.exists(p): return None
    with open(p) as f: return json.load(f)


def permutacja(et):
    """Etykieta sędziego → wariant; ziarno z fazy (sędzia widzi tylko A, B, C)."""
    w = list(WARIANTY_SEDZIEGO)
    random.Random(int(hashlib.sha256(('p12:sedzia:%s' % et).encode()).hexdigest()[:8], 16)).shuffle(w)
    return dict(zip(ETYKIETY, w))


RE_HASH = re.compile(r'\b[0-9a-f]{7,40}\b')
RE_LINIA_PLIKU = re.compile(r'(\.[A-Za-z]{1,5}):\d+(?:[-–]\d+)?')
RE_LINIE = re.compile(r'\(?\b(?:linie|linia|linii|lines?|L)\s*\d+(?:\s*[-–]\s*\d+)?\)?', re.I)
RE_STATUS = re.compile(r'^.*(Confirmed as addressed|Addressed in commit).*$', re.M | re.I)
RE_STATUS_FRAZA = re.compile(r'\b(NADAL OTWART\w*)\b\s*(\([^)]*\))?\.?|\(?\bzweryfikowany\b[^)\n]*\)?', re.I)
RE_NASTEPNY = re.compile(r'\n#{2,4} ')


def czysc_tresc(t):
    """Treść klucza bez śladów implementacji, w której go znaleziono: następny finding w tym samym wpisie, statusy naprawy, hashe commitów,
    numery linii (te trzy wskazywałyby sędziemu kod historyczny i zawyżały czułość)."""
    t = RE_NASTEPNY.split(t or '', maxsplit=1)[0]
    t = RE_STATUS_FRAZA.sub('', RE_STATUS.sub('', t))
    t = RE_LINIA_PLIKU.sub(r'\1', RE_HASH.sub('', t))
    t = RE_LINIE.sub('', t)
    return re.sub(r'\n{3,}', '\n\n', re.sub(r'[ \t]{2,}', ' ', t)).strip()


def prompt_sedziego(klucze, kat):
    """Prompt sędziego obecności defektu: klucz z neutralnymi id (bez źródła, przypadku bota, wycinku kodu historycznego i numerów linii —
    zdradzałyby, która implementacja jest historyczna), trzy implementacje w podkatalogach A, B, C."""
    bloki = []
    for k in klucze['klucze']:
        bloki.append('%s | waga %s | plik w implementacji, w której go znaleziono: %s\nStreszczenie: %s\nOpis: %s' % (
            k['id'], k.get('waga') or '?', k.get('plik') or '?', czysc_tresc(k.get('streszczenie')),
            czysc_tresc(k.get('tresc'))[:1500] or '(brak — tylko streszczenie)'))
    return '''Jesteś sędzią porównania implementacji. W katalogu %(kat)s leżą trzy implementacje tej samej fazy projektu, każda w swoim podkatalogu:
%(kat)s/A, %(kat)s/B, %(kat)s/C. W każdym: `zmiany.diff` (zmiany kodu fazy względem wspólnego punktu startu, bez docs/ i .claude/) oraz `pliki/`
(pełna treść plików kodu zmienionych w fazie, po implementacji, ścieżki względem korzenia projektu).

Poniżej lista defektów (%(ids)s) znalezionych w jednej z możliwych implementacji tej fazy. Dla KAŻDEGO defektu i KAŻDEJ z implementacji A, B, C
wystaw jedną ocenę:
- OBECNY — implementacja ma kod, którego defekt dotyczy, i ten sam mechanizm błędu w nim jest (także pod inną nazwą albo w innym pliku);
- ZAPOBIEZONY — implementacja ma kod, którego defekt dotyczy, i robi to poprawnie: opisany scenariusz nie daje w niej złego wyniku;
- BRAK_ODPOWIEDNIKA — implementacja nie ma kodu, którego defekt dotyczy (tej części nie zbudowała albo zbudowała tak, że opis nie ma zastosowania).
Implementacje różnią się strukturą, nazwami i podziałem na pliki, a miejsce podane przy defekcie dotyczy implementacji, w której go znaleziono —
odpowiednika szukasz po zachowaniu (grep po nazwach i pojęciach z opisu w `pliki/` i `zmiany.diff`, potem czytanie kodu). Każdą implementację
oceniasz osobno, na podstawie jej kodu, i nie zakładasz, że któraś jest lepsza. W polu dowod podajesz plik:linia w ocenianej implementacji
(przy OBECNY i ZAPOBIEZONY obowiązkowo), w polu uzasadnienie jedno–dwa zdania: co w kodzie przesądza o ocenie. Czytasz wyłącznie pliki w %(kat)s.

Zwracasz dokładnie %(m)d ocen: po jednej na parę (defekt, implementacja), pole wariant = A, B albo C.

=== DEFEKTY ===
%(bloki)s''' % {'kat': kat, 'ids': ', '.join(k['id'] for k in klucze['klucze']), 'm': 3 * len(klucze['klucze']), 'bloki': '\n\n'.join(bloki)}


def wynik_sedziego(sedzia, mapowanie):
    """Oceny sędziego per wariant: klucz 1 / klucz 2 / razem / grupy klas (d10, pokryte, inne); czułość = OBECNY na kodzie historycznym;
    pary stary–nowy na kluczach, które oba warianty mają w kodzie (bez BRAK_ODPOWIEDNIKA)."""
    pusty = lambda: dict({o: 0 for o in OCENY}, brak_oceny=0)
    oceny = {(x['id'], x['wariant']): x['ocena'] for x in sedzia.get('oceny') or []}
    w = {v: {'klucz1': pusty(), 'klucz2': pusty(), 'razem': pusty(), 'grupy': {}} for v in WARIANTY_SEDZIEGO}
    per_k = {}
    for k, info in mapowanie['K'].items():
        per_k[k] = {}
        for e, v in mapowanie['warianty'].items():
            o = oceny.get((k, e), 'brak_oceny')
            per_k[k][v] = o
            for t in (w[v][info['zrodlo']], w[v]['razem'], w[v]['grupy'].setdefault(info['grupa'], pusty())): t[o] += 1
    n = len(mapowanie['K'])
    w['czulosc_historycznego'] = round(w['historyczny']['razem']['OBECNY'] / n, 3) if n else None
    pary = {'tylko_nowy': [], 'tylko_stary': [], 'oba_zapobiegly': [], 'oba_obecne': [], 'brak_odpowiednika': []}
    for k, o in per_k.items():
        s, nw = o['stary'], o['nowy']
        if {s, nw} - {'OBECNY', 'ZAPOBIEZONY'}: pary['brak_odpowiednika'].append(k)
        elif s == nw: pary['oba_zapobiegly' if s == 'ZAPOBIEZONY' else 'oba_obecne'].append(k)
        else: pary['tylko_nowy' if nw == 'ZAPOBIEZONY' else 'tylko_stary'].append(k)
    w['pary'], w['klucze'] = pary, per_k
    return w


if __name__ == '__main__':
    raise SystemExit(__doc__)
