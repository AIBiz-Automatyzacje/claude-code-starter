#!/usr/bin/env python3
"""Pokrętła kosztu obecnego review (HANDOFF §8 „DECYZJE I PLAN WDROŻENIA” pkt 1) — liczby z transkryptów testu review i z danych panelu.

Użycie: python3 skrypty/pokretla_kosztu.py  → dane/pokretla-kosztu.{txt,json}

Jednostki: 13 faz etapu głównego (f-*, permutacja p1 — jak test_review_analiza), warianty 0 (dzisiejszy review-wf, efort sesji `high`)
i A (efort per rola z etykiety `[high|medium|low]`). Per rola: agentów, koszt ZMIERZONY i PO (po zmianie kontekstu — ta sama metoda co
test_review_wynik.koszt), wywołania API (≈ tury), kontekst pierwszej tury, tokeny wyjściowe (z myśleniem) i ich udział w koszcie, długość
polecenia (pierwsza wiadomość user w transkrypcie agenta), wywołania narzędzi Bash / Read / Grep / Glob, findingi P1/P2, wkład w klucze
(klucz 1 i klucz 2 w fazach, osobno dla 0 i A; „jedyny” = klucz złapany w wariancie wyłącznie findingiem tej roli).
Rozkład różnicy A − 0 (PO) na grupy ról: usunięte w A, efort obniżony w A, ten sam efort (różni je kształt polecenia i dossier).
Z danych panelu (dane/panel-koszt.json): udziały etapów projektu 0 i częstości warunków uruchamiania.
Kontrola: suma PO ról = znajdowanie_po z dane/test-review/wynik-koszt.json (fazy)."""
import collections, glob, json, os, re, sys

sys.dont_write_bytecode = True
import panel_koszt_dane as KD
import panel_koszt_model as KM
import test_review_analiza as TA
import test_review_pilot as P
import test_review_wynik as W

TR = os.path.expanduser('~/test-review')
PROJ = os.path.expanduser('~/.claude/projects')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DANE = os.path.join(BASE, 'dane')
WARIANTY = ('0', 'A')
NARZEDZIA = ('Bash', 'Read', 'Grep', 'Glob')
RE_EFORT = re.compile(r'\[(high|medium|low|haiku)\]$')
ZN_NA_TOK = 2.0
# grupy ról do rozkładu różnicy A − 0 (katalog A w dane/panel-run1-projekty.json, role_koszt)
USUNIETE_W_A = ('review:performance', 'kontekst:diff')
EFORT_NIZSZY_W_A = ('review:test-coverage', 'review:spec-compliance', 'review:code-quality')
TEN_SAM_EFORT = ('review:correctness', 'review:security')


def rola(etykieta):
    e = RE_EFORT.sub('', etykieta or '?')
    return e[2:] if e.startswith('A:') else e


def efort(etykieta, wariant):
    m = RE_EFORT.search(etykieta or '')
    if m: return m.group(1)
    return 'haiku' if 'dedup' in (etykieta or '') else ('low' if 'kontekst:diff' in (etykieta or '') else 'high (sesja)')


def odczyt(jf):
    """Tokeny wyjściowe (ostatni usage na message.id), wywołania narzędzi po nazwie (unikalne tool_use.id), długość pierwszej wiadomości user."""
    out, narz, prompt_zn = {}, {}, None
    for line in open(jf, errors='ignore'):
        try: o = json.loads(line)
        except ValueError: continue
        m = o.get('message') or {}
        if o.get('type') == 'user' and prompt_zn is None:
            c = m.get('content')
            prompt_zn = len(c) if isinstance(c, str) else sum(len(b.get('text', '')) for b in c or [] if isinstance(b, dict))
        if o.get('type') != 'assistant': continue
        if m.get('usage'): out[m.get('id')] = m['usage'].get('output_tokens', 0)
        for b in m.get('content') or []:
            if isinstance(b, dict) and b.get('type') == 'tool_use': narz[b.get('id')] = b.get('name')
    return sum(out.values()), collections.Counter(narz.values()), prompt_zn or 0


