// Test detekcji blokera srodowiska z dev-docs-review-wf.js.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/bloker-srodowiska.test.mjs
//
// DLACZEGO EKSTRAKCJA ZE ZRODLA, A NIE IMPORT: workflowy sa self-contained skryptami runtime'u Workflow —
// maja top-level `await agent(...)`, `phase()`, `log()`, ktorych w Node nie ma, wiec `import()` tego pliku
// wysypuje sie na ReferenceError. Wyciagniecie z pliku SYGNATUR i funkcji utrzymuje JEDNO zrodlo prawdy:
// test sprawdza dokladnie te regexy, ktore poleca w runie, a nie ich kopie, ktora rozjedzie sie po tygodniu.
//
// Kontekst (audyt pipeline'u 2026-09-02, pozycja A1): detektor lapal findingi o KODZIE. Realny P2
// z oferty-online ("`dns.lookup`/`getaddrinfo` nie ma wlasnego limitu") zatrzymywal caly run jako
// "bloker srodowiska". Naprawa ma trzy warstwy i test pokrywa wszystkie trzy:
//   (1) sygnatura — gole `getaddrinfo` juz nie wystarcza, musi byc zlaczone z kodem bledu,
//   (2) zrodlo    — liczy sie wylacznie finding TESTERA E2E (`_zrodlo === 'e2e'`),
//   (3) przebieg  — bloker bez wpisu FAIL/SKIP w `przebiegi[]` testera to nie bloker,
//   (4) tryb      — detekcja tylko w `e2eTryb === 'przegladarka'`.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const PLIK_WORKFLOWU = resolve(KATALOG, '../dev-docs-review-wf.js')
const zrodlo = readFileSync(PLIK_WORKFLOWU, 'utf8')

// ── Ekstrakcja jednostki testowanej ────────────────────────────────────────

function wytnijFragment() {
  const start = zrodlo.indexOf('const SYGNATURY_BLOKERA = [')
  assert.notEqual(start, -1, 'nie znaleziono SYGNATURY_BLOKERA w dev-docs-review-wf.js — kotwica testu wymaga aktualizacji')
  const funkcja = zrodlo.indexOf('function wykryjBlokerSrodowiska(', start)
  assert.notEqual(funkcja, -1, 'nie znaleziono wykryjBlokerSrodowiska po SYGNATURY_BLOKERA')
  const koniec = zrodlo.indexOf('\n}\n', funkcja)
  assert.notEqual(koniec, -1, 'nie znaleziono konca funkcji wykryjBlokerSrodowiska')
  return zrodlo.slice(start, koniec + 3)
}

// eslint-disable-next-line no-new-func — jedyna droga do niewyeksportowanej jednostki w skrypcie workflowu;
// wejsciem jest plik z tego repo, nie dane uzytkownika.
const { wykryjBlokerSrodowiska } = new Function(
  `${wytnijFragment()}\nreturn { wykryjBlokerSrodowiska }`
)()

// Odwzorowanie miejsca wywolania z workflowu (dwa filtry, ktorych nie ma w samej funkcji).
// Test `wiring` nizej pilnuje, ze wywolanie w workflowie nadal wyglada tak samo.
function wykryjJakWorkflow({ findingi, przebiegi, e2eTryb }) {
  if (e2eTryb !== 'przegladarka') return null
  return wykryjBlokerSrodowiska(findingi.filter((f) => f._zrodlo === 'e2e'), przebiegi)
}

const FAIL_PRZEBIEG = [{ checkbox: 'Test: [E2E] `logowanie`', flow: 'logowanie', wynik: 'FAIL', dowod: '—' }]
const PASS_PRZEBIEG = [{ checkbox: 'Test: [E2E] `logowanie`', flow: 'logowanie', wynik: 'PASS', dowod: '—' }]
const e2e = (opis, plik = '?') => ({ severity: 'P2', typ: 'E2E', plik, opis, _zrodlo: 'e2e' })

// ── 6 przypadkow POZYTYWNYCH — realne komunikaty runtime, ktore MAJA zatrzymac run ──

