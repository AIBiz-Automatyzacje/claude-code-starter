#!/usr/bin/env python3
"""Test review (TEST-REVIEW-PLAN §10–§11) — skan sesji testu jednej fazy. Zatrzymuje WYŁĄCZNIE według definicji §11 planu (skutek, nie jego
przybliżenie); zachowania nietypowe, ale bez skutku dla pomiaru, wypisuje jako UWAGI (przegląd po fazie, notatka pilota).

Użycie:
  python3 skrypty/test_review_skan.py <etykieta>          — skan po kroku; kod 0 = OK, 2 = twarde zatrzymanie, 4 = przeciek (§11: faza wypada
                                                           z wyników, dopiero przeciek w > 1 fazie zatrzymuje test — liczy test_review_uruchom.sh)
  python3 skrypty/test_review_skan.py odcisk <etykieta>   — przed pierwszym agentem fazy: odcisk nakładki .claude/ + CLAUDE.md kopii (skip-worktree
                                                           i info/exclude — `git status` ich nie widzi) → ~/test-review/meta/<et>-odcisk.json
Czyta sesje FAZY (test_review_sesja.sesje_fazy; inne sesje w katalogu kopii, np. próba harnessu, są pomijane i wypisane): <sesja>.jsonl (sesja
uruchamiająca) i <sesja>/subagents/workflows/<run>/agent-*.jsonl (+ journal.jsonl dla etykiet). Wyjście: dane/test-review/skan-<et>.{txt,json}.
TWARDE (§11): (1) MODEL — odpowiedź API z modelu ≠ claude-opus-5-5 albo haiku poza rolami haiku projektu (dedup/agregator/pre-skan);
(2) PRZECIEK — odczyt miejsca zakazanego dla fazy (Documents, transkrypty poza tool-results własnej sesji, lustro, wyniki, mapowania sędziego,
prompty, meta, robocze, inne kopie/dossier/skrypty, zrzuty /tmp innych faz) albo sieć (gh/curl/wget/WebFetch/WebSearch);
(3) ZMIANA KOPII — sprawdzana na kopii, nie w komendach: HEAD ≠ sha fazy, `git status` niepusty, odcisk nakładki ≠ zapisany przed fazą; do tego
zapis Bashem w komendzie dotykającej miejsca zakazanego z (2) (skażenie wyników albo innej fazy);
(4) N1 — wykonanie wiadomości startowej: sesja uruchamiająca woła coś poza Workflow/ToolSearch albo agent woła Workflow lub odpowiada „RUN wf_…”
(wiadomość startowa nie trafia do agentów — 0 z 82 agentów pilota; dlatego narzędzia agenta haiku to nie N1).
UWAGI (bez zatrzymania): narzędzia agentów haiku inne niż StructuredOutput, zapisy Bashem poza dozwolonymi celami (dozwolone: /dev/null, scratchpad
własnej sesji, /tmp/* packagera wariantu 0 — decyzje operatora 2026-09-25), próby Write/Edit/NotebookEdit (deny w --settings je odrzuca, skutek
łapie (3)). Przekierowania `>` ocenia po celu: po podstawieniu zmiennych z tej samej komendy; `>` w cudzysłowach to nie przekierowanie."""
import glob, hashlib, json, os, re, subprocess, sys

sys.dont_write_bytecode = True
import test_review_sesja as T

TR = os.path.expanduser('~/test-review')
PROJ = os.path.expanduser('~/.claude/projects')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = 'claude-opus-5-5'
RE_HAIKU_ROLA = re.compile(r'haiku|dedup|agregator|pre-skan', re.I)
ZAPIS_NARZ = {'Write', 'Edit', 'NotebookEdit', 'MultiEdit'}
RE_BASH_ZAPIS = re.compile(r'(^|[;&|]\s*)git\s+(commit|add|mv|rm|checkout|reset|push|stash|apply|restore|switch|merge|rebase|tag|worktree\s+add|clean)\b'
                           r'|\btee\s|\bmv\s|\brm\s|\bcp\s|open\([^)]*[\'"][wa]b?[\'"]|sed\s+-i')
