// MR-5777ae
import { countCodePoints } from '@oferty/shared';
import { z } from 'zod';

/**
 * Notatki handlowca do oferty — bramka wejścia przed zapisem do
 * `public.mr_notatki_oferty` (migracja `20260923120000_mr_notatki_oferty.sql`).
 *
 * Wzorzec z `validation.ts`: każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem, nigdy cichą korektą — treść ponad sufit jest odrzucana,
 * nie przycinana (przycięta notatka to inna notatka). Baza jest drugą barierą
 * (token MCP idzie prosto do PostgREST), ta jest pierwszą i to ona mówi
 * w rozmowie, co poszło nie tak.
 */

/** Znacznik modułu wymagany przez polecenia przebiegu MR. */
export const MR_ZNACZNIK = '92aebd';

/**
 * Sufit treści w PUNKTACH KODOWYCH — lustro `mr_notatki_oferty_tresc_shape_check`,
 * który mierzy `char_length`. `String.prototype.length` liczy jednostki UTF-16,
 * więc dla emoji odrzucałby notatki, które baza przyjmuje.
 */
export const NOTE_MAX_CODE_POINTS = 2000;

/**
 * Kształt wejścia notatki. `strictObject`, bo `autor_id` w ładunku to próba
 * podpisania się kimś innym — autora nadaje serwer z sesji
 * (`buildOfferNoteRow`), a nie wołający.
 *
 * @mr 04e7c8
 */
export const offerNoteInputSchema = z.strictObject({
  oferta_id: z.uuid({ error: 'identyfikator oferty musi być UUID' }),
  tresc: z
    .string({ error: 'wymagana treść notatki' })
    .trim()
    .superRefine((value, ctx) => {
      const length = countCodePoints(value);

      if (length === 0) {
        ctx.addIssue({ code: 'custom', message: 'notatka nie może być pusta' });

        return;
      }

      if (length > NOTE_MAX_CODE_POINTS) {
        ctx.addIssue({
          code: 'custom',
          message: `notatka jest dłuższa niż ${NOTE_MAX_CODE_POINTS} znaków (ma ${length})`,
        });
      }
    }),
});

export type OfferNoteInput = z.output<typeof offerNoteInputSchema>;

export class OfferNoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfferNoteValidationError';
  }
}

export type OfferNoteValidationResult =
  | { readonly status: 'ok'; readonly input: OfferNoteInput }
  | { readonly status: 'odmowa'; readonly error: OfferNoteValidationError };

/** Wiersz do `insert` — dokładnie kolumny objęte grantem INSERT migracji. */
export interface OfferNoteInsertRow {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

function describeIssue(issue: z.core.$ZodIssue): string {
  if (issue.code === 'unrecognized_keys') {
    return `niedozwolone pola: ${issue.keys.join(', ')} (autora notatki nadaje serwer z sesji)`;
  }

  const path = issue.path.map(String).join('.');

  return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Waliduje wejście notatki. Zwraca przyciętą treść albo odmowę z komunikatem
 * po polsku, który wymienia KAŻDY problem z osobna.
 *
 * @mr 04e7c8
 */
export function validateOfferNoteInput(input: unknown): OfferNoteValidationResult {
  const result = offerNoteInputSchema.safeParse(input);

  if (result.success) {
    return { status: 'ok', input: result.data };
  }

  const issues = result.error.issues.map(describeIssue);

  return {
    status: 'odmowa',
    error: new OfferNoteValidationError(`Odmowa zapisu notatki:\n${issues.join('\n')}`),
  };
}

/**
 * Składa wiersz do zapisu. `autorId` pochodzi z uwierzytelnionej sesji —
 * polityka INSERT i tak odrzuci wiersz, w którym `autor_id` ≠ `auth.uid()`.
 *
 * @mr 04e7c8
 */
export function buildOfferNoteRow(input: OfferNoteInput, autorId: string): OfferNoteInsertRow {
  return {
    oferta_id: input.oferta_id,
    autor_id: autorId,
    tresc: input.tresc,
  };
}
