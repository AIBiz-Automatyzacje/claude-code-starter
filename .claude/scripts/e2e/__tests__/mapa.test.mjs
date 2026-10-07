// Mapa funkcji skilla weryfikacji (P14, PANEL-WEJSCIE §2 pkt 14): jeden wpis na funkcje (droga uzytkownika, dowod dzialania,
// pliki kodu), dopisywany przy archiwizacji zadania ze scenariuszy [E2E] planu technicznego i zasiewany przez generator skilla.
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/mapa.test.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { parsujMape, rozbijScenariusz, scalMape, wpisyZPlanu } from '../mapa.mjs'
import { PLIK_MAPY, PLIK_SKILLA } from '../weryfikacja.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '../e2e.mjs')
const PLAN = readFileSync(resolve(KATALOG, '../../plan/__tests__/fixtures/plan-techniczny.md'), 'utf8')
const SCIEZKA_PLANU = 'docs/plans/2026-10-07-001-feat-publikacja-ofert-plan.md'

test('rozbijScenariusz: flow i seed poza droga; dowod za ostatnia strzalka; koncowe „→ PASS” to nie dowod', () => {
  assert.deepEqual(rozbijScenariusz('`a` (seed: e2e/seeds/a-seed.sql) — otwórz /a, kliknij „Zapisz” → toast „Zapisano”'),
    { droga: 'otwórz /a, kliknij „Zapisz”', dowod: 'toast „Zapisano”' })
  assert.deepEqual(rozbijScenariusz('`b` — tap → toast → commit → punkty skaczą → PASS.'), { droga: 'tap → toast → commit', dowod: 'punkty skaczą' })
  assert.deepEqual(rozbijScenariusz('`c` — sama droga bez stanu'), { droga: 'sama droga bez stanu', dowod: '' })
  assert.deepEqual(rozbijScenariusz('`d` -> ekran celu'), { droga: '', dowod: 'ekran celu' })
})

test('wpisyZPlanu: scenariusz [E2E] z flow = wpis z plikami kodu swojej jednostki (bez testow, seedow i migracji); runner i linia bez flow pominiete', () => {
  const wpisy = wpisyZPlanu(PLAN, 'publikacja-ofert')
  assert.deepEqual(wpisy.map((w) => w.flow), ['publikacja-oferty', 'oferta-publiczna'])
  assert.deepEqual(wpisy[0], {
    flow: 'publikacja-oferty',
    droga: 'otwórz /oferty, kliknij „Publikuj” przy szkicu, zrób screenshot',
    dowod: 'oferta ma status „opublikowana”',
    pliki: ['src/features/oferty/components/lista-ofert.tsx'],
    zadania: ['publikacja-ofert'],
  })
  assert.deepEqual(wpisy[1].pliki, ['src/pages/oferta-publiczna.tsx', 'src/hooks/use-oferta-publiczna.ts'])
})

