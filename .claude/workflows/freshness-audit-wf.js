export const meta = {
  name: 'freshness-audit-wf',
  description: 'Cykliczny audyt aktualnosci skilli technicznych wzgledem ZYWEJ dokumentacji: inwentaryzacja (1 agent wyciaga twierdzenia o swiecie — wersje, piny, wzorce — grupowane po TECHNOLOGII) -> weryfikacja w zrodlach (pipeline po technologiach, 1 agent/technologia sprawdza KAZDE twierdzenie w oficjalnych docs/changelogach/npm przez WebFetch/WebSearch/context7, zakaz pamieci modelu) -> adversarial verify P1/P2 (1 sceptyk probuje obalic) -> scribe zapisuje raport do docs/reviews/. Workflow niczego nie zmienia w skillach — tylko raportuje; poprawki zatwierdza user.',
  whenToUse: 'Okresowy audyt aktualnosci (np. raz w miesiacu) albo standalone z args {data} (YYYY-MM-DD, wymagany; opcjonalnie {skille:[...]} do zawezenia).',
  phases: [
    { title: 'Inwentaryzacja', detail: '1 agent wyciaga twierdzenia o swiecie ze skilli technicznych, grupuje po technologii' },
    { title: 'Weryfikacja', detail: 'pipeline po technologiach — 1 agent/technologia weryfikuje twierdzenia w zywych zrodlach' },
    { title: 'Verify', detail: 'adversarial verify per rozjazd P1/P2 (1 sceptyk probuje obalic)' },
    { title: 'Raport', detail: 'scribe zapisuje docs/reviews/freshness-<data>.md (workflow niczego nie zmienia w skillach)' },
  ],
}

// Domyslna lista skilli technicznych do audytu (SKILL.md + resources/). Zawezenie: args.skille.
const DOMYSLNE_SKILLE = [
  'tailwind-react-guidelines',
  'ux-ui-guidelines',
  'supabase-dev-guidelines',
  'security',
  'sentry-integration',
]

// Ranga severity do sortowania (P1 najwyzsze).
const RANGA = { P1: 0, P2: 1, P3: 2 }

// Blok doklejany do promptow agentow, ktorzy MAJA sprawdzac zywe zrodla — nie odpowiadac z pamieci modelu.
// Narzedzia WebFetch/WebSearch/context7 sa DEFERRED — agent musi je zaladowac przez ToolSearch przed uzyciem.
const BLOK_ZYWE_ZRODLA = `
=== ZYWE ZRODLA (obowiazkowe — nie sugestia) ===
Narzedzia WebFetch, WebSearch i context7 (mcp__context7__resolve-library-id, mcp__context7__query-docs)
sa DEFERRED: NAJPIERW zaladuj ich schematy przez ToolSearch (np. query "select:WebFetch,WebSearch" oraz
"context7 docs"), dopiero potem je wolaj.
ZAKAZ odpowiadania z pamieci modelu — pamiec modelu jest przeterminowana z definicji (to wlasnie audytujemy).
KAZDE ustalenie MUSI pochodzic z URL zywego zrodla: oficjalna dokumentacja, CHANGELOG/releases na GitHub,
npm registry (registry.npmjs.org/<paczka>/latest lub strona npm), oficjalny blog wydania.
W polu zrodloUrl podaj konkretny URL, z ktorego pochodzi stanFaktyczny (nie strone glowna — konkretny changelog/wpis).
Jesli nie udalo sie potwierdzic twierdzenia w zadnym zywym zrodle — NIE zgaduj; pomin to twierdzenie
(lepiej brak rozjazdu niz halucynacja rozjazdu).
=== KONIEC BLOKU ZYWYCH ZRODEL ===`

// ── Schematy ──────────────────────────────────────────────────────────────

