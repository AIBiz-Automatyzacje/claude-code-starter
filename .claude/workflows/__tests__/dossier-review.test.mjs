// Dossier w dev-docs-review-wf.js (PLAN-POPRAWY P7): routing reviewerow liczony z pola dossier z args (domkniecie fazy
// w tym runie) albo z zapasowego agenta klasy mechanicznej, ktory uruchamia ten sam skrypt (swiezy run po STOP-ie miedzy
// execute a review, review uruchomione samodzielnie). Agent kontekst:diff znika. Funkcje wyciete ze zrodla workflowu.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { commit, noweRepo, usun, zapisz } from '../../scripts/bramki/__tests__/repo-testowe.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')
const zrodloAutopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
const CLI_DOSSIER = resolve(KATALOG, '../../scripts/dossier/dossier.mjs')

/** @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/**
 * @typedef {{ pliki: { plik: string, czegoDotyczy: string }[], warstwy: Record<string, boolean>, e2eCheckboxy: number,
 *   figmaScreens?: boolean, diffPlik?: string, diffZapisany?: boolean, diffUciety?: boolean, ctxPlik?: string, ctxZapisany?: boolean }} Dossier
 * @typedef {{ aktywni: { key: string }[], e2eTryb: string, pominieci: { key: string, powod: string }[], plikiKodu: number }} Routing
 */

// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const wf = new Function(
  `${wytnij('const REVIEWERZY = [', '\n]')}
   ${wytnij('// ── Dossier i routing (P7)', '// ── Koniec dossier i routingu')}
   ${wytnij('function mapaBlok(', '\n}')}
   return { czyDossier, dossierFazy, dossierPrompt, routingReviewerow, mapaBlok }`,
)()
/** @type {(d: unknown) => boolean} */
const czyDossier = wf.czyDossier
/** @type {(a: unknown, zapas: () => Promise<unknown>) => Promise<{ kontekst: Dossier | null, zrodlo: string | null }>} */
const dossierFazy = wf.dossierFazy
/** @type {(sciezka: string, faza: number, baza: unknown) => string} */
const dossierPrompt = wf.dossierPrompt
/** @type {(k: Dossier | null, srodowiskoE2E?: string) => Routing} */
const routingReviewerow = wf.routingReviewerow
/** @type {(k: Dossier | null) => string} */
const mapaBlok = wf.mapaBlok

const SHA = '0123456789abcdef0123456789abcdef01234567'
const WARSTWY = { ui: false, dane: false, typowanie: true, nowyModul: true }
/** @type {Dossier} */
const DOSSIER = { pliki: [{ plik: 'src/a.ts', czegoDotyczy: 'dodany (+3)' }], warstwy: WARSTWY, e2eCheckboxy: 0, ctxPlik: '/tmp/ctx.md', ctxZapisany: true, diffPlik: '/tmp/d.diff', diffZapisany: true, diffUciety: false }
const klucze = (/** @type {Routing} */ r) => r.aktywni.map((x) => x.key)

test('czyDossier: ksztalt KONTEKST z flagami warstw i liczba [E2E]; niepelny obiekt nie przechodzi', () => {
  assert.equal(czyDossier(DOSSIER), true)
  assert.equal(czyDossier(null), false)
  assert.equal(czyDossier({ ...DOSSIER, warstwy: { ui: true } }), false)
  assert.equal(czyDossier({ ...DOSSIER, e2eCheckboxy: '2' }), false)
  assert.equal(czyDossier({ ...DOSSIER, pliki: undefined }), false)
})

test('dossierFazy: dossier z args (domkniecie) bez zapasowego agenta; bez args zapasowy agent; jego null = brak dossier', async () => {
  let wolania = 0
  const zapas = async () => { wolania++; return DOSSIER }
  assert.deepEqual(await dossierFazy({ dossier: DOSSIER }, zapas), { kontekst: DOSSIER, zrodlo: 'domkniecie' })
  assert.equal(wolania, 0, 'dossier z domkniecia nie odpala zapasowego agenta')
  assert.deepEqual(await dossierFazy({ sciezka: 'x', faza: 1 }, zapas), { kontekst: DOSSIER, zrodlo: 'zapas' })
  assert.deepEqual(await dossierFazy({ dossier: { pliki: [] } }, zapas), { kontekst: DOSSIER, zrodlo: 'zapas' }, 'niepelne dossier z args = zapas')
  assert.equal(wolania, 2)
  assert.deepEqual(await dossierFazy({}, async () => null), { kontekst: null, zrodlo: null })
  assert.deepEqual(await dossierFazy({}, async () => ({ pliki: 'zle' })), { kontekst: null, zrodlo: null }, 'zly wynik zapasu = fail-open')
})

test('dossierPrompt: zapasowy agent uruchamia skrypt dossier; --baza tylko z SHA w args', () => {
  assert.ok(dossierPrompt('docs/active/x', 2, SHA).includes(`node .claude/scripts/dossier/dossier.mjs --sciezka docs/active/x --faza 2 --baza ${SHA}`))
  assert.ok(dossierPrompt('docs/active/x', 2, undefined).includes('node .claude/scripts/dossier/dossier.mjs --sciezka docs/active/x --faza 2`'))
  assert.doesNotMatch(dossierPrompt('docs/active/x', 2, 'HEAD; rm -rf /'), /--baza/)
})

