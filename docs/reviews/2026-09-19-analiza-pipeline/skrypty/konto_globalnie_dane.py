#!/usr/bin/env python3
"""Dane do widoku GLOBALNEGO konta (konto_globalnie.py): elementy poziomu user, mapa wszystkich projektów, długa historia użycia.
Tylko odczyt, same nazwy. Źródła poza konto_wspolne: ~/.claude/history.jsonl (prompty i /komendy operatora, CLI i aplikacja),
liczniki `skillUsage`/`pluginUsage` w ~/.claude.json (od instalacji; pluginUsage wlicza odpalenia hooków), rozszerzenia aplikacji
desktop (~/Library/Application Support/Claude) i pluginy z konta claude.ai wstrzykiwane przez aplikację (@inline, katalog rpm)."""
import collections, glob, json, os, re, time

from konto_wspolne import CL, HOME, aktywne_konto, slug, wczytaj, zawartosc_pluginu

APP = os.path.join(HOME, 'Library', 'Application Support', 'Claude')
PL_ZN_NA_TOK = 1.8    # kalibracja 2026-09-28: opis skilla aibiz (PL) vs `claude plugin details` → 1,3–2,5 zn/tok
EN_ZN_NA_TOK = 2.85   # jw. figma (EN) → 2,7–3,0 zn/tok
KOPIE = ('/test-review/', '/private/tmp/', '/tmp/')   # kopie testowe i scratchpady analizy — jedna zbiorcza linia w mapie


def dzien(ms):
    return time.strftime('%Y-%m-%d', time.localtime(ms / 1000)) if ms else ''


def szac_tok(tekst):
    """Szacunek tokenów always-on dla wpisu na liście skilli/agentów (nazwa + opis); stawka zależy od języka."""
    return round(len(tekst) / (PL_ZN_NA_TOK if re.search('[ąęółśżźćń]', tekst) else EN_ZN_NA_TOK))


def opis_frontmatter(plik):
    try:
        with open(plik, encoding='utf-8') as f: t = f.read(20000)
    except OSError:
        return ''
    m = re.match(r'---\n(.*?)\n---', t, re.S)
    d = re.search(r'^description:\s*(.*?)(?=^[\w-]+:|\Z)', m.group(1), re.S | re.M) if m else None
    return d.group(1).strip().strip('"\'>|').strip() if d else ''


def skille_katalogu(kat):
    """{nazwa: szac. tokenów} dla skilli w katalogu (<nazwa>/SKILL.md)."""
    wyn = {}
    for d in sorted(glob.glob(os.path.join(kat, '*', 'SKILL.md'))):
        n = os.path.basename(os.path.dirname(d)); wyn[n] = szac_tok(n + opis_frontmatter(d))
    return wyn


def agenci_katalogu(kat):
    return {os.path.splitext(os.path.basename(p))[0]: szac_tok(os.path.basename(p) + opis_frontmatter(p))
            for p in sorted(glob.glob(os.path.join(kat, '*.md')))}


def etykieta_hooka(komenda):
    """Nazwa hooka bez treści komendy: pierwszy program + nazwa ostatniego pliku (skrypt / plik wyjścia)."""
    slowa = komenda.split()
    pliki = [os.path.basename(s.strip('\'"')) for s in slowa if '/' in s or s.endswith(('.sh', '.py', '.js'))]
    prog = os.path.basename(slowa[0]) if slowa else '?'
    return prog if not pliki else (pliki[-1] if prog in ('python3', 'python', 'bash', 'sh', 'node') or pliki[-1] == prog
                                   else '%s → %s' % (prog, pliki[-1]))


def hooki_ustawien(ust):
    """{zdarzenie: [etykiety komend]} z bloku `hooks` pliku ustawień."""
    return {zd: [etykieta_hooka(h.get('command') or h.get('type') or '?') for m in lst for h in (m.get('hooks') or [])]
            for zd, lst in (ust.get('hooks') or {}).items()}


def pluginy_desktop():
    """Pluginy z konta claude.ai wstrzykiwane przez aplikację desktop (@inline) — tylko aktywne konto."""
    ak = aktywne_konto() or ''
    org, konto = (ak.split('_') + [''])[:2]
    kat = os.path.join(APP, 'local-agent-mode-sessions', konto, org, 'rpm')
    wyn = {}
    for p in (wczytaj(os.path.join(kat, 'manifest.json'), {}) or {}).get('plugins') or []:
        wyn[p.get('name', '?') + '@inline'] = dict(zawartosc=zawartosc_pluginu(os.path.join(kat, p.get('id', ''))),
                                                   marketplace=p.get('marketplaceName'))
    return wyn


def rozszerzenia_desktop():
    return sorted(((wczytaj(os.path.join(APP, 'extensions-installations.json'), {}) or {}).get('extensions') or {}).keys())


