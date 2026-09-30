"""Odczyt It. 1 (HANDOFF §8 „IT. 1 — ODCZYT (SMOKE)” pkt 3–4): rekordy telemetrii runu smoke vs plik harnessu,
pokrycie pełnego skanu, walidacja końcowa, kontekst startowy per klasa (smoke / dev-* opus 5.5 / wszystkie workflowy).

Użycie: python3 it1_odczyt.py <runId> > ../dane/it1-odczyt.txt
"""
import collections
import glob
import json
import os
import statistics
import sys

PLIK = os.path.expanduser('~/.claude/telemetry/pipeline.jsonl')
HARNESS = os.path.expanduser('~/.claude/projects/*/*/workflows/wf_*.json')
WERSJA_IMPORTU = 0


def ostatnie_rekordy():
    ostatnie = {}
    for linia in open(PLIK):
        r = json.loads(linia)
        if isinstance(r.get('klucz'), str):
            ostatnie[r['klucz']] = r
    return list(ostatnie.values())


def plik_harnessu(run_id):
    return next(p for p in glob.glob(HARNESS) if os.path.basename(p) == run_id + '.json')


def kontekst_per_klasa(agenci):
    grupy = collections.defaultdict(list)
    for a in agenci:
        if a.get('ctx_start'):
            grupy[(a['klasa_roli'], a['model'])].append(a)
    return {f'{k}/{m}': (len(v), round(statistics.median(x['ctx_start'] for x in v) / 1000),
                         statistics.median((x.get('kontekst') or {}).get('narzedzia_n') or 0 for x in v))
            for (k, m), v in sorted(grupy.items())}


def main(run_id):
    rekordy = ostatnie_rekordy()
    harness = json.load(open(plik_harnessu(run_id)))
    wp = [a for a in harness['workflowProgress'] if a.get('type') == 'workflow_agent']
    run = [r for r in rekordy if r.get('run') == run_id]
    agenci = [r for r in run if r['typ'] == 'agent']
    rec_run = next(r for r in run if r['typ'] == 'run')
    wynik = harness['result']

    print('== 1. Run smoke', run_id)
    print('harness: status', harness['status'], '| wynik.status', wynik.get('status'), '| agentCount', harness['agentCount'],
          '| sekundy', round(harness['durationMs'] / 1000))
    print('rekord run: status', rec_run['status'], '| v', rec_run['v'], '| walidacja', rec_run['walidacja'],
          '| koszt jedn', rec_run['koszt']['jedn'], '| agentow', rec_run['koszt']['agentow'], '| szablon', rec_run['szablon'])
    print('rekordy faza:', sum(r['typ'] == 'faza' for r in run), '| agent:', len(agenci), '| agenci w workflowProgress:', len(wp))
    ids_wp = {a['agentId'] for a in wp}
    ids_rec = {a['id'] for a in agenci}
    print('agenci bez rekordu:', sorted(ids_wp - ids_rec), '| rekordy spoza harnessu:', sorted(ids_rec - ids_wp))
    print('model/effort:', dict(collections.Counter(f"{a['model']}/{a['effort']}" for a in agenci)))
    print('opus bez effort:', [a['etykieta'] for a in agenci if 'opus' in a['model'] and not a['effort']])
    print('agenci telemetria:* w harnessie:', [a['label'] for a in wp if a.get('label', '').startswith('telemetria')])
    print('pola token* w wyniku:', [k for k in wynik if 'token' in k.lower()])
    print('smoke: smokeStatus', wynik.get('smokeStatus'), '| smokeOperatora', wynik.get('smokeOperatora'))

    print('\n== 2. Pełny skan: pliki harnessu vs rekordy run')
    pliki = {os.path.basename(p)[:-5] for p in glob.glob(HARNESS)}
    runy = {r['run']: r for r in rekordy if r['typ'] == 'run' and r.get('run')}
    print('plików', len(pliki), '| z rekordem run', len(pliki & set(runy)), '| bez rekordu', sorted(pliki - set(runy)),
          '| runów bez pliku (KILLED)', len(set(runy) - pliki))
    print('statusy:', dict(collections.Counter(r['status'] for r in runy.values())))
    print('wersje rekordów (bez importu):', dict(collections.Counter(r['v'] for r in rekordy if r['v'] != WERSJA_IMPORTU)))
    auto = [r for r in runy.values() if r.get('workflow') == 'dev-autopilot']
    print('walidacja w runach autopilota:', dict(collections.Counter(str(r['walidacja']) for r in auto)))

    print('\n== 3. Kontekst startowy per klasa/model: n, ctx_start p50 [k], narzędzia p50')
    wszyscy = [r for r in rekordy if r['typ'] == 'agent' and r.get('start', '') >= '2026-09']
    print('smoke:', kontekst_per_klasa(agenci))
    dev = [a for a in wszyscy if a['model'] == 'claude-opus-5-5' and a.get('workflow') in ('dev-autopilot', 'dev-pr')]
    print('dev-* opus 5.5 wrzesień:', kontekst_per_klasa(dev))
    opus55 = [a for a in wszyscy if a['model'] == 'claude-opus-5-5']
    print('wszystkie workflowy opus 5.5 wrzesień (= raport §2):', kontekst_per_klasa(opus55))
    print('workflowy agentów opus 5.5 wrzesień (top 5):', collections.Counter(a.get('workflow') for a in opus55).most_common(5))

    print('\n== 4. Rekordy starszych wersji, których bieżący skan już nie wytwarza')
    print([(r['typ'], r.get('skill'), r['v']) for r in rekordy if r['v'] not in (WERSJA_IMPORTU, max(x['v'] for x in rekordy))])


if __name__ == '__main__':
    main(sys.argv[1])
