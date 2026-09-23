// MR-04ab64
import { describe, expect, it } from 'vitest';

import {
  NOTATKA_MAX_ZNAKOW,
  validateNotatkaOferty,
  zbudujWierszNotatki,
  type WynikWalidacjiNotatki,
} from './mr-notatki.js';

const OFERTA_ID = '3f0c2a4e-8b1d-4c6f-9a2e-5d7b1c9e0f42';
const AUTOR_ID = '7a1e9c3b-2d4f-4e8a-b6c1-0f5d3a9e2b71';

function odmowa(wynik: WynikWalidacjiNotatki): string {
  if (wynik.ok) {
    throw new Error('oczekiwano odmowy walidacji, a wejście przeszło');
  }

  return wynik.komunikat;
}

describe('validateNotatkaOferty', () => {
  it('243c7c: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    const wynik = validateNotatkaOferty({
      oferta_id: OFERTA_ID,
      tresc: '  klient pytał o rabat  ',
    });

    if (!wynik.ok) {
      throw new Error(`oczekiwano poprawnej walidacji: ${wynik.komunikat}`);
    }

    expect(zbudujWierszNotatki(wynik.notatka, AUTOR_ID)).toEqual({
      oferta_id: OFERTA_ID,
      autor_id: AUTOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('243c7c: pusta treść po trim jest odrzucona z komunikatem', () => {
    const wynik = validateNotatkaOferty({ oferta_id: OFERTA_ID, tresc: ' \n\t ' });

    expect(odmowa(wynik)).toContain('tresc: notatka nie może być pusta');
  });

  it('243c7c: treść 2001 znaków jest odrzucona z komunikatem', () => {
    const wynik = validateNotatkaOferty({
      oferta_id: OFERTA_ID,
      tresc: 'a'.repeat(NOTATKA_MAX_ZNAKOW + 1),
    });

    expect(odmowa(wynik)).toContain('tresc: limit to 2000 znaków');
  });

  it('243c7c: treść dokładnie 2000 znaków przechodzi walidację', () => {
    const tresc = 'a'.repeat(NOTATKA_MAX_ZNAKOW);

    const wynik = validateNotatkaOferty({ oferta_id: OFERTA_ID, tresc });

    expect(wynik).toEqual({ ok: true, notatka: { oferta_id: OFERTA_ID, tresc } });
  });

  it('243c7c: limit liczy znaki jak char_length w bazie, nie jednostki UTF-16', () => {
    // Emoji spoza BMP to 1 znak dla `char_length`, a 2 jednostki UTF-16.
    const naGranicy = '🙂'.repeat(NOTATKA_MAX_ZNAKOW);
    const ponadGranica = '🙂'.repeat(NOTATKA_MAX_ZNAKOW + 1);

    const przyjeta = validateNotatkaOferty({ oferta_id: OFERTA_ID, tresc: naGranicy });
    const odrzucona = validateNotatkaOferty({ oferta_id: OFERTA_ID, tresc: ponadGranica });

    expect(przyjeta.ok).toBe(true);
    expect(odmowa(odrzucona)).toContain('tresc: limit to 2000 znaków');
  });

  it('243c7c: oferta_id, który nie jest uuid, jest odrzucony', () => {
    const wynik = validateNotatkaOferty({ oferta_id: 'oferta-123', tresc: 'klient pytał o rabat' });

    expect(odmowa(wynik)).toContain('oferta_id: identyfikator oferty musi być UUID');
  });

  it('243c7c: brak treści jest odrzucony z komunikatem, a nie rzuca wyjątku', () => {
    const wynik = validateNotatkaOferty({ oferta_id: OFERTA_ID });

    expect(odmowa(wynik)).toContain('tresc: wymagany tekst notatki');
  });
});
