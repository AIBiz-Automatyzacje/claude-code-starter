export const meta = {
  name: 'test-review-wariant0-fix',
  description: 'Test review (§2.6): kontrola diffu fixa z dev-autopilot-wf.js bez zmian — pre-skan (haiku, low) i fix:kontrola (low)',
  phases: [{ title: 'Kontrola', detail: 'pre-skan + kontrola regresji i bramek' }],
}

const PRE_SKAN_FIXA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    trafienia: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          wzorzec: { type: 'string', enum: ['pusty-catch', 'type-assertion', 'any', 'console-log', 'non-null'] },
          plik: { type: 'string' },
          linia: { type: 'string', description: 'DODANA linia diffu 1:1, bez wiodacego "+"' },
        },
        required: ['wzorzec', 'plik', 'linia'],
      },
    },
  },
  required: ['trafienia'],
}

const REGRESJA_FIXA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    regresje: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plik: { type: 'string', description: 'plik:linia' },
          opis: { type: 'string', description: 'co commit fixa zepsul — nie co bylo zepsute wczesniej' },
        },
        required: ['plik', 'opis'],
      },
    },
    bramki: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plik: { type: 'string', description: 'plik:linia nowej bramki walidacyjnej' },
          opis: { type: 'string', description: 'co bramka ma przepuszczac, a czego nie' },
          wektory: { type: 'array', items: { type: 'string' }, description: 'co najmniej 3 konkretne proby obejscia' },
          testOdmowy: { type: 'boolean', description: 'czy istnieje test, ktory sprawdza ODRZUCENIE zlego wejscia (nie tylko przyjecie dobrego)' },
        },
        required: ['plik', 'opis', 'wektory', 'testOdmowy'],
      },
    },
  },
  required: ['regresje', 'bramki'],
}

function preSkanFixaPrompt(numerFazy) {
  return `Mechaniczny skan commitow fix fazy ${numerFazy}. NIE oceniaj kodu, NIE interpretuj — tylko grep.

1. Ustal zakres: \`git log --oneline --grep="^fix("\` -> pierwszy commit fixa tej fazy.
   Diff: \`git diff <pierwszy-commit-fixa>^..HEAD\`. Gdy commitow fixa nie ma — \`git diff HEAD\`.
2. Patrz WYLACZNIE na linie DODANE (zaczynajace sie od "+", bez naglowkow "+++"). Linie kontekstu
   i usuniete pomijasz — szukamy tego, co fix WPROWADZIL, nie tego, co juz bylo.
3. Zglos kazde trafienie ponizszych wzorcow (z pliku i trescia linii 1:1, bez wiodacego "+"):
   - pusty-catch:    \`catch {}\` albo \`catch (e) {}\` — takze z bialymi znakami i nowa linia miedzy klamrami
   - type-assertion: \` as \` w TypeScript, Z WYJATKIEM \`as const\`
   - any:            \`: any\` (adnotacja typu)
   - console-log:    \`console.log\`
   - non-null:       operator \`!\` po wyrazeniu (\`foo!.bar\`, \`foo!)\`, \`foo!;\`, \`foo!,\`) — NIE mylic
                     z negacja \`!foo\` ani z \`!==\`
4. Zero trafien to poprawny i czesty wynik — zwroc {trafienia: []}. Nie dobieraj nic "na wszelki wypadek",
   nie zglaszaj linii spoza diffu i nie zglaszaj plikow, ktorych fix nie tknal.

Read-only: nie modyfikuj plikow, nie commituj, nie uruchamiaj testow.`
}

