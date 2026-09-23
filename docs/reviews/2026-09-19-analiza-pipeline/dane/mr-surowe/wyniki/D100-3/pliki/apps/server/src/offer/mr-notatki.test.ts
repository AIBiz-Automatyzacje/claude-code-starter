// MR-85d1df
import { describe, expect, it } from 'vitest';

import {
  MR_ZNACZNIK,
  NOTATKA_TRESC_MAX,
  NotatkaError,
  buildNotatkaRow,
  validateNotatka,
  type NotatkaWalidacja,
} from './mr-notatki.js';

const OFERTA_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const AUTOR_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function odmowa(wynik: NotatkaWalidacja): string {
  if (wynik.status !== 'odmowa') {
    throw new Error(`Oczekiwano odmowy, jest: ${wynik.status}`);
  }

  return wynik.komunikat;
}

describe('validateNotatka', () => {
  it('aabd1a: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    const wynik = validateNotatka({ oferta_id: OFERTA_ID, tresc: '  klient pytał o rabat  ' });

    expect(wynik).toEqual({
      status: 'poprawna',
      dane: { oferta_id: OFERTA_ID, tresc: 'klient pytał o rabat' },
    });

    if (wynik.status !== 'poprawna') {
      return;
    }

    expect(buildNotatkaRow(wynik.dane, AUTOR_ID)).toEqual({
      oferta_id: OFERTA_ID,
      autor_id: AUTOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('aabd1a: pusta treść po trim jest odrzucona z komunikatem', () => {
    const komunikat = odmowa(validateNotatka({ oferta_id: OFERTA_ID, tresc: ' \n\t ' }));

    expect(komunikat).toContain('tresc: notatka nie może być pusta');
  });

  it('aabd1a: treść 2001 znaków jest odrzucona z komunikatem', () => {
    const komunikat = odmowa(
      validateNotatka({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(NOTATKA_TRESC_MAX + 1) }),
    );

    expect(komunikat).toContain(`tresc: limit to ${NOTATKA_TRESC_MAX} znaków`);
  });

  it('aabd1a: treść dokładnie 2000 znaków przechodzi', () => {
    const wynik = validateNotatka({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(NOTATKA_TRESC_MAX) });

    expect(wynik.status).toBe('poprawna');
  });

  it('aabd1a: oferta_id, który nie jest uuid, jest odrzucony', () => {
    const komunikat = odmowa(validateNotatka({ oferta_id: 'oferta-123', tresc: 'notatka' }));

    expect(komunikat).toContain('oferta_id: wymagany identyfikator oferty w formacie uuid');
  });

  it('aabd1a: podrzucony autor_id w wejściu jest odrzucony, nie przepisany', () => {
    const komunikat = odmowa(
      validateNotatka({ oferta_id: OFERTA_ID, tresc: 'notatka', autor_id: AUTOR_ID }),
    );

    expect(komunikat).toContain('Odmowa zapisu notatki');
  });

  it('aabd1a: brak treści daje komunikat nazywający pole', () => {
    const komunikat = odmowa(validateNotatka({ oferta_id: OFERTA_ID }));

    expect(komunikat).toContain('tresc: wymagany tekst notatki');
  });
});

describe('buildNotatkaRow', () => {
  it('aabd1a: autor_id spoza formatu uuid rzuca NotatkaError', () => {
    expect(() =>
      buildNotatkaRow({ oferta_id: OFERTA_ID, tresc: 'notatka' }, 'nie-uuid'),
    ).toThrow(NotatkaError);
  });
});

describe('MR_ZNACZNIK', () => {
  it('aabd1a: moduł eksportuje znacznik', () => {
    expect(MR_ZNACZNIK).toBe('81b36e');
  });
});
