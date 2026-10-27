// Kolejka zgloszen narzedzia makiet (P24 IU-5): wpis „Zgłoś błąd” w kolejka.jsonl katalogu stanu, czekaj jako iterator zdarzen
// z limitem (Monitor sesji), dostarczenie raz, zgloszenia otwarte liczone z checklisty.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import { LIMIT_CZEKANIA_MIN, czekaj, dopiszPrzeglad, dopiszZgloszenie, niedostarczone, otwarteZgloszenia, podsumowanie } from '../kolejka.mjs'
import { punktyWizualne } from '../punkty.mjs'
import { skrotSha1 } from '../zapis-linii.mjs'

const WPIS = { punkt: 'p-12345678', ekran: 'a', trasa: '/konto', viewport: { szerokosc: 390, wysokosc: 844 }, urzadzenie: 'iphone-15', szerokosc: 393, opis: 'ucięty tytuł', spec: 'docs/plans/x/ekrany/a.md', makieta: 'docs/completed/z/visual-diff/a-figma.png', zrzut: null }

/** @param {(stan: string) => Promise<void>} cialo */
async function zeStanem(cialo) {
  const stan = mkdtempSync(join(tmpdir(), 'makieta-kolejka-'))
  try {
    await cialo(stan)
  } finally {
    rmSync(stan, { recursive: true, force: true })
  }
}

/** @param {AsyncIterable<Record<string, unknown>>} zrodlo @returns {Promise<Record<string, unknown>[]>} */
async function wszystkie(zrodlo) {
  const wynik = []
  for await (const z of zrodlo) wynik.push(z)
  return wynik
}

test('limit czekania to 25 min (Monitor żyje najwyżej 30 min)', () => assert.equal(LIMIT_CZEKANIA_MIN, 25))

test('dopisane zgłoszenie: jedna linia JSON z id, czasem i polami wpisu; niedostarczone je zwraca', () => zeStanem(async (stan) => {
  const w = dopiszZgloszenie(stan, WPIS)
  assert.match(w.id, /^[0-9a-f-]{36}$/)
  const linie = readFileSync(join(stan, 'kolejka.jsonl'), 'utf8').trim().split('\n')
  assert.equal(linie.length, 1)
  assert.deepEqual(JSON.parse(linie[0]), { ...WPIS, id: w.id, czas: w.czas })
  assert.deepEqual(niedostarczone(stan).map((x) => x.id), [w.id])
}))

test('czekaj oddaje zgłoszenie złożone przed startem i w trakcie, raz; potem limit; drugi start już ich nie oddaje', () => zeStanem(async (stan) => {
  const przed = dopiszZgloszenie(stan, WPIS)
  /** @type {Record<string, unknown>[]} */
  const zdarzenia = []
  for await (const z of czekaj({ katalogStanu: stan, limitMs: 600, odstepMs: 50 })) {
    zdarzenia.push(z)
    if (zdarzenia.length === 1) dopiszZgloszenie(stan, { ...WPIS, opis: 'drugi' })
  }
  assert.deepEqual(zdarzenia.map((z) => [z.zdarzenie, z.opis ?? null]), [['zgloszenie', 'ucięty tytuł'], ['zgloszenie', 'drugi'], ['limit', null]])
  assert.equal(zdarzenia[0].id, przed.id)
  assert.equal(zdarzenia[0].punkt, 'p-12345678')
  assert.deepEqual(await wszystkie(czekaj({ katalogStanu: stan, limitMs: 150, odstepMs: 50 })), [{ zdarzenie: 'limit' }])
  assert.deepEqual(niedostarczone(stan), [])
}))

test('czekaj kończy się zdarzeniem serwer-zatrzymany, gdy serwer przestał żyć; uszkodzona linia kolejki nie zatrzymuje reszty', () => zeStanem(async (stan) => {
  let zyje = true
  setTimeout(() => { zyje = false }, 120)
  const z = await wszystkie(czekaj({ katalogStanu: stan, limitMs: 5000, odstepMs: 40, czyZyje: async () => zyje }))
  assert.deepEqual(z, [{ zdarzenie: 'serwer-zatrzymany' }])
  dopiszZgloszenie(stan, WPIS)
  const { appendFileSync } = await import('node:fs')
  appendFileSync(join(stan, 'kolejka.jsonl'), '{niedokończony\n')
  dopiszZgloszenie(stan, { ...WPIS, opis: 'po uszkodzonej' })
  assert.deepEqual(niedostarczone(stan).map((x) => ('opis' in x ? x.opis : null)), ['ucięty tytuł', 'po uszkodzonej'])
}))

