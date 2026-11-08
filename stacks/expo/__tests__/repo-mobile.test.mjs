// Treść dla repo workspace-template-mobile (IU-3.5): README i workflow strażnika. Build ich nie kopiuje (tylko `.claude/`
// i `output-styles/`); do repo mobile trafiają ręcznie, za zgodą operatora. Test pilnuje kontraktu z buildem i publikacją.
//
// Uruchomienie: node --test stacks/expo/__tests__/repo-mobile.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { parse } from 'yaml'

const KATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'repo-mobile')
const czytaj = (/** @type {string} */ sciezka) => readFileSync(join(KATALOG, sciezka), 'utf8')

/** @typedef {{ name?: string, uses?: string, run?: string, with?: Record<string, unknown>, id?: string }} Krok */

test('strażnik: buduje wariant expo z SHA z .rdzen-version i porównuje oba katalogi z repo', () => {
  const wf = parse(czytaj('.github/workflows/straznik-claude.yml'))
  assert.deepEqual(wf.permissions, { contents: 'read' })
  assert.deepEqual(wf.on.push.branches, ['main'])
  assert.ok('pull_request' in wf.on)
  /** @type {Krok[]} */
  const kroki = wf.jobs['wariant-z-rdzenia'].steps
  const sha = kroki.find((k) => k.id === 'rdzen')
  assert.match(sha?.run ?? '', /mobile\/\.claude\/\.rdzen-version/)
  assert.match(sha?.run ?? '', /\^\[0-9a-f\]\{40\}\$/, 'SHA z -dirty albo skrócony nie przechodzi')
  const starter = kroki.find((k) => k.with?.repository === 'AIBiz-Automatyzacje/claude-code-starter')
  assert.equal(starter?.with?.ref, '${{ steps.rdzen.outputs.sha }}')
  const build = kroki.find((k) => /stacks\/zbuduj\.mjs/.test(k.run ?? ''))
  assert.equal(build?.run, 'node starter/stacks/zbuduj.mjs expo "$RUNNER_TEMP/wariant"')
  const porownanie = kroki.at(-1)?.run ?? ''
  assert.match(porownanie, /for katalog in \.claude output-styles/)
  assert.match(porownanie, /diff -r "\$RUNNER_TEMP\/wariant\/\$katalog" "mobile\/\$katalog"/)
  assert.ok(kroki.indexOf(build ?? {}) > kroki.indexOf(starter ?? {}), 'build po checkoucie startera')
})

test('README: skąd pochodzi .claude/, zakaz edycji, źródło syncu, przejście ze starego zestawu', () => {
  const r = czytaj('README.md')
  for (const naglowek of ['## Skąd pochodzi `.claude/`', '## Nie edytuj `.claude/` w tym repo', '## Instalacja', '## Aktualizacja', '### Przejście ze starego szablonu mobile']) {
    assert.ok(r.includes(`\n${naglowek}\n`), naglowek)
  }
  assert.match(r, /stacks\/expo\//)
  assert.match(r, /\.claude\/\.rdzen-version/)
  assert.match(r, /`sync: rdzeń <sha>`/)
  assert.match(r, /straznik-claude/)
  assert.match(r, /szablon\.repo/)
  assert.match(r, /learned-patterns\.md/)
})
