#!/usr/bin/env node
// Planowanie (PLAN-POPRAWY P13): CLI scalonego /dev-plan — walidacja planu technicznego, generowanie docs/active/<zadanie>/
// i bramka gotowosci przed autopilotem.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   plan.mjs linie <plik>...                       linie kodu jak ESLint max-lines (bez pustych i komentarzy) — kolumna „dziś”
//   plan.mjs sprawdz <plan.md>                     walidacja planu (fazy, IU, tabela plikow z budzetem, scenariusze, seedy, rejestr stalych,
//                                                  czesci PR); rozmiarPr = szacunek plikow do recenzji bota per faza i czesc
//   plan.mjs generuj <plan.md> [--nazwa <zadanie>] [--data RRRR-MM-DD] [--zapisz] [--nadpisz]
//                                                  pliki zadania z planu; bez --zapisz tylko liczniki; plan z bledami — nic
//   plan.mjs odswiez <docs/active/zadanie> [--od <rewizja>] [--zapisz] [--pomin-brakujace]
//                                                  zmiana planu technicznego po starcie zadania: roznica miedzy planem z rewizji
//                                                  (domyslnie HEAD) a obecnym nalozona na plik zadan; odhaczenia i linie przebiegu
//                                                  zostaja, pozycja przeniesiona miedzy jednostkami zabiera odhaczenie; bez --zapisz
//                                                  tylko lista zmian; stanu przebiegu nie zmienia
//   plan.mjs gotowosc <docs/active/zadanie>        plan, srodowisko E2E, checklista przygotowania, galaz i czyste drzewo,
//                                                  runner testow bez .claude/**
//   plan.mjs blokery <docs/active/zadanie>         nieodhaczone blokery checklisty z faza, ktora wstrzymuja (bootstrap autopilota;
//                                                  pozycje startu = faza 1)
//   plan.mjs spojnosc <plan.md> [--zapisz --fazy <1,2,…> --otwarte <N> [--bez-czytania <3,…>]]
//                                                  stan przegladu spojnosci planu (odcisk bez stanu checkboxow); z --zapisz
//                                                  zapis docs/plans/<plan>.spojnosc.json po przegladzie agentem spojnosc-planu;
//                                                  --otwarte 0 wymaga czystego czytania kazdej fazy zgodnego z jej obecna trescia,
//                                                  --bez-czytania = fazy zamykane bez czytania za zgoda operatora (bramka
//                                                  „OK z zastrzezeniem”)
//   plan.mjs spojnosc <plan.md> --faza <N> --czytanie | --czysta | --roznica
//                                                  czytanie fazy recenzentem: --czytanie przed uruchomieniem agenta (tura, odciski
//                                                  pol, lista pol zmienionych od poprzedniej tury), --czysta po wyniku „brak
//                                                  otwartych pozycji”, --roznica (bez zapisu) = pola zmienione miedzy dwoma
//                                                  ostatnimi czytaniami — dla recenzenta tury 2+
//   plan.mjs designerski <plan.md> --iu <IU-N>      blok kontekstu designerskiego buildera jednostki (DESIGN.md, SPEC.md, SPEC
//                                                  i PNG ekranow z pola Makiety); tresc pusta = blok pominiety
// Wynik: JSON na stdout. Kod wyjscia: 0 = ok, 1 = do poprawy (bledy planu, STOP bramki, katalog zadania zajety),
// 2 = zle argumenty, 3 = wyjatek skryptu (JSON z polem wyjatek).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { parseArgs } from 'node:util'

import { liczLinieKodu, podsumowanieBudzetu } from './budzet-pliku.mjs'
import { rozmiarPlanu } from './czesci-pr.mjs'
import { blokeryZadania, gotowosc } from './gotowosc.mjs'
import { blokDesignerski } from './makiety.mjs'
import { odswiezZadanie } from './odswiez.mjs'
import { parsujPlan } from './plan-techniczny.mjs'
import { oznaczCzysta, roznicaFazy, stanPrzegladu, zapiszCzytanie, zapiszPrzeglad } from './spojnosc.mjs'
import { sprawdzPlan } from './walidacja-planu.mjs'
import { zadanieZPlanu } from './zadanie.mjs'

