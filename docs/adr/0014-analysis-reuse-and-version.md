# ADR-0014: 같은 조건의 분석 결과는 재사용하고, 결과가 달라지는 규칙을 바꾸면 분석 버전을 올린다

- 상태: 채택
- 결정한 날: 2026-10-22
- 관련: [PR #86](https://github.com/ShinhanDSProject/dart-insight/pull/86)(4.3), [PR #102](https://github.com/ShinhanDSProject/dart-insight/pull/102)(2.5), [PR #108](https://github.com/ShinhanDSProject/dart-insight/pull/108)(5.5), `Analysis.CURRENT_VERSION`, 노션 개발 기준 7장

## 맥락

- 같은 보고서 쌍을 여러 사람이 여러 번 분석합니다. 매번 새로 하면 OpenDART 한도와 LLM 비용을 씁니다.
- 공시는 정정 공시가 새 접수번호로 나오는 것 말고는 바뀌지 않으므로, 입력이 같으면 결과를 다시 쓸 수 있습니다.
- 하지만 파서·비교·우선순위·프롬프트·표현 규칙을 고친 뒤에 옛 결과를 다시 쓰면 규칙이 다른 결과가 섞입니다.
- 이 규칙들은 backend와 ai-server 두 곳에 있습니다.

## 결정

- 분석은 기업·현재 접수번호·이전 접수번호·비교 기준·분석 버전(`analysis_version`)으로 식별합니다.
- 같은 조건에 완료된 결과가 있으면 새로 만들지 않고 돌려줍니다. 다만 문장 비교가 실패로 끝난 결과는 다시 쓰지 않습니다(일시 장애였으면 다시 요청해 원문을 비교할 수 있게).
- 분석 버전은 backend `Analysis.CURRENT_VERSION`(지금 `m2-4`) 하나입니다. 아래 중 하나라도 결과가 달라지게 바뀌면 이 값을 올립니다.
  - backend: 재무 비교·계산 규칙, 요약 대상 선택·사실 문장
  - ai-server: `PARSER_VERSION`, `DIFF_VERSION`, `PRIORITY_VERSION`, `PROMPT_VERSION`, `RULESET_VERSION`
- ai-server의 각 버전 상수 옆에 "결과가 달라지게 바꾸면 이 버전과 backend `Analysis.CURRENT_VERSION`을 함께 올린다"는 주석을 둡니다. 원문 구조화 결과는 따로 파서 버전을 저장해, 버전이 다르면 다시 구조화합니다([ADR-0009](0009-document-structure-and-evidence-id.md)).

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 재사용하지 않고 매번 새로 분석 | OpenDART 한도와 LLM 비용을 반복해서 씁니다. |
| 시간 기준으로 만료(TTL) | 규칙이 바뀐 것을 잡지 못하고, 바뀌지 않은 결과를 괜히 다시 만듭니다. |
| ai-server가 각 모듈 버전을 알려 주고 backend가 자동으로 비교 | 가장 안전하지만, 분석을 찾을 때마다 ai-server를 불러야 하고 키가 길어집니다. MVP에서는 버전 하나와 주석·PR 확인으로 관리합니다. |

## 결과

- 좋아지는 점: 같은 분석은 바로 결과를 보여 주고, 규칙이 다른 결과가 섞이지 않습니다.
- 감수하는 점: 버전 올리기를 잊으면 옛 결과가 다시 쓰입니다. 버전을 올리면 그 뒤의 요청은 모두 처음부터 다시 분석해 한도와 비용을 씁니다.
- 지켜야 할 것: 결과에 영향을 주는 규칙을 바꾸는 PR은 해당 모듈 버전과 `Analysis.CURRENT_VERSION`을 같은 PR에서 올리고, PR 본문에 적습니다.

## 다시 볼 때

- 버전 올리기를 잊어 옛 결과가 다시 쓰인 일이 생길 때(자동 비교로 바꿈)
- 실제 LLM 제공자를 연결해 같은 입력에도 결과가 달라질 수 있을 때
