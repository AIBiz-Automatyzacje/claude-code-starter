#!/usr/bin/env node
// Raport miesieczny telemetrii pipeline'u dev-* (It. 1; d5-telemetria-rekord.txt §4). Najpierw skan (siatka: zaden run nie ginie),
// potem obliczenia na ostatnich wersjach rekordow z okresu.
//
// Uzycie: node .claude/scripts/telemetria/raport.mjs --od 2026-10-01 --do 2026-10-31 [--projekt nazwa] [--wyj katalog] [--bez-skanu]
// Wynik: <wyj>/raport-<od>_<do>[-projekt].txt i ...-role.csv (domyslnie docs/reviews/telemetria/ w biezacym katalogu).

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { anomalie, czyPipeline, efortPerKlasa, findingiPerOs, jakoscBota, kontekstPerKlasa, kosztPerEtap, kwantyl, niezawodnosc, skillePerNazwa } from './raport-sekcje.mjs'
import { zbierzWszystko } from './zbieranie.mjs'
import { PLIK_BLEDOW, PLIK_DANYCH, odczytajRekordy } from './zapis.mjs'
import { KATALOG_PROJEKTOW } from './zrodla.mjs'

const { values: op } = parseArgs({
  options: {
    od: { type: 'string' }, do: { type: 'string' }, projekt: { type: 'string' },
    wyj: { type: 'string', default: join('docs', 'reviews', 'telemetria') },
    plik: { type: 'string', default: PLIK_DANYCH }, projekty: { type: 'string', default: KATALOG_PROJEKTOW },
    bledy: { type: 'string', default: PLIK_BLEDOW }, 'bez-skanu': { type: 'boolean', default: false },
  },
})
if (!op.od || !op.do) {
  process.stderr.write('Uzycie: raport.mjs --od YYYY-MM-DD --do YYYY-MM-DD [--projekt nazwa] [--wyj katalog] [--bez-skanu]\n')
  process.exit(2)
}
const OD = op.od
const DO_WYL = new Date(Date.parse(op.do) + 24 * 3600 * 1000).toISOString().slice(0, 10)

// Punkty odniesienia ctx_start (tokeny): stan z runu 20.09 (D3 korekta 2) i cele po allowliscie It. 3a (przeglad D4, mini-run (e)).
const ODNIESIENIE_CTX = 'odniesienie 20.09: mechaniczny haiku 89k, orkiestracyjny opus 121k, reviewer 125k, sceptyk 123k, builder 135k'
const CELE_CTX = 'cele po It. 3a: mechaniczny ~9–10k, orkiestracyjny/sceptyk/naprawiacz opus ~25–26k, naprawiacz haiku ~21k, reviewer ~29k, builder ~38k'

if (!op['bez-skanu']) {
  zbierzWszystko({ projekty: op.projekty, plik: op.plik, bledy: op.bledy, terazMs: Date.now(), szybko: false, sesjeWToku: new Set(), pominSesje: new Set() })
}
const wszystkie = [...odczytajRekordy(op.plik).ostatnie.values()]
/** @param {Record<string, unknown>} r */
const wOkresie = (r) => typeof r.start === 'string' && r.start >= OD && r.start < DO_WYL && (!op.projekt || r.projekt === op.projekt)
// Przynaleznosc do pipeline'u po workflowie runu (z calej historii — run moze zaczac sie przed okresem, a jego agenci w nim).
const workflowRunu = new Map(wszystkie.filter((r) => r.typ === 'run').map((r) => [r.run, r.workflow]))
const agenciOkresu = wszystkie.filter((r) => r.typ === 'agent' && wOkresie(r))
const runyOkresu = wszystkie.filter((r) => r.typ === 'run' && wOkresie(r))
const agenci = agenciOkresu.filter((r) => czyPipeline(workflowRunu.get(r.run)))
const runy = runyOkresu.filter((r) => czyPipeline(r.workflow))
const agenciPoza = agenciOkresu.filter((r) => !czyPipeline(workflowRunu.get(r.run)))
const idRunow = new Set(runy.map((r) => r.run))
const fazy = wszystkie.filter((r) => r.typ === 'faza' && idRunow.has(r.run))
const skille = wszystkie.filter((r) => r.typ === 'skill' && wOkresie(r))

/** @param {number | null} x */
const k = (x) => (x === null ? '—' : `${Math.round(x / 1000)}k`)
/** @param {number} x */
const m = (x) => `${(x / 1e6).toFixed(1)} M`

