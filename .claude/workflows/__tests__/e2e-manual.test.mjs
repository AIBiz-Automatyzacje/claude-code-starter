// E2E w workflowach (PLAN-POPRAWY P14, PANEL-WEJSCIE §2 pkt 6): dwa przypadki.
//   (1) srodowisko niesprawne NA STARCIE -> STOP w bootstrapie z komenda naprawy (decyzja w JS z wyniku skryptu e2e.mjs start);
//   (2) test niewykonalny W TRAKCIE runu (srodowisko padlo, limit zewnetrzny, harness, pad testera) -> linia [E2E] na [Manual]
//       z powodem, run idzie dalej, pozycja trafia do smoke'u operatora. Zmiana kontraktu wobec P13: bloker srodowiska
//       i pad testera nie zatrzymuja juz runu.
//
// Uruchomienie: node --test .claude/workflows/__tests__/e2e-manual.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { PRZYCZYNY_SKIP } from '../../scripts/e2e/ksiegowanie.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const autopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
const review = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')
const complete = readFileSync(resolve(KATALOG, '../dev-docs-complete-wf.js'), 'utf8')
const tester = readFileSync(resolve(KATALOG, '../../agents/feature-tester-e2e.md'), 'utf8')

/** @param {string} zrodlo @param {string} kotwica @param {string} koniec */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const A = new Function(`${wytnij(autopilot, '// ── Bramka wejscia (P4)', '// ── Koniec bramki wejscia')}
  return { decyzjaSrodowiskaE2e, startZeSkryptu, srodowiskoPoReview, srodowiskoPoRestarcie, decyzjaPrzebudowy, advisorsZWyniku, sygnaturyZRestartu, decyzjaBlokeraSrodowiska }`)()
// eslint-disable-next-line no-new-func -- jw.
const R = new Function(`${wytnij(review, 'const SYGNATURY_BLOKERA = [', '// ── Koniec E2E po testerze')}
  return { PRZYCZYNY_SKIP, liczManualE2e, komendaKsiegowania, wykryjBlokerSrodowiska }`)()
// eslint-disable-next-line no-new-func -- jw.
const fixPrompt = new Function('BLOK_DLUGIE_KOMENDY', 'blokZwinieciaDoPoprawy', `${wytnij(autopilot, 'function fixPrompt(', '\n}\n')}
  return fixPrompt`)('', () => '')

const ZADANIE = 'docs/active/zadanie-x'
/** @param {Partial<Record<string, unknown>>} p */
const start = (p) => ({ status: 'gotowe', scenariusze: 2, figmaScreens: false, envE2e: true, bazaE2e: true, serwer: 'uruchomione', url: 'http://localhost:5173', log: '/tmp/x.log', bledy: [], detal: 'ok', naprawa: '', ...p })

// ── (1) Start: decyzja bootstrapu ─────────────────────────────────────────

test('start: brak .env.e2e przy scenariuszach = STOP przed faza 1 z naprawa skryptu i komenda swiezego runu', () => {
  const d = A.decyzjaSrodowiskaE2e(start({ status: 'brak-srodowiska', envE2e: false, detal: 'zadanie ma 2 scenariuszy [E2E], a repo nie ma .env.e2e', naprawa: 'Setup wg README. Sprawdzenie: node .claude/scripts/e2e/e2e.mjs sprawdz --zadanie docs/active/zadanie-x' }), ZADANIE)
  assert.ok(d.stop)
  assert.match(d.stop.powod, /^start: srodowisko E2E — zadanie ma 2 scenariuszy \[E2E\], a repo nie ma \.env\.e2e/)
  assert.match(d.stop.naprawa, /^Setup wg README\. Sprawdzenie: node \.claude\/scripts\/e2e\/e2e\.mjs sprawdz --zadanie docs\/active\/zadanie-x/)
  assert.match(d.stop.naprawa, /\/dev-autopilot-wf docs\/active\/zadanie-x/)
  assert.equal(d.aktywne, false)
})

test('start: niepowodzenie sprawdzenia albo startu = STOP z bledami', () => {
  const d = A.decyzjaSrodowiskaE2e(start({ status: 'niepowodzenie', detal: '.env.e2e nie jest w .gitignore — dopisz go', naprawa: 'Popraw: .env.e2e nie jest w .gitignore' }), ZADANIE)
  assert.ok(d.stop)
  assert.match(d.stop.powod, /\.gitignore/)
})

test('start: agent null (2 proby) = STOP z komenda sprawdzenia, bez cichej degradacji', () => {
  const d = A.decyzjaSrodowiskaE2e(null, ZADANIE)
  assert.ok(d.stop)
  assert.match(d.stop.naprawa, /node \.claude\/scripts\/e2e\/e2e\.mjs sprawdz --zadanie docs\/active\/zadanie-x/)
  assert.match(d.stop.naprawa, /529/)
  assert.match(d.stop.powod, /^start: agent e2e:start zwrocil null 2x/, 'kategoria STOP-u: start (infrastruktura), nie srodowisko')
})

test('start: pominieto = run bez E2E; gotowe = E2E aktywne, db-sync tylko z baza e2e', () => {
  const pom = A.decyzjaSrodowiskaE2e(start({ status: 'pominieto', scenariusze: 0, serwer: 'brak' }), ZADANIE)
  assert.equal(pom.stop, null)
  assert.equal(pom.aktywne, false)
  assert.equal(pom.srodowisko, 'pominieto')
  const ok = A.decyzjaSrodowiskaE2e(start({ bazaE2e: false }), ZADANIE)
  assert.equal(ok.stop, null)
  assert.equal(ok.aktywne, true)
  assert.equal(ok.srodowisko, 'gotowe')
  assert.equal(ok.bazaE2e, false)
})

