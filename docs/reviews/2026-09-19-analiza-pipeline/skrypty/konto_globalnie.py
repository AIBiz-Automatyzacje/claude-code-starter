#!/usr/bin/env python3
"""Widok GLOBALNY konta Claude Code (wywołanie: konto_inwentarz.py --globalnie [--dni 30]): wszystko, co ładuje się na poziomie user
i z konta claude.ai (każda sesja w każdym projekcie), mapa wszystkich projektów (co włączają / wyłączają na poziomie project/local),
użycie każdego elementu w całym komputerze i koszt always-on. Tylko odczyt, same nazwy. Użycie z trzech źródeł, bo 0 w 30 dniach ≠ nigdy:
transkrypty N dni (wywołania narzędzi), ~/.claude/history.jsonl (/komendy operatora od początku pliku), liczniki ~/.claude.json
(`skillUsage`, `pluginUsage` — ten drugi wlicza odpalenia hooków, więc duża liczba przy pluginie z hookami ≠ świadome użycie)."""
import os, time

from konto_globalnie_dane import (agenci_katalogu, dzien, historia, hooki_ustawien, nazwa_projektu, nazwy_slugow, pluginy_desktop,
                                  projekty, rozszerzenia_desktop, skille_katalogu)
from konto_globalnie_mapa import sekcja_konektory, sekcja_projekty
from konto_globalnie_start import sekcja_start
from konto_wspolne import CL, HOME, koszt_always_on, pluginy, synced, ustawienia, uzycie, uzycie_pluginu, wczytaj


def fmt_30(e, nazwy):
    if not e or not e['n']: return '0'
    top = ', '.join('%s %d' % (nazwa_projektu(s, nazwy), n) for s, n in e['per'].most_common(3))
    return '%d× w %d proj. (%s), ost. %s' % (e['n'], len(e['per']), top, e['ostatnio'])


def fmt_hist(nazwy_komend, hist):
    e = [hist[k] for k in nazwy_komend if k in hist]
    if not e: return ''
    return ' | historia /kom.: %d× (w oknie %d), %d proj., ost. %s' % (
        sum(x['n'] for x in e), sum(x['n_okno'] for x in e), len(set().union(*(x['projekty'] for x in e))), dzien(max(x['ost'] for x in e)))


def fmt_licznik(wpis, etykieta='licznik'):
    return ' | %s %d×, ost. %s' % (etykieta, wpis['usageCount'], dzien(wpis.get('lastUsedAt'))) if wpis else ''


def sekcja_pluginy_user(Q, D):
    Q('=== 1a. PLUGINY poziomu user (~/.claude/settings.json enabledPlugins) — ładują się w KAŻDYM projekcie, który ich nie wyłącza ===')
    for pid, p in sorted(D['plug'].items()):
        if p['zrodlo'] != 'marketplace' or p['stan']['user'] is None: continue
        wiersz_pluginu(Q, D, pid, p['zawartosc'], 'ON ' if p['stan']['user'] else 'off')


def wiersz_pluginu(Q, D, pid, z, stan):
    nazwa = pid.split('@')[0]; u = uzycie_pluginu(pid, z, D['lic'])
    kom = [k for k in D['hist'] if k.startswith(nazwa + ':')] + [s for s in z.get('skille') or [] if s in D['hist']]
    koszt = D['koszt'].get(pid)
    if stan.strip() == 'ON' and koszt is not None: D['suma'].append((koszt, pid))
    Q('  %s %-44s | always-on %s | skille %d, agenci %d, MCP %s, hooki %s' % (
        stan, pid, '~%d tok' % koszt if koszt is not None else '?', len(z.get('skille') or []), len(z.get('agenci') or []),
        ','.join(z.get('mcp') or []) or '-', ','.join(z.get('hooki') or []) or '-'))
    Q('       użycie %d dni: %s%s%s%s' % (D['dni'], fmt_30(u, D['nazwy']), fmt_hist(kom, D['hist']),
                                         fmt_licznik(D['cj'].get('pluginUsage', {}).get(pid), 'licznik CC'),
                                         ' | statusLine' if nazwa in D['statusline'] else ''))


