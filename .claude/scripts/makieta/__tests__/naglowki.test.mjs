// Naglowki proxy narzedzia (P24 IU-4): zakaz osadzania zamieniony na „tylko ten origin” (XFO SAMEORIGIN, frame-ancestors 'self'
// w kazdej polityce CSP), HSTS zdjete, Location na origin proxy, Set-Cookie bez Domain i Secure, hop-by-hop w obu kierunkach,
// ramkowanie ciala bez przemytu. Fixture: naglowki aplikacji vibersi.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { frameAncestorsSelf, naglowkiOdpowiedzi, naglowkiZadania } from '../naglowki.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const VIBERSI = JSON.parse(readFileSync(join(KATALOG, 'fixtures', 'naglowki-vibersi.json'), 'utf8')).naglowki
const ADRESY = { cel: 'http://localhost:5173', proxy: 'http://127.0.0.1:5180' }
const SELF = "frame-ancestors 'self'"

test("nagłówki vibersi: XFO SAMEORIGIN, bez HSTS, frame-ancestors 'self'; reszta CSP i pozostałe nagłówki bez zmian", () => {
  const w = naglowkiOdpowiedzi(VIBERSI, ADRESY)
  assert.equal(w['x-frame-options'], 'SAMEORIGIN')
  assert.equal(w['strict-transport-security'], undefined)
  assert.equal(w['content-security-policy'], `${VIBERSI['content-security-policy'].replace("frame-ancestors 'none'; ", '')}; ${SELF}`)
  assert.match(String(w['content-security-policy']), /^default-src 'self'; script-src 'self'; connect-src 'self' https:\/\/abcdefghijklmnop\.supabase\.co; .*frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/www\.loom\.com;/)
  for (const k of ['cross-origin-opener-policy', 'cross-origin-resource-policy', 'x-content-type-options', 'referrer-policy', 'content-type']) {
    assert.equal(w[k], VIBERSI[k], k)
  }
  assert.equal(naglowkiOdpowiedzi({ 'content-type': 'text/html' }, ADRESY)['x-frame-options'], 'SAMEORIGIN', 'także gdy aplikacja (Vite dev) nie wysyła zakazu')
  assert.equal(naglowkiOdpowiedzi({}, ADRESY)['content-security-policy'], undefined, 'bez CSP aplikacji proxy jej nie dodaje')
})

test("kilka polityk po przecinku i Report-Only: frame-ancestors 'self' w każdej, która go miała; wielkość liter bez znaczenia; puste polityki nie zostają", () => {
  assert.equal(frameAncestorsSelf("default-src 'self'; FRAME-ANCESTORS 'none', frame-ancestors 'self', img-src *; Frame-Ancestors https://x"),
    `default-src 'self'; ${SELF}, ${SELF}, img-src *; ${SELF}`)
  assert.equal(frameAncestorsSelf("frame-ancestors 'none'"), SELF)
  assert.equal(frameAncestorsSelf(' ; , '), null)
  assert.equal(frameAncestorsSelf("default-src 'self' ;  ; frame-ancestorsx a"), "default-src 'self'; frame-ancestorsx a", 'inna dyrektywa o podobnej nazwie zostaje')
  const w = naglowkiOdpowiedzi({ 'content-security-policy-report-only': "frame-ancestors 'none'; report-uri /csp", 'content-security-policy': ['img-src *', "frame-ancestors 'none'"] }, ADRESY)
  assert.equal(w['content-security-policy-report-only'], `report-uri /csp; ${SELF}`)
  assert.equal(w['content-security-policy'], `img-src *, ${SELF}`, 'dwa nagłówki CSP to dwie polityki')
})

