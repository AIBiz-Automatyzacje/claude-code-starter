#!/usr/bin/env python3
"""Etap 5 (HANDOFF 6a pkt 35) — koszt typowej fazy i zadania „dziś” vs „po całym planie” (PANEL-WYNIK §4–§5), model panelu.

Uzycie: python3 skrypty/raport_koszt_po.py   (bez argumentow)
Wejscie: dane/panel-projekt-docelowy.json (format projektu dla panel_koszt_projektu.py + pola 'test', 'grupa'),
         dane/panel-projekt0-role.json, dane/panel-koszt-referencja.json, dane/mr-kontekst.json (starty klas: T = sama allowlista,
         TOLk = allowlista + omitClaudeMd u mechanicznych + learned-patterns poza eager), dane/pokretla-kosztu.json i
         dane/test-review/wynik-koszt.json (liczby testu review dla mnoznikow pracy).
Wyjscie: dane/raport-koszt-po.{txt,json}. NIE pisze do dane/panel-koszt.* (panel_koszt_projektu.py importowany tylko dla funkcji).

Metoda: jednostki i praca roli dokladnie jak w panel_koszt_model (metoda d4r, run 20.09). Dla kazdej roli agent-analog ma
praca = koszt po zmianie kontekstu (TOLk) - start klasy x ww(wywolan) — ta sama definicja co w modelu. Koszt agenta w scenariuszu
kontekstu S = koszt dzis (S = dzis) albo koszt po zmianie ze startem klasy z S (metoda po_zmianie z d4r), minus praca x (1 - mnoznik).
Mnoznik pracy roli z pola 'test' kalibrowany w kontekscie TOLk tak, zeby koszt roli na faze zmienil sie jak w tescie
(kolumna PO testu = po zmianie kontekstu): rola / wariant A vs 0 (pokretla-kosztu.json), sceptycy B vs 0 na finding, kontrola fixa
A vs 0 na cala czesc „fix” (zastepuje pare pre-skan + kontrola). Efort nie wchodzi wariantem ±20% — jest w mnozniku z testu.
Dzwignie nie sumuja sie: wklad kazdej grupy liczony osobno na projekcie 0 i razem; roznica pokazana wprost."""
import copy, json, os, statistics, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import panel_koszt_model as M  # noqa: E402
import panel_koszt_projektu as P  # noqa: E402

BASE = M.BASE
DOCELOWY = os.path.join(BASE, 'dane', 'panel-projekt-docelowy.json')
KOMORKA = {('mechaniczny', 'haiku'): 'mechaniczny-haiku', ('orkiestracyjny', 'opus'): 'orkiestracyjny-opus',
           ('reviewer', 'opus'): 'reviewer-opus-plik', ('sceptyk', 'opus'): 'sceptyk-opus', ('naprawiacz', 'opus'): 'naprawiacz-opus',
           ('naprawiacz', 'haiku'): 'naprawiacz-haiku', ('builder', 'opus'): 'builder-opus', ('tester', 'opus'): 'builder-opus'}
MECH_OPUS = 0.759   # mechaniczny opus = haiku / 0,759 (MINI-RUN-WYNIK (e), jak TOLK w modelu)
ZASTRZ = '†'
ZASTRZEZENIE = (ZASTRZ + ' = liczba bezwzgledna to DOLNA GRANICA: jednostki z malych faz runu 20.09 (8/7/0 plikow kodu) zanizaja koszt duzych '
                'faz epoki o ~39% (dane/panel-koszt.txt §3); porownania wzgledne (%, ta sama baza jednostek) tego bledu nie dziedzicza w calosci.')
out = []; Q = out.append; J = {}


def starty():
    """Starty klas po zmianie [tok] dla scenariuszy kontekstu: 'TOLk' (model panelu), 'It3a' (allowlista + omitClaudeMd u mechanicznych)."""
    k = json.load(open(os.path.join(BASE, 'dane', 'mr-kontekst.json')))['komorki']
    tolk = dict(M.TOLK)
    it3a = {}
    for (kl, mo), kom in KOMORKA.items():
        it3a[(kl, mo)] = tolk[(kl, mo)] if kl == 'mechaniczny' else k[kom]['T']['ctx']
    it3a[('mechaniczny', 'opus')] = it3a[('mechaniczny', 'haiku')] / MECH_OPUS
    return {'TOLk': tolk, 'It3a': it3a}


