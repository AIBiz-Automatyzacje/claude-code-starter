// Workflow publikacji do repo mobile (IU-3.3, D4): automat po zielonym biegu maszynerii, warunki publikacji i zakres commitu.
//
// Uruchomienie: node --test stacks/__tests__/publikuj-workflow.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { parse } from 'yaml'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const wf = parse(readFileSync(resolve(KORZEN, '.github/workflows/publikuj-mobile.yml'), 'utf8'))
const job = wf.jobs.publikuj
/** @type {Array<{ name?: string, uses?: string, run?: string, if?: string, with?: Record<string, unknown>, ['working-directory']?: string }>} */
const kroki = job.steps
const krok = (/** @type {string} */ nazwa) => kroki.find((k) => k.name === nazwa)

test('wyzwalacze: po biegu maszyneria na main i ręcznie; jedna publikacja naraz, bez anulowania', () => {
  assert.deepEqual(wf.on.workflow_run, { workflows: ['maszyneria'], types: ['completed'], branches: ['main'] })
  assert.ok('workflow_dispatch' in wf.on)
  assert.deepEqual(wf.concurrency, { group: 'publikuj-mobile', 'cancel-in-progress': false })
  assert.deepEqual(wf.permissions, { contents: 'read', actions: 'read' })
})

// D4: automat włączony 2026-11-13 po runie 5 pilota (Etap 4, decyzja operatora).
test('automat włączony: gałąź workflow_run tylko po zielonym biegu z pusha, ręczna publikacja tylko z main', () => {
  const [reczna, automat] = job.if.split('||').map((/** @type {string} */ s) => s.trim())
  assert.equal(reczna, "(github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')")
  assert.match(automat, /^\(github\.event_name == 'workflow_run' && github\.event\.workflow_run\.conclusion == 'success' && github\.event\.workflow_run\.event == 'push'\)$/)
})

test('przed buildem: sekret deploy key i zielony job wariant-expo dla publikowanego SHA', () => {
  assert.match(krok('Sekret deploy key')?.run ?? '', /MOBILE_DEPLOY_KEY/)
  const zielony = krok('Zielony wariant-expo dla tego SHA')?.run ?? ''
  assert.match(zielony, /--workflow maszyneria\.yml --commit "\$SHA" --branch main --event push --status success/)
  assert.match(zielony, /select\(\.name == "wariant-expo"\)/)
  assert.ok(kroki.indexOf(krok('Zielony wariant-expo dla tego SHA') ?? {}) < kroki.indexOf(krok('Decyzja') ?? {}))
})

test('checkouty: starter na publikowanym SHA z pełną historią, repo mobile kluczem deploy', () => {
  const [starter, mobile] = kroki.filter((k) => k.uses?.startsWith('actions/checkout@'))
  assert.deepEqual(starter.with, { ref: '${{ env.SHA }}', 'fetch-depth': 0, path: 'starter', 'persist-credentials': false })
  assert.deepEqual(mobile.with, {
    repository: 'AIBiz-Automatyzacje/workspace-template-mobile',
    ref: 'main',
    path: 'mobile',
    'ssh-key': '${{ secrets.MOBILE_DEPLOY_KEY }}',
  })
  assert.equal(job.env.SHA, "${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}")
})

test('build i commit tylko przy decyzji publikuj; commit z samymi .claude/ i output-styles/ i wiadomością sync: rdzeń', () => {
  assert.equal(krok('Decyzja')?.run, 'node starter/stacks/publikuj-mobile.mjs starter mobile "$SHA" >> "$GITHUB_OUTPUT"')
  for (const nazwa of ['Build wariantu do repo mobile', 'Commit i push']) {
    assert.equal(krok(nazwa)?.if, "steps.decyzja.outputs.decyzja == 'publikuj'", nazwa)
  }
  assert.match(krok('Build wariantu do repo mobile')?.run ?? '', /node starter\/stacks\/zbuduj\.mjs expo mobile --zastap\nnode starter\/stacks\/sprawdz-wersje\.mjs mobile "\$SHA"/)
  const commit = krok('Commit i push')
  assert.equal(commit?.['working-directory'], 'mobile')
  assert.match(commit?.run ?? '', /git add -A -- \.claude output-styles\n/)
  assert.match(commit?.run ?? '', /commit -q -m "sync: rdzeń \$SHA"/)
  assert.match(commit?.run ?? '', /git push origin HEAD:main/)
  assert.match(commit?.run ?? '', /--ignored -- \.claude output-styles/)
})
