// Opis procesu na zajetym porcie narzedzia makiet (punkt 67, vibersi: port blokowal serwer makiet innego projektu sprzed 5 dni).
//
// Uruchomienie: node --test .claude/scripts/makieta/__tests__/proces.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import { opisObcego } from '../proces.mjs'

test('opisObcego: serwer makiet innego projektu = nazwa projektu i komenda zatrzymania, bez argumentow komendy', () => {
  const o = opisObcego({ pid: 60707, komenda: '/Users/x/.hermes/node/bin/node /Users/x/Kod/akademia-dashboard/.claude/scripts/makieta/makieta.mjs serwer --token abc' })
  assert.equal(o, 'PID 60707: serwer narzędzia makiet projektu akademia-dashboard. Zatrzymaj go w tamtym projekcie (node .claude/scripts/makieta/makieta.mjs stop) albo kill 60707')
  assert.doesNotMatch(o, /abc/)
})

test('opisObcego: inny proces = sam program bez argumentow; brak lsof = proces nieznany', () => {
  assert.equal(opisObcego({ pid: 5, komenda: '/usr/local/bin/ngrok http 5180 --authtoken SEKRET' }), 'PID 5: ngrok')
  assert.equal(opisObcego({ pid: 6, komenda: 'node /p/.claude/scripts/makieta/__tests__/makieta-cli.test.mjs' }), 'PID 6: node')
  assert.equal(opisObcego(null), 'proces nieznany (brak lsof)')
})