def agenci(et, w):
    """Agenci runu wariantu w (wariant0 / wariantA) jednej fazy: etykieta + skład kosztu + odczyt."""
    meta = json.load(open(os.path.join(TR, 'meta', et + '.json')))
    kat = os.path.join(PROJ, re.sub(r'[^A-Za-z0-9]', '-', meta['kopia']))
    sid = json.load(open(os.path.join(TR, 'wyniki', et, 'wariant%s.json' % w)))['_run']['sesja']
    ref, wynik = KM.Referencja(), []
    for rd in glob.glob(os.path.join(kat, sid, 'subagents', 'workflows', '*')):
        lab = {}
        for line in open(os.path.join(rd, 'journal.jsonl'), errors='ignore'):
            try: o = json.loads(line)
            except ValueError: continue
            if o.get('type') == 'started' and o.get('agentId'): lab[o['agentId']] = o.get('label') or ''
        for jf in glob.glob(os.path.join(rd, 'agent-*.jsonl')):
            a = KD.sklad(jf)
            if not a: continue
            e = lab.get(os.path.basename(jf)[6:-6], '?')
            a['klasa'] = W.klasa(e); a['model_k'] = KM.model_k(a['model'])
            po = ref.po_zmianie(a) if a['zn'].get('tools_znikaja') is not None else a['koszt']
            wy, narz, pz = odczyt(jf)
            wynik.append({'et': et, 'rola': rola(e), 'efort': efort(e, w), 'zmierzony': a['koszt'], 'po': po, 'wywolania': a['wywolania'],
                          'ctx_start': a['ctx_start'], 'output': wy, 'narzedzia': narz, 'prompt_zn': pz})
    return wynik


def findingi(et, w):
    """P1/P2 per rola z pliku wyniku wariantu (0: pole _zrodlo, A: pole _rola)."""
    fs = json.load(open(os.path.join(TR, 'wyniki', et, 'wariant%s.json' % w))).get('findings') or []
    c = collections.Counter()
    for f in fs:
        if (f.get('severity') or f.get('waga')) in ('P1', 'P2'):
            r = f.get('_rola') or f.get('_zrodlo') or '?'
            c[r if r.startswith('review:') else 'review:' + r] += 1
    return c


def zrodla(fazy, w):
    """{(et, przypadek): role wariantu w, których findingi sędzia dopasował do klucza} (jak mechanizmy.zrodla_0, także dla A: pole _rola)."""
    out = {}
    for et in fazy:
        kl, sed, mp = P.wczytaj(et, '1')
        fs = json.load(open(os.path.join(TR, 'wyniki', et, 'wariant%s.json' % w)))['findings']
        for k in sed['klucze']:
            for d in k.get('dopasowania') or []:
                f = mp['F'].get(d['f'])
                if f and f['rodzaj'] == 'agent' and f['wlasciciele'] == [w]:
                    r = fs[f['indeks']].get('_rola') or 'review:' + str(fs[f['indeks']].get('_zrodlo'))
                    out.setdefault((et, kl[k['id']]['przypadek']), set()).add(r)
    return out


def wklad(fazy):
    """Klucze obecne w fazach (klucz 1, klucz 2) złapane przez wariant: ile z udziałem roli i ile WYŁĄCZNIE tą rolą (bez bramek)."""
    R = TA.obecne(TA.wiersze(), 'fazy')
    out = {}
    for w in WARIANTY:
        zr = zrodla(fazy, w)
        for kl in ('klucz1', 'klucz2'):
            rs = [r for r in R if r['zrodlo'] == kl and r['sz_' + w]]
            udzial, jedyny = collections.Counter(), collections.Counter()
            for r in rs:
                s = zr.get((r['et'], r['przypadek']), set())
                udzial.update(s)
                if len(s) == 1: jedyny[next(iter(s))] += 1
            out['%s|%s' % (w, kl)] = {'zlapane': len(rs), 'udzial': dict(sorted(udzial.items())), 'jedyny': dict(sorted(jedyny.items()))}
    return out


