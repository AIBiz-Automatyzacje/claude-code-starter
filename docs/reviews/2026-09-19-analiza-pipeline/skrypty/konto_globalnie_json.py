#!/usr/bin/env python3
"""Widok globalny konta jako JSON dla strony decyzji kroku 0 (wywołanie: konto_inwentarz.py --globalnie --json [--dni 30]).
Te same dane co raport tekstowy (konto_globalnie.py), ułożone w 8 kategorii kroku 0: każdy element = poziom dziś, koszt, co wnosi,
użycie 30 dni (projekty), dłuższa historia. Tylko odczyt, same nazwy."""
import glob, json, os, time

from konto_globalnie import zbierz
from konto_globalnie_dane import (agenci_katalogu, dzien, hooki_ustawien, nazwa_projektu, opis_frontmatter, pluginy_desktop, rozszerzenia_desktop,
                                  skille_katalogu)
from konto_globalnie_mapa import opis_wpisu
from konto_globalnie_start import najnowszy_transkrypt, pomiar_startu
from konto_opisy_hookow import HOOKI_OPIS
from konto_wspolne import CL, HOME, synced, uzycie_pluginu, wczytaj

# Nazwy konektorów claude.ai w aplikacji desktop (serwer = UUID). Aplikacja podała je sesji 2026-09-28; na dysku ich nie ma.
KONEKTORY_UUID = {'0bdbe947-1a7c-4a07-8233-69ed2f83595b': 'Cookieyes', '1a59c906-04da-521d-bda7-7f71b9f9e01c': 'Claude Docs',
                  '3ceab4b4-dd51-493f-b73d-074003daba3e': 'Mobbin', '674cb8d5-a580-45d5-a4d0-73f063b56e10': 'Replicate',
                  '6f616b42-0ed8-571e-823f-ee4aca6b7ce9': 'visualize', 'b6b5896d-74ec-4070-8770-ba5c806622f9': 'Traferto',
                  'e87cf519-3e1d-4304-a628-5c99a88ddeeb': 'Supabase'}
TOP_PROJEKTOW = 8
OPIS_ZN = 420   # opis z frontmattera / plugin.json przycięty do tylu znaków


def przytnij(t):
    t = ' '.join((t or '').split())
    return t if len(t) <= OPIS_ZN else t[:OPIS_ZN].rsplit(' ', 1)[0] + ' …'


def opis_pluginu(D, pid):
    kat = next((w['installPath'] for w in D['inst'].get(pid) or [] if os.path.isdir(w.get('installPath') or '')), None)
    if pid.endswith('@synced') and synced('plugins')[0]:
        kat = next(iter(glob.glob(os.path.join(synced('plugins')[0][0], pid.split('@')[0] + '*/'))), None)
    return przytnij(((wczytaj(os.path.join(kat, '.claude-plugin', 'plugin.json'), {}) or {}) if kat else {}).get('description'))


def uz30(e, D):
    if not e or not e.get('n'): return None
    return dict(n=e['n'], ost=e['ostatnio'], proj=[[nazwa_projektu(s, D['nazwy']), n] for s, n in e['per'].most_common(TOP_PROJEKTOW)],
                lproj=len(e['per']))


def dluzej(D, komendy=(), licznik=None, etykieta='licznik Claude Code'):
    wyn = []
    e = [D['hist'][k] for k in komendy if k in D['hist']]
    if e:
        wyn.append('historia komend: %d× w %d proj., ostatnio %s' % (sum(x['n'] for x in e), len(set().union(*(x['projekty'] for x in e))),
                                                                   dzien(max(x['ost'] for x in e))))
    if licznik: wyn.append('%s: %d×, ostatnio %s' % (etykieta, licznik['usageCount'], dzien(licznik.get('lastUsedAt'))))
    return wyn


