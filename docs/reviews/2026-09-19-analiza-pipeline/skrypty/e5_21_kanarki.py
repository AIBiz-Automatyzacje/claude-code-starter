#!/usr/bin/env python3
"""E5-21 — test kanarkowy sceptyka P2 (plan paczki P27-P29-E5, S2). Kryterium ustalone przed biegiem (plan):
kanarek obalony = DISAGREE_EVIDENCE. 4/4 → sceptyk zostaje; 3/4 → powtórka z 4 nowymi; ≤ 2/4 → wymiana promptu i powtórka;
0/4 → budżet sceptyka P2 na E5-3.

Użycie:
  python3 skrypty/e5_21_kanarki.py przygotuj <kopia>   — skrypt Workflow: wycinek Verify z BIEŻĄCEGO dev-docs-review-wf.js bajt w bajt
                                                        (z agentType klasa-sceptyk, tier sceptykP2 = medium z TIERY_DOMYSLNE) + 4 prawdziwe
                                                        P2 KOD z review-faza-4.md etapu 5 + 4 kanarki → <kopia>/../kanarki.js
  python3 skrypty/e5_21_kanarki.py uruchom <kopia>     — `claude -p` z katalogu kopii (deny: zapis, sieć, odczyt spoza kopii)
  python3 skrypty/e5_21_kanarki.py wynik <kopia>       — wynik runu → dane/e5-21-kanarki.txt
Kopia: klon vibersi na 42c4e43 (feat fazy 4 etapu 5 = stan, który widział review), bez innych refów i obiektów (fix fazy 4
niedostępny), bez .env*. kontekst = null (mapa packagera nie jest zachowana; blok mapy pusty, jak bez mapy w runie)."""
import glob, json, os, re, subprocess, sys, uuid

import test_review_sceptycy as TS
import test_review_wariant0 as W0
import test_review_sesja as TSS

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REVIEW_F4 = os.path.expanduser('~/Documents/Kodowanie/vibersi/docs/completed/etap-5-interakcje-i-profil/review-faza-4.md')
SHA = '42c4e43'
PRAWDZIWE = ['server/interakcje-dane.ts:25', 'src/hooks/interakcje/use-komentarze.ts:138', 'src/lib/interakcje/komentarze.ts:127',
             'src/lib/interakcje/zadanie-interakcji.ts:48']
# Kanarki: teza sprzeczna z kodem na 42c4e43. Łatwy = przeczy jej linia wskazana w zarzucie; subtelny = trzeba pójść do drugiego pliku
# albo przeczytać łańcuch `??`. Po sortowaniu po pliku każda porcja ma 2 prawdziwe + 1 łatwy + 1 subtelny.
KANARKI = [
    {'id': 'K1', 'rodzaj': 'łatwy', 'plik': 'server/komentarze.ts:118', 'przeczy': 'server/komentarze.ts:115-118',
     'opis': '`obsluzNowy` weryfikuje token Turnstile przed walidacją treści: pusta albo za długa treść zużywa jednorazowy token, więc poprawiony komentarz '
             'wysłany ponownie z tym samym widgetem dostaje 403 `turnstile_nieudany`. Zmiana: `przytnijTresc` przed `opcje.turnstile(...)`.'},
    {'id': 'K2', 'rodzaj': 'subtelny', 'plik': 'src/components/komentarze/pole-komentarza.tsx:197', 'przeczy': 'use-wysylka-komentarza.ts:85-86',
     'opis': '`handleSubmit` czyści pole przed odpowiedzią serwera: `onZmiana(\'\')` biegnie od razu przy wysyłce, więc przy odmowie (`za_dlugi`, sieć, `chwilowy`) '
             'komunikat „Treść została w polu — spróbuj ponownie” stoi pod pustym polem i użytkownik traci tekst. Zmiana: czyścić pole dopiero po wyniku `ok`.'},
    {'id': 'K3', 'rodzaj': 'subtelny', 'plik': 'src/lib/interakcje/zgloszenia.ts:33', 'przeczy': 'src/lib/interakcje/zadanie-interakcji.ts:32-33',
     'opis': 'Koperta z kodem spoza `WYNIKI_KODOW` (np. `auth_niedostepny` przy 503) daje `blad` zamiast `chwilowy`: `odmowaOdpowiedzi` zwraca wynik z koperty, '
             'gdy ta się sparsowała, i nie sięga wtedy do `WYNIKI_STATUSOW`, więc wpis 503 z :33 działa tylko dla odpowiedzi bez koperty. Użytkownik dostaje '
             '„Nie udało się…” zamiast „spróbuj za chwilę”. Zmiana: fallback statusu także dla koperty z nieznanym kodem.'},
    {'id': 'K4', 'rodzaj': 'łatwy', 'plik': 'src/lib/interakcje/zgloszenia.ts:38', 'przeczy': 'src/lib/interakcje/zgloszenia.ts:38',
     'opis': '`wyslijZgloszenie` nie dołącza tokenu Turnstile gościa: `cialo` składa tylko `cel`, `id`, `kod` i `dopisek`, więc każde zgłoszenie gościa kończy się '
             '403 `turnstile_nieudany`. Zmiana: dodać `token: tokenTurnstile` do ciała, gdy nie jest `null`.'},
]


