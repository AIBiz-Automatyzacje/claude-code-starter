// Punkty wizualne smoke'u operatora (P24 IU-1). Fixture'y: wycinki prawdziwych smoke'ow vibersi etapu 3 i 4 (odmiany
// viewportu, trasa przed makieta, trasy z placeholderem, dwie makiety w punkcie, kilka adnotacji, sciezki w adnotacjach).

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { ZNACZNIK_BLEDU, ZNACZNIK_ODSTEPSTWA, ZNACZNIK_POPRAWKI, punktyWizualne, rozbierzLinie, sprawdzFormat, statusLinii } from '../punkty.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const fixture = (/** @type {string} */ nazwa) => readFileSync(join(KATALOG, 'fixtures', nazwa), 'utf8')
const skrot = (/** @type {string} */ s) => createHash('sha1').update(s).digest('hex')
const ETAP_4 = fixture('vibersi-etap-4-smoke.md')
const ETAP_3 = fixture('vibersi-etap-3-smoke.md')

/** @param {string} md @param {number} nr @returns {import('../punkty.mjs').Punkt} */
function punktLinii(md, nr) {
  const p = punktyWizualne(md, skrot).find((x) => x.linia === nr)
  assert.ok(p, `brak punktu w linii ${nr}`)
  return p
}

test('trasa przed makietą i (viewport 390×782): ekran, trasa /konto/projekty, viewport, status otwarty', () => {
  const md = '# Smoke\n\n- [ ] Telefon: `/konto/projekty` obok `visual-diff/moje-projekty-telefon-figma.png` (viewport 390×782) → układ zgodny z makietą\n'
  const [p] = punktyWizualne(md, skrot)
  assert.deepEqual({ ...p, id: undefined }, {
    id: undefined, linia: 3, tekst: md.split('\n')[2], checkbox: ' ', adnotacje: [],
    tresc: 'Telefon: `/konto/projekty` obok `visual-diff/moje-projekty-telefon-figma.png` (viewport 390×782) → układ zgodny z makietą',
    status: 'otwarty', ekrany: ['moje-projekty-telefon'], trasa: '/konto/projekty', trasaStartowa: '/konto/projekty',
    viewport: { szerokosc: 390, wysokosc: 782 }, niejednoznaczny: false,
    opis: { co: 'Telefon: /konto/projekty', stany: null, sprawdz: 'układ zgodny z makietą' },
  })
  assert.match(p.id, /^p-[0-9a-f]{8}$/)
})

test('odmiany viewportu: z dwukropkiem, z px, z dopiskiem po średniku i z „x” dają ten sam kształt', () => {
  const linie = [
    '- [ ] A: `visual-diff/a-figma.png` (viewport: 390×844) → ok',
    '- [ ] B: `visual-diff/b-figma.png` (viewport 1440×1041px) → ok',
    '- [ ] C: `visual-diff/c-figma.png` (viewport 1440×1150; zrzutu z aplikacji brak) → ok',
    '- [ ] D: `visual-diff/d-figma.png` (viewport 1440x900) → ok',
  ]
  assert.deepEqual(punktyWizualne(linie.join('\n'), skrot).map((p) => p.viewport), [
    { szerokosc: 390, wysokosc: 844 }, { szerokosc: 1440, wysokosc: 1041 }, { szerokosc: 1440, wysokosc: 1150 }, { szerokosc: 1440, wysokosc: 900 },
  ])
  assert.deepEqual(punktLinii(ETAP_4, 73).viewport, { szerokosc: 1440, wysokosc: 1150 }, 'prawdziwa linia z dopiskiem po średniku')
})

test('dwie makiety bez viewportu: dwa ekrany jednego punktu, viewport null', () => {
  const p = punktLinii(ETAP_4, 95)
  assert.deepEqual(p.ekrany, ['admin-skrzynka-komputer', 'admin-kolejka-telefon'])
  assert.equal(p.viewport, null)
  assert.equal(p.trasa, '/admin/kolejka')
})

test('ścieżki w adnotacjach nie są trasą; `*/api/projekty*` w treści nie jest trasą', () => {
  const p = punktLinii(ETAP_4, 50)
  assert.equal(p.trasa, '/konto/projekty', 'adnotacja ma `/p/smoke-formularz-9-54` przed trasą treści')
  assert.equal(p.adnotacje.length, 2)
  const blad = punktLinii(ETAP_4, 42)
  assert.equal(blad.trasa, null, 'adnotacja z `*/api/projekty*`, treść bez trasy')
  assert.equal(blad.trasaStartowa, '/')
  const wTresci = punktyWizualne('- [ ] Telefon: zablokuj `*/api/projekty*`, potem `rpc/moje_projekty` i `/api/projekty` obok `visual-diff/x-figma.png` → ok', skrot)[0]
  assert.equal(wTresci.trasa, null)
})

