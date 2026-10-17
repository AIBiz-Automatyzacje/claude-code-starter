// Fix porcjami w swiezym kontekscie (P21 B1, HANDOFF 6a pkt 86 e i h).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/fix-porcjami.test.mjs
//
// Vibersi etap 3: jeden agent fixa bral 12–20 findingow fazy, kontekst rosl do 264–345k, 0,18 M na finding (etap 2: 0,11).
// Od P21 findingi ida porcjami (grupa = jeden plik, do MAKS_W_PORCJI_FIXA na porcje, P1 pierwsze), kazda porcja to osobny agent
// z commitem o tym samym temacie. Kontrola fixa dostaje commity wszystkich porcji, walidacja koncowa znajduje je po temacie,
// koniec fazy dla czesci PR liczy sie jak dotad (baza nastepnej fazy, a bez niej ostatni commit po temacie).

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { koniecFazy } from '../../scripts/pr/czesci.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')

/** @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/** @typedef {import('./typy.mjs').Finding} Finding */

// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const wf = new Function('BLOK_DLUGIE_KOMENDY', `
  ${wytnij('const MAKS_W_PORCJI_FIXA', '\n')}
  ${wytnij('function plikBezLinii(', '\n}')}
  ${wytnij('function porcjujFix(', '\n}')}
  ${wytnij('function zlozWynikiFixa(', '\n}')}
  ${wytnij('function blokZwinieciaDoPoprawy(', '\n}')}
  ${wytnij('function fixPrompt(', '\n}')}
  ${wytnij('function komendaCommitowFixa(', '\n}')}
  return { MAKS_W_PORCJI_FIXA, porcjujFix, zlozWynikiFixa, fixPrompt, komendaCommitowFixa }`)('')

/** @param {string} severity @param {string} plik @returns {Finding} */
const f = (severity, plik) => ({ severity, typ: 'KOD', plik, opis: `defekt ${plik}` })

/** @param {Finding[][]} porcje @returns {string[][]} */
const pliki = (porcje) => porcje.map((p) => p.map((x) => x.plik))

test('porcjujFix: grupa jednego pliku nie rozjezdza sie miedzy porcjami; P1 w porcjach pierwszych, osobno od samych P2', () => {
  const lista = [f('P2', 'src/b.ts:9'), f('P2', 'src/a.ts:1'), f('P1', 'src/c.ts:4'), f('P2', 'src/b.ts:2'), f('P2', 'src/a.ts:7'), f('P2', 'src/d.ts:1')]
  const porcje = wf.porcjujFix(lista, 4)
  assert.deepEqual(pliki(porcje), [['src/c.ts:4'], ['src/a.ts:1', 'src/a.ts:7', 'src/b.ts:9', 'src/b.ts:2'], ['src/d.ts:1']])
  assert.equal(porcje.flat().length, lista.length, 'kazdy finding w dokladnie jednej porcji')
})

test('porcjujFix: grupa wieksza niz limit dzielona na rowne kawalki; maly kawalek dopelnia porcje z miejscem', () => {
  const duza = Array.from({ length: 8 }, (_, i) => f('P2', `src/x.ts:${i + 1}`))
  const porcje = wf.porcjujFix([...duza, f('P2', 'src/y.ts:1')], 6)
  assert.deepEqual(porcje.map((/** @type {Finding[]} */ p) => p.length), [5, 4])
  assert.deepEqual(pliki(porcje), [['src/x.ts:1', 'src/x.ts:2', 'src/x.ts:3', 'src/x.ts:4', 'src/y.ts:1'], ['src/x.ts:5', 'src/x.ts:6', 'src/x.ts:7', 'src/x.ts:8']])
})

test('porcjujFix: etap 3 vibersi faza 4 (20 findingow, 12 plikow) = 4 porcje po co najwyzej 6, a nie jeden agent', () => {
  const rozklad = [4, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1]
  const lista = rozklad.flatMap((n, i) => Array.from({ length: n }, (_, j) => f(i === 0 && j === 0 ? 'P1' : 'P2', `src/p${String(i).padStart(2, '0')}.ts:${j + 1}`)))
  const porcje = wf.porcjujFix(lista)
  assert.equal(wf.MAKS_W_PORCJI_FIXA, 6)
  assert.ok(porcje.every((/** @type {Finding[]} */ p) => p.length <= 6))
  assert.deepEqual(porcje.map((/** @type {Finding[]} */ p) => p.length), [4, 6, 6, 4])
})

test('zlozWynikiFixa: sumy, commity i nienaprawione wszystkich porcji; FAIL albo serwer martwy w jednej porcji przechodzi na calosc', () => {
  const baza = { pozostaje: 0, typy: { kod: 1, test: 1, e2e: 0 }, e2eReweryfikacja: 'n/a', nierozwiazaneP1: 0, plikiBinarne: [] }
  const a = { ...baza, naprawione: 4, walidacja: 'PASS', commity: ['aaa1111'], nienaprawione: [], nierozwiazaneP2: 0, serwerE2e: 'nie-dotyczy' }
  const b = { ...baza, naprawione: 3, walidacja: 'PASS', commity: ['bbb2222'], nienaprawione: ['[P2] src/b.ts:2 — opis'], nierozwiazaneP2: 1, serwerE2e: 'martwy', e2eReweryfikacja: '1/2 passed' }
  const suma = wf.zlozWynikiFixa([a, b])
  assert.deepEqual([suma.naprawione, suma.nierozwiazaneP2, suma.walidacja, suma.serwerE2e, suma.e2eReweryfikacja], [7, 1, 'PASS', 'martwy', '1/2 passed'])
  assert.deepEqual(suma.commity, ['aaa1111', 'bbb2222'])
  assert.deepEqual(suma.typy, { kod: 2, test: 2, e2e: 0 })
  assert.deepEqual(suma.nienaprawione, ['[P2] src/b.ts:2 — opis'])
  assert.equal(wf.zlozWynikiFixa([a, { ...b, walidacja: 'FAIL' }]).walidacja, 'FAIL')
  assert.equal(wf.zlozWynikiFixa([]).walidacja, 'FAIL', 'zero wynikow to nie PASS')
})

test('fixPrompt porcji nieostatniej: lista tylko porcji, bez zwijania i bez zapisu known-issues, walidacja bez buildu, ten sam temat commita', () => {
  const p = wf.fixPrompt('docs/active/etap-3', 4, [f('P2', 'src/a.ts:1')], 'gotowe', { numer: 1, z: 3, poprzednie: [] })
  assert.match(p, /PORCJA 1 z 3/)
  assert.match(p, /Sekcji "## Do poprawy po review fazy 4" nie zwijasz/)
  assert.doesNotMatch(p, /Zamkniete cyklem fix/)
  assert.match(p, /known-issues\.md nie ruszasz/)
  assert.doesNotMatch(p, /ZASTAP jej cala tresc/)
  assert.match(p, /typecheck i pelny zestaw testow .*build uruchamia ostatnia porcja/)
  assert.match(p, /commit `fix\(etap-3\): poprawki po review fazy 4` \(temat dokladnie taki/)
  assert.match(p, /"\[P2\] <plik:linia> — <opis>"/)
})

test('fixPrompt porcji ostatniej: zwija sekcje, zapisuje known-issues takze z P2 poprzednich porcji, pelna walidacja z buildem', () => {
  const poprzednie = ['[P2] src/a.ts:1 — brak limitu', '[P1] src/c.ts:4 — nie powinno tu trafic']
  const p = wf.fixPrompt('docs/active/etap-3', 4, [f('P2', 'src/d.ts:1')], 'gotowe', { numer: 3, z: 3, poprzednie })
  assert.match(p, /PORCJA 3 z 3/)
  assert.match(p, /Zamkniete cyklem fix/)
  assert.match(p, /ZASTAP jej cala tresc/)
  assert.match(p, /- \[P2\] src\/a\.ts:1 — brak limitu/)
  assert.doesNotMatch(p, /nie powinno tu trafic/, 'P1 poprzednich porcji nie idzie do known-issues (P1 = STOP)')
  assert.match(p, /pelna walidacja \(typecheck, test, build/)
})

test('fixPrompt bez porcji (jedna porcja) = dawne polecenie: bez naglowka porcji, zwija i zapisuje known-issues', () => {
  const p = wf.fixPrompt('docs/active/x', 2, [f('P2', 'src/a.ts:1')], 'gotowe')
  assert.doesNotMatch(p, /PORCJA/)
  assert.match(p, /Zamkniete cyklem fix/)
  assert.match(p, /KNOWN-ISSUES \(graceful/)
})

test('wiring: porcje sekwencyjnie, kazda zeStanem; porcja z FAIL, P1 albo plikiem binarnym konczy fix; postep w stanie po porcji', () => {
  const blok = wytnij('const porcje = faza.otwarteFindingi.length', 'const fix = zlozWynikiFixa(wynikiPorcji)')
  assert.match(blok, /for \(let i = postep \? postep\.gotowe : 0; i < porcje\.length; i\+\+\)/)
  assert.match(blok, /await agent\(zeStanem\(fixPrompt\(sciezka, numerFazy, porcje\[i\], srodowiskoE2E, porcja\)\)/)
  assert.doesNotMatch(blok, /parallel\(/)
  assert.match(blok, /if \(\(wynik\.plikiBinarne \|\| \[\]\)\.length \|\| wynik\.walidacja === 'FAIL' \|\| wynik\.nierozwiazaneP1 > 0\) break/)
  assert.ok(blok.indexOf(') break') < blok.indexOf('faza.fixPostep = {'), 'postep zapisany dopiero po porcji bez STOP-u')
  assert.match(blok, /faza\.fixPostep\.porcje === porcje\.length/)
  // Kontrola fixa i tura poprawek biora commity wszystkich porcji (suma), nie ostatniej.
  assert.match(zrodlo, /kontrolaFixaPrompt\(sciezka, numerFazy, fix\.commity, faza\.otwarteFindingi\) \+ uwagaWznowienia/)
  assert.match(zrodlo, /fixPoprawkaPrompt\(sciezka, numerFazy, doPoprawki, fix\.commity\) \+ uwagaWznowienia/)
  assert.match(zrodlo, /faza\.otwarteFindingi = \[\]\n\s*delete faza\.fixPostep/)
})

test('porcjujFix: P1 w duzej grupie pliku idzie do pierwszego kawalka, a porcja z nim przed porcjami samych P2', () => {
  const lista = [...Array.from({ length: 6 }, (_, i) => f('P2', `src/a.ts:${i + 1}`)), f('P1', 'src/a.ts:50'), f('P2', 'src/b.ts:1')]
  const porcje = wf.porcjujFix(lista, 6)
  assert.equal(porcje[0][0].plik, 'src/a.ts:50')
  assert.ok(porcje[0].some((/** @type {Finding} */ x) => x.severity === 'P1'))
  assert.ok(porcje.slice(1).every((/** @type {Finding[]} */ p) => p.every((x) => x.severity === 'P2')))
})

test('fixPrompt porcji: pliki innych porcji otwiera, gdy wymaga tego poprawka; P2 liczy tylko swoje; [P2] poprzednich bez kotwicy', () => {
  const p = wf.fixPrompt('docs/active/x', 4, [f('P2', 'src/a.ts:1')], 'gotowe', { numer: 2, z: 2, poprzednie: ['🟠 [P2] src/c.ts:3 — opis'] })
  assert.match(p, /ich findingow nie naprawiasz; ich pliki otwierasz, gdy wymaga tego twoja poprawka/)
  assert.doesNotMatch(p, /ich plikow nie otwierasz/)
  assert.match(p, /nierozwiazaneP2 i nienaprawione\[\] dotycza tylko findingow tej porcji/)
  assert.match(p, /nierozwiazaneP2 \(P2 tej porcji, ktorych nie zamknales\)/)
  assert.match(p, /- 🟠 \[P2\] src\/c\.ts:3 — opis/)
})

test('wiring: nienaprawione wymagane w FixResult; rozjazd [P2] z nierozwiazaneP2 w logu; wznowienie = kontrola per commit', () => {
  assert.match(wytnij('const FIX_RESULT = {', '\n}'), /required: \[[^\]]*'nienaprawione'/)
  assert.match(zrodlo, /const wpisyP2 = fix\.nienaprawione\.filter\(\(n\) => \/\\\[P2\\\]\/\.test\(String\(n\)\)\)\.length/)
  assert.match(zrodlo, /if \(wpisyP2 !== fix\.nierozwiazaneP2\)/)
  assert.match(zrodlo, /const uwagaWznowienia = wynikiPorcji\.length && postep && postep\.gotowe > 0/)
  assert.match(zrodlo, /Diff fixa czytasz per commit z listy \(\\`git show --format= <hash>\\` dla kazdego\), nie zakresem/)
})

/** @param {string} cwd @param {...string} args */
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout.trim()
}

test('walidacja koncowa i koniec fazy: trzy commity porcji o tym samym temacie + kontrola — wszystkie w audycie, koniec fazy = ostatni', (t) => {
  const repo = mkdtempSync(join(tmpdir(), 'fix-porcjami-'))
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'config', 'user.email', 't@t'); git(repo, 'config', 'user.name', 't')
  writeFileSync(join(repo, 'a.txt'), '0'); git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'start')
  git(repo, 'switch', '-qc', 'feature/etap-3')
  const tematy = ['feat(etap-3): faza 4', 'fix(etap-3): poprawki po review fazy 4', 'fix(etap-3): poprawki po review fazy 4',
    'fix(etap-3): poprawki po review fazy 4', 'fix(etap-3): kontrola diffu naprawczego fazy 4']
  const sha = tematy.map((temat, i) => {
    writeFileSync(join(repo, 'a.txt'), String(i + 1)); git(repo, 'commit', '-qam', temat)
    return git(repo, 'rev-parse', '--short', 'HEAD')
  })
  const fixy = spawnSync('sh', ['-c', wf.komendaCommitowFixa('docs/active/etap-3')], { cwd: repo, encoding: 'utf8' }).stdout.trim().split('\n')
  assert.deepEqual(new Set(fixy.map((s) => s.slice(0, 7))), new Set(sha.slice(1).map((s) => s.slice(0, 7))))
  const commity = tematy.map((temat, i) => ({ sha: sha[i], temat }))
  assert.equal(koniecFazy(commity, 'etap-3', 4), sha[4])
  assert.equal(koniecFazy(commity.slice(0, 4), 'etap-3', 4), sha[3], 'bez kontroli — ostatnia porcja')
})
