"""Odczyt jednego pull requesta po /dev-pr (wejście odczytu C, KARTA-ODCZYTU §5) — HANDOFF 6a pkt 82.

Liczy skryptem, bez agentów:
  1. wątki bota per oś i waga (z rekordów run.pr etapu zbierz) i P1/P2 na 100 plików PR,
  2. klasyfikację (napraw / napraw-szerzej / do-operatora / odrzuć) i co z nią zrobiono (wynik etapu napraw), tury,
  3. pochodzenie linii każdej uwagi: git blame na commicie recenzji → commit zadania (execute fazy / fix / kontrola fixa)
     albo „poza pipeline'em” (commit spoza autopilota: smoke operatora, poprawki ręczne) — oś odczytu C liczy tylko
     uwagi w kodzie, który review fazy widział,
  4. czy review fazy (docs/completed/<zadanie>/review-faza-*.md) wspomina plik uwagi,
  5. koszt: runy dev-pr-wf (rekordy run telemetrii), epizod skilla dev-pr i okno sesji z transkryptu (cennik jak telemetria),
  6. czasy: utworzenie PR → merge, czekanie na bota (Monitor w transkrypcie) wobec statusu commita „CodeRabbit” (gotowa recenzja).

Wejście: katalog zrzutu GitHuba (pr.json, watki.json, statusy.json — `dane/vibersi-pr1/`), repo projektu, transkrypt sesji /dev-pr.
Zrzut (R = właściciel/repo, N = numer PR):
  gh pr view N -R R --json number,title,createdAt,mergedAt,changedFiles,additions,deletions,headRefName,baseRefName,mergeCommit,reviews,comments,commits > pr.json
  gh api graphql -f query='query{repository(owner:"<wł>",name:"<repo>"){pullRequest(number:N){reviewThreads(first:100){totalCount nodes{id
    isResolved isOutdated path line originalLine comments(first:20){nodes{author{login} createdAt body originalCommit{oid}}}}}}}}' > watki.json
  statusy.json = {sha: wynik `gh api repos/R/commits/<sha>/status`} dla każdego commita z pr.json → reviews[].commit.oid
  (historia pending → success: `gh api repos/R/commits/<sha>/statuses` → statusy-historia.json, do odczytu ręcznego).
Użycie:
  python3 odczyt_pr.py --gh ../dane/vibersi-pr1 --repo ~/Documents/Kodowanie/vibersi --zadanie etap-1-fundament \
      --sesja ~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-vibersi/a6ec81a9-1099-4cac-9633-c5c02b98120f.jsonl
"""
import argparse, collections, datetime as dt, glob, json, os, re, subprocess

CENNIK = {'in': 1, 'cache_w': 1.25, 'cache_r': 0.1, 'out': 5}  # .claude/scripts/telemetria/cennik.mjs
TELEMETRIA = os.path.expanduser('~/.claude/telemetry/pipeline.jsonl')


def czas(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))


def jedn(u):
    return round(u.get('input_tokens', 0) * CENNIK['in'] + u.get('cache_creation_input_tokens', 0) * CENNIK['cache_w']
                 + u.get('cache_read_input_tokens', 0) * CENNIK['cache_r'] + u.get('output_tokens', 0) * CENNIK['out'])


def git(repo, *a):
    return subprocess.run(['git', '-C', repo, *a], capture_output=True, text=True).stdout


def rekordy(projekt, sesja):
    ost = {}
    for l in open(TELEMETRIA):
        if not l.strip():
            continue
        r = json.loads(l)
        if r.get('projekt') == projekt and r.get('sesja') == sesja:
            ost[r['klucz']] = r
    return list(ost.values())


def okna_autopilota(projekt):
    """Okna czasu runów autopilota projektu (start, koniec) z rekordów run telemetrii — commit z takiego okna jest z pipeline'u."""
    ost = {}
    for l in open(TELEMETRIA):
        if not l.strip():
            continue
        r = json.loads(l)
        if r.get('projekt') == projekt and r.get('typ') == 'run' and r.get('workflow') == 'dev-autopilot' and r.get('start'):
            ost[r['klucz']] = r
    return [(czas(r['start']), czas(r['start']) + dt.timedelta(seconds=r.get('sekundy') or 0)) for r in ost.values()]


