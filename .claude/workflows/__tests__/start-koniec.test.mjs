// Testy startu i konca runu (PLAN-POPRAWY P4): bramka wejscia autopilota (czystosc, doctor, zielony start z cache po SHA),
// fazy ukonczone po stanie zadania, komenda commita ze stopka po pustej linii oraz archiwizacja w dev-docs-complete-wf
// (pathspec bez CLAUDE.md i *.bak, komunikat `docs(<zadanie>): archiwum`, plik decyzji z polem claude_md, bramka rozmiaru PR).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/start-koniec.test.mjs
//
// DLACZEGO: decyzje bramek zapadaja w JS (agenci tylko zbieraja dane i wykonuja), wiec da sie je sprawdzic bez runtime'u
// Workflow — funkcje wycinamy ze zrodla jak w kontrola-fixa.test.mjs.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { PLIK_MAPY } from '../../scripts/e2e/weryfikacja.mjs'
import { PROG_PLIKOW_PR } from '../../scripts/pr/rozmiar.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))

/**
 * Wycina fragment zrodla workflowu od kotwicy do konca (wlacznie).
 * @param {string} zrodlo
 * @param {string} kotwica
 * @param {string} koniec
 * @returns {string}
 */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

const autopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
const complete = readFileSync(resolve(KATALOG, '../dev-docs-complete-wf.js'), 'utf8')

// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const A = new Function(
  `${wytnij(autopilot, '// ── Bramka wejscia (P4)', '// ── Koniec bramki wejscia')}
   return { decyzjaWejscia, decyzjaTestowStartu, decyzjaClaudeMd, decyzjaBlokeraFazy, fazyUkonczone, instrukcjaCommita }`,
)()

// eslint-disable-next-line no-new-func -- jw.
const C = new Function(
  `${wytnij(complete, '// ── Archiwum (P4)', '// ── Koniec archiwum')}
   return { pathspecArchiwum, krokOgrodu, komunikatArchiwum, szkieletDecyzji, sprawdzDecyzje, czesciPr, czesciZWyniku, uwagaZmiennych, PROG_PLIKOW_PR }`,
)()

const ZADANIE = 'docs/active/zadanie-x'
const FAZY_NOWE = [{ numer: 1, execute: 'pending', review: 'pending', fix: 'none' }]
const CZYSTO = { zmiany: [], doctorKod: 0, doctorWynik: 'WYNIK: OK', kodJakPrzyTescie: null }

// ── Bramka wejscia autopilota ─────────────────────────────────────────────

test('wejscie: doctor bez obowiazkowego narzedzia = STOP z komenda doctora i swiezego runu', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, doctorKod: 1, doctorWynik: 'WYNIK: BRAK obowiązkowych: gh' }, FAZY_NOWE, null)
  assert.ok(d.stop, 'brak narzedzia zatrzymuje run przed faza 1')
  assert.match(d.stop.powod, /^start: doctor/)
  assert.match(d.stop.powod, /BRAK obowiązkowych: gh/)
  assert.match(d.stop.naprawa, /bash \.claude\/scripts\/doctor\/doctor\.sh/)
  assert.match(d.stop.naprawa, /\/dev-autopilot-wf docs\/active\/zadanie-x/)
})

test('wejscie: doctor bez wyniku (stary projekt bez skryptu) = uwaga, run idzie dalej', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, doctorKod: null, doctorWynik: '' }, FAZY_NOWE, null)
  assert.equal(d.stop, null)
  assert.equal(d.uwagi.length, 1)
  assert.match(d.uwagi[0], /doctor/)
})

test('wejscie: czyste drzewo, pierwsza faza przed nami, brak cache = testy startu', () => {
  const d = A.decyzjaWejscia(ZADANIE, CZYSTO, FAZY_NOWE, null)
  assert.deepEqual({ stop: d.stop, commitZadania: d.commitZadania, testyStartu: d.testyStartu }, { stop: null, commitZadania: false, testyStartu: true })
})

test('wejscie: zielony start z cache po SHA i kod bez zmian od testu = bez ponownych testow', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, kodJakPrzyTescie: true }, FAZY_NOWE, { sha: 'abc1234', wynik: 'PASS' })
  assert.equal(d.testyStartu, false)
  assert.equal(d.stop, null)
  assert.ok(d.uwagi.some((/** @type {string} */ u) => u.includes('abc1234')), 'log mowi, z ktorego SHA wzieto wynik')
})

test('wejscie: cache PASS, ale kod zmienil sie od testu = testy startu jeszcze raz', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, kodJakPrzyTescie: false }, FAZY_NOWE, { sha: 'abc1234', wynik: 'PASS' })
  assert.equal(d.testyStartu, true)
})

test('wejscie: zadanie w toku (faza z execute=done) = bez testow startu — kod faz testuje domkniecie', () => {
  const fazy = [{ numer: 1, execute: 'done', review: 'pending', fix: 'none' }, { numer: 2, execute: 'pending', review: 'pending', fix: 'none' }]
  const d = A.decyzjaWejscia(ZADANIE, CZYSTO, fazy, null)
  assert.equal(d.testyStartu, false)
  assert.equal(d.stop, null)
})

