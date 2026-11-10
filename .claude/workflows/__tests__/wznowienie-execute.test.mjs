// Wznowienie po przerwanym execute (znaleziska szablonu, punkt 34): baza fazy na kazdym wyjsciu, jednostki ukonczone zapisane
// domknieciem czesciowym i pamietane w stanie zadania, pliki jednostki nieukonczonej w schowku gita, bramki przy wznowieniu.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/wznowienie-execute.test.mjs
//
// DLACZEGO: aa-exam E3 (wf_1c69a604-076, faza 3). IU-10 i IU-11 byly ukonczone, IU-12 zwrocila `blocked`; execute wrocil
// z `commity: []`, 26 pozycji zostalo w drzewie, swiezy run stanal na bramce czystosci, a faze zbudowano od nowa. Dashboard E2
// (faza 6): commit z zielona walidacja i stan `execute: pending` wymagal recznej edycji `.autopilot-state.json`.
// Funkcje czyste wyciete ze zrodla workflowu; agentow nie uruchamiamy.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { Ajv } from 'ajv'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const EXECUTE = readFileSync(resolve(KATALOG, '../dev-docs-execute-wf.js'), 'utf8')
const AUTOPILOT = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')

/** @param {string} z @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(z, kotwica, koniec) {
  const start = z.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = z.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return z.slice(start, stop + koniec.length)
}

// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const ex = new Function(
  `const BLOK_DLUGIE_KOMENDY = '[DLUGIE KOMENDY]'
   ${wytnij(EXECUTE, 'function bazaFazy(', '\n}')}
   ${wytnij(EXECUTE, '// ── Wznowienie po przerwanym execute', '// ── Koniec wznowienia po przerwanym execute')}
   ${wytnij(EXECUTE, 'function plannerPrompt(', '\n}')}
   ${wytnij(EXECUTE, 'function domknieciePrompt(', '\n}')}
   return { CZESCIOWE_RESULT, kluczIu, bezUkonczonych, planCzesciowegoDomkniecia, nazwaSchowka, domkniecieCzesciowePrompt, wynikPrzerwanego, plannerPrompt, domknieciePrompt }`,
)()

// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const wf = new Function(
  `${wytnij(AUTOPILOT, '// ── Stan fazy (P7)', '// ── Koniec stanu fazy')}
   return { trescStanu, stanPoExecute, opisCzesciowego }`,
)()

const BAZA = 'abc1234abc1234abc1234abc1234abc1234abc12'
const iu = (/** @type {string} */ id) => ({ id, nazwa: id, agentType: 'feature-builder-data', prompt: 'p' })
/** @param {{ id: string }[]} jednostki @returns {string[]} */
const idy = (jednostki) => jednostki.map((j) => j.id)
const gotowa = (/** @type {string} */ id, /** @type {string[]} */ pliki) => ({ id, status: 'completed', pliki })

test('bezUkonczonych: jednostki ze stanu odpadaja z listy plannera niezaleznie od zapisu id', () => {
  const lista = [iu('IU-10'), iu('IU-11'), iu('IU-12')]
  assert.deepEqual(idy(ex.bezUkonczonych(lista, ['IU-10', '11'])), ['IU-12'])
  assert.deepEqual(idy(ex.bezUkonczonych(lista, [])), ['IU-10', 'IU-11', 'IU-12'])
  assert.deepEqual(ex.bezUkonczonych(lista, undefined).length, 3)
  assert.equal(ex.kluczIu('IU-12'), ex.kluczIu('12'))
  assert.notEqual(ex.kluczIu('IU-1'), ex.kluczIu('IU-11'), 'IU-1 nie zdejmuje IU-11')
})

