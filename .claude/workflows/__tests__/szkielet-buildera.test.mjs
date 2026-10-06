// Test wspolnego szkieletu plikow builderow i skilli, ktore buildery dostaja z `skills:` (PLAN-POPRAWY P12).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/szkielet-buildera.test.mjs
//
// DLACZEGO: warstwe stala sprawdza warstwa-stala.test.mjs (blok polecen, mandat, daty). Builder ma ponadto wspolny
// szkielet: jawny odczyt regul kodu (`paths:` nie dziala, gdy builder czyta pliki Bashem), samosprawdzenie na plikach
// jednostki (D7-1), pytanie „undefined”, wynik tylko w schemacie BUILD_RESULT i zero powtorzen tresci regul kodu (dwie
// kopie reguly rozjezdzaja sie po cichu). Skill wstrzykiwany builderowi jest jego warstwa stala, wiec nie niesie protokolu
// audytu ani krzyku wersalikami (PA-24, PA-17). Kazde sprawdzenie ma test na podlozonym zlym tekscie.
// Builder wchodzi na liste BUILDERY_ZE_SZKIELETEM, gdy jego plik jest przepisany (P12: data w sesji 2, reszta w sesji 3).

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { AGENCI, agenci } from './agenci-pipeline.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const BUILDERY_ZE_SZKIELETEM = ['feature-builder-data']
// Skille przepisane wg PA-17 (jedna zasada = jedno zdanie z powodem); tailwind-react-guidelines i ux-ui-guidelines — sesja 3.
const SKILLE_BEZ_WERSALIKOW = ['security', 'sentry-integration', 'supabase-dev-guidelines']

const REGULY_KODU = '.claude/rules/coding-rules.md'
const WYMAGANE_W_POLECENIACH = [REGULY_KODU, 'tsc --noEmit', 'vitest related --run', 'undefined']
// Tokeny regul kodu, ktorych builder nie przepisuje — odwoluje sie do sekcji po nazwie.
const TOKENY_REGUL_KODU = ['auth.uid()', 'auth.jwt()', 'strictObject', 'search_path', 'AbortSignal', 'eslint-disable', 'toBeDefined',
  'user_metadata', '`any`']
// Znaczniki protokolu audytu i jego raportu (skill security przed P12).
const ZNACZNIKI_AUDYTU = ['Executive Summary', 'Risk Matrix', 'Remediation Roadmap', 'Format Raportu', 'Klasyfikacja Findings',
  'skanowy protokol', 'jak atakujacy']
const WERSALIKI = /(?<![\p{L}_])(?:NIGDY|ZAWSZE|MUSI|MUSISZ|MUST|NEVER|ALWAYS|ALL|WAŻNE|OBOWIĄZKOWE|KRYTYCZNE|TYLKO|NIE)(?![\p{L}_])/gu

const zrodloExecute = readFileSync(join(REPO, '.claude/workflows/dev-docs-execute-wf.js'), 'utf8')

/**
 * @returns {string[]}  pola BUILD_RESULT z dev-docs-execute-wf.js
 */
