// Zrzuty testera E2E poza katalogiem zadania (P22 A3). Demon agent-browser rozwiazuje sciezke wzgledna zrzutu od swojego
// katalogu startowego (korzen repo), nie od katalogu powloki testera — vibersi etap 4: `cd <zadanie> && agent-browser
// screenshot x.png` zapisal x.png w korzeniu repo (nieśledzony), a bramka czystosci nastepnego runu stanela na nim.
// Sprzatanie przenosi nieśledzone obrazy z korzenia repo do katalogu zadania: drzewo poza zadaniem czyste, dowod testera
// zostaje. Glebiej nie siegamy — obraz w src/ moze byc nowym assetem buildera.

import { execFileSync } from 'node:child_process'
import { existsSync, realpathSync, renameSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'

const OBRAZY = ['png', 'jpg', 'jpeg', 'webp'].map((r) => `:(icase)*.${r}`)
const KATALOG_ZADAN = `docs${sep}active${sep}`

/**
 * @param {string} projekt katalog projektu (albo podkatalog repo)
 * @param {string} zadanie katalog zadania wzgledem projektu albo bezwzgledny (docs/active/<zadanie>)
 * @returns {{ przeniesione: string[], blad: string | null }} przeniesione: `<plik z korzenia> -> <sciezka w zadaniu>`
 */
export function przeniesZrzutyZKorzenia(projekt, zadanie) {
  let korzen
  try {
    korzen = realpathSync(execFileSync('git', ['-C', projekt, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim())
  } catch {
    return { przeniesione: [], blad: 'projekt poza repo git — zrzutów nie sprzątano' }
  }
  const sciezka = resolve(projekt, zadanie)
  const katalog = existsSync(sciezka) ? realpathSync(sciezka) : null
  const wzgledny = katalog ? relative(korzen, katalog) : ''
  if (!katalog || !wzgledny.startsWith(KATALOG_ZADAN) || wzgledny.split(sep).includes('..')) {
    return { przeniesione: [], blad: `katalog zadania ${zadanie} nie jest istniejącym katalogiem docs/active/<zadanie> w repo — zrzutów nie sprzątano` }
  }
  const nieSledzone = execFileSync('git', ['-C', korzen, 'ls-files', '--others', '--exclude-standard', '-z', '--', ...OBRAZY], { encoding: 'utf8' })
    .split('\0').filter((p) => p && !p.includes('/'))
  const przeniesione = nieSledzone.map((plik) => {
    const rozszerzenie = extname(plik)
    const cel = existsSync(join(katalog, plik)) ? `${plik.slice(0, -rozszerzenie.length)}-z-korzenia${rozszerzenie}` : plik
    renameSync(join(korzen, plik), join(katalog, cel))
    return `${plik} -> ${wzgledny}/${cel}`
  })
  return { przeniesione, blad: null }
}