def zbierz(fazy):
    per = {}
    for w in WARIANTY:
        rows = [a for et in fazy for a in agenci(et, w)]
        fnd = collections.Counter()
        for et in fazy: fnd.update(findingi(et, w))
        role = collections.OrderedDict()
        for a in sorted(rows, key=lambda x: x['rola']):
            s = role.setdefault(a['rola'], {'efort': a['efort'], 'agentow': 0, 'fazy': set(), 'zmierzony': 0.0, 'po': 0.0, 'wywolania': 0,
                                             'ctx_start': 0, 'output': 0, 'prompt_zn': 0, 'narzedzia': collections.Counter()})
            s['agentow'] += 1; s['fazy'].add(a['et'])
            for k in ('zmierzony', 'po', 'wywolania', 'ctx_start', 'output', 'prompt_zn'): s[k] += a[k]
            s['narzedzia'].update(a['narzedzia'])
        for r, s in role.items():
            n = s['agentow']
            role[r] = {'efort': s['efort'], 'agentow': n, 'faz': len(s['fazy']), 'po_M': round(s['po'] / 1e6, 3),
                       'po_na_faze_M': round(s['po'] / 1e6 / len(fazy), 3), 'zmierzony_M': round(s['zmierzony'] / 1e6, 3),
                       'wywolania_sr': round(s['wywolania'] / n, 1), 'ctx_start_sr': round(s['ctx_start'] / n),
                       'output_sr': round(s['output'] / n), 'udzial_outputu_w_koszcie': round(5 * s['output'] / s['zmierzony'], 3),
                       'prompt_zn_sr': round(s['prompt_zn'] / n), 'narzedzia_sr': {k: round(s['narzedzia'][k] / n, 1) for k in NARZEDZIA},
                       'p1p2': fnd.get(r, 0),
                       # bezpośredni koszt tekstu polecenia: zapis do cache w 1. turze + odczyt w każdej następnej (tekst polski ~2 zn/tok, HANDOFF §7)
                       'polecenie_bezposrednio_udzial': round(s['prompt_zn'] / ZN_NA_TOK * (1.25 + 0.1 * (s['wywolania'] / n - 1)) / s['zmierzony'], 3)}
        per[w] = {'role': role, 'po_razem_M': round(sum(x['po_M'] for x in role.values()), 2)}
    return per


def rozklad(per, n_faz):
    """Różnica A − 0 w PO na grupy ról (M jedn. na 13 faz i na fazę)."""
    r0, rA = per['0']['role'], per['A']['role']
    grupy = {'usuniete_w_A': USUNIETE_W_A, 'efort_nizszy_w_A': EFORT_NIZSZY_W_A, 'ten_sam_efort': TEN_SAM_EFORT}
    out = {}
    for g, role in grupy.items():
        d = sum(rA.get(r, {}).get('po_M', 0) - r0.get(r, {}).get('po_M', 0) for r in role)
        out[g] = {'role': list(role), 'delta_M': round(d, 2), 'delta_na_faze_M': round(d / n_faz, 3)}
    reszta = set(r0) | set(rA)
    reszta -= set(USUNIETE_W_A) | set(EFORT_NIZSZY_W_A) | set(TEN_SAM_EFORT)
    d = sum(rA.get(r, {}).get('po_M', 0) - r0.get(r, {}).get('po_M', 0) for r in reszta)
    out['reszta'] = {'role': sorted(reszta), 'delta_M': round(d, 2), 'delta_na_faze_M': round(d / n_faz, 3)}
    out['razem_delta_M'] = round(per['A']['po_razem_M'] - per['0']['po_razem_M'], 2)
    return out


def sceptycy(fazy):
    """Weryfikacja w teście (tylko findingi P1/P2 dopasowane do klucza 1, plan §6): agenci, decyzje (findingi), koszt PO — per wariant."""
    kz = json.load(open(os.path.join(DANE, 'test-review', 'wynik-koszt.json')))['jednostki']
    out = {}
    for w in '0ABC':
        ag = dec = 0; po = 0.0
        for et in fazy:
            d = json.load(open(os.path.join(TR, 'wyniki', et, 'sceptycy%s.json' % w)))
            ag += (d.get('_run') or {}).get('agentow') or 0; dec += len(d.get('decyzje') or [])
            po += kz[et].get('sceptycy' + w, {}).get('po', 0)
        out[w] = {'agentow': ag, 'findingow': dec, 'po_M': round(po, 2), 'po_na_finding_M': round(po / dec, 3) if dec else None,
                  'agentow_na_finding': round(ag / dec, 2) if dec else None}
    return out


