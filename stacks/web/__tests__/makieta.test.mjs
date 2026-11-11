// Punkty wizualne smoke'u w stacku web (plan szablonu mobile z rdzenia, IU-2.7, D2): narzędzie `/makieta` działa na aplikacji w iframe,
// więc zdania o nim leżą w slocie `dev-docs-complete/references/stack.md`, a skill i skrypty w `.claude/` tylko dla webu (w Expo: usun.txt).
// Asercje przeniesione z `.claude/workflows/__tests__/start-koniec.test.mjs`; kontrakt wspólny (format punktu, odesłania) zostaje tam.
//
// Uruchomienie: node --test stacks/web/__tests__/makieta.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { LIMIT_CZEKANIA_MIN } from '../../../.claude/scripts/makieta/kolejka.mjs'
import { DOMYSLNY_PORT } from '../../../.claude/scripts/makieta/proces.mjs'
import { sprawdzFormat } from '../../../.claude/scripts/makieta/punkty.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
/** @param {string} sciezka */
const czytaj = (sciezka) => readFileSync(join(REPO, sciezka), 'utf8')

test('slot web: zdania o /makieta i kontrola makieta.mjs sprawdz w sekcji „Punkty wizualne”', () => {
  const slot = czytaj('.claude/skills/dev-docs-complete/references/stack.md').replace(/\n\s+/g, ' ')
  for (const z of [
    'Punkty wizualne przejdziesz narzędziem makiet: w sesji smoke\'u wpisz /makieta.',
    'Kontrola po zapisie pliku: `node .claude/scripts/makieta/makieta.mjs sprawdz --smoke <plik> --pola`. Kod 1 = pole problemy (linie spoza formatu albo bez PNG makiety) — popraw wskazane linie i uruchom kontrolę jeszcze raz; smoke bez punktów wizualnych daje kod 0.',
  ]) assert.ok(slot.includes(z), z)
})

// Punkt 40, krok 4: ramka „Jak kontynuować” zniknęła; /makieta i zatrzymanie narzędzia przed /clear podaje slot skilla /dev-smoke.
test('slot web /dev-smoke: punkty wizualne przez /makieta, zatrzymanie narzędzia przed /clear', () => {
  const slot = czytaj('.claude/skills/dev-smoke/references/stack.md').replace(/\n\s+/g, ' ')
  const sekcja = slot.slice(slot.indexOf('## Punkty wizualne'))
  assert.match(sekcja, /zaproponuj `\/makieta`/)
  assert.ok(sekcja.includes('Przed `/clear` zatrzymaj narzędzie: `node .claude/scripts/makieta/makieta.mjs stop`.'))
})

// P24 IU-8 po recenzji: szablon kroku 3 daje punkt wizualny, który przechodzi kontrolę formatu narzędzia; skill /makieta używa
// stałych narzędzia (limit Monitora, port w Redirect URLs).
test('smoke: przykładowy punkt wizualny szablonu przechodzi makieta sprawdzFormat; skill /makieta ze stałymi narzędzia', () => {
  const linie = czytaj('.claude/skills/dev-docs-complete/SKILL.md').split('\n')
  const i = linie.findIndex((l) => /^ {3}- \[ \] .*obok `visual-diff\/<ekran>-figma\.png`/.test(l))
  assert.ok(i > 0, 'szablon ma punkt wizualny')
  assert.deepEqual(sprawdzFormat(linie[i].trimStart().replaceAll('<ekran>', 'moje-projekty').replaceAll('<trasa>', '/konto')), [], 'po podstawieniu placeholderów')
  const makieta = czytaj('.claude/skills/makieta/SKILL.md')
  assert.ok(makieta.includes(`makieta.mjs czekaj --limit-min ${LIMIT_CZEKANIA_MIN}`))
  assert.ok(makieta.includes(`http://127.0.0.1:${DOMYSLNY_PORT}/**`))
  assert.ok(makieta.includes('zgloszenia --smoke <plik>'))
  assert.ok(!/Read[^\n]*PNG|otwórz[^\n]*PNG/i.test(makieta), 'skill nie każe czytać PNG')
})

// P28 (4): zgloszenia na koniec przegladu — skill zna zdarzenie konca przegladu, tryb „od razu” i dokument ustalen.
test('skill /makieta: zdarzenie przeglad-zakonczony, --zgloszenia od-razu na prośbę, dokument ustaleń przed poprawkami', () => {
  const makieta = czytaj('.claude/skills/makieta/SKILL.md')
  assert.ok(makieta.includes('Zdarzenie `przeglad-zakonczony`'))
  assert.ok(makieta.includes('`--zgloszenia od-razu`'))
  assert.ok(makieta.includes('docs/operator/<data>-<zadanie>-makiety-ustalenia.md'))
  assert.ok(makieta.indexOf('## Koniec przeglądu') < makieta.indexOf('## Droga awaryjna'))
  assert.match(makieta, /Zakończ\s+przegląd/)
  assert.match(makieta, /Kolejne `przeglad-zakonczony`[^]*?aktualizuje\s+ten sam dokument ustaleń/)
  assert.match(makieta, /W trybie „na koniec” po przeglądzie\s+obsłuż je jak w sekcji „Koniec przeglądu”/)
})

// P28 (6): adres narzedzia w uslugach z lista hostow — skill podaje pole `hosty` startu i wpis Turnstile.
test('skill /makieta: pole hosty z wyniku startu i host 127.0.0.1 w widgecie Turnstile', () => {
  const makieta = czytaj('.claude/skills/makieta/SKILL.md')
  assert.ok(makieta.includes('`hosty`'))
  assert.match(makieta, /Turnstile wymaga `127\.0\.0\.1` w hostach\s+widgetu/)
})

// Wiedza zapobiegania: buildery UI web odsyłają do checklisty dostępności tego skilla (przeniesione z zapobieganie.test.mjs).
test('ux-ui-guidelines ma checklistę dostępności, do której odsyłają buildery UI', () => {
  assert.match(czytaj('.claude/skills/ux-ui-guidelines/SKILL.md'), /^### Dostępność/m)
})
