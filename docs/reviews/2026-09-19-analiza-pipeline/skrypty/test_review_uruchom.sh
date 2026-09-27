#!/bin/zsh
# Test review (TEST-REVIEW-PLAN §12 pkt 2) — przebieg FAZAMI: dla każdej fazy (1) kopia + bramki, (2) cztery warianty naraz (sesje headless),
# (3) sędzia (w pilocie dwie permutacje), (4) sceptycy na dopasowanych, (5) skan + koszt z transkryptów i decyzja o następnej fazie.
# URUCHAMIAĆ WYŁĄCZNIE PO ZGODZIE OPERATORA (sesje headless = agenci, koszt).
#
# Użycie:
#   test_review_uruchom.sh proba                      — próba harnessu (2 sesje, ~0,1–0,3 M jedn.): czy `claude -p` czeka na koniec Workflow i czy
#                                                       deny z --settings działa (odczyt pliku z Documents ma być odrzucony)
#   test_review_uruchom.sh pilot                      — fazy pilota po kolei + powtórka b26128d + 2 commity fixa; limit z dane/test-review/koszt-pilota.json (224 M jedn.) po każdej fazie
#   test_review_uruchom.sh faza <etykieta> <zakres>   — jedna faza/commit (etap główny: zakres 50%)
#   test_review_uruchom.sh etap przygotuj             — ZERO agentów: lista jednostek (test_review_etap.py lista), dla każdej nowej jednostki kopia + bramki
#                                                       + skrypty wariantów + klucze sędziego; jednostki pilota (znacznik _faza-ok) pomijane
#   test_review_uruchom.sh etap suchy                 — ZERO agentów: suchy bieg (atrapa agent()) skryptów wariantów 0/A/B/C każdej nowej jednostki,
#                                                       ustawienia deny każdej sesji, licznik limitu na jednostkach pilota
#   test_review_uruchom.sh etap                       — etap główny (HANDOFF 6a pkt 30): 13 faz + commity fixa z dane/test-review/etap.json po kolei,
#                                                       r=1, jedna permutacja sędziego, sceptycy tylko na kluczu 1, limit 300 M (licznik obejmuje jednostki
#                                                       pilota), stan przed-etap/po-etap, metryki --etap
# Wznowienie po przerwaniu = to samo polecenie: faza ze znacznikiem wyniki/<et>/_faza-ok (albo _faza-wypada) jest pomijana, a w fazie
# niedokończonej każdy krok agentów już zrobiony (warianty, sędzia, sceptycy: run completed, sesja bez błędu, zero błędów API u agentów);
# niedokończona próba kroku (limit konta, awaria API) jest przed ponownym startem przenoszona do ~/test-review/odrzucone/ (koszt liczony osobno).
set -uo pipefail
S=${0:A:h}
TR=$HOME/test-review
typeset -A SHA ZAD
SHA=(f-b26128d b26128d294 f-2634b67 2634b6770a f-f3ee433 f3ee433811 f-b26128d-r2 b26128d294 x-411a434 411a43405a x-05dd804 05dd804d0a)
ZAD=(f-b26128d faza-4-tracking-i-widok-oferty f-2634b67 faza-3-konto-i-dashboard f-f3ee433 faza-9c-dokumenty-prawne
     f-b26128d-r2 faza-4-tracking-i-widok-oferty x-411a434 faza-4-tracking-i-widok-oferty x-05dd804 faza-9c-dokumenty-prawne)
PILOT=(f-b26128d f-2634b67 f-f3ee433 f-b26128d-r2 x-411a434 x-05dd804)
ZROBIONE=()
WYPADLE=()   # fazy z przeciekiem (§11: wypadają z wyników; druga taka = STOP)

