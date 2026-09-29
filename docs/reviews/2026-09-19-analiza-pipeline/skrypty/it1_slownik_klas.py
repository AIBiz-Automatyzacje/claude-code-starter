#!/usr/bin/env python3
"""It. 1 krok 8 — zamkniety slownik klas uwag bota (L12, PANEL-WYNIK §4a C; decyzja O7: 25–35 klas + `inna`, review subagenta zamiast akceptacji operatora).

Wejscie: dane/coderabbit/klasyfikacja-574.csv (109 nazw klas z trzech klasyfikatorow), klasy ETAP1 §3 i ETAP1B §3 (odwzorowanie w SLOWNIK).
Wyjscie: dane/it1-slownik-klas.txt (lista klas: os, opis, stare nazwy, licznosci, przyklady), dane/it1-slownik-klas.csv (stara -> nowa),
dane/it1-slownik-klas.json (klasy z osia i opisem — zrodlo stalej KLASY_BLEDOW w dev-pr-wf.js).
Kontrola: kazda z 109 nazw ma klase; `inna` <= 5% uwag; raport udzialu P1/P2 per klasa (klasa > 10% P1/P2 musi byc jednorodna — ocenia review).
Os = reviewer, ktory powinien byl zlapac uwage (kolumna `etap` z 1b); `brak` = dzis zadna os (a11y, prawo, migracje) albo nie-defekt.
"""
import collections, csv, json, os, re, sys

sys.dont_write_bytecode = True
DANE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dane')

