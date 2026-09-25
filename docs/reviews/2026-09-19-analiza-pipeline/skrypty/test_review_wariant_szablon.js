export const meta = {
  name: '__NAZWA__',
  description: 'Test review (TEST-REVIEW-PLAN §4.2): etap znajdowania projektu __PROJEKT__ na kopii fazy __ETYKIETA__ — role z katalogu, agregacja projektu, zwrot findingów PRZED weryfikacją',
  phases: [{ title: 'Review', detail: 'role projektu równolegle' }, { title: 'Agregacja', detail: 'dedup/agregator projektu' }],
}

// Dane fazy wklejone przez skrypty/test_review_warianty.py (prompty złożone z brzmienia katalogu, efort i model per rola z role_koszt[]).
// Czysty JS: konkatenacja zamiast template literals (HANDOFF §7).
const DANE = __DANE__

const RANGA = { P1: 0, P2: 1, P3: 2 }
const opcje = (r) => {
  const o = { schema: DANE.schematy[r.schemat], label: r.etykieta, phase: 'Review' }
  if (r.model) o.model = r.model
  if (r.effort) o.effort = r.effort
  return o
}
const kluczPliku = (p) => String(p || '').split(':')[0].trim().toLowerCase()

phase('Review')
const wyniki = await parallel(DANE.role.map((r) => () => agent(r.prompt, opcje(r))))
const nulle = DANE.role.filter((r, i) => !wyniki[i]).map((r) => r.etykieta)
if (nulle.length) log('Role z wynikiem null: ' + nulle.join(', '))

// Normalizacja: każdy finding niesie rolę, soczewkę i numer próbki (tylko w danych — sędzia ich nie widzi).
const surowe = []
DANE.role.forEach((r, i) => {
  const w = wyniki[i]
  if (!w) return
  const lista = w.findings || w.pozycje || []
  for (const f of lista) surowe.push({ ...f, waga: f.waga || 'P2', _rola: r.klucz, _soczewka: f.soczewka || r.soczewka, _probka: r.probka || null })
})
const listyWyniki = DANE.role.map((r, i) => ({ rola: r.klucz, listy: (wyniki[i] && wyniki[i].listy) || null }))

phase('Agregacja')
let findings = surowe
const przebieg = { surowe: surowe.length, nulle: nulle }

