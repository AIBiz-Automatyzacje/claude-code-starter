// Ksiegowanie linii [E2E] po przebiegu testera (P14): PASS -> [x], FAIL zostaje, SKIP z przyczyna srodowiska albo limitu
// -> [Manual] z powodem (run idzie dalej, pozycja trafia do smoke'u operatora), SKIP z przyczyna po stronie kodu -> fix.
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/ksiegowanie.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import { PRZYCZYNY_SKIP, rodzajPrzyczyny, zaksiegujFaze } from '../ksiegowanie.mjs'
import { listaManual, liczE2e, scenariuszeFazy } from '../scenariusze.mjs'

const ZADANIA = `# Zadania

## Faza 1 — Formularz

### IU-1: Formularz (feature-builder-ui)

- [ ] Stwórz: \`src/Formularz.tsx\`
- [ ] Test: [E2E] \`zapis-formularza\` (seed: e2e/seeds/formularz-seed.sql) — /formularz, wypełnij i zapisz → komunikat „Zapisano”
- [ ] Test: [E2E] \`mail-powitalny\` — /rejestracja, załóż konto → mail w skrzynce testowej
- [ ] Weryfikacja: [E2E] \`zapis-formularza\` — po zapisie lista pokazuje nowy wpis
- [ ] Test: [E2E] \`tryb-ciemny\` — /ustawienia, przełącz motyw → tło ciemne

## Operator checklist faza 1

- [ ] Operator: sprawdź mail na produkcji (IU-1)

## Faza 2 — Lista

- [ ] Test: [E2E] \`lista\` — /lista → 3 wiersze
`

/** @param {string} wynik @param {string} flow @param {string} przyczyna @param {string} dowod */
const wpis = (wynik, flow, przyczyna = 'nie-dotyczy', dowod = 'dowod') => ({ checkbox: '', flow, wynik, przyczyna, dowod })

test('przyczyny SKIP: srodowisko, limit, harness i pad testera ida do [Manual], brak seeda i niejasny scenariusz do fixa', () => {
  assert.equal(rodzajPrzyczyny('srodowisko'), 'manual')
  assert.equal(rodzajPrzyczyny('limit-zewnetrzny'), 'manual')
  assert.equal(rodzajPrzyczyny('harness'), 'manual')
  assert.equal(rodzajPrzyczyny('tester-padl'), 'manual')
  assert.equal(rodzajPrzyczyny('brak-seeda'), 'fix')
  assert.equal(rodzajPrzyczyny('scenariusz-niewykonalny'), 'fix')
  // Nieznana przyczyna nie zamienia scenariusza w reczny: zostaje [E2E] z SKIP i zatrzyma sie na completion-gate.
  assert.equal(rodzajPrzyczyny('nie-dotyczy'), 'skip')
  assert.equal(rodzajPrzyczyny(''), 'skip')
  assert.deepEqual(Object.keys(PRZYCZYNY_SKIP).sort(), ['brak-seeda', 'harness', 'limit-zewnetrzny', 'scenariusz-niewykonalny', 'srodowisko', 'tester-padl'])
})

test('PASS odznacza wszystkie linie flow i zdejmuje stary suffix; FAIL zostaje bez suffixu SKIP', () => {
  const przed = ZADANIA.replace('→ 3 wiersze', '→ 3 wiersze').replace('po zapisie lista pokazuje nowy wpis', 'po zapisie lista pokazuje nowy wpis (SKIP — dev server nie odpowiadal)')
  const { tekst, zmiany } = zaksiegujFaze(przed, 1, [
    wpis('PASS', 'zapis-formularza'), wpis('FAIL', 'tryb-ciemny', 'nie-dotyczy', 'tlo jasne'), wpis('PASS', 'mail-powitalny'),
  ])
  assert.match(tekst, /^- \[x\] Test: \[E2E\] `zapis-formularza`.*„Zapisano”$/m)
  assert.match(tekst, /^- \[x\] Weryfikacja: \[E2E\] `zapis-formularza` — po zapisie lista pokazuje nowy wpis$/m)
  assert.match(tekst, /^- \[ \] Test: \[E2E\] `tryb-ciemny` — \/ustawienia, przełącz motyw → tło ciemne$/m)
  assert.deepEqual(zmiany.pass.length, 3)
  assert.deepEqual(zmiany.fail.length, 1)
  // Faza 2 nietknieta.
  assert.match(tekst, /^- \[ \] Test: \[E2E\] `lista` — \/lista → 3 wiersze$/m)
})

