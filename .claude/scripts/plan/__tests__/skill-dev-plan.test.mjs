// Skill /dev-plan a skrypty planowania (PLAN-POPRAWY P13): szablon planu ze skilla przechodzi walidacje i generator,
// tabela builderow zgadza sie z plikami agentow, handoff niesie polecenia skryptu i zdanie dla agentow workflow.
//
// Uruchomienie:  node --test .claude/scripts/plan/__tests__/skill-dev-plan.test.mjs
//
// DLACZEGO: model pisze plan z `references/szablon-planu.md`, a `plan.mjs sprawdz` odrzuca plan spoza kontraktu. Szablon
// rozjechany ze skryptem to kazdy plan odrzucony przy pierwszym `sprawdz` (petla poprawek w sesji operatora), a tabela
// builderow rozjechana z frontmatterami agentow to bledne `Skills in play` i `Delegate to` w kazdym planie.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { bezOgonkow, parsujPlan } from '../plan-techniczny.mjs'
import { podsumowanieBudzetu } from '../budzet-pliku.mjs'
import { BUILDERZY, sprawdzPlan, uruchamiaRunner } from '../walidacja-planu.mjs'
import { zadanieZPlanu } from '../zadanie.mjs'
import { doWzorca, PROFIL } from '../../stack/profil.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SKILL = join(REPO, '.claude/skills/dev-plan')
const SKILL_MD = readFileSync(join(SKILL, 'SKILL.md'), 'utf8')
const SZABLON = readFileSync(join(SKILL, 'references/szablon-planu.md'), 'utf8')
const SCIEZKA_PLANU = 'docs/plans/2026-10-07-001-feat-notatki-klienta-plan.md'

/** @returns {string} plan z bloku ```markdown sekcji „Przykład planu” szablonu */
function przykladPlanu() {
  const m = /## Przykład planu[\s\S]*?\n```markdown\n([\s\S]*?)\n```\n/.exec(SZABLON)
  assert.ok(m, 'szablon bez bloku ```markdown w sekcji „Przykład planu”')
  return `${m[1]}\n`
}

/** @param {string} plan @returns {string} projekt tymczasowy z planem i plikami, ktore plan modyfikuje albo wskazuje */
function projekt(plan) {
  const korzen = mkdtempSync(join(tmpdir(), 'skill-dev-plan-'))
  const pliki = {
    [SCIEZKA_PLANU]: plan,
    'docs/DESIGN.md': '# Design\n',
    '.env.e2e': 'X=1\n',
    'src/services/klienci-service.ts': 'export const x = 1\n',
    'src/features/klienci/components/karta-klienta.tsx': 'const x = 1\n'.repeat(285),
  }
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(korzen, sciezka)), { recursive: true })
    writeFileSync(join(korzen, sciezka), tresc)
  }
  return korzen
}

