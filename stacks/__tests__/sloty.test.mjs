// Rejestr slotów stackowych (plan szablonu mobile z rdzenia, IU-1.1). Slot = plik w `.claude/stack/`, do którego
// rdzeń (workflowy, skille, skrypty) odsyła po tekst zależny od stacku. `.claude/` repo niesie wariant web; nakładka
// stacku (Etap 2, `stacks/<stack>/`) podmienia te pliki w całości. Rejestr `stacks/sloty.json` jest jedyną listą slotów:
// slot spoza rejestru nie dostałby podmiany w wariancie Expo, a wpis bez pliku zostawiłby rdzeń z odesłaniem donikąd.
//
// Uruchomienie: node --test stacks/__tests__/sloty.test.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const KATALOG_SLOTOW = '.claude/stack'
/** @param {string} sciezka */
const czytaj = (sciezka) => readFileSync(resolve(KORZEN, sciezka), 'utf8')

/** @type {{ sloty: Array<{ plik: string, opis: string }> }} */
const rejestr = JSON.parse(czytaj('stacks/sloty.json'))
const pliki = rejestr.sloty.map((s) => s.plik)

// Slot tekstowy leży w .claude/stack/; slot plikowy to moduł rdzenia, który nakładka podmienia w całości (adapter E2E).
const SLOT = /^\.claude\/(?:stack\/[a-z0-9-]+\.md|scripts\/[a-z0-9-]+\/adapter\.mjs)$/

test('rejestr: każdy slot ma ścieżkę slotu tekstowego albo plikowego i opis, bez powtórzeń', () => {
  assert.ok(Array.isArray(rejestr.sloty) && rejestr.sloty.length > 0)
  for (const slot of rejestr.sloty) {
    assert.deepEqual(Object.keys(slot).sort(), ['opis', 'plik'], `pola slotu ${slot.plik}`)
    assert.match(slot.plik, SLOT)
    assert.ok(slot.opis.trim().length > 0, `opis slotu ${slot.plik}`)
  }
  assert.equal(new Set(pliki).size, pliki.length, 'zdublowany slot')
})

test('rejestr ma sloty tekstowe z IU-1.1', () => {
  for (const nazwa of ['buildery', 'e2e-srodowisko', 'walidacja', 'fix-e2e', 'plan-e2e']) {
    assert.ok(pliki.includes(`${KATALOG_SLOTOW}/${nazwa}.md`), `brak slotu ${nazwa}`)
  }
})

test('każdy slot z rejestru ma wariant web: tekstowy z nagłówkiem, plikowy z komentarzem o kontrakcie', () => {
  for (const plik of pliki) {
    assert.ok(existsSync(resolve(KORZEN, plik)), `brak pliku ${plik}`)
    if (plik.endsWith('.md')) assert.match(czytaj(plik), /^# \S/, `${plik} zaczyna się nagłówkiem`)
    else assert.match(czytaj(plik), /^\/\/ .*slot plikowy/i, `${plik} zaczyna się opisem slotu`)
  }
})

test('rejestr ma adapter E2E (IU-1.3)', () => {
  assert.ok(pliki.includes('.claude/scripts/e2e/adapter.mjs'))
})

test('w .claude/stack/ nie ma plików spoza rejestru', () => {
  const naDysku = readdirSync(resolve(KORZEN, KATALOG_SLOTOW)).map((n) => `${KATALOG_SLOTOW}/${n}`)
  assert.deepEqual(naDysku.filter((p) => !pliki.includes(p)), [])
})

// Wariant web niesie dzisiejszą treść rdzenia — zachowanie projektów web po przełączeniu rdzenia na sloty się nie zmienia.
test('sloty web niosą treść stacku web', () => {
  const oczekiwane = {
    buildery: ['feature-builder-ui', 'feature-builder-data', 'feature-builder-fullstack', 'src/components/', 'supabase/migrations/'],
    walidacja: ['vitest', 'vite build', '--reporter=dot', '[vitest-worker]', '@testing-library/react'],
    'e2e-srodowisko': ['--mode e2e', 'E2E_URL', 'E2E_HEALTH_TRESC', 'agent-browser'],
    'fix-e2e': ['agent-browser snapshot -i', 'agent-browser get box'],
    'plan-e2e': ['e2e/seeds/', 'Stwórz (e2e seed)', 'E2E_TEST_EMAIL', 'agent-browser'],
  }
  for (const [nazwa, frazy] of Object.entries(oczekiwane)) {
    const tresc = czytaj(`${KATALOG_SLOTOW}/${nazwa}.md`)
    for (const fraza of frazy) assert.ok(tresc.includes(fraza), `${nazwa}.md: brak „${fraza}”`)
  }
})

test('adapter E2E web: Vite na 5174 obok 5173, agent-browser, uwagi o proxy Vite', async () => {
  const a = await import(resolve(KORZEN, '.claude/scripts/e2e/adapter.mjs'))
  assert.equal(a.DOMYSLNY_PORT, 5174)
  assert.equal(a.PORT_DEV, 5173)
  assert.equal(a.komendaStartu('pnpm', 5174), 'pnpm run dev -- --mode e2e --port 5174 --strictPort')
  assert.deepEqual(a.NARZEDZIE_JAZDY, { nazwa: 'agent-browser', instalacja: 'npm install -g agent-browser && agent-browser install', diagnoza: 'agent-browser doctor' })
  assert.equal(a.LIMIT_ZRZUTU_SEK, 30)
  assert.match(a.naprawaZrzutu, /agent-browser close --all/)
})
