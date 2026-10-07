// Test normalizacji etykiety agenta do roli i klasy roli (It. 1, krok 1).
// Przeglad D5 (§8 pkt 7): koszt_agentow.py sklejal fix:kontrola / fix:pre-skan / fix:poprawka w `fix`
// (43 agentow w agents.csv) — dopasowanie musi brac NAJDLUZSZA pasujaca nazwe.

import test from 'node:test'
import assert from 'node:assert/strict'

import { klasaRoli, klasyfikujPoPrompcie, rola } from '../role.mjs'

test('numery fazy, IU i proby znikaja z roli', () => {
  assert.equal(rola('build:IU-2.1'), 'build')
  assert.equal(rola('planner:faza-3'), 'planner')
  assert.equal(rola('verify-batch:src/a.ts:4'), 'verify-batch')
  assert.equal(rola('verify:src/a.ts:0'), 'verify')
  assert.equal(rola('review:security'), 'review:security')
})

test('fix:kontrola, fix:pre-skan i fix:poprawka NIE sklejaja sie w fix', () => {
  assert.equal(rola('fix:kontrola:faza-2'), 'fix:kontrola')
  assert.equal(rola('fix:pre-skan:faza-1'), 'fix:pre-skan')
  assert.equal(rola('fix:poprawka:faza-4'), 'fix:poprawka')
  assert.equal(rola('fix:faza-1'), 'fix')
})

test('compound-refresh nie skleja sie w compound', () => {
  assert.equal(rola('compound-refresh'), 'compound-refresh')
  assert.equal(rola('compound'), 'compound')
})

test('ponowienie (:retry) wraca do swojej roli', () => {
  assert.equal(rola('review:e2e:retry'), 'review:e2e')
  assert.equal(rola('e2e:env-up:retry'), 'e2e:env-up')
  assert.equal(rola('e2e:start:retry'), 'e2e:start')
  assert.equal(rola('stan:zapis:retry'), 'stan:zapis')
})

test('pr:zbierz z numerem tury traci numer', () => {
  assert.equal(rola('pr:zbierz:tura-2'), 'pr:zbierz')
})

test('pusta etykieta = null (stary format, rola z promptu)', () => {
  assert.equal(rola(''), null)
  assert.equal(rola(null), null)
})

test('klasa roli wg mapy D3 z poprawka panelu', () => {
  assert.equal(klasaRoli('stan:zapis'), 'mechaniczny')
  assert.equal(klasaRoli('fix:pre-skan'), 'mechaniczny')
  assert.equal(klasaRoli('verify-batch'), 'sceptyk')
  assert.equal(klasaRoli('review:correctness'), 'reviewer')
  assert.equal(klasaRoli('review:e2e'), 'tester-e2e')
  assert.equal(klasaRoli('build'), 'builder')
  assert.equal(klasaRoli('fix'), 'naprawiacz')
  assert.equal(klasaRoli('fix:kontrola'), 'orkiestracyjny')
  assert.equal(klasaRoli('bootstrap'), 'orkiestracyjny')
  assert.equal(klasaRoli('pr:zbierz'), 'orkiestracyjny')
  assert.equal(klasaRoli(null), null)
})

test('stary run bez etykiet: rola z poczatku promptu', () => {
  assert.equal(klasyfikujPoPrompcie('Jestes reviewerem fazy 1. Skup sie na: auth, RLS, walidacja'), 'review:security')
  assert.equal(klasyfikujPoPrompcie('Zapisz plik stanu docs/active/x/.autopilot-state.json'), 'stan:zapis')
  assert.equal(klasyfikujPoPrompcie('Adwersaryjnie OBAL ponizsze findingi'), 'verify-batch')
  assert.equal(klasyfikujPoPrompcie('cos zupelnie innego'), null)
  assert.equal(klasyfikujPoPrompcie('Uruchom w korzeniu repo dokladnie jedno polecenie i przepisz jego wynik:\n`node .claude/scripts/e2e/e2e.mjs start --zadanie docs/active/x`'), 'e2e:start')
  assert.equal(klasaRoli('e2e:start'), 'mechaniczny')
})

// P7: dossier liczy skrypt; zapasowy agent `dossier:zapas` (klasa mechaniczna) zastapil packagera `kontekst:diff`,
// a zwijanie „Do poprawy” robi fix — role kontekst:diff i zwin-do-poprawy wychodza z mapy (stan:zapis zostaje).
test('dossier:zapas: rola mechaniczna z etykiety i z poczatku promptu; kontekst:diff i zwin-do-poprawy poza mapa', () => {
  assert.equal(rola('dossier:zapas'), 'dossier:zapas')
  assert.equal(klasaRoli('dossier:zapas'), 'mechaniczny')
  assert.equal(klasyfikujPoPrompcie('Uruchom w korzeniu repo (Bash): `node .claude/scripts/dossier/dossier.mjs --sciezka docs/active/x --faza 1`'), 'dossier:zapas')
  assert.equal(klasaRoli('kontekst:diff'), 'orkiestracyjny')
  assert.equal(klasaRoli('zwin-do-poprawy'), 'orkiestracyjny')
  assert.equal(rola('zwin-do-poprawy:faza-2'), 'zwin-do-poprawy')
  assert.equal(klasyfikujPoPrompcie('Jestes context-packagerem fazy 1'), null)
  assert.equal(klasyfikujPoPrompcie('Zwin ZAMKNIETE pozycje sekcji'), null)
})

test('P8: zapis P3 ze stanu sprzed P8 do known-issues to rola mechaniczna', () => {
  assert.equal(rola('start:p3-known-issues'), 'start:p3-known-issues')
  assert.equal(klasaRoli(rola('start:p3-known-issues')), 'mechaniczny')
})
