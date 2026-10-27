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
  assert.deepEqual([...opis.matchAll(/<dt>([^<]*)<\/dt>\s*<dd id="([^"]*)"/g)].map((m) => [m[1], m[2]]), [['Jak wejść', 'opis-wejscie'], ['Sprawdź', 'opis-sprawdz'], ['Stany', 'opis-stany'], ['Gdzie', 'opis-co']], 'P27 S3 poz. 28: „Jak wejść” z formatu trzech pól')
  assert.match(HTML, /<div id="opis-wejscie-wiersz" hidden><dt>Jak wejść<\/dt>/)
  const js = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'strona', 'strona.mjs'), 'utf8')
  assert.match(js, /el\('opis-wejscie', HTMLElement\)\.textContent = opis\?\.wejscie \?\? ''/)
  assert.match(js, /el\('opis-wejscie-wiersz', HTMLDivElement\)\.hidden = !opis\?\.wejscie/)
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

/**
 * Ramki bez DOM: iframe z dataset, contentWindow i licznikiem ustawien src; kontener z querySelectorAll.
 * @param {string[]} adresy adres startowy kazdej ramki
 */
function atrapaRamek(adresy) {
  const ramki = adresy.map((adres) => {
    /** @type {string[]} historia ustawien src */
    const historia = []
    return Object.defineProperty({ dataset: /** @type {Record<string, string>} */ ({ adres }), contentWindow: {}, historia }, 'src', {
      set(/** @type {string} */ v) { historia.push(v) },
      get() { return historia.at(-1) ?? '' },
    })
  })
  return { ramki, kontener: /** @type {any} */ ({ querySelectorAll: () => ramki }) }
}

const ORIGIN = 'http://127.0.0.1:5180'

test('P27 S3 poz. 25: „Ramki razem” — nawigacja w ramce A przenosi pozostałe ramki; ramka przeniesiona nie rozsyła dalej (1 przeniesienie na nawigację)', async () => {
  const { adresZRamki } = await import('../strona/ramki.mjs')
  const { ramki: [a, b, c], kontener } = atrapaRamek(['/p/x', '/p/x', '/p/x'])
  const z = (/** @type {{ contentWindow: object }} */ r, /** @type {string} */ adres) => ({ origin: ORIGIN, source: r.contentWindow, data: { makieta: 'adres', adres, rodzaj: 'push' } })
  assert.equal(adresZRamki(kontener, z(a, '/tworca/x'), { origin: ORIGIN, razem: true }), '/tworca/x')
  assert.deepEqual([a.historia, b.historia, c.historia], [[], ['/tworca/x'], ['/tworca/x']])
  // B i C po zaladowaniu zglaszaja ten sam adres — bez kolejnych przeniesien (bez petli).
  assert.equal(adresZRamki(kontener, z(b, '/tworca/x'), { origin: ORIGIN, razem: true }), null)
  assert.equal(adresZRamki(kontener, z(c, '/tworca/x'), { origin: ORIGIN, razem: true }), null)
  assert.deepEqual([a.historia, b.historia, c.historia], [[], ['/tworca/x'], ['/tworca/x']])
  // Tryb niezalezny: ramka zmienia tylko swoj adres.
  assert.equal(adresZRamki(kontener, z(c, '/inna'), { origin: ORIGIN, razem: false }), '/inna')
  assert.deepEqual([a.historia, b.historia, c.historia, c.dataset.adres], [[], ['/tworca/x'], ['/tworca/x'], '/inna'])
})

test('P27 S3 poz. 25: komunikat obcego originu, spoza ramek, innego typu albo z trasą poza aplikacją (//host, /__makieta/) — bez zmian', async () => {
  const { adresZRamki } = await import('../strona/ramki.mjs')
  const { ramki: [a, b], kontener } = atrapaRamek(['/p/x', '/p/x'])
  const opcje = { origin: ORIGIN, razem: true }
  for (const zdarzenie of [
    { origin: 'http://zly.example', source: a.contentWindow, data: { makieta: 'adres', adres: '/y', rodzaj: 'push' } },
    { origin: ORIGIN, source: {}, data: { makieta: 'adres', adres: '/y', rodzaj: 'push' } },
    { origin: ORIGIN, source: a.contentWindow, data: { makieta: 'inne', adres: '/y' } },
    { origin: ORIGIN, source: a.contentWindow, data: '/y' },
    ...['//zly.example/y', '/\\zly.example', '/\t/zly.example', '/__makieta/strona/', 'y', 7].map((adres) => ({ origin: ORIGIN, source: a.contentWindow, data: { makieta: 'adres', adres, rodzaj: 'push' } })),
    { origin: ORIGIN, source: a.contentWindow, data: { makieta: 'adres', adres: '/y', rodzaj: 'inny' } },
  ]) assert.equal(adresZRamki(kontener, zdarzenie, opcje), null, JSON.stringify(zdarzenie.data))
  assert.deepEqual([a.historia, b.historia, a.dataset.adres], [[], [], '/p/x'])
})

