// Lint repo szablonu (It. 1, krok 0). Dwie konfiguracje:
// - skrypty i testy Node (.mjs) — zwykle moduly ES,
// - workflowy (.claude/workflows/*.js) — skrypty runtime'u Workflow z `export const meta`, `return` i `await`
//   na gornym poziomie; zaden parser tego nie przyjmie wprost, wiec procesor owija zrodlo tak samo jak runtime
//   i test skladni (`__tests__/skladnia-workflowow.test.mjs`), a numery linii przesuwa z powrotem o 1.
import js from '@eslint/js'
import globals from 'globals'

const OPAKOWANIE_START = '(async () => {\n'

const procesorWorkflowow = {
  meta: { name: 'workflow-runtime' },
  preprocess(tekst) {
    return [OPAKOWANIE_START + tekst.replace(/^export\s+const\s/m, 'const ') + '\n})()']
  },
  postprocess(komunikaty) {
    // `meta` czyta runtime Workflow (eksport), nie sam skrypt — po zdjeciu `export` wyglada na nieuzywane.
    const czyEksportMeta = (k) => k.ruleId === 'no-unused-vars' && k.line === 2 && /'meta'/.test(k.message)
    return komunikaty.flat().filter((k) => !czyEksportMeta(k)).map((k) => ({
      ...k,
      line: k.line - 1,
      ...(k.endLine ? { endLine: k.endLine - 1 } : {}),
    }))
  },
  supportsAutofix: false,
}

// API runtime'u Workflow dostepne w skrypcie bez importu.
const GLOBALNE_WORKFLOWU = {
  agent: 'readonly',
  args: 'readonly',
  budget: 'readonly',
  log: 'readonly',
  parallel: 'readonly',
  phase: 'readonly',
  pipeline: 'readonly',
  workflow: 'readonly',
}

export default [
  {
    ignores: ['node_modules/**', 'docs/**', '.claude/.backups/**', 'compound-engineering-plugin-main/**'],
  },
  js.configs.recommended,
  {
    // Wzorzec „kopia bez pol”: `({ pomijane, ...reszta }) => reszta` — pominiete pola sa celowo nieuzywane.
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
      // coding-rules §9: zero dynamicznego wykonywania kodu. Wyjatek (testy wycinajace funkcje z workflowow)
      // oznaczany komentarzem eslint-disable z uzasadnieniem przy konkretnej linii.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
  },
  {
    files: ['.claude/workflows/*.js'],
    processor: procesorWorkflowow,
    languageOptions: { ecmaVersion: 2024, sourceType: 'script', globals: GLOBALNE_WORKFLOWU },
  },
]