RE_PRZEKIEROWANIE = re.compile(r'(?:^|(?<=[\s;&|(){}]))\d?>>?(?![&=>])\s*([^\s;&|<>()]+)')
RE_ZMIENNA = re.compile(r'(?:^|(?<=[\s;&(]))([A-Za-z_]\w*)=("[^"]*"|\'[^\']*\'|[^\s;&|]+)')
RE_CUDZYSLOW = re.compile(r'"[^"]*"|\'[^\']*\'')
RE_URL = re.compile(r'https?://(\[[^\]]*\]|[^/:\s\'"()]+)')
RE_WYWOLANIE = re.compile(r'(?:^|[;&|\s(`"])(curl|wget|gh)\s([^;&|\n)`]*)')
RE_RUN = re.compile(r'^\s*RUN wf_', re.M)
PETLA = re.compile(r'^(127\.\d+\.\d+\.\d+|localhost|[\w.-]+\.localhost|\[::1\])$')


def siec(cmd):
    """Komenda sięga sieci: wywołanie gh albo curl/wget, którego argumenty (do końca segmentu) nie mają adresu http(s) albo mają adres
    spoza pętli lokalnej. Builder sprawdza zbudowany serwer curlem na 127.0.0.1, a w tej samej komendzie bywa adres w treści heredoca
    (f-b8374c8, P12 sesja 5) — liczą się tylko argumenty wywołania. Także `$(curl …)` i curl w cudzysłowie."""
    for m in RE_WYWOLANIE.finditer(cmd):
        hosty = RE_URL.findall(m.group(2))
        if m.group(1) == 'gh' or not hosty or not all(PETLA.match(h) for h in hosty): return True
    return False


def slug(p):
    return re.sub(r'[^A-Za-z0-9]', '-', p)


def zapisy_bash(cmd, sid, packager):
    """Fragmenty komendy Bash, które zapisują poza dozwolonymi celami (pusta lista = nic takiego)."""
    for nazwa, wartosc in RE_ZMIENNA.findall(cmd):
        cmd = re.sub(r'\$\{?%s\}?(?!\w)' % nazwa, lambda _m: wartosc.strip('"\''), cmd)
    cmd = RE_CUDZYSLOW.sub(lambda m: m.group(0).replace('>', ' '), cmd)
    scratchpad = re.compile(r'(/private)?/tmp/claude-\d+/[^/]+/%s/scratchpad/' % re.escape(sid))
    zle = [m.group(0) for m in [RE_BASH_ZAPIS.search(cmd)] if m]
    for m in RE_PRZEKIEROWANIE.finditer(cmd):
        cel = m.group(1).strip('"\'')
        if cel == '/dev/null' or scratchpad.match(cel) or (packager and cel.startswith('/tmp/')): continue
        zle.append(m.group(0).strip())
    return zle


def zakazane_re(et):
    inne = [os.path.basename(p) for p in glob.glob(os.path.join(TR, 'kopie', '*')) if os.path.basename(p) != et]
    wzorce = [r'/Documents/', r'\.claude/projects', r'test-review/(_mirror|wyniki|sedzia|prompty|meta|robocze)', r'/tmp/tr-']
    # nazwa katalogu musi się tu kończyć: `\b` przepuszczał f-b26128d jako przedrostek f-b26128d-r2 (własna kopia powtórki = fałszywy przeciek)
    wzorce += [r'test-review/(kopie|dossier|skrypty)/%s(?![\w.-])' % re.escape(o) for o in inne]
    return re.compile('|'.join(wzorce))


def odcisk(kopia):
    """sha256 nakładki .claude/ + CLAUDE.md kopii (ścieżka względna + treść, w kolejności ścieżek)."""
    pliki = [os.path.join(d, f) for d, _, fs in os.walk(os.path.join(kopia, '.claude')) for f in fs] + [os.path.join(kopia, 'CLAUDE.md')]
    h = hashlib.sha256()
    for p in sorted(p for p in pliki if os.path.isfile(p)):
        h.update(os.path.relpath(p, kopia).encode() + b'\0' + open(p, 'rb').read())
    return h.hexdigest()


def plik_odcisku(et):
    return os.path.join(TR, 'meta', et + '-odcisk.json')


def zapisz_odcisk(et):
    if os.path.exists(plik_odcisku(et)):
        print('odcisk nakładki %s już jest — zostaje' % et); return 0
    kopia = json.load(open(os.path.join(TR, 'meta', et + '.json')))['kopia']
    json.dump({'etykieta': et, 'odcisk': odcisk(kopia)}, open(plik_odcisku(et), 'w'))
    print('odcisk nakładki %s zapisany' % et); return 0


