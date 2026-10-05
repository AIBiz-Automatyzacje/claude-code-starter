"""Sekcje odczytu smoke'a P10 (wiedza projektu) — importowane przez smoke_odczyt.py.

Z rekordów: agent.kontekst.learned_zn (po P10 ma być 0 — stary plik reguł nie ładuje się eager), faza.wiedza
(indeks_zn, claude_md_zn, wycinek_zn, wycinek_wpisy, wycinek_pominiete z dossier fazy).
Z journala runu: w transkryptach plannera, builderów i agentów naprawiających — blok „Wyuczone reguly projektu:”
(prompt buildera od plannera), polecenie „REGULY PROJEKTU dla poprawianych plikow” (prompt fixa, od P10 sesja 3)
i liczba wywołań `wiedza.mjs wycinek` przez agenta.
Z pliku harnessu: wynik compoundu w wyniku runu — wiedza (klasa, szczebel, długość reguły), indeks, propozycjeBramek, uwagaIndeksu.
"""
import json
import os

BLOK_BUILDERA = 'Wyuczone reguly projektu:'
POLECENIE_FIXA = 'REGULY PROJEKTU dla poprawianych plikow'
KOMENDA = 'wiedza.mjs wycinek'
ROLE_Z_WIEDZA = ('planner:', 'build:', 'fix:faza-', 'fix:poprawka:', 'pr:napraw:')
POLA_FAZY = ('indeks_zn', 'claude_md_zn', 'wycinek_zn', 'wycinek_wpisy', 'wycinek_pominiete')


def learned(agenci):
    """„<z zerem>/<z kontekstem>, max <zn>” dla agent.kontekst.learned_zn; None, gdy żaden agent nie ma kontekstu."""
    wartosci = [a['kontekst'].get('learned_zn') for a in agenci if isinstance(a.get('kontekst'), dict)]
    wartosci = [w for w in wartosci if isinstance(w, int)]
    if not wartosci:
        return None
    return '%d/%d, max %d' % (sum(1 for w in wartosci if w == 0), len(wartosci), max(wartosci))


def sekcja_wiedza(ref, run, wiersz):
    print('\n== 2f. Wiedza projektu (P10): learned_zn, faza.wiedza')
    wiersz('learned_zn = 0 / z kontekstem', learned(ref['agenci']), learned(run['agenci']), liczbowy=False)
    for i in range(max(len(ref['fazy']), len(run['fazy']))):
        r = (ref['fazy'][i] if i < len(ref['fazy']) else {}).get('wiedza') or {}
        s = (run['fazy'][i] if i < len(run['fazy']) else {}).get('wiedza') or {}
        print(' faza %d' % (i + 1))
        for pole in POLA_FAZY:
            wiersz('  faza.wiedza.' + pole, r.get(pole), s.get(pole))


def wiedza_w_transkrypcie(katalog, agent_id):
    """(blok buildera w prompcie, polecenie fixa w prompcie, wywołania wycinka) z agent-<id>.jsonl; None, gdy brak pliku."""
    plik = os.path.join(katalog, 'agent-%s.jsonl' % agent_id)
    if not os.path.exists(plik):
        return None
    blok, polecenie, komendy = False, False, 0
    for linia in open(plik, encoding='utf-8'):
        wpis = json.loads(linia)
        tresc = wpis.get('message', {}).get('content')
        if isinstance(tresc, str) and wpis.get('type') == 'user':
            blok, polecenie = blok or BLOK_BUILDERA in tresc, polecenie or POLECENIE_FIXA in tresc
        elif isinstance(tresc, list):
            komendy += sum(1 for c in tresc if c.get('type') == 'tool_use' and KOMENDA in json.dumps(c.get('input')))
    return blok, polecenie, komendy


def sekcja_wiedza_journal(wyniki, katalog):
    print('\n== 2g. Wycinek w promptach i wywołaniach agentów (journal runu)')
    if katalog is None:
        print('  brak katalogu runu')
        return
    for etykieta, agent_id, _ in wyniki:
        if not etykieta.startswith(ROLE_Z_WIEDZA):
            continue
        stan = wiedza_w_transkrypcie(katalog, agent_id)
        if stan is None:
            print('  %-34s brak transkryptu' % etykieta)
            continue
        print('  %-34s blok „%s” %s · „%s” %s · wywołania wycinka %d' % (
            etykieta, BLOK_BUILDERA, 'tak' if stan[0] else 'nie', POLECENIE_FIXA, 'tak' if stan[1] else 'nie', stan[2]))


def sekcja_compound(run):
    print('\n== 2h. Compound w wyniku runu (harness): wiedza, indeks, propozycje bramek')
    wynik = run['harness'].get('result') if isinstance(run['harness'].get('result'), dict) else {}
    wiedza = wynik.get('wiedza') or {}
    print('  %-34s %s' % ('solution', wynik.get('solution') or '—'))
    print('  %-34s %s' % ('wiedza: klasa / szczebel', '%s / %s' % (wiedza.get('klasa'), wiedza.get('szczebel')) if wiedza else '—'))
    print('  %-34s %s' % ('wiedza: regula [zn]', len(wiedza.get('regula') or '') if wiedza else '—'))
    print('  %-34s %s' % ('indeks', wynik.get('indeks') or '—'))
    print('  %-34s %s' % ('propozycjeBramek', len(wynik.get('propozycjeBramek') or [])))
    print('  %-34s %s' % ('uwagaIndeksu', wynik.get('uwagaIndeksu') if 'uwagaIndeksu' in wynik else 'brak pola (run sprzed P10 s3)'))
