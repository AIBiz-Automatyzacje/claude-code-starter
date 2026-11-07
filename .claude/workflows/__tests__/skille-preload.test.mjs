// Skill wymieniony w `skills:` agenta nie ma `paths:` (odbior Etapu 2, sprawy otwarte, pkt 2).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/skille-preload.test.mjs
//
// DLACZEGO: skill z `paths:` laduje sie ze `skills:` tylko wtedy, gdy sesja dotknela wczesniej pasujacego pliku. Builder
// zaczyna prace bez niego, a jego wynik nie zglasza braku (proba z IU-2.1 w planie szablonu mobile, „Rozjazdy z IU-2.1”;
// transkrypty builderow z runow vibersi). Test biegnie tez na kazdym wariancie stacku, bo jest w rdzeniu.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { parse } from 'yaml'

import { AGENCI, naPodlozonym } from './agenci-pipeline.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * @param {string} plik
 * @returns {Record<string, unknown>}  pola frontmattera; `paths:` w tresci pliku (przyklad w dev-compound) sie nie liczy
 */
function frontmatter(plik) {
  const blok = /^---\n([\s\S]*?)\n---$/m.exec(readFileSync(plik, 'utf8'))
  return blok ? parse(blok[1] ?? '') ?? {} : {}
}

/**
 * @param {string} korzen
 * @returns {Map<string, string[]>}  agent → skille ze `skills:`; plugin (`figma:figma-use`) nie lezy w repo, wiec go pomija
 */
function skilleAgentow(korzen) {
  const katalog = join(korzen, AGENCI)
  return new Map(readdirSync(katalog)
    .filter((p) => p.endsWith('.md'))
    .map((p) => {
      const skille = frontmatter(join(katalog, p)).skills
      const lista = Array.isArray(skille) ? skille : typeof skille === 'string' ? [skille] : []
      return [p.slice(0, -'.md'.length), lista.map(String).filter((s) => !s.includes(':'))]
    }))
}

/**
 * @param {string} korzen
 * @returns {string[]}  opisy naruszen; skill bez pliku tez jest naruszeniem, bo inaczej literowka przechodzi po cichu
 */
function naruszeniaPreloadu(korzen) {
  /** @type {string[]} */
  const naruszenia = []
  for (const [agent, skille] of skilleAgentow(korzen)) {
    for (const skill of skille) {
      const plik = join(korzen, '.claude/skills', skill, 'SKILL.md')
      if (!existsSync(plik)) naruszenia.push(`${agent}: skill ${skill} nie istnieje`)
      else if ('paths' in frontmatter(plik)) naruszenia.push(`${agent}: skill ${skill} ma paths:`)
    }
  }
  return naruszenia
}

const skill = (/** @type {string} */ nazwa, /** @type {string} */ pola = '') =>
  ({ [`.claude/skills/${nazwa}/SKILL.md`]: `---\nname: ${nazwa}\n${pola}---\n\n# Skill\n` })
const agent = (/** @type {string} */ nazwa, /** @type {string} */ pole) =>
  ({ [`${AGENCI}/${nazwa}.md`]: `---\nname: ${nazwa}\n${pole}\n---\n\nTresc.\n` })

test('kazdy skill ze skills: agenta istnieje i nie ma paths:', () => {
  assert.deepEqual(naruszeniaPreloadu(REPO), [])
})

test('sprawdzenie obejmuje builderow: czytnik widzi ich skille, a nie pusta liste', () => {
  const skille = skilleAgentow(REPO)
  for (const rola of ['feature-builder-ui', 'feature-builder-data', 'feature-builder-fullstack']) {
    assert.ok((skille.get(rola) ?? []).length > 0, rola)
  }
})

test('podlozony skill z paths: daje naruszenie, takze przy skills: jako liscie blokowej', () => {
  const zPaths = skill('wytyczne', 'paths:\n  - "**/*.tsx"\n')
  const oczekiwane = ['rola: skill wytyczne ma paths:']
  assert.deepEqual(naPodlozonym({ ...zPaths, ...agent('rola', 'skills: [wytyczne]') }, naruszeniaPreloadu), oczekiwane)
  assert.deepEqual(naPodlozonym({ ...zPaths, ...agent('rola', 'skills:\n  - wytyczne') }, naruszeniaPreloadu), oczekiwane)
})

test('podlozony skill spoza skills: agenta moze miec paths:, a paths: w tresci sie nie liczy', () => {
  const drzewo = {
    ...skill('luzny', 'paths:\n  - "**/*.sql"\n'),
    '.claude/skills/wytyczne/SKILL.md': '---\nname: wytyczne\n---\n\n```yaml\n---\npaths:\n  - katalog/**\n---\n```\n',
    ...agent('rola', 'skills: [wytyczne]'),
  }
  assert.deepEqual(naPodlozonym(drzewo, naruszeniaPreloadu), [])
})

test('podlozony skill bez pliku daje naruszenie, a skill pluginu jest pomijany', () => {
  assert.deepEqual(naPodlozonym(agent('rola', 'skills: [literowka, figma:figma-use]'), naruszeniaPreloadu), ['rola: skill literowka nie istnieje'])
})
