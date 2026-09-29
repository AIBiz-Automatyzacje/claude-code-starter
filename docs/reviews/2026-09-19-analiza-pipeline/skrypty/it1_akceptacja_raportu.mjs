// It. 1, krok 6 — test akceptacyjny raport.mjs na prawdziwym pliku telemetrii (~/.claude/telemetry/pipeline.jsonl, tylko odczyt).
// Kryteria: (1) udzialy etapow oferty-online 06–19.09 = d5r §2 ±0,3 pp; (2) ctx_start p50 per klasa z 20.09 (run wf_e5c34cd8-66c)
// = punkt odniesienia D3 korekta 2 (mechaniczny haiku 89k, orkiestracyjny 121k, reviewer 125k, sceptyk 123k, builder 135k) ±1k.
// KOREKTA PLANU: IT1-PLAN krok 6 podawal jako wzorzec 8,8k/25,5k/... — to cele PO allowliscie (It. 3a), nie historia.
// Uzycie: node skrypty/it1_akceptacja_raportu.mjs → dane/it1-akceptacja-raportu.txt

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BAZA = dirname(dirname(fileURLToPath(import.meta.url)))
const RAPORT = join(BAZA, '..', '..', '..', '.claude', 'scripts', 'telemetria', 'raport.mjs')
const WZORZEC_UDZIALOW = { execute: 29.1, review: 28.9, fix: 17.7, orkiestracja: 9.0, sceptycy: 6.1, mechanika_review: 5.0 }
const WZORZEC_CTX_K = { 'mechaniczny|claude-haiku': 89, 'orkiestracyjny|claude-opus': 121, 'reviewer|claude-opus': 125, 'sceptyk|claude-opus': 123, 'builder|claude-opus': 135 }

const wyj = mkdtempSync(join(tmpdir(), 'it1-raport-'))
/** @param {string} od @param {string} doDnia */
function raport(od, doDnia) {
  execFileSync(process.execPath, [RAPORT, '--od', od, '--do', doDnia, '--projekt', 'oferty-online', '--bez-skanu', '--wyj', wyj])
  return readFileSync(join(wyj, `raport-${od}_${doDnia}-oferty-online.txt`), 'utf8')
}
const out = ['It. 1 krok 6 — akceptacja raport.mjs na prawdziwym pliku telemetrii (2026-09-29)']
let ok = true
try {
  const wrzesien = raport('2026-09-06', '2026-09-19')
  out.push('', 'Udzialy etapow oferty-online 06–19.09 vs d5r §2 (±0,3 pp):')
  for (const [etap, wzorzec] of Object.entries(WZORZEC_UDZIALOW)) {
    const m = wrzesien.match(new RegExp(`^\\s+${etap}\\s+[\\d.]+ M\\s+([\\d.]+)%`, 'm'))
    const jest = m ? Number(m[1]) : NaN
    const zgodny = Math.abs(jest - wzorzec) <= 0.3
    ok &&= zgodny
    out.push(`  ${etap.padEnd(17)} ${jest}% vs ${wzorzec}% ${zgodny ? 'OK' : 'ROZJAZD'}`)
  }
  const dzien = raport('2026-09-20', '2026-09-20')
  out.push('', 'ctx_start p50 20.09 vs punkt odniesienia D3 (±1k):')
  for (const [klucz, wzorzec] of Object.entries(WZORZEC_CTX_K)) {
    const [klasa, model] = klucz.split('|')
    const m = dzien.match(new RegExp(`^\\s+${klasa}\\s+${model}\\S*\\s+n=(\\d+)\\s+ctx_start p50 (\\d+)k`, 'm'))
    const jest = m ? Number(m[2]) : NaN
    const zgodny = Math.abs(jest - wzorzec) <= 1
    ok &&= zgodny
    out.push(`  ${klucz.padEnd(28)} ${jest}k (n=${m ? m[1] : '?'}) vs ${wzorzec}k ${zgodny ? 'OK' : 'ROZJAZD'}`)
  }
} finally {
  rmSync(wyj, { recursive: true, force: true })
}
out.push(`→ ${ok ? 'ZALICZONE' : 'NIEZALICZONE'}`)
const tekst = out.join('\n') + '\n'
writeFileSync(join(BAZA, 'dane', 'it1-akceptacja-raportu.txt'), tekst)
process.stdout.write(tekst)
