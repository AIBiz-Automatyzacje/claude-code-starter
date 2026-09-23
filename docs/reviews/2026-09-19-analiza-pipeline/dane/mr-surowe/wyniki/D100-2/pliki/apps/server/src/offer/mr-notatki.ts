// MR-788cf4
import { z } from 'zod';

/**
 * Prywatne notatki handlowca do opublikowanej oferty (IU-MR).
 *
 * Wzorzec z `validation.ts`: każda reguła kończy się ODMOWĄ z komunikatem
 * nazywającym problem po imieniu — nigdy cichą korektą (za długa treść NIE
 * jest przycinana). Limity są lustrem `mr_notatki_oferty_tresc_check`
 * z migracji `20260923120000_mr_notatki_oferty.sql`: baza jest drugą barierą
 * (token MCP idzie prosto do PostgREST), ten moduł jest pierwszą i to on
 * potrafi powiedzieć, co dokładnie poszło nie tak.
 *
 * Tożsamość autora NIGDY nie pochodzi z wejścia: schemat odrzuca obiekt
 * z polem `autor_id`, a wiersz do insertu dostaje autora wyłącznie argumentem
 * `autorId` (z sesji). Polityka RLS INSERT i tak wymaga `autor_id = auth.uid()`.
 */

/** Znacznik modułu IU-MR. */
export const MR_ZNACZNIK = '2363a5';

/**
 * Sufit treści notatki w punktach kodowych — `char_length` w Postgresie liczy
 * punkty kodowe, nie jednostki UTF-16, więc `string.length` rozjechałby się
 * z bazą na emoji i znakach spoza BMP.
 */
export const MR_NOTATKA_TRESC_MAX = 2000;

/** Błąd walidacji notatki. Komunikat jest po polsku i nazywa problem. */
export class MrNotatkaValidationError extends Error {
  /** Lista pojedynczych problemów — każdy jako pełne zdanie. */
  readonly problemy: readonly string[];

  constructor(problemy: readonly string[]) {
    super(`Odmowa zapisu notatki:\n${problemy.join('\n')}`);
    this.name = 'MrNotatkaValidationError';
    this.problemy = problemy;
  }
}

function dlugoscWPunktachKodowych(value: string): number {
  return Array.from(value).length;
}

/** Schemat wejścia notatki: identyfikator oferty i treść (po trim 1–2000). */
export const mrNotatkaWejscieSchema = z.strictObject(
  {
    oferta_id: z.uuid({ error: 'oferta_id: oczekiwano identyfikatora UUID oferty' }),
    tresc: z
      .string({ error: 'tresc: wymagany tekst notatki' })
      .trim()
      .refine((value) => value.length > 0, {
        error: 'tresc: notatka nie może być pusta ani składać się z samych białych znaków',
      })
      .refine((value) => dlugoscWPunktachKodowych(value) <= MR_NOTATKA_TRESC_MAX, {
        error: `tresc: limit to ${MR_NOTATKA_TRESC_MAX} znaków — skróć notatkę`,
      }),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? `Nieznane pola notatki: ${issue.keys.join(', ')} — autor notatki pochodzi z sesji, nie z wejścia`
        : 'Notatka: oczekiwano obiektu z polami oferta_id i tresc',
  },
);

/** Wejście po walidacji — treść już przycięta i mieszcząca się w limicie. */
export type MrNotatkaWejscie = z.output<typeof mrNotatkaWejscieSchema>;

/** Wiersz gotowy do insertu w `public.mr_notatki_oferty`. */
export interface MrNotatkaWiersz {
  readonly oferta_id: string;
  readonly autor_id: string;
  readonly tresc: string;
}

/** Wynik walidacji — discriminated union, nie flaga + opcjonalne pola. */
export type MrNotatkaWalidacja =
  | { readonly status: 'poprawna'; readonly notatka: MrNotatkaWejscie }
  | { readonly status: 'odmowa'; readonly blad: MrNotatkaValidationError };

const autorIdSchema = z.uuid({ error: 'autor_id: oczekiwano identyfikatora UUID zalogowanego użytkownika' });

/**
 * Waliduje wejście notatki z granicy API.
 *
 * @mr bd8f25
 * @returns `poprawna` z przyciętą treścią albo `odmowa` z błędem, którego
 *   komunikat nazywa każdy problem po polsku.
 */
export function walidujNotatke(input: unknown): MrNotatkaWalidacja {
  const result = mrNotatkaWejscieSchema.safeParse(input);

  if (result.success) {
    return { status: 'poprawna', notatka: result.data };
  }

  const problemy = result.error.issues.map((issue) => issue.message);

  return { status: 'odmowa', blad: new MrNotatkaValidationError(problemy) };
}

/**
 * Buduje wiersz do insertu z (wejście, autor_id). Autor pochodzi WYŁĄCZNIE
 * z argumentu `autorId` (sesja), nigdy z wejścia.
 *
 * Fail fast: wejście jest walidowane ponownie (tani krok, a chroni przed
 * obiektem przemyconym rzutowaniem typu), `autorId` musi być UUID.
 *
 * @mr bd8f25
 * @throws {MrNotatkaValidationError} gdy wejście albo `autorId` są niepoprawne.
 */
export function zbudujWierszNotatki(wejscie: MrNotatkaWejscie, autorId: string): MrNotatkaWiersz {
  const autor = autorIdSchema.safeParse(autorId);

  if (!autor.success) {
    throw new MrNotatkaValidationError(autor.error.issues.map((issue) => issue.message));
  }

  const walidacja = walidujNotatke(wejscie);

  if (walidacja.status === 'odmowa') {
    throw walidacja.blad;
  }

  return {
    oferta_id: walidacja.notatka.oferta_id,
    autor_id: autor.data,
    tresc: walidacja.notatka.tresc,
  };
}
