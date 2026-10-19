# ai-server

공시레이더 AI 서버. OpenDART 수집, 원문 파싱, LLM 분석을 맡는다.

## 개발환경 설정

1. [uv](https://docs.astral.sh/uv/) 설치
2. 의존성 설치 (Python 3.12가 없으면 uv가 자동으로 받는다)
   ```bash
   cd ai-server
   uv sync
   ```
3. 환경변수 설정
   ```bash
   cp .env.example .env
   ```
   `.env`의 `DART_API_KEY`에 본인 OpenDART 인증키를 넣는다. 인증키는 팀원끼리 공유하지 않고 각자 발급받는다(OpenDART 약관 제19조②).
4. 인증키 확인
   ```bash
   uv run python scripts/check_dart_key.py
   ```

## 테스트

```bash
uv run pytest
```
