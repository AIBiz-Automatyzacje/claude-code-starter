// Kontrakt slotu danych `.claude/stack/profil.json` (plan szablonu mobile z rdzenia, IU-1.7, D15) i jego konsumentow
// w rdzeniu: skrypty biora wartosci stacku z profilu, nie z wlasnych literalow. Test nie sprawdza wartosci stacku —
// przechodzi na kazdym wariancie profilu; wartosci web pilnuje stacks/__tests__/sloty.test.mjs.
//
// Uruchomienie: node --test .claude/scripts/stack/__tests__/profil.test.mjs

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { refE2e } from '../../e2e/advisors.mjs'
import { bledySrodowiska, KLUCZE_BAZY } from '../../e2e/srodowisko.mjs'
import { ZAPIS_SEEDA } from '../../plan/pola-iu.mjs'
import { KOMENDY_CLI } from '../../plan/walidacja-planu.mjs'
import { noweZmienne } from '../../smoke/zmienne.mjs'
import { doWzorca, PROFIL } from '../profil.mjs'

const CLAUDE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
/** @type {import('../../e2e/srodowisko.mjs').Narzedzia} */
const SPRAWNE = { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }) }
const REF = 'abcdefghijklmnopqrst'
const { env, e2e } = PROFIL

test('profil: pola i typy kontraktu', () => {
  assert.ok(PROFIL.opis.trim().length > 0)
  assert.match(env.prefiksPubliczny, /^[A-Z][A-Z0-9_]*_$/)
  for (const klucz of [env.adresSupabase, ...env.kluczSupabase]) assert.ok(klucz.startsWith(env.prefiksPubliczny), klucz)
  assert.ok(env.kluczSupabase.length > 0 && env.plikiDev.length > 0 && env.plikiDev.every((p) => p.startsWith('.env')))
  assert.ok(env.plikE2eLokalny === null || env.plikE2eLokalny.startsWith('.env'))
  assert.ok(env.aplikacjaE2e.trim().length > 0)
  assert.ok(env.wbudowane.every((n) => /^[A-Z_][A-Z0-9_]*$/.test(n)))
  for (const katalog of [e2e.katalogSeedow, e2e.katalogRunnerow]) assert.match(katalog, /^[\w.][\w./-]*[\w]$/, katalog)
  assert.ok(e2e.plikFlow === null || e2e.plikFlow.includes('<flow>'), 'plikFlow: wzór ścieżki z <flow> albo null')
  assert.doesNotThrow(() => new RegExp(PROFIL.zrodla.frontend))
  assert.ok(PROFIL.testy.powiazane.trim().length > 0)
  assert.ok(PROFIL.komendyCli.every((k) => /^[\w-]+$/.test(k)))
  // Sygnal drugiego wariantu szablonu dla doctora (znaleziska 2026-11-02 pkt 26): paczka, jej oczekiwana obecnosc i repo wariantu.
  const { nazwa, zaleznosc, obecna, repo } = PROFIL.szablon.innyWariant
  assert.ok(nazwa.trim().length > 0 && zaleznosc.trim().length > 0)
  assert.equal(typeof obecna, 'boolean')
  assert.match(repo, /^https:\/\/.+\.git$/)
  assert.notEqual(repo, PROFIL.szablon.repo, 'drugi wariant ma inne repo niz ten profil')
})

test('doWzorca: znaki specjalne dosłownie', () => {
  assert.ok(new RegExp(`^${doWzorca('.maestro/a+b')}$`).test('.maestro/a+b'))
  assert.equal(new RegExp(`^${doWzorca('e2e/seeds')}$`).test('e2e-seeds'), false)
})

test('seed scenariusza [E2E] w katalogu seedów stacku', () => {
  assert.equal(ZAPIS_SEEDA.exec(`- [E2E] \`a\` (seed: ${e2e.katalogSeedow}/a-seed.sql) — ok`)?.[1], `${e2e.katalogSeedow}/a-seed.sql`)
  assert.equal(ZAPIS_SEEDA.exec('- [E2E] `a` (seed: inny/a-seed.sql) — ok'), null)
})

test('komendy CLI scribe\'a: rdzeń + komendy stacku', () => {
  for (const k of [...PROFIL.komendyCli, 'npm', 'node', 'supabase']) assert.ok(KOMENDY_CLI.includes(k), k)
})

test('zmienne wbudowane stacku nie są nowymi zmiennymi deployu', () => {
  const dodane = env.wbudowane.map((n, i) => ({ plik: 'app/a.ts', linia: i + 1, tresc: `process.env.${n}` }))
  assert.deepEqual(noweZmienne(dodane, new Set()), [])
})

test('klucze bazy e2e: adres i klucz klienta Supabase z profilu', () => {
  assert.deepEqual(KLUCZE_BAZY.slice(0, 2), [[env.adresSupabase], env.kluczSupabase])
})

test('strażnik bazy dev: adres z pliku env bazy dev stacku = baza dev w e2e', () => {
  const projekt = mkdtempSync(join(tmpdir(), 'profil-'))
  try {
    writeFileSync(join(projekt, env.plikiDev[0] ?? '.env'), `${env.adresSupabase}=https://dev.supabase.co\n`)
    const brak = bledySrodowiska(projekt, {}, { jazda: false, narzedzia: SPRAWNE })
    assert.deepEqual(brak.length, 1)
    assert.ok(brak[0]?.startsWith(`brak ${env.adresSupabase} w .env.e2e, a ${env.plikiDev.join(' / ')} go ma — ${env.aplikacjaE2e} doczyta baze dev`), brak[0])
    const taSama = bledySrodowiska(projekt, { [env.adresSupabase]: 'https://dev.supabase.co' }, { jazda: false, narzedzia: SPRAWNE })
    assert.ok(taSama[0]?.startsWith(`${env.adresSupabase} w .env.e2e jest taki sam jak w ${env.plikiDev.join(' / ')}`), taSama[0])
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
})

test('advisors: ref projektu e2e z adresu Supabase klienta', () => {
  assert.deepEqual(refE2e({ [env.adresSupabase]: `https://${REF}.supabase.co` }), { ref: REF, blad: null })
  assert.match(refE2e({}).blad ?? '', new RegExp(`ani SUPABASE_E2E_DB_URL, ani ${env.adresSupabase} w`))
})

test('rdzeń odsyła do profilu zamiast nieść wartości stacku', () => {
  const czytaj = (/** @type {string} */ p) => readFileSync(join(CLAUDE, p), 'utf8')
  const hook = czytaj('hooks/error-handling-reminder.sh')
  assert.match(hook, /stack\/profil\.json/)
  assert.match(hook, /zrodla\.frontend/)
  assert.doesNotMatch(hook, /grep '\^src\/'/)
  assert.match(czytaj('scripts/doctor/advisors.mjs'), /PROFIL\.env\.adresSupabase/)
  assert.match(czytaj('agents/security-sentinel.md'), /`env\.prefiksPubliczny` w `\.claude\/stack\/profil\.json`/)
})
