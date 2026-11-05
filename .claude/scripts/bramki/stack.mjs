// Bramka stacku (slot plikowy z rejestru stacks/sloty.json): punkt rozszerzenia bramek domkniecia fazy. Nakladka stacku podmienia plik
// w calosci; kontrakt: eksport `bramkaStacku`, wynik jak pozostale bramki. Web: nic do sprawdzenia.

/** @type {(projekt: string, zmiany: import('./diff.mjs').ZmianyFazy) => import('./uruchom.mjs').WynikBramki} */
export const bramkaStacku = () => ({ status: 'pominieta', sekundy: null, trafienia: [], powod: 'stack bez wlasnej bramki' })