def panel():
    d = json.load(open(os.path.join(DANE, 'panel-koszt.json')))
    p0 = d['projekty']['projekt 0 (dzisiejszy pipeline, wf 2026-09-06)']['po']
    udzialy = {k: round(v / p0['zadanie'], 3) for k, v in p0['etapy_zadanie'].items()}
    return {'czestosci': d['dane']['czestosci'], 'na_faze': d['dane']['na_faze'], 'udzialy_zadania_po': udzialy}


def pokretla(per, wk, sc, pn, n_faz):
    """Każde pokrętło: Δ PO na fazę (M), % kosztu znajdowania wariantu 0 w teście, ≈ % kosztu zadania (udział etapu z panelu, kolumna PO),
    wskaźnik jakości z testu (klucze z udziałem roli 0 → A, klucz 1 / klucz 2). Pokrętło = pojedyncza różnica ról; w A zmiany są splecione
    (efort + polecenie + dossier), więc Δ to górna granica efektu samego pokrętła."""
    r0, rA = per['0']['role'], per['A']['role']
    baza = per['0']['po_razem_M'] / n_faz
    u_rev, u_scep = pn['udzialy_zadania_po']['review'], pn['udzialy_zadania_po']['sceptycy']
    q = lambda r, w, kl: wk['%s|%s' % (w, kl)]['udzial'].get(r, 0)
    jakosc = lambda r: {'klucz1_0_A': [q(r, '0', 'klucz1'), q(r, 'A', 'klucz1')], 'klucz2_0_A': [q(r, '0', 'klucz2'), q(r, 'A', 'klucz2')],
                        'p1p2_0_A': [r0.get(r, {}).get('p1p2'), rA.get(r, {}).get('p1p2')]}
    def rola_d(nazwa, r, decyzja, opis):
        d = rA.get(r, {}).get('po_na_faze_M', 0) - r0[r]['po_na_faze_M']
        return {'id': nazwa, 'decyzja': decyzja, 'opis': opis, 'delta_na_faze_M': round(d, 3), 'proc_znajdowania': round(100 * d / baza, 1),
                'proc_zadania': round(100 * d / baza * u_rev, 1), 'jakosc': jakosc(r),
                'wyw_0_A': [r0[r]['wywolania_sr'], rA.get(r, {}).get('wywolania_sr')], 'out_0_A': [r0[r]['output_sr'], rA.get(r, {}).get('output_sr')]}
    K = [rola_d('efort test-coverage high→medium (+ lista mutantów)', 'review:test-coverage', 'D6', 'A: medium + listy L-TST + mutanty'),
         rola_d('efort spec high→medium', 'review:spec-compliance', 'D6', 'A: medium + listy L-SPC + sekcja planu'),
         rola_d('efort code-quality high→low', 'review:code-quality', 'D6', 'A: low + listy L-CQ + „nie zgłaszaj tego, co łapie lint”'),
         rola_d('kształt polecenia correctness (listy A, ten sam efort)', 'review:correctness', 'D10 / §2 pkt 11', 'A: high, listy L-COR, krótsze polecenie'),
         rola_d('kształt polecenia security (listy A, ten sam efort)', 'review:security', 'D10 / §2 pkt 11', 'A: high, listy L-SEC, krótsze polecenie'),
         rola_d('usunięcie reviewera performance', 'review:performance', 'poza D (6a pkt 32: 6 reviewerów zostaje)', 'A: brak roli'),
         rola_d('packager → skrypt (dossier bez agenta)', 'kontekst:diff', 'D3 (przesądzone §6)', 'A: dossier ze skryptu + mandat')]
    rev = [r for r in r0 if r.startswith('review:')]
    pol = sum(r0[r]['polecenie_bezposrednio_udzial'] * r0[r]['po_M'] for r in rev) / sum(r0[r]['po_M'] for r in rev)
    K.append({'id': 'długość tekstu polecenia reviewera (sam tekst, bez zmiany zachowania)', 'decyzja': 'nowa pozycja (porządek, nie koszt)',
              'proc_kosztu_roli': round(100 * pol, 1), 'proc_znajdowania': round(100 * pol, 1), 'proc_zadania': round(100 * pol * u_rev, 1),
              'opis': 'koszt zapisu i odczytu tekstu polecenia z cache ÷ koszt roli (ważone kosztem ról 0)'})
    nie_kod = 1 - pn['czestosci']['faza_z_kodem']
    zawsze = sum(r0[r]['po_na_faze_M'] for r in ('review:security', 'review:spec-compliance', 'review:test-coverage'))
    K.append({'id': 'warunek „faza z kodem” dla security / spec / test-coverage', 'decyzja': 'D4 (spec) + ETAP1 (security)',
              'delta_na_faze_M': round(-nie_kod * zawsze, 3), 'proc_znajdowania': round(-100 * nie_kod * zawsze / baza, 1),
              'proc_zadania': round(-100 * nie_kod * zawsze / baza * u_rev, 1), 'opis': 'odsetek faz bez kodu (panel) × koszt trzech ról rdzenia'})
    p1p2 = json.load(open(os.path.join(DANE, 'test-review', 'wynik-szum.json')))['razem']['fazy']['0']['findingi_agent_P1P2_na_jednostke']
    # B = batch 4 niezależnie od pliku + P1 ×3 jak dziś (C ma P1 ×1, więc nie izoluje batcha)
    na_f0 = sc['0']['po_M'] / sc['0']['findingow']; na_fb = sc['B']['po_M'] / sc['B']['findingow']
    K.append({'id': 'batch sceptyków po 4 findingi niezależnie od pliku (B) zamiast grupy po pliku (0)', 'decyzja': 'D2',
              'delta_na_faze_M': round((na_fb - na_f0) * p1p2, 3), 'proc_weryfikacji': round(100 * (na_fb - na_f0) / na_f0, 1),
              'proc_zadania': round(100 * (na_fb - na_f0) / na_f0 * u_scep, 1),
              'opis': 'koszt na zweryfikowany finding 0 vs B × findingi P1/P2 reviewerów 0 na fazę (%.1f); asymetria B też różni — górna granica' % p1p2})
    # podział różnicy A − 0 na role, w których A nie stracił trafień (klucz 1 i klucz 2 z udziałem roli ≥ dziś), i role, w których stracił
    bez_straty = [r for r in r0 if r.startswith('review:') and r in rA and all(q(r, 'A', kl) >= q(r, '0', kl) for kl in ('klucz1', 'klucz2'))]
    bez_straty.append('kontekst:diff')   # packager: brak findingów, dossier ze skryptu tej samej treści
    d_bez = sum(rA.get(r, {}).get('po_M', 0) - r0[r]['po_M'] for r in bez_straty)
    d_razem = per['A']['po_razem_M'] - per['0']['po_razem_M']
    podzial = {'role_bez_straty': bez_straty, 'delta_bez_straty_M': round(d_bez, 2), 'proc_bez_straty': round(100 * d_bez / per['0']['po_razem_M'], 1),
               'delta_ze_strata_M': round(d_razem - d_bez, 2), 'proc_ze_strata': round(100 * (d_razem - d_bez) / per['0']['po_razem_M'], 1)}
    return {'baza_znajdowania_na_faze_M': round(baza, 3), 'udzial_review_w_zadaniu': u_rev, 'udzial_sceptykow_w_zadaniu': u_scep, 'pokretla': K,
            'podzial_A_minus_0': podzial}