def sekcja_pluginy_claudeai(Q, D):
    Q('=== 1b. PLUGINY z konta claude.ai (aktywne konto; CLI: @synced, aplikacja desktop: @inline) — w KAŻDYM projekcie ===')
    inline = pluginy_desktop()
    for pid, p in sorted(D['plug'].items()):
        if p['zrodlo'] != 'claude.ai': continue
        nazwa = pid.split('@')[0]
        wiersz_pluginu(Q, D, pid, p['zawartosc'], 'ON ' if p['efektywnie'] else 'off')
        if nazwa + '@inline' in inline:
            Q('       + w aplikacji desktop jako %s@inline%s' % (nazwa, fmt_licznik(D['cj'].get('pluginUsage', {}).get(nazwa + '@inline'), 'licznik CC')))
    for pid in sorted(set(inline) - {k.split('@')[0] + '@inline' for k in D['plug']}):
        Q('  ON  %-44s | tylko w aplikacji desktop (brak kopii @synced)' % pid)
    nieakt = synced('plugins')[1] + synced('skills')[1]
    Q('  katalogi synchronizacji innych kont (nie ładują się): %d' % len(nieakt))


def sekcja_mcp_user(Q, D):
    Q('=== 1c. SERWERY MCP poziomu user (~/.claude.json mcpServers) + z pluginów user + rozszerzenia aplikacji desktop ===')
    wyl = {}
    for p, v in (D['cj'].get('projects') or {}).items():
        for n in v.get('disabledMcpServers') or []: wyl.setdefault(n, set()).add(p.lower())
    for n in sorted(D['cj'].get('mcpServers') or {}):
        Q('  %-22s user           | wyłączony w /mcp w %d proj. | użycie %d dni: %s' % (
            n, len(wyl.get(n, ())), D['dni'], fmt_30(D['lic'].get(('mcp', n)), D['nazwy'])))
    for pid, p in sorted(D['plug'].items()):
        if not (p['stan']['user'] or p['zrodlo'] == 'claude.ai') or not p['efektywnie']: continue
        for n in p['zawartosc'].get('mcp') or []:
            k = ('mcp', 'plugin_%s_%s' % (pid.split('@')[0], n.replace(' ', '_')))
            Q('  %-22s plugin %-30s | użycie %d dni: %s' % (n, pid, D['dni'], fmt_30(D['lic'].get(k), D['nazwy'])))
    for r in rozszerzenia_desktop(): Q('  %-22s rozszerzenie aplikacji desktop (%s)' % (r.split('.')[-1], r))


def sekcja_skille_user(Q, D, tytul, skille):
    tok = sum(skille.values())
    Q('=== %s: %d skilli, ~%d tok always-on (szacunek z opisu; lista skilli w każdej sesji) ===' % (tytul, len(skille), tok))
    for s, t in sorted(skille.items(), key=lambda x: -x[1]):
        e = D['lic'].get(('skill', s)) or D['lic'].get(('skill', 'anthropic-skills:' + s))
        Q('  %-30s ~%4d tok | użycie %d dni: %s%s%s' % (s, t, D['dni'], fmt_30(e, D['nazwy']), fmt_hist([s], D['hist']),
                                                     fmt_licznik(D['cj'].get('skillUsage', {}).get(s))))
    return tok


def sekcja_agenci_user(Q, D):
    ag = agenci_katalogu(os.path.join(CL, 'agents')); tok = sum(ag.values())
    Q('=== 1f. AGENCI poziomu user (~/.claude/agents): %d, ~%d tok always-on (opis w narzędziu Agent każdej sesji) ===' % (len(ag), tok))
    for a, t in sorted(ag.items(), key=lambda x: -x[1]):
        Q('  %-30s ~%4d tok | użycie %d dni: %s' % (a, t, D['dni'], fmt_30(D['lic'].get(('agent', a)), D['nazwy'])))
    return tok


def sekcja_hooki_user(Q, D):
    Q('=== 1g. HOOKI poziomu user — odpalają w KAŻDEJ sesji każdego projektu (brak śladu w transkryptach) ===')
    for zd, et in hooki_ustawien(D['ust']['user']).items(): Q('  %-18s ~/.claude/settings.json: %s' % (zd, ', '.join(et)))
    for pid, p in sorted(D['plug'].items()):
        if p['efektywnie'] and (p['stan']['user'] or p['zrodlo'] == 'claude.ai') and p['zawartosc'].get('hooki'):
            Q('  %-18s plugin %s' % (','.join(p['zawartosc']['hooki']), pid))
    sl = D['ust']['user'].get('statusLine') or {}
    Q('  statusLine: %s' % (' '.join((sl.get('command') or '').split()[:3]) or '-'))
    cm = os.path.join(CL, 'CLAUDE.md')
    Q('  ~/.claude/CLAUDE.md: %d zn | ~/.claude/rules: %d plików | output-styles: %s' % (
        len(open(cm, encoding='utf-8').read()) if os.path.isfile(cm) else 0, len(os.listdir(os.path.join(CL, 'rules'))) if os.path.isdir(os.path.join(CL, 'rules')) else 0,
        ', '.join(sorted(os.listdir(os.path.join(CL, 'output-styles')))) if os.path.isdir(os.path.join(CL, 'output-styles')) else '-'))


