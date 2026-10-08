// Krok ogrodnika w dev-autopilot-wf.js (PLAN-POPRAWY P15): odczyt wyniku skryptu, sekcja „Ogrod” podsumowania, rekord
// telemetrii i kontrakt z .claude/scripts/ogrod/ (kopie stalych, rekord czytany przez prog.mjs w nastepnym pomiarze).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/ogrod.test.mjs

import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { KATEGORIE, OPISY } from '../../scripts/ogrod/kategorie.mjs'
import { poprzedniPomiar } from '../../scripts/ogrod/prog.mjs'
import { commit, git, noweRepo, zapisz } from '../../scripts/bramki/__tests__/repo-testowe.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
const START = '// ── Ogrodnik (P15)'
const KONIEC = '// ── Koniec ogrodnika'

/** @returns {string} */
function blok() {
  const a = zrodlo.indexOf(START)
  const b = zrodlo.indexOf(KONIEC)
  assert.ok(a !== -1 && b > a, 'kotwice bloku ogrodnika w dev-autopilot-wf.js')
  return zrodlo.slice(a, b)
}

/**
 * Blok ogrodnika z atrapami `agent` i `log` runtime'u Workflow.
 * @param {(prompt: string, opcje: Record<string, unknown>) => unknown} agent
 */
function zaladuj(agent = () => null) {
  /** @type {string[]} */
  const logi = []
  // eslint-disable-next-line no-new-func -- ekstrakcja bloku z pliku workflowu tego repo, nie z inputu
  const f = new Function('agent', 'log', `${blok()}\nreturn { OGROD_KATEGORIE, OGROD_OPISY, OGROD_POMIAR, pomiarZWyniku, sekcjaOgrodu, rekordOgrodu, ogrodOcenaPrompt, ogrodPomiarPrompt, ogrodnik }`)
  return { ...f(agent, (/** @type {string} */ t) => logi.push(t)), logi }
}

const ZERO = { wyciszenia: 0, any: 0, rzutowania: 0, komentarze: 0, pusty_catch: 0 }
/** @param {Record<string, unknown>} decyzja @param {Record<string, unknown>} [reszta] */
function pomiar(decyzja = {}, reszta = {}) {
  return {
    projekt: 'oferty', commit: 'abc1234', plikow: 120, liczby: { ...ZERO, any: 4, wyciszenia: 2 }, poprzedni: null,
    decyzja: { ocena: false, powod: 'bez oceny: przyrost ponizej progu', zrodlo: 'telemetria', przyrost: { ...ZERO, any: 1 }, bez_oceny: 2, ...decyzja },
    noweRazem: 1, nowe: [{ kategoria: 'any', plik: 'src/a.ts', linia: 3, tekst: 'const a: any' }], hotspoty: [{ plik: 'src/a.ts', razem: 4 }],
    ...reszta,
  }
}
/** @param {unknown} dane @param {number} [kod] */
const wynikAgenta = (dane, kod = 0) => ({ kod, stdout: JSON.stringify(dane), stderr: '' })

test('kopie stalych: kategorie i opisy jak w .claude/scripts/ogrod/kategorie.mjs', () => {
  const { OGROD_KATEGORIE, OGROD_OPISY } = zaladuj()
  assert.deepEqual(OGROD_KATEGORIE, KATEGORIE)
  assert.deepEqual(OGROD_OPISY, OPISY)
})

test('pomiarZWyniku: null, zly JSON, blad skryptu i niekomplet = blad z przyczyna; komplet = pomiar', () => {
  const { pomiarZWyniku } = zaladuj()
  assert.equal(pomiarZWyniku(null).blad, 'agent pomiaru zwrocil null')
  assert.match(pomiarZWyniku({ kod: 0, stdout: '{"liczby":', stderr: '' }).blad, /nie jest JSON/)
  assert.equal(pomiarZWyniku(wynikAgenta({ blad: 'brak repo' }, 1)).blad, 'brak repo')
  assert.equal(pomiarZWyniku({ kod: 2, stdout: '', stderr: 'Uzycie: ...' }).pomiar, null)
  const niekomplet = [
    { ...pomiar(), liczby: { any: 1 } }, { ...pomiar(), decyzja: { ocena: false } }, { ...pomiar(), nowe: undefined },
    { ...pomiar(), noweRazem: '1' }, { ...pomiar(), hotspoty: null }, { ...pomiar(), plikow: undefined }, { ...pomiar(), commit: 1 },
    pomiar({ przyrost: { any: 1 } }), pomiar({ zrodlo: 'inne' }), pomiar({ bez_oceny: 'x' }), pomiar({ ocena: 'tak' }), pomiar({ powod: null }),
  ]
  for (const dane of niekomplet) assert.equal(pomiarZWyniku(wynikAgenta(dane)).blad, 'wynik skryptu bez kompletu pol', JSON.stringify(dane))
  assert.equal(pomiarZWyniku(wynikAgenta(pomiar(), 1)).blad, 'kod 1', 'kod wyjscia != 0 bez pola blad')
  const ok = pomiarZWyniku(wynikAgenta(pomiar()))
  assert.deepEqual([ok.blad, ok.pomiar.liczby.any], ['', 4])
})

