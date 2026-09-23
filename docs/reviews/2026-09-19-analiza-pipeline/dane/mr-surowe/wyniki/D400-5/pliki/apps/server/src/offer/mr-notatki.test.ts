// MR-ef5418
import { describe, expect, it } from 'vitest';

import { buildOfferNoteRow, validateOfferNote } from './mr-notatki.js';

/** UUID v4 z poprawnym wariantem — `z.uuid()` sprawdza oba półbajty. */
const OFFER_ID = '3f1c2a9e-5b7d-4c8e-9a1f-2b3c4d5e6f70';
const AUTHOR_ID = '7d2e4f60-1a3b-4c5d-8e9f-0a1b2c3d4e5f';

describe('validateOfferNote + buildOfferNoteRow', () => {
  it('a5a96b: poprawne wejście przechodzi walidację i daje wiersz z autor_id z sesji', () => {
    // Arrange
    const input = { oferta_id: OFFER_ID, tresc: '  Klient pytał o rabat.  ' };

    // Act
    const result = validateOfferNote(input);

    // Assert
    expect(result).toEqual({
      ok: true,
      note: { oferta_id: OFFER_ID, tresc: 'Klient pytał o rabat.' },
    });
    if (!result.ok) {
      throw new Error('walidacja miała przejść');
    }
    expect(buildOfferNoteRow(result.note, AUTHOR_ID)).toEqual({
      oferta_id: OFFER_ID,
      autor_id: AUTHOR_ID,
      tresc: 'Klient pytał o rabat.',
    });
  });

  it('a5a96b: treść pusta po trim jest odrzucona z komunikatem nazywającym problem', () => {
    // Arrange
    const input = { oferta_id: OFFER_ID, tresc: ' \n\t ' };

    // Act
    const result = validateOfferNote(input);

    // Assert
    expect(result).toEqual({
      ok: false,
      message: 'Odmowa zapisu notatki:\ntresc: notatka nie może być pusta',
    });
  });

  it('a5a96b: treść 2001 znaków jest odrzucona z komunikatem o limicie', () => {
    // Arrange
    const input = { oferta_id: OFFER_ID, tresc: 'a'.repeat(2001) };

    // Act
    const result = validateOfferNote(input);

    // Assert
    expect(result).toEqual({
      ok: false,
      message: 'Odmowa zapisu notatki:\ntresc: limit to 2000 znaków',
    });
  });

  it('a5a96b: treść dokładnie 2000 znaków (po trim) przechodzi', () => {
    // Arrange
    const tresc = 'a'.repeat(2000);

    // Act
    const result = validateOfferNote({ oferta_id: OFFER_ID, tresc: `  ${tresc} ` });

    // Assert
    expect(result).toEqual({ ok: true, note: { oferta_id: OFFER_ID, tresc } });
  });

  it('a5a96b: limit liczy punkty kodowe jak char_length w bazie, nie jednostki UTF-16', () => {
    // Arrange — emoji spoza BMP to 1 punkt kodowy i 2 jednostki UTF-16.
    const atLimit = '😀'.repeat(2000);
    const overLimit = '😀'.repeat(2001);

    // Act
    const accepted = validateOfferNote({ oferta_id: OFFER_ID, tresc: atLimit });
    const refused = validateOfferNote({ oferta_id: OFFER_ID, tresc: overLimit });

    // Assert
    expect(atLimit).toHaveLength(4000);
    expect(accepted).toEqual({ ok: true, note: { oferta_id: OFFER_ID, tresc: atLimit } });
    expect(refused).toEqual({
      ok: false,
      message: 'Odmowa zapisu notatki:\ntresc: limit to 2000 znaków',
    });
  });

  it.each([
    ['tekst', 'oferta-123'],
    ['pusty tekst', ''],
    ['UUID bez myślników', '3f1c2a9e5b7d4c8e9a1f2b3c4d5e6f70'],
    ['liczba', 42],
  ])('a5a96b: oferta_id, który nie jest uuid (%s), jest odrzucony', (_label, ofertaId) => {
    // Arrange
    const input = { oferta_id: ofertaId, tresc: 'Klient pytał o rabat.' };

    // Act
    const result = validateOfferNote(input);

    // Assert
    expect(result).toEqual({
      ok: false,
      message: 'Odmowa zapisu notatki:\noferta_id: identyfikator oferty musi być w formacie UUID',
    });
  });

  it('a5a96b: autor_id w wejściu jest odmową — autora ustala sesja, nie ładunek', () => {
    // Arrange — próba podpisania notatki cudzym kontem.
    const input = {
      oferta_id: OFFER_ID,
      tresc: 'Klient pytał o rabat.',
      autor_id: '0b7c9d1e-2f3a-4b5c-8d6e-7f8091a2b3c4',
    };

    // Act
    const result = validateOfferNote(input);

    // Assert
    expect(result).toEqual({
      ok: false,
      message:
        'Odmowa zapisu notatki:\n' +
        'niedozwolone pole — dozwolone są wyłącznie oferta_id i tresc; autora notatki ustala sesja',
    });
  });

  it('a5a96b: wejście, które nie jest obiektem, jest odrzucone', () => {
    // Act
    const result = validateOfferNote('Klient pytał o rabat.');

    // Assert
    expect(result).toEqual({
      ok: false,
      message: 'Odmowa zapisu notatki:\nwymagany obiekt z polami oferta_id i tresc',
    });
  });
});
