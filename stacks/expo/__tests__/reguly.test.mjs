// Reguły stacku Expo (`.claude/rules/stack.md`, IU-2.8, A0.5 §2 i korekty po spike'u SDK 58). Kontrakt wspólny (frontmatter, sekcje, do
// których odsyła rdzeń) sprawdza `.claude/workflows/__tests__/reguly-stacku.test.mjs` na zbudowanym wariancie; tu jest treść Expo.
//
// Uruchomienie: node --test stacks/expo/__tests__/reguly.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const STACK = readFileSync(join(KORZEN, 'stacks/expo/nakladka/.claude/rules/stack.md'), 'utf8')

/** @param {string} nazwa @returns {string} */
function sekcja(nazwa) {
  const start = STACK.indexOf(`\n## ${nazwa}\n`)
  assert.notEqual(start, -1, `brak sekcji ${nazwa}`)
  const koniec = STACK.indexOf('\n## ', start + 1)
  return STACK.slice(start, koniec === -1 ? undefined : koniec)
}

test('sekcje rdzenia mają treść Expo', () => {
  assert.match(sekcja('Organizacja kodu'), /Testy leżą obok plików źródłowych[^\n]*katalog tras \(`src\/app` albo `app`\)[^\n]*`__tests__\/`/)
  assert.match(sekcja('Zależności'), /`npx expo install`/)
  assert.match(sekcja('Bezpieczeństwo'), /`__DEV__`/)
  assert.match(sekcja('Type safety'), /Poza `as const` nie używasz `as`/)
  assert.match(sekcja('Performance'), /Expo Atlas/)
  assert.match(sekcja('Async i React'), /`AbortSignal\.timeout`[^\n]*`signal\.reason`, nie po `error\.name`/)
  assert.match(sekcja('Async i React'), /`experiments\.reactCompiler: true`/)
  assert.match(sekcja('Async i React'), /`render`, `fireEvent`[^.]*wymagają `await`/)
})

test('korekty po spike\'u: Uniwind zamiast NativeWind, helper limitu czasu wypadł, nowe reguły doszły', () => {
  // NativeWind tylko jako wyjątek istniejącego projektu (pilot Nawykometr, W14), bez zaleceń dla nowych projektów.
  const nativewind = STACK.split('\n').filter((l) => /NativeWind/.test(l))
  assert.equal(nativewind.length, 1, nativewind.join('\n'))
  assert.match(nativewind[0], /^- Projekt na NativeWind \(`nativewind` w `package\.json`, bez `uniwind`\) zostaje na nim: .*skill `uniwind` go nie dotyczą/)
  assert.match(sekcja('Stylowanie'), /^- Projekt na NativeWind/m)
  assert.doesNotMatch(STACK, /helper z `AbortController`/)
  assert.doesNotMatch(STACK, /\[D7\]/)
  assert.match(sekcja('Stylowanie'), /klasę `accent-\*` przez `\{prop\}ClassName`/)
  assert.match(sekcja('Stylowanie'), /W `TextInput` na iOS nie używasz `lineHeight`/)
  assert.match(sekcja('Konfiguracja, env i build'), /w dev plik `\.env\*` wygrywa ze zmienną procesu[^.]*wygrywa proces/)
  assert.match(STACK, /^ {2}- "\*\*\/global\.css"$/m)
})

test('D9: domyślny storage sesji Supabase, LargeSecureStore jako opcja', () => {
  assert.match(sekcja('Dane i sieć'), /domyślnym wariancie z `expo-sqlite\/localStorage\/install`/)
  assert.match(sekcja('Dane i sieć'), /`LargeSecureStore` to opcja/)
})

test('bez słów stacku web poza wyliczeniem elementów HTML', () => {
  for (const slowo of ['vite', 'agent-browser', 'shadcn', 'React.lazy', 'size-limit', 'SITE_URL']) {
    assert.ok(!new RegExp(slowo, 'i').test(STACK), slowo)
  }
})
