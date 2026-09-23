// MR-d306e5
import { describe, expect, it } from 'vitest';

import {
  MR_NOTATKA_MAX_ZNAKOW,
  MR_ZNACZNIK,
  buildMrNotatkaInsertRow,
  validateMrNotatka,
} from './mr-notatki.js';

const OFERTA_ID = '3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f';
const AUTOR_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('validateMrNotatka', () => {
  it('34b600: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    // Arrange
    const input = { oferta_id: OFERTA_ID, tresc: '  klient pytał o rabat  ' };

    // Act
    const result = validateMrNotatka(input);

    // Assert
    expect(result).toEqual({
      ok: true,
      data: { oferta_id: OFERTA_ID, tresc: 'klient pytał o rabat' },
    });
    if (!result.ok) {
      throw new Error('oczekiwano poprawnej walidacji');
    }
    expect(buildMrNotatkaInsertRow(result.data, AUTOR_ID)).toStrictEqual({
      oferta_id: OFERTA_ID,
      autor_id: AUTOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('34b600: pusta treść po trim jest odrzucona z komunikatem', () => {
    const result = validateMrNotatka({ oferta_id: OFERTA_ID, tresc: ' \n\t ' });

    expect(result).toEqual({
      ok: false,
      error: 'Odmowa zapisu notatki:\ntresc: notatka nie może być pusta',
    });
  });

  it('34b600: treść 2001 znaków jest odrzucona z komunikatem', () => {
    const tresc = 'a'.repeat(MR_NOTATKA_MAX_ZNAKOW + 1);
    expect(tresc).toHaveLength(2001);

    const result = validateMrNotatka({ oferta_id: OFERTA_ID, tresc });

    expect(result).toEqual({
      ok: false,
      error: 'Odmowa zapisu notatki:\ntresc: notatka może mieć najwyżej 2000 znaków',
    });
  });

  it('34b600: treść dokładnie 2000 znaków spoza BMP przechodzi (liczymy punkty kodowe jak char_length)', () => {
    const tresc = '😀'.repeat(MR_NOTATKA_MAX_ZNAKOW);
    expect(tresc.length).toBe(4000);

    const result = validateMrNotatka({ oferta_id: OFERTA_ID, tresc });

    expect(result).toEqual({ ok: true, data: { oferta_id: OFERTA_ID, tresc } });
  });

  it.each([['nie-uuid'], [''], [`${OFERTA_ID}x`], [42]])(
    '34b600: oferta_id %j, który nie jest uuid, jest odrzucony',
    (ofertaId) => {
      const result = validateMrNotatka({ oferta_id: ofertaId, tresc: 'notatka' });

      expect(result).toEqual({
        ok: false,
        error: 'Odmowa zapisu notatki:\noferta_id: identyfikator oferty musi być UUID',
      });
    },
  );

  it('34b600: autor_id w ładunku jest odrzucony — autora bierze się z tożsamości, nie z wejścia', () => {
    const result = validateMrNotatka({ oferta_id: OFERTA_ID, tresc: 'notatka', autor_id: AUTOR_ID });

    expect(result.ok).toBe(false);
  });

  it('34b600: moduł eksportuje znacznik', () => {
    expect(MR_ZNACZNIK).toBe('d51de0');
  });
});
// MR-S-1bce20
