// Warunek uruchomienia CLI (issue #3 claude-code-starter): `import.meta.url === \`file://${argv[1]}\`` jest falszywy, gdy
// sciezka ma spacje albo polskie znaki (w URL-u zakodowane: %20, %C5%81) — skrypt konczyl sie kodem 0 bez wyjscia, a autopilot
// dostawal pusty wynik czesci PR i kontroli zmiennych smoke. `argv[1] === fileURLToPath(...)` bez realpath przepuszcza z kolei
// sciezke przez dowiazanie (/tmp → /private/tmp na macOS): hook env-wartosci wolany przez dowiazanie nie blokowal niczego.

import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const CLAUDE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WARUNEK = 'if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {'
const POMIJANE = new Set(['__tests__', 'node_modules', '.backups', 'worktrees'])

/** @param {string} katalog @returns {string[]} pliki .mjs i .js pod katalogiem, bez testow i kopii */
function skrypty(katalog) {
  return readdirSync(katalog, { withFileTypes: true }).flatMap((w) => {
    const sciezka = join(katalog, w.name)
    if (w.isDirectory()) return POMIJANE.has(w.name) ? [] : skrypty(sciezka)
    return /\.(mjs|js)$/.test(w.name) ? [sciezka] : []
  })
}

test('każdy warunek uruchomienia CLI w .claude/ porównuje realpath argv[1] z fileURLToPath', () => {
  const linie = skrypty(CLAUDE).flatMap((plik) => readFileSync(plik, 'utf8').split('\n')
    .map((linia, i) => ({ plik: plik.slice(CLAUDE.length + 1), nr: i + 1, linia: linia.trim() }))
    .filter((l) => l.linia.startsWith('if (') && l.linia.includes('import.meta.url') && l.linia.includes('process.argv[1]')))
  assert.ok(linie.length >= 9,`za mało warunków (${linie.length}) — zmienił się zapis albo katalogi`)
  assert.deepEqual(linie.filter((l) => l.linia !== WARUNEK).map((l) => `${l.plik}:${l.nr}`), [])
})

test('CLI z kopii w ścieżce ze spacją i polskimi znakami oraz przez dowiązanie odpowiada zamiast milczeć', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'cli-sciezka-'))
  try {
    const projekt = join(tmp, 'projekt z spacją Ł')
    for (const k of ['scripts', 'hooks']) {
      cpSync(join(CLAUDE, k), join(projekt, '.claude', k), { recursive: true, filter: (z) => !z.includes('__tests__') })
    }
    const dowiazanie = join(tmp, 'dowiazanie')
    symlinkSync(projekt, dowiazanie)
    for (const korzen of [projekt, dowiazanie]) {
      for (const cli of ['scripts/pr/czesci.mjs', 'scripts/pr/rozmiar.mjs', 'scripts/smoke/zmienne.mjs']) {
        const w = spawnSync(process.execPath, [join(korzen, '.claude', cli), '--nieznana'], { encoding: 'utf8' })
        assert.equal(w.status, 2, `${korzen} ${cli}: ${w.stderr}`)
        assert.match(w.stderr, /Uzycie:/, cli)
      }
      const hook = spawnSync(process.execPath, [join(korzen, '.claude', 'hooks', 'env-wartosci.mjs')], {
        encoding: 'utf8', input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'cat .env' } }),
      })
      assert.equal(hook.status, 2, `${korzen} env-wartosci: blokada zamiast przepuszczenia`)
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
