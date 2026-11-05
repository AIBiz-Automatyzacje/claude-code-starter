// Kontrakt nakładki Expo (zasada 4 planu): każdy slot i każdy plik, który strażnik uznaje za usuwany albo podmieniany, ma w
// nakładce podmianę albo wpis w `usun.txt`. `ZALEGLE` to pliki, których Etap 2 jeszcze nie zrobił: każde IU usuwa stąd swoje,
// na odbiorze lista jest pusta. Wpis już pokryty zatrzymuje test, tak samo jak nieaktualny wyjątek strażnika.
//
// Uruchomienie: node --test stacks/expo/__tests__/nakladka.test.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { wczytajSloty, wczytajStraznik } from '../../straznik.mjs'
import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const STACK = join(KORZEN, 'stacks/expo')

const ZALEGLE = [
  // sloty
  '.claude/stack/buildery.md', // IU-2.5
  '.claude/stack/walidacja.md', // IU-2.5
  '.claude/stack/fix-e2e.md', // IU-2.5
  '.claude/stack/plan-e2e.md', // IU-2.5
  '.claude/skills/dev-plan/references/stack.md', // IU-2.5
  '.claude/skills/dev-prep/references/stack.md', // IU-2.9
  '.claude/skills/dev-compound/references/stack.md', // IU-2.9
  '.claude/skills/weryfikacja-setup/references/stack.md', // IU-2.6
  // wyjątki strażnika `podmiana`
  '.claude/agents/feature-builder-ui.md', // IU-2.1
  '.claude/agents/feature-builder-ui-figma.md', // IU-2.1
  '.claude/agents/feature-builder-fullstack.md', // IU-2.1
  '.claude/agents/feature-builder-fullstack-figma.md', // IU-2.1
  '.claude/agents/feature-builder-data.md', // IU-2.1
  '.claude/agents/feature-tester-e2e.md', // IU-2.2
  '.claude/templates/smoke-autopilot/', // IU-2.6
]

/** @returns {string[]} */
function plikiNakladki() {
  const korzen = join(STACK, 'nakladka')
  if (!existsSync(korzen)) return []
  return readdirSync(korzen, { recursive: true, withFileTypes: true })
    .filter((w) => w.isFile())
    .map((w) => relative(korzen, join(w.parentPath, w.name)))
}

const wpisyUsun = () => readFileSync(join(STACK, 'usun.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

/** Plik albo katalog (`/` na końcu) kontraktu pokryty wpisem `usun.txt` albo plikiem nakładki. @param {string} plik */
function pokryty(plik) {
  const trafia = (/** @type {string} */ p) => (plik.endsWith('/') ? p.startsWith(plik) : p === plik)
  return plikiNakladki().some(trafia) || wpisyUsun().some((w) => w === plik || (w.endsWith('/') && plik.startsWith(w)))
}

const straznik = wczytajStraznik(KORZEN)
const kontrakt = [
  ...wczytajSloty(KORZEN),
  ...straznik.wyjatki.filter((w) => w.rodzaj === 'usun' || w.rodzaj === 'podmiana').map((w) => w.plik),
]

test('każdy slot i plik usuwany albo podmieniany ma pokrycie w nakładce albo jest na liście zaległych', () => {
  const brak = kontrakt.filter((p) => !pokryty(p) && !ZALEGLE.includes(p))
  assert.deepEqual(brak, [])
})

test('lista zaległych: bez plików już pokrytych i bez plików spoza kontraktu', () => {
  assert.deepEqual(ZALEGLE.filter(pokryty), [])
  assert.deepEqual(ZALEGLE.filter((p) => !kontrakt.includes(p)), [])
})

test('slot po-fazie: web bez kroku, Expo z komendami przebudowy i LANG', () => {
  assert.match(readFileSync(join(KORZEN, '.claude/stack/po-fazie.md'), 'utf8'), /^## Przebudowa\n\nNic do zrobienia\./m)
  const expo = readFileSync(join(STACK, 'nakladka/.claude/stack/po-fazie.md'), 'utf8')
  assert.match(expo, /^## Przebudowa$/m)
  assert.match(expo, /LANG=en_US\.UTF-8 npx expo prebuild --clean --platform ios && LANG=en_US\.UTF-8 npx expo run:ios --no-bundler/)
  assert.match(expo, /npx expo prebuild --clean --platform android && npx expo run:android --no-bundler/)
})

test('wariant Expo się buduje, a settings.json i wersja rdzenia są na miejscu', () => {
  const { katalog, wynik, sprzataj } = przygotujLawke(KORZEN, 'expo')
  try {
    assert.ok(wynik.pliki > 0)
    assert.ok(JSON.parse(readFileSync(join(katalog, '.claude/settings.json'), 'utf8')).hooks)
    assert.match(readFileSync(join(katalog, '.claude/.rdzen-version'), 'utf8'), /^[0-9a-f]{40}(-dirty)?\n$/)
    assert.deepEqual(wynik.podmienione.filter((p) => !existsSync(join(katalog, p))), [])
  } finally {
    sprzataj()
  }
})