test('Location na cel → origin proxy (absolutne, bez schematu, 127.0.0.1 zamiast localhost); względne i obce bez zmian', () => {
  const loc = (/** @type {string} */ l) => naglowkiOdpowiedzi({ location: l }, ADRESY).location
  assert.equal(loc('http://localhost:5173/zaloguj?x=1#a'), 'http://127.0.0.1:5180/zaloguj?x=1#a')
  assert.equal(loc('http://localhost:5173'), 'http://127.0.0.1:5180/')
  assert.equal(loc('//localhost:5173/x'), 'http://127.0.0.1:5180/x')
  assert.equal(loc('http://127.0.0.1:5173/x'), 'http://127.0.0.1:5180/x')
  assert.equal(loc('/zaloguj'), '/zaloguj')
  assert.equal(loc('https://abc.supabase.co/auth/v1/authorize?x'), 'https://abc.supabase.co/auth/v1/authorize?x')
  assert.equal(loc('//abc.supabase.co/x'), '//abc.supabase.co/x')
  assert.equal(loc('http://localhost:51730/x'), 'http://localhost:51730/x', 'inny port to inny origin')
  assert.equal(loc('http://192.168.0.5:5173/x'), 'http://192.168.0.5:5173/x', 'adres sieciowy to nie cel')
})

test('Set-Cookie traci Domain i Secure, pozostałe atrybuty zostają; __Host-/__Secure-/Partitioned z Secure; SameSite=None → Lax', () => {
  const w = naglowkiOdpowiedzi({ 'set-cookie': [
    'a=1; Domain=localhost; Path=/; Secure; HttpOnly', 'b=2; secure; SameSite=None; Max-Age=60', 'c=Secure; Path=/', 'd=4; ; Secure=1; Path=/',
    '__Host-s=1; Path=/; Secure', '__Secure-t=1; Domain=localhost; Secure', 'p=1; Secure; Partitioned; SameSite=None',
  ] }, ADRESY)
  assert.deepEqual(w['set-cookie'], [
    'a=1; Path=/; HttpOnly', 'b=2; SameSite=Lax; Max-Age=60', 'c=Secure; Path=/', 'd=4; Path=/',
    '__Host-s=1; Path=/; Secure', '__Secure-t=1; Secure', 'p=1; Secure; Partitioned; SameSite=None',
  ])
})

test('hop-by-hop zdjęte w obu kierunkach, także wymienione w Connection (bez względu na wielkość liter); Host zostaje originem proxy', () => {
  const odp = naglowkiOdpowiedzi({ connection: 'keep-alive, X-Wlasny', 'keep-alive': 'timeout=5', 'transfer-encoding': 'chunked', trailer: 'x', upgrade: 'h2c', 'x-wlasny': '1', 'x-inny': '2' }, ADRESY)
  assert.deepEqual(odp, { 'x-inny': '2', 'x-frame-options': 'SAMEORIGIN' })
  const zad = naglowkiZadania({ host: 'evil.example', connection: 'close, x-tylko-skok', 'x-tylko-skok': '1', te: 'trailers', trailer: 'x', 'keep-alive': '1', upgrade: 'h2c', 'proxy-authorization': 'x', cookie: 'a=1', 'content-length': '3' }, ADRESY)
  assert.deepEqual(zad, { host: '127.0.0.1:5180', cookie: 'a=1', 'content-length': '3', 'x-forwarded-host': '127.0.0.1:5180', 'x-forwarded-proto': 'http' })
  const upgrade = naglowkiZadania({ host: '127.0.0.1:5180', connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-key': 'k' }, ADRESY, { upgrade: true })
  assert.equal(upgrade.connection, 'Upgrade')
  assert.equal(upgrade.upgrade, 'websocket')
  assert.equal(upgrade['sec-websocket-key'], 'k')
})

test('ramkowanie ciała: Content-Length i Host wymienione w Connection zostają; Transfer-Encoding idzie do celu jako chunked bez Content-Length', () => {
  const cl = naglowkiZadania({ host: '127.0.0.1:5180', connection: 'content-length, host', 'content-length': '5' }, ADRESY)
  assert.equal(cl['content-length'], '5')
  assert.equal(cl.host, '127.0.0.1:5180')
  const te = naglowkiZadania({ host: '127.0.0.1:5180', 'transfer-encoding': 'gzip, chunked', 'content-length': '10' }, ADRESY)
  assert.equal(te['transfer-encoding'], 'chunked')
  assert.equal(te['content-length'], undefined)
})