def git(kopia, *argumenty):
    return subprocess.run(['git', '-C', kopia] + list(argumenty), capture_output=True, text=True).stdout


def zmiany_kopii(et, meta):
    """Skutek na kopii (§11 „zmiana w kopii”): lista opisów; pusta = kopia jak przed fazą."""
    k, zle = meta['kopia'], []
    head = git(k, 'rev-parse', 'HEAD').strip()
    if not head.startswith(meta['sha'][:10]): zle.append('HEAD %s ≠ sha fazy %s' % (head[:10], meta['sha'][:10]))
    st = git(k, 'status', '--porcelain', '--untracked-files=all').strip()
    if st: zle.append('git status: ' + st[:300].replace('\n', '; '))
    if not os.path.exists(plik_odcisku(et)): zle.append('brak odcisku nakładki sprzed fazy (%s)' % plik_odcisku(et))
    elif json.load(open(plik_odcisku(et)))['odcisk'] != odcisk(k): zle.append('nakładka .claude/ albo CLAUDE.md kopii zmieniona')
    return zle


def agent(jf, rp, etykieta, sid, kat):
    """(modele, liczba wywołań narzędzi, twarde {model, przeciek, zapis, n1}, uwagi) jednego agenta."""
    packager = etykieta.startswith('kontekst:diff')
    wlasne_wyniki = os.path.join(kat, sid, 'tool-results') + '/'
    modele, narz, uwagi, bledy_api = set(), [], [], []
    tw = {'model': [], 'przeciek': [], 'zapis': [], 'n1': []}
    for line in open(jf, errors='ignore'):
        try: o = json.loads(line)
        except ValueError: continue
        if o.get('type') != 'assistant': continue
        m = o.get('message') or {}
        if m.get('model') == '<synthetic>':   # harness wpisał błąd API zamiast odpowiedzi modelu (np. wyczerpany limit konta)
            bledy_api.append(' '.join(b.get('text', '') for b in m.get('content') or [] if isinstance(b, dict))[:100]); continue
        if m.get('model'): modele.add(m['model'])
        for b in m.get('content') or []:
            if not isinstance(b, dict): continue
            if b.get('type') == 'text' and RE_RUN.search(b.get('text') or ''): tw['n1'].append('agent odpowiada jak sesja: ' + b['text'][:80])
            if b.get('type') != 'tool_use': continue
            n, inp = b.get('name', ''), b.get('input') or {}
            narz.append(n)
            wej = json.dumps(inp, ensure_ascii=False).replace(wlasne_wyniki, '')
            cmd = inp.get('command', '') if n == 'Bash' else ''
            zle = zapisy_bash(cmd, sid, packager) if cmd else []
            if n == 'Workflow': tw['n1'].append('agent wołał Workflow')
            if n in ('WebFetch', 'WebSearch') or siec(cmd): tw['przeciek'].append('%s %s' % (n, wej[:140]))
            elif rp.search(wej): tw['zapis' if zle else 'przeciek'].append('%s %s' % (n, wej[:160]))
            elif zle: uwagi.append('zapis Bashem poza kopią %s: %s' % (zle, cmd[:120].replace('\n', ' ')))
            if n in ZAPIS_NARZ: uwagi.append('%s %s (deny w --settings)' % (n, inp.get('file_path', '')))
    if bledy_api: tw['model'].append('BŁĄD API zamiast odpowiedzi modelu (%d×): %s' % (len(bledy_api), bledy_api[0]))
    haiku_rola = bool(RE_HAIKU_ROLA.search(etykieta))
    for md in modele:
        if 'haiku' in md and not haiku_rola: tw['model'].append('haiku poza rolą: %s' % md)
        if 'haiku' not in md and md != MODEL: tw['model'].append('model %s' % md)
    narz_haiku = sorted(set(narz) - {'StructuredOutput'})
    if haiku_rola and narz_haiku: uwagi.append('agent haiku wołał narzędzia %s' % narz_haiku)
    return sorted(modele), len(narz), tw, uwagi


def etykiety(rd):
    lab, jp = {}, os.path.join(rd, 'journal.jsonl')
    if not os.path.exists(jp): return lab
    for line in open(jp, errors='ignore'):
        try: o = json.loads(line)
        except ValueError: continue
        if o.get('type') == 'started' and o.get('agentId'): lab[o['agentId']] = o.get('label') or ''
    return lab


