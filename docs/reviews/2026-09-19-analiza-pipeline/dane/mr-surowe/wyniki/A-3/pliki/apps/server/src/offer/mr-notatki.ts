// MR-d306e5
import { z } from 'zod';

/**
 * Notatki handlowca do opublikowanej oferty — bramka wejścia.
 *
 * Wzorzec z `validation.ts`: każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem po imieniu, nigdy cichą korektą (treść dłuższą niż sufit
 * odrzucamy, nie przycinamy). Baza jest drugą barierą (`CHECK` w migracji
 * `20260923120000_mr_notatki_oferty.sql`, RLS właściciela oferty) — token MCP
 * idzie prosto do PostgREST — a ta jest pierwszą i potrafi powiedzieć, co
 * dokładnie poszło nie tak.
 */

export const MR_ZNACZNIK = 'd51de0';

/**
 * Sufit treści = `mr_notatki_oferty_tresc_check`. Liczony w PUNKTACH KODOWYCH,
 * tak jak `char_length` w bazie — `string.length` liczy jednostki UTF-16 i poza
 * BMP (emoji) rozjechałby się z CHECK-iem.
 */
export const MR_NOTATKA_MAX_ZNAKOW = 2000;

function codePointLength(value: string): number {
  return [...value].length;
}

const mrNotatkaSchema = z.strictObject({
  oferta_id: z.uuid({ error: 'oferta_id: identyfikator oferty musi być UUID' }),
  tresc: z
    .string({ error: 'tresc: wymagany tekst notatki' })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .refine((value) => value.length > 0, {
          error: 'tresc: notatka nie może być pusta',
        })
        .refine((value) => codePointLength(value) <= MR_NOTATKA_MAX_ZNAKOW, {
          error: `tresc: notatka może mieć najwyżej ${MR_NOTATKA_MAX_ZNAKOW} znaków`,
        }),
    ),
});

export type MrNotatkaInput = z.input<typeof mrNotatkaSchema>;

export interface ValidatedMrNotatka {
  readonly oferta_id: string;
  /** Treść po `trim`, 1–2000 punktów kodowych. */
  readonly tresc: string;
}

export type MrNotatkaValidationResult =
  | { readonly ok: true; readonly data: ValidatedMrNotatka }
  | { readonly ok: false; readonly error: string };

/** Kolumny, które rola `authenticated` ma prawo wstawić (grant kolumnowy). */
export interface MrNotatkaInsertRow {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

/**
 * Waliduje wejście notatki. Nie rzuca — oddaje wynik albo odmowę z komunikatem
 * po polsku, który nazywa każde naruszone pole.
 *
 * @mr 17bcfb
 */
export function validateMrNotatka(input: unknown): MrNotatkaValidationResult {
  const result = mrNotatkaSchema.safeParse(input);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.join('.');

    return path.length > 0 && !issue.message.startsWith(path)
      ? `${path}: ${issue.message}`
      : issue.message;
  });

  return { ok: false, error: `Odmowa zapisu notatki:\n${issues.join('\n')}` };
}

/**
 * Wiersz do insertu w `public.mr_notatki_oferty`. `autor_id` przychodzi
 * z ZWERYFIKOWANEJ tożsamości wołającego (`auth.getUser`/claims tokenu), nigdy
 * z ładunku — polityka INSERT i tak odrzuci autora innego niż `auth.uid()`.
 * `id` i `created_at` nadaje baza.
 *
 * @mr 17bcfb
 */
export function buildMrNotatkaInsertRow(
  input: ValidatedMrNotatka,
  autorId: string,
): MrNotatkaInsertRow {
  return { oferta_id: input.oferta_id, autor_id: autorId, tresc: input.tresc };
}
