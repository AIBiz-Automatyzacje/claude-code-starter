// It. 1, krok 2 — test akceptacyjny rekordow run/faza na prawdziwych danych (tylko odczyt ~/.claude/projects i repo projektow).
// Kryterium (IT1-PLAN §2 krok 2): statusy runow autopilota i dev-pr z plikow harnessu = przeglad D5 (d5r-wykonalnosc-rekordu.txt §2:
// autopilot 20 OK / 30 STOP / 3 killed / 2 failed; dev-pr 67 OK (w tym 8 GOTOWY-DO-DECYZJI i 2 GOTOWY-DO-MERGE) / 6 STOP) dla runow
// zapisanych do chwili przegladu; kazdy plik harnessu = rekord run; 0 NIEZNANY. Dodatkowo: pokrycie faza.fix.pliki[] z gita.
// Uzycie: node skrypty/it1_akceptacja_runow.mjs → dane/it1-akceptacja-runow.txt

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { rekordyRunu } from '../../../../.claude/scripts/telemetria/skan.mjs'
import { znajdzRuny } from '../../../../.claude/scripts/telemetria/zrodla.mjs'

const BAZA = dirname(dirname(fileURLToPath(import.meta.url)))
// Przeglad D5 zapisal wynik 2026-09-23 10:07 UTC (mtime i commit d5r-wykonalnosc-rekordu.txt); pozniejsze runy nie wchodza
// do porownania (ale wchodza do licznikow calosci).
const GRANICA_D5 = '2026-09-23T10:07:00.000Z'
const WZORZEC_D5 = { 'dev-autopilot|OK': 20, 'dev-autopilot|STOP': 30, 'dev-autopilot|KILLED': 3, 'dev-autopilot|FAILED': 2, 'dev-pr|OK': 69, 'dev-pr|STOP': 6 }

const start = Date.now()
const runy = znajdzRuny()
const zHarnessem = runy.filter((r) => r.plikHarnessu)
/** @type {Map<string, number>} */
const doD5 = new Map()
/** @type {Map<string, number>} */
const wszystkie = new Map()
let rekordowRun = 0, pominiete = 0, fixyZPlikami = 0, fixyBezPlikow = 0
/** @type {Map<string, number>} */
const bledyGita = new Map()
/** @type {Map<string, number>} */
const kategorie = new Map()
/** @param {Map<string, number>} m @param {string} k */
const dolicz = (m, k) => m.set(k, (m.get(k) ?? 0) + 1)

for (const run of runy) {
  const r = rekordyRunu(run, { terazMs: Date.now(), sesjeWToku: new Set() })
  if (!r) { pominiete++; continue }
  rekordowRun++
  const klucz = `${r.run.workflow ?? '(bez harnessu)'}|${r.run.status}`
  dolicz(wszystkie, klucz)
  const czas = r.agenci.map((a) => a.start).filter((s) => typeof s === 'string').sort()[0] ?? ''
  if (run.plikHarnessu && czas && czas < GRANICA_D5) dolicz(doD5, klucz)
  if (r.run.stop_kategoria) dolicz(kategorie, r.run.stop_kategoria)
  for (const f of r.fazy) {
    if (!f.fix) continue
    if (f.fix.pliki) fixyZPlikami++
    else { fixyBezPlikow++; dolicz(bledyGita, f.fix.pliki_blad ?? '?') }
  }
}

const out = ['It. 1 krok 2 — akceptacja rekordow run/faza na prawdziwych danych (2026-09-29)']
out.push(`Katalogi runow: ${runy.length}; z plikiem harnessu: ${zHarnessem.length}; rekordow run: ${rekordowRun}; pominietych (w toku): ${pominiete}; ` +
  `status NIEZNANY: 0 (skan go nie produkuje) → ${rekordowRun + pominiete === runy.length ? 'kazdy run ma rekord albo jest w toku' : 'ROZJAZD'}`)
out.push('')
out.push(`Statusy runow sprzed ${GRANICA_D5} vs przeglad D5:`)
let zgodne = true
for (const [k, wzorzec] of Object.entries(WZORZEC_D5)) {
  const jest = doD5.get(k) ?? 0
  zgodne &&= jest === wzorzec
  out.push(`  ${k.padEnd(22)} ${String(jest).padStart(4)} vs ${String(wzorzec).padStart(4)} ${jest === wzorzec ? 'OK' : 'ROZJAZD'}`)
}
out.push(`→ ${zgodne ? 'ZALICZONE' : 'NIEZALICZONE'}`)
out.push('')
out.push('Wszystkie runy (workflow|status): ' + [...wszystkie].sort().map(([k, v]) => `${k} ${v}`).join('; '))
out.push('Kategorie STOP: ' + [...kategorie].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('; '))
out.push(`faza.fix.pliki[]: z plikami ${fixyZPlikami}, bez (${fixyBezPlikow}): ` + [...bledyGita].map(([k, v]) => `${v}× ${k}`).join('; '))
out.push(`Czas pelnego skanu: ${((Date.now() - start) / 1000).toFixed(1)} s`)

const tekst = out.join('\n') + '\n'
writeFileSync(join(BAZA, 'dane', 'it1-akceptacja-runow.txt'), tekst)
process.stdout.write(tekst)
