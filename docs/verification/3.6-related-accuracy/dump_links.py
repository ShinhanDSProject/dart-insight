# 분석마다 모든 문장 변경의 관련 수시공시를 받아 links-<aid>.json으로 저장하고 요약을 찍는다
# backend 주소는 환경변수 BACKEND_URL(기본 http://localhost:8080), 기대하는 규칙 버전은 RULE_VERSION(기본 related-2)
# UNAVAILABLE·partial 응답이나 다른 규칙 버전이 섞이면 측정에 쓰지 않도록 알리고 실패 코드로 끝낸다(다시 실행하면 저장된 결과를 다시 씀)
import json, os, sys, urllib.request, collections
BASE = os.environ.get('BACKEND_URL', 'http://localhost:8080').rstrip('/') + '/api/analyses'
EXPECTED_VERSION = os.environ.get('RULE_VERSION', 'related-2')
def get(url):
    return json.load(urllib.request.urlopen(url, timeout=300))
incomplete = False
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
    strong = [l for l in links if l[1]['matchLevel'] == 'STRONG']
    rules = collections.Counter(i['matchRule'] for _, i in links)
    discs = {i['rceptNo'] for _, i in links}
    st = collections.Counter(r['related']['status'] for r in rows)
    partial = sum(1 for r in rows if r['related'].get('partial'))
    versions = collections.Counter(r['related'].get('ruleVersion') for r in rows)
    print(f"[{aid}] changes={len(rows)} status={dict(st)} partial={partial} ruleVersion={dict(versions)} "
          f"links={len(links)} distinctDisclosures={len(discs)} strong={len(strong)} rules={dict(rules)}")
    if st['UNAVAILABLE'] or partial or set(versions) != {EXPECTED_VERSION}:
        incomplete = True
        print(f'[{aid}] 완전하지 않은 응답이 있습니다(UNAVAILABLE {st["UNAVAILABLE"]}, partial {partial}, '
              f'기대 규칙 버전 {EXPECTED_VERSION}). 이 결과로 채점표를 만들지 말고 다시 실행해 주세요.')
if incomplete:
    sys.exit(1)