function regresjaFixaPrompt(sciezka, numerFazy) {
  return `Jestes NIEZALEZNYM kontrolerem commitow fix fazy ${numerFazy} (zadanie: ${sciezka}).
Petla naprawcza nie ma nad soba re-review — jestes jedynym, kto oglada ten kod.

Zakres: \`git log --oneline --grep="^fix("\` -> pierwszy commit fixa tej fazy, potem
\`git diff <pierwszy-commit-fixa>^..HEAD\`. Gdy commitow fixa nie ma — \`git diff HEAD\`.

ZADANIE 1 — REGRESJE. Zglaszaj WYLACZNIE to, co zepsul TEN commit: kod dzialajacy przed fixem,
ktory po nim nie dziala, oraz zmiany zachowania, o ktore nikt nie prosil (fix fazy 5 w projekcie
zrodlowym dolozyl \`loading="lazy"\` do ramki, ktorej finding nie dotyczyl). NIE rob pelnego re-skanu
fazy i NIE zglaszaj problemow, ktorych review nie wykrylo — na to jest review, nie Ty.

ZADANIE 2 — NOWE BRAMKI WALIDACYJNE (obowiazkowe, nie pomijaj). Dla KAZDEJ nowej albo zmienionej
bramki w diffie (wyrazenie regularne, allowlista, limit rozmiaru/dlugosci, porownanie originu,
sprawdzenie roli, parsowanie wejscia) wypisz CO NAJMNIEJ 3 konkretne wektory obejscia — nie kategorie,
tylko wejscia, ktore sprobujesz przepchnac (np. "//evil.com jako adres protokolowo-wzgledny",
"JAVASCRIPT:alert(1) wielkimi literami", "wartosc druga na liscie srcset po przecinku").
Potem sprawdz w testach, czy istnieje test ODMOWY — sprawdzajacy, ze zle wejscie zostaje ODRZUCONE,
a nie tylko ze dobre przechodzi. Ustaw testOdmowy=false, gdy takiego testu nie ma.
Bramka bez testu odmowy to bramka, ktorej nikt nie sprawdzil — nastepna zmiana rozszczelni ja po cichu.

Zero regresji i zero nowych bramek to poprawny wynik: {regresje: [], bramki: []}.
Read-only: nie modyfikuj plikow, nie commituj.`
}

const zEffortemAP = (opts, effort) => (effort ? { ...opts, effort } : opts)

const sciezka = args && args.sciezka
const numerFazy = args && args.faza
phase('Kontrola')
// wywołania skopiowane z dev-autopilot-wf.js (efort i model jak w autopilocie)
const preSkan = await agent(preSkanFixaPrompt(numerFazy), zEffortemAP({ schema: PRE_SKAN_FIXA, model: 'haiku', label: `fix:pre-skan:faza-${numerFazy}` }, 'low'))
const regresja = await agent(regresjaFixaPrompt(sciezka, numerFazy), zEffortemAP({ schema: REGRESJA_FIXA, label: `fix:kontrola:faza-${numerFazy}` }, 'low'))
// zwrot jak doPoprawki w autopilocie (filtr console.log w plikach testowych w JS)
const doPoprawki = []
if (preSkan && Array.isArray(preSkan.trafienia)) {
  for (const t of preSkan.trafienia.filter((t) => !(t.wzorzec === 'console-log' && /\.(test|spec)\./i.test(t.plik || '')))) doPoprawki.push({ zrodlo: 'pre-skan', wzorzec: t.wzorzec, plik: t.plik, opis: 'commit fix wprowadzil: ' + t.linia })
}
if (regresja) {
  for (const r of regresja.regresje || []) doPoprawki.push({ zrodlo: 'regresja', plik: r.plik, opis: r.opis })
  for (const b of (regresja.bramki || []).filter((b) => !b.testOdmowy)) doPoprawki.push({ zrodlo: 'bramka-bez-testu-odmowy', plik: b.plik, opis: 'nowa bramka walidacyjna (' + b.opis + ') nie ma testu ODMOWY. Wektory do pokrycia: ' + (b.wektory || []).join(' | ') })
}
return { projekt: '0', tryb: 'fix', findings: doPoprawki.map((p) => ({ ...p, waga: 'P2' })), przebieg: { preSkanNull: !preSkan, regresjaNull: !regresja } }
