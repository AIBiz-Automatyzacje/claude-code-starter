// Walidacja planu technicznego przed generowaniem docs/active/ (PLAN-POPRAWY P13): kazda regula ma test na podlozonym
// zlym planie, a fixture z kompletnym planem przechodzi bez bledow.
//
// Uruchomienie:  node --test .claude/scripts/plan/__tests__/walidacja-planu.test.mjs

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { parsujPlan } from '../plan-techniczny.mjs'
import { liczLinieKodu } from '../budzet-pliku.mjs'
import { PROG_ESLINT, sprawdzPlan } from '../walidacja-planu.mjs'

const FIXTURE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/plan-techniczny.md'), 'utf8')

/** @param {number} n @returns {string} n linii kodu */
const linie = (n) => 'const x = 1\n'.repeat(n)

/** @param {Record<string, string>} [dodatkowe] @returns {string} projekt z plikami, na ktore wskazuje fixture */
function projekt(dodatkowe = {}) {
  const korzen = mkdtempSync(join(tmpdir(), 'walidacja-planu-'))
  const pliki = {
    'docs/DESIGN.md': '#\n',
    'docs/plans/publikacja-ofert-figma/SPEC.md': '#\n',
    'docs/plans/publikacja-ofert-figma/lista-ofert.png': 'png',
    'src/services/oferty-service.ts': linie(12),
    'src/features/oferty/components/lista-ofert.tsx': linie(8),
    '.env.e2e': 'X=1\n',
    'docs/brainstorms/2026-10-01-publikacja-ofert-requirements.md': '# Wymagania\n',
    'docs/operator/publikacja-ofert-przygotowanie.md': '# Przygotowanie\n',
    ...dodatkowe,
  }
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
    writeFileSync(join(korzen, sciezka), tresc)
  }
  return korzen
}

/**
 * @param {string} md
 * @param {Record<string, string>} [dodatkowe]
 * @returns {{ bledy: string[], uwagi: string[] }}
 */
