"""Panel decyzyjny, run 3 (sceptycy) — skrypt Workflow z wstępnymi wyborami wklejonymi do promptów.

Wejście: dane/panel-run3-wejscie.json ({grupy: [{grupa, decyzje: [{id, decyzja, opcje, wybor, metryka, odwrot, dane, pliki}]}]}),
pisane w sesji głównej po run 2 (wstępny wybór BEZ uzasadnienia — PANEL-PLAN §6).
Wyjście: skrypty/panel-run3.js.
"""
import json
from pathlib import Path

BAZA = Path(__file__).resolve().parent.parent
WEJ = BAZA / 'dane' / 'panel-run3-wejscie.json'
SZABLON = BAZA / 'skrypty' / 'panel_run3_szablon.js'
WYJ = BAZA / 'skrypty' / 'panel-run3.js'
POLA = ['id', 'decyzja', 'opcje', 'wybor', 'metryka', 'odwrot', 'dane', 'pliki']
OCZEKIWANE = {'G1': ['D1', 'D2', 'D3', 'D4'], 'G2': ['D5', 'D7', 'D10', 'D12'], 'G3': ['D6', 'D8a', 'D8b', 'D9', 'D11']}


def main():
    grupy = json.loads(WEJ.read_text())['grupy']
    assert {g['grupa']: [d['id'] for d in g['decyzje']] for g in grupy} == OCZEKIWANE
    for g in grupy:
        for d in g['decyzje']:
            braki = [p for p in POLA if not d.get(p)]
            assert not braki, (d['id'], braki)
    js = SZABLON.read_text().replace('/*__DANE__*/null', json.dumps(grupy, ensure_ascii=False))
    WYJ.write_text(js)
    print('skrypt', WYJ.name, len(js), 'znakow,', len(js.encode()), 'bajtow;',
          ', '.join(f"{g['grupa']}: {len(g['decyzje'])}" for g in grupy))


if __name__ == '__main__':
    main()
