// Frontmatter solutions (PLAN-POPRAWY P10): odczyt pol bez biblioteki YAML (skrypt dziala w projekcie bez zaleznosci)
// i dopisanie pol wiedzy bez przepisywania reszty naglowka.

import test from 'node:test'
import assert from 'node:assert/strict'

import { czytajFrontmatter, ustawPola } from '../frontmatter.mjs'

const SOLUTION = [
  '---',
  'title: "Asercja na pominietym polu: test zielony"',
  'date: 2026-09-08',
  'category: testing-issues',
  'severity: high',
  'stack:',
  '  - TypeScript',
  '  - Vitest',
  "kontekst: 'ma ''apostrof'''",
  'tags: [a, b]',
  '---',
  '',
  '# Tytul',
  '',
  'Tresc z linia --- w srodku.',
].join('\n')

test('czytajFrontmatter: skalary, cudzyslowy, listy blokowe i inline', () => {
  const f = czytajFrontmatter(SOLUTION)
  assert.ok(f)
  assert.equal(f.pola.title, 'Asercja na pominietym polu: test zielony')
  assert.equal(f.pola.date, '2026-09-08')
  assert.deepEqual(f.pola.stack, ['TypeScript', 'Vitest'])
  assert.equal(f.pola.kontekst, "ma 'apostrof'")
  assert.deepEqual(f.pola.tags, ['a', 'b'])
})

test('czytajFrontmatter: plik bez naglowka albo bez zamkniecia = null', () => {
  assert.equal(czytajFrontmatter('# Tytul\n\ntresc'), null)
  assert.equal(czytajFrontmatter('---\ntitle: x\n# brak zamkniecia'), null)
})

test('ustawPola: dopisuje nowe pola przed zamknieciem, podmienia istniejace (z lista), reszta pliku bez zmian', () => {
  const nowy = ustawPola(SOLUTION, { klasa: 'luka-pokrycia', paths: ['src/lib/**', 'tests/**'], ucieczki: 0, stack: ['Zod'] })
  const f = czytajFrontmatter(nowy)
  assert.ok(f)
  assert.equal(f.pola.klasa, 'luka-pokrycia')
  assert.deepEqual(f.pola.paths, ['src/lib/**', 'tests/**'])
  assert.equal(f.pola.ucieczki, '0')
  assert.deepEqual(f.pola.stack, ['Zod'])
  assert.equal(f.pola.title, 'Asercja na pominietym polu: test zielony')
  assert.ok(nowy.endsWith('\n---\n\n# Tytul\n\nTresc z linia --- w srodku.'))
})

test('ustawPola: tekst z cudzyslowem i dwukropkiem wraca z odczytu bez zmian', () => {
  const regula = 'Klucz bierz z polaczenia: "X-Forwarded-For" ustawia klient. Czytaj go od prawej.'
  assert.equal(czytajFrontmatter(ustawPola(SOLUTION, { regula }))?.pola.regula, regula)
})

test('ustawPola: plik bez frontmattera dostaje nowy naglowek', () => {
  const nowy = ustawPola('# Tytul\n', { klasa: 'a11y' })
  assert.equal(czytajFrontmatter(nowy)?.pola.klasa, 'a11y')
  assert.ok(nowy.endsWith('---\n# Tytul\n'))
})