def wnosi(z):
    cz = ['%d skilli' % len(z['skille'])] if z.get('skille') else []
    if z.get('agenci'): cz.append('%d agent(ów)' % len(z['agenci']))
    if z.get('mcp'): cz.append('MCP: ' + ', '.join(z['mcp']))
    if z.get('hooki'): cz.append('hooki: ' + ', '.join(z['hooki']))
    return '; '.join(cz) or 'nic poza opisem'


def projekty_z_pluginem(D, pid):
    return ['%s (%s %s)' % (x['sciezka'].replace(HOME, '~'), poz, 'on' if v else 'OFF') for x in D['proj'] if x['wpis'] and not x['kopia']
            for poz in ('project', 'local') for k, v in x['wpis']['pluginy'][poz].items() if k == pid]


def element_pluginu(D, pid, p, kat, poziom):
    z = p['zawartosc']; nazwa = pid.split('@')[0]
    kom = [k for k in D['hist'] if k.startswith(nazwa + ':')] + [s for s in z.get('skille') or [] if s in D['hist']]
    uw = []
    if nazwa in D['statusline']: uw.append('statusLine uruchamia npx @owloops/claude-powerline — nie zależy od pluginu')
    if z.get('hooki'): uw.append('hooki odpalają przy każdym zdarzeniu; licznik Claude Code wlicza te odpalenia')
    if pid.startswith('hookify@'): uw.append('brak reguł hookify w projektach — hooki nic nie robią')
    wlaczony = projekty_z_pluginem(D, pid)
    if wlaczony: uw.append('ustawiony w %d proj.: %s' % (len(wlaczony), ', '.join(wlaczony[:6]) + (' …' if len(wlaczony) > 6 else '')))
    return dict(id='plugin:' + pid, kat=kat, nazwa=pid, poziom=poziom, tok=D['koszt'].get(pid), wnosi=wnosi(z), opis=opis_pluginu(D, pid),
                uz30=uz30(uzycie_pluginu(pid, z, D['lic']), D), dluzej=dluzej(D, kom, D['cj'].get('pluginUsage', {}).get(pid)), uwagi=uw)


def kat_pluginy(D):
    wyn = []
    for pid, p in sorted(D['plug'].items()):
        if p['zrodlo'] == 'marketplace' and p['stan']['user'] is not None:
            wyn.append(element_pluginu(D, pid, p, 1, 'user: ' + ('włączony' if p['stan']['user'] else 'wyłączony')))
    inline = pluginy_desktop()
    for pid, p in sorted(D['plug'].items()):
        if p['zrodlo'] != 'claude.ai': continue
        e = element_pluginu(D, pid, p, 2, 'konto claude.ai (każdy projekt)')
        il = pid.split('@')[0] + '@inline'
        if il in inline:
            e['uwagi'].append('w aplikacji desktop ten sam plugin jako %s (z konta claude.ai)' % il)
            e['dluzej'] += dluzej(D, (), D['cj'].get('pluginUsage', {}).get(il), 'licznik %s' % il)
        wyn.append(e)
    return wyn


def kat_mcp(D, narz):
    wyl = {}
    for p, v in (D['cj'].get('projects') or {}).items():
        for n in v.get('disabledMcpServers') or []: wyl.setdefault(n, set()).add(p.lower())
    wyn = [dict(id='mcp:' + n, kat=3, nazwa=n, poziom='user (~/.claude.json)', tok=None, wnosi='%s narzędzi na starcie' % narz.get(n, '?'),
                uz30=uz30(D['lic'].get(('mcp', n)), D), dluzej=[], uwagi=['wyłączony w /mcp w %d proj.' % len(wyl[n])] if wyl.get(n) else [])
           for n in sorted(D['cj'].get('mcpServers') or {})]
    wyn += [dict(id='ext:' + r, kat=3, nazwa=r.split('.')[-1], poziom='rozszerzenie aplikacji desktop', tok=None,
                 wnosi='%s narzędzi na starcie' % narz.get('Airtable_MCP_Server', '?') if 'airtable' in r else '', uz30=uz30(
                     D['lic'].get(('mcp', 'Airtable_MCP_Server')), D) if 'airtable' in r else None, dluzej=[],
                 uwagi=['działa tylko w aplikacji desktop; zmiana w Ustawienia → Rozszerzenia aplikacji Claude']) for r in rozszerzenia_desktop()]
    return wyn


