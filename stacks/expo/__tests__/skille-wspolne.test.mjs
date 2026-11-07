// Skille wspólne i agenci badawczy w wariancie Expo (IU-2.9, D9, D10, D20; A0.3 §5). Rdzeń zostaje wersją web bez zmian, a nakładka ma kopie plików
// zależnych od stacku. Test porównuje każdą kopię z web: linia web jest w Expo dosłownie albo stoi na liście linii i sekcji stacku, więc zmiana web
// zatrzymuje test, dopóki ktoś jej nie przeniesie. Różnice mobile i poprawki P1 z A0.3 stoją w `references/stack.md` skilli.
//
// Uruchomienie: node --test stacks/expo/__tests__/skille-wspolne.test.mjs

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const NAKLADKA = join(KORZEN, 'stacks/expo/nakladka')
const { katalog: WARIANT, sprzataj } = przygotujLawke(KORZEN, 'expo')
after(sprzataj)
const web = (/** @type {string} */ p) => readFileSync(join(KORZEN, p), 'utf8')
const expo = (/** @type {string} */ p) => readFileSync(join(NAKLADKA, p), 'utf8')
const wariant = (/** @type {string} */ p) => readFileSync(join(WARIANT, p), 'utf8')

const S = '.claude/skills/security'
const E = '.claude/skills/sentry-integration'
const B = '.claude/skills/supabase-dev-guidelines'
const A = '.claude/agents'

/**
 * Początki linii web zastąpionych w Expo i sekcje zastąpione w całości: [początek pierwszej linii, początek linii kończącej, bez niej].
 * @type {Record<string, { linie: string[], sekcje?: [string, string][] }>}
 */
const KOPIE = {
  [`${S}/SKILL.md`]: { linie: ['description: ', 'Reguły dla kodu, który piszesz', '- Klucz sekretny i `service_role`', 'Audyt bezpieczeństwa (review'], sekcje: [['- HTML z danych użytkownika', '- Ukryty przycisk']] },
  [`${S}/resources/protokol-audytu.md`]: { linie: ['   - Form actions', '   - URL parameters', '   Przyklady: brak walidacji inputow', '   niebezpieczne renderowanie HTML', '   - Czy nie jest w zmiennych', '| XSS  '], sekcje: [['### XSS Detection', '### Auth/Authz Audit']] },
  [`${S}/resources/owasp-react-supabase.md`]: {
    linie: ['# OWASP Top 10', 'Przewodnik mapujący', '- `service_role` key w zmiennych', '- [ ] `service_role` key NIE jest', '- Brak Content Security Policy', '- [ ] **CSP dla', '- [ ] `X-Content-Type-Options', '- [ ] `Strict-Transport-Security', '- [ ] Sentry `beforeSend`', '// DOBRZE: secret server-side', 'const supabase = createClient(url, import.meta', 'SQL injection i XSS', '- Niebezpieczne renderowanie raw HTML', '- User-generated URLs', '- [ ] Brak renderowania niesanityzowanego', '- [ ] Walidacja protokołu URL', '- [ ] CSP blokuje', '## Podsumowanie', '| 3 | A02 Security', '| 4 | A05 Injection'],
    sekcje: [['**CSP dla Vite SPA', '**CORS — restrykcyjny'], ['import DOMPurify', '```\n---']],
  },
  [`${S}/resources/auth-security-patterns.md`]: { linie: ['Wzorce bezpieczenstwa specyficzne', '3. React -- uwazaj', '5. Secrets -- VITE_'], sekcje: [['## 3. React XSS Prevention', '## 4. Walidacja Granic'], ['### Co NIE moze byc', '### Edge Functions -- Zmienne']] },
  [`${E}/SKILL.md`]: { linie: ['description: ', 'Kompleksowy przewodnik', '> - **React SDK', '- **[react-sentry-patterns.md]', '  toast.error('], sekcje: [['### Frontend (React)', '### Edge Functions']] },
  [`${B}/SKILL.md`]: { linie: ['Przewodnik pracy z Supabase'] },
  [`${B}/resources/klient-i-przeglad.md`]: { linie: ['    { auth: { flowType', '    import.meta.env.VITE_SUPABASE_URL', '    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY', 'export const supabase = createClient(', "import { createClient }", '    // Domyślny flowType', ], sekcje: [['### Frontend (.env.local)', '### Edge Functions']] },
  [`${B}/resources/edge-functions.md`]: { linie: [], sekcje: [['## Wywołanie Edge Function z Frontend', '## Zmienne Środowiskowe']] },
  [`${B}/resources/database-patterns.md`]: { linie: ['    import.meta.env.VITE_SUPABASE_URL', '    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY'] },
  [`${B}/resources/security.md`]: { linie: ['const isDev = import.meta', "    toast.error('Wystąpił błąd')", "    toast.error('Nie udało się", '| Frontend (przeglądarka)'] },
  [`${B}/resources/auth-patterns.md`]: { linie: [], sekcje: [['# Wzorce Autentykacji', '## Tworzenie Profilu Użytkownika'], ['### Wywołanie na Froncie', '## ZA_KONCEM']] },
  [`${A}/best-practices-researcher.md`]: { linie: ['   - React/TypeScript/Components', '   - UI/Design/Accessibility', '   - Clearly indicate source', '- **Skill-based**'] },
  [`${A}/framework-docs-researcher.md`]: { linie: ['- React 19 in a Vite SPA', '- Tailwind CSS v4', '- Vite', '- Vitest (testing)'] },
  [`${A}/repo-research-analyst.md`]: { linie: ['| `vite.config.ts`', '| `tailwind.config.ts`', 'Common React/Vite SPA', '- `src/pages/` or', '   - Note testing requirements'] },
  [`${A}/web-research-specialist.md`]: { linie: ['user: "Dostaję błąd'] },
}

