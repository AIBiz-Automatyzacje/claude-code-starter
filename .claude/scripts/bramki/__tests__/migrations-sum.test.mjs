// Odbior bramki migrations.sum: suma SHA-256 migracji zapisana w repo (format sha256sum). Migracja z sumy zmieniona albo
// usunieta = porazka niezaleznie od bazy fazy (lapie tez edycje migracji z wczesniejszej fazy w kontroli fixa i przed env-up).

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { bramkaMigrationsSum, dopiszSume } from '../migrations-sum.mjs'
import { noweRepo, usun, zapisz } from './repo-testowe.mjs'

const A = '20260901000000_oferty.sql'
const B = '20261003000000_ceny.sql'
const SUMA = 'supabase/migrations.sum'

test('brak pliku sumy = brak; dopiszSume tworzy plik zgodny z sha256sum', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { [`supabase/migrations/${A}`]: 'create table oferty (id int);\n' })
    const bez = bramkaMigrationsSum(repo)
    assert.equal(bez.status, 'brak')
    assert.match(bez.powod ?? '', /migrations\.sum/)

    assert.deepEqual(dopiszSume(repo), [A])
    const sprawdzenie = execFileSync('shasum', ['-a', '256', '-c', '../migrations.sum'], { cwd: join(repo, 'supabase', 'migrations'), encoding: 'utf8' })
    assert.match(sprawdzenie, new RegExp(`${A}: OK`))
    assert.equal(bramkaMigrationsSum(repo).status, 'ok')
  } finally {
    usun(repo)
  }
})

test('przejscie -> edycja migracji z sumy -> porazka migrations-sum -> przejscie; usuniecie = porazka', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { [`supabase/migrations/${A}`]: 'create table oferty (id int);\n' })
    dopiszSume(repo)
    zapisz(repo, { [`supabase/migrations/${B}`]: 'alter table oferty add cena int;\n' })
    const zNowa = bramkaMigrationsSum(repo)
    assert.equal(zNowa.status, 'ok')
    assert.match(zNowa.powod ?? '', new RegExp(`spoza sumy: ${B}`))

    zapisz(repo, { [`supabase/migrations/${A}`]: 'create table oferty (id bigint);\n' })
    const w = bramkaMigrationsSum(repo)
    assert.equal(w.status, 'porazka')
    assert.deepEqual(w.trafienia.map((t) => [t.plik, t.regula]), [[`supabase/migrations/${A}`, 'migrations-sum']])

    zapisz(repo, { [`supabase/migrations/${A}`]: 'create table oferty (id int);\n' })
    assert.equal(bramkaMigrationsSum(repo).status, 'ok')

    rmSync(join(repo, 'supabase', 'migrations', A))
    assert.match(bramkaMigrationsSum(repo).trafienia[0]?.opis ?? '', /usunieta/)
  } finally {
    usun(repo)
  }
})

test('dopiszSume dopisuje tylko nowe migracje i nigdy nie nadpisuje istniejacego wpisu', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { [`supabase/migrations/${A}`]: 'create table oferty (id int);\n' })
    dopiszSume(repo)
    const przed = readFileSync(join(repo, SUMA), 'utf8')
    zapisz(repo, { [`supabase/migrations/${A}`]: 'zmieniona\n', [`supabase/migrations/${B}`]: 'nowa\n' })
    assert.deepEqual(dopiszSume(repo), [B])
    const po = readFileSync(join(repo, SUMA), 'utf8')
    assert.ok(po.startsWith(przed), 'wpis A bez zmian — edycja nadal wykrywalna')
    assert.equal(bramkaMigrationsSum(repo).status, 'porazka')
  } finally {
    usun(repo)
  }
})

test('projekt bez supabase/migrations = pominieta', () => {
  const repo = noweRepo()
  try {
    assert.equal(bramkaMigrationsSum(repo).status, 'pominieta')
  } finally {
    usun(repo)
  }
})

// Zmiana kontraktu (P6 sesja 2): dawniej blad; domkniecie fazy wola --dopisz-sume zawsze, takze w projekcie bez migracji.
test('dopiszSume w projekcie bez supabase/migrations: nic nie dopisuje i nie tworzy pliku (domkniecie wola ja zawsze)', () => {
  const repo = noweRepo()
  try {
    assert.deepEqual(dopiszSume(repo), [])
    assert.equal(existsSync(join(repo, 'supabase', 'migrations.sum')), false)
  } finally {
    usun(repo)
  }
})