def kat_skille_agenci(D):
    wyn = []
    for zr, kat_dir in [('user (~/.claude/skills)', os.path.join(CL, 'skills'))] + [('konto claude.ai', k) for k in synced('skills')[0]]:
        for s, t in sorted(skille_katalogu(kat_dir).items()):
            e = D['lic'].get(('skill', s)) or D['lic'].get(('skill', 'anthropic-skills:' + s))
            wyn.append(dict(id='skill:%s:%s' % ('ai' if 'claude.ai' in zr else 'user', s), kat=4, nazwa=s, poziom=zr, tok=t, szac=True,
                            wnosi='skill', opis=przytnij(opis_frontmatter(os.path.join(kat_dir, s, 'SKILL.md'))), uz30=uz30(e, D), dluzej=dluzej(D, [s], D['cj'].get('skillUsage', {}).get(s)), uwagi=[]))
    for a, t in sorted(agenci_katalogu(os.path.join(CL, 'agents')).items()):
        wyn.append(dict(id='agent:' + a, kat=5, nazwa=a, poziom='user (~/.claude/agents)', tok=t, szac=True, wnosi='agent',
                        opis=przytnij(opis_frontmatter(os.path.join(CL, 'agents', a + '.md'))),
                        uz30=uz30(D['lic'].get(('agent', a)), D), dluzej=[], uwagi=[]))
    return wyn


def kat_hooki(D):
    wyn = []
    for zd, et in hooki_ustawien(D['ust']['user']).items():
        for h in et:
            wyn.append(dict(id='hook:%s:%s' % (zd, h), kat=6, nazwa='%s → %s' % (zd, h), poziom='user (~/.claude/settings.json)', tok=None,
                            wnosi='hook', opis=HOOKI_OPIS.get(h, ''), uz30=None, dluzej=[], uwagi=['odpala w każdej sesji każdego projektu; w transkryptach brak śladu']))
    for pid, p in sorted(D['plug'].items()):
        if p['efektywnie'] and (p['stan']['user'] or p['zrodlo'] == 'claude.ai') and p['zawartosc'].get('hooki'):
            wyn.append(dict(id='hookplug:' + pid, kat=6, nazwa='%s (plugin %s)' % (', '.join(p['zawartosc']['hooki']), pid), poziom='plugin',
                            tok=None, wnosi='hooki pluginu', opis=HOOKI_OPIS.get(pid, ''), uz30=None, dluzej=[], info=True,
                            uwagi=['znika razem z pluginem — decyzja w kategorii pluginów']))
    return wyn


def kat_konektory(D):
    wyn = {}
    for n in D['cj'].get('claudeAiMcpEverConnected') or []:
        k = n.replace('claude.ai ', ''); wyn[k] = dict(nazwa=k, uz=None, zrodla={'kiedykolwiek połączony'})
    for (t, n), e in D['lic'].items():
        if t != 'mcp': continue
        k = n[len('claude_ai_'):].replace('_', ' ') if n.startswith('claude_ai_') else KONEKTORY_UUID.get(n)
        if not k and len(n) == 36 and n.count('-') == 4: k = 'nieznany (%s…) — narzędzia: %s' % (n[:8], ', '.join(x for x, _ in e['narzedzia'].most_common(3)))
        if not k: continue
        w = wyn.setdefault(k, dict(nazwa=k, uz=None, zrodla=set()))
        w['zrodla'].add('terminal' if n.startswith('claude_ai_') else 'aplikacja desktop')
        if not w['uz'] or e['n'] > w['uz']['n']: w['uz'] = e
    for k in KONEKTORY_UUID.values(): wyn.setdefault(k, dict(nazwa=k, uz=None, zrodla=set()))['zrodla'].add('podłączony w tej sesji')
    return [dict(id='konektor:' + k, kat=7, nazwa=k, poziom='konto claude.ai (każdy projekt)', tok=None, wnosi='konektor',
                 uz30=uz30(w['uz'], D), dluzej=[], uwagi=[', '.join(sorted(w['zrodla']))]) for k, w in sorted(wyn.items())]


