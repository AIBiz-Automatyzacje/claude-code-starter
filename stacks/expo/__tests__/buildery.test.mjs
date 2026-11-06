// Buildery Expo (IU-2.1, D3, D6, D7, D23): pliki ról na szkielecie web. Kontrakt wspólny sprawdzają testy rdzenia na wariancie
// (`szkielet-buildera`, `klasy-rol`, `warstwa-stala`, `odczyt-zakresami`, `reguly-stacku`); tu zostaje to, co należy do stacku Expo.
//
// Uruchomienie: node --test stacks/expo/__tests__/buildery.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const AGENCI = '.claude/agents'
const web = (/** @type {string} */ rola) => readFileSync(join(KORZEN, AGENCI, `${rola}.md`), 'utf8')
const expo = (/** @type {string} */ rola) => readFileSync(join(KORZEN, 'stacks/expo/nakladka', AGENCI, `${rola}.md`), 'utf8')

const PROFIL = JSON.parse(readFileSync(join(KORZEN, 'stacks/expo/nakladka/.claude/stack/profil.json'), 'utf8'))
const SKILLE_UI = ['rn-expo-guidelines', 'ux-ui-guidelines-mobile', 'uniwind']
const SKILLE_DANE = ['supabase-dev-guidelines', 'security', 'sentry-integration']
const SKILLE_FIGMA = ['figma:figma-use', 'figma:figma-design-to-code']
const NARZEDZIA = 'Read, Grep, Glob, Bash, Edit, Write, Skill'

const WSPOLNE_FRONTMATTER = ['description: ', 'skills: ', 'tools: ']
const WSPOLNE_STACKOWE = ['Polecenie workflowu zawiera', '- Wypisz z bloku jednostki', '- Przed zwrotem wyniku uruchom', '- W `odchylenia` wpisujesz']
const WSPOLNE_UI = ['- Gdy polecenie ma blok kontekstu', '- Gdy SPEC.md nie ma pomiaru', '- Gdy jednostka buduje widok', '- Dla każdego pliku z listy', '- Każdy element interaktywny',
  '- Przed pierwszym komponentem sprawdź', '- Klasy Tailwind']

// Linie roli web zależne od stacku: początek linii. Każda inna linia web musi być w Expo dosłownie, więc zmiana kontraktu web zatrzymuje
// test, dopóki ktoś jej nie przeniesie.
/** @type {Record<string, string[]>} */
const ZASTAPIONE = {
  'feature-builder-ui': [...WSPOLNE_FRONTMATTER, ...WSPOLNE_STACKOWE, ...WSPOLNE_UI, 'Wdrażasz jeden Implementation Unit warstwy prezentacji', '- Każdy scenariusz `[Unit]`'],
  'feature-builder-data': [...WSPOLNE_FRONTMATTER, ...WSPOLNE_STACKOWE],
  'feature-builder-fullstack': [...WSPOLNE_FRONTMATTER, ...WSPOLNE_STACKOWE, ...WSPOLNE_UI, '- Testy obu warstw piszesz'],
}
ZASTAPIONE['feature-builder-ui-figma'] = ZASTAPIONE['feature-builder-ui']
ZASTAPIONE['feature-builder-fullstack-figma'] = ZASTAPIONE['feature-builder-fullstack']
const ROLE = Object.keys(ZASTAPIONE)

const skille = (/** @type {string} */ tekst) => (/^skills: \[(.*)\]$/m.exec(tekst)?.[1] ?? '').split(', ')
const narzedzia = (/** @type {string} */ tekst) => /^tools: (.*)$/m.exec(tekst)?.[1] ?? ''
const tresc = (/** @type {string} */ tekst) => tekst.slice(tekst.indexOf('\n---\n') + 5)

for (const rola of ROLE) {
  test(`rola ${rola}: każda linia web jest w Expo dosłownie albo na liście linii stacku`, () => {
    const zExpo = new Set(expo(rola).split('\n'))
    const brak = web(rola).split('\n').filter((l) => l.trim() && !zExpo.has(l) && !ZASTAPIONE[rola].some((p) => l.startsWith(p)))
    assert.deepEqual(brak, [])
  })

  test(`rola ${rola}: lista linii stacku bez wpisów nieaktualnych`, () => {
    const linie = web(rola).split('\n')
    assert.deepEqual(ZASTAPIONE[rola].filter((p) => !linie.some((l) => l.startsWith(p))), [])
  })

  test(`rola ${rola}: bez słów stosu web`, () => {
    assert.doesNotMatch(expo(rola), /vitest|\bVite\b|shadcn|Tailwind|tailwind-react|e2e\/seeds|hover|React 19|`ux-ui-guidelines`|skilla ux-ui-guidelines[^-]/)
  })

  test(`rola ${rola}: samosprawdzenie komendą z profilu, bez expo-doctor; instalacja i przebudowa wg slotów`, () => {
    const t = expo(rola)
    assert.equal(PROFIL.testy.powiazane, 'jest --watchAll=false --findRelatedTests')
    assert.ok(t.includes(`\`npx ${PROFIL.testy.powiazane} <pliki jednostki>\``), 'komenda testów powiązanych z profilu')
    assert.ok(t.includes('`expo-doctor` uruchamia bramka `stack`'), 'doktor należy do bramki')
    assert.ok(t.includes('`.claude/stack/walidacja.md`, sekcja „Runner testów i build”'), 'typecheck na czystym checkoucie')
    assert.ok(t.includes('`.claude/stack/buildery.md`, sekcja „Instalacja zależności”'), 'instalacja paczek')
    assert.match(t, /`eas build` i przebudowy dev-clienta nie uruchamiasz/)
    assert.match(t, /zmianę warstwy natywnej/)
  })

  test(`rola ${rola}: plik flow i seed są deliverablem buildera, a testID istnieje w kodzie`, () => {
    const t = expo(rola)
    assert.ok(t.includes('z nich robisz tylko pliki, które jednostka wymienia w polu Pliki (flow `.maestro/<flow>.yaml`, seed `.maestro/<flow>-seed.sql`)'))
    assert.ok(t.includes('Przed napisaniem pliku flow z pola Pliki przeczytaj `.claude/stack/plan-e2e.md`, sekcja „Linia scenariusza”, i `.claude/skills/mobile-e2e-maestro/SKILL.md`, sekcja „Common gotchas”'))
    assert.match(t, /Każdy `testID` z flow istnieje w kodzie jednostki albo już w repo i stoi na elemencie widocznym w drzewie dostępności/)
  })
}