/** @param {string} plan @returns {{ bledy: string[], uwagi: string[] }} */
function sprawdz(plan) {
  const korzen = projekt(plan)
  try {
    return sprawdzPlan(parsujPlan(plan), korzen)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
}

test('przykład planu ze szablonu przechodzi plan.mjs sprawdz bez błędów', () => {
  const w = sprawdz(przykladPlanu())
  assert.deepEqual(w.bledy, [])
  assert.deepEqual(w.uwagi, [`frontmatter: origin docs/brainstorms/YYYY-MM-DD-notatki-klienta-requirements.md — plik nie istnieje (popraw origin)`])
})

test('przykład planu: generator daje zadanie z dwiema fazami, scenariuszem E2E i pozycją operatora', () => {
  const korzen = projekt(przykladPlanu())
  try {
    const z = zadanieZPlanu(korzen, SCIEZKA_PLANU, { data: '2026-10-07' })
    assert.deepEqual(z.bledyBilansu, [])
    assert.equal(z.nazwa, 'notatki-klienta')
    // Stack z plikiem flow (D17) ma w tabeli IU-2 jego wiersz.
    assert.deepEqual(z.liczniki, { fazy: 2, iu: 2, implementacyjne: PROFIL.e2e.plikFlow ? 10 : 9, testy: 4, weryfikacje: 3, e2e: 1, operator: 1 })
    const jednostki = parsujPlan(przykladPlanu()).fazy.flatMap((f) => f.iu)
    assert.deepEqual(podsumowanieBudzetu(jednostki), { iu_z_wymiarami: 1, wydzielenia: 1 })
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
})

test('przykład planu: bez wiersza Stwórz wydzielanego modułu i z plikiem ponad 360 linii walidacja odrzuca plan', () => {
  const plan = przykladPlanu()
  const bezStworz = plan.replace(/^\| Stwórz \| `src\/features\/klienci\/components\/kontakt-klienta\.tsx`.*\n/m, '')
    .replace(/^\| Stwórz \| `src\/features\/klienci\/components\/notatki-klienta\.tsx`.*\n/m, '')
  assert.notEqual(bezStworz, plan)
  assert.match(sprawdz(bezStworz).bledy.join('\n'), /IU-2: werdykt „wydziel” bez wiersza Stwórz/)
  const zaDuzy = plan.replace('| 285 → 260 |', '| 285 → 380 |')
  assert.notEqual(zaDuzy, plan)
  assert.match(sprawdz(zaDuzy).bledy.join('\n'), /karta-klienta\.tsx` po zmianie 380 linii > 360/)
})

// Tabela builderów jest w slocie stacku .claude/stack/buildery.md (IU-1.4), SKILL.md do niej odsyła.
test('tabela builderów w slocie stacku: bazowe nazwy z walidacji i Skills in play = skills: z frontmattera agenta', () => {
  assert.match(SKILL_MD, /`\.claude\/stack\/buildery\.md`, sekcja „Tabela builderów”/)
  const tabela = readFileSync(join(REPO, '.claude/stack/buildery.md'), 'utf8')
  const wiersze = [...tabela.matchAll(/^\|[^|]+\| `(feature-builder-[\w-]+)` \| ([^|]+) \|$/gm)]
  assert.deepEqual(wiersze.map((w) => w[1]).sort(), [...BUILDERZY].sort())
  for (const [, builder, skille] of wiersze) {
    const agent = readFileSync(join(REPO, '.claude/agents', `${builder}.md`), 'utf8')
    const frontmatter = /^skills:\s*\[([^\]]*)\]/m.exec(agent)?.[1] ?? ''
    assert.deepEqual(skille.split(',').map((s) => s.trim()), frontmatter.split(',').map((s) => s.trim()), builder)
  }
})

test('SKILL.md: końcówka prowadzi przez sprawdz, generuj --zapisz i gotowosc w tej kolejności', () => {
  const kolejnosc = ['plan.mjs sprawdz', 'git checkout -b feature/<zadanie>', 'plan.mjs generuj', 'docs: inicjalizacja planu dla <zadanie>',
    'plan.mjs gotowosc', 'Workflow({ scriptPath: ".claude/workflows/dev-autopilot-wf.js"']
  const pozycje = kolejnosc.map((fraza) => SKILL_MD.indexOf(fraza, SKILL_MD.indexOf('### Faza 6')))
  assert.ok(pozycje.every((p) => p > 0), kolejnosc.filter((_, i) => pozycje[i] <= 0).join(', '))
  assert.deepEqual([...pozycje].sort((a, b) => a - b), pozycje)
  assert.match(SKILL_MD, /generuj <docs\/plans\/plik-planu\.md> --zapisz/)
})

test('SKILL.md: handoff ma zdanie dla agentów workflow z opisu autopilota', () => {
  const autopilot = readFileSync(join(REPO, '.claude/workflows/dev-autopilot-wf.js'), 'utf8')
  const zdanie = /(Do agentow workflow: [^']+)'/.exec(autopilot)?.[1]
  assert.ok(zdanie, 'opis autopilota bez zdania dla agentów workflow')
  const handoff = SKILL_MD.slice(SKILL_MD.indexOf('## Format wyjściowy'))
  assert.ok(bezOgonkow(handoff).includes(zdanie), zdanie)
})

// Znaleziska 2026-11-02 pkt 36 (dashboard, run wf_a495d97e-47b): wiadomość startowa z warunkiem „jeśli zrzut padnie, zatrzymaj się”
// trafiła do 166 agentów, a testerzy faz 7–11 uznali warunek za swój. Zdanie dla agentów już było; brakowało zasady dla sesji i operatora.
test('opis autopilota i handoff: start to osobna wiadomość z samym poleceniem; warunki w wiadomości startowej sesja obsługuje wcześniej', () => {
  const opis = /^ {2}whenToUse: '([^']+)',$/m.exec(readFileSync(join(REPO, '.claude/workflows/dev-autopilot-wf.js'), 'utf8'))?.[1] ?? ''
  const dlaSesji = opis.indexOf('Start to osobna wiadomosc z samym poleceniem startu: wiadomosc, ktora uruchamia workflow, dostaje doslownie kazdy agent runu, wiec wymagania wobec sesji ida wczesniejsza wiadomoscia.')
  assert.notEqual(dlaSesji, -1, 'opis autopilota bez zasady dla sesji')
  assert.ok(dlaSesji < opis.indexOf('Do agentow workflow:'), 'zasada dla sesji stoi przed zdaniem dla agentów')
  const krok = SKILL_MD.slice(SKILL_MD.indexOf('#### 6.7 Handoff'), SKILL_MD.indexOf('## Format wyjściowy'))
  assert.match(krok, /Start to osobna wiadomość z samym poleceniem startu\. Wiadomość, która uruchamia workflow, dostaje dosłownie każdy agent runu/)
  assert.match(krok, /zawiera też warunki albo prośby → najpierw je obsługujesz, potem prosisz o osobną wiadomość z samym startem\. Workflowu z takiej wiadomości nie uruchamiasz\./)
  assert.match(krok, /do wklejenia w innej sesji, dzielisz tak samo: wymagania wobec sesji w jednej wiadomości, samo polecenie startu w następnej/)
  const ramka = SKILL_MD.slice(SKILL_MD.indexOf('➡️ Następny krok'), SKILL_MD.indexOf('## Referencje'))
  assert.match(ramka, /Start to osobna wiadomość z samym poleceniem, np\. „Uruchom autopilota dla docs\/active\/<zadanie>” — bez warunków i próśb/)
  // Weryfikacja partii 26–45, punkt 55 (36): zasady nie mialy README, szablon smoke'u autopilota (rdzen i Expo) ani komenda
  // swiezego runu z powodow STOP-u.
  const plaski = (/** @type {string} */ t) => t.replace(/\n\s*/g, ' ')
  const readme = join(REPO, 'README.md')
  if (existsSync(readme)) assert.match(plaski(readFileSync(readme, 'utf8')), /Start to osobna wiadomość z samym poleceniem \(np\. `\/dev-autopilot-wf docs\/active\/<zadanie>`\): wiadomość startową dostaje każdy agent runu, więc warunki i prośby wysyłasz wcześniejszą wiadomością\./)
  const kopie = ['.claude/templates/smoke-autopilot', 'stacks/expo/nakladka/.claude/templates/smoke-autopilot']
  for (const katalog of kopie.filter((k, i) => i === 0 || existsSync(join(REPO, k)))) {
    assert.match(plaski(readFileSync(join(REPO, katalog, 'README.md'), 'utf8')), /`\/dev-autopilot-wf docs\/active\/smoke-autopilot` osobn[aą] wiadomo[sś]ci[aą] z samym tym poleceniem/i, `${katalog}/README.md`)
    assert.ok(readFileSync(join(REPO, katalog, 'przygotuj-kopie.sh'), 'utf8').includes('i uruchom osobną wiadomością z samym tym poleceniem: /dev-autopilot-wf docs/active/smoke-autopilot'), `${katalog}/przygotuj-kopie.sh`)
    assert.doesNotMatch(readFileSync(join(REPO, katalog, 'README.md'), 'utf8'), /__tests__/, `${katalog}/README.md: testow projekt nie dostaje`)
  }
  assert.match(readFileSync(join(REPO, '.claude/workflows/dev-autopilot-wf.js'), 'utf8'), /return `w osobnej wiadomosci z samym poleceniem \(bez warunkow i prosb\): \/dev-autopilot-wf \$\{sciezka\}`/)
})

// Znaleziska 2026-11-02 pkt 31 (dashboard E2): sesja planowania zmieniła .claude/agents/feature-tester-e2e.md, a handoff mówił
// „autopilot w tej sesji” — tester działałby według wersji zbuforowanej przed zmianą. Skrypt nie widzi zmian sesji, więc to reguła 6.7.
test('handoff: sesja, która zmieniła .claude/, wskazuje nową sesję i nie uruchamia autopilota u siebie', () => {
  const krok = SKILL_MD.slice(SKILL_MD.indexOf('#### 6.7 Handoff'), SKILL_MD.indexOf('## Format wyjściowy'))
  assert.match(krok, /uruchom autopilota narzędziem `Workflow` w tej sesji — chyba że ta sesja zmieniła `\.claude\/`\./)
  assert.match(krok, /Gdy w tej sesji zmieniono cokolwiek w `\.claude\/` \(edycja skilla, agenta, workflowu, `\/sync-template`\), handoff wskazuje nową sesję i autopilota u siebie nie uruchamiasz/)
  assert.match(krok, /Instrukcje i skille są buforowane w sesji/)
  const ramka = SKILL_MD.slice(SKILL_MD.indexOf('➡️ Następny krok'), SKILL_MD.indexOf('## Referencje'))
  assert.match(ramka, /^➡️ Następny krok: autopilot w tej sesji <albo: w nowej sesji — ta sesja zmieniła \.claude\/>:$/m)
  // Ta sama reguła po stronie workflowu: opis autopilota każe ruszać w nowej sesji po zmianach w .claude/.
  assert.match(readFileSync(join(REPO, '.claude/workflows/dev-autopilot-wf.js'), 'utf8'), /Po zmianach w \.claude\/ \([^)]*\) uruchamiaj w nowej sesji/)
})

test('SKILL.md: wskazane pliki references/ istnieją', () => {
  const pliki = [...new Set([...SKILL_MD.matchAll(/`(references\/[\w.-]+)`/g)].map((m) => m[1]))]
  assert.deepEqual(pliki.sort(), ['references/kontekst-designerski.md', 'references/przygotowanie-operatora.md', 'references/stack.md', 'references/szablon-planu.md'])
  for (const p of pliki) assert.ok(existsSync(join(SKILL, p)), p)
})

/** @param {string} z @param {string} na @returns {string} przyklad planu z jedna podmiana (podmiana musi trafic) */
function mutacja(z, na) {
  const plan = przykladPlanu()
  assert.ok(plan.includes(z), `przykład nie zawiera: ${z}`)
  return plan.replace(z, na)
}

test('kolumna linii: szacunek z tyldą albo bez strzałki to błąd zapisu, a plik kodu bez liczby „po” omija budżet — błąd', () => {
  const tylda = sprawdz(mutacja('| 0 → 70 |', '| 0 → ~400 |')).bledy.join('\n')
  assert.match(tylda, /IU-1: linia \d+: kolumna linii „0 → ~400” — zapis „dziś → po” liczbami całkowitymi/)
  const slowa = sprawdz(mutacja('| 0 → 70 |', '| 120 do 140 |')).bledy.join('\n')
  assert.match(slowa, /kolumna linii „120 do 140”/)
  assert.match(sprawdz(mutacja('| 0 → 70 |', '| 0 → — |')).bledy.join('\n'), /notatki-service\.ts` — brak liczby linii po zmianie/)
})

// Znaleziska 2026-11-02 pkt 33: akcję „Usuń” znał tylko skrypt (budzet-pliku.mjs, czesci-pr.mjs), kontrakt planu jej nie wymieniał —
// dashboard E2 usuwał plik z żywym importerem (IU-19 przed IU-32), a skill nie mówił, w której IU plik wolno usunąć.
test('SKILL.md i szablon: akcja Usuń na liście akcji, z regułą importerów; wiersz Usuń bez liczby „po” przechodzi sprawdz', () => {
  const tabela = SKILL_MD.slice(SKILL_MD.indexOf('#### 3.6 Tabela plików'), SKILL_MD.indexOf('#### 3.6b'))
  assert.match(tabela, /Akcje: `Stwórz`, `Modyfikuj`, `Usuń`, `Test \(unit\)`/)
  assert.match(tabela, /każdy plik, który go importuje, ma wiersz `Usuń` albo `Modyfikuj` w tej samej albo wcześniejszej IU/)
  assert.match(tabela, /`plan\.mjs sprawdz` szuka importerów w repo i daje uwagę/)
  assert.match(SZABLON, /akcje `Stwórz`, `Modyfikuj`, `Usuń`, `Test \(unit\)`/)
  assert.match(SZABLON, /wiersz `Usuń` ma `—` po strzałce \(`45 → —`\)/)
  const wiersz = '| Stwórz | `src/services/notatki-limity.ts` | 0 → 3 | — | nowy |'
  assert.deepEqual(sprawdz(mutacja(wiersz, `${wiersz}\n| Usuń | \`src/services/klienci-service.ts\` | 1 → — | — | — |`)).bledy, [])
})

// Katalog runnerów i komenda testów ze stacku (IU-2.5): ostatnia pozycja Weryfikacji przykładu podmieniona na runner bez znacznika.
test('Weryfikacja z runnerem E2E bez znacznika [E2E] jest odrzucona — scribe uruchomiłby go bez środowiska e2e', () => {
  const ostatnia = przykladPlanu().match(/^- `[^`]+` przechodzi$/gm)?.at(-1) ?? ''
  const runner = `bash ${PROFIL.e2e.katalogRunnerow}/run-all.sh`
  const w = sprawdz(mutacja(ostatnia, `- \`${runner}\` przechodzi`))
  assert.match(w.bledy.join('\n'), new RegExp(`IU-2: Weryfikacja „\`${doWzorca(runner)}\` przechodzi” uruchamia runner E2E bez znacznika \\[E2E\\]`))
})

