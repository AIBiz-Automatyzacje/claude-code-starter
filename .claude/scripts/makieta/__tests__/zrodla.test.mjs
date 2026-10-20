// Zrodla makiet smoke'u (P24 IU-2): katalog zadania z nazwy smoke'u, plan techniczny z linii „Plan techniczny:”, PNG z visual-diff/
// albo z figma_screens, wymiary z punktu albo z SPEC, ekrany SPEC bez punktu. Uklad katalogow jak w vibersi (etap 4).

import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import { punktyWizualne } from '../punkty.mjs'
import { BladZrodel, zrodlaMakiet } from '../zrodla.mjs'

const skrotSha1 = (/** @type {string} */ s) => createHash('sha1').update(s).digest('hex')
const ZADANIE = 'etap-4-dodawanie-i-moderacja'
const SMOKE = `docs/operator/2026-10-18-${ZADANIE}-smoke.md`
const PLAN = 'docs/plans/2026-10-17-001-feat-etap-4-dodawanie-i-moderacja-plan.md'
const FIGMA = 'docs/plans/etap-4-dodawanie-i-moderacja-figma'
const PUNKTY = [
  '- [ ] Telefon: `/konto/projekty` obok `visual-diff/moje-projekty-telefon-figma.png` (viewport 390×800) → układ zgodny',
  '- [ ] Telefon: „Wysłano” obok `visual-diff/wyslano-telefon-figma.png` → zgodne',
  '- [ ] Komputer: `/admin` obok `visual-diff/admin-skrzynka-komputer-figma.png` → zgodne',
].join('\n')

const PLAN_MD = `---
title: "feat: Etap 4"
figma_spec: ./${FIGMA}/SPEC.md
figma_screens:
  moje-projekty-telefon: ./${FIGMA}/moje-projekty-telefon.png
  wyslano-telefon: ./${FIGMA}/wyslano-telefon.png
  admin-skrzynka-komputer: ./${FIGMA}/admin-skrzynka-komputer.png
  publikuj-telefon-wysylanie: ./${FIGMA}/publikuj-telefon-wysylanie.png
---

# feat
`

const SPEC_MD = `# SPEC

| Nazwa | Plik | SPEC ekranu | Wymiary | Frame |
|---|---|---|---|---|
| moje-projekty-telefon | \`./moje-projekty-telefon.png\` | \`./ekrany/moje-projekty-telefon.md\` | 390×782px | \`346:219\` |
| wyslano-telefon | \`./wyslano-telefon.png\` | \`./ekrany/wyslano-telefon.md\` | 390×896px | \`345:576\` |
| admin-skrzynka-komputer | \`./admin-skrzynka-komputer.png\` | — | 1440×1150px | \`348:312\` |
`

/** @param {string} projekt @param {Record<string, string>} pliki */
function zapisz(projekt, pliki) {
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(join(projekt, p, '..'), { recursive: true })
    writeFileSync(join(projekt, p), t)
  }
}

