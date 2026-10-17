// Czesci PR w planie (P20 S2): szacunek plikow do recenzji z tabel IU, sekcja „## Części PR” i podzial na granicy faz.
// vibersi etap 3: tabele plikow 13 IU byly w planie, a 172 pliki do recenzji (> 150, limit bota) wyszly dopiero
// w archiwizacji; podzial reczny po fazie 3 dal PR #3 (93) i PR #4 (121).
//
// Uruchomienie:  node --test .claude/scripts/plan/__tests__/czesci-pr.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { PROG_UWAGI_PR, podzialFaz, rozmiarPlanu, sekcjaCzesci, sprawdzCzesci } from '../czesci-pr.mjs'
import { parsujPlan } from '../plan-techniczny.mjs'
import { sprawdzPlan } from '../walidacja-planu.mjs'
import { PROG_PLIKOW_PR } from '../../pr/rozmiar.mjs'

/**
 * Plan z fazami; faza = lista plikow jednej IU (Stworz). Plik `.ts` bez `.test.ts` w planie liczy sie z testem.
 * @param {string[][]} fazy
 * @param {string} [czesci] tresc sekcji „## Części PR” (bez naglowka); brak = plan bez sekcji
 * @returns {string}
 */
function plan(fazy, czesci) {
  const iu = fazy.map((pliki, i) => `### Faza ${i + 1} — F${i + 1}\n\n**Zależy od:** Brak\n\n- [ ] **IU-${i + 1}: J${i + 1}**\n\n**Pliki:**\n\n`
    + '| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |\n|---|---|---|---|---|\n'
    + pliki.map((p) => `| Stwórz | \`${p}\` | 0 → 10 | — | nowy |`).join('\n') + '\n\n**Delegate to:** feature-builder-data\n')
  return `# Plan\n\n${czesci === undefined ? '' : `## Części PR\n\n${czesci}\n\n`}## Implementation Units\n\n${iu.join('\n')}`
}

/** @param {string} katalog @param {number} n @param {string} [rozszerzenie] @returns {string[]} n plikow (bez testow) */
const pliki = (katalog, n, rozszerzenie = 'sql') => Array.from({ length: n }, (_, i) => `${katalog}/p${i}.${rozszerzenie}`)

