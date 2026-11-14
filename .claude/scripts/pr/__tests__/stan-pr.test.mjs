// Stan PR ze zrodel trwalych: decyzje o watkach, licznik tur, recenzja czubka i ocena ostatniej tury (punkty 8, 12, 19, 20, 22).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { koniecRecenzjiCzubka, LIMIT_CZEKANIA_NA_BOTA_MIN, liczbaTur, ocenaCzekaniaNaBota, ocenaOstatniejTury, ocenaRecenzjiCzubka, odczytajZnacznik, PROG_LINII_TURY, stanWatku, znacznikDecyzji } from '../stan-pr.mjs'

const BOT = { author: { login: 'coderabbitai' }, body: 'Zarzut' }
/** @param {string} body */
const MY = (body) => ({ author: { login: 'operator' }, body })
/** @param {import('../stan-pr.mjs').KomentarzWatku[]} nodes */
const watek = (nodes) => ({ id: 'T', isResolved: false, comments: { nodes } })
const zawsze = () => true

test('znacznik decyzji: zapis i odczyt; obcy komentarz HTML i nieznana decyzja nie licza sie', () => {
  const z = znacznikDecyzji({ decyzja: 'operator', tura: 2 })
  assert.deepEqual(odczytajZnacznik(`Decyzja: limit zostaje.\n${z}`), { decyzja: 'operator', tura: 2 })
  assert.equal(odczytajZnacznik('<!-- This is an auto-generated comment by coderabbit.ai -->'), null)
  assert.equal(odczytajZnacznik('<!-- dev-pr:{"decyzja":"inna"} -->'), null)
})

test('watek bez naszej decyzji jest otwarty', () => {
  assert.deepEqual(stanWatku(watek([BOT]), zawsze), { stan: 'otwarty', decyzja: null, botOdpowiedzial: false })
})

test('aa-exam PR #51: decyzja operatora zostaje rozstrzygnieta takze po odpowiedzi bota', () => {
  const w = watek([BOT, MY(znacznikDecyzji({ decyzja: 'operator' })), BOT])
  assert.deepEqual(stanWatku(w, zawsze), { stan: 'rozstrzygniety', decyzja: 'operator', botOdpowiedzial: true })
})

test('aa-exam PR #48: poprawka w historii czubka czeka na bota i nie jest kolejna tura', () => {
  const w = watek([BOT, MY(znacznikDecyzji({ decyzja: 'naprawione', sha: 'abc' }))])
  assert.equal(stanWatku(w, zawsze).stan, 'naprawiony-czeka-na-bota')
})

test('poprawka spoza historii czubka albo po odpowiedzi bota wraca do oceny', () => {
  const w = watek([BOT, MY(znacznikDecyzji({ decyzja: 'naprawione', sha: 'abc' }))])
  assert.equal(stanWatku(w, () => false).stan, 'otwarty')
  assert.equal(stanWatku(watek([...w.comments.nodes, BOT]), zawsze).stan, 'otwarty')
})

test('licznik tur z tematow commitow: najwyzsza tura, obce tematy pomijane', () => {
  assert.equal(liczbaTur(['feat: x', 'fix(pr): tura 1 — poprawki po review bota', 'fix(pr): tura 3 — poprawki po review bota', 'docs: y']), 3)
  assert.equal(liczbaTur(['feat: x', 'fix(pr): inne']), 0)
})

const STATUS = { context: 'CodeRabbit', created_at: '2026-11-03T08:23:00Z' }

test('piszemy_wirale PR #7: „Review rate limited” i brak check-runu blokuja bramke', () => {
  const limit = ocenaRecenzjiCzubka({ statusy: [{ ...STATUS, state: 'rate-limit', description: 'Review rate limited' }], recenzjaCzubka: false, plikiPoRecenzji: 3 })
  assert.equal(limit.ok, false)
  assert.match(limit.powod, /limit planu/)
  assert.equal(ocenaRecenzjiCzubka({ statusy: [], recenzjaCzubka: false, plikiPoRecenzji: 3 }).ok, false)
  assert.equal(ocenaRecenzjiCzubka({ statusy: [{ ...STATUS, state: 'pending' }], recenzjaCzubka: false, plikiPoRecenzji: 3 }).ok, false)
})

