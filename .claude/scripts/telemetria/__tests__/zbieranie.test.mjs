// Test skanu maszyny (It. 1, krok 4): runy + epizody skilli → rekordy ze wspolnymi polami → jeden plik JSONL.

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { WERSJA_REKORDU, zbierzWszystko } from '../zbieranie.mjs'
import { katalogProjektu, katalogRepo, znajdzRuny } from '../zrodla.mjs'
import { odczytajRekordy } from '../zapis.mjs'
import { CWD_PROJEKTU, zbudujFixture } from './fixture-projekty.mjs'

/** @param {(k: { projekty: string, plik: string, bledy: string }) => void} cialo */
function zFixture(cialo) {
  const projekty = zbudujFixture()
  const wyjscie = mkdtempSync(join(tmpdir(), 'telemetria-wyjscie-'))
  try {
    cialo({ projekty, plik: join(wyjscie, 'pipeline.jsonl'), bledy: join(wyjscie, 'bledy.log') })
  } finally {
    rmSync(projekty, { recursive: true, force: true })
    rmSync(wyjscie, { recursive: true, force: true })
  }
}

const TERAZ = Date.parse('2026-09-29T12:00:00.000Z')

test('pelny skan: rekord run, faza, agenci i epizody skilli ze wspolnymi polami', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const wynik = zbierzWszystko({ projekty, plik, bledy, terazMs: TERAZ, szybko: false, sesjeWToku: new Set(), pominSesje: new Set() })
    assert.ok(wynik)
    const r = odczytajRekordy(plik).ostatnie
    const run = r.get('wf_aaa-111|run|wf_aaa-111')
    assert.equal(run?.status, 'OK')
    assert.equal(run?.projekt, 'projekt', 'projekt = nazwa katalogu repo (cwd), nie slug')
    assert.equal(run?.v, WERSJA_REKORDU)
    assert.equal(typeof run?.ts, 'string')
    assert.equal(r.get('wf_aaa-111|agent|a1')?.zadanie, 'zadanie-x', 'agent niesie zadanie runu')
    assert.ok(r.has('wf_aaa-111|faza|1'))
    const plan = r.get('skill|u1')
    assert.equal(plan?.skill, 'dev-plan')
    assert.equal(plan?.subagenci_jedn, 126)
    assert.equal(plan?.otwarty, false)
    assert.equal(r.get('skill|u2')?.otwarty, true, 'ostatni epizod pliku zapisany jako otwarty')
  })
})

test('run bez pliku harnessu, cichy ponad 3 h: KILLED; drugi skan nic nie dopisuje', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const we = { projekty, plik, bledy, terazMs: Date.now() + 4 * 3_600_000, szybko: false, sesjeWToku: new Set(), pominSesje: new Set() }
    zbierzWszystko(we)
    assert.equal(odczytajRekordy(plik).ostatnie.get('wf_bbb-222|run|wf_bbb-222')?.status, 'KILLED')
    assert.equal(zbierzWszystko(we)?.dopisanych, 0)
  })
})

test('hook: sesja z dzialajacym workflowem — jej run bez harnessu pominiety, jej epizody skilli nie zapisywane', () => {
  zFixture(({ projekty, plik, bledy }) => {
    zbierzWszystko({ projekty, plik, bledy, terazMs: Date.now() + 4 * 3_600_000, szybko: false, sesjeWToku: new Set(['sesja-1']), pominSesje: new Set(['sesja-1']) })
    const r = odczytajRekordy(plik).ostatnie
    assert.equal(r.has('wf_bbb-222|run|wf_bbb-222'), false)
    assert.equal(r.has('skill|u1'), false, 'zywa sesja hooka zmienia sie z kazda odpowiedzia — zapisze ja nastepny skan')
    assert.ok(r.has('wf_aaa-111|run|wf_aaa-111'), 'zakonczony run tej sesji zapisuje sie od razu')
  })
})

test('tryb szybki: znacznik po ostatniej zmianie plikow = nic do czytania', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const wynik = zbierzWszystko({ projekty, plik, bledy, terazMs: TERAZ, szybko: true, znacznikMs: Date.now() + 3_600_000, sesjeWToku: new Set(), pominSesje: new Set() })
    assert.equal(wynik?.runow, 1, 'tylko run bez rekordu i bez harnessu jest sprawdzany zawsze (moze byc juz KILLED)')
    assert.equal(wynik?.sesji, 0)
  })
})

