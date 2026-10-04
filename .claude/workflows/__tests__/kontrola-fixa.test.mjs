// Testy dev-autopilot-wf.js: bilans tury poprawkowej po kontroli diffu naprawczego (audyt 2026-09-06, N9) oraz strażnik
// It. 1 — orkiestrator nie powołuje agenta telemetrii i nie liczy tokenów z budget.spent().
//
// Uruchomienie:  node --test .claude/workflows/__tests__/kontrola-fixa.test.mjs
//   albo caly katalog:  node --test '.claude/workflows/__tests__/*.test.mjs'   (glob w apostrofach)
//
// N9: `kontrolaFixa` szla do stanu jako {pozycje, naprawione, walidacja} i gubila `nienaprawione[]`
//     z odpowiedzi agenta. Przy 61 pozycjach / 55 naprawionych / PASS dwie pozycje nie mialy sladu.
// Skrot `e2eSync` (N6) przeniesiony razem z testami do telemetrii (.claude/scripts/telemetria/faza.mjs) — It. 1 krok 7.
// Telemetria (It. 1): zapis robi skrypt po runie (hook Stop), nie agent — agent haiku dwa razy skasowal wspolny plik,
// a budget.spent() liczy tylko tokeny wyjsciowe (~11% kosztu; decyzja O3: usunac wszystkie trzy liczniki).

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')

// Ekstrakcja ze zrodla — workflowy sa skryptami runtime'u Workflow, `import()` ich nie zaladuje.
// `new Function` z interpolacja jest tu bezpieczny: wklejamy fragment z pliku w tym repo, nie z inputu.
/**
 * @param {string} kotwica
 * @param {string} koniec
 * @param {string} opis
 * @returns {string}
 */
function wytnij(kotwica, koniec, opis) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu (${opis}) wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca ${opis}`)
  return zrodlo.slice(start, stop + koniec.length)
}

// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { KONTROLA_FIXA, kontrolaFixaPrompt, podsumujKontroleFixa, pozycjeKontroliFixa, zakresFixa } = new Function('BLOK_DLUGIE_KOMENDY',
  `${wytnij('function podsumujKontroleFixa(', '\n}', 'podsumujKontroleFixa')}
   ${wytnij('function zakresFixa(', '\n}', 'zakresFixa')}
   ${wytnij('function pozycjeKontroliFixa(', '\n}', 'pozycjeKontroliFixa')}
   ${wytnij('function kontrolaFixaPrompt(', '\n}', 'kontrolaFixaPrompt')}
   ${wytnij('const WYNIK_LISTY_KONTROLI = {', '\n}', 'WYNIK_LISTY_KONTROLI')}
   ${wytnij('const WYNIK_K6 = {', '\n}', 'WYNIK_K6')}
   ${wytnij('const KONTROLA_FIXA = {', '\n}', 'KONTROLA_FIXA')}
   return { KONTROLA_FIXA, kontrolaFixaPrompt, podsumujKontroleFixa, pozycjeKontroliFixa, zakresFixa }`,
)('')

// ── Telemetria It. 1: bez agenta i bez budget.spent() ─────────────────────
// Strażnik regresji na zrodle — skryptu workflowu nie da sie uruchomic w tescie (wymaga runtime'u Workflow).

test('orkiestrator nie powoluje agenta telemetrii', () => {
  assert.doesNotMatch(zrodlo, /label: `telemetria:/, 'zapis telemetrii robi zbierz.mjs z hooka Stop, nie agent w runie')
  assert.doesNotMatch(zrodlo, /autopilot-runs\.jsonl/, 'stary plik telemetrii nie jest juz zapisywany z workflowu')
})

test('orkiestrator nie liczy tokenow z budget.spent() — koszt tylko z telemetrii (pelny cennik)', () => {
  assert.doesNotMatch(zrodlo, /budget\.spent/)
  assert.doesNotMatch(zrodlo, /tokenyEtapy|tokenyRazemK/)
})

// ── N9 ────────────────────────────────────────────────────────────────────

test('komplet napraw: zero pominietych, zero bez sladu', () => {
  const k = podsumujKontroleFixa(5, { naprawione: 5, walidacja: 'PASS', nienaprawione: [] })
  assert.deepEqual(k, { pozycje: 5, naprawione: 5, walidacja: 'PASS', pominiete: [], bezSladu: 0 })
})

test('pominiete Z uzasadnieniem wchodza do stanu, bilans sie zgadza', () => {
  const k = podsumujKontroleFixa(61, {
    naprawione: 55, walidacja: 'PASS',
    nienaprawione: [
      'decision-service.test.ts:12 — rzutowanie na granicy zewnetrznego SDK (dubler Supabase)',
      'queue-store.test.ts:40 — jw.',
      'a.test.ts:1 — dubler ClientRequest Node',
      'b.test.ts:2 — dubler ClientRequest Node',
      'c.ts:9 — poza zakresem fazy',
      'd.ts:3 — poza zakresem fazy',
    ],
  })
  assert.equal(k.pominiete.length, 6, 'uzasadnienia agenta NIE moga byc wyrzucane — to byl caly problem N9')
  assert.equal(k.bezSladu, 0)
})