test('trasa z placeholderem: trasaStartowa do segmentu przed „<”, pełna trasa do podpowiedzi', () => {
  const p = punktLinii(ETAP_4, 75)
  assert.equal(p.trasa, '/admin/kolejka?projekt=<id>')
  assert.equal(p.trasaStartowa, '/admin/kolejka')
  const edycja = punktLinii(ETAP_4, 53)
  assert.equal(edycja.trasa, '/konto/projekty/<id opublikowanego>/edycja')
  assert.equal(edycja.trasaStartowa, '/konto/projekty')
  const korzen = punktyWizualne('- [ ] A: `/<slug>` obok `visual-diff/a-figma.png` → ok', skrot)[0]
  assert.equal(korzen.trasaStartowa, '/')
})

test('trasa bez „obok”: pierwszy fragment ze „/” przed makietą; adres absolutny nie jest trasą', () => {
  assert.equal(punktLinii(ETAP_3, 32).trasa, '/auth/potwierdz?token_hash=nieistniejacy&type=email')
  assert.deepEqual(punktLinii(ETAP_3, 32).ekrany, ['potwierdzenie-komputer-link-wygasl', 'potwierdzenie-telefon-link-wygasl'])
  assert.equal(punktLinii(ETAP_3, 28).trasa, '/', '`rejestracja-email` nie jest trasą, `/` jest')
  assert.equal(punktLinii(ETAP_3, 99).trasa, null, '`https://vibersi.pl/` to adres, nie trasa')
  assert.equal(punktLinii(ETAP_4, 58).trasa, '/odznaka/jasna.svg')
})

test('pięć statusów z checkboxa i pierwszej adnotacji; przy kilku adnotacjach decyduje najnowsza (pierwsza)', () => {
  const linia = (/** @type {string} */ s) => statusLinii(/** @type {NonNullable<ReturnType<typeof rozbierzLinie>>} */ (rozbierzLinie(s)))
  assert.equal(linia('- [ ] A obok `visual-diff/a-figma.png`'), 'otwarty')
  assert.equal(linia('- [x] *(2026-10-20: zgodne)* A'), 'zgodny')
  assert.equal(linia('- [x] A — ✅ 2026-10-16: zgodne'), 'zgodny', 'stary zapis bez adnotacji na początku')
  assert.equal(linia(`- [x] *(2026-10-20: inny odstęp ${ZNACZNIK_ODSTEPSTWA})* A`), 'odstepstwo')
  assert.equal(linia(`- [ ] *(2026-10-20: ${ZNACZNIK_BLEDU} — iphone-15 393 px: ucięty tytuł)* A`), 'blad')
  assert.equal(linia(`- [ ] *(2026-10-20: ${ZNACZNIK_POPRAWKI} w abc1234, do sprawdzenia)* *(2026-10-20: ${ZNACZNIK_BLEDU} — x)* A`), 'poprawione')
  assert.equal(linia(`- [ ] *(2026-10-20: ${ZNACZNIK_BLEDU} — y)* *(2026-10-20: ${ZNACZNIK_POPRAWKI} w abc, do sprawdzenia)* A`), 'blad')
  assert.equal(linia(`- [x] *(2026-10-21: zgodne)* *(2026-10-20: ${ZNACZNIK_BLEDU} — y)* A`), 'zgodny')
  assert.equal(linia(`- [ ] *(2026-10-20: zgodne)* A`), 'otwarty', 'odznaczony ręcznie = otwarty')
  assert.equal(punktLinii(ETAP_4, 40).status, 'odstepstwo', 'prawdziwa adnotacja „— zatwierdzone)*”')
  assert.equal(punktLinii(ETAP_4, 38).status, 'zgodny', '„— zatwierdzone przez Kacpra” to nie znacznik odstępstwa')
})

