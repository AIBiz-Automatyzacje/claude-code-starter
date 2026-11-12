// Importerzy plikow z akcja „Usuń” (znaleziska szablonu 2026-11-02, pkt 33): dashboard E2, run wf_2e0ed17c-f7b, faza 6 — IU-19
// usuwala urgency-badge.tsx importowany przez invite-status-section.tsx, ktory plan usuwal dopiero w IU-32; execute zwrocil
// partial i autopilot stanal. Test odtwarza ten uklad na repo tymczasowym i pilnuje, ze skan nie trafia w sasiednie nazwy.
//
// Uruchomienie:  node --test .claude/scripts/plan/__tests__/importerzy.test.mjs

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { importerzyPliku, uwagiImporterow } from '../importerzy.mjs'
import { parsujPlan } from '../plan-techniczny.mjs'

const ODZNAKA = 'src/components/invites/urgency-badge.tsx'
const SEKCJA = 'src/components/invites/invite-status-section.tsx'
const PLIKI = {
  [ODZNAKA]: 'export const UrgencyBadge = () => null\n',
  'src/components/invites/urgency-badge.test.tsx': "import { UrgencyBadge } from './urgency-badge'\n",
  [SEKCJA]: "import { useState } from 'react'\nimport { UrgencyBadge } from './urgency-badge'\n",
}

/**
 * @param {Record<string, string>} pliki
 * @param {(korzen: string) => void} f
 * @param {{ git?: boolean }} [opcje] git=false: katalog bez repo gita
 */