function polaWyniku() {
  const start = zrodloExecute.indexOf('const BUILD_RESULT = {')
  assert.notEqual(start, -1, 'nie znaleziono BUILD_RESULT — kotwica testu wymaga aktualizacji')
  const blok = zrodloExecute.slice(start, zrodloExecute.indexOf('\n}', start))
  return [...blok.matchAll(/^ {4}(\w+): \{/gm)].map((m) => m[1] ?? '')
}

/**
 * @param {string} tekst
 * @returns {string}  tresc bloku `## Polecenia` (do nastepnego naglowka drugiego stopnia)
 */
function blokPolecen(tekst) {
  const m = tekst.match(/^## Polecenia\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m)
  return m?.[1] ?? ''
}

/**
 * @param {string} tekst  pelny plik buildera
 * @param {string[]} pola  pola schematu wyniku
 * @returns {string[]}  opisy naruszen szkieletu
 */
function naruszeniaSzkieletu(tekst, pola) {
  const blok = blokPolecen(tekst)
  /** @type {string[]} */
  const wynik = []
  for (const w of WYMAGANE_W_POLECENIACH) if (!blok.includes(w)) wynik.push(`brak w poleceniach: ${w}`)
  for (const p of pola.filter((n) => n !== 'id')) if (!blok.includes(`\`${p}\``)) wynik.push(`pole wyniku bez polecenia: ${p}`)
  if (/^```/m.test(tekst) || /^#+ Raport/m.test(tekst) || tekst.includes('**Status:**')) wynik.push('drugi format raportu obok schematu wyniku')
  for (const t of TOKENY_REGUL_KODU) if (tekst.includes(t)) wynik.push(`powtorzona tresc regul kodu: ${t}`)
  return wynik
}

/**
 * @param {string} tekst  SKILL.md
 * @returns {string[]}
 */
function protokolAudytu(tekst) {
  const ascii = tekst.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
  return ZNACZNIKI_AUDYTU.filter((z) => ascii.includes(z))
}

/**
 * @param {string} tekst  SKILL.md
 * @returns {string[]}  slowa krzyczane wersalikami poza blokami kodu i kodem w linii
 */
function wersaliki(tekst) {
  const proza = tekst.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '')
  return [...proza.matchAll(WERSALIKI)].map((m) => m[0])
}

const POLA = ['id', 'status', 'pliki', 'odchylenia']
const DOBRY = `Wdrazasz jednostke.

## Polecenia

- Przeczytaj ${REGULY_KODU}.
- Uruchom \`tsc --noEmit\` i \`vitest related --run\`; kazdy test przejdz pytaniem „undefined”.
- Zwracasz \`status\`, \`pliki\` i \`odchylenia\`.
`

test('poprawny szkielet: zero naruszen', () => {
  assert.deepEqual(naruszeniaSzkieletu(DOBRY, POLA), [])
})

test('brak odczytu regul, samosprawdzenia, pytania i pola wyniku jest zglaszany', () => {
  const tekst = 'Wdrazasz jednostke.\n\n## Polecenia\n\n- Zwracasz `status`.\n\n## Inne\n\nCzytasz coding-rules: .claude/rules/coding-rules.md\n'
  assert.deepEqual(naruszeniaSzkieletu(tekst, POLA), [
    `brak w poleceniach: ${REGULY_KODU}`,
    'brak w poleceniach: tsc --noEmit',
    'brak w poleceniach: vitest related --run',
    'brak w poleceniach: undefined',
    'pole wyniku bez polecenia: pliki',
    'pole wyniku bez polecenia: odchylenia',
  ])
})

test('drugi format raportu i powtorzona regula kodu sa zglaszane', () => {
  assert.deepEqual(naruszeniaSzkieletu(`${DOBRY}\n## Raport\n\n\`\`\`markdown\n**Status:** completed\n\`\`\`\n`, POLA),
    ['drugi format raportu obok schematu wyniku'])
  assert.deepEqual(naruszeniaSzkieletu(`${DOBRY}- Polityki z (SELECT auth.uid()), wejscie przez z.strictObject.\n`, POLA),
    ['powtorzona tresc regul kodu: auth.uid()', 'powtorzona tresc regul kodu: strictObject'])
})

test('protokol audytu i wersaliki w skillu sa zglaszane, kod i nazwy w backtickach nie', () => {
  assert.deepEqual(protokolAudytu('## Format Raportu\n### Executive Summary\nMysl jak atakujacy'), ['Executive Summary', 'Format Raportu', 'jak atakujacy'])
  assert.deepEqual(protokolAudytu('- Polityka RLS dla kazdej operacji, bo brak polityki to odmowa.'), [])
  assert.deepEqual(wersaliki('**NIGDY NIE ŁAMIESZ** zasad\n```ts\n// ŹLE - NIE!\n```\n`TYLKO` w kodzie, Nie wolno, RLS i SECURITY DEFINER'),
    ['NIGDY', 'NIE'])
})

test('pola BUILD_RESULT czytane z workflowu', () => {
  assert.deepEqual(polaWyniku(), ['id', 'status', 'pliki', 'odchylenia', 'nastepneKroki', 'pytanie'])
})

for (const builder of BUILDERY_ZE_SZKIELETEM) {
  test(`szkielet buildera: ${builder}.md`, () => {
    const tekst = readFileSync(join(REPO, AGENCI, `${builder}.md`), 'utf8')
    assert.deepEqual(naruszeniaSzkieletu(tekst, polaWyniku()), [])
  })
}

const skilleBuilderow = [...new Set([...agenci(REPO)].filter(([n]) => n.startsWith('feature-builder-'))
  .flatMap(([, fm]) => (fm.get('skills') ?? '').replace(/[[\]]/g, '').split(',').map((s) => s.trim()))
  .filter((s) => s && !s.includes(':')))].sort()

test('buildery maja skille z katalogu szablonu (lista do sprawdzen nizej nie jest pusta)', () => {
  assert.ok(skilleBuilderow.includes('security'), `skille builderow: ${skilleBuilderow.join(', ')}`)
})

for (const skill of skilleBuilderow) {
  test(`skill wstrzykiwany builderom bez protokolu audytu: ${skill}`, () => {
    assert.deepEqual(protokolAudytu(readFileSync(join(REPO, '.claude/skills', skill, 'SKILL.md'), 'utf8')), [])
  })
}

for (const skill of SKILLE_BEZ_WERSALIKOW) {
  test(`skill bez krzyku wersalikami: ${skill}`, () => {
    assert.deepEqual(wersaliki(readFileSync(join(REPO, '.claude/skills', skill, 'SKILL.md'), 'utf8')), [])
  })
}