def pochodzenie(repo, commit, plik, linia, okna):
    """Commit, który wprowadził linię uwagi (blame na commicie recenzji), i jego kategoria.
    Pipeline = commit z okna runu autopilota (nazwa zakresu w temacie commita bywa inna niż nazwa zadania — etap 2: `feat(katalog)`);
    w oknie: kontrola diffu → fix:kontrola, „poprawki po review fazy” → fix, reszta → execute."""
    b = git(repo, 'blame', '-s', '-L', f'{linia},{linia}', commit, '--', plik).split()
    if not b:
        return None, 'brak blame', ''
    h = b[0].lstrip('^')
    # Data autora: rebase (PR piętrowe, etap 3) zmienia datę commitera, a commit dalej pochodzi z runu autopilota.
    temat, data = git(repo, 'log', '-1', '--format=%s%x00%aI', h).strip().split('\x00')
    t = czas(data)
    if not any(od <= t <= do for od, do in okna):
        kat = 'poza pipeline\'em'
    elif 'kontrola diffu naprawczego' in temat:
        kat = 'fix:kontrola'
    elif 'poprawki po review fazy' in temat:
        kat = 'fix'
    else:
        kat = 'execute'
    return h[:7], kat, temat


def runy_pr(runy, wyniki, numer):
    """Runy dev-pr-wf jednego PR (P20 S2: kilka PR jednego zadania w jednej sesji — części PR wieloczęściowego).

    zbierz = rekordy run.pr z numerem tego PR (rekord bez numeru nie należy do żadnego PR — liczony osobno);
    czesc = numer części z tych rekordów (None = zadanie jednym PR); koszt = runy z args.czesc tej części,
    a bez części wszystkie runy sesji (jak przed P20).
    """
    zbierz = [r for r in runy if r.get('pr') and r['pr'].get('numer') == numer]
    bez_numeru = [r for r in runy if r.get('pr') and r['pr'].get('numer') is None]
    czesc = next((r['pr'].get('czesc') for r in zbierz if r['pr'].get('czesc') is not None), None)
    koszt = runy if czesc is None else [r for r in runy if wyniki.get(r['run'], {}).get('args', {}).get('czesc') == czesc]
    return zbierz, bez_numeru, czesc, koszt


