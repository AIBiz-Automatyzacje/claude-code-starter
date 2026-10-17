// Czesci PR zadania (P20 S2) mierzone na commitach konca faz ze stanu autopilota, bez worktree.
// vibersi etap 3: archiwizacja dala 172 pliki do recenzji i rade „per katalog”; operator ucial recznie po fazie 3
// (909f669 = kontrola diffu naprawczego fazy 3) — PR #3 93 pliki, PR #4 121.
//
// Uruchomienie:  node --test .claude/scripts/pr/__tests__/czesci.test.mjs

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { koniecFazy } from '../czesci.mjs'

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'czesci.mjs')
const Z = 'zadanie-x'

/**
 * Repo jak po autopilocie i archiwizacji: faza = commit execute + (opcjonalnie) poprawki + kontrola, baza fazy w stanie.
 * @param {{ pliki: number, kroki: string[] }[]} fazy kroki: 'feat' | 'poprawki' | 'kontrola' | 'stop' | 'reczna' (naprawa operatora po STOP)
 * @param {string} [czesciPlanu] tresc sekcji „## Części PR” planu technicznego
 * @param {{ poArchiwum?: number, stan?: (stan: { numer: number, baza: string | null }[]) => void }} [opcje] poArchiwum = pliki
 *   poprawek ze smoke'a po archiwum; stan = zmiana stanu przed zapisem
 * @returns {{ repo: string, git: (...a: string[]) => string, konce: string[] }}
 */
