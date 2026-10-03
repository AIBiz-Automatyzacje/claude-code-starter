// Stan fazy w dev-autopilot-wf.js (PLAN-POPRAWY P7): tresc .autopilot-state.json liczona w JS, zapis doklejony do polecenia
// agenta, ktory w tym miejscu i tak startuje (mapa w HANDOFF 6a pkt 54); `stan:zapis` zostaje przed pod-workflowem
// i jako zapas. Funkcje wyciete ze zrodla workflowu.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/stan-fazy.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { Ajv } from 'ajv'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
const zrodloExecute = readFileSync(resolve(KATALOG, '../dev-docs-execute-wf.js'), 'utf8')

/** @param {string} kotwica @param {string} koniec @param {string} [z] @returns {string} */
function wytnij(kotwica, koniec, z = zrodlo) {
  const start = z.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = z.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return z.slice(start, stop + koniec.length)
}

// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const wf = new Function(
  `${wytnij('// ── Stan fazy (P7)', '// ── Koniec stanu fazy')}
   return { trescStanu, blokZapisuStanu, zapisPotwierdzony, stanPoExecute }`,
)()

// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const ex = new Function(
  `${wytnij('function bazaFazy(', '\n}', zrodloExecute)}
   ${wytnij('function stanZBaza(', '\n}', zrodloExecute)}
   ${wytnij('function blokZapisuStanu(', '\n}', zrodloExecute)}
   ${wytnij('function punktZapisuStanu(', '\n}', zrodloExecute)}
   return { bazaFazy, stanZBaza, blokZapisuStanu, punktZapisuStanu }`,
)()

const STAN = {
  nazwaZadania: 'smoke-autopilot',
  branch: { aktualny: 'feature/smoke-autopilot', wymagany: 'feature/smoke-autopilot', zgodny: true },
  zrodloStanu: 'state-json',
  fazy: [{ numer: 1, nazwa: 'Rdzen', execute: 'done', review: 'pending', fix: 'none', otwarteFindingi: [], baza: 'abc1234' }],
  zakonczenie: { walidacja: 'pending', complete: 'pending', compound: 'pending' },
  bazaZielona: null,
}

test('trescStanu: JSON pliku stanu z polami do wznowienia, bez pol bootstrapu', () => {
  const tresc = wf.trescStanu(STAN)
  assert.deepEqual(JSON.parse(tresc), {
    wersja: 1,
    zadanie: 'smoke-autopilot',
    fazy: STAN.fazy,
    zakonczenie: STAN.zakonczenie,
    bazaZielona: null,
  })
  assert.equal(JSON.parse(tresc).fazy[0].baza, 'abc1234')
})

test('trescStanu: opis findingu z cudzyslowem daje poprawny JSON', () => {
  const finding = { severity: 'P2', typ: 'KOD', plik: 'a.ts', opis: 'zwraca "null" zamiast bledu' }
  const stan = { ...STAN, fazy: [{ ...STAN.fazy[0], otwarteFindingi: [finding] }] }
  assert.equal(JSON.parse(wf.trescStanu(stan)).fazy[0].otwarteFindingi[0].opis, 'zwraca "null" zamiast bledu')
})

test('blokZapisuStanu: dokladne polecenie zapisu i odczytu z dysku, tresc miedzy znacznikami 1:1', () => {
  const tresc = wf.trescStanu(STAN)
  const blok = wf.blokZapisuStanu('docs/active/smoke-autopilot', tresc)
  assert.match(blok, /Write zapisz plik docs\/active\/smoke-autopilot\/\.autopilot-state\.json/)
  assert.ok(blok.includes(`--- POCZATEK STANU ---\n${tresc}\n--- KONIEC STANU ---`))
  assert.ok(blok.includes("JSON.parse(require('fs').readFileSync('docs/active/smoke-autopilot/.autopilot-state.json','utf8'))"))
  assert.match(blok, /stanZapisany/)
})