// Pilot mobile W12 (runy 3–5): `grep -c "<flow>" <katalog>/run-all.sh` w Weryfikacji szło jako uruchomienie runnera.
test('Weryfikacja, która tylko czyta plik runnera (grep, test -f), przechodzi; runner po powłoce, zmiennej i && jest odrzucony', () => {
  const k = PROFIL.e2e.katalogRunnerow
  const ostatnia = przykladPlanu().match(/^- `[^`]+` przechodzi$/gm)?.at(-1) ?? ''
  const odczyt = sprawdz(mutacja(ostatnia, `- \`grep -c "notatki" ${k}/run-all.sh\` zwraca 1`))
  assert.deepEqual(odczyt.bledy, [])
  for (const czyta of [`grep -c "x" ${k}/run-all.sh`, `test -f ${k}/run-all.sh`, `wc -l ${k}/run-all.sh`, `npm test -- ${k}/run-all.sh`]) {
    assert.equal(uruchamiaRunner(`\`${czyta}\` zwraca 1`), false, czyta)
  }
  for (const uruchamia of [`${k}/run-all.sh`, `./${k}/run-all.sh`, `bash ${k}/run-all.sh`, `sh -e ${k}/x.sh`, `CI=1 ${k}/x.sh --flow a`, `timeout 60 bash ${k}/x.sh`, `npm run build && ${k}/x.sh`, `grep x plik | ${k}/x.sh`]) {
    assert.equal(uruchamiaRunner(`\`${uruchamia}\` przechodzi`), true, uruchamia)
  }
  assert.equal(uruchamiaRunner(`${k}/run-all.sh bez backticków`), false)
})

