// Generator indeksu docs/learned-patterns.md (PLAN-POPRAWY P10): tylko szczebel `regula`, dedup, koszyk „zawsze”
// z twardym limitem i bramka rozmiaru — limit dotyczy indeksu, nie wiedzy (solutions zostaja).

import test from 'node:test'
import assert from 'node:assert/strict'

import { MAKS_INDEKS_ZN, MAKS_ZAWSZE, generujIndeks } from '../indeks.mjs'

/** @param {string} plik @param {Record<string, string | string[]>} [zmiany] */
function wpis(plik, zmiany = {}) {
  return {
    plik,
    pola: {
      klasa: 'sciezka-bledu', regula: `Regula z ${plik}.`, paths: ['src/lib/**'], waga: 'srednia', szczebel: 'regula',
      szczebel_powod: 'x', date: '2026-09-01', zrodlo: 'PR 1', ucieczki: '0', ...zmiany,
    },
  }
}

test('generujIndeks: wiersz klasa | regula | wzorce | waga | link; kod i lint bez wdrozonej bramki dzialaja jak regula, z bramka poza indeksem', () => {
  const w = generujIndeks([
    wpis('docs/solutions/a/x.md'),
    wpis('docs/solutions/a/kod.md', { szczebel: 'kod' }),
    wpis('docs/solutions/a/lint.md', { szczebel: 'lint', bramka: 'eslint.config.js no-restricted-syntax' }),
  ])
  assert.deepEqual(w.bledy, [])
  assert.equal(w.wpisy, 2)
  assert.match(w.tresc, /\| sciezka-bledu \| Regula z docs\/solutions\/a\/x\.md\. \| `src\/lib\/\*\*` \| srednia \| \[solution\]\(solutions\/a\/x\.md\) \|/)
  assert.match(w.tresc, /solutions\/a\/kod\.md/)
  assert.doesNotMatch(w.tresc, /lint\.md/)
  assert.equal(w.zn, w.tresc.length)
})

test('generujIndeks: licznik propozycji bramek — lekcje kod/lint i te z wdrozona bramka (metryka wdrozen)', () => {
  const w = generujIndeks([
    wpis('docs/solutions/a/x.md'),
    wpis('docs/solutions/a/kod.md', { szczebel: 'kod' }),
    wpis('docs/solutions/a/lint.md', { szczebel: 'lint', bramka: 'eslint.config.js no-restricted-syntax' }),
  ])
  assert.deepEqual(w.bramki, { propozycje: 2, wdrozone: 1 })
})

test('generujIndeks: dedup po klasie i tresci reguly (wielkosc liter, spacje, interpunkcja) — zostaje nowszy wpis', () => {
  const w = generujIndeks([
    wpis('docs/solutions/a/stary.md', { regula: 'Waliduj  wejscie Zod.', date: '2026-08-01' }),
    wpis('docs/solutions/a/nowy.md', { regula: 'waliduj wejscie zod', date: '2026-09-01' }),
    wpis('docs/solutions/a/inna-klasa.md', { regula: 'Waliduj wejscie Zod.', klasa: 'walidacja-granicy-api' }),
  ])
  assert.equal(w.wpisy, 2)
  assert.deepEqual(w.duplikaty, [{ plik: 'docs/solutions/a/stary.md', duplikatZ: 'docs/solutions/a/nowy.md' }])
})

test('generujIndeks: koszyk „zawsze” ponad limit = blad bramki z lista plikow; w limicie wpisy zawsze na poczatku', () => {
  const zawsze = Array.from({ length: MAKS_ZAWSZE }, (_, i) => wpis(`docs/solutions/z/${i}.md`, { paths: ['**'] }))
  const ok = generujIndeks([wpis('docs/solutions/a/x.md', { waga: 'wysoka' }), ...zawsze])
  assert.deepEqual(ok.bledy, [])
  assert.equal(ok.zawsze, MAKS_ZAWSZE)
  assert.ok(ok.tresc.indexOf('solutions/z/0.md') < ok.tresc.indexOf('solutions/a/x.md'))
  const zaDuzo = generujIndeks([...zawsze, wpis('docs/solutions/z/extra.md', { paths: ['**'] })])
  assert.equal(zaDuzo.bledy.length, 1)
  assert.match(zaDuzo.bledy[0], new RegExp(`koszyk "zawsze": ${MAKS_ZAWSZE + 1} wpisow, limit ${MAKS_ZAWSZE}.*z/extra\\.md`))
})

