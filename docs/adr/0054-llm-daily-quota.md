# ADR-0054: 매번 LLM을 새로 부르는 요청(질문·에이전트 채팅)은 backend가 호출자별·서비스 전체 하루 횟수로 제한한다

- 상태: 채택
- 결정한 날: 2026-11-05
- 관련: 노션 '프로젝트 마무리 점검(11/5)' 위험 ②, [ADR-0023](0023-grounded-question-answering.md)·[ADR-0029](0029-company-question-answering.md)·[ADR-0044](0044-agent-tools-run-in-backend.md)(제한하는 API), [ADR-0046](0046-company-news-from-naver-api-hub.md)(외부 호출 하루 예산의 앞선 예), `backend/src/main/java/com/dartinsight/llmquota/`

## 맥락

- 분석 질문(`POST /api/analyses/{analysisId}/questions`), 기업 질문(`POST /api/companies/{corpCode}/questions`), 에이전트 채팅(`POST /api/analyses/{analysisId}/chat-messages`)은 로그인 없이 부를 수 있고(SC-1), 부를 때마다 LLM을 새로 부릅니다. 지금은 횟수 제한이 없어 공개 서버에서 한 사람이 반복 호출하면 LLM 비용이 끝없이 늘어납니다.
- 로컬 `llm_call` 기준으로 질문 답 1회는 입력 약 1,800 토큰, 에이전트 계획 1회는 약 5,000 토큰입니다. 브리핑·전망·약속 대조·요약은 보고서·분석마다 한 번만 만들어 저장하므로 비용에 상한이 있습니다.
- 서버는 backend 한 대입니다. 운영 서버는 프록시 뒤에 있지만 backend에 `server.forward-headers-strategy` 설정이 없어 `request.getRemoteAddr()`가 프록시 주소입니다.

## 결정

- 위 세 API의 `POST`만 하루(한국 시간) 횟수를 셉니다. 로그인했으면 회원 ID, 안 했으면 클라이언트 IP가 기준이고, 서비스 전체 합계도 따로 셉니다. 한도는 `app.llm-quota`(`anonymous-per-day` 기본 20, `member-per-day` 기본 100, `total-per-day` 기본 3,000, `enabled` 기본 true)로 바꿉니다.
- 한도를 넘으면 LLM을 부르기 전에 429 `AI_QUOTA_EXCEEDED`로 끝내고, `Retry-After`에 다음 날 0시(한국 시간)까지 남은 초를 줍니다. 로그인하지 않은 사용자가 넘었으면 메시지에 로그인하면 더 쓸 수 있다고 적습니다. 넘은 요청은 세지 않습니다.
- 클라이언트 IP는 요청이 사설망·루프백 주소(프록시)에서 왔을 때만 `X-Forwarded-For`의 첫 주소를 쓰고, 아니면 `getRemoteAddr()`를 씁니다. 앱 전체의 프록시 헤더 처리(`forward-headers-strategy`)는 바꾸지 않습니다(소셜 로그인 주소 등 다른 동작에 영향).
- 횟수는 backend 메모리에 둡니다(`LlmQuotaService`). 재시작하면 0부터 다시 셉니다.
- 컨트롤러는 바꾸지 않습니다. `llmquota/controller/LlmQuotaInterceptor`가 스스로 MVC 인터셉터로 등록돼 세 경로를 막습니다(ArchUnit 계층 규칙상 config가 service를 부를 수 없어 controller 계층에 둠).

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 세 API를 로그인 필수로 바꾸기 | 비로그인으로 분석·근거를 보는 흐름(SC-1)에서 질문이 막힘. 로그인 회원도 무제한이면 비용 문제는 남음 |
| DB에 횟수 저장(`news_call_usage`처럼) | 재시작해도 이어지지만 운영 DB에 되돌릴 수 없는 마이그레이션이 늘고, 요청마다 DB 쓰기가 생김. 서버 한 대·하루 단위라 메모리로 충분 |
| Bucket4j·Redis 같은 레이트 리밋 라이브러리 | 의존성과 운영 구성(Redis)이 늘어남. 지금 필요한 건 하루 횟수 하나 |
| 앱 전체에 `forward-headers-strategy: native` | 클라이언트 IP가 정확해지지만 리다이렉트 주소·스킴 처리까지 바뀌어 배포 담당과 함께 정할 일 |

## 결과

- 좋아지는 점: 공개 서버에서 LLM 비용의 상한이 생김(최대 `total-per-day`회). 비로그인 흐름은 그대로이고, 한도에 걸리면 사유와 다시 쓸 수 있는 시각이 보임.
- 감수하는 점: 재시작하면 횟수가 초기화됨. 같은 사설망(NAT) 뒤 여러 사람은 한 IP로 묶임. `X-Forwarded-For`는 프록시가 덮어쓴다는 전제(운영 nginx 설정 확인 필요).
- 지켜야 할 것: LLM을 매번 새로 부르는 공개 API를 더하면 `LlmQuotaInterceptor`의 경로 목록에 넣는다. 한도 값은 코드가 아니라 설정으로 바꾼다.

## 다시 볼 때

- backend를 두 대 이상 띄울 때(메모리 횟수가 서버마다 따로 셈 → DB·Redis로).
- 유료 요금제(크레딧, 노션 BM)가 생길 때: 회원 한도를 요금제 크레딧으로 대체.