test('luka bez uzasadnienia jest POLICZONA — PASS przy 55/61 nie udaje 61/61', () => {
  // Dokladnie przypadek z produkcji: 61 pozycji, 55 naprawionych, 4 opisane, 2 znikaja.
  const k = podsumujKontroleFixa(61, { naprawione: 55, walidacja: 'PASS', nienaprawione: ['a', 'b', 'c', 'd'] })
  assert.equal(k.bezSladu, 2, 'dwie pozycje ani nie naprawione, ani nie uzasadnione — musza byc widoczne jako liczba')
  assert.equal(k.walidacja, 'PASS', 'walidacja zostaje taka, jaka zglosil agent — bezSladu jest OBOK niej, nie zamiast')
})

test('brak pola nienaprawione (agent pominal) = wszystko nienaprawione jest bez sladu', () => {
  const k = podsumujKontroleFixa(10, { naprawione: 7, walidacja: 'PASS' })
  assert.deepEqual(k.pominiete, [])
  assert.equal(k.bezSladu, 3)
})

test('puste i nie-stringowe wpisy w nienaprawione nie licza sie jako uzasadnienie', () => {
  const k = podsumujKontroleFixa(4, { naprawione: 2, walidacja: 'PASS', nienaprawione: ['', '   ', null, 'x.ts:1 — realny powod'] })
  assert.deepEqual(k.pominiete, ['x.ts:1 — realny powod'])
  assert.equal(k.bezSladu, 1)
})

test('agent zglaszajacy wiecej niz bylo pozycji nie daje ujemnego bezSladu', () => {
  const k = podsumujKontroleFixa(3, { naprawione: 5, walidacja: 'PASS', nienaprawione: [] })
  assert.equal(k.bezSladu, 0)
})

// ── P8: zakres kontroli z hashy commitow fixa (H41–H43) ─────────────────────
// Pre-skan haiku szukal "pierwszego commita fixa tej fazy" grepem po historii zadania: mediana 20 wywolan na jeden diff.

test('zakresFixa: hashe z FixResult.commity (takze "hash opis") daja diff od rodzica najstarszego', () => {
  const z = zakresFixa(3, ['abc1234 fix(x): poprawki po review fazy 3', 'def5678'])
  assert.match(z, /abc1234 def5678/)
  assert.match(z, /git log --no-walk --format=%h abc1234 def5678/)
  assert.doesNotMatch(z, /--grep/, 'z hashami agent nie szuka commitow po historii')
})

test('zakresFixa: brak hashy (pole puste, nie-hash) = zapasowy grep po komunikacie fixa tej fazy', () => {
  for (const commity of [undefined, [], ['to nie hash', '']]) {
    const z = zakresFixa(2, commity)
    assert.match(z, /git log --oneline --grep="\^fix\("/)
    assert.match(z, /fazy 2/)
  }
})

// ── P8: pozycje do poprawki z list K-1…K-7 katalogu A i z bramek P6 na plikach fixa ──
// Dawna kontrola (regresje + bramki) zlapala 0 z 30 defektow urodzonych w fixie (test review); listy K daja polecenie per klasa.

/** @param {string} id @param {Array<{ plik: string, opis: string }>} [pozycje] */
const lista = (id, pozycje = []) => ({ sprawdzono: `${id}: git diff fixa`, pozycje })
const KONTROLA_CZYSTA = {
  listy: {
    'K-1': lista('K-1'), 'K-2': lista('K-2'), 'K-3': lista('K-3'), 'K-4': lista('K-4'), 'K-5': lista('K-5'),
    'K-6': { sprawdzono: 'K-6: brak P1', testy: /** @type {Array<{ finding: string, test: string | null, czerwonyPrzedPoprawka: boolean }>} */ ([]) },
    'K-7': lista('K-7'),
  },
  bramki: lista('bramki'),
}

test('pozycjeKontroliFixa: czysta kontrola = zero pozycji; brak wyniku agenta = zero pozycji', () => {
  assert.deepEqual(pozycjeKontroliFixa(KONTROLA_CZYSTA), [])
  assert.deepEqual(pozycjeKontroliFixa(null), [])
})

