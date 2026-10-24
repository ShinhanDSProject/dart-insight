# ADR-0021: 문장 변경에서 숫자만 바뀐 수정과 자리만 옮긴 글을 따로 분류한다

- 상태: 채택
- 결정한 날: 2026-10-25
- 관련: [#150](https://github.com/ShinhanDSProject/dart-insight/issues/150)(2.5), [ADR-0010](0010-rule-based-text-diff.md)(대체), [ADR-0014](0014-analysis-reuse-and-version.md), `ai-server/app/compare/text_diff.py`, `ai-server/app/compare/priority.py`, AI 레이어 설계 v2 4.3

## 맥락

- ADR-0010의 규칙은 숫자만 바뀐 수정을 `MODIFIED` + `numbers_only` 플래그로만 구분했습니다. 목록의 유형 거르기·건수가 `change_type` 기준이라 숫자만 바뀐 수정을 따로 보거나 빼기 어려웠습니다.
- 같은 글을 다른 섹션으로 옮기거나 같은 섹션 안에서 순서만 바꾸면 `DELETED`·`ADDED` 두 건으로 잡혀, 내용이 바뀌지 않았는데 빠지고 새로 들어간 것처럼 보였습니다.
- 이미 저장된 분석 결과(`m2-8`까지)는 그대로 남고, 같은 화면·API로 읽힙니다.

## 결정

ADR-0010의 결정을 그대로 두고, 블록 분류만 아래처럼 바꿉니다.

- 문장·표 변경 탐지는 ai-server `text_diff.py`(`DIFF_VERSION` `text-diff-2`)가 `difflib` 기반 규칙으로 합니다. LLM을 쓰지 않습니다.
  - 섹션 짝짓기는 ADR-0010과 같습니다.
  - 블록은 숫자를 가린 글로 자리를 맞춥니다. 짝지은 두 블록의 숫자를 가린 글이 같으면 `NUMERIC_UPDATE`, 그 밖에 다르면 `MODIFIED`입니다.
  - 문서 전체의 `DELETED`·`ADDED` 중 블록 종류가 같고 숫자를 가린 글이 같거나 비슷한 정도가 `MOVED_SIMILAR`(0.95) 이상이면서 다른 부분이 모두 띄어쓰기·문장부호뿐인(`formatting_only_differs`) 것을 한 쌍씩 `MOVED` 하나로 바꿉니다. 같은 섹션 안의 순서 바뀜과 다른 섹션으로의 이동을 구분하지 않고 같은 유형으로 둡니다. 숫자를 가린 글이 `MOVED_MIN_CHARS`(20자)보다 짧은 블록은 짝짓지 않고, 비교 횟수에 상한(`_MOVED_BUDGET`)을 둡니다.
  - `MOVED`는 이전·현재 위치를 둘 다 가지고, 이전 쪽 섹션 경로(`previousSectionPath`)를 따로 돌려줍니다. backend는 이를 `text_change.previous_section_path`에 저장합니다.
- `numbers_only`는 지우지 않습니다. 새 결과에서는 `numbers_only = (change_type = 'NUMERIC_UPDATE')`이고, 옛 결과(`MODIFIED` + true)와 API `numbersOnly`를 읽는 쪽을 위해 남깁니다.
- 확인 우선순위(`PRIORITY_VERSION` `priority-2`)는 두 유형을 낮게 둡니다(숫자만 바뀜 −20, 위치 이동 −20). backend `SummarySelector.text()`는 두 유형을 요약 대상에서 뺍니다.
- 결과가 달라지므로 `DIFF_VERSION`·`PRIORITY_VERSION`과 backend `Analysis.CURRENT_VERSION`(`m2-9`)을 함께 올립니다([ADR-0014](0014-analysis-reuse-and-version.md)).

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| `MODIFIED` + `numbers_only` 플래그를 그대로 두고 화면에서만 따로 거르기 | 유형 거르기·건수·요약 선택·우선순위가 모두 `change_type` 기준이라, 플래그 조건을 여러 곳에 따로 넣어야 합니다. |
| 같은 섹션 안 순서 바뀜(`REORDERED`)과 다른 섹션 이동(`MOVED`)을 다른 유형으로 | 사용자에게는 둘 다 '내용은 그대로, 자리만 바뀜'이고, 섹션 경로 두 개로 이미 구분할 수 있습니다. 유형이 늘면 필터만 복잡해집니다. |
| 임베딩 유사도로 옮긴 글 찾기 | ADR-0010과 같은 이유(숫자만 바뀐 글 구분이 어렵고, 왜 짝지었는지 설명하기 어려움)로 규칙 비교를 씁니다. |
| `numbers_only` 컬럼 지우기 | 옛 분석 결과 행이 `MODIFIED` + true로 남아 있어, 지우면 옛 결과의 '숫자만 바뀜' 표시를 잃습니다. |

## 결과

- 좋아지는 점: 숫자만 바뀐 수정과 자리만 옮긴 글을 실제 내용 변경과 따로 거르고 셀 수 있습니다. 옮긴 글이 빠지고 새로 들어간 것처럼 보이지 않습니다.
- 감수하는 점: 비슷한 정도 0.95는 실제 원문으로 더 조정해야 합니다. 짧은 상투 문구(20자 미만)는 옮겨도 `DELETED`·`ADDED`로 남습니다. 옛 결과(`m2-8`까지)는 다시 분석하기 전까지 옛 분류로 보입니다.
- 지켜야 할 것: 새 유형을 읽는 곳(유형 목록, 건수, 요약 선택, 근거 확인, 질문 후보, 화면 이름표)은 `NUMERIC_UPDATE`·`MOVED`를 함께 다룹니다. 옛 결과의 `MODIFIED` + `numbersOnly: true`도 계속 '숫자만 바뀜'으로 보여 줍니다.

## 다시 볼 때

- 정답 자료(7.5)로 평가한 위치 이동 정확도가 낮을 때(기준값 조정)
- 표 셀 단위 비교를 할 때(숫자만 바뀐 표의 분류가 달라짐)
