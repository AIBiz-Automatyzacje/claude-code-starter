// Tresc obecnej wersji przy przebudowie i pytanie blokera (znaleziska szablonu, punkt 41, kroki 1, 2, 4 i 7).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/tresc-przebudowy.test.mjs
//
// DLACZEGO: aa-exam E3 (run wf_1c69a604-076, faza 3, IU-12). Obecny mail logowania mial powitanie z imieniem, makieta nie,
// a granica zakresu zabraniala tekstow spoza makiet. Wymagania, checklista przygotowania i plan nie mowily, co z trescia
// obecnej wersji, ktorej makieta nie ma; decyzja wyszla dopiero u buildera, ktory zatrzymal run pytaniem po angielsku.
// Kazdy etap dostaje swoj kawalek: brainstorm pyta o zasade, prep spisuje obecna wersje do zamowienia makiety, plan zapisuje
// decyzje przy kazdym elemencie, a pytanie blokera przychodzi po polsku z opcjami.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
/** @param {string} sciezka wzgledem .claude/ @returns {string} */
const plik = (sciezka) => readFileSync(resolve(KATALOG, '..', '..', sciezka), 'utf8')

const BRAINSTORM = plik('skills/dev-brainstorm/SKILL.md')
const PREP = plik('skills/dev-prep/SKILL.md')
const PLAN = plik('skills/dev-plan/SKILL.md')
const EXECUTE = plik('workflows/dev-docs-execute-wf.js')

/** @param {string} tekst @param {string} od @param {string} po @returns {string} */
function sekcja(tekst, od, po) {
  const start = tekst.indexOf(od)
  assert.notEqual(start, -1, `brak naglowka: ${od}`)
  const stop = tekst.indexOf(po, start + od.length)
  assert.notEqual(stop, -1, `brak konca sekcji: ${po}`)
  return tekst.slice(start, stop)
}

test('/dev-brainstorm: przy przebudowie pyta, co z trescia, ktorej nowy projekt nie pokaze, i zapisuje odpowiedz jako wymaganie', () => {
  const dialog = sekcja(BRAINSTORM, '#### 1.3 Dialog', '### Faza 2')
  assert.match(dialog, /\*\*Przebudowa istniejących ekranów albo maili:\*\* gdy pomysł zmienia wygląd czegoś, co już działa/)
  assert.match(dialog, /„Gdy nowy projekt nie pokaże czegoś, co obecna wersja ma \(tekst, dana jak imię albo kwota, stan, zachowanie\): znika czy zostaje\?”/)
  assert.match(dialog, /`Znika — nowy projekt jest kompletny` \/ `Zostają treść i dane, zmienia się wygląd` \/ `Decyzja przy każdym elemencie podczas planowania`/)
  assert.match(dialog, /Odpowiedź zapisz w dokumencie jako wymaganie ze stabilnym ID\./)
  // Integration check obejmuje pare, ktora w E3 dala sprzecznosc.
  assert.match(dialog, /Parę „przebudowa istniejącego ekranu albo maila” i „teksty tylko z makiet” sprawdzasz zawsze/)
  assert.match(sekcja(BRAINSTORM, 'Przed finalizacją sprawdź:', 'Jeśli planowanie musiałoby'), /- Przy przebudowie istniejących ekranów albo maili: czy wymagania mówią, co z treścią obecnej wersji/)
})