if (DANE.tryb === 'fix') {
  // Moduł §2.6: kontrola diffu fixa — pozycje wszystkich prób (B: suma dwóch próbek), bez dedupu.
  przebieg.agregacja = 'suma pozycji kontroli'
} else if (DANE.projekt === 'A') {
  // A: P3 maks 3 na soczewkę; dedup JS (dokładne powtórzenia jak dziś) + haiku semantyczny z zachowaniem lista_id obu źródeł.
  const p3 = {}
  findings = surowe.filter((f) => {
    if (f.waga !== 'P3') return true
    p3[f._soczewka] = (p3[f._soczewka] || 0) + 1
    return p3[f._soczewka] <= 3
  })
  przebieg.p3Odrzucone = surowe.length - findings.length
  const poKluczu = new Map()
  for (const f of findings) {
    const k = kluczPliku(f.plik) + '|' + String(f.opis || '').slice(0, 60).toLowerCase()
    const o = poKluczu.get(k)
    if (!o) poKluczu.set(k, { ...f, lista_id: [f.lista_id].filter(Boolean) })
    else { o.lista_id = [...new Set([...o.lista_id, f.lista_id].filter(Boolean))]; if (RANGA[f.waga] < RANGA[o.waga]) o.waga = f.waga }
  }
  findings = [...poKluczu.values()]
  przebieg.poDedupJs = findings.length
  const soczewkiZFindingami = new Set(findings.map((f) => f._soczewka))
  if (findings.length > 1 && soczewkiZFindingami.size >= 2) {
    const grupy = await agent(DANE.promptDedup + '\n\n' + findings.map((f, i) => i + '. [' + f.waga + '/' + f.typ + '] ' + f.plik + ':' + f.linia + ' — ' + f.opis).join('\n'),
      { schema: DANE.schematy.DEDUP, label: 'A:dedup:semantyczny[haiku]', model: 'haiku', phase: 'Agregacja' })
    if (grupy && Array.isArray(grupy.duplikaty)) {
      const usun = new Set()
      for (const g of grupy.duplikaty) {
        const ok = [...new Set(g)].filter((i) => Number.isInteger(i) && i >= 0 && i < findings.length)
        if (ok.length < 2) continue
        const rep = ok.reduce((a, b) => (RANGA[findings[a].waga] <= RANGA[findings[b].waga] ? a : b))
        for (const i of ok) if (i !== rep) { usun.add(i); findings[rep].lista_id = [...new Set([...findings[rep].lista_id, ...findings[i].lista_id])] }
      }
      findings = findings.filter((_, i) => !usun.has(i))
    } else przebieg.dedupNull = true
  }
  przebieg.poDedupSem = findings.length
} else if (DANE.projekt === 'B') {
  // B: wstępne uporządkowanie po (plik, linia), agregator haiku grupuje „ten sam defekt” bez nazw próbek; JS liczy k = liczba różnych
  // próbek tej samej osi w grupie; k >= 2 z 3 = zgodny. P3 sporadyczny odpada; P1/P2 zostają wszystkie (filtr = sceptyk).
  const lista = surowe.map((f, i) => ({ f, i })).sort((a, b) => (kluczPliku(a.f.plik) < kluczPliku(b.f.plik) ? -1 : kluczPliku(a.f.plik) > kluczPliku(b.f.plik) ? 1 : (a.f.linia || 0) - (b.f.linia || 0)))
  let grupy = null
  if (lista.length > 1) {
    const w = await agent(DANE.promptDedup + '\n\n' + lista.map((x, j) => j + '. [' + x.f.waga + '/' + x.f.typ + '] ' + x.f.plik + ':' + x.f.linia + ' — ' + x.f.opis).join('\n'),
      { schema: DANE.schematy.AGREGATOR, label: 'B:agregator[haiku]', model: 'haiku', phase: 'Agregacja' })
    if (w && Array.isArray(w.grupy)) grupy = w.grupy
    else przebieg.agregatorNull = true
  }
  const przydzial = new Map()
  ;(grupy || []).forEach((g, gi) => g.forEach((j) => { if (Number.isInteger(j) && j >= 0 && j < lista.length && !przydzial.has(j)) przydzial.set(j, gi) }))
  const zbior = new Map()
  lista.forEach((x, j) => {
    const g = przydzial.has(j) ? 'g' + przydzial.get(j) : 's' + j
    if (!zbior.has(g)) zbior.set(g, [])
    zbior.get(g).push(x.f)
  })
  const wynik = []
  let sporadyczneP3 = 0
  for (const czlonkowie of zbior.values()) {
    const rep = czlonkowie.reduce((a, b) => (RANGA[a.waga] <= RANGA[b.waga] ? a : b))
    const probkowane = czlonkowie.filter((f) => f._probka)
    const poOsiach = {}
    for (const f of probkowane) (poOsiach[f._soczewka] = poOsiach[f._soczewka] || new Set()).add(f._probka)
    const k = Math.max(0, ...Object.values(poOsiach).map((s) => s.size))
    const zgodny = k >= 2
    const tylkoProbki = czlonkowie.every((f) => f._probka)
    const waga = zgodny ? rep.waga : (tylkoProbki ? czlonkowie[0].waga : rep.waga)
    if (waga === 'P3' && tylkoProbki && !zgodny) { sporadyczneP3++; continue }
    wynik.push({ ...rep, waga, _k: k, _zgodny: zgodny, _czlonkowie: czlonkowie.length })
  }
  findings = wynik
  przebieg.grupy = zbior.size
  przebieg.p3SporadyczneOdrzucone = sporadyczneP3
} else if (DANE.projekt === 'C') {
  // C: bez agenta dedup — JS łączy pary o tym samym pliku, |Δlinia| <= 3 i tej samej soczewce (wyższa waga wygrywa).
  const wynik = []
  for (const f of surowe) {
    const bliski = wynik.find((g) => kluczPliku(g.plik) === kluczPliku(f.plik) && g._soczewka === f._soczewka && Math.abs((g.linia || 0) - (f.linia || 0)) <= 3)
    if (!bliski) wynik.push({ ...f })
    else if (RANGA[f.waga] < RANGA[bliski.waga]) bliski.waga = f.waga
  }
  findings = wynik
  przebieg.poScaleniu = findings.length
}

return { projekt: DANE.projekt, etykieta: DANE.etykieta, tryb: DANE.tryb, findings, przebieg, listy: listyWyniki }
