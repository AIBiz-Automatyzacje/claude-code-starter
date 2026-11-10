// Tester E2E Expo (IU-2.2, D17, D22): plik roli na szkielecie web i skrypt `expo-flow.mjs`. Kontrakt wspólny sprawdzają testy rdzenia na
// wariancie (`tester-e2e`, `tester-porcje`, `e2e-manual`). Komendy systemowe i Maestro to atrapy; próbę na urządzeniu opisuje plan.
//
// Uruchomienie: node --test stacks/expo/__tests__/tester.test.mjs

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const { katalog: WARIANT, sprzataj } = przygotujLawke(KORZEN, 'expo')
after(sprzataj)
const flowy = await import(pathToFileURL(join(WARIANT, '.claude/scripts/e2e/expo-flow.mjs')).href)

const ROLA = '.claude/agents/feature-tester-e2e.md'
const tester = readFileSync(join(WARIANT, ROLA), 'utf8')
const web = readFileSync(join(KORZEN, ROLA), 'utf8')

// Linie roli web o narzędziu jazdy, które Expo ma własne: początek linii. Każda inna linia web musi być w Expo dosłownie (po podmianie
// katalogów), więc zmiana kontraktu web zatrzymuje test, dopóki ktoś jej nie przeniesie.
const ZASTAPIONE = [
  'description: ', 'skills: ', 'Odgrywasz w przeglądarce', 'Polecenie workflowu podaje', 'Scenariusz to niezaznaczona', 'Skrypt `.claude/scripts/e2e/e2e.mjs` podaje',
  '- Przy zerze scenariuszy', '- Jedna linia `[E2E]` to', '- Gdy skill weryfikacji projektu istnieje', '- W trybie `bez-interakcji` nie uruchamiasz', '- W trybie `interaktywny` zacznij',
  '- Własnego serwera nie stawiasz', '- Ustaw viewport', '- Prowadź scenariusz pętlą', '- Oczekiwany stan sprawdź', '- Zrzut zapisujesz', '- Każdy zrzut robisz', '  1. Zamknij sesję', '  2. Próbny zrzut przerwany',
  '  3. Próbny zrzut zapisany', '  4. Próbny zrzut zapisany', '  5. Porównanie z makietą', '  Zrzutu nie obchodzisz', '- PASS: oczekiwany stan', '- SKIP z przyczyną `srodowisko`', '- Plik zadań i kod zostają',
  '- Dla każdego ekranu fazy odczytaj', '- (próbny zrzut przerwany', '- Po `wait --load networkidle`', '- Każda para dostaje', '- W trybie `bez-interakcji` zrzutu',
]

test('rola: każda linia web jest w Expo dosłownie albo na liście linii narzędzia jazdy', () => {
  const zExpo = new Set(tester.split('\n'))
  const naKatalogach = (/** @type {string} */ l) => l.replaceAll('e2e/seeds/*.sql', '.maestro/*-seed.sql').replaceAll('e2e/seeds/', '.maestro/').replaceAll('`e2e/<etap>', '`.maestro/<etap>')
  const brak = web.split('\n').map(naKatalogach).filter((l) => l.trim() && !zExpo.has(l) && !ZASTAPIONE.some((p) => l.startsWith(p)))
  assert.deepEqual(brak, [])
})

// Punkt 30: wybór ekranów fazy (pola Makiety jednostek, reguła zapasowa) nie zależy od narzędzia jazdy. Kopia roli w dashboardzie
// i aa-exam rozjechała się z szablonem, więc linia reguły ma być w obu stackach ta sama co do znaku.
test('rola (punkt 30): reguła wyboru ekranów fazy do porównania z makietą jest w web i Expo dosłownie ta sama', () => {
  const regula = (/** @type {string} */ rola) => rola.split('\n').filter((l) => l.includes('Porównujesz tylko ekrany fazy'))
  assert.equal(regula(web).length, 1)
  assert.deepEqual(regula(tester), regula(web))
  assert.ok(!ZASTAPIONE.some((p) => regula(web)[0].startsWith(p)), 'linia reguły nie jest na liście linii narzędzia jazdy')
  for (const rola of [web, tester]) {
    assert.match(rola, /a każdy ekran fazy nadal idzie do człowieka/)
    assert.match(rola, /makiety fazy i linię runnera/)
    assert.match(rola, /^- Przy zerze scenariuszy i zerze ekranów fazy \(sekcja o makietach\) zwróć od razu/m)
    assert.doesNotMatch(rola.slice(rola.indexOf('### Makiety')), /każdy ekran z `figma_screens`|Dla każdego ekranu odczytaj/)
  }
})

