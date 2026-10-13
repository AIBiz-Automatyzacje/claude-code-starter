// Zmienne srodowiska dodane w galezi vs smoke operatora (P19). vibersi etap 2: smoke z archiwum (1457e5d) wymienial zmienne
// z planu, a `SUPABASE_SECRET_KEY` (odchylenie faz 1–2, jest w .env.example) dopisala sesja recznie (a8df841).
// Fixture: .env.example vibersi z bazy etapu (bdd35ce) i z archiwum etapu 2 (puste wartosci) + wycinki smoke'u z liniami zmiennych.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { brakiWSmoke, dodaneLinie, nazwyWLinii, noweZmienne } from '../zmienne.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = join(KATALOG, '..', 'zmienne.mjs')
const fixture = (/** @type {string} */ nazwa) => readFileSync(join(KATALOG, 'fixtures', nazwa), 'utf8')
const NOWE_ETAPU_2 = ['BASIC_AUTH_PASSWORD', 'BASIC_AUTH_USER', 'FB_APP_ID', 'SITE_URL', 'SUPABASE_DEV_DB_URL', 'SUPABASE_DEV_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_URL']

/** @param {(repo: string, git: (...a: string[]) => string) => void} cialo */
function zRepo(cialo) {
  const repo = mkdtempSync(join(tmpdir(), 'zmienne-'))
  const git = (/** @type {string[]} */ ...a) => {
    const w = spawnSync('git', a, { cwd: repo, encoding: 'utf8' })
    assert.equal(w.status, 0, w.stderr)
    return w.stdout
  }
  try {
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 't@x.pl')
    git('config', 'user.name', 't')
    cialo(repo, git)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

/** @param {string} repo @param {Record<string, string>} pliki */
function zapisz(repo, pliki) {
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(join(repo, p, '..'), { recursive: true })
    writeFileSync(join(repo, p), t)
  }
}

/** @param {string[]} argumenty @param {string} cwd */
const cli = (argumenty, cwd) => spawnSync(process.execPath, [CLI, ...argumenty], { cwd, encoding: 'utf8' })

test('vibersi etap 2: 9 zmiennych nowych w .env.example; smoke z archiwum bez SUPABASE_SECRET_KEY = kod 1 z brakiem, po a8df841 = kod 0', () => zRepo((repo, git) => {
  zapisz(repo, { '.env.example': fixture('vibersi-env-example-baza') })
  git('add', '-A')
  git('commit', '-qm', 'etap 1')
  git('switch', '-qc', 'feature/etap-2')
  zapisz(repo, { '.env.example': fixture('vibersi-env-example-etap2'), 'docs/smoke-archiwum.md': fixture('vibersi-smoke-archiwum.md'), 'docs/smoke-a8df841.md': fixture('vibersi-smoke-a8df841.md') })
  git('add', '-A')
  git('commit', '-qm', 'etap 2')
  const przed = cli(['--smoke', 'docs/smoke-archiwum.md'], repo)
  assert.equal(przed.status, 1, przed.stderr)
  const w = JSON.parse(przed.stdout)
  assert.deepEqual(w.zmienne.map((/** @type {{ nazwa: string }} */ z) => z.nazwa), NOWE_ETAPU_2)
  assert.deepEqual(w.zmienne.find((/** @type {{ nazwa: string }} */ z) => z.nazwa === 'SUPABASE_SECRET_KEY').zrodla, ['.env.example:17'])
  assert.deepEqual(w.braki, ['SUPABASE_SECRET_KEY'])
  const po = cli(['--smoke', 'docs/smoke-a8df841.md', '--projekt', repo], tmpdir())
  assert.equal(po.status, 0, po.stdout)
  assert.deepEqual(JSON.parse(po.stdout).braki, [])
  assert.equal(cli([], repo).status, 0, 'bez --smoke: sama lista, bez brakow')
  assert.equal(JSON.parse(cli([], repo).stdout).braki, undefined)
}))

