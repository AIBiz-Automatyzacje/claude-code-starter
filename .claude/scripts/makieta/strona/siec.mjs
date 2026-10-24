// Skrypt sieci narzedzia makiet (P28 (5), pilot etapu 5): proxy wstrzykuje go do stron HTML aplikacji, wiec dziala we
// wszystkich ramkach i w karcie z „Otwórz w karcie”. Opoznia albo odrzuca zadania `fetch` i XMLHttpRequest aplikacji wedlug
// ustawien `makieta.siec` w localStorage (wspolny origin ze strona narzedzia) — czytanych przy kazdym zadaniu, wiec zmiana
// w panelu „Sieć” dziala bez przeladowania ramki. Zastepuje throttling i blokade adresow z DevTools przy wywolywaniu stanow
// ladowania i bledow. Nie obejmuje nawigacji, obrazow ani ramek obcych (np. widget Turnstile). Klasyczny skrypt: musi wykonac
// sie przed modulami aplikacji.
;(() => {
  const okno = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (window))
  if (okno.__makietaSiec) return
  // Znacznik dla strony narzedzia: skrypt dziala w tej ramce (CSP aplikacji go nie zablokowal).
  okno.__makietaSiec = true
  const KLUCZ = 'makieta.siec'

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
  /** @type {WeakMap<XMLHttpRequest, string>} */
  const adresyXhr = new WeakMap()
  /**
   * @this {XMLHttpRequest}
   * @param {string} metoda @param {string | URL} url @param {boolean} [asynchronicznie] @param {string | null} [uzytkownik] @param {string | null} [haslo]
   */
  function openZNarzedzia(metoda, url, asynchronicznie = true, uzytkownik, haslo) {
    adresyXhr.set(this, String(url))
    return open.call(this, metoda, url, asynchronicznie, uzytkownik, haslo)
  }
  Xhr.prototype.open = /** @type {typeof open} */ (openZNarzedzia)
  /** @param {Document | XMLHttpRequestBodyInit | null} [cialo] */
  Xhr.prototype.send = function sendZNarzedzia(cialo) {
    const { opoznienieMs, blokady } = ustawienia()
    const zablokowane = zablokowany(adres(adresyXhr.get(this) ?? ''), blokady)
    if (!opoznienieMs && !zablokowane) return send.call(this, cialo)
    setTimeout(() => {
      if (!zablokowane) return send.call(this, cialo)
      this.dispatchEvent(new ProgressEvent('error'))
      this.dispatchEvent(new ProgressEvent('loadend'))
    }, opoznienieMs)
  }
})()