# klasa: (os, opis na 5 sekund, [stare nazwy z klasyfikacja-574.csv], [klasy ETAP1/ETAP1B, ktore obejmuje])
SLOWNIK = {
    # --- correctness
    'cykl-zycia-ui': ('correctness', 'efekt, timer albo stan UI zyje dluzej niz komponent albo przezywa zmiane propsa/identyfikatora '
                      '(zmiana propsa, odmontowanie → tu; dwie rownolegle operacje → wyscig)',
                      ['cykl-zycia-react', 'stan-ui-nieczyszczony'], ['ETAP1: cykl zycia i wspolbieznosc UI', 'ETAP1B: cykl zycia React']),
    'wyscig-i-wspolbieznosc': ('correctness', 'dwie rownolegle operacje albo wartosc sprzed await psuja wynik',
                               ['cykl-zycia-wspolbieznosc', 'wyscig-rownolegly', 'wartosc-po-await'], ['ETAP1B: wyscigi']),
    'sciezka-bledu': ('correctness', 'blad psuje stan dla uzytkownika albo niszczy dane zamiast byc obsluzony '
                      '(skutek dla uzytkownika/danych → tu; brak sladu tylko dla operatora → polkniety-blad)',
                      ['sciezka-bledu', 'sciezka-bledu-bez-obslugi', 'nieobsluzone-odrzucenie', 'granica-try-catch', 'utrata-danych-przy-bledzie',
                       'niespojnosc-transportow'], ['ETAP1B: sciezka bledu bez obslugi', 'ETAP1: granica try/catch']),
    'bramka-na-jednej-drodze': ('correctness', 'warunek chroni jedna droge do operacji, a inna go omija',
                                ['bramka-na-jednej-z-dwoch-drog', 'wszystkie-drogi-do-operacji', 'asymetria-bramek', 'kolejnosc-middleware'],
                                ['ETAP1B: bramka na jednej z dwoch drog']),
    'dopasowanie-tekstu': ('correctness', 'parsowanie albo porownanie tekstu, HTML, URI lub zbiorow daje zly wynik (regex, includes, '
                           'wielkosc liter, Set gubi krotnosc); gdy skutkiem jest obejscie kontroli dostepu → bramka-czarna-lista',
                      ['parser-regexem', 'parser-html-regexem', 'parser-tokenizer', 'dopasowanie-fragmentu', 'walidacja-tekstu', 'kodowanie-uri',
                       'porownanie-zbiorami', 'falszywy-alarm-walidatora'], ['ETAP1B: parser regexem']),
    'wartosc-graniczna': ('correctness', 'zle zachowanie na granicy zakresu: 0, 1, limit, maksymalna dlugosc',
                          ['wartosc-graniczna', 'granica-wartosci-migracja', 'kontrakt-diagnostyki'],
                          ['ETAP1B: granica wartosci w migracji']),
    'limit-czasu-i-ponowien': ('correctness', 'wywolanie bez limitu czasu albo petla ponowien bez sufitu',
                               ['brak-timeoutu', 'petla-ponowien-bez-sufitu', 'zamkniecie-procesu'], ['ETAP1B: brak timeoutu (performance → correctness)']),
    'spojnosc-dwoch-systemow': ('correctness', 'kod zaklada o innym systemie (baza, cudze API, drugi proces) cos, co nie jest prawda',
                                ['spojnosc-dwoch-systemow', 'kontrakt-vs-implementacja', 'zrodlo-czasu', 'limit-cudzej-uslugi'],
                                ['ETAP1: spojnosc dwoch systemow']),
    # --- security
    'bramka-czarna-lista': ('security', 'kontrola dostepu wylicza, co blokuje (albo dopasowuje niedokladnie), i domyslnie przepuszcza reszte',
                            ['bramka-czarna-lista'], ['ETAP1/1B: bramka czarna lista', 'ETAP1: straznik seeda']),
    'zaufanie-danym-klienta': ('security', 'decyzja (limit, dostep) oparta na danych, ktore kontroluje klient: naglowek, content-length',
                               ['zaufanie-naglowkowi'], []),
    'pii-i-sekrety': ('security', 'dane osobowe albo sekret trafiaja do logu, Sentry, repo albo argv',
                      ['pii-w-message', 'pii-do-sentry', 'pii-w-repo', 'pii-w-logu', 'sekret-do-sentry', 'sekret-w-argv'],
                      ['ETAP1B: PII/sekret w message/Sentry', 'ETAP1: ladunek wyjatku (PII w message)']),
    'walidacja-granicy-api': ('security', 'dane z zewnatrz wchodza bez walidacji ksztaltu (Zod) na granicy',
                              ['walidacja-granicy-api', 'walidacja-granicy', 'zod-granica'], ['ETAP1B: walidacja koperty']),
    'uprawnienia-naglowki-sql': ('security', 'grant bazy za szeroki albo za waski, brak naglowkow bezpieczenstwa HTTP, sklejanie SQL',
                                    ['grant-niepelny', 'minimum-privileges', 'konkatenacja-sql', 'naglowki-bezpieczenstwa'], []),
    # --- test
    'test-niefalsyfikowalny': ('test', 'test przechodzi takze wtedy, gdy zachowanie jest zepsute',
                               ['test-niefalsyfikowalny', 'straznik-negatywny'], ['ETAP1/1B: test niefalsyfikowalny', 'ETAP1B: straznik negatywny']),
    'luka-pokrycia': ('test', 'zachowanie z planu albo sciezka bledu nie ma testu',
                      ['luka-pokrycia', 'test-brak-pokrycia', 'wymaga-przegladarki'], ['ETAP1B: luka pokrycia']),
    'test-kruchy': ('test', 'test pada od zmiany niezwiazanej z zachowaniem (twarde liczby, kolejnosc)', ['test-kruchy'], []),
    # --- spec
    'tekst-ui': ('spec', 'tekst dla uzytkownika obiecuje cos, czego kod nie robi, albo niesie zle dane',
                 ['tekst-ui', 'zaszyta-domena'], ['ETAP1: tekst dla uzytkownika', 'ETAP1B: tekst UI obiecuje czynnosc']),
    'kontrakt-wspolny': ('spec', 'dwie warstwy (SQL, Zod, typ, dwie bramki) JUZ opisuja to samo pole inaczej '
                         '(kopia na razie zgodna → duplikacja)',
                         ['kontrakt-shared'], ['ETAP1B: kontrakt shared']),
    'zgodnosc-prawna': ('brak', 'dokument prawny niezgodny z przepisami (np. brak elementow z art. 13 RODO)',
                        ['zgodnosc-prawna', 'obowiazek-informacyjny'], []),
    # --- code-quality
    'polkniety-blad': ('code-quality', 'pusty catch albo blad polkniety: operator nie widzi przyczyny (kod bledu, stderr)',
                       ['pusty-catch', 'blad-polkniety'], ['ETAP1B: pusty catch']),
    'duplikacja': ('code-quality', 'ta sama logika albo stala w dwoch miejscach, na razie zgodnych, ktore moga sie rozjechac',
                   ['duplikacja-logiki', 'duplikacja-w-testach'], ['ETAP1: lustrzana duplikacja w testach', 'ETAP1B: duplikacja']),
    'martwy-kod-lub-komentarz': ('code-quality', 'nieosiagalna galaz albo komentarz, ktory nie zgadza sie z kodem',
                                 ['martwa-galaz', 'komentarz-rozmija-sie-z-kodem', 'komentarz-nieaktualny'], ['ETAP1B: martwa galaz']),
    # --- performance
    'cache-i-zapytania': ('performance', 'zbedne zapytania, zly cache albo wspolne wiadro limitera spowalnia / blokuje klientow',
                          ['cache-naglowki', 'cache-bez-inwalidacji', 'round-trip-auth', 'wspolne-wiadro-limitu'], []),
    # --- e2e
    'seed-e2e': ('e2e', 'seed testow E2E niezgodny z kontraktem migracji', ['seed-niezgodny-z-kontraktem', 'seed-dane-zrodlowe'],
                 ['ETAP1B: seed niezgodny z kontraktem']),
    # --- bez osi dzis (koszyk C w 1b)
    'migracja-bazy': ('brak', 'migracja blokuje tabele, nie jest idempotentna albo wchodzi w zlej kolejnosci',
                      ['blokada-migracji', 'migracja-blokujaca', 'idempotencja-migracji', 'kolizja-nazw-migracji', 'kolejnosc-rolloutu'],
                      ['ETAP1B: poprawka w wypchnietej migracji (domkniecie fazy)']),
    'a11y': ('brak', 'dostepnosc: fokus, klawiatura, kontrast, atrybuty ARIA',
             ['a11y', 'a11y-fokus', 'kontrast-a11y', 'a11y-klawiatura', 'a11y-drobiazg', 'a11y-postep'], []),
    'wada-dokumentu-sterujacego': ('brak', 'CLAUDE.md, plan albo instrukcja projektu kaze zrobic cos zlego albo sama sobie przeczy',
                                   ['wada-dokumentu-sterujacego'], ['ETAP1: wada w dokumencie sterujacym']),
    # --- konwencje (reguly bota z path_instructions; zwykle waga 0/P3)
    'prog-rozmiaru': ('brak', 'plik albo funkcja przekracza prog linii z konwencji', ['prog-rozmiaru'], ['ETAP1: progi rozmiaru 300/50 linii']),
    'konwencja-kodu': ('brak', 'bot cytuje regule projektu (typowanie as/any, eksporty, importy, style, console, Act/Assert, rate limit)',
                       ['asercja-typu-w-tescie', 'asercja-typu', 'zakaz-as', 'as-const-dozwolony', 'zakaz-any',
                        'jeden-eksport-per-plik', 'styl-inline', 'styl-tailwind', 'kolejnosc-importow', 'console-log-z-reguly',
                        'rate-limit-z-reguly', 'act-assert', 'organizacja-modulu', 'kierunek-zaleznosci'], []),
    # --- nie-defekty
    'preferencja-bota': ('brak', 'sugestia bota bez defektu i bez reguly projektu (rada, preferencja formatowania)',
                         ['preferencje-bota', 'preferencja-bota', 'rada-operacyjna', 'walidacja-zod-z-reguly', 'makieta-designu'],
                         ['ETAP1: preferencje bota']),
    'teza-obalona': ('brak', 'uwaga bota nieprawdziwa albo wycofana przez samego bota', ['teza-obalona', 'teza-falszywa'], []),
    'odpowiedz-bota': ('brak', 'odpowiedz bota w watku (potwierdzenie poprawki), nie nowa uwaga', ['odpowiedz-bota', 'odpowiedz-bota-w-watku'], []),
    'inna': ('brak', 'nic z listy nie pasuje — uzasadnienie w polu uzasadnienie', ['artefakt-w-repo'], []),
}
# Nadpisania pojedynczych uwag (review subagenta 2026-09-30, dane/it1-slownik-klas-review.txt): ta sama stara nazwa
# obejmowala rozne wady — przypisanie po tresci uwagi, nie po nazwie.
NADPISANIA = {
    ('2', '24'): 'zaufanie-danym-klienta', ('17', '117'): 'walidacja-granicy-api', ('9', '26'): 'seed-e2e',
    ('19', '150'): 'bramka-czarna-lista', ('10', '59'): 'dopasowanie-tekstu', ('9', '35'): 'migracja-bazy', ('9', '37'): 'migracja-bazy',
    ('7', '131'): 'sciezka-bledu', ('7', '158'): 'sciezka-bledu', ('10', '57'): 'tekst-ui', ('11', '65'): 'cykl-zycia-ui',
    ('9', '34'): 'bramka-czarna-lista', ('9', '13'): 'kontrakt-wspolny', ('9', '22'): 'polkniety-blad', ('10', '49'): 'polkniety-blad',
    ('3', '64'): 'duplikacja', ('3', '65'): 'duplikacja', ('13', '107'): 'duplikacja', ('8', '176'): 'cykl-zycia-ui',
}
LIMIT_INNA = 0.05
LIMIT_P1P2_KLASY = 0.10