test('wymaganie ze „Śledzenia wymagań” bez IU dostaje uwagę (autopilot pominąłby je po cichu)', () => {
  const w = sprawdz(mutacja('- R2. Karta klienta pokazuje notatki od najnowszej.', '- R2. Karta klienta pokazuje notatki od najnowszej.\n- R3. Eksport notatek do CSV.'))
  assert.deepEqual(w.bledy, [])
  assert.ok(w.uwagi.includes('R3: wymaganie ze „Śledzenia wymagań” bez IU (pole Wymagania żadnej jednostki go nie wymienia)'), w.uwagi.join('\n'))
})

test('Delegate to: wariant -figma tylko dla ui i fullstack', () => {
  assert.deepEqual(sprawdz(mutacja('**Delegate to:** feature-builder-fullstack', '**Delegate to:** feature-builder-fullstack-figma')).bledy, [])
  assert.match(sprawdz(mutacja('**Delegate to:** feature-builder-data', '**Delegate to:** feature-builder-data-figma')).bledy.join('\n'),
    /IU-1: Delegate to „feature-builder-data-figma”/)
})

// P20 A6: stala w IU pierwszego konsumenta w kodzie — migracja SQL z ta sama wartoscia nie czyni IU zrodlem (knip).
test('SKILL.md i szablon: źródło stałej w IU pierwszego konsumenta w kodzie; uwaga sprawdz przy źródle we wcześniejszej fazie', () => {
  const rejestr = SKILL_MD.slice(SKILL_MD.indexOf('#### 3.6b Rejestr stałych'), SKILL_MD.indexOf('#### 3.7'))
  assert.match(rejestr, /Używa = importuje w kodzie: wartość przepisana do migracji SQL nie czyni IU źródłem/)
  assert.match(rejestr, /knip w domknięciu fazy/)
  assert.match(rejestr, /`plan\.mjs sprawdz` daje uwagę, gdy źródło jest w fazie wcześniejszej niż wszyscy konsumenci/)
  assert.match(SZABLON, /\| `## Rejestr stałych` \|[^\n]*źródło stałej w tabeli plików IU jej pierwszego konsumenta w kodzie/)
  // P22 C1: kolumna IU-źródło — uwaga planu bez zgadywania IU (vibersi etap 4: falszywa uwaga IU-2).
  assert.match(rejestr, /tabela `\| Stała \| Wartość \| Plik \| IU-źródło \| Konsumenci \|`/)
  assert.match(rejestr, /tę IU wpisujesz w kolumnie IU-źródło \(`IU-5`\), także gdy plik tworzy wcześniejsza IU, a stała dochodzi później/)
  assert.match(SZABLON, /\| Stała \| Wartość \| Plik \| IU-źródło \| Konsumenci \|\n\|---\|---\|---\|---\|---\|\n\| `MAKS_DLUGOSC_NOTATKI` \| `500` \| `src\/services\/notatki-limity\.ts` \| IU-1 \| IU-1, IU-2 \|/)
  assert.match(SZABLON, /ta IU w kolumnie IU-źródło \(`—` = stała już w repo\)/)
})

