// Test dostawy regul kodu agentom, ktorzy zmieniaja kod (PLAN-POPRAWY P16, kryterium P12 w smoke'ach R-P14 i R-P15).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/reguly-naprawiacza.test.mjs
//
// DLACZEGO: `coding-rules.md` ma `paths:` i dolacza sie tylko przy Read/Edit pliku kodu. Polecenie jawnego odczytu
// trafilo w P12 do `fix:poprawka` i `pr:napraw`, a ominelo glowny fix — fix edytujacy Bashem zmienial kod bez regul
// (R-P14, R-P15), a poprawka czytajaca plik grepem dostawala go drugi raz przez `paths:`. Odczyt narzedziem Read
// harness zapamietuje i `paths:` juz pliku nie dolacza (buildery w R-P15). Polecenie siedzi wiec w pliku roli —
// builderow i klasy naprawiacza, ktora jada fix, poprawka fixa i naprawy PR — a workflowy go nie powtarzaja.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { AGENCI, WORKFLOWY, naPodlozonym, tresc } from './agenci-pipeline.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const REGULY_KODU = '.claude/rules/coding-rules.md'
const ODCZYT = `przeczytaj narzędziem Read cały plik \`${REGULY_KODU}\``
// Role, ktorych praca to pisanie kodu: buildery (P12) i klasa naprawiacza (fix, poprawka fixa, naprawy PR). Domkniecie fazy
// i walidacja koncowa poprawiaja kod po bramkach mechanicznych i swiadomie zostaja przy `paths:`.
const ROLE_Z_KODEM = ['feature-builder-data', 'feature-builder-ui', 'feature-builder-fullstack', 'feature-builder-ui-figma',
  'feature-builder-fullstack-figma', 'klasa-naprawiacz']

/**
 * @param {string} korzen
 * @returns {string[]}  role zmieniajace kod bez polecenia odczytu regul narzedziem Read
 */
function roleBezOdczytu(korzen) {
  return ROLE_Z_KODEM.flatMap((nazwa) => {
    let tekst
    try {
      tekst = readFileSync(join(korzen, AGENCI, `${nazwa}.md`), 'utf8')
    } catch {
      return [`${nazwa}: brak pliku`]
    }
    return tresc(tekst).includes(ODCZYT) ? [] : [`${nazwa}: brak odczytu regul kodu narzedziem Read`]
  })
}

/**
 * @param {string} korzen
 * @returns {string[]}  linie workflowow (poza komentarzami) odsylajace do pliku regul kodu
 */
function workflowyZRegulami(korzen) {
  const katalog = join(korzen, WORKFLOWY)
  return readdirSync(katalog).filter((p) => p.endsWith('.js')).flatMap((plik) =>
    readFileSync(join(katalog, plik), 'utf8').split('\n')
      .map((linia, i) => ({ linia, i }))
      .filter(({ linia }) => !linia.trim().startsWith('//') && linia.includes(REGULY_KODU))
      .map(({ i }) => `${plik}:${i + 1}`))
}

test('podlozona klasa naprawiacza bez odczytu i brak pliku buildera sa zglaszane', () => {
  const plik = (/** @type {string} */ nazwa, /** @type {string} */ body) => `---\nname: ${nazwa}\n---\n${body}\n`
  const drzewo = Object.fromEntries(ROLE_Z_KODEM.map((n) => [`${AGENCI}/${n}.md`, plik(n, `- Przed pierwsza zmiana ${ODCZYT}.`)]))
  drzewo[`${AGENCI}/klasa-naprawiacz.md`] = plik('klasa-naprawiacz', `Reguly kodu: ${REGULY_KODU} — przeczytaj przed naprawa.`)
  delete drzewo[`${AGENCI}/feature-builder-ui-figma.md`]
  assert.deepEqual(naPodlozonym(drzewo, roleBezOdczytu), [
    'feature-builder-ui-figma: brak pliku',
    'klasa-naprawiacz: brak odczytu regul kodu narzedziem Read',
  ])
})

test('repo szablonu: buildery i klasa naprawiacza czytaja reguly narzedziem Read', () => {
  assert.deepEqual(roleBezOdczytu(REPO), [])
})

test('podlozony workflow z poleceniem odczytu regul jest zglaszany, komentarz nie', () => {
  const wynik = naPodlozonym({
    [`${WORKFLOWY}/a.js`]: `// ${REGULY_KODU} w komentarzu\nconst p = \`Reguly kodu projektu: ${REGULY_KODU} — przeczytaj.\`\n`,
  }, workflowyZRegulami)
  assert.deepEqual(wynik, ['a.js:2'])
})

test('repo szablonu: workflowy nie powtarzaja polecenia odczytu regul z pliku roli', () => {
  assert.deepEqual(workflowyZRegulami(REPO), [])
})

// Dedup semantyczny (haiku) laczy findingi po tresci listy. W R-P12 sam otwieral pliki kodu, a Read dokleil mu reguly kodu
// przez `paths:` (0,03 → 0,11 M, ok. 4% runu) — polecenie zabrania otwierania plikow.
test('dedup semantyczny ocenia po tresci listy, bez otwierania plikow', () => {
  const zrodlo = readFileSync(join(REPO, WORKFLOWY, 'dev-docs-review-wf.js'), 'utf8')
  const start = zrodlo.indexOf('const lista = dedup.map(')
  const koniec = zrodlo.indexOf("label: 'dedup:semantyczny'", start)
  assert.ok(start > -1 && koniec > start, 'kotwica polecenia dedupu wymaga aktualizacji')
  assert.match(zrodlo.slice(start, koniec), /Plikow nie otwierasz/)
})
