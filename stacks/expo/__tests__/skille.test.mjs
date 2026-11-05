// Skille i ustawienia wariantu Expo (IU-2.7, D2, D6, D7): plugin i blokady w settings.json, lokalne skille stosu, brak odesłań
// do plików z usun.txt. Testy biegną na zbudowanym wariancie, bo tylko tam widać skutek usunięć i podmian.
//
// Uruchomienie: node --test stacks/expo/__tests__/skille.test.mjs

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const { katalog: WARIANT, sprzataj } = przygotujLawke(KORZEN, 'expo')
after(sprzataj)

/** @param {string} sciezka */
const czytaj = (sciezka) => readFileSync(join(WARIANT, sciezka), 'utf8')
/** @param {string} sciezka */
const jest = (sciezka) => existsSync(join(WARIANT, sciezka))

/** @param {string} katalog @returns {string[]} ścieżki względem wariantu */
function pliki(katalog) {
  return readdirSync(join(WARIANT, katalog), { recursive: true, withFileTypes: true })
    .filter((w) => w.isFile())
    .map((w) => relative(WARIANT, join(w.parentPath, w.name)))
}

test('settings.json: plugin expo i blokady feedbacku; reguły jak w próbie D6', () => {
  const ustawienia = JSON.parse(czytaj('.claude/settings.json'))
  assert.equal(ustawienia.enabledPlugins['expo@claude-plugins-official'], true)
  assert.equal(ustawienia.enabledPlugins['expo@expo-plugins'], undefined)
  assert.equal(ustawienia.enabledPlugins['figma@claude-plugins-official'], true, 'warianty -figma wymagają pluginu (D23)')
  assert.deepEqual(ustawienia.permissions.deny, [
    'Bash(npx --yes @expo/agent-cli*)',
    'Bash(npx @expo/agent-cli*)',
    'Bash(*agent-cli*feedback*)',
    'Bash(*submit-expo-feedback*)',
  ])
})

test('settings.json: kolejność kluczy, która nie brudzi drzewa przy plugin install', () => {
  const klucze = Object.keys(JSON.parse(czytaj('.claude/settings.json')))
  assert.equal(klucze[0], 'permissions')
  assert.deepEqual(klucze.slice(-2), ['enabledPlugins', 'extraKnownMarketplaces'])
})

test('doctor zgłasza niezainstalowany plugin expo z komendą instalacji w zakresie projektu', () => {
  const projekt = mkdtempSync(join(tmpdir(), 'expo-doctor-'))
  const dom = mkdtempSync(join(tmpdir(), 'expo-dom-'))
  mkdirSync(join(projekt, '.claude'))
  writeFileSync(join(projekt, '.claude/settings.json'), czytaj('.claude/settings.json'))
  const w = spawnSync(process.execPath, [join(WARIANT, '.claude/scripts/doctor/ustawienia.mjs'), projekt], { encoding: 'utf8', env: { ...process.env, HOME: dom } })
  assert.equal(w.status, 0, w.stderr)
  assert.ok(w.stdout.includes('plugin expo@claude-plugins-official\tUWAGA\tnie zainstalowany\tclaude plugin install expo@claude-plugins-official --scope project'), w.stdout)
})

test('usunięcia: skille i skrypty web znikają, skille Expo są', () => {
  for (const p of ['skills/agent-browser', 'skills/tailwind-react-guidelines', 'skills/ux-ui-guidelines', 'skills/coolify-manager', 'skills/makieta', 'scripts/makieta']) {
    assert.equal(jest(`.claude/${p}`), false, p)
  }
  for (const s of ['expo-stos-szablonu', 'rn-expo-guidelines', 'uniwind', 'mobile-e2e-maestro', 'ux-ui-guidelines-mobile']) {
    assert.ok(jest(`.claude/skills/${s}/SKILL.md`), s)
    assert.match(czytaj(`.claude/skills/${s}/SKILL.md`), new RegExp(`^---\\nname: ${s}\\n`), `${s}: nazwa we frontmatterze`)
  }
  assert.equal(jest('.claude/skills/expo-tailwind-setup'), false, 'wadliwy pin NativeWind v5 preview nie przechodzi')
  assert.equal(jest('.claude/skills/expo-overview'), false, 'hub bez kolizji z expo:expo-overview')
})

test('skill Uniwind: przypięta kopia z licencją i źródłem', () => {
  assert.match(czytaj('.claude/skills/uniwind/ZRODLO.md'), /66bac01484630822d5f8515bbd0aa82fb80ec832/)
  assert.match(czytaj('.claude/skills/uniwind/LICENSE'), /MIT License/)
  assert.ok(jest('.claude/skills/uniwind/references/setup.md'))
})

