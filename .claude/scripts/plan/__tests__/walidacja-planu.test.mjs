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
import { KOMENDY_CLI, PROG_ESLINT, sprawdzPlan, uwagiRozmiaruFaz, uwagiRozmiaruIu } from '../walidacja-planu.mjs'
import { zadanieZPlanu } from '../zadanie.mjs'

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
    [`IU-1: Weryfikacja „typecheck przechodzi bez błędów” bez komendy w backtickach z listy, którą uruchamia scribe (${KOMENDY_CLI.join(', ')}, grep, rg, ls, test, ./skrypt, *.sh, *.mjs) — krok człowieka idzie do Operator checklist`])
  for (const komenda of ['`tsc`', '`supabase test db`', '`psql "$SUPABASE_E2E_DB_URL" -c "select 1"`', '`./skrypty/sprawdz.sh`', '`node skrypty/x.mjs`']) {
    assert.deepEqual(sprawdz(zmien(typecheck, `- ${komenda} przechodzi\n\n### Faza 2`)).bledy, [], komenda)
  }
  // Zmiana kontraktu (P13 S2): runner z e2e/ bez [E2E] scribe uruchomilby bez srodowiska e2e — blad, nie zwykla komenda.
  assert.equal(sprawdz(zmien(typecheck, '- `./e2e/sprawdz.sh` przechodzi\n\n### Faza 2')).bledy.length, 1)
  assert.equal(sprawdz(zmien(typecheck, '- `test-utils.ts` istnieje\n\n### Faza 2')).bledy.length, 1)
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

