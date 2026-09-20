export const meta = {
  name: 'pipeline-analiza-etap1b',
  description: 'Etap 1b: analiza skilla dev-pr (analityk + sceptyk) oraz klasyfikacja 574 uwag CodeRabbita z 20 PR-ow oferty-online na 3 koszyki',
  phases: [
    { title: 'Klasyfikacja uwag bota', detail: '3 klasyfikatorow po ~190 uwag (opus)', model: 'opus' },
    { title: 'Synteza uwag', detail: 'scalenie 3 czesci w jedna mape luk procesu (opus)', model: 'opus' },
    { title: 'dev-pr', detail: 'analityk skilla dev-pr -> sceptyk (opus)', model: 'opus' },
  ],
}

const S = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/dane'
const WT = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template'
const OO = '/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online'
const CR = S + '/coderabbit'

const WSPOLNE = 'KONTEKST: analizujemy pipeline dev-* (workspace-template): plan -> docs -> autopilot (execute -> review 6 reviewerow -> verify -> fix) -> dev-docs-complete -> dev-pr (PR na GitHub, recenzja bota CodeRabbit, tury poprawek, merge, compound). Cel: odchudzic proces bez utraty jakosci. Miara jakosci: ile realnych P1/P2 znajduje CodeRabbit PO naszym review.\n' +
  'Przeczytaj najpierw ' + S + '/dane-digest.md sekcje 0, 5, 6 (liczby v2) oraz ' + WT + '/docs/reviews/2026-09-19-analiza-pipeline/ETAP1-ROZSTRZYGNIECIE.md sekcja 3 (ucieczki do bota — 10 klas z compoundow).\n' +
  'Pisz po polsku z polskimi znakami. Kazda teza z dowodem: id komentarza / PR / plik:linia / liczba. Pliki czytaj narzedziem Read (offset/limit), grep tylko do lokalizacji.'

const TAKSONOMIA = 'KOSZYKI (dokladnie jeden na uwage):\n' +
  'A = SZUM KONFIGURACYJNY: uwaga wynika z regul jakosci (progi 300/50 linii, styl, docstring, Act/Assert, nazewnictwo, formatowanie) albo z tezy bota, ktora jest falszywa; przekroczenie progu o <=20% tez tu. Do wylaczenia/zlagodzenia w .coderabbit.yaml.\n' +
  'B = DO UNIKNIECIA PRZEZ NASZ PIPELINE: realny defekt lub realna luka, ktora powinien zlapac konkretny etap (planner, builder, konkretna os review: security/correctness/spec/test-coverage/performance/code-quality/e2e, domkniecie fazy z typecheck/test/lint, fix, kontrola diffu). Podaj etap i dlaczego nie zlapal (poza zakresem promptu / w zakresie ale przeoczone / brak mechanicznego wejscia / wymaga calego repo / wymaga uruchomienia).\n' +
  'C = REALNA LUKA BEZ WLASCICIELA: defekt, ktorego zaden etap nie ma w zakresie i nie da sie go tanio dodac — zostaje botowi.\n' +
  'D = NIE DA SIE OCENIC (komentarz-odpowiedz, podsumowanie, brak tresci merytorycznej).\n' +
  'KLASA (krotka etykieta, np. "test-niefalsyfikowalny", "prog-rozmiaru", "bramka-czarna-lista", "pii-w-message", "cykl-zycia-react", "kontrakt-shared", "kolejnosc-rolloutu", "tekst-ui"): uzyj etykiet z ETAP1-ROZSTRZYGNIECIE.md §3 tam, gdzie pasuja, nowe tworz oszczednie.\n' +
  'SEVERITY realna wg Ciebie: P1 (blad produkcyjny/bezpieczenstwo), P2 (realny defekt), P3 (drobiazg), 0 (nie defekt).'

