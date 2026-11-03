// Login canary kontem e2e (plan szablonu mobile z rdzenia, IU-1.8, D16): przed startem srodowiska skrypt loguje sie kontem
// E2E_TEST_EMAIL przez Auth API projektu e2e, a gdy konta nie ma — zaklada je kluczem service_role i loguje ponownie. Zly login
// wychodzi na starcie z naprawa, zamiast jako SKIP-y testera w kazdej fazie. Atrapa Auth API na lokalnym porcie.
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/konto.test.mjs

import { createServer } from 'node:http'
import test from 'node:test'
import assert from 'node:assert/strict'

import { PROFIL } from '../../stack/profil.mjs'
import { loginCanary } from '../konto.mjs'

const { adresSupabase: ADRES, kluczSupabase: [KLUCZ = ''] } = PROFIL.env
const HASLO = 'tajne-haslo-e2e'
const SERWIS = 'klucz-serwisowy'

/**
 * Atrapa Auth API: konta w mapie e-mail → haslo; zapisuje zadania (metoda, sciezka, naglowki, cialo).
 * @param {{ konta?: Record<string, string>, status?: number, captcha?: boolean }} [o] status: wymuszona odpowiedz kazdego
 * zadania; captcha: projekt z wlaczona captcha Auth odrzuca logowanie bez tokenu, zanim sprawdzi haslo
 */
