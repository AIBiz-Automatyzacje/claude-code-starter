// MR-7307c6
import { describe, expect, it } from 'vitest';

import { buildNoteRow, NOTE_MAX_LENGTH, validateNoteInput } from './mr-notatki.js';

const OFFER_ID = '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7';
const AUTHOR_ID = '0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d';

describe('validateNoteInput + buildNoteRow', () => {
  it('a6662b: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    const result = validateNoteInput({ oferta_id: OFFER_ID, tresc: '  klient pytał o rabat  ' });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(buildNoteRow(result.data, AUTHOR_ID)).toEqual({
      oferta_id: OFFER_ID,
      autor_id: AUTHOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('a6662b: treść z samych białych znaków jest odrzucona z komunikatem o pustej treści', () => {
    const result = validateNoteInput({ oferta_id: OFFER_ID, tresc: ' \n\t ' });

    expect(result).toEqual({
      success: false,
      message: 'Odmowa zapisu notatki:\ntresc: notatka nie może być pusta',
    });
  });

  it('a6662b: treść dłuższa o jeden znak od limitu jest odrzucona z komunikatem o limicie', () => {
    const result = validateNoteInput({ oferta_id: OFFER_ID, tresc: 'a'.repeat(NOTE_MAX_LENGTH + 1) });

    expect(result).toEqual({
      success: false,
      message: 'Odmowa zapisu notatki:\ntresc: limit to 2000 znaków',
    });
  });

  it('a6662b: treść dokładnie na limicie przechodzi walidację', () => {
    const result = validateNoteInput({ oferta_id: OFFER_ID, tresc: 'a'.repeat(NOTE_MAX_LENGTH) });

    expect(result.success).toBe(true);
  });

  it('a6662b: limit liczy punkty kodowe jak char_length w bazie, nie jednostki UTF-16', () => {
    const atLimit = validateNoteInput({ oferta_id: OFFER_ID, tresc: '😀'.repeat(NOTE_MAX_LENGTH) });
    const overLimit = validateNoteInput({
      oferta_id: OFFER_ID,
      tresc: '😀'.repeat(NOTE_MAX_LENGTH + 1),
    });

    expect(atLimit.success).toBe(true);
    expect(overLimit).toEqual({
      success: false,
      message: 'Odmowa zapisu notatki:\ntresc: limit to 2000 znaków',
    });
  });

  it('a6662b: oferta_id, który nie jest uuid, jest odrzucony z komunikatem', () => {
    const result = validateNoteInput({ oferta_id: 'oferta-123', tresc: 'klient pytał o rabat' });

    expect(result).toEqual({
      success: false,
      message: 'Odmowa zapisu notatki:\noferta_id: identyfikator oferty musi być uuid',
    });
  });

  it('a6662b: brak treści jest odrzucony z komunikatem nazywającym pole', () => {
    const result = validateNoteInput({ oferta_id: OFFER_ID });

    expect(result).toEqual({
      success: false,
      message: 'Odmowa zapisu notatki:\ntresc: wymagany tekst notatki',
    });
  });
});