// vibersi etap 6a IU-3: „test pilnuje zgodności kodów z migracją” przy CHECK-ach w migracji IU-1 dawało uwagę — linia z numerem
// migracji z innej IU planu albo z dysku to odwołanie, nie nowa migracja.
test('IU odwolujaca sie do migracji z innej IU albo z repo po numerze — bez uwagi; nieznany numer — uwaga zostaje', () => {
  const odwolanie = (/** @type {string} */ numer) => zmien('- Strona czyta ofertę przez hook, szkic zwraca 404.', `- Strona czyta ofertę przez hook; test pilnuje zgodności statusów z migracją ${numer}.`)
  const uwaga = 'IU-3: opis wspomina migrację, a pole Pliki nie ma pliku w supabase/migrations/'
  assert.deepEqual(sprawdz(odwolanie('20261007120000')).uwagi, [], 'migracja IU-1 tego planu')
  assert.deepEqual(sprawdz(odwolanie('20250101090000')).uwagi, [uwaga], 'numer bez pliku w planie i w repo')
  assert.deepEqual(sprawdz(odwolanie('20250101090000'), { 'supabase/migrations/20250101090000_oferty.sql': 'select 1;\n' }).uwagi, [], 'migracja z repo')
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

test('problemy parsera (lista wcieta bez rodzica) i powtorzony numer IU to bledy; luka w numeracji to uwaga', () => {
  assert.match(sprawdz(zmien('- [Unit] hook dla szkicu zwraca brak oferty', '  - [Unit] hook dla szkicu zwraca brak oferty')).bledy.join('\n'),
    /IU-3: linia \d+: pole „scenariusze testowe” — pozycja poza zapisem/)
  assert.deepEqual(sprawdz(zmien('- [ ] **IU-3: Adres publiczny oferty**', '- [ ] **IU-2: Adres publiczny oferty**')).bledy,
    ['IU-2: numer jednostki powtórzony — każda IU ma własny numer (odnośniki IU-K w zadaniach)'])
  assert.deepEqual(sprawdz(zmien('- [ ] **IU-3: Adres publiczny oferty**', '- [ ] **IU-4: Adres publiczny oferty**')),
    { bledy: [], uwagi: ['numeracja IU z luką albo poza kolejnością (IU-1, IU-2, IU-4) — dopuszczalne, odnośniki IU-K zostają'] })
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

test('Operator checklist z wiodacym [Manual] albo Operator: przechodzi; generator nie dubluje prefiksu', () => {
  const md = zmien('- [ ] Projektant akceptuje wygląd przycisku na liście',
    '- [ ] [Manual] QA sprawdza przycisk na iOS\n- [ ] Operator: projektant akceptuje wygląd przycisku')
  const korzen = projekt()
  try {
    assert.deepEqual(sprawdzPlan(parsujPlan(md), korzen).bledy, [])
    mkdirSync(join(korzen, 'docs/plans'), { recursive: true })
    writeFileSync(join(korzen, 'docs/plans/2026-10-07-001-feat-x-plan.md'), md)
    const { zadania } = zadanieZPlanu(korzen, 'docs/plans/2026-10-07-001-feat-x-plan.md', { data: '2026-10-07' }).pliki
    assert.match(zadania, /^- \[ \] \[Manual\] QA sprawdza przycisk na iOS \(IU-2\)$/m)
    assert.match(zadania, /^- \[ \] Operator: projektant akceptuje wygląd przycisku \(IU-2\)$/m)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
})

test('pole drugi raz: zgloszony duplikat i problemy z obu wystapien w jednej walidacji', () => {
  const md = zmien('- [Unit] hook dla szkicu zwraca brak oferty', '* [Unit] hook dla szkicu zwraca brak oferty')
    .replace('**Weryfikacja:**\n- `pnpm typecheck` przechodzi bez błędów\n\n## Ryzyka', '**Scenariusze testowe:**\n1. [Unit] drugi\n\n**Weryfikacja:**\n- `pnpm typecheck` przechodzi bez błędów\n\n## Ryzyka')
  const bledy = sprawdz(md).bledy.join('\n')
  assert.match(bledy, /IU-3: linia \d+: pole „scenariusze testowe” drugi raz/)
  assert.equal((bledy.match(/pozycja poza zapisem/g) ?? []).length, 2)
})

// P20 A6 (vibersi etap 3): plan dal stale `src/config/konto.ts` do IU-1 (faza 1), konsumenci byli w fazach 2–5 — knip
// w domknieciu fazy 1 zglosil 8 eksportow bez konsumenta, builder je usunal, a IU-3–IU-8 dopisaly je ponownie.
const WIERSZ_STALEJ = '| `STATUSY_OFERTY` | `szkic`, `opublikowana` | `src/services/oferty-statusy.ts` | IU-1, IU-2 |'

test('rejestr stalych: zrodlo w IU fazy wczesniejszej niz wszyscy konsumenci = uwaga z IU, stala i faza; plan nie odrzucony', () => {
  for (const konsumenci of ['IU-2', 'IU-2, IU-3', 'IU-2 (licznik jak w IU-1)']) {
    const w = sprawdz(zmien(WIERSZ_STALEJ, WIERSZ_STALEJ.replace('IU-1, IU-2', konsumenci)))
    assert.deepEqual(w.bledy, [], konsumenci)
    assert.equal(w.uwagi.length, 1, konsumenci)
    assert.match(w.uwagi[0], /^IU-1 \(faza 1\) definiuje stałe z rejestru STATUSY_OFERTY, a ich konsumenci zaczynają się w fazie 2 — knip/)
    assert.match(w.uwagi[0], /stała powstaje w IU pierwszego konsumenta/)
  }
})

test('rejestr stalych: IU-zrodlo wsrod konsumentow, pole obiektu albo zrodlo spoza tabel plikow = bez uwagi', () => {
  const wiersze = [
    WIERSZ_STALEJ,
    '| `TRASY.publiczna` | `/o/:id` | `src/services/oferty-statusy.ts` | IU-3 |',
    '| `LIMIT_LISTY` | `20` | `src/config/listy.ts` | IU-3 |',
  ].join('\n')
  assert.deepEqual(sprawdz(zmien(WIERSZ_STALEJ, wiersze)).uwagi, [])
})

test('rejestr stalych: parser czyta tabele sekcji (naglowek i separator pominiete, numery IU poza nawiasami)', () => {
  assert.deepEqual(parsujPlan(zmien(WIERSZ_STALEJ, WIERSZ_STALEJ.replace('IU-1, IU-2', 'IU-1 (migracja IU-9), IU-2, szablony maili'))).rejestr, [
    { stala: 'STATUSY_OFERTY', zrodlo: 'src/services/oferty-statusy.ts', konsumenci: [1, 2], iuZrodlo: null, kolumnaIu: false, problem: null },
  ])
})

test('rejestr stalych: faza konsumentow liczona od najwczesniejszego; konsument innej IU w fazie zrodla = bez uwagi', () => {
  // IU-3 jest w fazie 2 razem z IU-2, IU-1 w fazie 1: konsumenci z faz 1 i 2 przy zrodle w fazie 1 spoza listy — bez uwagi.
  assert.deepEqual(sprawdz(zmien(WIERSZ_STALEJ, WIERSZ_STALEJ.replace('IU-1, IU-2', 'IU-3, IU-1'))).uwagi, [])
  const plik = '| Stwórz | `src/services/oferty-statusy.ts` | 0 → 15 | — | nowy |'
  const zrodloWFazie2 = zmien(plik, '| Stwórz | `src/services/oferty-limity.ts` | 0 → 15 | — | nowy |',
    zmien('| Test (unit) | `src/hooks/use-oferta-publiczna.test.ts` | 0 → 60 | — | nowy |',
      '| Test (unit) | `src/hooks/use-oferta-publiczna.test.ts` | 0 → 60 | — | nowy |\n| Stwórz | `src/services/oferty-statusy.ts` | 0 → 15 | — | nowy |'))
  assert.deepEqual(sprawdz(zmien(WIERSZ_STALEJ, WIERSZ_STALEJ.replace('IU-1, IU-2', 'IU-2'), zrodloWFazie2)).uwagi.filter((u) => /stałe z rejestru/.test(u)), [],
    'zrodlo w IU-3 (faza 2) i konsument IU-2 w tej samej fazie')
})

test('rejestr stalych: IU-zrodlo = IU z plikiem, ktorej opis wymienia stala; dwie stale jednej IU w jednej uwadze', () => {
  // Plik zrodla w IU-1 (faza 1) i IU-3 (faza 2); definicje w Podejsciu IU-3 — zrodlem jest IU-3, konsument IU-2 w fazie 2.
  const dopisz = (/** @type {string} */ md) => zmien('| Test (unit) | `src/hooks/use-oferta-publiczna.test.ts` | 0 → 60 | — | nowy |',
    '| Test (unit) | `src/hooks/use-oferta-publiczna.test.ts` | 0 → 60 | — | nowy |\n| Modyfikuj | `src/services/oferty-statusy.ts` | 15 → 20 | — | zostaje |', md)
  const wiersze = `${WIERSZ_STALEJ.replace('IU-1, IU-2', 'IU-2')}\n| \`LIMIT_OFERT\` | \`20\` | \`src/services/oferty-statusy.ts\` | IU-3 |`
  const zOpisem = zmien('**Cel:** Strona publiczna opublikowanej oferty.', '**Cel:** Strona publiczna opublikowanej oferty; STATUSY_OFERTY i LIMIT_OFERT.',
    dopisz(zmien(WIERSZ_STALEJ, wiersze)))
  const uwagi = sprawdz(zOpisem).uwagi.filter((u) => /stałe z rejestru/.test(u))
  assert.deepEqual(uwagi, [], 'zrodlo z opisu (IU-3) jest w fazie konsumentow')
  const bezOpisu = sprawdz(dopisz(zmien(WIERSZ_STALEJ, `${wiersze}\n| \`MAKS_ZDJEC\` | \`5\` | \`src/services/oferty-statusy.ts\` | IU-2 |`))).uwagi
  assert.deepEqual(bezOpisu.filter((u) => /stałe z rejestru/.test(u)).map((u) => u.slice(0, u.indexOf(', a ich'))),
    ['IU-1 (faza 1) definiuje stałe z rejestru STATUSY_OFERTY, LIMIT_OFERT, MAKS_ZDJEC'])
})

test('rejestr stalych: kreska w backtickach (unia typow, \\|) nie przesuwa kolumn', () => {
  const md = zmien(WIERSZ_STALEJ, "| `STATUSY_OFERTY` | `'szkic' \\| 'opublikowana'` | `src/services/oferty-statusy.ts` | IU-2 |")
  assert.deepEqual(parsujPlan(md).rejestr, [{ stala: 'STATUSY_OFERTY', zrodlo: 'src/services/oferty-statusy.ts', konsumenci: [2], iuZrodlo: null, kolumnaIu: false, problem: null }])
})

test('rejestr stalych: uwaga scalona na IU-zrodlo podaje najwczesniejsza faze konsumentow wszystkich jej stalych', () => {
  const trzyFazy = zmien('- [ ] **IU-3: Adres publiczny oferty**', '### Faza 3 — Adres publiczny\n\n**Zależy od:** Faza 2\n\n- [ ] **IU-3: Adres publiczny oferty**')
  const wiersze = `${WIERSZ_STALEJ.replace('IU-1, IU-2', 'IU-3')}\n| \`LIMIT_OFERT\` | \`20\` | \`src/services/oferty-statusy.ts\` | IU-2 |`
  const uwagi = sprawdz(zmien(WIERSZ_STALEJ, wiersze, trzyFazy)).uwagi.filter((u) => /stałe z rejestru/.test(u))
  assert.equal(uwagi.length, 1)
  assert.match(uwagi[0], /^IU-1 \(faza 1\) definiuje stałe z rejestru STATUSY_OFERTY, LIMIT_OFERT, a ich konsumenci zaczynają się w fazie 2 /)
})

// P22 C1: kolumna IU-źródło. vibersi etap 4 — IU-2 (faza 2) tworzy src/config/projekt-formularz.ts i zapowiada „DLUGI_BOK_ZRZUTU_PX,
// … NAZWA_BAZY_SZKICU dopisuje IU-5”; heurystyka (pierwsza IU z plikiem, ktorej opis wymienia stala) wskazala IU-2 i dala falszywa
// uwage. Tu ten sam uklad: IU-1 (faza 1) tworzy plik i zapowiada stala, IU-3 (faza 2) ja dopisuje, konsument IU-2 (faza 2).
const NAGLOWEK_STARY = '| Stała | Wartość | Źródło | Konsumenci |\n|---|---|---|---|'
const NAGLOWEK_NOWY = '| Stała | Wartość | Plik | IU-źródło | Konsumenci |\n|---|---|---|---|---|'
/** @param {string} tabela @returns {string} plan z ukladem etapu 4: zapowiedz w IU-1, dopisanie w IU-3 */
function ukladEtapu4(tabela) {
  const zDopisaniem = zmien('| Test (unit) | `src/hooks/use-oferta-publiczna.test.ts` | 0 → 60 | — | nowy |',
    '| Test (unit) | `src/hooks/use-oferta-publiczna.test.ts` | 0 → 60 | — | nowy |\n| Modyfikuj | `src/services/oferty-statusy.ts` | 15 → 20 | — | zostaje |')
  const zZapowiedzia = zmien('**Cel:** Kolumna statusu i funkcja publikacji w serwisie.',
    '**Cel:** Kolumna statusu i funkcja publikacji w serwisie; `LIMIT_OFERT` w `src/services/oferty-statusy.ts` dopisuje IU-3.', zDopisaniem)
  return zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, tabela, zZapowiedzia)
}

test('rejestr stalych (etap 4 vibersi): bez kolumny IU-źródło falszywa uwaga na IU-1; z kolumna (IU-3) — bez uwagi', () => {
  const stary = ukladEtapu4(`${NAGLOWEK_STARY}\n| \`LIMIT_OFERT\` | \`20\` | \`src/services/oferty-statusy.ts\` | IU-2 |`)
  assert.match(sprawdz(stary).uwagi.join('\n'), /IU-1 \(faza 1\) definiuje stałe z rejestru LIMIT_OFERT/, 'stara heurystyka zostaje dla planu bez kolumny')
  const nowy = ukladEtapu4(`${NAGLOWEK_NOWY}\n| \`LIMIT_OFERT\` | \`20\` | \`src/services/oferty-statusy.ts\` | IU-3 | IU-2 |`)
  assert.deepEqual(parsujPlan(nowy).rejestr, [{ stala: 'LIMIT_OFERT', zrodlo: 'src/services/oferty-statusy.ts', konsumenci: [2], iuZrodlo: 3, kolumnaIu: true, problem: null }])
  assert.deepEqual(sprawdz(nowy).uwagi.filter((u) => /rejestr/.test(u)), [])
})

test('rejestr stalych (etap 3 vibersi): jawne IU-źródło w fazie przed wszystkimi konsumentami — uwaga zostaje', () => {
  const md = zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, `${NAGLOWEK_NOWY}\n| \`MIN_DLUGOSC_HASLA\` | \`8\` | \`src/services/oferty-statusy.ts\` | IU-1 | IU-2, IU-3 |`)
  const uwagi = sprawdz(md).uwagi.filter((u) => /rejestr/.test(u))
  assert.equal(uwagi.length, 1)
  assert.match(uwagi[0] ?? '', /^IU-1 \(faza 1\) definiuje stałe z rejestru MIN_DLUGOSC_HASLA, a ich konsumenci zaczynają się w fazie 2 .*kolumna IU-źródło/)
})

test('rejestr stalych: jawne IU-źródło spoza planu albo bez pliku stalej w tabeli plikow = uwaga; kolumny po naglowku w dowolnej kolejnosci', () => {
  const md = zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, [NAGLOWEK_NOWY,
    '| `A` | `1` | `src/services/oferty-statusy.ts` | IU-9 | IU-1 |',
    '| `B` | `2` | `src/services/oferty-statusy.ts` | IU-2 | IU-2 |',
    '| `D` | `4` | `src/services/oferty-statusy.ts` | — | IU-2 |'].join('\n'))
  assert.deepEqual(sprawdz(md).uwagi.filter((u) => /rejestr/.test(u)), [
    'rejestr stałych: A — IU-źródło IU-9 nie ma w planie',
    'rejestr stałych: B — IU-2 (IU-źródło) nie ma src/services/oferty-statusy.ts w tabeli plików',
  ], 'D z „—” (stala juz w repo) — bez uwagi, bez zgadywania IU-1')
  const przestawione = zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, '| Stała | IU-zrodlo | Konsumenci | Wartość | Plik |\n|---|---|---|---|---|\n| `C` | IU-1 | IU-1, IU-2 | `3` | `src/services/oferty-statusy.ts` |')
  assert.deepEqual(parsujPlan(przestawione).rejestr, [{ stala: 'C', zrodlo: 'src/services/oferty-statusy.ts', konsumenci: [1, 2], iuZrodlo: 1, kolumnaIu: true, problem: null }])
})

// P22 C1 po recenzji: komorka IU-zrodla bez cichego wyniku (kilka IU, pusta, nieczytelna), naglowek w wariantach pisowni,
// tabela bez naglowka, IU-zrodlo po pierwszym konsumencie (vibersi etap 4: TRASY.kolejka importuje IU-13 w fazie 5,
// a „dopisuje” IU-14 w fazie 6), sciezka pliku z dopiskiem.
/** @param {string[]} wiersze @param {string} [naglowek] */
const zTabela = (wiersze, naglowek = NAGLOWEK_NOWY) => zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, [naglowek, ...wiersze].join('\n'))
const PLIK = '`src/services/oferty-statusy.ts`'

