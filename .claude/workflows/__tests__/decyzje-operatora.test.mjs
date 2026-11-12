// Jeden nosnik decyzji operatora (punkt 40, krok 1): sekcja "## Decyzje operatora" w known-issues zadania.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/decyzje-operatora.test.mjs
//
// Stan sprzed poprawki (sprawdzony w kodzie na 5599974): pozycje z prefiksem "OPERATOR:" z fixa i tury poprawkowej zyly
// w zmiennej petli fazy. Fix dopisywal swoje do known-issues jako zwykle P2 bez znacznika, tura poprawkowa nie zapisywala
// nic, a swiezy run po STOP-ie nie mial w raporcie decyzji wczesniejszych faz. Review mial jeden typ OPERATOR na dwie sprawy:
// weryfikacje niewykonalna bez czlowieka i decyzje o naprawie poza planem; obie szly do "## Operator checklist faza N".

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

/** @typedef {import('./typy.mjs').Finding} Finding */
/** @typedef {{ p1: number, p2: number, p3: number, operator: number, decyzje: number }} Liczniki */

const KATALOG = dirname(fileURLToPath(import.meta.url))
const review = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')
const autopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')

/** @param {string} zrodlo @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/**
 * @type {{
 *   policzFindingi: (findings: Finding[]) => Liczniki,
 *   otwartePoReview: (findings: Finding[]) => Finding[],
 *   polaczFindingiPoPowtorce: (nowe: Finding[], poprzednie: Finding[] | null) => Finding[],
 *   pozycjeOperatora: (nienaprawione: unknown) => string[],
 *   wierszDecyzji: (faza: number, zrodlo: string, pozycja: string) => string,
 *   decyzjeKnownIssuesPrompt: (sciezka: string, faza: number, wiersze: string[]) => string,
 *   nastepneKroki: (w: { smoke: string, raporty: unknown[], propozycjeBramek: unknown[], czesci: boolean, zadanie: string, decyzjeZPliku?: string[] | null, otwarte?: string | null, smokeStatus?: string | null, niezapisane?: string[] }) => string[],
 *   SEKCJA_DECYZJI: string,
 *   decyzjeAutopilotaPoExecute: (faza: { decyzjeAutopilota?: unknown }, exec: { decyzjeAutopilota?: unknown } | null) => number,
 *   gateZOtwartychSpraw: (w: { nierozwiazaneP2?: number, decyzjeOperatora?: number, decyzjeAutopilota?: number }) => string,
 *   poleNiezapisanych: (lista: string[]) => { decyzjeNiezapisane?: string[] },
 * }}
 */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const a = new Function('log', `${wytnij(autopilot, 'const SEKCJA_DECYZJI = ', '\n')}
  ${wytnij(autopilot, 'const STATUS_E2E_NIE_ODEGRANO = ', '\n')}
  ${wytnij(autopilot, 'function policzFindingi(', '\n}\n')}
  ${wytnij(autopilot, 'function otwartePoReview(', '\n}\n')}
  ${wytnij(autopilot, 'function polaczFindingiPoPowtorce(', '\n}\n')}
  ${wytnij(autopilot, 'function instrukcjaCommita(', '\n}\n')}
  ${wytnij(autopilot, 'function fazyNieOdegrane(', '\n}\n')}
  ${wytnij(autopilot, 'function nastepneKroki(', '\n}\n')}
  ${wytnij(autopilot, 'function pozycjeOperatora(', '\n}\n')}
  ${wytnij(autopilot, 'function wierszDecyzji(', '\n}\n')}
  ${wytnij(autopilot, 'function decyzjeKnownIssuesPrompt(', '\n}\n')}
  ${wytnij(autopilot, 'function decyzjeAutopilotaPoExecute(', '\n}\n')}
  ${wytnij(autopilot, 'function gateZOtwartychSpraw(', '\n}\n')}
  ${wytnij(autopilot, 'function poleNiezapisanych(', '\n}\n')}
  return { decyzjeAutopilotaPoExecute, gateZOtwartychSpraw, poleNiezapisanych, policzFindingi, otwartePoReview, polaczFindingiPoPowtorce, pozycjeOperatora, wierszDecyzji, decyzjeKnownIssuesPrompt, nastepneKroki, SEKCJA_DECYZJI }`)(() => {})