test('zapisPotwierdzony: tylko stanZapisany === true; null, false i brak wyniku ida do zapisu zapasowego', () => {
  assert.equal(wf.zapisPotwierdzony({ stanZapisany: true }), true)
  assert.equal(wf.zapisPotwierdzony({ stanZapisany: false }), false)
  assert.equal(wf.zapisPotwierdzony({ stanZapisany: null }), false)
  assert.equal(wf.zapisPotwierdzony({}), false)
  assert.equal(wf.zapisPotwierdzony(null), false)
})

test('stanPoExecute: faza oznaczona execute done w kopii, stan w pamieci bez zmian (domkniecie zapisuje kopie)', () => {
  const stan = { ...STAN, fazy: [{ ...STAN.fazy[0], execute: 'pending' }, { ...STAN.fazy[0], numer: 2, execute: 'pending' }] }
  const po = wf.stanPoExecute(stan, 2)
  assert.deepEqual(po.fazy.map((/** @type {{ execute: string }} */ f) => f.execute), ['pending', 'done'])
  assert.deepEqual(stan.fazy.map((f) => f.execute), ['pending', 'pending'])
  assert.equal(po.nazwaZadania, 'smoke-autopilot')
})

test('execute-wf stanZBaza: baza fazy (SHA z plannera) w stanie zapisywanym przez domkniecie; bez SHA = null', () => {
  const tresc = wf.trescStanu(wf.stanPoExecute({ ...STAN, fazy: [{ ...STAN.fazy[0], execute: 'pending', baza: undefined }] }, 1))
  const zSha = JSON.parse(ex.stanZBaza(tresc, 1, ex.bazaFazy({ baza: 'abc1234' })))
  assert.equal(zSha.fazy[0].baza, 'abc1234')
  assert.equal(zSha.fazy[0].execute, 'done')
  assert.equal(JSON.parse(ex.stanZBaza(tresc, 1, ex.bazaFazy({ baza: 'nie-sha' }))).fazy[0].baza, null)
  assert.equal(ex.stanZBaza(tresc, 1, 'abc1234'), JSON.stringify(zSha, null, 2), 'format jak trescStanu autopilota')
})

test('blok zapisu stanu w execute-wf jest kopia bloku autopilota', () => {
  assert.equal(ex.blokZapisuStanu('docs/active/x', '{}'), wf.blokZapisuStanu('docs/active/x', '{}'))
})

test('domkniecie: punkt zapisu stanu po dossier, tylko przy status=completed; bez args.stanPoExecute — brak punktu', () => {
  const tresc = wf.trescStanu(wf.stanPoExecute(STAN, 1))
  const punkt = ex.punktZapisuStanu('docs/active/x', 1, 'abc1234', tresc)
  assert.match(punkt, /^\n\nZAPIS STANU \(po punkcie 6\), gdy zwracasz status=completed; przy innym statusie pomin go i zwroc stanZapisany=false\./)
  assert.ok(punkt.includes(ex.blokZapisuStanu('docs/active/x', ex.stanZBaza(tresc, 1, 'abc1234'))))
  assert.equal(ex.punktZapisuStanu('docs/active/x', 1, 'abc1234', undefined), '')
})

