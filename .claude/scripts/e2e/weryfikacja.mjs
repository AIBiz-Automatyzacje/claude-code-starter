// Skill weryfikacji projektu (P14, PANEL-WEJSCIE §2 pkt 14): Launch / Doctor / Drive / Evidence / Cleanup + mapa funkcji.
// Generuje go /weryfikacja-setup w projekcie; szablon go nie dostarcza (sync-template nadpisalby skill i mape projektu).
// Kopia sciezki skilla w dev-docs-review-wf.js (workflowy sa self-contained) — test rownosci w tester-e2e.test.mjs.

import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const KATALOG_SKILLA = '.claude/skills/weryfikacja'
export const PLIK_SKILLA = `${KATALOG_SKILLA}/SKILL.md`
export const PLIK_MAPY = `${KATALOG_SKILLA}/mapa-funkcji.md`
export const KOMENDA_GENERATORA = '/weryfikacja-setup'

/** @param {string} projekt @returns {boolean} czy projekt ma skill weryfikacji */
export const maSkillWeryfikacji = (projekt) => existsSync(join(projekt, PLIK_SKILLA))
