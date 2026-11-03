// Login canary kontem e2e (plan szablonu mobile z rdzenia, IU-1.8, D16). Start srodowiska z baza e2e loguje sie kontem
// E2E_TEST_EMAIL przez Auth API projektu e2e (password grant kluczem klienta); konta, ktorego nie ma, zaklada kluczem
// service_role (potwierdzony e-mail) i loguje ponownie. Zly login wychodzi na starcie z naprawa — wczesniej dopiero tester
// trafial na niego w kazdej fazie (SKIP-y logowania), a mobile robil ten krok w prompcie env-up. Wynik nie niesie sekretow.

import { PROFIL } from '../stack/profil.mjs'

const LIMIT_MS = 10_000
const KONTO_ISTNIEJE = new Set(['email_exists', 'user_already_exists'])
const ZLE_DANE = new Set(['invalid_credentials', 'invalid_grant'])
// Captcha Auth odrzuca logowanie przed sprawdzeniem hasla, wiec canary nic o koncie nie wie: nie blokuje startu i nie zaklada
// konta. Tokenu nie wysyla — logowanie sprawdza tester w aplikacji, przez widget z kluczem testowym projektu.
const CAPTCHA = 'captcha_failed'

/** @typedef {{ status: 'ok' | 'utworzone' | 'blad' | 'pominieto', detal: string, naprawa: string }} WynikCanary */

/**
 * @param {string} url @param {Record<string, string>} naglowki @param {Record<string, unknown>} cialo @param {number} limitMs
 * @returns {Promise<{ status: number, kod: string } | { blad: string }>} status HTTP i kod bledu Auth API albo przyczyna sieci
 */
async function wyslij(url, naglowki, cialo, limitMs) {
  try {
    const odp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...naglowki }, body: JSON.stringify(cialo), signal: AbortSignal.timeout(limitMs) })
    const tresc = await odp.json().catch(() => ({}))
    const kod = tresc && typeof tresc === 'object' ? String(tresc.error_code ?? tresc.code ?? tresc.error ?? '') : ''
    return { status: odp.status, kod }
  } catch (e) {
    // Wynik canary, nie awaria skryptu: odmowa polaczenia, DNS albo limit czasu trafiaja do STOP-u z naprawa.
    return { blad: e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e) }
  }
}

/** @param {{ status: number, kod: string } | { blad: string }} w @returns {string} */
const opis = (w) => ('blad' in w ? w.blad : `HTTP ${w.status}${w.kod ? ` ${w.kod}` : ''}`)

/**
 * @param {Record<string, string>} env zawartosc .env.e2e
 * @param {{ limitMs?: number }} [opcje]
 * @returns {Promise<WynikCanary>}
 */
export async function loginCanary(env, { limitMs = LIMIT_MS } = {}) {
  const adres = env[PROFIL.env.adresSupabase]
  const klucz = PROFIL.env.kluczSupabase.map((k) => env[k]).find(Boolean)
  const { E2E_TEST_EMAIL: email, E2E_TEST_PASSWORD: haslo, SUPABASE_E2E_SERVICE_ROLE_KEY: serwis } = env
  if (!adres || !klucz || !email || !haslo) return { status: 'pominieto', detal: 'brak adresu, klucza klienta albo konta e2e w .env.e2e', naprawa: '' }
  const baza = adres.replace(/\/+$/, '')
  const naprawaSieci = `Sprawdz ${PROFIL.env.adresSupabase} i klucz klienta w .env.e2e oraz dostep do projektu e2e (Supabase → Authentication).`
  const login = () => wyslij(`${baza}/auth/v1/token?grant_type=password`, { apikey: klucz }, { email, password: haslo }, limitMs)
  const pierwszy = await login()
  if ('status' in pierwszy && pierwszy.status === 200) return { status: 'ok', detal: `zalogowano kontem ${email}`, naprawa: '' }
  if ('status' in pierwszy && pierwszy.kod === CAPTCHA) {
    return { status: 'pominieto', detal: `projekt e2e wymaga captchy przy logowaniu — canary nie sprawdzil hasla konta ${email}, sprawdzi je tester`, naprawa: '' }
  }
  if (!('status' in pierwszy) || !ZLE_DANE.has(pierwszy.kod)) {
    return { status: 'blad', detal: `logowanie kontem e2e ${email}: ${opis(pierwszy)}`, naprawa: naprawaSieci }
  }
  if (!serwis) {
    return { status: 'blad', detal: `logowanie kontem e2e ${email}: ${opis(pierwszy)}, a bez SUPABASE_E2E_SERVICE_ROLE_KEY konta nie da sie zalozyc`, naprawa: 'Dopisz SUPABASE_E2E_SERVICE_ROLE_KEY do .env.e2e albo zaloz konto E2E_TEST_EMAIL z haslem E2E_TEST_PASSWORD w projekcie e2e.' }
  }
  const zalozenie = await wyslij(`${baza}/auth/v1/admin/users`, { apikey: serwis, Authorization: `Bearer ${serwis}` }, { email, password: haslo, email_confirm: true }, limitMs)
  if ('status' in zalozenie && KONTO_ISTNIEJE.has(zalozenie.kod)) {
    return {
      status: 'blad',
      detal: `konto e2e ${email} istnieje, ale logowanie haslem E2E_TEST_PASSWORD odrzucone (${opis(pierwszy)})`,
      naprawa: `Ustaw w projekcie e2e haslo konta ${email} na wartosc E2E_TEST_PASSWORD (Supabase → Authentication → Users) albo popraw E2E_TEST_PASSWORD w .env.e2e.`,
    }
  }
  if (!('status' in zalozenie) || zalozenie.status >= 300) {
    return { status: 'blad', detal: `zalozenie konta e2e ${email} przez admin API: ${opis(zalozenie)}`, naprawa: `Sprawdz SUPABASE_E2E_SERVICE_ROLE_KEY w .env.e2e. ${naprawaSieci}` }
  }
  const drugi = await login()
  if ('status' in drugi && drugi.status === 200) return { status: 'utworzone', detal: `konto ${email} utworzone przez admin API i zalogowane`, naprawa: '' }
  return { status: 'blad', detal: `logowanie po zalozeniu konta ${email}: ${opis(drugi)}`, naprawa: naprawaSieci }
}