test('planCzesciowegoDomkniecia (E3): serial z `blocked` — ukonczone do commita, zablokowana i niezaczete jako nieukonczone', () => {
  const plan = { strategia: 'serial', iu: [iu('IU-10'), iu('IU-11'), iu('IU-12'), iu('IU-13')] }
  const wyniki = [gotowa('IU-10', ['src/a.ts']), gotowa('IU-11', ['src/b.ts', 'src/b.test.ts']), { id: 'IU-12', status: 'blocked', pliki: ['src/mail.ts'], pytanie: 'imie w mailu?' }]
  assert.deepEqual(ex.planCzesciowegoDomkniecia(plan, wyniki), {
    mozna: true,
    powod: null,
    ukonczone: [{ id: 'IU-10', pliki: ['src/a.ts'] }, { id: 'IU-11', pliki: ['src/b.ts', 'src/b.test.ts'] }],
    nieukonczone: ['IU-12 (blocked)', 'IU-13 (nie zaczeta)'],
  })
})

test('planCzesciowegoDomkniecia: odmowa, gdy plikow nie da sie rozdzielic — drzewo zostaje jak dotad', () => {
  const serial = { strategia: 'serial', iu: [iu('IU-1'), iu('IU-2'), iu('IU-3')] }
  const odmowa = (/** @type {unknown} */ w) => /** @type {{ mozna: boolean, powod: string }} */ (w)
  // Zadna jednostka nie jest ukonczona: nie ma czego zapisac.
  assert.equal(odmowa(ex.planCzesciowegoDomkniecia(serial, [{ id: 'IU-1', status: 'blocked', pliki: [] }])).powod, 'zadna jednostka fazy nie jest ukonczona')
  // Plik wspolny jednostki ukonczonej i zablokowanej.
  const wspolny = odmowa(ex.planCzesciowegoDomkniecia(serial, [gotowa('IU-1', ['src/a.ts']), { id: 'IU-2', status: 'blocked', pliki: ['src/a.ts', 'src/c.ts'] }]))
  assert.deepEqual([wspolny.mozna, wspolny.powod], [false, 'plik zmieniony przez jednostke ukonczona i nieukonczona: src/a.ts'])
  // Serial: builder zabity w trakcie pracy (brak wyniku, bez `blocked`) mogl zmienic pliki wczesniejszych jednostek.
  const zabity = odmowa(ex.planCzesciowegoDomkniecia(serial, [gotowa('IU-1', ['src/a.ts'])]))
  assert.equal(zabity.mozna, false)
  assert.match(zabity.powod, /^nie wiadomo, ktore pliki zmienila jednostka IU-2 \(brak wyniku albo listy plikow\)/)
  // Serial: zablokowany builder bez listy plikow — to samo.
  assert.match(odmowa(ex.planCzesciowegoDomkniecia(serial, [gotowa('IU-1', ['src/a.ts']), { id: 'IU-2', status: 'blocked' }])).powod, /^nie wiadomo, ktore pliki zmienila jednostka IU-2/)
  // Jednostka ukonczona bez listy plikow: nie wiadomo, co commitowac.
  assert.equal(odmowa(ex.planCzesciowegoDomkniecia(serial, [gotowa('IU-1', []), { id: 'IU-2', status: 'blocked', pliki: [] }])).powod, 'jednostka ukonczona bez listy plikow: IU-1')
})

test('planCzesciowegoDomkniecia: parallel z builderem bez wyniku — jednostki niezalezne, ukonczone ida do commita', () => {
  const plan = { strategia: 'parallel', iu: [iu('IU-1'), iu('IU-2'), iu('IU-3')] }
  const w = ex.planCzesciowegoDomkniecia(plan, [gotowa('IU-1', ['src/a.ts']), gotowa('IU-3', ['src/c.ts'])])
  assert.equal(w.mozna, true)
  assert.deepEqual(w.nieukonczone, ['IU-2 (bez wyniku)'])
})