/** @param {Record<string, string>} pliki @param {(korzen: string) => void} f */
function wProjekcie(pliki, f) {
  const korzen = mkdtempSync(join(tmpdir(), 'czesci-pr-'))
  try {
    for (const [s, t] of Object.entries(pliki)) {
      mkdirSync(dirname(join(korzen, s)), { recursive: true })
      writeFileSync(join(korzen, s), t)
    }
    f(korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

test('szacunek: sciezki z tabel IU po filtrach .coderabbit.yaml + test obok pliku kodu bez testu w planie; plik w dwoch fazach raz', () => {
  const md = plan([
    ['src/a.ts', 'src/a.test.ts', 'src/b.tsx', 'docs/x.md', 'supabase/m.sql'],
    ['src/b.tsx', 'src/c.spec.ts', 'src/c.ts', 'src/typy.d.ts', 'e2e/run.sh'],
  ])
  wProjekcie({ '.coderabbit.yaml': 'reviews:\n  path_filters:\n    - "!docs/**"\n' }, (k) => {
    const r = rozmiarPlanu(parsujPlan(md), k)
    // faza 1: a.ts, a.test.ts, b.tsx (+ b.test.tsx), m.sql = 5; faza 2: b.tsx (+test), c.spec.ts, c.ts, typy.d.ts, run.sh = 6
    assert.deepEqual(r.fazy, { 1: 5, 2: 6 })
    assert.equal(r.szacunek, 9)
    assert.equal(r.prog, PROG_PLIKOW_PR)
    assert.equal(r.czesci, null)
    assert.equal(r.propozycja, null)
  })
  wProjekcie({}, (k) => assert.equal(rozmiarPlanu(parsujPlan(md), k).fazy[1], 6, 'bez .coderabbit.yaml docs/ tez idzie do recenzji'))
})

test('plan powyzej 150 bez sekcji = blad z propozycja rownych czesci; 121–150 = uwaga; do 120 nic', () => {
  wProjekcie({}, (k) => {
    const duzy = plan([pliki('a', 60), pliki('b', 40), pliki('c', 50), pliki('d', 60)])
    const w = sprawdzCzesci(parsujPlan(duzy), k)
    assert.deepEqual(w.uwagi, [])
    assert.equal(w.bledy.length, 1)
    assert.match(w.bledy[0], /^plan ma ~210 plików do recenzji bota .* > 150 — sekcja „## Części PR” z cięciem na granicy faz/)
    assert.match(w.bledy[0], /propozycja: część 1: fazy 1–2 \(100\), część 2: fazy 3–4 \(110\)\)$/)
    const graniczny = sprawdzCzesci(parsujPlan(plan([pliki('a', 70), pliki('b', 51)])), k)
    assert.deepEqual(graniczny.bledy, [])
    assert.match(graniczny.uwagi[0] ?? '', /^plan ma ~121 plików do recenzji bota .* rozważ sekcję „## Części PR”$/)
    assert.equal(PROG_UWAGI_PR, 120)
    assert.deepEqual(sprawdzCzesci(parsujPlan(plan([pliki('a', 70), pliki('b', 50)])), k), { bledy: [], uwagi: [] })
    assert.deepEqual(sprawdzCzesci(parsujPlan(plan([pliki('a', 100), pliki('b', 50)])), k).bledy, [], 'dokladnie 150 bez sekcji przechodzi')
  })
})

test('sekcja Części PR: fazy po kolei i kazda czesc < 150 = bez bledu; luka, nakladanie, brak ostatniej fazy, czesc >= 150 = blad', () => {
  const fazy = [pliki('a', 60), pliki('b', 40), pliki('c', 50), pliki('d', 60)]
  const naglowek = '| Część | Fazy | Pliki |\n|---|---|---|\n'
  wProjekcie({}, (k) => {
    const dobry = parsujPlan(plan(fazy, `${naglowek}| 1 | 1–2 | 100 |\n| 2 | 3-4 | 110 |`))
    assert.deepEqual(sprawdzCzesci(dobry, k), { bledy: [], uwagi: [] })
    assert.deepEqual(rozmiarPlanu(dobry, k).czesci, [{ czesc: 1, fazy: '1–2', pliki: 100 }, { czesc: 2, fazy: '3–4', pliki: 110 }])
    for (const zle of ['| 1 | 1–2 |\n| 2 | 4 |', '| 1 | 1 |\n| 2 | 1–2 |\n| 3 | 3–4 |', '| 1 | 1–2 |\n| 2 | 3 |', '| 2 | 1–2 |\n| 1 | 3–4 |']) {
      assert.deepEqual(sprawdzCzesci(parsujPlan(plan(fazy, naglowek + zle)), k).bledy,
        ['Części PR: części numerowane od 1 pokrywają fazy 1–4 po kolei, bez luk i nakładania — cięcie tylko na granicy faz'], zle)
    }
    const zaDuza = sprawdzCzesci(parsujPlan(plan(fazy, `${naglowek}| 1 | 1–3 |\n| 2 | 4 |`)), k).bledy
    assert.equal(zaDuza.length, 1)
    assert.match(zaDuza[0], /^Części PR: część 1 \(fazy 1–3\) ma ~150 plików do recenzji — każda część < 150 \(propozycja: część 1: fazy 1–2/)
  })
})

test('sekcja: zapis wiersza spoza „| N | od–do |” albo sekcja bez tabeli = problem; brak sekcji = null', () => {
  assert.deepEqual(sekcjaCzesci('# P\n\n## Części PR\n\n| Część | Fazy |\n|---|---|\n| 1 | `1–3` |\n| **2** | 4 |\n\n## Dalej\n| 9 | 9 |'),
    { czesci: [{ czesc: 1, od: 1, do: 3 }, { czesc: 2, od: 4, do: 4 }], problemy: [] })
  assert.deepEqual(sekcjaCzesci('## Części PR\n\n| 1 | fazy pierwsze |\n')?.problemy,
    ['Części PR: wiersz „| 1 | fazy pierwsze |” — zapis „| N | od–do |” (numer części, fazy liczbami)'])
  assert.deepEqual(sekcjaCzesci('## Czesci PR\n\nPodzielimy po fazie 3.\n')?.problemy, ['Części PR: sekcja bez tabeli „| Część | Fazy |”'])
  assert.equal(sekcjaCzesci('## Implementation Units\n'), null)
})

// vibersi etap 3 (pomiar na koncach faz, archiwum 08e5584): prefiksy 14 / 61 / 93 / 131 / 146 / 172, czesc od fazy 4 do czubka 101.
// Ciecie jak najpozniej dawaloby 146 / 30 (czesc 1 bez zapasu na tury bota); podzial reczny operatora byl po fazie 3.
test('podzial faz: najmniej czesci < 150, z rownie licznych najmniejsza najwieksza; faza sama >= 150 = null', () => {
  const prefiks = [14, 61, 93, 131, 146, 172]
  const odFazy4 = { 3: 53, 4: 84, 5: 101 }
  const rozmiar = (/** @type {number} */ od, /** @type {number} */ doFazy) => {
    if (od === 0) return prefiks[doFazy]
    if (od === 3) return odFazy4[/** @type {3 | 4 | 5} */ (doFazy)]
    return prefiks[doFazy] - prefiks[od - 1] + 10
  }
  assert.deepEqual(podzialFaz(6, rozmiar), [2])
  assert.deepEqual(podzialFaz(2, () => 40), [])
  assert.equal(podzialFaz(3, (od, doFazy) => (od <= 1 && doFazy >= 1 ? 160 : 20)), null)
  assert.deepEqual(podzialFaz(3, (od, doFazy) => 60 * (doFazy - od + 1)), [0], 'trzy fazy po 60: dwie czesci (60 / 120), remis — pierwsze ciecie')
})

test('sprawdzPlan: blad czesci w wyniku walidacji planu (plan.mjs sprawdz, bramka gotowosci)', () => {
  wProjekcie({}, (k) => {
    const w = sprawdzPlan(parsujPlan(plan([pliki('a', 80), pliki('b', 80)])), k)
    assert.ok(w.bledy.some((b) => b.startsWith('plan ma ~160 plików do recenzji bota')), w.bledy.join('\n'))
  })
})
