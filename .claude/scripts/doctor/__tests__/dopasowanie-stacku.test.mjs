// Dopasowanie warstwy stacku do projektu (znaleziska 2026-11-02 pkt 26): wiersze doctora per element. Profil jest tu podlozony,
// wiec oba profile (zakladajacy paczke drugiego wariantu i nie) sa sprawdzane na kazdym wariancie szablonu.
//
// Uruchomienie: node --test .claude/scripts/doctor/__tests__/dopasowanie-stacku.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { PROFIL } from '../../stack/profil.mjs'
import { wierszeDopasowania } from '../dopasowanie-stacku.mjs'

const REPO_A = 'https://example.com/wariant-a.git'
const REPO_B = 'https://example.com/wariant-b.git'
/** @type {import('../../stack/profil.mjs').Profil} profil, ktory nie zaklada paczki `ramka` */
const BEZ_PACZKI = { ...PROFIL, szablon: { repo: REPO_A, innyWariant: { nazwa: 'B', zaleznosc: 'ramka', obecna: true, repo: REPO_B } } }
/** @type {import('../../stack/profil.mjs').Profil} profil, ktory zaklada paczke `ramka` */
const Z_PACZKA = { ...PROFIL, szablon: { repo: REPO_B, innyWariant: { nazwa: 'A', zaleznosc: 'ramka', obecna: false, repo: REPO_A } } }
const KLIENT = JSON.stringify({ dependencies: { '@supabase/supabase-js': '2.50.0' } })
const RAMKA = JSON.stringify({ dependencies: { ramka: '1.0.0', '@supabase/supabase-js': '2.50.0' } })

/** @param {Record<string, string>} pliki @param {(projekt: string) => void} cialo */
function zProjektem(pliki, cialo) {
  const projekt = mkdtempSync(join(tmpdir(), 'dopasowanie-'))
  try {
    for (const [sciezka, tresc] of Object.entries(pliki)) {
      mkdirSync(dirname(join(projekt, sciezka)), { recursive: true })
      writeFileSync(join(projekt, sciezka), tresc)
    }
    cialo(projekt)
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

test('projekt bez Supabase: wiersz „nie dotyczy” wymienia skill, komendy buildera danych i reguly RLS', () => zProjektem({ 'backend/pyproject.toml': '' }, (projekt) => {
  const [wiersz, ...reszta] = wierszeDopasowania(projekt, BEZ_PACZKI)
  assert.deepEqual(reszta, [])
  assert.deepEqual(wiersz?.slice(0, 2), ['stack: Supabase', 'nie dotyczy'])
  assert.equal(wiersz?.[3], 'projekt bez Supabase: nie stosuj skilla supabase-dev-guidelines, komend supabase z roli buildera danych ani reguł RLS i GRANT; migracje i dostęp do danych narzędziami projektu (plan, CLAUDE.md)')
}))

// Punkt 55 (26): zepsuty package.json bez innego trafienia = UWAGA „nie udało się ustalić”, a nie „nie dotyczy”.
test('Supabase nieustalony przez nieczytelny package.json: UWAGA ze sciezka; Supabase glebiej — bez wiersza', () => {
  zProjektem({ 'frontend/package.json': '{ "dependencies": ' }, (projekt) => {
    assert.deepEqual(wierszeDopasowania(projekt, BEZ_PACZKI), [['stack: Supabase', 'UWAGA', 'nie udało się ustalić (nieczytelny package.json: frontend/package.json)',
      'popraw JSON w tym pliku; do tego czasu stosuj elementy Supabase z profilu tylko tam, gdzie projekt ich używa']])
  })
  zProjektem({ 'apps/web/supabase/config.toml': '' }, (projekt) => assert.deepEqual(wierszeDopasowania(projekt, BEZ_PACZKI), []))
  zProjektem({ 'api/requirements.txt': 'supabase==2.3\n' }, (projekt) => assert.deepEqual(wierszeDopasowania(projekt, BEZ_PACZKI), []))
})

test('klient Supabase w pakiecie pierwszego poziomu: bez wiersza, takze gdy korzen nie ma package.json', () => zProjektem({ 'frontend/package.json': KLIENT }, (projekt) => {
  assert.deepEqual(wierszeDopasowania(projekt, BEZ_PACZKI), [])
}))

test('profil bez paczki, a projekt ja ma: UWAGA z manifestem i repo drugiego wariantu', () => zProjektem({ 'package.json': KLIENT, 'mobile/package.json': RAMKA }, (projekt) => {
  assert.deepEqual(wierszeDopasowania(projekt, BEZ_PACZKI), [['stack: wariant szablonu', 'UWAGA',
    'zależność ramka w mobile/package.json, a profil stacku w .claude/ jej nie zakłada', `dla tej aplikacji jest wariant B szablonu: ${REPO_B}`]])
}))

// Manifesty czytamy do pierwszego poziomu, wiec aplikacja w apps/mobile/ wygladalaby jak projekt bez paczki: brak trafienia nie jest dowodem.
test('profil z paczka: bez wiersza, takze gdy zaden manifest jej nie ma', () => {
  zProjektem({ 'package.json': KLIENT }, (projekt) => assert.deepEqual(wierszeDopasowania(projekt, Z_PACZKA), []))
  zProjektem({ 'supabase/config.toml': '' }, (projekt) => assert.deepEqual(wierszeDopasowania(projekt, Z_PACZKA), []))
  zProjektem({ 'package.json': KLIENT, 'mobile/package.json': RAMKA }, (projekt) => assert.deepEqual(wierszeDopasowania(projekt, Z_PACZKA), []))
})
