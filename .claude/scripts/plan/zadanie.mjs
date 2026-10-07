// Generator docs/active/<zadanie>/ z planu technicznego (PLAN-POPRAWY P13): plan zadania, kontekst i zadania z checkboxami.
// Pliki niosa odnosniki do IU i strukture, ktora czytaja workflowy (kontrakt: __tests__/kontrakt-docs-active.test.mjs);
// tresc jednostek (podejscie, decyzje, teksty) zostaje w planie technicznym — planner bierze ja stamtad.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { liczE2e } from '../dossier/dokumenty.mjs'
import { ekranyFigmy, nazwaZadania, parsujPlan, poleTekstowe, sciezkaOrigin } from './plan-techniczny.mjs'
import { przygotowanie, sciezkaWzgledna } from './przygotowanie.mjs'

/**
 * @typedef {import('./plan-techniczny.mjs').Plan} Plan
 * @typedef {import('./plan-techniczny.mjs').Jednostka} Jednostka
 * @typedef {import('./przygotowanie.mjs').Przygotowanie} Przygotowanie
 * @typedef {{ fazy: number, iu: number, implementacyjne: number, testy: number, weryfikacje: number, e2e: number, operator: number }} Liczniki
 * @typedef {{ nazwa: string, katalog: string, pliki: { plan: string, kontekst: string, zadania: string }, liczniki: Liczniki,
 *   bledyBilansu: string[] }} Zadanie
 */

/** @param {string} tytul @param {string} nazwa @param {string} data @param {string} sciezkaPlanu @returns {string[]} */
function naglowek(tytul, nazwa, data, sciezkaPlanu) {
  return [`# ${tytul}: ${nazwa}`, '', `Branch: \`feature/${nazwa}\``, `Ostatnia aktualizacja: ${data}`, `Plan techniczny: \`${sciezkaPlanu}\``, '']
}

/** @param {string} projekt @param {string | null} origin @returns {string} */
function requirementsDoc(projekt, origin) {
  if (!origin) return 'brak'
  const sciezka = sciezkaOrigin(origin)
  if (sciezka) {
    return existsSync(join(projekt, sciezka)) ? `\`${origin}\`` : `\`${origin}\` (plik nie istnieje — popraw \`origin\` w planie)`
  }
  return `${origin} (poza repo — ID wg „Śledzenie wymagań” planu)`
}

/** @param {string} projekt @param {Plan} plan @param {string} sciezkaPlanu @returns {string[]} */
function zrodla(projekt, plan, sciezkaPlanu) {
  const prep = sciezkaWzgledna(poleTekstowe(plan, 'operator_prep'))
  return ['## Źródła', '', `- Plan techniczny: \`${sciezkaPlanu}\``,
    `- Requirements doc: ${requirementsDoc(projekt, poleTekstowe(plan, 'origin'))}`,
    `- Przygotowanie dla operatora: ${prep ? `\`${prep}\`` : 'brak'}`, '']
}

/** @param {string} projekt @param {Plan} plan @param {string} nazwa @param {string} data @param {string} sciezkaPlanu @param {Przygotowanie | null} prep */
function planZadania(projekt, plan, nazwa, data, sciezkaPlanu, prep) {
  const fazy = plan.fazy.map((f) => `| ${f.numer} | ${f.nazwa} | ${f.iu.map((iu) => iu.id).join(', ')} | ${f.zalezyOd || 'Brak'} | `
    + `${[...new Set(f.iu.map((iu) => iu.delegate))].join(', ')} |`)
  const blokery = (prep?.odroczone ?? []).map((b) => `- [ ] faza ${b.faza} — ${b.tresc} · ${prep?.sciezka}:${b.linia}`)
  return [
    ...naglowek('Plan', nazwa, data, sciezkaPlanu),
    ...zrodla(projekt, plan, sciezkaPlanu),
    '## Cel', '', plan.przeglad || `Zob. sekcja „Przegląd” planu technicznego.`, '',
    '## Zakres', '', `Wymagania i granice: \`${sciezkaPlanu}\`, sekcje „Śledzenie wymagań” i „Granice scope'u”.`, '',
    '## Fazy', '', '| Faza | Nazwa | IU | Zależy od | Delegaci |', '|---|---|---|---|---|', ...fazy, '',
    '## Kryteria akceptacji całości', '',
    'Każda faza: typecheck 0 błędów, testy PASS, review bez otwartych P1; każdy `[E2E]` uruchomiony (nie odhaczony ręcznie).',
    `Kryteria zadania: \`${sciezkaPlanu}\`, sekcja „Śledzenie wymagań” (i „Metryki sukcesu”, gdy plan ją ma).`, '',
    ...(blokery.length ? ['## Blokery operatora per faza', '', ...blokery, ''] : []),
  ].join('\n')
}

