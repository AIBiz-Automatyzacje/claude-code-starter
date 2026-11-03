// Szwy stackowe w workflowach (plan szablonu mobile z rdzenia, IU-1.2). Tekst zależny od stacku (runner testów, narzędzie
// builda, narzędzie jazdy E2E) nie siedzi w promptach rdzenia, tylko w slotach `.claude/stack/*.md`, do których prompt
// odsyła. Wariant web slotów niesie dawną treść promptów (stacks/__tests__/sloty.test.mjs), wariant Expo podmienia pliki.
// Tryb testera E2E ma nazwy niezależne od narzędzia jazdy; dawne nazwy ze stanów sprzed zmiany mapuje autopilot.
//
// Uruchomienie: node --test .claude/workflows/__tests__/sloty-stacku.test.mjs

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
/** @param {string} sciezka */
const czytaj = (sciezka) => readFileSync(resolve(KATALOG, '..', '..', sciezka), 'utf8')

const autopilot = czytaj('workflows/dev-autopilot-wf.js')
const execute = czytaj('workflows/dev-docs-execute-wf.js')
const review = czytaj('workflows/dev-docs-review-wf.js')
const pr = czytaj('workflows/dev-pr-wf.js')
const tester = czytaj('agents/feature-tester-e2e.md')

/** @param {string} zrodlo @param {string} kotwica @param {string} koniec */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/**
 * Kod bez linii komentarzy `//` — słowa stacku w komentarzach (historia vibersi) nie trafiają do promptów. Etykieta
 * agenta rozgrzewki zostaje: telemetria (`scripts/telemetria/faza.mjs`) grupuje po niej runy sprzed i po zmianie.
 */
const bezKomentarzy = (/** @type {string} */ zrodlo) => zrodlo.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  .replace("label: 'warmup:vitest'", '')

const SLOWA_WALIDACJI = ['vitest', 'vite build', 'vite.config', 'optimizeDeps', '@testing-library/react', '<div>warmup']
/** @param {string} tekst @param {string[]} slowa */
const znalezione = (tekst, slowa) => slowa.filter((s) => tekst.includes(s))

const blok = (/** @type {string} */ zrodlo) => wytnij(zrodlo, 'const BLOK_DLUGIE_KOMENDY = `', '=== KONIEC BLOKU DLUGICH KOMEND ===`')

test('blok długich komend: ta sama treść w trzech workflowach, odsyła do slotu walidacji, bez słów stacku', () => {
  const wzor = blok(autopilot)
  assert.equal(blok(execute), wzor)
  assert.equal(blok(review), wzor)
  assert.match(wzor, /\.claude\/stack\/walidacja\.md/)
  assert.match(wzor, /„Zimny runner”/)
  assert.match(wzor, /„Flake infrastruktury”/)
  assert.deepEqual(znalezione(wzor, [...SLOWA_WALIDACJI, '--reporter=dot', '[vitest-worker]']), [])
  // Prawa środowiska agenta zostają w rdzeniu — nie zależą od stacku.
  assert.match(wzor, /~180s bez zadnego outputu/)
  assert.match(wzor, /limit 600s/)
  assert.match(wzor, /run_in_background/)
})