const KLASYFIKACJA = {
  type: 'object', additionalProperties: false,
  properties: {
    zakres: { type: 'string' },
    przeanalizowane: { type: 'integer' },
    uwagi: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'integer' }, pr: { type: 'integer' }, plik: { type: 'string' },
      koszyk: { type: 'string', enum: ['A', 'B', 'C', 'D'] }, klasa: { type: 'string' }, severity: { type: 'string', enum: ['P1', 'P2', 'P3', '0'] },
      etap: { type: 'string', description: 'dla B: etap/os, ktory powinien zlapac; inaczej ""' },
      dlaczegoPrzeszlo: { type: 'string', enum: ['poza-zakresem-promptu', 'w-zakresie-ale-przeoczone', 'brak-mechanicznego-wejscia', 'wymaga-calego-repo', 'wymaga-uruchomienia', 'nie-dotyczy'] },
      streszczenie: { type: 'string', description: 'max 120 znakow' },
    }, required: ['id', 'pr', 'plik', 'koszyk', 'klasa', 'severity', 'etap', 'dlaczegoPrzeszlo', 'streszczenie'] } },
    podsumowanie: { type: 'object', additionalProperties: false, properties: {
      A: { type: 'integer' }, B: { type: 'integer' }, C: { type: 'integer' }, D: { type: 'integer' },
      topKlasy: { type: 'array', items: { type: 'string' }, description: 'klasa: liczba, malejaco, max 12' },
      progiRozmiaruPrzekroczoneOMniejNiz20Proc: { type: 'integer' },
    }, required: ['A', 'B', 'C', 'D', 'topKlasy', 'progiRozmiaruPrzekroczoneOMniejNiz20Proc'] },
  },
  required: ['zakres', 'przeanalizowane', 'uwagi', 'podsumowanie'],
}
const SYNTEZA = {
  type: 'object', additionalProperties: false,
  properties: {
    razem: { type: 'object', additionalProperties: false, properties: { A: { type: 'integer' }, B: { type: 'integer' }, C: { type: 'integer' }, D: { type: 'integer' } }, required: ['A', 'B', 'C', 'D'] },
    mapaLuk: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      etap: { type: 'string' }, liczbaB: { type: 'integer' }, klasy: { type: 'array', items: { type: 'string' } },
      glownyPowod: { type: 'string' }, przykladyId: { type: 'array', items: { type: 'integer' } }, ruch: { type: 'string', description: 'konkretna zmiana w promptcie/JS/konfiguracji, ktora zamyka luke, z szacunkiem ile uwag B by zniknelo' },
    }, required: ['etap', 'liczbaB', 'klasy', 'glownyPowod', 'przykladyId', 'ruch'] } },
    konfiguracjaBota: { type: 'array', items: { type: 'string' }, description: 'konkretne zmiany w .coderabbit.yaml (path_instructions, progi z tolerancja, wylaczenia) z liczba uwag A, ktore by zniknely' },
    trendPoPR: { type: 'string', description: 'czy liczba uwag B na 100 zmienionych plikow spada po naprawach pipeline (03.09, 06.09) — z liczbami per PR' },
    niespojnosciKlasyfikatorow: { type: 'array', items: { type: 'string' } },
  },
  required: ['razem', 'mapaLuk', 'konfiguracjaBota', 'trendPoPR', 'niespojnosciKlasyfikatorow'],
}
const DEVPR = {
  type: 'object', additionalProperties: false,
  properties: {
    coRobi: { type: 'string', description: 'przebieg dev-pr krok po kroku z kodu (SKILL.md + dev-pr-wf.js), nie z deklaracji' },
    czyNaprawiaCoPowinien: { type: 'string', description: 'dowod z danych: ile uwag bota dostalo odpowiedz/commit naprawczy, ile zostalo zignorowanych, jak skill klasyfikuje uwagi i czy ta klasyfikacja jest trafna' },
    raportKoncowy: { type: 'string', description: 'co dzis dostaje operator po turach; czego brakuje (per tura: co bylo, co naprawiono, co odrzucono i dlaczego; rekomendacja merguj/nie/kolejna tura)' },
    liczbaTur: { type: 'string', description: 'ile tur realnie potrzeba wg danych (uwagi per tura, malejace?), rekomendowana wartosc domyslna z uzasadnieniem' },
    kosztITury: { type: 'string', description: 'z agents.csv / koszt_skilli.txt: koszt epizodu dev-pr, agenci, tury' },
    problemy: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { problem: { type: 'string' }, dowod: { type: 'string' }, naprawa: { type: 'string' } }, required: ['problem', 'dowod', 'naprawa'] } },
    werdykt: { type: 'string', enum: ['ZOSTAW', 'ZOSTAW-ODCHUDZ', 'PRZEBUDUJ', 'ZASTAP'] },
    uzasadnienie: { type: 'string' },
    pewnosc: { type: 'string', enum: ['wysoka', 'srednia', 'niska'] },
  },
  required: ['coRobi', 'czyNaprawiaCoPowinien', 'raportKoncowy', 'liczbaTur', 'kosztITury', 'problemy', 'werdykt', 'uzasadnienie', 'pewnosc'],
}
const KONTRA = {
  type: 'object', additionalProperties: false,
  properties: {
    obalony: { type: 'boolean' }, argumenty: { type: 'array', items: { type: 'string' } }, coSieBroni: { type: 'array', items: { type: 'string' } },
    werdyktPoKontrze: { type: 'string', enum: ['ZOSTAW', 'ZOSTAW-ODCHUDZ', 'PRZEBUDUJ', 'ZASTAP'] }, coZmienicWUzasadnieniu: { type: 'string' },
  },
  required: ['obalony', 'argumenty', 'coSieBroni', 'werdyktPoKontrze', 'coZmienicWUzasadnieniu'],
}