const POZYTYWNE = [
  {
    nazwa: 'przegladarka: ERR_CONNECTION_REFUSED na dev serwerze',
    opis: 'Scenariusz przerwany: net::ERR_CONNECTION_REFUSED przy otwieraniu http://localhost:5173/oferty',
    klasa: 'dev-server-nieosiagalny',
  },
  {
    nazwa: 'node: ECONNREFUSED z adresem i portem',
    opis: 'Preflight padl: Error: connect ECONNREFUSED 127.0.0.1:5173',
    klasa: 'dev-server-nieosiagalny',
  },
  {
    nazwa: 'curl: Connection refused',
    opis: 'curl: (7) Failed to connect to localhost port 5173 after 3 ms: Connection refused',
    klasa: 'dev-server-nieosiagalny',
  },
  {
    nazwa: 'przegladarka: ERR_NAME_NOT_RESOLVED na hoscie Supabase',
    opis: 'net::ERR_NAME_NOT_RESOLVED przy zadaniu do https://abcdefgh.supabase.co/auth/v1/token',
    klasa: 'host-nierozwiazywalny',
  },
  {
    nazwa: 'node: getaddrinfo ENOTFOUND (kod bledu zlaczony z wywolaniem)',
    opis: 'Logowanie padlo: getaddrinfo ENOTFOUND abcdefgh.supabase.co',
    klasa: 'host-nierozwiazywalny',
  },
  {
    nazwa: 'curl: Could not resolve host',
    opis: 'curl: (6) Could not resolve host: abcdefgh.supabase.co',
    klasa: 'host-nierozwiazywalny',
  },
]

for (const przypadek of POZYTYWNE) {
  test(`bloker WYKRYTY — ${przypadek.nazwa}`, () => {
    const wynik = wykryjJakWorkflow({
      findingi: [e2e(przypadek.opis)],
      przebiegi: FAIL_PRZEBIEG,
      e2eTryb: 'przegladarka',
    })
    assert.ok(wynik, 'realna awaria srodowiska musi zatrzymac run')
    assert.equal(wynik.wykryty, true)
    assert.equal(wynik.klasa, przypadek.klasa)
    assert.ok(wynik.dowod.length > 0, 'dowod idzie do komunikatu STOP-u — nie moze byc pusty')
  })
}

// ── 6 przypadkow NEGATYWNYCH — nie wolno ich uznac za bloker ────────────────

// Finding P2 z docs/completed/faza-6-cta-i-webhooki/review-faza-3.md (punkt 2), cytowany DOSLOWNIE.
// To on wywolal cala pozycje A1: opisuje BRAK LIMITU CZASU w kodzie, a zatrzymywal run jako awarie DNS.
const FINDING_DELIVER_TS = 'Twardy budżet czasu jednej próby (`WEBHOOK_HTTP_TIMEOUT_MS`, D8) NIE obejmuje rozwiązywania nazwy: '
  + '`resolveWebhookTarget` (a w nim `dns.lookup`) jest awaitowane PRZED utworzeniem `AbortSignal.timeout(timeoutMs)` '
  + '(linia 240), a `dns.lookup`/`getaddrinfo` nie ma własnego limitu. Dołożywszy do tego trzy sekwencyjne '
  + 'zapytania `loadJob` po 5 s każde (`queue-store.ts:74`), realny czas obsługi JEDNEGO wiersza może przekroczyć '
  + '`WEBHOOK_VISIBILITY_TIMEOUT_SECONDS = 30`.'

test('bloker NIE wykryty — finding o braku limitu na dns.lookup (gole "getaddrinfo" w opisie kodu)', () => {
  const wynik = wykryjJakWorkflow({
    findingi: [{ severity: 'P2', typ: 'KOD', plik: 'apps/server/src/webhooks/deliver.ts:214', opis: FINDING_DELIVER_TS, _zrodlo: 'e2e' }],
    przebiegi: FAIL_PRZEBIEG,
    e2eTryb: 'przegladarka',
  })
  assert.equal(wynik, null, 'nazwa wywolania systemowego w opisie defektu kodu to nie awaria srodowiska')
})

