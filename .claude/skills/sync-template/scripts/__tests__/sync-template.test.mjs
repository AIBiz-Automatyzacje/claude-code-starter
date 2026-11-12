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

// aa-exam po syncu: 11 z 1390 testow maszynerii padalo przez srodowisko (ajv w innej wersji, brak stacks/) i wygladalo jak
// uszkodzony sync. Testy maszynerii sa testami repo szablonu: sync ich nie przenosi, nie wpisuje do manifestu ani odciskow.
/** @param {string} zrodlo */
function skillZTestami(zrodlo) {
  mkdirSync(join(zrodlo, '.claude', 'skills', 'x', '__tests__', 'fixtures'), { recursive: true })
  writeFileSync(join(zrodlo, '.claude', 'skills', 'x', 'SKILL.md'), '---\nname: x\n---\n')
  writeFileSync(join(zrodlo, '.claude', 'skills', 'x', '__tests__', 'x.test.mjs'), "import 'ajv'\n")
  writeFileSync(join(zrodlo, '.claude', 'skills', 'x', '__tests__', 'fixtures', 'f.json'), '{}\n')
  git(zrodlo, ['add', '.'])
  git(zrodlo, ['commit', '-q', '-m', 'skill x z testami'])
}

test('testy maszynerii (__tests__/) nie trafiaja do projektu, manifestu ani odciskow', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    skillZTestami(zrodlo)
    const wyjscie = sync(zrodlo, projekt)
    assert.doesNotMatch(wyjscie, /__tests__/)
    assert.match(wyjscie, /COUNTS: nowe=3 /)
    assert.equal(readFileSync(join(projekt, '.claude', 'skills', 'x', 'SKILL.md'), 'utf8'), '---\nname: x\n---\n')
    assert.throws(() => statSync(join(projekt, '.claude', 'skills', 'x', '__tests__')), { code: 'ENOENT' })
    assert.equal(readFileSync(join(projekt, '.claude', '.template-manifest'), 'utf8'), '.claude/settings.json\n.claude/skills/x/SKILL.md\n.claude/workflows/dev-x-wf.js\n')
    assert.doesNotMatch(readFileSync(join(projekt, '.claude', '.template-hashes'), 'utf8'), /__tests__/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

// Projekt zsynchronizowany starsza wersja skryptu ma testy na dysku i w manifescie. Nastepny sync zdejmuje je ta sama droga
// co pliki wycofane z szablonu (USUNIETE, kopia w .backups/, pusty katalog znika); wlasny test projektu zostaje.
test('testy maszynerii z wczesniejszego syncu znikaja z projektu z kopia w backupie, wlasny test projektu zostaje', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    skillZTestami(zrodlo)
    sync(zrodlo, projekt)
    const stare = ['.claude/skills/x/__tests__/fixtures/f.json', '.claude/skills/x/__tests__/x.test.mjs']
    for (const rel of stare) {
      mkdirSync(dirname(join(projekt, rel)), { recursive: true })
      writeFileSync(join(projekt, rel), readFileSync(join(zrodlo, rel)))
    }
    const manifest = join(projekt, '.claude', '.template-manifest')
    writeFileSync(manifest, `${readFileSync(manifest, 'utf8')}${stare.join('\n')}\n`)
    const wlasny = join(projekt, '.claude', 'skills', 'wlasny', '__tests__', 'w.test.mjs')
    mkdirSync(dirname(wlasny), { recursive: true })
    writeFileSync(wlasny, '// test projektu\n')

    writeFileSync(join(zrodlo, '.claude', 'settings.json'), '{"a":1}\n')
    git(zrodlo, ['commit', '-qam', 'zmiana'])
    const wyjscie = sync(zrodlo, projekt)

    assert.match(wyjscie, /COUNTS: nowe=0 zmienione=1 usuniete=2 /)
    assert.match(wyjscie, /USUNIETE:\n {2}\.claude\/skills\/x\/__tests__\/fixtures\/f\.json\n {2}\.claude\/skills\/x\/__tests__\/x\.test\.mjs/)
    assert.throws(() => statSync(join(projekt, '.claude', 'skills', 'x', '__tests__')), { code: 'ENOENT' })
    const backup = /BACKUP: (.+)/.exec(wyjscie)?.[1] ?? ''
    assert.equal(readFileSync(join(backup, '.claude', 'skills', 'x', '__tests__', 'x.test.mjs'), 'utf8'), "import 'ajv'\n")
    assert.equal(readFileSync(wlasny, 'utf8'), '// test projektu\n')
    assert.doesNotMatch(readFileSync(manifest, 'utf8'), /__tests__/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

// Weryfikacja partii 26–45, punkt 55 (27): pierwszy sync starym skryptem kopiowal testy i zapisywal nowy SHA, a nastepny konczyl sie
// UP_TO_DATE — testy zostawaly do kolejnego commitu szablonu. Manifest z __tests__/ wymusza pelna sciezke bez zmiany w szablonie.
test('sync przy aktualnym SHA, ale z testami w manifescie: zdejmuje je zamiast UP_TO_DATE; wlasny test projektu zostaje', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    skillZTestami(zrodlo)
    sync(zrodlo, projekt)
    // Stan po pierwszym syncu starym skryptem: testy na dysku i w manifescie, VERSION = SHA szablonu.
    const stare = ['.claude/skills/x/__tests__/fixtures/f.json', '.claude/skills/x/__tests__/x.test.mjs']
    for (const rel of stare) {
      mkdirSync(dirname(join(projekt, rel)), { recursive: true })
      writeFileSync(join(projekt, rel), readFileSync(join(zrodlo, rel)))
    }
    const manifest = join(projekt, '.claude', '.template-manifest')
    writeFileSync(manifest, `${readFileSync(manifest, 'utf8')}${stare.join('\n')}\n`)
    const wlasny = join(projekt, '.claude', 'skills', 'wlasny', '__tests__', 'w.test.mjs')
    mkdirSync(dirname(wlasny), { recursive: true })
    writeFileSync(wlasny, '// test projektu\n')

    const wyjscie = sync(zrodlo, projekt)
    assert.doesNotMatch(wyjscie, /UP_TO_DATE/)
    assert.match(wyjscie, /COUNTS: nowe=0 zmienione=0 usuniete=2 /)
    assert.throws(() => statSync(join(projekt, '.claude', 'skills', 'x', '__tests__')), { code: 'ENOENT' })
    assert.equal(readFileSync(wlasny, 'utf8'), '// test projektu\n')
    assert.doesNotMatch(readFileSync(manifest, 'utf8'), /__tests__/)
    // Kolejny sync: manifest czysty, szablon bez zmian — znow szybkie wyjscie.
    assert.match(sync(zrodlo, projekt), /STATUS: UP_TO_DATE/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
  const skill = readFileSync(resolve(dirname(SKRYPT), '..', 'SKILL.md'), 'utf8').replace(/\n\s*/g, ' ')
  assert.match(skill, /Po pierwszym syncu na tę wersję uruchom sync drugi raz: pierwszy idzie jeszcze starym skryptem z projektu i testy kopiuje/)
})

// P2 (PLAN-POPRAWY): N2 — instrukcje i skille sa buforowane w sesji, wiec po zmianie .claude/ autopilot w starej sesji
// dzialalby na starej maszynerii. Komunikat ma wyjsc po kazdym syncu, ktory cos zmienil, i tylko wtedy.
test('sync, ktory zmienil .claude/, konczy sie komunikatem o nowej sesji; UP_TO_DATE — bez komunikatu', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    assert.match(sync(zrodlo, projekt), /NOWA SESJA: \.claude\/ się zmieniło — otwórz nową sesję Claude Code przed \/dev-autopilot-wf/)
    assert.doesNotMatch(sync(zrodlo, projekt), /NOWA SESJA/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

// P2: pierwsza instalacja (brak .template-version) uruchamia doctor z projektu — brak narzedzia wychodzi przed pierwszym
// runem. Wynik doctora nie zmienia kodu wyjscia syncu (sync sie udal); kolejne synci doctora nie wolaja.
test('pierwsza instalacja uruchamia doctor projektu, kolejny sync — nie', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    mkdirSync(join(zrodlo, '.claude', 'scripts', 'doctor'), { recursive: true })
    writeFileSync(join(zrodlo, '.claude', 'scripts', 'doctor', 'doctor.sh'), 'echo "DOCTOR-ATRAPA $1"\nexit 1\n')
    git(zrodlo, ['add', '.'])
    git(zrodlo, ['commit', '-q', '-m', 'doctor'])

    const pierwszy = sync(zrodlo, projekt)
    assert.match(pierwszy, new RegExp(`DOCTOR-ATRAPA ${projekt}`))
    assert.match(pierwszy, /DOCTOR_KOD: 1/)

    writeFileSync(join(zrodlo, '.claude', 'settings.json'), '{"a":1}\n')
    git(zrodlo, ['commit', '-qam', 'zmiana'])
    assert.doesNotMatch(sync(zrodlo, projekt), /DOCTOR/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

test('pierwszy sync projektu, ktory ma juz identyczne .claude/ (skopiowane recznie), tez uruchamia doctor', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    mkdirSync(join(zrodlo, '.claude', 'scripts', 'doctor'), { recursive: true })
    writeFileSync(join(zrodlo, '.claude', 'scripts', 'doctor', 'doctor.sh'), 'echo "DOCTOR-ATRAPA $1"\n')
    git(zrodlo, ['add', '.'])
    git(zrodlo, ['commit', '-q', '-m', 'doctor'])
    execFileSync('cp', ['-R', join(zrodlo, '.claude'), join(projekt, '.claude')])

    const wyjscie = sync(zrodlo, projekt)
    assert.match(wyjscie, /brak różnic/)
    assert.match(wyjscie, /DOCTOR-ATRAPA/)
    assert.doesNotMatch(wyjscie, /NOWA SESJA/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

// 02.11: claude-cron i dashboard mialy aktualny szablon, a stara baze wiedzy w .claude/rules/ — sync o tym milczal.
test('sync: stara baza wiedzy w projekcie → linia HIGIENA z naprawa przy kazdym syncu (takze UP_TO_DATE); pierwsza instalacja — bez linii', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    const skrypty = resolve(dirname(SKRYPT), '..', '..', '..', 'scripts')
    mkdirSync(join(zrodlo, '.claude', 'scripts', 'doctor'), { recursive: true })
    execFileSync('cp', [join(skrypty, 'doctor', 'higiena.mjs'), join(zrodlo, '.claude', 'scripts', 'doctor')])
    // higiena importuje wspolny detektor bajtow z wiedza/walidacja.mjs (a ten slownik klas) — szablon niesie caly katalog.
    execFileSync('cp', ['-R', join(skrypty, 'wiedza'), join(zrodlo, '.claude', 'scripts', 'wiedza')])
    // a kontrakt .coderabbit.yaml z pr/kontrakt-bota.mjs.
    execFileSync('cp', ['-R', join(skrypty, 'pr'), join(zrodlo, '.claude', 'scripts', 'pr')])
    git(zrodlo, ['add', '.'])
    git(zrodlo, ['commit', '-q', '-m', 'higiena'])
    mkdirSync(join(projekt, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(projekt, '.claude', 'rules', 'learned-patterns.md'), '# Learned Patterns\n')
    assert.doesNotMatch(sync(zrodlo, projekt), /HIGIENA:/, 'pierwsza instalacja: te same wiersze daje tabela doctora')
    assert.match(sync(zrodlo, projekt), /STATUS: UP_TO_DATE[\s\S]*HIGIENA: wiedza projektu — stara baza wiedzy .* — naprawa: \/dev-compound-refresh --konwersja/)
    rmSync(join(projekt, '.claude', 'rules', 'learned-patterns.md'))
    assert.doesNotMatch(sync(zrodlo, projekt), /HIGIENA: wiedza projektu/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

// P22 A1: kazdy sync (nie tylko pierwszy) podpowiada wykluczenie .claude/** w configu runnera testow, gdy go brak —
// linia z gotowa poprawka; projekt z configiem z include tests/ — bez linii. Sync nie wozi testow maszynerii, wiec linia
// wychodzi dopiero przy pliku testu pod .claude/ (tu wlasny test projektu).
test('sync: vitest bez configu i test pod .claude/ → linia RUNNER TESTÓW z poprawka; bez testu albo z configiem — bez linii', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    mkdirSync(join(zrodlo, '.claude', 'scripts', 'doctor'), { recursive: true })
    execFileSync('cp', [resolve(dirname(SKRYPT), '..', '..', '..', 'scripts', 'doctor', 'runner-testow.mjs'), join(zrodlo, '.claude', 'scripts', 'doctor')])
    git(zrodlo, ['add', '.'])
    git(zrodlo, ['commit', '-q', '-m', 'runner'])
    writeFileSync(join(projekt, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' }, devDependencies: { vitest: '3' } }))
    assert.doesNotMatch(sync(zrodlo, projekt), /RUNNER TESTÓW/)
    mkdirSync(join(projekt, '.claude', 'skills', 'wlasny', '__tests__'), { recursive: true })
    writeFileSync(join(projekt, '.claude', 'skills', 'wlasny', '__tests__', 'a.test.mjs'), '')
    assert.match(sync(zrodlo, projekt, ['--force']), /RUNNER TESTÓW: vitest bez configu .* — poprawka: vitest\.config\.ts: .*'\.claude\/\*\*'/)
    // Szablon bez zmian (UP_TO_DATE) — linia nadal wychodzi, dopoki config jej nie usunie.
    assert.match(sync(zrodlo, projekt), /STATUS: UP_TO_DATE[\s\S]*RUNNER TESTÓW: vitest bez configu/)
    writeFileSync(join(projekt, 'vitest.config.ts'), 'export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } })\n')
    assert.doesNotMatch(sync(zrodlo, projekt, ['--force']), /RUNNER TESTÓW/)
    // Projekt bez vitest i jest — bez linii.
    writeFileSync(join(projekt, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }))
    rmSync(join(projekt, 'vitest.config.ts'))
    assert.doesNotMatch(sync(zrodlo, projekt, ['--force']), /RUNNER TESTÓW/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

// Dashboard 02.11: sync podmienil wlasny sync-template.sh w trakcie dzialania. Bash czyta skrypt kawalkami, wiec dokonczyl go z
// nowej tresci od starego offsetu — blad skladni w linii 311, pliki podmienione, marker wersji i manifest nie. Skrypt projektu
// musi byc w calosci sparsowany przed wykonaniem.
test('sync podmieniajacy wlasny skrypt w projekcie konczy sie poprawnie: marker wersji, manifest, APPLIED', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  const wzgledna = join('.claude', 'skills', 'sync-template', 'scripts', 'sync-template.sh')
  try {
    const tresc = readFileSync(SKRYPT, 'utf8')
    mkdirSync(dirname(join(zrodlo, wzgledna)), { recursive: true })
    // Nowa wersja w szablonie: krotki dopisek na poczatku przesuwa offsety calej reszty pliku.
    writeFileSync(join(zrodlo, wzgledna), tresc.replace('#!/usr/bin/env bash\n', '#!/usr/bin/env bash\n# v2\n'))
    git(zrodlo, ['add', '.'])
    git(zrodlo, ['commit', '-q', '-m', 'nowa wersja skryptu'])
    mkdirSync(dirname(join(projekt, wzgledna)), { recursive: true })
    writeFileSync(join(projekt, wzgledna), tresc)
    const w = spawnSync('bash', [join(projekt, wzgledna)], { encoding: 'utf8', env: { ...process.env, TEMPLATE_LOCAL_SRC: zrodlo, PROJECT_DIR: projekt } })
    assert.equal(w.status, 0, w.stdout + w.stderr)
    assert.doesNotMatch(w.stderr, /syntax error|błąd składni/i)
    assert.match(w.stdout, /APPLIED: zaaplikowano zmiany\./)
    assert.equal(readFileSync(join(projekt, '.claude', '.template-version'), 'utf8').trim(), git(zrodlo, ['rev-parse', 'HEAD']))
    assert.match(readFileSync(join(projekt, wzgledna), 'utf8'), /^#!\/usr\/bin\/env bash\n# v2\n/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

// --- Repo szablonu z profilu stacku (plan szablonu mobile z rdzenia, IU-3.4) ---
// Wariant Expo publikuje się do osobnego repo; domyślny adres niesie klucz szablon.repo w .claude/stack/profil.json projektu.
// Klon idzie przez file://, żeby test nie potrzebował sieci; GIT_ALLOW_PROTOCOL=file blokuje https bez łączenia się.

/** @param {string} projekt @param {unknown} repo */
function profilProjektu(projekt, repo) {
  mkdirSync(join(projekt, '.claude', 'stack'), { recursive: true })
  writeFileSync(join(projekt, '.claude', 'stack', 'profil.json'), `${JSON.stringify({ opis: 'p', szablon: repo === undefined ? undefined : { repo } })}\n`)
}

/** @param {string} projekt @param {Record<string, string>} env */
function syncBezZrodlaLokalnego(projekt, env) {
  const reszta = { ...process.env }
  delete reszta.TEMPLATE_LOCAL_SRC
  delete reszta.TEMPLATE_REPO_URL
  return spawnSync('bash', [SKRYPT], { encoding: 'utf8', env: { ...reszta, PROJECT_DIR: projekt, GIT_ALLOW_PROTOCOL: 'file', ...env } })
}

/** @param {string} zrodlo */
const galaz = (zrodlo) => git(zrodlo, ['rev-parse', '--abbrev-ref', 'HEAD'])

test('profil z szablon.repo: sync klonuje to repo i zapisuje jego SHA', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    profilProjektu(projekt, `file://${zrodlo}`)
    const w = syncBezZrodlaLokalnego(projekt, { TEMPLATE_BRANCH: galaz(zrodlo) })
    assert.equal(w.status, 0, w.stdout + w.stderr)
    assert.match(w.stdout, /APPLIED: zaaplikowano zmiany\./)
    assert.equal(readFileSync(join(projekt, '.claude', '.template-version'), 'utf8').trim(), git(zrodlo, ['rev-parse', 'HEAD']))
    assert.equal(readFileSync(join(projekt, '.claude', 'workflows', 'dev-x-wf.js'), 'utf8'), "export const meta = { name: 'dev-x-wf' }\nlog('zażółć')\n")
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

test('TEMPLATE_REPO_URL wygrywa z szablon.repo z profilu', () => {
  const zrodlo = zrodloSzablonu()
  const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
  try {
    profilProjektu(projekt, `file://${zrodlo}-nie-istnieje`)
    const w = syncBezZrodlaLokalnego(projekt, { TEMPLATE_BRANCH: galaz(zrodlo), TEMPLATE_REPO_URL: `file://${zrodlo}` })
    assert.equal(w.status, 0, w.stdout + w.stderr)
    assert.equal(readFileSync(join(projekt, '.claude', '.template-version'), 'utf8').trim(), git(zrodlo, ['rev-parse', 'HEAD']))
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

test('profil bez szablon.repo i bez profilu: domyślnie claude-code-starter', () => {
  for (const zProfilem of [true, false]) {
    const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
    try {
      if (zProfilem) profilProjektu(projekt, undefined)
      const w = syncBezZrodlaLokalnego(projekt, {})
      assert.equal(w.status, 5, w.stdout + w.stderr)
      assert.match(w.stderr, /nie udało się sklonować szablonu z https:\/\/github\.com\/AIBiz-Automatyzacje\/claude-code-starter\.git /)
    } finally {
      rmSync(projekt, { recursive: true, force: true })
    }
  }
})

test('niepoprawny szablon.repo: błąd z kodem 7, bez cichego powrotu do claude-code-starter i bez zmian w projekcie', () => {
  for (const zly of ['nie-adres', 'https://x y', 42, '']) {
    const projekt = mkdtempSync(join(tmpdir(), 'sync-projekt-'))
    try {
      profilProjektu(projekt, zly)
      const w = syncBezZrodlaLokalnego(projekt, {})
      assert.equal(w.status, 7, `${JSON.stringify(zly)}: ${w.stdout}${w.stderr}`)
      assert.match(w.stderr, /BŁĄD: niepoprawny szablon\.repo w \.claude\/stack\/profil\.json/)
      assert.doesNotMatch(w.stderr, /claude-code-starter/)
      assert.throws(() => statSync(join(projekt, '.claude', '.template-version')))
    } finally {
      rmSync(projekt, { recursive: true, force: true })
    }
  }
})
