// Parser planu technicznego (PLAN-POPRAWY P13) na zapisach z realnych planow: adnotacje wykonania dopisane do naglowkow
// i pol, bloki kodu, listy w innym formacie, pusty frontmatter. Zapis niejednoznaczny ma trafic do `problemy`, nie zniknac.
//
// Uruchomienie:  node --test .claude/scripts/plan/__tests__/plan-techniczny.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import { ekranyFigmy, parsujPlan, poleTekstowe, sciezkaOrigin } from '../plan-techniczny.mjs'

/** @param {string} cialo @param {string} [fm] @returns {string} */
const plan = (cialo, fm = 'design_md: null\nfigma_spec: null\nfigma_screens: {}\noperator_prep: null') => `---\n${fm}\n---\n\n# P\n\n${cialo}`

const TABELA = '| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |\n|---|---|---|---|---|\n'

test('naglowek IU z dopiskiem po ** i z myslnikiem: jednostki nie sklejaja sie, pola nie nadpisuja poprzedniej', () => {
  const p = parsujPlan(plan(`### Faza 1 — A

**Zależy od:** Brak

- [ ] **IU-1: Pierwsza** *(adnotacja wykonania: zrobione)*

**Pliki:**

${TABELA}| Stwórz | \`src/a.ts\` | 0 → 10 | — | nowy |

**Delegate to:** feature-builder-data

- [x] **IU-2 — Druga**

**Pliki:**

${TABELA}| Stwórz | \`src/b.ts\` | 0 → 10 | — | nowy |

**Delegate to:** feature-builder-ui
`))
  assert.deepEqual(p.fazy[0].iu.map((iu) => [iu.id, iu.nazwa, iu.delegate, iu.pliki.map((f) => f.sciezka).join()]),
    [['IU-1', 'Pierwsza', 'feature-builder-data', 'src/a.ts'], ['IU-2', 'Druga', 'feature-builder-ui', 'src/b.ts']])
  assert.deepEqual(p.problemy, [])
})

test('naglowek IU nierozpoznany jest problemem planu z numerem linii', () => {
  const p = parsujPlan(plan('### Faza 1 — A\n\n**Zależy od:** Brak\n\n- [ ] **IU-1** Bez dwukropka\n'))
  assert.match(p.problemy[0], /^linia 14: nagłówek jednostki nierozpoznany/)
})

test('blok ``` w Podejsciu: naglowki i pola w srodku nie zamykaja jednostki ani fazy', () => {
  const p = parsujPlan(plan(`### Faza 1 — A

**Zależy od:** Brak

- [ ] **IU-1: Pierwsza**

**Podejście:**
\`\`\`md
## Przykład
**Weryfikacja:**
- [ ] **IU-9: Nie jednostka**
\`\`\`

**Scenariusze testowe:**
- [Unit] a

- [ ] **IU-2: Druga**
`))
  assert.deepEqual(p.fazy[0].iu.map((iu) => iu.id), ['IU-1', 'IU-2'])
  assert.deepEqual(p.fazy[0].iu[0].scenariusze.map((s) => s.tresc), ['a'])
  assert.deepEqual(p.fazy[0].iu[0].weryfikacja, [])
})

test('nieznane pogrubione pole konczy biezace: adnotacja po Weryfikacji nie staje sie checkboxem', () => {
  const p = parsujPlan(plan(`### Faza 1 — A

**Zależy od:** Brak

- [ ] **IU-1: Pierwsza**

**Weryfikacja:**
- \`pnpm test\` przechodzi

**Korekta planu naniesiona przy wykonaniu (IU-1):**
- builder zmienil nazwe pliku
`))
  const iu = p.fazy[0].iu[0]
  assert.deepEqual(iu.weryfikacja.map((w) => w.tresc), ['`pnpm test` przechodzi'])
  assert.deepEqual(iu.problemy, [])
})

test('pole drugi raz w jednostce i „**Pole** (dopisek):” sa problemem, nie cichym nadpisaniem', () => {
  const p = parsujPlan(plan(`### Faza 1 — A

**Zależy od:** Brak

- [ ] **IU-1: Pierwsza**

**Pliki:**

${TABELA}| Stwórz | \`src/a.ts\` | 0 → 10 | — | nowy |

**Pliki (uzupełnienie):**

${TABELA}| Stwórz | \`src/b.ts\` | 0 → 10 | — | nowy |
`))
  assert.match(p.fazy[0].iu[0].problemy.join('\n'), /linia 22: pole „pliki” drugi raz/)
})

