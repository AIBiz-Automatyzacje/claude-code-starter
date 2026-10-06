// Test adaptera bramek ślepego testu P11: mutanty z wrześniowego przebiegu Strykera przycięte do zakresu bramki szablonu.
// Uruchomienie: node --test skrypty/test_review_p11_bramki.test.mjs (z katalogu analizy).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mutantyWZakresie } from './test_review_p11_bramki.mjs'

const WRZESIEN = [
  { plik: 'apps/server/src/a.ts', linia: 12, regula: 'stryker/ConditionalExpression', opis: 'Survived: ConditionalExpression → true' },
  { plik: 'apps/server/src/a.ts', linia: 40, regula: 'stryker/BlockStatement', opis: 'NoCoverage: BlockStatement → {}' },
  { plik: 'apps/server/src/b.ts', linia: 12, regula: 'stryker/StringLiteral', opis: 'NoCoverage: StringLiteral → ""' },
]

test('mutant zostaje tylko na liniach zakresu bramki szablonu, z opisem jak w stryker.mjs', () => {
  const wynik = mutantyWZakresie(WRZESIEN, ['apps/server/src/a.ts:10-20', 'apps/server/src/c.ts:1-50'])
  assert.deepEqual(wynik, [{ plik: 'apps/server/src/a.ts', linia: 12, regula: 'stryker/ConditionalExpression', opis: 'Survived: true' }])
})

test('zakres spoza formatu plik:od-do odmawia', () => {
  assert.throws(() => mutantyWZakresie(WRZESIEN, ['apps/server/src/a.ts']), /zakres Strykera/)
})