test('jeden FAIL w flow blokuje odznaczenie wszystkich jego linii', () => {
  const { tekst } = zaksiegujFaze(ZADANIA, 1, [wpis('PASS', 'zapis-formularza'), wpis('FAIL', 'zapis-formularza')])
  assert.equal((tekst.match(/^- \[ \] (Test|Weryfikacja): \[E2E\] `zapis-formularza`/gm) || []).length, 2)
})

test('SKIP z przyczyna srodowiska -> [Manual] z kategoria i powodem, bez kopii w Operator checklist', () => {
  const { tekst, zmiany } = zaksiegujFaze(ZADANIA, 1, [
    wpis('PASS', 'zapis-formularza'), wpis('SKIP', 'mail-powitalny', 'limit-zewnetrzny', 'mailer stagingu: 429 (limit 2/h)'), wpis('PASS', 'tryb-ciemny'),
  ])
  assert.match(tekst, /^- \[ \] Test: \[Manual\] `mail-powitalny` — \/rejestracja, załóż konto → mail w skrzynce testowej \(MANUAL — limit-zewnetrzny: mailer stagingu: 429 \[limit 2\/h\]\)$/m)
  assert.equal(zmiany.manual.length, 1)
  assert.deepEqual({ ...zmiany.manual[0], linia: undefined }, { faza: 1, flow: 'mail-powitalny', przyczyna: 'limit-zewnetrzny', powod: 'mailer stagingu: 429 [limit 2/h]', linia: undefined })
  assert.doesNotMatch(tekst, /Operator: .*mail-powitalny/)
  // Linia [Manual] nie jest scenariuszem dla prechecku, completion-gate i dossier.
  assert.equal(liczE2e(tekst), 1 + 0)
})

test('SKIP z przyczyna po stronie kodu zostaje [E2E] z suffixem SKIP i kopia w Operator checklist (jak dzis)', () => {
  const { tekst, zmiany } = zaksiegujFaze(ZADANIA, 1, [
    wpis('SKIP', 'zapis-formularza', 'brak-seeda', 'brak e2e/seeds/formularz-seed.sql'), wpis('PASS', 'mail-powitalny'), wpis('PASS', 'tryb-ciemny'),
  ])
  assert.match(tekst, /^- \[ \] Test: \[E2E\] `zapis-formularza`.*„Zapisano” \(SKIP — brak e2e\/seeds\/formularz-seed\.sql\)$/m)
  assert.match(tekst, /^- \[ \] Operator: Test: \[Manual\] `zapis-formularza`.* — Operator action: brak e2e\/seeds\/formularz-seed\.sql$/m)
  assert.equal(zmiany.skip.length, 2)
  assert.equal(zmiany.manual.length, 0)
  // Kopia trafia do istniejacej sekcji operatora fazy 1, nie do fazy 2.
  const operator = tekst.split('## Operator checklist faza 1')[1].split('## Faza 2')[0]
  assert.match(operator, /zapis-formularza/)
})

test('w flow z SKIP srodowiska i SKIP brak-seeda wygrywa fix (defekt kodu nie znika w recznym)', () => {
  const { zmiany } = zaksiegujFaze(ZADANIA, 1, [wpis('SKIP', 'zapis-formularza', 'srodowisko'), wpis('SKIP', 'zapis-formularza', 'brak-seeda')], { tylkoZWpisem: true })
  assert.equal(zmiany.manual.length, 0)
  assert.equal(zmiany.skip.length, 2)
})