def historia(dni):
    """/komendy operatora z ~/.claude/history.jsonl: nazwa → n (całość), n w oknie dni, projekty, pierwsza i ostatnia data."""
    granica = (time.time() - dni * 86400) * 1000
    lic = collections.defaultdict(lambda: dict(n=0, n_okno=0, projekty=set(), od=None, ost=0))
    pierwszy = None; proj_ost = collections.Counter()
    try:
        f = open(os.path.join(CL, 'history.jsonl'), encoding='utf-8', errors='replace')
    except OSError:
        return lic, None, proj_ost
    with f:
        for linia in f:
            try: w = json.loads(linia)
            except ValueError: continue
            ts = w.get('timestamp') or 0; pierwszy = pierwszy or ts; p = (w.get('project') or '').lower()
            proj_ost[p] = max(proj_ost[p], ts)
            t = (w.get('display') or '').strip()
            if not t.startswith('/') or len(t) < 2: continue
            e = lic[t.split()[0][1:]]; e['n'] += 1; e['n_okno'] += ts >= granica; e['projekty'].add(p)
            e['od'] = e['od'] or ts; e['ost'] = max(e['ost'], ts)
    return lic, pierwszy, proj_ost


def wpis_projektu(p, cjp, inst):
    """Konfiguracja projektu na poziomach project/local (nazwy)."""
    ust = {poz: wczytaj(os.path.join(p, '.claude', plik), {}) or {} for poz, plik in (('project', 'settings.json'), ('local', 'settings.local.json'))}
    return dict(
        pluginy={poz: u.get('enabledPlugins') or {} for poz, u in ust.items()},
        instalacje=sorted('%s(%s)' % (pid, w.get('scope')) for pid, ws in inst.items() for w in ws
                          if (w.get('projectPath') or '').lower() == p.lower()),
        mcp_json=sorted(((wczytaj(os.path.join(p, '.mcp.json'), {}) or {}).get('mcpServers') or {}).keys()),
        mcp_local=sorted((cjp.get('mcpServers') or {}).keys()),
        mcp_wylaczone=sorted(set(cjp.get('disabledMcpServers') or []) | set(cjp.get('disabledMcpjsonServers') or [])),
        skille=len(glob.glob(os.path.join(p, '.claude', 'skills', '*', 'SKILL.md'))),
        agenci=len(glob.glob(os.path.join(p, '.claude', 'agents', '*.md'))),
        hooki={poz: sorted((u.get('hooks') or {}).keys()) for poz, u in ust.items() if u.get('hooks')},
        overrides=sum(len(u.get('skillOverrides') or {}) for u in ust.values()),
        bez_konektorow=any(u.get('disableClaudeAiConnectors') for u in ust.values()))


def projekty(cj, inst, hist_proj, lic):
    """Wszystkie projekty z ~/.claude.json i installed_plugins.json, scalone bez rozróżniania wielkości liter (macOS)."""
    sciezki = collections.defaultdict(set)
    for p in list((cj.get('projects') or {}).keys()) + [w['projectPath'] for ws in inst.values() for w in ws if w.get('projectPath')]:
        sciezki[p.rstrip('/').lower() or '/'].add(p)
    akt = collections.Counter()
    for (_, _), e in lic.items():
        for s, n in e['per'].items(): akt[s.lower()] += n
    wyn = []
    for klucz, warianty in sorted(sciezki.items()):
        p = next((w for w in sorted(warianty) if os.path.isdir(w)), sorted(warianty)[0])
        cjp = {}
        for w in warianty: cjp.update((cj.get('projects') or {}).get(w) or {})
        sesja = max((ostatnia_sesja(w) for w in warianty), default='')
        wyn.append(dict(sciezka=p, warianty=len(warianty), istnieje=os.path.isdir(p), kopia=any(k in p + '/' for k in KOPIE),
                        ostatnio=max(dzien(hist_proj.get(klucz, 0)), sesja), uzycia_30d=akt.get(slug(p).lower(), 0),
                        wpis=wpis_projektu(p, cjp, inst) if os.path.isdir(p) else None))
    return wyn


def nazwy_slugow(projekty_lista, hist_proj):
    """slug transkryptu (lower) → czytelna ścieżka (~/...)."""
    m = {slug(p).lower(): p for p in hist_proj if p}
    m.update({slug(x['sciezka']).lower(): x['sciezka'] for x in projekty_lista})
    return {k: v.replace(HOME, '~') for k, v in m.items()}


def nazwa_projektu(s, nazwy):
    """Krótka nazwa projektu ze sluga transkryptu; dla katalogów spoza map — slug bez prefiksu katalogu domowego."""
    if s.lower() in nazwy: return nazwy[s.lower()].rstrip('/').split('/')[-1] or '~'
    return re.sub(r'^(documents-(kodowanie-)?)', '', s.lower()[len(slug(HOME)):].lstrip('-')) or '~'


def ostatnia_sesja(p):
    """Data najnowszego transkryptu projektu (aplikacja desktop nie zawsze pisze do history.jsonl)."""
    pliki = glob.glob(os.path.join(CL, 'projects', slug(p), '*.jsonl'))
    return time.strftime('%Y-%m-%d', time.localtime(max(os.path.getmtime(f) for f in pliki))) if pliki else ''
