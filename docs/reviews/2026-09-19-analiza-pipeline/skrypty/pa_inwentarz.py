#!/usr/bin/env python3
"""Prompt-audit (HANDOFF 6a pkt 24), krok 1 i 4: inwentarz powierzchni promptow szablonu + grep sygnalow
z przewodnika claude-api shared/prompt-audit.md (grupy 1a-1f, 2, 3, 4 + kandydaci re-testu Opus 5 -> 5.5).
Nie ocenia - wypisuje trafienia z plik:linia do czytania w sesji glownej.
Uzycie: pa_inwentarz.py <repo workspace-template> -> dane/pa-inwentarz.txt, dane/pa-sygnaly.txt, dane/pa-sygnaly.json"""
import json, os, re, sys
from collections import Counter, defaultdict

REPO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
C = os.path.join(REPO, '.claude')
OUT = os.path.dirname(os.path.abspath(__file__)) + '/../dane/'

# 6a pkt 20: poza zakresem (do usuniecia). dev-docs-execute/review = tryb reczny; ich SKILL.md czyta agent w runie -> osobny znacznik.
POMINIETE_SKILLE = {'code-review', 'code-quality', 'gemini', 'dev-docs-update', 'bugfix', 'dev-ideate', 'freshness-audit',
                    'dev-docs-execute', 'dev-docs-review'}
POMINIETE_WF = {'freshness-audit-wf.js'}

