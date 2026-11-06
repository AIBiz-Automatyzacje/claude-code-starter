// Testy higiena.mjs: kazda kontrola na przypadku z 02.11 (claude-cron, dashboard, piszemy_wirale) i na projekcie czystym.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bajtySterujace, bibliotekaTestowKomponentow, dlugieLinieClaudeMd, higienaProjektu, hookiWUstawieniach, ignorowanePliki, konfiguracjaCodeRabbit, kontekstStartowy,
  plikiSpozaSzablonu, PROG_KONTEKSTU_ZN, STARA_WIEDZA, wiedzaProjektu,
} from '../higiena.mjs'

/** @param {(projekt: string, zapisz: (plik: string, tresc: string) => void) => void} cialo */
function zProjektem(cialo) {
  const projekt = mkdtempSync(join(tmpdir(), 'higiena-'))
  const zapisz = (/** @type {string} */ plik, /** @type {string} */ tresc) => {
    mkdirSync(dirname(join(projekt, plik)), { recursive: true })
    writeFileSync(join(projekt, plik), tresc)
  }
  try {
    cialo(projekt, zapisz)
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

test('wiedza: stary .claude/rules/learned-patterns.md = UWAGA z komenda konwersji; bez niego OK', () => zProjektem((p, zapisz) => {
  assert.equal(wiedzaProjektu(p).stan, 'OK')
  zapisz(STARA_WIEDZA, '# Learned Patterns\n'.repeat(10))
  const w = wiedzaProjektu(p)
  assert.deepEqual([w.stan, w.instalacja], ['UWAGA', '/dev-compound-refresh --konwersja (przy czystym drzewie)'])
  assert.match(w.szczegol, /190 zn/)
}))

test('kontekst: CLAUDE.md + reguly bez paths: ponad prog = UWAGA z najwiekszymi plikami; regula z paths: sie nie liczy', () => zProjektem((p, zapisz) => {
  zapisz('CLAUDE.md', 'x'.repeat(5000))
  zapisz('.claude/rules/coding-rules.md', `---\npaths:\n  - "**/*.ts"\n---\n${'y'.repeat(PROG_KONTEKSTU_ZN)}`)
  assert.equal(kontekstStartowy(p).stan, 'OK', 'regula z paths: laduje sie przy pasujacym pliku, nie na starcie')
  zapisz('.claude/rules/firma.md', 'z'.repeat(PROG_KONTEKSTU_ZN))
  const w = kontekstStartowy(p)
  assert.equal(w.stan, 'UWAGA')
  assert.match(w.szczegol, /^25\s000 zn na start kazdego agenta .*: \.claude\/rules\/firma\.md 20\s000, CLAUDE\.md 5000$/)
}))

test('pliki spoza szablonu: commands/, stary hook i skill-rules.json = UWAGA; wlasny skill projektu OK; bez manifestu — nie dotyczy', () => zProjektem((p, zapisz) => {
  assert.equal(plikiSpozaSzablonu(p).stan, 'nie dotyczy')
  zapisz('.claude/.template-manifest', '.claude/agents/klasa-mechaniczny.md\n')
  zapisz('.claude/agents/klasa-mechaniczny.md', 'x')
  zapisz('.claude/skills/weryfikacja/SKILL.md', 'x')
  zapisz('.claude/skills/.DS_Store', 'x')
  const ok = plikiSpozaSzablonu(p)
  assert.deepEqual([ok.stan, ok.szczegol], ['OK', 'wlasne skille projektu: .claude/skills/weryfikacja/SKILL.md'])
  zapisz('.claude/commands/dev-docs.md', 'x')
  zapisz('.claude/hooks/skill-activation-prompt.sh', 'x')
  zapisz('.claude/skills/skill-rules.json', '{}')
  const w = plikiSpozaSzablonu(p)
  assert.equal(w.stan, 'UWAGA')
  assert.match(w.szczegol, /^3 plikow poza manifestem/)
  assert.doesNotMatch(w.szczegol, /weryfikacja/)
}))

test('hooki w ustawieniach: wpis wskazujacy usuniety plik = UWAGA z plikiem ustawien', () => zProjektem((p, zapisz) => {
  zapisz('.claude/hooks/jest.sh', 'x')
  zapisz('.claude/settings.json', JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: '$CLAUDE_PROJECT_DIR/.claude/hooks/jest.sh' }] }] } }))
  assert.equal(hookiWUstawieniach(p).stan, 'OK')
  zapisz('.claude/settings.local.json', JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: '.claude/hooks/skill-activation-prompt.sh' }] }] } }))
  const w = hookiWUstawieniach(p)
  assert.deepEqual([w.stan, w.szczegol], ['UWAGA', 'hook wskazuje usuniety plik: .claude/settings.local.json: .claude/hooks/skill-activation-prompt.sh'])
}))