/** @param {(projekt: string) => void} cialo @param {{ katalog?: 'completed' | 'active' }} [opcje] */
function zProjektem(cialo, { katalog = 'completed' } = {}) {
  const projekt = mkdtempSync(join(tmpdir(), 'makieta-zrodla-'))
  try {
    zapisz(projekt, {
      [SMOKE]: `# Smoke\n\n${PUNKTY}\n`,
      [`docs/${katalog}/${ZADANIE}/${ZADANIE}-plan.md`]: `# Zadanie\n\nPlan techniczny: \`${PLAN}\`\n`,
      [`docs/${katalog}/${ZADANIE}/visual-diff/moje-projekty-telefon-figma.png`]: 'png-vd',
      [PLAN]: PLAN_MD,
      [`${FIGMA}/SPEC.md`]: SPEC_MD,
      [`${FIGMA}/ekrany/moje-projekty-telefon.md`]: '# moje-projekty-telefon (`346:219`) — 390×782px\n',
      [`${FIGMA}/ekrany/wyslano-telefon.md`]: '# wyslano-telefon (`345:576`) — 390×896px\n',
      [`${FIGMA}/wyslano-telefon.png`]: 'png-figma',
    })
    cialo(projekt)
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

/** @param {string} projekt */
const wynik = (projekt, smoke = SMOKE) => zrodlaMakiet(projekt, smoke, punktyWizualne(PUNKTY, skrotSha1))

test('smoke w docs/operator/ z zadaniem w docs/completed/: plan, PNG z visual-diff/, SPEC ekranu ekrany/<ekran>.md, viewport punktu przed SPEC', () => zProjektem((projekt) => {
  const w = wynik(projekt)
  assert.equal(w.katalogZadania, `docs/completed/${ZADANIE}`)
  assert.equal(w.plan, PLAN)
  assert.deepEqual(w.ekrany[0], {
    punkt: punktyWizualne(PUNKTY, skrotSha1)[0].id, ekran: 'moje-projekty-telefon',
    makieta: `docs/completed/${ZADANIE}/visual-diff/moje-projekty-telefon-figma.png`,
    spec: `${FIGMA}/ekrany/moje-projekty-telefon.md`, wymiary: { szerokosc: 390, wysokosc: 800 },
  })
  assert.equal(zrodlaMakiet(projekt, join(projekt, SMOKE), []).katalogZadania, `docs/completed/${ZADANIE}`, 'ścieżka bezwzględna smoke\'u')
}))

test('zadanie tylko w docs/active/ też działa; brak obu katalogów = błąd z obiema ścieżkami', () => {
  zProjektem((projekt) => assert.equal(wynik(projekt).katalogZadania, `docs/active/${ZADANIE}`), { katalog: 'active' })
  zProjektem((projekt) => {
    rmSync(join(projekt, 'docs/completed'), { recursive: true })
    assert.throws(() => wynik(projekt), (blad) => blad instanceof BladZrodel && blad.kod === 'brak-zadania'
      && blad.message.includes(`docs/completed/${ZADANIE}/`) && blad.message.includes(`docs/active/${ZADANIE}/`))
  })
  zProjektem((projekt) => {
    zapisz(projekt, { 'docs/operator/notatki.md': '- [ ] x' })
    assert.throws(() => zrodlaMakiet(projekt, 'docs/operator/notatki.md', []), (blad) => blad instanceof BladZrodel && blad.kod === 'nazwa-smoke')
  })
})

test('brak PNG w visual-diff/ → PNG z figma_screens; brak obu → makieta null (brak makiety)', () => zProjektem((projekt) => {
  const [, wyslano, admin] = wynik(projekt).ekrany
  assert.equal(wyslano.makieta, `${FIGMA}/wyslano-telefon.png`)
  assert.equal(admin.ekran, 'admin-skrzynka-komputer')
  assert.equal(admin.makieta, null)
}))

test('punkt bez viewportu: wymiary z tabeli SPEC.md, a bez wiersza — z nagłówka ekrany/<ekran>.md', () => zProjektem((projekt) => {
  const [, wyslano, admin] = wynik(projekt).ekrany
  assert.deepEqual(wyslano.wymiary, { szerokosc: 390, wysokosc: 896 })
  assert.deepEqual(admin.wymiary, { szerokosc: 1440, wysokosc: 1150 })
  assert.equal(admin.spec, `${FIGMA}/SPEC.md`, 'bez pliku ekranu — cały SPEC')
  zapisz(projekt, { [`${FIGMA}/SPEC.md`]: '# SPEC bez tabeli\n' })
  assert.deepEqual(wynik(projekt).ekrany[1].wymiary, { szerokosc: 390, wysokosc: 896 }, 'z nagłówka pliku ekranu')
  assert.equal(wynik(projekt).ekrany[2].wymiary, null)
}))

test('ekran z figma_screens bez punktu trafia do listy pominiętych; plan bez linii „Plan techniczny:” = bez SPEC i figma_screens', () => zProjektem((projekt) => {
  assert.deepEqual(wynik(projekt).pominiete, ['publikuj-telefon-wysylanie'])
  zapisz(projekt, { [`docs/completed/${ZADANIE}/${ZADANIE}-plan.md`]: '# Zadanie bez planu technicznego\n' })
  const w = wynik(projekt)
  assert.equal(w.plan, null)
  assert.deepEqual(w.pominiete, [])
  assert.equal(w.ekrany[1].makieta, null)
  assert.equal(w.ekrany[1].spec, null)
}))

test('ścieżka PNG wychodząca poza projekt (../ albo dowiązanie) jest odrzucona', () => zProjektem((projekt) => {
  const obcy = mkdtempSync(join(tmpdir(), 'makieta-obcy-'))
  try {
    writeFileSync(join(obcy, 'sekret.png'), 'obcy')
    zapisz(projekt, { [PLAN]: PLAN_MD.replace(`./${FIGMA}/wyslano-telefon.png`, `../${obcy.split('/').pop()}/sekret.png`) })
    rmSync(join(projekt, FIGMA, 'wyslano-telefon.png'))
    assert.equal(wynik(projekt).ekrany[1].makieta, null)
    symlinkSync(join(obcy, 'sekret.png'), join(projekt, `docs/completed/${ZADANIE}/visual-diff/wyslano-telefon-figma.png`))
    assert.equal(wynik(projekt).ekrany[1].makieta, null, 'dowiązanie poza projekt')
  } finally {
    rmSync(obcy, { recursive: true, force: true })
  }
}))
