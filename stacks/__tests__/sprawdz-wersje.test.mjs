// Kontrola wersji rdzenia w wariancie (IU-3.2): pełny SHA bez `-dirty`, równy oczekiwanemu.
//
// Uruchomienie: node --test stacks/__tests__/sprawdz-wersje.test.mjs

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { sprawdzWersje } from '../sprawdz-wersje.mjs'

const SKRYPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'sprawdz-wersje.mjs')
const SHA = 'a'.repeat(40)
const INNY = 'b'.repeat(40)

/** @param {string | null} tresc @returns {string} katalog wariantu */
function wariant(tresc) {
  const k = mkdtempSync(join(tmpdir(), 'wersja-'))
  if (tresc !== null) {
    mkdirSync(join(k, '.claude'))
    writeFileSync(join(k, '.claude/.rdzen-version'), tresc)
  }
  return k
}

test('wersja równa oczekiwanemu SHA: ok z wersją', () => {
  assert.deepEqual(sprawdzWersje(wariant(`${SHA}\n`), SHA), { ok: true, wersja: SHA })
})

test('wersja z -dirty: odmowa dirty, nawet przy zgodnym SHA', () => {
  const wynik = sprawdzWersje(wariant(`${SHA}-dirty\n`), SHA)
  assert.equal(wynik.ok, false)
  assert.equal(wynik.ok === false && wynik.kod, 'dirty')
})

test('wersja innego commitu: odmowa inny-sha z obiema wartościami', () => {
  const wynik = sprawdzWersje(wariant(`${INNY}\n`), SHA)
  assert.equal(wynik.ok === false && wynik.kod, 'inny-sha')
  assert.equal(wynik.ok === false && wynik.komunikat, `wersja ${INNY}, oczekiwana ${SHA}`)
})

test('brak pliku wersji: odmowa brak-pliku', () => {
  const wynik = sprawdzWersje(wariant(null), SHA)
  assert.equal(wynik.ok === false && wynik.kod, 'brak-pliku')
})

test('oczekiwany SHA skrócony albo pusty: odmowa zly-sha, zanim plik zostanie przeczytany', () => {
  for (const zly of ['aaaaaaa', '', `${SHA}-dirty`]) {
    const wynik = sprawdzWersje(wariant(`${SHA}\n`), zly)
    assert.equal(wynik.ok === false && wynik.kod, 'zly-sha', zly)
  }
})

test('CLI: kod 0 przy zgodnej wersji, 1 z kodem błędu na stderr, 2 przy złych argumentach', () => {
  const ok = spawnSync(process.execPath, [SKRYPT, wariant(`${SHA}\n`), SHA], { encoding: 'utf8' })
  assert.equal(ok.status, 0)
  assert.equal(ok.stdout.trim(), `rdzeń ${SHA}`)
  const zle = spawnSync(process.execPath, [SKRYPT, wariant(`${SHA}-dirty\n`), SHA], { encoding: 'utf8' })
  assert.equal(zle.status, 1)
  assert.match(zle.stderr, /^dirty: /)
  assert.equal(spawnSync(process.execPath, [SKRYPT, 'jeden'], { encoding: 'utf8' }).status, 2)
})