test('generujIndeks: indeks ponad limit znakow = blad bramki rozmiaru', () => {
  const dlugie = Array.from({ length: Math.ceil(MAKS_INDEKS_ZN / 250) }, (_, i) => wpis(`docs/solutions/a/${i}.md`, { regula: `${'Dluga regula numer '.repeat(15)}${i}.` }))
  const w = generujIndeks(dlugie)
  assert.ok(w.zn > MAKS_INDEKS_ZN)
  assert.match(w.bledy.join('\n'), new RegExp(`indeks: ${w.zn} zn, limit ${MAKS_INDEKS_ZN}`))
})

test('generujIndeks: 75 regul po ~400 zn (projekt rozwijany latami) miesci sie w limicie indeksu', () => {
  const regula = `${'Regula projektu o typowej dlugosci. '.repeat(10)}`.trim()
  const w = generujIndeks(Array.from({ length: 75 }, (_, i) => wpis(`docs/solutions/a/${i}.md`, { regula: `${regula} Numer ${i}.` })))
  assert.equal(w.wpisy, 75)
  assert.deepEqual(w.bledy, [])
})

test('generujIndeks: znak | i nowa linia w regule nie lamia tabeli', () => {
  const w = generujIndeks([wpis('docs/solutions/a/x.md', { regula: 'Uzyj a | b.\nPotem c.' })])
  assert.match(w.tresc, /\| Uzyj a \\\| b\. Potem c\. \|/)
})

// E5-15(d)(e) (vibersi etap 5: 4 reguly sciezka-bledu osobno, seed-e2e z 5 ucieczkami w 4 turach bota): indeks wskazuje
// refreshowi klasy do scalenia i klasy, ktorym zamiast kolejnej linii nalezy sie bramka mechaniczna.
test('generujIndeks: doScalenia — klasa z ≥ 3 regulami w indeksie; doBramki — klasa z suma ucieczek ≥ 3 bez wdrozonej bramki', () => {
  const w = generujIndeks([
    wpis('docs/solutions/a/1.md', { ucieczki: '1' }),
    wpis('docs/solutions/a/2.md', { ucieczki: '1' }),
    wpis('docs/solutions/a/3.md', { ucieczki: '1' }),
    wpis('docs/solutions/b/1.md', { klasa: 'seed-e2e', ucieczki: '4' }),
    wpis('docs/solutions/c/1.md', { klasa: 'tekst-ui', ucieczki: '1' }),
    wpis('docs/solutions/c/2.md', { klasa: 'tekst-ui', ucieczki: '1' }),
    // duplikat (ta sama tresc) nie liczy sie podwojnie: indeks bierze nowszy, jego licznik juz obejmuje starszy
    wpis('docs/solutions/d/stary.md', { klasa: 'duplikacja', regula: 'Jedna regula.', ucieczki: '2', date: '2026-08-01' }),
    wpis('docs/solutions/d/nowy.md', { klasa: 'duplikacja', regula: 'Jedna regula.', ucieczki: '2', date: '2026-09-01' }),
    // lekcja z wdrozona bramka poza indeksem i poza suma ucieczek klasy (2 + 1 dalyby prog)
    wpis('docs/solutions/e/lint.md', { klasa: 'konwencja-kodu', szczebel: 'lint', bramka: 'eslint.config.ts lokalne/x', ucieczki: '2' }),
    wpis('docs/solutions/e/regula.md', { klasa: 'konwencja-kodu', ucieczki: '1' }),
  ])
  assert.deepEqual(w.doScalenia, [{ klasa: 'sciezka-bledu', pliki: ['docs/solutions/a/1.md', 'docs/solutions/a/2.md', 'docs/solutions/a/3.md'] }])
  assert.deepEqual(w.doBramki, [{ klasa: 'seed-e2e', ucieczki: 4 }, { klasa: 'sciezka-bledu', ucieczki: 3 }])
  assert.deepEqual(w.bledy, [])
})