test('adnotacja z nawiasami w środku kończy się na „)*” przed spacją', () => {
  const r = rozbierzLinie('- [x] *(2026-10-18: wariant A (bez kółka (ramka)) — zatwierdzone)* Telefon: `visual-diff/a-figma.png`')
  assert.deepEqual(r, { checkbox: 'x', adnotacje: ['2026-10-18: wariant A (bez kółka (ramka)) — zatwierdzone'], tresc: 'Telefon: `visual-diff/a-figma.png`' })
  assert.deepEqual(rozbierzLinie('- [ ] *(2026-10-18: wzorzec `(a)*b` zablokowany)* T')?.adnotacje, ['2026-10-18: wzorzec `(a)*b` zablokowany'], '„)*” przed znakiem innym niż spacja nie zamyka')
  assert.equal(rozbierzLinie('  - [ ] wcięty'), null, 'checkbox tylko w kolumnie 0')
  assert.equal(rozbierzLinie('Zwykły akapit'), null)
})

test('identyfikator nie zmienia się po dopisaniu adnotacji; dwie linie z tą samą treścią są niejednoznaczne', () => {
  const tresc = 'Telefon: `/` obok `visual-diff/a-figma.png` (viewport 390×844) → ok'
  const [przed] = punktyWizualne(`- [ ] ${tresc}`, skrot)
  const [po] = punktyWizualne(`- [x] *(2026-10-20: zgodne)* ${tresc}`, skrot)
  assert.equal(przed.id, po.id)
  assert.equal(przed.id, `p-${skrot(tresc).slice(0, 8)}`)
  const dwa = punktyWizualne(`- [ ] ${tresc}\n- [x] *(2026-10-20: zgodne)* ${tresc}\n- [ ] inny obok \`visual-diff/b-figma.png\``, skrot)
  assert.deepEqual(dwa.map((p) => p.niejednoznaczny), [true, true, false])
})

test('fixture etapu 4: liczba punktów = liczba linii checkboxów z -figma.png; poza checkboxami i wcięciami nic', () => {
  const linie = ETAP_4.split('\n').filter((l) => /^- \[[ xX]\] /.test(l) && /-figma\.png/.test(l))
  const punkty = punktyWizualne(ETAP_4, skrot)
  assert.equal(punkty.length, linie.length)
  assert.equal(punkty.length, 24)
  assert.equal(punktyWizualne(ETAP_3, skrot).length, 21)
  assert.equal(new Set(punkty.map((p) => p.id)).size, 24, 'identyfikatory różne')
  assert.ok(punkty.every((p) => p.ekrany.length > 0))
})

test('punkt fizycznego urządzenia nie jest punktem narzędzia; CRLF nie trafia do treści', () => {
  const md = '- [ ] **[fizyczne urządzenie]** Telefon: porównaj z `visual-diff/a-figma.png` → ok\r\n- [ ] Telefon: `/` obok `visual-diff/b-figma.png` (viewport 390×844) → ok\r\n'
  const punkty = punktyWizualne(md, skrot)
  assert.deepEqual(punkty.map((p) => p.ekrany), [['b']])
  assert.equal(punkty[0].tekst.endsWith('\r'), false)
  assert.equal(punkty[0].linia, 2)
})

test('sprawdzFormat: punkt z dwiema makietami, stary zapis „obok -actual.png” i brak viewportu z numerem linii; format R11 = brak uwag', () => {
  const problemy = sprawdzFormat(ETAP_4)
  assert.ok(problemy.some((p) => p.linia === 95 && /dwie makiety|kilka makiet/.test(p.powod)), JSON.stringify(problemy.filter((p) => p.linia === 95)))
  assert.ok(problemy.some((p) => p.linia === 38 && /obok/.test(p.powod)), 'makieta obok zrzutu, nie aplikacji')
  const r11 = [
    '- [ ] Telefon: `/konto/projekty` obok `visual-diff/moje-projekty-telefon-figma.png` (viewport 390×782) → układ zgodny z makietą',
    '- [ ] Komputer, okno odznaki: przy opublikowanym obok `visual-diff/odznaka-okno-figma.png` (viewport 520×518) → okno zgodne z makietą',
    '- [ ] Zwykły punkt bez makiety',
  ].join('\n')
  assert.deepEqual(sprawdzFormat(r11), [])
  const bez = sprawdzFormat('- [ ] Telefon: `/` obok `visual-diff/a-figma.png` → ok\n- [ ] T: `/` obok `visual-diff/b-figma.png` (viewport: 390×844) → ok\n- [ ] T: `/` obok `visual-diff/c-figma.png` (viewport 390×844)')
  assert.deepEqual(bez.map((p) => p.linia), [1, 2, 3])
  const dubel = sprawdzFormat('- [ ] T: `/` obok `visual-diff/a-figma.png` (viewport 390×844) → ok\n- [x] T: `/` obok `visual-diff/a-figma.png` (viewport 390×844) → ok')
  assert.deepEqual(dubel.map((p) => [p.linia, /kilka razy/.test(p.powod)]), [[1, true], [2, true]])
  assert.deepEqual(sprawdzFormat('- [ ] *(2026-10-20: porównaj z `visual-diff/a-figma.png`)* Zwykły punkt'), [], 'makieta tylko w adnotacji')
  const nieobok = sprawdzFormat('- [ ] T: `/` nieobok `visual-diff/a-figma.png` (viewport 390×844) → ok')
  assert.deepEqual(nieobok.map((p) => p.linia), [1], '„obok” jako osobne słowo')
  assert.deepEqual(sprawdzFormat('```\n- [ ] T: `/` obok `visual-diff/a-figma.png` → ok\n```\n'), [], 'blok kodu')
  const bezEkranu = sprawdzFormat('- [ ] Telefon: `/` obok `makieta-figma.png` (viewport 390×844) → ok')
  assert.deepEqual(bezEkranu.map((p) => p.linia), [1])
})

