// Lekser i kategorie ogrodnika na fixture ze znanymi liczbami: kazda kategoria ma trafienia i pulapki (stringi, wzmianki
// w komentarzach, `z.any()`, operator `!==`, slownictwo dziedziny z realnych projektow), ktore liczone nie sa.

import test from 'node:test'
import assert from 'node:assert/strict'

import { rozbierz } from '../leksyka.mjs'
import { liczbyZRekordu, policz, wystapienia } from '../kategorie.mjs'

const FIXTURE_TS = [
  "import { z } from 'zod'", // 1
  '// eslint-disable-next-line no-console', // 2  wyciszenie
  "console.log('// TODO w stringu nie jest komentarzem')", // 3
  '/* eslint-disable */', // 4  wyciszenie
  '// `@ts-expect-error` zamiast rzutu — wzmianka, nie dyrektywa', // 5
  '// @ts-expect-error — wartosc spoza unii', // 6  wyciszenie
  'const a: any = 1', // 7  any
  'const b = a as any', // 8  any
  'const lista: Array<any> = []', // 9  any
  'const schemat = z.any()', // 10
  "const tekst = 'x: any'", // 11
  'type F = (x: number) => any', // 12 any
  'const c = b as unknown as string', // 13 rzutowanie
  'const d = el!.value', // 14 rzutowanie
  'if (a !== b && !c) d()', // 15
  'try { d() } catch {}', // 16 pusty catch
  'try { d() } catch (e) { /* cicho */ }', // 17 pusty catch (komentarz to nie slad)
  'p.catch(() => {})', // 18 pusty catch
  'p.catch((e) => null)', // 19 pusty catch
  'p.catch((e) => log(e))', // 20
  '// TODO: dopisac walidacje', // 21 komentarz
  '// tymczasowo wylaczone do czasu poprawki biblioteki', // 22 komentarz
  '// to jest obejscie bledu biblioteki', // 23 komentarz
  '// luka do obejscia limitu — bypass, nie obejscie w kodzie', // 24
  '// lista todo uzytkownika', // 25
  'const re = /["\']\\/\\/ TODO/', // 26 regex z cudzyslowem i TODO
  'const t = `${a as any} // TODO ${b}`', // 27 any w wyrazeniu szablonu; TODO w tekscie szablonu nie
  '/**', // 28
  ' * HACK: ominiecie cache', // 29 komentarz
  ' */', // 30
  '// zapisz do pliku tymczasowego, potem rename', // 31 dziedzina
  '// format: +48 XXX XXX XXX', // 32 format telefonu
  '// endpoint podatny na obejscie limitu', // 33 bypass
  '// XXX: do przepisania', // 34 komentarz
  'const url = process.env.DATABASE_URL!', // 35 rzutowanie (koniec linii w .ts)
  'f(a!, b)', // 36 rzutowanie
  'const v = x!;', // 37 rzutowanie
  'const w = y as never', // 38 rzutowanie
  'if (a != b) f()', // 39
  "const src = `const a: any = 1 // TODO`", // 40 tekst szablonu (L2)
  'const h = `${items.map((i) => { return i })}` // TODO po szablonie', // 41 komentarz po klamrach w ${} (L6)
  "function q(x) { return /'/.test(x) } // TODO po regexie z return", // 42 komentarz (L8)
  'const m = (a + b) / 2 // TODO po dzieleniu nawiasu', // 43 komentarz (L9)
  "const s = 'it\\'s' // TODO po escape", // 44 komentarz (L10)
  '/**', // 45
  ' * eslint-disable-next-line w srodku JSDoc nie jest dyrektywa', // 46
  ' */', // 47
  '// deno-lint-ignore no-explicit-any', // 48 wyciszenie
  '/* eslint no-console: "off" */', // 49 wyciszenie
  'p.catch(async () => {})', // 50 pusty catch
  'p.catch(function () {})', // 51 pusty catch
  'const czas: keyof any = "x"', // 52 any
].join('\n')