async function atrapa({ konta = {}, status, captcha = false } = {}) {
  /** @type {{ metoda: string, sciezka: string, apikey: string, autoryzacja: string, cialo: Record<string, unknown> }[]} */
  const zadania = []
  const serwer = createServer((zad, odp) => {
    let dane = ''
    zad.on('data', (k) => { dane += k })
    zad.on('end', () => {
      const cialo = dane ? JSON.parse(dane) : {}
      zadania.push({ metoda: zad.method ?? '', sciezka: zad.url ?? '', apikey: String(zad.headers.apikey ?? ''), autoryzacja: String(zad.headers.authorization ?? ''), cialo })
      const json = (/** @type {number} */ kod, /** @type {unknown} */ tresc) => odp.writeHead(kod, { 'Content-Type': 'application/json' }).end(JSON.stringify(tresc))
      if (status) return json(status, { code: 'unexpected_failure', msg: 'awaria' })
      if (zad.url === '/auth/v1/token?grant_type=password') {
        if (captcha) return json(400, { code: 'captcha_failed', error_code: 'captcha_failed', msg: 'captcha protection: request disallowed' })
        return konta[String(cialo.email)] === cialo.password
          ? json(200, { access_token: 'jwt', token_type: 'bearer' })
          : json(400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      }
      if (zad.url === '/auth/v1/admin/users' && zad.method === 'POST') {
        if (zad.headers.apikey !== SERWIS) return json(401, { msg: 'brak uprawnien' })
        if (String(cialo.email) in konta) return json(422, { code: 'email_exists', error_code: 'email_exists', msg: 'A user with this email address has already been registered' })
        konta[String(cialo.email)] = String(cialo.password)
        return json(200, { id: 'u1', email: cialo.email })
      }
      return json(404, {})
    })
  })
  await new Promise((r) => serwer.listen(0, '127.0.0.1', () => r(undefined)))
  const adres = serwer.address()
  const url = `http://127.0.0.1:${typeof adres === 'object' && adres ? adres.port : 0}`
  return { url, zadania, zamknij: () => new Promise((r) => serwer.close(() => r(undefined))) }
}

/** @param {string} url @param {Record<string, string>} [dodatkowe] @returns {Record<string, string>} .env.e2e z kontem e2e */
const env = (url, dodatkowe = {}) => ({
  [ADRES]: url, [KLUCZ]: 'klucz-klienta', SUPABASE_E2E_SERVICE_ROLE_KEY: SERWIS, E2E_TEST_EMAIL: 'e2e@x.pl', E2E_TEST_PASSWORD: HASLO, ...dodatkowe,
})

test('konto istnieje: logowanie password-grant kluczem klienta = ok, bez admin API', async () => {
  const a = await atrapa({ konta: { 'e2e@x.pl': HASLO } })
  try {
    const w = await loginCanary(env(a.url))
    assert.equal(w.status, 'ok', w.detal)
    assert.deepEqual(a.zadania.map((z) => [z.metoda, z.sciezka, z.apikey]), [['POST', '/auth/v1/token?grant_type=password', 'klucz-klienta']])
    assert.deepEqual(a.zadania[0]?.cialo, { email: 'e2e@x.pl', password: HASLO })
  } finally {
    await a.zamknij()
  }
})

test('brak konta: utworzenie przez admin API (service_role, potwierdzony e-mail) i ponowne logowanie = utworzone', async () => {
  const a = await atrapa()
  try {
    const w = await loginCanary(env(a.url))
    assert.equal(w.status, 'utworzone', w.detal)
    assert.deepEqual(a.zadania.map((z) => z.sciezka), ['/auth/v1/token?grant_type=password', '/auth/v1/admin/users', '/auth/v1/token?grant_type=password'])
    const admin = a.zadania[1]
    assert.deepEqual([admin?.apikey, admin?.autoryzacja], [SERWIS, `Bearer ${SERWIS}`])
    assert.deepEqual(admin?.cialo, { email: 'e2e@x.pl', password: HASLO, email_confirm: true })
    assert.doesNotMatch(`${w.detal} ${w.naprawa}`, new RegExp(`${HASLO}|${SERWIS}`), 'sekret w wyniku')
  } finally {
    await a.zamknij()
  }
})

test('konto z innym haslem: blad z naprawa, bez sekretow w wyniku', async () => {
  const a = await atrapa({ konta: { 'e2e@x.pl': 'inne' } })
  try {
    const w = await loginCanary(env(a.url))
    assert.equal(w.status, 'blad')
    assert.match(w.detal, /e2e@x\.pl/)
    assert.match(w.detal, /istnieje/)
    assert.match(w.naprawa, /E2E_TEST_PASSWORD/)
    assert.doesNotMatch(`${w.detal} ${w.naprawa}`, new RegExp(`${HASLO}|${SERWIS}|inne`), 'sekret w wyniku')
  } finally {
    await a.zamknij()
  }
})

// Odbior Etapu 1 w vibersi: projekt e2e z captcha Turnstile dostawal STOP startu z rada o adresie i kluczu, choc konto i haslo
// byly dobre. Auth odrzuca takie logowanie przed sprawdzeniem hasla, wiec canary nic o koncie nie wie: nie blokuje startu, nie
// zaklada konta i nie wysyla tokenu. Logowanie sprawdza tester w aplikacji, przez widget z kluczem testowym.
test('captcha Auth w projekcie e2e: canary pominiety z powodem, jedno zadanie, bez admin API i bez tokenu', async () => {
  const a = await atrapa({ konta: { 'e2e@x.pl': HASLO }, captcha: true })
  try {
    const w = await loginCanary(env(a.url))
    assert.equal(w.status, 'pominieto', w.detal)
    assert.equal(w.detal, 'projekt e2e wymaga captchy przy logowaniu — canary nie sprawdzil hasla konta e2e@x.pl, sprawdzi je tester')
    assert.equal(w.naprawa, '')
    assert.deepEqual(a.zadania.map((z) => z.sciezka), ['/auth/v1/token?grant_type=password'])
    assert.deepEqual(a.zadania[0]?.cialo, { email: 'e2e@x.pl', password: HASLO })
  } finally {
    await a.zamknij()
  }
})

test('awaria Auth API i brak polaczenia: blad z kodem HTTP albo przyczyna sieci', async () => {
  const a = await atrapa({ status: 500 })
  try {
    const w = await loginCanary(env(a.url))
    assert.equal(w.status, 'blad')
    assert.match(w.detal, /HTTP 500/)
  } finally {
    await a.zamknij()
  }
  const martwy = await loginCanary(env('http://127.0.0.1:9'), { limitMs: 2000 })
  assert.equal(martwy.status, 'blad')
  assert.match(martwy.naprawa, /\.env\.e2e/)
})

test('bez kompletu kluczy konta (adres, klucz klienta, e-mail, haslo) canary pominiety — braki zglasza sprawdzenie srodowiska', async () => {
  for (const brak of [ADRES, KLUCZ, 'E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD']) {
    const e = env('http://127.0.0.1:9')
    delete e[brak]
    assert.equal((await loginCanary(e)).status, 'pominieto', brak)
  }
})

test('legacy klucz klienta z profilu tez wystarcza do logowania', async () => {
  const legacy = PROFIL.env.kluczSupabase[1]
  if (!legacy) return
  const a = await atrapa({ konta: { 'e2e@x.pl': HASLO } })
  try {
    const e = env(a.url)
    delete e[KLUCZ]
    e[legacy] = 'klucz-legacy'
    assert.equal((await loginCanary(e)).status, 'ok')
    assert.equal(a.zadania[0]?.apikey, 'klucz-legacy')
  } finally {
    await a.zamknij()
  }
})
