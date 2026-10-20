// Zapis decyzji do jednej linii checklisty (P24 IU-3): adnotacja zaraz po checkboxie, reszta pliku bajt w bajt, konflikt przy
// zmianie linii przez sesje, zapis atomowy i blokada narzedzia w katalogu stanu.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import { punktyWizualne } from '../punkty.mjs'
import { BladZapisu, oczyscNotatke, skrotSha1, zapiszAtomowo, zapiszDecyzje } from '../zapis-linii.mjs'

const TERAZ = new Date(2026, 9, 20, 23, 30)
const P1 = 'Telefon: `/konto/projekty` obok `visual-diff/moje-projekty-telefon-figma.png` (viewport 390×782) → układ zgodny'
const P2 = 'Komputer: `/admin/kolejka` obok `visual-diff/admin-skrzynka-komputer-figma.png` (viewport 1440×1150) → zgodne'
const SMOKE = `# Smoke\n\n## 1. Ekrany\n\n- [ ] ${P1}\n- [x] *(2026-10-18: stara ocena)* ${P2}\n\nKoniec bez nowej linii`

/** @param {(k: { katalog: string, plik: string, stan: string }) => Promise<void>} cialo @param {string} [tresc] */
async function zSmoke(cialo, tresc = SMOKE) {
  const katalog = mkdtempSync(join(tmpdir(), 'makieta-zapis-'))
  const plik = join(katalog, '2026-10-20-x-smoke.md')
  const stan = join(katalog, 'stan')
  writeFileSync(plik, tresc)
  try {
    await cialo({ katalog, plik, stan })
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
}

/** @param {string} plik @param {number} i */
const punkt = (plik, i) => punktyWizualne(readFileSync(plik, 'utf8'), skrotSha1)[i]

/** @param {import('../zapis-linii.mjs').WynikZapisu} w @returns {string} nowa linia zapisu */
function zapisana(w) {
  assert.equal(w.wynik, 'zapisano', JSON.stringify(w))
  return w.linia ?? ''
}

test('„zgodne” na punkcie otwartym: [x] i adnotacja z dzisiejszą datą lokalną; reszta pliku identyczna bajtowo (także CRLF)', async () => {
  for (const koniec of ['\n', '\r\n']) {
    await zSmoke(async ({ plik, stan }) => {
      const p = punkt(plik, 0)
      const w = await zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: p.tekst, decyzja: 'zgodne', teraz: TERAZ })
      assert.equal(w.wynik, 'zapisano')
      const nowa = `- [x] *(2026-10-20: zgodne)* ${P1}`
      assert.equal(w.linia, nowa)
      assert.equal(readFileSync(plik, 'utf8'), SMOKE.replaceAll('\n', koniec).replace(`- [ ] ${P1}`, nowa))
      assert.equal(punkt(plik, 0).status, 'zgodny')
      assert.deepEqual(readdirSync(join(plik, '..')).filter((n) => n.endsWith('.tmp')), [])
    }, SMOKE.replaceAll('\n', koniec))
  }
})

test('„odstępstwo” bez notatki = odmowa; z notatką = adnotacja z „— zatwierdzone” przed starą adnotacją', () => zSmoke(async ({ plik, stan }) => {
  const p = punkt(plik, 1)
  await assert.rejects(zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: p.tekst, decyzja: 'odstepstwo', notatka: '  \n ', teraz: TERAZ }),
    (b) => b instanceof BladZapisu && b.kod === 'odmowa')
  assert.equal(readFileSync(plik, 'utf8'), SMOKE)
  const w = await zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: p.tekst, decyzja: 'odstepstwo', notatka: 'lista obok podglądu', teraz: TERAZ })
  assert.equal(w.linia, `- [x] *(2026-10-20: lista obok podglądu — zatwierdzone)* *(2026-10-18: stara ocena)* ${P2}`)
  assert.equal(punkt(plik, 1).status, 'odstepstwo')
}))

test('„błąd” zostawia [ ] także na punkcie [x], zapisuje urządzenie, szerokość i opis; potem „poprawione” = do sprawdzenia', () => zSmoke(async ({ plik, stan }) => {
  const p = punkt(plik, 1)
  const w = zapisana(await zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'ucięty tytuł', urzadzenie: 'iphone-15', szerokosc: 393, teraz: TERAZ }))
  assert.equal(w, `- [ ] *(2026-10-20: błąd zgłoszony — iphone-15 393 px: ucięty tytuł)* *(2026-10-18: stara ocena)* ${P2}`)
  assert.equal(punkt(plik, 1).status, 'blad')
  await assert.rejects(zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: w, decyzja: 'blad', notatka: '', urzadzenie: 'x', szerokosc: 393, teraz: TERAZ }),
    (b) => b instanceof BladZapisu && b.kod === 'odmowa', 'pusty opis błędu')
  await assert.rejects(zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: w, decyzja: 'blad', notatka: 'x', urzadzenie: 'x', szerokosc: 0, teraz: TERAZ }),
    (b) => b instanceof BladZapisu && b.kod === 'odmowa', 'szerokość spoza zakresu')
  for (const szerokosc of [-390, 390.5, 10_001]) {
    await assert.rejects(zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: w, decyzja: 'blad', notatka: 'x', urzadzenie: 'x', szerokosc, teraz: TERAZ }),
      (b) => b instanceof BladZapisu && b.kod === 'odmowa', `szerokość ${szerokosc}`)
  }
  const po = zapisana(await zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: w, decyzja: 'poprawione', commit: 'abc1234', teraz: TERAZ }))
  assert.match(po, /^- \[ \] \*\(2026-10-20: poprawione w abc1234, do sprawdzenia\)\* \*\(2026-10-20: błąd zgłoszony/)
  assert.equal(punkt(plik, 1).status, 'poprawione')
  await assert.rejects(zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: po, decyzja: 'poprawione', commit: 'nie sha; rm', teraz: TERAZ }),
    (b) => b instanceof BladZapisu && b.kod === 'odmowa')
  await assert.rejects(zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: po, decyzja: /** @type {import('../zapis-linii.mjs').Decyzja} */ ('usun'), teraz: TERAZ }),
    (b) => b instanceof BladZapisu && b.kod === 'odmowa')
}))

