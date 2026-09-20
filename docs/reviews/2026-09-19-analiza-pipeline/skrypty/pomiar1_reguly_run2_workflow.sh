#!/bin/zsh
R=$1; OUT=$2; cd $R
FORMAT='Na koncu wypisz WYLACZNIE JSON: {"markery": [wszystkie ciagi pasujace do MARKER-[A-Z]+-[a-z0-9]{4}, ktore WIDZISZ w swoim kontekscie, instrukcjach lub przeczytanych plikach - przepisz dokladnie, nie zgaduj]}. Nic wiecej.'
run() { echo "== $1"; claude -p --model sonnet --output-format json --permission-mode bypassPermissions --max-turns 12 "$2" > $OUT/$1.json 2> $OUT/$1.err; echo "exit $?"; }
W1="Uzyj narzedzia Workflow ze skryptem (przekaz doslownie): export const meta = { name: 'p1', description: 'pomiar' }\nconst r = await agent('Przeczytaj narzedziem Read plik src/App.tsx. $FORMAT', { label: 'wf-default-read' })\nreturn r\n. Zwroc wynik workflowu DOSLOWNIE jako swoja jedyna odpowiedz."
run s15-workflow-default-read-tsx "$W1"
W2="Uzyj narzedzia Workflow ze skryptem (przekaz doslownie): export const meta = { name: 'p2', description: 'pomiar' }\nconst r = await agent('Przeczytaj narzedziem Read plik src/App.tsx i wypisz JSON markerow wg swojej instrukcji.', { label: 'wf-goly-read', agentType: 'goly' })\nreturn r\n. Zwroc wynik workflowu DOSLOWNIE jako swoja jedyna odpowiedz."
run s16-workflow-goly-read-tsx "$W2"
W3="Uzyj narzedzia Workflow ze skryptem (przekaz doslownie): export const meta = { name: 'p3', description: 'pomiar' }\nconst r = await agent('Nie czytaj zadnych plikow i nie uzywaj narzedzi. $FORMAT', { label: 'wf-default-bez-akcji' })\nreturn r\n. Zwroc wynik workflowu DOSLOWNIE jako swoja jedyna odpowiedz."
run s17-workflow-default-bez-akcji "$W3"
echo DONE