test('frontmatter: skille równe tabeli builderów w tej samej kolejności, narzędzie Skill', () => {
  assert.deepEqual(skille(expo('feature-builder-ui')), SKILLE_UI)
  assert.deepEqual(skille(expo('feature-builder-data')), SKILLE_DANE)
  assert.deepEqual(skille(expo('feature-builder-fullstack')), [...SKILLE_UI, ...SKILLE_DANE])
  assert.deepEqual(skille(expo('feature-builder-ui-figma')), [...SKILLE_UI, ...SKILLE_FIGMA])
  assert.deepEqual(skille(expo('feature-builder-fullstack-figma')), [...SKILLE_UI, ...SKILLE_DANE, ...SKILLE_FIGMA])
  for (const rola of ['feature-builder-ui', 'feature-builder-data', 'feature-builder-fullstack']) assert.equal(narzedzia(expo(rola)), NARZEDZIA, rola)
})

// Próba IU-2.1: skill z `paths:` ładuje się ze `skills:` tylko po wcześniejszym dotknięciu pasującego pliku w sesji, więc pierwszy
// builder zostaje bez niego, bez błędu. `supabase-dev-guidelines` jest w rdzeniu i ma ten sam problem; opisuje to plan.
test('skille preloadu z nakładki bez paths:, bo inaczej builder dostaje je tylko czasem', () => {
  for (const skill of SKILLE_UI) {
    const plik = readFileSync(join(KORZEN, 'stacks/expo/nakladka/.claude/skills', skill, 'SKILL.md'), 'utf8')
    const frontmatter = plik.slice(0, plik.indexOf('\n---\n', 4))
    assert.doesNotMatch(frontmatter, /^paths:/m, skill)
  }
})

// Próba IU-2.1 na iPhone 17: flow bez centrowania dotknął paska kart nad przyciskiem przy dole ekranu i padł.
test('skill Maestro: pułapka elementu przy dole ekranu stoi w sekcji, do której odsyłają buildery', () => {
  const plik = readFileSync(join(KORZEN, 'stacks/expo/nakladka/.claude/skills/mobile-e2e-maestro/SKILL.md'), 'utf8')
  const sekcja = plik.slice(plik.indexOf('## Common gotchas'), plik.indexOf('## Quick reference'))
  assert.match(sekcja, /\*\*Element przy dole ekranu:\*\*[^\n]*pływającym paskiem kart[^\n]*`centerElement: true`/)
})

test('warianty -figma: treść identyczna z bazowym, narzędzia Figma jak web plus Skill', () => {
  for (const baza of ['feature-builder-ui', 'feature-builder-fullstack']) {
    assert.equal(tresc(expo(`${baza}-figma`)), tresc(expo(baza)), baza)
    assert.equal(narzedzia(expo(`${baza}-figma`)), narzedzia(web(`${baza}-figma`)).replace('Write,', 'Write, Skill,'), baza)
    assert.match(expo(`${baza}-figma`), /^name: .*-figma$/m)
  }
})

test('UI i fullstack: fraza zapobiegania, tokeny, makieta i referencja webowa z Figmy', () => {
  for (const rola of ['feature-builder-ui', 'feature-builder-fullstack']) {
    const t = expo(rola)
    assert.ok(t.includes('checklistą dostępności skilla ux-ui-guidelines-mobile'), rola)
    assert.ok(t.includes('obiecujesz w nim tylko to, co robi kod jednostki'), rola)
    assert.match(t, /sprawdzasz grepem w `global\.css`/, rola)
    assert.match(t, /1 pt z makiety to 1 px w klasie/, rola)
    assert.match(t, /Odpowiedź Figmy to referencja webowa/, rola)
    assert.ok(t.includes('`resources/ai-pitfalls.md`'), rola)
  }
})

test('dane: bez wytycznych UI, hooki zapytań ze skilla pluginu', () => {
  const t = expo('feature-builder-data')
  assert.doesNotMatch(t, /global\.css|ai-pitfalls|checklistą dostępności/)
  assert.ok(t.includes('`expo:expo-data-fetching`'))
})
