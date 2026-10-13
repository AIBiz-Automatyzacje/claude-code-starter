#!/usr/bin/env node
// Czesc doctor.sh: port serwera E2E (P19). Port 5173 to domyslny port zwyklego dev servera Vite — `pnpm dev` zajmuje go
// i start E2E zatrzymuje sie na serwerze spoza pipeline'u (vibersi etap 2: 9 scenariuszy SKIP). Wiersz TSV jak advisors.mjs;
// 5173 = UWAGA, nie BRAK: start E2E przejdzie, dopoki port jest wolny.
//
// Uzycie: node port-e2e.mjs <katalog-projektu>

import { DOMYSLNY_PORT, envE2e, konfiguracja, PLIK_ENV, PORT_DEV_VITE } from '../e2e/srodowisko.mjs'

const ELEMENT = 'port E2E'

/** @param {string} projekt @returns {[string, string, string, string]} */
function wierszPortu(projekt) {
  const env = envE2e(projekt)
  if (!env) return [ELEMENT, 'nie dotyczy', `brak ${PLIK_ENV}`, '—']
  const { port, url, blad } = konfiguracja(projekt, env)
  if (blad) return [ELEMENT, 'UWAGA', blad.split(' — ')[0], blad.split(' — ')[1] ?? '—']
  if (port === PORT_DEV_VITE) {
    return [ELEMENT, 'UWAGA', `${url} — ${PORT_DEV_VITE} to port zwyklego dev servera Vite; uruchomiony obok zatrzyma start E2E`, `E2E_URL=http://localhost:${DOMYSLNY_PORT} w ${PLIK_ENV} (i ten port w E2E_START, jesli jest ustawiony)`]
  }
  return [ELEMENT, 'OK', url, '—']
}

const projekt = process.argv[2]
if (!projekt) {
  process.stderr.write('Użycie: node port-e2e.mjs <katalog-projektu>\n')
  process.exit(2)
}
process.stdout.write(`${wierszPortu(projekt).join('\t')}\n`)
