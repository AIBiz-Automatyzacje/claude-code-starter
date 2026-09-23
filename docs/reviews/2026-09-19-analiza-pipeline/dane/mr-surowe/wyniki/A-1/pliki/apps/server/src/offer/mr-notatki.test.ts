// MR-283e5f
import { describe, expect, it } from 'vitest';

import { NOTATKA_MAX_ZNAKOW, buildNotatkaRow, validateNotatka } from './mr-notatki.js';

const OFERTA_ID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const AUTOR_ID = '9d8c7b6a-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('validateNotatka', () => {
  it('d347be: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    const result = validateNotatka({ oferta_id: OFERTA_ID, tresc: '  klient pytał o rabat  ' });

    if (!result.ok) {
      throw new Error(`oczekiwano sukcesu, dostałem: ${result.blad}`);
    }
    expect(buildNotatkaRow(result.notatka, AUTOR_ID)).toStrictEqual({
      oferta_id: OFERTA_ID,
      autor_id: AUTOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('d347be: pusta treść po trim jest odrzucona z komunikatem', () => {
    const result = validateNotatka({ oferta_id: OFERTA_ID, tresc: ' \n\t ' });

    expect(result).toStrictEqual({
      ok: false,
      blad: 'Odmowa zapisu notatki:\ntresc: notatka nie może być pusta',
    });
  });

  it('d347be: treść 2001 znaków jest odrzucona z komunikatem', () => {
    const result = validateNotatka({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(NOTATKA_MAX_ZNAKOW + 1) });

    expect(result).toStrictEqual({
      ok: false,
      blad: 'Odmowa zapisu notatki:\ntresc: limit to 2000 znaków',
    });
  });

  it('d347be: treść dokładnie 2000 znaków spoza BMP przechodzi, bo sufit liczy punkty kodowe jak char_length', () => {
    const tresc = '😀'.repeat(NOTATKA_MAX_ZNAKOW);

    expect(tresc.length).toBe(NOTATKA_MAX_ZNAKOW * 2);
    expect(validateNotatka({ oferta_id: OFERTA_ID, tresc })).toStrictEqual({
      ok: true,
      notatka: { oferta_id: OFERTA_ID, tresc },
    });
  });

  it('d347be: oferta_id, który nie jest uuid, jest odrzucony', () => {
    const result = validateNotatka({ oferta_id: 'oferta-123', tresc: 'klient pytał o rabat' });

    expect(result).toStrictEqual({
      ok: false,
      blad: 'Odmowa zapisu notatki:\noferta_id: wymagany identyfikator oferty w formacie UUID',
    });
  });
});