test('domkniecie czesciowe: schowek z nazwa zadania i fazy, walidacja bez naprawiania, commit tylko plikow ukonczonych, bez bramek', () => {
  const czesc = { mozna: true, powod: null, ukonczone: [{ id: 'IU-10', pliki: ['src/a.ts'] }], nieukonczone: ['IU-12 (blocked)'] }
  const prompt = ex.domkniecieCzesciowePrompt('docs/active/e3-design/', 3, czesc, BAZA)
  assert.equal(ex.nazwaSchowka('docs/active/e3-design/', 3), 'autopilot/e3-design/faza-3')
  assert.match(prompt, /- IU-10: src\/a\.ts\nJednostki nieukonczone: IU-12 \(blocked\)/)
  assert.match(prompt, /`git stash push --include-untracked -m "autopilot\/e3-design\/faza-3" -- <pliki \(c\)>`/)
  assert.match(prompt, /Niczego nie naprawiasz i nie zmieniasz kodu: czerwona walidacja znaczy, ze jednostki ukonczone\n\s+nie stoja bez przerwanej\. Wtedy przywroc pliki \(c\) \(`git stash pop`, gdy schowek powstal\)/)
  assert.match(prompt, /`git add` wylacznie pliki \(a\) i dwa pliki z punktu 4 \(nie git add \.\)/)
  assert.match(prompt, new RegExp(`Bramek mechanicznych i dossier nie uruchamiasz: zrobi je domkniecie calej fazy, liczone od bazy ${BAZA}`))
  assert.match(prompt, /\[DLUGIE KOMENDY\]/)
  const schemat = new Ajv({ strict: false }).compile(ex.CZESCIOWE_RESULT)
  assert.equal(schemat({ zacommitowano: true, commit: 'abc1234', schowek: 'autopilot/e3-design/faza-3', plikiOdlozone: ['src/mail.ts'], walidacja: 'PASS', powod: null }), true)
  assert.equal(schemat({ zacommitowano: false }), false, 'pola wymagane')
})

test('wynikPrzerwanego: baza zawsze; iuUkonczone rosnie tylko po udanym commicie; odmowa i brak wyniku agenta niosa powod', () => {
  const plan = { baza: BAZA }
  const pola = { fazaNumer: 3, status: 'blocked', iu: [], problem: 'pytanie' }
  const czesc = { mozna: true, powod: null, ukonczone: [{ id: 'IU-11', pliki: ['src/b.ts'] }], nieukonczone: ['IU-12 (blocked)'] }
  const ok = { zacommitowano: true, commit: 'fedcba9', schowek: 'autopilot/x/faza-3', plikiOdlozone: ['src/mail.ts'], walidacja: 'PASS', powod: null }
  const zapisany = ex.wynikPrzerwanego(pola, plan, ['IU-10'], czesc, ok)
  assert.deepEqual([zapisany.status, zapisany.problem, zapisany.baza, zapisany.commity], ['blocked', 'pytanie', BAZA, ['fedcba9']])
  assert.deepEqual(zapisany.iuUkonczone, ['IU-10', 'IU-11'])
  assert.equal(zapisany.czesciowe, ok)
  // Walidacja czerwona: nic nie zapisano, lista ze stanu bez zmian.
  const czerwony = ex.wynikPrzerwanego(pola, plan, ['IU-10'], czesc, { ...ok, zacommitowano: false, commit: null, schowek: null, powod: 'typecheck: TS2304' })
  assert.deepEqual([czerwony.iuUkonczone, czerwony.commity, czerwony.czesciowe.powod], [['IU-10'], [], 'typecheck: TS2304'])
  // Odmowa z planu (bez agenta) i agent bez wyniku.
  const odmowa = ex.wynikPrzerwanego(pola, plan, [], { mozna: false, powod: 'zadna jednostka fazy nie jest ukonczona', ukonczone: [], nieukonczone: [] }, null)
  assert.deepEqual([odmowa.baza, odmowa.iuUkonczone, odmowa.czesciowe.zacommitowano, odmowa.czesciowe.powod], [BAZA, [], false, 'zadna jednostka fazy nie jest ukonczona'])
  assert.match(ex.wynikPrzerwanego(pola, plan, [], czesc, null).czesciowe.powod, /agent domkniecia czesciowego nie zwrocil wyniku/)
  // Baza nieznana (planner bez SHA) nie udaje SHA.
  assert.equal(ex.wynikPrzerwanego(pola, { baza: 'HEAD~1' }, [], czesc, ok).baza, null)
})

