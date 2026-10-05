// Test spojnosci odwolan maszynerii (.claude/): kazde odwolanie w workflowach, agentach i skillach wskazuje cos, co istnieje.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/odwolania.test.mjs
//
// DLACZEGO (PLAN-POPRAWY P0): paczki P1–P16 usuwaja i przenosza skille, agentow i reguly. Martwe odwolanie nie wysypuje
// zadnego testu — wychodzi dopiero w runie (agentType bez pliku, workflow('<x>') bez rejestracji, sciezka do nieistniejacego
// SKILL.md w prompcie). Kazde sprawdzenie ma test na podlozonym zlym odwolaniu w katalogu tymczasowym, zeby zielony wynik
// na repo znaczyl "brak martwych odwolan", a nie "sprawdzenie niczego nie widzi".

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// Typy agentow wbudowane w Claude Code (bez pliku w .claude/agents/), uzywane w workflowach szablonu.
const AGENCI_WBUDOWANI = ['general-purpose']

/**
 * @param {string} katalog
 * @param {(nazwa: string) => boolean} filtr
 * @returns {string[]}
 */
function pliki(katalog, filtr) {
  if (!existsSync(katalog)) return []
  return readdirSync(katalog, { recursive: true, encoding: 'utf8' })
    .filter((p) => !p.includes('__tests__') && filtr(p))
    .map((p) => join(katalog, p))
}

/**
 * @param {string} korzen
 * @returns {{ workflowy: string[], agenci: string[], skille: string[] }}
 */
function zrodla(korzen) {
  return {
    workflowy: pliki(join(korzen, '.claude/workflows'), (p) => p.endsWith('.js')),
    agenci: pliki(join(korzen, '.claude/agents'), (p) => p.endsWith('.md')),
    skille: pliki(join(korzen, '.claude/skills'), (p) => p.endsWith('.md')),
  }
}

/**
 * @param {string} tekst
 * @param {RegExp} wzorzec  z jedna grupa przechwytujaca
 * @returns {string[]}
 */
function trafienia(tekst, wzorzec) {
  return [...tekst.matchAll(wzorzec)].map((m) => m[1] ?? '')
}

/**
 * agentType w workflowach (literal i enum schematu IU_PLAN) oraz subagent_type w skillach → plik agenta albo wbudowany.
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaAgentow(korzen) {
  const { workflowy, skille } = zrodla(korzen)
  const istniejace = new Set([...AGENCI_WBUDOWANI, ...pliki(join(korzen, '.claude/agents'), (p) => p.endsWith('.md'))
    .map((p) => p.slice(p.lastIndexOf('/') + 1, -'.md'.length))])
  /** @type {string[]} */
  const wyniki = []
  for (const plik of workflowy) {
    const tekst = readFileSync(plik, 'utf8')
    const enumy = trafienia(tekst, /agentType:\s*\{[^}]*?enum:\s*\[([^\]]*)\]/g)
      .flatMap((lista) => trafienia(lista, /'([^']+)'/g))
    for (const nazwa of [...trafienia(tekst, /agentType:\s*'([^']+)'/g), ...enumy]) {
      if (!istniejace.has(nazwa)) wyniki.push(`${relative(korzen, plik)}: agentType '${nazwa}' bez pliku w .claude/agents/`)
    }
  }
  for (const plik of skille) {
    for (const nazwa of trafienia(readFileSync(plik, 'utf8'), /subagent_type:\s*"([^"]+)"/g)) {
      if (!istniejace.has(nazwa)) wyniki.push(`${relative(korzen, plik)}: subagent_type "${nazwa}" bez pliku w .claude/agents/`)
    }
  }
  return wyniki
}

/**
 * Sciezki .claude/<katalog>/... w workflowach, agentach i skillach → plik lub katalog istnieje. Wzorce (*, <nazwa>, {x}) pomijane.
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaSciezek(korzen) {
  const { workflowy, agenci, skille } = zrodla(korzen)
  /** @type {string[]} */
  const wyniki = []
  for (const plik of [...workflowy, ...agenci, ...skille]) {
    const sciezki = trafienia(readFileSync(plik, 'utf8'), /(\.claude\/(?:agents|hooks|rules|scripts|skills|templates|workflows)\/[\w.*<>{}/-]+)/g)
      .map((s) => s.replace(/\.+$/, ''))
      .filter((s) => !/[*<>{}]/.test(s))
    for (const sciezka of new Set(sciezki)) {
      if (!existsSync(join(korzen, sciezka))) wyniki.push(`${relative(korzen, plik)}: ${sciezka} nie istnieje`)
    }
  }
  return wyniki
}