function wRepo(pliki, f, { git = true } = {}) {
  const korzen = mkdtempSync(join(tmpdir(), 'importerzy-'))
  try {
    for (const [s, t] of Object.entries(pliki)) {
      mkdirSync(dirname(join(korzen, s)), { recursive: true })
      writeFileSync(join(korzen, s), t)
    }
    if (git) {
      execFileSync('git', ['-C', korzen, 'init', '-q'])
      execFileSync('git', ['-C', korzen, 'add', '.'])
    }
    f(korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

/**
 * Plan z jedna faza; jednostka = lista wierszy [akcja, plik].
 * @param {[string, string][][]} jednostki
 * @returns {import('../pola-iu.mjs').Jednostka[]}
 */
function jednostkiPlanu(jednostki) {
  const iu = jednostki.map((wiersze, i) => `- [ ] **IU-${i + 1}: J${i + 1}**\n\n**Pliki:**\n\n`
    + '| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |\n|---|---|---|---|---|\n'
    + wiersze.map(([akcja, plik]) => `| ${akcja} | \`${plik}\` | 1 → ${akcja === 'Usuń' ? '—' : '5'} | — | zostaje |`).join('\n')
    + '\n\n**Delegate to:** feature-builder-ui\n')
  return parsujPlan(`# Plan\n\n## Implementation Units\n\n### Faza 1 — F\n\n**Zależy od:** Brak\n\n${iu.join('\n')}`).fazy[0].iu
}

test('importerzyPliku: import wzgledny, alias, require z rozszerzeniem, reeksport i import katalogu z index', () => {
  wRepo({
    ...PLIKI,
    'src/pages/zaproszenia.tsx': "import { UrgencyBadge } from '@/components/invites/urgency-badge'\n",
    'src/components/lista.tsx': "const { UrgencyBadge } = require('./invites/urgency-badge.tsx')\n",
    'src/components/invites/index.ts': "export * from './urgency-badge'\n",
    'src/components/wieloliniowy.tsx': "import {\n  UrgencyBadge,\n} from './invites/urgency-badge'\n",
    'src/components/tabela/index.tsx': 'export const Tabela = () => null\n',
    'src/pages/raport.tsx': "import { Tabela } from '../components/tabela'\n",
  }, (k) => {
    assert.deepEqual(importerzyPliku(k, ODZNAKA), ['src/components/invites/index.ts', SEKCJA, 'src/components/lista.tsx',
      'src/components/wieloliniowy.tsx', 'src/pages/zaproszenia.tsx'])
    assert.deepEqual(importerzyPliku(k, 'src/components/tabela/index.tsx'), ['src/pages/raport.tsx'])
  })
})

// Weryfikacja partii 26–45, punkt 55 (33): `import(` ze specyfikatorem w nastepnej linii (Prettier przy dlugiej sciezce).
test('importerzyPliku: import( i require( ze specyfikatorem w nastepnej linii; zwykly string w nastepnej linii po innym wywolaniu — nie', () => {
  wRepo({
    ...PLIKI,
    'src/pages/leniwy.tsx': "const Odznaka = lazy(() =>\n  import(\n    '@/components/invites/urgency-badge'\n  ),\n)\n",
    'src/lib/stary.js': "const x = require(\n\n  './../components/invites/urgency-badge'\n)\n",
    // Walidacja 51–55, punkt 60: sciezki wskazuja usuwany plik (od src/lib/ to ../components/…), wiec o wyniku decyduje
    // warunek „linia importu”; wczesniejsza sciezka ./components/… odpadala wczesniej i przypadek niczego nie sprawdzal.
    'src/lib/log.ts': "console.log(\n  '../components/invites/urgency-badge'\n)\n",
    'src/lib/lista.ts': "export const SCIEZKI = [\n  '@/components/invites/urgency-badge',\n]\n",
  }, (k) => assert.deepEqual(importerzyPliku(k, ODZNAKA), [SEKCJA, 'src/lib/stary.js', 'src/pages/leniwy.tsx']))
})

test('importerzyPliku: pomija sam plik, jego test, plik o tej samej nazwie w innym katalogu, paczke, komentarz i plik spoza kodu', () => {
  wRepo({
    [ODZNAKA]: "// stary import: import x from './urgency-badge'\nexport const UrgencyBadge = () => null\n",
    'src/components/invites/urgency-badge.test.tsx': "import { UrgencyBadge } from './urgency-badge'\n",
    'src/components/invites/__tests__/urgency-badge.spec.tsx': "import { UrgencyBadge } from '../urgency-badge'\n",
    'src/components/tasks/urgency-badge.tsx': 'export const X = 1\n',
    'src/components/tasks/lista.tsx': "import { X } from './urgency-badge'\nimport y from './urgency-badge-list'\n",
    'src/lib/paczka.ts': "import badge from 'ui-kit/urgency-badge'\n",
    'src/lib/opis.ts': '// urgency-badge zastapiony przez status-pill\nexport const A = 1\n',
    'docs/notatka.md': "import { UrgencyBadge } from './urgency-badge'\n",
  }, (k) => assert.deepEqual(importerzyPliku(k, ODZNAKA), []))
})

test('uwagiImporterow (dashboard E2): importer usuwany w pozniejszej IU = uwaga z jego nazwa i ta IU', () => {
  const jednostki = jednostkiPlanu([[['Usuń', ODZNAKA], ['Usuń', 'src/components/invites/urgency-badge.test.tsx']], [['Modyfikuj', 'src/app.tsx']], [['Usuń', SEKCJA]]])
  wRepo(PLIKI, (k) => {
    const uwagi = uwagiImporterow(jednostki, k)
    assert.equal(uwagi.length, 1)
    assert.match(uwagi[0], new RegExp(`^IU-1: Usuń \`${ODZNAKA}\` — importerzy, których plan nie zmienia do tej IU: \`${SEKCJA}\` \\(plan zmienia go dopiero w IU-3\\)\\. `))
    assert.match(uwagi[0], /heurystyką/)
  })
})

test('uwagiImporterow: importer poza planem = uwaga „w żadnej IU”; kazdy zalegly importer w jednej uwadze', () => {
  const jednostki = jednostkiPlanu([[['Usuń', ODZNAKA]], [['Usuń', SEKCJA]]])
  wRepo({ ...PLIKI, 'src/pages/zaproszenia.tsx': "import { UrgencyBadge } from '../components/invites/urgency-badge'\n" }, (k) => {
    const uwagi = uwagiImporterow(jednostki, k)
    assert.equal(uwagi.length, 1)
    assert.ok(uwagi[0].includes(`\`${SEKCJA}\` (plan zmienia go dopiero w IU-2), \`src/pages/zaproszenia.tsx\` (plan nie zmienia go w żadnej IU)`), uwagi[0])
  })
})

test('uwagiImporterow: importer usuwany albo modyfikowany w tej samej albo wczesniejszej IU — bez uwagi', () => {
  wRepo(PLIKI, (k) => {
    assert.deepEqual(uwagiImporterow(jednostkiPlanu([[['Usuń', ODZNAKA], ['Modyfikuj', SEKCJA]]]), k), [], 'ta sama IU')
    assert.deepEqual(uwagiImporterow(jednostkiPlanu([[['Usuń', SEKCJA]], [['Usuń', ODZNAKA]]]), k), [], 'wczesniejsza IU')
  })
})

test('uwagiImporterow: plik, ktorego juz nie ma na dysku (faza wykonana), i katalog bez repo gita — bez uwagi', () => {
  const jednostki = jednostkiPlanu([[['Usuń', ODZNAKA]], [['Usuń', SEKCJA]]])
  const poFazie = Object.fromEntries(Object.entries(PLIKI).filter(([sciezka]) => sciezka !== ODZNAKA))
  wRepo(poFazie, (k) => assert.deepEqual(uwagiImporterow(jednostki, k), []))
  wRepo(PLIKI, (k) => assert.deepEqual(uwagiImporterow(jednostki, k), []), { git: false })
})
