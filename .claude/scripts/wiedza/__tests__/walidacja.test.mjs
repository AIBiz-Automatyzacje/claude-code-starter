// Walidacja pol wiedzy w frontmatterze solution (PLAN-POPRAWY P10, zabezpieczenia PANEL-WEJSCIE §2 pkt 4): compound
// odmawia zapisu bez pol; klasa ze slownika, regula w 2 zdaniach, globy sprawdzone skladniowo i na plikach repo.

import test from 'node:test'
import assert from 'node:assert/strict'

import { POLA_WIEDZY, czyZawsze, liczZdania, walidujWpis } from '../walidacja.mjs'

const PLIKI = ['src/lib/limiter.ts', 'src/components/Baner.tsx', 'supabase/migrations/001_init.sql']
const WPIS = {
  klasa: 'zaufanie-danym-klienta',
  regula: 'Klucz limitera bierz z adresu polaczenia, nie z naglowka X-Forwarded-For. Naglowek czytaj tylko od zaufanego proxy, np. z listy TRUSTED_PROXY_IPS.',
  paths: ['src/lib/**'],
  waga: 'wysoka',
  szczebel: 'regula',
  szczebel_powod: 'zalezy od topologii wdrozenia, lint tego nie wyrazi',
  date: '2026-08-25',
  zrodlo: 'PR 4 oferty-online',
  ucieczki: '0',
}

test('walidujWpis: brak pol = odmowa z bledem dla kazdego wymaganego pola', () => {
  const w = walidujWpis({}, PLIKI)
  assert.equal(w.ok, false)
  for (const pole of POLA_WIEDZY) assert.ok(w.bledy.some((b) => b.startsWith(`${pole}:`)), pole)
})

test('walidujWpis: kompletny wpis przechodzi', () => {
  assert.deepEqual(walidujWpis(WPIS, PLIKI), { ok: true, bledy: [] })
})

test('walidujWpis: klasa spoza slownika, nie-defekt i „inna” odrzucone', () => {
  for (const klasa of ['xss', 'preferencja-bota', 'inna']) assert.equal(walidujWpis({ ...WPIS, klasa }, PLIKI).ok, false, klasa)
})

test('walidujWpis: regula ponad 2 zdania albo ponad limit znakow odrzucona; skroty i nazwy plikow nie koncza zdania', () => {
  assert.equal(walidujWpis({ ...WPIS, regula: 'Jedno. Drugie. Trzecie.' }, PLIKI).ok, false)
  assert.equal(walidujWpis({ ...WPIS, regula: `${'a'.repeat(401)}.` }, PLIKI).ok, false)
  assert.equal(liczZdania('Uzyj m.in. pliku `a.ts` i wersji 1.5, np. tak. Potem test!'), 2)
  assert.equal(liczZdania('Bez kropki na koncu'), 1)
})

test('walidujWpis: globy — skladnia (bezwzgledna, .., pusta lista) i dopasowanie do plikow repo', () => {
  for (const paths of [[], ['/src/**'], ['src/../x/**'], ['src\\lib\\**'], ['']]) {
    assert.equal(walidujWpis({ ...WPIS, paths }, PLIKI).ok, false, JSON.stringify(paths))
  }
  const w = walidujWpis({ ...WPIS, paths: ['src/lib/**', 'app/**'] }, PLIKI)
  assert.deepEqual(w.bledy, ['paths: glob "app/**" nie pasuje do zadnego pliku repo'])
  assert.equal(walidujWpis({ ...WPIS, paths: ['app/**'] }, null).ok, true, 'bez listy plikow tylko skladnia')
})

test('walidujWpis: waga, szczebel, data, ucieczki — wartosci spoza zakresu odrzucone', () => {
  for (const zmiana of [{ waga: 'P1' }, { szczebel: 'zasada' }, { date: '2026-13-01' }, { ucieczki: '-1' }, { zrodlo: ' ' }, { szczebel_powod: '' }]) {
    assert.equal(walidujWpis({ ...WPIS, ...zmiana }, PLIKI).ok, false, JSON.stringify(zmiana))
  }
})

test('czyZawsze: wpis z globem ** obowiazuje kazdy plik (koszyk „zawsze”)', () => {
  assert.equal(czyZawsze(['**']), true)
  assert.equal(czyZawsze(['src/**']), false)
})

test('walidujWpis: pole bramka (gdzie wdrozona) tylko przy szczeblu kod albo lint, niepuste', () => {
  const lint = { ...WPIS, szczebel: 'lint', szczebel_powod: 'no-restricted-syntax wykryje odczyt naglowka' }
  assert.deepEqual(walidujWpis({ ...lint, bramka: 'eslint.config.js no-restricted-syntax' }, PLIKI), { ok: true, bledy: [] })
  assert.match(walidujWpis({ ...lint, bramka: ' ' }, PLIKI).bledy.join('\n'), /^bramka: pusta/m)
  assert.match(walidujWpis({ ...WPIS, bramka: 'eslint.config.js' }, PLIKI).bledy.join('\n'), /^bramka: tylko przy szczeblu kod albo lint/m)
})