test('pliki poza .gitignore: .claude/.backups/ i CLAUDE.md w podkatalogu = UWAGA; po wpisach do .gitignore OK', () => zProjektem((p, zapisz) => {
  execFileSync('git', ['init', '-q'], { cwd: p })
  zapisz('CLAUDE.md', 'x')
  zapisz('.claude/.backups/20261102/a.md', 'x')
  zapisz('src/lib/CLAUDE.md', '<claude-mem-context>')
  const w = ignorowanePliki(p)
  assert.equal(w.stan, 'UWAGA')
  assert.match(w.szczegol, /^\.claude\/\.backups\/ \(kopie z \/sync-template\); CLAUDE\.md w podkatalogach \(np\. plugin claude-mem\): src\/lib\/CLAUDE\.md$/)
  zapisz('.gitignore', '.claude/.backups/\n**/CLAUDE.md\n!/CLAUDE.md\n')
  assert.equal(ignorowanePliki(p).stan, 'OK')
}))

test('bajty sterujace: NUL we wpisie docs/solutions/ = UWAGA; tabulator i CRLF nie', () => zProjektem((p, zapisz) => {
  zapisz('docs/solutions/a/ok.md', 'kolumna\twartosc\r\n')
  assert.equal(bajtySterujace(p).stan, 'OK')
  zapisz('docs/solutions/auth/zly.md', 'regex [\u0000-\u001f]\n')
  const w = bajtySterujace(p)
  assert.equal(w.stan, 'UWAGA')
  assert.match(w.szczegol, /^docs\/solutions\/auth\/zly\.md — git widzi plik jako binarny/)
}))

test('CodeRabbit: brak pliku = UWAGA z /coderabbit-setup; odwolanie do usunietej starej bazy wiedzy = UWAGA', () => zProjektem((p, zapisz) => {
  assert.equal(konfiguracjaCodeRabbit(p).instalacja, '/coderabbit-setup')
  zapisz('.coderabbit.yaml', `reviews:\n  path_instructions:\n    - path: "${STARA_WIEDZA}"\n`)
  assert.match(konfiguracjaCodeRabbit(p).szczegol, /wskazuje usuniety/)
  zapisz(STARA_WIEDZA, 'x')
  assert.match(konfiguracjaCodeRabbit(p).szczegol, /niezgodny z kontraktem/, 'plik jest — odwolanie aktualne, ale config nie spelnia kontraktu')
}))

test('higienaProjektu: dziewiec wierszy w stalej kolejnosci; CLI wypisuje je jako TSV', () => zProjektem((p) => {
  const elementy = higienaProjektu(p).map((w) => w.element)
  assert.deepEqual(elementy, ['wiedza projektu', 'kontekst startowy agenta', 'pliki .claude spoza szablonu', 'hooki w ustawieniach', 'pliki poza .gitignore', 'bajty sterujace w wiedzy', 'CodeRabbit', 'CLAUDE.md: dlugie linie', 'testy komponentow'])
  const wyjscie = execFileSync(process.execPath, [join(import.meta.dirname, '../higiena.mjs'), p], { encoding: 'utf8' })
  assert.deepEqual(wyjscie.trim().split('\n').map((l) => l.split('\t').length), [4, 4, 4, 4, 4, 4, 4, 4, 4])
}))

test('CodeRabbit: config spelniajacy kontrakt = OK, odstepstwo = UWAGA z /coderabbit-setup', () => zProjektem((p, zapisz) => {
  const zgodny = ['language: pl-PL', 'reviews:', '  request_changes_workflow: false', '  review_status: true', '  auto_review:', '    enabled: true', '    auto_incremental_review: true',
    '  pre_merge_checks:', '    docstrings:', '      mode: "off"', '  path_filters:', '    - "!docs/**"', '    - "!.claude/**"', '    - "!**/CLAUDE.md"',
    'knowledge_base:', '  code_guidelines:', '    filePatterns:', '      - "CLAUDE.md"', ''].join('\n')
  zapisz('CLAUDE.md', '# x')
  zapisz('.coderabbit.yaml', zgodny)
  assert.equal(konfiguracjaCodeRabbit(p).stan, 'OK')
  zapisz('.coderabbit.yaml', zgodny.replace('request_changes_workflow: false', 'request_changes_workflow: true'))
  const w = konfiguracjaCodeRabbit(p)
  assert.deepEqual([w.stan, w.instalacja], ['UWAGA', '/coderabbit-setup (nadpisanie po potwierdzeniu)'])
  assert.match(w.szczegol, /request_changes_workflow/)
}))

test('CLAUDE.md: akapit w jednej linii = UWAGA, tabela nie liczy sie; testy komponentow: React bez biblioteki = decyzja operatora', () => zProjektem((p, zapisz) => {
  zapisz('CLAUDE.md', `krotka\n| ${'x'.repeat(900)} |\n`)
  assert.equal(dlugieLinieClaudeMd(p).stan, 'OK')
  zapisz('CLAUDE.md', `${'x'.repeat(900)}\n`)
  assert.equal(dlugieLinieClaudeMd(p).stan, 'UWAGA')
  assert.equal(bibliotekaTestowKomponentow(p).stan, 'OK')
  zapisz('package.json', '{"dependencies":{"react":"19.0.0"}}')
  assert.equal(bibliotekaTestowKomponentow(p).instalacja, 'decyzja operatora')
  zapisz('package.json', '{"dependencies":{"react":"19.0.0"},"devDependencies":{"@testing-library/react":"16.0.0"}}')
  assert.equal(bibliotekaTestowKomponentow(p).stan, 'OK')
}))