// P20 A7 (vibersi etap 3): research zalozyl „Send Email hook = bez limitu 2 maili/h”; projekt e2e mial rate_limit_email_sent 2,
// a faza 4 potrzebowala 5 wysylek — w autopilocie padlaby na limicie nawet bez zawieszonego zrzutu.
test('SKILL.md 3.4b: wysyłki maili/SMS fazy kontra limit usługi na projekcie e2e z konfiguracji; za mały limit = pozycja operatora', () => {
  const e2e = SKILL_MD.slice(SKILL_MD.indexOf('#### 3.4b Scenariusze E2E i seedy'), SKILL_MD.indexOf('#### 3.5'))
  const regula = e2e.split('\n').find((l) => l.startsWith('- Wysyłka maili albo SMS')) ?? ''
  assert.match(regula, /policz wysyłki wszystkich scenariuszy `\[E2E\]` fazy razy dwa, bo re-review po fixie i ponowienie scenariusza/)
  assert.match(regula, /odczytanym z jego konfiguracji, nie z dokumentacji ani z researchu/)
  assert.match(regula, /\| jq '\{rate_limit_email_sent, rate_limit_sms_sent\}'`/, 'odczyt tylko pol limitu — pelna odpowiedz ma sekrety')
  assert.match(regula, /Całej odpowiedzi nie wypisujesz, bo zawiera sekrety/)
  assert.match(regula, /Send Email hook tego limitu nie omija/)
  assert.match(regula, /pozycja w checkliście przygotowania \(3\.7\)[^.]*`\[blokuje: faza N\]`/)
})

// Pilot Nawykometr W11 (runy 1 i 3): skill kazal pisac `[Manual agent]`, ktorego `plan.mjs sprawdz` nie znal; poprawka `c8d4580`
// dala `[Manual] agent:`. Punkt 40, krok 4: sesja /dev-smoke wykonuje kazda pozycje sama poza wyjatkami dla czlowieka, wiec
// znacznik kroku agenta znika z planowania i z polecenia autora smoke'u. Starszy plan z `[Manual] agent:` nadal przechodzi sprawdz.
test('SKILL.md 3.4b: [Manual] bez podziału na człowieka i agenta, wyjątki jak w /dev-smoke; stary zapis `[Manual] agent:` przechodzi sprawdz', () => {
  const e2e = SKILL_MD.slice(SKILL_MD.indexOf('#### 3.4b Scenariusze E2E i seedy'), SKILL_MD.indexOf('#### 3.5'))
  assert.match(e2e, /`\[Manual\]` zapisujesz bez podziału na kroki człowieka i agenta: sesja smoke'u \(`\/dev-smoke`\) wykonuje każdą pozycję sama/)
  const smokeSkill = readFileSync(join(REPO, '.claude/skills/dev-smoke/SKILL.md'), 'utf8')
  for (const w of ['produkcja i deploy', 'zewnętrzne konsole', 'fizyczne urządzenie', 'prawdziwa skrzynka pocztowa', 'płatność prawdziwą kartą', 'wpisanie hasła', 'ocena punktów wizualnych']) {
    assert.ok(e2e.includes(w), `3.4b: wyjatek „${w}”`)
    assert.ok(smokeSkill.includes(w), `dev-smoke: wyjatek „${w}”`)
  }
  const smoke = readFileSync(join(REPO, '.claude/workflows/dev-docs-complete-wf.js'), 'utf8')
  assert.doesNotMatch(`${SKILL_MD}\n${smoke}`, /\[Manual\] agent:|\[Manual agent\]/)
  const pierwszy = przykladPlanu().match(/^- \[Unit\] [^\n]+$/m)?.[0] ?? ''
  const plan = mutacja(pierwszy, `${pierwszy}\n- [Manual] agent: smoke RLS przez psql na bazie e2e`)
  assert.deepEqual(sprawdz(plan).bledy, [])
  const korzen = projekt(plan)
  try {
    const zadania = [zadanieZPlanu(korzen, SCIEZKA_PLANU, { data: '2026-10-07' }).pliki.zadania].flat().join('\n')
    assert.match(zadania, /^- \[ \] \[Manual\] agent: smoke RLS przez psql na bazie e2e \(IU-1\)$/m)
  } finally {
    rmSync(korzen, { recursive: true, force: true })
  }
})

// P27 (2) (vibersi etap 5): scenariusz o statusie HTTP i meta trasy renderowanej przez serwer odpytywal port Vite, ktory na
// kazdej sciezce odpowiada 200 i index.html — wynik zawsze „zgodny” albo `curl` na [Manual].
// Treść stacku z 3.4b jest w slocie .claude/stack/plan-e2e.md (IU-1.4), 3.4b odsyła do sekcji „Serwer aplikacji w scenariuszu”.
test('3.4b odsyła do sekcji slotu plan-e2e o serwerze aplikacji w scenariuszu (treść web: stacks/web/__tests__/e2e-adapter.test.mjs)', () => {
  assert.match(SKILL_MD.slice(SKILL_MD.indexOf('#### 3.4b'), SKILL_MD.indexOf('#### 3.5')), /`\.claude\/stack\/plan-e2e\.md`, sekcja „Serwer aplikacji w scenariuszu”/)
})

// Punkt 40, krok 6: bramka pokazuje sprawy odlozone w smoke'u, handoff je wypisuje, start nie czeka (decyzja operatora 2026-11-11).
test('SKILL.md 6.6 i handoff: pozycja odlozone wypisana z etapem, nie blokuje', () => {
  const bramka = SKILL_MD.slice(SKILL_MD.indexOf('#### 6.6 Bramka gotowości'), SKILL_MD.indexOf('#### 6.7'))
  assert.match(bramka, /Wynik ma (osiem|dziewięć) pozycji/)
  assert.match(bramka, /- `odlozone` — nie blokuje: otwarte sprawy odłożone w smoke'u poprzednich zadań \(`docs\/operator\/odlozone\.md`/)
  assert.match(SKILL_MD, /^ {3}- Odłożone: <brak \/ M otwartych: etap — treść \(linia\) — nie blokują>$/m)
})

// Punkt 41, kroki 3 i 5 (aa-exam E3): przeglad spojnosci kazdej fazy agentem ze swiezym kontekstem, znaleziska jako pytania do
// operatora, powtorka do zera otwartych i zapis z odciskiem planu, ktory sprawdza bramka gotowosci (decyzje operatora 2026-11-11:
// zawsze, takze plan Lekki; bramka blokuje).
test('SKILL.md 6.2b: przegląd spójności każdej fazy, pytania do operatora, powtórka do zera, zapis w commicie i w bramce', () => {
  const krok = SKILL_MD.slice(SKILL_MD.indexOf('#### 6.2b Przegląd spójności planu'), SKILL_MD.indexOf('#### 6.3 Git i branch'))
  assert.match(krok, /Każdy plan, także Lekki, przechodzi przegląd spójności/)
  assert.match(krok, /narzędziem `Agent` z typem `spojnosc-planu`, po jednym agencie na fazę planu/)
  assert.match(krok, /pokazujesz operatorowi po jednej narzędziem `AskUserQuestion`[^.]*rekomendacja jako pierwsza opcja/)
  assert.match(krok, /Pozycji nie rozstrzygasz sam\./)
  assert.match(krok, /aż każda faza ma wynik „brak otwartych pozycji”/)
  assert.match(krok, /plan\.mjs spojnosc docs\/plans\/<plik>\.md --zapisz --fazy <wszystkie fazy po przecinku> --otwarte 0/)
  assert.ok(SKILL_MD.indexOf('#### 6.2 Walidacja planu skryptem') < SKILL_MD.indexOf('#### 6.2b'), 'przegląd po zielonym sprawdz')
  assert.match(SKILL_MD, /plan techniczny, zapis przeglądu spójności `docs\/plans\/<plik>\.spojnosc\.json`/)
  assert.match(SKILL_MD, /Wynik ma dziewięć pozycji/)
  assert.match(SKILL_MD, /- `spojnosc` — przegląd spójności planu \(6\.2b\)[^\n]*`ok: false` zatrzymuje start/)
  assert.match(SKILL_MD, /^ {3}- Spójność: <OK \(fazy: …\) \/ OK z zastrzeżeniem: [^\n]*\/ powod → STOP>$/m)
  const agent = readFileSync(join(REPO, '.claude/agents/spojnosc-planu.md'), 'utf8')
  assert.match(agent, /^name: spojnosc-planu$/m)
  assert.match(agent, /Planu nie zmieniasz\./)
  assert.match(agent, /Faza N: brak otwartych pozycji\./, 'pusty wynik ma stałe zdanie, którego szuka skill')
})

// Analiza vibersi audyt-paczki-1-2 (decyzje operatora 2026-11-13): czytania faz w bramce, pytania techniczne paczka, stale
// polecenie recenzenta z tura, limit tur, rozmiar IU przed 6.2b i decyzje startowe we frontmatterze.
test('SKILL.md 6.2b i agent: czytania faz, paczka technicznych do 5, oznaczenia decyzji, stałe polecenie, limit tur, zamknięcie za zgodą', () => {
  const krok = SKILL_MD.slice(SKILL_MD.indexOf('#### 6.2b Przegląd spójności planu'), SKILL_MD.indexOf('#### 6.3 Git i branch'))
  assert.match(krok, /--faza \$f --czytanie/)
  assert.match(krok, /--faza <N> --czysta/)
  assert.match(krok, /„Przegląd spójności fazy <N> planu `docs\/plans\/<plik>\.md`, tura <T>\.” Polecenie ma tylko to zdanie/)
  assert.match(krok, /Pozycje techniczne możesz pokazać paczką do 5 w jednym pytaniu[^.]*`Pokaż po kolei`/)
  assert.match(krok, /`\(przyjęte zbiorczo RRRR-MM-DD\)`/)
  assert.match(krok, /Po trzeciej turze fazy[^.]*do operatora wracają tylko pozycje widoczne/)
  assert.match(krok, /Tylko po wyborze zamknięcia dopisujesz `--bez-czytania <numery faz>`/)
  assert.ok(krok.indexOf('Decyzje o podziale dużych IU') > 0, 'podział IU przed przeglądem')
  const metoda = SKILL_MD.slice(SKILL_MD.indexOf('## Metoda interakcji'), SKILL_MD.indexOf('## Opis feature'))
  assert.match(metoda, /do 5 takich pozycji w jednym pytaniu[^.]*„Pokaż po kolei”\. Pozycje widoczne dla użytkownika aplikacji idą zawsze pojedynczo/)
  assert.match(SKILL_MD, /`ok: true` z niepustym `zastrzezenie`/)
  const agent = readFileSync(join(REPO, '.claude/agents/spojnosc-planu.md'), 'utf8')
  assert.match(agent, /^model: inherit$/m)
  assert.match(agent, /--faza <N> --roznica/)
  assert.match(agent, /`\(decyzja operatora RRRR-MM-DD\)` albo\n?\s*`\(przyjęte zbiorczo RRRR-MM-DD\)`/)
  assert.match(agent, /^S1 \[<sprzecznosc[^\]]*\] \[<widoczna \| techniczna>\] IU-<n>$/m)
})

test('SKILL.md 3.3, 0.6, 1.3, 1.6 i szablon: pole Rozmiar jako warunek IU ponad progiem, decyzje startowe w polach frontmattera', () => {
  assert.match(SKILL_MD, /12 plikami to błąd `sprawdz`, dopóki nie ma jawnej decyzji/)
  assert.match(SKILL_MD, /`\*\*Rozmiar:\*\* zostaje w całości \(<P> plików, <S> scenariuszy\) — <powód>`/)
  assert.match(SKILL_MD, /O podziale decydujesz przed przeglądem spójności \(6\.2b\)/)
  assert.match(SKILL_MD, /pole frontmattera planu `glebokosc: Lekka \| Standardowa \| Głęboka`/)
  assert.match(SKILL_MD, /`research_zewnetrzny: "tak — <powód>"` albo `"nie — <powód>"`/)
  assert.match(SKILL_MD, /`dotyka_ui: tak \| nie` \(źródło prawdy/)
  // Wariant stacku ma szablon z nakladki pod ta sama sciezka (testuj-wariant.mjs) — test sprawdza ten, ktory jest na lawce.
  for (const plik of ['.claude/skills/dev-plan/references/szablon-planu.md']) {
    const szablon = readFileSync(join(REPO, plik), 'utf8')
    assert.match(szablon, /^\| `\*\*Rozmiar:\*\*` \|/m, plik)
    assert.match(szablon, /^## Decyzje startowe we frontmatterze$/m, plik)
    assert.match(szablon, /^glebokosc: Lekka$/m, plik)
  }
})