/** @type {{ podsumujFindingi: (findings: Finding[]) => { liczniki: Liczniki, severityGate: string } }} */
// eslint-disable-next-line no-new-func -- jw.
const r = new Function(`${wytnij(review, 'function podsumujFindingi(', '\n}\n')}
  return { podsumujFindingi }`)()

/** @param {string} severity @param {string} typ @returns {Finding} */
const f = (severity, typ) => ({ severity, typ, plik: `src/${typ.toLowerCase()}.ts:10`, opis: `opis ${typ}` })

test('review: DECYZJA jest osobnym typem w obu schematach findingow', () => {
  const enumy = review.match(/enum: \['KOD', 'TEST', 'E2E', 'OPERATOR'(, 'DECYZJA')?\]/g) || []
  assert.equal(enumy.length, 2, 'schemat reviewera i schemat wyniku review')
  assert.ok(enumy.every((e) => e.includes("'DECYZJA'")), 'oba enumy maja DECYZJA')
})

test('review: reviewer oznacza naprawe poza planem typem DECYZJA, a OPERATOR zostaje dla weryfikacji bez czlowieka', () => {
  const polecenie = wytnij(review, 'function reviewerPrompt(', '\n}\n')
  assert.match(polecenie, /przekracza „Granice planu”[^\n]*ma typ DECYZJA/)
  assert.doesNotMatch(polecenie, /ma typ OPERATOR \(decyzja czlowieka\)/)
  assert.match(polecenie, /Typ OPERATOR zostaje dla weryfikacji/)
})

test('review: DECYZJA nie blokuje bramki, nie wchodzi do licznikow P1–P3 i ma wlasny licznik', () => {
  const { liczniki, severityGate } = r.podsumujFindingi([f('P1', 'DECYZJA'), f('P2', 'DECYZJA'), f('P3', 'OPERATOR'), f('P3', 'KOD')])
  assert.deepEqual(liczniki, { p1: 0, p2: 0, p3: 1, operator: 1, decyzje: 2 })
  assert.equal(severityGate, 'CZYSTE')
  assert.equal(r.podsumujFindingi([f('P2', 'KOD'), f('P1', 'DECYZJA')]).severityGate, 'ZASTRZEZENIA')
})

