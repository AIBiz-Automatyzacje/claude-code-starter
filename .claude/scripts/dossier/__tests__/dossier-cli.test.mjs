// CLI dossier na repo-fixture: zadanie w docs/active/ (plan, zadania, kontekst), plan techniczny, learned-patterns,
// wynik bramek z ostatniego przebiegu. Wynik JSON = pole `dossier` w ksztalcie dzisiejszego KONTEKST z
// dev-docs-review-wf.js (walidacja schematem wycietym ze zrodla workflowu), plik dossier z sekcjami w stalej kolejnosci.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { Ajv } from 'ajv'

import { commit, noweRepo, usun, zapisz } from '../../bramki/__tests__/repo-testowe.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '..', 'dossier.mjs')
const zrodloReview = readFileSync(resolve(KATALOG, '../../../workflows/dev-docs-review-wf.js'), 'utf8')
const ZADANIE = 'docs/active/oferty'

/** @returns {Record<string, unknown>} schemat KONTEKST ze zrodla review-wf */
function schematKontekst() {
  const start = zrodloReview.indexOf('const KONTEKST = {')
  const stop = zrodloReview.indexOf("\n  required: ['pliki', 'warstwy', 'e2eCheckboxy'],\n}", start)
  assert.ok(start !== -1 && stop !== -1, 'kotwice KONTEKST w dev-docs-review-wf.js wymagaja aktualizacji')
  const kod = zrodloReview.slice(start, stop) + "\n  required: ['pliki', 'warstwy', 'e2eCheckboxy'],\n}"
  // eslint-disable-next-line no-new-func -- ekstrakcja schematu z pliku workflowu tego repo, nie z inputu
  return new Function(`${kod}\nreturn KONTEKST`)()
}

const DOKUMENTY = {
  [`${ZADANIE}/oferty-plan.md`]: '# Plan: oferty\n\n## Źródła\n\n- Plan techniczny: docs/plans/plan-oferty.md\n',
  [`${ZADANIE}/oferty-zadania.md`]: [
    '# Zadania: oferty', '', '## Faza 1 — Dane', '', '- [x] Utworz tabele', '- [ ] Test: [E2E] lista ofert widoczna',
    '- [ ] Weryfikacja: [E2E] widok na telefonie', '- [ ] Operator: [E2E] kopia', '', '## Faza 2 — UI', '', '- [ ] Test: [E2E] inna faza', '',
  ].join('\n'),
  [`${ZADANIE}/oferty-kontekst.md`]: '# Kontekst\n\n## Designerski kontekst\n\n- **Screeny referencyjne:**\n  - `lista`: `./docs/plans/oferty-figma/lista.png`\n\n## Dziennik\n',
  'docs/plans/plan-oferty.md': [
    '# Plan techniczny', '', '## Śledzenie wymagań', '', '- R1. Lista ofert', '- R2. Eksport', '', '## Implementation Units', '',
    '### Faza 1 — Dane', '', '**Wymagania:** [R1]', '', '### Faza 2 — UI', '', '**Wymagania:** [R2]', '',
  ].join('\n'),
  '.claude/rules/learned-patterns.md': '# Wyuczone reguly\n\n- Zawsze waliduj wejscie Zod.\n',
}

/**
 * @typedef {{ diffStat: string, pliki: { plik: string, czegoDotyczy: string }[], warstwy: Record<string, boolean>, e2eCheckboxy: number,
 *   figmaScreens: boolean, diffPlik: string, diffZapisany: boolean, diffUciety: boolean, ctxPlik: string, ctxZapisany: boolean,
 *   ctxZnaki: number, preSkan: { wzorzec: string, plik: string }[] }} Dossier
 */

/** @param {string[]} argumenty @param {string} cwd @returns {{ kod: number | null, wynik: Dossier, stderr: string }} */
function cli(argumenty, cwd) {
  const p = spawnSync(process.execPath, [CLI, ...argumenty], { encoding: 'utf8', cwd })
  return { kod: p.status, wynik: p.stdout ? JSON.parse(p.stdout) : null, stderr: p.stderr }
}

/** @param {(repo: string, baza: string, wyjscie: string) => void} sprawdz */
function naZadaniu(sprawdz) {
  const repo = noweRepo()
  const wyjscie = mkdtempSync(join(tmpdir(), 'dossier-wyjscie-'))
  try {
    zapisz(repo, { ...DOKUMENTY, 'tsconfig.json': '{}', 'package.json': JSON.stringify({ dependencies: { react: '19.1.0' } }) })
    const baza = commit(repo, 'baza')
    zapisz(repo, { 'src/oferty.ts': 'export const pobierz = () => fetch("/oferty").then((r) => r.json())\n', 'src/Lista.tsx': 'export const Lista = () => <ul />\n' })
    commit(repo, 'faza 1')
    sprawdz(repo, baza, wyjscie)
  } finally {
    usun(repo)
    rmSync(wyjscie, { recursive: true, force: true })
  }
}