// Faza 1: twierdzenia o swiecie zgrupowane po TECHNOLOGII (jedna technologia moze zyc w kilku skillach).
const INWENTARZ = {
  type: 'object',
  additionalProperties: false,
  properties: {
    technologie: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          nazwa: { type: 'string', description: 'nazwa technologii, np. "React", "Stripe", "Tailwind CSS", "Zod"' },
          twierdzenia: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                plik: { type: 'string', description: 'sciezka pliku skilla:linia (lub sam plik)' },
                twierdzenie: { type: 'string', description: 'twierdzenie o swiecie: numer wersji, pin paczki, nazwa API/wzorzec opisany jako aktualny/preferowany/deprecated' },
                cytat: { type: 'string', description: 'doslowny cytat fragmentu skilla, na ktorym opiera sie twierdzenie' },
              },
              required: ['plik', 'twierdzenie', 'cytat'],
            },
          },
        },
        required: ['nazwa', 'twierdzenia'],
      },
    },
  },
  required: ['technologie'],
}

// Faza 2: rozjazdy dla JEDNEJ technologii (agent echo-uje nazwe technologii, ktora weryfikowal).
const WERYFIKACJA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    technologia: { type: 'string', description: 'nazwa weryfikowanej technologii (echo z inputu)' },
    rozjazdy: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['P1', 'P2', 'P3'], description: 'P1 = wygeneruje bledny/zepsuty kod; P2 = nieaktualna wersja lub wzorzec; P3 = kosmetyka' },
          plik: { type: 'string' },
          twierdzenie: { type: 'string', description: 'twierdzenie ze skilla, ktore sie rozjezdza' },
          stanFaktyczny: { type: 'string', description: 'jak jest naprawde wg zywego zrodla' },
          zrodloUrl: { type: 'string', description: 'konkretny URL zywego zrodla (changelog/npm/docs)' },
          poprawka: { type: 'string', description: 'proponowana poprawka tresci skilla' },
        },
        required: ['severity', 'plik', 'twierdzenie', 'stanFaktyczny', 'zrodloUrl', 'poprawka'],
      },
    },
  },
  required: ['technologia', 'rozjazdy'],
}

// Faza 3: werdykt sceptyka probujacego OBALIC rozjazd.
const WERDYKT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    werdykt: { type: 'string', enum: ['REFUTED', 'CONFIRMED', 'PARTIAL'], description: 'REFUTED = rozjazd nieprawdziwy (odpada); CONFIRMED = potwierdzony; PARTIAL = czesciowo prawdziwy (dostaje korekte)' },
    uzasadnienie: { type: 'string' },
    zrodloUrl: { type: ['string', 'null'], description: 'URL zrodla sprawdzonego PONOWNIE (lub null gdy bez zmian)' },
    korekta: { type: ['string', 'null'], description: 'dla PARTIAL: skorygowana tresc (stanFaktyczny + poprawka); null dla REFUTED/CONFIRMED' },
  },
  required: ['werdykt', 'uzasadnienie'],
}

// Faza 4: wynik scribe.
const RAPORT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    raportSciezka: { type: 'string' },
  },
  required: ['raportSciezka'],
}

// ── Prompty ────────────────────────────────────────────────────────────────

function inwentarzPrompt(skille, data) {
  const lista = skille.map((s) => `.claude/skills/${s}/`).join(', ')
  return `Jestes inwentaryzatorem twierdzen o swiecie w skillach technicznych (audyt aktualnosci na dzien ${data}).
Przeczytaj SKILL.md ORAZ wszystkie pliki w resources/ nastepujacych skilli: ${lista}.

Wyciagnij TWIERDZENIA O SWIECIE — czyli wszystko, co moze sie przeterminowac wzgledem zywej dokumentacji:
- numery wersji (np. "TypeScript 5.9", "React Router v7", "Sentry SDK v10"),
- pinowane paczki (np. npm:stripe@22, zod@4, @sentry/deno, esm.sh/stripe@17),
- nazwy API / wzorce opisane jako AKTUALNE / PREFEROWANE / DEPRECATED / USUNIETE
  (np. "getClaims() preferowane server-side", "react-router-dom deprecated", "defaultIntegrations: false").
POMIJAJ czyste zasady inzynieryjne bez odniesienia do wersji/API (np. "waliduj input", "early return") — te sie nie przeterminowuja.

Grupuj po TECHNOLOGII, nie po skillu — jedna technologia (np. Stripe, React, Zod) moze wystepowac w kilku skillach;
zbierz wszystkie jej twierdzenia pod jedna pozycja technologie[].
Dla kazdego twierdzenia podaj plik (sciezka:linia jesli mozliwe) i DOSLOWNY cytat fragmentu.

Nie oceniaj aktualnosci (to robi nastepny etap), nie wchodz do sieci. Zwroc obiekt {technologie:[...]} zgodny ze schematem.`
}

