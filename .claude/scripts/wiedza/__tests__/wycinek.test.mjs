// Wycinek wiedzy dla buildera i reviewera (PLAN-POPRAWY P10): reguly, ktorych globy pasuja do plikow IU / fazy,
// plus koszyk „zawsze”, w limicie znakow — zamiast calego pliku learned-patterns w kazdym agencie.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { MAKS_WYCINEK_ZN, wycinek } from '../wycinek.mjs'

/** @param {string} plik @param {Record<string, string | string[]>} zmiany */
function wpis(plik, zmiany) {
  return {
    plik,
    pola: {
      klasa: 'sciezka-bledu', regula: `Regula ${plik}.`, paths: ['src/lib/**'], waga: 'srednia', szczebel: 'regula',
      szczebel_powod: 'x', date: '2026-09-01', zrodlo: 'PR 1', ucieczki: '0', ...zmiany,
    },
  }
}

const WPISY = [
  wpis('docs/solutions/a/lib.md', { paths: ['src/lib/**'] }),
  wpis('docs/solutions/a/ui.md', { paths: ['src/components/**/*.tsx'], waga: 'wysoka' }),
  wpis('docs/solutions/a/sql.md', { paths: ['supabase/migrations/**'] }),
  wpis('docs/solutions/a/zawsze.md', { paths: ['**'], waga: 'niska' }),
  wpis('docs/solutions/a/lint.md', { paths: ['src/lib/**'], szczebel: 'lint', bramka: 'eslint.config.js no-restricted-syntax' }),
  wpis('docs/solutions/a/kod.md', { paths: ['src/lib/**'], szczebel: 'kod' }),
]

test('wycinek: reguly z globami pasujacymi do plikow (takze nowych, jeszcze nieistniejacych) + koszyk „zawsze”; kod/lint z wdrozona bramka poza wycinkiem', () => {
  const w = wycinek(WPISY, ['src/lib/nowy-modul.ts', 'src/components/oferta/Karta.tsx'])
  assert.deepEqual(w.pliki, ['docs/solutions/a/zawsze.md', 'docs/solutions/a/ui.md', 'docs/solutions/a/lib.md', 'docs/solutions/a/kod.md'])
  assert.match(w.tresc, /^- \[niska\] sciezka-bledu: Regula docs\/solutions\/a\/zawsze\.md\. \(docs\/solutions\/a\/zawsze\.md\)$/m)
  assert.doesNotMatch(w.tresc, /sql\.md|lint\.md/)
  assert.equal(w.zn, w.tresc.length)
})

test('wycinek --bez-zawsze: tylko reguly dopasowane do plikow — /dev-plan sprawdza, czy obszar ma wpisy w wiedzy projektu', () => {
  assert.deepEqual(wycinek(WPISY, ['src/zupelnie-nowy/a.ts'], MAKS_WYCINEK_ZN, { bezZawsze: true }).tresc, '')
  assert.deepEqual(wycinek(WPISY, ['src/zupelnie-nowy/a.ts']).pliki, ['docs/solutions/a/zawsze.md'], 'bez opcji koszyk zawsze dochodzi')
  assert.deepEqual(wycinek(WPISY, ['src/lib/a.ts'], MAKS_WYCINEK_ZN, { bezZawsze: true }).pliki, ['docs/solutions/a/lib.md', 'docs/solutions/a/kod.md'])
})

test('wycinek: brak pasujacych regul i brak koszyka = pusty wycinek', () => {
  const w = wycinek(WPISY.filter((x) => x.plik !== 'docs/solutions/a/zawsze.md'), ['README.md'])
  assert.deepEqual({ tresc: w.tresc, wpisy: w.wpisy, pominiete: w.pominiete }, { tresc: '', wpisy: 0, pominiete: 0 })
})

