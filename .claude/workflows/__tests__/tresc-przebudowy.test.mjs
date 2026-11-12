// Tresc obecnej wersji przy przebudowie i pytanie blokera (znaleziska szablonu, punkt 41, kroki 1, 2, 4 i 7).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/tresc-przebudowy.test.mjs
//
// DLACZEGO: aa-exam E3 (run wf_1c69a604-076, faza 3, IU-12). Obecny mail logowania mial powitanie z imieniem, makieta nie,
// a granica zakresu zabraniala tekstow spoza makiet. Wymagania, checklista przygotowania i plan nie mowily, co z trescia
// obecnej wersji, ktorej makieta nie ma; decyzja wyszla dopiero u buildera, ktory zatrzymal run pytaniem po angielsku.
// Kazdy etap dostaje swoj kawalek: brainstorm pyta o zasade, prep spisuje obecna wersje do zamowienia makiety, plan zapisuje
// decyzje przy kazdym elemencie, a pytanie blokera przychodzi po polsku z opcjami.

import { existsSync, readFileSync } from 'node:fs'
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
  // Punkt 41, krok 6: decyzja „znika” wygrywa z Podejsciem i scenariuszem (hierarchia zrodel) — wybor jawny, bez STOP-u fazy.
  assert.match(planner, /Gdy Podejscie albo scenariusz jednostki wymaga takiego elementu, wygrywa decyzja „znika” \(HIERARCHIA ZRODEL\)/)
  assert.doesNotMatch(planner, /wymaga takiego elementu, zwroc status blocked/)
})

