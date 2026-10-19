// Odbior bramki migrations.sum: suma SHA-256 migracji zapisana w repo (format sha256sum). Migracja z sumy zmieniona albo
// usunieta = porazka niezaleznie od bazy fazy (lapie tez edycje migracji z wczesniejszej fazy w kontroli fixa i przed env-up).

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { bramkaMigrationsSum, dopiszSume, scalSume, scalWpisy } from '../migrations-sum.mjs'
import { commit, git, noweRepo, usun, zapisz } from './repo-testowe.mjs'

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

// P23 (pilot P22 B3, vibersi): rebase czesci 2 stanal na konflikcie w supabase/migrations.sum — main i czesc dopisaly
// po wpisie na koncu pliku. Wpis jest niezmienny, wiec rozwiazanie = suma wpisow obu stron, bez przeliczania skrotow.
const C = '20261005000000_rabaty.sql'
/** @param {string} skrot @param {string} nazwa */
const wpis = (skrot, nazwa) => `${skrot.repeat(64)}  ${nazwa}`

test('scalWpisy: nasze w kolejnosci, potem nowe z ich strony; wspolny wpis raz; ta sama migracja z inna suma = sprzeczne', () => {
  const nasza = `${wpis('a', A)}\n${wpis('b', B)}\n`
  assert.deepEqual(scalWpisy(nasza, `${wpis('a', A)}\n${wpis('c', C)}\n`), { tresc: `${wpis('a', A)}\n${wpis('b', B)}\n${wpis('c', C)}\n`, dopisane: [C] })
  assert.deepEqual(scalWpisy(nasza, nasza), { tresc: nasza, dopisane: [] })
  assert.deepEqual(scalWpisy(nasza, `${wpis('a', A)}\n${wpis('d', B)}\n`), { sprzeczne: [B] })
})

/**
 * Repo w trakcie rebase'u galezi `czesc` na main: obie strony dopisaly migracje i wpis do sumy.
 * @param {string} repo
 */
function rebaseZKonfliktemSumy(repo) {
  git(repo, ['branch', '-M', 'main'])
  zapisz(repo, { [`supabase/migrations/${A}`]: 'create table oferty (id int);\n' })
  dopiszSume(repo)
  commit(repo, 'A')
  git(repo, ['switch', '-q', '-c', 'czesc'])
  zapisz(repo, { [`supabase/migrations/${C}`]: 'alter table oferty add rabat int;\n' })
  dopiszSume(repo)
  commit(repo, 'C')
  git(repo, ['switch', '-q', 'main'])
  zapisz(repo, { [`supabase/migrations/${B}`]: 'alter table oferty add cena int;\n' })
  dopiszSume(repo)
  commit(repo, 'B')
  git(repo, ['switch', '-q', 'czesc'])
  const r = spawnSync('git', ['-C', repo, 'rebase', 'main'], { encoding: 'utf8' })
  assert.notEqual(r.status, 0, 'rebase ma stanac na konflikcie')
  assert.equal(git(repo, ['diff', '--name-only', '--diff-filter=U']), SUMA)
}

test('scalSume: konflikt rebase\'u w sumie -> wpisy obu stron, bramka ok, rebase --continue konczy rebase', () => {
  const repo = noweRepo()
  try {
    rebaseZKonfliktemSumy(repo)
    assert.deepEqual(scalSume(repo), { scalony: true, dopisane: [C] })
    assert.deepEqual(readFileSync(join(repo, SUMA), 'utf8').split('\n').filter(Boolean).map((l) => l.split('  ')[1]), [A, B, C])
    git(repo, ['add', SUMA])
    execFileSync('git', ['-C', repo, 'rebase', '--continue'], { env: { ...process.env, GIT_EDITOR: 'true' } })
    assert.equal(bramkaMigrationsSum(repo).status, 'ok')
    assert.equal(git(repo, ['log', '--format=%s', 'main..czesc']), 'C')
  } finally {
    usun(repo)
  }
})

test('scalSume: suma po scaleniu niezgodna z drzewem = scalony false z plikiem; bez konfliktu = scalony false', () => {
  const repo = noweRepo()
  try {
    rebaseZKonfliktemSumy(repo)
    writeFileSync(join(repo, 'supabase', 'migrations', A), 'zmieniona\n')
    const zla = scalSume(repo)
    assert.equal(zla.scalony, false)
    assert.match(zla.powod, new RegExp(`supabase/migrations/${A} — migracja zmieniona`))
  } finally {
    usun(repo)
  }
  const bez = noweRepo()
  try {
    const w = scalSume(bez)
    assert.equal(w.scalony, false)
    assert.match(w.powod, /brak obu wersji supabase\/migrations\.sum w konflikcie/)
  } finally {
    usun(bez)
  }
})
