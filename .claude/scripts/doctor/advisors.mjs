#!/usr/bin/env node
// Czesc doctor.sh: czy advisors Supabase pobiegnie po migracjach fazy (P17) — baza e2e z ref i token Management API.
// Wiersz TSV jak zaleznosci-bramek.mjs. Brak = UWAGA, nie BRAK: run idzie dalej, a security sprawdza migracje recznie.
//
// Uzycie: node advisors.mjs <katalog-projektu>

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { gotowoscAdvisors } from '../e2e/advisors.mjs'
import { envE2e } from '../e2e/srodowisko.mjs'

const ELEMENT = 'advisors (baza e2e)'

/** @param {string} projekt @returns {[string, string, string, string]} */
function wierszAdvisors(projekt) {
  const env = envE2e(projekt)
  if (!existsSync(join(projekt, 'supabase')) && !env?.VITE_SUPABASE_URL) return [ELEMENT, 'nie dotyczy', 'projekt bez Supabase (brak supabase/ i VITE_SUPABASE_URL w .env.e2e)', '—']
  const g = gotowoscAdvisors(projekt)
  if (g.gotowe) return [ELEMENT, 'OK', `token i projekt e2e ${g.ref}`, '—']
  const [szczegol, naprawa] = g.uwaga.split(' — ')
  return [ELEMENT, 'UWAGA', `${szczegol} — security sprawdzi migracje ręcznie`, naprawa ?? '—']
}

const projekt = process.argv[2]
if (!projekt) {
  process.stderr.write('Użycie: node advisors.mjs <katalog-projektu>\n')
  process.exit(2)
}
process.stdout.write(`${wierszAdvisors(projekt).join('\t')}\n`)
