// MR-9effc9
import { describe, expect, it } from 'vitest';

import {
  MR_NOTATKA_MAX_ZNAKOW,
  MR_ZNACZNIK,
  MrNotatkaError,
  walidujNotatke,
  zbudujWierszNotatki,
  type MrWynikWalidacjiNotatki,
} from './mr-notatki.js';

const OFERTA_ID = '3f1c2a8e-6b4d-4e2f-9a1b-7c5d8e9f0a12';
const AUTOR_ID = '9b2e4c6a-1d3f-4a5b-8c7d-2e4f6a8b0c1d';

function odmowa(wynik: MrWynikWalidacjiNotatki): string {
  if (wynik.rodzaj !== 'odmowa') {
    throw new Error(`oczekiwano odmowy, a jest: ${wynik.rodzaj}`);
  }

  return wynik.komunikat;
}

describe('walidujNotatke', () => {
  it('191abf: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    const wynik = walidujNotatke({ oferta_id: OFERTA_ID, tresc: '  klient pytał o rabat  ' });

    expect(wynik.rodzaj).toBe('ok');
    if (wynik.rodzaj !== 'ok') return;

    expect(wynik.notatka).toEqual({ oferta_id: OFERTA_ID, tresc: 'klient pytał o rabat' });
    expect(zbudujWierszNotatki(wynik.notatka, AUTOR_ID)).toEqual({
      oferta_id: OFERTA_ID,
      autor_id: AUTOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('191abf: pusta treść po trim jest odrzucona z komunikatem', () => {
    const komunikat = odmowa(walidujNotatke({ oferta_id: OFERTA_ID, tresc: ' \n\t ' }));

    expect(komunikat).toContain('tresc: notatka nie może być pusta');
  });

  it('191abf: treść 2001 znaków jest odrzucona z komunikatem', () => {
    const komunikat = odmowa(
      walidujNotatke({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(MR_NOTATKA_MAX_ZNAKOW + 1) }),
    );

    expect(komunikat).toContain('tresc: limit to 2000 znaków');
  });

  it('191abf: treść dokładnie 2000 znaków przechodzi (granica włącznie)', () => {
    const wynik = walidujNotatke({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(MR_NOTATKA_MAX_ZNAKOW) });

    expect(wynik.rodzaj).toBe('ok');
  });

  it('191abf: limit liczy znaki jak char_length w bazie, nie jednostki UTF-16', () => {
    // 2000 emoji = 4000 jednostek UTF-16, ale 2000 punktów kodowych.
    const wynik = walidujNotatke({ oferta_id: OFERTA_ID, tresc: '😀'.repeat(MR_NOTATKA_MAX_ZNAKOW) });

    expect(wynik.rodzaj).toBe('ok');
  });

  it('191abf: oferta_id, który nie jest uuid, jest odrzucony', () => {
    const komunikat = odmowa(walidujNotatke({ oferta_id: 'oferta-123', tresc: 'notatka' }));

    expect(komunikat).toContain('oferta_id: identyfikator oferty musi być poprawnym UUID');
  });

  it('191abf: brak treści jest odrzucony z komunikatem, nie wyjątkiem', () => {
    const komunikat = odmowa(walidujNotatke({ oferta_id: OFERTA_ID }));

    expect(komunikat).toContain('tresc: wymagany tekst notatki');
  });

  it('191abf: odmowa wymienia każde naruszone pole', () => {
    const komunikat = odmowa(walidujNotatke({ oferta_id: 'x', tresc: '' }));

    expect(komunikat).toMatch(/^Odmowa zapisu notatki:/);
    expect(komunikat).toContain('oferta_id:');
    expect(komunikat).toContain('tresc:');
  });
});

describe('zbudujWierszNotatki', () => {
  it('191abf: autor_id spoza sesji (nie-UUID) daje typowany błąd', () => {
    expect(() => zbudujWierszNotatki({ oferta_id: OFERTA_ID, tresc: 'notatka' }, '')).toThrow(
      MrNotatkaError,
    );
  });

  it('191abf: autor_id w wejściu klienta nie trafia do wiersza', () => {
    const wynik = walidujNotatke({
      oferta_id: OFERTA_ID,
      tresc: 'notatka',
      autor_id: '00000000-0000-4000-8000-000000000000',
    });

    expect(wynik.rodzaj).toBe('ok');
    if (wynik.rodzaj !== 'ok') return;

    expect(zbudujWierszNotatki(wynik.notatka, AUTOR_ID).autor_id).toBe(AUTOR_ID);
  });
});

describe('MR_ZNACZNIK', () => {
  it('191abf: moduł eksportuje znacznik 72072f', () => {
    expect(MR_ZNACZNIK).toBe('72072f');
  });
});
