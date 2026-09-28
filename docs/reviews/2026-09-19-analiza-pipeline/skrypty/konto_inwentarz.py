#!/usr/bin/env python3
"""Inwentarz konta Claude Code dla jednego projektu: pluginy, MCP, skille, agenci, hooki — per poziom (user / project / local /
plugin / claude.ai), co jest AKTYWNE w tym projekcie, co było UŻYWANE w ostatnich N dniach i komendy porządkujące.

Użycie: python3 konto_inwentarz.py [ŚCIEŻKA_PROJEKTU] [--dni 30] [--koszt]
  --koszt  dopisuje „Always-on” tokeny każdego aktywnego pluginu z `claude plugin details` (wolniej: jedno wywołanie CLI na plugin).
Tylko odczyt: niczego nie zmienia, nie uruchamia serwerów MCP, wypisuje NAZWY (nigdy wartości konfiguracji — w MCP bywają klucze).
Reguły poziomów (docs code.claude.com: settings, mcp, skills, discover-plugins): pluginy local > project > user (`enabledPlugins`);
MCP local > project > user > plugin > claude.ai; skille user > project, plus plugin (`plugin:skill`) i synchronizowane z claude.ai
(ładuje się tylko aktywne konto: ~/.claude/{skills,plugins}/synced/<organizationUuid>_<accountUuid>).
Użycie liczone z transkryptów ~/.claude/projects (retencja ~30 dni): wywołania narzędzi mcp__*, Skill, Agent i komendy /x operatora.
Hooki i statusLine nie zostawiają śladu w transkrypcie — takie pluginy dostają ostrzeżenie zamiast rekomendacji wyłączenia."""
import collections, glob, json, os, re, subprocess, sys, time

HOME = os.path.expanduser('~')
CL = os.path.join(HOME, '.claude')
DUZO_SKILLI = 20      # plugin z tyloma skillami wydłuża listę skilli każdej sesji — osobna rekomendacja
MALO_PROJEKTOW = 3    # plugin globalny używany w tylu projektach lub mniej → kandydat do poziomu project/local


def wczytaj(p, domyslnie=None):
    try:
        with open(p, encoding='utf-8') as f: return json.load(f)
    except (OSError, ValueError): return domyslnie


def slug(p):
    return re.sub(r'[^A-Za-z0-9]', '-', p)


def aktywne_konto():
    o = (wczytaj(os.path.join(HOME, '.claude.json'), {}) or {}).get('oauthAccount') or {}
    return '%s_%s' % (o.get('organizationUuid'), o.get('accountUuid')) if o.get('accountUuid') else None


def synced(rodzaj):
    """(aktywne, nieaktywne) katalogi kont w ~/.claude/<rodzaj>/synced."""
    kat = sorted(glob.glob(os.path.join(CL, rodzaj, 'synced', '*')))
    ak = aktywne_konto()
    return [k for k in kat if os.path.basename(k) == ak], [k for k in kat if os.path.basename(k) != ak]


def ustawienia(projekt):
    return {poz: wczytaj(p, {}) or {} for poz, p in (('user', os.path.join(CL, 'settings.json')),
                                                     ('project', os.path.join(projekt, '.claude', 'settings.json')),
                                                     ('local', os.path.join(projekt, '.claude', 'settings.local.json')))}


def zawartosc_pluginu(sciezka):
    """Co plugin wnosi: skille, agenci, komendy, serwery MCP, zdarzenia hooków (z plików na dysku)."""
    if not sciezka or not os.path.isdir(sciezka): return {}
    sk = sorted(os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(sciezka, 'skills', '*', 'SKILL.md')))
    ag = sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(sciezka, 'agents', '*')))
    mcp = list(((wczytaj(os.path.join(sciezka, '.mcp.json'), {}) or {}).get('mcpServers') or {}).keys())
    man = wczytaj(os.path.join(sciezka, '.claude-plugin', 'plugin.json'), {}) or {}
    if isinstance(man.get('mcpServers'), dict): mcp += list(man['mcpServers'].keys())
    hk = list(((wczytaj(os.path.join(sciezka, 'hooks', 'hooks.json'), {}) or {}).get('hooks') or {}).keys())
    return dict(skille=sk, agenci=ag, komendy=len(glob.glob(os.path.join(sciezka, 'commands', '*'))), mcp=sorted(set(mcp)), hooki=hk)


