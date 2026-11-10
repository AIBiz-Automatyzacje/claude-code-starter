// Odswiezenie pliku zadan po zmianie planu technicznego w trakcie zadania (znaleziska szablonu, punkt 34).
//
// Dashboard E2 (faza 6): przeniesienie dwoch pozycji do IU-32 wymagalo recznej edycji planu technicznego, pliku zadan
// i `.autopilot-state.json`, bo `generuj --nadpisz` odmawia przy zadaniu z przebiegiem. Tu sesja poprawia sam plan
// techniczny, a skrypt liczy roznice miedzy plikiem zadan z planu sprzed zmiany (`git show <od>:<plan>`) i z planu
// obecnego, po czym naklada ja na plik zadan na dysku: odhaczenia i wszystko, co dopisal run (sekcje „Do poprawy po
// review”, zmienione linie testera), zostaja. Pozycja o tej samej tresci przeniesiona do innej jednostki zabiera
// swoje odhaczenie. Linii zmienionej przez run nie zgadujemy: brak dokladnego dopasowania to konflikt i nic nie zapisujemy.
// Pliku stanu skrypt nie zmienia.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { parsujPlan } from './plan-techniczny.mjs'
import { sprawdzPlan } from './walidacja-planu.mjs'
import { checkboxyIu, naglowekFazy, wierszFazy } from './zadanie.mjs'

/**
 * @typedef {import('./plan-techniczny.mjs').Plan} Plan
 * @typedef {{ id: string, naglowek: string, linie: string[], operator: string[] }} IuZadan
 * @typedef {{ numer: number, naglowek: string[], wiersz: string, iu: IuZadan[] }} FazaZadan
 * @typedef {{ ok: boolean, odmowa: string | null, plan: string | null, od: string, konflikty: string[], bledy: string[],
 *   zmiany: { dodane: string[], usuniete: string[], przeniesione: string[], naglowki: string[], noweIu: string[], usunieteIu: string[], tabelaFaz: number[] },
 *   pliki: Record<string, string> }} Odswiezenie
 */

const CHECKBOX = /^- \[([ xX])\] (.*)$/
const NAGLOWEK_2 = /^## /
const NAGLOWEK_2_3 = /^#{2,3} /

/** @param {string} linia @returns {string} tresc checkboxa bez `- [ ] ` */
const tresc = (linia) => linia.replace(/^- \[ \] /, '')
/** @param {string} t @returns {string} klucz przeniesienia: pozycja operatora niesie w nawiasie id jednostki, ktora sie zmienia */
const kluczPrzeniesienia = (t) => t.replace(/ \(IU-[^)]+\)$/, '')
/** @param {string} id @returns {string} */
const kluczIu = (id) => String(id).toLowerCase().replace(/^iu[\s-]*/, '').trim()

/** @param {Plan} plan @returns {FazaZadan[]} linie pliku zadan, ktore generator zbudowalby z planu */
export function strukturaZadan(plan) {
  return plan.fazy.map((f) => ({
    numer: f.numer,
    naglowek: naglowekFazy(f),
    wiersz: wierszFazy(f),
    iu: f.iu.map((j) => {
      const c = checkboxyIu(j)
      return { id: j.id, naglowek: c.linie[0], linie: c.linie.slice(1).filter(Boolean).map(tresc), operator: c.operator.map(tresc) }
    }),
  }))
}

/** @param {string[]} stare @param {string[]} nowe @returns {{ usuniete: string[], dodane: string[] }} roznica wielozbiorow */
export function roznica(stare, nowe) {
  const bez = (/** @type {string[]} */ z, /** @type {string[]} */ odejmij) => {
    const licznik = new Map()
    for (const t of odejmij) licznik.set(t, (licznik.get(t) ?? 0) + 1)
    return z.filter((t) => {
      const n = licznik.get(t) ?? 0
      if (n) licznik.set(t, n - 1)
      return !n
    })
  }
  return { usuniete: bez(stare, nowe), dodane: bez(nowe, stare) }
}

