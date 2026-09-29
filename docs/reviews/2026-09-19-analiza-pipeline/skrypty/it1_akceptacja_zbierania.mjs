// It. 1, krok 4 — test akceptacyjny zbierania na prawdziwych danych (tylko odczyt ~/.claude/projects; zapis do katalogu tymczasowego).
// Kryteria (IT1-PLAN §2 krok 4): pelny skan maszyny bez bledu; typ `skill` — mediany pelnego kosztu (E2 + subagenci)
// dev-plan / dev-docs / dev-prep = 2 392 / 559 / 1 401 k jedn. ±2% (d6r-rewizja-audytu.txt §4, epizody sprzed przegladu D6);
// drugi skan nie dopisuje nic; tryb szybki bez zmian < 1 s.
// Uzycie: node skrypty/it1_akceptacja_zbierania.mjs → dane/it1-akceptacja-zbierania.txt

import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { odczytajRekordy } from '../../../../.claude/scripts/telemetria/zapis.mjs'
import { zbierzWszystko } from '../../../../.claude/scripts/telemetria/zbieranie.mjs'
import { KATALOG_PROJEKTOW } from '../../../../.claude/scripts/telemetria/zrodla.mjs'

const BAZA = dirname(dirname(fileURLToPath(import.meta.url)))
const ETAP0 = new Set(['oferty-online', 'claude-cron', 'Nawykometr', 'akademia-automatyzacji-dashboard', 'symulator-poczekalni'])
const GRANICA_D6 = statSync(join(BAZA, 'dane', 'd6r-rewizja-audytu.txt')).mtime.toISOString()
const WZORZEC_K = { 'dev-plan': 2392, 'dev-docs': 559, 'dev-prep': 1401 }
const TOLERANCJA = 0.02
const LIMIT_SZYBKI_MS = 1000

/** @param {number[]} x */
function mediana(x) {
  const s = [...x].sort((a, b) => a - b)
  const p = Math.floor(s.length / 2)
  return s.length % 2 ? s[p] : (s[p - 1] + s[p]) / 2
}

const wyjscie = mkdtempSync(join(tmpdir(), 'it1-akceptacja-'))
const op = { projekty: KATALOG_PROJEKTOW, plik: join(wyjscie, 'pipeline.jsonl'), bledy: join(wyjscie, 'bledy.log'), sesjeWToku: new Set(), pominSesje: new Set() }
const out = ['It. 1 krok 4 — akceptacja zbierania na prawdziwych danych (2026-09-29)']
try {
  let t = Date.now()
  const pierwszy = zbierzWszystko({ ...op, terazMs: Date.now(), szybko: false })
  out.push(`Pelny skan: ${JSON.stringify(pierwszy)} w ${((Date.now() - t) / 1000).toFixed(1)} s`)
  t = Date.now()
  const drugi = zbierzWszystko({ ...op, terazMs: Date.now(), szybko: false })
  out.push(`Drugi pelny skan: dopisanych ${drugi?.dopisanych} (oczekiwane 0; wyjatek: epizody otwarte w zywych sesjach) w ${((Date.now() - t) / 1000).toFixed(1)} s`)
  t = Date.now()
  const szybki = zbierzWszystko({ ...op, terazMs: Date.now(), szybko: true, znacznikMs: Date.now() })
  const czasSzybki = Date.now() - t
  out.push(`Tryb szybki bez zmian: ${JSON.stringify(szybki)} w ${czasSzybki} ms (limit ${LIMIT_SZYBKI_MS} ms) → ${czasSzybki < LIMIT_SZYBKI_MS ? 'OK' : 'ZA WOLNO'}`)

  const { ostatnie, uszkodzone } = odczytajRekordy(op.plik)
  const wg = new Map()
  for (const r of ostatnie.values()) wg.set(r.typ, (wg.get(r.typ) ?? 0) + 1)
  out.push(`Rekordy wg typu: ${[...wg].map(([k, v]) => `${k} ${v}`).join(', ')}; linii uszkodzonych: ${uszkodzone}`)

  out.push('')
  out.push(`Epizody skilli (projekty etapu 0, start < ${GRANICA_D6}) — mediana E2 + subagenci vs d6r §4, tolerancja ±${TOLERANCJA * 100}%:`)
  let zgodne = true
  for (const [skill, wzorzec] of Object.entries(WZORZEC_K)) {
    const koszty = [...ostatnie.values()]
      .filter((r) => r.typ === 'skill' && r.skill === skill && ETAP0.has(String(r.projekt)) && String(r.start) < GRANICA_D6)
      .map((r) => (Number(r.koszt_jedn) + Number(r.subagenci_jedn ?? 0)) / 1000)
    const m = mediana(koszty)
    const odch = Math.abs(m - wzorzec) / wzorzec
    zgodne &&= odch <= TOLERANCJA
    out.push(`  ${skill.padEnd(9)} n=${String(koszty.length).padStart(2)} mediana ${m.toFixed(0).padStart(5)}k vs ${wzorzec}k (${(odch * 100).toFixed(1)}%) ${odch <= TOLERANCJA ? 'OK' : 'ROZJAZD'}`)
  }
  out.push(`→ ${zgodne && pierwszy?.bledow === 0 ? 'ZALICZONE' : 'NIEZALICZONE'}`)
} finally {
  rmSync(wyjscie, { recursive: true, force: true })
}
const tekst = out.join('\n') + '\n'
writeFileSync(join(BAZA, 'dane', 'it1-akceptacja-zbierania.txt'), tekst)
process.stdout.write(tekst)