test('wiring execute-wf: oba przerwane wyjscia ida przez domkniecie czesciowe i wynikPrzerwanego; builder podaje pliki takze przy blocked', () => {
  const orkiestracja = EXECUTE.slice(EXECUTE.indexOf('// ── Orkiestracja'))
  assert.equal(orkiestracja.split('const { czesc, czesciowe } = await zapiszUkonczone()').length - 1, 2, 'blocked i builder bez wyniku')
  assert.equal(orkiestracja.split('return wynikPrzerwanego({').length - 1, 2)
  assert.doesNotMatch(orkiestracja, /commity: \[\],\n\s+testy: 'n\/a'/, 'stare zwroty bez bazy znikaja')
  assert.match(orkiestracja, /agent\(domkniecieCzesciowePrompt\(sciezka, faza, czesc, bazaFazy\(plan\)\), \{ schema: CZESCIOWE_RESULT, agentType: 'klasa-orkiestracyjny'/)
  assert.match(orkiestracja, /if \(!czesc\.mozna\) return \{ czesc, czesciowe: null \}/)
  assert.match(wytnij(EXECUTE, 'const BLOK_PYTANIE_BLOKERA = `', '.`\n'), /Pole pliki wypelniasz takze przy blocked i partial: kazdy plik, ktory zdazyles utworzyc albo zmienic \(pusta lista, gdy zadnego\)/)
})

test('wiring execute-wf: lista ze stanu filtruje jednostki w JS, a planner bez pracy z baza w stanie idzie do domkniecia (bramki przed review)', () => {
  const orkiestracja = EXECUTE.slice(EXECUTE.indexOf('// ── Orkiestracja'))
  assert.match(orkiestracja, /const ukonczoneWczesniej = Array\.isArray\(args\.iuUkonczone\) \? args\.iuUkonczone\.filter\(/)
  assert.match(orkiestracja, /agent\(plannerPrompt\(sciezka, faza, ukonczoneWczesniej\), \{/)
  assert.match(orkiestracja, /plan\.iu = plan\.poza \? \[\] : bezUkonczonych\(plan\.iu, ukonczoneWczesniej\)\n/)
  assert.match(orkiestracja, /if \(plan\.iu\.length === 0 && !bazaZeStanu\) \{\n {2}return \{ fazaNumer: faza, status: 'completed'/)
  assert.match(orkiestracja, /if \(plan\.iu\.length === 0\) \{\n {2}builds = \[\]\n\} else if \(plan\.strategia === 'parallel'\) \{/)
  assert.match(orkiestracja, /domknieciePrompt\(sciezka, faza, buildResults, bazaFazy\(plan\), plikBramek\(sciezka, faza\), ukonczoneWczesniej\)/)
  // Planner dostaje liste (oszczednosc promptow), ale filtr w JS obowiazuje niezaleznie od niego.
  assert.match(ex.plannerPrompt('docs/active/x', 3, ['IU-10', 'IU-11']), /Jednostki zapisane commitem w poprzednim, przerwanym podejsciu do tej fazy: IU-10, IU-11\. Pomijasz je/)
  assert.doesNotMatch(ex.plannerPrompt('docs/active/x', 3), /w poprzednim, przerwanym podejsciu/)
  // Domkniecie bez raportow builderow waliduje stan repo od bazy.
  const domkniecie = ex.domknieciePrompt('docs/active/x', 3, [], BAZA, '/tmp/b.json', ['IU-10'])
  assert.match(domkniecie, /Raporty builderow:\n\(brak — w tym podejsciu zaden builder nie pracowal; walidujesz i domykasz stan repo od bazy fazy\)/)
  assert.match(domkniecie, /Jednostki zapisane commitem w poprzednim, przerwanym podejsciu \(kod jest juz w repo, checkboxy odhaczone\): IU-10\./)
  assert.doesNotMatch(ex.domknieciePrompt('docs/active/x', 3, [{ id: 'IU-1', status: 'completed' }], BAZA, '/tmp/b.json'), /przerwanym podejsciu|zaden builder nie pracowal/)
})

test('stan zadania: iuUkonczone przechodzi przez bootstrap i STOP, znika po „execute done”', () => {
  // eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
  const PLAN_STATE = new Function(
    `${wytnij(AUTOPILOT, 'const FINDING_OTWARTY = {', '\n}')}
     ${wytnij(AUTOPILOT, 'const METRYKI_FAZY = {', '\n}')}
     ${wytnij(AUTOPILOT, 'const PLAN_STATE = {', '\n}')}
     return PLAN_STATE`,
  )()
  const faza = { numer: 3, nazwa: 'Mail', execute: 'pending', review: 'pending', fix: 'none', otwarteFindingi: [], baza: BAZA, iuUkonczone: ['IU-10', 'IU-11'] }
  const schemat = new Ajv({ strict: false }).compile(PLAN_STATE.properties.fazy.items)
  assert.equal(schemat(structuredClone(faza)), true, JSON.stringify(schemat.errors))
  assert.equal(schemat({ ...faza, iuUkonczone: 'IU-10' }), false)
  assert.match(wytnij(AUTOPILOT, 'function bootstrapPrompt(', '\n}'), /Pole "iuUkonczone" fazy \(jesli obecne\) przepisz 1:1/)
  const stan = { nazwaZadania: 'e3', fazy: [faza], zakonczenie: { walidacja: 'pending', complete: 'pending', compound: 'pending' } }
  assert.deepEqual(JSON.parse(wf.trescStanu(stan)).fazy[0].iuUkonczone, ['IU-10', 'IU-11'], 'STOP zapisuje liste')
  const po = JSON.parse(wf.trescStanu(wf.stanPoExecute(stan, 3))).fazy[0]
  assert.deepEqual([po.execute, 'iuUkonczone' in po, po.baza], ['done', false, BAZA])
})

test('autopilot: lista idzie do execute-wf, STOP utrwala nowa liste i mowi operatorowi o commicie, schowku albo odmowie', () => {
  const petla = AUTOPILOT.slice(AUTOPILOT.indexOf("if (faza.execute === 'pending') {"), AUTOPILOT.indexOf('// 2) REVIEW'))
  assert.match(petla, /iuUkonczone: faza\.iuUkonczone \|\| \[\], stanPoExecute:/)
  assert.match(petla, /const ukonczoneZExecute = Boolean\(exec && Array\.isArray\(exec\.iuUkonczone\) && exec\.iuUkonczone\.length > \(faza\.iuUkonczone \|\| \[\]\)\.length\)\n\s+if \(ukonczoneZExecute\) faza\.iuUkonczone = exec\.iuUkonczone\n/)
  assert.match(petla, /\$\{opisCzesciowego\(exec\)\}`, faza: numerFazy, exec, raporty \}\)/)
  assert.match(petla, /faza\.execute = 'done'\n\s+delete faza\.iuUkonczone\n/)
  const zapisane = wf.opisCzesciowego({ iuUkonczone: ['IU-10', 'IU-11'], czesciowe: { zacommitowano: true, commit: 'fedcba9', schowek: 'autopilot/e3/faza-3', plikiOdlozone: ['src/mail.ts', 'src/mail.test.ts'], powod: null } })
  assert.equal(zapisane, ' Jednostki ukonczone zapisane commitem fedcba9: IU-10, IU-11 — swiezy run zacznie od przerwanej. Pliki jednostki nieukonczonej (2) sa w schowku gita "autopilot/e3/faza-3" (git stash list); nie przywracaj ich przed swiezym runem — jednostka powstanie od nowa po decyzji.')
  assert.equal(wf.opisCzesciowego({ iuUkonczone: ['IU-10'], czesciowe: { zacommitowano: true, commit: 'fedcba9', schowek: null, plikiOdlozone: [], powod: null } }), ' Jednostki ukonczone zapisane commitem fedcba9: IU-10 — swiezy run zacznie od przerwanej.')
  assert.equal(wf.opisCzesciowego({ iuUkonczone: [], czesciowe: { zacommitowano: false, commit: null, schowek: null, plikiOdlozone: [], powod: 'typecheck: TS2304' } }),
    ' Jednostek ukonczonych nie zapisano (typecheck: TS2304): pliki fazy zostaly w drzewie, a bramka czystosci swiezego runu na nich stanie.')
  // Execute zakonczony w domknieciu (porazka bramki) nie ma pola `czesciowe`: powod STOP-u bez dopisku.
  assert.equal(wf.opisCzesciowego({ status: 'partial', problem: 'bramka stack' }), '')
  assert.equal(wf.opisCzesciowego(null), '')
})
