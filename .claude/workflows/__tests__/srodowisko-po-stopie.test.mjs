// Pilot mobile W26: STOP zostawia zywe srodowisko E2E celowo, ale komunikat musi to powiedziec, z komenda zatrzymania —
// operator naprawial recznie przy dzialajacym Metro i `expo install --fix` padl w polowie.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const zrodlo = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'dev-autopilot-wf.js'), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

test('STOP przy zywym srodowisku E2E dopisuje do powodu UWAGE z komenda e2e.mjs stop; bez srodowiska powod bez zmian', async () => {
  const poczatek = zrodlo.indexOf('let srodowiskoZostawione = false')
  const koniec = zrodlo.indexOf('\n}\n', zrodlo.indexOf('async function stopRun(obj) {')) + 3
  assert.ok(poczatek > 0 && koniec > poczatek)
  const fragment = zrodlo.slice(poczatek, koniec)
  const uruchom = (/** @type {boolean} */ zywe) => new AsyncFunction('sciezka', 'stan', 'log', 'zacommitujArtefaktyStop', 'potwierdzStan', 'zapiszZaleglyStan', 'fazyUkonczone', 'poleNiezapisanych', 'decyzjeNiezapisane',
    `${fragment}\n${zywe ? 'srodowiskoZostawione = true' : ''}\nreturn stopRun({ powod: 'canary na iPhone: kod 1' })`)(
    'docs/active/x', null, () => {}, async () => null, async () => {}, async () => {}, () => null, () => ({}), [])
  const zZywym = await uruchom(true)
  assert.match(zZywym.powod, /^canary na iPhone: kod 1 UWAGA: srodowisko E2E dziala dalej/)
  assert.match(zZywym.powod, /`node \.claude\/scripts\/e2e\/e2e\.mjs stop --zadanie "docs\/active\/x"`\.$/)
  assert.equal((await uruchom(false)).powod, 'canary na iPhone: kod 1')
})

test('flaga zywego srodowiska: ustawiana po starcie z serwerem i po restarcie fazy, zerowana po udanym env-down', () => {
  const start = zrodlo.indexOf('e2eStart = startZeSkryptu(e2eStart)')
  const flaga = zrodlo.indexOf("if (e2eStart && e2eStart.serwer === 'uruchomione') srodowiskoZostawione = true")
  assert.ok(start > 0 && flaga > start && flaga < zrodlo.indexOf('if (srodowiskoStartu.stop)'), 'flaga po starcie, przed STOP-em startu')
  assert.match(zrodlo, /if \(po\.nasz\) \{ serwerNasz = true; srodowiskoZostawione = true \}/)
  assert.match(zrodlo, /if \(down && down\.posprzatano\) srodowiskoZostawione = false/)
  assert.ok(zrodlo.indexOf('let srodowiskoZostawione') < zrodlo.indexOf("return await stopRun({ powod: 'bootstrap nie zwrocil stanu"), 'deklaracja przed pierwszym STOP-em (TDZ)')
})