test('po recenzji: „obok” w opisie stanu nie zabiera trasy; viewport R11 przed luźnym; hash przy placeholderze', () => {
  const [p] = punktyWizualne('- [ ] Komputer, lista obok podglądu: `/admin/kolejka` obok `visual-diff/a-figma.png` (viewport 1440×900) → ok', skrot)
  assert.equal(p.trasa, '/admin/kolejka')
  const [v] = punktyWizualne('- [ ] T: wariant (viewport: 800×600) i `/` obok `visual-diff/a-figma.png` (viewport 390×844) → ok', skrot)
  assert.deepEqual(v.viewport, { szerokosc: 390, wysokosc: 844 })
  const [w] = punktyWizualne('- [ ] T: `/` obok `visual-diff/a-figma.png` (Viewport 390×844) → ok', skrot)
  assert.deepEqual(w.viewport, { szerokosc: 390, wysokosc: 844 }, 'wielkość liter słowa viewport')
  assert.equal(punktyWizualne('- [ ] T: `/a#<x>` obok `visual-diff/a-figma.png` → ok', skrot)[0].trasaStartowa, '/a')
})

test('po recenzji: trasy spoza aplikacji, ten sam ekran dwa razy, makieta bez visual-diff/, blok kodu', () => {
  const trasa = (/** @type {string} */ t) => punktyWizualne(`- [ ] T: ${t} obok \`visual-diff/a-figma.png\` → ok`, skrot)[0].trasa
  assert.equal(trasa('`//cdn.x/a`'), null)
  assert.equal(trasa('`/\\example.com`'), null, 'ukośnik wsteczny = adres obcy w przeglądarce')
  assert.equal(trasa('zablokuj `/odznaka/*.svg`'), null)
  assert.equal(trasa('`rpc/moje_projekty` i `/konto`'), '/konto')
  const [p] = punktyWizualne('- [ ] T: `/` obok `visual-diff/a-figma.png` (viewport 390×844) → jak `visual-diff/a-figma.png`', skrot)
  assert.deepEqual(p.ekrany, ['a'])
  assert.deepEqual(sprawdzFormat('- [ ] T: `/` obok `visual-diff/a-figma.png` (viewport 390×844) → jak `visual-diff/a-figma.png`'), [])
  assert.deepEqual(punktyWizualne('- [ ] T: `/` obok `makieta-figma.png` → ok', skrot), [])
  assert.deepEqual(punktyWizualne('```\n- [ ] T: `/` obok `visual-diff/a-figma.png` → ok\n```\n- [ ] U obok `visual-diff/b-figma.png`', skrot).map((x) => x.linia), [4])
})

test('po recenzji: rozbiór — [X], CRLF, dwie spacje po checkboxie, niezamknięta adnotacja; statusy tylko z początku adnotacji', () => {
  assert.equal(rozbierzLinie('- [X] A')?.checkbox, 'x')
  assert.equal(rozbierzLinie('- [ ] *(2026-10-20: zgodne)* T\r')?.tresc, 'T')
  assert.deepEqual(rozbierzLinie('- [x]  *(2026-10-20: zgodne)* T'), { checkbox: 'x', adnotacje: ['2026-10-20: zgodne'], tresc: 'T' })
  assert.equal(rozbierzLinie('- [ ] *(niezamknięta T')?.tresc, '*(niezamknięta T')
  const status = (/** @type {string} */ s) => statusLinii(/** @type {NonNullable<ReturnType<typeof rozbierzLinie>>} */ (rozbierzLinie(s)))
  assert.equal(status(`- [ ] *(2026-10-20, druga sesja: ${ZNACZNIK_BLEDU} — x)* T`), 'blad')
  assert.equal(status(`- [ ] *(2026-10-20: zgodne, wcześniej ${ZNACZNIK_BLEDU})* T`), 'otwarty')
  assert.equal(status(`- [ ] *(2026-10-20: zgodne, ${ZNACZNIK_POPRAWKI} w abc)* T`), 'otwarty')
  assert.equal(status(`- [ ] *(2026-10-20: ${ZNACZNIK_BLEDU} — nie ${ZNACZNIK_POPRAWKI} w x)* T`), 'blad')
})