test('rejestr stalych: kilka IU w komorce, pusta albo nieczytelna komorka = uwaga; „—”, „-” i „–” = stala w repo bez uwagi', () => {
  const uwagi = sprawdz(zTabela([
    `| \`A\` / \`B\` | \`1\` | ${PLIK} | IU-1, IU-3 | IU-1 |`,
    `| \`C\` | \`2\` | ${PLIK} |  | IU-2 |`,
    `| \`D\` | \`3\` | ${PLIK} | brak | IU-2 |`,
    `| \`E\` | \`4\` | ${PLIK} | (IU-2) | IU-2 |`,
    `| \`F\` | \`5\` | ${PLIK} | - | IU-2 |`,
    `| \`G\` | \`6\` | ${PLIK} | – | IU-2 |`,
  ])).uwagi.filter((u) => /rejestr/.test(u))
  assert.deepEqual(uwagi, [
    'rejestr stałych: A / B — kilka IU w kolumnie IU-źródło (IU-1, IU-3) — jedna IU-źródło na wiersz, rozbij wiersz',
    'rejestr stałych: C — kolumna IU-źródło pusta albo nieczytelna („”) — wpisz IU-N albo „—” (stała już w repo)',
    'rejestr stałych: D — kolumna IU-źródło pusta albo nieczytelna („brak”) — wpisz IU-N albo „—” (stała już w repo)',
    'rejestr stałych: E — kolumna IU-źródło pusta albo nieczytelna („(IU-2)”) — wpisz IU-N albo „—” (stała już w repo)',
  ])
})

