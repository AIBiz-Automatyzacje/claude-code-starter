// MR-ce6cd7
import { describe, expect, it } from 'vitest';

import {
  MR_NOTATKA_MAX_ZNAKOW,
  buildMrNotatkaInsertRow,
  validateMrNotatka,
} from './mr-notatki.js';

const OFERTA_ID = '3f2b8c1e-7a4d-4e9b-9c21-5d6e7f8a9b0c';
const AUTOR_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('validateMrNotatka', () => {
  it('9940d7: poprawne wejście przechodzi walidację i daje wiersz z autor_id', () => {
    const result = validateMrNotatka({ oferta_id: OFERTA_ID, tresc: '  klient pytał o rabat  ' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(buildMrNotatkaInsertRow(result.value, AUTOR_ID)).toStrictEqual({
      oferta_id: OFERTA_ID,
      autor_id: AUTOR_ID,
      tresc: 'klient pytał o rabat',
    });
  });

  it('9940d7: pusta treść po trim jest odrzucona z komunikatem', () => {
    const result = validateMrNotatka({ oferta_id: OFERTA_ID, tresc: ' \n\t ' });

    expect(result).toStrictEqual({
      ok: false,
      message: 'Odmowa zapisu notatki:\ntresc: notatka nie może być pusta',
    });
  });

  it('9940d7: treść 2001 znaków jest odrzucona z komunikatem', () => {
    const result = validateMrNotatka({
      oferta_id: OFERTA_ID,
      tresc: 'a'.repeat(MR_NOTATKA_MAX_ZNAKOW + 1),
    });

    expect(MR_NOTATKA_MAX_ZNAKOW + 1).toBe(2001);
    expect(result).toStrictEqual({
      ok: false,
      message: 'Odmowa zapisu notatki:\ntresc: notatka może mieć najwyżej 2000 znaków',
    });
  });

  it('9940d7: treść 2000 znaków spoza BMP przechodzi, bo sufit liczy punkty kodowe jak baza', () => {
    const tresc = '😀'.repeat(MR_NOTATKA_MAX_ZNAKOW);

    const result = validateMrNotatka({ oferta_id: OFERTA_ID, tresc });

    expect(tresc.length).toBe(4000);
    expect(result).toStrictEqual({ ok: true, value: { ofertaId: OFERTA_ID, tresc } });
  });

  it('9940d7: oferta_id, który nie jest uuid, jest odrzucony', () => {
    const result = validateMrNotatka({ oferta_id: 'oferta-123', tresc: 'klient pytał o rabat' });

    expect(result).toStrictEqual({
      ok: false,
      message: 'Odmowa zapisu notatki:\noferta_id: wymagany identyfikator oferty w formacie uuid',
    });
  });

  it('9940d7: autor_id podany w ładunku jest odrzucony, zamiast przejść do wiersza', () => {
    const result = validateMrNotatka({
      oferta_id: OFERTA_ID,
      tresc: 'klient pytał o rabat',
      autor_id: AUTOR_ID,
    });

    expect(result).toStrictEqual({
      ok: false,
      message:
        'Odmowa zapisu notatki:\nnotatka: dozwolone są wyłącznie pola oferta_id i tresc (autora ustala serwer)',
    });
  });
});
// MR-S-727788
