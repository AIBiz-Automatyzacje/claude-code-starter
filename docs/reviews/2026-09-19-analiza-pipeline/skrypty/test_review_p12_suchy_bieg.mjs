// Ślepy test P12 — suchy bieg skryptu wariantu execute-wf z atrapą agent()/parallel() (zero modeli, zero tokenów): planner zwraca dwa IU
// (serial), buildery completed, domknięcie completed. Pokazuje kolejność agentów z efortem i wynik; ZRZUT=<plik> dopisuje prompty
// (planner i domknięcie — prompty builderów składa planner-agent, więc tu są atrapą). Użycie: node skrypty/test_review_p12_suchy_bieg.mjs <skrypt.js>
import fs from 'node:fs'

const src = fs.readFileSync(process.argv[2], 'utf8').replace(/^export const meta/m, 'const meta')
const etykiety = []
async function agent(prompt, o = {}) {
  etykiety.push((o.label || '?') + (o.effort ? ' effort=' + o.effort : ''))
  if (process.env.ZRZUT) fs.appendFileSync(process.env.ZRZUT, '##### ' + (o.label || '?') + ' | ' + (o.agentType || '?') + ' | effort ' + (o.effort || 'sesji') + '\n' + prompt + '\n\n')
  const props = (o.schema && o.schema.properties) || {}
  if (props.iu && props.strategia) return { fazaNumer: 2, strategia: 'serial', poza: false, baza: 'abc1234', iu: [1, 2].map((i) => ({ id: 'IU-' + i, nazwa: 'n' + i, agentType: 'feature-builder-ui', prompt: '<blok IU-' + i + ' z plannera>' })) }
  if (props.pytanie) return { id: o.label.replace('build:', ''), status: 'completed', pliki: ['a.ts'], odchylenia: [], nastepneKroki: null, pytanie: null }
  if (props.stanZapisany) return { fazaNumer: 2, status: 'completed', iu: [{ id: 'IU-1', status: 'completed' }, { id: 'IU-2', status: 'completed' }], commity: ['abc'], testy: 'PASS', odchylenia: [], problem: null, stanZapisany: false }
  throw new Error('atrapa: nieznany schemat agenta ' + o.label)
}
const parallel = async (th) => Promise.all(th.map((t) => t()))
const phase = () => {}
const log = () => {}
const fn = new Function('args', 'agent', 'parallel', 'phase', 'log', 'return (async()=>{' + src + '})()')
const wynik = await fn(undefined, agent, parallel, phase, log)
console.log('agentów ' + etykiety.length)
console.log('agenci: ' + etykiety.join(' | '))
console.log('wynik: ' + JSON.stringify(wynik))