def narzedzia_sesji(sj):
    narz = []
    for line in open(sj, errors='ignore'):
        try: o = json.loads(line)
        except ValueError: continue
        for b in ((o.get('message') or {}).get('content') or []) if o.get('type') == 'assistant' else []:
            if isinstance(b, dict) and b.get('type') == 'tool_use': narz.append(b.get('name'))
    return narz


def main(et):
    meta = json.load(open(os.path.join(TR, 'meta', et + '.json')))
    kat = os.path.join(PROJ, slug(meta['kopia']))
    rp = zakazane_re(et)
    L, uwagi, stop = [], [], []
    podsum = {'agentow': 0, 'model': 0, 'przeciek': 0, 'zapis': 0, 'n1': 0}
    fazy, pominiete = T.sesje_fazy(et), []
    for sj in sorted(glob.glob(os.path.join(kat, '*.jsonl'))):
        sid = os.path.basename(sj)[:-6]
        if sid not in fazy: pominiete.append(sid[:8]); continue
        narz = narzedzia_sesji(sj)
        inne = [n for n in narz if n not in ('Workflow', 'ToolSearch')]
        L.append('sesja %s: narzędzia sesji %s%s' % (sid[:8], sorted(set(narz)), ('  ALARM N1: ' + str(inne)) if inne else ''))
        if inne: podsum['n1'] += 1; stop.append('N1 sesja %s: %s' % (sid[:8], inne))
        for rd in sorted(glob.glob(os.path.join(kat, sid, 'subagents', 'workflows', '*'))):
            lab = etykiety(rd)
            for jf in sorted(glob.glob(os.path.join(rd, 'agent-*.jsonl'))):
                aid = os.path.basename(jf)[6:-6]; e = lab.get(aid, aid)
                modele, nn, tw, uw = agent(jf, rp, e, sid, kat)
                podsum['agentow'] += 1
                for k, v in tw.items():
                    if v: podsum[k] += 1; stop.append('%s %s %s: %s' % (k.upper(), os.path.basename(rd), e, v[:2]))
                uwagi += ['%s %s: %s' % (os.path.basename(rd), e, u) for u in uw]
                L.append('  %-44s %-26s narzędzia %3d%s%s' % (e[:44], ','.join(modele) or '?', nn,
                                                               ''.join('  %s: %s' % (k.upper(), v[:2]) for k, v in tw.items() if v), '  (uwaga)' if uw else ''))
    kopia = zmiany_kopii(et, meta)
    if kopia: podsum['zapis'] += 1; stop.append('ZMIANA KOPII: %s' % kopia)
    L.append('')
    L.append('kopia fazy: %s' % ('; '.join(kopia) if kopia else 'bez zmian (HEAD = sha fazy, git status pusty, odcisk nakładki zgodny)'))
    L.append('UWAGI bez zatrzymania (%d)%s' % (len(uwagi), ':' if uwagi else ''))
    L += ['  ' + u for u in uwagi]
    L.append('pominięte sesje spoza fazy (nie są sesjami testu tej fazy): %s' % (pominiete or 'brak'))
    L.append('podsumowanie: %s, uwag %d' % (podsum, len(uwagi)))
    twarde = podsum['model'] or podsum['zapis'] or podsum['n1']
    if twarde: L.append('STOP §11: ' + '; '.join(stop[:12]))
    elif podsum['przeciek']: L.append('PRZECIEK §11 — faza wypada z wyników (przeciek w > 1 fazie = STOP): ' + '; '.join(stop[:12]))
    else: L.append('STOP §11: brak — modele zgodne z projektem, kopia bez zmian, zero przecieku, zero N1')
    os.makedirs(os.path.join(BASE, 'dane', 'test-review'), exist_ok=True)
    open(os.path.join(BASE, 'dane', 'test-review', 'skan-%s.txt' % et), 'w').write('\n'.join(L) + '\n')
    json.dump({'etykieta': et, 'podsumowanie': podsum, 'stop': stop, 'kopia': kopia, 'uwagi': uwagi},
              open(os.path.join(BASE, 'dane', 'test-review', 'skan-%s.json' % et), 'w'), ensure_ascii=False, indent=1)
    print('\n'.join(L[-3:]))
    return 2 if twarde else 4 if podsum['przeciek'] else 0


if __name__ == '__main__':
    sys.exit(zapisz_odcisk(sys.argv[2]) if sys.argv[1] == 'odcisk' else main(sys.argv[1]))
