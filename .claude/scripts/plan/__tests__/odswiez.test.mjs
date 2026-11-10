// Odswiezenie pliku zadan po zmianie planu technicznego w trakcie zadania (znaleziska szablonu, punkt 34) na tymczasowym repo git.
//
// Uruchomienie:  node --test .claude/scripts/plan/__tests__/odswiez.test.mjs
//
// DLACZEGO: dashboard E2 (faza 6) — przeniesienie dwoch pozycji do innej jednostki wymagalo recznej edycji planu technicznego,
// pliku zadan i `.autopilot-state.json`, bo `generuj --nadpisz` odmawia przy zadaniu z przebiegiem, a pomylka w pliku stanu
// psula diff review. `plan.mjs odswiez` naklada na plik zadan sama roznice miedzy planem sprzed zmiany i obecnym: odhaczenia,
// sekcje dopisane przez run i linie zmienione przez testera zostaja, a stanu przebiegu skrypt nie rusza.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { roznica } from '../odswiez.mjs'
import { PROFIL } from '../../stack/profil.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '../plan.mjs')
// Fixture niesie sciezki seedow web (e2e/seeds/); katalog seedow z profilu stacku — test przechodzi na kazdym wariancie.
const FIXTURE = readFileSync(join(KATALOG, 'fixtures/plan-techniczny.md'), 'utf8').replaceAll('e2e/seeds/', `${PROFIL.e2e.katalogSeedow}/`)
const PLAN = 'docs/plans/2026-10-07-001-feat-publikacja-ofert-plan.md'
const ZADANIE = 'docs/active/publikacja-ofert'
const ZADANIA = `${ZADANIE}/publikacja-ofert-zadania.md`
const PLAN_ZADANIA = `${ZADANIE}/publikacja-ofert-plan.md`
const STAN = `${ZADANIE}/.autopilot-state.json`

const TEST_CUDZEJ = '- [Unit] publikacja cudzej oferty zwraca błąd uprawnień\n'
const WIERSZ_STATUSOW = '| Stwórz | `src/services/oferty-statusy.ts` | 0 → 15 | — | nowy |\n'
const KOTWICA_IU3_TESTY = '- [Unit] hook dla szkicu zwraca brak oferty\n'
const KOTWICA_IU3_PLIKI = '| Stwórz | `src/pages/oferta-publiczna.tsx` | 0 → 90 | — | nowy |\n'