test('review: DECYZJA omija sceptykow, limit nitow i liste plikow fixa, ale zostaje w wyniku', () => {
  assert.match(review, /const doWeryfikacji = dedup\.filter\(\(f\) => [^\n]*f\.typ !== 'DECYZJA'/)
  assert.match(review, /const wszystkieNity = dedup\.filter\(\(f\) => [^\n]*f\.typ !== 'DECYZJA'/)
  assert.match(review, /const operatorowe = dedup\.filter\(\(f\) => f\.typ === 'OPERATOR' \|\| f\.typ === 'DECYZJA'\)/)
  assert.match(review, /dedup\.filter\(\(f\) => \(f\.severity === 'P1' \|\| f\.severity === 'P2'\) && f\.typ !== 'OPERATOR' && f\.typ !== 'DECYZJA'\)\.map\(\(f\) => kluczPliku/)
})

test('review: scribe zapisuje DECYZJE w sekcji decyzji known-issues, poza checklista operatora', () => {
  const scribe = wytnij(review, 'Findingi typu DECYZJA nie ida do zadnej z tych dwoch sekcji', '\n2a.')
  assert.match(scribe, /known-issues\.md w sekcji "## Decyzje operatora"/)
  assert.match(scribe, /"- \[DECYZJA · faza \$\{faza\} · review\] <plik:linia> — <opis>"/)
  assert.match(scribe, /bez duplikatow/)
  assert.match(review, /## Findingi DECYZJA\n\s+### DECYZJA · /)
  assert.match(review, /Zawsze wszystkie piec sekcji/)
})

test('review i autopilot: ten sam naglowek sekcji i ten sam znacznik wiersza', () => {
  // Polecenia agentow maja naglowek i wzor wiersza wpisane doslownie (testy wycinaja je bez stalych modulu).
  assert.equal(a.SEKCJA_DECYZJI, '## Decyzje operatora')
  for (const [nazwa, zrodlo] of [['fix', wytnij(autopilot, 'function fixPrompt(', '\n}\n')], ['walidacja', wytnij(autopilot, 'function finalValidationPrompt(', '\n}\n')], ['scribe review', review]]) {
    assert.ok(zrodlo.includes(`"${a.SEKCJA_DECYZJI}"`), `${nazwa} podaje naglowek sekcji decyzji`)
  }
  const wzorScribe = '- [DECYZJA · faza ${faza} · review] <plik:linia> — <opis>'
  assert.ok(review.includes(wzorScribe))
  assert.equal(a.wierszDecyzji(3, 'review', 'OPERATOR: <plik:linia> — <opis>'), wzorScribe.replace('${faza}', '3'))
})

test('autopilot: wiersz decyzji niesie faze i zrodlo, bez prefiksu OPERATOR i w jednej linii', () => {
  assert.equal(a.wierszDecyzji(2, 'fix', 'OPERATOR: src/auth.ts:41 — limit magic-linkow: zostaje 5 czy 3'), '- [DECYZJA · faza 2 · fix] src/auth.ts:41 — limit magic-linkow: zostaje 5 czy 3')
  assert.equal(a.wierszDecyzji(4, 'tura poprawkowa', '  operator:  src/x.ts:1 — pierwsza\n  druga linia '), '- [DECYZJA · faza 4 · tura poprawkowa] src/x.ts:1 — pierwsza druga linia')
})

test('autopilot: polecenie zapisu podaje gotowe wiersze, jedna sekcje, usuniecie dubla P2 i commit', () => {
  const wiersze = [a.wierszDecyzji(2, 'fix', 'OPERATOR: src/auth.ts:41 — limit'), a.wierszDecyzji(2, 'fix', 'OPERATOR: src/b.ts:7 — zaleznosc')]
  const polecenie = a.decyzjeKnownIssuesPrompt('docs/active/zad', 2, wiersze)
  for (const w of wiersze) assert.ok(polecenie.includes(w), `polecenie ma wiersz: ${w}`)
  assert.match(polecenie, /docs\/active\/zad\/known-issues\.md/)
  assert.match(polecenie, /"## Decyzje operatora"/)
  assert.match(polecenie, /dokladnie raz/)
  assert.match(polecenie, /"## Faza 2"[^\n]*usun ja stamtad/)
  assert.match(polecenie, /git add docs\/active\/zad\/known-issues\.md/)
  assert.match(polecenie, /docs\(known-issues\): decyzje operatora fazy 2/)
})

test('autopilot: decyzje ida na dysk po fixie i po turze poprawkowej, zanim faza moze sie zatrzymac', () => {
  const poFixie = autopilot.indexOf("await zapiszDecyzje(numerFazy, 'fix', zastrzezoneFixa)")
  const kontrola = autopilot.indexOf('const kontrola = await agent(kontrolaFixaPrompt(')
  assert.ok(poFixie !== -1 && poFixie < kontrola, 'zapis decyzji fixa stoi przed kontrola diffu')
  const poPoprawce = autopilot.indexOf("await zapiszDecyzje(numerFazy, 'tura poprawkowa', zastrzezonePoprawki)")
  const stopPoprawki = autopilot.indexOf("if (poprawka.walidacja === 'NIE-URUCHOMIONO')")
  assert.ok(poPoprawce !== -1 && poPoprawce < stopPoprawki, 'zapis decyzji tury stoi przed STOP-ami tury')
  const zapis = wytnij(autopilot, 'async function zapiszDecyzje(', '\n}\n')
  assert.match(zapis, /if \(!pozycje\.length\) return/)
  assert.match(zapis, /agentType: 'klasa-mechaniczny', label: `decyzje:zapis:faza-\$\{numerFazy\}`/)
  assert.match(zapis, /UWAGA/, 'nieudany zapis wychodzi w logu')
})

test('autopilot: fix nie dubluje decyzji jako P2 w known-issues, a faza z decyzja ma gate ZASTRZEZENIA', () => {
  const fix = wytnij(autopilot, 'function fixPrompt(', '\n}\n')
  assert.doesNotMatch(fix, /dopisz P2 do known-issues/)
  assert.match(fix, /Do known-issues jej nie dopisujesz i nie liczysz jej w nierozwiazaneP2/)
  // Punkt 48 (pokrewne): decyzja autopilota tez daje ZASTRZEZENIA — w fazie z fixem i w fazie bez findingow (fix: none).
  // Walidacja 51–55, punkt 60: gate liczony funkcja wykonana na danych, nie dopasowaniem wyrazenia w petli.
  assert.equal(a.gateZOtwartychSpraw({}), 'CZYSTE')
  assert.equal(a.gateZOtwartychSpraw({ nierozwiazaneP2: 0, decyzjeOperatora: 0, decyzjeAutopilota: 0 }), 'CZYSTE')
  assert.equal(a.gateZOtwartychSpraw({ nierozwiazaneP2: 1 }), 'ZASTRZEZENIA')
  assert.equal(a.gateZOtwartychSpraw({ decyzjeOperatora: 2 }), 'ZASTRZEZENIA')
  assert.equal(a.gateZOtwartychSpraw({ decyzjeAutopilota: 1 }), 'ZASTRZEZENIA')
  const petla = autopilot.slice(autopilot.indexOf('for (const numerFazy of kolejka) {'))
  assert.match(petla, /\n {4}gateFazy = gateZOtwartychSpraw\(\{ nierozwiazaneP2: fix\.nierozwiazaneP2, decyzjeOperatora: doDecyzjiOperatora\.length, decyzjeAutopilota: decyzjeAutopilotaFazy \}\)\n/)
  // Po ustawieniu gate'u w galezi fix: none nic go nie zmienia przed raportem fazy.
  assert.match(petla, /\} else if \(faza\.fix === 'none'\) \{\n {4}gateFazy = gateZOtwartychSpraw\(\{ decyzjeAutopilota: decyzjeAutopilotaFazy \}\)\n {2}\}\n\n {2}historia\[numerFazy\] = cykle\n {2}log\(`Faza \$\{numerFazy\}: koniec — gate \$\{gateFazy\}/)
  // Walidacja 51–55, punkt 57: licznik to suma ze stanu fazy i z biezacego execute — jednostka z decyzja zapisana przed
  // przerwaniem jest w swiezym runie pomijana, wiec sam wynik execute dawal 0 i gate CZYSTE.
  assert.equal(a.decyzjeAutopilotaPoExecute({}, null), 0)
  assert.equal(a.decyzjeAutopilotaPoExecute({}, { decyzjeAutopilota: ['IU-1: a', 'IU-2: b'] }), 2)
  assert.equal(a.decyzjeAutopilotaPoExecute({ decyzjeAutopilota: 1 }, { decyzjeAutopilota: [] }), 1, 'wznowiony execute bez nowych decyzji')
  assert.equal(a.decyzjeAutopilotaPoExecute({ decyzjeAutopilota: 1 }, { decyzjeAutopilota: ['IU-3: c'] }), 2)
  assert.equal(a.decyzjeAutopilotaPoExecute({ decyzjeAutopilota: 2 }, null), 2, 'faza wznowiona od review')
  assert.equal(a.decyzjeAutopilotaPoExecute({ decyzjeAutopilota: -1 }, { decyzjeAutopilota: 'x' }), 0, 'smieci w stanie i wyniku')
  assert.match(petla, /\n {2}let decyzjeAutopilotaFazy = decyzjeAutopilotaPoExecute\(faza, null\)\n/)
  // Od zapisu decyzji do STOP-u execute: licznik z funkcji, zapis w stanie fazy, nic pomiedzy.
  assert.match(petla, /await zapiszDecyzje\(numerFazy, 'autopilot', [^\n]+\)\n {4}decyzjeAutopilotaFazy = decyzjeAutopilotaPoExecute\(faza, exec\)\n {4}const licznikDecyzjiZmieniony = decyzjeAutopilotaFazy !== \(faza\.decyzjeAutopilota \|\| 0\)\n {4}if \(licznikDecyzjiZmieniony\) faza\.decyzjeAutopilota = decyzjeAutopilotaFazy\n {4}if \(!exec \|\| exec\.status !== 'completed'\) \{\n/)
  assert.match(petla, /if \(licznikDecyzjiZmieniony\) oznaczStan\(\)\n {4}log\(`Faza \$\{numerFazy\}: Execute OK/)
  assert.ok(petla.indexOf('let decyzjeAutopilotaFazy = ') < petla.indexOf("if (faza.execute === 'pending') {"), 'licznik ustawiany na fazie, przed execute')
  // Schemat stanu i bootstrap niosa licznik miedzy runami.
  assert.match(autopilot, /\n {10}decyzjeAutopilota: \{ type: 'integer', description: /)
  assert.match(autopilot, /Pole "decyzjeAutopilota" fazy \(jesli obecne\) przepisz 1:1/)
})

test('autopilot: DECYZJA z review nie idzie do fixa, ma wlasny licznik i nie wraca po powtorce review', () => {
  const findingi = [f('P1', 'DECYZJA'), f('P2', 'KOD'), f('P3', 'OPERATOR')]
  assert.deepEqual(a.otwartePoReview(findingi).map((x) => x.typ), ['KOD'])
  assert.deepEqual(a.policzFindingi(findingi), { p1: 0, p2: 1, p3: 0, operator: 1, decyzje: 1 })
  assert.deepEqual(a.polaczFindingiPoPowtorce([], [f('P2', 'DECYZJA'), f('P2', 'KOD')]).map((x) => x.typ), ['KOD'])
})

test('autopilot: walidacja koncowa nie zamyka decyzji i oddaje je w decyzjeOtwarte', () => {
  const walidacja = wytnij(autopilot, 'function finalValidationPrompt(', '\n}\n')
  assert.match(walidacja, /Sekcja "## Decyzje operatora" jest poza tym przegladem/)
  assert.match(walidacja, /nie przenosisz do "## Zamkniete"/)
  assert.match(walidacja, /pola decyzjeOtwarte/)
  assert.match(autopilot, /decyzjeOtwarte: \{ type: 'array', items: \{ type: 'string' \}/)
})

test('autopilot: raport bierze decyzje z pliku, takze z faz sprzed tego runu', () => {
  const baza = { smoke: '', propozycjeBramek: [], czesci: false, zadanie: 'x' }
  const zPamieci = [{ faza: 3, liczniki: { operator: 0 }, doDecyzjiOperatora: ['OPERATOR: src/c.ts:1 — z pamieci'] }]
  const zPliku = a.nastepneKroki({ ...baza, raporty: zPamieci, decyzjeZPliku: ['[DECYZJA · faza 1 · fix] src/a.ts:5 — limit', '[DECYZJA · faza 3 · review] src/c.ts:1 — zaleznosc'] })
  assert.match(zPliku[0], /zmiany spoza planu do decyzji \(2, sekcja „Decyzje operatora” w known-issues\): \[DECYZJA · faza 1 · fix\] src\/a\.ts:5 — limit; \[DECYZJA · faza 3 · review\]/)
  assert.doesNotMatch(zPliku[0], /z pamieci/)
  // Plik bez decyzji wygrywa z pamiecia runu (operator mogl zamknac sprawe recznie przed walidacja).
  assert.equal(a.nastepneKroki({ ...baza, raporty: zPamieci, decyzjeZPliku: [] }).length, 1)
  // Walidacja byla w poprzednim runie: nie ma odczytu, zostaje lista z pamieci.
  assert.match(a.nastepneKroki({ ...baza, raporty: zPamieci, decyzjeZPliku: null })[0], /z pamieci/)
  assert.match(autopilot, /decyzjeZPliku: stan\.walidacjaWynik \? \(stan\.walidacjaWynik\.decyzjeOtwarte \|\| \[\]\) : null/)
})

// Weryfikacja partii, punkt 48 (pokrewne): przy nieudanym zapisie do known-issues decyzje ginely — log mowil „zostaja w raporcie”,
// a nie wchodzily ani do `raporty`, ani do krokow. Teraz pozycja „Akcji operatora” (takze przy smoke'u, bo smoke ich nie pokaze).
test('autopilot: decyzje niezapisane w known-issues ida do Akcji operatora, wyniku runu i STOP-u', () => {
  const niezapisane = ['[DECYZJA · faza 2 · autopilot] IU-4: src/mail.ts:12 — mail bez imienia']
  for (const smoke of ['', 'docs/operator/x-smoke.md']) {
    const kroki = a.nastepneKroki({ smoke, propozycjeBramek: [], czesci: false, zadanie: 'x', raporty: [], decyzjeZPliku: [], niezapisane })
    const akcje = kroki.find((k) => k.startsWith('Akcje operatora: '))
    assert.ok(akcje, `akcje przy smoke=${JSON.stringify(smoke)}`)
    assert.match(akcje, /decyzje niezapisane w known-issues \(1\): \[DECYZJA · faza 2 · autopilot\] IU-4: src\/mail\.ts:12 — mail bez imienia\.$/)
  }
  assert.equal(a.nastepneKroki({ smoke: '', propozycjeBramek: [], czesci: false, zadanie: 'x', raporty: [], decyzjeZPliku: [], niezapisane: [] }).length, 1, 'pusta lista = bez pozycji')
  assert.deepEqual(a.poleNiezapisanych([]), {})
  const lista = ['x']
  const pole = a.poleNiezapisanych(lista)
  assert.deepEqual(pole, { decyzjeNiezapisane: ['x'] })
  assert.notEqual(pole.decyzjeNiezapisane, lista, 'kopia listy')
  assert.match(autopilot, /niezapisane: decyzjeNiezapisane, nieOdegraneZeStanu: e2eNieOdegrane \}\),\n {2}decyzjeNiezapisane,/)
  assert.match(wytnij(autopilot, 'async function stopRun(', '\n}\n'), /artefaktyStop: artefakty, \.\.\.poleNiezapisanych\(decyzjeNiezapisane\) \}\n\}\n$/)
  // Lista runu stoi przed stopRun i zapisem decyzji (zapis jest przed STOP-em execute).
  assert.ok(autopilot.indexOf('const decyzjeNiezapisane = []') < autopilot.indexOf('async function stopRun('))
})

// Walidacja 51–55, punkt 60: zapiszDecyzje wykonane z atrapa agenta. Dopasowanie tekstu przepuszczalo `!zapis && !zapis.zapisano`:
// odpowiedz { zapisano: false } uchodzila za sukces i decyzje ginely po cichu.
test('autopilot: zapiszDecyzje — brak wyniku agenta i zapisano: false trafiaja do decyzjeNiezapisane; udany zapis i pusta lista nie', async () => {
  /** @param {unknown} odpowiedz @returns {Promise<{ wynik: boolean, niezapisane: string[], wywolan: number, logi: string[] }>} */
  const przebieg = async (odpowiedz, pozycje = ['IU-4: src/mail.ts:12 — mail bez imienia', 'IU-5: b.ts:1 — B']) => {
    /** @type {string[]} */
    const niezapisane = []
    /** @type {string[]} */
    const logi = []
    let wywolan = 0
    // eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
    const zapiszDecyzje = new Function('agent', 'log', 'decyzjeNiezapisane', 'sciezka', 'P3_KNOWN_ISSUES', `${wytnij(autopilot, 'const SEKCJA_DECYZJI = ', '\n')}
      ${wytnij(autopilot, 'function instrukcjaCommita(', '\n}\n')}
      ${wytnij(autopilot, 'function wierszDecyzji(', '\n}\n')}
      ${wytnij(autopilot, 'function decyzjeKnownIssuesPrompt(', '\n}\n')}
      ${wytnij(autopilot, 'async function zapiszDecyzje(', '\n}\n')}
      return zapiszDecyzje`)(async () => { wywolan++; return odpowiedz }, (/** @type {string} */ l) => logi.push(l), niezapisane, 'docs/active/x', {})
    return { wynik: await zapiszDecyzje(2, 'autopilot', pozycje), niezapisane, wywolan, logi }
  }
  const oczekiwane = ['[DECYZJA · faza 2 · autopilot] IU-4: src/mail.ts:12 — mail bez imienia', '[DECYZJA · faza 2 · autopilot] IU-5: b.ts:1 — B']
  for (const odpowiedz of [null, { zapisano: false }, { zapisano: false, commit: 'abc' }]) {
    const p = await przebieg(odpowiedz)
    assert.equal(p.wynik, false, JSON.stringify(odpowiedz))
    assert.deepEqual(p.niezapisane, oczekiwane, JSON.stringify(odpowiedz))
    assert.match(p.logi.join('\n'), /UWAGA — 2 decyzji operatora \(autopilot\) nie zapisano/)
  }
  const udany = await przebieg({ zapisano: true, commit: 'abc1234' })
  assert.deepEqual([udany.wynik, udany.niezapisane, udany.wywolan], [true, [], 1])
  const pusty = await przebieg(null, [])
  assert.deepEqual([pusty.wynik, pusty.niezapisane, pusty.wywolan], [true, [], 0], 'bez pozycji agent nie rusza')
})

// Krok 3: przy smoke'u jedna droga — raport podaje liczbe decyzji i odsyla do smoke'u, bez listy decyzji i bez komendy PR.
test('autopilot: raport przy smoke\'u podaje liczbe decyzji zamiast listy i nie podaje komendy PR', () => {
  const wejscie = { propozycjeBramek: [], czesci: true, zadanie: 'x', raporty: [], decyzjeZPliku: ['[DECYZJA · faza 1 · fix] src/a.ts:5 — limit', '[DECYZJA · faza 2 · review] src/b.ts:9 — zaleznosc'] }
  const zeSmoke = a.nastepneKroki({ ...wejscie, smoke: 'docs/operator/x-smoke.md' })
  assert.deepEqual(zeSmoke, ['Smoke w nowej sesji: `/clear`, potem `/dev-smoke x` (checklista docs/operator/x-smoke.md). Smoke zaczyna sie od sekcji „Decyzje przed PR” (decyzji: 2). Komende PR podaje koniec sesji smoke\'u; przed smoke\'em PR-a nie wysylaj.'])
  const bezSmoke = a.nastepneKroki({ ...wejscie, smoke: '' })
  assert.equal(bezSmoke.length, 2)
  assert.match(bezSmoke[0], /^Akcje operatora: zmiany spoza planu do decyzji \(2, .*src\/a\.ts:5 — limit; .*src\/b\.ts:9 — zaleznosc\.$/)
  assert.match(bezSmoke[1], /^Po smoke'u: `\/clear`, potem `\/dev-pr 3 --bez-merge --czesc 1` \(zadanie x\)\.$/)
})

// ── Krok 2: smoke zaczyna sie od sekcji „Decyzje przed PR” ────────────────────────────────────────────────────────────
// Przed poprawka wiersz decyzji szedl do smoke'u tylko jako „znany problem” i tylko wtedy, gdy opisywal zachowanie na ekranie:
// decyzja o zaleznosci albo o zakresie nie trafiala do operatora wcale.

const complete = readFileSync(resolve(KATALOG, '../dev-docs-complete-wf.js'), 'utf8')
const skillComplete = readFileSync(resolve(KATALOG, '../../skills/dev-docs-complete/SKILL.md'), 'utf8')
const smokePrompt = wytnij(complete, 'const smokePrompt = `', 'Zwroc obiekt zgodny ze schematem.`')

test('smoke: autor bierze kazdy wiersz sekcji decyzji jako pozycje „Decyzje przed PR” na poczatku dokumentu', () => {
  const zrodlo7 = wytnij(smokePrompt, '7. DECYZJE OPERATORA:', 'w polu decyzje.')
  assert.match(zrodlo7, /wiersze sekcji "## Decyzje operatora" z docs\/active\/\$\{nazwaZadania\}\/known-issues\.md/)
  assert.match(zrodlo7, /kazdy wiersz, takze bez skutku\s+na ekranie/)
  assert.match(zrodlo7, /sekcji "## Decyzje przed PR"\. Sekcja stoi na poczatku dokumentu, przed czerwonymi flagami/)
  assert.match(zrodlo7, /„zostaw jak jest”/)
  assert.match(zrodlo7, /nie zgadujesz/)
  assert.match(zrodlo7, /nie przenosisz do „Znanych problemow”/)
})

test('smoke: sekcja decyzji nie wpada do „Znanych problemow”, a same decyzje wystarcza, zeby plik powstal', () => {
  assert.match(smokePrompt, /Sekcje "## Decyzje operatora" tez tu pomin: jej wiersze obsluguje punkt 7\./)
  assert.match(smokePrompt, /hierarchii \(1\)-\(7\) nie ma ANI JEDNEJ pozycji/)
  assert.match(smokePrompt, /Nie wymyslaj pozycji spoza zrodel \(1\)-\(7\)\./)
  assert.doesNotMatch(smokePrompt, /hierarchii \(1\)-\(6\)|zrodel \(1\)-\(6\)/)
})

test('smoke: wynik autora ma licznik decyzji, a log archiwizacji go pokazuje', () => {
  assert.match(complete, /decyzje: \{ type: 'integer', description: 'ile pozycji ma sekcja "Decyzje przed PR"/)
  assert.match(complete, /smoke\.decyzje \? `, w tym decyzji przed PR: \$\{smoke\.decyzje\}` : ''/)
})

test('skill archiwizacji: zrodlo 7 i uklad pliku z „Decyzjami przed PR” przed czerwonymi flagami', () => {
  assert.match(skillComplete, /7\. \*\*decyzje operatora:\*\* wiersze sekcji `## Decyzje operatora`/)
  assert.match(skillComplete, /źródła \(1\)–\(7\) są puste/)
  const decyzje = skillComplete.indexOf('## Decyzje przed PR   ←')
  const flagi = skillComplete.indexOf('## ⚠️ E2E przebiegło i padło (znany defekt)   ←')
  assert.ok(decyzje !== -1 && decyzje < flagi, 'sekcja decyzji stoi w ukladzie przed czerwonymi flagami')
  const uklad = skillComplete.slice(decyzje, flagi)
  for (const pole of ['- [ ] D1 (faza N, <fix | tura poprawkowa | review | autopilot>)', 'Gdzie: `<plik:linia>`', 'Opcja A: zostaw jak jest', 'Część PR: <N>']) {
    assert.ok(uklad.includes(pole), `uklad decyzji ma pole: ${pole}`)
  }
  assert.match(skillComplete, /bez sekcji `## P3 faza N` i `## Decyzje operatora`/)
})

// Weryfikacja partii 2026-11-11, punkt 49: po padzie autora smoke'u raport mowil „Otwarte: brak” i konczyl sie komenda PR.
test('autopilot: po padzie autora smoke\'u albo archiwizacji raport nie podaje komendy PR, tylko droge do listy smoke\'u', () => {
  const wejscie = { propozycjeBramek: [], czesci: true, zadanie: 'x', raporty: [], decyzjeZPliku: ['[DECYZJA · faza 1 · fix] src/a.ts:5 — limit'], smoke: '' }
  const pad = a.nastepneKroki({ ...wejscie, smokeStatus: 'agent-null', otwarte: 'Otwarte: nieznane — lista smoke\'u nie powstala (autor smoke\'u padl), pozycje do sprawdzenia nie sa policzone; wygeneruj ja: /dev-docs-complete x.' })
  assert.match(pad[0], /^Automat zamkniety\. Otwarte: nieznane/)
  assert.match(pad[1], /^Lista smoke'u NIE powstala \(autor smoke'u padl\): .*Najpierw `\/clear` i `\/dev-docs-complete x`, potem `\/dev-smoke x`\. Przed smoke'em PR-a nie wysylaj\.$/)
  assert.match(pad[2], /^Akcje operatora: zmiany spoza planu do decyzji \(1,/, 'decyzje zostaja w raporcie, bo smoke ich nie pokaze')
  assert.ok(pad.every((k) => !/\/dev-pr/.test(k)), 'bez komendy PR')
  const bezArchiwum = a.nastepneKroki({ ...wejscie, smokeStatus: 'complete-null', otwarte: null })
  assert.match(bezArchiwum[0], /^Lista smoke'u NIE powstala \(archiwizacja nie zwrocila wyniku/)
  assert.ok(bezArchiwum.every((k) => !/\/dev-pr/.test(k)))
  // Zadanie bez pozycji smoke'u: jak dotad komenda PR.
  assert.match(a.nastepneKroki({ ...wejscie, smokeStatus: 'brak-pozycji' }).at(-1) ?? '', /^Po smoke'u: `\/clear`, potem `\/dev-pr 3 --bez-merge --czesc 1`/)
  assert.match(autopilot, /smokeStatus: complete \? complete\.smokeStatus : \(stan\.zakonczenie\.complete === 'done' \? null : 'complete-null'\), niezapisane: decyzjeNiezapisane, nieOdegraneZeStanu: e2eNieOdegrane \}\),/)
})

// Krok 6 (punkt 45): raport autopilota zaczyna sie od zdania o otwartych sprawach z archiwizacji (otwarte.mjs); bez zdania uklad bez zmian.
test('autopilot: „Automat zamkniety.” ze zdaniem o otwartych sprawach na poczatku raportu', () => {
  const wejscie = { propozycjeBramek: [], czesci: false, zadanie: 'x', raporty: [], decyzjeZPliku: [], smoke: 'docs/operator/x-smoke.md' }
  const z = a.nastepneKroki({ ...wejscie, otwarte: 'Otwarte: 4 pozycji smoke\'u, 1 odłożonych (docs/operator/odlozone.md).' })
  assert.equal(z[0], 'Automat zamkniety. Otwarte: 4 pozycji smoke\'u, 1 odłożonych (docs/operator/odlozone.md).')
  assert.match(z[1] ?? '', /^Smoke w nowej sesji:/)
  assert.deepEqual(a.nastepneKroki({ ...wejscie, otwarte: null }), a.nastepneKroki(wejscie))
})
