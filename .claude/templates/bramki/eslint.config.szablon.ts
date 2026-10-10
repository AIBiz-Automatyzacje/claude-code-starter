// Konfiguracja ESLint z szablonu (.claude/templates/bramki) — w projekcie kopiuj jako eslint.config.ts w korzeniu.
// Nazwa w szablonie jest spoza wzorca eslint.config.*: ESLint 10 wzialby plik za konfiguracje katalogu z szablonem.
// Bramka `eslint` (.claude/scripts/bramki): error = porazka do naprawy w domknieciu fazy, warn = lista dla code-quality.
// Sciezka .claude/templates/bramki w tym komentarzu jest znacznikiem: hook error-handling-reminder.sh konczy sie od razu,
// gdy ja widzi (no-console, no-empty i no-floating-promises przejmuja jego prace). Instalacja: README, „Bramki domkniecia”.
// Reguly typowane (typescript-eslint) wymagaja w projekcie typescript < 6.1.
import js from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import type { Linter } from 'eslint'
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
    plugins: { vitest },
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
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
    },
  },
)