/** @param {Plan} plan @returns {string[]} */
function designerski(plan) {
  const design = poleTekstowe(plan, 'design_md')
  const spec = poleTekstowe(plan, 'figma_spec')
  const ekrany = ekranyFigmy(plan)
  if (!design && !spec && !ekrany.length) return []
  return ['## Designerski kontekst', '',
    `- **DESIGN.md (projekt-wide):** ${design ? `\`${design}\`` : 'null'}`,
    `- **SPEC.md (per-feature, pomiary z Figmy):** ${spec ? `\`${spec}\`` : 'null'}`,
    `- **Screeny referencyjne:**${ekrany.length ? '' : ' brak'}`,
    ...ekrany.map(([n, s]) => `  - \`${n}\`: \`${s}\``), '']
}

/** @param {string} projekt @param {Plan} plan @param {string} nazwa @param {string} data @param {string} sciezkaPlanu @param {Przygotowanie | null} prep */
function kontekstZadania(projekt, plan, nazwa, data, sciezkaPlanu, prep) {
  const wiszace = prep ? [...prep.blokujace, ...prep.odroczone] : []
  const wymagania = !prep ? ['Brak.'] : !prep.istnieje ? [`Checklista \`${prep.sciezka}\` nie istnieje — popraw \`operator_prep\` w planie.`]
    : [`Checklista: \`${prep.sciezka}\`.`, '',
    ...(wiszace.length ? wiszace.map((b) => `- [ ] ${b.faza ? `faza ${b.faza}` : 'start'} — ${b.tresc} · ${prep.sciezka}:${b.linia}`)
      : ['Brak nieodhaczonych pozycji blokujących.'])]
  return [
    ...naglowek('Kontekst', nazwa, data, sciezkaPlanu),
    ...zrodla(projekt, plan, sciezkaPlanu),
    '## Plan techniczny', '',
    `Kluczowe pliki, decyzje techniczne, odroczone pytania i wzorce do naśladowania: \`${sciezkaPlanu}\` (sekcje „Kluczowe decyzje`
      + ` techniczne”, „Otwarte pytania”, tabela plików i „Wzorce do naśladowania” w blokach IU).`, '',
    ...designerski(plan),
    '## Wymagania wstępne operatora', '', ...wymagania, '',
    '## Dziennik', '',
  ].join('\n')
}

/** @param {Jednostka} iu @returns {{ linie: string[], operator: string[] }} */
function checkboxyIu(iu) {
  const linie = [
    `### ${iu.id}: ${iu.nazwa} (${iu.delegate})`, '',
    ...iu.pliki.map((p) => `- [ ] ${p.akcja || 'Plik'}: \`${p.sciezka}\``),
    ...iu.scenariusze.filter((s) => s.typ === 'Unit' || s.typ === 'E2E').map((s) => `- [ ] Test: [${s.typ}] ${s.tresc}`),
    ...iu.weryfikacja.map((w) => `- [ ] Weryfikacja: ${w.e2e ? '[E2E] ' : ''}${w.tresc}`), '',
  ]
  const operator = [
    ...iu.operator.map((o) => `- [ ] Operator: ${o} (${iu.id})`),
    ...iu.scenariusze.filter((s) => s.typ === 'Manual').map((s) => `- [ ] [Manual] ${s.tresc} (${iu.id})`),
  ]
  return { linie, operator }
}

