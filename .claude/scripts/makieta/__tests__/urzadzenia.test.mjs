// Presety urzadzen i regula domyslna narzedzia makiet (P24 IU-7): presety o szerokosci w granicach ±24 px od makiety; bez
// trafienia — wymiar makiety plus desktop-1440 (makieta >= 600 px albo punkt „Komputer”) albo iphone-15.

import assert from 'node:assert/strict'
import test from 'node:test'

import { PRESETY, domyslneUrzadzenia, urzadzenieZWymiaru } from '../urzadzenia.mjs'

const nazwy = (/** @type {{ id: string }[]} */ u) => u.map((x) => x.id)

test('biblioteka presetów z planu', () => {
  assert.deepEqual(PRESETY.map((p) => [p.id, p.szerokosc, p.wysokosc]), [
    ['iphone-se', 375, 667], ['iphone-15', 393, 852], ['pixel-8', 412, 915], ['ipad-mini', 768, 1024],
    ['ipad-11', 834, 1194], ['laptop-1280', 1280, 800], ['desktop-1440', 1440, 900],
  ])
})

test('makieta 390 px wybiera iphone-15, iphone-se i pixel-8; 1440 px wybiera desktop-1440', () => {
  assert.deepEqual(nazwy(domyslneUrzadzenia({ szerokosc: 390, wysokosc: 844 }, 'Telefon: …')), ['iphone-se', 'iphone-15', 'pixel-8'])
  assert.deepEqual(nazwy(domyslneUrzadzenia({ szerokosc: 1440, wysokosc: 1041 }, 'Komputer, krok 1: …')), ['desktop-1440'])
  assert.deepEqual(nazwy(domyslneUrzadzenia({ szerokosc: 414, wysokosc: 900 }, 'T')), ['iphone-15', 'pixel-8'], 'granica +24/−24 px włącznie: 390 i 438')
  assert.deepEqual(nazwy(domyslneUrzadzenia({ szerokosc: 390, wysokosc: 544 }, 'Telefon')), ['iphone-se', 'iphone-15', 'pixel-8'], 'lista 390×544 to jeszcze ekran')
  assert.deepEqual(nazwy(domyslneUrzadzenia({ szerokosc: 390, wysokosc: 300 }, 'Telefon')), ['makieta-390x300', 'iphone-15'], 'komponent niższy niż pół ekranu')
})

test('bez trafienia: wymiar makiety i desktop-1440 przy ≥ 600 px albo „Komputer”, inaczej iphone-15', () => {
  assert.deepEqual(nazwy(domyslneUrzadzenia({ szerokosc: 480, wysokosc: 679 }, 'Komputer: okno')), ['makieta-480x679', 'desktop-1440'])
  assert.deepEqual(nazwy(domyslneUrzadzenia({ szerokosc: 358, wysokosc: 234 }, '„Odznaka” przy projekcie')), ['makieta-358x234', 'iphone-15'])
  assert.deepEqual(nazwy(domyslneUrzadzenia({ szerokosc: 1104, wysokosc: 141 }, '`/odznaka/jasna.svg`')), ['makieta-1104x141', 'desktop-1440'])
  assert.deepEqual(nazwy(domyslneUrzadzenia({ szerokosc: 520, wysokosc: 518 }, 'komputer, okno')), ['makieta-520x518', 'desktop-1440'], 'wielkość liter etykiety')
  assert.deepEqual(domyslneUrzadzenia({ szerokosc: 358, wysokosc: 234 }, 'T')[0], { id: 'makieta-358x234', nazwa: 'wymiar makiety 358×234', szerokosc: 358, wysokosc: 234 })
})

test('bez wymiarów makiety: iphone-15 i desktop-1440; własny wymiar W×H jako urządzenie', () => {
  assert.deepEqual(nazwy(domyslneUrzadzenia(null, 'Telefon')), ['iphone-15', 'desktop-1440'])
  assert.deepEqual(urzadzenieZWymiaru('390×844'), { id: 'wlasny-390x844', nazwa: 'własny 390×844', szerokosc: 390, wysokosc: 844 })
  assert.deepEqual(urzadzenieZWymiaru(' 1200 x 700 '), { id: 'wlasny-1200x700', nazwa: 'własny 1200×700', szerokosc: 1200, wysokosc: 700 })
  for (const zly of ['', '390', '0×100', '390×abc', '99999×100']) assert.equal(urzadzenieZWymiaru(zly), null, zly)
})
