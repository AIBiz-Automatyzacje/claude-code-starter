import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// Ślepy test P11 (7 faz): finding na każdego mutanta dawał test-coverage 80 P1/P2 zamiast 30, z czego 39 z mutantów,
// a każdy P1/P2 przechodzi przez sceptyka i fix. Decyzja operatora: findingi z mutantów grupowane per plik.
const PLIK_ROLI = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'agents', 'test-coverage-reviewer.md')
const tekst = readFileSync(PLIK_ROLI, 'utf8')
const pozycjeMutantow = tekst.split('\n').filter((l) => l.startsWith('- (blok przeżytych mutantów niepusty)'))

test('mutanty Survived jednego pliku testu dają jeden finding P2 TEST z listą id', () => {
  const regula = pozycjeMutantow.find((l) => l.includes('Survived'))
  assert.ok(regula, 'brak pozycji z regułą findingu dla mutantów Survived')
  assert.match(regula, /Survived[^.]*ten sam plik testu[^.]*jeden finding P2 TEST/)
  assert.match(regula, /id mutantów/)
})

test('mutanty NoCoverage jednego pliku produkcyjnego dają jeden finding P2 TEST', () => {
  const regula = pozycjeMutantow.find((l) => l.includes('NoCoverage'))
  assert.ok(regula, 'brak pozycji z regułą findingu dla mutantów NoCoverage')
  assert.match(regula, /NoCoverage[^.]*jednego pliku produkcyjnego[^.]*jeden finding P2 TEST/)
})

test('żadna pozycja nie każe zgłaszać findingu na każdego mutanta osobno', () => {
  for (const l of pozycjeMutantow) assert.doesNotMatch(l, /Mutant Survived z istniejącym testem to finding/)
})