test('scalMape: nowa mapa z naglowkiem; scalenie po flow — droga i dowod z nowego planu, pliki i zadania sumowane, wlasne pola wpisu zostaja', () => {
  const pierwsza = scalMape(null, wpisyZPlanu(PLAN, 'publikacja-ofert'), 'oferty')
  assert.match(pierwsza.tekst, /^# Mapa funkcji — oferty\n/)
  assert.deepEqual([pierwsza.dodane, pierwsza.zaktualizowane], [['publikacja-oferty', 'oferta-publiczna'], []])
  assert.match(pierwsza.tekst, /^## `publikacja-oferty`\n- Droga: otwórz \/oferty, kliknij „Publikuj” przy szkicu, zrób screenshot\n- Dowód: oferta ma status „opublikowana”\n- Pliki: `src\/features\/oferty\/components\/lista-ofert\.tsx`\n- Zadania: publikacja-ofert\n/m)

  const zSelektorami = pierwsza.tekst.replace('- Zadania: publikacja-ofert\n', '- Zadania: publikacja-ofert\n- Selektory: przycisk `data-testid="publikuj"`\n')
  const nowy = [{ flow: 'publikacja-oferty', droga: 'otwórz /oferty/szkice, kliknij „Publikuj”', dowod: 'status „opublikowana” i link publiczny', pliki: ['src/features/oferty/components/szkice.tsx', 'src/features/oferty/components/lista-ofert.tsx'], zadania: ['szkice-ofert'] }]
  const druga = scalMape(zSelektorami, nowy, 'oferty')
  assert.deepEqual([druga.dodane, druga.zaktualizowane], [[], ['publikacja-oferty']])
  const wpis = parsujMape(druga.tekst).wpisy.get('publikacja-oferty')
  assert.deepEqual(wpis, [
    ['Droga', 'otwórz /oferty/szkice, kliknij „Publikuj”'],
    ['Dowód', 'status „opublikowana” i link publiczny'],
    ['Pliki', '`src/features/oferty/components/lista-ofert.tsx`, `src/features/oferty/components/szkice.tsx`'],
    ['Zadania', 'publikacja-ofert, szkice-ofert'],
    ['Selektory', 'przycisk `data-testid="publikuj"`'],
  ])
  assert.ok(druga.tekst.indexOf('`publikacja-oferty`') < druga.tekst.indexOf('`oferta-publiczna`'), 'kolejnosc wpisow zachowana')
})

test('scalMape: idempotentne — drugie scalenie tych samych wpisow nie zmienia tekstu; opis nad wpisami zostaje', () => {
  const raz = scalMape(null, wpisyZPlanu(PLAN, 'publikacja-ofert'), 'oferty').tekst
  const zOpisem = raz.replace('\n## ', '\nOpis dopisany przez operatora.\n\n## ')
  const dwa = scalMape(zOpisem, wpisyZPlanu(PLAN, 'publikacja-ofert'), 'oferty')
  assert.equal(dwa.tekst, zOpisem)
  assert.deepEqual([dwa.dodane, dwa.zaktualizowane], [[], []])
})

test('parsujMape: wpis bez backticka w naglowku i linie spoza listy pol nie gubia sie (zostaja w tresci wpisu)', () => {
  const md = '# Mapa funkcji — x\n\n## `a`\n- Droga: /a\nnotatka luzna\n\n## Sekcja reczna\n- Coś: tak\n'
  const m = parsujMape(md)
  assert.deepEqual([...m.wpisy.keys()], ['a'])
  assert.equal(scalMape(md, [], 'x').tekst, md)
})

// Wniosek z P13: parser sprawdzany na wszystkich planach z dysku, nie tylko na idealnym fixture.
test('wpisyZPlanu na prawdziwych planach z dysku: bez wyjatku, kazdy wpis ma flow i droge albo dowod', (t) => {
  const korzen = join(homedir(), 'Documents/Kodowanie')
  if (!existsSync(korzen)) return t.skip('brak katalogu z projektami')
  const plany = execFileSync('find', [korzen, '-path', '*docs/plans/*-plan.md', '-not', '-path', '*/node_modules/*'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  let wpisow = 0
  for (const p of plany) {
    for (const w of wpisyZPlanu(readFileSync(p, 'utf8'), 'x')) {
      wpisow += 1
      assert.ok(w.flow && (w.droga || w.dowod), `${p}: ${JSON.stringify(w)}`)
      assert.ok(!w.pliki.some((f) => /\.test\.|__tests__|\/seeds\/|-seed\.sql$/.test(f)), `${p}: plik testu albo seeda w mapie: ${w.pliki}`)
    }
  }
  assert.ok(plany.length === 0 || wpisow > 0, 'na dysku sa plany z [E2E], a mapa nie dostala zadnego wpisu')
})

/** @param {boolean} skill */
function projekt(skill) {
  const k = mkdtempSync(join(tmpdir(), 'e2e-mapa-'))
  mkdirSync(join(k, 'docs/active/publikacja-ofert'), { recursive: true })
  mkdirSync(join(k, 'docs/plans'), { recursive: true })
  writeFileSync(join(k, SCIEZKA_PLANU), PLAN)
  writeFileSync(join(k, 'docs/active/publikacja-ofert/publikacja-ofert-plan.md'), `# Plan\n\nPlan techniczny: \`${SCIEZKA_PLANU}\`\n`)
  writeFileSync(join(k, 'docs/active/publikacja-ofert/publikacja-ofert-zadania.md'), '## Faza 1\n')
  if (skill) {
    mkdirSync(join(k, dirname(PLIK_SKILLA)), { recursive: true })
    writeFileSync(join(k, PLIK_SKILLA), '# Weryfikacja\n')
  }
  return k
}

/** @param {string} k @param {string[]} a */
function uruchom(k, a) {
  const w = spawnSync('node', [CLI, ...a, '--projekt', k], { encoding: 'utf8' })
  return { kod: w.status, json: w.stdout.trim() ? JSON.parse(w.stdout) : null, stderr: w.stderr }
}

test('CLI mapa: bez skilla weryfikacji pominiete (kod 0, plik nie powstaje); ze skillem zapis, drugi raz bez zmian', () => {
  const bez = projekt(false)
  const p = uruchom(bez, ['mapa', '--zadanie', 'docs/active/publikacja-ofert'])
  assert.equal(p.kod, 0, p.stderr)
  assert.match(p.json.pominieto, /brak skilla weryfikacji/)
  assert.equal(existsSync(join(bez, PLIK_MAPY)), false)
  rmSync(bez, { recursive: true })

  const ze = projekt(true)
  const w = uruchom(ze, ['mapa', '--zadanie', 'docs/active/publikacja-ofert'])
  assert.equal(w.kod, 0, w.stderr)
  assert.deepEqual(w.json, { plik: PLIK_MAPY, plan: SCIEZKA_PLANU, dodane: ['publikacja-oferty', 'oferta-publiczna'], zaktualizowane: [] })
  assert.match(readFileSync(join(ze, PLIK_MAPY), 'utf8'), /^# Mapa funkcji — e2e-mapa-/)
  assert.deepEqual(uruchom(ze, ['mapa', '--zadanie', 'docs/active/publikacja-ofert']).json.dodane, [])
  rmSync(ze, { recursive: true })
})

test('CLI mapa: zadanie bez planu technicznego = kod 1 z bledem (archiwizacja wpisuje go do rezultatow)', () => {
  const k = projekt(true)
  rmSync(join(k, SCIEZKA_PLANU))
  const w = uruchom(k, ['mapa', '--zadanie', 'docs/active/publikacja-ofert'])
  assert.equal(w.kod, 1)
  assert.match(w.json.blad, /brak planu technicznego/)
  rmSync(k, { recursive: true })
})
