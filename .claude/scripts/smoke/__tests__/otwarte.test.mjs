// Otwarte sprawy po automacie (punkt 40, krok 6; punkt 45): liczby z plikow smoke'u i spraw odlozonych, nie z pamieci sesji.
//
// Uruchomienie: node --test .claude/scripts/smoke/__tests__/otwarte.test.mjs

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { decyzjeNierozstrzygniete, liczSmoke, otwarte, parsujOdlozone, plikSmoke, zdanieOtwartych } from '../otwarte.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '..', 'otwarte.mjs')
const SKILL_SMOKE = readFileSync(resolve(KATALOG, '../../../skills/dev-smoke/SKILL.md'), 'utf8')

/** @param {Record<string, string>} pliki @returns {string} */
function projekt(pliki) {
  const k = mkdtempSync(join(tmpdir(), 'otwarte-'))
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(dirname(join(k, p)), { recursive: true })
    writeFileSync(join(k, p), t)
  }
  return k
}

const SMOKE = `# Smoke\n\n## Decyzje przed PR\n- [x] D1 (faza 2, fix): limit → zostaw jak jest\n  - Gdzie: \`src/a.ts:5\`\n\n## 1. Ekran\n- [ ] Klik → widać listę\n- [x] Klik 2 → OK\n- [ ] **[fizyczne urządzenie]** dotyk\n- [ ] Sprawdź na produkcji po deployu → strona wstaje\n`
const ODLOZONE = `# Sprawy odłożone\n\nPozycje odłożone w smoke'u.\n\n- [ ] [etap: etap 5] sklep D2: limit koszyka — \`src/k.ts:9\` (smoke 2026-11-11)\n- [x] [etap: etap 4] sklep D1: zrobione w abc\n- [ ] [etap: następny etap] blog D1: pusty stan — \`src/b.ts:1\` (smoke 2026-11-10)\n- [ ] luźna notatka bez etykiety\n`

test('liczSmoke: nieodhaczone checkboxy, osobno „po deployu”; podpunkty i odhaczone pomija', () => {
  assert.deepEqual(liczSmoke(SMOKE), { otwarte: 3, poDeployu: 1, poDeployuLista: ['Sprawdź na produkcji po deployu → strona wstaje'] })
  assert.deepEqual(liczSmoke(SMOKE.replace(/\n/g, '\r\n')), { otwarte: 3, poDeployu: 1, poDeployuLista: ['Sprawdź na produkcji po deployu → strona wstaje'] })
})

test('parsujOdlozone: tylko nieodhaczone pozycje z etykietą etapu, z numerem linii', () => {
  assert.deepEqual(parsujOdlozone(ODLOZONE), [
    { linia: 5, etap: 'etap 5', tresc: 'sklep D2: limit koszyka — `src/k.ts:9` (smoke 2026-11-11)' },
    { linia: 7, etap: 'następny etap', tresc: 'blog D1: pusty stan — `src/b.ts:1` (smoke 2026-11-10)' },
  ])
})