test('rola: lista zastąpionych linii bez wpisów nieaktualnych', () => {
  const linie = web.split('\n')
  assert.deepEqual(ZASTAPIONE.filter((p) => !linie.some((l) => l.startsWith(p))), [])
})

test('rola: frontmatter jak web, bez przeglądarki i bez narzędzi zapisu', () => {
  assert.match(tester, /^---\nname: feature-tester-e2e\n/)
  assert.match(tester, /^skills: \[mobile-e2e-maestro\]$/m)
  assert.match(tester, /^tools: Read, Grep, Glob, Bash$/m)
  assert.doesNotMatch(tester, /agent-browser|viewport|przeglądark/i)
  assert.doesNotMatch(tester, /e2e\/seeds|e2e\/<etap>/)
})

test('rola (IU-2.2): flow z linii także przy braku pliku, SKIP bez findingu OPERATOR, nie bootuje i nie pisze do .maestro', () => {
  assert.match(tester, /„brak flow: builder nie dostarczył `\.maestro\/<flow>\.yaml` z pola Pliki jednostki”, `plik` = oczekiwana ścieżka, i wpis SKIP z przyczyną `scenariusz-niewykonalny` i polem `flow` z linii/)
  assert.match(tester, /urządzenia nie włączasz, dev-clienta nie budujesz ani nie instalujesz/)
  assert.match(tester, /do `\.maestro\/` nie piszesz/)
  assert.match(tester, /Flow bez asercji tego stanu to wpis FAIL i finding P2 typ E2E/)
  assert.match(tester, /`node \.claude\/scripts\/e2e\/expo-flow\.mjs --zadanie <folder> --flow <flow>`/)
  assert.match(tester, /`~\/Library\/Logs\/DiagnosticReports\/<App>-\*\.ips`/)
  assert.match(tester, /`postgres`, a użytkownik w roli `authenticated`/)
})

const BUNDLE = 'com.example.app'
const APP_JSON = JSON.stringify({ expo: { scheme: 'przyklad', ios: { bundleIdentifier: BUNDLE }, android: { package: 'com.example.android' } } })

/** @param {{ flow?: boolean }} [o] @returns {{ projekt: string, app: string, dataPath: string }} */
function uklad({ flow = true } = {}) {
  const projekt = mkdtempSync(join(tmpdir(), 'expo-flow-'))
  writeFileSync(join(projekt, 'app.json'), APP_JSON)
  utimesSync(join(projekt, 'app.json'), 1000, 1000)
  mkdirSync(join(projekt, '.maestro'))
  if (flow) writeFileSync(join(projekt, '.maestro/notatki.yaml'), 'appId: x\n')
  const baza = mkdtempSync(join(tmpdir(), 'expo-flow-sym-'))
  const app = join(baza, 'Przyklad.app')
  mkdirSync(app)
  const dataPath = join(baza, 'dane')
  mkdirSync(join(dataPath, 'Library/Accounts'), { recursive: true })
  writeFileSync(join(dataPath, 'Library/Accounts/Accounts3.sqlite'), '')
  mkdirSync(join(dataPath, 'Containers/Bundle/Application/X'), { recursive: true })
  writeFileSync(join(dataPath, 'Containers/Bundle/Application/X/.com.apple.mobile_container_manager.metadata.plist'), `bplist${BUNDLE}`)
  return { projekt, app, dataPath }
}

/** @param {string} app @param {string} dataPath @param {string} stan @returns {{ wykonaj: (k: string, a: string[]) => { status: number, stdout: string, stderr: string }, wywolania: string[] }} */
function atrapa(app, dataPath, stan) {
  /** @type {string[]} */
  const wywolania = []
  const wykonaj = (/** @type {string} */ k, /** @type {string[]} */ a) => {
    wywolania.push(`${k} ${a.join(' ')}`)
    if (k === 'sqlite3') return { status: 0, stdout: '0\n', stderr: '' }
    if (k === 'codesign') return { status: 0, stdout: '', stderr: 'Executable=/x' }
    if (k === 'adb') return { status: 0, stdout: 'List of devices attached\n', stderr: '' }
    if (a[1] === 'list') return { status: 0, stdout: JSON.stringify({ devices: { r: [{ udid: 'UDID-1', name: 'iPhone 17', state: stan, dataPath, isAvailable: true, deviceTypeIdentifier: 'iPhone-17' }] } }), stderr: '' }
    if (a[1] === 'get_app_container') return { status: 0, stdout: app, stderr: '' }
    return { status: 0, stdout: '', stderr: '' }
  }
  return { wykonaj, wywolania }
}

const ENV = { E2E_URL: 'http://127.0.0.1:8081', E2E_TEST_EMAIL: 'e2e@x.pl', E2E_TEST_PASSWORD: 'tajne-haslo', MAESTRO_KLUCZ: 'tajny-klucz', SUPABASE_E2E_DB_URL: 'postgres://nie-do-flow' }

