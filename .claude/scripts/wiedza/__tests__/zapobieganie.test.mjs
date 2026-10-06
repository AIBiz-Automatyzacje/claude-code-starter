// Klasy zapobiegalne dla buildera (PLAN-POPRAWY P12, D10): zdanie „co robic zamiast” dobrane po plikach jednostki,
// kolejnosc wg liczby solutions klasy w projekcie, w limicie znakow wspolnym z wycinkiem regul projektu.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { KLASY_WIEDZY } from '../klasy.mjs'
import { NAGLOWEK, POKRYTE, ZDANIA, zapobieganie } from '../zapobieganie.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
// Tokeny regul kodu (jak w szkielet-buildera.test.mjs): zdanie odsylajace do tresci regul ja dubluje.
const TOKENY_REGUL_KODU = ['auth.uid()', 'strictObject', 'search_path', 'AbortSignal', 'eslint-disable', 'toBeDefined', 'user_metadata']
const MAKS_ZDANIE_ZN = 260

/** @param {string} klasa @param {string} plik */
function wpis(klasa, plik) {
  return { plik, pola: { klasa, regula: 'R.', paths: ['**'], waga: 'srednia', szczebel: 'regula', szczebel_powod: 'x', date: '2026-09-01', zrodlo: 'PR 1', ucieczki: '0' } }
}

test('tabela: klasy ze slownika wiedzy, rozlaczne z pokrytymi, zdania w limicie i bez tresci regul kodu', () => {
  const klasy = ZDANIA.map((z) => z.klasa)
  assert.deepEqual(klasy.filter((k) => !KLASY_WIEDZY.includes(k)), [])
  assert.deepEqual(Object.keys(POKRYTE).filter((k) => !KLASY_WIEDZY.includes(k)), [])
  assert.deepEqual(klasy.filter((k) => k in POKRYTE), [])
  assert.equal(new Set(klasy).size, klasy.length)
  for (const z of ZDANIA) {
    assert.ok(z.zdanie.length <= MAKS_ZDANIE_ZN, `${z.klasa}: ${z.zdanie.length} zn`)
    assert.deepEqual(TOKENY_REGUL_KODU.filter((t) => z.zdanie.includes(t)), [], z.klasa)
  }
})

