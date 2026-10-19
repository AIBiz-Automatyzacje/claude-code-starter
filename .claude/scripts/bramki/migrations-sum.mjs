// Bramka migrations.sum: SHA-256 kazdej zapisanej migracji w supabase/migrations.sum (format sha256sum — sprawdzenie reczne:
// `cd supabase/migrations && shasum -a 256 -c ../migrations.sum`). Wpis raz zapisany sie nie zmienia; migracja z sumy zmieniona
// albo usunieta = porazka niezaleznie od bazy fazy. Nowe migracje dopisuje dopiszSume (domkniecie po bramkach).
// Konflikt rebase'u w sumie (obie strony dopisaly wpisy na koncu) rozwiazuje scalSume: suma wpisow obu stron, bez przeliczania.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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
 * Projekt bez katalogu migracji: nic (domkniecie fazy wola dopisanie zawsze).
 * @param {string} projekt
 * @returns {string[]} dopisane nazwy
 */
export function dopiszSume(projekt) {
  if (!existsSync(join(projekt, KATALOG_MIGRACJI))) return []
  const zapisane = wpisy(projekt)
  const nowe = migracje(projekt).filter((n) => !zapisane.has(n))
  if (nowe.length) appendFileSync(join(projekt, PLIK_SUMY), nowe.map((n) => `${skrot(projekt, n)}  ${n}\n`).join(''))
  return nowe
}

/**
 * Wpisy obu stron konfliktu w kolejnosci: najpierw nasze (przy rebase'ie = galaz docelowa), potem ich nowe. Wpis jest
 * niezmienny, wiec ta sama migracja z inna suma po obu stronach to prawdziwy konflikt, nie do scalenia. Niepusta linia
 * spoza formatu (CRLF, wielkie litery skrotu, komentarz) tez — scalenie po cichu by ja wyrzucilo, a bramka jej nie widzi.
 * @param {string} nasza
 * @param {string} ich
 * @returns {{ tresc: string, dopisane: string[] } | { sprzeczne: string[] } | { nieparsowalne: string[] }}
 */
export function scalWpisy(nasza, ich) {
  const nieparsowalne = [nasza, ich].flatMap((tekst) => tekst.split('\n').filter((l) => l !== '' && !WPIS.test(l)))
  if (nieparsowalne.length) return { nieparsowalne }
  /** @param {string} tekst @returns {[string, string, string][]} [nazwa, skrot, linia] */
  const rozbierz = (tekst) => tekst.split('\n').flatMap((l) => {
    const m = WPIS.exec(l)
    return m ? [[m[2], m[1], l]] : []
  })
  const nasze = rozbierz(nasza)
  const znane = new Map(nasze.map(([nazwa, s]) => [nazwa, s]))
  const sprzeczne = []
  const nowe = []
  for (const wpis of rozbierz(ich)) {
    const s = znane.get(wpis[0])
    if (s === undefined) {
      znane.set(wpis[0], wpis[1])
      nowe.push(wpis)
    } else if (s !== wpis[1]) sprzeczne.push(wpis[0])
  }
  if (sprzeczne.length) return { sprzeczne }
  return { tresc: [...nasze, ...nowe].map(([, , l]) => `${l}\n`).join(''), dopisane: nowe.map(([nazwa]) => nazwa) }
}

/**
 * Rozwiazanie konfliktu rebase'u w sumie: wersje :2 i :3 z indeksu gita scalone przez scalWpisy, zapis i bramka na drzewie.
 * Przy porazce bramki plik wraca do stanu z markerami konfliktu, zeby operator nie dodal odrzuconej wersji.
 * Nie robi `git add` — wolajacy dodaje plik tylko przy scalony: true.
 * @param {string} projekt
 * @returns {{ scalony: true, dopisane: string[] } | { scalony: false, powod: string }}
 */
export function scalSume(projekt) {
  /** @param {number} etap */
  const wersja = (etap) => spawnSync('git', ['-C', projekt, 'show', `:${etap}:./${PLIK_SUMY}`], { encoding: 'utf8' })
  const [nasza, ich] = [wersja(2), wersja(3)]
  if (nasza.status !== 0 || ich.status !== 0) {
    const strona = nasza.status !== 0 ? 'galezi docelowej (:2)' : 'commitu czesci (:3)'
    return { scalony: false, powod: `brak wersji ${PLIK_SUMY} po stronie ${strona} — suma usunieta po jednej stronie albo bez konfliktu w niej; rozwiaz recznie` }
  }
  const wynik = scalWpisy(nasza.stdout, ich.stdout)
  if ('nieparsowalne' in wynik) return { scalony: false, powod: `linie spoza formatu sha256sum (CRLF, wielkie litery, komentarz): ${wynik.nieparsowalne.map((l) => JSON.stringify(l)).join(', ')}` }
  if ('sprzeczne' in wynik) return { scalony: false, powod: `ta sama migracja z inna suma po obu stronach: ${wynik.sprzeczne.join(', ')}` }
  const sciezka = join(projekt, PLIK_SUMY)
  const zKonfliktem = readFileSync(sciezka, 'utf8')
  writeFileSync(sciezka, wynik.tresc)
  const bramka = bramkaMigrationsSum(projekt)
  if (bramka.status === 'porazka') {
    writeFileSync(sciezka, zKonfliktem)
    return { scalony: false, powod: `suma po scaleniu nie zgadza sie z migracjami: ${bramka.trafienia.map((t) => `${t.plik} — ${t.opis}`).join('; ')}` }
  }
  return { scalony: true, dopisane: wynik.dopisane }
}