const KOD_DO_POPRAWY = 1
const KOD_ZLYCH_ARGUMENTOW = 2
const KOD_WYJATKU = 3
const USTAWIENIA = /** @type {const} */ ({
  projekt: { type: 'string' }, nazwa: { type: 'string' }, data: { type: 'string' },
  zapisz: { type: 'boolean' }, nadpisz: { type: 'boolean' }, iu: { type: 'string' }, od: { type: 'string' },
  fazy: { type: 'string' }, otwarte: { type: 'string' }, 'pomin-brakujace': { type: 'boolean' },
  faza: { type: 'string' }, czytanie: { type: 'boolean' }, czysta: { type: 'boolean' }, roznica: { type: 'boolean' },
  'bez-czytania': { type: 'string' },
})

/** @param {string} komunikat @returns {never} */
function zleArgumenty(komunikat) {
  process.stderr.write(`plan: ${komunikat}\nUzycie: plan.mjs linie <plik>... | sprawdz <plan.md> | generuj <plan.md> [--nazwa <zadanie>] [--data RRRR-MM-DD] [--zapisz] [--nadpisz] | odswiez <docs/active/zadanie> [--od <rewizja>] [--zapisz] [--pomin-brakujace] | spojnosc <plan.md> [--zapisz --fazy <1,2> --otwarte <N> [--bez-czytania <3>]] | spojnosc <plan.md> --faza <N> --czytanie|--czysta|--roznica | gotowosc <docs/active/zadanie> | blokery <docs/active/zadanie> [--projekt <katalog>]\n`)
  process.exit(KOD_ZLYCH_ARGUMENTOW)
}

/** @param {unknown} wynik @param {boolean} ok @returns {never} */
function zakoncz(wynik, ok) {
  process.stdout.write(`${JSON.stringify(wynik)}\n`)
  process.exit(ok ? 0 : KOD_DO_POPRAWY)
}

/** @returns {string} dzisiejsza data lokalna RRRR-MM-DD (nie UTC: po polnocy w Polsce UTC ma jeszcze wczorajsza) */
function dzis() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Powod odmowy zapisu: katalog zadania istnieje (wznowienie) bez --nadpisz; z --nadpisz — gdy zadanie ma juz przebieg
 * (stan autopilota, raport review, postep w zadaniach, wpisy dziennika), ktorego swieze pliki by nie znaly.
 * @param {string} katalog katalog zadania (absolutny)
 * @param {boolean} nadpisz
 * @returns {string | null}
 */
