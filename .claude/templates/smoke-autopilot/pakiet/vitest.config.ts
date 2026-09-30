import { defineConfig } from 'vitest/config'

// Pakiet fixture smoke'a: przed fazą build nie ma testów — bez passWithNoTests bazowe `pnpm -r run test` kopii jest czerwone.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