test('/dev-prep: status „modyfikacja” = inwentarz obecnej wersji z kodu w zamowieniu makiety (subagent, bez opisu wygladu)', () => {
  const makiety = sekcja(PREP, '#### 2.4 Makiety', '### Faza 3')
  const pole = makiety.split('\n').find((l) => l.startsWith('- **Dziś pokazuje**'))
  assert.ok(pole, 'pole „Dziś pokazuje” w 2.4')
  assert.match(pole, /\(tylko status `modyfikacja`\) — inwentarz obecnej wersji z kodu, nie z wymagań/)
  assert.match(pole, /teksty widoczne dla użytkownika dosłownie, dane \(imię, kwota, data, licznik\), stany, zachowania/)
  assert.match(pole, /`subagent_type: "repo-research-analyst"`.*jedno zlecenie na najwyżej 5 pozycji `modyfikacja`/)
  assert.match(pole, /Układu, kolorów i komponentów obecnej wersji nie opisujesz\./)
  assert.ok(makiety.indexOf('- **Co pokazuje**') < makiety.indexOf('- **Dziś pokazuje**'), 'po „Co pokazuje”')
  // Szablon dokumentu niesie pole, a skan repo odsyla do niego zamiast do „opisu roznicy”, ktory nie mial pola.
  assert.match(sekcja(PREP, '## 4. Makiety', '## Gdzie to ląduje'), / {2}- Dziś pokazuje _\(tylko modyfikacja\)_: .* — czego makieta nie pokaże: wg /)
  assert.match(sekcja(PREP, '#### 1.2 Skan repo', '#### 1.3'), /zamówienie na \*\*modyfikację\*\* z inwentarzem obecnej wersji \(2\.4, pole „Dziś pokazuje”\)/)
  assert.doesNotMatch(PREP, /z opisem różnicy/)
})

test('/dev-prep: decyzja o tresci obecnej wersji blokuje planowanie; decyzja sprzeczna ze zrodlem wskazuje wymaganie, ktorego prep nie poprawia', () => {
  const decyzje = sekcja(PREP, '#### 2.1 Decyzje', '#### 2.2')
  assert.match(decyzje, /\*\*Treść obecnej wersji przy przebudowie\.\*\* Gdy sekcja makiet ma choć jedną pozycję `modyfikacja`, a dokument źródłowy nie mówi/)
  assert.match(decyzje, /dodaj decyzję \*\*\[blokuje: planowanie\]\*\*: „Gdy makieta nie pokaże czegoś, co ekran albo mail ma dziś: znika czy zostaje\?”/)
  assert.match(decyzje, /Wymagania z taką zasadą \(pyta o nią `\/dev-brainstorm`\) — decyzji nie powtarzasz/)
  assert.match(decyzje, /\*\*Decyzja, która zmienia wymaganie\.\*\* .*dopisz pod pytaniem linię `Zmienia wymaganie: <ID> przy wyborze <opcja>`/)
  // Prep nadal produkuje jeden dokument: wymagania poprawia /dev-plan po zgodzie operatora.
  assert.match(decyzje, /Dokumentu wymagań nie poprawiasz: operator wpisuje „Ustalono” po tym skillu, a `\/dev-plan` czyta wypełnioną decyzję obok źródła \(0\.3\)/)
  assert.match(sekcja(PREP, '## 1. Decyzje', '## 2. Konta'), / {2}- Zmienia wymaganie: <ID> przy wyborze <opcja>/)
})

test('/dev-plan: decyzja z checklisty sprzeczna ze zrodlem = pytanie i poprawka wymagania przed planem; odmowa = bloker', () => {
  const checklista = sekcja(PLAN, '#### 0.3 Checklista operatora', '#### 0.4')
  const punkt = checklista.split('\n').find((l) => l.startsWith('- decyzję z wypełnionym „Ustalono”'))
  assert.ok(punkt, 'punkt o decyzji sprzecznej ze zrodlem w 0.3')
  assert.match(punkt, /linia `Zmienia wymaganie:` przy decyzji albo rozjazd widoczny przy czytaniu obu dokumentów/)
  assert.match(punkt, /Po zgodzie popraw wymaganie w dokumencie źródłowym z dopiskiem `\(zmienione decyzją <nr> z <data>, <ścieżka checklisty>\)`/)
  assert.match(punkt, /Odmowa to bloker z 0\.5: z dwóch sprzecznych źródeł planu nie piszesz/)
})