/** @param {Plan} plan @param {string} nazwa @param {string} data @param {string} sciezkaPlanu */
function zadaniaZadania(plan, nazwa, data, sciezkaPlanu) {
  const fazy = plan.fazy.flatMap((f) => {
    const iu = f.iu.map(checkboxyIu)
    const operator = iu.flatMap((j) => j.operator)
    return [`## Faza ${f.numer} — ${f.nazwa}`, '', `Zależy od: ${f.zalezyOd || 'Brak'}`, ...(f.rownolegleZ ? [`Równolegle z: ${f.rownolegleZ}`] : []), '',
      ...iu.flatMap((j) => j.linie),
      ...(operator.length ? [`## Operator checklist faza ${f.numer}`, '', ...operator, ''] : [])]
  })
  return [
    ...naglowek('Zadania', nazwa, data, sciezkaPlanu),
    'Checkboxy odsyłają do jednostek planu technicznego (IU-K): cel, podejście, decyzje i teksty są tylko tam.', '',
    ...fazy,
  ].join('\n')
}

/**
 * Liczniki z modelu planu, E2E z wygenerowanego tekstu tym samym grepem co konsumenci (precheck, completion-gate).
 * @param {Plan} plan @param {string} zadania
 * @returns {{ liczniki: Liczniki, bledyBilansu: string[] }}
 */
function bilans(plan, zadania) {
  const iu = plan.fazy.flatMap((f) => f.iu)
  const suma = (/** @type {(j: Jednostka) => number} */ f) => iu.reduce((n, j) => n + f(j), 0)
  const oczekiwaneE2e = suma((j) => j.scenariusze.filter((s) => s.typ === 'E2E').length + j.weryfikacja.filter((w) => w.e2e).length)
  const e2e = liczE2e(zadania)
  const liczniki = {
    fazy: plan.fazy.length,
    iu: iu.length,
    implementacyjne: suma((j) => j.pliki.length),
    testy: suma((j) => j.scenariusze.filter((s) => s.typ === 'Unit' || s.typ === 'E2E').length),
    weryfikacje: suma((j) => j.weryfikacja.length),
    e2e,
    operator: suma((j) => j.operator.length + j.scenariusze.filter((s) => s.typ === 'Manual').length),
  }
  return { liczniki, bledyBilansu: e2e === oczekiwaneE2e ? [] : [`bilans E2E: grep prechecku liczy ${e2e} linii, plan ma ${oczekiwaneE2e} scenariuszy i runnerów`] }
}

/**
 * @param {string} projekt katalog projektu
 * @param {string} sciezkaPlanu plan techniczny wzgledem projektu
 * @param {{ nazwa?: string, data: string }} opcje
 * @returns {Zadanie}
 */
export function zadanieZPlanu(projekt, sciezkaPlanu, opcje) {
  const plan = parsujPlan(readFileSync(join(projekt, sciezkaPlanu), 'utf8'))
  const nazwa = opcje.nazwa ?? nazwaZadania(sciezkaPlanu)
  const prep = przygotowanie(projekt, poleTekstowe(plan, 'operator_prep'))
  const zadania = zadaniaZadania(plan, nazwa, opcje.data, sciezkaPlanu)
  return {
    nazwa,
    katalog: `docs/active/${nazwa}`,
    pliki: {
      plan: planZadania(projekt, plan, nazwa, opcje.data, sciezkaPlanu, prep),
      kontekst: kontekstZadania(projekt, plan, nazwa, opcje.data, sciezkaPlanu, prep),
      zadania,
    },
    ...bilans(plan, zadania),
  }
}
