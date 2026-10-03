// Odbior bramki niezmiennosci migracji na repo testowym z commitami: migracja obecna w bazie fazy nie moze sie zmienic ani zniknac
// (Supabase CLI nie zauwazy edycji wypchnietej migracji). Nowa migracja fazy moze byc edytowana do woli.

import { rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { bramkaNiezmiennoscMigracji } from '../migracje.mjs'
import { commit, noweRepo, usun, zapisz } from './repo-testowe.mjs'

const STARA = 'supabase/migrations/20260901000000_oferty.sql'
const NOWA = 'supabase/migrations/20261003000000_ceny.sql'

test('przejscie -> edycja migracji z bazy -> porazka "popraw nowa migracja" -> przejscie', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { [STARA]: 'create table oferty (id int);\n' })
    const baza = commit(repo, 'baza')
    zapisz(repo, { [NOWA]: 'alter table oferty add cena int;\n' })
    commit(repo, 'faza: nowa migracja')
    zapisz(repo, { [NOWA]: 'alter table oferty add cena numeric;\n' })
    assert.equal(bramkaNiezmiennoscMigracji(repo, baza).status, 'ok', 'edycja migracji z tej samej fazy jest dozwolona')

    zapisz(repo, { [STARA]: 'create table oferty (id bigint);\n' })
    const w = bramkaNiezmiennoscMigracji(repo, baza)
    assert.equal(w.status, 'porazka')
    assert.deepEqual(w.trafienia.map((t) => [t.plik, t.regula]), [[STARA, 'niezmiennosc-migracji']])
    assert.match(w.trafienia[0].opis, /nowa migracja/)

    zapisz(repo, { [STARA]: 'create table oferty (id int);\n' })
    assert.equal(bramkaNiezmiennoscMigracji(repo, baza).status, 'ok')
  } finally {
    usun(repo)
  }
})

test('migracja z bazy usunieta w commicie fazy = porazka', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { [STARA]: 'create table oferty (id int);\n' })
    const baza = commit(repo, 'baza')
    rmSync(join(repo, STARA))
    commit(repo, 'faza: usuniecie')
    const w = bramkaNiezmiennoscMigracji(repo, baza)
    assert.equal(w.status, 'porazka')
    assert.match(w.trafienia[0].opis, /usunieta/)
  } finally {
    usun(repo)
  }
})

test('projekt bez supabase/migrations = pominieta', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { 'src/a.ts': 'export const a = 1\n' })
    const baza = commit(repo, 'baza')
    assert.equal(bramkaNiezmiennoscMigracji(repo, baza).status, 'pominieta')
  } finally {
    usun(repo)
  }
})
