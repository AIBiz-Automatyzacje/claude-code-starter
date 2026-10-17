// /dev-plan w swiezej sesji (P21 B3, HANDOFF 6a pkt 86 h).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/swieza-sesja-dev-plan.test.mjs
//
// DLACZEGO: w etapie 3 vibersi `/dev-plan` ruszyl w sesji z 215k kontekstu po `/dev-prep` i makietach; 48 tur planu ciagnelo
// ten balast (ok. 1,0 M z 6,89 M). `/dev-prep` uruchamial `/dev-plan` w tej samej sesji. Od P21 konczy sie linia
// „/clear, potem /dev-plan”, a `/dev-plan` przed praca pyta o `/clear`, gdy sesja ma juz inna prace.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const prep = readFileSync(join(REPO, '.claude/skills/dev-prep/SKILL.md'), 'utf8')
const plan = readFileSync(join(REPO, '.claude/skills/dev-plan/SKILL.md'), 'utf8')

/** @param {string} tekst @param {string} naglowek @returns {string} tresc sekcji do nastepnego naglowka tego samego lub wyzszego stopnia */
function sekcja(tekst, naglowek) {
  const start = tekst.indexOf(`\n${naglowek}\n`)
  assert.notEqual(start, -1, `brak sekcji ${naglowek}`)
  const poziom = naglowek.split(' ')[0]
  const reszta = tekst.slice(start + naglowek.length + 2)
  const koniec = reszta.search(new RegExp(`^#{1,${poziom.length}} `, 'm'))
  return koniec === -1 ? reszta : reszta.slice(0, koniec)
}

test('/dev-prep konczy sie linia „/clear, potem /dev-plan” i nie uruchamia /dev-plan w tej sesji', () => {
  const handoff = sekcja(prep, '### Faza 4: Podsumowanie i handoff')
  assert.match(handoff, /Następny krok: \/clear, potem \/dev-plan <origin>/)
  assert.doesNotMatch(handoff, /uruchom `\/dev-plan <origin>` w tej sesji/)
  assert.match(handoff, /`\/dev-plan` w tej sesji nie uruchamiasz/)
  assert.match(handoff, /Skill kończysz zawsze tą samą linią następnego kroku \(przy każdej odpowiedzi poza `Popraw dokument`\)/)
  assert.match(prep, /\/clear {10}→ świeża sesja przed planowaniem/)
})

test('/dev-plan zaczyna od kroku 0.0: inna praca w sesji = pytanie o /clear przed odczytem czegokolwiek', () => {
  const krok = sekcja(plan, '#### 0.0 Świeża sesja')
  assert.ok(plan.indexOf('#### 0.0 Świeża sesja') < plan.indexOf('#### 0.1 Wznowienie'), '0.0 przed 0.1')
  assert.match(krok, /zanim cokolwiek przeczytasz, zadaj `AskUserQuestion`/)
  assert.match(krok, /`Zrobię \/clear i wrócę` \(rekomendowane\)/)
  assert.match(krok, /`\/clear, potem \/dev-plan <to samo wejście>`/)
  assert.match(krok, /- `Planuj w tej sesji` — idziesz dalej \(0\.1\)/, 'operator moze swiadomie zostac w sesji')
  assert.match(krok, /Pierwsza wiadomość sesji to `\/dev-plan` → pytania nie zadajesz/)
})
