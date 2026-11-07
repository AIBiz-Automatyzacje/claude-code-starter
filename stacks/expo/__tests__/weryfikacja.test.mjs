// Skill weryfikacji w wariancie Expo (IU-2.6, D24): trasy z plików Expo Router, selektor `testID`, slot przejścia na żywo i wiedza z dawnego
// `e2e-setup`. Kontrakt wspólny sprawdzają testy rdzenia na wariancie (`szkielet`, `sloty-skilli`). Przebieg na urządzeniu opisuje plan.
//
// Uruchomienie: node --test stacks/expo/__tests__/weryfikacja.test.mjs

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const { katalog: WARIANT, sprzataj } = przygotujLawke(KORZEN, 'expo')
after(sprzataj)
const modul = (/** @type {string} */ plik) => import(pathToFileURL(join(WARIANT, '.claude/scripts/e2e', plik)).href)
const { trasyAplikacji, szkieletSkilla } = await modul('szkielet.mjs')
const { SZKIELET_WERYFIKACJI } = await modul('adapter.mjs')
const czytaj = (/** @type {string} */ sciezka) => readFileSync(join(WARIANT, sciezka), 'utf8')

/** @param {Record<string, string>} pliki @returns {string} */
function projekt(pliki) {
  const k = mkdtempSync(join(tmpdir(), 'expo-trasy-'))
  after(() => rmSync(k, { recursive: true, force: true }))
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(dirname(join(k, p)), { recursive: true })
    writeFileSync(join(k, p), t)
  }
  return k
}

const ZALEZNOSCI = JSON.stringify({ name: 'apka', dependencies: { expo: '58.0.0', 'expo-router': '58.0.0' } })
const EKRAN = 'export default function E() { return null }\n'

test('trasy Expo Router: pliki w src/app bez układów i plików specjalnych, grupy poza adresem, index jako katalog', () => {
  const k = projekt({
    'package.json': ZALEZNOSCI,
    'src/app/_layout.tsx': EKRAN,
    'src/app/+not-found.tsx': EKRAN,
    'src/app/+html.tsx': EKRAN,
    'src/app/+native-intent.ts': EKRAN,
    'src/app/+middleware.ts': EKRAN,
    'src/app/index.tsx': EKRAN,
    'src/app/explore.tsx': EKRAN,
    'src/app/(tabs)/_layout.tsx': EKRAN,
    'src/app/(tabs)/profil.tsx': EKRAN,
    'src/app/notatki/index.tsx': EKRAN,
    'src/app/notatki/[id].tsx': EKRAN,
    'src/app/ustawienia.ios.tsx': EKRAN,
    'src/app/ustawienia.android.tsx': EKRAN,
    'src/app/wyslij+api.ts': EKRAN,
    'src/app/__tests__/index.test.tsx': EKRAN,
    'src/components/karta.tsx': EKRAN,
  })
  assert.deepEqual(trasyAplikacji(k).trasy, ['/', '/explore', '/notatki', '/notatki/[id]', '/profil', '/ustawienia'])
})

test('trasy Expo Router: katalog app/ w korzeniu; bez expo-router w zależnościach pliki nie są trasami', () => {
  assert.deepEqual(trasyAplikacji(projekt({ 'package.json': ZALEZNOSCI, 'app/index.tsx': EKRAN, 'app/konto.tsx': EKRAN })).trasy, ['/', '/konto'])
  assert.deepEqual(trasyAplikacji(projekt({ 'package.json': JSON.stringify({ dependencies: { expo: '58.0.0' } }), 'src/app/router.tsx': EKRAN })).trasy, [])
  assert.deepEqual(trasyAplikacji(projekt({ 'src/app/router.tsx': EKRAN })).trasy, [])
})

test('szkielet: selektory testID, bez przeglądarki i bez data-testid', () => {
  const zTestId = projekt({ 'package.json': ZALEZNOSCI, 'src/app/index.tsx': '<Pressable testID="a" /><View testID="b" /><View data-testid="nie" />\n' })
  const s = szkieletSkilla(zTestId, { wpisowMapy: 0 })
  assert.match(s, /kod ma 2 atrybutów `testID`/)
  assert.match(s, /prowadzenie aplikacji na urządzeniu \(Drive\)/)
  assert.match(s, /\(etykiety, role, testID\)/)
  assert.doesNotMatch(s, /przeglądark|data-testid|agent-browser/)
})

test('szkielet: dowód przez expo-flow, bez --test-output-dir w folderze zadania (tam Maestro zapisuje hasło)', () => {
  assert.match(SZKIELET_WERYFIKACJI.drive, /expo-flow\.mjs/)
  assert.match(SZKIELET_WERYFIKACJI.evidence, /`node \.claude\/scripts\/e2e\/expo-flow\.mjs --zadanie <folder zadania> --flow <flow>`/)
  assert.doesNotMatch(SZKIELET_WERYFIKACJI.evidence, /--test-output-dir/)
})

test('slot weryfikacja-setup: przejście na żywo przez expo-flow poza śledzonymi plikami, sekcje z wiedzą dawnego e2e-setup', () => {
  const slot = czytaj('.claude/skills/weryfikacja-setup/references/stack.md')
  const sekcja = slot.slice(slot.indexOf('## Przejście na żywo'))
  assert.match(sekcja, /`node \.claude\/scripts\/e2e\/expo-flow\.mjs --zadanie \.expo\/weryfikacja-setup --flow przejscie --plik \.expo\/weryfikacja-setup\/przejscie\.yaml`/)
  assert.match(sekcja, /`stopApp`[^\n]*`openLink`/)
  assert.match(slot, /`testID`/)
  // Lekcje A0.6 i pułapki 6–8, 10, 11 dawnego e2e-setup (D24).
  assert.match(slot, /launchApp[^\n]*DEVELOPMENT SERVERS|DEVELOPMENT SERVERS[^\n]*launchApp/)
  assert.match(slot, /Continue/)
  assert.match(slot, /`<App>\.app\/<App>\.debug\.dylib`/)
  assert.match(slot, /`__DEV__`[^\n]*`preview`|`preview`[^\n]*`__DEV__`/)
  assert.match(slot, /`EXPO_PUBLIC_E2E_TEST_USER_EMAIL`/)
  assert.match(slot, /kont(?:o|em) Apple/)
  assert.match(slot, /Otworzyć w/)
  assert.match(slot, /`centerElement: true`/)
  assert.doesNotMatch(slot, /agent-browser|przeglądark/)
})