def main():
    uwagi = list(csv.DictReader(open(os.path.join(DANE, 'coderabbit', 'klasyfikacja-574.csv'))))
    mapa = {stara: nowa for nowa, (_, _, stare, _) in SLOWNIK.items() for stara in stare}
    dubel = [s for s, n in collections.Counter(s for (_, _, st, _) in SLOWNIK.values() for s in st).items() if n > 1]
    brak = sorted({u['klasa'] for u in uwagi} - set(mapa))
    assert not dubel, f'stara nazwa w dwoch klasach: {dubel}'
    assert not brak, f'nazwy bez klasy: {brak}'
    assert set(NADPISANIA.values()) <= set(SLOWNIK), 'nadpisanie na klase spoza slownika'
    klucze = {(u['pr'], u['id']) for u in uwagi}
    assert set(NADPISANIA) <= klucze, f'nadpisanie nieistniejacej uwagi: {set(NADPISANIA) - klucze}'
    nowa_klasa = lambda u: NADPISANIA.get((u['pr'], u['id']), mapa[u['klasa']])
    per = collections.defaultdict(list)
    for u in uwagi:
        per[nowa_klasa(u)].append(u)
    p1p2 = [u for u in uwagi if u['severity'] in ('P1', 'P2')]
    out = [f'It. 1 krok 8 — zamkniety slownik klas uwag bota (po review subagenta, z nadpisaniami {len(NADPISANIA)} uwag; {len(SLOWNIK)} klas z `inna`)',
           f'Wejscie: {len(uwagi)} uwag, {len({u["klasa"] for u in uwagi})} starych nazw; P1/P2: {len(p1p2)}', '']
    for nowa, (os_, opis, stare, etap) in SLOWNIK.items():
        l = per[nowa]
        s = collections.Counter(u['severity'] for u in l)
        n12 = s['P1'] + s['P2']
        przyklady = [u['streszczenie'][:110] for u in sorted(l, key=lambda u: u['severity'] not in ('P1', 'P2'))[:2]]
        out.append(f'{nowa}  [os: {os_}]  n={len(l)}  P1={s["P1"]} P2={s["P2"]} P3={s["P3"]} 0={s["0"]}  udzial P1/P2 {100 * n12 / len(p1p2):.1f}%')
        out.append(f'   {opis}')
        out.append(f'   stare: {", ".join(stare)}' + (f' | ETAP1/1B: {"; ".join(etap)}' if etap else ''))
        for p in przyklady:
            out.append(f'   np. {p}')
    inna = len(per['inna']) / len(uwagi)
    out += ['', f'Kontrola: kazda stara nazwa ma klase (0 brakow, 0 dubli); `inna` = {100 * inna:.1f}% uwag (limit {100 * LIMIT_INNA:.0f}%) '
            f'→ {"OK" if inna <= LIMIT_INNA else "ZA DUZO"}',
            'Klasy > 10% P1/P2 (maja byc jednorodne — ocenia review): ' + ', '.join(
                f'{k} {100 * sum(u["severity"] in ("P1", "P2") for u in v) / len(p1p2):.1f}%' for k, v in per.items()
                if sum(u['severity'] in ('P1', 'P2') for u in v) / len(p1p2) > LIMIT_P1P2_KLASY)]
    open(os.path.join(DANE, 'it1-slownik-klas.txt'), 'w').write('\n'.join(out) + '\n')
    with open(os.path.join(DANE, 'it1-slownik-klas.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['stara', 'nowa', 'os'])
        for stara, nowa in sorted(mapa.items()):
            w.writerow([stara, nowa, SLOWNIK[nowa][0]])
    with open(os.path.join(DANE, 'it1-slownik-nadpisania.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['pr', 'id', 'nowa'])
        for (pr, id_), nowa in sorted(NADPISANIA.items(), key=lambda kv: (int(kv[0][0]), int(kv[0][1]))):
            w.writerow([pr, id_, nowa])
    json.dump({k: {'os': v[0], 'opis': v[1]} for k, v in SLOWNIK.items()}, open(os.path.join(DANE, 'it1-slownik-klas.json'), 'w'),
              ensure_ascii=False, indent=1)
    print('\n'.join(out[:3] + out[-2:]))


if __name__ == '__main__':
    main()