function repoZadania(fazy, czesciPlanu, opcje = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'czesci-pr-'))
  const git = (/** @type {string[]} */ ...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' }).stdout.trim()
  const zapisz = (/** @type {string} */ s, /** @type {string} */ t) => {
    mkdirSync(dirname(join(repo, s)), { recursive: true })
    writeFileSync(join(repo, s), t)
  }
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@x.pl')
  git('config', 'user.name', 't')
  zapisz('.coderabbit.yaml', 'reviews:\n  path_filters:\n    - "!docs/**"\n')
  git('add', '-A')
  git('commit', '-qm', 'start')
  git('switch', '-qc', `feature/${Z}`)
  zapisz('docs/plans/plan.md', `# Plan\n\n${czesciPlanu ? `## Części PR\n\n${czesciPlanu}\n\n` : ''}## Implementation Units\n`)
  zapisz(`docs/active/${Z}/${Z}-plan.md`, `# Plan: ${Z}\n\nPlan techniczny: \`docs/plans/plan.md\`\n`)
  git('add', '-A')
  git('commit', '-qm', `docs: inicjalizacja planu dla ${Z}`)
  /** @type {{ numer: number, baza: string | null }[]} */
  const stan = []
  /** @type {string[]} */
  const konce = []
  fazy.forEach((f, i) => {
    const n = i + 1
    stan.push({ numer: n, baza: git('rev-parse', 'HEAD') })
    for (const krok of f.kroki) {
      if (krok === 'feat') for (let p = 0; p < f.pliki; p += 1) zapisz(`src/f${n}/p${p}.sql`, `-- ${p}\n`)
      else if (krok === 'reczna') zapisz(`src/f${n}/reczna.sql`, '-- naprawa\n')
      else zapisz(`docs/active/${Z}/review-faza-${n}.md`, `${krok}\n`)
      git('add', '-A')
      const temat = { feat: `feat(${Z}): faza ${n}`, poprawki: `fix(${Z}): poprawki po review fazy ${n}`, reczna: 'fix: reczna naprawa po STOP kontroli',
        kontrola: `fix(${Z}): kontrola diffu naprawczego fazy ${n}`, stop: `docs(${Z}): stan pipeline'u po STOP (faza ${n})` }[krok]
      git('commit', '-qm', temat ?? krok)
      // Nieostatnia faza konczy sie na bazie nastepnej (wszystko przed jej execute), ostatnia — na commicie pipeline'u.
      if (i < fazy.length - 1 || ['feat', 'poprawki', 'kontrola'].includes(krok)) konce[i] = git('rev-parse', 'HEAD')
    }
  })
  opcje.stan?.(stan)
  zapisz(`docs/active/${Z}/.autopilot-state.json`, JSON.stringify({ zadanie: Z, fazy: stan }))
  mkdirSync(join(repo, 'docs/completed'), { recursive: true })
  renameSync(join(repo, `docs/active/${Z}`), join(repo, `docs/completed/${Z}`))
  git('add', '-A')
  git('commit', '-qm', `docs(${Z}): archiwum`)
  if (opcje.poArchiwum) {
    for (let p = 0; p < opcje.poArchiwum; p += 1) zapisz(`src/smoke/p${p}.sql`, `-- ${p}\n`)
    git('add', '-A')
    git('commit', '-qm', `fix(${Z}): poprawki ze smoke'a operatora`)
  }
  return { repo, git, konce }
}

/** @param {string} repo @returns {{ kod: number | null, w: Record<string, any> }} */
function czesci(repo) {
  const r = spawnSync(process.execPath, [CLI, '--projekt', repo, '--zadanie', `docs/completed/${Z}`], { encoding: 'utf8' })
  return { kod: r.status, w: JSON.parse(r.stdout) }
}

const PELNA = ['feat', 'poprawki', 'kontrola']

test('bez sekcji w planie, ponad 150: ciecie na koncu fazy z najmniejsza najwieksza czescia; koniec fazy = kontrola, poprawki albo feat w zakresie fazy, nie STOP', () => {
  const { repo, git, konce } = repoZadania([
    { pliki: 60, kroki: PELNA }, { pliki: 40, kroki: ['feat', 'stop'] }, { pliki: 50, kroki: ['feat', 'poprawki'] }, { pliki: 60, kroki: ['feat'] },
  ])
  try {
    const { kod, w } = czesci(repo)
    assert.equal(kod, 0)
    assert.deepEqual(w.fazy.map((/** @type {{ koniec: string }} */ f) => f.koniec), konce)
    // Faza 2 bez fixa, z commitem STOP: koniec = baza fazy 3 (dokumenty STOP sa poza recenzja); faza 3 bez kontroli — poprawki.
    assert.equal(git('log', '-1', '--format=%s', konce[1]), `docs(${Z}): stan pipeline'u po STOP (faza 2)`)
    assert.match(git('log', '-1', '--format=%s', konce[2]), /poprawki po review fazy 3$/)
    assert.deepEqual([w.ok, w.zrodlo, w.plan, w.uwaga], [true, 'pomiar', null, null])
    // .coderabbit.yaml z galezi glownej w bazie — nie w diffie; docs/ odfiltrowane.
    assert.deepEqual(w.czesci.map((/** @type {{ fazy: string, doRecenzji: number }} */ c) => [c.fazy, c.doRecenzji]), [['1–2', 100], ['3–4', 110]])
    assert.deepEqual(w.ciecia, [konce[1]])
    assert.deepEqual([w.czesci[0].od, w.czesci[1].od, w.czesci[1].do], [git('rev-parse', 'main'), konce[1], git('rev-parse', 'HEAD')])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('ciecie z sekcji planu, gdy kazda czesc < 150; czesc z planu >= 150 = ciecie z pomiaru z uwaga', () => {
  const fazy = [{ pliki: 60, kroki: PELNA }, { pliki: 40, kroki: PELNA }, { pliki: 30, kroki: PELNA }, { pliki: 60, kroki: PELNA }]
  const z = repoZadania(fazy, '| Część | Fazy |\n|---|---|\n| 1 | 1–3 |\n| 2 | 4 |')
  try {
    const { kod, w } = czesci(z.repo)
    assert.equal(kod, 0)
    assert.deepEqual([w.zrodlo, w.plan, w.ciecia, w.uwaga], ['plan', [3], [z.konce[2]], null])
    assert.deepEqual(w.czesci.map((/** @type {{ doRecenzji: number }} */ c) => c.doRecenzji), [130, 60])
  } finally {
    rmSync(z.repo, { recursive: true, force: true })
  }
  const zly = repoZadania(fazy.map((f, i) => (i === 1 ? { ...f, pliki: 70 } : f)), '| Część | Fazy |\n|---|---|\n| 1 | 1–3 |\n| 2 | 4 |')
  try {
    const { kod, w } = czesci(zly.repo)
    assert.equal(kod, 0)
    assert.deepEqual([w.zrodlo, w.ciecia], ['pomiar', [zly.konce[1]]])
    assert.equal(w.uwaga, 'cięcie z planu daje część >= 150: część 1 (fazy 1–3) 160 — inny punkt cięcia')
    assert.deepEqual(w.czesci.map((/** @type {{ doRecenzji: number }} */ c) => c.doRecenzji), [130, 90])
  } finally {
    rmSync(zly.repo, { recursive: true, force: true })
  }
})

test('do 150 jedna czesc; faza sama >= 150 = ok false, kod 1, uwaga o podziale w planowaniu; brak stanu = wyjatek', () => {
  const maly = repoZadania([{ pliki: 100, kroki: PELNA }, { pliki: 50, kroki: PELNA }])
  try {
    const { kod, w } = czesci(maly.repo)
    assert.deepEqual([kod, w.ok, w.zrodlo, w.czesci.length, w.czesci[0].doRecenzji, w.ciecia], [0, true, 'jedna', 1, 150, []])
  } finally {
    rmSync(maly.repo, { recursive: true, force: true })
  }
  const duzy = repoZadania([{ pliki: 160, kroki: PELNA }, { pliki: 10, kroki: PELNA }])
  try {
    const { kod, w } = czesci(duzy.repo)
    assert.equal(kod, 1)
    assert.equal(w.ok, false)
    assert.deepEqual(w.czesci.map((/** @type {{ doRecenzji: number }} */ c) => c.doRecenzji), [160, 10])
    assert.match(w.uwaga, /część 1 \(fazy 1\) 160 — faza powyżej limitu bota, dziel zadanie w planowaniu$/)
    rmSync(join(duzy.repo, `docs/completed/${Z}/.autopilot-state.json`))
    const bez = czesci(duzy.repo)
    assert.equal(bez.kod, 3)
    assert.match(bez.w.wyjatek, /^brak docs\/completed\/zadanie-x\/\.autopilot-state\.json/)
  } finally {
    rmSync(duzy.repo, { recursive: true, force: true })
  }
})

test('koniec fazy: kontrola przed poprawkami przed execute; docs i commity innej fazy nie koncza fazy', () => {
  const c = (/** @type {string} */ sha, /** @type {string} */ temat) => ({ sha, temat })
  const zakres = [c('a', `feat(${Z}): x (faza 2)`), c('b', `fix(${Z}): kontrola diffu naprawczego fazy 2`), c('c', `fix(${Z}): poprawki po review fazy 2`), c('d', `docs(${Z}): stan pipeline'u po STOP (faza 2)`)]
  assert.equal(koniecFazy(zakres, Z, 2), 'b')
  assert.equal(koniecFazy(zakres.filter((x) => x.sha !== 'b'), Z, 2), 'c')
  assert.equal(koniecFazy([c('a', `feat(${Z}): x`), c('e', `refactor(${Z}): y`), c('d', `docs(${Z}): z`)], Z, 2), 'e')
  assert.equal(koniecFazy([c('b', `fix(${Z}): kontrola diffu naprawczego fazy 12`), c('a', `feat(${Z}): x`)], Z, 1), 'a')
  assert.equal(koniecFazy([c('a', 'feat(inne-zadanie): x'), c('d', `docs(${Z}): archiwum`)], Z, 1), null)
})

// Recenzja P20 S2: koniec fazy po temacie dawal ciecie przed reczna naprawa operatora (czesc 1 bez walidacji), a faza bez
// commita wywracala pomiar; czesci konczyly sie testami bez commitow po archiwum (vibersi: smoke 101 -> 121).
test('koniec fazy = baza nastepnej (z reczna naprawa po STOP); faza bez commitow i baza null = uwaga bez wyjatku; commity po archiwum w ostatniej czesci', () => {
  const z = repoZadania([{ pliki: 60, kroki: [...PELNA, 'reczna'] }, { pliki: 40, kroki: PELNA }, { pliki: 0, kroki: [] }, { pliki: 60, kroki: PELNA }],
    undefined, { poArchiwum: 15 })
  try {
    const { kod, w } = czesci(z.repo)
    assert.equal(kod, 0)
    assert.equal(z.git('log', '-1', '--format=%s', w.fazy[0].koniec), 'fix: reczna naprawa po STOP kontroli')
    assert.equal(w.fazy[2].koniec, w.fazy[1].koniec, 'faza 3 bez commitow konczy sie na koncu fazy 2')
    assert.deepEqual(w.czesci.map((/** @type {{ fazy: string, doRecenzji: number }} */ c) => [c.fazy, c.doRecenzji]), [['1–2', 101], ['3–4', 75]])
    assert.equal(w.uwaga, null)
  } finally {
    rmSync(z.repo, { recursive: true, force: true })
  }
  const bezBazy = repoZadania([{ pliki: 60, kroki: PELNA }, { pliki: 50, kroki: PELNA }, { pliki: 0, kroki: [] }, { pliki: 60, kroki: PELNA }],
    undefined, { stan: (s) => { s[1].baza = null; s[2].baza = null } })
  try {
    const { kod, w } = czesci(bezBazy.repo)
    assert.equal(kod, 0)
    assert.deepEqual(w.fazy.map((/** @type {{ koniec: string }} */ f) => f.koniec), [bezBazy.konce[0], bezBazy.konce[1], bezBazy.konce[1], bezBazy.konce[3]])
    // Faza 3 bez bazy, ale z baza fazy 4 = koniec fazy 2 (pusta faza bez uwagi).
    assert.equal(w.uwaga, 'faza 1: koniec z tematu commita (brak bazy fazy 2 w historii); faza 2: koniec z tematu commita (brak bazy fazy 3 w historii)')
  } finally {
    rmSync(bezBazy.repo, { recursive: true, force: true })
  }
})

test('ostatnia faza bez commita fazy = koniec poprzedniej z uwaga', () => {
  const z = repoZadania([{ pliki: 20, kroki: PELNA }, { pliki: 0, kroki: [] }])
  try {
    const { kod, w } = czesci(z.repo)
    assert.equal(kod, 0)
    assert.equal(w.fazy[1].koniec, z.konce[0])
    assert.equal(w.uwaga, `faza 2: bez commita fazy — koniec jak poprzedniej (${z.konce[0].slice(0, 12)})`)
  } finally {
    rmSync(z.repo, { recursive: true, force: true })
  }
})

test('sekcja planu przy calosci do 150 = jeden PR z uwaga; sekcja z bledem zapisu nie tnie (pomiar); granica: czesc z planu 150 odrzucona', () => {
  const maly = repoZadania([{ pliki: 30, kroki: PELNA }, { pliki: 30, kroki: PELNA }], '| Część | Fazy |\n|---|---|\n| 1 | 1 |\n| 2 | 2 |')
  try {
    const { w } = czesci(maly.repo)
    assert.deepEqual([w.zrodlo, w.czesci.length, w.uwaga], ['jedna', 1, 'plan przewidywał części, a całość ma 60 plików do recenzji — jeden PR'])
  } finally {
    rmSync(maly.repo, { recursive: true, force: true })
  }
  const fazy = [{ pliki: 60, kroki: PELNA }, { pliki: 40, kroki: PELNA }, { pliki: 50, kroki: PELNA }, { pliki: 60, kroki: PELNA }]
  const zly = repoZadania(fazy, '| Część | Fazy |\n|---|---|\n| 1 | 1 |\n| 2 | druga połowa |')
  try {
    const { w } = czesci(zly.repo)
    assert.deepEqual([w.zrodlo, w.plan, w.czesci.map((/** @type {{ doRecenzji: number }} */ c) => c.doRecenzji)], ['pomiar', null, [100, 110]])
  } finally {
    rmSync(zly.repo, { recursive: true, force: true })
  }
  const granica = repoZadania(fazy, '| Część | Fazy |\n|---|---|\n| 1 | 1–3 |\n| 2 | 4 |')
  try {
    const { w } = czesci(granica.repo)
    assert.deepEqual([w.zrodlo, w.uwaga], ['pomiar', 'cięcie z planu daje część >= 150: część 1 (fazy 1–3) 150 — inny punkt cięcia'])
  } finally {
    rmSync(granica.repo, { recursive: true, force: true })
  }
})
