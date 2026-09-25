#!/usr/bin/env python3
"""Panel decyzyjny, krok 0 (c) — model kosztu roli, fazy i zadania (biblioteka dla panel_koszt_projektu.py; PANEL-PLAN §3).

Jednostki = cennik wzgledny d4r (in 1 / cache write 1,25 / cache read 0,1 / out 5), tokeny haiku i opusa liczone tak samo (konwencja
analizy). W USD token Haiku 4.5 jest 4x tanszy od Opus 5.5 (in $1 vs $4, out $5 vs $20 — skill claude-api, stan 2026-06-24): wynik podaje to zdaniem.

Koszt agenta roli po zmianie kontekstu (metoda d4r, pelna): oszczednosc = Δprefiks x wp + Δwiadomosc x ww, gdzie Δ = start dzis - start
klasy po zmianie (mini-run (e), TOLk), Δprefiks = schematy znikajacych narzedzi (znaki / stawka d4r x mnoznik modelu), wp/ww = wagi d4r
(1. tura 1,25 albo 0,1 gdy prefiks z cache; kolejne 0,1; przepisanie prefiksu 1,25). Praca agenta = koszt po zmianie - start po zmianie x ww.
Rola w projekcie: start klasy x (1,25 + 0,1 x (wywolania x m - 1)) + praca x m x (0,742 przy zmianie opus -> haiku, 1/0,742 odwrotnie)."""
import collections, json, os, statistics

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_RUN = 'wf_e5c34cd8-66c'        # 20.09, cookie-consent, CLAUDE.md 17 810 zn, Opus 5 (PANEL-PLAN §3)
EPOKA = ('2026-09-08', '2026-09-17')  # role nieobecne w REF_RUN — kontrfakt CLAUDE.md do 17 810 zn (d4r)
CLAUDE_REF_ZN = 17810
W_CW, W_CR = 1.25, 0.1
TOK_HAIKU = 0.742                   # ten sam tekst u haiku = 0,742 tokena opusa (przeglad D4)
# start po zmianie per (klasa, model) [tok] — mini-run (e) TOLk (dane/mr-kontekst.txt §1); mechaniczny opus = haiku / 0,759 (MINI-RUN-WYNIK (e));
# tester E2E niezmierzony — przyjety start buildera (plik agenta + skills: + CLAUDE.md, jak builder)
TOLK = {('mechaniczny', 'haiku'): 8797, ('mechaniczny', 'opus'): 8797 / 0.759, ('orkiestracyjny', 'opus'): 25505,
        ('reviewer', 'opus'): 29747, ('sceptyk', 'opus'): 27001, ('naprawiacz', 'opus'): 26011, ('naprawiacz', 'haiku'): 20271,
        ('builder', 'opus'): 38609, ('tester', 'opus'): 38609}
ZADANIE = {'bootstrap', 'e2e:precheck', 'e2e:env-up', 'warmup:vitest', 'walidacja-koncowa', 'e2e:env-down', 'compound',
           'compound-refresh', 'complete', 'smoke-operatora', 'telemetria', 'stop'}
ETAP = {'planner': 'execute', 'build': 'execute', 'domkniecie': 'execute', 'verify': 'sceptycy', 'verify-batch': 'sceptycy',
        'verify-fix': 'sceptycy', 'fix': 'fix', 'fix:poprawka': 'fix', 'fix:kontrola': 'fix', 'fix:pre-skan': 'mechanika',
        'stan:zapis': 'mechanika', 'dedup:semantyczny': 'mechanika', 'kontekst:diff': 'mechanika', 'zwin-do-poprawy': 'mechanika',
        'scribe': 'orkiestracja', 'bootstrap': 'orkiestracja', 'stop': 'orkiestracja', 'review:e2e': 'E2E', 'e2e:db-sync': 'E2E',
        'e2e:env-up': 'E2E', 'e2e:precheck': 'E2E', 'e2e:env-down': 'E2E', 'warmup:vitest': 'E2E', 'compound': 'zamkniecie',
        'compound-refresh': 'zamkniecie', 'complete': 'zamkniecie', 'smoke-operatora': 'zamkniecie', 'walidacja-koncowa': 'zamkniecie',
        'telemetria': 'zamkniecie'}
WARUNKI = ('zawsze', 'faza_z_kodem', 'faza_z_testami', 'faza_z_ui', 'faza_z_migracja', 'faza_z_e2e', 'zadanie_z_e2e', 'raz_na_zadanie')


def start_po(klasa, model):
    """Start klasy po zmianie [tok]; kombinacja niezmierzona = wartosc opusa przeliczona tokenizerem haiku."""
    if (klasa, model) in TOLK: return TOLK[(klasa, model)]
    if model == 'haiku': return TOLK[(klasa, 'opus')] * TOK_HAIKU
    return TOLK[(klasa, 'haiku')] / TOK_HAIKU


def model_k(m):
    return 'haiku' if 'haiku' in m else 'opus'


def etap(rola):
    return ETAP.get(rola, 'review' if rola.startswith('review:') else 'orkiestracja')


def ww(n):
    return W_CW + W_CR * max(0, n - 1)


