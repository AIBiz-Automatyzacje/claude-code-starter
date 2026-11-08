// Profil stacku (plan szablonu mobile z rdzenia, IU-1.7, D15): slot danych `.claude/stack/profil.json` z wartosciami
// zaleznymi od stacku, ktore czytaja skrypty rdzenia — klucze env klienta i straznika bazy dev, katalogi seedow i runnerow
// E2E, zmienne wbudowane narzedzia budowania, komenda testow powiazanych, komendy CLI stacku. Nakladka stacku podmienia
// plik JSON w calosci; modul tylko go wczytuje, wiec skrypty rdzenia nie niosa slow stacku.

import { readFileSync } from 'node:fs'

/**
 * @typedef {{ prefiksPubliczny: string, adresSupabase: string, kluczSupabase: string[], plikiDev: string[],
 *   plikE2eLokalny: string | null, aplikacjaE2e: string, wbudowane: string[] }} EnvStacku
 *   kluczSupabase: klucz klienta i jego zamienniki legacy; plikiDev: pliki env bazy dev; plikE2eLokalny: plik env, ktory
 *   w trybie e2e wygrywa z .env.e2e (null = stack go nie ma); aplikacjaE2e: kto w trybie e2e czyta pliki env (komunikaty)
 * @typedef {{ opis: string, env: EnvStacku, e2e: { katalogSeedow: string, katalogRunnerow: string, plikFlow: string | null }, zrodla: { frontend: string },
 *   testy: { powiazane: string }, komendyCli: string[], szablon: { repo: string } }} Profil
 *   plikFlow: wzor sciezki pliku flow scenariusza z `<flow>`, deliverable buildera (D17); null = tester gra scenariusz z opisu linii
 *   szablon.repo: repo, z ktorego sync-template zaciaga wariant stacku (czyta je sync-template.sh, IU-3.4)
 */

/** @type {Profil} */
export const PROFIL = JSON.parse(readFileSync(new URL('../../stack/profil.json', import.meta.url), 'utf8'))

/** @param {string} tekst @returns {string} tekst z ucieczka znakow specjalnych wyrazenia regularnego */
export const doWzorca = (tekst) => tekst.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