// P22 F1: vibersi etap 4 — cwd pierwszego agenta runu autopilota = docs/active/<zadanie> (agent zrobil cd), rekordy dostaly
// projekt „etap-4-dodawanie-i-moderacja”, a `raport.mjs --projekt vibersi` dawal 0 runow. Projekt = katalog repo (z .git).
test('projekt = katalog repo nad cwd agenta (podkatalog zadania, takze juz usuniety); pole repo; bez repo — cwd sesji', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const repo = join(mkdtempSync(join(tmpdir(), 'telemetria-repo-')), 'vibersi')
    mkdirSync(join(repo, '.git'), { recursive: true })
    try {
      const sesja = join(projekty, '-Users-u-Kodowanie-projekt', 'sesja-1', 'subagents', 'workflows', 'wf_aaa-111')
      for (const n of readdirSync(sesja).filter((x) => x.startsWith('agent-') && x.endsWith('.jsonl'))) {
        writeFileSync(join(sesja, n), readFileSync(join(sesja, n), 'utf8').replaceAll(CWD_PROJEKTU, join(repo, 'docs/active/zadanie-x')))
      }
      zbierzWszystko({ projekty, plik, bledy, terazMs: TERAZ, szybko: false, sesjeWToku: new Set(), pominSesje: new Set() })
      const r = odczytajRekordy(plik).ostatnie
      for (const klucz of ['wf_aaa-111|run|wf_aaa-111', 'wf_aaa-111|agent|a1', 'wf_aaa-111|faza|1']) {
        assert.deepEqual([r.get(klucz)?.projekt, r.get(klucz)?.repo], ['vibersi', repo], klucz)
      }
      assert.deepEqual([r.get('skill|u1')?.projekt, r.get('skill|u1')?.repo], ['projekt', null], 'cwd sesji poza repo — nazwa katalogu cwd')
      // Ten sam korzen dostaja pliki rol, wiedza i wersja szablonu runu (instrukcje_stale, klasyZRegula, szablon).
      assert.equal(katalogProjektu(znajdzRuny(projekty).find((x) => x.run === 'wf_aaa-111') ?? (() => { throw new Error('brak runu') })()), repo)
    } finally {
      rmSync(join(repo, '..'), { recursive: true, force: true })
    }
  })
})

test('katalogRepo: korzen z .git (katalog albo plik worktree) nad sciezka, takze nieistniejaca; poza repo i brak = null', () => {
  const k = mkdtempSync(join(tmpdir(), 'telemetria-repo-'))
  try {
    mkdirSync(join(k, 'repo', '.git'), { recursive: true })
    mkdirSync(join(k, 'wt'), { recursive: true })
    writeFileSync(join(k, 'wt', '.git'), 'gitdir: /x\n')
    // Worktree repo glownego (.claude/worktrees/<nazwa>) — projekt to repo; submodul zostaje osobnym repo.
    mkdirSync(join(k, 'repo', '.claude', 'worktrees', 'tura-1'), { recursive: true })
    writeFileSync(join(k, 'repo', '.claude', 'worktrees', 'tura-1', '.git'), `gitdir: ${join(k, 'repo', '.git', 'worktrees', 'tura-1')}\n`)
    mkdirSync(join(k, 'repo', 'lib', 'sub'), { recursive: true })
    writeFileSync(join(k, 'repo', 'lib', 'sub', '.git'), 'gitdir: ../../.git/modules/sub\n')
    assert.equal(katalogRepo(join(k, 'repo', '.claude', 'worktrees', 'tura-1', 'src')), join(k, 'repo'))
    assert.equal(katalogRepo(join(k, 'repo', 'lib', 'sub', 'a')), join(k, 'repo', 'lib', 'sub'))
    assert.equal(katalogRepo(''), null)
    assert.equal(katalogRepo(join(k, 'repo', 'docs', 'active', 'z')), join(k, 'repo'))
    assert.equal(katalogRepo(join(k, 'wt', 'src')), join(k, 'wt'))
    assert.equal(katalogRepo(join(k, 'repo')), join(k, 'repo'))
    assert.equal(katalogRepo(null), null)
    assert.equal(katalogRepo('/nie/ma/takiego/katalogu-p22'), null)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('projekt runu: agent w repo A i sesja w repo B → A; agent w scratchpadzie sesji → projekt sesji; bez repo — nazwa cwd sesji', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const baza = mkdtempSync(join(tmpdir(), 'telemetria-repo-'))
    try {
      for (const r of ['repo-a', 'repo-b']) mkdirSync(join(baza, r, '.git'), { recursive: true })
      const katalogSesji = join(projekty, '-Users-u-Kodowanie-projekt')
      const run = join(katalogSesji, 'sesja-1', 'subagents', 'workflows', 'wf_aaa-111')
      const agenci = readdirSync(run).filter((x) => x.startsWith('agent-') && x.endsWith('.jsonl'))
      const ustaw = (/** @type {string} */ cwdAgenta, /** @type {string} */ cwdSesjiGlownej) => {
        for (const n of agenci) writeFileSync(join(run, n), readFileSync(join(run, n), 'utf8').replace(/"cwd":"[^"]*"/g, `"cwd":${JSON.stringify(cwdAgenta)}`))
        const s = join(katalogSesji, 'sesja-1.jsonl')
        writeFileSync(s, readFileSync(s, 'utf8').replace(/"cwd":"[^"]*"/g, `"cwd":${JSON.stringify(cwdSesjiGlownej)}`))
        rmSync(plik, { force: true })
        zbierzWszystko({ projekty, plik, bledy, terazMs: TERAZ, szybko: false, sesjeWToku: new Set(), pominSesje: new Set() })
        return odczytajRekordy(plik).ostatnie.get('wf_aaa-111|run|wf_aaa-111')?.projekt
      }
      assert.equal(ustaw(join(baza, 'repo-a', 'docs', 'active', 'z'), join(baza, 'repo-b')), 'repo-a')
      const scratchpad = join(baza, 'tmp', 'claude-501', 'slug', 'sesja', 'scratchpad', 'kopia')
      mkdirSync(join(scratchpad, '.git'), { recursive: true })
      assert.equal(ustaw(scratchpad, join(baza, 'repo-b', 'src')), 'repo-b', 'kopia w scratchpadzie znika — projekt sesji od razu')
      assert.equal(ustaw('/nie/ma/x', '/nie/ma/sesja-projekt'), 'sesja-projekt')
    } finally {
      rmSync(baza, { recursive: true, force: true })
    }
  })
})
