// Otwarte sprawy po automacie (punkt 40, krok 6; punkt 45): liczby z plikow smoke'u i spraw odlozonych, nie z pamieci sesji.
//
// Uruchomienie: node --test .claude/scripts/smoke/__tests__/otwarte.test.mjs

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { liczSmoke, otwarte, parsujOdlozone, plikSmoke, zdanieOtwartych } from '../otwarte.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '..', 'otwarte.mjs')
const SKILL_SMOKE = readFileSync(resolve(KATALOG, '../../../skills/dev-smoke/SKILL.md'), 'utf8')

/** @param {Record<string, string>} pliki @returns {string} */
function projekt(pliki) {
  const k = mkdtempSync(join(tmpdir(), 'otwarte-'))
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(dirname(join(k, p)), { recursive: true })
    writeFileSync(join(k, p), t)
  }
  return k
}

const SMOKE = `# Smoke\n\n## Decyzje przed PR\n- [x] D1 (faza 2, fix): limit → zostaw jak jest\n  - Gdzie: \`src/a.ts:5\`\n\n## 1. Ekran\n- [ ] Klik → widać listę\n- [x] Klik 2 → OK\n- [ ] **[fizyczne urządzenie]** dotyk\n- [ ] Sprawdź na produkcji po deployu → strona wstaje\n`
const ODLOZONE = `# Sprawy odłożone\n\nPozycje odłożone w smoke'u.\n\n- [ ] [etap: etap 5] sklep D2: limit koszyka — \`src/k.ts:9\` (smoke 2026-11-11)\n- [x] [etap: etap 4] sklep D1: zrobione w abc\n- [ ] [etap: następny etap] blog D1: pusty stan — \`src/b.ts:1\` (smoke 2026-11-10)\n- [ ] luźna notatka bez etykiety\n`

test('liczSmoke: nieodhaczone checkboxy, osobno „po deployu”; podpunkty i odhaczone pomija', () => {
  assert.deepEqual(liczSmoke(SMOKE), { otwarte: 3, poDeployu: 1 })
  assert.deepEqual(liczSmoke(SMOKE.replace(/\n/g, '\r\n')), { otwarte: 3, poDeployu: 1 })
})

test('parsujOdlozone: tylko nieodhaczone pozycje z etykietą etapu, z numerem linii', () => {
  assert.deepEqual(parsujOdlozone(ODLOZONE), [
    { linia: 5, etap: 'etap 5', tresc: 'sklep D2: limit koszyka — `src/k.ts:9` (smoke 2026-11-11)' },
    { linia: 7, etap: 'następny etap', tresc: 'blog D1: pusty stan — `src/b.ts:1` (smoke 2026-11-10)' },
  ])
})

test('format odłożonych zgodny ze skillem /dev-smoke (pozycja z szablonu skilla przechodzi parser)', () => {
  const wzor = /`(- \[ \] \[etap: <etykieta>\] [^\n]+?)`\. Etykieta/.exec(SKILL_SMOKE.replace(/\n\s+/g, ' '))?.[1] ?? ''
  assert.ok(wzor, 'skill /dev-smoke ma wzór pozycji odłożonej')
  const linia = wzor.replace(/\\`/g, '`').replace('<etykieta>', 'etap 3')
  assert.equal(parsujOdlozone(linia)[0]?.etap, 'etap 3')
})

test('plikSmoke: najnowszy smoke zadania po dacie w nazwie, bez smoke\'ów innych zadań', () => {
  const k = projekt({
    'docs/operator/2026-11-01-sklep-smoke.md': '- [ ] a\n',
    'docs/operator/2026-11-09-sklep-smoke.md': '- [ ] b\n',
    'docs/operator/2026-11-10-maly-sklep-smoke.md': '- [ ] c\n',
    'docs/operator/2026-11-12-inny-smoke.md': '- [ ] d\n',
  })
  try {
    assert.equal(plikSmoke(k, 'sklep'), 'docs/operator/2026-11-09-sklep-smoke.md')
    assert.equal(plikSmoke(k, 'brak'), null)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
  assert.equal(plikSmoke(tmpdir(), 'x'), null)
})

test('otwarte + zdanie: liczby z plików; zero mówi wprost „brak”, bez smoke\'u nie liczy pozycji smoke\'u', () => {
  const k = projekt({ 'docs/operator/2026-11-11-sklep-smoke.md': SMOKE, 'docs/operator/odlozone.md': ODLOZONE })
  try {
    const w = otwarte(k, { zadanie: 'sklep' })
    assert.deepEqual(w.smoke, { plik: 'docs/operator/2026-11-11-sklep-smoke.md', otwarte: 3, poDeployu: 1 })
    assert.equal(w.odlozone.otwarte.length, 2)
    assert.equal(w.zdanie, 'Otwarte: 3 pozycji smoke\'u, 2 odłożonych (docs/operator/odlozone.md).')
    assert.equal(otwarte(k).zdanie, 'Otwarte: 2 odłożonych (docs/operator/odlozone.md).')
    const cli = spawnSync(process.execPath, [CLI, '--zadanie', 'sklep', '--projekt', k], { encoding: 'utf8' })
    assert.equal(cli.status, 0)
    assert.equal(JSON.parse(cli.stdout).zdanie, w.zdanie)
    assert.equal(spawnSync(process.execPath, [CLI, '--zadanie', '../x'], { encoding: 'utf8' }).status, 2)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
  assert.equal(zdanieOtwartych({ smoke: { otwarte: 0 }, odlozone: { otwarte: [] } }), 'Otwarte: brak (smoke odhaczony, nic odłożonego).')
  assert.equal(zdanieOtwartych({ smoke: null, odlozone: { otwarte: [] } }), 'Otwarte: brak (bez smoke\'u, nic odłożonego).')
})

// Raporty i planowanie czytaja te same liczby: archiwizacja, /dev-pr i /dev-smoke biora zdanie ze skryptu, /dev-prep — sprawy odlozone.
test('skille: raporty biorą zdanie z otwarte.mjs, /dev-prep zamienia sprawy odłożone w decyzje', () => {
  const czytaj = (/** @type {string} */ s) => readFileSync(resolve(KATALOG, '../../../skills', s), 'utf8').replace(/\n\s*/g, ' ')
  assert.match(czytaj('dev-docs-complete/SKILL.md'), /📌 <zdanie z `node \.claude\/scripts\/smoke\/otwarte\.mjs --zadanie \$ARGUMENTS`, pole `zdanie`, 1:1/)
  const pr = czytaj('dev-pr/SKILL.md')
  assert.match(pr, /Otwarte sprawy: <pole `zdanie` z `node \.claude\/scripts\/smoke\/otwarte\.mjs --zadanie <zadanie>`, 1:1>/)
  assert.match(pr, /dopóki zdanie nie brzmi „Otwarte: brak …”, nie piszesz, że zadanie jest zamknięte w całości/)
  assert.match(czytaj('dev-smoke/SKILL.md'), /pole `zdanie` z `node \.claude\/scripts\/smoke\/otwarte\.mjs --zadanie <zadanie>` 1:1/)
  const prep = czytaj('dev-prep/SKILL.md')
  assert.match(prep, /`node \.claude\/scripts\/smoke\/otwarte\.mjs` \(pole `odlozone\.otwarte`/)
  assert.match(prep, /\*\*Sprawy odłożone w smoke'u\.\*\* Każda otwarta pozycja `odlozone\.otwarte` ze skanu \(1\.2\) to decyzja bez markera blokady/)
})
