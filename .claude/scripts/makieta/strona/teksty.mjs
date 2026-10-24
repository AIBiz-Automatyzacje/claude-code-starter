// Teksty strony narzedzia makiet (P28): liczebnik z polska odmiana dla komunikatow i naglowkow.

/**
 * @param {number} n
 * @param {readonly [string, string, string]} formy „1 zgłoszenie”, „2 zgłoszenia”, „5 zgłoszeń”
 * @returns {string}
 */
export function liczebnik(n, [jeden, kilka, wiele]) {
  const reszta = n % 10
  const forma = n === 1 ? jeden : reszta >= 2 && reszta <= 4 && (n % 100 < 12 || n % 100 > 14) ? kilka : wiele
  return `${n} ${forma}`
}