def wagi(a):
    """(waga prefiksu, waga wiadomosci) jak wagi() w d4r."""
    n, p = a['wywolania'], a['przepisania']
    kolejne = (n - 1 - p) * W_CR + p * W_CW
    return (W_CR if a['cr_pierwsza'] > 0 else W_CW) + kolejne, W_CW + kolejne


class Referencja:
    def __init__(self):
        self.dane = json.load(open(os.path.join(BASE, 'dane', 'panel-koszt-referencja.json')))
        k = json.load(open(os.path.join(BASE, 'dane', 'd4r-dzwignia-kontekstu.json')))['kalibracja']
        self.r_t, self.r_i = k['r_t'], k['r_i']
        self.mn = {m: k['mnoznik'][m]['s'] for m in ('opus', 'haiku')}
        for a in self.dane['agenci']:
            a['model_k'] = model_k(a['model'])
            a['poziom'] = 'zadanie' if a['rola'] in ZADANIE else ('faza' if a['faza'] != 'run' else 'zadanie')
        self.agenci_roli = self._agenci_roli()
        self.delta_klasy = None   # tryb kontrolny walidacji: Δ startu per (klasa, model) z mini-runu zamiast startu agenta

    def kontrfakt(self, a):
        """Agent z epoki z CLAUDE.md przycietym do stanu runu 20.09 (kontrfakt d4r): koszt i start pomniejszone."""
        nad = max(0, (a['zn'].get('claude_proj') or 0) - CLAUDE_REF_ZN) / self.r_i * self.mn[a['model_k']]
        b = dict(a); b['koszt'] = a['koszt'] - nad * wagi(a)[1]; b['ctx_start'] = a['ctx_start'] - nad
        return b

    def _agenci_roli(self):
        ref = collections.defaultdict(list); ep = collections.defaultdict(list)
        for a in self.dane['agenci']:
            if a['run'] == REF_RUN: ref[a['rola']].append(a)
            elif EPOKA[0] <= a['start'][:10] <= EPOKA[1] and a['zn'].get('tools_znikaja') is not None:
                ep[a['rola']].append(self.kontrfakt(a))
        out = {}
        for r in set(ref) | set(ep):
            out[r] = (ref[r], 'run 20.09') if ref[r] else (ep[r], 'epoka 09-08..09-17 (kontrfakt CLAUDE.md)')
        return out

    def po_zmianie(self, a):
        """Koszt agenta po zmianie kontekstu (start jego klasy i modelu po zmianie) — metoda d4r."""
        if self.delta_klasy: d = self.delta_klasy[(a['klasa'], a['model_k'])]
        else: d = max(0.0, a['ctx_start'] - start_po(a['klasa'], a['model_k']))
        dp = min(d, (a['zn'].get('tools_znikaja') or 0) / self.r_t * self.mn[a['model_k']])
        wp, wwi = wagi(a)
        return a['koszt'] - dp * wp - (d - dp) * wwi

    def jednostka(self, analog, klasa=None, model=None, m=1.0, kontekst='po', praca_mn=1.0):
        """Sredni koszt jednego wywolania roli [jedn.]: 'dzis' = jak analog dzis; 'po' = po zmianie kontekstu, z klasa/modelem/mnoznikiem tur projektu."""
        if analog not in self.agenci_roli: raise KeyError('analog %r nie wystepuje w danych referencyjnych' % analog)
        wyn = []
        for a in self.agenci_roli[analog][0]:
            if kontekst == 'dzis':
                wyn.append(a['koszt']); continue
            kl = klasa or a['klasa']; mo = model or a['model_k']
            praca = max(0.0, self.po_zmianie(a) - start_po(a['klasa'], a['model_k']) * ww(a['wywolania']))
            tok = 1.0 if mo == a['model_k'] else (TOK_HAIKU if mo == 'haiku' else 1 / TOK_HAIKU)
            wyn.append(start_po(kl, mo) * ww(max(1, round(a['wywolania'] * m))) + praca * m * tok * praca_mn)
        return statistics.mean(wyn)

    def zrodlo(self, analog):
        ag, z = self.agenci_roli[analog]
        return '%s n=%d' % (z, len(ag))


def fazy_unikalne(fazy):
    """Jedna faza na (zadanie, numer): wykonanie z builderami (iu>0), inaczej ostatnie; powtorki samego review odrzucone."""
    u = {}
    for f in sorted(fazy, key=lambda f: (f['iu'] > 0, f['start'])):
        u[(f['zadanie'], f['faza'])] = f
    return list(u.values())


def czestosci(fazy_u, zadania_e2e):
    n = len(fazy_u)
    c = {w: sum(1 for f in fazy_u if f[w]) / n for w in WARUNKI if w.startswith('faza_')}
    c['zawsze'] = 1.0
    c['zadanie_z_e2e'] = zadania_e2e
    return c


def wywolania(rola, fakty, cz):
    """Wywolania roli na faze: liczba x czestosc warunku; per iu/finding z faktow fazy."""
    w = rola['wywolania_na_faze']
    baza = w if isinstance(w, (int, float)) else fakty[{'iu': 'iu', 'finding': 'findingi'}[w['per']]] * w['x']
    if rola.get('czestosc') is not None: return baza * rola['czestosc']
    return baza * cz[rola['warunek']]
