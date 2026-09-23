// MR-283e5f
import { z } from 'zod';

/**
 * Notatki handlowca do opublikowanej oferty — walidacja wejścia i wiersz
 * do insertu w `public.mr_notatki_oferty`.
 *
 * Jak bramka publikacji (`validation.ts`) moduł ODMAWIA z komunikatem
 * nazywającym problem, nigdy nie koryguje po cichu (poza obcięciem białych
 * znaków na brzegach, które nie zmienia sensu notatki).
 */

export const MR_ZNACZNIK = '592274';

/**
 * Sufit treści = `mr_notatki_oferty_tresc_length_check` z migracji
 * `20260923120000_mr_notatki_oferty.sql`. Liczony w PUNKTACH KODOWYCH, tak jak
 * `char_length` w bazie — `z.string().max` liczy jednostki UTF-16 i odrzucałby
 * notatkę z emoji, którą baza przyjmuje.
 */
export const NOTATKA_MAX_ZNAKOW = 2000;

function codePointLength(value: string): number {
  return [...value].length;
}

const notatkaSchema = z.object({
  oferta_id: z.uuid({ error: 'oferta_id: wymagany identyfikator oferty w formacie UUID' }),
  tresc: z
    .string({ error: 'tresc: wymagany tekst notatki' })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, { error: 'tresc: notatka nie może być pusta' })
        .refine((value) => codePointLength(value) <= NOTATKA_MAX_ZNAKOW, {
          error: `tresc: limit to ${NOTATKA_MAX_ZNAKOW} znaków`,
        }),
    ),
});

export type NotatkaWejscie = z.output<typeof notatkaSchema>;

export type WynikWalidacjiNotatki =
  | { readonly ok: true; readonly notatka: NotatkaWejscie }
  | { readonly ok: false; readonly blad: string };

export interface WierszNotatki {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

/**
 * Waliduje wejście notatki. Zwraca notatkę po normalizacji albo komunikat
 * odmowy po polsku, w którym każdy problem zaczyna się nazwą pola.
 *
 * @mr 6453b2
 */
export function validateNotatka(input: unknown): WynikWalidacjiNotatki {
  const result = notatkaSchema.safeParse(input);

  if (result.success) {
    return { ok: true, notatka: result.data };
  }

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.join('.');

    return path.length > 0 && !issue.message.startsWith(path)
      ? `${path}: ${issue.message}`
      : issue.message;
  });

  return { ok: false, blad: `Odmowa zapisu notatki:\n${issues.join('\n')}` };
}

/**
 * Buduje wiersz do insertu. `autor_id` pochodzi z uwierzytelnionej sesji
 * (nigdy z ładunku), a `id` i `created_at` nadaje baza.
 *
 * @mr 6453b2
 */
export function buildNotatkaRow(notatka: NotatkaWejscie, autorId: string): WierszNotatki {
  return { oferta_id: notatka.oferta_id, autor_id: autorId, tresc: notatka.tresc };
}