test('rejestr stalych: naglowek pogrubiony, z kreska en, „Źródło (IU)”, STAŁA, „Konsumenci (IU)” — kolumny rozpoznane', () => {
  for (const naglowek of [
    '| **Stała** | **Wartość** | **Plik** | **IU-źródło** | **Konsumenci** |',
    '| STAŁA | Wartość | Plik | IU–źródło | Konsumenci (IU) |',
    '| Stała | Wartość | Plik | Źródło (IU) | Konsumenci |',
    '| Stała | Wartość | Plik | IU źródło | Konsumenci |',
  ]) {
    const md = zTabela([`| \`LIMIT_OFERT\` | \`20\` | ${PLIK} | IU-3 | IU-2 |`], `${naglowek}\n|---|---|---|---|---|`)
    assert.deepEqual(parsujPlan(md).rejestr, [{ stala: 'LIMIT_OFERT', zrodlo: 'src/services/oferty-statusy.ts', konsumenci: [2], iuZrodlo: 3, kolumnaIu: true, problem: null }], naglowek)
  }
  const stary = zTabela([`| \`X\` | \`1\` | ${PLIK} | IU-2 |`], '| Stała | Źródło | Wartość | Konsumenci |\n|---|---|---|---|')
  assert.deepEqual(parsujPlan(stary).rejestr[0], { stala: 'X', zrodlo: '1', konsumenci: [2], iuZrodlo: null, kolumnaIu: false, problem: null }, 'Źródło w kolumnie 2 wg naglowka')
})