test('uzycia w kodzie: process.env, import.meta.env, Deno.env.get w dodanych liniach; znane na bazie, wbudowane, testy i e2e pomijane', () => zRepo((repo, git) => {
  zapisz(repo, { 'src/stary.ts': 'export const u = import.meta.env.VITE_STARY\n' })
  git('add', '-A')
  git('commit', '-qm', 'baza')
  git('switch', '-qc', 'feature/x')
  zapisz(repo, {
    'src/stary.ts': 'export const u = import.meta.env.VITE_STARY\nexport const n = import.meta.env.VITE_NOWY ?? import.meta.env.MODE\n',
    'server/a.ts': "const k = process.env.KLUCZ_SERWERA\nconst t = process.env['TOKEN_X']\nif (process.env.NODE_ENV) {}\n",
    'supabase/functions/f/index.ts': "const s = Deno.env.get('SEKRET_FUNKCJI')\n",
    'src/a.test.ts': 'process.env.TYLKO_TEST\n',
    'e2e/seed.mjs': 'process.env.E2E_COS\n',
    '.env.e2e.example': 'E2E_URL=\n',
  })
  git('add', '-A')
  git('commit', '-qm', 'zmiany')
  const w = JSON.parse(cli(['--smoke', '/dev/null'], repo).stdout)
  assert.deepEqual(w.zmienne, [
    { nazwa: 'KLUCZ_SERWERA', zrodla: ['server/a.ts:1'] },
    { nazwa: 'SEKRET_FUNKCJI', zrodla: ['supabase/functions/f/index.ts:1'] },
    { nazwa: 'TOKEN_X', zrodla: ['server/a.ts:2'] },
    { nazwa: 'VITE_NOWY', zrodla: ['src/stary.ts:2'] },
  ])
  assert.deepEqual(w.braki, ['KLUCZ_SERWERA', 'SEKRET_FUNKCJI', 'TOKEN_X', 'VITE_NOWY'])
}))

test('funkcje: linie example i kodu, numery dodanych linii z diffu -U0, nazwa w smoke jako cale slowo', () => {
  assert.deepEqual(nazwyWLinii('.env.staging.example', 'export SITE_URL= # adres'), ['SITE_URL'])
  assert.deepEqual(nazwyWLinii('.env.example', '# SITE_URL=komentarz'), [])
  assert.deepEqual(nazwyWLinii('src/a.ts', 'f(process.env.A, import.meta.env.B)'), ['A', 'B'])
  assert.deepEqual(dodaneLinie('+++ b/a.ts\n@@ -1,0 +5,2 @@\n+x\n+y\n+++ /dev/null\n@@ -1 +0,0 @@\n'), [{ plik: 'a.ts', linia: 5, tresc: 'x' }, { plik: 'a.ts', linia: 6, tresc: 'y' }])
  const nowe = noweZmienne([{ plik: '.env.example', linia: 3, tresc: 'SUPABASE_URL=' }, { plik: '.env.example', linia: 4, tresc: 'APIFY_TOKEN=' }], new Set(['APIFY_TOKEN']))
  assert.deepEqual(nowe, [{ nazwa: 'SUPABASE_URL', zrodla: ['.env.example:3'] }])
  assert.deepEqual(brakiWSmoke(nowe, 'w Coolify `VITE_SUPABASE_URL`'), ['SUPABASE_URL'], 'VITE_SUPABASE_URL nie pokrywa SUPABASE_URL')
  assert.deepEqual(brakiWSmoke(nowe, 'w Coolify `SUPABASE_URL`'), [])
})

test('zle argumenty = kod 2; nieznana baza = kod 3 z bledem gita', () => zRepo((repo, git) => {
  zapisz(repo, { 'a.txt': 'a\n' })
  git('add', '-A')
  git('commit', '-qm', 'a')
  assert.equal(cli(['--nieznana'], repo).status, 2)
  const zla = cli(['--baza', 'nie-ma'], repo)
  assert.equal(zla.status, 3)
  assert.match(JSON.parse(zla.stdout).wyjatek, /^git merge-base|^git diff|^git ls-tree/)
}))