test('dossier: wynik zgodny ze schematem KONTEKST review-wf; flagi, [E2E], figma_screens i pre-skan liczone skryptem', () => {
  naZadaniu((repo, baza, wyjscie) => {
    const { kod, wynik, stderr } = cli(['--sciezka', ZADANIE, '--faza', '1', '--baza', baza, '--wyjscie', wyjscie], repo)
    assert.equal(kod, 0, stderr)
    const ajv = new Ajv({ strict: false })
    assert.ok(ajv.validate(schematKontekst(), structuredClone(wynik)), JSON.stringify(ajv.errors))
    assert.deepEqual(wynik.pliki, [{ plik: 'src/Lista.tsx', czegoDotyczy: 'dodany (+1)' }, { plik: 'src/oferty.ts', czegoDotyczy: 'dodany (+1)' }])
    assert.deepEqual(wynik.warstwy, { ui: true, dane: true, typowanie: true, nowyModul: true })
    assert.equal(wynik.e2eCheckboxy, 2)
    assert.equal(wynik.figmaScreens, true)
    assert.deepEqual(wynik.preSkan, [{ wzorzec: 'then-bez-catch', plik: 'src/oferty.ts:1' }])
    assert.equal(wynik.diffPlik, join(wyjscie, 'review-diff-docs-active-oferty-faza-1.diff'))
    assert.equal(wynik.ctxPlik, join(wyjscie, 'review-ctx-docs-active-oferty-faza-1.md'))
    assert.equal(wynik.diffZapisany, true)
    assert.equal(wynik.diffUciety, false)
    assert.equal(wynik.ctxZapisany, true)
    assert.equal(wynik.ctxZnaki, readFileSync(wynik.ctxPlik, 'utf8').length, 'rozmiar dossier dla telemetrii (faza.dossier_zn)')
    assert.match(readFileSync(wynik.diffPlik, 'utf8'), /\+export const Lista/)
  })
})

test('dossier: plik z sekcjami w stalej kolejnosci, wycinki fazy doslownie, bramki z pliku ostatniego przebiegu', () => {
  naZadaniu((repo, baza, wyjscie) => {
    const bramki = join(wyjscie, 'bramki.json')
    writeFileSync(bramki, JSON.stringify({ eslint: { status: 'ok', sekundy: 1, trafienia: [], ostrzezenia: [{ plik: 'src/oferty.ts', linia: 1, regula: 'complexity', opis: 'za zlozone' }] } }))
    const { wynik } = cli(['--sciezka', ZADANIE, '--faza', '1', '--baza', baza, '--bramki', bramki, '--wyjscie', wyjscie], repo)
    const tresc = readFileSync(wynik.ctxPlik, 'utf8')
    const wrappery = [
      'Zmiany fazy', 'Profil stacku', 'Sygnaly diffu (pre-skan: miejsca, nie findingi)', 'Bramki domkniecia (ostatni przebieg)',
      'Plan techniczny — sekcja fazy', 'Sledzenie wymagan — wiersze tej fazy', 'Reguly projektu (learned-patterns.md)',
      'Zadania fazy', 'Designerski kontekst zadania',
    ].map((s) => tresc.indexOf(`\n## ${s}\n`))
    assert.ok(wrappery.every((i, k) => i !== -1 && (k === 0 || i > wrappery[k - 1])), `kolejnosc sekcji: ${wrappery.join(', ')}`)
    assert.match(tresc, /^# Dossier fazy 1 — docs\/active\/oferty$/m)
    assert.match(tresc, new RegExp(`Baza fazy: ${baza}`))
    assert.match(tresc, /### Faza 1 — Dane\n\n\*\*Wymagania:\*\* \[R1\]/)
    assert.doesNotMatch(tresc, /Faza 2 — UI|inna faza|R2\. Eksport/)
    assert.match(tresc, /- R1\. Lista ofert/)
    assert.match(tresc, /Zawsze waliduj wejscie Zod/)
    assert.match(tresc, /- src\/oferty\.ts:1 complexity — za zlozone/)
    assert.match(tresc, /react 19\.1\.0/)
  })
})

test('dossier: bez --baza merge-base z galezia glowna albo HEAD (zapisane w pliku); brak dokumentow nazwany; zle argumenty = kod 2', () => {
  naZadaniu((repo, baza, wyjscie) => {
    const { kod, wynik } = cli(['--sciezka', 'docs/active/brak', '--faza', '1', '--wyjscie', wyjscie], repo)
    assert.equal(kod, 0)
    const tresc = readFileSync(wynik.ctxPlik, 'utf8')
    assert.match(tresc, /Baza fazy: \S+ \(zastepcza/)
    assert.match(tresc, /Brak pliku zadan w docs\/active\/brak/)
    assert.equal(wynik.e2eCheckboxy, 0)
    assert.equal(wynik.diffZapisany, false, 'HEAD bez zmian w drzewie = pusty diff')
    assert.equal(existsSync(wynik.ctxPlik), true)
    assert.equal(cli(['--faza', '1'], repo).kod, 2)
    assert.equal(cli(['--sciezka', ZADANIE, '--faza', 'x'], repo).kod, 2)
    assert.equal(cli(['--sciezka', ZADANIE, '--faza', '1', '--baza', 'nie-ma-takiego'], repo).kod, 2)
    assert.ok(baza)
  })
})
