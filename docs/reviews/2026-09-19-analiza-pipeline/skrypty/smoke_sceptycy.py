"""Sekcje odczytu smoke'a P9 (sceptyk asymetryczny) i poprawki K-7 z P8 — importowane przez smoke_odczyt.py.

Z rekordów: faza.sceptyk (etykiety, degradacje), przebieg.sceptycy (porcje P2), agent.werdykty/obalone sceptyków.
Z journala runu: etykiety i błędy schematu w wynikach verify / verify-batch (`failed`, brak etykiety spoza enumu).
Z kopii (cwd z transkryptu agenta): wiersz „Sceptycy: AGREE …” i adnotacje „*(sceptyk:” w review-faza-N.md,
linia „Zamkniete cyklem fix” w archiwum zadań (docs/completed/<zadanie>/*-zadania.md).
"""
import glob
import json
import math
import os

ETYKIETY = ('AGREE', 'DISAGREE_EVIDENCE', 'DISAGREE_CONCERN')
MAKS_W_PORCJI_P2 = 4  # MAKS_W_GRUPIE_P2 w dev-docs-review-wf.js
WIERSZ_RAPORTU = '| Sceptycy: AGREE'
LINIA_ARCHIWUM = 'Zamkniete cyklem fix'


def sceptycy_fazy(agenci, faza):
    """Agenci-sceptycy review fazy (bez verify-fix ze starych runów)."""
    return [a for a in agenci if a['faza'] == faza and a['rola'] in ('verify', 'verify-batch')]


def suma_werdyktow(sceptycy):
    """agent.werdykty zsumowane po sceptykach; None, gdy żaden nie ma etykiet (run sprzed P9)."""
    werdykty = [a['werdykty'] for a in sceptycy if a.get('werdykty')]
    if not werdykty:
        return None
    return {k: sum(w.get(k) or 0 for w in werdykty) for k in ('agree', 'disagree_evidence', 'disagree_concern')}


def opis_porcji(przebieg, sceptycy):
    """„<verify-batch> ≤ ⌈<P2>/4⌉=<sufit> OK|PRZEKROCZONE” z przebiegu review i rekordów agentów."""
    s = (przebieg or {}).get('sceptycy')
    if not s:
        return None
    batch = sum(1 for a in sceptycy if a['rola'] == 'verify-batch')
    sufit = math.ceil(s['p2Findingi'] / MAKS_W_PORCJI_P2)
    return '%d batch (przebieg %d) ≤ ⌈%d/4⌉=%d %s' % (
        batch, s['p2Grupy'], s['p2Findingi'], sufit, 'OK' if batch <= sufit else 'PRZEKROCZONE')


def sekcja_sceptycy(ref, run, wiersz):
    print('\n== 2c. Sceptycy (P9): etykiety, porcje P2, werdykty agentów')
    for i in range(max(len(ref['fazy']), len(run['fazy']))):
        r = ref['fazy'][i] if i < len(ref['fazy']) else {}
        s = run['fazy'][i] if i < len(run['fazy']) else {}
        faza = s.get('faza', r.get('faza'))
        sr, ss = sceptycy_fazy(ref['agenci'], faza), sceptycy_fazy(run['agenci'], faza)
        print(' faza %s' % faza)
        wiersz('faza.sceptyk', r.get('sceptyk'), s.get('sceptyk'), liczbowy=False)
        wiersz('agent.werdykty (suma)', suma_werdyktow(sr), suma_werdyktow(ss), liczbowy=False)
        wiersz('agent.obalone (suma)', sum(a.get('obalone') or 0 for a in sr), sum(a.get('obalone') or 0 for a in ss))
        wiersz('agent.weryfikowane (suma)', sum(a.get('weryfikowane') or 0 for a in sr),
               sum(a.get('weryfikowane') or 0 for a in ss))
        wiersz('verify-batch vs ⌈P2/4⌉', opis_porcji(r.get('przebieg'), sr), opis_porcji(s.get('przebieg'), ss),
               liczbowy=False)
        wiersz('agenci verify (P1 ×3)', sum(1 for a in sr if a['rola'] == 'verify'),
               sum(1 for a in ss if a['rola'] == 'verify'))


