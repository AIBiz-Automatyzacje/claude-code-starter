// Test warstwy stalej plikow rol (PLAN-POPRAWY P11; w P12 rozszerzany o buildery).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/warstwa-stala.test.mjs
//
// DLACZEGO: plik roli to warstwa stala — model czyta go przy kazdym wywolaniu. Zasady pisania (PROMPT-AUDIT §4,
// INSPIRACJE A4): polecenia w jednym oznaczonym bloku z budzetem, mandat w 1–2 zdaniach, czas terazniejszy bez dat
// i fraz migracyjnych, odwolania do regul kodu po temacie. Sprawdzenia licza sie z tekstu pliku, wiec kazde ma test
// na podlozonym zlym tekscie. Rola wchodzi na liste ROLE_Z_WARSTWA, gdy jej plik jest przepisany wg tych zasad.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { MAKS_POLECEN, liczbaPolecen, naruszeniaWarstwy } from '../../scripts/doctor/warstwa-stala.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const ROLE_Z_WARSTWA = ['correctness-reviewer', 'spec-compliance-reviewer']

/**
 * @param {string} cialo
 * @returns {string}
 */
function plik(cialo) {
  return `---\nname: x\ndescription: "opis"\n---\n\n${cialo}`
}

const DOBRY = plik(`Szukasz defektow w zmienionym kodzie fazy. Zglaszasz te, ktore pokazujesz na konkretnym wejsciu.

## Polecenia

- Wypisz kazda operacje zmieniajaca stan — z tej listy liczysz drogi bez bramki. Gotowe, gdy kazda ma plik:linie.
- Zglaszaj finding ze scenariuszem awarii, bo sceptyk sprawdza teze na kodzie.
`)

test('poprawny plik: zero naruszen i liczba polecen z bloku', () => {
  assert.deepEqual(naruszeniaWarstwy(DOBRY), [])
  assert.equal(liczbaPolecen(DOBRY), 2)
})

test('brak bloku polecen i dwa bloki sa zglaszane', () => {
  assert.deepEqual(naruszeniaWarstwy(plik('Szukasz defektow.\n')), ['blok "## Polecenia": 0, oczekiwany 1'])
  assert.deepEqual(naruszeniaWarstwy(`${DOBRY}\n## Polecenia\n\n- Wypisz drugie.\n`), ['blok "## Polecenia": 2, oczekiwany 1'])
})

test('blok ponad budzet polecen jest zglaszany', () => {
  const lista = Array.from({ length: MAKS_POLECEN + 1 }, (_, i) => `- Wypisz pozycje ${i}.`).join('\n')
  assert.deepEqual(naruszeniaWarstwy(plik(`Szukasz defektow.\n\n## Polecenia\n\n${lista}\n`)), [`polecen w bloku: ${MAKS_POLECEN + 1}, budzet ${MAKS_POLECEN}`])
})

test('zdanie nakazowe poza blokiem jest zglaszane, opis poza blokiem (takze „nalezy do”) nie', () => {
  const tekst = plik(`Szukasz defektow.\n\n## Wejscie\n\nDossier ma diff fazy. Styl nalezy do innej osi. Sprawdz kazda sciezke.\n- Nie zglaszaj stylu.\nMusisz czytac plan. Nalezy czytac diff.\n\n## Polecenia\n\n- Wypisz drogi.\n`)
  assert.deepEqual(naruszeniaWarstwy(tekst), [
    'zdanie nakazowe poza blokiem: "Sprawdz kazda sciezke."',
    'zdanie nakazowe poza blokiem: "Nie zglaszaj stylu."',
    'zdanie nakazowe poza blokiem: "Musisz czytac plan."',
    'zdanie nakazowe poza blokiem: "Nalezy czytac diff."',
  ])
})

test('mandat dluzszy niz dwa zdania jest zglaszany', () => {
  const tekst = plik('Szukasz defektow. Zglaszasz je. Opisujesz scenariusz.\n\n## Polecenia\n\n- Wypisz drogi.\n')
  assert.deepEqual(naruszeniaWarstwy(tekst), ['mandat: 3 zdania, oczekiwane 1–2'])
})

test('daty, frazy migracyjne i numery sekcji regul kodu sa zglaszane takze w bloku', () => {
  const tekst = plik(`Szukasz defektow.\n\n## Polecenia\n\n- Wypisz drogi od 2026-09-03.\n- Jak dotąd wystarczal grep.\n- Juz nie czytaj planu.\n- Stosuj coding-rules §4.\n`)
  assert.deepEqual(naruszeniaWarstwy(tekst), [
    'data: "2026-09-03"',
    'fraza migracyjna: "Jak dotąd"',
    'fraza migracyjna: "Juz nie"',
    'numer sekcji zamiast tematu: "§4"',
  ])
})

for (const rola of ROLE_Z_WARSTWA) {
  test(`warstwa stala: ${rola}.md wg zasad pisania`, () => {
    const tekst = readFileSync(join(REPO, '.claude/agents', `${rola}.md`), 'utf8')
    assert.deepEqual(naruszeniaWarstwy(tekst), [])
  })
}
