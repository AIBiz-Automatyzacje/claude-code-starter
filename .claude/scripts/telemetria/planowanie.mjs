// Pole `artefakty` rekordu skill (d5-telemetria-rekord.txt §7, PLAN-POPRAWY P13): wyniki `plan.mjs sprawdz | generuj | gotowosc`
// z epizodu /dev-plan — rozmiary planu i zadan, budzet pliku, odrzucenia planu przez walidacje i ostatnia bramka gotowosci.
// Zrodlo: wywolania Bash w transkrypcie sesji glownej i JSON z ich wynikow; wynik bez JSON (blad uruchomienia) jest pomijany.

const RE_PLAN = /plan\.mjs(?:\s+--[\w-]+(?:\s+(?!sprawdz\b|generuj\b|gotowosc\b)[^\s-]\S*)?)*\s+(sprawdz|generuj|gotowosc)\b/
// Bledy budzetu pliku z walidacji (budzet-pliku.mjs): prog ESLint, wymiary ponad prog pytania, rozjazd linii "dzis".
const RE_BUDZET = /linii > \d+|linii kodu \(bez pustych|tabela podaje dziś|wcześniejsza jednostka planu kończy/
const POZYCJE_BRAMKI = ['plan', 'e2e', 'przygotowanie', 'git']

/**
 * @typedef {{ polecenie: string, wynik: Record<string, unknown> | null }} WywolaniePlanu
 * @typedef {{ plan_kb: number | null, zadania_kb: number | null, iu: number | null, iu_z_wymiarami: number | null,
 *   wydzielenia: number | null, walidacja: { n: number, odrzucone: number, bledy_pierwszy: number | null, bledy_budzetu_pierwszy: number | null },
 *   gotowosc: { n: number, ok_ostatnia: boolean | null, czerwone_ostatnia: string[] } }} Artefakty
 */

/** @param {Record<string, unknown>} blok tool_use @returns {string | null} polecenie plan.mjs wywolane przez Bash */
export function poleceniePlanu(blok) {
  const wejscie = blok.input
  const komenda = blok.name === 'Bash' && wejscie && typeof wejscie === 'object' && 'command' in wejscie ? String(wejscie.command) : ''
  return RE_PLAN.exec(komenda)?.[1] ?? null
}

/** @param {unknown} tresc content bloku tool_result (tekst albo bloki text) @returns {Record<string, unknown> | null} */
export function wynikJson(tresc) {
  const tekst = typeof tresc === 'string' ? tresc
    : Array.isArray(tresc) ? tresc.map((b) => (b && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('\n') : ''
  const linie = tekst.split('\n')
  // Jedna linia JSON (wyjscie plan.mjs) albo JSON wieloliniowy od linii „{” (np. po `| jq .`).
  const kandydaci = [linie.slice().reverse().find((l) => l.trim().startsWith('{') && l.trim() !== '{'),
    linie.slice(linie.findIndex((l) => l.trim() === '{')).join('\n')]
  for (const k of kandydaci) {
    if (!k?.trim().startsWith('{')) continue
    try {
      const w = JSON.parse(k)
      if (w && typeof w === 'object' && !Array.isArray(w)) return w
    } catch {
      continue
    }
  }
  return null
}

/** @param {unknown} v @returns {Record<string, unknown>} */
const obiekt = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {})
/** @param {unknown} v @returns {number | null} */
const liczba = (v) => (typeof v === 'number' ? v : null)
/** @param {number | null} zn @returns {number | null} */
const kb = (zn) => (zn === null ? null : Math.round(zn / 1024))

/**
 * @param {WywolaniePlanu[]} wywolania w kolejnosci wywolan
 * @returns {Artefakty | null} null = epizod bez plan.mjs
 */
export function artefaktyPlanu(wywolania) {
  const odczytane = wywolania.filter((w) => w.wynik !== null)
  if (!wywolania.length) return null
  const zBledami = odczytane.filter((w) => (w.polecenie === 'sprawdz' || w.polecenie === 'generuj') && Array.isArray(w.wynik?.bledy))
  const pierwszy = zBledami[0]?.wynik?.bledy
  const bledyPierwszy = Array.isArray(pierwszy) ? pierwszy.map(String) : null
  const generuj = obiekt(odczytane.filter((w) => w.polecenie === 'generuj' && w.wynik?.liczniki).at(-1)?.wynik)
  const rozmiary = obiekt(generuj.rozmiary)
  const budzet = obiekt(generuj.budzet)
  const bramki = odczytane.filter((w) => w.polecenie === 'gotowosc')
  const ostatnia = obiekt(bramki.at(-1)?.wynik)
  return {
    plan_kb: kb(liczba(rozmiary.plan_zn)),
    zadania_kb: kb(liczba(rozmiary.zadania_zn)),
    iu: liczba(obiekt(generuj.liczniki).iu),
    iu_z_wymiarami: liczba(budzet.iu_z_wymiarami),
    wydzielenia: liczba(budzet.wydzielenia),
    walidacja: {
      n: wywolania.filter((w) => w.polecenie === 'sprawdz').length,
      odrzucone: zBledami.filter((w) => Array.isArray(w.wynik?.bledy) && w.wynik.bledy.length > 0).length,
      bledy_pierwszy: bledyPierwszy?.length ?? null,
      bledy_budzetu_pierwszy: bledyPierwszy ? bledyPierwszy.filter((b) => RE_BUDZET.test(b)).length : null,
    },
    gotowosc: {
      n: wywolania.filter((w) => w.polecenie === 'gotowosc').length,
      ok_ostatnia: typeof ostatnia.ok === 'boolean' ? ostatnia.ok : null,
      czerwone_ostatnia: POZYCJE_BRAMKI.filter((k) => obiekt(ostatnia[k]).ok === false),
    },
  }
}
