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
// Poza pipeline'em: nie wola ich zaden workflow ani skill, usuwane w P11 (PANEL-WYNIK §4a E) — bez allowlisty.
const POZA_PIPELINE = ['kieran-typescript-reviewer', 'code-simplicity-reviewer']
const WBUDOWANE = ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'WebSearch', 'WebFetch', 'Skill']
// Narzedzia serwera MCP pluginu figma 2.2.120 (`.mcp.json` pluginu, ideToolTitles) — plugin wymagany per projekt od P2.
const FIGMA_MCP = ['add_code_connect_map', 'create_new_file', 'generate_diagram', 'generate_figma_design', 'get_code_connect_map',
  'get_code_connect_suggestions', 'get_context_for_code_connect', 'get_design_context', 'get_figjam', 'get_libraries', 'get_metadata',
  'get_screenshot', 'get_variable_defs', 'search_design_system', 'send_code_connect_mappings', 'upload_assets', 'use_figma', 'whoami']
  .map((n) => `mcp__plugin_figma_figma__${n}`)
// Agenci z wariantem `<nazwa>-figma.md` (Figma MCP + skille Figmy); orkiestrator wybiera wariant przy zadaniu z makietami.
// Tester E2E go nie ma: porownuje zrzut z PNG makiety z dysku, Figma MCP nie wola.
const Z_WARIANTEM_FIGMA = ['feature-builder-ui', 'feature-builder-fullstack']
const SUFIKS_FIGMA = '-figma'

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
 * Kazdy agent pipeline'u ma `tools:`, a kazda pozycja to znane narzedzie (literowka = agent bez narzedzia, bez bledu).
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaTools(korzen) {
  const znane = new Set([...WBUDOWANE, ...FIGMA_MCP])
  /** @type {string[]} */
  const wyniki = []
  for (const [nazwa, fm] of agenci(korzen)) {
    if (POZA_PIPELINE.includes(nazwa)) continue
    const lista = narzedzia(fm)
    if (!lista.length) wyniki.push(`${nazwa}: brak tools:`)
    for (const n of lista.filter((x) => !znane.has(x))) wyniki.push(`${nazwa}: nieznane narzedzie ${n}`)
  }
  return wyniki
}

/**
 * @param {string} tekst
 * @returns {string}  tresc pliku agenta po frontmatterze
 */
function tresc(tekst) {
  return tekst.split(/^---$/m).slice(2).join('---')
}

/**
 * MCP w `tools:` tylko w wariantach `-figma`; wariant istnieje dla Z_WARIANTEM_FIGMA, ma tresc identyczna z plikiem bazowym
 * i w `tools:` kazde narzedzie MCP, ktore wymienia jego tresc.
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaMcp(korzen) {
  const katalog = join(korzen, AGENCI)
  const czytaj = (/** @type {string} */ nazwa) => readFileSync(join(katalog, `${nazwa}.md`), 'utf8')
  const wszyscy = agenci(korzen)
  /** @type {string[]} */
  const wyniki = []
  for (const [nazwa, fm] of wszyscy) {
    const mcp = narzedzia(fm).filter((n) => n.startsWith('mcp__'))
    if (!nazwa.endsWith(SUFIKS_FIGMA)) {
      if (mcp.length) wyniki.push(`${nazwa}: MCP poza wariantem ${SUFIKS_FIGMA}`)
      continue
    }
    const bazowy = nazwa.slice(0, -SUFIKS_FIGMA.length)
    if (fm.get('name') !== nazwa) wyniki.push(`${nazwa}: name: inne niz nazwa pliku`)
    if (!wszyscy.has(bazowy)) wyniki.push(`${nazwa}: brak pliku bazowego ${bazowy}`)
    else if (tresc(czytaj(nazwa)) !== tresc(czytaj(bazowy))) wyniki.push(`${nazwa}: tresc rozna od ${bazowy}`)
    const wTresci = new Set(tresc(czytaj(nazwa)).match(/mcp__\w+/g) ?? [])
    for (const n of [...wTresci].filter((x) => !mcp.includes(x))) wyniki.push(`${nazwa}: tresc wola ${n} spoza tools:`)
  }
  for (const nazwa of Z_WARIANTEM_FIGMA) {
    if (!wszyscy.has(`${nazwa}${SUFIKS_FIGMA}`)) wyniki.push(`${nazwa}: brak wariantu ${SUFIKS_FIGMA}`)
  }
  return wyniki
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

test('tools: podlozony agent bez tools: i literowka w nazwie narzedzia sa zglaszane, plik spoza pipeline\'u nie', () => {
  const wynik = naPodlozonym({
    [`${AGENCI}/bez-tools.md`]: '---\nname: bez-tools\n---\n',
    [`${AGENCI}/literowka.md`]: '---\nname: literowka\ntools: Read, Websearch, mcp__plugin_figma_figma__get_screenshot\n---\n',
    [`${AGENCI}/kieran-typescript-reviewer.md`]: '---\nname: kieran-typescript-reviewer\n---\n',
  }, naruszeniaTools)
  assert.deepEqual(wynik.sort(), ['bez-tools: brak tools:', 'literowka: nieznane narzedzie Websearch'])
})

test('tools: kazdy agent pipeline\'u w repo szablonu ma allowliste ze znanych narzedzi', () => {
  assert.deepEqual(naruszeniaTools(REPO), [])
})

test('MCP: podlozone MCP w pliku bazowym, rozna tresc wariantu, narzedzie spoza tools: i brak wariantu sa zglaszane', () => {
  const g = 'mcp__plugin_figma_figma__get_design_context'
  const wynik = naPodlozonym({
    [`${AGENCI}/feature-builder-ui.md`]: `---\nname: feature-builder-ui\ntools: Read, ${g}\n---\nWolaj ${g}.\n`,
    [`${AGENCI}/feature-builder-ui-figma.md`]: '---\nname: feature-builder-ui-figma\ntools: Read\n---\nInna tresc, wolaj mcp__plugin_figma_figma__use_figma.\n',
  }, naruszeniaMcp)
  assert.deepEqual(wynik.sort(), [
    'feature-builder-fullstack: brak wariantu -figma',
    'feature-builder-ui-figma: tresc rozna od feature-builder-ui',
    'feature-builder-ui-figma: tresc wola mcp__plugin_figma_figma__use_figma spoza tools:',
    'feature-builder-ui: MCP poza wariantem -figma',
  ])
})

test('MCP: repo szablonu ma Figma MCP wylacznie w wariantach -figma o tresci plikow bazowych', () => {
  assert.deepEqual(naruszeniaMcp(REPO), [])
})
