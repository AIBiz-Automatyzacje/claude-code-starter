// Makiety jednostki i SPEC per ekran (P21 B2, HANDOFF 6a pkt 86 e i h).
//
// Uruchomienie:  node --test .claude/scripts/plan/__tests__/makiety.test.mjs
//
// Vibersi etap 3: agent SPEC Figmy na 23 ekrany = 81 tur, kontekst 414k, 2,26 M (odpowiedzi get_design_context ze zrzutami);
// builderzy czytali caly SPEC.md (47 KB) i 3–8 zrzutow. Od P21: pobranie w 2–3 czesciach bez zrzutow w kontekscie, SPEC
// per ekran (`ekrany/<nazwa>.md`), pole IU `Makiety` i blok designerski liczony skryptem — builder dostaje tylko swoje ekrany.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { blokDesignerski, sprawdzMakiety } from '../makiety.mjs'
import { parsujPlan } from '../plan-techniczny.mjs'
import { sprawdzPlan } from '../walidacja-planu.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '../plan.mjs')
const FOLDER = 'docs/plans/x-figma'
const FM = `design_md: ./docs/DESIGN.md\nfigma_spec: ./${FOLDER}/SPEC.md\nfigma_screens:\n  logowanie: ./${FOLDER}/logowanie.png\n  rejestracja: ./${FOLDER}/rejestracja.png\noperator_prep: null`

/** @param {string} id @param {string} delegate @param {string | null} makiety @returns {string} */
const iu = (id, delegate, makiety) => `- [ ] **${id}: Jednostka**\n\n**Cel:** c\n\n**Delegate to:** ${delegate}\n${makiety === null ? '' : `\n**Makiety:** ${makiety}\n`}`

/** @param {string} cialo @param {string} [fm] */
const plan = (cialo, fm = FM) => parsujPlan(`---\n${fm}\n---\n\n# P\n\n### Faza 1 — F\n\n**Zależy od:** Brak\n\n${cialo}`)

/** @param {ReturnType<typeof parsujPlan>} p @param {string} id */
const jednostka = (p, id) => {
  const j = p.fazy.flatMap((f) => f.iu).find((x) => x.id === id)
  assert.ok(j, id)
  return j
}

/** @param {Record<string, string>} pliki @returns {string} */
function projekt(pliki) {
  const korzen = mkdtempSync(join(tmpdir(), 'makiety-'))
  for (const [s, t] of Object.entries(pliki)) {
    mkdirSync(dirname(join(korzen, s)), { recursive: true })
    writeFileSync(join(korzen, s), t)
  }
  return korzen
}

test('pole Makiety: backticki, lista bez backtickow, „—” = zero ekranow, brak pola, puste pole i placeholder = null', () => {
  const p = plan([iu('IU-1', 'feature-builder-ui', '`logowanie`, `rejestracja`'), iu('IU-2', 'feature-builder-ui', 'logowanie, rejestracja'),
    iu('IU-3', 'feature-builder-ui', '—'), iu('IU-4', 'feature-builder-ui', null), iu('IU-5', 'feature-builder-ui', ''),
    iu('IU-6', 'feature-builder-ui', '*(brak)*')].join('\n'))
  assert.equal(jednostka(p, 'IU-5').makiety, null, 'puste pole nie jest jawnym „zero ekranow”')
  const wiele = plan([iu('IU-7', 'feature-builder-ui', '\n- logowanie\n- rejestracja'), iu('IU-8', 'feature-builder-ui', 'logowanie rejestracja')].join('\n'))
  assert.deepEqual(jednostka(wiele, 'IU-7').makiety, ['logowanie', 'rejestracja'], 'lista wieloliniowa bez backtickow')
  assert.deepEqual(jednostka(wiele, 'IU-8').makiety, ['logowanie', 'rejestracja'], 'separator spacja')
  assert.equal(jednostka(p, 'IU-6').makiety, null)
  assert.deepEqual(jednostka(p, 'IU-1').makiety, ['logowanie', 'rejestracja'])
  assert.deepEqual(jednostka(p, 'IU-2').makiety, ['logowanie', 'rejestracja'])
  assert.deepEqual(jednostka(p, 'IU-3').makiety, [])
  assert.equal(jednostka(p, 'IU-4').makiety, null)
})

test('sprawdzMakiety: ekran spoza figma_screens = blad; UI bez pola = uwaga; data bez pola i UI z „—” = nic; pole bez makiet = blad', () => {
  const p = plan([iu('IU-1', 'feature-builder-ui-figma', '`logowanie`, `reset`'), iu('IU-2', 'feature-builder-fullstack', null),
    iu('IU-3', 'feature-builder-data', null), iu('IU-4', 'feature-builder-ui', '—')].join('\n'))
  const w = sprawdzMakiety(p, p.fazy.flatMap((f) => f.iu), tmpdir())
  assert.deepEqual(w.bledy, ['IU-1: Makiety reset — brak w figma_screens (dozwolone: logowanie, rejestracja)'])
  assert.deepEqual(w.uwagi.map((u) => u.split(':')[0]), ['IU-2'])
  const bez = plan([iu('IU-1', 'feature-builder-ui', '`logowanie`'), iu('IU-2', 'feature-builder-ui', '—')].join('\n'),
    'design_md: null\nfigma_spec: null\nfigma_screens: {}\noperator_prep: null')
  assert.deepEqual(sprawdzMakiety(bez, bez.fazy.flatMap((f) => f.iu), tmpdir()).bledy,
    ['IU-1: pole Makiety, a frontmatter nie ma figma_screens — usuń pole albo dodaj makiety'], '„—” bez makiet nie jest bledem; nazwa nie jest „obca”')
})