test('pozycjeKontroliFixa: pozycje list i bramek ze zrodlem, w kolejnosci K-1…K-7, potem bramki', () => {
  const k = structuredClone(KONTROLA_CZYSTA)
  k.listy['K-7'].pozycje = [{ plik: 'src/obcy.ts', opis: 'zmiana bez findingu' }]
  k.listy['K-1'].pozycje = [{ plik: 'src/api.ts:12', opis: 'nowe pole odpowiedzi' }]
  k.bramki.pozycje = [{ plik: 'supabase/migrations/001.sql', opis: 'migracje: edycja wypchnietej migracji' }]
  assert.deepEqual(pozycjeKontroliFixa(k), [
    { zrodlo: 'K-1', plik: 'src/api.ts:12', opis: 'nowe pole odpowiedzi' },
    { zrodlo: 'K-7', plik: 'src/obcy.ts', opis: 'zmiana bez findingu' },
    { zrodlo: 'bramki', plik: 'supabase/migrations/001.sql', opis: 'migracje: edycja wypchnietej migracji' },
  ])
})

test('pozycjeKontroliFixa: K-6 — P1 bez testu albo z testem zielonym przed poprawka to pozycja; czerwony nie', () => {
  const k = structuredClone(KONTROLA_CZYSTA)
  k.listy['K-6'].testy = [
    { finding: 'src/a.ts:1', test: 'src/a.test.ts', czerwonyPrzedPoprawka: true },
    { finding: 'src/b.ts:2', test: 'src/b.test.ts', czerwonyPrzedPoprawka: false },
    { finding: 'src/c.ts:3', test: null, czerwonyPrzedPoprawka: false },
  ]
  const pozycje = pozycjeKontroliFixa(k)
  assert.deepEqual(pozycje.map((/** @type {{ zrodlo: string, plik: string }} */ p) => [p.zrodlo, p.plik]), [['K-6', 'src/b.ts:2'], ['K-6', 'src/c.ts:3']])
  assert.match(pozycje[0].opis, /src\/b\.test\.ts/)
  assert.match(pozycje[0].opis, /przechodzi na kodzie sprzed poprawki/)
  assert.match(pozycje[1].opis, /bez testu/)
})

test('KONTROLA_FIXA: pole wyniku kazdej listy K-1…K-7 i bramek wymagane, kazde z wpisem sprawdzono', () => {
  const LISTY = ['K-1', 'K-2', 'K-3', 'K-4', 'K-5', 'K-6', 'K-7']
  assert.deepEqual(KONTROLA_FIXA.required, ['listy', 'bramki'])
  assert.deepEqual(KONTROLA_FIXA.properties.listy.required, LISTY)
  assert.deepEqual(Object.keys(KONTROLA_FIXA.properties.listy.properties), LISTY)
  for (const wynik of [...Object.values(KONTROLA_FIXA.properties.listy.properties), KONTROLA_FIXA.properties.bramki]) {
    assert.ok(wynik.required.includes('sprawdzono'), 'pusta lista ma wpis, czego i czym szukano (katalog A)')
  }
  assert.deepEqual(KONTROLA_FIXA.properties.listy.properties['K-6'].required, ['sprawdzono', 'testy'])
})

test('kontrolaFixaPrompt: listy K-1…K-7, bramki na plikach fixa, zakres z hashy i P1 do K-6', () => {
  const findingi = [
    { severity: 'P1', typ: 'KOD', plik: 'src/a.ts:3', opis: 'brak sprawdzenia roli' },
    { severity: 'P2', typ: 'KOD', plik: 'src/b.ts:9', opis: 'stan rozjechany' },
  ]
  const p = kontrolaFixaPrompt('docs/active/x', 2, ['abc1234'], findingi)
  for (const id of ['K-1', 'K-2', 'K-3', 'K-4', 'K-5', 'K-6', 'K-7', 'L-COR-1', 'L-COR-2', 'L-COR-3']) assert.match(p, new RegExp(`^ *${id}`, 'm'), id)
  assert.match(p, /node \.claude\/scripts\/bramki\/bramki\.mjs --baza <najstarszy>\^/)
  assert.match(p, /abc1234/)
  assert.match(p, /P1 naprawiane przez fix: src\/a\.ts:3\)/)
  assert.match(p, /git worktree add --detach/)
  assert.match(kontrolaFixaPrompt('docs/active/x', 2, [], findingi.slice(1)), /P1 naprawiane przez fix: brak/)
})

test('straznik P8: brak agentow fix:pre-skan i verify-fix — zastapione listami K kontroli fixa', () => {
  assert.doesNotMatch(zrodlo, /label: `fix:pre-skan/)
  assert.doesNotMatch(zrodlo, /label: `verify-fix/)
  assert.doesNotMatch(zrodlo, /PRE_SKAN_FIXA|POSTFIX_VERDICT|REGRESJA_FIXA/)
  assert.match(zrodlo, /agent\(kontrolaFixaPrompt\(sciezka, numerFazy, fix\.commity, faza\.otwarteFindingi\), \{ schema: KONTROLA_FIXA/)
})