test('bloker NIE wykryty — ECONNREFUSED cytowany w tescie jednostkowym (zrodlo test-coverage, nie tester)', () => {
  const wynik = wykryjJakWorkflow({
    findingi: [{
      severity: 'P2',
      typ: 'TEST',
      plik: 'apps/server/src/webhooks/deliver.test.ts:88',
      opis: 'Brakuje testu sciezki bledu sieciowego: mock powinien rzucac Error("connect ECONNREFUSED 127.0.0.1:8080"), '
        + 'zeby sprawdzic, czy deliverWebhook zamienia to na status `nieudane` zamiast wywalac worker.',
      _zrodlo: 'test-coverage',
    }],
    przebiegi: FAIL_PRZEBIEG,
    e2eTryb: 'przegladarka',
  })
  assert.equal(wynik, null, 'finding reviewera kodu/testow nigdy nie jest dowodem awarii srodowiska')
})

test('bloker NIE wykryty — realna sygnatura, ale tester nie ma ani jednego przebiegu', () => {
  const wynik = wykryjJakWorkflow({
    findingi: [e2e('net::ERR_CONNECTION_REFUSED przy otwieraniu http://localhost:5173/')],
    przebiegi: [],
    e2eTryb: 'przegladarka',
  })
  assert.equal(wynik, null, 'bloker bez przebiegu FAIL/SKIP to nie bloker')
})

test('bloker NIE wykryty — realna sygnatura, ale wszystkie przebiegi PASS', () => {
  const wynik = wykryjJakWorkflow({
    findingi: [e2e('W konsoli przegladarki pojawil sie net::ERR_NAME_NOT_RESOLVED dla zewnetrznego skryptu analityki, scenariusz przeszedl')],
    przebiegi: PASS_PRZEBIEG,
    e2eTryb: 'przegladarka',
  })
  assert.equal(wynik, null, 'komplet PASS oznacza, ze srodowisko dziala — nie ma czego zatrzymywac')
})

test('bloker NIE wykryty — tryb bez-przegladarki (odmowa polaczenia jest oczekiwana)', () => {
  const wynik = wykryjJakWorkflow({
    findingi: [e2e('curl: (7) Failed to connect to localhost port 5173: Connection refused — srodowiska E2E nie ma')],
    przebiegi: [{ checkbox: 'Weryfikacja: [E2E] `dashboard`', flow: 'dashboard', wynik: 'SKIP', dowod: 'brak srodowiska E2E' }],
    e2eTryb: 'bez-przegladarki',
  })
  assert.equal(wynik, null, 'w trybie bez przegladarki brak polaczenia jest stanem znanym, nie awaria')
})

test('bloker NIE wykryty — zwykly FAIL scenariusza bez sygnatury infrastrukturalnej', () => {
  const wynik = wykryjJakWorkflow({
    findingi: [e2e('Przycisk "Zapisz" nie zamyka modala — po kliknieciu dialog zostaje otwarty, brak toastu potwierdzenia')],
    przebiegi: FAIL_PRZEBIEG,
    e2eTryb: 'przegladarka',
  })
  assert.equal(wynik, null, 'defekt UI nie moze przebierac sie za awarie srodowiska')
})

// ── Kotwice wywolania w workflowie ─────────────────────────────────────────
// Sama funkcja nie zna ani zrodla findingu, ani trybu E2E — te dwa filtry sa w miejscu wywolania.
// Gdyby ktos je usunal, wszystkie testy wyzej dalej by przechodzily, a regresja wrocilaby po cichu.

test('wiring — wywolanie w workflowie filtruje po zrodle, trybie i podaje przebiegi testera', () => {
  assert.match(
    zrodlo,
    /const blokerSrodowiska = e2eTryb === 'przegladarka'\s*\n\s*\? wykryjBlokerSrodowiska\(wszystkie\.filter\(\(f\) => f\._zrodlo === 'e2e'\), e2ePrzebiegi\)\s*\n\s*: null/,
    'detekcja musi dostawac wylacznie findingi testera E2E, jego przebiegi i dzialac tylko w trybie przegladarki'
  )
})
