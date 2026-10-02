// Test plikow klas rol i allowlist `tools:` agentow pipeline'u (PLAN-POPRAWY P3).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/klasy-rol.test.mjs
//
// DLACZEGO: agent bez `tools:` dziedziczy wszystkie narzedzia sesji razem z MCP — start ~62k tokenow zamiast ~12k
// (POMIARY-ROZSTRZYGNIECIE §1). Allowliste gubi sie po cichu: nowy plik agenta bez `tools:`, MCP dopisane nie temu
// agentowi, mechaniczny bez `omitClaudeMd`. Kazde sprawdzenie ma test na podlozonym zlym pliku w katalogu tymczasowym,
// zeby zielony wynik na repo znaczyl "allowlista jest", a nie "sprawdzenie niczego nie widzi".

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { AGENCI, agenci, naPodlozonym, narzedzia, tresc, typyDynamiczne, wywolaniaAgentow } from './agenci-pipeline.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

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
// Narzedzia serwera MCP pluginu figma 2.2.120 — lista z serwera w sesji (`.mcp.json` pluginu, ideToolTitles, ma tylko czesc,
// np. bez download_assets). Plugin wymagany per projekt od P2.
const FIGMA_MCP = ['add_code_connect_map', 'create_generative_plugin', 'create_new_file', 'create_shader', 'download_assets', 'export_video',
  'generate_diagram', 'generate_figma_design', 'get_code_connect_map', 'get_code_connect_suggestions', 'get_context_for_code_connect',
  'get_design_context', 'get_figjam', 'get_generative_plugin', 'get_libraries', 'get_metadata', 'get_motion_context', 'get_screenshot',
  'get_shader', 'get_variable_defs', 'list_file_components_for_code_connect', 'list_file_shaders', 'list_generative_plugins', 'list_shaders',
  'search_design_system', 'send_code_connect_mappings', 'update_generative_plugin', 'update_shader', 'upload_assets', 'use_figma',
  'weave_cancel_tool_run', 'weave_find_model', 'weave_get_model_run_output', 'weave_get_tool_inputs', 'weave_get_tool_run_output',
  'weave_list_tools', 'weave_run_model', 'weave_run_tool', 'weave_upload_asset', 'whoami']
  .map((n) => `mcp__plugin_figma_figma__${n}`)
// Agenci z wariantem `<nazwa>-figma.md` (Figma MCP + skille Figmy); orkiestrator wybiera wariant przy zadaniu z makietami.
// Tester E2E go nie ma: porownuje zrzut z PNG makiety z dysku, Figma MCP nie wola.
const Z_WARIANTEM_FIGMA = ['feature-builder-ui', 'feature-builder-fullstack']
const SUFIKS_FIGMA = '-figma'

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

// ── Wywolania agent() w workflowach ─────────────────────────────────────────
// agent() bez agentType dziedziczy wszystkie narzedzia sesji (z MCP) i jej model, a `model:` w opcjach omija plik
// klasy. Mapa rola → klasa z HANDOFF 6a pkt 46 (g); etykiety z `${...}` zamienionym na `*`. Rola spoza mapy =
// klasa-orkiestracyjny. Wywolania z typem z pola (reviewerzy, buildery) sprawdza sie po liscie mozliwych typow.
const MAPA_KLAS = /** @type {const} */ ([
  [/^(stop:commit-artefaktow|stan:zapis|e2e:precheck|e2e:env-down|fix:pre-skan:faza-\*|zwin-do-poprawy:faza-\*)$/, 'klasa-mechaniczny'],
  [/^(dedup:semantyczny|scribe:faza-\*:inspekcja)$/, 'klasa-mechaniczny-odczyt'],
  [/^(verify:\*:\*|verify-batch:\*:\*|verify-fix:\*|fix:kontrola:faza-\*)$/, 'klasa-sceptyk'],
  [/^(fix:faza-\*|fix:poprawka:faza-\*|pr:napraw:tura-\*)$/, 'klasa-naprawiacz'],
  [/^review:test-coverage$/, 'test-coverage-reviewer'],
  [/^review:e2e(:retry)?$/, 'feature-tester-e2e'],
])
const KLASA_DOMYSLNA = 'klasa-orkiestracyjny'

