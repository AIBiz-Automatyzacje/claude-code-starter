#!/usr/bin/env python3
"""Odtwarza wyniki agentow z journal.jsonl workflowu (wpisy started -> result po agentId)
do jednego JSON + czytelnych .txt per agent.
Uzycie: journal_do_json.py <katalog_wf> <plik_wyj.json> [katalog_txt]"""
import json, os, sys

wf_dir, out_json = sys.argv[1], sys.argv[2]
txt_dir = sys.argv[3] if len(sys.argv) > 3 else None
etykiety, wyniki = {}, {}
with open(os.path.join(wf_dir, 'journal.jsonl'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        if rec.get('type') == 'started':
            etykiety[rec['agentId']] = rec.get('label') or rec['agentId']
        elif rec.get('type') == 'result':
            wyniki[etykiety.get(rec['agentId'], rec['agentId'])] = rec.get('result')
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(wyniki, f, ensure_ascii=False, indent=1)
print(f"zapisano {len(wyniki)} wynikow -> {out_json}")
if txt_dir:
    os.makedirs(txt_dir, exist_ok=True)
    for label, w in wyniki.items():
        p = os.path.join(txt_dir, label.replace(':', '-').replace('/', '_') + '.txt')
        with open(p, 'w', encoding='utf-8') as f:
            f.write(json.dumps(w, ensure_ascii=False, indent=1))
        print(' ', p)
