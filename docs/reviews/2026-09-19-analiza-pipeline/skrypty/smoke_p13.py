"""Sekcja odczytu smoke'a P13 (planowanie: scalony /dev-plan) — importowana przez smoke_odczyt.py.

Smoke P13: w kopii nowe zadanie przez /dev-plan (plan techniczny → docs/active/ ze skryptu → bramka gotowości → Workflow autopilota
w tej samej sesji). Odczyt:
1. epizod dev-plan z rekordu `skill` telemetrii (koszt własny i subagentów, tury, wiadomości operatora, `artefakty` z wyników plan.mjs);
   rekord liczy epizod do następnego skilla, czyli razem z czekaniem na autopilota i podsumowaniem po nim — dlatego koszt planowania
   DO wywołania Workflow liczę osobno z transkryptu sesji głównej (te same wagi co telemetria: in 1, cache_w 1,25, cache_r 0,1, out 5);
2. planner fazy znalazł plan techniczny i IU: wynik `planner:faza-N` w journalu ma IU z agentType, a prompt każdej IU niesie tabelę
   plików z planu (`| Akcja | Plik |`);
3. próg PLAN-POPRAWY P13: mediana epizodu dev-plan > 2,95 M → generowanie zadania jako osobny krok (tu n = 1 — odczyt, nie mediana).
"""
import glob, json, os

PLIK = os.path.expanduser('~/.claude/telemetry/pipeline.jsonl')
PROJEKTY = os.path.expanduser('~/.claude/projects')
PROG_EPIZODU = 2.95e6
WAGI = {'input_tokens': 1, 'cache_creation_input_tokens': 1.25, 'cache_read_input_tokens': 0.1, 'output_tokens': 5}


def rekord_dev_plan(projekt):
    """Ostatni rekord `skill` dev-plan w projekcie (ostatni zapis per klucz — hook dopisuje kolejne wersje otwartego epizodu)."""
    ostatnie = {}
    for linia in open(PLIK, encoding='utf-8'):
        r = json.loads(linia)
        if r.get('typ') == 'skill' and r.get('skill') == 'dev-plan' and r.get('projekt') == projekt:
            ostatnie[r['klucz']] = r
    return max(ostatnie.values(), key=lambda r: r.get('start') or '', default=None)


def _czlowiek(t):
    return not (t.lstrip().startswith('<task-notification>') or t.startswith('[Request interrupted') or t.startswith('<local-command')
                or '<command-name>' in t)


def planowanie_do_workflow(sesja, klucz):
    """Koszt i wiadomości operatora od otwarcia epizodu (uuid `klucz`) do pierwszego wywołania Workflow włącznie."""
    pliki = glob.glob(os.path.join(PROJEKTY, '*', sesja + '.jsonl'))
    if not pliki:
        return None
    odpowiedzi, operator, w_epizodzie, workflow = {}, 0, False, None
    for linia in open(pliki[0], encoding='utf-8'):
        w = json.loads(linia)
        if not w_epizodzie:
            w_epizodzie = w.get('uuid') == klucz
            continue
        tresc = (w.get('message') or {}).get('content')
        if w.get('type') == 'user' and not w.get('isMeta'):
            tekst = tresc if isinstance(tresc, str) else ' '.join(b.get('text', '') for b in tresc or [] if isinstance(b, dict))
            operator += bool(tekst.strip()) and not any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in (tresc if isinstance(tresc, list) else [])) and _czlowiek(tekst)
        if w.get('type') != 'assistant':
            continue
        m = w.get('message') or {}
        if m.get('id') and m.get('usage'):
            odpowiedzi[m['id']] = m['usage']
        bloki = [b for b in tresc or [] if isinstance(b, dict) and b.get('type') == 'tool_use'] if isinstance(tresc, list) else []
        wf = next((b for b in bloki if b.get('name') == 'Workflow'), None)
        if wf:
            workflow = wf.get('input') or {}
            break
    koszt = sum(sum((u.get(k) or 0) * v for k, v in WAGI.items()) for u in odpowiedzi.values())
    return {'koszt': round(koszt), 'tury': len(odpowiedzi), 'operator': operator, 'workflow': workflow}


def planner(wyniki):
    """[(etykieta, liczba IU, [(id, agentType, tabela plików w prompcie)])] z wyników plannerów w journalu."""
    out = []
    for etykieta, _, r in wyniki:
        if not etykieta.startswith('planner:') or not isinstance(r, dict):
            continue
        iu = r.get('iu') or []
        out.append((etykieta, len(iu), [(i.get('id'), i.get('agentType'), '| Akcja | Plik |' in (i.get('prompt') or '')) for i in iu]))
    return out


def sekcja_p13(run, wyniki):
    print('\n== 2j. Planowanie (P13: scalony /dev-plan)')
    r = rekord_dev_plan(run['run']['projekt'])
    if r is None:
        print('  brak rekordu skill dev-plan dla projektu %s' % run['run']['projekt'])
    else:
        print('  epizod dev-plan (rekord): koszt %.2f M + subagenci %s (n=%s), tury %s, wiadomości operatora %s, otwarty %s' % (
            (r.get('koszt_jedn') or 0) / 1e6, '%.2f M' % (r['subagenci_jedn'] / 1e6) if r.get('subagenci_jedn') is not None else '—',
            r.get('subagenci_n'), r.get('tury'), r.get('wiadomosci_operatora'), r.get('otwarty')))
        print('  artefakty: %s' % json.dumps(r.get('artefakty'), ensure_ascii=False))
        d = planowanie_do_workflow(r.get('sesja') or '', (r.get('klucz') or '').split('|', 1)[-1])
        if d:
            calosc = d['koszt'] + (r.get('subagenci_jedn') or 0)
            print('  do wywołania Workflow: koszt sesji %.2f M (+ subagenci = %.2f M; próg mediany %.2f M → %s), tury %d, wiadomości operatora %d'
                  % (d['koszt'] / 1e6, calosc / 1e6, PROG_EPIZODU / 1e6, 'PONAD' if calosc > PROG_EPIZODU else 'w progu', d['tury'], d['operator']))
            print('  Workflow: %s' % json.dumps(d['workflow'], ensure_ascii=False))
    for etykieta, n, iu in planner(wyniki):
        print('  %s: IU %d — %s' % (etykieta, n, ', '.join('%s %s %s' % (i, a, 'tabela' if t else 'BEZ TABELI') for i, a, t in iu)))