test('P28 (7) wymiar z dopiskiem po średniku w tym samym nawiasie (smoke etapu 5 vibersi, linie 93 i 102) to poprawny zapis R11', () => {
  const linia = '- [ ] Komputer: `/tworca/<slug>` obok `visual-diff/profil-tworcy-komputer-figma.png` i `visual-diff/profil-tworcy-komputer-actual.png` (viewport 1440×1153; zrzut aplikacji z konta e2e bez opisu) → karta zgodna'
  assert.deepEqual(sprawdzFormat(linia), [])
  assert.deepEqual(punktyWizualne(linia, skrot)[0].viewport, { szerokosc: 1440, wysokosc: 1153 })
  assert.deepEqual(sprawdzFormat(linia.replace('1440×1153;', '1440×1153 px;')).map((p) => p.powod), ['brak „(viewport <W>×<H>)” bez dwukropka i sufiksu'], 'sufiks px nadal poza formatem')
  assert.equal(sprawdzFormat(linia.replace('1440×1153; ', '1440×1153;')).length, 1, 'dopisek po średniku ze spacją')
})

test('P28 opis punktu dla człowieka: co (urządzenie i miejsce), stany (warianty po wymiarze), sprawdź (po →) — bez ścieżek plików', () => {
  const opis = (/** @type {string} */ t) => punktyWizualne(`- [ ] ${t}`, skrot)[0].opis
  assert.deepEqual(opis('Komputer: sekcja komentarzy obok `visual-diff/k-figma.png` i `visual-diff/k-actual.png` (viewport 860×621) → lista, wątki i pole zgodne z makietą'),
    { co: 'Komputer: sekcja komentarzy', stany: null, sprawdz: 'lista, wątki i pole zgodne z makietą' })
  assert.deepEqual(opis('Stany zgłoszenia obok `visual-diff/z-figma.png` (viewport 1600×290): wysyłka (Slow 3G), błąd (zablokowane `*/api/zgloszenia*`) → każdy stan zgodny z makietą'),
    { co: 'Stany zgłoszenia', stany: 'wysyłka (Slow 3G), błąd (zablokowane */api/zgloszenia*)', sprawdz: 'każdy stan zgodny z makietą' })
  assert.deepEqual(opis('Komputer, krok 2: obok `visual-diff/z2-figma.png` (viewport 1440×900; zrzut z e2e) → zgodne z makietą'),
    { co: 'Komputer, krok 2', stany: null, sprawdz: 'zgodne z makietą' })
  assert.deepEqual(opis('Telefon: `/tworca/<slug>` obok `visual-diff/p-figma.png` (viewport 390×844) → karta zgodna'),
    { co: 'Telefon: /tworca/<slug>', stany: null, sprawdz: 'karta zgodna' })
  assert.equal(opis('Ekran obok `visual-diff/e-figma.png` bez wymiaru i strzałki'), null, 'zapis spoza formatu — strona pokazuje całą linię')
})

const TRZY_POLA = 'Telefon: `/p/kawiarnia-u-ani` obok `visual-diff/projekt-telefon-figma.png` (viewport 390×844) → Wejście: z `/odkrywaj` kliknij kartę „Kawiarnia u Ani”. Porównaj: nagłówek z awatarem, trzy karty zrzutów w rzędzie, przycisk „Odwiedź” pod opisem. Stany: ładowanie — panel „Sieć”, Slow 3G; błąd — zablokuj `*/api/projekty*`.'