test('wejscie: brudny wylacznie katalog zadania = commit zadania i dalej, nie STOP', () => {
  const zmiany = [' M docs/active/zadanie-x/zadanie-x-zadania.md', '?? docs/active/zadanie-x/notatka.md', 'R  docs/active/zadanie-x/a.md -> docs/active/zadanie-x/b.md']
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, zmiany }, FAZY_NOWE, null)
  assert.equal(d.stop, null)
  assert.equal(d.commitZadania, true)
})

test('wejscie: brudne poza katalogiem zadania = STOP z lista sciezek i gotowa komenda', () => {
  const zmiany = [' M docs/active/zadanie-x/zadanie-x-zadania.md', ' M src/app.ts', '?? docs/active/zadanie-x-2/plan.md', 'R  docs/active/zadanie-x/a.md -> docs/b.md']
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, zmiany }, FAZY_NOWE, null)
  assert.ok(d.stop)
  assert.match(d.stop.powod, /niezacommitowane zmiany/, 'kategoria telemetrii: czystosc')
  for (const p of ['src/app.ts', 'docs/active/zadanie-x-2/plan.md', 'docs/b.md']) assert.ok(d.stop.powod.includes(p), `brak ${p} w powodzie`)
  assert.ok(!d.stop.powod.includes('zadanie-x-zadania.md'), 'katalog zadania nie jest zmiana operatora')
  assert.match(d.stop.naprawa, /git status --short/)
  assert.match(d.stop.naprawa, /\/dev-autopilot-wf docs\/active\/zadanie-x/)
})

test('wejscie: sciezka w cudzyslowie (spacja) jest rozpoznana', () => {
  const d = A.decyzjaWejscia(ZADANIE, { ...CZYSTO, zmiany: ['?? "docs/active/zadanie-x/a b.md"'] }, FAZY_NOWE, null)
  assert.equal(d.stop, null)
  assert.equal(d.commitZadania, true)
})

test('testy startu: czerwone = STOP z komenda do odtworzenia i swiezym runem', () => {
  const d = A.decyzjaTestowStartu({ wynik: 'FAIL', sha: 'def5678', komenda: 'pnpm typecheck && pnpm test', bledy: ['src/a.test.ts: expected 1'] }, ZADANIE)
  assert.ok(d.stop)
  assert.match(d.stop.powod, /^start: testy/)
  assert.match(d.stop.powod, /src\/a\.test\.ts/)
  assert.match(d.stop.naprawa, /pnpm typecheck && pnpm test/)
  assert.match(d.stop.naprawa, /\/dev-autopilot-wf docs\/active\/zadanie-x/)
  assert.equal(d.cache, null, 'czerwony wynik nie trafia do cache — po naprawie testy ida jeszcze raz')
})

test('testy startu: zielone = wynik do stanu zadania z SHA', () => {
  const d = A.decyzjaTestowStartu({ wynik: 'PASS', sha: 'def5678', komenda: 'pnpm test', bledy: [] }, ZADANIE)
  assert.equal(d.stop, null)
  assert.deepEqual(d.cache, { sha: 'def5678', wynik: 'PASS' })
})

test('testy startu: agent bez wyniku albo projekt bez testow = uwaga, bez STOP-u i bez cache', () => {
  for (const w of [null, { wynik: 'BRAK-TESTOW', sha: 'def5678', komenda: '', bledy: [] }]) {
    const d = A.decyzjaTestowStartu(w, ZADANIE)
    assert.equal(d.stop, null)
    assert.equal(d.cache, null)
    assert.ok(d.uwaga)
  }
})

// ── Warunek CLAUDE.md po merge'u (P5) ─────────────────────────────────────

/** @param {string} plik @param {string} pole @returns {string} linia `git grep` na galezi main */
const linia = (plik, pole) => `main:docs/decisions/${plik}:claude_md: ${pole}`

