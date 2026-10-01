// Test plikow klas rol i allowlist `tools:` agentow pipeline'u (PLAN-POPRAWY P3).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/klasy-rol.test.mjs
//
// DLACZEGO: agent bez `tools:` dziedziczy wszystkie narzedzia sesji razem z MCP — start ~62k tokenow zamiast ~12k
// (POMIARY-ROZSTRZYGNIECIE §1). Allowliste gubi sie po cichu: nowy plik agenta bez `tools:`, MCP dopisane nie temu
// agentowi, mechaniczny bez `omitClaudeMd`. Kazde sprawdzenie ma test na podlozonym zlym pliku w katalogu tymczasowym,
// zeby zielony wynik na repo znaczyl "allowlista jest", a nie "sprawdzenie niczego nie widzi".

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const AGENCI = '.claude/agents'

// Klasy mechaniczne (haiku, bez CLAUDE.md). Wariant `-odczyt` dla rol, ktore tylko czytaja (dedup, inspekcja) — N1:
// haiku wykonuje przekazana wiadomosc operatora, wiec rola bez potrzeby zapisu nie dostaje Bash/Edit/Write.
const KLASY_MECHANICZNE = ['klasa-mechaniczny', 'klasa-mechaniczny-odczyt']
// Badacze (wolani ze skilli planowania): jedna allowlista w szesciu plikach, bez narzedzi zapisu.
const BADACZE = ['best-practices-researcher', 'framework-docs-researcher', 'learnings-researcher', 'repo-research-analyst',
  'spec-flow-analyzer', 'web-research-specialist']
const NARZEDZIA_ZAPISU = ['Edit', 'Write']

/**
 * Pola frontmattera jako mapa klucz → surowa wartosc (jedna linia).
 * @param {string} tekst
 * @returns {Map<string, string>}
 */
function frontmatter(tekst) {
  const blok = tekst.split(/^---$/m)[1] ?? ''
  return new Map(blok.split('\n')
    .map((linia) => linia.match(/^([\w-]+):\s*(.*)$/))
    .filter((m) => m !== null)
    .map((m) => [m[1] ?? '', (m[2] ?? '').trim()]))
}

/**
 * @param {string} korzen
 * @returns {Map<string, Map<string, string>>}  nazwa agenta → frontmatter
 */
function agenci(korzen) {
  const katalog = join(korzen, AGENCI)
  if (!existsSync(katalog)) return new Map()
  return new Map(readdirSync(katalog)
    .filter((p) => p.endsWith('.md'))
    .map((p) => [p.slice(0, -'.md'.length), frontmatter(readFileSync(join(katalog, p), 'utf8'))]))
}

/**
 * @param {Map<string, string> | undefined} fm
 * @returns {string[]}  narzedzia z `tools:` (lista po przecinku)
 */
function narzedzia(fm) {
  return (fm?.get('tools') ?? '').split(',').map((n) => n.trim()).filter(Boolean)
}

/**
 * Badacze maja identyczna allowliste bez Edit/Write.
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaBadaczy(korzen) {
  const wszyscy = agenci(korzen)
  const wzorzec = narzedzia(wszyscy.get(BADACZE[0])).join(', ')
  /** @type {string[]} */
  const wyniki = []
  for (const nazwa of BADACZE) {
    const lista = narzedzia(wszyscy.get(nazwa))
    if (!lista.length) wyniki.push(`${nazwa}: brak tools:`)
    else if (lista.join(', ') !== wzorzec) wyniki.push(`${nazwa}: tools: inne niz u ${BADACZE[0]}`)
    for (const n of lista.filter((x) => NARZEDZIA_ZAPISU.includes(x))) wyniki.push(`${nazwa}: narzedzie zapisu ${n}`)
  }
  return wyniki
}

/**
 * Klasy mechaniczne istnieja, maja `omitClaudeMd: true` i `model: haiku`; nikt poza nimi nie wycina CLAUDE.md.
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaMechanicznych(korzen) {
  const wszyscy = agenci(korzen)
  /** @type {string[]} */
  const wyniki = []
  for (const nazwa of KLASY_MECHANICZNE) {
    const fm = wszyscy.get(nazwa)
    if (!fm) {
      wyniki.push(`${nazwa}: brak pliku klasy`)
      continue
    }
    if (fm.get('omitClaudeMd') !== 'true') wyniki.push(`${nazwa}: brak omitClaudeMd: true`)
    if (fm.get('model') !== 'haiku') wyniki.push(`${nazwa}: model inny niz haiku`)
  }
  for (const [nazwa, fm] of wszyscy) {
    if (!KLASY_MECHANICZNE.includes(nazwa) && fm.has('omitClaudeMd')) wyniki.push(`${nazwa}: omitClaudeMd poza klasa mechaniczna`)
  }
  return wyniki
}

/**
 * @param {Record<string, string>} drzewo  sciezka wzgledna → tresc
 * @param {(korzen: string) => string[]} sprawdzenie
 * @returns {string[]}
 */
function naPodlozonym(drzewo, sprawdzenie) {
  const korzen = mkdtempSync(join(tmpdir(), 'klasy-rol-'))
  try {
    for (const [sciezka, tresc] of Object.entries(drzewo)) {
      mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
      writeFileSync(join(korzen, sciezka), tresc)
    }
    return sprawdzenie(korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

test('mechaniczni: podlozony brak omitClaudeMd, model opus i omitClaudeMd u reviewera sa zglaszane', () => {
  const wynik = naPodlozonym({
    [`${AGENCI}/klasa-mechaniczny.md`]: '---\nname: klasa-mechaniczny\nmodel: opus\n---\n',
    [`${AGENCI}/klasa-mechaniczny-odczyt.md`]: '---\nname: klasa-mechaniczny-odczyt\nmodel: haiku\nomitClaudeMd: true\n---\n',
    [`${AGENCI}/reviewer.md`]: '---\nname: reviewer\nomitClaudeMd: true\n---\n',
  }, naruszeniaMechanicznych)
  assert.deepEqual(wynik, [
    'klasa-mechaniczny: brak omitClaudeMd: true',
    'klasa-mechaniczny: model inny niz haiku',
    'reviewer: omitClaudeMd poza klasa mechaniczna',
  ])
})

test('mechaniczni: repo szablonu ma obie klasy mechaniczne na haiku bez CLAUDE.md', () => {
  assert.deepEqual(naruszeniaMechanicznych(REPO), [])
})

test('badacze: podlozony brak tools:, inna lista i Write sa zglaszane', () => {
  const plik = (/** @type {string} */ nazwa, /** @type {string} */ tools) => `---\nname: ${nazwa}\n${tools}---\n`
  const drzewo = Object.fromEntries(BADACZE.map((n) => [`${AGENCI}/${n}.md`, plik(n, 'tools: Read, Grep\n')]))
  drzewo[`${AGENCI}/learnings-researcher.md`] = plik('learnings-researcher', '')
  drzewo[`${AGENCI}/web-research-specialist.md`] = plik('web-research-specialist', 'tools: Read, Grep, Write\n')
  assert.deepEqual(naPodlozonym(drzewo, naruszeniaBadaczy), [
    'learnings-researcher: brak tools:',
    'web-research-specialist: tools: inne niz u best-practices-researcher',
    'web-research-specialist: narzedzie zapisu Write',
  ])
})

test('badacze: repo szablonu ma jedna allowliste bez Edit/Write w szesciu plikach', () => {
  assert.deepEqual(naruszeniaBadaczy(REPO), [])
})
