// MR-2da4b9
import { describe, expect, it } from 'vitest';

import {
  MR_NOTATKA_MAX_ZNAKOW,
  MR_ZNACZNIK,
  MrNotatkaError,
  buildMrNotatkaRow,
  validateMrNotatka,
  type MrNotatkaWalidacja,
} from './mr-notatki.js';

const OFERTA_ID = '3f0c5a1e-8b2d-4c7a-9e11-0a2b3c4d5e6f';
const AUTOR_ID = '7d9e2b40-1c3a-4f5b-8a6c-2e4f6a8b0c1d';

/** Wyciąga komunikat odmowy — a gdy walidacja PRZESZŁA, zapala test. */
function komunikatOdmowy(wynik: MrNotatkaWalidacja): string {
  expect(wynik.status).toBe('odmowa');
  return wynik.status === 'odmowa' ? wynik.komunikat : '';
}

describe('validateMrNotatka', () => {
  it('44c7f0: poprawne wejście przechodzi walidację i daje wiersz z autor_id z sesji', () => {
    const wynik = validateMrNotatka({ oferta_id: OFERTA_ID, tresc: '  klient pytał o rabat  ' });

    expect(wynik.status).toBe('ok');
    if (wynik.status !== 'ok') return;
    expect(buildMrNotatkaRow(wynik.wartosc, AUTOR_ID)).toStrictEqual({
      oferta_id: OFERTA_ID,
      autor_id: AUTOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('44c7f0: pusta treść po trim jest odrzucona z komunikatem nazywającym pole', () => {
    const komunikat = komunikatOdmowy(validateMrNotatka({ oferta_id: OFERTA_ID, tresc: ' \n\t ' }));

    expect(komunikat).toContain('tresc: notatka nie może być pusta');
  });

  it('44c7f0: treść 2001 znaków jest odrzucona z komunikatem o limicie', () => {
    const komunikat = komunikatOdmowy(
      validateMrNotatka({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(MR_NOTATKA_MAX_ZNAKOW + 1) }),
    );

    expect(komunikat).toContain('tresc: limit to 2000 znaków');
  });

  it('44c7f0: treść dokładnie 2000 znaków przechodzi (granica włącznie)', () => {
    const wynik = validateMrNotatka({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(MR_NOTATKA_MAX_ZNAKOW) });

    expect(wynik.status).toBe('ok');
  });

  it('44c7f0: limit liczy znaki jak char_length w bazie, nie jednostki UTF-16', () => {
    // 2000 emoji = 4000 jednostek UTF-16, ale 2000 znaków — CHECK w bazie je przyjmie.
    const wynik = validateMrNotatka({ oferta_id: OFERTA_ID, tresc: '😀'.repeat(MR_NOTATKA_MAX_ZNAKOW) });

    expect(wynik.status).toBe('ok');
  });

  it('44c7f0: oferta_id, który nie jest uuid, jest odrzucony z komunikatem', () => {
    const komunikat = komunikatOdmowy(validateMrNotatka({ oferta_id: 'oferta-123', tresc: 'notatka' }));

    expect(komunikat).toContain('oferta_id: wymagany identyfikator oferty w formacie UUID');
  });

  it('44c7f0: autor_id podany w wejściu jest odmową, a nie cichym pominięciem', () => {
    const komunikat = komunikatOdmowy(
      validateMrNotatka({ oferta_id: OFERTA_ID, tresc: 'notatka', autor_id: AUTOR_ID }),
    );

    expect(komunikat).toContain('niedozwolone pole (autor_id)');
  });

  it('44c7f0: wejście, które nie jest obiektem, jest odrzucone z komunikatem', () => {
    const komunikat = komunikatOdmowy(validateMrNotatka('notatka'));

    expect(komunikat).toContain('wejście: oczekiwano obiektu z polami oferta_id i tresc');
  });
});

describe('buildMrNotatkaRow', () => {
  it('44c7f0: autor_id spoza formatu UUID rzuca MrNotatkaError', () => {
    const wynik = validateMrNotatka({ oferta_id: OFERTA_ID, tresc: 'notatka' });
    expect(wynik.status).toBe('ok');
    if (wynik.status !== 'ok') return;

    expect(() => buildMrNotatkaRow(wynik.wartosc, '')).toThrow(MrNotatkaError);
  });
});

describe('MR_ZNACZNIK', () => {
  it('44c7f0: moduł eksportuje znacznik 21bb51', () => {
    expect(MR_ZNACZNIK).toBe('21bb51');
  });
});
