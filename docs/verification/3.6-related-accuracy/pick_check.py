# AI 판정을 사람이 확인할 20줄을 고른다(시드 345). 내용 일치 O·X 3줄씩, 같은 종류 O 3줄·X 7줄, 재현율에서 관련 공시가 있던 4줄
import csv, random
J = '판정(O 관련 있음 / X 없음 / ? 모름)'
rnd = random.Random(345)
p = list(csv.DictReader(open('precision.csv', encoding='utf-8-sig')))
def take(cond, n):
    pool = [r for r in p if cond(r)]
    return sorted(rnd.sample(pool, min(n, len(pool))), key=lambda r: r['번호'])
picked = (take(lambda r: r['연결 강도'] == 'STRONG' and r[J] == 'O', 3)
          + take(lambda r: r['연결 강도'] == 'STRONG' and r[J] == 'X', 3)
          + take(lambda r: r['연결 강도'] == 'TYPE_ONLY' and r[J] == 'O', 3)
          + take(lambda r: r['연결 강도'] == 'TYPE_ONLY' and r[J] == 'X', 7))
out = [{'번호': r['번호'], '변경 글(앞부분)': r['변경 글(앞부분)'], '서비스가 붙인 공시': f"{r['접수번호']} {r['공시명']} ({r['연결 강도']})",
        'AI 판정': r[J], 'AI 근거': r['메모'], 'DART': r['DART'], '앱에서 보기': r['앱에서 보기']} for r in picked]
F = '붙인 것 중 관련 있는 접수번호(쉼표, 없으면 없음)'
M = '놓친 관련 접수번호(쉼표, 없으면 없음)'
for r in csv.DictReader(open('recall.csv', encoding='utf-8-sig')):
    if (r[F] != '없음' or r[M] != '없음') and r['번호'] != 'R4-080':  # R4-080은 R4-077과 같은 판단이라 뺌
        out.append({'번호': r['번호'], '변경 글(앞부분)': r['변경 글(앞부분)'], '서비스가 붙인 공시': r['서비스가 붙인 공시'][:300],
                    'AI 판정': f'붙인 것 중 관련: {r[F]} / 놓친 것: {r[M]}', 'AI 근거': r['메모'], 'DART': '', '앱에서 보기': r['앱에서 보기']})
for r in out:
    r['사람 판정(같음 / 다름)'] = ''; r['다르면 이유'] = ''
with open('ai-check.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
for r in out: print(r['번호'], r['AI 판정'], '|', r['AI 근거'][:70])
print(len(out))
