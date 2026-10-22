# ADR-0002: 세 서비스를 한 저장소에 두고 React → Spring Boot → FastAPI로만 부른다

- 상태: 채택
- 결정한 날: 2026-10-21
- 관련: [PR #43](https://github.com/ShinhanDSProject/dart-insight/pull/43), [PR #70](https://github.com/ShinhanDSProject/dart-insight/pull/70)(0.1), [PR #74](https://github.com/ShinhanDSProject/dart-insight/pull/74)(0.5), 노션 개발 기준 3장

## 맥락

- 화면(React), 서비스 API(Spring Boot), AI 처리(Python)를 각각 맡는 역할로 팀을 나눴습니다(백엔드 2, AI 2, 프론트 1, 인프라 1).
- 기능 하나가 세 서비스에 걸칩니다. 예를 들어 문장 변경 탐지는 backend의 원문 받기·저장, ai-server의 비교, 화면의 목록·근거 표시가 함께 바뀝니다.
- 4주 안에 끝내야 하고, OpenDART 키·LLM 비용·에러 형식·추적 ID를 여러 곳에서 따로 관리할 여유가 없습니다.

## 결정

- 저장소 하나에 `frontend/`(React + TypeScript), `backend/`(Spring Boot), `ai-server/`(FastAPI)를 둡니다. CI는 바뀐 폴더의 서비스만 검사합니다(`.github/workflows/`).
- 호출 방향은 React → Spring Boot → FastAPI 하나뿐입니다.
  - 화면은 Spring Boot의 `/api/**`만 부릅니다(`VITE_API_BASE_URL`). FastAPI나 OpenDART를 직접 부르지 않습니다.
  - Spring Boot는 FastAPI의 `/internal/**`를 부릅니다(`AiServerClient`). FastAPI는 다른 서비스를 부르지 않습니다.
- DB에 쓰는 것은 backend뿐입니다. ai-server는 받은 입력을 처리해 결과를 돌려주고, DB에 직접 연결하지 않습니다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 서비스마다 저장소를 따로 두기 | 세 서비스에 걸친 기능을 PR 하나로 검토할 수 없고, 서비스 사이 API 버전을 따로 맞춰야 합니다. |
| 화면이 FastAPI를 직접 부르기 | 에러 형식·추적 ID·캐시·접근 제어가 두 곳으로 나뉘고, LLM 호출과 비용을 한곳에서 통제하기 어렵습니다. |
| ai-server도 DB에 직접 쓰기 | 스키마를 두 서비스가 함께 바꾸게 되고, 분석 완료와 결과 저장을 한 트랜잭션으로 묶을 수 없습니다([ADR-0004](0004-async-analysis-job.md)). |
| 백엔드를 Python 하나로 만들기 | 팀의 역할 구성과 학습 목표(Spring Boot)에 맞지 않습니다. |

## 결과

- 좋아지는 점: 기능 하나를 PR 하나로 검토합니다. 외부에 열리는 곳이 Spring Boot 하나라 에러 형식·추적 ID·키 관리가 한곳에 모입니다.
- 감수하는 점: ai-server를 쓰는 기능은 내부 호출을 한 번 더 거칩니다. 내부 API도 `docs/api-spec.md`에 적어 두고 맞춰야 합니다.
- 지켜야 할 것: 새 기능도 이 호출 방향을 따릅니다. ai-server가 데이터를 저장해야 할 것 같으면 결과를 돌려주고 backend가 저장합니다.

## 다시 볼 때

- ai-server가 OpenDART나 DB를 직접 써야만 하는 기능이 생길 때
- 서비스를 따로 배포·확장해야 할 만큼 부하가 달라질 때
