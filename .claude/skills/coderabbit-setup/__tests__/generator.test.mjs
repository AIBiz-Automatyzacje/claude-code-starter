// Test generatora .coderabbit.yaml (P5, ETAP1B §2): template bazowy + bloki stacku musza dac config, ktory CodeRabbit przyjmie.
// Dlaczego schemat: nieznany klucz albo za dlugie `tone_instructions` (limit 250 zn.) i bot odrzuca config — bez sladu w PR.
// Schemat: kopia https://coderabbit.ai/integrations/schema.v2.json (2026-10-03) w fixtures/ — test dziala offline;
// odswiezenie kopii = swiadoma zmiana.
//
// Uruchomienie:  node --test .claude/skills/coderabbit-setup/__tests__/generator.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { Ajv2020 } from 'ajv/dist/2020.js'
import { parse } from 'yaml'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const SKILL = resolve(KATALOG, '..')
const czytaj = (/** @type {string} */ sciezka) => readFileSync(resolve(SKILL, sciezka), 'utf8')

const OPIS = czytaj('SKILL.md')
const BAZA = czytaj('templates/coderabbit-base.yaml')
const BLOKI = czytaj('reference/stack-blocks.md')
const SCHEMAT = JSON.parse(czytaj('__tests__/fixtures/coderabbit-schema.v2.json'))

/** @typedef {{ path: string, instructions: string }} Instrukcja */
/** @typedef {{ filtry: string[], instrukcje: Instrukcja[] }} BlokStacku */