test('P27 S3 poz. 25: przełącznik „Ramki razem” w pasku ramek, domyślnie włączony; strona słucha komunikatów ramek', () => {
  const pasek = HTML.slice(HTML.indexOf('id="form-adres"'), HTML.indexOf('class="skala"'))
  assert.match(pasek, /<label[^>]*><input type="checkbox" id="razem" checked> Ramki razem<\/label>/)
  const js = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'strona', 'strona.mjs'), 'utf8')
  assert.match(js, /addEventListener\('message', \(z\) => \{\s*const trasa = adresZRamki\(/)
})

test('P27 S3 poz. 26: „Przeładuj ramki” przeładowuje każdą ramkę na jej bieżącym adresie (nie na trasie punktu); ramka bez adresu — na trasie', async () => {
  const { przeladujRamki } = await import('../strona/ramki.mjs')
  const { ramki: [a, b, c], kontener } = atrapaRamek(['/tworca/x', '/p/x', ''])
  delete c.dataset.adres
  przeladujRamki(kontener, '/p/x')
  assert.deepEqual([a.historia, b.historia, c.historia], [['about:blank', '/tworca/x'], ['about:blank', '/p/x'], ['about:blank', '/p/x']])
})

test('P27 S3 poz. 26: „Wszystkie ramki tutaj” (tryb niezależny) przenosi ramki z innym adresem na adres z paska; ramka już tam — bez przeładowania', async () => {
  const { przeniesRamki } = await import('../strona/ramki.mjs')
  const { ramki: [a, b], kontener } = atrapaRamek(['/tworca/x', '/p/x'])
  przeniesRamki(kontener, '/tworca/x')
  assert.deepEqual([a.historia, b.historia, b.dataset.adres], [[], ['/tworca/x'], '/tworca/x'])
})

test('P27 S3 poz. 26: pasek adresu śledzi adres ramki (bez nadpisywania wpisu operatora w trakcie pisania); „Wszystkie ramki tutaj” widoczne tylko bez „Ramki razem”', () => {
  assert.match(HTML, /<button type="button" id="tutaj" hidden>Wszystkie ramki tutaj<\/button>/)
  const js = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'strona', 'strona.mjs'), 'utf8')
  const nasluch = js.slice(js.indexOf("addEventListener('message'"), js.indexOf("el('przeladuj'"))
  assert.match(nasluch, /const trasa = adresZRamki\(/)
  assert.match(nasluch, /stan\.trasa = trasa/)
  assert.match(nasluch, /document\.activeElement !== pole/)
  assert.match(js, /el\('tutaj', HTMLButtonElement\)\.hidden = [^\n]*checked/)
  assert.match(js, /el\('tutaj', HTMLButtonElement\)\.addEventListener\('click', \(\) => przeniesRamki\(el\('ramki', HTMLDivElement\), stan\.trasa\)\)/)
})

test('P27 S3 poz. 27: kadr zrzutu — zaznaczenie w pikselach podglądu (w dowolną stronę) na piksele obrazu, przycięte do obrazu; zaznaczenie mniejsze niż 8 px = cały obraz', async () => {
  const { kadrZrzutu } = await import('../strona/zrzut.mjs')
  const obraz = { szerokosc: 2000, wysokosc: 1000 }
  assert.deepEqual(kadrZrzutu({ x0: 10, y0: 20, x1: 110, y1: 70 }, 4, obraz), { x: 40, y: 80, szerokosc: 400, wysokosc: 200 })
  assert.deepEqual(kadrZrzutu({ x0: 110, y0: 70, x1: 10, y1: 20 }, 4, obraz), { x: 40, y: 80, szerokosc: 400, wysokosc: 200 }, 'od prawej dolnej')
  assert.deepEqual(kadrZrzutu({ x0: 450, y0: 200, x1: 900, y1: -50 }, 4, obraz), { x: 1800, y: 0, szerokosc: 200, wysokosc: 800 }, 'poza podglądem — do krawędzi obrazu')
  assert.deepEqual(kadrZrzutu({ x0: 10.4, y0: 10.6, x1: 20.6, y1: 30.2 }, 1, obraz), { x: 10, y: 11, szerokosc: 11, wysokosc: 19 })
  assert.deepEqual(kadrZrzutu({ x0: 10, y0: 10, x1: 17, y1: 100 }, 4, obraz), { x: 0, y: 0, szerokosc: 2000, wysokosc: 1000 })
  assert.deepEqual(kadrZrzutu(null, 4, obraz), { x: 0, y: 0, szerokosc: 2000, wysokosc: 1000 })
})

