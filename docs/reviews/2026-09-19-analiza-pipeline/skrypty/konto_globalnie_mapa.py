#!/usr/bin/env python3
"""Sekcje widoku globalnego: konektory claude.ai / serwery spoza plików konta oraz mapa wszystkich projektów (project/local)."""
import re

from konto_wspolne import HOME

UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
WBUDOWANE = ('Claude_Browser', 'Claude_Preview', 'Claude_Code_iOS_Simulator', 'claude-in-chrome', 'visualize', 'terminal',
             'scheduled-tasks', 'mcp-registry', 'ide', 'ccd_', 'cowork', 'session_info', 'workspace', 'dispatch')


def rodzaj_serwera(n, znane_proj):
    if n.startswith('claude_ai_'): return 'konektor claude.ai (CLI)'
    if UUID.match(n): return 'konektor claude.ai (aplikacja desktop, nazwa = UUID)'
    if n.startswith(WBUDOWANE): return 'wbudowany w aplikację'
    if n in znane_proj: return 'projektowy (%s)' % znane_proj[n]
    return 'inny (rozszerzenie / usunięty / spoza map)'


def sekcja_konektory(Q, D):
    Q('=== 2. KONEKTORY claude.ai i inne serwery z transkryptów %d dni (nazw konektorów nie ma w plikach konta) ===' % D['dni'])
    user = set(D['cj'].get('mcpServers') or {})
    znane = {}
    for x in D['proj']:
        for n in (x['wpis'] or {}).get('mcp_json', []) + (x['wpis'] or {}).get('mcp_local', []):
            znane.setdefault(n, x['sciezka'].replace(HOME, '~').split('/')[-1])
    grupy = {}
    for (t, n), e in D['lic'].items():
        if t != 'mcp' or n in user or n.startswith('plugin_'): continue
        grupy.setdefault(rodzaj_serwera(n, znane), []).append((n, e))
    for rodzaj in sorted(grupy):
        Q('  -- %s: %d' % (rodzaj, len(grupy[rodzaj])))
        for n, e in sorted(grupy[rodzaj], key=lambda x: -x[1]['n']):
            narz = ', '.join(k for k, _ in e['narzedzia'].most_common(3)) if UUID.match(n) else ''
            Q('     %-40s %5d× w %d proj., ost. %s%s' % (n, e['n'], len(e['per']), e['ostatnio'], ' | narzędzia: ' + narz if narz else ''))
    Q('  kiedykolwiek połączone konektory claude.ai (~/.claude.json): %s' % ', '.join(D['cj'].get('claudeAiMcpEverConnected') or []))
    Q('  czekają na autoryzację (mcpNeedsAuthNoticed): %s' % ', '.join(D['cj'].get('mcpNeedsAuthNoticed') or []))


def opis_wpisu(w):
    cz = []
    for poz in ('project', 'local'):
        on = sorted(k for k, v in w['pluginy'][poz].items() if v); off = sorted(k for k, v in w['pluginy'][poz].items() if not v)
        if on: cz.append('%s włącza: %s' % (poz, ', '.join(on)))
        if off: cz.append('%s WYŁĄCZA: %s' % (poz, ', '.join(off)))
    if w['instalacje']: cz.append('installed_plugins: ' + ', '.join(w['instalacje']))
    if w['mcp_json']: cz.append('.mcp.json: ' + ', '.join(w['mcp_json']))
    if w['mcp_local']: cz.append('MCP local: ' + ', '.join(w['mcp_local']))
    if w['mcp_wylaczone']: cz.append('wyłączone MCP: ' + ', '.join(w['mcp_wylaczone']))
    if w['skille'] or w['agenci']: cz.append('własne skille %d, agenci %d' % (w['skille'], w['agenci']))
    cz += ['hooki %s: %s' % (poz, ','.join(z)) for poz, z in w['hooki'].items()]
    if w['overrides']: cz.append('skillOverrides %d' % w['overrides'])
    if w['bez_konektorow']: cz.append('disableClaudeAiConnectors')
    return cz


def sekcja_projekty(Q, D):
    P = D['proj']; ist = [x for x in P if x['istnieje'] and not x['kopia']]
    kopie = [x for x in P if x['istnieje'] and x['kopia']]; brak = [x for x in P if not x['istnieje']]
    Q('=== 3. MAPA PROJEKTÓW (~/.claude.json + installed_plugins.json; ścieżki scalone bez rozróżniania wielkości liter): '
      '%d istniejących, %d kopii testowych/tymczasowych, %d nieistniejących ===' % (len(ist), len(kopie), len(brak)))
    puste = []
    for x in sorted(ist, key=lambda x: x['ostatnio'], reverse=True):
        cz = opis_wpisu(x['wpis'])
        if not cz: puste.append(x); continue
        Q('  %s  [ost. aktywność %s, wywołań narzędzi MCP/Skill/Agent w %d dni: %d%s%s]' % (
            x['sciezka'].replace(HOME, '~'), x['ostatnio'] or '-', D['dni'], x['uzycia_30d'],
            ', %d wpisy (wielkość liter)' % x['warianty'] if x['warianty'] > 1 else '',
            ' — UWAGA: .claude/ tego katalogu = konto (~/.claude), to NIE jest osobny projekt' if x['sciezka'] == HOME else ''))
        for c in cz: Q('      ' + c)
    Q('  -- bez własnej konfiguracji Claude (%d): %s' % (len(puste), ', '.join(
        '%s (%s)' % (x['sciezka'].replace(HOME, '~'), x['ostatnio'] or '-') for x in puste)))
    wk = sorted({c for x in kopie for c in opis_wpisu(x['wpis'])})
    Q('  -- kopie testowe/tymczasowe (%d, np. ~/test-review/kopie): %s' % (len(kopie), '; '.join(wk) or 'bez konfiguracji'))
    Q('  -- nieistniejące katalogi (%d; szum w ~/.claude.json i `claude plugin list`, nie koszt): %s' % (
        len(brak), ', '.join(x['sciezka'].replace(HOME, '~') for x in brak)))
