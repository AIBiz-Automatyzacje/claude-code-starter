import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
const T = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/.claude/scripts/ogrod/'
const { zmierzProjekt } = await import(T + 'pomiar.mjs')
const { decyzjaOceny } = await import(T + 'prog.mjs')
const [src, out] = process.argv.slice(2)
const log = execFileSync('git', ['-C', src, 'log', '--all', '--format=%h %ad %s', '--date=short', '--grep', 'archiwizacja zadania'], { encoding: 'utf8' }).trim().split('\n').reverse()
let poprzedni = null; let ocen = 0
for (const l of log) {
  const h = l.split(' ')[0]; const d = join(out, h); rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true })
  execFileSync('sh', ['-c', `git -C "${src}" archive ${h} | tar -x -C "${d}" && cd "${d}" && git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -q -m x`])
  const p = zmierzProjekt(d, { baza: null })
  const dec = decyzjaOceny({ liczby: p.liczby, noweLiczby: p.noweLiczby, poprzedni })
  if (dec.ocena) ocen++
  console.log(l.slice(0, 52).padEnd(52), JSON.stringify(p.liczby), dec.ocena ? 'OCENA: ' + dec.powod : '-')
  poprzedni = { run: h, start: h, liczby: p.liczby, bez_oceny: dec.ocena ? 0 : dec.bez_oceny }
  rmSync(d, { recursive: true, force: true })
}
console.log('zadan', log.length, 'ocen', ocen)