function weryfikacjaPrompt(tech, data) {
  return `Jestes weryfikatorem aktualnosci technologii "${tech.nazwa}" w skillach technicznych (audyt na dzien ${data}).
Ponizej twierdzenia wyciagniete ze skilli dla tej technologii (JSON):
${JSON.stringify(tech.twierdzenia, null, 2)}

Zweryfikuj KAZDE twierdzenie w ZYWYCH oficjalnych zrodlach na dzien ${data}. Dla kazdego ustal, czy jest nadal aktualne.
Jesli twierdzenie sie ROZJEZDZA z rzeczywistoscia — zglos rozjazd:
- severity P1: skill kaze uzyc czegos, co WYGENERUJE BLEDNY/ZEPSUTY kod (nieistniejacy import, niekompatybilna wersja API,
  usuniety pakiet, sprzeczne piny SDK+apiVersion),
- severity P2: nieaktualna wersja lub wzorzec (kod zadziala, ale przestarzaly — np. stary major, deprecated API),
- severity P3: kosmetyka (etykieta/nazewnictwo/drobna nieaktualnosc bez wplywu na dzialanie).
W poprawka podaj konkretna proponowana zmiane tresci skilla. Twierdzenia AKTUALNE pomijaj (nie zglaszaj).
W polu technologia zwroc doslownie "${tech.nazwa}".
${BLOK_ZYWE_ZRODLA}
Zwroc obiekt {technologia, rozjazdy:[...]} zgodny ze schematem. Sam nie zapisuj plikow.`
}

function sceptykPrompt(rozjazd, data) {
  return `Adwersaryjnie OBAL ten rozjazd z audytu aktualnosci skilli (dzien ${data}). Domyslnie zakladaj, ze rozjazd jest
NIEPRAWDZIWY (false positive — np. weryfikator sam odpowiedzial z pamieci albo zle odczytal changelog), chyba ze
POTWIERDZISZ go twardym dowodem z zywego zrodla.

Rozjazd [${rozjazd.severity}] ${rozjazd.plik} (technologia: ${rozjazd.technologia})
- twierdzenie skilla: ${rozjazd.twierdzenie}
- rzekomy stan faktyczny: ${rozjazd.stanFaktyczny}
- rzekome zrodlo: ${rozjazd.zrodloUrl}
- proponowana poprawka: ${rozjazd.poprawka}

Sprawdz zrodlo PONOWNIE (otworz URL, znajdz alternatywne zrodlo). Rozstrzygnij:
- REFUTED: rozjazd nieprawdziwy (twierdzenie skilla jednak aktualne, albo "stan faktyczny" bledny) — odpada,
- CONFIRMED: rozjazd potwierdzony zywym zrodlem,
- PARTIAL: czesciowo prawdziwy (np. dobra diagnoza, zle severity/wersja/poprawka) — w polu korekta podaj skorygowana tresc.
${BLOK_ZYWE_ZRODLA}
Zwroc werdykt zgodny ze schematem.`
}

