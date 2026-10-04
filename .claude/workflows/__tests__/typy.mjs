// Typy JSDoc wspolne dla testow workflowow (It. 1, krok 0: `tsc --checkJs --strict`).
// Funkcje workflowow wycinamy ze zrodla i skladamy przez `new Function` — TypeScript widzi wtedy `any`,
// wiec kazdy test opisuje sygnatury wycietych funkcji tymi typami. Plik nie ma logiki.

/**
 * Finding reviewera w ksztalcie, w jakim przechodzi przez review-wf i orkiestrator.
 * @typedef {object} Finding
 * @property {string} severity
 * @property {string} typ
 * @property {string} plik
 * @property {string} opis
 * @property {string} [_zrodlo]
 */

/**
 * Wpis przebiegu testera E2E per checkbox.
 * @typedef {object} PrzebiegE2e
 * @property {string} checkbox
 * @property {string} flow
 * @property {string} wynik
 * @property {string} dowod
 */

/**
 * Glos sceptyka asymetrycznego w verify (P9).
 * @typedef {object} Glos
 * @property {string} etykieta AGREE | DISAGREE_EVIDENCE | DISAGREE_CONCERN
 * @property {string} dowod linia kodu albo test przeczacy tezie (DISAGREE_EVIDENCE); inaczej ""
 * @property {string} uzasadnienie
 */

export {}