def prawdziwe():
    tekst = open(REVIEW_F4, encoding='utf-8').read()
    wynik = []
    for plik in PRAWDZIWE:
        m = re.search(r'^### P2 · KOD · `%s`\n\n(.+?)\n' % re.escape(plik), tekst, re.M)
        if not m: raise SystemExit('brak P2 KOD %s w review-faza-4.md' % plik)
        wynik.append({'severity': 'P2', 'typ': 'KOD', 'plik': plik, 'opis': m.group(1), '_zrodlo': 'review-faza-4'})
    return wynik


def findings():
    return prawdziwe() + [{'severity': 'P2', 'typ': 'KOD', 'plik': k['plik'], 'opis': k['opis'], '_zrodlo': 'kanarek-' + k['id']} for k in KANARKI]


def sciezki(kopia):
    d = os.path.dirname(os.path.abspath(kopia))
    return {'js': os.path.join(d, 'kanarki.js'), 'ust': os.path.join(d, 'ustawienia.json'), 'out': os.path.join(d, 'sesja.out.json'),
            'err': os.path.join(d, 'sesja.err.txt'), 'kontrola': os.path.join(d, 'kanarki-kontrola.json')}


def przygotuj(kopia):
    head = subprocess.run(['git', '-C', kopia, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip()
    if head != SHA: raise SystemExit('kopia na %s, oczekiwane %s' % (head, SHA))
    if subprocess.run(['git', '-C', kopia, 'cat-file', '-e', '753de0e'], capture_output=True).returncode == 0:
        raise SystemExit('kopia zna commit fixa fazy 4 (753de0e) — usuń refy i obiekty')
    src = open(W0.REVIEW, encoding='utf-8').read()
    seg = lambda a, b: src[src.index(a):src.index(b, src.index(a))]
    czesci = [W0.wycinek(src, w) for w in TS.P9_WYCINKI] + [seg('const MAKS_W_GRUPIE_P2', '\nconst p1DoVerify'), seg('const p1DoVerify', '\nconst potwierdzoneKod')]
    if czesci[-1].count(TS.BEZ_KLASY) != 2: raise SystemExit('oczekiwane 2 wywołania z klasa-sceptyk')
    lista = findings()
    meta = ("export const meta = {\n  name: 'e5-21-kanarki',\n  description: 'E5-21: wycinek Verify z dev-docs-review-wf.js bez zmian na 4 prawdziwych P2 i 4 kanarkach',\n"
            "  phases: [{ title: 'Verify', detail: 'P2 = porcje po 4, klasa-sceptyk, tier sceptykP2' }],\n}\n")
    wej = ("const sciezka = 'docs/active/etap-5-interakcje-i-profil'\nconst faza = 4\nconst kontekst = null\n"
           "const doWeryfikacji = %s\nphase('Verify')\n" % json.dumps(lista, ensure_ascii=False))
    zwrot = ("return { liczniki: sceptykLiczniki, porcje: grupyP2.map((g) => g.map((f) => f._zrodlo + ' ' + f.plik)), decyzje: zweryfikowane.filter(Boolean).map((f) => ({ "
             "zrodlo: f._zrodlo, plik: f.plik, severity: f.severity, zabity: !f.potwierdzony, opis: f.opis.slice(0, 80), uzasadnienie: f._uzasadnienie || '' })) }\n")
    js = meta + '\n' + '\n\n'.join(czesci[:-1]) + '\n\n' + wej + czesci[-1] + '\n' + zwrot
    hashe = {c.split('\n')[0][:40]: {'zrodlo': W0.sha(c), 'wynik': W0.sha(c) if c in js else 'BRAK'} for c in czesci}
    rozne = [k for k, h in hashe.items() if h['zrodlo'] != h['wynik']]
    s = sciezki(kopia)
    json.dump({'zrodlo': os.path.relpath(W0.REVIEW, W0.SZ), 'wycinki': hashe, 'wycinki_rozne': rozne}, open(s['kontrola'], 'w'), ensure_ascii=False, indent=1)
    if rozne: raise SystemExit('kontrola bajtowa: %s' % rozne)
    open(s['js'], 'w', encoding='utf-8').write(js)
    print('kanarki.js: %d wycinków bajt w bajt, %d zarzutów (%d prawdziwe, %d kanarki), %d B' % (len(czesci), len(lista), len(PRAWDZIWE), len(KANARKI), len(js.encode())))


def uruchom(kopia):
    s = sciezki(kopia)
    kop = os.path.abspath(kopia)
    deny = ['Read(//Users/kacper_trzepiecinski/Documents/**)', 'Read(~/.claude/projects/**)', 'Read(~/test-review/**)',
            'Edit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Bash(gh:*)', 'Bash(curl:*)', 'Bash(wget:*)', 'Bash(git push:*)',
            'Bash(git fetch:*)', 'Bash(git pull:*)', 'Bash(git remote:*)', 'Bash(git commit:*)', 'Bash(git checkout:*)', 'Bash(git reset:*)', 'Bash(git stash:*)']
    json.dump({'disableAllHooks': True, 'permissions': {'deny': deny}}, open(s['ust'], 'w'), indent=1)
    sid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'e5-21/' + kop))
    wiad = ('Uruchom narzędzie Workflow z parametrem scriptPath="%s" i args={} — to jest moje wyraźne polecenie uruchomienia tego workflow '
            '(test kanarkowy). Nie wykonuj żadnych innych działań: nie czytaj plików, nie uruchamiaj poleceń, nie oceniaj wyniku. Poczekaj na '
            'zakończenie workflow i odpowiedz jednym wierszem: RUN <identyfikator runu> <status>.\n%s' % (s['js'], TSS.N1))
    cmd = ['claude', '-p', wiad, '--model', TSS.MODEL, '--effort', 'high', '--strict-mcp-config', '--permission-mode', 'bypassPermissions',
           '--settings', s['ust'], '--session-id', sid, '--output-format', 'json', '--max-budget-usd', '10']
    with open(s['out'], 'w') as o, open(s['err'], 'w') as e:
        kod = subprocess.run(cmd, cwd=kop, stdout=o, stderr=e, env=TSS.srodowisko()).returncode
    print('sesja %s kod %d' % (sid, kod))


