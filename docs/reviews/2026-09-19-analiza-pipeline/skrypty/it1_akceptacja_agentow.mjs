// It. 1, krok 1 — test akceptacyjny portu rekordu `agent` na prawdziwych danych (tylko odczyt ~/.claude/projects).
// Kryterium (IT1-PLAN §2 krok 1): suma kosztu 2 941 agentow z dane/agents.csv = 1 293 M jedn. ±0,5%
// (d5r-koszt-output.txt §1, „poprawione (ostatni wpis)”) i udzialy etapow oferty-online po 06.09 = d5r §2 ±0,3 pp.
// Uzycie: node skrypty/it1_akceptacja_agentow.mjs → dane/it1-akceptacja-agentow.txt

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { agenciRunu, znajdzRuny } from '../../../../.claude/scripts/telemetria/zrodla.mjs'

const BAZA = dirname(dirname(fileURLToPath(import.meta.url)))
const WZORZEC_M = 1293
const TOLERANCJA_SUMY = 0.005
const TOLERANCJA_PP = 0.3
// d5r §2, kolumna „popr.”
const WZORZEC_UDZIALOW = { execute: 29.1, reviewerzy: 28.9, sceptycy: 6.1, mechanika: 5.0, fix: 17.7, orkiestracja: 9.0 }

/** @type {Array<[keyof typeof WZORZEC_UDZIALOW, (r: string) => boolean]>} */
const GRUPY = [
  ['execute', (r) => ['build', 'planner', 'domkniecie', 'warmup:vitest'].includes(r)],
  ['reviewerzy', (r) => r.startsWith('review:')],
  ['sceptycy', (r) => r.startsWith('verify')],
  ['mechanika', (r) => ['kontekst:diff', 'dedup:semantyczny', 'scribe'].includes(r)],
  ['fix', (r) => r.startsWith('fix') || r === 'zwin-do-poprawy'],
  ['orkiestracja', (r) => ['stan:zapis', 'bootstrap', 'telemetria', 'stop', 'e2e:precheck', 'e2e:env-up', 'e2e:env-down', 'e2e:db-sync',
    'walidacja-koncowa', 'compound', 'compound-refresh', 'complete', 'smoke-operatora'].includes(r)],
]

const csv = readFileSync(join(BAZA, 'dane', 'agents.csv'), 'utf8').trim().split('\n')
const naglowek = csv[0].split(',')
const [iRun, iAgent, iProjekt] = ['run', 'agent', 'projekt'].map((k) => naglowek.indexOf(k))
/** @type {Map<string, string>} klucz run|agent -> projekt */
const wzorcowi = new Map(csv.slice(1).map((l) => l.split(',')).map((p) => [`${p[iRun]}|${p[iAgent]}`, p[iProjekt]]))

const runyWzorca = new Set([...wzorcowi.keys()].map((k) => k.split('|')[0]))
/** @type {Array<{ projekt: string, rola: string, start: string, koszt: number }>} */
const rekordy = []
for (const run of znajdzRuny().filter((r) => runyWzorca.has(r.run))) {
  for (const a of agenciRunu(run)) {
    const projekt = wzorcowi.get(`${run.run}|${a.id}`)
    if (projekt) rekordy.push({ projekt, rola: a.rola ?? '?', start: a.start ?? '', koszt: a.koszt_jedn })
  }
}

const out = []
const suma = rekordy.reduce((s, r) => s + r.koszt, 0)
const odchylenie = Math.abs(suma / 1e6 - WZORZEC_M) / WZORZEC_M
out.push('It. 1 krok 1 — akceptacja rekordu agent na prawdziwych danych (2026-09-29)')
out.push(`Agenci odnalezieni: ${rekordy.length} / ${wzorcowi.size} z dane/agents.csv`)
out.push(`Suma kosztu: ${(suma / 1e6).toFixed(1)} M jedn. vs wzorzec ${WZORZEC_M} M (d5r §1) — odchylenie ${(odchylenie * 100).toFixed(2)}% ` +
  `(tolerancja ${TOLERANCJA_SUMY * 100}%) → ${odchylenie <= TOLERANCJA_SUMY && rekordy.length === wzorcowi.size ? 'ZALICZONE' : 'NIEZALICZONE'}`)

const podzbior = rekordy.filter((r) => r.projekt === 'oferty-online' && r.start >= '2026-09-06')
const sumaPodzbioru = podzbior.reduce((s, r) => s + r.koszt, 0)
out.push('')
out.push(`Udzialy etapow — oferty-online po 06.09 (${podzbior.length} agentow; wzorzec d5r §2 „popr.”, tolerancja ±${TOLERANCJA_PP} pp):`)
let wszystkieUdzialy = true
for (const [nazwa, f] of GRUPY) {
  const udzial = (podzbior.filter((r) => f(r.rola)).reduce((s, r) => s + r.koszt, 0) / sumaPodzbioru) * 100
  const roznica = udzial - WZORZEC_UDZIALOW[nazwa]
  const ok = Math.abs(roznica) <= TOLERANCJA_PP
  wszystkieUdzialy &&= ok
  out.push(`  ${nazwa.padEnd(13)} ${udzial.toFixed(1).padStart(5)}% vs ${WZORZEC_UDZIALOW[nazwa].toFixed(1).padStart(5)}%  (${roznica >= 0 ? '+' : ''}${roznica.toFixed(2)} pp) ${ok ? 'OK' : 'ROZJAZD'}`)
}
out.push(`Udzialy → ${wszystkieUdzialy ? 'ZALICZONE' : 'NIEZALICZONE'}`)

const tekst = out.join('\n') + '\n'
writeFileSync(join(BAZA, 'dane', 'it1-akceptacja-agentow.txt'), tekst)
process.stdout.write(tekst)
