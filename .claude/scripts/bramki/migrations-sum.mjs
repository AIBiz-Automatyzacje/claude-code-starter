// Bramka migrations.sum: SHA-256 kazdej zapisanej migracji w supabase/migrations.sum (format sha256sum — sprawdzenie reczne:
// `cd supabase/migrations && shasum -a 256 -c ../migrations.sum`). Wpis raz zapisany sie nie zmienia; migracja z sumy zmieniona
// albo usunieta = porazka niezaleznie od bazy fazy. Nowe migracje dopisuje dopiszSume (domkniecie po bramkach).

import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { KATALOG_MIGRACJI } from './migracje.mjs'

const PLIK_SUMY = 'supabase/migrations.sum'
const WPIS = /^([0-9a-f]{64}) [ *](.+)$/

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */

/** @param {string} projekt @returns {string[]} nazwy plikow migracji, posortowane */
function migracje(projekt) {
  return readdirSync(join(projekt, KATALOG_MIGRACJI)).filter((n) => n.endsWith('.sql')).sort()
}

/** @param {string} projekt @param {string} nazwa */
function skrot(projekt, nazwa) {
  return createHash('sha256').update(readFileSync(join(projekt, KATALOG_MIGRACJI, nazwa))).digest('hex')
}

/** @param {string} projekt @returns {Map<string, string>} nazwa -> skrot */
function wpisy(projekt) {
  const sciezka = join(projekt, PLIK_SUMY)
  if (!existsSync(sciezka)) return new Map()
  return new Map(readFileSync(sciezka, 'utf8').split('\n').flatMap((l) => {
    const m = WPIS.exec(l)
    return m ? [[m[2], m[1]]] : []
  }))
}

/**
 * @param {string} projekt
 * @returns {WynikBramki}
 */
export function bramkaMigrationsSum(projekt) {
  if (!existsSync(join(projekt, KATALOG_MIGRACJI))) return { status: 'pominieta', sekundy: null, trafienia: [], powod: `projekt bez ${KATALOG_MIGRACJI}` }
  if (!existsSync(join(projekt, PLIK_SUMY))) return { status: 'brak', sekundy: null, trafienia: [], powod: `brak ${PLIK_SUMY} — utworz go: bramki.mjs --dopisz-sume` }
  const zapisane = wpisy(projekt)
  const obecne = new Set(migracje(projekt))
  const trafienia = [...zapisane].flatMap(([nazwa, zapisany]) => {
    const plik = `${KATALOG_MIGRACJI}/${nazwa}`
    if (!obecne.has(nazwa)) return [{ plik, linia: null, regula: 'migrations-sum', opis: 'migracja z sumy usunieta — przywroc ja i popraw nowa migracja' }]
    if (skrot(projekt, nazwa) !== zapisany) return [{ plik, linia: null, regula: 'migrations-sum', opis: 'migracja zmieniona po zapisie sumy — przywroc ja i popraw nowa migracja' }]
    return []
  })
  const nowe = [...obecne].filter((n) => !zapisane.has(n))
  /** @type {WynikBramki} */
  const wynik = { status: trafienia.length ? 'porazka' : 'ok', sekundy: null, trafienia }
  if (nowe.length) wynik.powod = `nowe migracje spoza sumy: ${nowe.join(', ')}`
  return wynik
}

/**
 * Dopisuje do sumy migracje, ktorych w niej nie ma (tworzy plik, gdy go brak). Istniejacych wpisow nie zmienia.
 * @param {string} projekt
 * @returns {string[]} dopisane nazwy
 */
export function dopiszSume(projekt) {
  const zapisane = wpisy(projekt)
  const nowe = migracje(projekt).filter((n) => !zapisane.has(n))
  if (nowe.length) appendFileSync(join(projekt, PLIK_SUMY), nowe.map((n) => `${skrot(projekt, n)}  ${n}\n`).join(''))
  return nowe
}