test('sekcja: bez oceny — liczby z przyrostem, nowe z miejscem, powod, zdanie o braku zmian w kodzie', () => {
  const { sekcjaOgrodu } = zaladuj()
  const s = sekcjaOgrodu(pomiar(), '', null)
  assert.ok(s.startsWith('## Ogród\n'))
  assert.match(s, /120 plików JS\/TS, commit abc1234\); w nawiasie przyrost względem poprzedniego zadania/)
  assert.match(s, /^- any: 4 \(\+1\)$/m)
  assert.match(s, /^- wyciszenia lint\/TS: 2 \(0\)$/m)
  assert.match(s, /Nowe w tym zadaniu \(1\): `src\/a\.ts:3` \(any\)\./)
  assert.match(s, /Bez oceny — bez oceny: przyrost ponizej progu\./)
  assert.match(s, /Ogrodnik niczego nie zmienił w kodzie/)
  assert.doesNotMatch(s, /Propozycje/)
})

test('sekcja: ocena z propozycjami — checkbox na wzorzec, regula z liczba miejsc do posprzatania, trzy szczeble', () => {
  const { sekcjaOgrodu } = zaladuj()
  const ocena = {
    propozycje: [
      { wzorzec: 'cichy catch przy fetch', kategoria: 'pusty_catch', miejsca: ['src/a.ts:3', 'src/b.ts:9'], szczebel: 'regula-lint', regula: 'no-empty', doPosprzatania: 4, uzasadnienie: 'Gubi bledy sieci.' },
      { wzorzec: 'any w adapterach', kategoria: 'any', miejsca: ['src/c.ts:1'], szczebel: 'zadanie-sprzatajace', regula: '', doPosprzatania: 0, uzasadnienie: 'Za duzo miejsc na regule teraz.' },
      { wzorzec: 'expect-error w tescie typu', kategoria: 'wyciszenia', miejsca: ['src/t.test.ts:5'], szczebel: 'zostawic', regula: '', doPosprzatania: 0, uzasadnienie: 'Test sprawdza blad typu.' },
    ],
  }
  const s = sekcjaOgrodu(pomiar({ ocena: true, powod: 'nowe wyciszenia lint/TS: +1', zrodlo: 'diff' }), '', ocena)
  assert.match(s, /w liniach dodanych przez to zadanie \(pierwszy pomiar w projekcie\)/)
  assert.match(s, /### Propozycje do decyzji operatora/)
  assert.match(s, /^- \[ \] \*\*cichy catch przy fetch\*\* — reguła lint teraz \(`no-empty`, z posprzątaniem 4 miejsc\)\. Gubi bledy sieci\. Miejsca: `src\/a\.ts:3`, `src\/b\.ts:9`\.$/m)
  assert.match(s, /^- \[ \] \*\*any w adapterach\*\* — zadanie sprzątające\. /m)
  assert.match(s, /^- \[ \] \*\*expect-error w tescie typu\*\* — zostawić\. /m)
})

test('sekcja: ocena bez wyniku agenta, pusta lista, blad pomiaru i limit nowych', () => {
  const { sekcjaOgrodu } = zaladuj()
  const doOceny = pomiar({ ocena: true, powod: 'przeglad okresowy' })
  assert.match(sekcjaOgrodu(doOceny, '', null), /Agent oceny nie zwrócił wyniku — propozycji brak/)
  assert.match(sekcjaOgrodu(doOceny, '', { propozycje: [] }), /Wynik: brak wzorców do zgłoszenia\./)
  assert.match(sekcjaOgrodu(null, 'agent pomiaru zwrocil null', null), /^## Ogród\n\nPomiar nie powstał: agent pomiaru zwrocil null\. Ręcznie: `node \.claude\/scripts\/ogrod\/ogrod\.mjs pomiar`\.\n$/)
  const nowe = Array.from({ length: 20 }, (_, i) => ({ kategoria: 'any', plik: 'src/x.ts', linia: i + 1, tekst: '' }))
  const s = sekcjaOgrodu(pomiar({}, { noweRazem: 23, nowe }), '', null)
  assert.match(s, /Nowe w tym zadaniu \(23\): .*`src\/x\.ts:10` \(any\) i 13 więcej\./)
  assert.doesNotMatch(s, /src\/x\.ts:11/)
})

test('rekord: ocena odbyta zeruje licznik i liczy szczeble; ocena bez wyniku agenta licznika nie zeruje; blad pomiaru', () => {
  const { rekordOgrodu } = zaladuj()
  const ocena = { propozycje: [{ szczebel: 'regula-lint' }, { szczebel: 'regula-lint' }, { szczebel: 'zostawic' }] }
  const odbyta = rekordOgrodu(pomiar({ ocena: true, bez_oceny: 5 }), '', ocena)
  assert.deepEqual([odbyta.status, odbyta.ocena, odbyta.bez_oceny, odbyta.propozycje], ['ok', true, 0, 3])
  assert.deepEqual(odbyta.szczeble, { regula_lint: 2, zadanie_sprzatajace: 0, zostawic: 1 })
  const bezAgenta = rekordOgrodu(pomiar({ ocena: true, bez_oceny: 5 }), '', null)
  assert.deepEqual([bezAgenta.ocena, bezAgenta.bez_oceny, bezAgenta.propozycje], [false, 5, 0])
  const bezOceny = rekordOgrodu(pomiar({ bez_oceny: 3 }), '', null)
  assert.deepEqual([bezOceny.ocena, bezOceny.bez_oceny, bezOceny.nowe], [false, 3, 1])
  assert.deepEqual(rekordOgrodu(null, 'zly JSON', null), { status: 'blad', powod: 'zly JSON' })
})

test('kontrakt z prog.mjs: rekord z wyniku runu to poprzedni pomiar nastepnego zadania (liczby i licznik)', () => {
  const { rekordOgrodu } = zaladuj()
  const run = { typ: 'run', workflow: 'dev-autopilot', projekt: 'oferty', run: 'wf_x', start: '2026-10-08T10:00:00Z' }
  const rekord = rekordOgrodu(pomiar({ bez_oceny: 3 }), '', null)
  assert.deepEqual(poprzedniPomiar([{ ...run, ogrod: rekord }], { projekt: 'oferty' }), { run: 'wf_x', start: '2026-10-08T10:00:00Z', liczby: rekord.liczby, bez_oceny: 3 })
  assert.equal(poprzedniPomiar([{ ...run, ogrod: rekordOgrodu(null, 'x', null) }], { projekt: 'oferty' }), null, 'rekord bledu nie jest punktem odniesienia')
})

test('ogrodnik(): bez przyrostu jeden agent pomiaru (klasa bez edycji); przy progu agent oceny sceptyka z efortem medium', async () => {
  /** @type {Array<Record<string, unknown>>} */
  const wywolania = []
  const bezOceny = zaladuj((_, opcje) => {
    wywolania.push(opcje)
    return wynikAgenta(pomiar())
  })
  const w1 = await bezOceny.ogrodnik('zadanie-x')
  assert.deepEqual(wywolania.map((o) => [o.label, o.agentType]), [['ogrod:pomiar', 'klasa-mechaniczny-pomiar']])
  assert.match(w1.sekcja, /^## Ogród/)
  assert.equal(w1.rekord.ocena, false)
  assert.match(bezOceny.logi[0], /^Ogrod: wyciszenia=2, any=4/)

  wywolania.length = 0
  const zOcena = zaladuj((_, opcje) => {
    wywolania.push(opcje)
    return opcje.label === 'ogrod:pomiar' ? wynikAgenta(pomiar({ ocena: true })) : { propozycje: [] }
  })
  const w2 = await zOcena.ogrodnik('zadanie-x')
  assert.deepEqual(wywolania.map((o) => [o.label, o.agentType, o.effort]), [
    ['ogrod:pomiar', 'klasa-mechaniczny-pomiar', undefined], ['ogrod:ocena', 'klasa-sceptyk', 'medium'],
  ])
  assert.deepEqual([w2.rekord.ocena, w2.rekord.bez_oceny], [true, 0])

  const padniety = zaladuj(() => null)
  const w3 = await padniety.ogrodnik('zadanie-x')
  assert.equal(w3.rekord.status, 'blad')
  assert.match(padniety.logi[0], /^UWAGA: ogrod — pomiar nie powstal \(agent pomiaru zwrocil null\)/)
})

test('prompt oceny: zakaz zmian w plikach, wejscie z pomiaru, limit propozycji', () => {
  const { ogrodOcenaPrompt } = zaladuj()
  const p = ogrodOcenaPrompt(pomiar({ ocena: true, powod: 'nowe wyciszenia lint/TS: +1' }))
  assert.match(p, /Kodu nie zmieniasz/)
  assert.match(p, /"nowe":\[\{"kategoria":"any","plik":"src\/a\.ts","linia":3/)
  assert.match(p, /Najwyzej 5 propozycji/)
})

test('kolejnosc zakonczenia: compound-refresh -> ogrodnik -> complete-wf z sekcja; wynik runu niesie rekord ogrod', () => {
  const refresh = zrodlo.indexOf("label: 'compound-refresh'")
  const ogrodnik = zrodlo.indexOf('ogrod = await ogrodnik(stan.nazwaZadania)')
  const complete = zrodlo.indexOf("workflow('dev-docs-complete-wf'")
  assert.ok(refresh !== -1 && ogrodnik > refresh && complete > ogrodnik, `refresh ${refresh}, ogrodnik ${ogrodnik}, complete ${complete}`)
  assert.match(zrodlo.slice(complete, complete + 200), /sekcjaOgrodu: ogrod\.sekcja/)
  assert.match(zrodlo, /^ {2}ogrod: ogrod \? ogrod\.rekord : null,$/m)
  assert.match(zrodlo, /ogrod = await ogrodnik\(stan\.nazwaZadania\)/)
})

test('polecenie z promptu agenta pomiaru, wykonane w repo-fixture, daje wynik, ktory przechodzi pomiarZWyniku i sekcje', () => {
  const { pomiarZWyniku, sekcjaOgrodu, ogrodPomiarPrompt } = zaladuj()
  const prompt = ogrodPomiarPrompt('zadanie-x')
  const polecenia = prompt.split('\n').filter((/** @type {string} */ linia) => linia.startsWith('node '))
  assert.deepEqual(polecenia, ["node .claude/scripts/ogrod/ogrod.mjs pomiar --zadanie 'zadanie-x'"], 'dokladnie jedno polecenie, bez innych argumentow')
  const [, skrypt, ...argumenty] = polecenia[0].replaceAll("'", '').split(' ')
  const repo = noweRepo()
  try {
    git(repo, ['branch', '-M', 'main'])
    zapisz(repo, { 'src/a.ts': 'export const a = 1\n' })
    commit(repo, 'baza')
    git(repo, ['checkout', '-q', '-b', 'feature/x'])
    zapisz(repo, { 'src/a.ts': 'export const a = 1\n// eslint-disable-next-line\nexport const b: any = 2\n' })
    commit(repo, 'zadanie')
    // Polecenie z promptu uruchamiane w korzeniu repo (jak agent); telemetria na pusty plik, zeby test nie czytal danych maszyny.
    const p = spawnSync(process.execPath, [resolve(KATALOG, '../../..', skrypt), ...argumenty, '--telemetria', resolve(repo, 'brak.jsonl')], { encoding: 'utf8', cwd: repo })
    const { pomiar: wynik, blad } = pomiarZWyniku({ kod: p.status, stdout: p.stdout.trim(), stderr: p.stderr })
    assert.equal(blad, '')
    assert.equal(wynik.decyzja.ocena, true)
    const s = sekcjaOgrodu(wynik, '', { propozycje: [] })
    assert.match(s, /^- wyciszenia lint\/TS: 1 \(\+1\)$/m)
    assert.match(s, /^- any: 1 \(\+1\)$/m)
    assert.match(s, /Nowe w tym zadaniu \(2\): `src\/a\.ts:2` \(wyciszenia lint\/TS\), `src\/a\.ts:3` \(any\)\./)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