przygotuj_krok() {   # $1 et, $2 krok, $3 wariant — kod 0: krok zrobiony, pomijam (sesje mają deterministyczne id — drugi start = drugi koszt);
                     # kod 1: do startu, a pozostałości niedokończonej próby (np. limit konta, awaria API) idą do ~/test-review/odrzucone/
  if python3 $S/test_review_sesja.py gotowy $1 $2 $3; then echo "$1 $2 $3: krok zrobiony — pomijam"; return 0; fi
  python3 $S/test_review_sesja.py odrzuc $1 $2 $3; return 1
}

krok_wariantow() {   # $1 et, $2 krok (review|sceptycy); wariant ze zrobionym krokiem jest pomijany (wznowienie fazy po STOP)
  local et=$1 krok=$2 w
  local -a do_startu=()
  for w in 0 A B C; do przygotuj_krok $et $krok $w || do_startu+=($w); done
  for w in $do_startu; do python3 $S/test_review_sesja.py start $et $krok $w & done
  wait
  for w in $do_startu; do python3 $S/test_review_sesja.py zbierz $et $krok $w || echo "UWAGA: brak wyniku $et $krok $w"; done
  krok_kompletny $et $krok 0 A B C
}

krok_kompletny() {   # $1 et, $2 krok, reszta = warianty; kod 2, gdy któryś niedokończony (limit konta, awaria API) — następny krok nie może
                     # startować na niepełnym wejściu (sędzia na puli bez wariantu zostałby potem pominięty przy wznowieniu jako „zrobiony”)
  local et=$1 krok=$2 w; shift 2
  for w in $@; do
    python3 $S/test_review_sesja.py gotowy $et $krok $w || { echo "STOP: $et $krok $w niedokończony — wznowienie tym samym poleceniem (krok idzie od nowa)"; return 2 }
  done
}

