#!/usr/bin/env node
// Czesc doctor.sh: port serwera E2E (P19). Port zwyklego serwera deweloperskiego stacku (adapter E2E: PORT_DEV, w webie 5173
// dev servera Vite) — `pnpm dev` zajmuje go i start E2E zatrzymuje sie na serwerze spoza pipeline'u (vibersi etap 2:
// 9 scenariuszy SKIP). Wiersz TSV jak advisors.mjs; port deweloperski = UWAGA, nie BRAK: start E2E przejdzie, dopoki port jest wolny.
//
// Uzycie: node port-e2e.mjs <katalog-projektu>

import { DOMYSLNY_PORT, OPIS_PORTU_DEV, PORT_DEV } from '../e2e/adapter.mjs'
import { envE2e, konfiguracja, PLIK_ENV } from '../e2e/srodowisko.mjs'

const ELEMENT = 'port E2E'

/** @param {string} projekt @returns {[string, string, string, string]} */
function wierszPortu(projekt) {
  const env = envE2e(projekt)
  if (!env) return [ELEMENT, 'nie dotyczy', `brak ${PLIK_ENV}`, '—']
  const { port, url, blad } = konfiguracja(projekt, env)
  if (blad) return [ELEMENT, 'UWAGA', blad.split(' — ')[0], blad.split(' — ')[1] ?? '—']
  if (PORT_DEV !== null && port === PORT_DEV) {
    return [ELEMENT, 'UWAGA', `${url} — ${PORT_DEV} to ${OPIS_PORTU_DEV}; uruchomiony obok zatrzyma start E2E`, `E2E_URL=http://localhost:${DOMYSLNY_PORT} w ${PLIK_ENV} (i ten port w E2E_START, jesli jest ustawiony)`]
  }
  return [ELEMENT, 'OK', url, '—']
}

const projekt = process.argv[2]
if (!projekt) {
  process.stderr.write('Użycie: node port-e2e.mjs <katalog-projektu>\n')
  process.exit(2)
}
process.stdout.write(`${wierszPortu(projekt).join('\t')}\n`)