/** Bloki ```yaml z reference/stack-blocks.md, kazdy pod naglowkiem `## <stack>`. @returns {Map<string, BlokStacku>} */
function blokiStackow() {
  /** @type {Map<string, BlokStacku>} */
  const wynik = new Map()
  for (const sekcja of BLOKI.split(/^## /m).slice(1)) {
    const nazwa = sekcja.slice(0, sekcja.indexOf('\n')).trim()
    const kod = /```yaml\n([\s\S]*?)```/.exec(sekcja)
    assert.ok(kod, `stack "${nazwa}" bez bloku yaml`)
    const [filtry, instrukcje] = kod[1].split(/^# path_instructions.*$/m)
    wynik.set(nazwa, {
      filtry: parse(filtry.replace(/^# path_filters.*$/m, '')) ?? [],
      instrukcje: parse(instrukcje ?? '') ?? [],
    })
  }
  return wynik
}

// Sciezka regul kodu zyje w jednej stalej w SKILL.md (P12 ja zmieni); template ma w jej miejscu {{CODING_RULES}}.
const STALA = /`CODING_RULES = ([^`]+)`/.exec(OPIS)?.[1]

/** Config tak, jak skleja go skill: baza ze stala + bloki wybranych stackow. @param {BlokStacku[]} bloki */
function zbuduj(bloki) {
  const config = parse(BAZA.replaceAll('{{CODING_RULES}}', STALA ?? '{{CODING_RULES}}'))
  for (const b of bloki) {
    config.reviews.path_filters.push(...b.filtry)
    config.reviews.path_instructions.push(...b.instrukcje)
  }
  return config
}

const ajv = new Ajv2020({ allErrors: true })
ajv.addKeyword('enumNames') // adnotacja edytora w schemacie CodeRabbit, bez znaczenia dla walidacji
const waliduj = ajv.compile(SCHEMAT)

/** @param {unknown} config */
function bledySchematu(config) {
  return waliduj(config) ? [] : (waliduj.errors ?? []).map((e) => `${e.instancePath} ${e.message}`)
}

test('baza i kazdy blok stacku daja config zgodny ze schematem CodeRabbit', () => {
  const stacki = blokiStackow()
  assert.ok(stacki.size >= 5, `oczekiwano 5 stackow, jest ${stacki.size}`)
  assert.deepEqual(bledySchematu(zbuduj([])), [], 'sama baza')
  for (const [nazwa, blok] of stacki) {
    assert.ok(blok.instrukcje.length > 0, `stack "${nazwa}" bez path_instructions`)
    assert.deepEqual(bledySchematu(zbuduj([blok])), [], `baza + ${nazwa}`)
  }
})

// Schemat zabrania nieznanych kluczy tylko w korzeniu (literowka `reveiws` gubi cala sekcje review).
test('schemat lapie za dlugie tone_instructions i nieznany klucz w korzeniu', () => {
  const config = zbuduj([])
  config.tone_instructions = 'x'.repeat(251)
  config.reveiws = config.reviews
  const bledy = bledySchematu(config)
  assert.ok(bledy.some((b) => b.startsWith('/tone_instructions')), bledy.join('\n'))
  assert.ok(bledy.some((b) => b.includes('additional properties')), bledy.join('\n'))
})

/** Instrukcje bloku glownego `**\/*.{ts,tsx}` — dotycza kazdego pliku TS, takze testow i texts.ts. @returns {string} */
function blokGlowny() {
  const glowny = zbuduj([]).reviews.path_instructions.find((/** @type {Instrukcja} */ i) => i.path === '**/*.{ts,tsx}')
  assert.ok(glowny, 'brak bloku glownego **/*.{ts,tsx}')
  return glowny.instructions
}

// ETAP1B §2: prog 300/50 dal 80 uwag szumu (przekroczenia o <20%, np. 305 vs 300) — prog 360/60, ten sam co ESLint (P6).
test('prog rozmiaru 360/60 w bloku glownym, bez progu 300/50 w zadnej instrukcji', () => {
  assert.match(blokGlowny(), /360 linii/)
  assert.match(blokGlowny(), /60 linii/)
  /** @type {[string, BlokStacku][]} */
  const warianty = [['baza', { filtry: [], instrukcje: [] }], ...blokiStackow()]
  for (const [nazwa, blok] of warianty) {
    for (const i of zbuduj([blok]).reviews.path_instructions) {
      assert.doesNotMatch(i.instructions, /\b(300|50) linii/, `${nazwa}: ${i.path}`)
    }
  }
})

// Instrukcje per glob SUMUJA sie, nie nadpisuja: wyjatek w `**/*.test.{ts,tsx}` nie zdejmuje progu z bloku glownego
// (template-assets.test.ts 1185 linii zgloszony mimo wyjatku; texts.ts 515 linii) — wyjatek musi stac w bloku glownym.
test('wyjatki od progu rozmiaru (pliki testowe, texts.ts) stoja w bloku glownym', () => {
  assert.match(blokGlowny(), /\*\.test\./)
  assert.match(blokGlowny(), /texts\.ts/)
})

test('sciezka regul kodu wystepuje w skillu raz — w stalej CODING_RULES, z ktorej skill podstawia ja do template', () => {
  assert.ok(STALA, 'SKILL.md bez stalej `CODING_RULES = <sciezka>`')
  const wystapienia = [OPIS, BAZA, BLOKI].flatMap((t) => t.match(/coding-rules/g) ?? [])
  assert.equal(wystapienia.length, 1, 'sciezka regul kodu poza stala')
  const config = zbuduj([...blokiStackow().values()])
  assert.ok(config.knowledge_base.code_guidelines.filePatterns.includes(STALA))
  assert.ok(blokGlowny().includes(STALA))
  assert.doesNotMatch(JSON.stringify(config), /\{\{CODING_RULES\}\}/, 'niepodstawiony znacznik w configu')
})

// nav-icons.tsx zgloszony w PR 1 i znow 9 PR-ow pozniej: regula „jeden eksport per plik” bez wyjatku dla kolekcji.
test('regula „jeden eksport per plik” dotyczy ekranow, kolekcje sa wyjatkiem w tej samej instrukcji', () => {
  const zRegula = [...blokiStackow().values()].flatMap((b) => b.instrukcje).filter((i) => /jeden (eksport|export)/i.test(i.instructions))
  assert.ok(zRegula.length > 0, 'zadna instrukcja nie niesie reguly — test do aktualizacji')
  for (const i of zRegula) assert.match(i.instructions, /kolekcj/, i.path)
})

// Seedy E2E nie mialy instrukcji (wpis dla scripts/**/*.ts ich nie obejmuje) — uwaga P1: straznik seeda nie potwierdzal
// pochodzenia konta przed `delete from auth.users`. Seedy to konwencja pipeline'u (e2e/seeds/), wiec wpis stoi w bazie.
test('seedy e2e/seeds/*.sql maja w bazie instrukcje granicy zaufania', () => {
  const seedy = zbuduj([]).reviews.path_instructions.find((/** @type {Instrukcja} */ i) => i.path === 'e2e/seeds/**/*.sql')
  assert.ok(seedy, 'brak wpisu dla e2e/seeds/**/*.sql')
  assert.match(seedy.instructions, /granic\S* zaufania/)
  assert.match(seedy.instructions, /potwierdza/)
})

// ~8 uwag szumu: preferencje bota bez wplywu na wykrywalnosc regresji. Blok testow nie moze ich jednoczesnie zadac.
test('tone_instructions wylacza uklad Arrange-Act-Assert, docstringi i DRY w testach, a blok testow ich nie wymaga', () => {
  const config = zbuduj([])
  for (const fraza of [/Arrange-Act-Assert/, /docstring/, /DRY w testach/]) assert.match(config.tone_instructions, fraza)
  const testy = config.reviews.path_instructions.find((/** @type {Instrukcja} */ i) => i.path === '**/*.test.{ts,tsx}')
  assert.ok(testy, 'brak bloku testow')
  assert.doesNotMatch(testy.instructions, /Arrange-Act-Assert/)
})
