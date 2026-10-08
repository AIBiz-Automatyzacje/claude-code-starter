"""Sekcja odczytu smoke'a P14 (E2E i skill weryfikacji) — importowana przez smoke_odczyt.py; samodzielnie: przebieg (1).

Smoke P14 (PLAN-POPRAWY §3 P14, HANDOFF 6a pkt 74 (g), 75 (j)): fixture z [E2E] w dwóch fazach.
- Przebieg (1): kopia bez .env.e2e → STOP `start: srodowisko E2E` przed fazą 1 (koszt minimalny).
  Użycie: python3 smoke_p14.py --stop <wf_id>
- Przebieg (2): środowisko sprawne, skill weryfikacji z /weryfikacja-setup, serwer zatrzymany przed review fazy 2 →
  faza 1: tester woła `e2e.mjs scenariusze`, czyta `.claude/skills/weryfikacja/` (SKILL.md i mapa-funkcji.md), PASS z dowodem;
  faza 2: SKIP `srodowisko` → [Manual] z powodem; 0 STOP-ów w trakcie; telemetria `faza.e2e.manual`, `run.manual_razem`;
  archiwum kopii: mapa funkcji z flow zadania, sekcja E2E w smoke'u operatora, linie zadań odznaczone / przeniesione.
"""
import glob
import json
import os
import sys

PLIK = os.path.expanduser('~/.claude/telemetry/pipeline.jsonl')
KATALOG_RUNU = os.path.expanduser('~/.claude/projects/*/*/subagents/workflows/%s')
KODOWANIE = os.path.expanduser('~/Documents/Kodowanie')
FLOWY = ('smoke-strona', 'smoke-strona-faza-2')


def narzedzia(katalog, agent_id):
    """(tekst poleceń workflowu, [(narzędzie, argument)]) z transkryptu agenta: Bash → komenda, Read → ścieżka."""
    plik = os.path.join(katalog, 'agent-%s.jsonl' % agent_id)
    if not os.path.exists(plik):
        return '', []
    polecenie, uzycia = '', []
    for linia in open(plik, encoding='utf-8'):
        m = json.loads(linia).get('message') or {}
        tresc = m.get('content')
        # Polecenie workflowu: wiadomosc uzytkownika w tekscie (harness dokleja ja po wstepie).
        if m.get('role') == 'user' and isinstance(tresc, str):
            polecenie += tresc
        for b in tresc if isinstance(tresc, list) else []:
            if isinstance(b, dict) and b.get('type') == 'tool_use':
                we = b.get('input') or {}
                uzycia.append((b.get('name'), we.get('command') or we.get('file_path') or we.get('pattern') or ''))
    return polecenie, uzycia


def tester(agent, wynik, katalog):
    tekst_polecen, uzycia = narzedzia(katalog, agent['id'])
    tekst = ' '.join(a for _, a in uzycia)
    tryb = next((t for t in ('bez-przegladarki', 'przegladarka') if 'Tryb: %s.' % t in tekst_polecen), '?')
    print('  %s (faza %s): tryb %s, koszt %.2f M, tury %s, %s s, ctx_start %s' % (
        agent['etykieta'], agent.get('faza'), tryb, (agent.get('koszt_jedn') or 0) / 1e6, agent.get('tury'), agent.get('sekundy'), agent.get('ctx_start')))
    print('    e2e.mjs scenariusze: %s | skill weryfikacji: %s | mapa-funkcji.md: %s | e2e.mjs stan: %s | agent-browser: %d | curl: %d' % (
        'tak' if 'e2e.mjs scenariusze' in tekst else 'NIE', 'tak' if 'skills/weryfikacja/SKILL.md' in tekst else 'NIE',
        'tak' if 'mapa-funkcji.md' in tekst else 'NIE', 'tak' if 'e2e.mjs stan' in tekst else 'nie',
        sum(1 for n, a in uzycia if n == 'Bash' and 'agent-browser' in a), sum(1 for n, a in uzycia if n == 'Bash' and 'curl' in a)))
    for p in (wynik or {}).get('przebiegi') or []:
        print('    przebieg %-22s %-4s %-14s %s' % (p.get('flow'), p.get('wynik'), p.get('przyczyna'), (p.get('dowod') or '').replace('\n', ' ')[:150]))
    for f in (wynik or {}).get('findings') or []:
        print('    finding %s %s %s' % (f.get('severity'), f.get('typ'), (f.get('opis') or '').replace('\n', ' ')[:120]))