test('P27 S3 poz. 28: punkt w formacie trzech pól — jak wejść, co porównać, stany i jak je wywołać — daje opis z polem wejscie', () => {
  const opis = (/** @type {string} */ t) => punktyWizualne(`- [ ] ${t}`, skrot)[0].opis
  assert.deepEqual(opis(TRZY_POLA), {
    co: 'Telefon: /p/kawiarnia-u-ani',
    wejscie: 'z /odkrywaj kliknij kartę „Kawiarnia u Ani”',
    sprawdz: 'nagłówek z awatarem, trzy karty zrzutów w rzędzie, przycisk „Odwiedź” pod opisem',
    stany: 'ładowanie — panel „Sieć”, Slow 3G; błąd — zablokuj */api/projekty*',
  })
  assert.deepEqual(opis(TRZY_POLA.replace(/ Stany: .*$/, ' Stany: brak (ekran bez stanów)'))?.stany, 'brak (ekran bez stanów)')
  assert.equal(punktyWizualne(`- [ ] ${TRZY_POLA}`, skrot)[0].trasa, '/p/kawiarnia-u-ani', 'trasa i ekran jak w R11')
})

test('P27 S3 poz. 28: kontrola formatu — z --pola punkt bez trzech pól (stary R11) to problem; niepełne pola zawsze; stare smoke\'i bez --pola bez nowych uwag', () => {
  const r11 = '- [ ] Telefon: `/konto/projekty` obok `visual-diff/moje-projekty-telefon-figma.png` (viewport 390×782) → układ zgodny z makietą'
  assert.deepEqual(sprawdzFormat(`- [ ] ${TRZY_POLA}`, { pola: true }), [])
  assert.deepEqual(sprawdzFormat(r11), [])
  assert.deepEqual(sprawdzFormat(r11, { pola: true }).map((p) => p.powod), ['po „→” brak pól „Wejście: … Porównaj: … Stany: …”'])
  for (const [zly, brak] of [[TRZY_POLA.replace(/ Stany: .*$/, ''), 'Stany'], [TRZY_POLA.replace(/ Porównaj: [^.]*\./, ''), 'Porównaj']]) {
    assert.deepEqual(sprawdzFormat(`- [ ] ${zly}`).map((p) => p.powod), [`po „→” brak pola „${brak}:” (format: Wejście: … Porównaj: … Stany: …)`], brak)
  }
  for (const f of ['vibersi-etap-3-smoke.md', 'vibersi-etap-4-smoke.md']) {
    const md = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', f), 'utf8')
    assert.ok(!sprawdzFormat(md).some((p) => /Wejście|Porównaj|Stany/.test(p.powod)), f)
  }
})

test('po recenzji P27 S3: stary R11 ze słowem „Stany:” po „→” bez --pola bez uwag; zapis ASCII (Wejscie/Porownaj) czytany jak polski; pola w złej kolejności i tekst przed „Wejście:” = uwaga', () => {
  const r11 = '- [ ] Komputer: `/a` obok `visual-diff/a-figma.png` (viewport 1440×900) → Stany: ładowanie i błąd jak w makiecie'
  assert.deepEqual(sprawdzFormat(r11), [])
  assert.deepEqual(sprawdzFormat(r11, { pola: true }).map((p) => p.powod), ['po „→” brak pól „Wejście: … Porównaj: … Stany: …”'])
  const ascii = `- [ ] ${TRZY_POLA.replace('Wejście:', 'Wejscie:').replace('Porównaj:', 'Porownaj:')}`
  assert.deepEqual(sprawdzFormat(ascii, { pola: true }), [])
  assert.equal(punktyWizualne(ascii, skrot)[0].opis?.wejscie, 'z /odkrywaj kliknij kartę „Kawiarnia u Ani”')
  const kolejnosc = '- [ ] T: `/a` obok `visual-diff/a-figma.png` (viewport 390×844) → Porównaj: nagłówek. Wejście: z `/`. Stany: brak'
  assert.deepEqual(sprawdzFormat(kolejnosc, { pola: true }).map((p) => p.powod), ['pola po „→” w kolejności: Wejście:, Porównaj:, Stany:'])
  const przed = '- [ ] T: `/a` obok `visual-diff/a-figma.png` (viewport 390×844) → zgodne. Wejście: z `/`. Porównaj: nagłówek. Stany: brak'
  assert.deepEqual(sprawdzFormat(przed).map((p) => p.powod), ['pola po „→” w kolejności: Wejście:, Porównaj:, Stany:'])
  assert.deepEqual(sprawdzFormat(`- [ ] ${TRZY_POLA.replace(/\.\s*Porównaj:/, ';Porównaj:')}`), ['pola po „→” w kolejności: Wejście:, Porównaj:, Stany:'].map((powod) => ({ linia: 1, powod })), 'Porównaj: bez spacji przed')
})
