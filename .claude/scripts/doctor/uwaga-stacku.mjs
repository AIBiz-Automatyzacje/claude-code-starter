#!/usr/bin/env node
// Czesc doctor.sh: uwaga stacku z adaptera E2E (`uwagaDoctora`). Wiersz TSV jak port-e2e.mjs albo nic, gdy stack nie ma uwag.
//
// Uzycie: node uwaga-stacku.mjs <katalog-projektu>

import { uwagaDoctora } from '../e2e/adapter.mjs'

const projekt = process.argv[2]
if (!projekt) {
  process.stderr.write('Użycie: node uwaga-stacku.mjs <katalog-projektu>\n')
  process.exit(2)
}
const wiersz = uwagaDoctora(projekt)
if (wiersz) process.stdout.write(`${wiersz.join('\t')}\n`)