/** @param {string} korzen @param {string[]} a */
const git = (korzen, a) => execFileSync('git', ['-C', korzen, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { stdio: 'pipe' })
/** @param {string} korzen @param {string} s @returns {string} */
const czytaj = (korzen, s) => readFileSync(join(korzen, s), 'utf8')
/** @param {string} korzen @param {string} s @param {(t: string) => string} f */
const zmien = (korzen, s, f) => writeFileSync(join(korzen, s), f(czytaj(korzen, s)))
/** @param {string} t @param {string} z @param {string} na @returns {string} podmiana, ktora musi trafic dokladnie raz */
function podmien(t, z, na) {
  assert.equal(t.split(z).length - 1, 1, `oczekiwano jednego wystapienia: ${z}`)
  return t.replace(z, na)
}

/** @param {string} korzen @param {string[]} a @returns {{ kod: number | null, wynik: any }} */
function cli(korzen, a) {
  const p = spawnSync('node', [CLI, ...a, '--projekt', korzen], { encoding: 'utf8' })
  return { kod: p.status, wynik: JSON.parse(p.stdout.trim().split('\n').pop() ?? '{}') }
}

/**
 * Repo z planem, wygenerowanym zadaniem i sladami przebiegu: faza 1 zbudowana, odhaczone pozycje IU-1, sekcja „Do poprawy”,
 * linia [E2E] IU-3 zmieniona przez testera na [Manual].
 * @param {import('node:test').TestContext} t
 * @returns {string}
 */
function repoZPrzebiegiem(t) {
  const korzen = mkdtempSync(join(tmpdir(), 'odswiez-'))
  t.after(() => rmSync(korzen, { recursive: true, force: true }))
  const pliki = {
    [PLAN]: FIXTURE,
    'docs/DESIGN.md': '#\n',
    'docs/brainstorms/2026-10-01-publikacja-ofert-requirements.md': '#\n',
    'docs/plans/publikacja-ofert-figma/SPEC.md': '#\n',
    'docs/plans/publikacja-ofert-figma/lista-ofert.png': 'png',
    'src/services/oferty-service.ts': 'const x = 1\n'.repeat(12),
    'src/features/oferty/components/lista-ofert.tsx': 'const x = 1\n'.repeat(8),
    'docs/operator/publikacja-ofert-przygotowanie.md': '# Przygotowanie\n\n- [x] Konto — **[blokuje: faza 1]**\n',
    '.env.e2e': 'X=1\n',
    ...Object.fromEntries((PROFIL.e2e.plikFlow ? ['publikacja-oferty', 'oferta-publiczna'] : []).map((f) => [PROFIL.e2e.plikFlow?.replace('<flow>', f) ?? '', 'appId: x\n'])),
  }
  for (const [s, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(korzen, s)), { recursive: true })
    writeFileSync(join(korzen, s), tresc)
  }
  writeFileSync(join(korzen, '.gitignore'), '.env.e2e\n')
  git(korzen, ['init', '-q', '-b', 'main'])
  const generuj = cli(korzen, ['generuj', PLAN, '--zapisz', '--data', '2026-11-10'])
  assert.equal(generuj.kod, 0, JSON.stringify(generuj.wynik))
  zmien(korzen, ZADANIA, (z) => {
    let w = podmien(z, '- [ ] Test: [Unit] publikacja cudzej oferty zwraca błąd uprawnień', '- [x] Test: [Unit] publikacja cudzej oferty zwraca błąd uprawnień')
    w = podmien(w, '- [ ] Stwórz: `src/services/oferty-service.ts`'.replace('Stwórz', 'Modyfikuj'), '- [x] Modyfikuj: `src/services/oferty-service.ts`')
    w = w.replace(/^- \[ \] Test: \[E2E\] `oferta-publiczna`.*$/m, '- [ ] [Manual] `oferta-publiczna` — tester: środowisko bez przeglądarki')
    return `${w}\n## Do poprawy po review fazy 1\n\n- [ ] [P2] brak limitu częstości publikacji\n`
  })
  writeFileSync(join(korzen, STAN), JSON.stringify({ wersja: 1, zadanie: 'publikacja-ofert', fazy: [
    { numer: 1, nazwa: 'Status i zapis', execute: 'done', review: 'done', fix: 'none', otwarteFindingi: [], baza: 'abc1234' },
    { numer: 2, nazwa: 'Przycisk na liście', execute: 'pending', review: 'pending', fix: 'none', otwarteFindingi: [] },
  ] }, null, 2))
  git(korzen, ['add', '-A'])
  git(korzen, ['commit', '-qm', 'zadanie z przebiegiem'])
  return korzen
}

/** Plan: test „cudzej oferty” i plik statusow przechodza z IU-1 (faza 1, zbudowana) do IU-3 (faza 2). @param {string} p @returns {string} */
function przeniesDoIu3(p) {
  let w = podmien(p, TEST_CUDZEJ, '')
  w = podmien(w, KOTWICA_IU3_TESTY, `${KOTWICA_IU3_TESTY}${TEST_CUDZEJ}`)
  w = podmien(w, WIERSZ_STATUSOW, '')
  return podmien(w, KOTWICA_IU3_PLIKI, `${KOTWICA_IU3_PLIKI}${WIERSZ_STATUSOW}`)
}