test('rejestr stalych: tabela bez naglowka — 4 kolumny po staremu, 5 kolumn = uwaga o naglowku', () => {
  const bez4 = zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, `|---|---|---|---|\n${WIERSZ_STALEJ}`)
  assert.deepEqual(parsujPlan(bez4).rejestr, [{ stala: 'STATUSY_OFERTY', zrodlo: 'src/services/oferty-statusy.ts', konsumenci: [1, 2], iuZrodlo: null, kolumnaIu: false, problem: null }])
  const bez5 = zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, `| \`X\` | \`1\` | ${PLIK} | IU-1 | IU-2 |`)
  assert.match(sprawdz(bez5).uwagi.join('\n'), /rejestr stałych: X — tabela rejestru bez wiersza nagłówka/)
})

test('rejestr stalych: jawne IU-źródło w fazie po pierwszym konsumencie = uwaga, takze dla pola obiektu; sciezka z dopiskiem i ./', () => {
  const uwagi = sprawdz(ukladEtapu4(`${NAGLOWEK_NOWY}\n| \`TRASY.kolejka\` | \`'/k'\` | ./src/services/oferty-statusy.ts (dopisanie) | IU-3 | IU-1, IU-3 |`)).uwagi.filter((u) => /rejestr/.test(u))
  assert.deepEqual(uwagi, ['rejestr stałych: TRASY.kolejka — IU-3 (IU-źródło, faza 2) jest po pierwszym konsumencie (faza 1) — źródło w IU pierwszego konsumenta'])
  const zDopiskiem = parsujPlan(zTabela([`| \`Y\` | \`1\` | ${PLIK} (dopisanie) | IU-1 | IU-1 |`])).rejestr[0]
  assert.equal(zDopiskiem?.zrodlo, 'src/services/oferty-statusy.ts')
})

