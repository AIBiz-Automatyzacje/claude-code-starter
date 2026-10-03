// Generuje skrypt Workflow kalibracji z dev-pr-wf.js: prompt zbierz, ZEBRANE, KLASY_BLEDOW bez zmian; podmiana tylko kroku 1.
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const src = readFileSync('/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/.claude/workflows/dev-pr-wf.js', 'utf8')
const wytnij = (od, doKonca) => { const a = src.indexOf(od); assert.ok(a >= 0, od); const b = src.indexOf(doKonca, a); assert.ok(b >= 0, doKonca); return src.slice(a, b + doKonca.length) }
const stale = [
  wytnij('const BLOK_GH = `', '=== KONIEC BLOKU gh ===`'),
  wytnij('const BLOK_STANU_PR = `', '=== KONIEC STANU PR ===`'),
  wytnij("const KLASY = [", "]"),
  wytnij('const KLASY_BLEDOW = {', '\n}'),
  wytnij('const OSIE_UWAG = [', ']'),
  wytnij('const WAGI_UWAG = [', ']'),
  wytnij('const ZEBRANE = {', '\n}'),
].join('\n\n')
let prompt = wytnij('`Jestes klasyfikatorem uwag', 'Zwroc obiekt zgodny ze schematem.${BLOK_STANU_PR}${BLOK_GH}`')
const podmien = (a, b) => { assert.equal(prompt.split(a).length, 2, a); prompt = prompt.replace(a, b) }
podmien('(\\`gh pr view --json number,headRefOid,changedFiles\\`', '(\\`gh pr view ${nr} -R ${REPO} --json number,headRefOid,changedFiles\\`')
podmien('Wez tylko te z \\`isResolved: false\\`.', 'Wez wszystkie watki, takze z \\`isResolved: true\\` (kalibracja na zmergowanym PR).')
podmien('(\\`gh pr view --json reviews\\`)', '(\\`gh pr view ${nr} -R ${REPO} --json reviews\\`)')
const skrypt = `export const meta = {
  name: 'kalibracja-pr-zbierz',
  description: 'Kalibracja P5: prompt etapu zbierz dev-pr na starych PR oferty-online (odczyt, bez zapisu w GitHubie)',
  phases: [{ title: 'Zbierz' }],
}
const REPO = 'AIBiz-Automatyzacje/oferty-online'
const KLON = '/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online'
${stale}

function polecenie(nr, zadanie) {
  const tura = 1
  const wstep = \`KALIBRACJA (sam odczyt). Pull request nr \${nr} w repo \${REPO} (owner AIBiz-Automatyzacje, repo oferty-online) — juz zmergowany.
Kazde \\\`gh pr view\\\` wolaj z \\\`\${nr} -R \${REPO}\\\`; w GraphQL owner=AIBiz-Automatyzacje, repo=oferty-online, pr=\${nr}.
Kod: lokalny klon \${KLON}; plik w wersji PR czytaj \\\`git -C \${KLON} show <headRefOid>:<sciezka>\\\`. Klonu nie zmieniaj (bez checkout).
Zadnych mutacji GraphQL, odpowiedzi ani rozwiazywania watkow.

\`
  return wstep + ${prompt}
}

phase('Zbierz')
const PR = args.pr
const wyniki = await parallel(PR.map((p) => () =>
  agent(polecenie(p.nr, p.zadanie), { schema: ZEBRANE, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: \`pr:zbierz:kalibracja-pr-\${p.nr}\`, phase: 'Zbierz' })
    .then((w) => ({ nr: p.nr, wynik: w }))))
return wyniki
`
writeFileSync('kalibracja-wf.js', skrypt)
console.log('ok', skrypt.length)
