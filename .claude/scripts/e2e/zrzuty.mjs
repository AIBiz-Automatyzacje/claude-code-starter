// Zrzuty testera E2E poza katalogiem zadania (P22 A3). Demon agent-browser rozwiazuje sciezke wzgledna zrzutu od swojego
// katalogu startowego, nie od katalogu powloki testera — vibersi etap 4: `cd <zadanie> && agent-browser screenshot x.png`
// zapisal x.png w korzeniu repo (nieśledzony). Run startuje na czystym drzewie (bramka czystosci bootstrapu), wiec
// nieśledzony PNG spoza katalogu zadania na koncu runu powstal w runie — sprzatanie srodowiska go usuwa.

import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @param {string} projekt katalog projektu (korzen repo)
 * @param {string} zadanie katalog zadania wzgledem projektu (docs/active/<zadanie>)
 * @returns {string[]} usuniete pliki (sciezki wzgledem projektu)
 */
export function usunZrzutySpozaZadania(projekt, zadanie) {
  const katalog = `${zadanie.replace(/^\.\//, '').replace(/\/+$/, '')}/`
  const nieSledzone = execFileSync('git', ['-C', projekt, 'ls-files', '--others', '--exclude-standard', '-z', '--', '*.png', '*.PNG'], { encoding: 'utf8' })
    .split('\0').filter(Boolean)
  const spoza = nieSledzone.filter((p) => !p.startsWith(katalog))
  for (const p of spoza) rmSync(join(projekt, p), { force: true })
  return spoza
}
