// Pomiar ogrodnika na wszystkich projektach git z ~/Documents/Kodowanie (tylko odczyt; na maszynie bez tego katalogu test
// sie pomija). Lekser testowany tylko na fixture przepuszczal by zle rozbiory realnego kodu (lekcja P13: parser planu 40/40
// na fixture, 6 z 7 IU zgubionych na planach z dysku). Kontrola niezalezna od lekseru: dyrektywy wyciszen liczone prostym
// wzorcem linii musza sie zgadzac z kategoria `wyciszenia` co do pliku i linii.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { wystapienia } from '../kategorie.mjs'
import { plikiProjektu, zmierzProjekt } from '../pomiar.mjs'

const KATALOG = join(homedir(), 'Documents', 'Kodowanie')
const DYREKTYWA_W_LINII = /(?:\/\/|\/\*+)\s*(?:eslint-disable(?:-next-line|-line)?\b|@ts-(?:ignore|expect-error|nocheck)\b|biome-ignore\b|oxlint-disable\b|deno-lint-ignore(?:-file)?\b|eslint\s+[\w@/-]+\s*:\s*["']?(?:0|off)\b)/

/** @returns {string[]} */
function projekty() {
  if (!existsSync(KATALOG)) return []
  return readdirSync(KATALOG, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(KATALOG, d.name, '.git')))
    .map((d) => join(KATALOG, d.name))
}

const lista = projekty()

test('realne projekty: pomiar bez wyjatku na kazdym, liczby nieujemne, nowe w granicach', { skip: !lista.length && 'brak ~/Documents/Kodowanie' }, () => {
  /** @type {string[]} */
  const bledy = []
  for (const projekt of lista) {
    try {
      const p = zmierzProjekt(projekt)
      for (const [k, n] of Object.entries(p.liczby)) if (!(Number.isInteger(n) && n >= 0)) bledy.push(`${projekt}: ${k}=${n}`)
      for (const [k, n] of Object.entries(p.noweLiczby)) if (n > p.liczby[/** @type {keyof typeof p.liczby} */ (k)]) bledy.push(`${projekt}: nowe ${k} > wszystkie`)
    } catch (e) {
      bledy.push(`${projekt}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  assert.deepEqual(bledy, [])
})

test('realne projekty: wyciszenia z lekseru = dyrektywy z prostego wzorca linii (plik:linia)', { skip: !lista.length && 'brak ~/Documents/Kodowanie' }, () => {
  /** @type {string[]} */
  const roznice = []
  let razem = 0
  for (const projekt of lista) {
    for (const plik of plikiProjektu(projekt)) {
      const tekst = readFileSync(join(projekt, plik), 'utf8')
      const zLeksera = wystapienia(tekst, plik).filter((w) => w.kategoria === 'wyciszenia').map((w) => w.linia)
      const zWzorca = tekst.split('\n').flatMap((l, i) => (DYREKTYWA_W_LINII.test(l) ? [i + 1] : []))
      razem += zWzorca.length
      if (JSON.stringify(zLeksera) !== JSON.stringify(zWzorca)) roznice.push(`${projekt}/${plik}: lekser ${zLeksera} / wzorzec ${zWzorca}`)
    }
  }
  assert.ok(razem > 0, 'kontrola bez ani jednej dyrektywy niczego nie sprawdza')
  assert.deepEqual(roznice, [])
})
