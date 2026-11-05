// Hook Stop `mobile-anti-pattern-check.sh` (IU-2.8, D25): naprawione defekty (filtr komentarzy, odesłanie, pliki z poprawnym web API)
// i nowe wzorce. Repo fikcyjne, hook z nakładki.
//
// Uruchomienie: node --test stacks/expo/__tests__/hook.test.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const HOOK = join(KORZEN, 'stacks/expo/nakladka/.claude/hooks/mobile-anti-pattern-check.sh')

/** @param {Record<string, string>} pliki @param {string} [wejscie] */
function uruchom(pliki, wejscie = '{}') {
  const projekt = mkdtempSync(join(tmpdir(), 'hook-expo-'))
  try {
    execFileSync('git', ['-C', projekt, 'init', '-q'])
    for (const [plik, tresc] of Object.entries(pliki)) {
      mkdirSync(dirname(join(projekt, plik)), { recursive: true })
      writeFileSync(join(projekt, plik), tresc)
    }
    return spawnSync('bash', [HOOK], { encoding: 'utf8', input: wejscie, env: { ...process.env, CLAUDE_PROJECT_DIR: projekt } })
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

test('hook jest wykonywalny', () => {
  assert.equal(statSync(HOOK).mode & 0o111, 0o111)
})

test('bez zmienionych plików i przy czystym kodzie RN: kod 0', () => {
  assert.equal(uruchom({}).status, 0)
  const w = uruchom({ 'src/app/index.tsx': "import { View, Text } from 'react-native'\n\nexport default () => <View><Text>ok</Text></View>\n" })
  assert.equal(w.status, 0, w.stderr)
})

const WZORCE = {
  'localStorage/sessionStorage': 'export const x = localStorage.getItem("a")\n',
  'HTML elementy': 'export const x = () => <div>a</div>\n',
  'react-router': "import { Link } from 'react-router-dom'\n",
  'useNavigate/useLocation': 'export const x = () => useNavigate()\n',
  'window./document.': 'export const x = window.innerWidth\n',
  'import.meta.env': 'export const x = import.meta.env.VITE_A\n',
  'SafeAreaView z react-native': "import { View, SafeAreaView } from 'react-native'\n",
  'process.env[...]': "export const x = process.env['EXPO_PUBLIC_A']\n",
}

for (const [nazwa, tresc] of Object.entries(WZORCE)) {
  test(`wzorzec „${nazwa}” blokuje z numerem linii i odesłaniem do reguł stacku`, () => {
    const w = uruchom({ 'src/ekran.tsx': `// wstęp\n${tresc}` })
    assert.equal(w.status, 2, w.stderr)
    assert.ok(w.stderr.includes(nazwa), w.stderr)
    assert.ok(w.stderr.includes('Linia 2'), w.stderr)
    assert.ok(w.stderr.includes('.claude/rules/stack.md, sekcja „Prymitywy RN zamiast DOM i Web API”'), w.stderr)
    assert.ok(!w.stderr.includes('expo-overview'), w.stderr)
  })
}

test('zakomentowany wzorzec nie blokuje (dawny defekt filtra na wyjściu grep -n)', () => {
  const w = uruchom({ 'src/a.ts': '// localStorage.getItem("a")\n  * window.location\nexport const x = 1\n' })
  assert.equal(w.status, 0, w.stderr)
})

test('pliki, w których web API jest poprawne, nie blokują; ten sam kod w zwykłym pliku blokuje', () => {
  const kod = 'export const x = window.location.href\n'
  for (const plik of ['src/a.web.ts', 'src/a.web.tsx', 'src/app/+html.tsx', 'supabase/functions/f/index.ts', 'src/a.test.tsx', '__tests__/a.tsx', 'src/a.d.ts']) {
    assert.equal(uruchom({ [plik]: kod }).status, 0, plik)
  }
  assert.equal(uruchom({ 'src/a.tsx': kod }).status, 2)
})

test('klient Supabase z polyfillem expo-sqlite może użyć localStorage; inne wzorce w tym pliku nadal blokują', () => {
  const klient = "import 'expo-sqlite/localStorage/install'\n\nexport const opcje = { storage: localStorage }\n"
  assert.equal(uruchom({ 'src/lib/supabase.ts': klient }).status, 0)
  assert.equal(uruchom({ 'src/lib/supabase.ts': `${klient}export const u = window.location\n` }).status, 2)
})

test('uprawnienie na false w app config blokuje; true nie blokuje; poza app config nie sprawdza', () => {
  const zla = uruchom({ 'app.json': '{"expo":{"plugins":[["expo-camera",{"cameraPermission":false}]]}}\n' })
  assert.equal(zla.status, 2)
  assert.ok(zla.stderr.includes('Uprawnienie na false'), zla.stderr)
  assert.equal(uruchom({ 'app.config.ts': 'export default { cameraPermission: false }\n' }).status, 2)
  assert.equal(uruchom({ 'app.json': '{"expo":{"plugins":[["expo-camera",{"cameraPermission":"Opis"}]]}}\n' }).status, 0)
  assert.equal(uruchom({ 'docs/a.json': '{"cameraPermission":false}\n' }).status, 0)
})

test('stop_hook_active kończy od razu, bez drugiej blokady w tej turze', () => {
  const w = uruchom({ 'src/a.tsx': 'export const x = window.location\n' }, '{"stop_hook_active": true}')
  assert.equal(w.status, 0)
})

test('settings.patch.json wpina hook do Stop', () => {
  const patch = JSON.parse(readFileSync(join(KORZEN, 'stacks/expo/settings.patch.json'), 'utf8'))
  assert.deepEqual(patch.hooks.Stop, [{ hooks: [{ type: 'command', command: '$CLAUDE_PROJECT_DIR/.claude/hooks/mobile-anti-pattern-check.sh' }] }])
})
