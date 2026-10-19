// P22 E1: kalibracja hooka env-wartosci na korpusie komend Bash (skrypty/p22_e1_korpus.py — JSON lines, bez przycinania).
// Uzycie: node skrypty/p22_e1_kalibracja.mjs <hook przed.mjs> <hook po.mjs> <korpus.jsonl> <wyj.txt>
// Wynik: liczby blokad przed/po, nowe blokady per rodzaj i zniknięte — bez treści komend (komendy bywaja z wartosciami).
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [przed, po, korpus, wyj] = process.argv.slice(2)
const komendy = readFileSync(korpus, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).komenda)
const ocen = async (/** @type {string} */ m) => {
  const { ocenKomende } = await import(resolve(m))
  return komendy.map((k) => ocenKomende(k))
}
const a = await ocen(przed)
const b = await ocen(po)
const nowe = b.map((o, i) => (o.blokada && !a[i]?.blokada ? o.rodzaj : null)).filter(Boolean)
const znikly = a.filter((o, i) => o.blokada && !b[i]?.blokada).length
const perRodzaj = Object.fromEntries([...new Set(nowe)].map((r) => [r, nowe.filter((x) => x === r).length]))
const tekst = [
  `komend w korpusie: ${komendy.length}`,
  `blokad przed: ${a.filter((o) => o.blokada).length}, po: ${b.filter((o) => o.blokada).length}`,
  `nowe blokady: ${nowe.length} ${JSON.stringify(perRodzaj)}; znikniete: ${znikly}`,
].join('\n')
writeFileSync(wyj, `${tekst}\n`)
console.log(tekst)