const ZAKRESY = [
  { key: 'pr-1-8', pr: [1, 2, 3, 4, 5, 6, 7, 8], opis: 'PR 1-8 (25.08-05.09, PRZED naprawami pipeline z 03.09/06.09)' },
  { key: 'pr-9-13', pr: [9, 10, 11, 12, 13], opis: 'PR 9-13 (05.09-11.09)' },
  { key: 'pr-14-20', pr: [14, 15, 16, 17, 18, 19, 20], opis: 'PR 14-20 (13.09-17.09, po naprawach)' },
]

phase('Klasyfikacja uwag bota')
log('574 uwag inline CodeRabbita w ' + CR + '/bot-comments.jsonl (jedna linia = jedna uwaga; pola: pr, id, path, line, created, in_reply_to, body)')
const czesci = pipeline(
  ZAKRESY,
  (z) => agent(WSPOLNE + '\n\nROLA: klasyfikator uwag CodeRabbita, zakres ' + z.opis + '.\nDANE: ' + CR + '/bot-comments.jsonl — wez WYLACZNIE linie z "pr" w [' + z.pr.join(',') + '] (grep -n \'"pr": ' + z.pr.join('\\|"pr": ') + '\' albo python3 -c z filtrem; czytaj body w calosci, sa dlugie). Kontekst kodu, gdy potrzebny: ' + OO + ' (git show <sha> lub Read pliku). Konfiguracja bota: ' + OO + '/.coderabbit.yaml. Reguly jakosci, na ktore bot sie powoluje: ' + OO + '/.claude/rules/coding-rules.md.\n' +
    TAKSONOMIA + '\n' +
    'ZADANIE: sklasyfikuj KAZDA uwage z zakresu (uwagi z in_reply_to != null, ktore sa tylko odpowiedzia bota w watku, daj do D; podsumowania "walkthrough" tez D). Nie pomijaj zadnej — pole przeanalizowane musi sie rownac liczbie linii w zakresie. Dla progow rozmiaru policz osobno, ile przekroczen jest o <=20% (np. plik 300-360 linii, funkcja 50-60) — to szum wg operatora. Badz surowy wobec koszyka B: "w zakresie ale przeoczone" tylko gdy prompt osi/etapu wprost obejmuje te klase (sprawdz REVIEWERZY w ' + WT + '/.claude/workflows/dev-docs-review-wf.js ok. linii 361-370 i pliki ' + WT + '/.claude/agents/*.md).',
    { label: 'klasyfikacja:' + z.key, phase: 'Klasyfikacja uwag bota', schema: KLASYFIKACJA, model: 'opus' }),
)

phase('dev-pr')
const devpr = pipeline(
  [{ key: 'dev-pr' }],
  () => agent(WSPOLNE + '\n\nROLA: analityk skilla dev-pr. Operator jest z niego NIEZADOWOLONY i pyta: (1) czy skill realnie naprawia uwagi bota, ktore powinien; (2) dlaczego po N turach nie dostaje raportu per tura (co bylo, co naprawiono, co odrzucono i dlaczego); (3) dlaczego nie dostaje jasnej rekomendacji: merguj / nie merguj / potrzebna kolejna tura; (4) jaka domyslna liczba tur ma sens (3? 4?).\n' +
    'PRZECZYTAJ W CALOSCI: ' + WT + '/.claude/skills/dev-pr/SKILL.md (184 linie) i ' + WT + '/.claude/workflows/dev-pr-wf.js (454 linie) — to jest mechanika; porownaj z kopia w ' + OO + '/.claude/ (moze byc starsza). DANE: ' + CR + '/bot-comments.jsonl (574 uwagi; pole in_reply_to i daty pokazuja watki), ' + CR + '/pr-N-reviews.json i pr-N-issue-comments.json (odpowiedzi, stany), historia git w ' + OO + ' (git log --oneline --all | grep -i "tura\\|bot\\|coderabbit\\|fix(pr"), ' + S + '/koszt_skilli.txt i ' + S + '/agents.csv (workflow dev-pr: koszt, agenci, tury), ' + S + '/dane-digest.md §2, ' + OO + '/docs/solutions/*/ pliki z "bota" (compoundy po dev-pr), ' + OO + '/docs/completed/*/ (raporty koncowe zadan, jesli zawieraja sekcje PR).\n' +
    'ZADANIE: opisz, co skill robi naprawde (z kodu), i odpowiedz na 4 pytania operatora z dowodami. Policz: ile uwag bota per PR dostalo commit naprawczy lub odpowiedz (po datach i watkach), ile zignorowano i czy slusznie (rubryka klasyfikacji w SKILL.md); ile tur realnie sie wykonuje i czy liczba uwag w kolejnych turach maleje (uzasadnij domyslna liczbe tur). Wypisz konkretne problemy z dowodem i naprawa (zmiana w SKILL.md lub dev-pr-wf.js, z numerem linii). Zwroc uwage na bramke merge (SKILL.md ok. 114-121) i etap compound (ok. 129-134): czy operator dostaje z nich czytelny wynik.',
    { label: 'analityk:dev-pr', phase: 'dev-pr', schema: DEVPR, model: 'opus' }),
  (w) => w ? agent(WSPOLNE + '\n\nROLA: SCEPTYK. Analityk wydal werdykt o skillu dev-pr (JSON ponizej). Obal go na tych samych danych: sprawdz liczby (uwagi naprawione/zignorowane, tury, koszt z agents.csv), otworz cytowane linie SKILL.md i dev-pr-wf.js, sprawdz czy "problemy" nie sa juz rozwiazane w kodzie, czy naprawy nie dubluja istniejacych mechanizmow i czy rekomendowana liczba tur ma pokrycie w danych. Domyslnie zakladaj, ze werdykt jest zly; jesli sie broni — obalony=false i wypisz co go wzmacnia.\n' + JSON.stringify(w, null, 1),
    { label: 'sceptyk:dev-pr', phase: 'dev-pr', schema: KONTRA, model: 'opus' }).then((k) => ({ werdykt: w, kontra: k })) : null,
)