test('routingReviewerow: brak dossier = pelny sklad i tester w przegladarce (fail-open)', () => {
  const r = routingReviewerow(null)
  assert.deepEqual(klucze(r), ['security', 'performance', 'code-quality', 'correctness', 'spec-compliance', 'test-coverage'])
  assert.equal(r.e2eTryb, 'przegladarka')
})

test('routingReviewerow: tryb testera z checkboxow [E2E] i srodowiska; zero checkboxow i makiet = tester pominiety', () => {
  assert.equal(routingReviewerow({ ...DOSSIER, e2eCheckboxy: 2 }, 'pominieto').e2eTryb, 'bez-przegladarki')
  assert.equal(routingReviewerow({ ...DOSSIER, e2eCheckboxy: 0, figmaScreens: true }, 'gotowe').e2eTryb, 'przegladarka')
  const r = routingReviewerow(DOSSIER, 'gotowe')
  assert.equal(r.e2eTryb, 'pominiety')
  assert.ok(r.pominieci.some((p) => p.key === 'e2e'))
})

/** @param {Record<string, string>} pliki zmiany fazy @returns {Dossier} wynik prawdziwego skryptu na repo-fixture */
function dossierZeSkryptu(pliki) {
  const repo = noweRepo()
  const wyjscie = mkdtempSync(join(tmpdir(), 'dossier-routing-'))
  try {
    zapisz(repo, { 'README.md': '# x\n', 'docs/active/z/z-zadania.md': '# Zadania\n\n## Faza 1\n\n- [ ] Test: [E2E] lista widoczna\n' })
    const baza = commit(repo, 'baza')
    zapisz(repo, pliki)
    commit(repo, 'faza')
    const p = spawnSync(process.execPath, [CLI_DOSSIER, '--sciezka', 'docs/active/z', '--faza', '1', '--baza', baza, '--wyjscie', wyjscie], { cwd: repo, encoding: 'utf8' })
    assert.equal(p.status, 0, p.stderr)
    return JSON.parse(p.stdout)
  } finally {
    usun(repo)
    rmSync(wyjscie, { recursive: true, force: true })
  }
}

test('kontrakt skrypt → routing: faza z fetch w nowym module budzi caly sklad, faza czysto dokumentacyjna tylko rdzen', () => {
  const kod = dossierZeSkryptu({ 'src/oferty.ts': 'export const pobierz = () => fetch("/o").then((r) => r.json()).catch(() => null)\n', 'src/Lista.tsx': 'export const L = () => <ul />\n' })
  assert.equal(czyDossier(kod), true)
  const r = routingReviewerow(kod)
  assert.deepEqual(klucze(r), ['security', 'performance', 'code-quality', 'correctness', 'spec-compliance', 'test-coverage'])
  assert.equal(r.e2eTryb, 'przegladarka')

  const dokumentacja = dossierZeSkryptu({ 'README.md': '# x\n\nWiecej opisu.\n' })
  const rd = routingReviewerow(dokumentacja, 'gotowe')
  assert.deepEqual(klucze(rd), ['security', 'spec-compliance', 'test-coverage'])
  assert.equal(rd.plikiKodu, 0)
})

test('wiring: agent kontekst:diff i jego prompt znikaja (H59, H60); zapasowy agent klasy mechanicznej', () => {
  assert.doesNotMatch(zrodlo, /kontekst:diff|function kontekstPrompt|context-packager/)
  assert.doesNotMatch(zrodlo, /dotad 7x ten sam git diff|najwiekszy pojedynczy oszczednik/)
  assert.match(zrodlo, /agentType: 'klasa-mechaniczny', label: 'dossier:zapas'/)
  assert.match(zrodlo, /const \{ kontekst, zrodlo: zrodloDossier \} = await dossierFazy\(args,/)
})

test('mapaBlok: dossier i diff ze skryptu z zapasowa sciezka bez archeologii (H57, H58)', () => {
  const blok = mapaBlok(DOSSIER)
  assert.match(blok, /Plik: \/tmp\/ctx\.md/)
  assert.match(blok, /Plik: \/tmp\/d\.diff/)
  assert.doesNotMatch(blok, /dokladnie jak dotad/)
  assert.match(blok, /zrob wlasny `git diff` fazy: brak artefaktu NIE zwalnia Cie z obejrzenia pelnego diffu/)
  assert.match(blok, /przeczytaj pelne dokumenty\n\(plan techniczny fazy, requirements doc\) i policz wycinek wiedzy: `node \.claude\/scripts\/wiedza\/wiedza\.mjs wycinek --pliki/)
  assert.match(blok, /wycinek wiedzy projektu dla plikow fazy/)
  assert.match(mapaBlok({ ...DOSSIER, diffUciety: true }), /PRZYCIETY/)
  assert.equal(mapaBlok(null), '')
})

test('wiring autopilota: dossier z execute tej fazy idzie w args review; faza wznowiona z execute: done go nie ma', () => {
  assert.match(zrodloAutopilot, /let dossierZExecute = null\n {2}if \(faza\.execute === 'pending'\) \{/)
  assert.match(zrodloAutopilot, /dossierZExecute = exec\.dossier \|\| null/)
  const wywolanie = zrodloAutopilot.slice(zrodloAutopilot.indexOf("workflow('dev-docs-review-wf'"))
  assert.match(wywolanie.slice(0, wywolanie.indexOf('})')), /\bdossier: dossierZExecute,/)
  assert.doesNotMatch(zrodloAutopilot, /kontekst:diff/)
})
