// Wycinki dokumentow zadania do dossier: sekcja fazy (plan techniczny i zadania), wiersze "Sledzenie wymagan" fazy,
// liczba niezaznaczonych [E2E], figma_screens z "Designerski kontekst". Formaty z dev-plan (plan techniczny i generator docs/active/) oraz smoke'a.

import test from 'node:test'
import assert from 'node:assert/strict'

import { czyFigmaScreens, liczE2e, sciezkaPlanu, sekcjaDesignerska, sekcjaFazy, wierszeWymagan } from '../dokumenty.mjs'

const PLAN = `# Plan techniczny

## Śledzenie wymagań

- R1. Suma liczb
- R2. Walidacja wejscia
- R10. Eksport CSV

## Implementation Units

### Faza 1 — Funkcja pomocnicza

**Zależy od:** Brak

- [ ] **IU-1: dodaj**

**Wymagania:** [R1, R2]

#### Szczegoly IU-1

tresc IU-1

### Faza 10 — Eksport

**Wymagania:** [R10]

## Wpływ systemowy

Brak.
`

test('sekcjaFazy: od naglowka fazy do nastepnego naglowka tego samego albo wyzszego poziomu; Faza 1 to nie Faza 10', () => {
  const sekcja = sekcjaFazy(PLAN, 1) ?? ''
  assert.ok(sekcja.startsWith('### Faza 1 — Funkcja pomocnicza'))
  assert.match(sekcja, /#### Szczegoly IU-1\n\ntresc IU-1/, 'podnaglowki fazy zostaja w sekcji')
  assert.doesNotMatch(sekcja, /Faza 10/)
  const sekcja10 = sekcjaFazy(PLAN, 10) ?? ''
  assert.ok(sekcja10.startsWith('### Faza 10 — Eksport'))
  assert.doesNotMatch(sekcja10, /Wpływ systemowy/, 'naglowek wyzszego poziomu konczy sekcje')
})

test('sekcjaFazy: naglowek z dwukropkiem (smoke) i brak fazy = null', () => {
  assert.equal(sekcjaFazy('## Faza 2: Dane\n\ntresc\n\n## Faza 3: UI\n', 2), '## Faza 2: Dane\n\ntresc')
  assert.equal(sekcjaFazy(PLAN, 4), null)
})

test('wierszeWymagan: tylko wiersze z ID przywolanymi w sekcji fazy (R1 to nie R10); lista i tabela', () => {
  assert.equal(wierszeWymagan(PLAN, sekcjaFazy(PLAN, 1) ?? ''), '- R1. Suma liczb\n- R2. Walidacja wejscia')
  assert.equal(wierszeWymagan(PLAN, sekcjaFazy(PLAN, 10) ?? ''), '- R10. Eksport CSV')
  const tabela = '## Sledzenie wymagan\n\n| ID | Wymaganie |\n|---|---|\n| R1 | suma |\n| R2 | walidacja |\n'
  assert.equal(wierszeWymagan(tabela, 'Wymagania: R2'), '| ID | Wymaganie |\n|---|---|\n| R2 | walidacja |', 'naglowek tabeli zostaje')
})

test('wierszeWymagan: brak sekcji albo brak ID w fazie = null', () => {
  assert.equal(wierszeWymagan('# Plan\n\n### Faza 1\n', 'Wymagania: R1'), null)
  assert.equal(wierszeWymagan(PLAN, '### Faza 1\nbez wymagan'), null)
})

test('liczE2e: niezaznaczone [E2E] z prefiksow Test: i Weryfikacja: w kolumnie 0; bez zaznaczonych, wcietych, Operator: i pozycji findingow', () => {
  const zadania = [
    '## Faza 2 — UI',
    '- [ ] Test: [E2E] logowanie dziala',
    '- [ ] Weryfikacja: [E2E] widok na telefonie',
    '- [x] Test: [E2E] juz przeszedl',
    '- [ ] Operator: [E2E] kopia dla operatora',
    '- [ ] [P2] [E2E] finding z review',
    '- [ ] Test: [Unit] suma',
    '- [ ] Weryfikacja: CLI typecheck',
    '  - [ ] Test: [E2E] wciety — grep konsumentow go nie widzi',
  ].join('\n')
  assert.equal(liczE2e(zadania), 2)
  assert.equal(liczE2e('## Faza 1\n- [ ] Test: [Unit] x'), 0)
})

const KONTEKST_Z_MAKIETAMI = `# Kontekst

## Designerski kontekst

- **DESIGN.md (projekt-wide):** ./docs/DESIGN.md
- **SPEC.md (per-feature, pomiary z Figmy):** null
- **Screeny referencyjne:**
  - \`home\`: \`./docs/plans/x-figma/home.png\`

## Dziennik
`

test('sekcjaDesignerska i czyFigmaScreens: makiety = co najmniej jeden screen z obrazem; "Brak" i null = false', () => {
  const sekcja = sekcjaDesignerska(KONTEKST_Z_MAKIETAMI)
  assert.ok(sekcja?.startsWith('## Designerski kontekst'))
  assert.doesNotMatch(sekcja ?? '', /Dziennik/)
  assert.equal(czyFigmaScreens(sekcja), true)
  assert.equal(czyFigmaScreens(sekcjaDesignerska('## Designerski kontekst\n\nBrak — zadanie nie dotyka UI.\n')), false)
  assert.equal(czyFigmaScreens(sekcjaDesignerska('## Designerski kontekst\n\n- **DESIGN.md:** ./docs/DESIGN.md\n- **Screeny referencyjne:** \n')), false)
  assert.equal(czyFigmaScreens(null), false)
})

test('sciezkaPlanu: linia "Plan techniczny:" (zwykla, pogrubiona, w backtickach); brak = null', () => {
  assert.equal(sciezkaPlanu('# Plan\n\nPlan techniczny: docs/plans/p.md\n'), 'docs/plans/p.md')
  assert.equal(sciezkaPlanu('## Źródła\n- **Plan techniczny:** `docs/plans/2026-01-01-001-feat-x-plan.md`\n'), 'docs/plans/2026-01-01-001-feat-x-plan.md')
  assert.equal(sciezkaPlanu('# Plan bez zrodel\n'), null)
})