def zbierz(dni):
    ust = dict(ustawienia(HOME), project={}, local={})   # tylko poziom user; project/local są w mapie projektów
    plug = pluginy(ust); lic = uzycie(dni)
    cj = wczytaj(os.path.join(HOME, '.claude.json'), {}) or {}
    hist, pierwszy, hist_proj = historia(dni)
    inst = (wczytaj(os.path.join(CL, 'plugins', 'installed_plugins.json'), {}) or {}).get('plugins') or {}
    proj = projekty(cj, inst, hist_proj, lic)
    koszt = {pid: koszt_always_on(pid) for pid, p in plug.items() if p['stan']['user'] is not None or p['zrodlo'] == 'claude.ai' or p['efektywnie']
             or any(pid in (x['wpis'] or {}).get('pluginy', {}).get(poz, {}) for x in proj for poz in ('project', 'local'))}
    return dict(dni=dni, ust=ust, plug=plug, lic=lic, cj=cj, hist=hist, pierwszy=pierwszy, inst=inst, proj=proj, koszt=koszt, suma=[],
                nazwy=nazwy_slugow(proj, hist_proj), statusline=str(ust['user'].get('statusLine') or {}))


def skrot(Q, D, tok_sk_user, tok_sk_ai, tok_ag):
    Q('=== 0. SKRÓT: co ładuje się do KAŻDEJ sesji w KAŻDYM projekcie (always-on; bez schematów narzędzi MCP) ===')
    poz = sorted(D['suma'], reverse=True) + [(tok_sk_user, 'skille user (szac.)'), (tok_sk_ai, 'skille claude.ai (szac.)'),
                                              (tok_ag, 'agenci user (szac.)')]
    razem = sum(k for k, _ in poz)
    for k, n in sorted(poz, reverse=True): Q('  ~%6d tok  %5.1f%%  %s' % (k, 100.0 * k / razem if razem else 0, n))
    Q('  ~%6d tok  RAZEM na sesję (pluginy: `claude plugin details`; skille/agenci: opis ÷ %s)' % (razem, '1,8 zn/tok PL, 2,85 EN'))


def main(dni):
    D = zbierz(dni); L = []; Q = L.append; T = []; W = T.append
    sekcja_pluginy_user(W, D); W('')
    sekcja_pluginy_claudeai(W, D); W('')
    sekcja_mcp_user(W, D); W('')
    tu = sekcja_skille_user(W, D, '1d. SKILLE poziomu user (~/.claude/skills)', skille_katalogu(os.path.join(CL, 'skills'))); W('')
    ta = sum(sekcja_skille_user(W, D, '1e. SKILLE z konta claude.ai (aktywne konto)', skille_katalogu(k)) for k in synced('skills')[0]); W('')
    tg = sekcja_agenci_user(W, D); W('')
    sekcja_hooki_user(W, D); W('')
    sekcja_konektory(W, D); W('')
    sekcja_projekty(W, D); W('')
    sekcja_start(W, os.getcwd())
    Q('INWENTARZ GLOBALNY KONTA CLAUDE CODE — %s | użycie: transkrypty %d dni + history.jsonl od %s + liczniki ~/.claude.json' % (
        time.strftime('%Y-%m-%d %H:%M'), dni, dzien(D['pierwszy'])))
    Q('Tylko odczyt, same nazwy. Poziomy: pluginy local > project > user; MCP local > project > user > plugin > claude.ai; skille user + project'
      ' + plugin + claude.ai. Użycie „0” = brak w transkryptach okna; historia i liczniki pokazują dłuższy okres.')
    Q('')
    skrot(Q, D, tu, ta, tg); Q('')
    print('\n'.join(L + T))
