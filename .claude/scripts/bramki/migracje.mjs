// Bramka niezmiennosci migracji: migracja obecna w bazie fazy zmieniona albo usunieta (w commicie fazy lub w drzewie roboczym)
// = porazka. Edycja wypchnietej migracji nie zmienia bazy danych (Supabase CLI jej nie zauwazy) — poprawka idzie nowa migracja.

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { git } from './diff.mjs'

export const KATALOG_MIGRACJI = 'supabase/migrations'

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */

/**
 * @param {string} projekt
 * @param {string} baza commit sprzed fazy
 * @returns {WynikBramki}
 */
export function bramkaNiezmiennoscMigracji(projekt, baza) {
  const wBazie = git(projekt, ['ls-tree', '-r', '--name-only', baza, '--', KATALOG_MIGRACJI]).trim()
  if (!wBazie && !existsSync(join(projekt, KATALOG_MIGRACJI))) {
    return { status: 'pominieta', sekundy: null, trafienia: [], powod: `projekt bez ${KATALOG_MIGRACJI}` }
  }
  // Bez wykrywania zmian nazw: M i D dotycza wylacznie plikow obecnych w bazie. --relative: projekt w podkatalogu repo.
  const zmiany = git(projekt, ['diff', '--name-status', '--no-renames', '--relative', '--diff-filter=MD', baza, '--', KATALOG_MIGRACJI])
  const trafienia = zmiany.split('\n').filter(Boolean).map((wiersz) => {
    const [status, plik] = wiersz.split('\t')
    const co = status === 'D' ? 'usunieta' : 'zmieniona'
    return { plik, linia: null, regula: 'niezmiennosc-migracji', opis: `migracja z bazy fazy ${co} — przywroc ja i popraw nowa migracja` }
  })
  return { status: trafienia.length ? 'porazka' : 'ok', sekundy: null, trafienia }
}
