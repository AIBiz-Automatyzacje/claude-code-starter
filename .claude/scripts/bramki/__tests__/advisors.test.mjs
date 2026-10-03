// Odbior bramki advisors: Management API Supabase (GET /v1/projects/{ref}/advisors/{security,performance}) zastapione lokalnym
// serwerem HTTP (zewnetrzny serwis). Brak tokenu albo ref = brak; lint ERROR = porazka, WARN = ostrzezenie, INFO pominiety.

import { createServer } from 'node:http'
import test from 'node:test'
import assert from 'node:assert/strict'

import { bramkaAdvisors } from '../advisors.mjs'
import { noweRepo, usun, zapisz } from './repo-testowe.mjs'

const RLS = { name: 'rls_disabled_in_public', title: 'RLS Disabled in Public', level: 'ERROR', categories: ['SECURITY'], detail: 'Table `public.oferty` is public, but RLS has not been enabled.' }
const INDEKS = { name: 'unindexed_foreign_keys', title: 'Unindexed foreign keys', level: 'INFO', categories: ['PERFORMANCE'], detail: 'fk bez indeksu' }
const INITPLAN = { name: 'auth_rls_initplan', title: 'Auth RLS Initialization Plan', level: 'WARN', categories: ['PERFORMANCE'], detail: 'auth.uid() bez (select ...)' }

/**
 * @param {{ security: object[], performance: object[], status?: number }} stan zmieniany w trakcie testu
 * @returns {Promise<{ baza: string, zapytania: string[], zamknij: () => void }>}
 */
async function serwerApi(stan) {
  /** @type {string[]} */
  const zapytania = []
  const serwer = createServer((req, res) => {
    zapytania.push(`${req.method} ${req.url} ${req.headers.authorization}`)
    const rodzaj = /\/advisors\/(security|performance)$/.exec(req.url ?? '')?.[1]
    res.writeHead(stan.status ?? 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(rodzaj === 'security' ? { lints: stan.security } : rodzaj === 'performance' ? { lints: stan.performance } : { message: 'nie ma' }))
  })
  await new Promise((gotowe) => serwer.listen(0, '127.0.0.1', () => gotowe(null)))
  const adres = serwer.address()
  assert.ok(adres && typeof adres === 'object')
  return { baza: `http://127.0.0.1:${adres.port}`, zapytania, zamknij: () => serwer.close() }
}

/** @returns {string} projekt z supabase/ i ref z `supabase link` */
function projekt() {
  const repo = noweRepo()
  zapisz(repo, { 'supabase/.temp/project-ref': 'abcdefghij\n', 'supabase/migrations/1_a.sql': '' })
  return repo
}

test('przejscie -> tabela bez RLS -> porazka advisors/rls_disabled_in_public -> przejscie; WARN = ostrzezenie, INFO pominiety', async () => {
  const repo = projekt()
  /** @type {{ security: object[], performance: object[] }} */
  const stan = { security: [], performance: [INDEKS, INITPLAN] }
  const api = await serwerApi(stan)
  try {
    const env = { SUPABASE_ACCESS_TOKEN: 'tok' }
    const czysto = await bramkaAdvisors(repo, env, api.baza)
    assert.equal(czysto.status, 'ok')
    assert.deepEqual(czysto.ostrzezenia?.map((t) => t.regula), ['advisors/auth_rls_initplan'])
    assert.deepEqual(api.zapytania.sort(), [
      'GET /v1/projects/abcdefghij/advisors/performance Bearer tok',
      'GET /v1/projects/abcdefghij/advisors/security Bearer tok',
    ])

    stan.security = [RLS]
    const w = await bramkaAdvisors(repo, env, api.baza)
    assert.equal(w.status, 'porazka')
    assert.deepEqual(w.trafienia, [{ plik: null, linia: null, regula: 'advisors/rls_disabled_in_public', opis: `RLS Disabled in Public: ${RLS.detail}` }])

    stan.security = []
    assert.equal((await bramkaAdvisors(repo, env, api.baza)).status, 'ok')
  } finally {
    api.zamknij()
    usun(repo)
  }
})

test('brak tokenu albo ref projektu = brak; projekt bez supabase/ = pominieta', async () => {
  const repo = projekt()
  const bezSupabase = noweRepo()
  try {
    const bezTokenu = await bramkaAdvisors(repo, {}, 'http://127.0.0.1:9')
    assert.equal(bezTokenu.status, 'brak')
    assert.match(bezTokenu.powod ?? '', /SUPABASE_ACCESS_TOKEN/)

    zapisz(repo, { 'supabase/.temp/project-ref': '' })
    assert.match((await bramkaAdvisors(repo, { SUPABASE_ACCESS_TOKEN: 'tok' }, 'http://127.0.0.1:9')).powod ?? '', /ref projektu/)

    assert.equal((await bramkaAdvisors(bezSupabase, { SUPABASE_ACCESS_TOKEN: 'tok' }, 'http://127.0.0.1:9')).status, 'pominieta')
  } finally {
    usun(repo)
    usun(bezSupabase)
  }
})

test('odpowiedz API inna niz 200 = blad ze statusem HTTP; ref z SUPABASE_PROJECT_REF ma pierwszenstwo', async () => {
  const repo = projekt()
  const api = await serwerApi({ security: [], performance: [], status: 401 })
  try {
    const w = await bramkaAdvisors(repo, { SUPABASE_ACCESS_TOKEN: 'zly', SUPABASE_PROJECT_REF: 'zenv' }, api.baza)
    assert.equal(w.status, 'blad')
    assert.match(w.powod ?? '', /HTTP 401/)
    assert.ok(api.zapytania.every((z) => z.includes('/projects/zenv/')))
  } finally {
    api.zamknij()
    usun(repo)
  }
})

test('API nieosiagalne (blad sieci) = blad z komunikatem fetch', async () => {
  const repo = projekt()
  try {
    const w = await bramkaAdvisors(repo, { SUPABASE_ACCESS_TOKEN: 'tok' }, 'http://127.0.0.1:9')
    assert.equal(w.status, 'blad')
    assert.match(w.powod ?? '', /^advisors: fetch failed/)
  } finally {
    usun(repo)
  }
})
