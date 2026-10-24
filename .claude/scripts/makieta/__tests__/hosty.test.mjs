// Uslugi z lista dozwolonych hostow (P28 (6), pilot etapu 5): adres narzedzia 127.0.0.1:<port> trzeba dopisac w Redirect URLs
// Supabase (OAuth) i w hostach widgetu Cloudflare Turnstile, inaczej logowanie dostawca i captcha w ramkach nie dzialaja.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import { hostyDoDopisania } from '../hosty.mjs'

/** @param {unknown} manifest zawartosc package.json (string = surowy tekst) @param {(projekt: string) => void} cialo */
function zProjektem(manifest, cialo) {
  const projekt = mkdtempSync(join(tmpdir(), 'makieta-hosty-'))
  try {
    if (manifest !== undefined) writeFileSync(join(projekt, 'package.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest))
    cialo(projekt)
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

test('Supabase i Turnstile w zależnościach: dwie pozycje z adresem narzędzia i miejscem wpisu', () => zProjektem({ dependencies: { '@supabase/supabase-js': '2.0.0' }, devDependencies: { '@marsidev/react-turnstile': '1.6.2' } }, (p) => {
  const h = hostyDoDopisania(p, 5180)
  assert.equal(h.length, 2)
  assert.match(h[0], /^Supabase \(logowanie OAuth\): Authentication → URL Configuration → Redirect URLs — dopisz http:\/\/127\.0\.0\.1:5180\/\*\*/)
  assert.match(h[1], /^Cloudflare Turnstile: Turnstile → widget → Hostname Management — dopisz 127\.0\.0\.1/)
}))

test('bez tych usług, bez package.json albo z uszkodzonym — pusta lista; port z argumentu', () => {
  zProjektem({ dependencies: { react: '19.0.0' } }, (p) => assert.deepEqual(hostyDoDopisania(p, 5180), []))
  zProjektem(undefined, (p) => assert.deepEqual(hostyDoDopisania(p, 5180), []))
  zProjektem('{zepsuty', (p) => assert.deepEqual(hostyDoDopisania(p, 5180), []))
  zProjektem({ dependencies: { '@supabase/ssr': '1.0.0' } }, (p) => assert.match(hostyDoDopisania(p, 5190)[0], /127\.0\.0\.1:5190\/\*\*/))
})
