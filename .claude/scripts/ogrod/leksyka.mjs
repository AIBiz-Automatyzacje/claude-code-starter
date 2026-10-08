// Lekser plikow JS/TS dla pomiaru ogrodnika: rozdziela komentarze od kodu i wygasza tresc stringow, zeby wzorce kodu
// (`as any`, pusty `catch`) nie trafialy w tekst, a wzorce komentarzy (TODO, eslint-disable) w stringi.
// Przyblizenie swiadome: tekst JSX nie jest stringiem, a literal regex rozpoznajemy po poprzedzajacym znaku. String
// w apostrofach albo cudzyslowie konczy sie najpozniej na koncu linii, wiec pomylka lekseru psuje najwyzej jedna linie.

// Znaki, po ktorych `/` otwiera literal regex, a nie dzielenie.
const PRZED_REGEXEM = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])
const SLOWA_PRZED_REGEXEM = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|yield|await)$/

/** @typedef {{ linia: number, tekst: string }} LiniaKomentarza */
/** @typedef {{ kod: string, komentarze: LiniaKomentarza[] }} Rozbior */

/**
 * @param {string} tekst
 * @param {number} poz
 * @returns {boolean}
 */
function regexMozliwy(tekst, poz) {
  let i = poz - 1
  while (i >= 0 && /\s/.test(tekst[i])) i--
  if (i < 0) return true
  if (PRZED_REGEXEM.has(tekst[i])) return true
  return SLOWA_PRZED_REGEXEM.test(tekst.slice(Math.max(0, i - 7), i + 1))
}

/**
 * Koniec literalu regex od pozycji otwierajacego `/` (indeks za zamykajacym `/`) albo -1, gdy linia sie konczy wczesniej.
 * @param {string} tekst
 * @param {number} poz
 * @returns {number}
 */
function koniecRegexu(tekst, poz) {
  let wKlasie = false
  for (let i = poz + 1; i < tekst.length; i++) {
    const z = tekst[i]
    if (z === '\n') return -1
    if (z === '\\') i++
    else if (z === '[') wKlasie = true
    else if (z === ']') wKlasie = false
    else if (z === '/' && !wKlasie) return i + 1
  }
  return -1
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
    tekst.slice(od, doIndeksu).split('\n').forEach((t, n) => komentarze.push({ linia: linia + n, tekst: t }))
  }
  let i = 0
  while (i < tekst.length) {
    const z = tekst[i]
    const kontekst = stos[stos.length - 1]
    if (z === '\n') {
      linia++
      i++
      continue
    }
    if (kontekst.typ === 'szablon') {
      if (z === '\\') {
        wygas(i, i + 2)
        i += 2
      } else if (z === '`') {
        stos.pop()
        i++
      } else if (z === '$' && tekst[i + 1] === '{') {
        stos.push({ typ: 'kod', klamry: 0 })
        i += 2
      } else {
        wygas(i, i + 1)
        i++
      }
      continue
    }
    if (z === '/' && tekst[i + 1] === '/') {
      const koniec = tekst.indexOf('\n', i) === -1 ? tekst.length : tekst.indexOf('\n', i)
      dodajKomentarz(i + 2, koniec)
      wygas(i, koniec)
      i = koniec
    } else if (z === '/' && tekst[i + 1] === '*') {
      const zamkniecie = tekst.indexOf('*/', i + 2)
      const koniec = zamkniecie === -1 ? tekst.length : zamkniecie + 2
      dodajKomentarz(i + 2, zamkniecie === -1 ? tekst.length : zamkniecie)
      wygas(i, koniec)
      linia += tekst.slice(i, koniec).split('\n').length - 1
      i = koniec
    } else if (z === '\'' || z === '"') {
      let j = i + 1
      while (j < tekst.length && tekst[j] !== z && tekst[j] !== '\n') j += tekst[j] === '\\' && tekst[j + 1] !== '\n' ? 2 : 1
      wygas(i + 1, Math.min(j, tekst.length))
      i = tekst[j] === z ? j + 1 : j
    } else if (z === '`') {
      stos.push({ typ: 'szablon' })
      i++
    } else if (z === '/' && regexMozliwy(tekst, i) && koniecRegexu(tekst, i) !== -1) {
      const koniec = koniecRegexu(tekst, i)
      wygas(i + 1, koniec - 1)
      i = koniec
    } else {
      if (z === '{') kontekst.klamry++
      if (z === '}' && kontekst.klamry === 0 && stos.length > 1) stos.pop()
      else if (z === '}') kontekst.klamry--
      i++
    }
  }
  return { kod: kod.join(''), komentarze }
}