test('fixture TS: znane liczby i linie per kategoria', () => {
  const lista = wystapienia(FIXTURE_TS, 'src/fixture.ts')
  const linie = (/** @type {string} */ k) => lista.filter((w) => w.kategoria === k).map((w) => w.linia)
  assert.deepEqual(linie('wyciszenia'), [2, 4, 6, 48, 49])
  assert.deepEqual(linie('any'), [7, 8, 9, 12, 27, 52])
  assert.deepEqual(linie('rzutowania'), [13, 14, 35, 36, 37, 38])
  assert.deepEqual(linie('pusty_catch'), [16, 17, 18, 19, 50, 51])
  assert.deepEqual(linie('komentarze'), [21, 22, 23, 29, 34, 41, 42, 43, 44])
  assert.deepEqual(policz(lista), { wyciszenia: 5, any: 6, rzutowania: 6, komentarze: 9, pusty_catch: 6 })
  assert.equal(lista.find((w) => w.linia === 21)?.tekst, '// TODO: dopisac walidacje')
})

test('plik JS: bez kategorii typow (any, rzutowania), pozostale liczone', () => {
  const lista = wystapienia('const a = b!.c\n// FIXME\ntry { x() } catch (e) {}\nconst any = 1, y: any\n', 'src/a.js')
  assert.deepEqual(policz(lista), { wyciszenia: 0, any: 0, rzutowania: 0, komentarze: 1, pusty_catch: 1 })
})

test('TSX: wykrzyknik na koncu linii tekstu JSX nie jest asercja, `x!.y` jest', () => {
  const lista = wystapienia('const A = () => (\n  <p>\n    Zapisano!\n  </p>\n)\nconst b = ref.current!.value\n', 'src/a.tsx')
  assert.deepEqual(lista.filter((w) => w.kategoria === 'rzutowania').map((w) => w.linia), [6])
})

test('JSX: `</tag>` i `<Foo />` nie otwieraja regexu — kod i komentarze za nimi zostaja', () => {
  const zrodlo = '<div><span>x</span>{(v as any).y}</div>\nreturn <Foo a={b} /> // eslint-disable-line x\n<b>a</b> // TODO znacznik\n'
  assert.deepEqual(policz(wystapienia(zrodlo, 'src/a.tsx')), { wyciszenia: 1, any: 1, rzutowania: 0, komentarze: 1, pusty_catch: 0 })
})

test('lekser: kod tej samej dlugosci, konce linii zachowane, stringi i komentarze wygaszone', () => {
  const zrodlo = "const s = 'a // b'\nconst t = `x\n${y + '}'}\nz`\n/* k1\nk2 */ const w = 1 // k3\n"
  const { kod, komentarze } = rozbierz(zrodlo)
  assert.equal(kod.length, zrodlo.length)
  assert.equal(kod.split('\n').length, zrodlo.split('\n').length)
  assert.ok(!kod.includes('a // b') && !kod.includes('k1') && !kod.includes('k3'))
  assert.ok(kod.includes('${y + '), 'wyrazenie szablonu zostaje kodem')
  assert.ok(kod.includes('const w = 1'), 'kod za komentarzem blokowym w tej samej linii zostaje')
  assert.deepEqual(komentarze, [
    { linia: 5, tekst: ' k1', poczatek: true }, { linia: 6, tekst: 'k2 ', poczatek: false }, { linia: 6, tekst: ' k3', poczatek: true },
  ])
})

test('lekser: niezamkniety string (apostrof w tekscie JSX) psuje najwyzej swoja linie', () => {
  const zrodlo = "const v = <p>Don't panic</p>\n// TODO: nastepna linia jest komentarzem\n"
  assert.deepEqual(policz(wystapienia(zrodlo, 'src/a.tsx')).komentarze, 1)
})

test('lekser: dzielenie nie otwiera regexu, regex z apostrofem nie otwiera stringu', () => {
  const { komentarze } = rozbierz("const x = a / b / c // TODO po dzieleniu\nconst r = /'/g // TODO po regexie\n")
  assert.deepEqual(komentarze.map((k) => k.linia), [1, 2])
})

test('liczby z rekordu telemetrii: komplet liczb calkowitych albo null', () => {
  const komplet = { wyciszenia: 1, any: 0, rzutowania: 2, komentarze: 0, pusty_catch: 3 }
  assert.deepEqual(liczbyZRekordu({ ...komplet, inne: 'x' }), komplet)
  for (const zle of [null, [], { ...komplet, any: '0' }, { ...komplet, any: 1.5 }, { ...komplet, any: undefined }]) {
    assert.equal(liczbyZRekordu(zle), null, JSON.stringify(zle))
  }
})