class Model:
    """Koszt roli i projektu w scenariuszu kontekstu (None = dzis) z mnoznikiem pracy per rola."""

    def __init__(self):
        self.ref = M.Referencja()
        self.S = starty()
        fazy_u = M.fazy_unikalne(self.ref.dane['fazy'])
        self.fk, self.cz = P.fakty_typowe(fazy_u)

    def _start(self, S, kl, mo):
        if (kl, mo) in S: return S[(kl, mo)]
        return S[(kl, 'opus')] * M.TOK_HAIKU if mo == 'haiku' else S[(kl, 'haiku')] / M.TOK_HAIKU

    def _po(self, a, S):
        """Koszt agenta po zmianie kontekstu do startu klasy z S — jak Referencja.po_zmianie (d4r)."""
        d = max(0.0, a['ctx_start'] - self._start(S, a['klasa'], a['model_k']))
        dp = min(d, (a['zn'].get('tools_znikaja') or 0) / self.ref.r_t * self.ref.mn[a['model_k']])
        wp, wwi = M.wagi(a)
        return a['koszt'] - dp * wp - (d - dp) * wwi

    def praca(self, a, scen='TOLk'):
        S = self.S[scen]
        return max(0.0, self._po(a, S) - self._start(S, a['klasa'], a['model_k']) * M.ww(a['wywolania']))

    def jednostka(self, analog, klasa, model, scen, mp=1.0):
        """Jak Referencja.jednostka (m = 1): 'dzis' = koszt analogu minus niewykonana praca; inaczej start klasy roli z S + praca x mnoznik."""
        wyn = []
        for a in self.ref.agenci_roli[analog][0]:
            if scen == 'dzis':
                wyn.append(a['koszt'] - self.praca(a) * (1.0 - mp)); continue
            tok = 1.0 if model == a['model_k'] else (M.TOK_HAIKU if model == 'haiku' else 1 / M.TOK_HAIKU)
            wyn.append(self._start(self.S[scen], klasa, model) * M.ww(a['wywolania']) + self.praca(a, scen) * tok * mp)
        return statistics.mean(wyn)

    def praca_sr(self, analog):
        return statistics.mean(self.praca(a) for a in self.ref.agenci_roli[analog][0])

    def rola(self, r, scen):
        """(koszt na faze albo na zadanie, wywolania, poziom)."""
        mp = r.get('_mp', 1.0)
        j = self.jednostka(r['analog'], r['klasa'], M.model_k(r['model']), scen, mp)
        if r['warunek'] == 'raz_na_zadanie':
            n = r['wywolania_na_faze'] * (r['czestosc'] if r.get('czestosc') is not None else 1.0)
            return n * j, n, 'zadanie'
        n = M.wywolania(r, self.fk, self.cz)
        return n * j, n, 'faza'

    def projekt(self, pr, scen):
        faza = {}; zad = {}; agf = agz = 0.0; per_rola = {}
        for r in pr['role_koszt']:
            k, n, poz = self.rola(r, scen)
            e = r.get('etap') or M.etap(r['analog'])
            per_rola[r['rola']] = dict(koszt=k, wywolania=n, poziom=poz, etap=e)
            if poz == 'zadanie': zad[e] = zad.get(e, 0) + k; agz += n
            else: faza[e] = faza.get(e, 0) + k; agf += n
        fz = self.fk['fazy_na_zadanie']
        et = {e: faza.get(e, 0) * fz + zad.get(e, 0) for e in set(faza) | set(zad)}
        return dict(faza=sum(faza.values()), zadanie=sum(faza.values()) * fz + sum(zad.values()), etapy_faza=faza, etapy_zadanie=et,
                    agenci_faza=agf, agenci_zadanie=agf * fz + agz, role=per_rola)