test('brak wpisu: domyslnie SKIP (completion-gate), z brakWpisu tester-padl -> [Manual] dla kazdej linii', () => {
  const bez = zaksiegujFaze(ZADANIA, 1, [])
  assert.equal(bez.zmiany.bezWpisu.length, 4)
  assert.match(bez.tekst, /`tryb-ciemny` — \/ustawienia, przełącz motyw → tło ciemne \(SKIP — brak wpisu testera\)$/m)
  const padl = zaksiegujFaze(ZADANIA, 1, [], { brakWpisu: { przyczyna: 'tester-padl', powod: 'tester E2E zwrocil null 2x' } })
  assert.equal(padl.zmiany.manual.length, 4)
  assert.equal(liczE2e(padl.tekst), 1)
  assert.equal(listaManual(padl.tekst).length, 4)
})

test('tylkoZWpisem zostawia flow bez wpisu (fix przenosi pojedynczy flow na [Manual])', () => {
  const { tekst, zmiany } = zaksiegujFaze(ZADANIA, 1, [wpis('SKIP', 'tryb-ciemny', 'srodowisko', 'dev server lezy')], { tylkoZWpisem: true })
  assert.equal(zmiany.manual.length, 1)
  assert.equal(zmiany.bezWpisu.length, 0)
  assert.match(tekst, /^- \[ \] Test: \[E2E\] `mail-powitalny` — \/rejestracja, załóż konto → mail w skrzynce testowej$/m)
})

test('powtorka: PASS po wczesniejszym SKIP zdejmuje suffix i usuwa kopie Operator z [Manual]', () => {
  const pierwszy = zaksiegujFaze(ZADANIA, 1, [wpis('SKIP', 'zapis-formularza', 'brak-seeda', 'brak seeda')], { tylkoZWpisem: true }).tekst
  const drugi = zaksiegujFaze(pierwszy, 1, [wpis('PASS', 'zapis-formularza')], { tylkoZWpisem: true }).tekst
  assert.match(drugi, /^- \[x\] Test: \[E2E\] `zapis-formularza`.*„Zapisano”$/m)
  assert.doesNotMatch(drugi, /Operator: Test: \[Manual\] `zapis-formularza`/)
  assert.match(drugi, /Operator: sprawdź mail na produkcji/)
})

test('dopasowanie po tresci dla linii bez identyfikatora flow (starszy format)', () => {
  const stary = '## Faza 1 — X\n\n- [ ] Weryfikacja: [E2E] otworz /x i kliknij Zapisz → toast (SKIP — stary powod)\n'
  const { tekst } = zaksiegujFaze(stary, 1, [{ checkbox: 'Weryfikacja: [E2E] otworz /x i kliknij Zapisz → toast (SKIP — stary powod)', flow: '', wynik: 'PASS', przyczyna: 'nie-dotyczy', dowod: 'ok' }])
  assert.match(tekst, /^- \[x\] Weryfikacja: \[E2E\] otworz \/x i kliknij Zapisz → toast$/m)
})

