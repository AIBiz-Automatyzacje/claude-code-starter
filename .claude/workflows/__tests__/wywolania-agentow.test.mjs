// Test wywolan agent() w workflowach: agentType klasy albo roli i efort z tabeli D6 (PLAN-POPRAWY P3).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/wywolania-agentow.test.mjs
//
// DLACZEGO: pliki klas ról (klasy-rol.test.mjs) dzialaja tylko wtedy, gdy workflow wola je przez agentType — agent()
// bez niego dziedziczy wszystkie narzedzia sesji i jej model. Kazde sprawdzenie ma test na podlozonym zlym zrodle.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { AGENCI, agenci, naPodlozonym, typyDynamiczne, wywolaniaAgentow } from './agenci-pipeline.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
// Buildery z wariantem `<nazwa>-figma` (klasy-rol.test.mjs) — planner wybiera wariant przy zadaniu z makietami.
const Z_WARIANTEM_FIGMA = ['feature-builder-ui', 'feature-builder-fullstack']
const SUFIKS_FIGMA = '-figma'

// agent() bez agentType dziedziczy wszystkie narzedzia sesji (z MCP) i jej model, a `model:` w opcjach omija plik
// klasy. Mapa rola → klasa z HANDOFF 6a pkt 46 (g); etykiety z `${...}` zamienionym na `*`. Rola spoza mapy =
// klasa-orkiestracyjny. Wywolania z typem z pola (reviewerzy, buildery) sprawdza sie po liscie mozliwych typow.
const MAPA_KLAS = /** @type {const} */ ([
  [/^(stop:commit-artefaktow|start:commit-zadania|start:p3-known-issues|complete:uwaga-pr:\*|pr:claude-md-commit:\*|stan:zapis|e2e:start|e2e:start:retry|e2e:env-down|dossier:zapas)$/, 'klasa-mechaniczny'],
  [/^(dedup:semantyczny|scribe:faza-\*:inspekcja)$/, 'klasa-mechaniczny-odczyt'],
  [/^(verify:\*:\*|verify-batch:\*:\*|fix:kontrola:faza-\*)$/, 'klasa-sceptyk'],
  [/^(fix:faza-\*|fix:poprawka:faza-\*|pr:napraw:tura-\*)$/, 'klasa-naprawiacz'],
  [/^review:test-coverage$/, 'test-coverage-reviewer'],
  [/^review:spec-compliance$/, 'spec-compliance-reviewer'],
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
    "await agent(p, { schema: A, agentType: 'klasa-orkiestracyjny', label: `verify:${k}:${f.plik}` })",
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
    'dev-docs-review-wf.js:4 verify:*:*: klasa-orkiestracyjny, mapa klas: klasa-sceptyk',
    'dev-docs-review-wf.js:6 review:*: agentType security-sentinel bez pliku agenta',
    'IU_PLAN: brak feature-builder-fullstack-figma w enum agentType',
  ])
})

test('agent(): kazde wywolanie w workflowach szablonu ma agentType klasy albo roli z plikiem, bez model:', () => {
  assert.deepEqual(naruszeniaWywolan(REPO), [])
})

// ── Efort jawny (PANEL-WYNIK D6, PLAN-POPRAWY P3) ──────────────────────────
// Bez efortu w opcjach agent bierze efort sesji, ktora operator akurat otworzyl — koszt i jakosc review zalezaly
// od tego (smoke R0: 20× medium). Efort siedzi w opcjach agent() (w review przez TIERY_DOMYSLNE), nie w plikach klas:
// sceptyk i orkiestracyjny potrzebuja roznych efortow per rola, a pierwszenstwo pliku nad opcja nie jest udokumentowane.
// Haiku (klasy mechaniczne) bez efortu. Role z plikow (reviewerzy, tester E2E, buildery) — high.
const EFORT_KLASY = /** @type {Record<string, string | null>} */ ({
  'klasa-orkiestracyjny': 'medium', 'klasa-naprawiacz': 'high', 'klasa-sceptyk': 'high', 'klasa-mechaniczny': null, 'klasa-mechaniczny-odczyt': null,
})
const EFORT_ROLI = 'high'
// Wyjatki w klasie: scribe przepisuje (low), sceptyk P2 jeden plik (medium), kontrola diffu fixa — medium od P8
// (listy K-1…K-7, katalog A: opus medium; wczesniej low). Packager (kontekst:diff, low) zniknal w P7.
// Reviewerzy spec i test-coverage — medium od P11 (katalog A: polecenia-listy z wejsciem z dossier zamiast przegladu
// wlasnym osadem; PANEL K1, K2).
const EFORT_WYJATKI = /** @type {const} */ ([
  [/^scribe:faza-\*(:retry)?$/, 'low'], [/^verify-batch:/, 'medium'], [/^fix:kontrola:/, 'medium'],
  [/^review:(spec-compliance|test-coverage)$/, 'medium'],
])

/**
 * @param {import('./agenci-pipeline.mjs').Wywolanie} w
 * @returns {string | null}
 */
function efortOczekiwany(w) {
  const wyjatek = EFORT_WYJATKI.find(([wzorzec]) => wzorzec.test(w.etykieta))
  if (wyjatek) return wyjatek[1]
  const typ = w.agentType ?? ''
  return typ in EFORT_KLASY ? (EFORT_KLASY[typ] ?? null) : EFORT_ROLI
}

/**
 * @param {string} korzen
 * @returns {string[]}
 */
function naruszeniaEfortu(korzen) {
  return wywolaniaAgentow(korzen).wywolania
    .filter((w) => w.effort !== efortOczekiwany(w))
    .map((w) => `${w.plik}:${w.linia} ${w.etykieta}: effort ${w.effort ?? 'brak'}, tabela D6: ${efortOczekiwany(w) ?? 'brak'}`)
}

test('efort: podlozony brak efortu, efort u haiku i nieznany tier sa zglaszane', () => {
  const wynik = naPodlozonym({
    '.claude/workflows/a-wf.js': [
      "const TIERY_DOMYSLNE = { reviewer: 'high', sceptykP2: null }",
      "agent(p, { schema: A, agentType: 'klasa-orkiestracyjny', label: 'bootstrap' })",
      "agent(p, { schema: A, agentType: 'klasa-mechaniczny', label: 'stan:zapis', effort: 'low' })",
      "agent(p, zEffortem({ schema: A, agentType: 'klasa-sceptyk', label: `verify-batch:${k}:${n}` }, tiery.sceptykP2))",
      "agent(p, zEffortem({ schema: A, agentType: 'klasa-sceptyk', label: `verify:${f}:${i}` }, tiery.sceptykP1))",
      "agent(p, zEffortem({ schema: A, agentType: r.agentType, label: `review:${r.key}` }, tiery.reviewer))",
    ].join('\n'),
  }, naruszeniaEfortu)
  assert.deepEqual(wynik, [
    'a-wf.js:2 bootstrap: effort brak, tabela D6: medium',
    'a-wf.js:3 stan:zapis: effort low, tabela D6: brak',
    'a-wf.js:4 verify-batch:*:*: effort brak, tabela D6: medium',
    'a-wf.js:5 verify:*:*: effort brak, tabela D6: high',
  ])
})

test('efort: kazde wywolanie agent() w workflowach szablonu ma efort z tabeli D6', () => {
  assert.deepEqual(naruszeniaEfortu(REPO), [])
})