const czesciGotowe = (await czesci).filter(Boolean)
phase('Synteza uwag')
const synteza = czesciGotowe.length ? await agent(WSPOLNE + '\n\nROLA: synteza klasyfikacji uwag CodeRabbita. Masz ' + czesciGotowe.length + ' czesci (ponizej, JSON). ZADANIE: (1) zsumuj koszyki; (2) zbuduj mape luk: per etap pipeline (planner, builder, kazda os review, domkniecie, fix, kontrola) liczba uwag B, klasy, glowny powod, 3-5 id przykladow i KONKRETNY ruch zamykajacy luke z szacunkiem, ile uwag B by zniknelo; (3) lista zmian w .coderabbit.yaml dla koszyka A z liczba uwag, ktore by zniknely (przeczytaj ' + OO + '/.coderabbit.yaml); (4) trend: uwagi B na 100 zmienionych plikow per PR (liczby plikow: PR1 121, PR2 147, PR3 117, PR4 86, PR5 56, PR6 40, PR7 122, PR8 116, PR9 157, PR10 113, PR11 160, PR12 72, PR13 70, PR14 124, PR15 104, PR16 110, PR17 146, PR18 12, PR19 129, PR20 7) — czy naprawy pipeline z 03.09 i 06.09 cos zmienily; (5) wypisz niespojnosci miedzy klasyfikatorami (ta sama klasa w roznych koszykach).\n' +
    'CZESCI (bez pola uwagi[] w calosci — masz podsumowania i probki; pelne listy sa w journalu):\n' + JSON.stringify(czesciGotowe.map((c) => ({ zakres: c.zakres, przeanalizowane: c.przeanalizowane, podsumowanie: c.podsumowanie, uwagiB: c.uwagi.filter((u) => u.koszyk === 'B'), uwagiC: c.uwagi.filter((u) => u.koszyk === 'C'), probkaA: c.uwagi.filter((u) => u.koszyk === 'A').slice(0, 40) })), null, 0),
    { label: 'synteza-uwag-bota', phase: 'Synteza uwag', schema: SYNTEZA, model: 'opus' }) : null

const dp = (await devpr).filter(Boolean)[0] || null
log('1b: czesci ' + czesciGotowe.length + '/3, synteza ' + (synteza ? 'ok' : 'brak') + ', dev-pr ' + (dp ? dp.werdykt.werdykt + ' -> ' + dp.kontra.werdyktPoKontrze : 'brak'))
return {
  koszyki: synteza ? synteza.razem : null,
  mapaLuk: synteza ? synteza.mapaLuk.map((m) => m.etap + ': B=' + m.liczbaB + ' [' + m.klasy.join(', ') + '] -> ' + m.ruch.slice(0, 200)) : null,
  konfiguracjaBota: synteza ? synteza.konfiguracjaBota : null,
  trend: synteza ? synteza.trendPoPR : null,
  niespojnosci: synteza ? synteza.niespojnosciKlasyfikatorow : null,
  devpr: dp ? { werdykt: dp.werdykt.werdykt, pewnosc: dp.werdykt.pewnosc, liczbaTur: dp.werdykt.liczbaTur.slice(0, 400), problemy: dp.werdykt.problemy.map((p) => p.problem), obalony: dp.kontra.obalony, poKontrze: dp.kontra.werdyktPoKontrze, argumenty: dp.kontra.argumenty.map((a) => a.slice(0, 250)) } : null,
}