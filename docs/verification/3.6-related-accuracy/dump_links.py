# 분석마다 모든 문장 변경의 관련 수시공시를 받아 links-<aid>.json으로 저장하고 요약을 찍는다
import json, sys, urllib.request, collections
BASE = 'http://localhost:8080/api/analyses'
def get(url):
    return json.load(urllib.request.urlopen(url, timeout=300))
for aid in sys.argv[1:]:
    changes, page = [], 0
    while True:
        d = get(f'{BASE}/{aid}/text-changes?page={page}&size=100')
        changes += d['items']
        if not d.get('hasNext', len(d['items']) == 100): break
        page += 1
    rows = []
    for c in changes:
        r = get(f"{BASE}/{aid}/text-changes/{c['changeId']}/related-disclosures")
        rows.append({'change': c, 'related': r})
    json.dump(rows, open(f'links-{aid}.json', 'w', encoding='utf-8'), ensure_ascii=False)
    found = [r for r in rows if r['related']['status'] == 'FOUND']
    links = [(r['change']['changeId'], i) for r in found for i in r['related']['items']]
    pairs = {(cid, i['rceptNo']) for cid, i in links}
    strong = [l for l in links if l[1]['matchLevel'] == 'STRONG']
    rules = collections.Counter(i['matchRule'] for _, i in links)
    discs = {i['rceptNo'] for _, i in links}
    st = collections.Counter(r['related']['status'] for r in rows)
    print(f"[{aid}] changes={len(rows)} status={dict(st)} links={len(links)} distinctDisclosures={len(discs)} strong={len(strong)} rules={dict(rules)}")