test('odegranie: urządzenie adaptera, zmienne konta i MAESTRO_* w środowisku, dowody w katalogu zadania, zrzuty w wyniku', async () => {
  const { projekt, app, dataPath } = uklad()
  const { wykonaj } = atrapa(app, dataPath, 'Booted')
  /** @type {{ argumenty?: string[], cwd?: string, sekrety?: string[], srodowisko?: Record<string, string> }} */
  const zapis = {}
  const maestro = async (/** @type {string[]} */ argumenty, /** @type {string} */ cwd, /** @type {{ sekrety: string[], srodowisko: Record<string, string> }} */ zmienne) => {
    Object.assign(zapis, { argumenty, cwd, ...zmienne })
    // Układ wyjścia prawdziwego Maestro 2.5.1: zrzut nazwany, zrzut kroku opcjonalnego i porażki, zapis komend z wartościami zmiennych.
    const katalog = argumenty[argumenty.indexOf('--test-output-dir') + 1]
    mkdirSync(join(katalog, 'screenshots'), { recursive: true })
    mkdirSync(join(katalog, '2026-11-05_233359'), { recursive: true })
    writeFileSync(join(katalog, 'screenshots/notatka.png'), 'png')
    writeFileSync(join(katalog, '2026-11-05_233359/screenshot-⚠️-1-(notatki.yaml).png'), 'png')
    writeFileSync(join(katalog, '2026-11-05_233359/screenshot-❌-2-(notatki.yaml).png'), 'png')
    writeFileSync(join(katalog, '2026-11-05_233359/commands-(notatki.yaml).json'), 'tajne-haslo')
    return { kod: 0, ogon: 'Flow Passed' }
  }
  const w = await flowy.odegrajFlow({ projekt, zadanie: 'docs/active/z', flow: 'notatki', env: ENV, wykonajKomende: wykonaj, maestro })
  assert.deepEqual(w, { status: 'ok', flow: 'notatki', kod: 0, ogon: 'Flow Passed', urzadzenie: 'iPhone 17', katalog: 'docs/active/z/maestro/notatki',
    zrzuty: ['docs/active/z/maestro/notatki/blad-1.png', 'docs/active/z/maestro/notatki/notatka.png'] })
  assert.deepEqual(readdirSync(join(projekt, 'docs/active/z/maestro/notatki')).sort(), ['blad-1.png', 'notatka.png'], 'w repo tylko zrzuty, bez zapisu komend z hasłem')
  assert.equal(zapis.cwd, projekt)
  assert.deepEqual(zapis.sekrety, ['tajne-haslo', 'tajny-klucz'])
  assert.deepEqual(zapis.srodowisko, { MAESTRO_KLUCZ: 'tajny-klucz', MAESTRO_E2E_EMAIL: 'e2e@x.pl', MAESTRO_E2E_PASSWORD: 'tajne-haslo' })
  const argumenty = zapis.argumenty ?? []
  const robocze = argumenty[argumenty.indexOf('--test-output-dir') + 1]
  assert.ok(!robocze.startsWith(projekt), 'Maestro pisze poza repo')
  assert.equal(existsSync(robocze), false, 'katalog roboczy usunięty')
  assert.deepEqual(argumenty, ['--device', 'UDID-1', 'test', '--test-output-dir', robocze, '--debug-output', argumenty[argumenty.indexOf('--debug-output') + 1],
    '-e', `APP_ID=${BUNDLE}`, '-e', 'APP_SCHEME=przyklad', '-e', 'METRO_URL=http%3A%2F%2F127.0.0.1%3A8081', '.maestro/notatki.yaml'])
})

test('odegranie: argumenty prawdziwego procesu bez wartości konta i MAESTRO_*, wartości w środowisku procesu', async () => {
  const { projekt, app, dataPath } = uklad()
  const { wykonaj } = atrapa(app, dataPath, 'Booted')
  const bin = mkdtempSync(join(tmpdir(), 'atrapa-maestro-'))
  writeFileSync(join(bin, 'maestro'), `#!/bin/sh\nprintf '%s\\n' "$@" > "${bin}/argv"\nenv > "${bin}/env"\n`, { mode: 0o755 })
  const sciezka = process.env.PATH
  try {
    process.env.PATH = `${bin}:${sciezka}`
    const w = await flowy.odegrajFlow({ projekt, zadanie: 'z', flow: 'notatki', env: ENV, wykonajKomende: wykonaj })
    assert.equal(w.status, 'ok')
    const argv = readFileSync(join(bin, 'argv'), 'utf8')
    for (const zakazane of ['e2e@x.pl', 'tajne-haslo', 'tajny-klucz', 'MAESTRO_', 'E2E_']) assert.ok(!argv.includes(zakazane), `argumenty procesu zawierają: ${zakazane}`)
    assert.ok(argv.includes(`APP_ID=${BUNDLE}`), 'zmienne jawne zostają w -e')
    const srodowisko = readFileSync(join(bin, 'env'), 'utf8').split('\n')
    for (const wpis of ['MAESTRO_E2E_EMAIL=e2e@x.pl', 'MAESTRO_E2E_PASSWORD=tajne-haslo', 'MAESTRO_KLUCZ=tajny-klucz']) assert.ok(srodowisko.includes(wpis), wpis.split('=')[0])
  } finally {
    process.env.PATH = sciezka
    rmSync(bin, { recursive: true, force: true })
  }
})