def kat_projekty(D):
    wyn = []
    for x in sorted(D['proj'], key=lambda x: x['ostatnio'], reverse=True):
        if not x['istnieje'] or x['kopia']: continue
        cz = opis_wpisu(x['wpis'])
        if not cz: continue
        wyn.append(dict(id='projekt:' + x['sciezka'].lower(), kat=8, nazwa=x['sciezka'].replace(HOME, '~'), poziom='ostatnio ' + (x['ostatnio'] or '-'),
                        tok=None, wnosi='; '.join(cz), uz30={'n': x['uzycia_30d'], 'ost': '', 'proj': [], 'lproj': 0} if x['uzycia_30d'] else None,
                        dluzej=[], uwagi=(['wpis zapisany 2× (wielkość liter)'] if x['warianty'] > 1 else []) +
                        (['UWAGA: .claude/ tego katalogu = konto (~/.claude)'] if x['sciezka'] == HOME else [])))
    kopie = [x for x in D['proj'] if x['istnieje'] and x['kopia']]; brak = [x for x in D['proj'] if not x['istnieje']]
    puste = [x for x in D['proj'] if x['istnieje'] and not x['kopia'] and not opis_wpisu(x['wpis'])]
    for ident, nazwa, lst in (('grupa:kopie', 'Kopie testowe i tymczasowe (~/test-review/kopie, /private/tmp)', kopie),
                              ('grupa:brak', 'Wpisy katalogów, których już nie ma', brak), ('grupa:puste', 'Projekty bez własnej konfiguracji', puste)):
        wyn.append(dict(id=ident, kat=8, nazwa='%s: %d' % (nazwa, len(lst)), poziom='grupa', tok=None, uz30=None, dluzej=[], uwagi=[],
                        wnosi=', '.join(x['sciezka'].replace(HOME, '~') for x in lst)))
    return wyn


def main(dni):
    D = zbierz(dni)
    start = pomiar_startu(najnowszy_transkrypt(os.getcwd())) if najnowszy_transkrypt(os.getcwd()) else {}
    narz = dict(start.get('narzedzia') or {})
    el = kat_pluginy(D) + kat_mcp(D, narz) + kat_skille_agenci(D) + kat_hooki(D) + kat_konektory(D) + kat_projekty(D)
    zawsze = sum(e['tok'] or 0 for e in el if e['kat'] in (1, 2, 4, 5) and not e['poziom'].endswith('wyłączony'))
    print(json.dumps(dict(
        wygenerowano=time.strftime('%Y-%m-%d %H:%M'), dni=dni, historia_od=dzien(D['pierwszy']), always_on=zawsze,
        start=dict(skille=start.get('skille'), skille_zn=start.get('skille_zn'), bez_opisu={k: v for k, v in (start.get('bez_opisu') or {}).items()},
                   narzedzia_mcp=sum(v for k, v in narz.items() if k != '(wbudowane)'), serwery_mcp=len([k for k in narz if k != '(wbudowane)']),
                   instrukcje_zn=sum((start.get('instrukcje') or {}).values())),
        projekty=sorted({x['sciezka'].replace(HOME, '~') for x in D['proj'] if x['istnieje'] and not x['kopia']}),
        elementy=el), ensure_ascii=False, indent=1))
