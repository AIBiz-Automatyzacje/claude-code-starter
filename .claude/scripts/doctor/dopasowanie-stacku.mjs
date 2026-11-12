#!/usr/bin/env node
// Czesc doctor.sh (znaleziska 2026-11-02 pkt 26): warstwa stacku zaklada Supabase i jeden wariant szablonu, a aa-exam
// (Next.js, Fastify, Drizzle) i dashboard (klient w frontend/, backend w Pythonie) maja inna technologie. Decyzja operatora:
// osobnych profili nie budujemy, elementy stacku po prostu nie sa wtedy uzywane. Doctor mowi, ktore: wiersz na element,
// bo jedno zdanie „profil nie pasuje” liczone z korzenia sklamaloby w ukladzie frontend/ + backend/.
// Wiersze TSV jak higiena.mjs, tylko gdy jest co zglosic; zaden nie blokuje runu.
//
// Uzycie: node dopasowanie-stacku.mjs <katalog-projektu>

import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { PROFIL } from '../stack/profil.mjs'
import { manifestyZZaleznoscia, stanSupabase } from '../stack/projekt.mjs'

/** @typedef {[element: string, stan: 'UWAGA' | 'nie dotyczy', szczegol: string, naprawa: string]} Wiersz */

const MANIFESTY = 'package.json do trzech poziomów katalogów, pliki Pythona korzenia i pierwszego poziomu'

/**
 * Profil zaklada Supabase (klucz adresu w env klienta), a projekt nie ma ani katalogu supabase/, ani klienta w zaleznosciach.
 * @param {string} projekt @param {import('../stack/profil.mjs').Profil} profil @returns {Wiersz | null}
 */
function wierszSupabase(projekt, profil) {
  if (!profil.env.adresSupabase) return null
  const { sygnal, nieczytelne } = stanSupabase(projekt)
  if (sygnal === 'tak') return null
  // Punkt 55 (26): przy nieczytelnym manifescie brak trafienia nie jest dowodem — UWAGA zamiast „nie dotyczy”.
  if (sygnal === 'nieznane') {
    return ['stack: Supabase', 'UWAGA', `nie udało się ustalić (nieczytelny package.json: ${nieczytelne.join(', ')})`,
      'popraw JSON w tym pliku; do tego czasu stosuj elementy Supabase z profilu tylko tam, gdzie projekt ich używa']
  }
  return ['stack: Supabase', 'nie dotyczy', `brak katalogu supabase/, supabase/config.toml, zależności @supabase/* i wpisu supabase w requirements.txt/pyproject.toml (${MANIFESTY})`,
    'projekt bez Supabase: nie stosuj skilla supabase-dev-guidelines, komend supabase z roli buildera danych ani reguł RLS i GRANT; migracje i dostęp do danych narzędziami projektu (plan, CLAUDE.md)']
}

/**
 * Sygnal drugiego wariantu szablonu z profilu: paczka obecna w manifestach, a profil jej nie zaklada. Kierunek odwrotny
 * (profil zaklada paczke, a manifesty jej nie maja) nie daje wiersza: manifesty czytamy do pierwszego poziomu, wiec aplikacja
 * glebiej (apps/mobile/) dalaby falszywa uwage — brak trafienia nie jest dowodem.
 * @param {string} projekt @param {import('../stack/profil.mjs').Profil} profil @returns {Wiersz | null}
 */
function wierszWariantu(projekt, profil) {
  const { nazwa, zaleznosc, obecna, repo } = profil.szablon.innyWariant
  if (!obecna) return null
  const zPaczka = manifestyZZaleznoscia(projekt, zaleznosc)
  if (!zPaczka.length) return null
  return ['stack: wariant szablonu', 'UWAGA', `zależność ${zaleznosc} w ${zPaczka.join(', ')}, a profil stacku w .claude/ jej nie zakłada`,
    `dla tej aplikacji jest wariant ${nazwa} szablonu: ${repo}`]
}

/**
 * @param {string} projekt katalog projektu
 * @param {import('../stack/profil.mjs').Profil} [profil]
 * @returns {Wiersz[]}
 */
export function wierszeDopasowania(projekt, profil = PROFIL) {
  return [wierszSupabase(projekt, profil), wierszWariantu(projekt, profil)].filter((w) => w !== null)
}

// realpath: katalog tymczasowy macOS (/var → /private/var) daje rozne zapisy tej samej sciezki.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projekt = process.argv[2]
  if (!projekt) {
    process.stderr.write('Użycie: node dopasowanie-stacku.mjs <katalog-projektu>\n')
    process.exit(2)
  }
  for (const w of wierszeDopasowania(projekt)) process.stdout.write(`${w.join('\t')}\n`)
}
