// MR-788cf4
import { describe, expect, it } from 'vitest';

import {
  MR_NOTATKA_TRESC_MAX,
  MR_ZNACZNIK,
  MrNotatkaValidationError,
  walidujNotatke,
  zbudujWierszNotatki,
  type MrNotatkaWalidacja,
  type MrNotatkaWejscie,
} from './mr-notatki.js';

const OFERTA_ID = '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d';
const AUTOR_ID = '8a2b4c6d-1e3f-4a5b-8c7d-9e0f1a2b3c4d';

/** Rozpakowuje odmowę — test, który jej oczekuje, pada czytelnie na `poprawna`. */
function odmowa(wynik: MrNotatkaWalidacja): MrNotatkaValidationError {
  if (wynik.status !== 'odmowa') {
    throw new Error(`Oczekiwano odmowy, a walidacja przepuściła: ${JSON.stringify(wynik.notatka)}`);
  }

  return wynik.blad;
}

function poprawna(wynik: MrNotatkaWalidacja): MrNotatkaWejscie {
  if (wynik.status !== 'poprawna') {
    throw new Error(`Oczekiwano poprawnej notatki, a jest odmowa: ${wynik.blad.message}`);
  }

  return wynik.notatka;
}

describe('mr-notatki — znacznik modułu', () => {
  it('f65dfc: eksportuje stały znacznik modułu', () => {
    expect(MR_ZNACZNIK).toBe('2363a5');
  });
});

describe('walidujNotatke', () => {
  it('f65dfc: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    const notatka = poprawna(walidujNotatke({ oferta_id: OFERTA_ID, tresc: '  klient pytał o rabat  ' }));

    expect(notatka).toEqual({ oferta_id: OFERTA_ID, tresc: 'klient pytał o rabat' });
    expect(zbudujWierszNotatki(notatka, AUTOR_ID)).toEqual({
      oferta_id: OFERTA_ID,
      autor_id: AUTOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('f65dfc: pusta treść po trim jest odrzucona z komunikatem', () => {
    const blad = odmowa(walidujNotatke({ oferta_id: OFERTA_ID, tresc: ' \n\t  ' }));

    expect(blad).toBeInstanceOf(MrNotatkaValidationError);
    expect(blad.message).toContain('Odmowa zapisu notatki');
    expect(blad.problemy).toEqual([
      'tresc: notatka nie może być pusta ani składać się z samych białych znaków',
    ]);
  });

  it('f65dfc: treść 2001 znaków jest odrzucona z komunikatem, nie przycięta', () => {
    const blad = odmowa(
      walidujNotatke({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(MR_NOTATKA_TRESC_MAX + 1) }),
    );

    expect(blad.problemy).toEqual(['tresc: limit to 2000 znaków — skróć notatkę']);
  });

  it('f65dfc: treść dokładnie 2000 znaków przechodzi (granica włącznie)', () => {
    const notatka = poprawna(walidujNotatke({ oferta_id: OFERTA_ID, tresc: 'a'.repeat(MR_NOTATKA_TRESC_MAX) }));

    expect(notatka.tresc).toHaveLength(MR_NOTATKA_TRESC_MAX);
  });

  it('f65dfc: limit liczy punkty kodowe jak char_length w bazie, nie jednostki UTF-16', () => {
    // 2000 emoji = 4000 jednostek UTF-16, ale 2000 punktów kodowych — baza to przyjmie.
    const notatka = poprawna(walidujNotatke({ oferta_id: OFERTA_ID, tresc: '😀'.repeat(MR_NOTATKA_TRESC_MAX) }));

    expect(Array.from(notatka.tresc)).toHaveLength(MR_NOTATKA_TRESC_MAX);
  });

  it('f65dfc: oferta_id, który nie jest uuid, jest odrzucony', () => {
    const blad = odmowa(walidujNotatke({ oferta_id: 'oferta-123', tresc: 'klient pytał o rabat' }));

    expect(blad.problemy).toEqual(['oferta_id: oczekiwano identyfikatora UUID oferty']);
  });

  it('f65dfc: brak treści jest odrzucony z komunikatem nazywającym pole', () => {
    const blad = odmowa(walidujNotatke({ oferta_id: OFERTA_ID }));

    expect(blad.problemy).toEqual(['tresc: wymagany tekst notatki']);
  });

  it('f65dfc: wejście z polem autor_id jest odrzucone — autor pochodzi z sesji', () => {
    const blad = odmowa(
      walidujNotatke({ oferta_id: OFERTA_ID, tresc: 'klient pytał o rabat', autor_id: AUTOR_ID }),
    );

    expect(blad.problemy).toEqual([
      'Nieznane pola notatki: autor_id — autor notatki pochodzi z sesji, nie z wejścia',
    ]);
  });

  it('f65dfc: wejście, które nie jest obiektem, jest odrzucone', () => {
    const blad = odmowa(walidujNotatke('klient pytał o rabat'));

    expect(blad.problemy).toEqual(['Notatka: oczekiwano obiektu z polami oferta_id i tresc']);
  });

  it('f65dfc: zgłasza wszystkie problemy naraz', () => {
    const blad = odmowa(walidujNotatke({ oferta_id: 'x', tresc: '' }));

    expect(blad.problemy).toHaveLength(2);
  });
});

describe('zbudujWierszNotatki', () => {
  const notatka: MrNotatkaWejscie = { oferta_id: OFERTA_ID, tresc: 'klient pytał o rabat' };

  it('f65dfc: autor_id, który nie jest uuid, rzuca typowany błąd', () => {
    expect(() => zbudujWierszNotatki(notatka, 'nie-uuid')).toThrow(MrNotatkaValidationError);
    expect(() => zbudujWierszNotatki(notatka, 'nie-uuid')).toThrow(
      'autor_id: oczekiwano identyfikatora UUID zalogowanego użytkownika',
    );
  });

  it('f65dfc: niezwalidowane wejście przemycone rzutowaniem jest odrzucone', () => {
    const przemycone = { oferta_id: OFERTA_ID, tresc: 'a'.repeat(MR_NOTATKA_TRESC_MAX + 1) };

    expect(() => zbudujWierszNotatki(przemycone, AUTOR_ID)).toThrow(MrNotatkaValidationError);
  });
});