SYGNALY = {
    '1a-nacisk-wersaliki': r'\b(MUST|NEVER|ALWAYS|CRITICAL|IMPORTANT|NIGDY|ZAWSZE|MUSI|MUSISZ|MUSZ[AĄ]|KRYTYCZN\w*|WA[ZŻ]NE|BEZWZGL[EĘ]DNIE|OBOWI[AĄ]ZKOWO|ZAKAZ\w*|NIE WOLNO|WY[LŁ][AĄ]CZNIE|TYLKO|ZABRONION\w*)\b',
    '1a-wykrzykniki': r'!!|‼|⚠️|🚨|❗',
    '1a-asekuracja': r'\b(try to|if possible|ideally|spr[oó]buj|je[sś]li to mo[zż]liwe|w miar[eę] mo[zż]liwo[sś]ci|najlepiej je[sś]li|o ile to mo[zż]liwe)\b',
    '1a-cechy-modelu': r'\b(you (tend to|often|sometimes)|masz tendencj|cz[eę]sto zapominasz|modele (cz[eę]sto|maj[aą] tendencj)|agenci (cz[eę]sto|maj[aą] tendencj)|LLM[- ]?y? (cz[eę]sto|maj))',
    '1a-nie-badz-zbyt': r"\b(don'?t be too|nie b[aą]d[zź] zbyt|nie b[aą]d[zź] leniw|do not be lazy|be thorough|b[aą]d[zź] dok[lł]adn|nie przerywaj|do not stop early|nie ko[nń]cz przedwcze[sś]nie)",
    '1b-mysl-krok-po-kroku': r'(think step by step|krok po kroku|take a deep breath|think (harder|less)|ultrathink|think hard|pomy[sś]l (dok[lł]adnie|g[lł][eę]boko|intensywnie)|don.?t overthink|<scratchpad>|<thinking>)',
    '1b-planuj-najpierw': r'(plan before|najpierw (zaplanuj|zr[oó]b plan|przemy[sś]l)|use the think tool|zaplanuj zanim|przed dzia[lł]aniem zaplanuj)',
    '1b-kadencja-limit-slow': r'(every \d+ (tool calls|messages|turns)|co \d+ (wywo[lł]a|tur|narz[eę]dzi)|at most \d+ (words|sentences)|(maks(ymalnie)?|max|do|najwy[zż]ej|nie wi[eę]cej ni[zż]) \d+ (s[lł][oó]w|zda[nń]|linii|linijek|punkt[oó]w|znak[oó]w))',
    '1b-parametry-api': r'\b(budget_tokens|temperature|top_p|top_k|tool_choice|prefill|stop_sequences|thinking\s*:)',
    '1c-kroki-choreografia': r'^\s*(#+\s*)?(STEP|KROK|Krok|Step)\s*\d',
    '1c-nie-halucynuj': r'(do not hallucinate|nie halucynuj|nie zmy[sś]laj|nie wymy[sś]laj)',
    '1c-powtorzenie': r'\b(Remember,|Again,|As stated above|As mentioned|Pami[eę]taj|Przypominam|Jak wspomniano|Jeszcze raz|Powtarzam|ponownie podkre[sś]lam)',
    '1c-slownik-oceny': r'\b(grade|graded|hidden test|b[eę]dziesz ocenian|ocena twojej pracy|ukryte testy)\b',
    '1c-strategia': r"(it'?s usually best|zwykle najlepiej|najcz[eę][sś]ciej warto|dobr[aą] praktyk[aą] jest)",
    '1d-modele-przypiete': r'\b(claude-[23]|claude-instant|sonnet|haiku|opus|fable|mythos|[Oo]pus ?4|4\.5|4\.6|4\.7|4\.8)\b',
    '1d-tlumienie-narracji': r"(hold (all )?(findings|results)|don'?t narrate|no interim|nie narruj|bez komentarzy|nie komentuj|nie opisuj (co|swoich)|bez (wst[eę]p[oó]w|podsumowa[nń])|nie pisz (wst[eę]pu|podsumowania|komentarzy))",
    '1d-mitygacje-bez-myslenia': r'(internal (XML )?tags|before (each|a) tool call|tag[oó]w (XML|wewn[eę]trznych))',
    '1d-anty-formatowanie': r"(never use (bullets|headers|bold)|no (bullet|header|bold)|bez (punktor[oó]w|nag[lł][oó]wk[oó]w|pogrubie[nń]|markdown))",
    '1d-przypomnienie': r'(reminder:|przypomnienie:|REMINDER)',
    '1d-frazy-migracyjne': r'\b(no longer|od teraz|ju[zż] nie|now works|teraz (dzia[lł]a|te[zż])|also counts|te[zż] si[eę] liczy)\b',
    '1d-tozsamosc': r'^\s*(You are (a|an) |Jeste[sś] (a|an)?\s?\w+)',
    '2-historia-incydenty': r'(\b(N[1-9]|D[1-6]|L\d{1,2}|PR ?#?\d+|#\d{2,}|wf_[0-9a-f]{6,})\b|20\d\d-\d\d-\d\d|\b(incydent|w runie|w poprzednim runie|zdarzy[lł]o si[eę]|kiedy[sś]|historycznie|by[lł]o tak)\b)',
    '2-czas-przeszly-oferty': r'\b(oferty-online|w ofercie|na projekcie oferty)\b',
    '3-scolding-cross-ref': r'(ALWAYS use|NEVER use|ZAWSZE u[zż]ywaj|NIGDY nie u[zż]ywaj|zamiast (Read|Grep|Edit|Write|Bash))',
    'o5-weryfikacja-samokontrola': r'(double[- ]check|re-?verify|verify your|self-check|sprawd[zź] ponownie|zweryfikuj (sw[oó]j|swoj|swoje|ponownie|jeszcze)|upewnij si[eę]|przed zwr[oó]ceniem (wyniku|odpowiedzi) sprawd[zź]|samokontrol|podw[oó]jnie sprawd[zź])',
    'o5-zakres-scope': r'(poza zakres|nie rozszerzaj|tylko to,? o co|scope|zakres zadania|nie dodawaj (niczego|funkcj)|nie refaktoruj)',
    'o5-delegacja-subagenci': r'(subagent|sub-agent|Task tool|narz[eę]dzi[ae] Task|deleguj|uruchom agent|odpal agent|r[oó]wnolegle agent|spawn)',
    'o5-dlugosc-odpowiedzi': r'(zwi[eę][zź]le|kr[oó]tko|concise|be brief|brevity|nie rozpisuj|bez lania wody|lakoniczn)',
}
RX = {k: re.compile(v, re.M) for k, v in SYGNALY.items()}
WERSALIKI_KEYS = {'1a-nacisk-wersaliki', '1d-modele-przypiete'}


def czytaj(p):
    return open(p, encoding='utf-8', errors='ignore').read()


def frontmatter(t):
    m = re.match(r'^---\n(.*?)\n---\n', t, re.S)
    return m.group(1) if m else ''


def pole(fm, nazwa):
    m = re.search(r'^' + nazwa + r':\s*(.*)$', fm, re.M)
    return m.group(1).strip() if m else ''


