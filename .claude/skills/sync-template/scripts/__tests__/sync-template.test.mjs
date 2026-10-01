// Test zapisu odciskow plikow przez sync-template.sh (It. 1, krok 9; przeglad D5 §8 pkt 3, decyzja O8).
// Po co: telemetria porownuje hash skryptu, ktory sie wykonal (plik harnessu), z hashem pliku z ostatniego sync
// (`run.szablon.zgodny`). Hash repo projektu tego nie mowi — 33/55 runow autopilota puscilo skrypt spoza historii szablonu.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const SKRYPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'sync-template.sh')

/** @param {string} repo @param {string[]} argumenty */
const git = (repo, argumenty) => execFileSync('git', ['-C', repo, ...argumenty], { encoding: 'utf8' }).trim()

function zrodloSzablonu() {
  const zrodlo = mkdtempSync(join(tmpdir(), 'sync-zrodlo-'))
  git(zrodlo, ['init', '-q'])
  git(zrodlo, ['config', 'user.email', 't@t'])
  git(zrodlo, ['config', 'user.name', 't'])
  mkdirSync(join(zrodlo, '.claude', 'workflows'), { recursive: true })
  writeFileSync(join(zrodlo, '.claude', 'workflows', 'dev-x-wf.js'), "export const meta = { name: 'dev-x-wf' }\nlog('zażółć')\n")
  writeFileSync(join(zrodlo, '.claude', 'settings.json'), '{}\n')
  git(zrodlo, ['add', '.'])
  git(zrodlo, ['commit', '-q', '-m', 'szablon'])
  return zrodlo
}

/** @param {string} zrodlo @param {string} projekt @param {string[]} [argumenty] */
function sync(zrodlo, projekt, argumenty = []) {
  const w = spawnSync('bash', [SKRYPT, ...argumenty], { encoding: 'utf8', env: { ...process.env, TEMPLATE_LOCAL_SRC: zrodlo, PROJECT_DIR: projekt } })
  assert.equal(w.status, 0, w.stdout + w.stderr)
  return w.stdout
}

test('sync zapisuje .claude/.template-hashes: hash gita kazdego pliku zarzadzanego', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    sync(zrodlo, projekt)
    const hashe = readFileSync(join(projekt, '.claude', '.template-hashes'), 'utf8').trim().split('\n').map((l) => l.split('\t'))
    assert.deepEqual(hashe.map(([, sciezka]) => sciezka).sort(), ['.claude/settings.json', '.claude/workflows/dev-x-wf.js'])
    for (const [hash, sciezka] of hashe) {
      assert.equal(hash, git(zrodlo, ['hash-object', sciezka]), `${sciezka}: hash rozny od git hash-object`)
    }
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

test('drugi sync bez zmian w szablonie nie przepisuje pliku odciskow', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    sync(zrodlo, projekt)
    const plik = join(projekt, '.claude', '.template-hashes')
    const przed = statSync(plik).mtimeMs
    assert.match(sync(zrodlo, projekt), /UP_TO_DATE/)
    assert.equal(statSync(plik).mtimeMs, przed)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

test('sync bez roznic w plikach (--force) tez zapisuje odciski', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    sync(zrodlo, projekt)
    rmSync(join(projekt, '.claude', '.template-hashes'))
    assert.match(sync(zrodlo, projekt, ['--force']), /brak różnic/)
    assert.ok(readFileSync(join(projekt, '.claude', '.template-hashes'), 'utf8').includes('.claude/workflows/dev-x-wf.js'))
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

// P1 (PLAN-POPRAWY): szablon usuwa skille — sync ma je zdjac z projektu razem z katalogiem,
// zostawiajac kopie w .backups/ i nie ruszajac skilli dodanych lokalnie przez projekt.
test('skill usuniety w szablonie znika z projektu, lokalny skill projektu zostaje', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    mkdirSync(join(zrodlo, '.claude', 'skills', 'stary', 'resources'), { recursive: true })
    writeFileSync(join(zrodlo, '.claude', 'skills', 'stary', 'SKILL.md'), '---\nname: stary\n---\n')
    writeFileSync(join(zrodlo, '.claude', 'skills', 'stary', 'resources', 'opis.md'), 'opis\n')
    git(zrodlo, ['add', '.'])
    git(zrodlo, ['commit', '-q', '-m', 'skill stary'])
    sync(zrodlo, projekt)
    mkdirSync(join(projekt, '.claude', 'skills', 'wlasny'), { recursive: true })
    writeFileSync(join(projekt, '.claude', 'skills', 'wlasny', 'SKILL.md'), '---\nname: wlasny\n---\n')

    git(zrodlo, ['rm', '-rq', '.claude/skills/stary'])
    git(zrodlo, ['commit', '-q', '-m', 'usun skill stary'])
    const wyjscie = sync(zrodlo, projekt)

    assert.match(wyjscie, /USUNIETE:\n {2}\.claude\/skills\/stary\/SKILL\.md\n {2}\.claude\/skills\/stary\/resources\/opis\.md/)
    assert.throws(() => statSync(join(projekt, '.claude', 'skills', 'stary')), { code: 'ENOENT' })
    assert.equal(readFileSync(join(projekt, '.claude', 'skills', 'wlasny', 'SKILL.md'), 'utf8'), '---\nname: wlasny\n---\n')
    assert.ok(!readFileSync(join(projekt, '.claude', '.template-hashes'), 'utf8').includes('skills/stary'))
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})