const out = [`Raport telemetrii pipeline'u dev-* — ${op.od} … ${op.do}${op.projekt ? ` — projekt ${op.projekt}` : ''} (wygenerowano ${new Date().toISOString()})`]
const koszt = kosztPerEtap(agenci)
out.push('', '1. Koszt (jednostki wzgledne: in 1, cache write 1,25, cache read 0,1, out 5)')
out.push(`   razem ${m(koszt.razem)}; agentow: ${agenci.length}; runow: ${runy.length}; faz: ${fazy.length}; poza etapami fazy ${m(koszt.poza_etapami)}`)
for (const [etap, v] of Object.entries(koszt.etapy).sort((a, b) => b[1].jedn - a[1].jedn)) out.push(`   ${etap.padEnd(17)} ${m(v.jedn).padStart(9)}  ${v.udzial}%`)
const perProjekt = Map.groupBy(agenci, (a) => String(a.projekt))
out.push(`   poza pipeline'em (analizy, testy): ${runyOkresu.length - runy.length} runow, ${agenciPoza.length} agentow, ${m(agenciPoza.reduce((s, a) => s + Number(a.koszt_jedn), 0))} — pominiete w sekcjach 1–5 i 7`)
out.push('   per projekt: ' +[...perProjekt].map(([p, l]) => `${p} ${m(l.reduce((s, a) => s + Number(a.koszt_jedn), 0))}`).join('; '))

out.push('', `2. Kontekst startowy per klasa roli i model (${ODNIESIENIE_CTX}; ${CELE_CTX})`)
for (const w of kontekstPerKlasa(agenci)) {
  out.push(`   ${w.klasa.padEnd(15)} ${w.model.padEnd(26)} n=${w.n}  ctx_start p50 ${k(w.ctx_start_p50)} p90 ${k(w.ctx_start_p90)}  narzedzia p50 ${w.narzedzia_n_p50 ?? '—'}  CLAUDE.md p50 ${w.claude_md_zn_p50 ?? '—'} zn`)
}

out.push('', '3. Efort per klasa roli (brak = efort sesji albo model bez efortu, np. haiku)')
for (const [klasa, poziomy] of Object.entries(efortPerKlasa(agenci))) out.push(`   ${klasa.padEnd(15)} ${Object.entries(poziomy).map(([p, n]) => `${p} ${n}`).join(', ')}`)

out.push('', '4. Jakosc')
out.push('   findingi reviewerow per os: ' + (Object.entries(findingiPerOs(fazy)).map(([os, v]) => `${os} P1 ${v.p1} / P2 ${v.p2} / P3 ${v.p3}`).join('; ') || 'brak'))
const bot = jakoscBota(runy)
/** @param {ReturnType<typeof jakoscBota>[number]} b */
const opisBota = (b) => b.bez_wagi === b.watki
  ? `${b.zadanie}: ${b.watki} watkow bez klasyfikacji (sprzed slownika klas)`
  : `${b.zadanie}: ${b.p1p2} P1/P2 z ${b.watki} watkow, ${b.p1p2_na_100_plikow ?? '—'} na 100 plikow${b.bez_wagi ? `, ${b.bez_wagi} bez klasyfikacji` : ''}`
out.push('   uwagi bota (unikalne watki per zadanie): ' + (bot.map(opisBota).join('; ') || 'brak rekordow run.pr'))

const nz = niezawodnosc(runy)
out.push('', '5. Niezawodnosc')
for (const [wf, s] of Object.entries(nz.statusy)) out.push(`   ${wf.padEnd(20)} ${Object.entries(s).map(([st, n]) => `${st} ${n}`).join(', ')}`)
out.push('   STOP per kategoria: ' + (Object.entries(nz.stopy).sort((a, b) => b[1] - a[1]).map(([kat, n]) => `${kat} ${n}`).join('; ') || 'brak'))

out.push('', '6. Skille w sesji glownej (pelny koszt = wlasny + subagenci; epizody zamkniete)')
for (const s of skillePerNazwa(skille).slice(0, 15)) out.push(`   ${s.skill.padEnd(24)} n=${s.n}  pelny p50 ${k(s.pelny_p50)}  wiadomosci operatora p50 ${s.wiadomosci_p50 ?? '—'}`)

out.push('', '7. Anomalie (agent > 2× mediany swojej roli), top 10')
for (const a of anomalie(agenci).slice(0, 10)) out.push(`   ${String(a.rola).padEnd(24)} ${m(Number(a.koszt_jedn))}  ${a.run} ${a.id}`)

const perRola = [...Map.groupBy(agenci, (a) => `${a.rola}|${a.klasa_roli}`)].map(([klucz, l]) => {
  const [rola, klasa] = klucz.split('|')
  const koszty = l.map((a) => Number(a.koszt_jedn))
  return [rola, klasa, l.length, koszty.reduce((s, x) => s + x, 0), kwantyl(koszty, 0.5)].join(',')
})
const nazwa = `raport-${op.od}_${op.do}${op.projekt ? `-${op.projekt}` : ''}`
mkdirSync(op.wyj, { recursive: true })
writeFileSync(join(op.wyj, `${nazwa}.txt`), out.join('\n') + '\n')
writeFileSync(join(op.wyj, `${nazwa}-role.csv`), ['rola,klasa,agentow,koszt_jedn,koszt_p50', ...perRola].join('\n') + '\n')
process.stdout.write(`${join(op.wyj, `${nazwa}.txt`)}\n`)