test('brak sekcji Operator checklist -> tworzy ja za sekcja fazy', () => {
  const bez = '## Faza 3 — Y\n\n- [ ] Test: [E2E] `y` — /y → ok\n\n## Faza 4 — Z\n'
  const { tekst } = zaksiegujFaze(bez, 3, [wpis('SKIP', 'y', 'scenariusz-niewykonalny', 'brak oczekiwanego stanu')])
  assert.match(tekst, /## Faza 3 — Y\n\n- \[ \] Test: \[E2E\] `y` — \/y → ok \(SKIP — brak oczekiwanego stanu\)\n\n## Operator checklist faza 3\n\n- \[ \] Operator: Test: \[Manual\] `y` — \/y → ok — Operator action: brak oczekiwanego stanu\n\n## Faza 4/)
})

test('scenariuszeFazy pomija kopie Operator:, pozycje findingow [P1-3] i linie innej fazy', () => {
  const z = `${ZADANIA}\n## Do poprawy po review fazy 1\n\n- [ ] 🟠 [P2] **x.tsx:1** — checkbox: Test: [e2e→fix] \`zapis-formularza\`\n`
  const linie = scenariuszeFazy(z, 1)
  assert.deepEqual(linie.map((l) => l.flow), ['zapis-formularza', 'mail-powitalny', 'zapis-formularza', 'tryb-ciemny'])
  assert.equal(scenariuszeFazy(z, 2).length, 1)
})

test('jakoReczna zamienia kazdy marker [E2E] w linii (inaczej completion-gate dalej widzi scenariusz)', () => {
  const z = '## Faza 1 — A\n\n- [ ] Test: [E2E] `a` — /a → ok [E2E]\n'
  const { tekst } = zaksiegujFaze(z, 1, [wpis('SKIP', 'a', 'srodowisko', 'x')])
  assert.equal(liczE2e(tekst), 0)
  assert.doesNotMatch(tekst, /\[E2E\]/)
})

test('kopia scenariusza = tylko format ksiegowania („— Operator action:”); wpis planera z tym samym flow zostaje', () => {
  const z = '## Faza 1 — A\n\n- [ ] Test: [E2E] `a` — /a → ok\n\n## Operator checklist faza 1\n\n- [ ] Operator: [Manual] `a`: review wizualny ekranu (IU-1)\n'
  const { tekst } = zaksiegujFaze(z, 1, [wpis('PASS', 'a')])
  assert.match(tekst, /Operator: \[Manual\] `a`: review wizualny ekranu \(IU-1\)/)
})

test('sekcja fazy tez z naglowkiem innego poziomu (# Faza N, ### Faza N), jak w dossier', () => {
  for (const h of ['#', '###']) {
    const z = `${h} Faza 1\n\n- [ ] Test: [E2E] \`a\` — /a → ok\n\n${h} Faza 2\n\n- [ ] Test: [E2E] \`b\` — /b → ok\n`
    assert.deepEqual(scenariuszeFazy(z, 1).map((l) => l.flow), ['a'], h)
    assert.deepEqual(scenariuszeFazy(z, 2).map((l) => l.flow), ['b'], h)
  }
})

test('kopia SKIP przy naglowkach # Faza N trafia do Operator checklist swojej fazy, nie nastepnej', () => {
  const z = '# Faza 1\n\n- [ ] Test: [E2E] `a` — /a → ok\n\n## Operator checklist faza 1\n\n- [ ] Operator: x (IU-1)\n\n# Faza 2\n\n- [ ] Test: [E2E] `b` — /b → ok\n\n## Operator checklist faza 2\n\n- [ ] Operator: y (IU-2)\n'
  const { tekst } = zaksiegujFaze(z, 1, [wpis('SKIP', 'a', 'brak-seeda', 'brak seeda')])
  const faza1 = tekst.split('# Faza 2')[0]
  assert.match(faza1, /Operator: Test: \[Manual\] `a`/)
  assert.doesNotMatch(tekst.split('# Faza 2')[1], /`a`/)
})

test('kopia SKIP przy naglowkach ### Faza N tez trafia do swojej fazy', () => {
  const z = '### Faza 1\n\n- [ ] Test: [E2E] `a` — /a → ok\n\n### Faza 2\n\n- [ ] Test: [E2E] `b` — /b → ok\n'
  const { tekst } = zaksiegujFaze(z, 1, [wpis('SKIP', 'a', 'brak-seeda', 'brak seeda')])
  assert.match(tekst.split('### Faza 2')[0], /Operator: Test: \[Manual\] `a`/)
})
