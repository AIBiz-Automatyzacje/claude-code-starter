// MR-ef5418
import { z } from 'zod';

/**
 * Notatki handlowca do własnej opublikowanej oferty (IU-MR).
 *
 * Wzorzec z `validation.ts`: każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem, nigdy cichą korektą. Jedyną transformacją jest `trim`
 * treści — tak jak w polach tekstowych publikacji.
 *
 * Autora notatki NIE bierze się z wejścia: dostaje go `buildOfferNoteRow`
 * z sesji wołającego (`auth.getUser`). Politykę „notatkę widzi i pisze tylko
 * właściciel oferty" egzekwuje RLS migracji `20260923120000_mr_notatki_oferty.sql`
 * — ten moduł jest pierwszą barierą, która potrafi powiedzieć zdaniem, co
 * poszło nie tak.
 */

export const MR_ZNACZNIK = '3460e0';

/**
 * Sufit treści = `mr_notatki_oferty_tresc_length_check` w migracji. Liczony
 * w PUNKTACH KODOWYCH, bo tak liczy `char_length` w Postgresie — `z.string().max`
 * liczy jednostki UTF-16 i rozjeżdżałby się z bazą poza BMP (emoji).
 */
const NOTE_MAX_LENGTH = 2000;

function countCodePoints(value: string): number {
  return [...value].length;
}

const offerNoteInputSchema = z.strictObject(
  {
    oferta_id: z.uuid({ error: 'oferta_id: identyfikator oferty musi być w formacie UUID' }),
    tresc: z
      .string({ error: 'tresc: wymagany tekst notatki' })
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(1, { error: 'tresc: notatka nie może być pusta' })
          .refine((value) => countCodePoints(value) <= NOTE_MAX_LENGTH, {
            error: `tresc: limit to ${NOTE_MAX_LENGTH} znaków`,
          }),
      ),
  },
  {
    // Nazwy nadmiarowych kluczy świadomie NIE trafiają do komunikatu — to
    // tekst z wejścia, a odmowa ma nazwać problem, nie odbić ładunek.
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? 'niedozwolone pole — dozwolone są wyłącznie oferta_id i tresc; autora notatki ustala sesja'
        : 'wymagany obiekt z polami oferta_id i tresc',
  },
);

/** Notatka po walidacji: `tresc` przycięta, `oferta_id` w kształcie UUID. */
export type OfferNote = z.output<typeof offerNoteInputSchema>;

export type OfferNoteValidation =
  | { readonly ok: true; readonly note: OfferNote }
  | { readonly ok: false; readonly message: string };

/**
 * Wiersz do `insert` w `public.mr_notatki_oferty` — dokładnie kolumny objęte
 * grantem INSERT migracji. `id` i `created_at` nadaje baza.
 */
export interface OfferNoteInsertRow {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

function describeRefusal(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.join('.');

    return path.length > 0 && !issue.message.startsWith(path)
      ? `${path}: ${issue.message}`
      : issue.message;
  });

  return `Odmowa zapisu notatki:\n${lines.join('\n')}`;
}

/**
 * Bramka wejścia notatki. Zwraca notatkę gotową do zapisu albo odmowę
 * z komunikatem po polsku — nigdy obiektu „prawie poprawnego".
 *
 * @mr 5be0d4
 */
export function validateOfferNote(input: unknown): OfferNoteValidation {
  const result = offerNoteInputSchema.safeParse(input);

  if (!result.success) {
    return { ok: false, message: describeRefusal(result.error) };
  }

  return { ok: true, note: result.data };
}

/**
 * Składa wiersz do zapisu. `authorId` pochodzi z ZWERYFIKOWANEJ sesji
 * (`auth.getUser`), nigdy z wejścia — polityka `mr_notatki_oferty_insert_own`
 * i tak odrzuci `autor_id` różne od `auth.uid()`.
 *
 * @mr 5be0d4
 */
export function buildOfferNoteRow(note: OfferNote, authorId: string): OfferNoteInsertRow {
  return { oferta_id: note.oferta_id, autor_id: authorId, tresc: note.tresc };
}