test('claude_md: plik decyzji na main z do-uzgodnienia = STOP z komenda uzgodnienia i swiezego runu', () => {
  const d = A.decyzjaClaudeMd({ glowna: 'main', katalog: true, linie: [linia('2026-10-02-smoke-autopilot.md', 'do-uzgodnienia')] }, ZADANIE)
  assert.ok(d.stop, 'nieuzgodniony CLAUDE.md zatrzymuje run przed faza 1')
  assert.match(d.stop.powod, /^start: CLAUDE\.md nieuzgodniony po merge'u/, 'kategoria telemetrii: start')
  assert.match(d.stop.powod, /docs\/decisions\/2026-10-02-smoke-autopilot\.md/)
  assert.match(d.stop.naprawa, /git switch main/)
  assert.match(d.stop.naprawa, /\/dev-pr --claude-md smoke-autopilot/)
  assert.match(d.stop.naprawa, /\/dev-autopilot-wf docs\/active\/zadanie-x/)
})

test('claude_md: wszystkie pliki uzgodniono = dalej, bez uwagi', () => {
  const d = A.decyzjaClaudeMd({ glowna: 'main', katalog: true, linie: [linia('2026-09-30-a.md', 'uzgodniono'), linia('2026-10-01-b.md', 'uzgodniono')] }, ZADANIE)
  assert.deepEqual(d, { stop: null, uwaga: null })
})

test('claude_md: kazdy nieuzgodniony plik na main trafia do STOP-u, takze starszy niz ostatni (decyzja operatora 2026-10-02)', () => {
  const d = A.decyzjaClaudeMd({ glowna: 'main', katalog: true, linie: [
    linia('2026-09-28-stare.md', 'do-uzgodnienia'), linia('2026-09-30-srodkowe.md', 'uzgodniono'), linia('2026-10-01-nowe.md', 'do-uzgodnienia'),
  ] }, ZADANIE)
  assert.ok(d.stop)
  assert.ok(d.stop.powod.includes('2026-09-28-stare.md') && d.stop.powod.includes('2026-10-01-nowe.md'))
  assert.ok(!d.stop.powod.includes('srodkowe'))
  assert.match(d.stop.naprawa, /--claude-md stare/)
  assert.match(d.stop.naprawa, /--claude-md nowe/)
})

test('claude_md: brak docs/decisions/ na main (projekt sprzed zmiany) albo brak galezi glownej = ostrzezenie, nie STOP', () => {
  for (const decyzje of [{ glowna: 'main', katalog: false, linie: [] }, { glowna: null, katalog: false, linie: [] }]) {
    const d = A.decyzjaClaudeMd(decyzje, ZADANIE)
    assert.equal(d.stop, null)
    assert.match(d.uwaga ?? '', /docs\/decisions/)
  }
})

// ── Koniec runu autopilota ────────────────────────────────────────────────

// P25 A1 (vibersi etap 5): „[blokuje: faza 3]” bylo tylko informacja w planie zadania — run przeszedl fazy 3–6 bez serwera
// Hono w E2E i 7 scenariuszy poszlo na [Manual]. Teraz nieodhaczony bloker zatrzymuje run przed swoja faza.
const PREP = 'docs/operator/zadanie-x-przygotowanie.md'
const BLOKER_3 = { faza: 3, linia: 110, tresc: 'Podmiana `E2E_START` w `.env.e2e` — **[blokuje: faza 3]** (IU-5)' }

test('bloker fazy: nieodhaczona pozycja tej fazy = STOP z linia checklisty, commitem odhaczenia i swiezym runem', () => {
  const d = A.decyzjaBlokeraFazy(3, { checklista: PREP, blokery: [BLOKER_3] }, ZADANIE)
  assert.ok(d, 'faza 3 nie rusza z otwartym blokerem')
  assert.match(d.powod, /^Faza 3: nieodhaczony bloker operatora/)
  assert.match(d.powod, /Podmiana `E2E_START`/)
  assert.match(d.naprawa, /docs\/operator\/zadanie-x-przygotowanie\.md:110/)
  assert.match(d.naprawa, /git add docs\/operator\/zadanie-x-przygotowanie\.md && git commit/)
  assert.match(d.naprawa, /\/dev-autopilot-wf docs\/active\/zadanie-x/)
})

test('bloker fazy: pozycja pozniejszej fazy nie zatrzymuje wczesniejszej; wczesniejszej fazy (wznowienie) — zatrzymuje', () => {
  assert.equal(A.decyzjaBlokeraFazy(2, { checklista: PREP, blokery: [BLOKER_3] }, ZADANIE), null)
  const d = A.decyzjaBlokeraFazy(4, { checklista: PREP, blokery: [BLOKER_3] }, ZADANIE)
  assert.ok(d, 'bloker fazy 3 nadal otwarty przy fazie 4 (wznowienie po STOP-ie) — faza 4 tez go potrzebuje')
  assert.match(d.powod, /^Faza 4:/)
})

test('bloker fazy: kilka pozycji w jednym STOP-ie; brak checklisty albo pusta lista = bez STOP-u', () => {
  const drugi = { faza: 1, linia: 12, tresc: 'Konto Resend — **[blokuje: faza 1]**' }
  const d = A.decyzjaBlokeraFazy(3, { checklista: PREP, blokery: [drugi, BLOKER_3] }, ZADANIE)
  assert.ok(d)
  assert.match(d.naprawa, /:12\b[\s\S]*:110\b/)
  assert.equal(A.decyzjaBlokeraFazy(1, { checklista: null, blokery: [] }, ZADANIE), null)
  assert.equal(A.decyzjaBlokeraFazy(1, { checklista: PREP, blokery: [] }, ZADANIE), null)
})

test('bloker fazy: autopilot sprawdza pierwsza faze przed testami startu, a kazda faze petli przed execute (STOP z jej numerem)', () => {
  const start = autopilot.indexOf('const blokerStartu = pierwszaFaza ? decyzjaBlokeraFazy(pierwszaFaza.numer, stan.wejscie.blokery, sciezka)')
  assert.ok(start > 0 && start < autopilot.indexOf('if (wejscie.testyStartu) {'), 'bloker pierwszej fazy przed testami startu')
  const petla = wytnij(autopilot, 'for (const numerFazy of kolejka) {', "if (faza.execute === 'pending') {")
  assert.match(petla, /const bloker = decyzjaBlokeraFazy\(numerFazy, stan\.wejscie\.blokery, sciezka\)\s*\n\s*if \(bloker\) \{\s*\n\s*return await stopRun\(\{ \.\.\.bloker, faza: numerFazy/)
})

test('fazyUkonczone liczy fazy domkniete w zadaniu, nie tylko w tym runie', () => {
  const fazy = [
    { numer: 1, execute: 'done', review: 'done', fix: 'none' },
    { numer: 2, execute: 'done', review: 'done', fix: 'done' },
    { numer: 3, execute: 'done', review: 'done', fix: 'pending' },
    { numer: 4, execute: 'pending', review: 'pending', fix: 'none' },
  ]
  assert.equal(A.fazyUkonczone(fazy), 2)
})

test('instrukcja commita: temat w pierwszym -m, stopka tylko w drugim -m (git wstawia pusta linie)', () => {
  const tekst = A.instrukcjaCommita("docs(zadanie-x): stan pipeline'u po STOP (faza 2)")
  assert.ok(tekst.includes('git commit -m "docs(zadanie-x): stan pipeline\'u po STOP (faza 2)"'))
  assert.match(tekst, /drugim `-m`/)
})

// ── Archiwizacja (dev-docs-complete-wf) ───────────────────────────────────

test('pathspec archiwum: katalogi zadania, smoke, decyzje i wyjscia compound; bez CLAUDE.md, .claude/rules/ i *.bak', () => {
  const p = C.pathspecArchiwum('zadanie-x', 'docs/operator/2026-10-02-zadanie-x-smoke.md', ['docs/solutions', 'docs/learned-patterns.md'])
  for (const s of ['docs/active/zadanie-x', 'docs/completed/zadanie-x', 'docs/operator/2026-10-02-zadanie-x-smoke.md', 'docs/decisions', 'docs/solutions', 'docs/learned-patterns.md']) {
    assert.ok(p.split(' ').includes(s), `brak ${s}`)
  }
  assert.ok(!p.includes('CLAUDE.md'))
  assert.ok(p.includes("':(exclude,glob)**/*.bak'"), 'kopie robocze operatora nie wchodza do archiwum')
  // Zmiana kontraktu (P14 S2): jedynym plikiem .claude/ w archiwum jest mapa funkcji skilla weryfikacji projektu.
  assert.deepEqual(p.split(' ').filter((/** @type {string} */ s) => s.startsWith('.claude/')), [PLIK_MAPY], 'wiedza projektu lezy w docs/; z .claude/ tylko mapa funkcji')
})

test('pathspec archiwum bez smoke i bez compound', () => {
  assert.equal(C.pathspecArchiwum('zadanie-x', '', []), `docs/active/zadanie-x docs/completed/zadanie-x docs/decisions ${PLIK_MAPY} ':(exclude,glob)**/*.bak'`)
})

test('archiwizacja dopisuje funkcje zadania do mapy przed przeniesieniem folderu; skill dev-docs-complete ma ten sam krok', () => {
  const kroki = complete.slice(complete.indexOf('Kroki (zgodnie ze skillem):'))
  const mapa = kroki.indexOf('node .claude/scripts/e2e/e2e.mjs mapa --zadanie docs/active/${nazwaZadania}')
  assert.ok(mapa > 0, 'brak kroku mapy funkcji w poleceniu archiwizacji')
  assert.ok(mapa < kroki.indexOf('4. Przenies'), 'mapa czyta plan zadania z docs/active/ — przed przeniesieniem')
  assert.ok(complete.includes(`const MAPA_FUNKCJI = '${PLIK_MAPY}'`), 'kopia sciezki mapy w complete-wf = PLIK_MAPY')
  assert.match(kroki, /git check-ignore -q <sciezka>/, 'sciezka ignorowana przez git (np. .claude/ w .gitignore projektu) daje git add z kodem 1 — pomijana jak nieistniejaca')
  const skill = readFileSync(resolve(KATALOG, '../../skills/dev-docs-complete/SKILL.md'), 'utf8')
  assert.ok(skill.indexOf('e2e.mjs mapa --zadanie docs/active/$ARGUMENTS') > 0)
  assert.ok(skill.indexOf('e2e.mjs mapa') < skill.indexOf('5. **Utwórz podsumowanie'), 'w skillu mapa przed przeniesieniem plikow')
})

test('sekcja Ogrod (P15): krok 4b z sekcja doslownie miedzy znacznikami; bez sekcji (standalone) krok znika', () => {
  const sekcja = '## Ogród\n\n- any: 4 (+1)\n\nOgrodnik niczego nie zmienił w kodzie.\n'
  const k = C.krokOgrodu('zadanie-x', sekcja)
  assert.match(k, /^4b\. Na koniec docs\/completed\/zadanie-x\/zadanie-x-podsumowanie\.md dopisz sekcje ogrodnika DOSLOWNIE/)
  assert.ok(k.includes(`<<<OGROD\n${sekcja.trim()}\nOGROD>>>\n`))
  assert.equal(C.krokOgrodu('zadanie-x', ''), '')
  const kroki = complete.slice(complete.indexOf('Kroki (zgodnie ze skillem):'))
  const krok = kroki.indexOf('${krokOgrodu(nazwaZadania, sekcjaOgrodu)}')
  assert.ok(krok > kroki.indexOf('4. Przenies') && krok < kroki.indexOf('5. Jesli'), 'krok 4b po utworzeniu podsumowania, przed stemplem stanu')
  assert.match(complete, /const sekcjaOgrodu = \(args && typeof args\.sekcjaOgrodu === 'string'\) \? args\.sekcjaOgrodu : ''/)
})

test('komunikat commita archiwizacji', () => {
  assert.equal(C.komunikatArchiwum('smoke-autopilot'), 'docs(smoke-autopilot): archiwum')
})

test('szkielet pliku decyzji ma frontmatter z polem claude_md: do-uzgodnienia', () => {
  const s = C.szkieletDecyzji('zadanie-x')
  assert.match(s, /^---\nzadanie: zadanie-x\ndata: <data z `date \+%F`>\nclaude_md: do-uzgodnienia\n---\n/)
})

test('plik decyzji: poprawna sciezka i pole = bez uwagi; brak pliku, zla sciezka albo inne pole = UWAGA', () => {
  assert.equal(C.sprawdzDecyzje({ plik: 'docs/decisions/2026-10-02-zadanie-x.md', claudeMd: 'do-uzgodnienia' }, 'zadanie-x'), null)
  for (const d of [null, { plik: '', claudeMd: '' }, { plik: 'docs/decisions/zadanie-x.md', claudeMd: 'do-uzgodnienia' }, { plik: 'docs/decisions/2026-10-02-zadanie-x.md', claudeMd: 'uzgodniono' }]) {
    assert.match(C.sprawdzDecyzje(d, 'zadanie-x') ?? '', /^UWAGA/)
  }
})

// P20 S2: czesci PR na commitach konca faz (czesci.mjs) zamiast rady „per katalog” — vibersi etap 3: 172 pliki do recenzji,
// ciecie po fazie 3 (909f669): 93 / 101 w archiwum (121 z poprawkami ze smoke'a).
const SHA_A = '6ada855e2f76cd1fcc61bba55e21ccf548962145'
const SHA_B = '909f669f0efce8a340f5e541573fa3ea43259f11'
const SHA_C = '08e5584634418dfb79b302d6284666327bff3bdd'
/** @param {Record<string, unknown>[]} czesci @param {Record<string, unknown>} [reszta] */
const wynikCzesci = (czesci, reszta = {}) => `log\n${JSON.stringify({ ok: true, zrodlo: 'pomiar', uwaga: null, czesci, ...reszta })}`

test('czesci PR: dwie czesci = tabela z commitami ciecia do podsumowania i informacja (nie UWAGA); jedna do 150 = nic', () => {
  assert.equal(C.PROG_PLIKOW_PR, PROG_PLIKOW_PR, 'kopia progu w complete-wf = rozmiar.mjs')
  const dwie = C.czesciPr(C.czesciZWyniku(wynikCzesci([
    { czesc: 1, fazy: '1–3', od: SHA_A, do: SHA_B, doRecenzji: 93 }, { czesc: 2, fazy: '4–6', od: SHA_B, do: SHA_C, doRecenzji: 101 },
  ])), 'etap-3')
  assert.equal(dwie.uwaga, 'PR w 2 częściach: część 1: fazy 1–3 (93), część 2: fazy 4–6 (101) — commity cięcia w podsumowaniu, wysyłka: `/clear`, potem `/dev-pr --czesc 1`')
  assert.ok(dwie.sekcja?.includes('| Część | Fazy | Od | Do | Plików do recenzji |\n|---|---|---|---|---|\n| 1 | 1–3 | 6ada855e2f76 | 909f669f0efc | 93 |\n| 2 | 4–6 | 909f669f0efc | czubek gałęzi | 101 |'), dwie.sekcja ?? '')
  assert.match(dwie.sekcja ?? '', /^PR w 2 częściach \(cięcie: pomiar na końcach faz;/)
  assert.doesNotMatch(`${dwie.uwaga}${dwie.sekcja}`, /per obszar|per katalog/)
  const jedna = (/** @type {number} */ n) => C.czesciPr(C.czesciZWyniku(wynikCzesci([{ czesc: 1, fazy: '1–2', od: SHA_A, do: SHA_C, doRecenzji: n }])), 'z')
  assert.deepEqual(jedna(150), { uwaga: null, sekcja: null })
  assert.match(jedna(151).uwaga ?? '', /^UWAGA: PR powyżej progu 150 plików do recenzji bota — część 1: fazy 1–2 \(151\)$/)
  assert.equal(jedna(151).sekcja, null)
})

test('czesci PR: czesc >= 150 albo uwaga skryptu = UWAGA (tabela zostaje); wynik nieczytelny, wyjatek albo zly SHA = UWAGA o braku pomiaru', () => {
  const zaDuza = C.czesciPr(C.czesciZWyniku(wynikCzesci([
    { czesc: 1, fazy: '1', od: SHA_A, do: SHA_B, doRecenzji: 160 }, { czesc: 2, fazy: '2', od: SHA_B, do: SHA_C, doRecenzji: 10 },
  ], { ok: false, uwaga: 'bez cięcia na granicy faz poniżej 150: część 1 (fazy 1) 160 — faza powyżej limitu bota, dziel zadanie w planowaniu' })), 'z')
  assert.match(zaDuza.uwaga ?? '', /^UWAGA: bez cięcia na granicy faz poniżej 150: .* dziel zadanie w planowaniu — część 1: fazy 1 \(160\), część 2: fazy 2 \(10\)$/)
  assert.ok(zaDuza.sekcja?.includes('| 1 | 1 | 6ada855e2f76 | 909f669f0efc | 160 |'))
  const rowna = C.czesciPr(C.czesciZWyniku(wynikCzesci([
    { czesc: 1, fazy: '1', od: SHA_A, do: SHA_B, doRecenzji: 150 }, { czesc: 2, fazy: '2', od: SHA_B, do: SHA_C, doRecenzji: 10 },
  ])), 'z')
  assert.match(rowna.uwaga ?? '', /^UWAGA: część z 150 lub więcej plikami do recenzji bota \(część ma mieć mniej\) — część 1: fazy 1 \(150\)/, 'czesc rowna progowi = UWAGA')
  for (const zly of ['', 'nie JSON', '{"wyjatek":"brak stanu"}', wynikCzesci([{ czesc: 1, fazy: '1', od: 'HEAD; rm -rf /', do: SHA_C, doRecenzji: 3 }])]) {
    assert.deepEqual(C.czesciPr(C.czesciZWyniku(zly), 'z'), {
      uwaga: 'UWAGA: części PR niezmierzone (wynik czesci.mjs nieczytelny) — sprawdz: `node .claude/scripts/pr/czesci.mjs --zadanie docs/completed/z`', sekcja: null,
    }, zly)
  }
  assert.match(complete, /9\. Czesci PR-a: \\`node \.claude\/scripts\/pr\/czesci\.mjs --zadanie docs\/completed\/\$\{nazwaZadania\}\\`/)
  assert.match(complete, /if \(pr\.sekcja && wynik\.commit\)/)
  assert.match(complete, /## Części PR\n\n\$\{pr\.sekcja\}/)
})

// P8: fix naprawia tylko P1/P2, P3 zostaja w known-issues (sekcje "## P3 faza N") — smoke operatora ich nie bierze.
test('smoke operatora: z "Do poprawy" i known-issues otwarte P1/P2; sekcje "## P3 faza N" zostaja w known-issues', () => {
  /** @type {(nazwaZadania: string) => string} */
  // eslint-disable-next-line no-new-func -- jw.
  const smokePrompt = new Function(`return (nazwaZadania) => {\n${wytnij(complete, 'const smokePrompt = `', 'Zwroc obiekt zgodny ze schematem.`')}\nreturn smokePrompt\n}`)()
  const p = smokePrompt('zadanie-x')
  assert.match(p, /otwarte \[P1\]\/\[P2\] z\s+"## Do poprawy po review fazy N"/)
  assert.match(p, /sekcje "## P3 faza N" pomin/)
  assert.doesNotMatch(p, /otwarte P3/)
})

// P19: vibersi etap 2 — SUPABASE_SECRET_KEY (odchylenie faz 1–2, jest w .env.example) nie trafila do smoke'u, bo agent przepisal
// zmienne z planu. Agent smoke'u liczy zmienne skryptem i nie konczy przy brakach; JS sprawdza ostatni wynik kontroli.
test('smoke: zmienne srodowiska galezi skryptem (krok 6) i kontrola po zapisie; JS: braki albo zmienne bez pliku = UWAGA, czysto = brak uwagi', () => {
  /** @type {(nazwaZadania: string) => string} */
  // eslint-disable-next-line no-new-func -- jw.
  const smokePrompt = new Function(`return (nazwaZadania) => {\n${wytnij(complete, 'const smokePrompt = `', 'Zwroc obiekt zgodny ze schematem.`')}\nreturn smokePrompt\n}`)()
  const p = smokePrompt('zadanie-x')
  assert.match(p, /6\. ZMIENNE SRODOWISKA dodane w galezi: `node \.claude\/scripts\/smoke\/zmienne\.mjs`/)
  assert.match(p, /KONTROLA ZMIENNYCH po zapisie pliku: `node \.claude\/scripts\/smoke\/zmienne\.mjs --smoke <plik>`\. Kod 1 = pole braki[\s\S]*Nie konczysz, dopoki kod nie jest 0/)
  assert.match(p, /spoza zrodel \(1\)-\(6\)/)
  assert.match(wytnij(complete, 'const SMOKE_RESULT = {', '\n}\n'), /required: \['plik', 'pozycje', 'e2eNieuruchomione', 'zmienne'\]/)
  const z = (/** @type {object} */ o) => `cos\n${JSON.stringify(o)}`
  const sekretny = { nazwa: 'SUPABASE_SECRET_KEY', zrodla: ['.env.example:17'] }
  assert.equal(C.uwagaZmiennych({ plik: 'docs/operator/s.md', zmienne: z({ baza: 'a', zmienne: [sekretny], braki: [] }) }), null)
  assert.equal(C.uwagaZmiennych({ plik: '', zmienne: z({ baza: 'a', zmienne: [] }) }), null)
  assert.equal(C.uwagaZmiennych(null), null, 'agent smoke padl — osobny status, bez uwagi o zmiennych')
  assert.match(C.uwagaZmiennych({ plik: 'docs/operator/s.md', zmienne: z({ baza: 'a', zmienne: [sekretny], braki: ['SUPABASE_SECRET_KEY'] }) }), /^UWAGA: zmienne srodowiska dodane w galezi bez pozycji w smoke'u: SUPABASE_SECRET_KEY/)
  assert.match(C.uwagaZmiennych({ plik: '', zmienne: z({ baza: 'a', zmienne: [sekretny] }) }), /bez pozycji w smoke'u: SUPABASE_SECRET_KEY/)
  assert.match(C.uwagaZmiennych({ plik: 'docs/operator/s.md', zmienne: z({ baza: 'a', zmienne: [sekretny] }) }), /bez --smoke/)
  assert.match(C.uwagaZmiennych({ plik: 'docs/operator/s.md', zmienne: 'Error: cos' }), /^UWAGA: kontrola zmiennych srodowiska w smoke'u bez wyniku/)
  assert.match(complete, /const uwagi = \[sprawdzDecyzje\(wynik\.decyzje, nazwaZadania\), pr\.uwaga, uwagaZmiennych\(smoke\)\]/)
})

// P22 B2: vibersi etap 4 — smoke i oba PR w jednej sesji: sesja glowna 4,49 M wobec 1,42 M wszystkich runow PR. Ramka smoke'u
// konczy sie linia z /clear i /dev-pr; sama sesja smoke'u PR nie wysyla. Ta sama tresc w workflowie i w skillu.
test('smoke: ramka „Jak kontynuowac” konczy smoke linia „Następny krok: /clear, potem /dev-pr --czesc 1” bez /dev-pr w sesji', () => {
  /** @type {(nazwaZadania: string) => string} */
  // eslint-disable-next-line no-new-func -- jw.
  const smokePrompt = new Function(`return (nazwaZadania) => {\n${wytnij(complete, 'const smokePrompt = `', 'Zwroc obiekt zgodny ze schematem.`')}\nreturn smokePrompt\n}`)()
  const linia = 'Po ostatnim punkcie zakończ linią „Następny krok: /clear, potem /dev-pr --czesc 1” (podsumowanie zadania'
  assert.ok(smokePrompt('zadanie-x').includes(linia))
  assert.match(smokePrompt('zadanie-x'), /„Następny krok: \/clear, potem \/dev-pr”\)\. \/dev-pr w tej sesji nie uruchamiaj\./)
  const skill = readFileSync(resolve(KATALOG, '../../skills/dev-docs-complete/SKILL.md'), 'utf8')
  assert.ok(skill.includes(linia))
  assert.match(skill, /„Następny krok: \/clear, potem \/dev-pr”\)\. \/dev-pr w tej sesji nie uruchamiaj\./)
})

// P24 IU-8: punkty wizualne smoke'u w formacie czytanym przez narzedzie makiet (.claude/scripts/makieta/), odeslanie do /makieta
// przed pierwszym punktem wizualnym i w ramce „Jak kontynuowac”, kontrola formatu skryptem. Te same zdania w workflowie i w skillu.
test('smoke: format punktu wizualnego, zdanie o /makieta przed punktami i w ramce, kontrola makieta.mjs sprawdz — w workflowie i w skillu', () => {
  /** @type {(nazwaZadania: string) => string} */
  // eslint-disable-next-line no-new-func -- jw.
  const smokePrompt = new Function(`return (nazwaZadania) => {\n${wytnij(complete, 'const smokePrompt = `', 'Zwroc obiekt zgodny ze schematem.`')}\nreturn smokePrompt\n}`)()
  const p = smokePrompt('zadanie-x')
  const skill = readFileSync(resolve(KATALOG, '../../skills/dev-docs-complete/SKILL.md'), 'utf8')
  const zdania = [
    'Punkt wizualny ma postać „- [ ] <Urządzenie>[, <stan>]: `<trasa>` obok `visual-diff/<ekran>-figma.png` (viewport <W>×<H>) → Wejście: <adres z przykładowym slugiem z seeda i co kliknąć>. Porównaj: <2–4 konkretne elementy z makiety albo SPEC>. Stany: <każdy stan i jak go wywołać: panel „Sieć”, konto, dane; „brak” dla ekranu bez stanów>”: trasa w backtickach z przykładowym slugiem z seeda (bez znanej trasy „<opis wejścia> obok …”), jedna makieta na punkt, viewport bez dwukropka, bez ogólników typu „zgodne z makietą”.',
    'Punkty wizualne przejdziesz narzędziem makiet: w sesji smoke\'u wpisz /makieta.',
    'Przy punktach wizualnych uruchom /makieta; przed /clear zatrzymaj narzędzie (makieta.mjs stop).',
    'Punktem wizualnym jest pozycja ze źródeł (1)–(6), która porównuje ekran z makietą, gdy `docs/active/<zadanie>/visual-diff/<ekran>-figma.png` istnieje; W×H to wymiary makiety z tabeli SPEC.md albo nagłówka `ekrany/<ekran>.md`, ze znakiem ×.',
    'Kontrola makiet po zapisie pliku: `node .claude/scripts/makieta/makieta.mjs sprawdz --smoke <plik> --pola`. Kod 1 = pole problemy (linie spoza formatu albo bez PNG makiety) — popraw wskazane linie i uruchom kontrolę jeszcze raz; smoke bez punktów wizualnych daje kod 0.',
  ]
  for (const z of zdania) {
    assert.ok(p.includes(z), `workflow: ${z}`)
    assert.ok(skill.replace(/\n\s+/g, ' ').includes(z), `skill: ${z}`)
  }
  for (const tekst of [p, skill.replace(/\n\s+/g, ' ')]) assert.match(tekst, /Przed pierwszym punktem wizualnym smoke'u stoi zdanie:? [„"]Punkty wizualne przejdziesz narzędziem makiet/)
  // Ramka nadal konczy sie zdaniami o „Następny krok” (P22 B2) — zdanie o /makieta stoi przed nimi.
  const ramka = skill.slice(skill.indexOf('## Jak kontynuować w nowej sesji'))
  assert.ok(ramka.indexOf(zdania[2]) !== -1 && ramka.indexOf(zdania[2]) < ramka.indexOf('Po ostatnim punkcie zakończ linią'))
  assert.match(ramka, /\/dev-pr w tej sesji nie uruchamiaj\.\n {3}```/)
  assert.ok(p.indexOf(zdania[2]) < p.indexOf('Po ostatnim punkcie zakończ linią'))
})

// P24 IU-8 po recenzji: szablon kroku 3 daje punkt wizualny, ktory przechodzi kontrole formatu narzedzia; zdanie o /makieta
// stoi bezposrednio przed nim; skill /makieta uzywa stalych narzedzia (limit Monitora, port w Redirect URLs).
test('smoke: przykładowy punkt wizualny szablonu przechodzi makieta sprawdzFormat; skill /makieta ze stałymi narzędzia', async () => {
  const { sprawdzFormat } = await import('../../scripts/makieta/punkty.mjs')
  const { LIMIT_CZEKANIA_MIN } = await import('../../scripts/makieta/kolejka.mjs')
  const { DOMYSLNY_PORT } = await import('../../scripts/makieta/proces.mjs')
  const skill = readFileSync(resolve(KATALOG, '../../skills/dev-docs-complete/SKILL.md'), 'utf8')
  const linie = skill.split('\n')
  const i = linie.findIndex((l) => /^ {3}- \[ \] .*obok `visual-diff\/<ekran>-figma\.png`/.test(l))
  assert.ok(i > 0, 'szablon ma punkt wizualny')
  assert.deepEqual(sprawdzFormat(linie[i].trimStart().replaceAll('<ekran>', 'moje-projekty').replaceAll('<trasa>', '/konto')), [], 'po podstawieniu placeholderów')
  assert.match(linie[i - 1], /^ {3}Punkty wizualne przejdziesz narzędziem makiet: w sesji smoke'u wpisz \/makieta\./)
  const makieta = readFileSync(resolve(KATALOG, '../../skills/makieta/SKILL.md'), 'utf8')
  assert.ok(makieta.includes(`makieta.mjs czekaj --limit-min ${LIMIT_CZEKANIA_MIN}`))
  assert.ok(makieta.includes(`http://127.0.0.1:${DOMYSLNY_PORT}/**`))
  assert.ok(makieta.includes('zgloszenia --smoke <plik>'))
  assert.ok(!/Read[^\n]*PNG|otwórz[^\n]*PNG/i.test(makieta), 'skill nie każe czytać PNG')
})

// P28 (4): zgloszenia na koniec przegladu — skill zna zdarzenie konca przegladu, tryb „od razu” i dokument ustalen.
test('skill /makieta: zdarzenie przeglad-zakonczony, --zgloszenia od-razu na prośbę, dokument ustaleń przed poprawkami', () => {
  const makieta = readFileSync(resolve(KATALOG, '../../skills/makieta/SKILL.md'), 'utf8')
  assert.ok(makieta.includes('Zdarzenie `przeglad-zakonczony`'))
  assert.ok(makieta.includes('`--zgloszenia od-razu`'))
  assert.ok(makieta.includes('docs/operator/<data>-<zadanie>-makiety-ustalenia.md'))
  assert.ok(makieta.indexOf('## Koniec przeglądu') < makieta.indexOf('## Droga awaryjna'))
  assert.match(makieta, /Zakończ\s+przegląd/)
  assert.match(makieta, /Kolejne `przeglad-zakonczony`[^]*?aktualizuje\s+ten sam dokument ustaleń/)
  assert.match(makieta, /W trybie „na koniec” po przeglądzie\s+obsłuż je jak w sekcji „Koniec przeglądu”/)
})

// P28 (6): adres narzedzia w uslugach z lista hostow — skill podaje pole `hosty` startu i wpis Turnstile.
test('skill /makieta: pole hosty z wyniku startu i host 127.0.0.1 w widgecie Turnstile', () => {
  const makieta = readFileSync(resolve(KATALOG, '../../skills/makieta/SKILL.md'), 'utf8')
  assert.ok(makieta.includes('`hosty`'))
  assert.match(makieta, /Turnstile wymaga `127\.0\.0\.1` w hostach\s+widgetu/)
})