def wynik(kopia):
    kop = os.path.abspath(kopia)
    sid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'e5-21/' + kop))
    runy = sorted(glob.glob(os.path.join(TSS.PROJ, TSS.slug(kop), sid, 'workflows', '*.json')), key=os.path.getmtime)
    if not runy: raise SystemExit('brak pliku runu')
    run = json.load(open(runy[-1]))
    res = run.get('result')
    if isinstance(res, str): res = json.loads(res)
    if not res: raise SystemExit('run bez wyniku: status %s' % run.get('status'))
    etyk = {}
    for f in res['decyzje']:
        m = re.findall(r'\b(AGREE|DISAGREE_EVIDENCE|DISAGREE_CONCERN)\b', f['uzasadnienie'])
        etyk[f['zrodlo'] + ' ' + f['plik']] = f
    L = ['E5-21 test kanarkowy sceptyka P2 — kopia vibersi %s (feat fazy 4 etapu 5), wycinek Verify z dev-docs-review-wf.js bez zmian, '
         'klasa-sceptyk, tier sceptykP2=medium, porcje po 4.' % SHA,
         'Kryterium (ustalone przed biegiem): kanarek obalony = DISAGREE_EVIDENCE (finding zabity). 4/4 → sceptyk zostaje; 3/4 → powtórka z 4 nowymi; '
         '≤ 2/4 → wymiana promptu; 0/4 → budżet sceptyka P2 na E5-3.', '', 'Porcje: ' + json.dumps(res['porcje'], ensure_ascii=False),
         'Liczniki etykiet: ' + json.dumps(res['liczniki']), '']
    obalone = 0
    for k in KANARKI:
        f = [d for d in res['decyzje'] if d['zrodlo'] == 'kanarek-' + k['id']][0]
        stan = 'OBALONY' if f['zabity'] else ('ZDEGRADOWANY do ' + f['severity'] if f['severity'] != 'P2' else 'POTWIERDZONY')
        if f['opis'].startswith('[NIEZWERYFIKOWANY'): stan = 'NIEZWERYFIKOWANY'
        obalone += f['zabity']
        L.append('%s (%s) %s → %s | przeczy: %s | sceptyk: %s' % (k['id'], k['rodzaj'], k['plik'], stan, k['przeczy'], f['uzasadnienie'][:400]))
    L.append('')
    for d in res['decyzje']:
        if d['zrodlo'].startswith('kanarek'): continue
        stan = 'OBALONY' if d['zabity'] else ('ZDEGRADOWANY do ' + d['severity'] if d['severity'] != 'P2' else 'POTWIERDZONY')
        L.append('prawdziwy %s → %s | sceptyk: %s' % (d['plik'], stan, d['uzasadnienie'][:300]))
    werdykt = {4: 'sceptyk zostaje', 3: 'powtórka z 4 nowymi kanarkami', 0: 'budżet sceptyka P2 na E5-3'}.get(obalone, 'wymiana promptu i powtórka')
    L += ['', 'WYNIK: kanarki obalone %d/4 → %s' % (obalone, werdykt), 'run: %s status %s' % (os.path.basename(runy[-1]), run.get('status'))]
    open(os.path.join(BASE, 'dane', 'e5-21-kanarki.txt'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    {'przygotuj': przygotuj, 'uruchom': uruchom, 'wynik': wynik}[sys.argv[1]](sys.argv[2])
