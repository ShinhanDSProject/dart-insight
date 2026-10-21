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
uvicorn app.main:app --reload --port 8000
```

상태 확인: <http://localhost:8000/health> 가 `{"status":"UP"}`를 돌려주면 정상입니다.

## 검사

```bash
ruff check .                       # 린트
pytest                             # 테스트
```

## 폴더

```text
app/        애플리케이션 코드
tests/      테스트
```