test('wycinek: limit znakow — reguly ponad limit pominiete z odeslaniem do indeksu, tresc w limicie', () => {
  // linia wycinka niesie regule skrocona (E5-15(b)) — 40 linii po ~180 zn przekracza limit
  const duzo = Array.from({ length: 40 }, (_, i) => wpis(`docs/solutions/b/${i}.md`, { regula: `Regula dluga ${i}.`, regula_krotka: `${'x'.repeat(140)} ${i}.` }))
  const w = wycinek(duzo, ['src/lib/a.ts'])
  assert.ok(w.zn <= MAKS_WYCINEK_ZN, `${w.zn}`)
  assert.ok(w.pominiete > 0)
  assert.equal(w.wpisy + w.pominiete, 40)
  assert.match(w.tresc, new RegExp(`\\+${w.pominiete} regul poza limitem wycinka — pelna lista: docs/learned-patterns\\.md$`))
})

test('wycinek: duplikat reguly (ta sama klasa i tresc) nie zajmuje limitu — zostaje nowszy', () => {
  const w = wycinek([
    wpis('docs/solutions/a/stary.md', { regula: 'Waliduj wejscie.', date: '2026-08-01' }),
    wpis('docs/solutions/a/nowy.md', { regula: 'Waliduj wejscie.', date: '2026-09-01' }),
  ], ['src/lib/a.ts'])
  assert.deepEqual(w.pliki, ['docs/solutions/a/nowy.md'])
})

// E5-15(a) (vibersi etap 5): przy rownej wadze i ucieczkach decydowal alfabet klasy (`cykl-zycia-ui` przed `sciezka-bledu`).
// Teraz przed alfabetem: wezszy glob z tych, ktore pasuja do plikow — regula z katalogu modulu wygrywa z regula calego `src/`.
test('wycinek: przy rownej wadze i ucieczkach wezszy pasujacy glob przed alfabetem klasy; ucieczki nadal przed globem', () => {
  const szeroki = wpis('docs/solutions/c/szeroki.md', { klasa: 'cykl-zycia-ui', paths: ['src/**'] })
  const waski = wpis('docs/solutions/c/waski.md', { klasa: 'sciezka-bledu', paths: ['src/components/komentarze/**'] })
  // waski glob, ale niepasujacy do plikow, nie podnosi wpisu
  const obok = wpis('docs/solutions/c/obok.md', { klasa: 'duplikacja', paths: ['src/**', 'server/trasy/komentarze.ts'] })
  const pliki = ['src/components/komentarze/pole.tsx']
  assert.deepEqual(wycinek([szeroki, obok, waski], pliki).pliki, ['docs/solutions/c/waski.md', 'docs/solutions/c/szeroki.md', 'docs/solutions/c/obok.md'])
  const zUcieczkami = wpis('docs/solutions/c/ucieczki.md', { klasa: 'tekst-ui', paths: ['src/**'], ucieczki: '2' })
  assert.deepEqual(wycinek([waski, zUcieczkami], pliki).pliki, ['docs/solutions/c/ucieczki.md', 'docs/solutions/c/waski.md'])
  // plik dokladny wezszy niz katalog
  const dokladny = wpis('docs/solutions/c/dokladny.md', { klasa: 'wartosc-graniczna', paths: ['src/components/komentarze/pole.tsx'] })
  assert.deepEqual(wycinek([waski, dokladny], pliki).pliki, ['docs/solutions/c/dokladny.md', 'docs/solutions/c/waski.md'])
})

