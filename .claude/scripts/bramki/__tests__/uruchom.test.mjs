// Test uruchomienia narzedzia bramki: wyjscie, kod, czas, sufit czasu.

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { uruchom } from '../uruchom.mjs'

/** @param {string} tresc @returns {{ katalog: string, bin: string }} */
function skrypt(tresc) {
  const katalog = mkdtempSync(join(tmpdir(), 'bramki-uruchom-'))
  const bin = join(katalog, 'narzedzie')
  writeFileSync(bin, `#!/bin/sh\n${tresc}\n`)
  chmodSync(bin, 0o755)
  return { katalog, bin }
}

test('wyjscie, kod i czas narzedzia; katalog roboczy = projekt', () => {
  const { katalog, bin } = skrypt('pwd; echo "$1" >&2; exit 3')
  try {
    const w = uruchom(bin, ['argument'], { cwd: katalog, sufitSekund: 10 })
    assert.equal(w.kod, 3)
    assert.equal(w.przekroczony, false)
    assert.match(w.stdout, /bramki-uruchom-/)
    assert.equal(w.stderr.trim(), 'argument')
    assert.ok(w.sekundy >= 0 && w.sekundy < 10)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

test('przekroczony sufit czasu: przekroczony = true, kod null', () => {
  const { katalog, bin } = skrypt('exec sleep 5')
  try {
    const w = uruchom(bin, [], { cwd: katalog, sufitSekund: 0.3 })
    assert.equal(w.przekroczony, true)
    assert.equal(w.kod, null)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})