test('P27 S3 poz. 27: formularz „Zgłoś błąd” — zrzut z pliku albo Cmd+V, podgląd z zaznaczeniem, „Usuń zrzut”; zgłoszenie wysyła PNG do api/zrzut przed decyzją', () => {
  const form = /<form id="form-blad"[^>]*>([\s\S]*?)<\/form>/.exec(HTML)?.[1] ?? ''
  assert.match(form, /<label for="zrzut-bledu">[^<]*Cmd\+V[^<]*<\/label>/)
  assert.match(form, /<input type="file" id="zrzut-bledu" accept="image\/\*">/)
  assert.match(form, /<canvas id="podglad-zrzutu" class="podglad-zrzutu" hidden><\/canvas>/)
  assert.match(form, /<button type="button" id="usun-zrzut" hidden>Usuń zrzut<\/button>/)
  const js = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'strona', 'strona.mjs'), 'utf8')
  const wysylka = js.slice(js.indexOf('async function zglosBlad'), js.indexOf('function podepnij()'))
  assert.match(wysylka, /api\(`zrzut\?punkt=\$\{[^}]+\}`, \{ method: 'POST', body: png, headers: \{ 'content-type': 'image\/png' \} \}\)/)
  assert.ok(wysylka.indexOf("api(`zrzut") < wysylka.indexOf("zapisz('blad'"), 'zrzut przed decyzją')
})

test('po recenzji P27 S3 (P2): przekierowanie zależne od szerokości nie zapętla „Ramki razem” — start/replace ramki przeniesionej przez narzędzie w oknie 3 s nie rozsyła dalej', async () => {
  const { adresZRamki, przeniesRamki } = await import('../strona/ramki.mjs')
  const { ramki: [a, b], kontener } = atrapaRamek(['/x', '/x'])
  const z = (/** @type {{ contentWindow: object }} */ r, /** @type {string} */ adres, /** @type {string} */ rodzaj) => ({ origin: ORIGIN, source: r.contentWindow, data: { makieta: 'adres', adres, rodzaj } })
  // Komputer (A) klika: telefon (B) dostaje /d, aplikacja przekierowuje go na /m/d (start nowego dokumentu albo replace routera).
  assert.equal(adresZRamki(kontener, z(a, '/d', 'push'), { origin: ORIGIN, razem: true, teraz: 1000 }), '/d')
  assert.equal(adresZRamki(kontener, z(b, '/m/d', 'start'), { origin: ORIGIN, razem: true, teraz: 1500 }), '/m/d')
  assert.equal(adresZRamki(kontener, z(b, '/m/d?r=1', 'replace'), { origin: ORIGIN, razem: true, teraz: 2000 }), '/m/d?r=1')
  assert.deepEqual([a.historia, b.historia, b.dataset.adres], [[], ['/d'], '/m/d?r=1'], 'A zostaje na /d — bez ping-ponga')
  // Klik operatora w B (push) rozsyła zawsze; po oknie 3 s zwykłe replace też.
  assert.equal(adresZRamki(kontener, z(b, '/m/e', 'push'), { origin: ORIGIN, razem: true, teraz: 2500 }), '/m/e')
  assert.deepEqual(a.historia, ['/m/e'])
  assert.equal(adresZRamki(kontener, z(b, '/m/f', 'replace'), { origin: ORIGIN, razem: true, teraz: 9000 }), '/m/f')
  assert.deepEqual(a.historia, ['/m/e', '/m/f'])
  // Ramka przeniesiona przyciskiem „Wszystkie ramki tutaj” tak samo nie odbija przekierowania.
  przeniesRamki(kontener, '/g', 20_000)
  assert.equal(adresZRamki(kontener, z(a, '/m/g', 'start'), { origin: ORIGIN, razem: true, teraz: 20_500 }), '/m/g')
  assert.deepEqual([a.historia.at(-1), b.historia.at(-1)], ['/g', '/g'])
})

test('po recenzji P27 S3: kadr zrzutu — granica 8 px to zaznaczenie, mała wysokość przy dużej szerokości = cały obraz, zaznaczenie całkiem poza obrazem = cały obraz, zaokrąglenie do najbliższego piksela', async () => {
  const { kadrZrzutu } = await import('../strona/zrzut.mjs')
  const obraz = { szerokosc: 100, wysokosc: 100 }
  assert.deepEqual(kadrZrzutu({ x0: 0, y0: 0, x1: 8, y1: 8 }, 1, obraz), { x: 0, y: 0, szerokosc: 8, wysokosc: 8 })
  assert.deepEqual(kadrZrzutu({ x0: 0, y0: 0, x1: 80, y1: 7 }, 1, obraz), { x: 0, y: 0, szerokosc: 100, wysokosc: 100 })
  assert.deepEqual(kadrZrzutu({ x0: 200, y0: 200, x1: 300, y1: 300 }, 1, obraz), { x: 0, y: 0, szerokosc: 100, wysokosc: 100 })
  assert.deepEqual(kadrZrzutu({ x0: 10.6, y0: 10, x1: 30, y1: 30 }, 1, obraz), { x: 11, y: 10, szerokosc: 19, wysokosc: 20 })
})