def zbierz_pliki():
    pliki = []  # (sciezka_wzgl, grupa, status, kto_czyta)
    agenci_skille = {}
    for a in sorted(os.listdir(f'{C}/agents')):
        fm = frontmatter(czytaj(f'{C}/agents/{a}'))
        sk = pole(fm, 'skills')
        agenci_skille[a] = [s.strip() for s in sk.strip('[]').split(',') if s.strip()]
    wstrzykiwany = defaultdict(list)
    for a, sks in agenci_skille.items():
        for s in sks:
            wstrzykiwany[s].append(a.replace('.md', ''))
    for s in sorted(os.listdir(f'{C}/skills')):
        d = f'{C}/skills/{s}'
        if not os.path.isdir(d):
            continue
        status = 'POMINIETY (6a pkt 20)' if s in POMINIETE_SKILLE else 'w zakresie'
        for root, _, fs in os.walk(d):
            for f in sorted(fs):
                if not f.endswith('.md'):
                    continue
                rel = os.path.relpath(os.path.join(root, f), REPO)
                glowny = f == 'SKILL.md'
                kto = []
                if glowny and s in wstrzykiwany:
                    kto.append('wstrzykiwany skills: -> ' + ', '.join(wstrzykiwany[s]))
                if glowny and s not in wstrzykiwany:
                    kto.append('sesja glowna (Skill) / agent czyta plik')
                if not glowny:
                    kto.append('referencja na zadanie (Read/cat)')
                pliki.append((rel, 'skill' if glowny else 'skill-ref', status, '; '.join(kto)))
    for a in sorted(os.listdir(f'{C}/agents')):
        pliki.append((f'.claude/agents/{a}', 'agent', 'w zakresie', 'plik agenta (system prompt subagenta)'))
    for w in sorted(os.listdir(f'{C}/workflows')):
        if w.endswith('.js'):
            pliki.append((f'.claude/workflows/{w}', 'workflow', 'POMINIETY (6a pkt 20)' if w in POMINIETE_WF else 'w zakresie',
                          'stringi promptow agent() + orkiestrator'))
    pliki.append(('.claude/rules/coding-rules.md', 'regula', 'w zakresie - TYLKO RAPORT (regula operatora)', 'eager: sesja glowna + subagenci z CLAUDE.md'))
    for h in sorted(x for x in os.listdir(f'{C}/hooks') if os.path.isfile(f'{C}/hooks/{x}')):
        pliki.append((f'.claude/hooks/{h}', 'hook', 'w zakresie', 'hook Stop -> komunikat do modelu (exit 2 / stderr)'))
    for root, _, fs in os.walk(f'{C}/templates'):
        for f in sorted(fs):
            pliki.append((os.path.relpath(os.path.join(root, f), REPO), 'szablon', 'w zakresie', 'kopiowany do docs/ projektu, czytany przez agentow'))
    return pliki, agenci_skille


def modele_workflow():
    """agent(xPrompt(...), {... model: 'haiku' ...}) -> rola haiku; reszta dziedziczy model sesji."""
    wynik = []
    for w in sorted(os.listdir(f'{C}/workflows')):
        if not w.endswith('.js') or w in POMINIETE_WF:
            continue
        t = czytaj(f'{C}/workflows/{w}')
        for i, l in enumerate(t.splitlines(), 1):
            if 'agent(' not in l or l.strip().startswith('//'):
                continue
            fn = re.search(r'agent\(\s*([A-Za-z]\w*)', l)
            lab = re.search(r"label:\s*[`']([^`']+)", l)
            mod = re.search(r"model:\s*'(\w+)'", l)
            eff = re.search(r"\}, '(low|medium|high|xhigh|max)'\)|tiery\.(\w+)", l)
            wynik.append((w, i, fn.group(1) if fn else '?', lab.group(1) if lab else '?', mod.group(1) if mod else 'sesja (Opus 5.5)',
                          eff.group(0) if eff else '-'))
    return wynik