// P17 (vibersi etap 1): projekt od zera — repo bez aplikacji; skrypt rozpoznaje to po strukturze i zwraca odroczone.
// Baza e2e dziala niezaleznie od przegladarki: zadanie bez scenariuszy tez dostaje db-sync i advisors (recenzja P17, pkt 5).
test('start: odroczone = bez STOP-u, srodowisko w runie z baza e2e; pominieto z baza po guardzie = db-sync bez przegladarki', () => {
  const d = A.decyzjaSrodowiskaE2e(start({ status: 'odroczone', serwer: 'brak', detal: 'aplikacji jeszcze nie ma' }), ZADANIE)
  assert.deepEqual([d.stop, d.aktywne, d.srodowisko, d.bazaE2e], [null, true, 'odroczone', true])
  const bezScen = A.decyzjaSrodowiskaE2e(start({ status: 'pominieto', scenariusze: 0, serwer: 'brak', bazaE2e: true }), ZADANIE)
  assert.deepEqual([bezScen.stop, bezScen.aktywne, bezScen.srodowisko, bezScen.bazaE2e], [null, false, 'pominieto', true])
  assert.match(wytnij(autopilot, 'function e2eStartPrompt(', '\n}\n'), /e2e\.mjs start --zadanie \$\{sciezka\}\\`\n/)
  assert.doesNotMatch(autopilot, /przed-pierwsza-faza|przedPierwszaFaza/)
  assert.match(wytnij(autopilot, 'const E2E_START = {', '\n}\n'), /'gotowe', 'odroczone'\]/)
})

// P17: serwer z bootstrapu nie widzial vite.config.ts z IU-1 (500 w fazie 4) — kazda faza zaczyna review od restartu serwera.
test('restart fazy: gotowe/pominieto ustawia srodowisko fazy; szybki pad = martwe w fazie, brak odpowiedzi w limicie = do konca runu; nieczytelny = bez zmian', () => {
  const linia = (/** @type {Record<string, unknown>} */ o) => `cos wczesniej\n${JSON.stringify(o)}`
  assert.deepEqual(A.srodowiskoPoRestarcie(linia({ status: 'gotowe', serwer: 'uruchomione', detal: 'od nowa' })), { srodowisko: 'gotowe', trwale: false, nasz: true, obcy: false, detal: 'od nowa' })
  assert.equal(A.srodowiskoPoRestarcie(linia({ status: 'pominieto', detal: 'faza bez scenariuszy' })).srodowisko, 'pominieto')
  const pad = A.srodowiskoPoRestarcie(linia({ status: 'niepowodzenie', detal: 'komenda startu zakonczyla sie (1)' }))
  assert.deepEqual([pad.srodowisko, pad.trwale], ['martwe', false], 'kod fazy polozyl serwer — fix moze go naprawic, nastepna faza restartuje')
  const limit = A.srodowiskoPoRestarcie(linia({ status: 'niepowodzenie', detal: 'http://localhost:5173 nie odpowiada po 90 s od „pnpm dev”' }))
  assert.deepEqual([limit.srodowisko, limit.trwale], ['martwe', true])
  const smiec = A.srodowiskoPoRestarcie('to nie JSON')
  assert.equal(smiec.srodowisko, null)
  assert.match(smiec.detal, /nieczytelny/)
  assert.equal(A.srodowiskoPoRestarcie(undefined).srodowisko, null)
})

// IU-2.4: krok stacku przed serwerem padl (Expo: urzadzenie, przebudowa). Przyczyna poza kodem fazy, a przebudowa daje STOP przed testerem.
test('restart fazy: porazka kroku stacku = przyczyna dla testera, nie restartE2e; przebudowa = STOP z naprawa i slotem', () => {
  const urzadzenie = A.srodowiskoPoRestarcie(JSON.stringify({ status: 'niepowodzenie', krokStacku: true, przebudowa: false, detal: 'brak urzadzenia', naprawa: 'Wlacz.' }))
  assert.deepEqual([urzadzenie.srodowisko, urzadzenie.trwale, urzadzenie.przyczyna, urzadzenie.detal], ['martwe', false, 'brak urzadzenia', 'brak urzadzenia. Wlacz.'])
  assert.equal(A.decyzjaPrzebudowy(urzadzenie, 2, 'docs/active/z'), null, 'bez przebudowy faza idzie dalej bez urzadzenia')
  const stara = A.srodowiskoPoRestarcie(JSON.stringify({ status: 'niepowodzenie', krokStacku: true, przebudowa: true, detal: 'dev-client starszy', naprawa: 'Przebuduj.' }))
  const stop = A.decyzjaPrzebudowy(stara, 2, 'docs/active/z')
  assert.match(stop.powod, /^Faza 2: dev-client starszy\./)
  assert.match(stop.naprawa, /^Przebuduj\. Opis: \.claude\/stack\/po-fazie\.md, sekcja „Przebudowa”\. Sprawdzenie: node \.claude\/scripts\/e2e\/e2e\.mjs restart --zadanie docs\/active\/z --faza 2\./)
  assert.equal(A.decyzjaPrzebudowy(A.srodowiskoPoRestarcie(JSON.stringify({ status: 'niepowodzenie', detal: 'kod 1' })), 2, 'x'), null, 'restart padniety kodem fazy to nie przebudowa')
  const petla = wytnij(autopilot, '      const po = srodowiskoPoRestarcie(', "    const review = await workflow('dev-docs-review-wf'")
  assert.match(petla, /const stopPrzebudowy = decyzjaPrzebudowy\(po, numerFazy, sciezka\)\n\s+if \(stopPrzebudowy\) return await stopRun\(\{ \.\.\.stopPrzebudowy, faza: numerFazy, raporty \}\)/)
  assert.ok(petla.indexOf('decyzjaPrzebudowy') < petla.indexOf('e2eDbSyncPrompt'), 'STOP przed db-sync i testerem')
})

// P19: obcy serwer zajal port E2E w trakcie runu — faza bez przegladarki z nazwana przyczyna, bez logu dla correctness
// (przyczyna poza kodem fazy) i bez „do konca runu” (nastepna faza sprawdza port od nowa).
test('restart fazy: obcy serwer na porcie = martwe w tej fazie z przyczyna dla testera, nie restartE2e; tester dostaje przyczyne tylko bez przegladarki', () => {
  const detal = "na porcie 5174 dziala serwer spoza pipeline'u — PID 3814: node vite --port 5174 nie odpowiada po 90 s"
  const po = A.srodowiskoPoRestarcie(JSON.stringify({ status: 'niepowodzenie', serwer: 'obcy', obcy: { pid: 3814, komenda: 'node vite' }, detal, naprawa: 'Zatrzymaj go: `kill 3814`' }))
  assert.deepEqual([po.srodowisko, po.trwale, po.obcy, po.nasz], ['martwe', false, true, false])
  assert.equal(po.przyczyna, detal, 'tester dostaje opis bez polecenia kill')
  assert.equal(po.detal, `${detal}. Zatrzymaj go: \`kill 3814\``, 'log operatora z naprawa')
  assert.equal(A.srodowiskoPoRestarcie(JSON.stringify({ status: 'niepowodzenie', detal: 'kod 1' })).przyczyna, null)
  const petla = wytnij(autopilot, '      const po = srodowiskoPoRestarcie(', "    const review = await workflow('dev-docs-review-wf'")
  assert.match(petla, /if \(po\.srodowisko === 'martwe' && po\.przyczyna\) przyczynaBezPrzegladarki = po\.przyczyna\n\s+else if \(po\.srodowisko === 'martwe'\) restartBlad = po\.detal/)
  assert.match(wytnij(autopilot, "    const review = await workflow('dev-docs-review-wf'", '    })'), /\n\s+przyczynaBezPrzegladarki,\n/)
  // eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
  const e2ePrompt = new Function('SKILL_WERYFIKACJI', 'BLOK_DLUGIE_KOMENDY', 'BLOK_LIMIT_P3', 'mapaBlok', 'rereviewBlok', `${wytnij(review, 'function e2ePrompt(', '\n}\n')}
  return e2ePrompt`)('S', '', '', () => '', () => '')
  assert.match(e2ePrompt('z', 4, [], 'bez-interakcji', null, detal), /Tryb: bez-interakcji\.\nPrzyczyna trybu bez-interakcji \(powod wpisow SKIP zamiast ogolnego\): na porcie 5174 dziala serwer spoza pipeline'u — PID 3814/)
  assert.doesNotMatch(e2ePrompt('z', 4, [], 'interaktywny', null, detal), /Przyczyna trybu/)
  assert.doesNotMatch(e2ePrompt('z', 4, [], 'bez-interakcji', null, null), /Przyczyna trybu/)
  assert.match(review, /e2ePrompt\(sciezka, faza, poprzE2e, e2eTryb, kontekst, przyczynaBezPrzegladarki\), zEffortem/)
  assert.match(tester, /albo przyczyną trybu podaną w poleceniu, bez findingu[^\n]*obcy serwer na porcie E2E, sprawdzeń HTTP nie robisz/)
  assert.match(tester, /przy obcym serwerze na porcie E2E preflightu nie robisz/)
})

test('faza: restart przed db-sync i review; db-sync zalezy od bazy e2e, nie od serwera; env-down sprzata serwer uruchomiony takze przez restart', () => {
  const petla = wytnij(autopilot, "  if (faza.review === 'pending') {", "    const review = await workflow('dev-docs-review-wf'")
  const iRestart = petla.indexOf('e2eRestartPrompt(sciezka, numerFazy)')
  const iSync = petla.indexOf('e2eDbSyncPrompt(sciezka, numerFazy, (poprzednia && poprzednia.baza) || faza.baza || null)')
  assert.ok(iRestart > 0 && iSync > iRestart, 'restart przed db-sync')
  assert.match(petla, /if \(e2eWRunie && !e2eTrwaleMartwe\) \{/)
  assert.match(petla, /if \(!restart\) \{[\s\S]{0,200}restart = await agent\(e2eRestartPrompt/, 'restart z jednym ponowieniem jak e2e:start')
  assert.match(petla, /if \(po\.srodowisko === 'martwe'\) restartBlad = po\.detal/)
  assert.match(petla, /\n {4}if \(bazaE2e\) \{/, 'db-sync zalezy od bazy e2e, nie od serwera')
  assert.match(petla, /advisorsFazy = e2eSync && e2eSync\.status !== 'niepowodzenie' \? advisorsZWyniku\(e2eSync\.advisors\) : null/, 'advisors po nieudanym db push = brak wyniku, nie falszywe ok')
  assert.match(autopilot, /restartE2e: restartBlad,/)
  assert.match(autopilot, /advisors: advisorsFazy,/)
  assert.match(autopilot, /\nif \(serwerNasz\) \{\n {2}const down = await agent\(zeStanem\(e2eEnvDownPrompt\(sciezka\)\)/)
  // P22 A3: sprzatanie dostaje katalog zadania — skrypt usuwa niesledzone zrzuty PNG spoza niego.
  assert.match(autopilot, /function e2eEnvDownPrompt\(sciezka\) \{\n {2}return `Sprzatanie srodowiska E2E dev-autopilot: \\`node \.claude\/scripts\/e2e\/e2e\.mjs stop --zadanie "\$\{sciezka\}"\\`/)
  // STOP: commit artefaktow najpierw przenosi zrzuty z korzenia repo do katalogu zadania (inaczej bramka czystosci nastepnego runu).
  assert.match(autopilot, /0\. \\`node \.claude\/scripts\/e2e\/e2e\.mjs zrzuty --zadanie "\$\{sciezka\}"\\`/)
  assert.match(autopilot, /const zrzuty = etykieta === 'stop:commit-artefaktow'/)
  assert.match(wytnij(autopilot, 'function e2eRestartPrompt(', '\n}\n'), /e2e\.mjs restart --zadanie \$\{sciezka\} --faza \$\{numerFazy\}/)
})

// P17: advisors na bazie e2e po wgraniu migracji fazy (db-sync) — wynik przepisany przez agenta jako string, walidowany w JS.
test('advisors z db-sync: JSON skryptu -> bledy i ostrzezenia dla security; zly status albo smiec = null; token nie przechodzi', () => {
  const w = A.advisorsZWyniku(JSON.stringify({ status: 'porazka', ref: 'abc', bledy: [{ plik: null, linia: null, regula: 'advisors/rls_disabled_in_public', opis: 'RLS Disabled' }, { zle: 1 }], ostrzezenia: [], detal: '1 bledow', naprawa: '', token: 'tajny' }))
  assert.deepEqual(w, { status: 'porazka', ref: 'abc', bledy: [{ regula: 'advisors/rls_disabled_in_public', opis: 'RLS Disabled' }], ostrzezenia: [], detal: '1 bledow', naprawa: '' })
  assert.equal(A.advisorsZWyniku(JSON.stringify({ status: 'inny' })), null)
  assert.equal(A.advisorsZWyniku(''), null)
  const sync = wytnij(autopilot, 'function e2eDbSyncPrompt(', '\n}\n')
  assert.match(sync, /e2e\.mjs advisors\$\{baza \? ` --baza \$\{baza\}` : ''\}/)
  assert.match(sync, /tylko gdy krok 2 przeszedl/)
  assert.match(wytnij(autopilot, 'const E2E_DB_SYNC_RESULT = {', '\n}\n'), /required: \['status', 'detal', 'advisors'\]/)
})

// ── (2) W trakcie: bloker srodowiska -> reszta runu bez przegladarki, scenariusze na [Manual] ─────────

test('w trakcie: bloker srodowiska przelacza srodowisko na martwe do konca runu; bez blokera bez zmian', () => {
  assert.equal(A.srodowiskoPoReview('gotowe', { blokerSrodowiska: { wykryty: true, klasa: 'dev-server-nieosiagalny', dowod: 'ECONNREFUSED' } }), 'martwe')
  assert.equal(A.srodowiskoPoReview('gotowe', { blokerSrodowiska: null }), 'gotowe')
  assert.equal(A.srodowiskoPoReview('martwe', {}), 'martwe')
})

test('w trakcie: autopilot nie zatrzymuje runu na blokerze srodowiska ani na padzie testera', () => {
  assert.doesNotMatch(autopilot, /scenariusz E2E padl na BLOKERZE SRODOWISKA/)
  assert.doesNotMatch(autopilot, /review\.e2eTesterFail\)\s*\{[\s\S]{0,400}stopRun/)
  assert.match(autopilot, /srodowiskoE2E = srodowiskoPoReview\(srodowiskoE2E, review\)/)
})

// ── (3) Polityka blokera stacku (D12, IU-1.8): stop-rebuild zatrzymuje run z naprawa adaptera ─────────
// Sygnatury blokera stacku przychodza z adaptera w JSON-ie `e2e.mjs restart`; autopilot je waliduje i przekazuje do review.
// Bloker z polityka `stop-rebuild` (restart serwera nie przebuduje binarki) = STOP przed zamknieciem review: linie [E2E]
// zostaja bez zmian, swiezy run po przebudowie powtarza review fazy.

const NATYWNY = { wzorzec: 'cannot find native module', flagi: 'i', klasa: 'brak-modulu-natywnego', polityka: 'stop-rebuild', naprawa: 'Przebuduj dev-client.' }

test('restart: sygnatury blokera stacku z JSON-u restartu, tylko poprawne wpisy; brak albo smiec = pusta lista', () => {
  assert.deepEqual(A.sygnaturyZRestartu(JSON.stringify({ status: 'gotowe', sygnaturyBlokera: [NATYWNY, { klasa: 'x' }, null] })), [NATYWNY])
  assert.deepEqual(A.sygnaturyZRestartu(JSON.stringify({ status: 'gotowe' })), [])
  assert.deepEqual(A.sygnaturyZRestartu('to nie JSON'), [])
  assert.deepEqual(A.sygnaturyZRestartu(undefined), [])
})

test('w trakcie: bloker stop-rebuild = STOP fazy z naprawa adaptera i komenda swiezego runu; manual-restart i brak blokera = dalej', () => {
  const stop = A.decyzjaBlokeraSrodowiska({ blokerSrodowiska: { wykryty: true, klasa: 'brak-modulu-natywnego', dowod: 'Cannot find native module X', polityka: 'stop-rebuild', naprawa: 'Przebuduj dev-client.' } }, 3, ZADANIE)
  assert.match(stop?.powod ?? '', /^Faza 3: srodowisko E2E wymaga przebudowy \(brak-modulu-natywnego\): "Cannot find native module X"/)
  assert.match(stop?.powod ?? '', /linie \[E2E\] bez zmian/)
  assert.match(stop?.naprawa ?? '', /^Przebuduj dev-client\. .*BEZ resumeFromRunId/)
  assert.equal(A.decyzjaBlokeraSrodowiska({ blokerSrodowiska: { wykryty: true, klasa: 'dev-server-nieosiagalny', dowod: 'x', polityka: 'manual-restart', naprawa: '' } }, 3, ZADANIE), null)
  assert.equal(A.decyzjaBlokeraSrodowiska({ blokerSrodowiska: null }, 3, ZADANIE), null)
  assert.equal(A.decyzjaBlokeraSrodowiska(null, 3, ZADANIE), null)
})

test('w trakcie: wiring — sygnatury z restartu do args review, STOP stop-rebuild przed zamknieciem review', () => {
  assert.match(wytnij(autopilot, '      const po = srodowiskoPoRestarcie(', "    const review = await workflow('dev-docs-review-wf'"), /sygnaturyBlokera = sygnaturyZRestartu\(restart && restart\.stdout\)/)
  assert.match(wytnij(autopilot, "    const review = await workflow('dev-docs-review-wf'", '    })'), /\n\s+sygnaturyBlokera,\n/)
  const poReview = wytnij(autopilot, '    if (review.scribeFail) {', "    faza.review = 'done'")
  assert.match(poReview, /const stopBlokera = decyzjaBlokeraSrodowiska\(review, numerFazy, sciezka\)\n\s+if \(stopBlokera\) \{\n\s+oznaczStan\(\)\n\s+return await stopRun\(\{ \.\.\.stopBlokera, faza: numerFazy, findings: review\.findings, raporty \}\)/)
  assert.ok(poReview.indexOf('decyzjaBlokeraSrodowiska(') < poReview.indexOf('srodowiskoPoReview('), 'STOP przed przelaczeniem na martwe')
  assert.match(review, /scribePrompt\(sciezka, faza, potwierdzone, przebieg, obalone, bezKsiegowaniaE2e\)/)
  assert.match(review, /const bezKsiegowaniaE2e = Boolean\(blokerSrodowiska && POLITYKI_STOP\.includes\(blokerSrodowiska\.polityka\)\)/)
  assert.match(review, /const POLITYKI_STOP = \['stop-rebuild', 'stop-srodowisko'\]/)
})

// Pilot Nawykometr, run 1 (W17): seed padl na bazie e2e, oba scenariusze zeszly po cichu na [Manual], zadanie zarchiwizowane przy 0 PASS.
test('w trakcie: seed, ktory nie wszedl = bloker stop-srodowisko (STOP z naprawa, linie [E2E] bez zmian), takze za wczesniejszym SKIP-em i przy bledzie sieci w dowodzie', () => {
  const skip = (/** @type {string} */ dowod) => ({ checkbox: 'x', flow: 'x', wynik: 'SKIP', przyczyna: 'srodowisko', dowod })
  const b = R.wykryjBlokerSrodowiska([skip('aplikacja nie odpowiada'), skip('seed nie wszedł: psql: error: connection to server at "127.0.0.1", port 54322 failed: Connection refused')])
  assert.deepEqual([b?.klasa, b?.polityka], ['seed-nie-wszedl', 'stop-srodowisko'])
  assert.match(b?.naprawa ?? '', /psql "\$SUPABASE_E2E_DB_URL" -v ON_ERROR_STOP=1 -f <seed>/)
  assert.equal(R.wykryjBlokerSrodowiska([skip('seed nie wszedl: ERROR: Seed e3 odmawia pracy: brak public.e2e_env_marker')])?.polityka, 'stop-srodowisko')
  // Zwrot w srodku dowodu albo przy FAIL (blad SQL seeda z fazy = defekt do fixa) nie zatrzymuje runu.
  assert.equal(R.wykryjBlokerSrodowiska([skip('Metro milczy; wczesniej seed nie wszedł')])?.polityka, 'manual-restart')
  assert.equal(R.wykryjBlokerSrodowiska([{ checkbox: 'x', flow: 'x', wynik: 'FAIL', przyczyna: 'nie-dotyczy', dowod: 'seed nie wszedł: ERROR: column "x" does not exist' }]), null)
  const stop = A.decyzjaBlokeraSrodowiska({ blokerSrodowiska: b }, 2, ZADANIE)
  assert.match(stop?.powod ?? '', /^Faza 2: srodowisko E2E wymaga naprawy \(seed-nie-wszedl\): "seed nie wszedł: psql: error/)
  assert.match(stop?.powod ?? '', /Review pozostaje pending, linie \[E2E\] bez zmian/)
  assert.match(stop?.naprawa ?? '', /^Zaaplikuj seed recznie .* Po naprawie swiezy run \(te same args, BEZ resumeFromRunId\)/)
  assert.deepEqual(A.sygnaturyZRestartu(JSON.stringify({ sygnaturyBlokera: [{ wzorzec: 'x', klasa: 'k', polityka: 'stop-srodowisko' }] })).map((/** @type {{ polityka: string }} */ s) => s.polityka), ['stop-srodowisko'])
})

test('w trakcie: przyczyny SKIP w review-wf = kopia z ksiegowanie.mjs', () => {
  assert.deepEqual({ ...R.PRZYCZYNY_SKIP }, { ...PRZYCZYNY_SKIP })
})

test('w trakcie: awaria srodowiska z pola przyczyny — SKIP srodowisko bez komunikatu (curl -s milczy) wystarcza', () => {
  const b = R.wykryjBlokerSrodowiska([{ checkbox: 'x', flow: 'x', wynik: 'SKIP', przyczyna: 'srodowisko', dowod: 'aplikacja nie odpowiada na http://localhost:5173' }])
  assert.ok(b)
  assert.equal(b.klasa, 'srodowisko')
  const zSygnatura = R.wykryjBlokerSrodowiska([{ checkbox: 'x', flow: 'x', wynik: 'SKIP', przyczyna: 'srodowisko', dowod: 'connect ECONNREFUSED 127.0.0.1:5173' }])
  assert.equal(zSygnatura.klasa, 'dev-server-nieosiagalny')
})

test('w trakcie: SKIP harness albo limitu z cytowanym bledem sieci zewnetrznej uslugi to nie awaria srodowiska', () => {
  assert.equal(R.wykryjBlokerSrodowiska([
    { checkbox: 'x', flow: 'x', wynik: 'SKIP', przyczyna: 'harness', dowod: 'popup OAuth: net::ERR_NAME_NOT_RESOLVED accounts.google.com' },
    { checkbox: 'y', flow: 'y', wynik: 'SKIP', przyczyna: 'limit-zewnetrzny', dowod: 'SMTP: connect ECONNREFUSED smtp.example.com:587' },
  ]), null)
})

test('w trakcie: FAIL z sygnatura = kod fazy polozyl serwer — finding do fixa, srodowisko zostaje gotowe (fix restartuje serwer)', () => {
  assert.equal(R.wykryjBlokerSrodowiska([{ checkbox: 'x', flow: 'x', wynik: 'FAIL', przyczyna: 'nie-dotyczy', dowod: 'net::ERR_CONNECTION_REFUSED http://localhost:5173/b' }]), null)
  // Procedura testera (stan serwera, curl -sS) jest w pliku roli (P14 S2: jedno zrodlo promptu, zmiana kontraktu testu).
  assert.match(tester, /`"nasz": true`/)
  assert.doesNotMatch(review, /poBlokerzeSrodowiska/)
  assert.match(tester, /node \.claude\/scripts\/e2e\/e2e\.mjs stan/)
  assert.match(tester, /curl -sS <E2E_URL>/)
})

test('w trakcie: licznik [Manual] — SKIP z przyczyna reczna bez FAIL w tym samym flow; pad testera = wszystkie scenariusze fazy', () => {
  const przebiegi = [
    { flow: 'a', wynik: 'SKIP', przyczyna: 'limit-zewnetrzny' }, { flow: 'a', wynik: 'SKIP', przyczyna: 'limit-zewnetrzny' },
    { flow: 'b', wynik: 'SKIP', przyczyna: 'srodowisko' }, { flow: 'b', wynik: 'FAIL', przyczyna: 'nie-dotyczy' },
    { flow: 'c', wynik: 'SKIP', przyczyna: 'brak-seeda' }, { flow: 'd', wynik: 'PASS', przyczyna: 'nie-dotyczy' },
  ]
  assert.equal(R.liczManualE2e(przebiegi, false, 6), 2)
  assert.equal(R.liczManualE2e([], true, 4), 4)
  assert.equal(R.liczManualE2e([], true, null), null)
})

test('w trakcie: scribe ksieguje linie [E2E] skryptem z przebiegami w heredoc; pad testera -> --brak-wpisu tester-padl', () => {
  const k = R.komendaKsiegowania(ZADANIE, 2, [{ checkbox: 'Test: [E2E] `a` — /a → \'ok\'', flow: 'a', wynik: 'SKIP', przyczyna: 'srodowisko', dowod: 'x'.repeat(500) }], false)
  assert.match(k, /^node \.claude\/scripts\/e2e\/e2e\.mjs ksieguj --zadanie docs\/active\/zadanie-x --faza 2 <<'PRZEBIEGI_E2E'\n\[\{.*\}\]\nPRZEBIEGI_E2E$/s)
  const json = JSON.parse(k.split('\n')[1])
  assert.equal(json[0].dowod.length, 300)
  assert.equal(json[0].przyczyna, 'srodowisko')
  assert.equal(json[0].checkbox, 'Test: [E2E] `a` — /a → \'ok\'', 'checkbox zawsze — dopasowanie po tresci, gdy flow testera rozni sie od backticka linii')
  const pass = JSON.parse(R.komendaKsiegowania(ZADANIE, 2, [{ checkbox: 'Weryfikacja: [E2E] stary format', flow: 'stary', wynik: 'PASS', przyczyna: 'nie-dotyczy', dowod: 'ok' }], false).split('\n')[1])
  assert.deepEqual(pass, [{ checkbox: 'Weryfikacja: [E2E] stary format', flow: 'stary', wynik: 'PASS', przyczyna: 'nie-dotyczy' }])
  const padl = R.komendaKsiegowania(ZADANIE, 2, [], true)
  assert.match(padl, /--brak-wpisu tester-padl --powod "[^"']+"/)
  assert.match(review, /\$\{komendaKsiegowania\(sciezka, faza, przebieg\.e2ePrzebiegi \|\| \[\], przebieg\.e2eTesterFail\)\}/)
  assert.doesNotMatch(review, /Orkiestrator ZATRZYMA run i review tej fazy POWTORZY sie z testerem/)
})

test('w trakcie: schemat testera ma kategorie przyczyny SKIP (wymagana)', () => {
  const schemat = wytnij(review, 'const E2E_RESULT = {', '\n}\n')
  assert.match(schemat, /przyczyna: \{ type: 'string', enum: \['nie-dotyczy', 'srodowisko', 'limit-zewnetrzny', 'harness', 'brak-seeda', 'scenariusz-niewykonalny'\]/)
  assert.match(schemat, /required: \['checkbox', 'flow', 'wynik', 'przyczyna', 'dowod'\]/)
})

test('w trakcie: fix przy srodowisku niedostepnym przenosi flow na [Manual] skryptem zamiast odgrywac', () => {
  const martwe = fixPrompt(ZADANIE, 2, [], 'martwe')
  assert.match(martwe, /node \.claude\/scripts\/e2e\/e2e\.mjs manual --zadanie docs\/active\/zadanie-x --faza 2 --flow <identyfikator> --przyczyna/)
  assert.match(martwe, /SRODOWISKO E2E NIEDOSTEPNE W TYM RUNIE \(martwe\)/)
  // Srodowisko gotowe, ale re-run padl na srodowisku albo limicie w trakcie fixa — tez [Manual], nie STOP completion-gate.
  const gotowe = fixPrompt(ZADANIE, 2, [], 'gotowe')
  assert.match(gotowe, /re-uruchom scenariusz narzedziem jazdy wg \.claude\/stack\/fix-e2e\.md/)
  assert.match(gotowe, /Ponowne odegranie niewykonalne nie z winy kodu/)
  // Kod fazy polozyl serwer (FAIL z ogonem logu): po naprawie fix uruchamia serwer od nowa, potem odgrywa scenariusz.
  assert.match(gotowe, /node \.claude\/scripts\/e2e\/e2e\.mjs start --zadanie docs\/active\/zadanie-x/)
  assert.match(gotowe, /--przyczyna <srodowisko\|limit-zewnetrzny\|harness>/)
  assert.doesNotMatch(gotowe, /SRODOWISKO E2E NIEDOSTEPNE/)
})

// ── Smoke operatora i telemetria ───────────────────────────────────────────

test('smoke operatora: pozycje przeniesione w trakcie runu na [Manual] z powodem, bez czerwonej flagi', () => {
  assert.match(complete, /node \.claude\/scripts\/e2e\/e2e\.mjs lista-manual --zadanie docs\/active\/\$\{nazwaZadania\}/)
  assert.match(complete, /## E2E do odegrania recznie \(srodowisko w trakcie runu\)/)
})

test('D4: pelny dowod [Manual] w raporcie review, smoke odsyla do sciezki po archiwizacji (docs/completed/)', () => {
  // Linia [Manual] ma powod skrocony do 160 znakow; pelny dowod testera zapisuje scribe w Bookkeeping raportu fazy.
  assert.match(review, /przeniesione w trakcie runu na \[Manual\]: M \(lista: flow — przyczyna: PELNY dowod testera z "Przebiegi E2E"/)
  // Smoke czyta operator po archiwizacji: odsylacz do raportu i do plikow zadania przez docs\/completed\/, nie docs\/active\/.
  assert.match(complete, /pelny powod: docs\/completed\/\$\{nazwaZadania\}\/review-faza-<faza>\.md, sekcja "Bookkeeping/)
  assert.match(complete, /ODSYLACZE w smoke'u do plikow zadania pisz jako docs\/completed\/\$\{nazwaZadania\}\//)
  const skill = readFileSync(resolve(KATALOG, '../../skills/dev-docs-complete/SKILL.md'), 'utf8')
  assert.match(skill, /pełny powód: `docs\/completed\/\$ARGUMENTS\/review-faza-<faza>\.md`, sekcja „Bookkeeping/)
  assert.match(skill, /Odsyłacze w smoke'u do plików zadania piszesz jako `docs\/completed\/\$ARGUMENTS\/…`/)
})

test('telemetria: faza.e2e.manual z przebiegu (bylo null)', () => {
  const faza = readFileSync(resolve(KATALOG, '../../scripts/telemetria/faza.mjs'), 'utf8')
  assert.match(faza, /manual: liczbaLubNull\(przebieg\.e2eManual\)/)
  assert.match(autopilot, /e2eManual: p\.e2eManual \?\? null/)
  assert.match(review, /e2eManual: liczManualE2e\(/)
})

test('start: agent uruchamia skrypt raz z limitem Basha 600 s i obsluguje wyjatek skryptu (kod 3)', () => {
  const p = wytnij(autopilot, 'function e2eStartPrompt(', '\n}\n')
  assert.match(p, /timeout 600000/)
  assert.match(p, /jeden raz/)
  assert.match(p, /Kod 3/)
  assert.match(p, /bez zmian w polu stdout/)
})

// Pilot Nawykometr, run 2: skrypt zwrocil kod 1 z komenda przebudowy w `naprawa`, a agent wpisal tekst zapasowy z `sprawdz`.
test('start: pola ze stdout skryptu wygrywaja z przepisaniem agenta; STOP niesie komende przebudowy ze skryptu', () => {
  const zeSkryptu = { status: 'niepowodzenie', scenariusze: 2, figmaScreens: false, envE2e: true, bazaE2e: true, serwer: 'brak', url: 'http://localhost:8081', log: null, bledy: ['dev-client starszy niż package-lock.json: expo-haptics'], detal: 'dev-client starszy niż package-lock.json: expo-haptics', naprawa: 'Przebuduj: npx expo run:ios --no-bundler. Wariant ad-hoc: xcodebuild CODE_SIGN_IDENTITY=- build' }
  const odAgenta = start({ status: 'niepowodzenie', serwer: 'brak', detal: 'dev-client starszy', naprawa: 'Uruchom recznie: node .claude/scripts/e2e/e2e.mjs sprawdz --zadanie docs/active/zadanie-x', stdout: `${JSON.stringify(zeSkryptu)}\n`, stanZapisany: true })
  const w = A.startZeSkryptu(odAgenta)
  assert.equal(w.naprawa, zeSkryptu.naprawa)
  assert.equal(w.detal, zeSkryptu.detal)
  assert.equal(w.stanZapisany, true, 'pola spoza skryptu zostaja od agenta')
  const d = A.decyzjaSrodowiskaE2e(w, ZADANIE)
  assert.match(d.stop.naprawa, /^Przebuduj: npx expo run:ios --no-bundler\. Wariant ad-hoc: xcodebuild CODE_SIGN_IDENTITY=- build Po naprawie swiezy run/)
})

test('start: stdout nieczytelny, z wyjatkiem albo z nieznanym statusem zostawia pola agenta; null zostaje nullem', () => {
  const odAgenta = start({ status: 'niepowodzenie', naprawa: 'od agenta' })
  for (const stdout of [null, undefined, 'Error: cos padlo', '{"wyjatek":"TypeError","status":"niepowodzenie","naprawa":"x"}', '{"status":"dziwny","naprawa":"x"}', '[1]']) {
    assert.equal(A.startZeSkryptu({ ...odAgenta, stdout }).naprawa, 'od agenta', String(stdout))
  }
  assert.equal(A.startZeSkryptu(null), null)
  assert.match(autopilot, /e2eStart = startZeSkryptu\(e2eStart\)\nconst srodowiskoStartu = decyzjaSrodowiskaE2e\(e2eStart, sciezka\)/)
  assert.match(autopilot, /const NAPRAWA_ZAPASOWA_STARTU = \(sciezka\) => `Uruchom recznie: node \.claude\/scripts\/e2e\/e2e\.mjs start --zadanie/)
})

test('scribe: przegladarkowa „Weryfikacja:” bez markera dostaje kopie w Operator checklist (inaczej znika ze smoke)', () => {
  assert.match(review, /" — wymaga operatora \(checklist\)" \+ kopia w "## Operator checklist/)
})

test('fix przy „serwer padl”: start takze po nieudanej naprawie; start nieudany -> [Manual] i serwerE2e martwy -> reszta runu bez przegladarki', () => {
  const gotowe = fixPrompt(ZADANIE, 2, [], 'gotowe')
  assert.match(gotowe, /takze gdy naprawa sie nie udala/)
  assert.match(gotowe, /serwerE2e: "martwy"/)
  assert.match(wytnij(autopilot, 'const FIX_RESULT = {', '\n}\n'), /serwerE2e: \{ type: 'string', enum: \['dziala', 'martwy', 'nie-dotyczy'\]/)
  assert.match(autopilot, /if \(fix\.serwerE2e === 'martwy'\) \{\n\s*srodowiskoE2E = 'martwe'/)
})

test('instrukcje bez wykrywania awarii po sygnaturze tekstu; watcher (zywy proces) z bledem kodu w logu = FAIL', () => {
  assert.doesNotMatch(review, /Orkiestrator rozpoznaje awarie srodowiska po SYGNATURZE/)
  assert.doesNotMatch(tester, /rozpoznaje awarię środowiska po sygnaturze tekstowej/)
  assert.match(tester, /`"zyje": true`, gdy watcher \(np\. nodemon\)/)
})

// P22 D2: vibersi etap 4 — fix fazy 6 wczytal Readem 2 PNG makiet (visual-diff/admin-*-figma*.png; 378k + 93k zn base64, ok. 2,5 tys.
// tokenow w kazdej kolejnej turze). Polecenie fixa kieruje finding wizualny do opisu ekranu w planie zadania, PNG tylko jako sciezka.
test('fix: finding wizualny — opis ekranu z katalogu makiet planu zadania (ekrany/<ekran>.md, SPEC.md), PNG tylko sciezka, bez Read obrazu', () => {
  const blok = (/** @type {string} */ srodowisko) => {
    const p = fixPrompt(ZADANIE, 6, [], srodowisko)
    return p.slice(p.indexOf('FINDING WIZUALNY'), p.indexOf('ZAKAZ TEST-WEAKENINGU'))
  }
  const p = blok('gotowe')
  assert.equal(blok('martwe'), p, 'blok niezalezny od srodowiska E2E')
  assert.match(p, /^FINDING WIZUALNY \(rozjazd z makieta: opis wskazuje ekran makiety, np\. „z makiety <ekran>” albo visual-diff\/<ekran>-figma\.png\):/)
  assert.match(p, /`grep -m1 'SPEC\.md' docs\/active\/zadanie-x\/\*-plan\.md`\); opis ekranu = `<katalog>\/ekrany\/<ekran>\.md` \(wymiary, odstepy, kolory, tokeny,\nteksty\)/)
  assert.match(p, /bez tego pliku — sekcja ekranu w `<katalog>\/SPEC\.md` \(`grep -n '<ekran>'`, potem `sed -n`\)/)
  assert.match(p, /PNG makiety i zrzutu\npodajesz w raporcie tylko jako sciezke i nie otwierasz ich narzedziem Read/)
  assert.match(p, /\(rzad 1–3 tys\. tokenow na obraz\)/)
  assert.match(p, /bez zrzutu\nwg \.claude\/stack\/fix-e2e\.md, sekcja „Sprawdzenie poprawki wizualnej”/)
  assert.doesNotMatch(p, /docs\/plans\/\*-figma|otworz PNG|z PNG makiety/)
})