def pluginy(ust):
    """Stan każdego pluginu per poziom i efektywnie w projekcie (local > project > user)."""
    ep = {poz: u.get('enabledPlugins') or {} for poz, u in ust.items()}
    inst = (wczytaj(os.path.join(CL, 'plugins', 'installed_plugins.json'), {}) or {}).get('plugins') or {}
    wyn = {}
    for pid in sorted(set(ep['user']) | set(ep['project']) | set(ep['local']) | set(inst)):
        wpisy = inst.get(pid) or []
        sciezka = next((w['installPath'] for w in wpisy if w.get('installPath') and os.path.isdir(w['installPath'])), None)
        martwe = [w for w in wpisy if w.get('projectPath') and not os.path.isdir(w['projectPath'])]
        ef = ep['local'].get(pid, ep['project'].get(pid, ep['user'].get(pid)))
        wyn[pid] = dict(stan={p: ep[p].get(pid) for p in ep}, efektywnie=bool(ef), zrodlo='marketplace',
                        martwe_wpisy=len(martwe), zawartosc=zawartosc_pluginu(sciezka))
    if ust['user'].get('syncClaudeAiPlugins') is not False:
        for konto in synced('plugins')[0]:
            for d in (d for d in sorted(glob.glob(os.path.join(konto, '*'))) if os.path.isdir(d)):
                pid = os.path.basename(d).split('~')[0] + '@synced'
                ef = ep['local'].get(pid, ep['project'].get(pid, ep['user'].get(pid, True)))
                wyn.setdefault(pid, dict(stan={p: ep[p].get(pid) for p in ep}, efektywnie=bool(ef), zrodlo='claude.ai',
                                         martwe_wpisy=0, zawartosc=zawartosc_pluginu(d)))
    return wyn


def uzycie(dni):
    """Liczniki z transkryptów: mcp serwer, skill (Skill + /komenda operatora), agent — liczba, projekty, ostatnia data."""
    granica = time.time() - dni * 86400
    lic = collections.defaultdict(lambda: dict(n=0, projekty=set(), ostatnio=''))
    for plik in glob.iglob(os.path.join(CL, 'projects', '*', '**', '*.jsonl'), recursive=True):
        try:
            if os.path.getmtime(plik) < granica: continue
            proj = os.path.relpath(plik, os.path.join(CL, 'projects')).split(os.sep)[0]
            glowna = os.sep + 'subagents' + os.sep not in plik
            with open(plik, encoding='utf-8', errors='replace') as f:
                for linia in f:
                    if '"tool_use"' not in linia and not (glowna and '<command-name>' in linia): continue
                    for k, ts in klucze_linii(linia, glowna):
                        e = lic[k]; e['n'] += 1; e['projekty'].add(proj); e['ostatnio'] = max(e['ostatnio'], ts)
        except OSError:
            continue
    return lic


def klucze_linii(linia, glowna):
    try: w = json.loads(linia)
    except ValueError: return []
    ts = (w.get('timestamp') or '')[:10]; tresc = (w.get('message') or {}).get('content'); wyn = []
    for c in tresc if isinstance(tresc, list) else []:
        if not isinstance(c, dict) or c.get('type') != 'tool_use': continue
        n = c.get('name') or ''; inp = c.get('input') or {}
        if n.startswith('mcp__'): wyn.append((('mcp', n.split('__')[1]), ts))
        elif n == 'Skill' and inp.get('skill'): wyn.append((('skill', inp['skill']), ts))
        elif n in ('Agent', 'Task') and inp.get('subagent_type'): wyn.append((('agent', inp['subagent_type']), ts))
    if glowna and w.get('type') == 'user':
        wyn += [(('skill', m.lstrip('/')), ts) for m in re.findall(r'<command-name>([^<]+)</command-name>', linia)]
    return wyn


def uzycie_pluginu(pid, z, lic):
    nazwa = pid.split('@')[0]; wyn = dict(n=0, projekty=set(), ostatnio='')
    for (typ, k), e in lic.items():
        if (typ in ('skill', 'agent') and k.startswith(nazwa + ':')) or (typ == 'mcp' and k.startswith('plugin_%s_' % nazwa)) \
                or (typ == 'skill' and k in (z.get('skille') or [])):
            wyn['n'] += e['n']; wyn['projekty'] |= e['projekty']; wyn['ostatnio'] = max(wyn['ostatnio'], e['ostatnio'])
    return wyn