/**
 * workflow('<x>') → workflow z `meta.name` = <x> (runtime rejestruje po nazwie z meta, nie po nazwie pliku).
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaWorkflowow(korzen) {
  const { workflowy } = zrodla(korzen)
  const teksty = workflowy.map((plik) => ({ plik, tekst: readFileSync(plik, 'utf8') }))
  const nazwy = new Set(teksty.flatMap(({ tekst }) => trafienia(tekst, /export const meta = \{\s*name:\s*'([^']+)'/g)))
  return teksty.flatMap(({ plik, tekst }) => trafienia(tekst, /\bworkflow\(\s*'([^']+)'/g)
    .filter((nazwa) => !nazwy.has(nazwa))
    .map((nazwa) => `${relative(korzen, plik)}: workflow('${nazwa}') bez workflowu o tej nazwie w meta`))
}

/**
 * `skills:` we frontmatterze agentow → katalog .claude/skills/<x>/ albo skill pluginu (prefiks `<plugin>:`).
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaSkilliAgentow(korzen) {
  const { agenci } = zrodla(korzen)
  return agenci.flatMap((plik) => {
    const frontmatter = readFileSync(plik, 'utf8').split(/^---$/m)[1] ?? ''
    return trafienia(frontmatter, /^skills:\s*\[([^\]]*)\]/gm)
      .flatMap((lista) => lista.split(',').map((s) => s.trim()).filter(Boolean))
      .filter((nazwa) => !nazwa.includes(':') && !existsSync(join(korzen, '.claude/skills', nazwa, 'SKILL.md')))
      .map((nazwa) => `${relative(korzen, plik)}: skill '${nazwa}' bez .claude/skills/${nazwa}/SKILL.md`)
  })
}

/**
 * @param {Record<string, string>} drzewo  sciezka wzgledna → tresc
 * @returns {string}
 */
function podlozRepo(drzewo) {
  const korzen = mkdtempSync(join(tmpdir(), 'odwolania-'))
  for (const [sciezka, tresc] of Object.entries(drzewo)) {
    mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
    writeFileSync(join(korzen, sciezka), tresc)
  }
  return korzen
}

/**
 * @param {Record<string, string>} drzewo
 * @param {(korzen: string) => string[]} sprawdzenie
 * @returns {string[]}
 */
function naPodlozonym(drzewo, sprawdzenie) {
  const korzen = podlozRepo(drzewo)
  try {
    return sprawdzenie(korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

test('agentType: podlozony literal, enum IU_PLAN i subagent_type bez pliku agenta sa zglaszane', () => {
  const wynik = naPodlozonym({
    '.claude/agents/istniejacy.md': '---\nname: istniejacy\n---\n',
    '.claude/workflows/x-wf.js': "agent('p', { agentType: 'brak-literal' })\nagent('p', { agentType: 'istniejacy' })\n"
      + "const S = { agentType: { type: 'string', enum: ['istniejacy', 'brak-enum'] } }\nagent('p', { agentType: 'general-purpose' })\n",
    '.claude/skills/s/SKILL.md': 'subagent_type: "brak-skill"\nsubagent_type: "istniejacy"\n',
  }, naruszeniaAgentow)
  assert.equal(wynik.length, 3, wynik.join('\n'))
  assert.match(wynik.join('\n'), /'brak-literal'[\s\S]*'brak-enum'[\s\S]*"brak-skill"/)
})

test('agentType: repo szablonu nie ma martwych odwolan do agentow', () => {
  assert.deepEqual(naruszeniaAgentow(REPO), [])
})

test('sciezki .claude/: podlozona sciezka do nieistniejacego skilla i reguly jest zglaszana (takze stary plik regul projektu), wzorce nie', () => {
  const wynik = naPodlozonym({
    '.claude/skills/jest/SKILL.md': 'Czytaj .claude/skills/jest/SKILL.md i .claude/skills/usuniety/SKILL.md.\n',
    '.claude/agents/a.md': 'Regula: `.claude/rules/brak.md`. Wzorzec .claude/skills/<nazwa>/SKILL.md, .claude/workflows/*.js.\n'
      + 'Tworzy dev-compound: .claude/rules/learned-patterns.md\n',
    '.claude/workflows/x-wf.js': "const P = '.claude/workflows/x-wf.js'\n",
  }, naruszeniaSciezek)
  assert.deepEqual(wynik, [
    '.claude/agents/a.md: .claude/rules/brak.md nie istnieje',
    '.claude/agents/a.md: .claude/rules/learned-patterns.md nie istnieje',
    '.claude/skills/jest/SKILL.md: .claude/skills/usuniety/SKILL.md nie istnieje',
  ])
})

test('sciezki .claude/: repo szablonu nie ma martwych sciezek', () => {
  assert.deepEqual(naruszeniaSciezek(REPO), [])
})

test('workflow(): podlozone wywolanie workflowu bez meta.name jest zglaszane', () => {
  const wynik = naPodlozonym({
    '.claude/workflows/a-wf.js': "export const meta = {\n  name: 'a-wf',\n}\nawait workflow('b-wf', {})\nawait workflow('usuniety-wf', {})\n",
    '.claude/workflows/b.js': "export const meta = {\n  name: 'b-wf',\n}\n",
  }, naruszeniaWorkflowow)
  assert.deepEqual(wynik, [".claude/workflows/a-wf.js: workflow('usuniety-wf') bez workflowu o tej nazwie w meta"])
})

test('workflow(): repo szablonu nie wola nieistniejacych workflowow', () => {
  assert.deepEqual(naruszeniaWorkflowow(REPO), [])
})

test('skills: agentow: podlozony skill bez katalogu jest zglaszany, skill pluginu nie', () => {
  const wynik = naPodlozonym({
    '.claude/skills/jest/SKILL.md': '---\nname: jest\n---\n',
    '.claude/agents/a.md': '---\nname: a\nskills: [jest, figma:figma-use, usuniety]\n---\nskills: [poza-frontmatterem]\n',
  }, naruszeniaSkilliAgentow)
  assert.deepEqual(wynik, [".claude/agents/a.md: skill 'usuniety' bez .claude/skills/usuniety/SKILL.md"])
})

test('skills: agentow: repo szablonu nie ma martwych skilli', () => {
  assert.deepEqual(naruszeniaSkilliAgentow(REPO), [])
})