test('odegranie: zapis komend znika także przy wyjątku Maestro', async () => {
  const { projekt, app, dataPath } = uklad()
  const { wykonaj } = atrapa(app, dataPath, 'Booted')
  /** @type {string} */
  let robocze = ''
  const maestro = async (/** @type {string[]} */ a) => {
    robocze = a[a.indexOf('--test-output-dir') + 1]
    mkdirSync(robocze, { recursive: true })
    writeFileSync(join(robocze, 'commands-(x).json'), 'tajne-haslo')
    throw new Error('awaria')
  }
  await assert.rejects(flowy.odegrajFlow({ projekt, zadanie: 'z', flow: 'notatki', env: ENV, wykonajKomende: wykonaj, maestro }), /awaria/)
  assert.equal(existsSync(robocze), false)
})

test('odegranie: wynik według kodu Maestro; plik podany wprost zamiast domyślnego', async () => {
  const { projekt, app, dataPath } = uklad()
  const { wykonaj } = atrapa(app, dataPath, 'Booted')
  const zKodem = (/** @type {number | string | null} */ kod) => async () => ({ kod, ogon: 'ogon' })
  const odegraj = (/** @type {number | string | null} */ kod) => flowy.odegrajFlow({ projekt, zadanie: 'z', flow: 'notatki', env: ENV, wykonajKomende: wykonaj, maestro: zKodem(kod) })
  assert.equal((await odegraj(1)).status, 'porazka')
  assert.equal((await odegraj('SIGKILL')).status, 'zawieszony')
  assert.equal((await odegraj('spawn maestro ENOENT')).status, 'blad-maestro')
  writeFileSync(join(projekt, 'z/inny.yaml'), 'appId: x\n')
  /** @type {string[]} */
  let argumenty = []
  const w = await flowy.odegrajFlow({ projekt, zadanie: 'z', flow: 'visual-diff-ekran', plik: 'z/inny.yaml', env: ENV, wykonajKomende: wykonaj, maestro: async (/** @type {string[]} */ a) => { argumenty = a; return { kod: 0, ogon: '' } } })
  assert.equal(w.status, 'ok')
  assert.equal(argumenty.at(-1), 'z/inny.yaml')
  assert.ok(existsSync(join(projekt, 'z/maestro/visual-diff-ekran')))
})

test('odegranie: brak pliku flow = status bez Maestro i bez katalogu dowodów', async () => {
  const { projekt, app, dataPath } = uklad({ flow: false })
  const { wykonaj } = atrapa(app, dataPath, 'Booted')
  const zaden = async () => { throw new Error('Maestro nie może ruszyć bez pliku flow') }
  assert.deepEqual(await flowy.odegrajFlow({ projekt, zadanie: 'z', flow: 'notatki', env: ENV, wykonajKomende: wykonaj, maestro: zaden }), { status: 'brak-flow', flow: 'notatki', plik: '.maestro/notatki.yaml' })
  assert.equal(existsSync(join(projekt, 'z/maestro')), false)
})

test('urządzenie: wybór włączonego bez boot; wyłączony symulator = brak-urzadzenia, bez włączania', () => {
  const { projekt, app, dataPath } = uklad()
  const wlaczony = atrapa(app, dataPath, 'Booted')
  assert.deepEqual(flowy.urzadzenieTestera({ projekt, env: ENV, wykonajKomende: wlaczony.wykonaj }), { status: 'gotowe', platforma: 'ios', id: 'UDID-1', nazwa: 'iPhone 17', uwagi: [] })
  const wylaczony = atrapa(app, dataPath, 'Shutdown')
  const w = flowy.urzadzenieTestera({ projekt, env: ENV, wykonajKomende: wylaczony.wykonaj })
  assert.equal(w.status, 'brak-urzadzenia')
  assert.match(w.detal, /brak urządzenia do E2E/)
  assert.deepEqual(wylaczony.wywolania.filter((c) => c.includes(' boot ')), [])
})
