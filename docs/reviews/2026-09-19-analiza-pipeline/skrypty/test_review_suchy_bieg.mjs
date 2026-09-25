// Test review — suchy bieg skryptu Workflow z atrapą agent()/parallel() (zero modeli, zero tokenów): wykrywa błędy wykonania
// orkiestracji i agregacji A/B/C oraz wariantu 0 przed pilotem. Atrapa zwraca po 2 findingi na rolę (w tym duplikat między rolami),
// dedup/agregator grupuje indeksy 0 i 1. Użycie: node skrypty/test_review_suchy_bieg.mjs <skrypt.js> [args-json]
import fs from 'node:fs'

const plik = process.argv[2]
const args = process.argv[3] ? JSON.parse(process.argv[3]) : {}
const src = fs.readFileSync(plik, 'utf8').replace(/^export const meta/m, 'const meta')
let n = 0
const etykiety = []
async function agent(prompt, o = {}) {
  n++
  etykiety.push((o.label || '?') + (o.model ? ' model=' + o.model : '') + (o.effort ? ' effort=' + o.effort : ''))
  const props = (o.schema && o.schema.properties) || {}
  if (process.env.ZRZUT) fs.appendFileSync(process.env.ZRZUT, '##### ' + (o.label || '?') + (o.model ? ' | model ' + o.model : ' | model sesji (claude-opus-5-5)') + (o.effort ? ' | effort ' + o.effort : ' | effort sesji (high)') + '\n' + prompt + '\n\n')
  if (props.duplikaty) return { duplikaty: [[0, 1]] }
  if (props.grupy) return { grupy: [[0, 1], [2]] }
  if (props.pliki && props.warstwy) return { diffStat: '<git diff --stat fazy>', pliki: [{ plik: 'apps/server/src/<plik fazy>.ts', czegoDotyczy: '<czego dotyczy — packager>' }], warstwy: { ui: false, dane: true, typowanie: true, nowyModul: false }, e2eCheckboxy: 0, diffPlik: '/tmp/review-diff-<sciezka>-faza-N.diff', diffZapisany: true, diffUciety: false, ctxPlik: '/tmp/review-ctx-<sciezka>-faza-N.md', ctxZapisany: true, preSkan: [] }
  if (props.trafienia) return { trafienia: [{ wzorzec: 'any', plik: 'a.ts', linia: 'x: any' }] }
  if (props.regresje) return { regresje: [{ plik: 'a.ts:1', opis: 'r' }], bramki: [{ plik: 'a.ts:2', opis: 'b', wektory: ['1', '2', '3'], testOdmowy: false }] }
  if (props.realny) return { realny: n % 2 === 0, uzasadnienie: 'u', severityKorekta: null }
  if (props.werdykty) {
    const w = props.werdykty.items.properties
    return { werdykty: [0, 1, 2, 3].map((i) => (w.etykieta ? { indeks: i, etykieta: ['AGREE', 'DISAGREE_EVIDENCE', 'DISAGREE_CONCERN'][(i + n) % 3], dowod: i % 2 ? 'a.ts:1' : '', uzasadnienie: 'u' } : { indeks: i, realny: i % 2 === 0, uzasadnienie: 'u' })) }
  }
  if (props.klucze) return { klucze: [{ id: 'K1', obecny: 'TAK', uzasadnienie_obecnosci: 'x', dopasowania: [{ f: 'F1', ocena: 'PEŁNE', uzasadnienie: 'x' }] }], bez_dopasowania: [] }
  const klucz = props.pozycje ? 'pozycje' : 'findings'
  const f = (i, waga) => {
    const x = { plik: 'apps/server/src/a.ts' + (klucz === 'findings' && !props.findings.items.properties.linia ? ':' + (10 + i) : ''), linia: 10 + i, waga, typ: 'KOD', opis: 'opis ' + i, scenariusz: 's', severity: waga }
    if (props[klucz].items.properties.lista_id) x.lista_id = 'L-X'
    if (props[klucz].items.properties.soczewka) x.soczewka = 'correctness'
    return x
  }
  const wynik = { [klucz]: [f(0, 'P2'), f(1, 'P3'), f(n, 'P3')] }
  if (props.listy) wynik.listy = Object.fromEntries(props.listy.required.map((k) => [k, 'pusta']))
  return wynik
}
const parallel = async (th) => Promise.all(th.map((t) => t().catch((e) => { console.error('thunk:', e.message); return null })))
const phase = () => {}
const log = (m) => console.log('  log:', String(m).slice(0, 140))
const fn = new Function('args', 'agent', 'parallel', 'phase', 'log', 'return (async()=>{' + src + '})()')
const wynik = await fn(args, agent, parallel, phase, log)
console.log(plik.split('/').slice(-2).join('/') + ': agentów ' + n + ', findingów zwróconych ' + (wynik && wynik.findings ? wynik.findings.length : '?'))
console.log('  agenci: ' + etykiety.join(' | '))
console.log('  wynik: ' + String(JSON.stringify(wynik && (wynik.przebieg || wynik.decyzje || wynik.klucze || wynik))).slice(0, 300))
