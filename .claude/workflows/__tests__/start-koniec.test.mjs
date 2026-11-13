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
   return { decyzjaWejscia, decyzjaTestowStartu, decyzjaClaudeMd, decyzjaBlokeraFazy, decyzjaSpojnosci, fazyUkonczone, instrukcjaCommita }`,
)()

// eslint-disable-next-line no-new-func -- jw.
const C = new Function(
  `${wytnij(complete, '// ── Archiwum (P4)', '// ── Koniec archiwum')}
   return { pathspecArchiwum, krokOgrodu, komunikatArchiwum, szkieletDecyzji, sprawdzDecyzje, czesciPr, czesciZWyniku, uwagaZmiennych, zdanieOtwartych, PROG_PLIKOW_PR }`,
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
  // Pilot Nawykometr W21: galaz zadania zalozona przed uzgodnieniem nie ma nowego CLAUDE.md.
  assert.match(d.stop.naprawa, /wroc na galaz zadania, wciagnij uzgodniony CLAUDE\.md \(`git merge main`\) i swiezy run/)
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

// Weryfikacja partii 26–45, punkt 53: autopilot nie sprawdzal przegladu spojnosci planu — plan bez przegladu szedl do runu.
// Swieze zadanie = STOP na starcie; zadanie w toku (aa-exam E3, planowane przed bramka) = uwaga; brak pola = brak kontroli.
const CZERWONA = { ok: false, powod: 'plan zmieniony po przeglądzie spójności (odcisk inny niż w docs/plans/p.spojnosc.json) → /dev-plan krok 6.2b' }
const SWIEZE = [{ numer: 1, execute: 'pending', review: 'pending', fix: 'none' }, { numer: 2, execute: 'pending', review: 'pending', fix: 'none' }]

test('punkt 53: swieze zadanie bez waznego przegladu spojnosci = STOP z powodem ze skryptu i naprawa 6.2b + swiezy run', () => {
  const d = A.decyzjaSpojnosci(SWIEZE, CZERWONA, ZADANIE)
  assert.equal(d.uwaga, null)
  assert.ok(d.stop)
  assert.equal(d.stop.powod, `start: przeglad spojnosci planu — ${CZERWONA.powod}`)
  assert.equal(d.stop.naprawa, '/dev-plan krok 6.2b (przeglad spojnosci), potem swiezy run: w osobnej wiadomosci z samym poleceniem (bez warunkow i prosb): /dev-autopilot-wf docs/active/zadanie-x')
})

test('punkt 53: zadanie w toku (faza zbudowana albo jednostki zapisane) = tylko uwaga; przeglad ok albo brak pola = nic', () => {
  const zbudowana = [{ ...SWIEZE[0], execute: 'done' }, SWIEZE[1]]
  const przerwana = [{ ...SWIEZE[0], iuUkonczone: ['IU-1'] }, SWIEZE[1]]
  for (const fazy of [zbudowana, przerwana]) {
    const d = A.decyzjaSpojnosci(fazy, CZERWONA, ZADANIE)
    assert.equal(d.stop, null)
    assert.equal(d.uwaga, `przeglad spojnosci planu nieaktualny, zadanie w toku — run idzie dalej: ${CZERWONA.powod}`)
  }
  assert.deepEqual(A.decyzjaSpojnosci([{ ...SWIEZE[0], iuUkonczone: [] }], CZERWONA, ZADANIE).stop?.naprawa.startsWith('/dev-plan'), true, 'pusta lista iuUkonczone to swieze zadanie')
  assert.deepEqual(A.decyzjaSpojnosci(SWIEZE, { ok: true, powod: '' }, ZADANIE), { stop: null, uwaga: null })
  assert.deepEqual(A.decyzjaSpojnosci(SWIEZE, undefined, ZADANIE), { stop: null, uwaga: null }, 'starszy plan.mjs bez pola')
})

// Analiza vibersi audyt-paczki-1-2: faza zamknieta bez czytania za zgoda operatora — bramka zielona z zastrzezeniem.
test('przeglad spojnosci z zastrzezeniem (ok, powod „OK z zastrzezeniem”) = bez STOP, uwaga z powodem; takze w zadaniu w toku', () => {
  const zastrzezenie = { ok: true, powod: 'OK z zastrzeżeniem: faza 3 zmieniona po ostatnim czytaniu (decyzja operatora)' }
  for (const fazy of [SWIEZE, [{ ...SWIEZE[0], execute: 'done' }, SWIEZE[1]]]) {
    assert.deepEqual(A.decyzjaSpojnosci(fazy, zastrzezenie, ZADANIE), { stop: null, uwaga: `przeglad spojnosci planu: ${zastrzezenie.powod}` })
  }
})

test('punkt 53: bootstrap przepisuje spojnosc z plan.mjs blokery; schemat ja dopuszcza; decyzja przed blokerem i testami startu', () => {
  const schemat = wytnij(autopilot, '        blokery: {\n', "      required: ['zmiany', 'doctorKod'")
  assert.match(schemat, /spojnosc: \{\n\s+type: 'object',\n\s+additionalProperties: false,\n\s+properties: \{ ok: \{ type: 'boolean' \}, powod: \{ type: 'string' \} \},\n\s+required: \['ok', 'powod'\],/)
  // Pole w `properties` obiektu blokery (additionalProperties: false), opcjonalne: starszy skrypt go nie zwraca.
  assert.match(schemat, /required: \['ok', 'powod'\],\n {12}\},\n {10}\},\n {10}required: \['checklista', 'blokery'\],/)
  assert.match(schemat, /required: \['faza', 'linia', 'tresc'\],\n {14}\},\n {12}\},\n {12}\/\/ Punkt 53: stan przegladu/, 'spojnosc obok checklista i blokery, nie za properties')
  assert.match(autopilot, /przepisz pola\n {3}checklista, blokery i spojnosc \(gdy wynik je ma\) 1:1 do wejscie\.blokery/)
  const decyzja = autopilot.indexOf('const bramkaSpojnosci = decyzjaSpojnosci(stan.fazy, stan.wejscie.blokery && stan.wejscie.blokery.spojnosc, sciezka)')
  assert.ok(decyzja > 0 && decyzja < autopilot.indexOf('const blokerStartu = ') && decyzja < autopilot.indexOf('if (wejscie.testyStartu) {'))
  assert.match(autopilot, /if \(bramkaSpojnosci\.stop\) \{\n {2}return await stopRun\(\{ \.\.\.bramkaSpojnosci\.stop, stan \}\)/)
  assert.match(autopilot, /uwagaSpojnosci: bramkaSpojnosci\.uwaga,/)
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
  assert.equal(dwie.uwaga, "PR w 2 częściach: część 1: fazy 1–3 (93), część 2: fazy 4–6 (101) — commity cięcia w podsumowaniu, po smoke'u: `/clear`, potem `/dev-pr 3 --bez-merge --czesc 1`")
  // Punkt 38: tabela w podsumowaniu podaje tryb autonomiczny bez merge'a dla pierwszej i ostatniej czesci.
  assert.ok(dwie.sekcja?.endsWith("Wysyłka po smoke'u: `/clear`, potem `/dev-pr 3 --bez-merge --czesc 1`; po merge'u każdej części `/clear` i następna, do `/dev-pr 3 --bez-merge --czesc 2` (rebase na główną gałąź)."), dwie.sekcja ?? '')
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
  // Punkt 40, krok 2: zrodlo 7 to wiersze sekcji decyzji z known-issues.
  assert.match(p, /spoza zrodel \(1\)-\(7\)/)
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
  assert.match(complete, /const uwagi = \[sprawdzDecyzje\(wynik\.decyzje, nazwaZadania\), pr\.uwaga, uwagaZmiennych\(smoke\),/)
})

// P22 B2: vibersi etap 4 — smoke i oba PR w jednej sesji: sesja glowna 4,49 M wobec 1,42 M wszystkich runow PR. Sesja smoke'u
// konczy sie linia z /clear i /dev-pr, sama PR nie wysyla. Punkt 40, krok 4: dluga ramka do wklejania zniknela, smoke prowadzi
// skill /dev-smoke; sekcja „Jak kontynuowac” w pliku smoke'u (workflow i skill archiwizacji) podaje komende skilla i linie konca.
test('smoke: sekcja „Jak kontynuowac” odsyla do /dev-smoke, a /dev-smoke konczy linia „Następny krok” bez /dev-pr w sesji', () => {
  /** @type {(nazwaZadania: string) => string} */
  // eslint-disable-next-line no-new-func -- jw.
  const smokePrompt = new Function(`return (nazwaZadania) => {\n${wytnij(complete, 'const smokePrompt = `', 'Zwroc obiekt zgodny ze schematem.`')}\nreturn smokePrompt\n}`)()
  const plaski = (/** @type {string} */ t) => t.replace(/\n\s*/g, ' ')
  const p = plaski(smokePrompt('zadanie-x'))
  const skill = readFileSync(resolve(KATALOG, '../../skills/dev-docs-complete/SKILL.md'), 'utf8')
  const ramka = plaski(skill.slice(skill.indexOf('## Jak kontynuować w nowej sesji'), skill.indexOf('Reguły: sekrety tylko nazwami')))
  const zdania = [
    'Sesja zaczyna od „Decyzji przed PR”, potem sama przechodzi listę i zatrzymuje się tylko przy pozycjach dla człowieka.',
    'Kończy się linią „Następny krok: /clear, potem /dev-pr 3 --bez-merge --czesc 1” (zadanie bez części PR: „Następny krok: /clear, potem /dev-pr 3 --bez-merge”); /dev-pr w sesji smoke\'u nie rusza.',
  ]
  for (const z of zdania) {
    assert.ok(p.includes(z), `workflow: ${z}`)
    assert.ok(ramka.includes(z), `skill: ${z}`)
  }
  assert.ok(p.includes('`/clear`, potem `/dev-smoke zadanie-x`'), 'workflow: komenda skilla z nazwa zadania')
  assert.ok(ramka.includes('`/clear`, potem `/dev-smoke <zadanie>`'), 'skill: komenda skilla')
  // Ramki do wklejania juz nie ma: starsze smoke'i nie moga jej przeniesc przez regule ukladu sekcji.
  assert.doesNotMatch(ramka, /Skopiuj jako pierwszą wiadomość|odhaczaj za mnie w pliku/)
  assert.doesNotMatch(p, /ramka do wklejenia jako pierwsza wiadomosc|odhaczaj za mnie w pliku/)
  assert.match(p, /Wyjatek ukladu: sekcja "Jak kontynuowac w nowej sesji" zawsze wg zdan wyzej/)
  assert.match(skill, /Wyjątek: sekcja „Jak kontynuować w nowej sesji” zawsze według układu niżej/)
  assert.match(skill, /— po smoke'u: \/clear, potem \/dev-pr 3 --bez-merge --czesc 1\n/, 'raport archiwizacji: ta sama komenda')
  assert.match(skill, /→ w nowej sesji: \/clear, potem \/dev-smoke \$ARGUMENTS/, 'raport archiwizacji odsyla do skilla')
  // Punkt 37 (piszemy_wirale 08.11): odhaczony plik bez commita zatrzymywal etap start /dev-pr na brudnym drzewie. Commit pliku
  // smoke'u jawna sciezka robi teraz skill /dev-smoke, przed linia „Następny krok”.
  const smokeSkill = plaski(readFileSync(resolve(KATALOG, '../../skills/dev-smoke/SKILL.md'), 'utf8'))
  const koniec = smokeSkill.slice(smokeSkill.indexOf('## 5. Koniec'))
  const commit = 'Zacommituj plik smoke\'u i dokumenty zmienione w sesji jawnymi ścieżkami, bez `git add -A` (`/dev-pr` wymaga czystego drzewa)'
  const linia = 'Ostatnia linia: „Następny krok: /clear, potem /dev-pr 3 --bez-merge --czesc 1”'
  assert.ok(koniec.includes(commit), 'dev-smoke: commit pliku smoke\'u')
  assert.ok(koniec.includes(linia) && koniec.indexOf(commit) < koniec.indexOf(linia), 'dev-smoke: commit przed linia „Następny krok”')
  assert.ok(koniec.includes('bez niej „Następny krok: /clear, potem /dev-pr 3 --bez-merge”'))
  assert.ok(koniec.includes('`/dev-pr` w tej sesji nie uruchamiasz'))
})

// P24 IU-8: punkty wizualne smoke'u mają format czytany przez przegląd stacku; narzędzie i zdania do smoke'u leżą w slocie
// dev-docs-complete/references/stack.md, sekcja „Punkty wizualne” (IU-2.7, D2). Treść web: stacks/web/__tests__/makieta.test.mjs.
test('smoke: format punktu wizualnego w workflowie i w skillu, zdania i kontrola ze slotu, bez zdania do ramki', () => {
  /** @type {(nazwaZadania: string) => string} */
  // eslint-disable-next-line no-new-func -- jw.
  const smokePrompt = new Function(`return (nazwaZadania) => {\n${wytnij(complete, 'const smokePrompt = `', 'Zwroc obiekt zgodny ze schematem.`')}\nreturn smokePrompt\n}`)()
  const p = smokePrompt('zadanie-x')
  const skill = readFileSync(resolve(KATALOG, '../../skills/dev-docs-complete/SKILL.md'), 'utf8')
  const slot = readFileSync(resolve(KATALOG, '../../skills/dev-docs-complete/references/stack.md'), 'utf8')
  assert.match(slot, /^## Punkty wizualne$/m)
  const splaszczony = skill.replace(/\n\s+/g, ' ')
  for (const z of [
    'Punkt wizualny ma postać „- [ ] <Urządzenie>[, <stan>]: `<trasa>` obok `visual-diff/<ekran>-figma.png` (viewport <W>×<H>) → Wejście: <adres z przykładowym slugiem z seeda i co kliknąć>. Porównaj: <2–4 konkretne elementy z makiety albo SPEC>. Stany: <każdy stan i jak go wywołać: panel „Sieć”, konto, dane; „brak” dla ekranu bez stanów>”: trasa w backtickach z przykładowym slugiem z seeda (bez znanej trasy „<opis wejścia> obok …”), jedna makieta na punkt, viewport bez dwukropka, bez ogólników typu „zgodne z makietą”.',
    'Punktem wizualnym jest pozycja ze źródeł (1)–(6), która porównuje ekran z makietą, gdy `docs/active/<zadanie>/visual-diff/<ekran>-figma.png` istnieje; W×H to wymiary makiety z tabeli SPEC.md albo nagłówka `ekrany/<ekran>.md`, ze znakiem ×.',
  ]) {
    assert.ok(p.includes(z), `workflow: ${z}`)
    assert.ok(splaszczony.includes(z), `skill: ${z}`)
  }
  assert.match(p, /Przed pierwszym punktem wizualnym smoke'u stoi zdanie z \.claude\/skills\/dev-docs-complete\/references\/stack\.md, sekcja „Punkty wizualne”/)
  assert.match(p, /Kontrola makiet po zapisie pliku: wg \.claude\/skills\/dev-docs-complete\/references\/stack\.md, sekcja „Punkty wizualne”/)
  assert.match(splaszczony, /Przed pierwszym punktem wizualnym smoke'u stoi zdanie z `references\/stack\.md`, sekcja „Punkty wizualne”/)
  assert.match(splaszczony, /Kontrola makiet po zapisie pliku: wg `references\/stack\.md`, sekcja „Punkty wizualne”/)
  // Punkt 40, krok 4: ramki nie ma, więc zdania do ramki też nie; przegląd punktów wizualnych w sesji opisuje slot /dev-smoke.
  assert.doesNotMatch(slot, /Zdanie do ramki/)
  assert.doesNotMatch(skill, /zdanie do ramki/)
  assert.doesNotMatch(p, /zdanie do ramki/)
  assert.match(readFileSync(resolve(KATALOG, '../../skills/dev-smoke/references/stack.md'), 'utf8'), /^## Punkty wizualne$/m)
  const linie = skill.split('\n')
  const i = linie.findIndex((l) => /^ {3}- \[ \] .*obok `visual-diff\/<ekran>-figma\.png`/.test(l))
  assert.ok(i > 0, 'szablon ma punkt wizualny')
  assert.match(linie[i - 1], /^ {3}<zdanie przed punktami z sekcji „Punkty wizualne”>/)
})

// Punkt 40, krok 6 (punkt 45): zdanie o otwartych sprawach z otwarte.mjs przez archiwizacje do raportu autopilota, nie ze slow modelu.
test('archiwizacja: zdanie o otwartych sprawach 1:1 z otwarte.mjs; brak wyniku = uwaga, nie zgadywanie', () => {
  const z = (/** @type {unknown} */ o) => `cos na stdout\n${JSON.stringify(o)}`
  assert.equal(C.zdanieOtwartych(z({ ok: true, zdanie: 'Otwarte: 2 pozycji smoke\'u, 1 odłożonych (docs/operator/odlozone.md).' })), 'Otwarte: 2 pozycji smoke\'u, 1 odłożonych (docs/operator/odlozone.md).')
  assert.equal(C.zdanieOtwartych(z({ ok: false, wyjatek: 'x' })), null)
  assert.equal(C.zdanieOtwartych(z({ ok: true, zdanie: 'Wszystko zamknięte w całości.' })), null, 'zdanie spoza skryptu odrzucone')
  assert.equal(C.zdanieOtwartych(''), null)
  // Weryfikacja partii, punkt 49: po padzie autora smoke'u skrypt widzi brak pliku i mowi „brak” — zdanie mowi wtedy, ze lista nie powstala.
  const poPadzie = C.zdanieOtwartych(z({ ok: true, zdanie: 'Otwarte: brak (bez smoke\'u, nic odłożonego).' }), 'zadanie-x')
  assert.match(poPadzie, /^Otwarte: nieznane — lista smoke'u nie powstala \(autor smoke'u padl\).*\/dev-docs-complete zadanie-x\.$/)
  assert.doesNotMatch(poPadzie, /brak \(bez smoke/)
  assert.match(complete, /const otwarte = zdanieOtwartych\(wynik\.otwarte, smokeStatus === 'agent-null' \? nazwaZadania : null\)/)
  assert.match(complete, /10\. Otwarte sprawy: \\`node \.claude\/scripts\/smoke\/otwarte\.mjs --zadanie \$\{nazwaZadania\}\\` -> otwarte = ostatnia linia stdout 1:1/)
  assert.match(complete, /otwarte \? null : `UWAGA: liczba otwartych spraw nieznana/)
  assert.match(complete, /return \{ \.\.\.wynik, otwarte, uwagi,/)
  assert.match(autopilot, /otwarte: \(complete && complete\.otwarte\) \|\| null, smokeStatus: /)
})
