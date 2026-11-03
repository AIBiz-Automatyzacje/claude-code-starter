// Reguły stacku web (`.claude/rules/stack.md`, plan szablonu mobile z rdzenia, IU-1.9, A0.5 §1). Wariant web niesie
// mechanizmy, które przed podziałem stały w regułach rdzenia — dosłownie, żeby projekt web dostał tę samą wiedzę:
// rdzeń po podziale + reguły stacku = dawny `coding-rules.md`. Kontrakt wspólny (frontmatter, odesłania do sekcji,
// odczyt przez role) sprawdza `.claude/workflows/__tests__/reguly-stacku.test.mjs`.
//
// Uruchomienie: node --test stacks/web/__tests__/reguly.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
/** @param {string} sciezka */
const czytaj = (sciezka) => readFileSync(join(REPO, sciezka), 'utf8')
const STACK = czytaj('.claude/rules/stack.md')

/** @param {string} tekst @returns {string | undefined} */
const frontmatter = (tekst) => /^---\n([\s\S]*?)\n---\n/.exec(tekst)?.[1]

/** @param {string} naglowek @returns {string} */
function sekcja(naglowek) {
  const start = STACK.indexOf(`\n## ${naglowek}\n`)
  assert.notEqual(start, -1, `brak sekcji "## ${naglowek}"`)
  const koniec = STACK.indexOf('\n## ', start + 1)
  return STACK.slice(start, koniec === -1 ? undefined : koniec)
}

test('reguły stacku web ładują się dla tych samych plików co rdzeń', () => {
  assert.equal(frontmatter(STACK), frontmatter(czytaj('.claude/rules/coding-rules.md')))
})

test('reguły stacku web: React DOM + Vite', () => {
  assert.match(STACK, /^# Reguły stacku: React DOM \+ Vite$/m)
})

test('reguły stacku web niosą mechanizmy dawnego rdzenia dosłownie', () => {
  const oczekiwane = {
    'Organizacja kodu': ['Testy leżą obok plików źródłowych.'],
    Zależności: ['Wersje w package.json przypinasz dokładnie.'],
    Bezpieczeństwo: ['z trybu aplikacji albo `SITE_URL`'],
    'Type safety': ['`as` tylko przy zawężaniu DOM'],
    Performance: ['budżet paczki pilnuje size-limit w domknięciu',
      'Komponent większy niż 50 KB ładujesz dynamicznie (`React.lazy`, dynamic import).'],
    'Async i React': ['`AbortSignal.timeout`', '`babel-plugin-react-compiler` w projekcie'],
  }
  for (const [nazwa, frazy] of Object.entries(oczekiwane)) {
    const tresc = sekcja(nazwa)
    for (const f of frazy) assert.ok(tresc.includes(f), `stack.md, sekcja „${nazwa}”: brak „${f}”`)
  }
})
