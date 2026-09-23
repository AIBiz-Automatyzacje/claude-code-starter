// MR-04ab64
import { z } from 'zod';

/**
 * Notatki handlowca do opublikowanej oferty — walidacja wejścia i wiersz
 * do zapisu w `public.mr_notatki_oferty`.
 *
 * Wzorzec z `validation.ts`: każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem, nigdy cichą korektą (np. obcięciem za długiej treści).
 * Jedynym przekształceniem jest przycięcie białych znaków na brzegach.
 *
 * Granicę „czyja oferta" i „kto jest autorem" pilnuje RLS
 * (`20260923120000_mr_notatki_oferty.sql`) — ten moduł nie autoryzuje.
 */

export const MR_ZNACZNIK = 'cad317';

/**
 * Sufit treści = `mr_notatki_oferty_tresc_check`. Powtórzony tutaj po to, żeby
 * odmowa brzmiała jak zdanie, a nie jak błąd PostgREST-a.
 */
export const NOTATKA_MAX_ZNAKOW = 2000;

/**
 * Liczy znaki tak jak `char_length` w bazie (punkty kodowe), nie jak
 * `string.length` (jednostki UTF-16) — inaczej obie bramki rozjeżdżają się
 * na emoji spoza BMP. Punkt kodowy zajmuje 1 albo 2 jednostki UTF-16, więc
 * skrajne długości rozstrzygają bez rozbijania całego łańcucha.
 */
function miesciSieWLimicie(value: string): boolean {
  if (value.length <= NOTATKA_MAX_ZNAKOW) {
    return true;
  }

  if (value.length > NOTATKA_MAX_ZNAKOW * 2) {
    return false;
  }

  return [...value].length <= NOTATKA_MAX_ZNAKOW;
}

const trescSchema = z
  .string({ error: 'tresc: wymagany tekst notatki' })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, { error: 'tresc: notatka nie może być pusta' })
      .refine(miesciSieWLimicie, { error: `tresc: limit to ${NOTATKA_MAX_ZNAKOW} znaków` }),
  );

export const notatkaOfertySchema = z.object({
  oferta_id: z.uuid({ error: 'oferta_id: identyfikator oferty musi być UUID' }),
  tresc: trescSchema,
});

export type NotatkaOferty = z.output<typeof notatkaOfertySchema>;

export type WynikWalidacjiNotatki =
  | { readonly ok: true; readonly notatka: NotatkaOferty }
  | { readonly ok: false; readonly komunikat: string };

/**
 * Wiersz do INSERT — wyłącznie kolumny z grantu kolumnowego migracji.
 * `id` i `created_at` nadaje baza.
 */
export interface WierszNotatkiOferty {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

function komunikatOdmowy(error: z.ZodError): string {
  const problemy = error.issues.map((issue) => {
    const sciezka = issue.path.join('.');

    return sciezka.length > 0 && !issue.message.startsWith(sciezka)
      ? `${sciezka}: ${issue.message}`
      : issue.message;
  });

  return `Odmowa zapisu notatki:\n${problemy.join('\n')}`;
}

/**
 * Waliduje wejście notatki z granicy systemu. Zwraca notatkę z przyciętą
 * treścią albo odmowę z komunikatem po polsku nazywającym każdy problem.
 *
 * @mr b78b85
 */
export function validateNotatkaOferty(input: unknown): WynikWalidacjiNotatki {
  const result = notatkaOfertySchema.safeParse(input);

  if (result.success) {
    return { ok: true, notatka: result.data };
  }

  return { ok: false, komunikat: komunikatOdmowy(result.error) };
}

/**
 * Składa wiersz do zapisu z zwalidowanej notatki i tożsamości z sesji.
 * `autorId` pochodzi z uwierzytelnionej sesji, NIGDY z ładunku żądania —
 * polityka INSERT i tak odrzuci autora innego niż wołający.
 *
 * @mr b78b85
 */
export function zbudujWierszNotatki(notatka: NotatkaOferty, autorId: string): WierszNotatkiOferty {
  return {
    oferta_id: notatka.oferta_id,
    autor_id: autorId,
    tresc: notatka.tresc,
  };
}