def rekomendacje_pluginu(pid, p, u, ctx):
    """Reguły porządkujące; zawsze komenda do uruchomienia przez operatora."""
    z = p['zawartosc']; rek = []
    if not p['efektywnie']: return ['plugin %s: %d martwych wpisów project/local w installed_plugins.json (szum w `claude plugin list`)' % (
        pid, p['martwe_wpisy'])] if p['martwe_wpisy'] else []
    if pid.split('@')[0] in ctx['statusline']: return []
    lokalnie = '.claude/settings.local.json → "enabledPlugins": {"%s": false}' % pid
    uwaga = ' (UWAGA: ma hooki %s — ich użycia nie widać w transkryptach; sprawdź, czy z nich korzystasz)' % ','.join(z['hooki']) if z.get('hooki') else ''
    if p['zrodlo'] == 'claude.ai':
        if u['n'] == 0 or z.get('hooki'):
            rek.append('plugin %s (z konta claude.ai, działa w każdym projekcie): %s → w projektach kodu %s, albo wyłącz go na claude.ai%s' % (
                pid, '0 użyć w %d dni' % ctx['dni'] if u['n'] == 0 else 'użyty w %d proj.' % len(u['projekty']), lokalnie, uwaga))
        return rek
    if not p['stan']['user']: return rek
    if u['n'] == 0:
        rek.append('plugin %s: globalny, 0 użyć w %d dni → claude plugin disable %s --scope user%s' % (pid, ctx['dni'], pid, uwaga))
    elif len(u['projekty']) <= MALO_PROJEKTOW and ctx['moj'] not in u['projekty']:
        rek.append('plugin %s: globalny, używany w %d proj. (nie w tym) → przenieś: claude plugin disable %s --scope user, a w projektach, '
                   'które go używają: claude plugin install %s --scope local (albo tylko tu: %s)%s' % (
                       pid, len(u['projekty']), pid, pid, lokalnie, uwaga))
    if len(z.get('skille') or []) >= DUZO_SKILLI:
        rek.append('plugin %s wnosi %d skilli na listę każdej sesji → jeśli używasz tylko jego MCP: .claude/settings.json → "skillOverrides" '
                   'z wartością "off" dla nieużywanych skilli, albo przenieś plugin na poziom projektu' % (pid, len(z['skille'])))
    return rek


def sekcja_pluginy(Q, plug, lic, ctx):
    Q('=== 1. PLUGINY (stan u:user / p:project / l:local → efektywnie w tym projekcie) ===')
    rek = []; suma = []; st = lambda v: '-' if v is None else ('on' if v else 'off')
    for pid, p in sorted(plug.items(), key=lambda x: (not x[1]['efektywnie'], x[0])):
        z = p['zawartosc']; u = uzycie_pluginu(pid, z, lic)
        tylko_hooki = not (z.get('skille') or z.get('mcp') or z.get('agenci') or z.get('komendy'))
        kos = ''
        if ctx['koszt'] and p['efektywnie']:
            k = koszt_always_on(pid); kos = ' | always-on ~%s tok' % k if k is not None else ''
            if k is not None: suma.append(k)
        uz = ('%d× w %d proj., ostatnio %s' % (u['n'], len(u['projekty']), u['ostatnio'])) if u['n'] else \
            ('statusLine' if pid.split('@')[0] in ctx['statusline'] else ('niewidoczne (tylko hooki)' if tylko_hooki else '0'))
        Q('  %-4s %-46s u:%-3s p:%-3s l:%-3s %-9s | skille %3d, agenci %d, MCP %s, hooki %s | użycie: %s%s' % (
            'ON' if p['efektywnie'] else 'off', pid, st(p['stan']['user']), st(p['stan']['project']), st(p['stan']['local']), p['zrodlo'],
            len(z.get('skille') or []), len(z.get('agenci') or []), ','.join(z.get('mcp') or []) or '-', ','.join(z.get('hooki') or []) or '-',
            uz, kos))
        rek += rekomendacje_pluginu(pid, p, u, ctx)
    if suma: Q('  SUMA always-on aktywnych pluginów: ~%d tok na KAŻDĄ sesję (%d pluginów; bez schematów narzędzi MCP)' % (sum(suma), len(suma)))
    return rek


