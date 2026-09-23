// MR-5777ae
import { describe, expect, it } from 'vitest';

import {
  NOTE_MAX_CODE_POINTS,
  OfferNoteValidationError,
  buildOfferNoteRow,
  validateOfferNoteInput,
} from './mr-notatki.js';

const OFFER_ID = '0b6f3c1e-8a2d-4c5e-9f10-2a3b4c5d6e7f';
const AUTHOR_ID = '5d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6';

/** Komunikat odmowy albo porażka testu, gdy walidacja przepuściła wejście. */
function refusalMessage(input: unknown): string {
  const result = validateOfferNoteInput(input);

  if (result.status === 'ok') {
    throw new Error('oczekiwano odmowy, walidacja przepuściła wejście');
  }

  expect(result.error).toBeInstanceOf(OfferNoteValidationError);

  return result.error.message;
}

describe('validateOfferNoteInput', () => {
  it('94a06d: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    const result = validateOfferNoteInput({ oferta_id: OFFER_ID, tresc: '  Klient pytał o rabat  ' });

    if (result.status !== 'ok') {
      throw new Error(`oczekiwano sukcesu, odmowa: ${result.error.message}`);
    }

    expect(buildOfferNoteRow(result.input, AUTHOR_ID)).toEqual({
      oferta_id: OFFER_ID,
      autor_id: AUTHOR_ID,
      tresc: 'Klient pytał o rabat',
    });
  });

  it('94a06d: pusta treść po trim jest odrzucona z komunikatem', () => {
    const message = refusalMessage({ oferta_id: OFFER_ID, tresc: ' \n\t ' });

    expect(message).toContain('tresc: notatka nie może być pusta');
  });

  it('94a06d: treść 2001 znaków jest odrzucona z komunikatem', () => {
    const message = refusalMessage({ oferta_id: OFFER_ID, tresc: 'a'.repeat(2001) });

    expect(message).toContain(`tresc: notatka jest dłuższa niż ${NOTE_MAX_CODE_POINTS} znaków`);
  });

  it('94a06d: treść dokładnie 2000 znaków przechodzi walidację', () => {
    const result = validateOfferNoteInput({ oferta_id: OFFER_ID, tresc: 'a'.repeat(2000) });

    expect(result.status).toBe('ok');
  });

  it('94a06d: 2000 emoji mieści się w suficie, bo sufit liczy punkty kodowe jak char_length w bazie', () => {
    const tresc = '😀'.repeat(2000);
    expect(tresc.length).toBe(4000);

    const result = validateOfferNoteInput({ oferta_id: OFFER_ID, tresc });

    expect(result.status).toBe('ok');
  });

  it('94a06d: oferta_id, który nie jest uuid, jest odrzucony', () => {
    const message = refusalMessage({ oferta_id: 'oferta-123', tresc: 'Klient pytał o rabat' });

    expect(message).toContain('oferta_id: identyfikator oferty musi być UUID');
  });

  it('94a06d: autor_id w wejściu jest odrzucony — tożsamość pochodzi z sesji, nie z ładunku', () => {
    const message = refusalMessage({
      oferta_id: OFFER_ID,
      tresc: 'Klient pytał o rabat',
      autor_id: AUTHOR_ID,
    });

    expect(message).toContain('autor_id');
  });
});