test('otwarte zgłoszenia liczone z checklisty (status błąd zgłoszony), nie z kolejki', () => {
  const md = [
    '- [ ] *(2026-10-20: błąd zgłoszony — iphone-15 393 px: ucięty)* T: `/` obok `visual-diff/a-figma.png` (viewport 390×844) → ok',
    '- [ ] *(2026-10-20: poprawione w abc1234, do sprawdzenia)* *(2026-10-20: błąd zgłoszony — x)* T: `/b` obok `visual-diff/b-figma.png` (viewport 390×844) → ok',
    '- [x] *(2026-10-20: zgodne)* T: `/c` obok `visual-diff/c-figma.png` (viewport 390×844) → ok',
  ].join('\n')
  const otwarte = otwarteZgloszenia(punktyWizualne(md, skrotSha1))
  assert.deepEqual(otwarte.map((p) => [p.linia, p.ekrany, p.adnotacje[0]]), [[1, ['a'], '2026-10-20: błąd zgłoszony — iphone-15 393 px: ucięty']])
})

test('po recenzji: konsument przerwany po pierwszym zdarzeniu dostaje je ponownie przy następnym starcie; wpis bez pól zgłoszenia pominięty', () => zeStanem(async (stan) => {
  const w = dopiszZgloszenie(stan, WPIS)
  for await (const z of czekaj({ katalogStanu: stan, limitMs: 1000, odstepMs: 20 })) {
    assert.equal(z.zdarzenie, 'zgloszenie')
    break
  }
  const ponownie = await wszystkie(czekaj({ katalogStanu: stan, limitMs: 60, odstepMs: 20 }))
  assert.deepEqual(ponownie.map((z) => z.id ?? z.zdarzenie), [w.id, 'limit'])
  const { appendFileSync } = await import('node:fs')
  appendFileSync(join(stan, 'kolejka.jsonl'), `${JSON.stringify({ id: 'samo-id' })}\n${JSON.stringify({ id: 'bez-opisu', punkt: 'p-1', ekran: 'a', urzadzenie: 'u', czas: 'x' })}\n`)
  assert.deepEqual(niedostarczone(stan), [])
}))

test('P28 (4) wpis przeglądu: czekaj oddaje go raz jako przeglad-zakonczony bez pola typ; wpis typu przeglad bez listy zgłoszeń pominięty', () => zeStanem(async (stan) => {
  const pod = { punkty: 3, otwarty: 1, zgodny: 1, odstepstwo: 0, blad: 1, poprawione: 0 }
  const w = dopiszPrzeglad(stan, { smoke: 's.md', zgloszenia: [], podsumowanie: pod })
  const { appendFileSync } = await import('node:fs')
  appendFileSync(join(stan, 'kolejka.jsonl'), `${JSON.stringify({ id: 'zly', typ: 'przeglad', zgloszenia: 'nie-lista' })}\n`)
  const z = await wszystkie(czekaj({ katalogStanu: stan, limitMs: 60, odstepMs: 20 }))
  assert.deepEqual(z, [{ zdarzenie: 'przeglad-zakonczony', smoke: 's.md', zgloszenia: [], podsumowanie: pod, id: w.id, czas: w.czas }, { zdarzenie: 'limit' }])
  assert.deepEqual(niedostarczone(stan), [])
}))

test('P28 (4) podsumowanie liczy punkty według statusu', () => {
  const md = [
    '- [ ] *(2026-10-20: błąd zgłoszony — u 390 px: x)* T: `/` obok `visual-diff/a-figma.png` (viewport 390×844) → ok',
    '- [x] *(2026-10-20: zgodne)* T: `/c` obok `visual-diff/c-figma.png` (viewport 390×844) → ok',
    '- [x] *(2026-10-20: inny odstęp — zatwierdzone)* T: `/d` obok `visual-diff/d-figma.png` (viewport 390×844) → ok',
    '- [ ] T: `/e` obok `visual-diff/e-figma.png` (viewport 390×844) → ok',
  ].join('\n')
  assert.deepEqual(podsumowanie(punktyWizualne(md, skrotSha1)), { punkty: 4, otwarty: 1, zgodny: 1, odstepstwo: 1, blad: 1, poprawione: 0 })
})
