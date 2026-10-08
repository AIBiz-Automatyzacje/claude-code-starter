// Lekser plikow JS/TS dla pomiaru ogrodnika: rozdziela komentarze od kodu i wygasza tresc stringow, zeby wzorce kodu
// (`as any`, pusty `catch`) nie trafialy w tekst, a wzorce komentarzy (TODO, eslint-disable) w stringi.
// Przyblizenie swiadome: tekst JSX nie jest stringiem, a literal regex rozpoznajemy po poprzedzajacym znaku. String
// w apostrofach albo cudzyslowie konczy sie najpozniej na koncu linii, wiec pomylka lekseru psuje najwyzej jedna linie.

// Znaki, po ktorych `/` otwiera literal regex, a nie dzielenie (`)` i `]` koncza wyrazenie — po nich jest dzielenie).
const PRZED_REGEXEM = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])
const SLOWA_PRZED_REGEXEM = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|yield|await)$/
// Najdluzsze slowo z SLOWA_PRZED_REGEXEM (`typeof`, `return`) plus znak przed nim.
const OKNO_SLOWA = 7

/** @typedef {{ linia: number, tekst: string, poczatek: boolean }} LiniaKomentarza poczatek = pierwsza linia komentarza */
/** @typedef {{ kod: string, komentarze: LiniaKomentarza[] }} Rozbior */

/**
 * @param {string} tekst
 * @param {number} pozycja indeks znaku `/`
 * @returns {boolean}
 */
function regexMozliwy(tekst, pozycja) {
  // JSX: `</tag>` i `<Foo />` to znaczniki, nie regex.
  if (tekst[pozycja - 1] === '<' || tekst[pozycja + 1] === '>') return false
  let indeks = pozycja - 1
  while (indeks >= 0 && /\s/.test(tekst[indeks])) indeks--
  if (indeks < 0) return true
  if (PRZED_REGEXEM.has(tekst[indeks])) return true
  return SLOWA_PRZED_REGEXEM.test(tekst.slice(Math.max(0, indeks - OKNO_SLOWA), indeks + 1))
}

/**
 * Koniec literalu regex od pozycji otwierajacego `/` (indeks za zamykajacym `/`) albo -1, gdy linia sie konczy wczesniej.
 * @param {string} tekst
 * @param {number} pozycja
 * @returns {number}
 */
function koniecRegexu(tekst, pozycja) {
  let wKlasie = false
  for (let indeks = pozycja + 1; indeks < tekst.length; indeks++) {
    const znak = tekst[indeks]
    if (znak === '\n') return -1
    if (znak === '\\') indeks++
    else if (znak === '[') wKlasie = true
    else if (znak === ']') wKlasie = false
    else if (znak === '/' && !wKlasie) return indeks + 1
  }
  return -1
}

/**
 * Koniec stringu w apostrofach albo cudzyslowie od pozycji cudzyslowu otwierajacego: indeks cudzyslowu zamykajacego
 * albo konca linii (string niezamkniety w tej linii).
 * @param {string} tekst
 * @param {number} pozycja
 * @returns {number}
 */
function koniecStringu(tekst, pozycja) {
  const cudzyslow = tekst[pozycja]
  let indeks = pozycja + 1
  while (indeks < tekst.length && tekst[indeks] !== cudzyslow && tekst[indeks] !== '\n') {
    indeks += tekst[indeks] === '\\' && tekst[indeks + 1] !== '\n' ? 2 : 1
  }
  return Math.min(indeks, tekst.length)
}

/**
 * Rozbior pliku: `kod` ma te sama dlugosc i te same konce linii co wejscie, ale komentarze i tresc stringow sa zastapione
 * spacjami (offset w `kod` = offset w pliku); `komentarze` to linie komentarzy z numerem linii pliku (od 1).
 * @param {string} tekst
 * @returns {Rozbior}
 */
export function rozbierz(tekst) {
  const kod = tekst.split('')
  /** @type {LiniaKomentarza[]} */
  const komentarze = []
  let linia = 1
  // Stos kontekstow: 'kod' (glebokosc nawiasow klamrowych w wyrazeniu `${}`) albo 'szablon'.
  /** @type {Array<{ typ: 'kod', klamry: number } | { typ: 'szablon' }>} */
  const stos = [{ typ: 'kod', klamry: 0 }]
  const wygas = (/** @type {number} */ od, /** @type {number} */ doIndeksu) => {
    for (let k = od; k < doIndeksu; k++) if (kod[k] !== '\n') kod[k] = ' '
  }
  const dodajKomentarz = (/** @type {number} */ od, /** @type {number} */ doIndeksu) => {
    tekst.slice(od, doIndeksu).split('\n').forEach((tresc, numer) => komentarze.push({ linia: linia + numer, tekst: tresc, poczatek: numer === 0 }))
  }
  let i = 0
  while (i < tekst.length) {
    const znak = tekst[i]
    const kontekst = stos[stos.length - 1]
    if (znak === '\n') {
      linia++
      i++
      continue
    }
    if (kontekst.typ === 'szablon') {
      if (znak === '\\') {
        wygas(i, i + 2)
        i += 2
      } else if (znak === '`') {
        stos.pop()
        i++
      } else if (znak === '$' && tekst[i + 1] === '{') {
        stos.push({ typ: 'kod', klamry: 0 })
        i += 2
      } else {
        wygas(i, i + 1)
        i++
      }
      continue
    }
    if (znak === '/' && tekst[i + 1] === '/') {
      const koniec = tekst.indexOf('\n', i) === -1 ? tekst.length : tekst.indexOf('\n', i)
      dodajKomentarz(i + 2, koniec)
      wygas(i, koniec)
      i = koniec
    } else if (znak === '/' && tekst[i + 1] === '*') {
      const zamkniecie = tekst.indexOf('*/', i + 2)
      const koniec = zamkniecie === -1 ? tekst.length : zamkniecie + 2
      dodajKomentarz(i + 2, zamkniecie === -1 ? tekst.length : zamkniecie)
      wygas(i, koniec)
      linia += tekst.slice(i, koniec).split('\n').length - 1
      i = koniec
    } else if (znak === '\'' || znak === '"') {
      const koniec = koniecStringu(tekst, i)
      wygas(i + 1, koniec)
      i = tekst[koniec] === znak ? koniec + 1 : koniec
    } else if (znak === '`') {
      stos.push({ typ: 'szablon' })
      i++
    } else if (znak === '/' && regexMozliwy(tekst, i) && koniecRegexu(tekst, i) !== -1) {
      const koniec = koniecRegexu(tekst, i)
      wygas(i + 1, koniec - 1)
      i = koniec
    } else {
      if (znak === '{') kontekst.klamry++
      if (znak === '}' && kontekst.klamry === 0 && stos.length > 1) stos.pop()
      else if (znak === '}') kontekst.klamry--
      i++
    }
  }
  return { kod: kod.join(''), komentarze }
}
