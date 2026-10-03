// Bloki z wyniku bramek domkniecia w dossier: ostrzezenia ESLint (code-quality), knip (martwy kod), przezyte mutanty
// (test-coverage). Zrodlo = plik z OSTATNIEGO przebiegu bramek (domkniecie nadpisuje go po naprawie — HANDOFF 6a pkt 52 e).

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { blokBramek } from '../bramki-blok.mjs'

const WYNIK = {
  typecheck: { status: 'ok', sekundy: 1.2, trafienia: [] },
  eslint: {
    status: 'ok', sekundy: 0.8, trafienia: [],
    ostrzezenia: [{ plik: 'src/a.ts', linia: 4, regula: 'complexity', opis: 'Function has a complexity of 12' }],
  },
  knip: { status: 'ok', sekundy: 2, trafienia: [], zastane: 3 },
  stryker: {
    status: 'ok', sekundy: 30, trafienia: [{ plik: 'src/a.ts', linia: 7, regula: 'stryker/ArithmeticOperator', opis: 'a - b przezyl' }],
  },
  advisors: { status: 'brak', sekundy: 0, trafienia: [], powod: 'brak SUPABASE_ACCESS_TOKEN' },
}

/** @param {unknown} tresc @returns {{ plik: string, sprzataj: () => void }} */
function plikWyniku(tresc) {
  const katalog = mkdtempSync(join(tmpdir(), 'bramki-blok-'))
  const plik = join(katalog, 'bramki.json')
  writeFileSync(plik, typeof tresc === 'string' ? tresc : JSON.stringify(tresc))
  return { plik, sprzataj: () => rmSync(katalog, { recursive: true, force: true }) }
}

test('blokBramek: statusy wszystkich bramek, ostrzezenia ESLint, knip z liczba zastanych, przezyte mutanty', () => {
  const { plik, sprzataj } = plikWyniku(WYNIK)
  try {
    const blok = blokBramek(plik)
    assert.match(blok, /typecheck ok, eslint ok, knip ok, stryker ok, advisors brak/)
    assert.match(blok, /### Ostrzezenia ESLint[^\n]*\n- src\/a\.ts:4 complexity — Function has a complexity of 12/)
    assert.match(blok, /### knip[^\n]*zastane poza faza: 3[^\n]*\n- brak/)
    assert.match(blok, /### Przezyte mutanty[^\n]*\n- src\/a\.ts:7 stryker\/ArithmeticOperator — a - b przezyl/)
  } finally {
    sprzataj()
  }
})

test('blokBramek: brak pliku albo zly JSON = jedna linia z powodem, bez blokow', () => {
  assert.match(blokBramek('/nie/ma/takiego.json'), /^Brak wyniku bramek: plik \/nie\/ma\/takiego\.json nie istnieje/)
  assert.match(blokBramek(null), /^Brak wyniku bramek: bramki nie biegly w tej fazie albo plik wyniku zniknal/)
  const { plik, sprzataj } = plikWyniku('{ niepelny')
  try {
    assert.match(blokBramek(plik), /^Brak wyniku bramek: plik .* nie jest JSON-em/)
  } finally {
    sprzataj()
  }
})