test('format odłożonych zgodny ze skillem /dev-smoke (pozycja z szablonu skilla przechodzi parser)', () => {
  const wzor = /`(- \[ \] \[etap: <etykieta>\] [^\n]+?)`\. Etykieta/.exec(SKILL_SMOKE.replace(/\n\s+/g, ' '))?.[1] ?? ''
  assert.ok(wzor, 'skill /dev-smoke ma wzór pozycji odłożonej')
  const linia = wzor.replace(/\\`/g, '`').replace('<etykieta>', 'etap 3')
  assert.equal(parsujOdlozone(linia)[0]?.etap, 'etap 3')
})

test('plikSmoke: najnowszy smoke zadania po dacie w nazwie, bez smoke\'ów innych zadań', () => {
  const k = projekt({
    'docs/operator/2026-11-01-sklep-smoke.md': '- [ ] a\n',
    'docs/operator/2026-11-09-sklep-smoke.md': '- [ ] b\n',
    'docs/operator/2026-11-10-maly-sklep-smoke.md': '- [ ] c\n',
    'docs/operator/2026-11-12-inny-smoke.md': '- [ ] d\n',
  })
  try {
    assert.equal(plikSmoke(k, 'sklep'), 'docs/operator/2026-11-09-sklep-smoke.md')
    assert.equal(plikSmoke(k, 'brak'), null)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
  assert.equal(plikSmoke(tmpdir(), 'x'), null)
})

test('otwarte + zdanie: liczby z plików; zero mówi wprost „brak”, bez smoke\'u nie liczy pozycji smoke\'u', () => {
  const k = projekt({ 'docs/operator/2026-11-11-sklep-smoke.md': SMOKE, 'docs/operator/odlozone.md': ODLOZONE })
  try {
    const w = otwarte(k, { zadanie: 'sklep' })
    assert.deepEqual(w.smoke, { plik: 'docs/operator/2026-11-11-sklep-smoke.md', otwarte: 3, poDeployu: 1, poDeployuLista: ['Sprawdź na produkcji po deployu → strona wstaje'] })
    assert.equal(w.odlozone.otwarte.length, 2)
    assert.equal(w.zdanie, 'Otwarte: 3 pozycji smoke\'u (w tym 1 po deployu), 2 odłożonych (docs/operator/odlozone.md).')
    assert.equal(otwarte(k).zdanie, 'Otwarte: 2 odłożonych (docs/operator/odlozone.md).')
    const cli = spawnSync(process.execPath, [CLI, '--zadanie', 'sklep', '--projekt', k], { encoding: 'utf8' })
    assert.equal(cli.status, 0)
    assert.equal(JSON.parse(cli.stdout).zdanie, w.zdanie)
    assert.equal(spawnSync(process.execPath, [CLI, '--zadanie', '../x'], { encoding: 'utf8' }).status, 2)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
  assert.equal(zdanieOtwartych({ smoke: { otwarte: 0 }, odlozone: { otwarte: [] } }), 'Otwarte: brak (smoke odhaczony, nic odłożonego).')
  assert.equal(zdanieOtwartych({ smoke: null, odlozone: { otwarte: [] } }), 'Otwarte: brak (bez smoke\'u, nic odłożonego).')
})

// Raporty i planowanie czytaja te same liczby: archiwizacja, /dev-pr i /dev-smoke biora zdanie ze skryptu, /dev-prep — sprawy odlozone.
test('skille: raporty biorą zdanie z otwarte.mjs, /dev-prep zamienia sprawy odłożone w decyzje', () => {
  const czytaj = (/** @type {string} */ s) => readFileSync(resolve(KATALOG, '../../../skills', s), 'utf8').replace(/\n\s*/g, ' ')
  assert.match(czytaj('dev-docs-complete/SKILL.md'), /📌 <zdanie z `node \.claude\/scripts\/smoke\/otwarte\.mjs --zadanie \$ARGUMENTS`, pole `zdanie`, 1:1/)
  const pr = czytaj('dev-pr/SKILL.md')
  assert.match(pr, /Otwarte sprawy: <pole `zdanie` z `node \.claude\/scripts\/smoke\/otwarte\.mjs --zadanie <zadanie>`, 1:1>/)
  assert.match(pr, /dopóki zdanie nie brzmi „Otwarte: brak …”, nie piszesz, że zadanie jest zamknięte w całości/)
  assert.match(czytaj('dev-smoke/SKILL.md'), /pole `zdanie` z `node \.claude\/scripts\/smoke\/otwarte\.mjs --zadanie <zadanie>` 1:1/)
  const prep = czytaj('dev-prep/SKILL.md')
  assert.match(prep, /`node \.claude\/scripts\/smoke\/otwarte\.mjs` \(pole `odlozone\.otwarte`/)
  assert.match(prep, /\*\*Sprawy odłożone w smoke'u\.\*\* Każda otwarta pozycja `odlozone\.otwarte` ze skanu \(1\.2\) to decyzja bez markera blokady/)
})

// Weryfikacja partii 26–45, punkt 52: sprawa odlozona, ktora weszla do etapu, nie byla zamykana — /dev-prep i /dev-plan pliku nie
// zmienialy. Teraz zamyka ja /dev-plan po decyzji z /dev-prep; trzy wzory linii ze skilla przechodza parser jak trzeba.
test('/dev-plan zamyka sprawy odłożone: wchodzi i rezygnacja nie są liczone, czeka zostaje otwarta z nową etykietą', () => {
  const plan = readFileSync(resolve(KATALOG, '../../../skills/dev-plan/SKILL.md'), 'utf8')
  const wzor = (/** @type {string} */ wyjscie) => new RegExp(`- ${wyjscie} → (?:po zapisaniu planu \\(5\\.2\\) )?\`([^\`]+)\``).exec(plan)?.[1] ?? ''
  const wypelnij = (/** @type {string} */ w) => w.replace('<etykieta>', 'etap 5').replace('<nowa etykieta>', 'etap 6').replace('<treść>', 'sklep D2: limit koszyka — `src/k.ts:9` (smoke 2026-11-11)')
    .replace('<ścieżka planu>', 'docs/plans/2026-11-12-001-feat-x-plan.md').replace('<YYYY-MM-DD>', '2026-11-12')
  const [wchodzi, czeka, rezygnacja] = ['wchodzi', 'czeka', 'rezygnacja'].map((w) => wypelnij(wzor(w)))
  assert.match(wchodzi, /^- \[x\] \[etap: etap 5\] sklep D2: .* → w planie docs\/plans\/2026-11-12-001-feat-x-plan\.md \(2026-11-12\)$/)
  assert.match(rezygnacja, /^- \[x\] \[etap: etap 5\] sklep D2: .* → rezygnacja \(2026-11-12\)$/)
  assert.deepEqual(parsujOdlozone([wchodzi, rezygnacja].join('\n')), [], 'zamkniete nie sa liczone')
  assert.deepEqual(parsujOdlozone(czeka).map((p) => p.etap), ['etap 6'], 'czeka: otwarta z nowa etykieta')
  assert.match(plan, /Plik idzie do commitu inicjalnego \(6\.5\) jawną ścieżką\./)
  assert.match(plan, /`docs\/operator\/odlozone\.md` \(gdy 0\.3 go zmienił\)\. Bez `git add -A`/)
  const prep = readFileSync(resolve(KATALOG, '../../../skills/dev-prep/SKILL.md'), 'utf8')
  assert.match(prep, /po wypełnieniu decyzji \(„Ustalono”\) zmienia go `\/dev-plan` \(0\.3\)/)
  assert.doesNotMatch(prep, /robi to operator po wyborze/)
})

// Punkt 52: do odlozone.md pisalo tylko wyjscie „Odłóż” decyzji — zwykla pozycja listy i usterka nie mialy formatu.
test('/dev-smoke: odłożona pozycja listy i usterka (U<n>) mają wzory, które przechodzą parser odłożonych', () => {
  const plaski = SKILL_SMOKE.replace(/\n\s+/g, ' ')
  const usterka = /z numerem `U<n>` \(kolejna usterka tej sesji\) zamiast `D<n>`: `(- \[ \] \[etap: <etykieta>\] [^\n]+?)`\./.exec(plaski)?.[1] ?? ''
  const pozycja = /Wtedy wpis w `docs\/operator\/odlozone\.md`: `(- \[ \] \[etap: <etykieta>\] [^\n]+?)`, a w pliku smoke'u/.exec(plaski)?.[1] ?? ''
  assert.ok(usterka && pozycja, 'skill ma oba wzory')
  const wypelnij = (/** @type {string} */ w) => w.replace(/\\`/g, '`').replace('<etykieta>', 'etap 4').replace('<zadanie>', 'sklep')
  const linie = [wypelnij(usterka), wypelnij(pozycja)]
  assert.deepEqual(parsujOdlozone(linie.join('\n')).map((p) => [p.etap, p.tresc.split(':')[0]]), [['etap 4', 'sklep U<n>'], ['etap 4', 'sklep smoke']])
  assert.match(plaski, /a w pliku smoke'u pozycja `- \[x\] … → odłożone do <etykieta>`/)
})

// Walidacja 51–55, punkt 60: kilka zadan (kolejnosc alfabetyczna), plik obok katalogow archiwum i sekcja o podobnej nazwie.
test('decyzjeNierozstrzygniete: zadania alfabetycznie, plik w docs/completed pominiety, sekcja o podobnej nazwie nie liczy sie', () => {
  const k = projekt({
    'docs/completed/zeta/known-issues.md': '## Decyzje operatora\n\n- [DECYZJA · faza 1 · fix] z.ts:1 — z\n',
    'docs/completed/alfa/known-issues.md': '## Decyzje operatora — archiwum\n\n- [DECYZJA · faza 1 · fix] stara\n\n## Decyzje operatora \n\n- [DECYZJA · faza 2 · review] a.ts:2 — a\n',
    'docs/completed/known-issues.md': '## Decyzje operatora\n\n- [DECYZJA · faza 9 · fix] plik obok katalogow\n',
  })
  try {
    assert.deepEqual(decyzjeNierozstrzygniete(k), [
      { zadanie: 'alfa', wiersz: '[DECYZJA · faza 2 · review] a.ts:2 — a' },
      { zadanie: 'zeta', wiersz: '[DECYZJA · faza 1 · fix] z.ts:1 — z' },
    ])
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

// Punkt 52: decyzji nierozstrzygnietych (smoke pominiety albo przerwany) nie widzial ani /dev-prep, ani bramka gotowosci.
test('decyzjeNierozstrzygniete: wiersze [DECYZJA bez ROZSTRZYGNIĘTA z sekcji „Decyzje operatora” archiwum; tylko bez --zadanie', () => {
  const KI = '# Known issues — sklep\n\n## Decyzje operatora\n\n- [DECYZJA · faza 1 · fix] src/a.ts:5 — limit\n- [DECYZJA · faza 2 · autopilot] IU-4: mail bez imienia → ROZSTRZYGNIĘTA (smoke 2026-11-11): zostaw jak jest\n  - podpunkt\n\n## Faza 1\n\n- [DECYZJA · faza 1 · fix] poza sekcja\n'
  const k = projekt({
    'docs/completed/sklep/known-issues.md': KI.replace(/\n/g, '\r\n'),
    'docs/completed/blog/known-issues.md': '# K\n\n## Zamkniete\n\n- x\n',
    'docs/completed/bez-pliku/podsumowanie.md': '#\n',
  })
  try {
    assert.deepEqual(decyzjeNierozstrzygniete(k), [{ zadanie: 'sklep', wiersz: '[DECYZJA · faza 1 · fix] src/a.ts:5 — limit' }])
    assert.deepEqual(otwarte(k).decyzje, [{ zadanie: 'sklep', wiersz: '[DECYZJA · faza 1 · fix] src/a.ts:5 — limit' }])
    assert.equal(Object.hasOwn(otwarte(k, { zadanie: 'sklep' }), 'decyzje'), false, 'z --zadanie liczy plik smoke\'u')
    assert.equal(otwarte(k).zdanie, 'Otwarte: brak (bez smoke\'u, nic odłożonego).', 'zdanie bez zmian')
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
  const pusty = projekt({ 'README.md': '#\n' })
  try {
    assert.deepEqual(decyzjeNierozstrzygniete(pusty), [], 'brak docs/completed')
  } finally {
    rmSync(pusty, { recursive: true, force: true })
  }
  const plaski = (/** @type {string} */ s) => readFileSync(resolve(KATALOG, '../../../skills', s), 'utf8').replace(/\n\s*/g, ' ')
  assert.match(plaski('dev-prep/SKILL.md'), /Pole `decyzje` to decyzje poprzednich zadań, których nikt nie rozstrzygnął \(smoke pominięty albo przerwany\)/)
  assert.match(plaski('dev-prep/SKILL.md'), /\*\*Decyzje poprzednich zadań bez rozstrzygnięcia\.\*\* Każda pozycja pola `decyzje` ze skanu \(1\.2\) trafia do sekcji „Decyzje” z odsyłaczem: .*`\/dev-smoke <zadanie>`/)
  assert.match(plaski('dev-plan/SKILL.md'), /Pole `decyzje` \(zadanie, wiersz\) to decyzje poprzednich zadań, których nikt nie rozstrzygnął \(smoke pominięty albo przerwany\): wypisz każdą z odsyłaczem do `\/dev-smoke <zadanie>`; nie blokują\./)
})

// Punkt 52: opcje decyzji z autora smoke'u (2–3 warianty) nie pasowaly do trzech wyjsc, znacznik autopilot nie byl opisany,
// a skill obiecywal, ze plik decyzji czyta autopilot (czyta tylko `claude_md:`).
test('/dev-smoke sekcja 1: warianty jako „Popraw: <wariant>”, „Odłóż” przez Other przy trzech, znacznik autopilot, czytelnicy pliku decyzji', () => {
  const sekcja1 = SKILL_SMOKE.slice(SKILL_SMOKE.indexOf('## 1. Decyzje przed PR'), SKILL_SMOKE.indexOf('## 2. Kontrola poprawek')).replace(/\n\s*/g, ' ')
  assert.match(sekcja1, /Każdy wariant zmiany pokazujesz jako osobną odpowiedź „Popraw: <wariant>”, do tego „Zostaw jak jest” i „Odłóż”\./)
  assert.match(sekcja1, /`AskUserQuestion` ma najwyżej 4 opcje: przy trzech wariantach zmiany „Odłóż” się nie mieści — napisz w pytaniu, że operator wybiera je przez „Other”\./)
  assert.match(sekcja1, /\*\*Decyzja autopilota\*\* \(wiersz ze znacznikiem `\[DECYZJA · faza N · autopilot\]`\): wybór jest już w kodzie/)
  assert.match(sekcja1, /„Zostaw jak jest” = potwierdzenie wyboru autopilota \(zapis jak wyżej\); „Popraw” = przywrócenie źródła, które przegrało/)
  assert.match(sekcja1, /Ten plik czyta klasyfikator odrzuceń bota w `\/dev-pr` i etap uzgodnienia `CLAUDE\.md`/)
  assert.match(sekcja1, /Autopilot treści decyzji nie czyta \(z tego pliku bierze tylko pole `claude_md:`\)\./)
  assert.doesNotMatch(sekcja1, /czytają autopilot i klasyfikator/)
  // Znacznik w skillu ten sam co w wierszu decyzji autopilota (wierszDecyzji: `[DECYZJA · faza N · <zrodlo>]`).
  const autopilot = readFileSync(resolve(KATALOG, '../../../workflows/dev-autopilot-wf.js'), 'utf8')
  assert.match(autopilot, /return `- \[DECYZJA · faza \$\{faza\} · \$\{zrodlo\}\] \$\{tresc\}`/)
  assert.match(autopilot, /await zapiszDecyzje\(numerFazy, 'autopilot', /)
})

// Punkt 52: pole poDeployu nie mialo czytelnika — zdanie mowi teraz, ile otwartych pozycji czeka na wdrozenie.
// Dopisek z ukladu smoke'u w skillu archiwizacji musi trafiac w to, czego szuka liczSmoke: inaczej autor smoke'u pisze
// zgodnie z instrukcja, a licznik po deployu zostaje na 0 (vibersi audyt-paczki-1-2).
test('liczSmoke: przykladowa pozycja „(po deployu)” z ukladu smoke\'u w /dev-docs-complete liczy sie jako po deployu', () => {
  const skill = readFileSync(resolve(KATALOG, '../../../skills/dev-docs-complete/SKILL.md'), 'utf8')
  const przyklad = skill.split('\n').filter((l) => /^\s*- \[ \] \(po deployu\)/.test(l))
  assert.equal(przyklad.length, 1, 'uklad smoke\'u ma jedna przykladowa pozycje z dopiskiem')
  assert.deepEqual(liczSmoke(`## 5. Wdrozenie\n${przyklad[0]}\n- [ ] Lokalnie: klik → lista\n`), { otwarte: 2, poDeployu: 1, poDeployuLista: [przyklad[0].replace(/^\s*- \[ \] /, '')] })
})

test('zdanieOtwartych: pozycje po deployu w nawiasie, tylko gdy są; zdanie zaczyna się od „Otwarte: ”', () => {
  const odl = { otwarte: [] }
  assert.equal(zdanieOtwartych({ smoke: { otwarte: 3, poDeployu: 2 }, odlozone: odl }), 'Otwarte: 3 pozycji smoke\'u (w tym 2 po deployu), 0 odłożonych (docs/operator/odlozone.md).')
  assert.equal(zdanieOtwartych({ smoke: { otwarte: 3, poDeployu: 0 }, odlozone: odl }), 'Otwarte: 3 pozycji smoke\'u, 0 odłożonych (docs/operator/odlozone.md).')
  assert.equal(zdanieOtwartych({ smoke: { otwarte: 3 }, odlozone: odl }), 'Otwarte: 3 pozycji smoke\'u, 0 odłożonych (docs/operator/odlozone.md).', 'stary ksztalt bez pola')
})

// Punkt 62 (vibersi audyt-paczki-1-2): /dev-smoke przenosil pozycje czekajace na wdrozenie do odlozone.md z etykieta „po merge'u”,
// smoke pokazywal „0 otwartych”, a nikt nie mial ich potem odhaczyc. Zostaja otwarte, raport po merge'u je wypisuje.
test('pozycje po deployu: /dev-smoke zostawia je otwarte i ma tryb po wdrozeniu, /dev-pr wypisuje je po merge\'u', () => {
  const plaski = (/** @type {string} */ t) => t.replace(/\n\s*/g, ' ')
  const smoke = plaski(SKILL_SMOKE)
  assert.match(smoke, /nie jest sprawą odłożoną: przed PR jej nie wykonujesz i nie wpisujesz do `docs\/operator\/odlozone\.md`\. Zostaje `\[ \]`; bez dopisku „\(po deployu\)” w linii dopisz go\./)
  assert.match(smoke, /PR zadania już zmergowany \(`gh pr list --state merged --head feature\/<zadanie>` niepusty\) → \*\*tryb po wdrożeniu\*\*/)
  assert.match(smoke, /przechodzisz tylko otwarte pozycje z dopiskiem „\(po deployu\)”/)
  assert.match(smoke, /`docs\(<zadanie>\): smoke po wdrożeniu` na gałęzi głównej, push tylko po zgodzie operatora/)
  const pr = plaski(readFileSync(resolve(KATALOG, '../../../skills/dev-pr/SKILL.md'), 'utf8'))
  assert.match(pr, /Po wdrożeniu: <pole `smoke\.poDeployuLista` tego skryptu, jedna pozycja na wiersz; puste = „brak”>/)
  assert.match(pr, /„Następny krok: po wdrożeniu \/clear, potem \/dev-smoke <zadanie>”/)
})

test('liczSmoke: poDeployuLista bez znacznika checkboxa, odhaczone pozycje po deployu pomija', () => {
  const t = '- [ ] (po deployu) Migracje na dev → lista bez braków\n- [x] (po deployu) Coolify → OK\n  - [ ] Staging po deployu: logowanie → działa\n- [ ] Lokalnie → OK\n'
  assert.deepEqual(liczSmoke(t), { otwarte: 3, poDeployu: 2, poDeployuLista: ['(po deployu) Migracje na dev → lista bez braków', 'Staging po deployu: logowanie → działa'] })
})

test('punkt 67: /dev-smoke tłumaczy --bez-merge, /makieta przygotowuje stany z narzędzi programisty sam', () => {
  const plaski = (/** @type {string} */ t) => t.replace(/\n\s*/g, ' ')
  assert.match(plaski(SKILL_SMOKE), /`--bez-merge` znaczy, że PR i tury poprawek idą same, a zmiany wejdą do głównej wersji dopiero po „tak” operatora/)
  // Skill /makieta jest tylko w rdzeniu web; zbudowany wariant Expo go nie ma.
  const plikMakiety = resolve(KATALOG, '../../../skills/makieta/SKILL.md')
  if (!existsSync(plikMakiety)) return
  const makieta = plaski(readFileSync(plikMakiety, 'utf8'))
  assert.match(makieta, /Punkt, którego stan wymaga narzędzi programisty .* przygotowujesz sam, gdy operator dojdzie do tego punktu/)
})