def cel_z_testu(t):
    """Stosunek kosztu (wariant / dzis) z testu review + opis zrodla."""
    d = json.load(open(os.path.join(BASE, t['plik'])))
    if 'sceptycy' in t:
        a, b = (d['sceptycy'][w] for w in t['sceptycy'])
        r = (b['po_M'] / b['findingow']) / (a['po_M'] / a['findingow'])
        return r, 'weryfikacja na finding: 0 %.3f -> %s %.3f M (%s, %s)' % (a['po_M'] / a['findingow'], t['sceptycy'][1], b['po_M'] / b['findingow'], t['pokretlo'], t['plik'])
    if 'czesc' in t:
        c = d['czesci'][t['czesc']]
        r = c[t['wariant']]['znajdowanie_po'] / c['0']['znajdowanie_po']
        return r, 'kontrola fixa: 0 %.2f -> %s %.2f M na 24 commity (%s, %s)' % (c['0']['znajdowanie_po'], t['wariant'], c[t['wariant']]['znajdowanie_po'], t['pokretlo'], t['plik'])
    role = d['warianty']
    a, b = role['0']['role'][t['rola']], role[t['wariant']]['role'][t['rola']]
    return b['po_na_faze_M'] / a['po_na_faze_M'], '%s: 0 %.3f -> %s %.3f M/faze, efort %s -> %s, tury %.1f -> %.1f (%s, %s)' % (
        t['rola'], a['po_na_faze_M'], t['wariant'], b['po_na_faze_M'], a['efort'], b['efort'], a['wywolania_sr'], b['wywolania_sr'], t['pokretlo'], t['plik'])


def kalibruj(mod, pd, p0):
    """Mnoznik pracy per rola z polem 'test' (kontekst TOLk): koszt roli na faze = cel x baza (baza = te same role w projekcie 0)."""
    rows = []
    b0 = mod.projekt(p0, 'TOLk')['role']
    for r in pd['role_koszt']:
        t = r.get('test')
        if not t: continue
        cel, opis = cel_z_testu(t)
        baza = sum(b0[x]['koszt'] for x in t.get('zastepuje', [r['rola']]))
        k1, n, _ = mod.rola(dict(r, _mp=1.0), 'TOLk')
        praca = mod.praca_sr(r['analog']) * n
        mp = 1.0 - (k1 - cel * baza) / praca
        r['_mp'] = max(0.0, mp)
        rows.append(dict(rola=r['rola'], cel=cel, baza=baza, bez_mnoznika=k1, mnoznik_pracy=mp, opis=opis, obciety=mp < 0))
    return rows


def z_grupami(pd, p0, grupy):
    """Projekt 0 z przyjetymi zmianami tylko z podanych grup (pozostale role jak w projekcie 0)."""
    pr = copy.deepcopy(p0); idx = {r['rola']: i for i, r in enumerate(pr['role_koszt'])}
    for r in pd['role_koszt']:
        if r.get('grupa') not in grupy: continue
        if r['rola'] in idx: pr['role_koszt'][idx[r['rola']]] = copy.deepcopy(r)
        else: pr['role_koszt'].append(copy.deepcopy(r))
    return pr


def fmt_et(w):
    tot = w['zadanie']
    return ', '.join('%s %.1f%%' % (k, 100 * v / tot) for k, v in sorted(w['etapy_zadanie'].items(), key=lambda x: -x[1]) if v > 0)


def pct(a, b):
    return 100 * (a / b - 1)