test('pytanie blokera i problem domkniecia: po polsku, prostym jezykiem, z opcjami i rekomendacja — blok doklejany w JS kazdemu builderowi', () => {
  const blok = sekcja(EXECUTE, 'const BLOK_PYTANIE_BLOKERA = `', '`\n')
  assert.match(blok, /PYTANIE BLOKERA \(gdy zwracasz status blocked\)/)
  assert.match(blok, /Piszesz je po polsku, prostym jezykiem, w tej kolejnosci: \(1\) co blokuje prace i gdzie/)
  assert.match(blok, /\(2\) opcje do wyboru, kazda z jednym zdaniem skutku, \(3\) ktora opcje rekomendujesz i dlaczego/)
  // Kazdy builder (parallel i serial) dostaje prompt przez promptIU, wiec blok nie zalezy od plannera ani pliku roli stacku.
  assert.match(EXECUTE, /const promptIU = \(iu\) => `\$\{iu\.prompt\}\\n\$\{BLOK_DLUGIE_KOMENDY\}\$\{BLOK_HIERARCHIA_ZRODEL\}\$\{BLOK_PYTANIE_BLOKERA\}`/)
  assert.equal(EXECUTE.split('agent(promptIU(iu)').length - 1, 2, 'oba wywolania builderow ida przez promptIU')
  assert.match(EXECUTE, /pytanie: \{ type: \['string', 'null'\], description: 'wypelnione gdy status=blocked; po polsku, prostym jezykiem/)
  // Porazka domkniecia tez trafia do powodu STOP-u.
  assert.match(EXECUTE, /problem: \{ type: \['string', 'null'\], description: 'null przy completed; inaczej po polsku, prostym jezykiem/)
  assert.match(sekcja(EXECUTE, 'function domknieciePrompt(', '\n}\n'), /Pole problem przy statusie innym niz completed czyta operator w raporcie zatrzymania: piszesz je po polsku, prostym jezykiem/)
})

// Punkt 41, krok 6 (aa-exam E3, wf_1c69a604-076): builder stanal na sprzecznosci scenariusza (imie w mailu) z makieta i tekstami.
// Decyzja operatora 2026-11-11: builder rozstrzyga sam wg hierarchii zrodel, gdy wybor niczego nie dodaje i da sie go cofnac;
// wybor idzie jako decyzja autopilota do known-issues i „Decyzji przed PR”, review go nie zglasza. STOP dla nieodwracalnego
// (dane, bezpieczenstwo, pieniadze) i pracy spoza Granic.
test('builder: hierarchia zrodel z warunkami samodzielnego wyboru, polem decyzje i wyjatkami STOP-u', () => {
  const blok = sekcja(EXECUTE, 'const BLOK_HIERARCHIA_ZRODEL = `', '`\n')
  assert.match(blok, /Granice zakresu > makieta i Teksty \(verbatim\) > Kluczowe decyzje\s+i pole „Znika z obecnej wersji” > Podejscie > Scenariusze testowe > obecny kod i wzorce/)
  assert.match(blok, /\(a\) niczego nie dodaje ponad zrodla[^\n]*\n?[^\n]*\(b\) da sie ja\s+cofnac/)
  assert.match(blok, /Scenariusz testowy dopasowujesz do wybranej opcji/)
  assert.match(blok, /Kazdy taki wybor wpisujesz do pola decyzje, po polsku/)
  assert.match(blok, /Status blocked zostaje tylko, gdy: zadna opcja nie spelnia \(a\) i \(b\); wybor jest nieodwracalny albo dotyka danych[^;]*bezpieczenstwa[^;]*pieniedzy[^;]*; bez pracy wykluczonej w Granicach jednostki nie da sie ukonczyc\./)
  // Weryfikacja partii, punkt 48 (pokrewne): aa-exam E3 — scenariusz chcial imienia w mailu, Granice zabranialy tekstow spoza makiet.
  // Element zadany tylko przez nizsze zrodlo = pominiecie i decyzja; blocked tylko, gdy bez wykluczonej pracy jednostka nie powstanie.
  assert.doesNotMatch(blok, /jednostka wymaga pracy wykluczonej w Granicach/)
  assert.match(blok.replace(/\n/g, ' '), /Gdy elementu wykluczonego w Granicach zada tylko nizsze zrodlo \(Podejscie, scenariusz, obecny kod albo wzorzec\), a reszte jednostki da sie zrobic bez niego: pomijasz element, dopasowujesz scenariusz i wpisujesz wybor do pola decyzje \(np\. scenariusz chce imienia w mailu, a Granice zabraniaja tekstow spoza makiet → mail bez imienia jako decyzja, nie blocked\)\./)
  assert.match(EXECUTE, /decyzje: \{ type: 'array', items: \{ type: 'string' \}, description: 'sprzecznosci zrodel rozstrzygniete wg blok HIERARCHIA ZRODEL/)
  // Granice zostaja zakazem: blok wykluczen dalej kaze zwrocic blocked.
  assert.match(sekcja(EXECUTE, 'function plannerPrompt(', '\n}\n'), /Niczego z tej listy nie implementuj, nawet gdy wyglada na przydatne\. Gdy jednostka wymaga takiej pracy,\s+zwroc status blocked i w polu pytanie nazwij te prace \(wyjatek: element zadany tylko przez nizsze zrodlo — HIERARCHIA ZRODEL\)\."/)
})

test('execute → autopilot → review: decyzje builderow z prefiksem IU, zapis zaraz po execute, review ich nie zglasza', () => {
  // Walidacja 51–55, punkt 60: filtr wykonany na danych (tekst przepuszczal `decyzjeUkonczonych.push(...decyzjeAutopilota)` dopisane obok).
  // eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
  const decyzjeBuilderow = new Function(`${sekcja(EXECUTE, 'function decyzjeBuilderow(', '\n}\n')}\n}\nreturn decyzjeBuilderow`)()
  const buildery = [
    { id: 'IU-1', status: 'completed', decyzje: [' a.ts:1 — wybrano A ', '', '  '] }, { id: 'IU-2', status: 'partial', decyzje: ['b.ts:2 — wybrano B'] },
    { id: 'IU-3', status: 'blocked', decyzje: ['c.ts:3 — wybrano C'] }, { id: 'IU-4', status: 'completed' }, { id: 'IU-5', status: 'completed', decyzje: 'nie lista' },
  ]
  assert.deepEqual(decyzjeBuilderow(buildery, false), ['IU-1: a.ts:1 — wybrano A', 'IU-2: b.ts:2 — wybrano B'], 'wszyscy poza blocked')
  assert.deepEqual(decyzjeBuilderow(buildery, true), ['IU-1: a.ts:1 — wybrano A'], 'tylko ukonczone')
  assert.match(EXECUTE, /\nconst decyzjeAutopilota = decyzjeBuilderow\(buildResults, false\)\nconst decyzjeUkonczonych = decyzjeBuilderow\(buildResults, true\)\n\nif \(zablokowany\) \{\n/)
  assert.equal(EXECUTE.split('return wynikPrzerwanego({\n    fazaNumer: faza,\n    decyzjeAutopilota: decyzjeUkonczonych,').length - 1, 2, 'blocked i partial niosa decyzje ukonczonych jednostek')
  // Punkt 48 (pokrewne): builder `partial` przy przerwaniu oddaje pliki do schowka — jego decyzje nie ida do zapisu.
  assert.doesNotMatch(EXECUTE, /return wynikPrzerwanego\(\{\n {4}fazaNumer: faza,\n {4}decyzjeAutopilota,/)
  // Pelne domkniecie dostaje dotychczasowa liste (wszyscy poza blocked).
  assert.match(EXECUTE, /ukonczoneWczesniej, decyzjeAutopilota\) \+ punktZapisuStanu/)
  assert.match(EXECUTE, /return wynikDomkniecia\(wynik, faza, buildResults, bazaWyniku, decyzjeAutopilota\)/)
  const autopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')
  const poExecute = autopilot.slice(autopilot.indexOf("const exec = await workflow('dev-docs-execute-wf'"))
  const zapis = poExecute.indexOf("await zapiszDecyzje(numerFazy, 'autopilot', exec && Array.isArray(exec.decyzjeAutopilota) ? exec.decyzjeAutopilota : [])")
  assert.ok(zapis !== -1 && zapis < poExecute.indexOf("if (!exec || exec.status !== 'completed')"), 'zapis przed STOP-em execute')
  assert.match(autopilot, /przy znaczniku autopilot builder\s+rozstrzygnal sprzecznosc zrodel planu/)
  const review = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')
  // Weryfikacja partii 2026-11-11, punkt 48: tester E2E dostaje te sama wiedze co reviewer (finding E2E omija sceptykow i idzie do fixa).
  // Regula stoi w pliku roli (procedura testera ma jedno zrodlo), w rdzeniu i w kopii wariantu Expo.
  // W repo szablonu kopia Expo lezy w nakladce; w zbudowanym wariancie nakladki nie ma, a plik pod .claude/ jest juz ta kopia.
  const role = ['../../agents/feature-tester-e2e.md', '../../../stacks/expo/nakladka/.claude/agents/feature-tester-e2e.md']
  for (const sciezka of role.filter((r, i) => i === 0 || existsSync(resolve(KATALOG, r)))) {
    const klasyfikacja = sekcja(readFileSync(resolve(KATALOG, sciezka), 'utf8'), '### Klasyfikacja i wynik', '\n### ')
    assert.match(klasyfikacja, /wiersz `\[DECYZJA · faza N · autopilot\]` bieżącej fazy w sekcji `## Decyzje operatora` pliku `known-issues\.md`/)
    assert.match(klasyfikacja, /brak tego, z czego builder zrezygnował, nie jest FAIL-em ani findingiem/)
    assert.match(klasyfikacja, /FAIL zostaje, gdy aplikacja robi co innego niż opisany wybór/)
  }
  const prompt = sekcja(review, 'function reviewerPrompt(', '\n}\n')
  assert.match(prompt, /wiersz "\[DECYZJA · faza \$\{faza\} · autopilot\]" w sekcji "## Decyzje operatora" pliku \$\{sciezka\}\/known-issues\.md/)
  assert.match(prompt, /Odstepstwo od Podejscia albo scenariusza opisane takim wierszem nie jest findingiem \(ani KOD, ani TEST\)/)
  const complete = readFileSync(resolve(KATALOG, '../dev-docs-complete-wf.js'), 'utf8')
  assert.match(complete, /Wiersz ze znacznikiem "autopilot" to wybor, ktory builder juz wprowadzil/)
})
