// Konfiguracja ESLint z szablonu (.claude/templates/bramki) — w projekcie kopiuj jako eslint.config.ts w korzeniu.
// Nazwa w szablonie jest spoza wzorca eslint.config.*: ESLint 10 wzialby plik za konfiguracje katalogu z szablonem.
// Bramka `eslint` (.claude/scripts/bramki): error = porazka do naprawy w domknieciu fazy, warn = lista dla code-quality.
// Sciezka .claude/templates/bramki w tym komentarzu jest znacznikiem: hook error-handling-reminder.sh konczy sie od razu,
// gdy ja widzi (no-console, no-empty i no-floating-promises przejmuja jego prace). Instalacja: README, „Bramki domkniecia”.
// Reguly typowane (typescript-eslint) wymagaja w projekcie typescript < 6.1.
import js from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import type { Linter, Rule } from 'eslint'
import { defineConfig } from 'eslint/config'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const KOD = ['**/*.{ts,tsx}']
const TESTY = ['**/*.{test,spec}.{ts,tsx}', '**/*.test-d.{ts,tsx}']
// Warstwa prezentacji: klient bazy i auth tylko przez hook albo modul z src/lib (bez wyjatku dla ekranow logowania).
const PREZENTACJA = ['src/components/**', 'src/pages/**', 'src/screens/**', 'src/features/**/components/**']

/** Reguly z zestawu typescript-eslint z wymuszonym poziomem; reguly wylaczone zostaja wylaczone. */
function zPoziomem(zestaw: typeof tseslint.configs.recommendedTypeChecked, poziom: 'error' | 'warn', pomin: Set<string>): Linter.RulesRecord {
  const wynik: Linter.RulesRecord = {}
  for (const blok of zestaw) {
    for (const [regula, ustawienie] of Object.entries(blok.rules ?? {})) {
      const opcje: unknown[] = Array.isArray(ustawienie) ? ustawienie.slice(1) : []
      const wylaczona = (Array.isArray(ustawienie) ? ustawienie[0] : ustawienie) === 'off'
      if (!pomin.has(regula)) wynik[regula] = wylaczona ? 'off' : [poziom, ...opcje]
    }
  }
  return wynik
}

// E5-22 (vibersi PR #12): test wyscigu sprawdzal atrape sama liczba wywolan, a `vitest/prefer-called-with` nie obejmuje
// `toHaveBeenCalledTimes`. Selektor AST nie powiaze dwoch asercji jednej atrapy, stad regula lokalna: w callbacku testu
// (it/test, takze it.each i test.x) `expect(x).toHaveBeenCalledTimes(n > 0)` wymaga `toHaveBeenCalledWith`, `NthCalledWith` albo `LastCalledWith` na `x`.
type Wezel = Rule.Node
const SPRAWDZA_ARGUMENTY = new Set(['toHaveBeenCalledWith', 'toHaveBeenNthCalledWith', 'toHaveBeenLastCalledWith', 'toBeCalledWith'])
const LICZY_WYWOLANIA = new Set(['toHaveBeenCalledTimes', 'toBeCalledTimes'])
const FUNKCJE_TESTU = new Set(['it', 'test'])

/** `expect` albo `expect.soft`. */
function czyExpect(w: Wezel): boolean {
  if (w.type === 'Identifier') return w.name === 'expect'
  return w.type === 'MemberExpression' && w.object.type === 'Identifier' && w.object.name === 'expect'
    && w.property.type === 'Identifier' && w.property.name === 'soft'
}

/** `vi.mocked(x)` to ta sama atrapa co `x`. */
function bezMocked(w: Wezel): Wezel {
  const mocked = w.type === 'CallExpression' && w.callee.type === 'MemberExpression' && w.callee.object.type === 'Identifier'
    && w.callee.object.name === 'vi' && w.callee.property.type === 'Identifier' && w.callee.property.name === 'mocked'
  return mocked && w.arguments[0] ? (w.arguments[0] as Wezel) : w
}

/** Atrapa i matcher z `expect(atrapa).matcher(...)` / `expect.soft(...)` (bez `.not`); inny ksztalt — null. */
function asercjaAtrapy(wezel: Wezel, tekst: (w: Wezel) => string): { atrapa: string, matcher: string } | null {
  if (wezel.type !== 'CallExpression' || wezel.callee.type !== 'MemberExpression' || wezel.callee.property.type !== 'Identifier') return null
  const obiekt = wezel.callee.object
  if (obiekt.type !== 'CallExpression' || !czyExpect(obiekt.callee as Wezel) || !obiekt.arguments[0]) return null
  return { atrapa: tekst(bezMocked(obiekt.arguments[0] as Wezel)), matcher: wezel.callee.property.name }
}

/** Callback testu (ostatni argument `it(...)`, `test(...)`, `it.each(...)(...)`, `test.concurrent(...)`) obejmujacy wezel; poza testem — Program. */
function zakresTestu(przodkowie: Wezel[]): Wezel {
  for (let i = przodkowie.length - 1; i > 0; i--) {
    const funkcja = przodkowie[i]
    const wywolanie = przodkowie[i - 1]
    if (funkcja.type !== 'ArrowFunctionExpression' && funkcja.type !== 'FunctionExpression') continue
    if (wywolanie.type !== 'CallExpression') continue
    let nazwa: Wezel = wywolanie.callee as Wezel
    while (nazwa.type === 'MemberExpression' || nazwa.type === 'CallExpression') nazwa = (nazwa.type === 'MemberExpression' ? nazwa.object : nazwa.callee) as Wezel
    if (nazwa.type === 'Identifier' && FUNKCJE_TESTU.has(nazwa.name)) return funkcja
  }
  return przodkowie[0]
}

