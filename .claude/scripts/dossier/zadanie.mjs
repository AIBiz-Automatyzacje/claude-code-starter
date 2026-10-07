// Wycinki dokumentow zadania z dysku: plik planu, zadan i kontekstu z katalogu zadania (docs/active/<nazwa>/),
// plan techniczny ze wskaznika "Plan techniczny:". Brak pliku = zdanie z powodem w dossier.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { czyFigmaScreens, liczE2e, sciezkaPlanu, sekcjaDesignerska, sekcjaFazy, wierszeWymagan } from './dokumenty.mjs'

/**
 * @typedef {{ planFazy: string, wymagania: string, zadaniaFazy: string, designerski: string,
 *   e2eCheckboxy: number, figmaScreens: boolean }} WycinkiZadania
 */

/**
 * Tresc pierwszego pliku katalogu zadania z danym sufiksem; null gdy brak.
 * @param {string} katalog
 * @param {string} sufiks
 * @returns {{ nazwa: string, tresc: string } | null}
 */
export function plikZadania(katalog, sufiks) {
  const nazwa = existsSync(katalog) ? readdirSync(katalog).filter((p) => p.endsWith(sufiks)).sort()[0] : undefined
  return nazwa ? { nazwa, tresc: readFileSync(join(katalog, nazwa), 'utf8') } : null
}

/**
 * @param {string} projekt
 * @param {string} sciezka katalog zadania wzgledem projektu
 * @param {number} faza
 * @returns {WycinkiZadania}
 */
export function wycinkiZadania(projekt, sciezka, faza) {
  const katalog = join(projekt, sciezka)
  const plan = plikZadania(katalog, '-plan.md')
  const zadania = plikZadania(katalog, '-zadania.md')
  const kontekst = plikZadania(katalog, '-kontekst.md')
  const wskaznik = [plan, zadania, kontekst].map((p) => (p ? sciezkaPlanu(p.tresc) : null)).find(Boolean) ?? null
  const planTechniczny = wskaznik && existsSync(join(projekt, wskaznik)) ? readFileSync(join(projekt, wskaznik), 'utf8') : null
  const planFazy = planTechniczny ? sekcjaFazy(planTechniczny, faza) : null
  const zadaniaFazy = zadania ? sekcjaFazy(zadania.tresc, faza) : null
  const designerski = kontekst ? sekcjaDesignerska(kontekst.tresc) : null
  return {
    planFazy: planFazy
      ?? (planTechniczny ? `Brak sekcji "Faza ${faza}" w ${wskaznik}.` : `Brak planu technicznego (wskaznik: ${wskaznik ?? 'brak linii "Plan techniczny:" w plikach zadania'}).`),
    wymagania: (planTechniczny && planFazy && wierszeWymagan(planTechniczny, planFazy)) ?? 'Brak wierszy: plan nie ma sekcji "Sledzenie wymagan" albo faza nie przywoluje ID wymagan.',
    zadaniaFazy: zadaniaFazy ?? (zadania ? `Brak sekcji "Faza ${faza}" w ${sciezka}/${zadania.nazwa}.` : `Brak pliku zadan w ${sciezka}.`),
    designerski: designerski ?? 'Brak sekcji "Designerski kontekst" w pliku kontekstu zadania.',
    e2eCheckboxy: zadaniaFazy ? liczE2e(zadaniaFazy) : 0,
    figmaScreens: czyFigmaScreens(designerski),
  }
}
