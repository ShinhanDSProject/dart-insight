# ai-server (FastAPI)

원문 파싱·구조화, 문장 변경 탐지, 요약·설명을 맡습니다. backend(Spring Boot)만 이 서버를 부릅니다.

| 항목 | 값 |
| --- | --- |
| Python | 3.12 |
| 웹 프레임워크 | FastAPI |
| 포트 | 8000 |

## 실행

```bash
cd ai-server
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env               # 값 채우기 (커밋하지 않음)
uvicorn app.main:app --reload --port 8000 --env-file .env
```

상태 확인: <http://localhost:8000/health> 가 `{"status":"UP"}`를 돌려주면 정상입니다.

## 검사

```bash
ruff check .                       # 린트
pytest                             # 테스트
```

## LLM 호출 (0.7)

LLM은 `app/llm`의 `LlmClient`를 거쳐서만 부릅니다. 다른 코드에서 LLM SDK를 직접 가져오지 않습니다.

- 제공자는 `LLM_PROVIDER`로 고릅니다. 지금은 `fake`(가짜 응답)만 있고, 실제 제공자는 결정 로그가 정해지면 `app/llm/providers.py`에 더합니다.
- 결과는 JSON으로 받아 부른 쪽이 넘긴 검사 함수로 확인합니다. 통과하지 못하면 문제를 알려 주며 최대 2회 다시 생성하고, 그래도 실패하면 `LlmOutputInvalid`로 끝납니다.
- 시간 초과·네트워크 같은 일시 오류는 `LLM_MAX_RETRIES`번 다시 시도하고, 끝내 실패하거나 제공자가 없으면 `LlmUnavailable`입니다.
- 요청 하나에 쓰는 전체 시간은 `LLM_TOTAL_TIMEOUT_SECONDS`(기본 120초)까지입니다. backend가 AI 서버를 기다리는 시간(180초)보다 짧게 두어, 시간이 다 돼도 호출 기록이 backend에 돌아가게 합니다.
- 호출마다 제공자·모델·프롬프트 버전·호출 시각·토큰 수·추적 ID·걸린 시간·결과를 로그(`app.llm`)와 `CallRecord`로 남깁니다.
- 공시 원문은 `app.llm.prompting.disclosure`로 감싸 넣습니다. 원문은 지시가 아니라 자료입니다.

## 폴더

```text
app/api/    내부 API(backend만 부름)
app/core/   설정, 공통 에러, 추적 ID
app/llm/    LLM 호출 모듈
tests/      테스트
```
