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

test('P28 (3) opis punktu dla człowieka: Sprawdź, Stany, Gdzie; pełna linia checklisty ukryta pod „Pokaż całą linię”', () => {
  const opis = /<dl id="opis"[^>]*>([\s\S]*?)<\/dl>/.exec(HTML)?.[1] ?? ''
  assert.deepEqual([...opis.matchAll(/<dt>([^<]*)<\/dt>\s*<dd id="([^"]*)"/g)].map((m) => [m[1], m[2]]), [['Sprawdź', 'opis-sprawdz'], ['Stany', 'opis-stany'], ['Gdzie', 'opis-co']])
  assert.match(HTML, /<button type="button" id="cala-tresc" aria-expanded="false" aria-controls="tresc">Pokaż całą linię<\/button>/)
  assert.match(HTML, /<p id="tresc" class="tresc" hidden><\/p>/)
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

test('P28 (2) rozdzielacz: udział aplikacji z pozycji wskaźnika w granicach 20–80 %, strzałki ±5, Home/End do granic', async () => {
  const { udzialZPozycji, udzialPoKlawiszu, MIN_UDZIAL, MAX_UDZIAL } = await import('../strona/uklad.mjs')
  assert.deepEqual([MIN_UDZIAL, MAX_UDZIAL], [20, 80])
  assert.equal(udzialZPozycji(600, { left: 100, width: 1000 }), 50)
  assert.equal(udzialZPozycji(433.3, { left: 100, width: 1000 }), 33, 'zaokrąglenie do całego procentu')
  assert.equal(udzialZPozycji(120, { left: 100, width: 1000 }), 20)
  assert.equal(udzialZPozycji(5000, { left: 100, width: 1000 }), 80)
  assert.equal(udzialZPozycji(500, { left: 0, width: 0 }), null, 'zerowa szerokość — bez zmiany')
  assert.equal(udzialPoKlawiszu(50, 'ArrowLeft'), 45)
  assert.equal(udzialPoKlawiszu(78, 'ArrowRight'), 80)
  assert.equal(udzialPoKlawiszu(80, 'Home'), 20)
  assert.equal(udzialPoKlawiszu(50, 'End'), 80)
  assert.equal(udzialPoKlawiszu(50, 'a'), null)
})

test('P28 (2) rozdzielacz stoi między aplikacją a makietą jako separator dostępny z klawiatury; makieta bez sztywnego limitu 55vw', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'strona', 'styl.css'), 'utf8')
  const sep = /<div id="rozdzielacz"[^>]*>/.exec(HTML)?.[0] ?? ''
  for (const atrybut of ['role="separator"', 'aria-orientation="vertical"', 'tabindex="0"', 'aria-valuemin="20"', 'aria-valuemax="80"']) assert.ok(sep.includes(atrybut), atrybut)
  assert.ok(HTML.indexOf('class="aplikacja"') < pozycja('rozdzielacz') && pozycja('rozdzielacz') < HTML.indexOf('class="makieta"'))
  assert.ok(!css.includes('55vw'))
  assert.match(css, /grid-template-columns: minmax\(0, var\(--udzial-aplikacji/)
})

test('P28 (5) panel „Sieć”: profile opóźnienia, blokady po jednej w linii, opis stanu w nagłówku panelu', async () => {
  const { PROFILE_SIECI, ustawieniaZFormularza, opisSieci } = await import('../strona/panel-sieci.mjs')
  assert.deepEqual(PROFILE_SIECI.map((p) => [p.nazwa, p.opoznienieMs]), [['Bez ograniczeń', 0], ['Fast 3G', 560], ['Slow 3G', 2000]])
  assert.deepEqual(ustawieniaZFormularza('2000', ' */api/komentarze* \n\n/api/glosy\n'), { opoznienieMs: 2000, blokady: ['*/api/komentarze*', '/api/glosy'] })
  assert.deepEqual(ustawieniaZFormularza('abc', ''), { opoznienieMs: 0, blokady: [] })
  assert.deepEqual(ustawieniaZFormularza('-5', ''), { opoznienieMs: 0, blokady: [] })
  assert.equal(opisSieci({ opoznienieMs: 0, blokady: [] }), 'Sieć')
  assert.equal(opisSieci({ opoznienieMs: 2000, blokady: ['a'] }), 'Sieć: Slow 3G · 1 blokada')
  assert.equal(opisSieci({ opoznienieMs: 0, blokady: ['a', 'b'] }), 'Sieć: 2 blokady')
  assert.equal(opisSieci({ opoznienieMs: 300, blokady: Array(5).fill('x') }), 'Sieć: +300 ms · 5 blokad')
  for (const id of ['siec', 'opoznienie', 'blokady', 'siec-stan']) assert.ok(pozycja(id) > HTML.indexOf('class="aplikacja"'), `#${id} w kolumnie aplikacji`)
})

test('P28 (6) podpowiedź przy ramkach: dostawca OAuth przez „Otwórz w karcie” i „Przeładuj ramki”', () => {
  const m = /<p id="podpowiedz-logowania"[^>]*>([^<]*)<\/p>/.exec(HTML)
  assert.ok(m)
  assert.match(m[1], /„Otwórz w karcie”.*„Przeładuj ramki”/)
  assert.ok(pozycja('podpowiedz-logowania') > pozycja('w-karcie') && pozycja('podpowiedz-logowania') < pozycja('ramki'))
})

test('P28 po pilocie: liczebnik z odmianą (1 zgłoszenie, 2 zgłoszenia, 5 zgłoszeń, 12 zgłoszeń, 22 zgłoszenia)', async () => {
  const { liczebnik } = await import('../strona/teksty.mjs')
  const formy = /** @type {const} */ (['zgłoszenie', 'zgłoszenia', 'zgłoszeń'])
  assert.deepEqual([0, 1, 2, 4, 5, 12, 13, 14, 21, 22, 24, 25, 112].map((n) => liczebnik(n, formy)).join(', '),
    '0 zgłoszeń, 1 zgłoszenie, 2 zgłoszenia, 4 zgłoszenia, 5 zgłoszeń, 12 zgłoszeń, 13 zgłoszeń, 14 zgłoszeń, 21 zgłoszeń, 22 zgłoszenia, 24 zgłoszenia, 25 zgłoszeń, 112 zgłoszeń')
})

test('P28 po pilocie: strzałki na rozdzielaczu nie zmieniają ekranu (globalny skrót ← → pomija separator)', () => {
  const js = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'strona', 'strona.mjs'), 'utf8')
  const skrot = js.slice(js.indexOf("document.addEventListener('keydown'"), js.indexOf("if (z.key === 'ArrowLeft')"))
  assert.match(skrot, /role="separator"|getAttribute\('role'\) === 'separator'/)
})
