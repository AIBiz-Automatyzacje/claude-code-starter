// MR-8c057f
import { describe, expect, it } from 'vitest';

import {
  MR_ZNACZNIK,
  NOTATKA_TRESC_MAX,
  NotatkaOfertyError,
  notatkaOfertyInputSchema,
  walidujNotatke,
  zbudujWierszNotatki,
  type NotatkaOferty,
  type WynikWalidacjiNotatki,
} from './mr-notatki.js';

const OFERTA_ID = '3f1c2b8e-5a4d-4c7e-9b2a-1d0e6f7a8b9c';
const AUTOR_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

function oczekujOdmowy(wynik: WynikWalidacjiNotatki): NotatkaOfertyError {
  if (wynik.status !== 'odmowa') {
    throw new Error(`Oczekiwano odmowy, otrzymano: ${JSON.stringify(wynik)}`);
  }

  return wynik.blad;
}

function oczekujPoprawnej(wynik: WynikWalidacjiNotatki): NotatkaOferty {
  if (wynik.status !== 'poprawna') {
    throw new Error(`Oczekiwano poprawnej notatki, otrzymano: ${wynik.blad.message}`);
  }

  return wynik.notatka;
}

describe('walidujNotatke', () => {
  it('ee9491: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    const notatka = oczekujPoprawnej(
      walidujNotatke({ oferta_id: OFERTA_ID, tresc: '  klient pytał o rabat  ' }),
    );

    expect(notatka).toEqual({ oferta_id: OFERTA_ID, tresc: 'klient pytał o rabat' });
    expect(zbudujWierszNotatki(notatka, AUTOR_ID)).toEqual({
      oferta_id: OFERTA_ID,
      autor_id: AUTOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('ee9491: pusta treść po trim jest odrzucona z komunikatem', () => {
    const blad = oczekujOdmowy(walidujNotatke({ oferta_id: OFERTA_ID, tresc: ' \n\t ' }));

    expect(blad).toBeInstanceOf(NotatkaOfertyError);
    expect(blad.message).toContain('tresc: notatka nie może być pusta');
  });

  it('ee9491: treść 2001 znaków jest odrzucona z komunikatem', () => {
    const blad = oczekujOdmowy(
      walidujNotatke({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(NOTATKA_TRESC_MAX + 1) }),
    );

    expect(blad).toBeInstanceOf(NotatkaOfertyError);
    expect(blad.message).toContain(`tresc: notatka przekracza limit ${NOTATKA_TRESC_MAX} znaków`);
  });

  it('ee9491: treść dokładnie 2000 znaków przechodzi walidację', () => {
    const tresc = 'a'.repeat(NOTATKA_TRESC_MAX);

    expect(oczekujPoprawnej(walidujNotatke({ oferta_id: OFERTA_ID, tresc })).tresc).toBe(tresc);
  });

  it('ee9491: limit liczy treść po trim, nie surowe wejście', () => {
    const tresc = `  ${'a'.repeat(NOTATKA_TRESC_MAX)}  `;

    expect(oczekujPoprawnej(walidujNotatke({ oferta_id: OFERTA_ID, tresc })).tresc).toHaveLength(
      NOTATKA_TRESC_MAX,
    );
  });

  it('ee9491: oferta_id, który nie jest uuid, jest odrzucony', () => {
    const blad = oczekujOdmowy(walidujNotatke({ oferta_id: 'oferta-123', tresc: 'notatka' }));

    expect(blad).toBeInstanceOf(NotatkaOfertyError);
    expect(blad.message).toContain('oferta_id: identyfikator oferty musi być poprawnym UUID');
  });

  it('ee9491: pole autor_id w wejściu jest odmową, nie cichym pominięciem', () => {
    const blad = oczekujOdmowy(
      walidujNotatke({ oferta_id: OFERTA_ID, tresc: 'notatka', autor_id: AUTOR_ID }),
    );

    expect(blad.message).toContain('Niedozwolone pola w notatce: autor_id');
  });

  it('ee9491: wejście, które nie jest obiektem, jest odrzucone z komunikatem', () => {
    const blad = oczekujOdmowy(walidujNotatke(null));

    expect(blad.message).toContain('Wejście notatki musi być obiektem z polami oferta_id i tresc');
  });

  it('ee9491: brak treści i zły uuid naraz — komunikat nazywa oba problemy', () => {
    const blad = oczekujOdmowy(walidujNotatke({ oferta_id: 42 }));

    expect(blad.message).toContain('oferta_id:');
    expect(blad.message).toContain('tresc: wymagany tekst notatki');
  });
});

describe('notatkaOfertyInputSchema', () => {
  it('ee9491: schemat przycina treść poprawnego wejścia', () => {
    expect(notatkaOfertyInputSchema.parse({ oferta_id: OFERTA_ID, tresc: ' ok ' })).toEqual({
      oferta_id: OFERTA_ID,
      tresc: 'ok',
    });
  });

  it('ee9491: schemat odrzuca pustą treść', () => {
    expect(notatkaOfertyInputSchema.safeParse({ oferta_id: OFERTA_ID, tresc: '' }).success).toBe(
      false,
    );
  });
});

describe('zbudujWierszNotatki', () => {
  const notatka: NotatkaOferty = { oferta_id: OFERTA_ID, tresc: 'klient pytał o rabat' };

  it('ee9491: autor_id pochodzi z argumentu sesji', () => {
    expect(zbudujWierszNotatki(notatka, AUTOR_ID).autor_id).toBe(AUTOR_ID);
  });

  it('ee9491: autor_id, który nie jest uuid, rzuca NotatkaOfertyError', () => {
    expect(() => zbudujWierszNotatki(notatka, '')).toThrow(NotatkaOfertyError);
    expect(() => zbudujWierszNotatki(notatka, 'nie-uuid')).toThrow(
      'identyfikator autora z sesji nie jest poprawnym UUID',
    );
  });
});

describe('MR_ZNACZNIK', () => {
  it('ee9491: moduł eksportuje znacznik 787f77', () => {
    expect(MR_ZNACZNIK).toBe('787f77');
  });
});