test('rozgrzewka: kroki stacku ze slotu walidacji, prefiks promptu dla telemetrii bez zmian', () => {
  const p = wytnij(autopilot, 'function warmupPrompt(', '\n}\n')
  assert.match(p, /return `Jestes rozgrzewka cache/)
  assert.match(p, /\.claude\/stack\/walidacja\.md/)
  assert.match(p, /„Rozgrzewka cache”/)
  assert.deepEqual(znalezione(p, [...SLOWA_WALIDACJI, 'src/components/']), [])
  assert.match(p, /status:"zbedne"/)
  assert.match(p, /czasKontrolnySek < 60/)
})

test('walidacja końcowa i domknięcie fazy: krok build ze slotu walidacji, bez vite build', () => {
  const koncowa = wytnij(autopilot, 'function finalValidationPrompt(', 'KROK 3 — AUDYT TESTOW')
  assert.match(koncowa, /\.claude\/stack\/walidacja\.md/)
  assert.deepEqual(znalezione(bezKomentarzy(autopilot), SLOWA_WALIDACJI), [])
  assert.deepEqual(znalezione(bezKomentarzy(execute), SLOWA_WALIDACJI), [])
  assert.match(execute, /\.claude\/stack\/walidacja\.md/)
  assert.match(wytnij(pr, 'const BLOK_KOMEND_PROJEKTU = `', '=== KONIEC BLOKU KOMEND ===`'), /\.claude\/stack\/walidacja\.md/)
})

test('fix findingu E2E: narzędzie jazdy ze slotu fix-e2e, mechanika restartu i manual w rdzeniu', () => {
  assert.match(autopilot, /\.claude\/stack\/fix-e2e\.md/)
  assert.deepEqual(znalezione(bezKomentarzy(autopilot), ['agent-browser']), [])
  assert.match(autopilot, /e2e\.mjs start --zadanie/)
  assert.match(autopilot, /e2e\.mjs manual --zadanie/)
})

test('review: opisy pól dossier bez narzędzia jazdy, ścieżki warstwy UI ze slotu builderów', () => {
  const schemat = wytnij(review, 'warstwy: {', 'figmaScreens:')
  assert.deepEqual(znalezione(schemat, ['agent-browser', 'public/', 'HTML']), [])
  assert.match(schemat, /\.claude\/stack\/buildery\.md/)
  assert.doesNotMatch(review, /milczy w przegladarce/)
  assert.deepEqual(znalezione(bezKomentarzy(review), SLOWA_WALIDACJI.filter((s) => s !== 'vitest')), [])
  assert.doesNotMatch(bezKomentarzy(execute), /agent-browser/)
})

test('tryb testera E2E: interaktywny | bez-interakcji | pominiety w workflowie i pliku roli', () => {
  const tryb = wytnij(review, 'function trybTesteraE2e(', '\n}\n')
  assert.match(tryb, /'bez-interakcji' : 'interaktywny'/)
  assert.match(review, /const blokerSrodowiska = e2eTryb === 'interaktywny'/)
  for (const [nazwa, tekst] of [['review', review], ['autopilot', bezKomentarzy(autopilot).replace(/const TRYB_E2E_DAWNY = .*\n/, '')], ['tester', tester]]) {
    assert.doesNotMatch(tekst, /bez-przegladarki|`przegladarka`|'przegladarka'/, `${nazwa}: dawna nazwa trybu`)
  }
  assert.match(tester, /`interaktywny` albo `bez-interakcji`/)
})

test('stan sprzed zmiany: dawne nazwy trybu mapowane na nowe przy skrócie przebiegu', () => {
  const mapa = wytnij(autopilot, 'const TRYB_E2E_DAWNY = ', '}')
  assert.match(mapa, /przegladarka: 'interaktywny'/)
  assert.match(mapa, /'bez-przegladarki': 'bez-interakcji'/)
  assert.match(wytnij(autopilot, 'function skrotPrzebiegu(', '\n}\n'), /e2eTryb: TRYB_E2E_DAWNY\[p\.e2eTryb\] \|\| p\.e2eTryb \|\| null/)
})

test('każdy slot, do którego odsyłają workflowy, istnieje w wariancie web', () => {
  const odeslania = new Set([autopilot, execute, review, pr].flatMap((t) => [...t.matchAll(/\.claude\/stack\/[a-z0-9-]+\.md/g)].map((m) => m[0])))
  assert.ok(odeslania.size >= 3)
  for (const plik of odeslania) assert.ok(existsSync(resolve(KATALOG, '..', '..', '..', plik)), `brak ${plik}`)
})

// Odesłanie do sekcji, której nazwa w slocie się zmieniła, zostawia agenta bez instrukcji — także w nakładce stacku,
// która musi zachować te same nagłówki.
test('sekcje slotów, do których odsyłają workflowy, są nagłówkami ## w wariancie web', () => {
  const sekcje = {
    'walidacja.md': ['Zimny runner', 'Flake infrastruktury', 'Rozgrzewka cache', 'Runner testów i build'],
    'fix-e2e.md': ['Ponowne odegranie scenariusza', 'Sprawdzenie poprawki wizualnej'],
    'buildery.md': ['Ścieżki warstw'],
    'plan-e2e.md': ['Linia scenariusza'],
  }
  const workflowy = [autopilot, execute, review, pr].join('\n')
  for (const [plik, nazwy] of Object.entries(sekcje)) {
    const slot = czytaj(`stack/${plik}`)
    for (const nazwa of nazwy) {
      assert.ok(workflowy.includes(`„${nazwa}”`), `workflowy nie odsyłają do „${nazwa}” — lista testu wymaga aktualizacji`)
      assert.match(slot, new RegExp(`^## ${nazwa}$`, 'm'), `${plik}: brak sekcji ${nazwa}`)
    }
  }
  const wszystkieOdeslania = [...workflowy.matchAll(/„([^”]+)”/g)].map((m) => m[1])
  const znane = Object.values(sekcje).flat()
  const sekcjePodobne = wszystkieOdeslania.filter((n) => !znane.includes(n) && /^(Zimny|Flake|Rozgrzewka|Runner|Ponowne|Sprawdzenie|Ścieżki)/.test(n))
  assert.deepEqual(sekcjePodobne, [], 'odesłanie do sekcji slotu spoza listy testu')
})