function scribePrompt(data, statystyki, finalne, aktualne) {
  return `Jestes scribe audytu aktualnosci skilli. Otrzymujesz ZWERYFIKOWANE rozjazdy (po adversarial verify) — NICZEGO nie zmieniasz
w skillach, tylko zapisujesz raport. Poprawki zatwierdzi user.

Data audytu: ${data}
Statystyki: ${JSON.stringify(statystyki)}
Rozjazdy (JSON, posortowane P1->P2->P3):
${JSON.stringify(finalne, null, 2)}
Technologie zweryfikowane jako AKTUALNE (bez rozjazdow): ${JSON.stringify(aktualne)}

Zapisz plik docs/reviews/freshness-${data}.md (utworz katalog docs/reviews/ jesli nie istnieje):
1. Naglowek "# Audyt aktualnosci skilli — ${data}" + jedno-akapitowe podsumowanie (ile technologii, ile twierdzen,
   ile rozjazdow P1/P2/P3, ile obalonych w verify).
2. Tabela rozjazdow posortowana P1 -> P2 -> P3, kolumny: severity | plik | twierdzenie | stan faktyczny | poprawka | zrodlo (URL).
3. Sekcja "## Zweryfikowane jako aktualne" — lista technologii bez rozjazdow (potwierdzone zywym zrodlem).
4. Nota na koncu: "Workflow niczego nie zmienil w skillach — poprawki nanosi user po akceptacji."

Zapisz TYLKO ten jeden plik. Zwroc obiekt {raportSciezka} zgodny ze schematem.`
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

const data = args && args.data
if (!data) {
  // Bez daty audyt nie ma sensu (workflow nie moze uzyc Date.now — data przychodzi z wrappera/usera).
  return {
    raport: '',
    statystyki: { technologie: 0, twierdzenia: 0, p1: 0, p2: 0, p3: 0, obalone: 0 },
    topRozjazdy: [],
    blad: 'Brak wymaganego args {data} (YYYY-MM-DD) — wrapper podaje date przez Bash `date +%Y-%m-%d`.',
  }
}
const skille = args && Array.isArray(args.skille) && args.skille.length ? args.skille : DOMYSLNE_SKILLE

// Faza 1: inwentaryzacja twierdzen o swiecie (bariera — nastepny etap potrzebuje kompletu technologii).
phase('Inwentaryzacja')
const inwentarz = await agent(inwentarzPrompt(skille, data), { schema: INWENTARZ, label: 'inwentarz', phase: 'Inwentaryzacja' })
if (!inwentarz || !inwentarz.technologie || !inwentarz.technologie.length) {
  // Inwentaryzator padl lub nic nie wyciagnal — nie ma czego weryfikowac, kontrolowany return.
  log('Inwentaryzacja: brak technologii (agent padl lub pusty skan) — koncze')
  return {
    raport: '',
    statystyki: { technologie: 0, twierdzenia: 0, p1: 0, p2: 0, p3: 0, obalone: 0 },
    topRozjazdy: [],
  }
}
const technologie = inwentarz.technologie
const liczbaTwierdzen = technologie.reduce((s, t) => s + ((t.twierdzenia && t.twierdzenia.length) || 0), 0)
log(`Inwentaryzacja: ${technologie.length} technologii, ${liczbaTwierdzen} twierdzen o swiecie`)

// Faza 2: weryfikacja w zywych zrodlach — pipeline po technologiach (bez barier: technologie strumieniowo).
// 1 agent na technologie; padniety = null (pomijamy). Agent echo-uje technologia -> nie polegamy na kolejnosci.
phase('Weryfikacja')
const wynikiWer = await pipeline(technologie, (t) =>
  agent(weryfikacjaPrompt(t, data), { schema: WERYFIKACJA, label: `weryfikacja:${t.nazwa}`, phase: 'Weryfikacja' })
)
const rozjazdy = (wynikiWer || [])
  .filter(Boolean)
  .flatMap((w) => (w.rozjazdy || []).map((r) => ({ ...r, technologia: w.technologia })))
log(`Weryfikacja: ${rozjazdy.length} rozjazdow (P1: ${rozjazdy.filter((r) => r.severity === 'P1').length}, P2: ${rozjazdy.filter((r) => r.severity === 'P2').length}, P3: ${rozjazdy.filter((r) => r.severity === 'P3').length})`)

// Faza 3: adversarial verify — tylko P1/P2 (P3 przechodza bez weryfikacji). 1 sceptyk na rozjazd.
phase('Verify')
const doWeryfikacji = rozjazdy.filter((r) => r.severity === 'P1' || r.severity === 'P2')
const nity = rozjazdy.filter((r) => r.severity === 'P3')
const werdykty = await parallel(
  doWeryfikacji.map((r) => () => agent(sceptykPrompt(r, data), { schema: WERDYKT, label: `verify:${r.technologia}:${r.plik}`, phase: 'Verify' }))
)
const potwierdzone = []
doWeryfikacji.forEach((r, i) => {
  const w = werdykty[i]
  // Sceptyk padl (null) != obalenie — przepusc bez kill, ale oznacz w poprawce (jak review-wf przy 0 glosach).
  if (!w) {
    potwierdzone.push({ ...r, poprawka: `[NIEZWERYFIKOWANY — sceptyk padl] ${r.poprawka}` })
    return
  }
  if (w.werdykt === 'REFUTED') return
  if (w.werdykt === 'PARTIAL') {
    potwierdzone.push({ ...r, poprawka: w.korekta || r.poprawka, zrodloUrl: w.zrodloUrl || r.zrodloUrl })
    return
  }
  // CONFIRMED — ew. odswiez URL sprawdzony ponownie przez sceptyka.
  potwierdzone.push(w.zrodloUrl ? { ...r, zrodloUrl: w.zrodloUrl } : r)
})
const obalone = doWeryfikacji.length - potwierdzone.length
log(`Verify: z ${doWeryfikacji.length} rozjazdow P1/P2 potwierdzono ${potwierdzone.length}, obalono ${obalone} (+ ${nity.length} nitow P3)`)

// Konsolidacja + statystyki (liczone w JS, nie z self-reportu agenta).
const finalne = [...potwierdzone, ...nity].sort((a, b) => RANGA[a.severity] - RANGA[b.severity])
const statystyki = {
  technologie: technologie.length,
  twierdzenia: liczbaTwierdzen,
  p1: finalne.filter((f) => f.severity === 'P1').length,
  p2: finalne.filter((f) => f.severity === 'P2').length,
  p3: finalne.filter((f) => f.severity === 'P3').length,
  obalone,
}
const zRozjazdami = new Set(finalne.map((f) => f.technologia))
const aktualne = technologie.map((t) => t.nazwa).filter((n) => !zRozjazdami.has(n))
const topRozjazdy = finalne.slice(0, 5).map((f) => ({ severity: f.severity, plik: f.plik, twierdzenie: f.twierdzenie, stanFaktyczny: f.stanFaktyczny, zrodloUrl: f.zrodloUrl }))

// Faza 4: scribe zapisuje raport (jedyny agent zapisujacy plik — retry raz przy padnieciu).
phase('Raport')
let wynik = await agent(scribePrompt(data, statystyki, finalne, aktualne), { schema: RAPORT, label: 'scribe:freshness', phase: 'Raport' })
if (!wynik) {
  log('Scribe padl — ponawiam raz')
  wynik = await agent(
    `${scribePrompt(data, statystyki, finalne, aktualne)}\n\n(PONOWNA PROBA — poprzedni zapis nie zwrocil wyniku. Nadpisz plik idempotentnie w calosci.)`,
    { schema: RAPORT, label: 'scribe:freshness:retry', phase: 'Raport' }
  )
}
const raport = wynik && wynik.raportSciezka ? wynik.raportSciezka : `docs/reviews/freshness-${data}.md`
if (!wynik) log('Scribe padl 2x — zwracam statystyki, raport moze nie istniec na dysku')

return { raport, statystyki, topRozjazdy }