/** @param {string[]} linie @param {number} start @param {RegExp} koniec @returns {number} indeks pierwszego naglowka po `start` albo dlugosc pliku */
function koniecSekcji(linie, start, koniec) {
  for (let i = start + 1; i < linie.length; i += 1) if (koniec.test(linie[i])) return i
  return linie.length
}

/** @param {string[]} linie @param {string} id @returns {[number, number] | null} sekcja `### IU-K:` do nastepnego naglowka */
function sekcjaIu(linie, id) {
  const start = linie.findIndex((l) => l.startsWith(`### ${id}:`))
  return start === -1 ? null : [start, koniecSekcji(linie, start, NAGLOWEK_2_3)]
}

/** @param {string[]} linie @param {string} naglowek @returns {[number, number] | null} sekcja poziomu 2 o dokladnym naglowku */
function sekcja2(linie, naglowek) {
  const start = linie.indexOf(naglowek)
  return start === -1 ? null : [start, koniecSekcji(linie, start, NAGLOWEK_2)]
}

/** @param {string[]} linie @param {number} numer @returns {[number, number] | null} sekcja `## Faza N — …` */
function sekcjaFazy(linie, numer) {
  const start = linie.findIndex((l) => new RegExp(`^## Faza ${numer}(?!\\d)`).test(l))
  return start === -1 ? null : [start, koniecSekcji(linie, start, NAGLOWEK_2)]
}

/** @param {string[]} linie @param {[number, number]} zakres @param {string} t @returns {number} indeks checkboxa o tej tresci albo -1 */
function znajdz(linie, [od, po], t) {
  for (let i = od; i < po; i += 1) if (CHECKBOX.exec(linie[i])?.[2] === t) return i
  return -1
}

/** @param {string[]} linie @param {[number, number]} zakres @returns {boolean} sekcja bez tresci poza naglowkiem */
const pusta = (linie, [od, po]) => linie.slice(od + 1, po).every((l) => !l.trim())

/**
 * Stan przebiegu z `.autopilot-state.json`: fazy z execute „done” i jednostki zapisane domknieciem czesciowym. Nowa pozycja
 * w zbudowanej fazie albo jednostce nigdy nie zostalaby wykonana (planner pomija je), wiec odswiezenie jej tam nie dopisze.
 * @param {string} katalog katalog zadania (absolutny)
 * @returns {{ fazy: Set<number>, iu: Set<string> }}
 */
function zbudowane(katalog) {
  const plik = join(katalog, '.autopilot-state.json')
  /** @type {{ fazy: Set<number>, iu: Set<string> }} */
  const w = { fazy: new Set(), iu: new Set() }
  if (!existsSync(plik)) return w
  const stan = JSON.parse(readFileSync(plik, 'utf8'))
  for (const f of Array.isArray(stan.fazy) ? stan.fazy : []) {
    if (f.execute === 'done') w.fazy.add(Number(f.numer))
    for (const id of Array.isArray(f.iuUkonczone) ? f.iuUkonczone : []) w.iu.add(kluczIu(id))
  }
  return w
}