test('rn-expo-guidelines: krótki SKILL.md, każdy plik z tabeli istnieje i nie ma plików spoza tabeli', () => {
  const skill = czytaj('.claude/skills/rn-expo-guidelines/SKILL.md')
  assert.ok(skill.split('\n').length <= 120, 'SKILL.md do 120 linii (A0.4 §5)')
  const wymienione = [...skill.matchAll(/`references\/([a-z0-9-]+\.md)`/g)].map((m) => m[1]).sort()
  assert.deepEqual([...new Set(wymienione)], readdirSync(join(WARIANT, '.claude/skills/rn-expo-guidelines/references')).sort())
})

test('hub stosu: zakaz feedbacku, E2E przez Maestro, Uniwind, ostrzeżenie o starszym pluginie, bez kopii tabeli wersji', () => {
  const hub = czytaj('.claude/skills/expo-stos-szablonu/SKILL.md')
  assert.match(hub, /Feedback do Expo:\*\* nie wysyłasz/)
  assert.match(hub, /`expo:eas-simulator`/)
  assert.match(hub, /starsza od bieżącego SDK/)
  assert.match(hub, /Uniwind/)
  assert.doesNotMatch(hub, /`expo-tailwind-setup`\s*\|/)
})

test('mobile-e2e-maestro: bez zakazu dev-clienta i bez permissions all allow; kontrakt testera i przyczyny SKIP', () => {
  const m = czytaj('.claude/skills/mobile-e2e-maestro/SKILL.md')
  assert.doesNotMatch(m, /Maestro NIE działa na devbuild/)
  assert.doesNotMatch(m, /all: allow/)
  assert.doesNotMatch(m, /feature-tester-mobile-e2e/)
  assert.doesNotMatch(m, /agent-browser/)
  assert.match(m, /--test-output-dir "\$Z\/maestro\/<flow>"/)
  assert.match(m, /`stopApp` \+ `openLink`, nigdy `launchApp` \+ `openLink`/)
  const { PRZYCZYNY_SKIP } = /** @type {{ PRZYCZYNY_SKIP: Record<string, string> }} */ (JSON.parse(spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { PRZYCZYNY_SKIP } from ${JSON.stringify(join(WARIANT, '.claude/scripts/e2e/ksiegowanie.mjs'))}; console.log(JSON.stringify({ PRZYCZYNY_SKIP }))`], { encoding: 'utf8' }).stdout))
  for (const [przyczyna] of [...m.matchAll(/\| `([a-z-]+)` \|$/gm)].map((t) => [t[1]])) {
    assert.ok(przyczyna in PRZYCZYNY_SKIP, `przyczyna spoza księgowania: ${przyczyna}`)
  }
})

// Pliki rdzenia, które wciąż odsyłają do usuniętego skilla, bo ich wariant Expo robi dalsze IU. Lista kurczy się razem z nimi.
const ZALEGLE_ODESLANIA = [
  '.claude/agents/best-practices-researcher.md', // IU-2.9
  '.claude/agents/feature-builder-fullstack-figma.md', // IU-2.1
  '.claude/agents/feature-builder-fullstack.md', // IU-2.1
  '.claude/agents/feature-builder-ui-figma.md', // IU-2.1
  '.claude/agents/feature-builder-ui.md', // IU-2.1
  '.claude/skills/dev-plan/references/szablon-planu.md', // IU-2.5
  '.claude/stack/buildery.md', // IU-2.5
]
// Nazwy skilli w telemetrii opisują przebiegi wszystkich wariantów; `doctor.sh` sprawdza skrypt coolify warunkowo; fraza w
// `zapobieganie.mjs` to prefiks, który pasuje też do `ux-ui-guidelines-mobile` w builderach Expo (IU-2.1).
const STALE_ODESLANIA = ['.claude/scripts/telemetria/skill.mjs', '.claude/scripts/doctor/doctor.sh', '.claude/scripts/wiedza/zapobieganie.mjs']

// Odesłanie = ścieżka, komenda albo nazwa skilla. Samo słowo „makieta” to zwykły rzeczownik, a `agent-browser` poza ścieżką
// pilnuje strażnik słów stacku.
const ODESLANIE = /skills\/(?:agent-browser|tailwind-react-guidelines|ux-ui-guidelines|coolify-manager|makieta)(?![\w-])|scripts\/makieta|(?<![\w/.-])\/makieta(?![\w-])|makieta\.mjs|(?<![\w/-])(?:ux-ui-guidelines|tailwind-react-guidelines|coolify-manager)(?![\w-])/

test('rdzeń wariantu nie odsyła do plików z usun.txt (poza listą zaległych)', () => {
  const trafione = pliki('.claude').filter((p) => {
    if (p.includes('__tests__') || STALE_ODESLANIA.includes(p)) return false
    return ODESLANIE.test(readFileSync(join(WARIANT, p), 'utf8'))
  })
  assert.deepEqual(trafione.filter((p) => !ZALEGLE_ODESLANIA.includes(p)), [])
  assert.deepEqual(ZALEGLE_ODESLANIA.filter((p) => !trafione.includes(p)), [], 'wpis zaległy już bez odesłania')
})