test('klasa pokryta warstwa stala buildera albo regulami kodu: fraza nadal stoi we wskazanym pliku', () => {
  for (const [klasa, { pliki, fraza }] of Object.entries(POKRYTE)) {
    for (const plik of pliki) {
      assert.ok(readFileSync(resolve(REPO, plik), 'utf8').includes(fraza), `${klasa}: brak „${fraza}” w ${plik} — dopisz zdanie do ZDANIA`)
    }
  }
  assert.match(readFileSync(resolve(REPO, '.claude/skills/ux-ui-guidelines/SKILL.md'), 'utf8'), /^### Dostępność/m, 'checklista, do ktorej odsylaja buildery UI')
})

test('dobor po plikach: komponent dostaje tylko klasy kodu UI, migracja — klasy SQL, seed — klasy seedu', () => {
  assert.deepEqual(zapobieganie([], ['src/components/oferta/karta.tsx']).klasy, ['pii-i-sekrety', 'dopasowanie-tekstu', 'wyscig-i-wspolbieznosc'])
  const sql = zapobieganie([], ['supabase/migrations/20260901_oferty.sql']).klasy
  assert.ok(sql.includes('wartosc-graniczna') && sql.includes('bramka-na-jednej-drodze') && sql.includes('migracja-bazy'), sql.join(', '))
  assert.ok(!sql.includes('pii-i-sekrety'))
  assert.ok(zapobieganie([], ['e2e/seeds/oferta-seed.sql']).klasy.includes('seed-e2e'))
  assert.deepEqual(zapobieganie([], ['README.md']), { tresc: '', zn: 0, klasy: [], pominiete: 0 })
})

test('hook i klient API w folderze funkcji to warstwa danych klienta, komponent obok — nadal tylko klasy UI', () => {
  for (const plik of ['apps/web/src/features/settings/use-webhook-settings.ts', 'apps/web/src/features/settings/webhook-api.ts', 'src/features/oferty/oferta-service.ts']) {
    const { klasy } = zapobieganie([], [plik])
    assert.ok(klasy.includes('sciezka-bledu') && klasy.includes('limit-czasu-i-ponowien'), `${plik}: ${klasy.join(', ')}`)
  }
  assert.deepEqual(zapobieganie([], ['apps/web/src/features/settings/webhook-form.tsx']).klasy, ['pii-i-sekrety', 'dopasowanie-tekstu', 'wyscig-i-wspolbieznosc'])
})

test('kolejnosc: najpierw klasy z najwieksza liczba solutions w projekcie, remis — wezszy glob przed szerszym', () => {
  const wpisy = [wpis('wartosc-graniczna', 'a.md'), wpis('wartosc-graniczna', 'b.md'), wpis('pii-i-sekrety', 'c.md')]
  const { klasy } = zapobieganie(wpisy, ['supabase/functions/oferta/index.ts', 'supabase/migrations/1.sql'])
  assert.deepEqual(klasy.slice(0, 3), ['wartosc-graniczna', 'pii-i-sekrety', 'migracja-bazy'])
  assert.ok(klasy.indexOf('zaufanie-danym-klienta') < klasy.indexOf('sciezka-bledu'), klasy.join(', '))
})

test('limit nie wypiera zdan waskich: Edge Function z migracja dostaje zdania serwera i migracji, schemat — klasy danych', () => {
  const { klasy } = zapobieganie([], ['supabase/functions/oferta/index.ts', 'supabase/migrations/1.sql', 'src/services/oferta.ts'], { limitZn: 2000 })
  assert.ok(klasy.includes('zaufanie-danym-klienta') && klasy.includes('migracja-bazy'), klasy.join(', '))
  assert.ok(zapobieganie([], ['src/schemas/oferta-schema.ts']).klasy.includes('wartosc-graniczna'))
  assert.ok(!zapobieganie([], ['supabase/migrations/1.sql']).klasy.includes('limit-czasu-i-ponowien'))
  assert.deepEqual(zapobieganie([], ['src/schemas/oferta-schema.ts']).klasy, ['wartosc-graniczna', 'dopasowanie-tekstu', 'wyscig-i-wspolbieznosc'])
  assert.ok(!zapobieganie([], ['e2e/seeds/oferta-seed.sql']).klasy.includes('migracja-bazy'))
  assert.ok(klasy.includes('pii-i-sekrety'), 'Edge Function: zdanie o logach i Sentry nie wypada z limitu')
})

test('klasa z regula projektu w wycinku wypada — regula jest konkretniejsza', () => {
  const { klasy } = zapobieganie([], ['src/lib/a.ts'], { pominKlasy: ['dopasowanie-tekstu'] })
  assert.ok(!klasy.includes('dopasowanie-tekstu'))
})

test('limit: tresc z naglowkiem w limicie, nadmiarowe klasy policzone, limit bez miejsca na zdanie = pusto', () => {
  const pelny = zapobieganie([], ['supabase/functions/a/index.ts', 'supabase/migrations/1.sql'])
  assert.ok(pelny.tresc.startsWith(`${NAGLOWEK}\n- `))
  assert.equal(pelny.zn, pelny.tresc.length)
  const ciasny = zapobieganie([], ['supabase/functions/a/index.ts', 'supabase/migrations/1.sql'], { limitZn: 600 })
  assert.ok(ciasny.zn <= 600 && ciasny.klasy.length > 0, `${ciasny.zn}`)
  assert.equal(ciasny.klasy.length + ciasny.pominiete, pelny.klasy.length + pelny.pominiete)
  assert.deepEqual(zapobieganie([], ['src/lib/a.ts'], { limitZn: NAGLOWEK.length + 10 }).tresc, '')
})