def main():
    pliki, agenci_skille = zbierz_pliki()
    hity = defaultdict(list)  # sygnal -> [(plik, linia, tekst)]
    per_plik = defaultdict(Counter)
    rozmiar = {}
    for rel, grupa, status, _ in pliki:
        t = czytaj(os.path.join(REPO, rel))
        rozmiar[rel] = (len(t.splitlines()), len(t))
        for i, l in enumerate(t.splitlines(), 1):
            s = l.strip()
            if grupa == 'workflow' and (s.startswith('//') or s.startswith('*')):
                continue
            for k, rx in RX.items():
                if rx.search(l):
                    hity[k].append((rel, i, s[:220], status))
                    per_plik[rel][k] += 1
    # --- inwentarz
    o = ['# Prompt-audit: inwentarz powierzchni promptow (pa_inwentarz.py)', f'repo: {REPO}', '']
    grupy = defaultdict(list)
    for p in pliki:
        grupy[p[1]].append(p)
    for g in ['skill', 'skill-ref', 'agent', 'workflow', 'regula', 'hook', 'szablon']:
        lst = grupy[g]
        wz = [p for p in lst if not p[2].startswith('POMINIETY')]
        o.append(f'## {g}: {len(lst)} plikow, w zakresie {len(wz)}, linie w zakresie {sum(rozmiar[p[0]][0] for p in wz)}, znaki {sum(rozmiar[p[0]][1] for p in wz)}')
        for rel, _, status, kto in lst:
            n, z = rozmiar[rel]
            o.append(f'  {rel:78s} {n:5d} l {z:7d} zn  [{status}]  {kto}')
        o.append('')
    o.append('## role workflow: prompt -> model (efort)')
    for w, i, fn, lab, mod, eff in modele_workflow():
        o.append(f'  {w}:{i:<5d} {fn:28s} {lab:40s} {mod:18s} {eff}')
    o.append('')
    o.append('## skille wstrzykiwane przez skills: w plikach agentow')
    for a, s in agenci_skille.items():
        if s:
            o.append(f'  {a}: {", ".join(s)}')
    o.append('')
    o.append('## CLAUDE.md: w repo szablonu BRAK pliku w katalogu glownym (CLAUDE.md nalezy do projektu docelowego); grep odwolan:')
    for rel, _, status, _ in pliki:
        if status.startswith('POMINIETY'):
            continue
        for i, l in enumerate(czytaj(os.path.join(REPO, rel)).splitlines(), 1):
            if re.search(r'CLAUDE\.md', l) and re.search(r'(dopisz|zaktualizuj|aktualizuj|edytuj|zapisz|update|append)', l, re.I):
                o.append(f'  {rel}:{i}: {l.strip()[:160]}')
    open(OUT + 'pa-inwentarz.txt', 'w').write('\n'.join(o) + '\n')
    # --- sygnaly
    o = ['# Prompt-audit: sygnaly z przewodnika (pa_inwentarz.py) - trafienia do czytania, nie werdykty', '']
    o.append('## liczby per sygnal (w zakresie / pominiete)')
    for k in SYGNALY:
        wz = sum(1 for h in hity[k] if not h[3].startswith('POMINIETY'))
        o.append(f'  {k:32s} {wz:5d} / {len(hity[k]) - wz}')
    o.append('')
    o.append('## gestosc nacisku (wersaliki 1a) na 100 linii, pliki w zakresie >= 40 linii, malejaco')
    gest = []
    for rel, grupa, status, _ in pliki:
        if status.startswith('POMINIETY') or rozmiar[rel][0] < 40:
            continue
        gest.append((100 * per_plik[rel]['1a-nacisk-wersaliki'] / rozmiar[rel][0], rel, per_plik[rel]['1a-nacisk-wersaliki'], rozmiar[rel][0]))
    for g, rel, n, l in sorted(gest, reverse=True)[:40]:
        o.append(f'  {g:5.1f}  {n:4d}/{l:<5d} {rel}')
    o.append('')
    for k in SYGNALY:
        o.append(f'## {k}  ({SYGNALY[k][:90]})')
        for rel, i, s, status in hity[k]:
            if status.startswith('POMINIETY'):
                continue
            o.append(f'  {rel}:{i}: {s}')
        o.append('')
    open(OUT + 'pa-sygnaly.txt', 'w').write('\n'.join(o) + '\n')
    json.dump({'per_plik': {k: dict(v) for k, v in per_plik.items()}, 'rozmiar': rozmiar}, open(OUT + 'pa-sygnaly.json', 'w'), ensure_ascii=False, indent=1)
    print('pliki:', len(pliki), '| trafienia w zakresie:', sum(1 for k in hity for h in hity[k] if not h[3].startswith('POMINIETY')))


if __name__ == '__main__':
    main()