test('wiring execute-wf: punkt zapisu doklejony do promptu domkniecia, wynik niesie baze fazy z JS', () => {
  assert.match(zrodloExecute, /domknieciePrompt\(sciezka, faza, buildResults, bazaFazy\(plan\), plikBramek\(sciezka, faza\)\) \+ punktZapisuStanu\(sciezka, faza, bazaFazy\(plan\), args\.stanPoExecute\)/)
  assert.match(zrodloExecute, /return wynik && \{ \.\.\.wynik, baza: bazaFazy\(plan\) === 'HEAD' \? null : bazaFazy\(plan\) \}/)
  assert.match(zrodloExecute, /stanZapisany: \{ type: \['boolean', 'null'\]/)
})

// ── Wiring 14 miejsc (mapa HANDOFF 6a pkt 54) ─────────────────────────────────

/** @param {string} etykieta fragment opcji `label: ...` @returns {string} linia wywolania agenta z ta etykieta */
function liniaAgenta(etykieta) {
  const linia = zrodlo.split('\n').find((l) => l.includes(`label: ${etykieta}`))
  assert.ok(linia, `brak wywolania agenta z label: ${etykieta}`)
  return linia
}

const NASTEPCY = [
  ["'e2e:precheck'", 'E2E_PRECHECK'], ['`fix:faza-${numerFazy}`', 'FIX_RESULT'], ["'walidacja-koncowa'", 'VALIDATION_RESULT'],
  ["'e2e:env-down'", 'E2E_DOWN_RESULT'], ["'compound-refresh'", 'REFRESH_RESULT'], ["'stop:commit-artefaktow'", 'COMMIT_ARTEFAKTOW'],
]

test('wiring: nastepcy dostaja zapis doklejony przez zeStanem, potwierdzaja go polem stanZapisany i potwierdzStan', () => {
  for (const [etykieta, schemat] of NASTEPCY) {
    assert.match(liniaAgenta(etykieta), /agent\(zeStanem\(/, etykieta)
    assert.match(wytnij(`const ${schemat} = {`, '\n}'), /stanZapisany: POLE_STANU/, schemat)
  }
  assert.equal(zrodlo.match(/await potwierdzStan\(/g)?.length, NASTEPCY.length)
})

test('wiring: zmiany stanu oznaczaja zapis (oznaczStan), gole zapiszStan() znika; stan:zapis tylko w zapisie zapasowym', () => {
  assert.doesNotMatch(zrodlo, /await zapiszStan\(\)/)
  // 14 miejsc mapy minus execute (zapisuje domkniecie) plus STOP po execute, gdy domkniecie zapisalo juz stan „done”
  const kod = zrodlo.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  assert.equal(kod.match(/(?<!function )\boznaczStan\(\)/g)?.length, 14)
  assert.equal(zrodlo.match(/label: 'stan:zapis'/g)?.length, 1)
})

test('wiring: zalegly stan idzie do stan:zapis przed kazdym pod-workflowem (miejsca a–c mapy); po complete-wf zadnego zapisu', () => {
  const linie = zrodlo.split('\n')
  const wywolania = linie.map((l, i) => ({ l, i })).filter(({ l }) => /await workflow\('/.test(l))
  assert.equal(wywolania.length, 4)
  for (const { l, i } of wywolania) {
    const przed = linie.slice(Math.max(0, i - 3), i).join('\n')
    assert.match(przed, /await zapiszZaleglyStan\(\)/, l.trim())
  }
  // complete-wf przenosi katalog zadania do archiwum — zapis stanu po nim wskrzesilby pusty katalog w docs/active/
  const poComplete = zrodlo.slice(zrodlo.indexOf("await workflow('dev-docs-complete-wf'"))
  assert.doesNotMatch(poComplete, /zapiszZaleglyStan\(|oznaczStan\(|zapiszStan\(|zeStanem\(/)
})

// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const PLAN_STATE = new Function(
  `${wytnij('const FINDING_OTWARTY = {', '\n}')}
   ${wytnij('const METRYKI_FAZY = {', '\n}')}
   ${wytnij('const PLAN_STATE = {', '\n}')}
   return PLAN_STATE`,
)()

test('PLAN_STATE: baza fazy przechodzi przez bootstrap (string albo null), stan bez pola — poprawny (starsze zadania)', () => {
  const faza = new Ajv({ strict: false }).compile(PLAN_STATE.properties.fazy.items)
  const { baza, ...bezBazy } = STAN.fazy[0]
  assert.equal(faza(structuredClone(STAN.fazy[0])), true, JSON.stringify(faza.errors))
  assert.equal(faza({ ...bezBazy, baza: null }), true)
  assert.equal(faza(bezBazy), true)
  assert.equal(baza, 'abc1234')
  assert.match(wytnij('function bootstrapPrompt(', '\n}'), /Pole "baza" fazy \(jesli obecne\) przepisz 1:1/)
})

const zrodloReview = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')
// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const rv = new Function(
  `${wytnij('// ── Dossier i routing (P7)', '// ── Koniec dossier i routingu', zrodloReview)}
   return { dossierFazy, dossierPrompt }`,
)()

test('wznowienie po STOP-ie miedzy execute a review: baza z pliku stanu trafia do zapasowego agenta dossier', async () => {
  // Plik stanu zapisany przez domkniecie fazy 1; run zatrzymany przed review.
  const plik = JSON.parse(ex.stanZBaza(wf.trescStanu(wf.stanPoExecute({ ...STAN, fazy: [{ ...STAN.fazy[0], execute: 'pending', baza: undefined }] }, 1)), 1, 'abc1234'))
  const faza = plik.fazy[0]
  assert.deepEqual([faza.execute, faza.review], ['done', 'pending'])
  // Swiezy run: execute pominiete (dossierZExecute = null), review dostaje baze ze stanu.
  const wywolanie = zrodlo.slice(zrodlo.indexOf("workflow('dev-docs-review-wf'"))
  assert.match(wywolanie.slice(0, wywolanie.indexOf('})')), /\bbaza: faza\.baza \|\| null,/)
  const args = { sciezka: 'docs/active/smoke-autopilot', faza: 1, dossier: null, baza: faza.baza || null }
  /** @type {string[]} */
  const polecenia = []
  const { zrodlo: zrodloDossier } = await rv.dossierFazy(args, async () => {
    polecenia.push(rv.dossierPrompt(args.sciezka, args.faza, args.baza))
    return null
  })
  assert.equal(zrodloDossier, null)
  assert.equal(polecenia.length, 1)
  assert.match(polecenia[0], /dossier\.mjs --sciezka docs\/active\/smoke-autopilot --faza 1 --baza abc1234/)
})

// ── Zwiniecie sekcji „Do poprawy” w fixie (P7, PWE-zwin) ─────────────────────

// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const { blokZwinieciaDoPoprawy } = new Function(
  `${wytnij('function blokZwinieciaDoPoprawy(', '\n}')}
   return { blokZwinieciaDoPoprawy }`,
)()

test('blokZwinieciaDoPoprawy: sekcja i raport fazy z JS; zaznaczone wiersze zwijane, niezaznaczone zostaja doslownie', () => {
  const blok = blokZwinieciaDoPoprawy('docs/active/x', 3)
  assert.match(blok, /"## Do poprawy po review fazy 3" pliku docs\/active\/x\/\*-zadania\.md/)
  assert.match(blok, /usun wiersze zaznaczone \(`- \[x\]`\)/)
  assert.ok(blok.includes('`Zamkniete cyklem fix: <liczba usunietych wierszy> pozycji — pelna tresc findingow i uzasadnienia w `review-faza-3.md`.`'))
  assert.match(blok, /Wiersze niezaznaczone \(`- \[ \]`\) zostaja doslownie/)
  assert.match(blok, /"## Operator checklist faza 3"/)
})

test('wiring: zwiniecie w poleceniu fixa przed commitem; agent zwin-do-poprawy znika', () => {
  const fix = wytnij('function fixPrompt(', '\n}')
  assert.ok(fix.indexOf('${blokZwinieciaDoPoprawy(sciezka, numerFazy)}') < fix.indexOf('Kolejnosc: KOD -> TEST -> E2E. Po naprawach'))
  assert.notEqual(fix.indexOf('${blokZwinieciaDoPoprawy(sciezka, numerFazy)}'), -1)
  assert.doesNotMatch(zrodlo, /zwin-do-poprawy|Zwin ZAMKNIETE pozycje/)
})