test('listy: wciety podpunkt doklejony do pozycji; wcieta bez rodzica, *, numerowana i kontynuacja bez wciecia to problemy', () => {
  const p = parsujPlan(plan(`### Faza 1 — A

**Zależy od:** Brak

- [ ] **IU-1: Pierwsza**

**Scenariusze testowe:**
  - [Unit] wcięty bez rodzica
- [Unit] krok powitalny:
  - pusty stan
  - błąd sieci
  → widać komunikat
* [E2E] \`flow-b\` — gwiazdka
1. [Unit] numerowany
ciąg dalszy bez wcięcia

---

**Operator checklist:**
- [ ] [Manual] QA sprawdza animację
- [ ] Operator: wgranie plików
`))
  const iu = p.fazy[0].iu[0]
  assert.deepEqual(iu.scenariusze.map((s) => s.tresc), ['krok powitalny:; pusty stan; błąd sieci → widać komunikat'])
  assert.equal(iu.problemy.length, 4)
  assert.ok(iu.problemy.every((x) => /pole „scenariusze testowe” — pozycja poza zapisem/.test(x)), iu.problemy.join('\n'))
  assert.deepEqual(iu.operator, ['[Manual] QA sprawdza animację', 'wgranie plików'])
})

test('tabela plikow: \\| w komorce nie przesuwa kolumn, dwa pliki w komorce to problem', () => {
  const p = parsujPlan(plan(`### Faza 1 — A

**Zależy od:** Brak

- [ ] **IU-1: Pierwsza**

**Pliki:**

${TABELA}| Modyfikuj | \`src/a.ts\` | 300 → 330 | eksporty: UI \\| dane | zostaje |
| Stwórz | \`src/b.tsx\`, \`src/c.tsx\` | 0 → 10 | — | nowy |
`))
  const iu = p.fazy[0].iu[0]
  assert.deepEqual(iu.pliki[0], { akcja: 'Modyfikuj', sciezka: 'src/a.ts', dzis: 300, po: 330, wymiary: 'eksporty: UI | dane', werdykt: 'zostaje' })
  assert.match(iu.problemy.join('\n'), /linia 21: kilka plików w jednej komórce/)
})

test('seed z dopiskiem w nawiasie jest rozpoznany; inny zapis seeda to problem', () => {
  const p = parsujPlan(plan(`### Faza 1 — A

**Zależy od:** Brak

- [ ] **IU-1: Pierwsza**

**Scenariusze testowe:**
- [E2E] \`a\` (seed: e2e/seeds/a-seed.sql — trzy zdarzenia) — otwórz → ok
- [E2E] \`b\` (seed: a-seed) — otwórz → ok
`))
  const iu = p.fazy[0].iu[0]
  assert.deepEqual(iu.scenariusze.map((s) => s.seed), ['e2e/seeds/a-seed.sql', null])
  assert.match(iu.problemy.join('\n'), /seed w zapisie innym niż/)
})

test('faza: poziom naglowka, Zależy od i Równolegle z — placeholder szablonu to pusta wartosc', () => {
  const p = parsujPlan(plan('## Faza 1: A\n\n**Zależy od:** Brak\n**Równolegle z:** — *(opcjonalne)*\n\n### Faza 2 — B\n\n**Zależy od:** Faza 1\n**Równolegle z:** Faza 3\n'))
  assert.deepEqual(p.fazy.map((f) => [f.numer, f.poziom, f.zalezyOd, f.rownolegleZ]), [[1, 2, 'Brak', ''], [2, 3, 'Faza 1', 'Faza 3']])
})

test('frontmatter: pusta wartosc i ~ to null, mapa tylko z wcietymi kluczami pod spodem', () => {
  const p = parsujPlan(plan('', 'design_md:\nfigma_spec: ~\nfigma_screens:\n  lista: ./docs/a.png\noperator_prep:\norigin: docs/b/x-requirements.md#etap-2'))
  assert.deepEqual([poleTekstowe(p, 'design_md'), poleTekstowe(p, 'figma_spec'), poleTekstowe(p, 'operator_prep')], [null, null, null])
  assert.deepEqual(ekranyFigmy(p), [['lista', './docs/a.png']])
  assert.equal(sciezkaOrigin(poleTekstowe(p, 'origin')), 'docs/b/x-requirements.md')
  assert.equal(sciezkaOrigin('sesja /zroastuj-mnie 2026-10-01'), null)
})

test('niezamkniety blok kodu jest problemem planu', () => {
  assert.match(parsujPlan(plan('### Faza 1 — A\n\n```\n## X\n')).problemy.join(), /niezamknięty blok kodu/)
})
