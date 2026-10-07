// Skill /weryfikacja-setup a skrypt e2e.mjs (P14): polecenia skilla istnieja w CLI, linia wyniku przejscia na zywo jest ta,
// ktora pisze szkielet, a komenda generatora w uwagach bramki gotowosci wskazuje istniejacy skill.
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/skill-weryfikacja-setup.test.mjs

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { szkieletSkilla } from '../szkielet.mjs'
import { KATALOG_SKILLA, KOMENDA_GENERATORA } from '../weryfikacja.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SKILL_MD = readFileSync(join(REPO, '.claude/skills/weryfikacja-setup/SKILL.md'), 'utf8')
const CLI = readFileSync(join(REPO, '.claude/scripts/e2e/e2e.mjs'), 'utf8')

test('komenda generatora wskazuje ten skill', () => {
  assert.equal(KOMENDA_GENERATORA, '/weryfikacja-setup')
  assert.match(SKILL_MD, /^---\nname: weryfikacja-setup\n/)
  assert.ok(existsSync(join(REPO, '.claude/skills', KOMENDA_GENERATORA.slice(1), 'SKILL.md')))
})

test('polecenia e2e.mjs ze skilla istnieja w CLI', () => {
  const polecenia = [...SKILL_MD.matchAll(/node \.claude\/scripts\/e2e\/e2e\.mjs ([a-z-]+)/g)].map((m) => m[1])
  assert.deepEqual([...new Set(polecenia)].sort(), ['sprawdz', 'start', 'stop', 'weryfikacja'])
  for (const p of polecenia) assert.match(CLI, new RegExp(`polecenie === '${p}'|polecenie === 'sprawdz' \\|\\| polecenie === '${p}'`), `e2e.mjs nie obsluguje ${p}`)
})

test('przejscie na zywo: skill podmienia linie, ktora pisze szkielet; wyniki clean | changed | blocked', () => {
  const linia = /^Przejście na żywo: niewykonane$/m.exec(szkieletSkilla(REPO, { wpisowMapy: 0 }))?.[0]
  assert.ok(linia, 'szkielet bez linii wyniku przejscia')
  assert.ok(SKILL_MD.includes(`\`${linia}\``), 'skill nie wskazuje linii ze szkieletu')
  assert.match(SKILL_MD, /Przejście na żywo: <clean\|changed\|blocked>/)
})

test('commit obejmuje katalog skilla projektu; nadpisanie szkieletem tylko na prosbe operatora', () => {
  assert.ok(SKILL_MD.includes(`git add ${KATALOG_SKILLA} `))
  assert.match(SKILL_MD, /`--nadpisz`[^.]*na wyraźną prośbę operatora/)
})