def main():
    mod = Model()
    p0 = P.wczytaj(P.PROJEKT0)
    pd = P.wczytaj(DOCELOWY)
    Q('raport_koszt_po.py — koszt typowej fazy i zadania: dzis vs po calym planie (PANEL-WYNIK §4–§5), M jedn. (in 1 / cw 1,25 / cr 0,1 / out 5)')
    Q(ZASTRZEZENIE)
    Q('Typowa faza i zadanie jak w panelu: %.2f faz na zadanie, %.2f IU i %.1f findingu na faze (dane/panel-koszt.txt §1).' % (
        mod.fk['fazy_na_zadanie'], mod.fk['iu'], mod.fk['findingi']))
    Q('')

    # 0. kontrola zgodnosci z modelem panelu
    ref_po = P.koszt(mod.ref, p0, mod.fk, mod.cz, 'po'); ref_dz = P.koszt(mod.ref, p0, mod.fk, mod.cz, 'dzis')
    moj_po = mod.projekt(p0, 'TOLk'); moj_dz = mod.projekt(p0, 'dzis')
    pk = json.load(open(os.path.join(BASE, 'dane', 'panel-koszt.json')))['projekty']
    pk0 = next(v for k, v in pk.items() if k.startswith('projekt 0'))
    ok = all(abs(pct(a, b)) < 0.1 for a, b in ((moj_po['faza'], ref_po['faza']), (moj_po['zadanie'], ref_po['zadanie']),
                                               (moj_dz['zadanie'], ref_dz['zadanie']), (moj_po['zadanie'], pk0['po']['zadanie'])))
    Q('=== 0. Kontrola: ten skrypt na projekcie 0 = model panelu (panel_koszt_projektu.koszt i dane/panel-koszt.json) ===')
    Q('  projekt 0 dzis: zadanie %.2f M (model %.2f); po zmianie kontekstu: faza %.2f / zadanie %.2f M (model %.2f / %.2f; panel-koszt.json %.2f) — %s' % (
        moj_dz['zadanie'] / 1e6, ref_dz['zadanie'] / 1e6, moj_po['faza'] / 1e6, moj_po['zadanie'] / 1e6, ref_po['faza'] / 1e6,
        ref_po['zadanie'] / 1e6, pk0['po']['zadanie'] / 1e6, 'ZGODNE (< 0,1%)' if ok else 'NIEZGODNE'))
    J['kontrola_zgodnosci'] = dict(ok=ok, moj_po=moj_po['zadanie'], model_po=ref_po['zadanie'], moj_dzis=moj_dz['zadanie'], model_dzis=ref_dz['zadanie'])
    if not ok:
        Q('STOP: skrypt nie odtwarza modelu panelu — wyniki nieliczone.'); zapisz(); return
    Q('')

    # 1. mnozniki pracy z testu
    kal = kalibruj(mod, pd, p0)
    Q('=== 1. Mnozniki pracy roli z testu review (kalibracja w kontekscie TOLk: koszt roli na faze = cel x dzis) ===')
    for k in kal:
        Q('  %-24s cel x%.3f  (baza %.3f M/faze -> %.3f M)  mnoznik pracy %.3f%s | %s' % (
            k['rola'], k['cel'], k['baza'] / 1e6, k['cel'] * k['baza'] / 1e6, k['mnoznik_pracy'], ' (OBCIETY do 0)' if k['obciety'] else '', k['opis']))
    Q('  Pozostale zmiany bez liczby z testu: usuniecia rol (liczba wywolan 0), warunek „faza z kodem” (K9) przez czestosc warunku 0,96.')
    J['mnozniki'] = kal
    Q('')

    # 2. scenariusze
    scen = [('S0', 'projekt 0, kontekst dzis', p0, 'dzis'), ('S1', 'projekt 0 + allowlista (It. 3a: tools:, omitClaudeMd u mechanicznych)', p0, 'It3a'),
            ('S2', 'projekt 0 + pelny kontekst (It. 3a + learned-patterns poza eager, It. 8) = „po” panelu', p0, 'TOLk'),
            ('S3', 'docelowy, kontekst dzis (same zmiany rol i pokretla)', pd, 'dzis'), ('S4', 'docelowy + allowlista (It. 3a)', pd, 'It3a'),
            ('S5', 'docelowy + pelny kontekst = PO CALYM PLANIE', pd, 'TOLk')]
    W = {}
    Q('=== 2. Faza i zadanie: dzis vs po (typowa faza; ' + ZASTRZ + ' przy kazdej liczbie bezwzglednej) ===')
    for sid, opis, pr, sc in scen:
        w = mod.projekt(pr, sc); W[sid] = w
        Q('  %s %-80s faza %6.2f M%s  zadanie %6.2f M%s  (%+6.1f%% vs dzis)  agentow faza %.1f / zadanie %.1f' % (
            sid, opis, w['faza'] / 1e6, ZASTRZ, w['zadanie'] / 1e6, ZASTRZ, pct(w['zadanie'], W['S0']['zadanie']), w['agenci_faza'], w['agenci_zadanie']))
    Q('')
    Q('  udzialy etapow w zadaniu (' + ZASTRZ + ' — udzialy liczone na malych fazach; w duzych fazach review i fix maja wiecej):')
    for sid in ('S0', 'S2', 'S5'):
        Q('    %s: %s' % (sid, fmt_et(W[sid])))
    Q('')
    Q('  etap review (6 reviewerow; tester E2E w etapie E2E, packager w „mechanice”) na zadanie:')
    for sid in ('S0', 'S2', 'S5'):
        Q('    %s review %.2f M%s' % (sid, W[sid]['etapy_zadanie'].get('review', 0) / 1e6, ZASTRZ))
    Q('    review S5 vs S2 (te same starty): %+.1f%%  (PANEL-WYNIK §5: pokretla K1, K2, K4, K7, K9 ≈ −20%% kosztu znajdowania — tu bez K7, bo packager to etap „mechanika”)' % (
        pct(W['S5']['etapy_zadanie']['review'], W['S2']['etapy_zadanie']['review'])))
    Q('')

    # 3. wklad dzwigni
    Q('=== 3. Wklad dzwigni — kazda liczona modelem per rola, NIE dodawaniem procentow ===')
    wk = {}
    def lin(nazwa, a, b):
        wk[nazwa] = pct(W[b]['zadanie'], W[a]['zadanie'])
        Q('  %-66s %s -> %s: zadanie %+6.1f%%' % (nazwa, a, b, wk[nazwa]))
    lin('kontekst razem (allowlista + learned-patterns) na dzisiejszych rolach', 'S0', 'S2')
    lin('  w tym sama allowlista (It. 3a)', 'S0', 'S1')
    lin('  learned-patterns poza eager (It. 8) po allowliscie', 'S1', 'S2')
    lin('pokretla i zmiany rol w dzisiejszym kontekscie', 'S0', 'S3')
    lin('pokretla i zmiany rol po zmianie kontekstu', 'S2', 'S5')
    lin('kontekst na docelowych rolach', 'S3', 'S5')
    lin('CALY PLAN', 'S0', 'S5')
    naiwnie = 100 * ((1 + wk['kontekst razem (allowlista + learned-patterns) na dzisiejszych rolach'] / 100) *
                     (1 + wk['pokretla i zmiany rol po zmianie kontekstu'] / 100) - 1)
    Q('  suma procentow „kontekst” + „pokretla w dzisiejszym kontekscie” = %+.1f%% — ZLA (dzwignie nie sumuja sie); poprawnie: %+.1f%% (S0 -> S5)' % (
        wk['kontekst razem (allowlista + learned-patterns) na dzisiejszych rolach'] + wk['pokretla i zmiany rol w dzisiejszym kontekscie'], wk['CALY PLAN']))
    Q('  kontrola: (1 + kontekst) x (1 + pokretla po kontekscie) - 1 = %+.1f%% = caly plan' % naiwnie)
    J['wklad'] = wk
    Q('')

    # 4. grupy osobno
    Q('=== 4. Grupy zmian rol osobno (na projekcie 0 po zmianie kontekstu S2; kazda grupa sama) ===')
    grupy = [('mechanika', 'usuniecia mechaniki: stan:zapis, packager, telemetria, e2e:precheck (It. 1, 3d, 3e)'),
             ('review', 'pokretla review: K1 test-coverage, K2 spec, K4 correctness, K9 warunek faza z kodem (It. 4b, 7a, 7b)'),
             ('sceptycy', 'batch sceptykow P2 po 4 (K11, D2, It. 5)'),
             ('kontrola_fixa', 'kontrola diffu fixa wg A zamiast pre-skan + kontrola + verify-fix (D12 cz. 1, It. 3)'),
             ('nowe', 'nowe role: ogrodnik skan + ocena (I8, R1; wartosci z projektu A)')]
    G = {}; suma = 0.0
    base = W['S2']
    for g, opis in grupy:
        w = mod.projekt(z_grupami(pd, p0, {g}), 'TOLk')
        d = w['zadanie'] - base['zadanie']; suma += d
        G[g] = dict(delta_zadanie=d, proc=100 * d / base['zadanie'], proc_dzis=100 * d / W['S0']['zadanie'])
        Q('  %-100s %+6.3f M%s  %+5.1f%% zadania po kontekscie  (%+5.1f%% dzisiejszego zadania)' % (opis, d / 1e6, ZASTRZ, G[g]['proc'], G[g]['proc_dzis']))
    razem = W['S5']['zadanie'] - base['zadanie']
    Q('  suma grup %+.3f M vs wszystkie naraz %+.3f M (roznica %.3f M — grupy dotykaja rozlacznych rol, wiec tu sumuja sie; nie sumuje sie kontekst z grupami, §3)' % (
        suma / 1e6, razem / 1e6, (razem - suma) / 1e6))
    Q('  te same grupy w dzisiejszym kontekscie (S0):')
    for g, opis in grupy:
        w = mod.projekt(z_grupami(pd, p0, {g}), 'dzis')
        d = w['zadanie'] - W['S0']['zadanie']
        G[g]['proc_w_kontekscie_dzis'] = 100 * d / W['S0']['zadanie']
        Q('    %-14s %+6.1f%% zadania dzis (po zmianie kontekstu ta sama zmiana: %+5.1f%% dzisiejszego zadania)' % (g, G[g]['proc_w_kontekscie_dzis'], G[g]['proc_dzis']))
    J['grupy'] = G
    Q('')

    # 5. wariant fix P1/P2
    Q('=== 5. Poza liczba glowna (bez liczby z testu) ===')
    wf = pd['wariant_poza_liczba_glowna']
    pf = copy.deepcopy(pd)
    for r in pf['role_koszt']:
        if r['rola'] == wf['rola']: r['_mp'] = wf['mnoznik_tur']
    w6 = mod.projekt(pf, 'TOLk')
    Q('  fix tylko P1/P2 (It. 6) jako praca fixa x%.1f (%s): zadanie %.2f M%s (%+.1f%% vs S5, %+.1f%% vs dzis)' % (
        wf['mnoznik_tur'], wf['zrodlo'], w6['zadanie'] / 1e6, ZASTRZ, pct(w6['zadanie'], W['S5']['zadanie']), pct(w6['zadanie'], W['S0']['zadanie'])))
    J['wariant_fix'] = dict(zadanie=w6['zadanie'], vs_S5=pct(w6['zadanie'], W['S5']['zadanie']), vs_dzis=pct(w6['zadanie'], W['S0']['zadanie']))
    Q('  Nieliczone w ogole: efort sesji dzis (±15%, K12 — dotyczy obu stron), mniej powtorek runu po STOP dzieki E2E → [MANUAL], samosprawdzenie')
    Q('  buildera (D7), wycinek wiedzy (≤ 2k zn), warstwa stala < 150 (K10: tekst ≤ 2,6% kosztu roli), koszt falszywych alarmow list w petli fix,')
    Q('  skille przed autopilotem (scalony dev-plan, research warunkowy — D8a/D8b; dzis ~4–7% kosztu zadania, dane/d6r-rewizja-audytu.txt),')
    Q('  roznica cen haiku/opus w USD (jednostki licza token haiku jak opusa; w USD haiku ~4x tanszy).')
    J['scenariusze'] = {sid: {k: v for k, v in W[sid].items() if k != 'role'} for sid in W}
    J['role_S0_S5'] = {r: dict(dzis=W['S0']['role'][r]['koszt'], po=W['S5']['role'].get(r, {}).get('koszt')) for r in W['S0']['role']}
    zapisz()


def zapisz():
    open(os.path.join(BASE, 'dane', 'raport-koszt-po.txt'), 'w').write('\n'.join(out) + '\n')
    json.dump(J, open(os.path.join(BASE, 'dane', 'raport-koszt-po.json'), 'w'), ensure_ascii=False, indent=1, default=float)
    print('\n'.join(out))


if __name__ == '__main__':
    main()
