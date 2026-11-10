// Tryb recenzji PR projektu (znaleziska szablonu, punkt 39, czesc 2): wybor „bez bota” zapisany w .claude/projekt.json.
//
// Uruchomienie:  node --test .claude/scripts/pr/__tests__/tryb-recenzji.test.mjs
//
// DLACZEGO: CodeRabbit jest opcjonalny (decyzja operatora 2026-11-08). Sama flaga /dev-pr --bez-bota nie wystarcza: /dev-plan
// i archiwizacja licza prog 150 plikow recenzji bota duzo wczesniej niz /dev-pr, a bez .coderabbit.yaml liczenie szlo bez
// filtrow, wiec prog robil sie ostrzejszy (docs/, .claude/, lockfile w liczbie). Wybor zapisuje operator raz, w pliku projektu,
// ktorego szablon nie dostarcza (sync go nie nadpisuje).

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { PLIK_USTAWIEN, projektBezBota, trybRecenzji, ustawTrybRecenzji } from '../tryb-recenzji.mjs'
import { FILTRY_BEZ_BOTA, filtrySciezek, PROG_PLIKOW_PR } from '../rozmiar.mjs'
import { rozmiarPlanu, sprawdzCzesci } from '../../plan/czesci-pr.mjs'
import { parsujPlan } from '../../plan/plan-techniczny.mjs'
import { konfiguracjaCodeRabbit } from '../../doctor/higiena.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(KATALOG, '../../../..')
const CLI = resolve(KATALOG, '../tryb-recenzji.mjs')
const CLI_ROZMIARU = resolve(KATALOG, '../rozmiar.mjs')
const BEZ_BOTA = '{\n  "recenzjaPr": "bez-bota"\n}\n'