test('/dev-plan: pole IU „Znika z obecnej wersji” — zrodla listy i decyzji, pytanie w Fazie 2, przeglad 5.1', () => {
  const pola = sekcja(PLAN, '#### 3.4 Pola IU', '#### 3.4b')
  assert.match(pola, /Znika z obecnej wersji \(IU z makietami, która modyfikuje istniejący plik\), Wzorce do naśladowania,/)
  const pole = pola.split('\n').find((l) => l.startsWith('- **Znika z obecnej wersji**'))
  assert.ok(pole, 'opis pola w 3.4')
  assert.match(pole, /Elementy bierzesz z pola „Dziś pokazuje” checklisty \(0\.3\), a bez niego z plików `Modyfikuj` tej IU; decyzję z zasady w wymaganiach albo w checkliście\./)
  assert.match(pole, /Bez zasady pytasz w Fazie 2: decyzji nie wymyślasz i nie zostawiasz builderowi\./)
  assert.match(pole, /element, który znika, nie wraca w Podejściu ani w scenariuszach, także gdy ma go plik z „Wzorców do naśladowania”/)
  assert.match(sekcja(PLAN, '### Faza 2: Pytania planistyczne', '### Faza 3'), /Przy przebudowie istniejącego ekranu albo maila bez zasady „znika czy zostaje” w źródle i w checkliście pytasz o nią tutaj/)
  assert.match(sekcja(PLAN, '#### 5.1 Przegląd przed zapisem', '#### 5.2'), /- Każda IU z makietami i wierszem `Modyfikuj` ma pole „Znika z obecnej wersji”/)
})

test('planner fazy przekazuje builderowi pole „Znika z obecnej wersji” z zakazem przenoszenia elementow', () => {
  const planner = sekcja(EXECUTE, 'function plannerPrompt(', '\n}\n')
  assert.match(planner, /caly blok IU doslownie \(Cel, Wymagania, Pliki, Podejscie, Teksty \(verbatim\), Znika z obecnej wersji, Wzorce, Scenariusze testowe, Weryfikacja\)/)
  assert.match(planner, /gdy IU ma pole "Znika z obecnej wersji" z lista elementow \(nie sama kreska\): pod polem dopisz zdanie/)
  assert.match(planner, /Elementow z decyzja „znika” nie przenosisz z obecnego pliku ani ze wzorca/)
  assert.match(planner, /Gdy Podejscie albo scenariusz jednostki wymaga takiego elementu, zwroc status blocked/)
})

test('pytanie blokera i problem domkniecia: po polsku, prostym jezykiem, z opcjami i rekomendacja — blok doklejany w JS kazdemu builderowi', () => {
  const blok = sekcja(EXECUTE, 'const BLOK_PYTANIE_BLOKERA = `', '`\n')
  assert.match(blok, /PYTANIE BLOKERA \(gdy zwracasz status blocked\)/)
  assert.match(blok, /Piszesz je po polsku, prostym jezykiem, w tej kolejnosci: \(1\) co blokuje prace i gdzie/)
  assert.match(blok, /\(2\) opcje do wyboru, kazda z jednym zdaniem skutku, \(3\) ktora opcje rekomendujesz i dlaczego/)
  // Kazdy builder (parallel i serial) dostaje prompt przez promptIU, wiec blok nie zalezy od plannera ani pliku roli stacku.
  assert.match(EXECUTE, /const promptIU = \(iu\) => `\$\{iu\.prompt\}\\n\$\{BLOK_DLUGIE_KOMENDY\}\$\{BLOK_PYTANIE_BLOKERA\}`/)
  assert.equal(EXECUTE.split('agent(promptIU(iu)').length - 1, 2, 'oba wywolania builderow ida przez promptIU')
  assert.match(EXECUTE, /pytanie: \{ type: \['string', 'null'\], description: 'wypelnione gdy status=blocked; po polsku, prostym jezykiem/)
  // Porazka domkniecia tez trafia do powodu STOP-u.
  assert.match(EXECUTE, /problem: \{ type: \['string', 'null'\], description: 'null przy completed; inaczej po polsku, prostym jezykiem/)
  assert.match(sekcja(EXECUTE, 'function domknieciePrompt(', '\n}\n'), /Pole problem przy statusie innym niz completed czyta operator w raporcie zatrzymania: piszesz je po polsku, prostym jezykiem/)
})
