// MR-3088cd
import { describe, expect, it } from 'vitest';

import { buildNoteRow, validateNoteInput, type ValidNoteInput } from './mr-notatki.js';

const OFFER_ID = '3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f';
const SESSION_AUTHOR_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const FORGED_AUTHOR_ID = '11111111-2222-4333-8444-555555555555';

/** Znak spoza BMP: 1 punkt kodowy (`char_length`), 2 jednostki UTF-16. */
const ASTRAL_CHARACTER = '\u{1F4B0}';

function acceptedNote(input: unknown): ValidNoteInput {
  const result = validateNoteInput(input);

  if (result.status !== 'ok') {
    throw new Error(`Oczekiwano przyjęcia notatki, odmowa: ${result.message}`);
  }

  return result.note;
}

function refusalMessage(input: unknown): string {
  const result = validateNoteInput(input);

  if (result.status !== 'odmowa') {
    throw new Error('Oczekiwano odmowy walidacji notatki');
  }

  return result.message;
}

describe('validateNoteInput', () => {
  it('8fb3c9: poprawne wejście przechodzi walidację i daje wiersz z autor_id z sesji', () => {
    // Arrange
    const input = { oferta_id: OFFER_ID, tresc: '  klient pytał o rabat  ' };

    // Act
    const row = buildNoteRow(acceptedNote(input), SESSION_AUTHOR_ID);

    // Assert
    expect(row).toStrictEqual({
      oferta_id: OFFER_ID,
      autor_id: SESSION_AUTHOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('8fb3c9: pusta treść po trim jest odrzucona z komunikatem nazywającym problem', () => {
    // Arrange
    const input = { oferta_id: OFFER_ID, tresc: ' \n\t ' };

    // Act
    const message = refusalMessage(input);

    // Assert
    expect(message).toContain('tresc: notatka nie może być pusta');
  });

  it('8fb3c9: treść 2001 znaków jest odrzucona z komunikatem o limicie', () => {
    // Arrange
    const input = { oferta_id: OFFER_ID, tresc: 'a'.repeat(2001) };

    // Act
    const message = refusalMessage(input);

    // Assert
    expect(message).toContain('tresc: limit to 2000 znaków');
  });

  it('8fb3c9: treść dokładnie 2000 znaków przechodzi walidację', () => {
    // Arrange
    const input = { oferta_id: OFFER_ID, tresc: 'a'.repeat(2000) };

    // Act
    const result = validateNoteInput(input);

    // Assert
    expect(result.status).toBe('ok');
  });

  it('8fb3c9: 2000 znaków spoza BMP przechodzi, bo sufit liczy się jak char_length w bazie', () => {
    // Arrange — 2000 punktów kodowych = 4000 jednostek UTF-16
    const input = { oferta_id: OFFER_ID, tresc: ASTRAL_CHARACTER.repeat(2000) };

    // Act
    const result = validateNoteInput(input);

    // Assert
    expect(result.status).toBe('ok');
  });

  it('8fb3c9: 2001 znaków spoza BMP jest odrzucone z komunikatem o limicie', () => {
    // Arrange
    const input = { oferta_id: OFFER_ID, tresc: ASTRAL_CHARACTER.repeat(2001) };

    // Act
    const message = refusalMessage(input);

    // Assert
    expect(message).toContain('tresc: limit to 2000 znaków');
  });

  it('8fb3c9: oferta_id, który nie jest uuid, jest odrzucony z komunikatem', () => {
    // Arrange
    const input = { oferta_id: 'oferta-123', tresc: 'klient pytał o rabat' };

    // Act
    const message = refusalMessage(input);

    // Assert
    expect(message).toContain('oferta_id: identyfikator oferty musi być UUID');
  });

  it('8fb3c9: brak treści jest odrzucony z komunikatem, nie wyjątkiem', () => {
    // Arrange
    const input = { oferta_id: OFFER_ID };

    // Act
    const message = refusalMessage(input);

    // Assert
    expect(message).toContain('tresc: wymagany tekst notatki');
  });
});

describe('buildNoteRow', () => {
  it('8fb3c9: autor_id podany w ładunku nie trafia do wiersza — tożsamość bierze się z sesji', () => {
    // Arrange
    const note = acceptedNote({
      oferta_id: OFFER_ID,
      tresc: 'klient pytał o rabat',
      autor_id: FORGED_AUTHOR_ID,
    });

    // Act
    const row = buildNoteRow(note, SESSION_AUTHOR_ID);

    // Assert
    expect(row.autor_id).toBe(SESSION_AUTHOR_ID);
    expect(Object.keys(row).sort()).toStrictEqual(['autor_id', 'oferta_id', 'tresc']);
  });
});