def okna_sesji(sciezka):
    """Wywołania Monitor (start, koniec, zdarzenie) i koszt sesji od wywołania skilla dev-pr do końca transkryptu."""
    wiersze = [json.loads(l) for l in open(sciezka) if l.strip()]
    monitory, wyniki, start_skilla = {}, {}, None
    koszt_po, koszt_przed, widziane = 0, 0, set()
    for w in wiersze:
        ts = w.get('timestamp')
        if w.get('type') == 'assistant':
            m = w['message']
            for b in m.get('content', []):
                if b.get('type') == 'tool_use' and b['name'] == 'Monitor':
                    monitory[b['id']] = {'start': ts, 'opis': b['input'].get('description', ''), 'komenda': b['input'].get('command', '')}
                if b.get('type') == 'tool_use' and b['name'] == 'Skill' and b['input'].get('skill') == 'dev-pr' and not start_skilla:
                    start_skilla = ts
            u, mid = m.get('usage'), m.get('id')
            if u and mid not in widziane:
                widziane.add(mid)
                if start_skilla:
                    koszt_po += jedn(u)
                else:
                    koszt_przed += jedn(u)
        if w.get('type') == 'user':
            c = w['message'].get('content')
            if isinstance(c, str) and '<task-notification>' in c and 'Monitor' in c:
                zd = re.search(r'<event>(.*?)</event>', c, re.S)
                opis = re.search(r'Monitor "(.*?)"', c)
                for k, v in monitory.items():
                    if opis and v['opis'] == opis.group(1) and 'koniec' not in v:
                        v['koniec'], v['zdarzenie'] = ts, zd.group(1).strip() if zd else ''
    return list(monitory.values()), start_skilla, koszt_po, koszt_przed


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--gh', required=True)
    p.add_argument('--repo', required=True)
    p.add_argument('--zadanie', required=True)
    p.add_argument('--sesja', required=True)
    p.add_argument('--projekt', default=None)
    a = p.parse_args()
    repo = os.path.expanduser(a.repo)
    projekt = a.projekt or os.path.basename(repo.rstrip('/'))
    sesja_id = os.path.basename(a.sesja).replace('.jsonl', '')
    pr = json.load(open(os.path.join(a.gh, 'pr.json')))
    watki = json.load(open(os.path.join(a.gh, 'watki.json')))['data']['repository']['pullRequest']['reviewThreads']['nodes']
    statusy = json.load(open(os.path.join(a.gh, 'statusy.json')))
    rek = rekordy(projekt, sesja_id)
    okna = okna_autopilota(projekt)
    runy = sorted([r for r in rek if r['typ'] == 'run' and r.get('workflow') == 'dev-pr'], key=lambda r: r['start'])
    wf_dir = os.path.join(os.path.dirname(a.sesja), sesja_id, 'workflows')
    wyniki = {os.path.basename(f)[:-5]: json.load(open(f)) for f in glob.glob(os.path.join(wf_dir, 'wf_*.json'))}

    zbierz, bez_numeru, czesc, runy_kosztu = runy_pr(runy, wyniki, pr['number'])
    print(f'# Odczyt PR #{pr["number"]} {pr["title"]} — projekt {projekt}, zadanie {a.zadanie}'
          + (f', część {czesc}' if czesc is not None else '') + '\n')
    pliki = pr['changedFiles']
    print(f'pliki PR {pliki}, +{pr["additions"]} −{pr["deletions"]}, commitów {len(pr["commits"])}')

    # 1. wątki per oś i waga (ostatni zbierz każdej tury)
    print('\n## 1. Wątki bota (rekordy run.pr etapu zbierz)')
    # Dwa PR jednego zadania w jednej sesji (etap 3: PR #3 i #4) — tylko rekordy z numerem tego PR (runy_pr).
    if bez_numeru:
        print(f'  UWAGA: {len(bez_numeru)} rekordów zbierz bez numeru PR — pominięte (nie wiadomo, którego PR dotyczą)')
    klasy = {}
    for r in zbierz:
        print(f'  tura {r["pr"]["tura"]}: uwag {r["pr"]["uwagi_razem"]} (P1 {r["pr"]["p1"]} / P2 {r["pr"]["p2"]} / P3 {r["pr"]["p3"]}), '
              f'rekomendacja: {r["pr"]["rekomendacja"]}')
        for k in r['pr']['klasy']:
            klasy[k['id']] = k
    os_waga = collections.Counter((k['os'], k['severity']) for k in klasy.values())
    for (o, w), n in sorted(os_waga.items()):
        print(f'  oś {o:12} {w}: {n}')
    p12 = sum(1 for k in klasy.values() if k['severity'] in ('P1', 'P2'))
    print(f'  B P1/P2 unikalne: {p12} na {pliki} plików = {100 * p12 / pliki:.2f} na 100 plików (tło wrzesień 3,5; oferty PR 1–7 9,3)')
    print(f'  wątki na GitHubie: {len(watki)}, rozwiązane {sum(t["isResolved"] for t in watki)}')

    # 2. klasyfikacja i co zrobiono
    print('\n## 2. Klasyfikacja i decyzje')
    commity_pr = {c['oid'][:7] for c in pr['commits']}
    napraw = [w['result'] for w in wyniki.values() if w['args'].get('etap') == 'napraw'
              and str(w['result'].get('commit') or '')[:7] in commity_pr | {''}]
    naprawione = {i for r in napraw for i in r.get('naprawione', [])}
    odrzucone = {i for r in napraw for i in r.get('odrzucone', [])}
    licz = collections.Counter(k['decyzja'] for k in klasy.values())
    print(f'  klasy: {dict(licz)}; tury napraw: {len(napraw)}; naprawione {len(naprawione)}, odrzucone {len(odrzucone)}, '
          f'nieruszone {len(set(klasy) - naprawione - odrzucone)}')
    for r in napraw:
        print(f'  tura {r["tura"]}: commit {r.get("commit")}, walidacja {r.get("walidacja")}, odpowiedzi {r.get("odpowiedziWyslane")}, push {r.get("push")}')

    # 3–4. pochodzenie linii i review fazy
    print('\n## 3. Pochodzenie linii uwagi (blame na commicie recenzji) i review fazy')
    reviews = ' '.join(open(f).read() for f in sorted(glob.glob(os.path.join(repo, 'docs/completed', a.zadanie, 'review-faza-*.md'))))
    kat_licz = collections.Counter()
    for t in watki:
        c0 = t['comments']['nodes'][0]
        k = klasy.get(t['id'], {})
        h, kat, temat = pochodzenie(repo, c0['originalCommit']['oid'], t['path'], t['originalLine'], okna)
        kat_licz[(kat, k.get('severity'))] += 1
        w_review = 'plik w review fazy' if t['path'] in reviews else 'pliku brak w review fazy'
        print(f'  {k.get("severity")} {k.get("os")}/{k.get("klasa")} {t["path"]}:{t["originalLine"]} ← {h} [{kat}] {temat[:70]} — {w_review}')
    print('  razem: ' + ', '.join(f'{kat} {w}: {n}' for (kat, w), n in sorted(kat_licz.items())))

    # 5. koszt
    print('\n## 4. Koszt (jednostki względne)')
    suma = 0
    for r in runy_kosztu:
        etap = wyniki.get(r['run'], {}).get('args', {}).get('etap', '?')
        suma += r['koszt']['jedn']
        print(f'  {r["run"]} {etap:9} {r["status"]:4} agentów {r["koszt"]["agentow"]} {r["koszt"]["jedn"] / 1e6:.3f} M {r["sekundy"]} s')
    print(f'  runy dev-pr-wf razem: {len(runy_kosztu)}' + (f' (część {czesc}; sesja {len(runy)})' if czesc is not None else '')
          + f', {suma / 1e6:.2f} M')
    epizody = [r for r in rek if r['typ'] == 'skill']
    for e in epizody:
        print(f'  epizod {e["skill"]:16} {e["start"][11:19]}–{e["koniec"][11:19]} {e["koszt_jedn"] / 1e6:.2f} M, workflow {e["workflow_calls"]}, '
              f'otwarty {e["otwarty"]}, zagnieżdżone {e.get("zagniezdzone")}, wiadomości operatora {e["wiadomosci_operatora"]}')
    monitory, start_skilla, koszt_po, koszt_przed = okna_sesji(a.sesja)
    print(f'  sesja od wywołania dev-pr do końca transkryptu: {koszt_po / 1e6:.2f} M (przed: {koszt_przed / 1e6:.2f} M)')

    # 6. czasy
    print('\n## 5. Czasy')
    t0, t1 = czas(pr['createdAt']), czas(pr['mergedAt']) if pr.get('mergedAt') else None
    if t1:
        print(f'  PR utworzony {pr["createdAt"][11:19]} → merge {pr["mergedAt"][11:19]} = {(t1 - t0).total_seconds() / 60:.1f} min')
    gotowe = {h: min((s['created_at'] for s in v['statuses'] if s['context'] == 'CodeRabbit' and s['state'] == 'success'), default=None)
              for h, v in statusy.items()}
    for h, g in gotowe.items():
        print(f'  status CodeRabbit success na {h[:7]}: {g}')
    stracone = 0
    for m in monitory:
        h = next((x for x in gotowe if x[:7] in m['opis'] or x in m.get('komenda', '') or x[:7] in (m.get('zdarzenie') or '')), None)
        g = gotowe.get(h)
        dl = (czas(m['koniec']) - czas(m['start'])).total_seconds() / 60 if m.get('koniec') else None
        po = (czas(m['koniec']) - czas(g)).total_seconds() / 60 if g and m.get('koniec') else None
        stracone += max(0, (po or 0) - 1)  # minuta na interwał odpytywania
        f = lambda x: '—' if x is None else f'{x:.1f}'
        print(f'  Monitor „{m["opis"]}”: {f(dl)} min, zdarzenie: {(m.get("zdarzenie") or "")[:140]}; recenzja gotowa {f(po)} min przed końcem czekania')
    print(f'  czekanie ponad gotową recenzję (minus 1 min odpytywania): {stracone:.1f} min')


if __name__ == '__main__':
    main()
