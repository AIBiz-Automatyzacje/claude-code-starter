# Koszt sesji glownej z transkryptu (jednostki wzgledne jak raport.mjs; jedna odpowiedz API = jeden message.id).
# Uzycie: python3 e5_sesje.py ~/.claude/projects/<slug>/<sesja>.jsonl ...
import json,sys
for p in sys.argv[1:]:
    ids={}
    for l in open(p):
        try: r=json.loads(l)
        except Exception: continue
        m=r.get('message',{})
        if r.get('type')=='assistant' and m.get('usage') and m.get('id'): ids[m['id']]=m['usage']
    j=sum(u.get('input_tokens',0)+1.25*u.get('cache_creation_input_tokens',0)+0.1*u.get('cache_read_input_tokens',0)+5*u.get('output_tokens',0) for u in ids.values())
    mx=max((u.get('input_tokens',0)+u.get('cache_creation_input_tokens',0)+u.get('cache_read_input_tokens',0) for u in ids.values()),default=0)
    print(p.split('/')[-1][:8],f'{j/1e6:.2f} M','tur',len(ids),'ctx max',mx//1000,'k')