test('blokDesignerski: SPEC per ekran — builder dostaje naglowek SPEC, SPEC i PNG tylko swoich ekranow', (t) => {
  const korzen = projekt({ [`${FOLDER}/SPEC.md`]: '#', [`${FOLDER}/ekrany/logowanie.md`]: '#', [`${FOLDER}/ekrany/rejestracja.md`]: '#' })
  t.after(() => rmSync(korzen, { recursive: true, force: true }))
  const p = plan([iu('IU-1', 'feature-builder-ui-figma', '`logowanie`'), iu('IU-2', 'feature-builder-fullstack', '—')].join('\n'))
  const b = blokDesignerski(p, jednostka(p, 'IU-1'), korzen)
  assert.match(b.tresc, /^## Mandatory designerski kontekst \(przeczytaj przed implementacja\)/)
  assert.match(b.tresc, /SPEC ekranow innych jednostek nie czytasz\): docs\/plans\/x-figma\/SPEC\.md/)
  assert.match(b.tresc, /\n {2}- docs\/plans\/x-figma\/ekrany\/logowanie\.md/)
  assert.match(b.tresc, /\n {2}- logowanie: docs\/plans\/x-figma\/logowanie\.png/)
  assert.doesNotMatch(b.tresc, /rejestracja/)
  assert.deepEqual([b.ekrany, b.specEkranow], [['logowanie'], ['docs/plans/x-figma/ekrany/logowanie.md']])
  const zero = blokDesignerski(p, jednostka(p, 'IU-2'), korzen)
  assert.doesNotMatch(zero.tresc, /\.png|ekrany\//, '„—” = bez zrzutow i bez SPEC ekranow')
  assert.match(zero.tresc, /SPEC\.md \(naglowek, tokeny i rozjazdy/)
})

test('blokDesignerski: bez pola Makiety albo SPEC sprzed podzialu — caly SPEC; builder danych — bez bloku', (t) => {
  const korzen = projekt({ [`${FOLDER}/SPEC.md`]: '#' })
  t.after(() => rmSync(korzen, { recursive: true, force: true }))
  const p = plan([iu('IU-1', 'feature-builder-ui', null), iu('IU-2', 'feature-builder-ui', '`rejestracja`'), iu('IU-3', 'feature-builder-data', null)].join('\n'))
  const bezPola = blokDesignerski(p, jednostka(p, 'IU-1'), korzen)
  assert.match(bezPola.tresc, /SPEC\.md \(pomiary tej funkcji z Figmy\): docs\/plans\/x-figma\/SPEC\.md/)
  assert.deepEqual(bezPola.ekrany, ['logowanie', 'rejestracja'])
  const staryspec = blokDesignerski(p, jednostka(p, 'IU-2'), korzen)
  assert.match(staryspec.tresc, /pomiary tej funkcji z Figmy/, 'brak katalogu ekrany/ = caly SPEC')
  assert.deepEqual([staryspec.ekrany, staryspec.specEkranow], [['rejestracja'], []])
  assert.equal(blokDesignerski(p, jednostka(p, 'IU-3'), korzen).tresc, '')
  const zero = plan(iu('IU-4', 'feature-builder-ui', '—'))
  assert.match(blokDesignerski(zero, jednostka(zero, 'IU-4'), korzen).tresc, /pomiary tej funkcji z Figmy/, '„—” przy SPEC bez katalogu ekrany/ = caly SPEC')
})

test('SPEC podzielony na ekrany: ekran z figma_screens bez pliku ekrany/<nazwa>.md = blad sprawdz (builder zostalby bez pomiarow)', (t) => {
  const korzen = projekt({ [`${FOLDER}/SPEC.md`]: '#', [`${FOLDER}/ekrany/logowanie.md`]: '#' })
  t.after(() => rmSync(korzen, { recursive: true, force: true }))
  const p = plan(iu('IU-1', 'feature-builder-ui', '`logowanie`'))
  assert.deepEqual(sprawdzMakiety(p, p.fazy.flatMap((f) => f.iu), korzen).bledy, [`figma_spec: SPEC podzielony na ekrany, brak ${FOLDER}/ekrany/rejestracja.md — pobierz ekran ponownie (kontekst designerski, krok E)`])
  const zBrakiem = plan(iu('IU-2', 'feature-builder-ui', '`rejestracja`'))
  assert.deepEqual(blokDesignerski(zBrakiem, jednostka(zBrakiem, 'IU-2'), korzen).specEkranow, [], 'brak pliku ekranu = bez trybu ekranow (sprawdz daje blad)')
  const bezKatalogu = projekt({ [`${FOLDER}/SPEC.md`]: '#' })
  t.after(() => rmSync(bezKatalogu, { recursive: true, force: true }))
  assert.deepEqual(sprawdzMakiety(p, p.fazy.flatMap((f) => f.iu), bezKatalogu).bledy, [], 'SPEC sprzed podzialu — bez bledu')
})

test('sprawdzPlan zglasza bledy i uwagi pola Makiety (walidacja planu przed autopilotem)', () => {
  const p = plan(iu('IU-1', 'feature-builder-ui', '`reset`'))
  assert.ok(sprawdzPlan(p, tmpdir()).bledy.some((b) => b.startsWith('IU-1: Makiety reset — brak w figma_screens')))
  const bezPola = plan(iu('IU-1', 'feature-builder-ui', null))
  assert.ok(sprawdzPlan(bezPola, tmpdir()).uwagi.some((u) => u.startsWith('IU-1: jednostka UI bez pola Makiety')))
})

test('blokDesignerski: jednostka bez Delegate to (plan starszy) dostaje blok — buildera dobiera planner po plikach', () => {
  const p = plan(iu('IU-1', '', null))
  assert.match(blokDesignerski(p, jednostka(p, 'IU-1'), tmpdir()).tresc, /Mandatory designerski kontekst/)
})

test('CLI designerski: blok jednostki z planu na dysku; brak --iu = zle argumenty, nieznana IU = kod 1', (t) => {
  const tekst = `---\n${FM}\n---\n\n# P\n\n### Faza 1 — F\n\n**Zależy od:** Brak\n\n${iu('IU-1', 'feature-builder-ui', '`rejestracja`')}`
  const korzen = projekt({ 'docs/plans/p.md': tekst, [`${FOLDER}/SPEC.md`]: '#', [`${FOLDER}/ekrany/rejestracja.md`]: '#' })
  t.after(() => rmSync(korzen, { recursive: true, force: true }))
  const uruchom = (/** @type {string[]} */ a) => spawnSync(process.execPath, [CLI, 'designerski', 'docs/plans/p.md', ...a, '--projekt', korzen], { encoding: 'utf8' })
  const ok = uruchom(['--iu', 'IU-1'])
  assert.equal(ok.status, 0, ok.stdout)
  assert.deepEqual(JSON.parse(ok.stdout).specEkranow, ['docs/plans/x-figma/ekrany/rejestracja.md'])
  assert.equal(uruchom([]).status, 2)
  writeFileSync(join(korzen, 'docs/plans/b.md'), `---\n${FM}\n---\n\n# P\n\n${iu('IU-2', 'feature-builder-ui', '`logowanie`')}`)
  const bezFazy = spawnSync(process.execPath, [CLI, 'designerski', 'docs/plans/b.md', '--iu', 'IU-2', '--projekt', korzen], { encoding: 'utf8' })
  assert.deepEqual(JSON.parse(bezFazy.stdout).ekrany, ['logowanie'], 'jednostka spoza faz (bezFazy)')
  assert.equal(uruchom(['--iu', 'IU-9']).status, 1)
})

test('kontekst designerski (dev-plan krok E): agenci w czesciach, zrzuty do plikow bez ogladania, SPEC per ekran', () => {
  const krok = readFileSync(resolve(KATALOG, '../../../skills/dev-plan/references/kontekst-designerski.md'), 'utf8')
  assert.match(krok, /do 8 ekranów — jeden agent, 9–16 — dwa, więcej — trzy/)
  assert.match(krok, /get_design_context \(fileKey, nodeId, clientFrameworks: react, clientLanguages: typescript, excludeScreenshot: true\)/)
  assert.match(krok, /PNG nie otwierasz narzędziem Read/)
  assert.match(krok, /curl -sSL -o <folder>\/<name>\.png "<image_url>"/)
  assert.match(krok, /Zapisz <folder>\/ekrany\/<name>\.md/)
  assert.match(krok, /\| <name> \| `\.\/<name>\.png` \| `\.\/ekrany\/<name>\.md` \|/)
  assert.match(krok, /pole `\*\*Makiety:\*\*`/)
  assert.match(krok, /get_design_context widocznych dzieci\n {3}\(też excludeScreenshot: true\)/)
  assert.match(krok, /Agent pierwszej części: get_variable_defs jednego reprezentatywnego ekranu → <folder>\/tokeny\.md/)
  assert.match(krok, /wiersze rozjazdów z DESIGN\.md gotowe do tabeli/)
  const szablon = readFileSync(resolve(KATALOG, '../../../skills/dev-plan/references/szablon-planu.md'), 'utf8')
  assert.match(szablon, /\| `\*\*Makiety:\*\*` \| nazwy z `figma_screens`/)
  const skill = readFileSync(resolve(KATALOG, '../../../skills/dev-plan/SKILL.md'), 'utf8')
  assert.match(skill, /- \*\*Makiety\*\* — w planie z `figma_screens` każda IU ui\/fullstack wymienia ekrany/)
})
