// Strona narzedzia makiet (P28): uklad z pilota etapu 5 vibersi sprawdzany na pliku index.html (strona nie ma testow DOM —
// logika czysta lezy w modulach z wlasnymi testami).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const HTML = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'strona', 'index.html'), 'utf8')

/** @param {string} id @returns {number} pozycja elementu o id w pliku (-1 = brak) */
const pozycja = (id) => HTML.indexOf(`id="${id}"`)

test('P28 (3) jeden pasek u góry: nawigacja, status, ekran, decyzje i „Zakończ przegląd” w jednym wierszu', () => {
  const wiersz = HTML.slice(HTML.indexOf('class="pasek-punktu"'), HTML.indexOf('</div>', HTML.indexOf('id="zakoncz"')))
  for (const id of ['poprzedni', 'licznik', 'nastepny', 'status', 'ekran', 'trasa', 'zgodne', 'odstepstwo', 'blad', 'zakoncz']) {
    assert.ok(wiersz.includes(`id="${id}"`), `#${id} w pasku punktu`)
  }
  assert.ok(!/<h1/.test(HTML), 'bez osobnego nagłówka z nazwą narzędzia (nazwa zostaje w <title>)')
  assert.equal(HTML.match(/<header/g)?.length, 1, 'jedna sekcja nagłówka zamiast nagłówka i sekcji punktu')
})

test('P28 (3) uwagi narzędzia (ekrany SPEC bez punktu, ostrzeżenia, plik smoke\'u) zwinięte w <details> pod paskiem', () => {
  const m = /<details id="uwagi"[^>]*>\s*<summary id="uwagi-naglowek"[^>]*>[^<]*<\/summary>([\s\S]*?)<\/details>/.exec(HTML)
  assert.ok(m, 'uwagi w <details> z podsumowaniem')
  assert.ok(m[1].includes('id="uwagi-tresc"') && m[1].includes('id="smoke"'))
  assert.ok(!/<details id="uwagi"[^>]*\sopen/.test(HTML), 'domyślnie zwinięte')
  assert.ok(pozycja('uwagi') > pozycja('zakoncz'))
})

test('P28 (3) treść punktu skrócona do dwóch linii z przełącznikiem „Pokaż całość”', () => {
  assert.match(HTML, /<p id="tresc" class="tresc tresc--zwinieta"/)
  assert.match(HTML, /<button type="button" id="cala-tresc" aria-expanded="false" aria-controls="tresc">Pokaż całość<\/button>/)
})

test('P28 (1) skala ramek: „przewijaj” dopasowuje najszerszą ramkę do kolumny (reszta w rzędzie z przewijaniem), „wszystkie” mieści cały rząd, 1:1 = 1', async () => {
  const { skalaRamek } = await import('../strona/ramki.mjs')
  const u = [{ id: 'a', nazwa: 'a', szerokosc: 1440, wysokosc: 900 }, { id: 'b', nazwa: 'b', szerokosc: 375, wysokosc: 667 }, { id: 'c', nazwa: 'c', szerokosc: 834, wysokosc: 1194 }]
  // kolumna 1000: margines paska 20, najszersza 1440 + 2 obramowania
  assert.equal(skalaRamek(u, 1000, 'przewijaj'), 980 / 1442)
  // caly rzad: 1442 + 377 + 836 + 2 odstepy po 16
  assert.equal(skalaRamek(u, 1000, 'wszystkie'), 980 / (1442 + 377 + 836 + 32))
  assert.equal(skalaRamek(u, 1000, '1:1'), 1)
  assert.equal(skalaRamek([u[1]], 3000, 'przewijaj'), 1, 'najwyżej 1')
  assert.equal(skalaRamek([], 1000, 'przewijaj'), 1)
})

test('P28 (1) rząd ramek bez zawijania, z przewijaniem w poziomie; przełącznik skali z trzema trybami', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'strona', 'styl.css'), 'utf8')
  const ramki = /\.ramki \{([^}]*)\}/.exec(css)?.[1] ?? ''
  assert.match(ramki, /flex-wrap: nowrap/)
  assert.match(ramki, /overflow-x: auto/)
  for (const tryb of ['przewijaj', 'wszystkie', '1:1']) assert.match(HTML, new RegExp(`data-skala="${tryb}"`))
})