/** @param {string} zadania @param {string} id @returns {string} sekcja jednostki w pliku zadan */
function sekcja(zadania, id) {
  const start = zadania.indexOf(`### ${id}:`)
  assert.notEqual(start, -1, id)
  const reszta = zadania.slice(start + 4)
  const koniec = reszta.search(/^#{2,3} /m)
  return zadania.slice(start, koniec === -1 ? undefined : start + 4 + koniec)
}

test('roznica: wielozbiory — ta sama tresc dwa razy liczy sie osobno', () => {
  assert.deepEqual(roznica(['a', 'b', 'b'], ['b', 'c']), { usuniete: ['a', 'b'], dodane: ['c'] })
  assert.deepEqual(roznica(['a'], ['a']), { usuniete: [], dodane: [] })
})

test('odswiez (dashboard E2): pozycje przeniesione do innej jednostki zabieraja odhaczenie; slady przebiegu i stan zostaja', (t) => {
  const korzen = repoZPrzebiegiem(t)
  const stanPrzed = czytaj(korzen, STAN)
  const zadaniaPrzed = czytaj(korzen, ZADANIA)
  zmien(korzen, PLAN, przeniesDoIu3)

  // Bez --zapisz: lista zmian, plik bez zmian.
  const proba = cli(korzen, ['odswiez', ZADANIE])
  assert.equal(proba.kod, 0, JSON.stringify(proba.wynik))
  assert.deepEqual(proba.wynik.zapisane, [])
  assert.equal(czytaj(korzen, ZADANIA), zadaniaPrzed)
  assert.deepEqual(proba.wynik.zmiany.przeniesione, ['IU-3: Stwórz: `src/services/oferty-statusy.ts`', 'IU-3: Test: [Unit] publikacja cudzej oferty zwraca błąd uprawnień (odhaczona)'])
  assert.deepEqual(proba.wynik.zmiany.dodane, [])

  const zapis = cli(korzen, ['odswiez', ZADANIE, '--zapisz'])
  assert.equal(zapis.kod, 0, JSON.stringify(zapis.wynik))
  assert.deepEqual(zapis.wynik.zapisane, [ZADANIA])
  const po = czytaj(korzen, ZADANIA)
  const iu1 = sekcja(po, 'IU-1')
  const iu3 = sekcja(po, 'IU-3')
  assert.doesNotMatch(iu1, /oferty-statusy\.ts|publikacja cudzej oferty/)
  assert.match(iu1, /^- \[x\] Modyfikuj: `src\/services\/oferty-service\.ts`$/m, 'odhaczenie nietknietej linii zostaje')
  // Pozycje stoja w kolejnosci planu: plik za plikiem strony, test za testem hooka; odhaczenie przeszlo z testem.
  assert.match(iu3, /- \[ \] Stwórz: `src\/pages\/oferta-publiczna\.tsx`\n- \[ \] Stwórz: `src\/services\/oferty-statusy\.ts`\n/)
  assert.match(iu3, /- \[ \] Test: \[Unit\] hook dla szkicu zwraca brak oferty\n- \[x\] Test: \[Unit\] publikacja cudzej oferty zwraca błąd uprawnień\n/)
  // Linia zmieniona przez testera i sekcja dopisana przez review zostaja; stan przebiegu bez zmian.
  assert.match(iu3, /^- \[ \] \[Manual\] `oferta-publiczna` — tester: środowisko bez przeglądarki$/m)
  assert.match(po, /\n## Do poprawy po review fazy 1\n\n- \[ \] \[P2\] brak limitu częstości publikacji\n$/)
  assert.equal(czytaj(korzen, STAN), stanPrzed)
  assert.equal(po.split('\n').length, zadaniaPrzed.split('\n').length, 'przeniesienie nie zmienia liczby linii')
})

test('odswiez: nowa pozycja w zbudowanej fazie albo w jednostce z iuUkonczone = odmowa (nie zostalaby wykonana)', (t) => {
  const korzen = repoZPrzebiegiem(t)
  const plan = czytaj(korzen, PLAN)
  zmien(korzen, PLAN, (p) => podmien(p, TEST_CUDZEJ, `${TEST_CUDZEJ}- [Unit] publikacja opublikowanej oferty nic nie zmienia\n`))
  const zbudowana = cli(korzen, ['odswiez', ZADANIE, '--zapisz'])
  assert.equal(zbudowana.kod, 1)
  assert.match(zbudowana.wynik.odmowa, /^IU-1: faza 1 jest już zbudowana \(execute: done\), więc nowa pozycja „Test: \[Unit\] publikacja opublikowanej oferty nic nie zmienia” nie zostałaby wykonana/)
  assert.deepEqual(zbudowana.wynik.zapisane, [])

  writeFileSync(join(korzen, PLAN), plan)
  zmien(korzen, STAN, (s) => s.replace('"execute": "pending"', '"execute": "pending", "iuUkonczone": ["IU-2"]'))
  zmien(korzen, PLAN, (p) => podmien(p, '- [Unit] przycisk „Publikuj” jest tylko przy szkicu\n', '- [Unit] przycisk „Publikuj” jest tylko przy szkicu\n- [Unit] przycisk blokuje się na czas zapisu\n'))
  const ukonczona = cli(korzen, ['odswiez', ZADANIE, '--zapisz'])
  assert.equal(ukonczona.kod, 1)
  assert.match(ukonczona.wynik.odmowa, /^IU-2: jednostka jest już zapisana commitem \(iuUkonczone\)/)
})

test('odswiez: linia zmieniona przez przebieg, ktora plan usuwa = konflikt i zaden zapis', (t) => {
  const korzen = repoZPrzebiegiem(t)
  const przed = czytaj(korzen, ZADANIA)
  zmien(korzen, PLAN, (p) => p.replace(/^- \[E2E\] `oferta-publiczna`.*\n/m, ''))
  const { kod, wynik } = cli(korzen, ['odswiez', ZADANIE, '--zapisz'])
  assert.equal(kod, 1)
  assert.equal(wynik.konflikty.length, 1)
  assert.match(wynik.konflikty[0], /^IU-3: nie ma w pliku zadań linii „Test: \[E2E\] `oferta-publiczna`/)
  assert.match(wynik.odmowa, /nic nie zapisano/)
  assert.equal(czytaj(korzen, ZADANIA), przed)
})

test('odswiez: nowa jednostka w niezbudowanej fazie dostaje sekcje za poprzednia i wiersz w tabeli faz planu zadania', (t) => {
  const korzen = repoZPrzebiegiem(t)
  const blokIu3 = FIXTURE.slice(FIXTURE.indexOf('- [ ] **IU-3:'), FIXTURE.indexOf('## Ryzyka i zależności'))
  const blokIu4 = blokIu3.replace('IU-3: Adres publiczny oferty', 'IU-4: Licznik odsłon oferty').replaceAll('oferta-publiczna', 'licznik-odslon')
    .replace(/^- \[E2E\].*\n/m, '').replace('feature-builder-fullstack', 'feature-builder-data').replace('**Makiety:** —\n\n', '')
  zmien(korzen, PLAN, (p) => podmien(p, '## Ryzyka i zależności', `${blokIu4}## Ryzyka i zależności`))
  const { kod, wynik } = cli(korzen, ['odswiez', ZADANIE, '--zapisz'])
  assert.equal(kod, 0, JSON.stringify(wynik))
  assert.deepEqual(wynik.zmiany.noweIu, ['IU-4'])
  assert.deepEqual(wynik.zmiany.tabelaFaz, [2])
  assert.deepEqual(wynik.zapisane.sort(), [PLAN_ZADANIA, ZADANIA].sort())
  const po = czytaj(korzen, ZADANIA)
  assert.ok(po.indexOf('### IU-3:') < po.indexOf('### IU-4: Licznik odsłon oferty (feature-builder-data)'), 'za IU-3')
  assert.ok(po.indexOf('### IU-4:') < po.indexOf('## Operator checklist faza 2'), 'przed sekcja operatora fazy')
  assert.match(sekcja(po, 'IU-4'), /- \[ \] Stwórz: `src\/pages\/licznik-odslon\.tsx`\n/)
  assert.match(czytaj(korzen, PLAN_ZADANIA), /^\| 2 \| Przycisk na liście \| IU-2, IU-3, IU-4 \| Faza 1 \| feature-builder-ui, feature-builder-fullstack, feature-builder-data \|$/m)
})

test('odswiez: pozycja operatora przeniesiona do innej jednostki zmienia dopisek jednostki i zachowuje odhaczenie', (t) => {
  const korzen = repoZPrzebiegiem(t)
  zmien(korzen, ZADANIA, (z) => podmien(z, '- [ ] Operator: Projektant akceptuje wygląd przycisku na liście (IU-2)', '- [x] Operator: Projektant akceptuje wygląd przycisku na liście (IU-2)'))
  zmien(korzen, PLAN, (p) => {
    const bez = podmien(p, '**Operator checklist:**\n- [ ] Projektant akceptuje wygląd przycisku na liście\n\n', '')
    return podmien(bez, '## Ryzyka i zależności', '**Operator checklist:**\n- [ ] Projektant akceptuje wygląd przycisku na liście\n\n## Ryzyka i zależności')
  })
  const { kod, wynik } = cli(korzen, ['odswiez', ZADANIE, '--zapisz'])
  assert.equal(kod, 0, JSON.stringify(wynik))
  const po = czytaj(korzen, ZADANIA)
  assert.match(po, /^- \[x\] Operator: Projektant akceptuje wygląd przycisku na liście \(IU-3\)$/m)
  assert.doesNotMatch(po, /przycisku na liście \(IU-2\)/)
})

test('odswiez: plan bez zmian wzgledem HEAD = odmowa z --od; zmiana juz w commicie przechodzi z --od; zmiana faz i zly plan = odmowa', (t) => {
  const korzen = repoZPrzebiegiem(t)
  const bezZmian = cli(korzen, ['odswiez', ZADANIE])
  assert.equal(bezZmian.kod, 1)
  assert.match(bezZmian.wynik.odmowa, /^plan względem HEAD nie zmienia pliku zadań — gdy zmiana planu jest już w commicie, podaj --od <commit sprzed zmiany>/)

  zmien(korzen, PLAN, przeniesDoIu3)
  git(korzen, ['commit', '-qam', 'decyzja operatora w planie'])
  assert.equal(cli(korzen, ['odswiez', ZADANIE]).kod, 1, 'HEAD ma juz zmiane')
  const zOd = cli(korzen, ['odswiez', ZADANIE, '--od', 'HEAD~1', '--zapisz'])
  assert.equal(zOd.kod, 0, JSON.stringify(zOd.wynik))
  assert.equal(zOd.wynik.od, 'HEAD~1')
  assert.equal(zOd.wynik.zmiany.przeniesione.length, 2)
  assert.match(cli(korzen, ['odswiez', ZADANIE, '--od', 'nie-ma-takiej']).wynik.odmowa, /^git nie ma planu .* w rewizji nie-ma-takiej/)

  zmien(korzen, PLAN, (p) => podmien(p, '### Faza 2 — Przycisk na liście', '### Faza 2 — Publikacja z listy'))
  assert.match(cli(korzen, ['odswiez', ZADANIE]).wynik.odmowa, /^zmiana zmienia fazy/)
  zmien(korzen, PLAN, (p) => podmien(p, '### Faza 2 — Publikacja z listy', '### Faza 2 — Przycisk na liście').replace('**Delegate to:** feature-builder-data', '**Delegate to:** nie-ma-takiego'))
  const zly = cli(korzen, ['odswiez', ZADANIE])
  assert.equal(zly.kod, 1)
  assert.match(zly.wynik.odmowa, /^plan po zmianie nie przechodzi walidacji/)
  assert.ok(zly.wynik.bledy.length > 0)
})

test('skill /dev-plan: zmiana planu po starcie idzie przez odswiez, stanu przebiegu nikt nie edytuje', () => {
  const skill = readFileSync(resolve(KATALOG, '../../../skills/dev-plan/SKILL.md'), 'utf8')
  const wznowienie = skill.split('\n').find((l) => l.startsWith('- Istnieje `docs/active/<zadanie>/` → to wznowienie zadania.'))
  assert.ok(wznowienie, 'punkt o wznowieniu w 0.1')
  assert.match(wznowienie, /przenosisz do pliku zadań przez `node \.claude\/scripts\/plan\/plan\.mjs odswiez docs\/active\/<zadanie>`: najpierw bez `--zapisz` \(lista zmian\), potem z `--zapisz`/)
  assert.match(wznowienie, /`--od <commit sprzed zmiany>`, gdy zmiana planu jest już w commicie/)
  assert.match(wznowienie, /`\.autopilot-state\.json` nie edytujesz ani ty, ani skrypt\./)
  assert.match(skill, /odmowa z powodu przebiegu \(stan autopilota, raport review, odhaczone pozycje, wpisy dziennika\) → zmiana planu idzie przez `plan\.mjs odswiez` \(0\.1\)/)
})

test('generuj --nadpisz przy zadaniu z przebiegiem wskazuje odswiez; uzycie CLI wymienia polecenie', (t) => {
  const korzen = repoZPrzebiegiem(t)
  const { kod, wynik } = cli(korzen, ['generuj', PLAN, '--zapisz', '--nadpisz'])
  assert.equal(kod, 1)
  assert.match(wynik.odmowa, /zmianę planu po starcie przenosi `plan\.mjs odswiez <katalog zadania>`/)
  const uzycie = spawnSync('node', [CLI, 'nieznane', 'x', '--projekt', korzen], { encoding: 'utf8' })
  assert.equal(uzycie.status, 2)
  assert.match(uzycie.stderr, /odswiez <docs\/active\/zadanie> \[--od <rewizja>\] \[--zapisz\]/)
})