def tekst(per, rk, wk, sc, pn, pk, kontrola):
    L = ['pokretla_kosztu.py — koszt ról review w teście (13 faz etapu, p1), M jedn.; PO = po zmianie kontekstu (jak test_review_wynik.koszt)', '']
    for w in WARIANTY:
        L.append('=== wariant %s — razem PO %.2f M (%.2f M na fazę) ===' % (w, per[w]['po_razem_M'], per[w]['po_razem_M'] / 13))
        L.append('  %-24s %-12s %4s %4s %7s %7s %6s %7s %7s %6s %7s %-26s %5s' % ('rola', 'efort', 'agt', 'faz', 'PO', 'PO/faz', 'wyw', 'ctx0', 'out/agt',
                                                                               'out%', 'prompt', 'Bash/Read/Grep/Glob', 'P1P2') + '  pol%')
        for r, s in per[w]['role'].items():
            n = s['narzedzia_sr']
            L.append('  %-24s %-12s %4d %4d %7.2f %7.3f %6.1f %7d %7d %5.0f%% %7d %-26s %5d' % (
                r, s['efort'], s['agentow'], s['faz'], s['po_M'], s['po_na_faze_M'], s['wywolania_sr'], s['ctx_start_sr'], s['output_sr'],
                100 * s['udzial_outputu_w_koszcie'], s['prompt_zn_sr'], '/'.join('%.1f' % n[k] for k in NARZEDZIA), s['p1p2'])
                     + '  %4.1f%%' % (100 * s['polecenie_bezposrednio_udzial']))
        L.append('')
    L.append('=== rozkład różnicy A − 0 (PO) ===')
    for g, v in rk.items():
        L.append('  %-18s %s' % (g, json.dumps(v, ensure_ascii=False)))
    L += ['', '=== weryfikacja w teście (tylko dopasowane P1/P2 klucza 1) ===']
    L += ['  %s: %s' % (w, json.dumps(v, ensure_ascii=False)) for w, v in sc.items()]
    L += ['', '=== wkład ról w klucze (fazy, obecne; udział = klucze z findingiem roli, jedyny = tylko ta rola) ===']
    L += ['  %s: %s' % (k, json.dumps(v, ensure_ascii=False)) for k, v in wk.items()]
    L += ['',
          '=== dane panelu (dane/panel-koszt.json) ===', '  częstości warunków: ' + json.dumps(pn['czestosci'], ensure_ascii=False),
          '  wywołania na fazę (review): ' + json.dumps({k: round(v, 2) for k, v in pn['na_faze'].items() if k.startswith(('review', 'verify',
                                                                                                                                  'kontekst', 'dedup'))},
                                                        ensure_ascii=False),
          '', '=== POKRĘTŁA (baza: znajdowanie 0 = %.3f M/fazę; review %.1f%% i sceptycy %.1f%% kosztu zadania — panel, kolumna PO) ===' % (
              pk['baza_znajdowania_na_faze_M'], 100 * pk['udzial_review_w_zadaniu'], 100 * pk['udzial_sceptykow_w_zadaniu'])]
    L += ['  ' + json.dumps(k, ensure_ascii=False) for k in pk['pokretla']]
    L += ['  podział A − 0 (role bez straty trafień vs ze stratą): ' + json.dumps(pk['podzial_A_minus_0'], ensure_ascii=False)]
    L += ['', '=== kontrola ===', '  ' + json.dumps(kontrola, ensure_ascii=False)]
    return '\n'.join(L) + '\n'


def main():
    fazy = sorted(u['et'] for u in TA.jednostki() if TA.czesc(u['et']) == 'fazy')
    per = zbierz(fazy)
    rk = rozklad(per, len(fazy))
    wk = wklad(fazy)
    pn = panel()
    sc = sceptycy(fazy)
    pk = pokretla(per, wk, sc, pn, len(fazy))
    wkoszt = json.load(open(os.path.join(DANE, 'test-review', 'wynik-koszt.json')))['czesci']['fazy']
    kontrola = {w: {'suma_rol_po': per[w]['po_razem_M'], 'wynik_koszt_znajdowanie_po': wkoszt[w]['znajdowanie_po']} for w in WARIANTY}
    json.dump({'fazy': fazy, 'warianty': per, 'rozklad_A_minus_0': rk, 'wklad': wk, 'sceptycy': sc, 'pokretla': pk, 'panel': pn,
               'kontrola': kontrola}, open(os.path.join(DANE, 'pokretla-kosztu.json'), 'w'), ensure_ascii=False, indent=1)
    t = tekst(per, rk, wk, sc, pn, pk, kontrola)
    open(os.path.join(DANE, 'pokretla-kosztu.txt'), 'w').write(t)
    print(t)


if __name__ == '__main__':
    main()
