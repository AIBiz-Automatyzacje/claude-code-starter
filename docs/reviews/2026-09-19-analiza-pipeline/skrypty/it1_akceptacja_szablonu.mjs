// It. 1, krok 3 — test akceptacyjny `run.szablon.skrypt_sha` na prawdziwych danych (tylko odczyt).
// Kryterium (IT1-PLAN §2 krok 3): z 55 runow autopilota sprzed przegladu D5 33 wykonaly skrypt spoza historii szablonu
// (d5r-wykonalnosc-rekordu.txt §7: oferty-online 29, Nawykometr 4). Historia = wszystkie wersje dev-autopilot-wf.js w gicie szablonu.
// Uzycie: node skrypty/it1_akceptacja_szablonu.mjs → dane/it1-akceptacja-szablonu.txt

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hashBloba } from '../../../../.claude/scripts/telemetria/szablon.mjs'
import { czytajHarness, znajdzRuny } from '../../../../.claude/scripts/telemetria/zrodla.mjs'

const BAZA = dirname(dirname(fileURLToPath(import.meta.url)))
const REPO_SZABLONU = join(BAZA, '..', '..', '..')
const SCIEZKA = '.claude/workflows/dev-autopilot-wf.js'
const GRANICA_D5_MS = Date.parse('2026-09-23T10:07:00.000Z')
const WZORZEC = { runow: 55, spoza: 33 }

/** @param {string[]} a */
const git = (a) => execFileSync('git', ['-C', REPO_SZABLONU, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const historia = new Set(
  git(['log', '--all', '--format=%H', '--', SCIEZKA]).split('\n').filter(Boolean)
    .map((c) => git(['ls-tree', c, SCIEZKA]).split(/\s+/)[2]).filter(Boolean),
)

let runow = 0, spoza = 0
/** @type {Map<string, number>} */
const spozaPerProjekt = new Map()
for (const run of znajdzRuny()) {
  const h = czytajHarness(run)
  if (!h || h.workflowName !== 'dev-autopilot-wf' || typeof h.script !== 'string') continue
  if (typeof h.startTime !== 'number' || h.startTime >= GRANICA_D5_MS) continue
  runow++
  if (!historia.has(hashBloba(h.script))) {
    spoza++
    const projekt = run.projektSlug.replace(/^-Users-[^-]+-[^-]+-Documents-Kodowanie-/, '')
    spozaPerProjekt.set(projekt, (spozaPerProjekt.get(projekt) ?? 0) + 1)
  }
}

const ok = runow === WZORZEC.runow && spoza === WZORZEC.spoza
const out = [
  'It. 1 krok 3 — akceptacja run.szablon.skrypt_sha na prawdziwych danych (2026-09-29)',
  `Wersje ${SCIEZKA} w historii szablonu: ${historia.size}`,
  `Runy autopilota sprzed przegladu D5: ${runow} (wzorzec ${WZORZEC.runow}); skrypt spoza historii: ${spoza} (wzorzec ${WZORZEC.spoza}) — ` +
    [...spozaPerProjekt].map(([p, n]) => `${p} ${n}`).join(', '),
  `→ ${ok ? 'ZALICZONE' : 'NIEZALICZONE'}`,
]
const tekst = out.join('\n') + '\n'
writeFileSync(join(BAZA, 'dane', 'it1-akceptacja-szablonu.txt'), tekst)
process.stdout.write(tekst)
