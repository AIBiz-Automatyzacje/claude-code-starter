// Lekser i kategorie ogrodnika na fixture ze znanymi liczbami: kazda kategoria ma trafienia i pulapki (stringi, wzmianki
// w komentarzach, `z.any()`, operator `!==`), ktore liczone nie sa.

import test from 'node:test'
import assert from 'node:assert/strict'

import { rozbierz } from '../leksyka.mjs'
import { policz, wystapienia } from '../kategorie.mjs'

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
  "const schemat = z.any()", // 10
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
  '// tymczasowo wylaczone', // 22 komentarz
  '// to jest obejscie bledu biblioteki', // 23 komentarz
  '// luka do obejscia limitu — bypass, nie obejscie w kodzie', // 24
  '// lista todo uzytkownika', // 25
  'const re = /["\']\\/\\/ TODO/', // 26 regex z cudzyslowem i TODO
  'const t = `${a as any} // TODO ${b}`', // 27 any w wyrazeniu szablonu; TODO w tekscie szablonu nie
  '/**', // 28
  ' * HACK: ominiecie cache', // 29 komentarz
  ' */', // 30
].join('\n')

test('fixture TS: znane liczby per kategoria', () => {
  const lista = wystapienia(FIXTURE_TS, 'src/fixture.ts')
  assert.deepEqual(policz(lista), { wyciszenia: 3, any: 5, rzutowania: 2, komentarze: 4, pusty_catch: 4 })
  const linie = (/** @type {string} */ k) => lista.filter((w) => w.kategoria === k).map((w) => w.linia)
  assert.deepEqual(linie('wyciszenia'), [2, 4, 6])
  assert.deepEqual(linie('any'), [7, 8, 9, 12, 27])
  assert.deepEqual(linie('rzutowania'), [13, 14])
  assert.deepEqual(linie('pusty_catch'), [16, 17, 18, 19])
  assert.deepEqual(linie('komentarze'), [21, 22, 23, 29])
  assert.equal(lista.find((w) => w.linia === 21)?.tekst, '// TODO: dopisac walidacje')
})

test('plik JS: bez kategorii typow (any, rzutowania), pozostale liczone', () => {
  const lista = wystapienia('const a = b!.c\n// FIXME\ntry { x() } catch (e) {}\nconst any = 1, y: any\n', 'src/a.js')
  assert.deepEqual(policz(lista), { wyciszenia: 0, any: 0, rzutowania: 0, komentarze: 1, pusty_catch: 1 })
})

test('lekser: kod tej samej dlugosci, konce linii zachowane, stringi i komentarze wygaszone', () => {
  const zrodlo = "const s = 'a // b'\nconst t = `x\n${y + '}'}\nz`\n/* k1\nk2 */ const w = 1 // k3\n"
  const { kod, komentarze } = rozbierz(zrodlo)
  assert.equal(kod.length, zrodlo.length)
  assert.equal(kod.split('\n').length, zrodlo.split('\n').length)
  assert.ok(!kod.includes('a // b') && !kod.includes('k1') && !kod.includes('k3'))
  assert.ok(kod.includes('${y + '), 'wyrazenie szablonu zostaje kodem')
  assert.ok(kod.includes('const w = 1'), 'kod za komentarzem blokowym w tej samej linii zostaje')
  assert.deepEqual(komentarze, [{ linia: 5, tekst: ' k1' }, { linia: 6, tekst: 'k2 ' }, { linia: 6, tekst: ' k3' }])
})

test('lekser: niezamkniety string (apostrof w tekscie JSX) psuje najwyzej swoja linie', () => {
  const zrodlo = "const v = <p>Don't panic</p>\n// TODO: nastepna linia jest komentarzem\n"
  assert.deepEqual(policz(wystapienia(zrodlo, 'src/a.tsx')).komentarze, 1)
})

test('lekser: dzielenie nie otwiera regexu, regex z apostrofem nie otwiera stringu', () => {
  const { komentarze } = rozbierz("const x = a / b / c // TODO po dzieleniu\nconst r = /'/g // TODO po regexie\n")
  assert.deepEqual(komentarze.map((k) => k.linia), [1, 2])
})