test('linia zmieniona przez sesję między odczytem a zapisem = konflikt, plik bez zmian; nieznany punkt i dubel też', () => zSmoke(async ({ plik, stan }) => {
  const p = punkt(plik, 0)
  const zmieniony = SMOKE.replace(`- [ ] ${P1}`, `- [ ] *(2026-10-20: sesja dopisała)* ${P1}`)
  writeFileSync(plik, zmieniony)
  const w = await zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: p.tekst, decyzja: 'zgodne', teraz: TERAZ })
  assert.deepEqual(w, { wynik: 'konflikt', powod: 'linia-zmieniona', linia: `- [ ] *(2026-10-20: sesja dopisała)* ${P1}` })
  assert.equal(readFileSync(plik, 'utf8'), zmieniony)
  assert.equal((await zapiszDecyzje({ plik, katalogStanu: stan, punkt: 'p-00000000', linia: p.tekst, decyzja: 'zgodne', teraz: TERAZ })).wynik, 'konflikt')
  writeFileSync(plik, `- [ ] ${P1}\n- [ ] ${P1}\n`)
  assert.deepEqual(await zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: `- [ ] ${P1}`, decyzja: 'zgodne', teraz: TERAZ }),
    { wynik: 'konflikt', powod: 'niejednoznaczny', linia: null })
  assert.equal(readFileSync(plik, 'utf8'), `- [ ] ${P1}\n- [ ] ${P1}\n`)
}))

test('notatka ze znacznikami grepów pipeline\'u, zamknięciem adnotacji i nową linią trafia do pliku bez nich', () => zSmoke(async ({ plik, stan }) => {
  assert.equal(oczyscNotatke('jak [E2E] i [Manual]\n[Unit] [P1] [p2] Operator: zrób *(x)* koniec\r\nlinia'), 'jak E2E i Manual Unit P1 p2 Operator zrób (x) koniec linia')
  assert.equal(oczyscNotatke('a'.repeat(400)).length, 300)
  const p = punkt(plik, 0)
  const w = await zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: p.tekst, decyzja: 'odstepstwo', notatka: 'ok [E2E] Operator: )* x\ny', teraz: TERAZ })
  assert.equal(w.linia, `- [x] *(2026-10-20: ok E2E Operator ) x y — zatwierdzone)* ${P1}`)
  const tekst = readFileSync(plik, 'utf8')
  assert.ok(!tekst.includes('[E2E]') && !tekst.includes('Operator:'))
  assert.equal(tekst.split('\n').length, SMOKE.split('\n').length)
  await zapiszDecyzje({ plik, katalogStanu: stan, punkt: punkt(plik, 1).id, linia: punkt(plik, 1).tekst, decyzja: 'blad', notatka: 'x', urzadzenie: 'Operator: [P1]\n*(', szerokosc: 390, teraz: TERAZ })
  assert.match(readFileSync(plik, 'utf8'), /błąd zgłoszony — Operator P1 \( 390 px: x\)\*/)
}))

test('przerwany zapis nie zostawia pliku tymczasowego; przeterminowana blokada nie blokuje, świeża = konflikt blokady', () => zSmoke(async ({ katalog, plik, stan }) => {
  assert.throws(() => zapiszAtomowo(plik, 'nowa', { rename: () => { throw Object.assign(new Error('EIO'), { code: 'EIO' }) } }), /EIO/)
  assert.deepEqual(readdirSync(katalog).filter((n) => n.endsWith('.tmp')), [])
  assert.equal(readFileSync(plik, 'utf8'), SMOKE)
  const p = punkt(plik, 0)
  await zapiszDecyzje({ plik, katalogStanu: stan, punkt: p.id, linia: p.tekst, decyzja: 'zgodne', teraz: TERAZ })
  const blokada = join(stan, 'zapis.lock')
  assert.equal(existsSync(blokada), false, 'blokada zdjęta po zapisie')
  writeFileSync(blokada, '99999')
  const stara = new Date(Date.now() - 60_000)
  utimesSync(blokada, stara, stara)
  const q = punkt(plik, 1)
  assert.equal((await zapiszDecyzje({ plik, katalogStanu: stan, punkt: q.id, linia: q.tekst, decyzja: 'zgodne', teraz: TERAZ })).wynik, 'zapisano')
  writeFileSync(blokada, '99999')
  const r = punkt(plik, 1)
  await assert.rejects(zapiszDecyzje({ plik, katalogStanu: stan, punkt: r.id, linia: r.tekst, decyzja: 'odstepstwo', notatka: 'x', teraz: TERAZ, limitBlokadyMs: 200 }),
    (b) => b instanceof BladZapisu && b.kod === 'blokada')
}))