// E5-15(b): linia = waga, klasa, regula skrocona i link do solution; pelnej reguly w wycinku nie ma.
test('wycinek: linia z regula_krotka zamiast pelnej reguly; bez pola — pierwsze zdanie reguly albo ciecie do 160 zn z „…”', () => {
  const pelna = `Pierwsze zdanie reguly. ${'Drugie zdanie dlugie '.repeat(10)}koniec.`
  const zKrotka = wpis('docs/solutions/d/krotka.md', { regula: pelna, regula_krotka: 'Krotko: blad zapisu widoczny w kazdej galezi.' })
  assert.equal(wycinek([zKrotka], ['src/lib/a.ts']).tresc, '- [srednia] sciezka-bledu: Krotko: blad zapisu widoczny w kazdej galezi. (docs/solutions/d/krotka.md)')
  const bezKrotkiej = wpis('docs/solutions/d/zdanie.md', { regula: pelna })
  assert.equal(wycinek([bezKrotkiej], ['src/lib/a.ts']).tresc, '- [srednia] sciezka-bledu: Pierwsze zdanie reguly. (docs/solutions/d/zdanie.md)')
  const jednoDlugie = wpis('docs/solutions/d/dlugie.md', { regula: `${'slowo '.repeat(60)}koniec.` })
  const linia = wycinek([jednoDlugie], ['src/lib/a.ts']).tresc
  const skrot = /sciezka-bledu: (.*) \(docs/.exec(linia)?.[1] ?? ''
  assert.equal(skrot.length, 160)
  assert.ok(skrot.endsWith('…'), skrot)
})

// E5-15(c): limit ~5000 zn. Fixture: baza wiedzy vibersi na starcie etapu 5 (19 wpisow, reguly 200–365 zn) i pliki IU-10/14/19/23
// z planu etapu; przy limicie 2000 i pelnych regulach kazda z tych IU dostawala 4 reguly (11 pominietych), bez `sciezka-bledu`
// i `cykl-zycia-ui` — a bot na PR #10 znalazl potem bledy obu klas w tych plikach.
test('wycinek (vibersi etap 5): IU-10/14/19/23 dostaja sciezka-bledu i cykl-zycia-ui, bez pominietych, w limicie', () => {
  const fixture = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/wiedza-vibersi-etap5.json'), 'utf8'))
  assert.equal(MAKS_WYCINEK_ZN, 5000)
  for (const [iu, pliki] of Object.entries(fixture.iu)) {
    const w = wycinek(fixture.wpisy, pliki)
    const klasy = w.pliki.map((p) => fixture.wpisy.find((/** @type {{ plik: string }} */ x) => x.plik === p).pola.klasa)
    assert.ok(klasy.includes('sciezka-bledu') && klasy.includes('cykl-zycia-ui'), `${iu}: ${klasy.join(', ')}`)
    assert.equal(w.pominiete, 0, iu)
    assert.ok(w.zn <= MAKS_WYCINEK_ZN, `${iu}: ${w.zn}`)
  }
})

// Recenzja S2 (P3): przypadki brzegowe precyzji globu i jednej linii reguly krotkiej.
test('wycinek: plik dokladny przed katalogiem tej samej glebokosci; {a,b} i ? to wieloznaczniki; liczy sie najwezszy pasujacy glob', () => {
  const pliki = ['src/a/b.ts']
  const plik = wpis('docs/solutions/e/plik.md', { klasa: 'wartosc-graniczna', paths: ['src/a/b.ts'] })
  const katalog = wpis('docs/solutions/e/katalog.md', { klasa: 'cykl-zycia-ui', paths: ['src/a/**'] })
  assert.deepEqual(wycinek([katalog, plik], pliki).pliki, ['docs/solutions/e/plik.md', 'docs/solutions/e/katalog.md'])
  const klamry = wpis('docs/solutions/e/klamry.md', { klasa: 'cykl-zycia-ui', paths: ['src/{a,b}/b.ts'] })
  const znak = wpis('docs/solutions/e/znak.md', { klasa: 'duplikacja', paths: ['src/?/b.ts'] })
  assert.deepEqual(wycinek([klamry, znak, katalog], pliki).pliki, ['docs/solutions/e/katalog.md', 'docs/solutions/e/klamry.md', 'docs/solutions/e/znak.md'])
  const dwa = wpis('docs/solutions/e/dwa.md', { klasa: 'tekst-ui', paths: ['src/**', 'src/a/b.ts'] })
  assert.deepEqual(wycinek([katalog, dwa], pliki).pliki, ['docs/solutions/e/dwa.md', 'docs/solutions/e/katalog.md'])
})

test('wycinek: regula_krotka z nowa linia w jednej linii wycinka', () => {
  const w = wpis('docs/solutions/e/nl.md', { regula_krotka: 'Pierwsza czesc\n  druga czesc.' })
  assert.equal(wycinek([w], ['src/lib/a.ts']).tresc, '- [srednia] sciezka-bledu: Pierwsza czesc druga czesc. (docs/solutions/e/nl.md)')
})
