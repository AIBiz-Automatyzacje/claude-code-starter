// Skrypt sieci narzedzia makiet (P28 (5), pilot etapu 5): proxy wstrzykuje go do stron HTML aplikacji, wiec dziala we
// wszystkich ramkach i w karcie z „Otwórz w karcie”. Opoznia albo odrzuca zadania `fetch` i XMLHttpRequest aplikacji wedlug
// ustawien `makieta.siec` w localStorage (wspolny origin ze strona narzedzia) — czytanych przy kazdym zadaniu, wiec zmiana
// w panelu „Sieć” dziala bez przeladowania ramki. Zastepuje throttling i blokade adresow z DevTools przy wywolywaniu stanow
// ladowania i bledow. Nie obejmuje nawigacji, obrazow ani ramek obcych (np. widget Turnstile). Klasyczny skrypt: musi wykonac
// sie przed modulami aplikacji. W ramce zglasza tez stronie narzedzia swoj adres (P27 S3).
;(() => {
  const okno = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (window))
  if (okno.__makietaSiec) return
  // Znacznik dla strony narzedzia: skrypt dziala w tej ramce (CSP aplikacji go nie zablokowal).
  okno.__makietaSiec = true
  const KLUCZ = 'makieta.siec'

  // Adres ramki dla strony narzedzia (P27 S3 poz. 25–26): pasek adresu, „Ramki razem” i „Przeładuj ramki” w biezacym miejscu.
  // Tylko w ramce (karta z „Otwórz w karcie” nie ma rodzica), tylko do originu narzedzia; ten sam adres nie idzie drugi raz.
  // Rodzaj zmiany (start dokumentu, push, replace, pop) odroznia przekierowanie od klikniecia operatora.
  if (window.parent && window.parent !== window) {
    let zgloszony = ''
    /** @param {'start' | 'push' | 'replace' | 'pop'} rodzaj */
    const zglos = (rodzaj) => {
      const adres = window.location.pathname + window.location.search + window.location.hash
      if (adres === zgloszony) return
      zgloszony = adres
      window.parent.postMessage({ makieta: 'adres', adres, rodzaj }, window.location.origin)
    }
    const { pushState, replaceState } = window.history
    /** @param {Parameters<History['pushState']>} argumenty */
    window.history.pushState = function pushStateZNarzedzia(...argumenty) {
      pushState.apply(this, argumenty)
      zglos('push')
    }
    /** @param {Parameters<History['replaceState']>} argumenty */
    window.history.replaceState = function replaceStateZNarzedzia(...argumenty) {
      replaceState.apply(this, argumenty)
      zglos('replace')
    }
    window.addEventListener('popstate', () => zglos('pop'))
    window.addEventListener('hashchange', () => zglos('pop'))
    zglos('start')
  }

  /** @returns {{ opoznienieMs: number, blokady: string[] }} ustawienia albo brak ograniczen (brak zapisu, zapis uszkodzony) */
  function ustawienia() {
    try {
      const u = JSON.parse(window.localStorage.getItem(KLUCZ) ?? 'null')
      const opoznienieMs = u && Number.isFinite(u.opoznienieMs) && u.opoznienieMs > 0 ? u.opoznienieMs : 0
      const blokady = u && Array.isArray(u.blokady) ? u.blokady.filter((/** @type {unknown} */ w) => typeof w === 'string' && w.trim()) : []
      return { opoznienieMs, blokady }
    } catch {
      // localStorage niedostepny albo zapis uszkodzony — aplikacja dziala bez ograniczen.
      return { opoznienieMs: 0, blokady: [] }
    }
  }

  /** @param {string} wzorzec fragment adresu z `*` jako dowolnym ciagiem (jak blokada adresow w DevTools) @returns {RegExp} */
  const wyrazenie = (wzorzec) => new RegExp(wzorzec.trim().split('*').map((c) => c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*'))

  /** @param {unknown} wejscie @returns {string} adres bezwzgledny zadania */
  const adres = (wejscie) => new URL(wejscie instanceof Request ? wejscie.url : String(wejscie), window.location.href).href

  /** @param {string} url @param {string[]} blokady */
  const zablokowany = (url, blokady) => blokady.some((w) => wyrazenie(w).test(url))

  /** @param {number} ms */
  const czekaj = (ms) => new Promise((ok) => setTimeout(ok, ms))

  const fetchAplikacji = window.fetch
  window.fetch = async function fetchZNarzedzia(wejscie, opcje) {
    const { opoznienieMs, blokady } = ustawienia()
    if (opoznienieMs) await czekaj(opoznienieMs)
    if (zablokowany(adres(wejscie), blokady)) throw new TypeError('Failed to fetch (zablokowane w narzędziu makiet)')
    return fetchAplikacji.call(this, wejscie, opcje)
  }

  const Xhr = window.XMLHttpRequest
  if (!Xhr) return
  const open = Xhr.prototype.open
  const send = Xhr.prototype.send
  const abort = Xhr.prototype.abort
  /** @type {WeakMap<XMLHttpRequest, { url: string, asynchronicznie: boolean }>} */
  const zadaniaXhr = new WeakMap()
  /** @type {WeakSet<XMLHttpRequest>} */
  const przerwane = new WeakSet()
  /**
   * @this {XMLHttpRequest}
   * @param {string} metoda @param {string | URL} url @param {boolean} [asynchronicznie] @param {string | null} [uzytkownik] @param {string | null} [haslo]
   */
  function openZNarzedzia(metoda, url, asynchronicznie = true, uzytkownik, haslo) {
    zadaniaXhr.set(this, { url: String(url), asynchronicznie })
    przerwane.delete(this)
    return open.call(this, metoda, url, asynchronicznie, uzytkownik, haslo)
  }
  Xhr.prototype.open = /** @type {typeof open} */ (openZNarzedzia)
  // abort() w trakcie opoznienia: zadanie nie jest jeszcze wyslane, wiec bez znacznika poszloby po czasie mimo przerwania.
  Xhr.prototype.abort = function abortZNarzedzia() {
    przerwane.add(this)
    return abort.call(this)
  }
  /** @param {Document | XMLHttpRequestBodyInit | null} [cialo] */
  Xhr.prototype.send = function sendZNarzedzia(cialo) {
    const { opoznienieMs, blokady } = ustawienia()
    const zadanie = zadaniaXhr.get(this) ?? { url: '', asynchronicznie: true }
    const zablokowane = zablokowany(adres(zadanie.url), blokady)
    // Synchroniczny XHR zostaje synchroniczny: bez opoznienia, blokada jak blad sieci przegladarki.
    if (!zadanie.asynchronicznie && zablokowane) throw new DOMException('zablokowane w narzędziu makiet', 'NetworkError')
    if (!zadanie.asynchronicznie || (!opoznienieMs && !zablokowane)) return send.call(this, cialo)
    setTimeout(() => {
      if (przerwane.has(this)) return
      if (!zablokowane) return send.call(this, cialo)
      // readyState zostaje OPENED (tylko do odczytu) — readystatechange budzi biblioteki, ktore nie sluchaja `error`.
      for (const zdarzenie of ['readystatechange', 'error', 'loadend']) this.dispatchEvent(zdarzenie === 'readystatechange' ? new Event(zdarzenie) : new ProgressEvent(zdarzenie))
    }, opoznienieMs)
  }
})()