def sekcja_mcp(Q, projekt, ust, plug, lic, ctx):
    cj = wczytaj(os.path.join(HOME, '.claude.json'), {}) or {}
    pr = (cj.get('projects') or {}).get(projekt) or {}
    wyl_kon = any(u.get('disableClaudeAiConnectors') for u in ust.values()) or os.environ.get('ENABLE_CLAUDEAI_MCP_SERVERS') == 'false'
    Q('=== 2. SERWERY MCP aktywne w tym projekcie (local > project > user > plugin > konektory claude.ai) ===')
    serwery = [(n, poz) for poz, src in (('local', pr.get('mcpServers')), ('project', (wczytaj(os.path.join(projekt, '.mcp.json'), {}) or {}).get('mcpServers')),
                                          ('user', cj.get('mcpServers'))) for n in (src or {})]
    serwery += [(n, 'plugin ' + pid) for pid, p in plug.items() if p['efektywnie'] for n in p['zawartosc'].get('mcp') or []]
    rek = []
    for n, poz in serwery:
        e = lic.get(('mcp', n)) if not poz.startswith('plugin') else lic.get(('mcp', 'plugin_%s_%s' % (poz.split(' ')[1].split('@')[0], n)))
        wyl = n in (pr.get('disabledMcpServers') or [])
        Q('  %-18s %-42s %-17s | użycie: %s' % (n, poz, 'wyłączony w /mcp' if wyl else '',
                                                ('%d× w %d proj., ostatnio %s' % (e['n'], len(e['projekty']), e['ostatnio'])) if e else '0'))
        if poz == 'user' and not e:
            rek.append('MCP %s (user): 0 użyć w %d dni → claude mcp remove %s --scope user; tam, gdzie potrzebny, dodaj ponownie z --scope local' % (
                n, ctx['dni'], n))
        elif poz == 'user' and len(e['projekty']) <= MALO_PROJEKTOW and ctx['moj'] not in e['projekty'] and not wyl:
            rek.append('MCP %s (user): używany w %d proj. (nie w tym) → przenieś na --scope local w tych projektach (claude mcp get %s pokaże '
                       'konfigurację), potem claude mcp remove %s --scope user' % (n, len(e['projekty']), n, n))
    znane = {n for n, _ in serwery}
    inne = sorted(((k, e) for (t, k), e in lic.items() if t == 'mcp' and k not in znane and not k.startswith('plugin_')), key=lambda x: -x[1]['n'])
    Q('  konektory claude.ai: %s' % ('WYŁĄCZONE (disableClaudeAiConnectors / ENABLE_CLAUDEAI_MCP_SERVERS=false)' if wyl_kon else
                                     'WŁĄCZONE — lista na claude.ai/customize/connectors i w /mcp (nazw nie ma na dysku)'))
    Q('  inne serwery z transkryptów (konektory claude.ai, wbudowane w aplikację, inne projekty): %d — najczęstsze: %s' % (
        len(inne), ', '.join('%s %d×' % (k, e['n']) for k, e in inne[:8])))
    if not wyl_kon:
        rek.append('konektory claude.ai ładują się do każdej sesji → w projektach kodu "disableClaudeAiConnectors": true w .claude/settings.json '
                   '(sprawdź w /mcp, że zniknęły — aplikacja desktop rejestruje je inaczej niż terminal) albo wyłącz nieużywane na claude.ai/customize/connectors')
    return rek, cj