function odmowaZapisu(katalog, nadpisz) {
  if (!existsSync(katalog)) return null
  if (!nadpisz) return 'katalog zadania już istnieje — wznowienie: --nadpisz (bez przebiegu autopilota) albo inna --nazwa'
  const pliki = readdirSync(katalog)
  const tresc = (/** @type {string} */ sufiks) => {
    const p = pliki.find((n) => n.endsWith(sufiks))
    return p ? readFileSync(join(katalog, p), 'utf8') : ''
  }
  if (pliki.includes('.autopilot-state.json') || pliki.some((p) => /^review-faza-\d+\.md$/.test(p))) {
    return 'zadanie ma przebieg autopilota (.autopilot-state.json albo review-faza-N.md) — postępu nie nadpisuję; zmianę planu po starcie przenosi `plan.mjs odswiez <katalog zadania>`'
  }
  if (/^- \[x\]/m.test(tresc('-zadania.md'))) return 'plik zadań ma odhaczone pozycje — postępu nie nadpisuję'
  if (/^## Dziennik\n+\S/m.test(tresc('-kontekst.md'))) return 'dziennik w pliku kontekstu ma wpisy — postępu nie nadpisuję'
  return null
}

/** @param {string} projekt @param {string} sciezka @returns {string} sciezka planu wzgledem projektu */
function planWzgledny(projekt, sciezka) {
  const wzgledna = isAbsolute(sciezka) ? relative(projekt, sciezka) : sciezka
  if (!existsSync(join(projekt, wzgledna))) zleArgumenty(`nie ma pliku planu ${sciezka}`)
  return wzgledna
}

/**
 * @param {string[]} positionals
 * @param {{ projekt?: string, nazwa?: string, data?: string, zapisz?: boolean, nadpisz?: boolean, iu?: string, od?: string, fazy?: string, otwarte?: string, 'pomin-brakujace'?: boolean, faza?: string, czytanie?: boolean, czysta?: boolean, roznica?: boolean, 'bez-czytania'?: string }} values
 */
function wykonaj(positionals, values) {
  const [polecenie, sciezka, ...reszta] = positionals
  const projekt = values.projekt ?? process.cwd()
  if (!sciezka) zleArgumenty(polecenie ? `${polecenie} wymaga ścieżki` : 'brak polecenia')
  const data = values.data ?? dzis()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) zleArgumenty('--data w formacie RRRR-MM-DD')

  if (polecenie === 'linie') {
    const wynik = Object.fromEntries([sciezka, ...reszta].map((p) => {
      const plik = join(projekt, p)
      return [p, existsSync(plik) ? liczLinieKodu(readFileSync(plik, 'utf8')) : null]
    }))
    zakoncz({ ok: true, linie: wynik }, true)
  }
  if (polecenie === 'gotowosc') {
    const wynik = gotowosc(projekt, sciezka.replace(/\/$/, ''))
    zakoncz(wynik, wynik.ok)
  }
  if (polecenie === 'odswiez') {
    const { pliki, ...wynik } = odswiezZadanie(projekt, sciezka.replace(/\/$/, ''), { od: values.od, pominBrakujace: values['pomin-brakujace'] === true })
    const zapisane = wynik.ok && values.zapisz ? Object.keys(pliki) : []
    for (const s of zapisane) writeFileSync(join(projekt, s), pliki[s])
    zakoncz({ ...wynik, zapisane }, wynik.ok)
  }
  if (polecenie === 'blokery') zakoncz({ ok: true, ...blokeryZadania(projekt, sciezka.replace(/\/$/, '')) }, true)
  if (polecenie === 'spojnosc') {
    const planRel = planWzgledny(projekt, sciezka)
    const fazyPlanu = parsujPlan(readFileSync(join(projekt, planRel), 'utf8')).fazy.map((f) => f.oznaczenie)
    const lista = (/** @type {string | undefined} */ v) => (v ?? '').split(',').map((f) => f.trim()).filter(Boolean)
    const spozaPlanu = (/** @type {string[]} */ fazy) => {
      const nieznane = fazy.filter((f) => !fazyPlanu.includes(f))
      if (nieznane.length) zakoncz({ ok: false, bledy: [`fazy spoza planu: ${nieznane.join(', ')} (plan ma: ${fazyPlanu.join(', ')})`] }, false)
    }
    const tryby = [values.czytanie, values.czysta, values.roznica].filter(Boolean).length
    if (values.faza !== undefined || tryby) {
      if (!values.faza || tryby !== 1 || values.zapisz) zleArgumenty('spojnosc --faza <N> wymaga dokładnie jednego z --czytanie, --czysta, --roznica (bez --zapisz)')
      spozaPlanu([values.faza])
      const wynik = values.czytanie ? zapiszCzytanie(projekt, planRel, values.faza, data)
        : values.czysta ? oznaczCzysta(projekt, planRel, values.faza)
          : roznicaFazy(projekt, planRel, values.faza)
      zakoncz(wynik, wynik.ok)
    }
    if (values['bez-czytania'] !== undefined && !values.zapisz) zleArgumenty('--bez-czytania tylko z --zapisz')
    if (values.zapisz) {
      if (!values.fazy || !/^\d+$/.test(values.otwarte ?? '')) zleArgumenty('spojnosc --zapisz wymaga --fazy <1,2,…> i --otwarte <liczba>')
      const fazy = lista(values.fazy)
      const bezCzytania = lista(values['bez-czytania'])
      spozaPlanu([...fazy, ...bezCzytania])
      const zapis = zapiszPrzeglad(projekt, planRel, { fazy, otwarte: Number(values.otwarte), data, bezCzytania })
      if (!zapis.ok) zakoncz({ ok: false, bledy: zapis.bledy }, false)
    }
    const stan = stanPrzegladu(projekt, planRel, fazyPlanu)
    zakoncz(stan, stan.ok)
  }
  if (polecenie === 'designerski') {
    if (!values.iu) zleArgumenty('designerski wymaga --iu <IU-N>')
    const plan = parsujPlan(readFileSync(join(projekt, planWzgledny(projekt, sciezka)), 'utf8'))
    const iu = [...plan.bezFazy, ...plan.fazy.flatMap((f) => f.iu)].find((j) => j.id === values.iu)
    if (!iu) zakoncz({ ok: false, bledy: [`brak jednostki ${values.iu} w planie`] }, false)
    zakoncz({ ok: true, ...blokDesignerski(plan, iu, projekt) }, true)
  }
  if (polecenie !== 'sprawdz' && polecenie !== 'generuj') zleArgumenty(`nieznane polecenie ${polecenie}`)
  const plan = planWzgledny(projekt, sciezka)
  const planMd = readFileSync(join(projekt, plan), 'utf8')
  const sparsowany = parsujPlan(planMd)
  const w = sprawdzPlan(sparsowany, projekt)
  const rozmiarPr = rozmiarPlanu(sparsowany, projekt)
  if (polecenie === 'sprawdz' || w.bledy.length) zakoncz({ ok: !w.bledy.length, ...w, rozmiarPr }, !w.bledy.length)

  const zadanie = zadanieZPlanu(projekt, plan, { nazwa: values.nazwa, data })
  if (zadanie.bledyBilansu.length) zakoncz({ ok: false, bledy: zadanie.bledyBilansu, uwagi: w.uwagi }, false)
  const odmowa = values.zapisz ? odmowaZapisu(join(projekt, zadanie.katalog), values.nadpisz === true) : null
  /** @type {string[]} */
  const zapisane = []
  if (values.zapisz && !odmowa) {
    mkdirSync(join(projekt, zadanie.katalog), { recursive: true })
    for (const [rodzaj, tresc] of Object.entries(zadanie.pliki)) {
      const s = `${zadanie.katalog}/${zadanie.nazwa}-${rodzaj}.md`
      writeFileSync(join(projekt, s), tresc)
      zapisane.push(s)
    }
  }
  const rozmiary = { plan_zn: planMd.length, zadania_zn: zadanie.pliki.zadania.length }
  const budzet = podsumowanieBudzetu(sparsowany.fazy.flatMap((f) => f.iu))
  zakoncz({ ok: !odmowa, nazwa: zadanie.nazwa, katalog: zadanie.katalog, liczniki: zadanie.liczniki, rozmiary, budzet, rozmiarPr, uwagi: w.uwagi,
    zapisane, odmowa }, !odmowa)
}

const { values, positionals } = (() => {
  try {
    return parseArgs({ options: USTAWIENIA, allowPositionals: true })
  } catch (e) {
    return zleArgumenty(e instanceof Error ? e.message : String(e))
  }
})()
try {
  wykonaj(positionals, values)
} catch (e) {
  process.stdout.write(`${JSON.stringify({ ok: false, wyjatek: e instanceof Error ? e.message : String(e) })}\n`)
  process.exit(KOD_WYJATKU)
}