przygotuj_jednostke() {   # $1 et — zero agentów: kopia + bramki + skrypty wariantów + klucze sędziego
  local et=$1
  if [[ -z ${SHA[$et]:-} ]]; then   # jednostki etapu głównego: sha i zadanie z dane/test-review/etap.json
    local pola; pola=$(python3 $S/test_review_etap.py pola $et) || return 2
    SHA[$et]=${pola%% *}; ZAD[$et]=${pola#* }
  fi
  [[ -d $TR/kopie/$et ]] || $S/test_review_kopia.sh kopia ${SHA[$et]} $et ${ZAD[$et]} || return 2
  [[ -f $S/../dane/test-review/bramki-$et.json ]] || python3 $S/test_review_bramki.py $et || return 2
  python3 $S/test_review_warianty.py $et >/dev/null || return 2
  python3 $S/test_review_sedzia.py klucze $et || return 2
}

skan_kroku() {   # $1 et, $2 opis kroku; kod skanu: 0 OK, 4 przeciek (§11: faza wypada, przeciek w > 1 fazie = STOP), inny = twardy STOP
  python3 $S/test_review_skan.py $1; local k=$?
  (( k == 0 )) && return 0
  if (( k == 4 )); then
    touch $TR/wyniki/$1/_faza-wypada; WYPADLE+=($1)
    (( ${#WYPADLE} > 1 )) && { echo "STOP §11: przeciek w więcej niż jednej fazie: $WYPADLE"; return 2 }
    echo "PRZECIEK w $1 $2 — faza wypada z wyników (§11), przechodzę do następnej"; return 5
  fi
  echo "STOP §11 $2 $1"; return 2
}

faza() {   # $1 et, $2 zakres limitu; kod 0 = faza zrobiona, 5 = faza wypadła (przeciek), inny = przerwać
  local et=$1 zakres=$2 fix=0 p
  [[ $et == x-* ]] && fix=1
  if [[ -f $TR/wyniki/$et/_faza-ok ]]; then echo "=== $et: zakończona w poprzednim runie — pomijam"; ZROBIONE+=($et); return 0; fi
  if [[ -f $TR/wyniki/$et/_faza-wypada ]]; then echo "=== $et: wypadła w poprzednim runie (przeciek) — pomijam"; WYPADLE+=($et); return 5; fi
  echo "=== $et ($(date '+%H:%M')) ==="
  przygotuj_jednostke $et || return 2
  python3 $S/test_review_skan.py odcisk $et || return 2   # przed pierwszym agentem fazy; przy wznowieniu zostaje ten sprzed fazy
  mkdir -p $TR/wyniki/$et
  krok_wariantow $et review; local kw=$?
  skan_kroku $et "po wariantach" || return $?
  (( kw == 0 )) || return 2
  local -a perm=(1) sedz=(); [[ $zakres == pilot ]] && perm=(1 2)
  for p in $perm; do przygotuj_krok $et sedzia-p$p S || sedz+=($p); done
  for p in $sedz; do python3 $S/test_review_sedzia.py pula $et $p || return 2; done
  for p in $sedz; do python3 $S/test_review_sesja.py start $et sedzia-p$p S & done
  wait
  for p in $sedz; do python3 $S/test_review_sesja.py zbierz $et sedzia-p$p S || return 2; done
  for p in $perm; do krok_kompletny $et sedzia-p$p S || return 2; done
  kw=0
  if (( ! fix )); then
    python3 $S/test_review_sceptycy.py przygotuj $et 1 $([[ $zakres == pilot ]] && echo --klucz2) || return 2
    krok_wariantow $et sceptycy; kw=$?
  fi
  skan_kroku $et "po sędzi/sceptykach" || return $?
  (( kw == 0 )) || return 2
  touch $TR/wyniki/$et/_faza-ok
  ZROBIONE+=($et)
  python3 $S/test_review_wynik.py limit $zakres $ZROBIONE $WYPADLE || return 3
}

case ${1:-} in
proba)
  K=$TR/kopie/f-b26128d; mkdir -p $TR/skrypty/proba $TR/sesje/proba
  # workflow z JEDNYM agentem haiku (kilkanaście s pracy) — workflow bez agentów kończy się natychmiast i nie sprawdza, czy -p czeka na tło
  printf "export const meta = { name: 'test-review-proba', description: 'Proba harnessu: jeden agent haiku', phases: [] }\nconst w = await agent('Policz od 1 do 30, kazda liczbe w osobnej linii, a na koniec napisz GOTOWE. Nie uzywaj narzedzi.', { model: 'haiku', label: 'proba:haiku' })\nreturn { ok: 1, dlugosc: String(w || '').length }\n" > $TR/skrypty/proba/proba.js
  UST=$TR/sesje/proba/ustawienia.json
  python3 -c "import sys; sys.dont_write_bytecode=True; sys.path.insert(0,'$S'); import json, test_review_sesja as T; json.dump(T.ustawienia('f-b26128d'), open('$UST','w'))"
  (cd $K && claude -p "Uruchom narzędzie Workflow z parametrem scriptPath=\"$TR/skrypty/proba/proba.js\" i args={} — wyraźnie zlecam uruchomienie tego workflow. Poczekaj na jego zakończenie i odpowiedz jednym wierszem: RUN <identyfikator> <status> <wynik>. Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu." \
    --model claude-opus-5-5 --effort low --strict-mcp-config --permission-mode bypassPermissions --settings $UST --output-format json --max-budget-usd 2 < /dev/null > $TR/sesje/proba/workflow.out.json)
  (cd $K && claude -p "Przeczytaj narzędziem Read plik /Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/CLAUDE.md i podaj jego pierwszą linię albo dokładny komunikat odmowy." \
    --model claude-opus-5-5 --effort low --strict-mcp-config --permission-mode bypassPermissions --settings $UST --output-format json --max-budget-usd 1 < /dev/null > $TR/sesje/proba/deny.out.json)
  python3 -c "import json; [print(f, '→', str(json.load(open('$TR/sesje/proba/'+f)).get('result'))[:300]) for f in ('workflow.out.json','deny.out.json')]"
  ;;
pilot)
  # stan „przed” zapisany przy przygotowaniu (2026-09-25); „po” porównuje z nim — commity operatora w oferty-online w trakcie pilota też wyjdą w różnicy
  for et in $PILOT; do
    faza $et pilot; k=$?
    (( k == 5 )) && { python3 $S/test_review_wynik.py limit pilot $ZROBIONE $WYPADLE || { echo "PRZERWANE po $et (kod 3)"; break }; continue }
    (( k == 0 )) || { echo "PRZERWANE na $et (kod $k)"; break }
  done
  $S/test_review_kopia.sh stan po
  python3 $S/test_review_wynik.py metryki $ZROBIONE
  ;;
faza) faza $2 $3 ;;
etap)
  D=$S/../dane/test-review
  python3 $S/test_review_etap.py lista >/dev/null || { echo "STOP: kontrola listy etapu (dane/test-review/etap.txt)"; exit 2 }
  ETAP=($(python3 -c "import json; print(' '.join(j['et'] for j in json.load(open('$D/etap.json'))))"))
  case ${2:-} in
  przygotuj)
    for et in $ETAP; do
      [[ -f $TR/wyniki/$et/_faza-ok ]] && { echo "$et: zrobiona w pilocie — pomijam"; continue }
      echo "=== przygotuj $et ($(date '+%H:%M'))"
      przygotuj_jednostke $et || { echo "PRZERWANE na $et"; exit 2 }
    done
    python3 $S/test_review_etap.py koszt
    ;;
  suchy)
    for et in $ETAP; do
      [[ -f $TR/wyniki/$et/_faza-ok ]] && { ZROBIONE+=($et); continue }
      for w in 0 A B C; do
        # skrypt i args jak przy starcie sesji + ustawienia deny i bezpiecznik budżetu (liczone, nie zapisywane do sesji)
        wej=("${(@f)$(python3 -c "import sys; sys.dont_write_bytecode=True; sys.path.insert(0,'$S'); import json, test_review_sesja as T
s, a = T.skrypt_i_args('$et', 'review', '$w'); u = T.ustawienia('$et')
print(s); print(json.dumps(a)); print('deny %d, budzet %.2f USD' % (len(u['permissions']['deny']), T.budzet('$et', 'review', '$w')))")}") || { echo "STOP: $et $w wejście sesji"; exit 2 }
        out=$(cd $TR/kopie/$et && node $S/test_review_suchy_bieg.mjs ${wej[1]} ${wej[2]} 2>&1) || { echo "STOP: suchy bieg $et $w"; echo $out; exit 2 }
        n=$(echo $out | sed -n 's/.*agentów \([0-9]*\).*/\1/p' | head -1)
        (( ${n:-0} > 0 )) || { echo "STOP: suchy bieg $et $w bez agentów"; echo $out; exit 2 }
        echo "$et $w: agentów $n | ${wej[3]}"
      done
    done
    python3 $S/test_review_wynik.py limit 50% $ZROBIONE   # licznik limitu na jednostkach pilota (stan wyjściowy etapu)
    ;;
  '')
    [[ -f $D/stan-przed-etap.txt ]] || $S/test_review_kopia.sh stan przed-etap   # przy wznowieniu zostaje stan sprzed pierwszego startu
    for et in $ETAP; do
      faza $et 50%; k=$?
      (( k == 5 )) && { python3 $S/test_review_wynik.py limit 50% $ZROBIONE $WYPADLE || { echo "PRZERWANE po $et (kod 3)"; break }; continue }
      (( k == 0 )) || { echo "PRZERWANE na $et (kod $k)"; break }
    done
    $S/test_review_kopia.sh stan po-etap
    python3 $S/test_review_wynik.py metryki --etap $ZROBIONE
    ;;
  *) sed -n 2,20p $0; exit 1 ;;
  esac
  ;;
*) sed -n 2,20p $0; exit 1 ;;
esac