test('rejestr stalych: tekst uwagi planu bez kolumny wskazuje kolumne IU-źródło do dodania', () => {
  assert.match(sprawdz(zmien(WIERSZ_STALEJ, WIERSZ_STALEJ.replace('IU-1, IU-2', 'IU-2'))).uwagi[0] ?? '', /IU-źródło wskaż kolumną IU-źródło w rejestrze\)$/)
})

// P25 C1 (vibersi etap 5): etykiety powodow zgloszen w src/components/zgloszenia/teksty-zgloszen.ts (IU-16, UI), a szablony
// maili serwera (IU-17) mialy je stamtad brac — serwer importowalby warstwe komponentow. Uwaga, gdy konsument ma pliki serwera.
test('rejestr stalych: zrodlo w warstwie UI, a konsument z plikami server/ = uwaga z modulem bez Reacta; zrodlo w src/config — bez uwagi', () => {
  const zSerwerem = zmien('| Test (unit) | `src/features/oferty/components/lista-ofert.test.tsx` | 0 → 50 | — | nowy |',
    '| Test (unit) | `src/features/oferty/components/lista-ofert.test.tsx` | 0 → 50 | — | nowy |\n| Stwórz | `server/poczta.ts` | 0 → 30 | — | nowy |')
  const tabela = (/** @type {string} */ plik) => `${NAGLOWEK_NOWY}\n| \`ETYKIETY_POWODOW\` | lista etykiet | \`${plik}\` | IU-3 | IU-3, IU-2 |`
  const zUi = zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, tabela('src/pages/oferta-publiczna.tsx'), zSerwerem)
  const uwagi = sprawdz(zUi).uwagi.filter((u) => /warstwie UI/.test(u))
  assert.equal(uwagi.length, 1)
  assert.match(uwagi[0] ?? '', /^rejestr stałych: ETYKIETY_POWODOW — plik src\/pages\/oferta-publiczna\.tsx jest w warstwie UI, a IU-2 ma pliki serwera \(server\/poczta\.ts\)/)
  assert.match(uwagi[0] ?? '', /src\/config\//)
  const bezSerwera = zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, tabela('src/pages/oferta-publiczna.tsx'))
  assert.deepEqual(sprawdz(bezSerwera).uwagi.filter((u) => /warstwie UI/.test(u)), [], 'konsument tylko w kliencie')
  const wConfig = zmien('| Stwórz | `src/pages/oferta-publiczna.tsx` | 0 → 90 | — | nowy |',
    '| Stwórz | `src/pages/oferta-publiczna.tsx` | 0 → 90 | — | nowy |\n| Stwórz | `src/config/powody.ts` | 0 → 10 | — | nowy |',
    zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, tabela('src/config/powody.ts'), zSerwerem))
  assert.deepEqual(sprawdz(wConfig).uwagi.filter((u) => /warstwie UI/.test(u)), [])
  // Hook feature'a jako zrodlo i konsument z Edge Function; IU z plikiem serwera spoza listy konsumentow — bez uwagi.
  const zFunkcja = zmien('| Stwórz | `server/poczta.ts` | 0 → 30 | — | nowy |', '| Stwórz | `supabase/functions/poczta/index.ts` | 0 → 30 | — | nowy |', zSerwerem)
  const hook = zmien('| Stwórz | `src/hooks/use-oferta-publiczna.ts` | 0 → 40 | — | nowy |', '| Stwórz | `src/features/oferty/hooks/use-powody.ts` | 0 → 40 | — | nowy |',
    zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, tabela('src/features/oferty/hooks/use-powody.ts'), zFunkcja))
  assert.match(sprawdz(hook).uwagi.filter((u) => /warstwie UI/.test(u)).join('\n'), /use-powody\.ts jest w warstwie UI, a IU-2 ma pliki serwera \(supabase\/functions\/poczta\/index\.ts\)/)
  const bezKonsumenta = zmien(`${NAGLOWEK_STARY}\n${WIERSZ_STALEJ}`, `${NAGLOWEK_NOWY}\n| \`ETYKIETY_POWODOW\` | lista etykiet | \`src/pages/oferta-publiczna.tsx\` | IU-3 | IU-3 |`, zSerwerem)
  assert.deepEqual(sprawdz(bezKonsumenta).uwagi.filter((u) => /warstwie UI/.test(u)), [], 'IU-2 z serwerem nie jest konsumentem')
})