/** @param {string} projekt @param {string} rewizja @param {string} sciezka @returns {string | null} plik w rewizji gita */
function plikZRewizji(projekt, rewizja, sciezka) {
  const p = spawnSync('git', ['-C', projekt, 'show', `${rewizja}:${sciezka}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return p.status === 0 ? p.stdout : null
}

/** @param {Odswiezenie} w @param {string} powod @returns {Odswiezenie} */
const odmow = (w, powod) => ({ ...w, ok: false, odmowa: powod })

/**
 * Usuniecia: pozycje, ktorych nowy plan nie ma w danej jednostce (albo cala jednostka). Stan usunietej linii idzie do puli,
 * z ktorej wezmie go ta sama pozycja dodana w innym miejscu.
 * @param {string[]} linie @param {FazaZadan[]} stare @param {FazaZadan[]} nowe @param {Odswiezenie} w @param {Map<string, string[]>} pula
 */
function usun(linie, stare, nowe, w, pula) {
  const zdejmij = (/** @type {[number, number] | null} */ zakres, /** @type {string} */ t, /** @type {string} */ gdzie) => {
    const i = zakres ? znajdz(linie, zakres, t) : -1
    if (i === -1) return void w.konflikty.push(`${gdzie}: nie ma w pliku zadań linii „${t}” (zmienił ją przebieg albo ręczna edycja) — usuń ją ręcznie i uruchom odświeżenie ponownie`)
    const stan = CHECKBOX.exec(linie[i])?.[1] ?? ' '
    pula.set(kluczPrzeniesienia(t), [...(pula.get(kluczPrzeniesienia(t)) ?? []), stan])
    linie.splice(i, 1)
    w.zmiany.usuniete.push(`${gdzie}: ${t}`)
  }
  for (const f of stare) {
    const nowaFaza = nowe.find((n) => n.numer === f.numer)
    for (const iu of f.iu) {
      const nowa = nowaFaza?.iu.find((n) => n.id === iu.id) ?? nowe.flatMap((n) => n.iu).find((n) => n.id === iu.id)
      for (const t of roznica(iu.linie, nowa ? nowa.linie : []).usuniete) zdejmij(sekcjaIu(linie, iu.id), t, iu.id)
      if (nowa) continue
      const zakres = sekcjaIu(linie, iu.id)
      if (zakres && pusta(linie, zakres)) {
        linie.splice(zakres[0], zakres[1] - zakres[0])
        w.zmiany.usunieteIu.push(iu.id)
      } else if (zakres) w.konflikty.push(`${iu.id}: jednostka zniknęła z planu, a jej sekcja w pliku zadań ma linie spoza planu — przenieś je ręcznie`)
    }
    const operatorStary = f.iu.flatMap((j) => j.operator)
    const operatorNowy = (nowaFaza?.iu ?? []).flatMap((j) => j.operator)
    const naglowek = `## Operator checklist faza ${f.numer}`
    for (const t of roznica(operatorStary, operatorNowy).usuniete) zdejmij(sekcja2(linie, naglowek), t, `operator faza ${f.numer}`)
    const zakres = sekcja2(linie, naglowek)
    if (zakres && !operatorNowy.length && pusta(linie, zakres)) linie.splice(zakres[0], zakres[1] - zakres[0])
  }
}

/**
 * @param {string[]} linie @param {[number, number]} zakres @param {string[]} wzor kolejnosc pozycji z nowego planu
 * @param {string} t @returns {number} miejsce wstawienia: za najblizsza wczesniejsza pozycja wzoru, ktora jest w pliku
 */
function miejsce(linie, zakres, wzor, t) {
  for (let k = wzor.indexOf(t) - 1; k >= 0; k -= 1) {
    const i = znajdz(linie, zakres, wzor[k])
    if (i !== -1) return i + 1
  }
  return linie[zakres[0] + 1]?.trim() ? zakres[0] + 1 : Math.min(zakres[0] + 2, zakres[1])
}

/**
 * Dodania: nowe pozycje, nowe jednostki i zmienione naglowki jednostek.
 * @param {string[]} linie @param {FazaZadan[]} stare @param {FazaZadan[]} nowe @param {Odswiezenie} w @param {Map<string, string[]>} pula
 */
function dodaj(linie, stare, nowe, w, pula) {
  const zeStanem = (/** @type {string} */ t, /** @type {string} */ gdzie) => {
    const stan = pula.get(kluczPrzeniesienia(t))?.shift()
    if (stan === undefined) w.zmiany.dodane.push(`${gdzie}: ${t}`)
    else w.zmiany.przeniesione.push(`${gdzie}: ${t}${stan === ' ' ? '' : ' (odhaczona)'}`)
    return `- [${stan ?? ' '}] ${t}`
  }
  const stareIu = new Map(stare.flatMap((f) => f.iu).map((j) => [j.id, j]))
  for (const f of nowe) {
    f.iu.forEach((iu, nr) => {
      const stara = stareIu.get(iu.id)
      const zakres = sekcjaIu(linie, iu.id)
      if (stara && !zakres) return void w.konflikty.push(`${iu.id}: brak sekcji jednostki w pliku zadań`)
      if (stara && zakres) {
        if (stara.naglowek !== iu.naglowek) {
          linie[zakres[0]] = iu.naglowek
          w.zmiany.naglowki.push(iu.naglowek)
        }
        for (const t of roznica(stara.linie, iu.linie).dodane) {
          const teraz = sekcjaIu(linie, iu.id) ?? zakres
          linie.splice(miejsce(linie, teraz, iu.linie, t), 0, zeStanem(t, iu.id))
        }
        return
      }
      const poprzednia = nr > 0 ? sekcjaIu(linie, f.iu[nr - 1].id) : null
      const faza = sekcjaFazy(linie, f.numer)
      if (!faza) return void w.konflikty.push(`${iu.id}: brak sekcji fazy ${f.numer} w pliku zadań`)
      const pierwsza = linie.findIndex((l, i) => i > faza[0] && i < faza[1] && l.startsWith('### '))
      const gdzie = poprzednia ? poprzednia[1] : pierwsza === -1 ? faza[1] : pierwsza
      linie.splice(gdzie, 0, iu.naglowek, '', ...iu.linie.map((t) => zeStanem(t, iu.id)), '')
      w.zmiany.noweIu.push(iu.id)
    })
    const operatorStary = (stare.find((s) => s.numer === f.numer)?.iu ?? []).flatMap((j) => j.operator)
    const operatorNowy = f.iu.flatMap((j) => j.operator)
    const naglowek = `## Operator checklist faza ${f.numer}`
    for (const t of roznica(operatorStary, operatorNowy).dodane) {
      const zakres = sekcja2(linie, naglowek)
      if (zakres) linie.splice(miejsce(linie, zakres, operatorNowy, t), 0, zeStanem(t, `operator faza ${f.numer}`))
      else {
        const faza = sekcjaFazy(linie, f.numer)
        if (!faza) return void w.konflikty.push(`operator faza ${f.numer}: brak sekcji fazy w pliku zadań`)
        linie.splice(faza[1], 0, naglowek, '', zeStanem(t, `operator faza ${f.numer}`), '')
      }
    }
  }
}

/**
 * @param {string} projekt katalog projektu
 * @param {string} zadanie katalog zadania wzgledem projektu (docs/active/<zadanie>)
 * @param {{ od?: string }} [opcje] rewizja gita z planem sprzed zmiany (domyslnie HEAD)
 * @returns {Odswiezenie} pliki = nowa tresc plikow zadania do zapisu (pusta przy odmowie i konfliktach)
 */
export function odswiezZadanie(projekt, zadanie, opcje = {}) {
  const od = opcje.od ?? 'HEAD'
  /** @type {Odswiezenie} */
  const w = { ok: true, odmowa: null, plan: null, od, konflikty: [], bledy: [],
    zmiany: { dodane: [], usuniete: [], przeniesione: [], naglowki: [], noweIu: [], usunieteIu: [], tabelaFaz: [] }, pliki: {} }
  const katalog = join(projekt, zadanie)
  const nazwy = existsSync(katalog) ? readdirSync(katalog) : []
  const plikZadan = nazwy.find((n) => n.endsWith('-zadania.md'))
  const plikPlanu = nazwy.find((n) => n.endsWith('-plan.md'))
  if (!plikZadan || !plikPlanu) return odmow(w, `w ${zadanie} nie ma plików <zadanie>-zadania.md i <zadanie>-plan.md`)
  const zadania = readFileSync(join(katalog, plikZadan), 'utf8')
  const sciezkaPlanu = /^Plan techniczny: `([^`]+)`/m.exec(zadania)?.[1] ?? null
  if (!sciezkaPlanu || !existsSync(join(projekt, sciezkaPlanu))) return odmow(w, 'plik zadań nie wskazuje istniejącego planu technicznego (linia „Plan techniczny:”)')
  w.plan = sciezkaPlanu
  const staryMd = plikZRewizji(projekt, od, sciezkaPlanu)
  if (staryMd === null) return odmow(w, `git nie ma planu ${sciezkaPlanu} w rewizji ${od} — podaj --od <commit sprzed zmiany planu>`)
  const nowyPlan = parsujPlan(readFileSync(join(projekt, sciezkaPlanu), 'utf8'))
  w.bledy = sprawdzPlan(nowyPlan, projekt).bledy
  if (w.bledy.length) return odmow(w, 'plan po zmianie nie przechodzi walidacji (plan.mjs sprawdz) — popraw błędy')
  const stare = strukturaZadan(parsujPlan(staryMd))
  const nowe = strukturaZadan(nowyPlan)
  if (JSON.stringify(stare.map((f) => f.naglowek)) !== JSON.stringify(nowe.map((f) => f.naglowek))) {
    return odmow(w, 'zmiana zmienia fazy (liczbę, nazwę albo zależności) — stan przebiegu jest liczony per faza, tego odświeżenie nie przenosi')
  }
  const fazaIu = (/** @type {FazaZadan[]} */ fazy) => new Map(fazy.flatMap((f) => f.iu.map((j) => /** @type {[string, number]} */ ([j.id, f.numer]))))
  const przedtem = fazaIu(stare)
  const przesunieta = [...fazaIu(nowe)].find(([id, numer]) => przedtem.has(id) && przedtem.get(id) !== numer)
  if (przesunieta) return odmow(w, `${przesunieta[0]} zmienia fazę — przenieś pozycje do jednostki w docelowej fazie, zamiast przenosić całą jednostkę`)
  if (JSON.stringify(stare) === JSON.stringify(nowe)) {
    return odmow(w, `plan względem ${od} nie zmienia pliku zadań — gdy zmiana planu jest już w commicie, podaj --od <commit sprzed zmiany>`)
  }
  const gotowe = zbudowane(katalog)
  const stareIu = new Map(stare.flatMap((f) => f.iu).map((j) => [j.id, j]))
  for (const f of nowe) {
    for (const iu of f.iu) {
      const dodane = roznica(stareIu.get(iu.id)?.linie ?? [], iu.linie).dodane
      if (!dodane.length) continue
      if (gotowe.fazy.has(f.numer)) return odmow(w, `${iu.id}: faza ${f.numer} jest już zbudowana (execute: done), więc nowa pozycja „${dodane[0]}” nie zostałaby wykonana — dopisz ją do jednostki w fazie, która jeszcze nie ruszyła`)
      if (gotowe.iu.has(kluczIu(iu.id))) return odmow(w, `${iu.id}: jednostka jest już zapisana commitem (iuUkonczone), więc nowa pozycja „${dodane[0]}” nie zostałaby wykonana — dopisz ją do jednostki, która jeszcze nie ruszyła`)
    }
  }
  const linie = zadania.split('\n')
  /** @type {Map<string, string[]>} */
  const pula = new Map()
  usun(linie, stare, nowe, w, pula)
  dodaj(linie, stare, nowe, w, pula)
  const liniePlanu = readFileSync(join(katalog, plikPlanu), 'utf8').split('\n')
  for (const f of nowe) {
    const stary = stare.find((s) => s.numer === f.numer)?.wiersz
    if (!stary || stary === f.wiersz) continue
    const i = liniePlanu.indexOf(stary)
    if (i === -1) w.konflikty.push(`faza ${f.numer}: w ${plikPlanu} nie ma wiersza tabeli „Fazy” w zapisie generatora — popraw listę jednostek i delegatów ręcznie`)
    else {
      liniePlanu[i] = f.wiersz
      w.zmiany.tabelaFaz.push(f.numer)
    }
  }
  if (w.konflikty.length) return odmow(w, 'plik zadań różni się od tego, co zapisał generator — rozwiąż konflikty i uruchom ponownie; nic nie zapisano')
  w.pliki = { [`${zadanie}/${plikZadan}`]: linie.join('\n'), ...(w.zmiany.tabelaFaz.length ? { [`${zadanie}/${plikPlanu}`]: liniePlanu.join('\n') } : {}) }
  return w
}
