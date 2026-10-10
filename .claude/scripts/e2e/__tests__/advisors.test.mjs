// Advisors na bazie e2e po db-sync (P17): ref z .env.e2e, token ze srodowiska albo z .env.e2e, faza bez migracji pominieta,
// brak tokenu = brak z naprawa. Management API zastapione lokalnym serwerem HTTP (zewnetrzny serwis).
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/advisors.test.mjs

import { createServer } from 'node:http'
import test from 'node:test'
import assert from 'node:assert/strict'

import { commit, noweRepo, usun, zapisz } from '../../bramki/__tests__/repo-testowe.mjs'
import { advisorsE2e, refE2e, tokenAdvisors } from '../advisors.mjs'

const REF = 'abcdefghijklmnopqrst'
const ENV = `VITE_SUPABASE_URL=https://${REF}.supabase.co\n`
const RLS = { name: 'rls_disabled_in_public', title: 'RLS Disabled in Public', level: 'ERROR', detail: 'Table `public.projects` bez RLS' }
const INITPLAN = { name: 'auth_rls_initplan', title: 'Auth RLS Initialization Plan', level: 'WARN', detail: 'auth.uid() bez (select ...)' }

/** @param {{ security: object[], performance: object[] }} lints @returns {Promise<{ baza: string, zapytania: string[], zamknij: () => void }>} */
async function serwerApi(lints) {
  /** @type {string[]} */
  const zapytania = []
  const serwer = createServer((req, res) => {
    zapytania.push(`${req.url} ${req.headers.authorization}`)
    const rodzaj = /\/advisors\/(security|performance)$/.exec(req.url ?? '')?.[1]
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ lints: rodzaj === 'security' ? lints.security : lints.performance }))
  })
  await new Promise((gotowe) => serwer.listen(0, '127.0.0.1', () => gotowe(null)))
  const adres = serwer.address()
  assert.ok(adres && typeof adres === 'object')
  return { baza: `http://127.0.0.1:${adres.port}`, zapytania, zamknij: () => serwer.close() }
}

test('refE2e: SUPABASE_E2E_PROJECT_REF wygrywa; inaczej projekt bazy z migracjami (pooler albo direct), potem VITE_SUPABASE_URL; rozne projekty = blad', () => {
  const INNY = 'zyxwvutsrqponmlkjihg'
  assert.deepEqual(refE2e({ VITE_SUPABASE_URL: `https://${REF}.supabase.co` }), { ref: REF, blad: null })
  assert.deepEqual(refE2e({ VITE_SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_E2E_PROJECT_REF: 'wlasny' }), { ref: 'wlasny', blad: null })
  assert.equal(refE2e({ SUPABASE_E2E_DB_URL: `postgresql://postgres.${REF}:haslo@aws-0-eu-central-1.pooler.supabase.com:5432/postgres` }).ref, REF)
  assert.equal(refE2e({ SUPABASE_E2E_DB_URL: `postgresql://postgres:haslo@db.${REF}.supabase.co:5432/postgres` }).ref, REF)
  const rozne = refE2e({ VITE_SUPABASE_URL: `https://${INNY}.supabase.co`, SUPABASE_E2E_DB_URL: `postgresql://postgres.${REF}:h@x.pooler.supabase.com:5432/postgres` })
  assert.equal(rozne.ref, null)
  assert.match(rozne.blad ?? '', /wskazuja rozne projekty.*SUPABASE_E2E_PROJECT_REF/)
  assert.doesNotMatch(rozne.blad ?? '', /haslo|:h@/)
  assert.equal(refE2e({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }).ref, null)
  assert.match(refE2e({}).blad ?? '', /SUPABASE_E2E_PROJECT_REF/)
})

test('tokenAdvisors: token projektu z .env.e2e wygrywa z ogolnym ze srodowiska; brak w obu = null', () => {
  assert.equal(tokenAdvisors({ SUPABASE_ACCESS_TOKEN: 'z-pliku' }, { SUPABASE_ACCESS_TOKEN: 'z-env' }), 'z-pliku')
  assert.equal(tokenAdvisors({}, { SUPABASE_ACCESS_TOKEN: 'z-env' }), 'z-env')
  assert.equal(tokenAdvisors({}, {}), null)
})

