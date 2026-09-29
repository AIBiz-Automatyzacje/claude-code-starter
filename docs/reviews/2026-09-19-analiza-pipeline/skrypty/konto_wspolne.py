#!/usr/bin/env python3
"""Wspólne odczyty konta Claude Code dla konto_inwentarz.py (widok projektu) i konto_globalnie.py (widok całego komputera).
Tylko odczyt; zwraca NAZWY, nigdy wartości konfiguracji (w MCP i env bywają klucze)."""
import collections, glob, json, os, re, subprocess, time

HOME = os.path.expanduser('~')
CL = os.path.join(HOME, '.claude')


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


def zawartosc_pluginu(sciezka):
    """Co plugin wnosi: skille, agenci, komendy, serwery MCP, zdarzenia hooków (z plików na dysku)."""
    if not sciezka or not os.path.isdir(sciezka): return {}
    sk = sorted(os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(sciezka, 'skills', '*', 'SKILL.md')))
    ag = sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(sciezka, 'agents', '*.md')))
    mcp = list(((wczytaj(os.path.join(sciezka, '.mcp.json'), {}) or {}).get('mcpServers') or {}).keys())
    man = wczytaj(os.path.join(sciezka, '.claude-plugin', 'plugin.json'), {}) or {}
    if isinstance(man.get('mcpServers'), dict): mcp += list(man['mcpServers'].keys())
    if isinstance(man.get('mcpServers'), str):   # manifest może wskazywać plik (np. supabase: ./agents/claude/.mcp.json)
        mcp += list(((wczytaj(os.path.join(sciezka, man['mcpServers']), {}) or {}).get('mcpServers') or {}).keys())
    hk = list(((wczytaj(os.path.join(sciezka, 'hooks', 'hooks.json'), {}) or {}).get('hooks') or {}).keys())
    return dict(skille=sk, agenci=ag, komendy=len(glob.glob(os.path.join(sciezka, 'commands', '*'))), mcp=sorted(set(mcp)), hooki=hk)


def ustawienia(projekt):
    return {poz: wczytaj(p, {}) or {} for poz, p in (('user', os.path.join(CL, 'settings.json')),
                                                     ('project', os.path.join(projekt, '.claude', 'settings.json')),
                                                     ('local', os.path.join(projekt, '.claude', 'settings.local.json')))}


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
    """Liczniki z transkryptów: mcp serwer, skill (Skill + /komenda operatora), agent — liczba, projekty (slug → liczba),
    ostatnia data; dla MCP także najczęstsze narzędzia (rozpoznanie serwerów nazwanych UUID)."""
    granica = time.time() - dni * 86400
    lic = collections.defaultdict(lambda: dict(n=0, projekty=set(), per=collections.Counter(), ostatnio='',
                                               narzedzia=collections.Counter()))
    for plik in glob.iglob(os.path.join(CL, 'projects', '*', '**', '*.jsonl'), recursive=True):
        try:
            if os.path.getmtime(plik) < granica: continue
            proj = os.path.relpath(plik, os.path.join(CL, 'projects')).split(os.sep)[0]
            glowna = os.sep + 'subagents' + os.sep not in plik
            with open(plik, encoding='utf-8', errors='replace') as f:
                for linia in f:
                    if '"tool_use"' not in linia and not (glowna and '<command-name>' in linia): continue
                    for k, ts, narz in klucze_linii(linia, glowna):
                        e = lic[k]; e['n'] += 1; e['projekty'].add(proj); e['per'][proj] += 1
                        e['ostatnio'] = max(e['ostatnio'], ts)
                        if narz: e['narzedzia'][narz] += 1
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
        if n.startswith('mcp__'): wyn.append((('mcp', n.split('__')[1]), ts, n.split('__', 2)[-1]))
        elif n == 'Skill' and inp.get('skill'): wyn.append((('skill', inp['skill']), ts, None))
        elif n in ('Agent', 'Task') and inp.get('subagent_type'): wyn.append((('agent', inp['subagent_type']), ts, None))
    if glowna and w.get('type') == 'user':
        wyn += [(('skill', m.lstrip('/')), ts, None) for m in re.findall(r'<command-name>([^<]+)</command-name>', linia)]
    return wyn


def uzycie_pluginu(pid, z, lic):
    nazwa = pid.split('@')[0]; wyn = dict(n=0, projekty=set(), per=collections.Counter(), ostatnio='')
    for (typ, k), e in lic.items():
        if (typ in ('skill', 'agent') and k.startswith(nazwa + ':')) or (typ == 'mcp' and k.startswith('plugin_%s_' % nazwa)) \
                or (typ == 'skill' and k in (z.get('skille') or [])):
            wyn['n'] += e['n']; wyn['projekty'] |= e['projekty']; wyn['per'].update(e['per'])
            wyn['ostatnio'] = max(wyn['ostatnio'], e['ostatnio'])
    return wyn


def koszt_always_on(pid):
    try:
        r = subprocess.run(['claude', 'plugin', 'details', pid], capture_output=True, text=True, timeout=90, cwd='/tmp')
        m = re.search(r'Always-on:\s+~?([\d,]+)\s*tok', r.stdout)
        return int(m.group(1).replace(',', '')) if m else None
    except (OSError, subprocess.TimeoutExpired):
        return None
