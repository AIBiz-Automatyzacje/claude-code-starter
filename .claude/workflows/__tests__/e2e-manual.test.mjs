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
  return { decyzjaSrodowiskaE2e, srodowiskoPoReview, srodowiskoPoRestarcie, advisorsZWyniku }`)()
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

// P17 (vibersi etap 1): projekt od zera — start przed faza 1 nie ma czego uruchomic; srodowisko zostaje w runie, serwer
// wystartuje restart przed testerem pierwszej fazy, ktora go potrzebuje. Flaga idzie do skryptu tylko, gdy zadna faza nie ma execute.
test('start: odroczone (projekt od zera) = bez STOP-u, srodowisko w runie z baza e2e; flaga --przed-pierwsza-faza tylko przed faza 1', () => {
  const d = A.decyzjaSrodowiskaE2e(start({ status: 'odroczone', serwer: 'brak', detal: 'aplikacji jeszcze nie ma' }), ZADANIE)
  assert.equal(d.stop, null)
  assert.equal(d.aktywne, true)
  assert.equal(d.srodowisko, 'odroczone')
  assert.equal(d.bazaE2e, true)
  const prompt = wytnij(autopilot, 'function e2eStartPrompt(', '\n}\n')
  assert.match(prompt, /\$\{przedPierwszaFaza \? ' --przed-pierwsza-faza' : ''\}/)
  assert.match(autopilot, /const przedPierwszaFaza = stan\.fazy\.every\(\(f\) => f\.execute === 'pending'\)/)
  assert.match(wytnij(autopilot, 'const E2E_START = {', '\n}\n'), /'gotowe', 'odroczone'\]/)
})

// P17: serwer z bootstrapu nie widzial vite.config.ts z IU-1 (500 w fazie 4) — kazda faza zaczyna review od restartu serwera.
test('restart fazy: gotowe/pominieto ustawia srodowisko fazy; niepowodzenie = martwe do konca runu; nieczytelny wynik = bez zmian', () => {
  const linia = (/** @type {Record<string, unknown>} */ o) => `cos wczesniej\n${JSON.stringify(o)}`
  assert.deepEqual(A.srodowiskoPoRestarcie(linia({ status: 'gotowe', serwer: 'uruchomione', detal: 'od nowa' })), { srodowisko: 'gotowe', trwale: false, nasz: true, detal: 'od nowa' })
  assert.equal(A.srodowiskoPoRestarcie(linia({ status: 'gotowe', serwer: 'zastane', detal: '' })).nasz, false)
  assert.equal(A.srodowiskoPoRestarcie(linia({ status: 'pominieto', detal: 'faza bez scenariuszy' })).srodowisko, 'pominieto')
  const pad = A.srodowiskoPoRestarcie(linia({ status: 'niepowodzenie', detal: 'komenda startu zakonczyla sie (1)' }))
  assert.equal(pad.srodowisko, 'martwe')
  assert.equal(pad.trwale, true)
  const smiec = A.srodowiskoPoRestarcie('to nie JSON')
  assert.equal(smiec.srodowisko, null)
  assert.match(smiec.detal, /nieczytelny/)
  assert.equal(A.srodowiskoPoRestarcie(undefined).srodowisko, null)
})

test('faza: restart przed db-sync i review; db-sync zalezy od bazy e2e, nie od serwera; env-down sprzata serwer uruchomiony takze przez restart', () => {
  const petla = wytnij(autopilot, "  if (faza.review === 'pending') {", "    const review = await workflow('dev-docs-review-wf'")
  const iRestart = petla.indexOf('e2eRestartPrompt(sciezka, numerFazy)')
  const iSync = petla.indexOf('e2eDbSyncPrompt(sciezka, numerFazy, faza.baza || null)')
  assert.ok(iRestart > 0 && iSync > iRestart, 'restart przed db-sync')
  assert.match(petla, /if \(e2eWRunie && !e2eTrwaleMartwe\) \{/)
  assert.match(petla, /if \(bazaE2e && e2eWRunie\) \{/)
  assert.match(autopilot, /advisors: advisorsFazy,/)
  assert.match(autopilot, /\nif \(serwerNasz\) \{\n {2}const down = await agent\(zeStanem\(e2eEnvDownPrompt\(\)\)/)
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
  assert.match(gotowe, /re-uruchom scenariusz w przegladarce/)
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