/** @param {Record<string, string>} pliki @param {(korzen: string) => void} f */
function wProjekcie(pliki, f) {
  const korzen = mkdtempSync(join(tmpdir(), 'tryb-recenzji-'))
  try {
    for (const [s, t] of Object.entries(pliki)) {
      mkdirSync(dirname(join(korzen, s)), { recursive: true })
      writeFileSync(join(korzen, s), t)
    }
    f(korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

/** @param {number[]} fazy liczba plikow .sql w kazdej fazie @param {string} [czesci] @returns {string} plan z jedna IU na faze */
function plan(fazy, czesci) {
  const iu = fazy.map((n, i) => `### Faza ${i + 1} — F${i + 1}\n\n**Zależy od:** Brak\n\n- [ ] **IU-${i + 1}: J${i + 1}**\n\n**Pliki:**\n\n`
    + '| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |\n|---|---|---|---|---|\n'
    + Array.from({ length: n }, (_, p) => `| Stwórz | \`src/f${i + 1}/p${p}.sql\` | 0 → 10 | — | nowy |`).join('\n') + '\n\n**Delegate to:** feature-builder-data\n')
  return `# Plan\n\n${czesci === undefined ? '' : `## Części PR\n\n${czesci}\n\n`}## Implementation Units\n\n${iu.join('\n')}`
}

test('trybRecenzji: brak pliku, brak pola, zly JSON i zla wartosc daja „bot” (bramki bota zostaja); „bez-bota” tylko z jawnego zapisu', () => {
  wProjekcie({}, (k) => assert.deepEqual(trybRecenzji(k), { recenzjaPr: 'bot', plik: false, konfigBota: false, blad: null }))
  wProjekcie({ [PLIK_USTAWIEN]: '{ "inne": 1 }', '.coderabbit.yaml': 'reviews:\n' }, (k) => assert.deepEqual(trybRecenzji(k), { recenzjaPr: 'bot', plik: true, konfigBota: true, blad: null }))
  wProjekcie({ [PLIK_USTAWIEN]: BEZ_BOTA }, (k) => {
    assert.deepEqual(trybRecenzji(k), { recenzjaPr: 'bez-bota', plik: true, konfigBota: false, blad: null })
    assert.equal(projektBezBota(k), true)
  })
  wProjekcie({ [PLIK_USTAWIEN]: '{ recenzjaPr: bez-bota' }, (k) => {
    assert.equal(trybRecenzji(k).recenzjaPr, 'bot')
    assert.match(trybRecenzji(k).blad ?? '', /^\.claude\/projekt\.json: /)
    assert.equal(projektBezBota(k), false)
  })
  wProjekcie({ [PLIK_USTAWIEN]: '{ "recenzjaPr": "brak" }' }, (k) => assert.equal(trybRecenzji(k).blad, '.claude/projekt.json: recenzjaPr = "brak" — dozwolone: bot, bez-bota'))
  wProjekcie({ [PLIK_USTAWIEN]: '[]' }, (k) => assert.equal(trybRecenzji(k).blad, '.claude/projekt.json: oczekiwany obiekt JSON'))
})

test('ustawTrybRecenzji i CLI: zapis zachowuje inne pola, nieczytelnego pliku nie nadpisuje; zly argument = kod 2', () => {
  wProjekcie({ [PLIK_USTAWIEN]: '{ "inne": 1 }' }, (k) => {
    assert.equal(ustawTrybRecenzji(k, 'bez-bota').recenzjaPr, 'bez-bota')
    assert.deepEqual(JSON.parse(readFileSync(join(k, PLIK_USTAWIEN), 'utf8')), { inne: 1, recenzjaPr: 'bez-bota' })
  })
  wProjekcie({ [PLIK_USTAWIEN]: 'popsuty' }, (k) => {
    assert.match(ustawTrybRecenzji(k, 'bez-bota').blad ?? '', /popraw plik ręcznie, nie nadpisuję go$/)
    assert.equal(readFileSync(join(k, PLIK_USTAWIEN), 'utf8'), 'popsuty')
  })
  wProjekcie({}, (k) => {
    const cli = (/** @type {string[]} */ ...a) => spawnSync(process.execPath, [CLI, '--projekt', k, ...a], { encoding: 'utf8' })
    assert.deepEqual(JSON.parse(cli().stdout), { recenzjaPr: 'bot', plik: false, konfigBota: false, blad: null, plikUstawien: PLIK_USTAWIEN })
    const zapis = cli('--ustaw', 'bez-bota')
    assert.equal(zapis.status, 0)
    assert.equal(JSON.parse(zapis.stdout).recenzjaPr, 'bez-bota')
    assert.equal(readFileSync(join(k, PLIK_USTAWIEN), 'utf8'), BEZ_BOTA)
    assert.equal(JSON.parse(cli('--ustaw', 'bot').stdout).recenzjaPr, 'bot')
    assert.equal(cli('--ustaw', 'moze').status, 2)
  })
})

test('szablon nie dostarcza .claude/projekt.json (sync nie moze nadpisac wyboru projektu); filtry bez bota = path_filters szablonu configu', () => {
  assert.equal(existsSync(join(REPO, PLIK_USTAWIEN)), false, 'rdzen')
  assert.equal(existsSync(join(REPO, 'stacks/expo/nakladka', PLIK_USTAWIEN)), false, 'nakladka Expo')
  const szablon = readFileSync(join(REPO, '.claude/skills/coderabbit-setup/templates/coderabbit-base.yaml'), 'utf8')
  assert.deepEqual(FILTRY_BEZ_BOTA, filtrySciezek(szablon))
})

test('plan powyzej progu: z botem blad i sekcja „Części PR”; projekt bez bota = uwaga, liczenie z wykluczeniami domyslnymi', () => {
  const duzy = plan([100, 100])
  wProjekcie({}, (k) => {
    const w = sprawdzCzesci(parsujPlan(duzy), k)
    assert.equal(w.bledy.length, 1)
    assert.match(w.bledy[0], /^plan ma ~200 plików do recenzji bota .* > 150 — sekcja „## Części PR”/)
  })
  wProjekcie({ [PLIK_USTAWIEN]: BEZ_BOTA }, (k) => {
    const w = sprawdzCzesci(parsujPlan(duzy), k)
    assert.deepEqual(w.bledy, [])
    assert.equal(w.uwagi.length, 1)
    assert.match(w.uwagi[0], /^plan ma ~200 plików \(tabele plików IU \+ test obok pliku kodu\) — projekt bez bota recenzji \(\.claude\/projekt\.json\), próg 150 plików jego recenzji nie obowiązuje/)
    // Faza sama powyzej progu tez nie jest bledem; ponizej progu bez uwagi.
    assert.deepEqual(sprawdzCzesci(parsujPlan(plan([PROG_PLIKOW_PR + 20])), k).bledy, [])
    assert.deepEqual(sprawdzCzesci(parsujPlan(plan([10, 10])), k), { bledy: [], uwagi: [] })
    // Sekcja czesci z planu (np. wdrozenie etapami): rozmiar czesci nie jest bledem, uklad faz nadal jest sprawdzany.
    assert.deepEqual(sprawdzCzesci(parsujPlan(plan([160, 40], '| Część | Fazy |\n|---|---|\n| 1 | 1 |\n| 2 | 2 |')), k).bledy, [])
    assert.match(sprawdzCzesci(parsujPlan(plan([160, 40], '| Część | Fazy |\n|---|---|\n| 1 | 1 |')), k).bledy.join('\n'), /pokrywają fazy 1–2 po kolei/)
  })
  const zDocs = '# Plan\n\n## Implementation Units\n\n### Faza 1 — F\n\n**Zależy od:** Brak\n\n- [ ] **IU-1: J**\n\n**Pliki:**\n\n| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |\n|---|---|---|---|---|\n'
    + '| Stwórz | `docs/x.md` | 0 → 10 | — | nowy |\n| Stwórz | `.claude/skills/x/SKILL.md` | 0 → 10 | — | nowy |\n| Stwórz | `supabase/m.sql` | 0 → 10 | — | nowy |\n\n**Delegate to:** feature-builder-data\n'
  wProjekcie({}, (k) => assert.equal(rozmiarPlanu(parsujPlan(zDocs), k).szacunek, 3, 'z botem bez configu: bez filtrow, jak bot'))
  wProjekcie({ [PLIK_USTAWIEN]: BEZ_BOTA }, (k) => assert.equal(rozmiarPlanu(parsujPlan(zDocs), k).szacunek, 1, 'bez bota: docs/ i .claude/ poza liczba'))
})

test('rozmiar.mjs: projekt bez bota i bez .coderabbit.yaml liczy z wykluczeniami domyslnymi; z botem bez pliku — bez filtrow', () => {
  const repo = mkdtempSync(join(tmpdir(), 'tryb-recenzji-rozmiar-'))
  const git = (/** @type {string[]} */ ...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' })
  const zapisz = (/** @type {string} */ s, /** @type {string} */ t) => {
    mkdirSync(dirname(join(repo, s)), { recursive: true })
    writeFileSync(join(repo, s), t)
  }
  try {
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 't@x.pl')
    git('config', 'user.name', 't')
    zapisz('src/a.ts', 'export const a = 1\n')
    git('add', '-A')
    git('commit', '-qm', 'start')
    git('switch', '-qc', 'feature/x')
    zapisz('src/b.ts', 'export const b = 2\n')
    zapisz('docs/plan.md', '# plan\n')
    zapisz('.claude/skills/x/SKILL.md', '# x\n')
    zapisz('pnpm.lock', 'x\n')
    git('add', '-A')
    git('commit', '-qm', 'zmiany')
    const licz = () => JSON.parse(spawnSync(process.execPath, [CLI_ROZMIARU, '--projekt', repo], { encoding: 'utf8' }).stdout)
    assert.deepEqual([licz().doRecenzji, licz().filtry], [4, 0])
    zapisz(PLIK_USTAWIEN, BEZ_BOTA)
    const bez = licz()
    assert.deepEqual([bez.doRecenzji, bez.pliki, bez.filtry], [1, ['src/b.ts'], FILTRY_BEZ_BOTA.length])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('doctor: projekt bez bota = „nie dotyczy”; sprzecznosc z .coderabbit.yaml i nieczytelny plik ustawien = UWAGA', () => {
  wProjekcie({ [PLIK_USTAWIEN]: BEZ_BOTA }, (k) => {
    assert.deepEqual(konfiguracjaCodeRabbit(k), { element: 'CodeRabbit', stan: 'nie dotyczy', szczegol: 'projekt bez bota recenzji (.claude/projekt.json)', instalacja: '—' })
  })
  wProjekcie({ [PLIK_USTAWIEN]: BEZ_BOTA, '.coderabbit.yaml': 'reviews:\n' }, (k) => {
    const w = konfiguracjaCodeRabbit(k)
    assert.equal(w.stan, 'UWAGA')
    assert.match(w.szczegol, /mowi „bez bota”, a \.coderabbit\.yaml istnieje/)
    assert.match(w.instalacja, /tryb-recenzji\.mjs --ustaw bot albo usun \.coderabbit\.yaml/)
  })
  wProjekcie({ [PLIK_USTAWIEN]: 'popsuty' }, (k) => assert.equal(konfiguracjaCodeRabbit(k).stan, 'UWAGA'))
  wProjekcie({}, (k) => {
    const w = konfiguracjaCodeRabbit(k)
    assert.deepEqual([w.stan, w.instalacja], ['UWAGA', '/coderabbit-setup'])
    assert.match(w.szczegol, /bot recenzji PR jest opcjonalny: z botem \/coderabbit-setup, bez bota \/dev-pr --bez-bota/)
  })
})

test('archiwizacja (complete-wf): wynik czesci.mjs z bezBota nie daje uwagi o progu; z botem uwaga zostaje', () => {
  const complete = readFileSync(join(REPO, '.claude/workflows/dev-docs-complete-wf.js'), 'utf8')
  const archiwum = complete.slice(complete.indexOf('// ── Archiwum (P4)'), complete.indexOf('// ── Koniec archiwum'))
  // eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
  const { czesciPr } = new Function(`${archiwum}\nreturn { czesciPr }`)()
  const jedna = { ok: true, zrodlo: 'jedna', uwaga: null, czesci: [{ czesc: 1, fazy: '1–4', od: 'a', do: 'b', doRecenzji: 210 }] }
  assert.match(czesciPr(jedna, 'z').uwaga, /^UWAGA: PR powyżej progu 150 plików do recenzji bota/)
  assert.deepEqual(czesciPr({ ...jedna, bezBota: true }, 'z'), { uwaga: null, sekcja: null })
  const dwie = { ok: true, zrodlo: 'plan', uwaga: null, bezBota: true, czesci: [{ czesc: 1, fazy: '1–2', od: 'a'.repeat(40), do: 'b'.repeat(40), doRecenzji: 180 }, { czesc: 2, fazy: '3–4', od: 'b'.repeat(40), do: 'c'.repeat(40), doRecenzji: 30 }] }
  const w = czesciPr(dwie, 'z')
  assert.match(w.sekcja, /^PR w 2 częściach \(cięcie: sekcja „Części PR” planu; projekt bez bota recenzji, liczba plików informacyjnie\)\./)
  assert.doesNotMatch(w.uwaga, /^UWAGA/)
})

test('skille: /dev-pr czyta i zapisuje wybor, /dev-prep pyta o recenzje PR, /dev-plan i archiwizacja znaja projekt bez bota', () => {
  const skill = (/** @type {string} */ nazwa) => readFileSync(join(REPO, `.claude/skills/${nazwa}/SKILL.md`), 'utf8')
  const pr = skill('dev-pr')
  const tryb = pr.slice(pr.indexOf('## Tryb bez bota'), pr.indexOf('## Przebieg'))
  assert.match(tryb, /zapis w pliku projektu \(`node \.claude\/scripts\/pr\/tryb-recenzji\.mjs` zwraca\n\s+`recenzjaPr: "bez-bota"` — sprawdzasz to przed krokiem 1 w każdym wywołaniu\)/)
  assert.match(tryb, /\*\*Zapis wyboru\.\*\* Po odpowiedzi „Projekt bez bota recenzji”: `node \.claude\/scripts\/pr\/tryb-recenzji\.mjs --ustaw bez-bota`/)
  assert.match(tryb, /commit tego pliku jawną ścieżką\n\s+na `feature\/<zadanie>` i znów krok 1/)
  assert.match(tryb, /Pole `blad` w wyniku skryptu pokazujesz operatorowi i idziesz\n\s+trybem z botem\./)
  assert.doesNotMatch(pr, /kolejne wywołania wymagają `--bez-bota`/)
  const prep = skill('dev-prep')
  const decyzja = prep.split('\n').find((l) => l.startsWith('**Recenzja pull requestów.**'))
  assert.ok(decyzja, 'decyzja o recenzji PR w /dev-prep 2.1')
  assert.match(decyzja, /zwraca `plik: false` \(wybór jeszcze nie padł\)/)
  assert.match(decyzja, /B\) bez bota — `node \.claude\/scripts\/pr\/tryb-recenzji\.mjs --ustaw bez-bota` i commit pliku `\.claude\/projekt\.json`/)
  assert.match(skill('dev-plan'), /Projekt bez bota recenzji \(`\.claude\/projekt\.json`: `recenzjaPr: "bez-bota"`.*`sprawdz` daje przy szacunku powyżej 150 uwagę zamiast błędu/)
  assert.match(skill('dev-docs-complete'), /projekt bez bota recenzji wg `\.claude\/projekt\.json`: `bezBota: true`, próg nie tnie PR, części tylko z planu/)
  assert.match(skill('coderabbit-setup'), /`recenzjaPr: "bez-bota"` znaczy, że operator zapisał wcześniej wybór „projekt bez bota recenzji”/)
  assert.match(skill('sync-template'), /projekt bez niego zapisuje wybór w `\.claude\/projekt\.json`, którego sync nie rusza/)
})
