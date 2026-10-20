// Naglowki proxy narzedzia (P24 IU-4): zdjecie zakazu osadzania w ramce (XFO, frame-ancestors w kazdej polityce CSP, HSTS),
// Location na origin proxy, Set-Cookie bez Domain i Secure, hop-by-hop w obu kierunkach. Fixture: naglowki aplikacji vibersi.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { bezFrameAncestors, naglowkiOdpowiedzi, naglowkiZadania } from '../naglowki.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const VIBERSI = JSON.parse(readFileSync(join(KATALOG, 'fixtures', 'naglowki-vibersi.json'), 'utf8')).naglowki
const ADRESY = { cel: 'http://localhost:5173', proxy: 'http://127.0.0.1:5180' }

test('nagłówki vibersi: bez XFO, HSTS i frame-ancestors; reszta CSP i pozostałe nagłówki bez zmian', () => {
  const w = naglowkiOdpowiedzi(VIBERSI, ADRESY)
  assert.equal(w['x-frame-options'], undefined)
  assert.equal(w['strict-transport-security'], undefined)
  assert.equal(w['content-security-policy'], VIBERSI['content-security-policy'].replace("frame-ancestors 'none'; ", ''))
  assert.match(String(w['content-security-policy']), /^default-src 'self'; script-src 'self'; connect-src 'self' https:\/\/abcdefghijklmnop\.supabase\.co; .*frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/www\.loom\.com;/)
  for (const k of ['cross-origin-opener-policy', 'cross-origin-resource-policy', 'x-content-type-options', 'referrer-policy', 'content-type']) {
    assert.equal(w[k], VIBERSI[k], k)
  }
})

test('kilka polityk po przecinku i Report-Only: frame-ancestors znika z każdej, wielkość liter bez znaczenia, puste polityki nie zostają', () => {
  assert.equal(bezFrameAncestors("default-src 'self'; FRAME-ANCESTORS 'none', frame-ancestors 'self', img-src *; Frame-Ancestors https://x"), "default-src 'self', img-src *")
  assert.equal(bezFrameAncestors("frame-ancestors 'none'"), null)
  assert.equal(bezFrameAncestors("default-src 'self' ;  ; frame-ancestorsx a"), "default-src 'self'; frame-ancestorsx a", 'inna dyrektywa o podobnej nazwie zostaje')
  const w = naglowkiOdpowiedzi({ 'content-security-policy-report-only': "frame-ancestors 'none'; report-uri /csp", 'content-security-policy': "frame-ancestors 'none'" }, ADRESY)
  assert.equal(w['content-security-policy-report-only'], 'report-uri /csp')
  assert.equal('content-security-policy' in w, false, 'polityka z samym frame-ancestors znika cała')
})

test('Location absolutne na cel → origin proxy; względne i obce bez zmian', () => {
  assert.equal(naglowkiOdpowiedzi({ location: 'http://localhost:5173/zaloguj?x=1#a' }, ADRESY).location, 'http://127.0.0.1:5180/zaloguj?x=1#a')
  assert.equal(naglowkiOdpowiedzi({ location: 'http://localhost:5173' }, ADRESY).location, 'http://127.0.0.1:5180/')
  assert.equal(naglowkiOdpowiedzi({ location: '/zaloguj' }, ADRESY).location, '/zaloguj')
  assert.equal(naglowkiOdpowiedzi({ location: 'https://abc.supabase.co/auth/v1/authorize?x' }, ADRESY).location, 'https://abc.supabase.co/auth/v1/authorize?x')
  assert.equal(naglowkiOdpowiedzi({ location: 'http://localhost:51730/x' }, ADRESY).location, 'http://localhost:51730/x', 'inny port to inny origin')
})

test('Set-Cookie traci Domain i Secure, pozostałe atrybuty zostają; kilka ciasteczek zostaje tablicą; SameSite=None → Lax', () => {
  const w = naglowkiOdpowiedzi({ 'set-cookie': ['a=1; Domain=localhost; Path=/; Secure; HttpOnly', 'b=2; secure; SameSite=None; Max-Age=60', 'c=Secure; Path=/'] }, ADRESY)
  assert.deepEqual(w['set-cookie'], ['a=1; Path=/; HttpOnly', 'b=2; SameSite=Lax; Max-Age=60', 'c=Secure; Path=/'])
})

test('hop-by-hop zdjęte w obu kierunkach, także wymienione w Connection; Host zostaje originem proxy, X-Forwarded-*', () => {
  const odp = naglowkiOdpowiedzi({ connection: 'keep-alive, x-wlasny', 'keep-alive': 'timeout=5', 'transfer-encoding': 'chunked', 'x-wlasny': '1', 'x-inny': '2' }, ADRESY)
  assert.deepEqual(odp, { 'x-inny': '2' })
  const zad = naglowkiZadania({ host: '127.0.0.1:5180', connection: 'close, x-tylko-skok', 'x-tylko-skok': '1', te: 'trailers', 'proxy-authorization': 'x', cookie: 'a=1', 'content-length': '3' }, ADRESY)
  assert.deepEqual(zad, { host: '127.0.0.1:5180', cookie: 'a=1', 'content-length': '3', 'x-forwarded-host': '127.0.0.1:5180', 'x-forwarded-proto': 'http' })
  const upgrade = naglowkiZadania({ host: '127.0.0.1:5180', connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-key': 'k' }, ADRESY, { upgrade: true })
  assert.equal(upgrade.connection, 'Upgrade')
  assert.equal(upgrade.upgrade, 'websocket')
  assert.equal(upgrade['sec-websocket-key'], 'k')
})