/**
 * @param {string} etykieta
 * @returns {string}
 */
function klasaRoli(etykieta) {
  return MAPA_KLAS.find(([wzorzec]) => wzorzec.test(etykieta))?.[1] ?? KLASA_DOMYSLNA
}

/**
 * Kazde agent() ma agentType z istniejacym plikiem agenta, bez `model:` w opcjach, a typ stały zgadza sie z mapa klas.
 * Enum builderow ma warianty -figma.
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaWywolan(korzen) {
  const { wywolania, niezgodnosci } = wywolaniaAgentow(korzen)
  const pliki = agenci(korzen)
  const dynamiczne = typyDynamiczne(korzen)
  const wyniki = [...niezgodnosci]
  for (const w of wywolania) {
    const gdzie = `${w.plik}:${w.linia} ${w.etykieta}`
    const typy = w.agentType ? [w.agentType] : w.agentTypeZPola ? (dynamiczne[w.agentTypeZPola] ?? []) : []
    if (!typy.length) wyniki.push(`${gdzie}: brak agentType`)
    for (const t of typy.filter((x) => !pliki.has(x))) wyniki.push(`${gdzie}: agentType ${t} bez pliku agenta`)
    if (w.agentType && w.agentType !== klasaRoli(w.etykieta)) wyniki.push(`${gdzie}: ${w.agentType}, mapa klas: ${klasaRoli(w.etykieta)}`)
    if (w.maModel) wyniki.push(`${gdzie}: model: w opcjach zamiast w pliku klasy`)
  }
  for (const nazwa of Z_WARIANTEM_FIGMA) {
    if (!(dynamiczne.iu ?? []).includes(`${nazwa}${SUFIKS_FIGMA}`)) wyniki.push(`IU_PLAN: brak ${nazwa}${SUFIKS_FIGMA} w enum agentType`)
  }
  return wyniki
}

test('agent(): podlozone wywolanie bez agentType, z model:, z typem bez pliku i z obca klasa sa zglaszane', () => {
  const wf = [
    "await agent(p, { schema: A, label: 'bootstrap' })",
    "await agent(p, { schema: A, agentType: 'klasa-mechaniczny', label: 'stan:zapis', model: 'haiku' })",
    "await agent(p, { schema: A, agentType: 'general-purpose', label: 'review:correctness' })",
    "await agent(p, { schema: A, agentType: 'klasa-orkiestracyjny', label: `verify-fix:${f.plik}` })",
    'await agent(p,',
    '  { schema: A, agentType: r.agentType, label: `review:${r.key}` })',
    "const REVIEWERZY = [{ key: 'security', agentType: 'security-sentinel' }]",
  ].join('\n')
  const wynik = naPodlozonym({
    [`${AGENCI}/klasa-mechaniczny.md`]: '---\nname: klasa-mechaniczny\n---\n',
    [`${AGENCI}/klasa-orkiestracyjny.md`]: '---\nname: klasa-orkiestracyjny\n---\n',
    '.claude/workflows/dev-docs-review-wf.js': wf,
    '.claude/workflows/dev-docs-execute-wf.js': "agentType: { type: 'string', enum: ['feature-builder-ui-figma'] }",
  }, naruszeniaWywolan)
  assert.deepEqual(wynik, [
    'dev-docs-review-wf.js:1 bootstrap: brak agentType',
    'dev-docs-review-wf.js:2 stan:zapis: model: w opcjach zamiast w pliku klasy',
    'dev-docs-review-wf.js:3 review:correctness: agentType general-purpose bez pliku agenta',
    'dev-docs-review-wf.js:3 review:correctness: general-purpose, mapa klas: klasa-orkiestracyjny',
    'dev-docs-review-wf.js:4 verify-fix:*: klasa-orkiestracyjny, mapa klas: klasa-sceptyk',
    'dev-docs-review-wf.js:6 review:*: agentType security-sentinel bez pliku agenta',
    'IU_PLAN: brak feature-builder-fullstack-figma w enum agentType',
  ])
})

test('agent(): kazde wywolanie w workflowach szablonu ma agentType klasy albo roli z plikiem, bez model:', () => {
  assert.deepEqual(naruszeniaWywolan(REPO), [])
})