const atrapaZArgumentami: Rule.RuleModule = {
  meta: { type: 'problem', messages: { liczba: 'Atrapa `{{atrapa}}` sprawdzana sama liczba wywolan — dodaj toHaveBeenCalledWith (albo Nth/LastCalledWith) tej atrapy w tym tescie.' } },
  create(context) {
    const zakresy = new Map<Wezel, { liczby: { atrapa: string, wezel: Wezel }[], zArgumentami: Set<string> }>()
    const tekst = (w: Wezel): string => context.sourceCode.getText(w)
    return {
      CallExpression(wezel) {
        const asercja = asercjaAtrapy(wezel, tekst)
        if (!asercja) return
        const zakres = zakresTestu(context.sourceCode.getAncestors(wezel) as Wezel[])
        const wpis = zakresy.get(zakres) ?? { liczby: [], zArgumentami: new Set<string>() }
        zakresy.set(zakres, wpis)
        if (SPRAWDZA_ARGUMENTY.has(asercja.matcher)) wpis.zArgumentami.add(asercja.atrapa)
        const [n] = wezel.arguments
        const zero = n?.type === 'Literal' && n.value === 0
        if (LICZY_WYWOLANIA.has(asercja.matcher) && !zero) wpis.liczby.push({ atrapa: asercja.atrapa, wezel })
      },
      'Program:exit'() {
        for (const { liczby, zArgumentami } of zakresy.values()) {
          for (const { atrapa, wezel } of liczby) if (!zArgumentami.has(atrapa)) context.report({ node: wezel, messageId: 'liczba', data: { atrapa } })
        }
      },
    }
  },
}

const rekomendowane = zPoziomem(tseslint.configs.recommendedTypeChecked, 'error', new Set())
// strictTypeChecked jako warn tylko dla regul spoza recommended — inaczej pozniejszy blok obnizylby error do warn.
const scisle = zPoziomem(tseslint.configs.strictTypeChecked, 'warn', new Set(Object.keys(rekomendowane)))

export default defineConfig(
  // Plik konfiguracji poza lintem: nie nalezy do zadnego tsconfig projektu, a reguly typowane wymagaja projektu TS.
  // .claude/ to maszyneria z szablonu (sync-template), nie kod projektu.
  { ignores: ['eslint.config.ts', '.claude/**', '**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.stryker-tmp/**', '**/*.d.ts', '**/database.types.ts'] },
  js.configs.recommended,
  {
    files: KOD,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    // react-hooks bez pola `configs`: jego `configs.flat` nie pasuje do typu Plugin z ESLint 10 (TS2322), a projekt, ktory
    // sprawdza typy plikow konfiguracji (`include` z `*.config.ts`), dostalby blad tsc w pierwszej fazie (vibersi, 6a pkt 80).
    plugins: { '@typescript-eslint': tseslint.plugin, 'import-x': importX, 'react-hooks': { meta: reactHooks.meta, rules: reactHooks.rules } },
    // Ustawienia typescript z import-x (parsery, rozszerzenia) — bez nich no-cycle nie widzi cyklu miedzy plikami .ts.
    settings: { ...importX.flatConfigs.typescript.settings, 'import-x/resolver-next': [createTypeScriptImportResolver()] },
    rules: {
      ...rekomendowane,
      ...scisle,
      // Reguly bazowe, ktore TypeScript sprawdza lepiej (jak w configs.eslintRecommended typescript-eslint).
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-console': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      // Prog 360/60 = progi z coding-rules (sekcja „Pilnuje ESLint”, test coding-rules.test.mjs pilnuje zgodnosci); ten sam prog ma bot PR.
      'max-lines': ['error', { max: 360, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'import-x/order': ['error', { groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'], 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
      // React Compiler (react-hooks v6+): regula hookow i czystosci renderu jako bledy.
      ...reactHooks.configs.flat['recommended-latest'].rules,
    },
  },
  {
    files: PREZENTACJA,
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@supabase/supabase-js', '@supabase/ssr', '**/lib/supabase', '**/lib/supabase/**', '**/lib/supabase-*'],
          message: 'Klient Supabase (baza i auth) tylko przez hook z src/hooks albo modul z src/lib — takze w ekranach logowania.',
        }],
      }],
    },
  },
  {
    files: TESTY,
    plugins: { vitest, lokalne: { rules: { 'atrapa-z-argumentami': atrapaZArgumentami } } },
    rules: {
      // Opis testu (describe) przekracza 60 linii z natury; rozmiar pliku testow nadal liczony.
      'max-lines-per-function': 'off',
      'no-console': 'off',
      // Slabe asercje: test bez expect, expect w warunku, toHaveBeenCalled bez argumentow, expect poza testem.
      // Testy typow (*.test-d.ts) asercje robia expectTypeOf/assertType.
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expectTypeOf', 'assertType'] }],
      'vitest/valid-expect': 'error',
      'vitest/no-conditional-expect': 'error',
      'vitest/no-standalone-expect': 'error',
      'vitest/prefer-called-with': 'error',
      'lokalne/atrapa-z-argumentami': 'error',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
    },
  },
)