def archiwum(projekt, zadanie):
    kopia = os.path.join(KODOWANIE, projekt)
    print('  kopia: %s' % kopia)
    mapa = os.path.join(kopia, '.claude/skills/weryfikacja/mapa-funkcji.md')
    tresc = open(mapa, encoding='utf-8').read() if os.path.exists(mapa) else None
    print('  mapa-funkcji.md: %s' % ('BRAK' if tresc is None else ', '.join('%s %s' % (f, 'jest' if '## `%s`' % f in tresc else 'BRAK') for f in FLOWY)))
    skill = os.path.join(kopia, '.claude/skills/weryfikacja/SKILL.md')
    if os.path.exists(skill):
        print('  skill: %s' % next((l.strip() for l in open(skill, encoding='utf-8') if l.startswith('Przejście na żywo:')), 'bez linii przejścia'))
    zadania = glob.glob(os.path.join(kopia, 'docs/completed', zadanie, '*-zadania.md'))
    for linia in open(zadania[0], encoding='utf-8') if zadania else []:
        if any('`%s`' % f in linia for f in FLOWY):
            print('  zadania: %s' % linia.strip()[:200])
    smoke = sorted(glob.glob(os.path.join(kopia, 'docs/operator/*-%s-smoke.md' % zadanie)))
    if not smoke:
        print('  smoke operatora: BRAK pliku')
        return
    s = open(smoke[-1], encoding='utf-8').read()
    sekcja = s.split('E2E do odegrania', 1)[1][:400] if 'E2E do odegrania' in s else None
    print('  smoke operatora %s: sekcja E2E %s' % (os.path.basename(smoke[-1]), 'BRAK' if sekcja is None else 'jest'))
    if sekcja:
        print('    %s' % sekcja.replace('\n', '\n    ').rstrip())


def sekcja_p14(run, wyniki, katalog):
    print('\n== 2k. E2E i skill weryfikacji (P14)')
    r = run['run']
    print('  run: status %s, powód %s, e2eSrodowisko %s, manual_razem %s' % (r.get('status'), r.get('powod'), r.get('e2eSrodowisko'), r.get('manual_razem')))
    for f in run['fazy']:
        print('  faza %s: e2e %s, e2eSync %s' % (f['faza'], json.dumps(f.get('e2e')), f.get('e2eSync')))
    po_id = {a: w for _, a, w in wyniki}
    for agent in sorted((a for a in run['agenci'] if (a.get('etykieta') or '').startswith(('review:e2e', 'e2e:'))), key=lambda a: a.get('start') or ''):
        if agent['etykieta'].startswith('review:e2e') and katalog:
            tester(agent, po_id.get(agent['id']), katalog)
        else:
            print('  %s (faza %s): koszt %.2f M, %s s' % (agent['etykieta'], agent.get('faza'), (agent.get('koszt_jedn') or 0) / 1e6, agent.get('sekundy')))
    for etykieta, _, w in wyniki:
        if etykieta == 'e2e:start' and isinstance(w, dict):
            print('  e2e:start: %s, serwer %s, scenariusze %s, baza %s' % (w.get('status'), w.get('serwer'), w.get('scenariusze'), w.get('bazaE2e')))
    archiwum(r['projekt'], r['zadanie'])


def przebieg_stop(run_id):
    rekordy = {}
    for linia in open(PLIK, encoding='utf-8'):
        r = json.loads(linia)
        if r.get('run') == run_id and isinstance(r.get('klucz'), str):
            rekordy[r['klucz']] = r
    run = next((r for r in rekordy.values() if r['typ'] == 'run'), None)
    if run is None:
        sys.exit('BŁĄD: brak rekordu `run` dla %s' % run_id)
    agenci = [r for r in rekordy.values() if r['typ'] == 'agent']
    print('Przebieg (1) %s (projekt %s): status %s, kategoria %s' % (run_id, run['projekt'], run.get('status'), run.get('stop_kategoria')))
    print('  powód: %s' % run.get('powod'))
    print('  koszt %.2f M, agentów %d, %s s, fazy ukończone %s/%s' % (
        run['koszt']['jedn'] / 1e6, len(agenci), run.get('sekundy'), run.get('fazyUkonczone'), run.get('fazyZadania')))
    for a in sorted(agenci, key=lambda a: a.get('start') or ''):
        print('  %-28s %.2f M' % (a.get('etykieta'), (a.get('koszt_jedn') or 0) / 1e6))


if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] != '--stop':
        sys.exit('Użycie: smoke_p14.py --stop <wf_id>   (przebieg (2): smoke_odczyt.py <wf_id>)')
    przebieg_stop(sys.argv[2])