test('faza z migracja: lint bazy e2e z tokenem z .env.e2e — ERROR = porazka z bledami, WARN = ostrzezenia; token nie trafia do wyniku', async () => {
  const repo = noweRepo()
  const api = await serwerApi({ security: [RLS], performance: [INITPLAN] })
  try {
    zapisz(repo, { '.env.e2e': `${ENV}SUPABASE_ACCESS_TOKEN=tajny\n`, 'supabase/migrations/1_a.sql': 'create table a (id int);\n' })
    const baza = commit(repo, 'baza')
    zapisz(repo, { 'supabase/migrations/2_b.sql': 'create table projects (id int);\n' })
    commit(repo, 'faza')
    const w = await advisorsE2e(repo, { baza, bazaApi: api.baza, srodowisko: {} })
    assert.equal(w.status, 'porazka')
    assert.equal(w.ref, REF)
    assert.deepEqual(w.bledy.map((t) => t.regula), ['advisors/rls_disabled_in_public'])
    assert.deepEqual(w.ostrzezenia.map((t) => t.regula), ['advisors/auth_rls_initplan'])
    assert.deepEqual(api.zapytania.sort(), [
      `/v1/projects/${REF}/advisors/performance Bearer tajny`,
      `/v1/projects/${REF}/advisors/security Bearer tajny`,
    ])
    assert.doesNotMatch(JSON.stringify(w), /tajny/)
  } finally {
    api.zamknij()
    usun(repo)
  }
})

test('faza bez zmian w supabase/migrations = pominieta bez zapytania do API; bez --baza advisors biegnie zawsze', async () => {
  const repo = noweRepo()
  const api = await serwerApi({ security: [], performance: [] })
  try {
    zapisz(repo, { '.env.e2e': ENV, 'supabase/migrations/1_a.sql': 'create table a (id int);\n' })
    const baza = commit(repo, 'baza')
    zapisz(repo, { 'src/a.ts': 'export const a = 1\n' })
    commit(repo, 'faza bez migracji')
    const pominieta = await advisorsE2e(repo, { baza, bazaApi: api.baza, srodowisko: { SUPABASE_ACCESS_TOKEN: 't' } })
    assert.equal(pominieta.status, 'pominieta')
    assert.deepEqual(api.zapytania, [])
    assert.equal((await advisorsE2e(repo, { bazaApi: api.baza, srodowisko: { SUPABASE_ACCESS_TOKEN: 't' } })).status, 'ok')
  } finally {
    api.zamknij()
    usun(repo)
  }
})

test('brak tokenu = brak z naprawa (gdzie wygenerowac, gdzie wpisac); brak .env.e2e = pominieta; adres bez ref = brak', async () => {
  const repo = noweRepo()
  try {
    assert.equal((await advisorsE2e(repo, { srodowisko: {} })).status, 'pominieta')
    zapisz(repo, { '.env.e2e': ENV })
    const bezTokenu = await advisorsE2e(repo, { srodowisko: {} })
    assert.equal(bezTokenu.status, 'brak')
    assert.equal(bezTokenu.ref, REF)
    assert.match(bezTokenu.naprawa, /Access Tokens.*SUPABASE_ACCESS_TOKEN=<token> do \.env\.e2e/)
    zapisz(repo, { '.env.e2e': 'VITE_SUPABASE_URL=http://127.0.0.1:54321\n' })
    const bezRef = await advisorsE2e(repo, { srodowisko: { SUPABASE_ACCESS_TOKEN: 't' } })
    assert.equal(bezRef.status, 'brak')
    assert.match(bezRef.naprawa, /SUPABASE_E2E_PROJECT_REF/)
    assert.match(bezRef.detal, /brak ref projektu e2e/)
  } finally {
    usun(repo)
  }
})