// P25 C5 (vibersi etap 5): faza 1 z 6 IU (3 migracje, w tym 4. przepisanie admin_zdecyduj, serwer, E2E, Sentry) — po podziale
// dwa mniejsze review. Uwaga przy fazie powyzej 5 IU, nie blad.
test('rozmiar fazy: powyzej 5 IU = uwaga z numerem fazy i liczba IU; 5 IU — bez uwagi', () => {
  const faza = (/** @type {number} */ numer, /** @type {number} */ ile) => ({ numer, iu: Array.from({ length: ile }, (_, i) => ({ id: `IU-${i + 1}` })) })
  assert.deepEqual(uwagiRozmiaruFaz([faza(1, 5), faza(2, 3)]), [])
  const [uwaga, ...reszta] = uwagiRozmiaruFaz([faza(1, 6), faza(2, 5)])
  assert.equal(reszta.length, 0)
  assert.match(uwaga ?? '', /^faza 1: 6 IU \(próg 5\)/)
  assert.match(uwaga ?? '', /migracje przepisujące istniejące funkcje/)
})

// P3 pkt 96 M22: uwaga rozmiaru fazy byla testowana tylko funkcja — usuniecie jej wpiecia w sprawdzPlan przezywalo.
test('sprawdzPlan: faza z 6 IU daje uwage rozmiaru fazy (wpiecie uwagiRozmiaruFaz), faza fixture — bez niej', () => {
  const korzen = projekt()
  try {
    const plan = parsujPlan(FIXTURE)
    assert.deepEqual(sprawdzPlan(plan, korzen).uwagi.filter((u) => /IU \(próg 5\)/.test(u)), [])
    const [faza] = plan.fazy
    while (faza.iu.length < 6) faza.iu.push({ ...faza.iu[0] })
    const uwagi = sprawdzPlan(plan, korzen).uwagi.filter((u) => /IU \(próg 5\)/.test(u))
    assert.equal(uwagi.length, 1)
    assert.match(uwagi[0], new RegExp(`^faza ${faza.numer}: 6 IU \\(próg 5\\)`))
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
})

// E5-14 (vibersi etapy 3–5, 51 IU, dane/e5-14-tury-iu.txt): scenariusze IU ↔ ctx_max buildera Spearman +0,83, pliki ↔ tury +0,71;
// IU z 10+ plikami: tury p50 72, ctx_max p50 227k (1–3 pliki: 27 i 89k); 7–9 scenariuszy: 80 i 263k. Zero porazek buildera,
// wiec uwaga (koszt i kontekst), nie blad — decyzja operatora 2026-10-27.
// Decyzja operatora 2026-10-27: prog 7/10 dawal uwage 29/51 IU etapow 3–5 (srodek zwyklego rozmiaru), 8/12 — 17/51 najciezszym.
test('rozmiar IU: >= 8 scenariuszy albo >= 12 plikow = uwaga z liczbami; 7 scenariuszy i 11 plikow — bez uwagi', () => {
  /** @param {string} id @param {number} scen @param {number} pliki */
  const iu = (id, scen, pliki) => ({ id, scenariusze: Array.from({ length: scen }, () => ({})), pliki: Array.from({ length: pliki }, () => ({})) })
  assert.deepEqual(uwagiRozmiaruIu([iu('IU-1', 7, 11)]), [])
  const uwagi = uwagiRozmiaruIu([iu('IU-1', 8, 2), iu('IU-2', 1, 12), iu('IU-3', 9, 14), iu('IU-4', 7, 11)])
  assert.equal(uwagi.length, 3)
  assert.match(uwagi[0], /^IU-1: 8 scenariuszy testowych, 2 plików \(próg: 8 scenariuszy albo 12 plików\)/)
  assert.match(uwagi[1], /^IU-2: 1 scenariuszy testowych, 12 plików/)
  assert.match(uwagi[2], /^IU-3: /)
  assert.match(uwagi[0], /podziel/)
})

test('sprawdzPlan: IU z 8 scenariuszami daje uwage rozmiaru IU (wpiecie), fixture — bez niej', () => {
  const korzen = projekt()
  try {
    const plan = parsujPlan(FIXTURE)
    assert.deepEqual(sprawdzPlan(plan, korzen).uwagi.filter((u) => /próg: 8 scenariuszy/.test(u)), [])
    const [jednostka] = plan.fazy[0].iu
    while (jednostka.scenariusze.length < 8) jednostka.scenariusze.push({ ...jednostka.scenariusze[0] })
    assert.equal(sprawdzPlan(plan, korzen).uwagi.filter((u) => new RegExp(`^${jednostka.id}: 8 scenariuszy`).test(u)).length, 1)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
})