def sekcja_skille(Q, projekt, ust, plug, lic, ctx):
    Q('=== 3. SKILLE widoczne w tym projekcie (per źródło) ===')
    zr = collections.OrderedDict()
    us = os.path.join(CL, 'skills')
    zr['user'] = sorted(d for d in os.listdir(us) if not d.startswith('.') and d != 'synced') if os.path.isdir(us) else []
    if ust['user'].get('syncClaudeAiSkills') is not False:
        for d in synced('skills')[0]: zr['claude.ai (aktywne konto)'] = sorted(x for x in os.listdir(d) if os.path.isdir(os.path.join(d, x)))
    ps = os.path.join(projekt, '.claude', 'skills')
    zr['project'] = sorted(d for d in os.listdir(ps) if os.path.isdir(os.path.join(ps, d))) if os.path.isdir(ps) else []
    zr.update(('plugin ' + pid, p['zawartosc']['skille']) for pid, p in plug.items() if p['efektywnie'] and p['zawartosc'].get('skille'))
    over = {}
    for poz in ('project', 'local'): over.update(ust[poz].get('skillOverrides') or {})
    razem = 0
    for nazwa, lst in zr.items():
        pref = nazwa.split(' ')[-1].split('@')[0]
        uz = sum(1 for s in lst if ('skill', s) in lic or ('skill', '%s:%s' % (pref, s)) in lic)
        razem += len(lst)
        Q('  %-44s %3d (użyte w %d dni: %3d) %s' % (nazwa, len(lst), ctx['dni'], uz, ', '.join(lst[:10]) + (' …' if len(lst) > 10 else '')))
    ag_pl = sum(len(p['zawartosc'].get('agenci') or []) for p in plug.values() if p['efektywnie'])
    Q('  RAZEM ~%d skilli na liście modelu w KAŻDEJ sesji (bez wbudowanych); skillOverrides: %s' % (razem, over or 'brak'))
    Q('  agenci: user %d, project %d, z pluginów %d' % (len(glob.glob(os.path.join(CL, 'agents', '*'))),
                                                       len(glob.glob(os.path.join(projekt, '.claude', 'agents', '*'))), ag_pl))
    nieakt = synced('skills')[1] + synced('plugins')[1]
    if nieakt: Q('  katalogi synchronizacji innych kont (nie ładują się): %d' % len(nieakt))


def sekcja_hooki(Q, ust, plug):
    Q('=== 4. HOOKI (zdarzenia) per poziom — każdy odpala w każdej sesji tego projektu ===')
    for poz in ('user', 'project', 'local'): Q('  %-44s %s' % (poz, ', '.join((ust[poz].get('hooks') or {}).keys()) or '-'))
    for pid, p in plug.items():
        if p['efektywnie'] and p['zawartosc'].get('hooki'): Q('  %-44s %s' % ('plugin ' + pid, ', '.join(p['zawartosc']['hooki'])))


def koszt_always_on(pid):
    try:
        r = subprocess.run(['claude', 'plugin', 'details', pid], capture_output=True, text=True, timeout=90, cwd='/tmp')
        m = re.search(r'Always-on:\s+~?([\d,]+)\s*tok', r.stdout)
        return int(m.group(1).replace(',', '')) if m else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def main():
    arg = sys.argv[1:]
    dni = int(arg[arg.index('--dni') + 1]) if '--dni' in arg else 30
    poz = [a for i, a in enumerate(arg) if not a.startswith('--') and (i == 0 or arg[i - 1] != '--dni')]
    projekt = os.path.abspath(poz[0] if poz else os.getcwd())
    ust = ustawienia(projekt); plug = pluginy(ust); lic = uzycie(dni)
    ctx = dict(dni=dni, moj=slug(projekt), koszt='--koszt' in arg, statusline=json.dumps(ust['user'].get('statusLine') or {}))
    L = []; Q = L.append
    Q('INWENTARZ KONTA CLAUDE CODE — projekt %s (użycie: ostatnie %d dni, z transkryptów)' % (projekt, dni))
    Q('Poziomy: user = ~/.claude/settings.json, ~/.claude.json, ~/.claude/skills | project = .claude/settings.json, .mcp.json, .claude/skills'
      ' | local = .claude/settings.local.json, ~/.claude.json projects[ścieżka] | plugin | claude.ai (aktywne konto)')
    Q('')
    rek = sekcja_pluginy(Q, plug, lic, ctx); Q('')
    r2, cj = sekcja_mcp(Q, projekt, ust, plug, lic, ctx); rek += r2; Q('')
    sekcja_skille(Q, projekt, ust, plug, lic, ctx); Q('')
    sekcja_hooki(Q, ust, plug); Q('')
    pr = cj.get('projects') or {}
    Q('=== 5. ~/.claude.json: wpisów projektów %d, dla nieistniejących katalogów %d (szum, nie koszt) ===' % (
        len(pr), sum(1 for k in pr if not os.path.isdir(k))))
    Q('')
    Q('=== 6. REKOMENDACJE (komendy uruchamiasz Ty — skrypt niczego nie zmienia) ===')
    L += ['  %2d. %s' % (i, r) for i, r in enumerate(rek, 1)] or ['  brak']
    print('\n'.join(L))


if __name__ == '__main__':
    main()