/** @param {string} plik @returns {string[]} linie web bez wyjęcia na liście */
function roznice(plik) {
  const { linie, sekcje = [] } = KOPIE[plik]
  const zExpo = new Set(expo(plik).split('\n'))
  const zWeb = web(plik).split('\n')
  const wSekcji = new Set()
  for (const [od, koniec] of sekcje) {
    const start = zWeb.findIndex((l) => l.startsWith(od))
    assert.notEqual(start, -1, `${plik}: brak początku sekcji „${od}”`)
    const stopRel = zWeb.slice(start + 1).findIndex((l) => l.startsWith(koniec.split('\n')[koniec.includes('\n') ? 1 : 0]))
    const stop = stopRel === -1 ? zWeb.length : start + 1 + stopRel
    for (let i = start; i < stop; i++) wSekcji.add(i)
  }
  return zWeb.filter((l, i) => l.trim() && !zExpo.has(l) && !wSekcji.has(i) && !linie.some((p) => l.startsWith(p)))
}

for (const plik of Object.keys(KOPIE)) {
  test(`kopia ${plik}: linie web dosłownie albo na liście stacku`, () => {
    assert.deepEqual(roznice(plik), [])
  })

  test(`kopia ${plik}: lista linii stacku bez wpisów nieaktualnych`, () => {
    const zWeb = web(plik).split('\n')
    assert.deepEqual(KOPIE[plik].linie.filter((p) => !zWeb.some((l) => l.startsWith(p))), [])
  })

  test(`kopia ${plik}: bez słów klienta web`, () => {
    assert.doesNotMatch(expo(plik), /\bVITE_|import\.meta|window\.location|toast\.|react-router|@sentry\/react['\s]|tailwind-react|`ux-ui-guidelines`|shadcn/)
  })
}

test('skille wspólne Expo: preload bez paths i odesłanie do references/stack.md', () => {
  for (const s of [S, E, B]) {
    const plik = expo(`${s}/SKILL.md`)
    assert.doesNotMatch(plik.slice(0, plik.indexOf('\n---\n', 4)), /^paths:/m, s)
    assert.match(plik, /`references\/stack\.md`/, s)
    assert.ok(existsSync(join(NAKLADKA, s, 'references/stack.md')), s)
  }
})

test('react-sentry-patterns poza wariantem, a skill odsyła do wersji RN', () => {
  assert.equal(existsSync(join(WARIANT, E, 'resources/react-sentry-patterns.md')), false)
  assert.ok(existsSync(join(WARIANT, E, 'resources/react-native-sentry-patterns.md')))
  const skill = wariant(`${E}/SKILL.md`)
  assert.match(skill, /resources\/react-native-sentry-patterns\.md/)
  assert.doesNotMatch(skill, /react-sentry-patterns/)
})

test('security (A0.3 §5.1): DOMPurify rzuca w RN (S1), waga storage wg D9 (S2), ramy mobile, klucze płatne bez API route (S5), sendDefaultPii (S7)', () => {
  const s = expo(`${S}/references/stack.md`)
  assert.match(s, /DOMPurify[^\n]*`TypeError`/)
  assert.doesNotMatch(s, /CICHY NO-OP|NO-OP/i)
  assert.match(s, /AsyncStorage[^\n]*(MEDIUM|nie jest CRITICAL)/)
  assert.match(s, /`LargeSecureStore`/)
  assert.match(s, /Mobile Top 10 2024/)
  assert.match(s, /MASVS 2\.1/)
  assert.match(s, /plan[^\n]*(Production|Enterprise)/)
  assert.match(s, /`sendDefaultPii: false`/)
  assert.match(s, /`expo-build-properties`/)
  assert.doesNotMatch(s, /API route|eas-hosting/)
})

test('sentry (T1–T7): metro, minimum wersji z exclude, opt-in Androida, eas env:set, nowa komenda sourcemap, bez enableNative', () => {
  const s = expo(`${E}/references/stack.md`)
  const p = expo(`${E}/resources/react-native-sentry-patterns.md`)
  assert.match(s, /getSentryExpoConfig/)
  assert.match(s, />=8\.33\.0/)
  assert.match(s, /`expo\.install\.exclude`/)
  assert.match(p, /enableAndroidGradlePlugin: true/)
  assert.match(p, /eas env:set/)
  assert.doesNotMatch(p, /eas env:create|sentry-expo-upload-sourcemaps|enableNative:/)
  assert.match(p, /npx @sentry\/expo-upload-sourcemaps dist/)
  assert.match(p, /npx expo export --dump-sourcemap/)
  assert.match(p, /autoWrapExpoRouterErrorBoundary/)
  assert.match(p, /sendDefaultPii: false/)
})

test('supabase (D1–D5, D9, D10): klient domyślny i LargeSecureStore, publishable key, PKCE, Realtime po powrocie, płatności IAP', () => {
  const s = expo(`${B}/references/stack.md`)
  const k = expo(`${B}/resources/klient-i-przeglad.md`)
  const a = expo(`${B}/resources/auth-patterns.md`)
  const f = expo(`${B}/resources/edge-functions.md`)
  assert.match(k, /process\.env\.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  assert.match(k, /expo-sqlite\/localStorage\/install/)
  assert.match(k, /detectSessionInUrl: false/)
  assert.match(s, /npx expo install @supabase\/supabase-js react-native-url-polyfill/)
  assert.match(s, /`LargeSecureStore`[^\n]*opcj/)
  assert.match(s, /supabase\.auth\.startAutoRefresh\(\)/)
  assert.match(s, /nie odpinasz kanału/)
  assert.doesNotMatch(s, /channel\.subscribe\(\)[^\n]*po[^\n]*unsubscribe/)
  assert.match(s, /`heartbeatCallback`/)
  assert.match(a, /exchangeCodeForSession/)
  assert.match(a, /skipBrowserRedirect: true/)
  assert.match(a, /`flowType: 'pkce'`/)
  assert.doesNotMatch(a, /url\.split\('#'\)/)
  assert.match(f, /RevenueCat/)
  assert.match(f, /3\.1\.1/)
  assert.match(f, /origin_context/)
})

test('sloty dev-prep i dev-compound: wymiar frame\'a, Target device, stos Expo', () => {
  const prep = expo('.claude/skills/dev-prep/references/stack.md')
  assert.match(prep, /^## Skan repo$/m)
  assert.match(prep, /^## Serwer API w E2E$/m)
  assert.match(prep, /^## Makiety$/m)
  assert.match(prep, /\*\*Wymiar frame'a\*\*/)
  assert.match(prep, /393×852/)
  assert.match(prep, /`Target device`/)
  assert.match(prep, /safe area/i)
  assert.doesNotMatch(prep, /Vite|Breakpointy/)
  const compound = expo('.claude/skills/dev-compound/references/stack.md')
  assert.match(compound, /^## Pola wpisu$/m)
  assert.match(compound, /Expo, React Native/)
  assert.doesNotMatch(compound, /Vite|Tailwind/)
})