test('recenzja czubka, check-run bez uwag i commit poza filtrami bota przepuszczaja', () => {
  assert.equal(ocenaRecenzjiCzubka({ statusy: [], recenzjaCzubka: true, plikiPoRecenzji: null }).ok, true)
  assert.equal(ocenaRecenzjiCzubka({ statusy: [{ ...STATUS, state: 'success', description: 'Finished' }], recenzjaCzubka: false, plikiPoRecenzji: 2 }).ok, true)
  assert.equal(ocenaRecenzjiCzubka({ statusy: [], recenzjaCzubka: false, plikiPoRecenzji: 0 }).ok, true)
})

test('ostatnia tura: duzo kodu albo plik sesji wymaga krotkiego review; testy i dokumenty sie nie licza', () => {
  assert.equal(ocenaOstatniejTury([{ plik: 'src/a.ts', dodane: PROG_LINII_TURY + 1 }]).wymagaReview, true)
  assert.equal(ocenaOstatniejTury([{ plik: 'src/a.ts', dodane: 5 }, { plik: 'src/a.test.ts', dodane: 900 }, { plik: 'docs/x.md', dodane: 900 }]).wymagaReview, false)
  assert.deepEqual(ocenaOstatniejTury([{ plik: 'src/server/magic-link-session.ts', dodane: 3 }]).ryzykowne, ['src/server/magic-link-session.ts'])
})

// Punkt 64 (vibersi PR #24): bot odrzucil poprawke 4 min po recenzji czubka, bramka sprawdzala stan chwile pozniej.
test('ocenaCzekaniaNaBota: czeka do 10 min od recenzji czubka, potem przepuszcza z adnotacja; bez poprawek nie czeka', () => {
  assert.equal(LIMIT_CZEKANIA_NA_BOTA_MIN, 10)
  const koniec = '2026-11-14T10:35:00Z'
  const t = (/** @type {number} */ min) => Date.parse(koniec) + min * 60_000
  assert.deepEqual(ocenaCzekaniaNaBota({ czekajace: [], koniecRecenzji: koniec, teraz: t(0) }), { czekaj: false, watki: [], resztaMin: 0, poLimicie: false, powod: 'brak poprawek czekajacych na bota' })
  const w5 = ocenaCzekaniaNaBota({ czekajace: ['a.ts:1'], koniecRecenzji: koniec, teraz: t(5) })
  assert.deepEqual([w5.czekaj, w5.resztaMin, w5.poLimicie], [true, 5, false])
  assert.match(w5.powod, /jeszcze 5 min z 10/)
  assert.deepEqual([ocenaCzekaniaNaBota({ czekajace: ['a.ts:1'], koniecRecenzji: koniec, teraz: t(9.99) }).resztaMin], [1])
  const w10 = ocenaCzekaniaNaBota({ czekajace: ['a.ts:1'], koniecRecenzji: koniec, teraz: t(10) })
  assert.deepEqual([w10.czekaj, w10.poLimicie, w10.watki], [false, true, ['a.ts:1']])
  assert.match(w10.powod, /nie odpowiedzial na poprawke w 10 min/)
  const brak = ocenaCzekaniaNaBota({ czekajace: ['a.ts:1'], koniecRecenzji: null, teraz: t(60) })
  assert.deepEqual([brak.czekaj, brak.poLimicie], [true, false])
})

test('koniecRecenzjiCzubka: najpozniejsza recenzja czubka albo zakonczony check-run; starsze commity i pending pomija', () => {
  const recenzje = [{ commit_id: 'A', submitted_at: '2026-11-14T10:00:00Z' }, { commit_id: 'B', submitted_at: '2026-11-14T10:35:00Z' }, { commit_id: 'B', submitted_at: '2026-11-14T10:30:00Z' }]
  assert.equal(koniecRecenzjiCzubka(recenzje, null, 'B'), '2026-11-14T10:35:00Z')
  const sukces = { context: 'CodeRabbit', state: 'success', description: null, created_at: '2026-11-14T10:40:00Z' }
  assert.equal(koniecRecenzjiCzubka(recenzje, sukces, 'B'), '2026-11-14T10:40:00Z')
  assert.equal(koniecRecenzjiCzubka([], { ...sukces, state: 'pending' }, 'B'), null)
  assert.equal(koniecRecenzjiCzubka(recenzje, null, 'C'), null)
})