def glosy_wyniku(wynik):
    """Głosy z wyniku sceptyka: lista werdykty[] (porcja) albo pojedynczy werdykt (P1)."""
    if not isinstance(wynik, dict):
        return None
    return wynik['werdykty'] if isinstance(wynik.get('werdykty'), list) else [wynik]


def bledy_schematu(glosy):
    """Głosy bez etykiety z enumu — po P9 każdy werdykt ma `etykieta`; stary `realny` też jest tu błędem."""
    return sum(1 for g in glosy if not isinstance(g, dict) or g.get('etykieta') not in ETYKIETY)


def nieudani_journala(katalog):
    """agentId z wpisem `failed` w journal.jsonl (agent padł, np. na schemacie wyniku)."""
    ids = set()
    for linia in open(os.path.join(katalog, 'journal.jsonl'), encoding='utf-8'):
        wpis = json.loads(linia) if linia.strip() else {}
        if wpis.get('type') == 'failed':
            ids.add(wpis['agentId'])
    return ids


def sekcja_sceptycy_journal(wyniki, katalog):
    print('\n== 2d. Sceptycy w journalu runu: etykiety w wyniku, błędy schematu')
    if katalog is None:
        print('  brak katalogu runu')
        return
    nieudani = nieudani_journala(katalog)
    for etykieta, agent_id, wynik in wyniki:
        if not etykieta.startswith(('verify:', 'verify-batch:')):
            continue
        glosy = glosy_wyniku(wynik)
        if glosy is None:
            print('  %-60s wynik %s' % (etykieta[:60], 'FAILED' if agent_id in nieudani else 'pusty'))
            continue
        rozklad = ' '.join('%s=%d' % (e, sum(1 for g in glosy if g.get('etykieta') == e)) for e in ETYKIETY)
        print('  %-60s %s · błędy schematu %d' % (etykieta[:60], rozklad, bledy_schematu(glosy)))
    sceptycy_ids = {a for e, a, _ in wyniki if e.startswith(('verify:', 'verify-batch:'))}
    print('  %-34s %d' % ('sceptycy failed (journal)', len(nieudani & sceptycy_ids)))


def katalog_kopii(wyniki, katalog):
    """Katalog projektu runu = `cwd` z pierwszego wpisu transkryptu dowolnego agenta."""
    for _, agent_id, _ in wyniki:
        plik = os.path.join(katalog, 'agent-%s.jsonl' % agent_id)
        if os.path.exists(plik):
            for linia in open(plik, encoding='utf-8'):
                cwd = json.loads(linia).get('cwd')
                if cwd:
                    return cwd
    return None


def sekcja_kopia(wyniki, katalog, zadanie):
    print('\n== 2e. Kopia: raport review i archiwum zadań')
    kopia = katalog_kopii(wyniki, katalog) if katalog else None
    if not kopia or not os.path.isdir(kopia):
        print('  kopia niedostępna (%s)' % kopia)
        return
    print('  %-34s %s' % ('kopia', kopia))
    raporty = sorted(glob.glob(os.path.join(kopia, 'docs/*/%s/review-faza-*.md' % zadanie)))
    for raport in raporty:
        tresc = open(raport, encoding='utf-8').read()
        wiersze = [w for w in tresc.splitlines() if w.startswith(WIERSZ_RAPORTU)]
        print('  %-34s %s' % (os.path.relpath(raport, kopia), wiersze[0].split('|')[2].strip() if wiersze else 'BRAK WIERSZA'))
        print('  %-34s %d' % ('  adnotacje *(sceptyk:', tresc.count('*(sceptyk:')))
    if not raporty:
        print('  brak review-faza-*.md dla zadania %s' % zadanie)
    zadania = glob.glob(os.path.join(kopia, 'docs/completed/%s/*-zadania.md' % zadanie))
    linie = [w.strip() for z in zadania for w in open(z, encoding='utf-8') if LINIA_ARCHIWUM in w]
    print('  %-34s %s' % ('archiwum: „%s”' % LINIA_ARCHIWUM, linie or ('BRAK' if zadania else 'brak archiwum zadań')))