function sprawdz(md, dodatkowe) {
  const korzen = projekt(dodatkowe)
  try {
    return sprawdzPlan(parsujPlan(md), korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

/** @param {string} z @param {string} na @returns {string} fixture z jedna podmiana (podmiana musi trafic) */
function zmien(z, na, md = FIXTURE) {
  assert.ok(md.includes(z), `fixture nie zawiera: ${z}`)
  return md.replace(z, na)
}

const WIERSZ_SERWISU = '| Modyfikuj | `src/services/oferty-service.ts` | 12 → 60 | — | zostaje |'

test('kompletny plan z fixture przechodzi bez bledow i uwag', () => {
  assert.deepEqual(sprawdz(FIXTURE), { bledy: [], uwagi: [] })
})

test('IU z lista plikow zamiast tabeli (dlugosc, przyrost, werdykt) jest odrzucony', () => {
  const md = zmien(`| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Modyfikuj | \`src/features/oferty/components/lista-ofert.tsx\` | 8 → 40 | — | zostaje |
| Test (unit) | \`src/features/oferty/components/lista-ofert.test.tsx\` | 0 → 50 | — | nowy |`,
  '- Modyfikuj: `src/features/oferty/components/lista-ofert.tsx`\n- Test (unit): `src/features/oferty/components/lista-ofert.test.tsx`')
  assert.deepEqual(sprawdz(md).bledy, ['IU-2: pole Pliki bez tabeli (Akcja | Plik | Linie dziś → po | Wymiary | Werdykt)'])
})

test('IU bez plikow jest odrzucony: bootstrap uznalby faze za wykonana bez kodu', () => {
  const md = zmien('**Pliki:**\n\n| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |\n|---|---|---|---|---|\n| Stwórz | `src/pages/oferta-publiczna.tsx` | 0 → 90 | — | nowy |\n'
    + '| Stwórz | `src/hooks/use-oferta-publiczna.ts` | 0 → 40 | — | nowy |\n| Test (unit) | `src/hooks/use-oferta-publiczna.test.ts` | 0 → 60 | — | nowy |\n', '')
  assert.ok(sprawdz(md).bledy.includes('IU-3: brak plików w polu Pliki'))
})

test('scenariusz [Unit] bez pliku testu w tabeli jest odrzucony (blok regul i D10 liczony z pola Pliki)', () => {
  const md = zmien('| Test (unit) | `src/services/oferty-service.test.ts` | 0 → 80 | — | nowy |\n', '')
  assert.deepEqual(sprawdz(md).bledy, ['IU-1: scenariusze [Unit] bez pliku testu w polu Pliki'])
})

test('Modyfikuj na plik, ktorego nie ma w repo, jest odrzucony', () => {
  const md = zmien(WIERSZ_SERWISU, '| Modyfikuj | `src/services/brak-service.ts` | 12 → 60 | — | zostaje |')
  assert.deepEqual(sprawdz(md).bledy, ['IU-1: Modyfikuj `src/services/brak-service.ts` — pliku nie ma w repo ani we wcześniejszej jednostce planu'])
})

test('dlugosc "dzis" rozjechana z plikiem o wiecej niz 20% i 10 linii jest odrzucona z faktyczna liczba', () => {
  const wynik = sprawdz(FIXTURE, { 'src/services/oferty-service.ts': linie(40) })
  assert.deepEqual(wynik.bledy, ['IU-1: `src/services/oferty-service.ts` ma 40 linii kodu (bez pustych i komentarzy, jak ESLint), tabela podaje 12'])
})

test(`plik kodu powyzej ${PROG_ESLINT} linii po zmianie jest odrzucony (prog ESLint max-lines)`, () => {
  const md = zmien(WIERSZ_SERWISU, '| Modyfikuj | `src/services/oferty-service.ts` | 12 → 400 | powody zmiany: 3 | zostaje |')
  assert.match(sprawdz(md).bledy.join('\n'), /IU-1: `src\/services\/oferty-service\.ts` po zmianie 400 linii > 360/)
})

test('plik kodu 301–360 linii po zmianie wymaga ocenionych wymiarow; z wymiarami przechodzi', () => {
  const bez = zmien(WIERSZ_SERWISU, '| Modyfikuj | `src/services/oferty-service.ts` | 12 → 330 | — | zostaje |')
  assert.deepEqual(sprawdz(bez).bledy, ['IU-1: `src/services/oferty-service.ts` po zmianie 330 linii > 300 — oceń wymiary (powody zmiany, eksporty między warstwami, importy z wielu domen, test-lustro, reguła 5 s)'])
  const z = zmien(WIERSZ_SERWISU, '| Modyfikuj | `src/services/oferty-service.ts` | 12 → 330 | powody zmiany: 1; eksporty tylko do warstwy danych | zostaje |')
  assert.deepEqual(sprawdz(z).bledy, [])
})

test('plik SQL i markdown nie podlega progowi linii kodu', () => {
  const md = zmien('| 0 → 25 |', '| 0 → 900 |')
  assert.deepEqual(sprawdz(md).bledy, [])
})

test('werdykt "wydziel" bez wiersza Stwórz nowego modulu jest odrzucony', () => {
  const md = zmien(`| Stwórz | \`src/pages/oferta-publiczna.tsx\` | 0 → 90 | — | nowy |
| Stwórz | \`src/hooks/use-oferta-publiczna.ts\` | 0 → 40 | — | nowy |`,
  '| Modyfikuj | `src/features/oferty/components/lista-ofert.tsx` | 40 → 30 | powody zmiany: 2 | wydziel `oferta-publiczna` przed dodaniem strony |')
  assert.deepEqual(sprawdz(md).bledy, ['IU-3: werdykt „wydziel” bez wiersza Stwórz dla nowego modułu'])
})

test('fazy: litera zamiast numeru, luka w numeracji, faza bez IU i bez "Zależy od", IU poza faza', () => {
  assert.deepEqual(sprawdz(zmien('### Faza 2 — Przycisk na liście', '### Faza B — Przycisk na liście')).bledy,
    ['faza „B”: numeracja faz liczbami od 1 bez luk (1, 2, …)'])
  assert.deepEqual(sprawdz(zmien('### Faza 2 — Przycisk na liście', '### Faza 3 — Przycisk na liście')).bledy,
    ['faza 3: numeracja faz liczbami od 1 bez luk (1, 2, …)'])
  assert.deepEqual(sprawdz(zmien('**Zależy od:** Faza 1\n', '')).bledy, ['faza 2: brak linii „Zależy od:”'])
  const pusta = zmien('## Ryzyka i zależności', '### Faza 3 — Pusta\n\n**Zależy od:** Faza 2\n\n## Ryzyka i zależności')
  assert.deepEqual(sprawdz(pusta).bledy, ['faza 3: brak Implementation Units'])
  const bezFazy = zmien('### Faza 1 — Status i zapis\n\n**Zależy od:** Brak\n**Równolegle z:** — *(opcjonalne)*\n\n', '')
  assert.deepEqual(sprawdz(bezFazy).bledy,
    ['faza 2: numeracja faz liczbami od 1 bez luk (1, 2, …)', 'IU-1: jednostka poza nagłówkiem „### Faza N — nazwa”'])
})

test('Delegate to: brak albo agent spoza builderow jest odrzucony', () => {
  assert.deepEqual(sprawdz(zmien('**Delegate to:** feature-builder-ui', '**Delegate to:** general-purpose')).bledy,
    ['IU-2: Delegate to „general-purpose” — dozwolone feature-builder-ui | feature-builder-data | feature-builder-fullstack'])
  assert.deepEqual(sprawdz(zmien('**Delegate to:** feature-builder-fullstack\n', '')).bledy,
    ['IU-3: Delegate to „” — dozwolone feature-builder-ui | feature-builder-data | feature-builder-fullstack'])
})

test('scenariusze: bez typu, [E2E] bez identyfikatora flow, nieznany seed, ten sam flow dwa razy', () => {
  assert.deepEqual(sprawdz(zmien('- [Unit] hook dla szkicu zwraca brak oferty', '- hook dla szkicu zwraca brak oferty')).bledy,
    ['IU-3: scenariusz bez typu [Unit] / [E2E] / [Manual]: „hook dla szkicu zwraca brak oferty”'])
  assert.deepEqual(sprawdz(zmien('- [E2E] `oferta-publiczna` (seed', '- [E2E] oferta publiczna (seed')).bledy,
    ['IU-3: [E2E] bez identyfikatora flow w backtickach na początku linii'])
  assert.deepEqual(sprawdz(zmien('`oferta-publiczna` (seed: e2e/seeds/publikacja-oferty-seed.sql)', '`oferta-publiczna` (seed: e2e/seeds/brak-seed.sql)')).bledy,
    ['IU-3: seed e2e/seeds/brak-seed.sql — nie ma go w polu Pliki (Stwórz (e2e seed)) ani w repo'])
  assert.deepEqual(sprawdz(zmien('- [E2E] `oferta-publiczna`', '- [E2E] `publikacja-oferty`')).bledy,
    ['IU-3: flow `publikacja-oferty` ma już linię [E2E] w IU-2 — jeden scenariusz = jedna linia'])
})

test('weryfikacja: [Manual], bez komendy CLI, [E2E] bez runnera i runner bedacy scenariuszem sa odrzucone; runner w tekscie przechodzi', () => {
  const typecheck = '- `pnpm typecheck` przechodzi bez błędów\n\n### Faza 2'
  assert.deepEqual(sprawdz(zmien(typecheck, '- [Manual] operator klika przycisk\n\n### Faza 2')).bledy,
    ['IU-1: Weryfikacja [Manual] — kroki człowieka idą do Operator checklist albo Scenariusze testowe'])
  assert.deepEqual(sprawdz(zmien(typecheck, '- typecheck przechodzi bez błędów\n\n### Faza 2')).bledy,
    ['IU-1: Weryfikacja „typecheck przechodzi bez błędów” bez komendy w backtickach (`pnpm typecheck`, `grep …`) — scribe jej nie uruchomi; krok człowieka idzie do Operator checklist'])
  const runner = '- [E2E] `e2e/run-all.sh` — wszystkie flow zielone'
  assert.deepEqual(sprawdz(zmien(runner, '- [E2E] `publikacja-oferty` — oferta opublikowana')).bledy,
    ['IU-2: Weryfikacja [E2E] „`publikacja-oferty` — oferta opublikowana” — tylko runner .sh w backtickach, niebędący scenariuszem'])
  assert.deepEqual(sprawdz(zmien(runner, '- [E2E] `e2e/publikacja-oferty.sh` — oferta opublikowana')).bledy,
    ['IU-2: Weryfikacja [E2E] `e2e/publikacja-oferty.sh` to scenariusz z linii [E2E] — drugi przebieg tego samego flow'])
  assert.deepEqual(sprawdz(zmien(runner, '- [E2E] runner `e2e/run-all.sh` — wszystkie flow zielone')).bledy, [])
})

test('seed w tabeli poza e2e/seeds/*-seed.sql jest odrzucony', () => {
  const md = zmien('| Stwórz (e2e seed) | `e2e/seeds/publikacja-oferty-seed.sql` |', '| Stwórz (e2e seed) | `supabase/seed.sql` |')
  assert.ok(sprawdz(md).bledy.includes('IU-1: seed `supabase/seed.sql` poza wzorcem e2e/seeds/<flow>-seed.sql'))
})

test('frontmatter: brak pol kontekstu designerskiego i nieistniejacy SPEC sa odrzucone', () => {
  assert.deepEqual(sprawdz(zmien('operator_prep: ./docs/operator/publikacja-ofert-przygotowanie.md\n', '')).bledy,
    ['frontmatter: brak pola operator_prep (ścieżka albo null)'])
  assert.deepEqual(sprawdz(zmien('figma_spec: ./docs/plans/publikacja-ofert-figma/SPEC.md', 'figma_spec: ./docs/plans/brak/SPEC.md')).bledy,
    ['frontmatter: figma_spec ./docs/plans/brak/SPEC.md — plik nie istnieje'])
})

test('plan z [E2E] bez .env.e2e i bez checklisty przygotowania jest odrzucony', () => {
  const md = zmien('operator_prep: ./docs/operator/publikacja-ofert-przygotowanie.md', 'operator_prep: null')
  const korzen = projekt()
  try {
    rmSync(join(korzen, '.env.e2e'))
    assert.deepEqual(sprawdzPlan(parsujPlan(md), korzen).bledy,
      ['plan ma scenariusze [E2E], a projekt nie ma .env.e2e — pozycja setupu w checkliście przygotowania (operator_prep) albo [E2E] → [Manual]'])
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
})

test('IU opisujace migracje bez pliku migracji w tabeli dostaje uwage (nie blad)', () => {
  const md = zmien('- Strona czyta ofertę przez hook, szkic zwraca 404.', '- Strona czyta ofertę przez hook; nowa kolumna wymaga migracji.')
  assert.deepEqual(sprawdz(md), { bledy: [], uwagi: ['IU-3: opis wspomina migrację, a pole Pliki nie ma pliku w supabase/migrations/'] })
})

test('origin wskazujacy nieistniejacy plik w repo dostaje uwage; wartosc spoza repo nie', () => {
  const brak = zmien('origin: docs/brainstorms/2026-10-01-publikacja-ofert-requirements.md', 'origin: docs/brainstorms/brak-requirements.md#etap-2')
  assert.deepEqual(sprawdz(brak).uwagi, ['frontmatter: origin docs/brainstorms/brak-requirements.md#etap-2 — plik nie istnieje (popraw origin)'])
  assert.deepEqual(sprawdz(zmien('origin: docs/brainstorms/2026-10-01-publikacja-ofert-requirements.md', 'origin: sesja /zroastuj-mnie 2026-10-01')).uwagi, [])
})

test('znacznik [E2E], [Manual], Operator: albo [P2] w tresci pozycji jest odrzucony — zmienilby liczniki grepow konsumentow', () => {
  const wer = sprawdz(zmien('- `pnpm typecheck` przechodzi bez błędów\n\n### Faza 2', '- `pnpm typecheck` przechodzi; scenariusze [E2E] uruchamia tester\n\n### Faza 2')).bledy
  assert.deepEqual(wer, ['IU-1: „`pnpm typecheck` przechodzi; scenariusze [E2E] uruchamia tester” zawiera znacznik [E2E] poza początkiem pozycji — grepy prechecku, testera i completion-gate liczą linie po znaczniku; napisz to słowami'])
  const e2e = sprawdz(zmien('zrób screenshot → oferta ma status', 'sprawdź komunikat „Operator: brak uprawnień” → oferta ma status')).bledy
  assert.match(e2e.join('\n'), /IU-2: .* zawiera znacznik Operator:/)
  const oper = sprawdz(zmien('- [ ] Projektant akceptuje wygląd przycisku na liście', '- [ ] Projektant sprawdza scenariusz [E2E] na produkcji')).bledy
  assert.match(oper.join('\n'), /IU-2: .* zawiera znacznik \[E2E\]/)
})

test('problemy parsera (naglowek IU, lista wcieta) i numeracja IU z luka sa bledami walidacji', () => {
  assert.match(sprawdz(zmien('- [Unit] hook dla szkicu zwraca brak oferty', '  - [Unit] hook dla szkicu zwraca brak oferty')).bledy.join('\n'),
    /IU-3: linia \d+: pole „scenariusze testowe” — pozycja poza zapisem/)
  assert.deepEqual(sprawdz(zmien('- [ ] **IU-3: Adres publiczny oferty**', '- [ ] **IU-4: Adres publiczny oferty**')).bledy,
    ['IU-4: numeracja IU ciągła w całym planie od IU-1, bez powtórzeń (oczekiwane IU-3)'])
})

test('Modyfikuj pliku tworzonego przez wczesniejsza jednostke planu przechodzi; "dzis" porownane z jej "po"', () => {
  const dodaj = '| Test (unit) | `src/hooks/use-oferta-publiczna.test.ts` | 0 → 60 | — | nowy |'
  const ok = zmien(dodaj, `${dodaj}\n| Modyfikuj | \`src/services/oferty-statusy.ts\` | 15 → 25 | — | zostaje |`)
  assert.deepEqual(sprawdz(ok).bledy, [])
  const zle = zmien(dodaj, `${dodaj}\n| Modyfikuj | \`src/services/oferty-statusy.ts\` | 80 → 90 | — | zostaje |`)
  assert.deepEqual(sprawdz(zle).bledy, ['IU-3: `src/services/oferty-statusy.ts` — tabela podaje dziś 80, a wcześniejsza jednostka planu kończy na 15'])
})

test('bez regul wzgledem repo (bramka po fazie 1): plik zmieniony przez faze nie daje bledu "dzis"', () => {
  const korzen = projekt({ 'src/services/oferty-service.ts': linie(60) })
  try {
    assert.equal(sprawdzPlan(parsujPlan(FIXTURE), korzen).bledy.length, 1)
    assert.deepEqual(sprawdzPlan(parsujPlan(FIXTURE), korzen, { wzgledemRepo: false }).bledy, [])
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
})

test('liczLinieKodu: jak ESLint max-lines — bez pustych linii i linii samego komentarza', () => {
  const kod = '// naglowek\n\nimport x from "y"\n/**\n * opis\n */\nexport const a = 1 // koniec\n/* jedna */ const b = 2\n'
  assert.equal(liczLinieKodu(kod), 3)
})

test(`prog ${PROG_ESLINT} = max-lines z szablonu ESLint (jedna liczba w budzecie planu, bramce i bocie)`, () => {
  const eslint = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../templates/bramki/eslint.config.szablon.ts'), 'utf8')
  assert.equal(Number(/'max-lines': \['error', \{ max: (\d+)/.exec(eslint)?.[1]), PROG_ESLINT)
})

test('frontmatter: pole sciezki zapisane jako mapa jest odrzucone', () => {
  assert.deepEqual(sprawdz(zmien('design_md: ./docs/DESIGN.md', 'design_md:\n  a: ./docs/DESIGN.md')).bledy,
    ['frontmatter: design_md — oczekiwana ścieżka albo null, jest mapa'])
})
