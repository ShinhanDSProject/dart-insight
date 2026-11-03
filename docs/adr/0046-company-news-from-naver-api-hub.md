# ADR-0046: 기업 뉴스는 NAVER API HUB 뉴스 검색으로 받아 backend가 기업별 30분 메모리 캐시로 두고, 화면에만 보이며 AI에는 넣지 않는다

- 상태: 채택
- 결정한 날: 2026-11-03
- 관련: #592

## 맥락

분석 결과 화면에 그 기업의 최신 뉴스를 보이기로 했다(#592). 뉴스 원문 사이트를 직접 긁어 오는 방법은 약관·저작권 문제가 있고 사이트 구조가 바뀌면 깨진다.

- 네이버 개발자센터의 검색 API는 2026-07 말 신규 신청이 중단됐고, 신규 신청은 네이버 클라우드의 NAVER API HUB에서만 된다. 2026-11-03 개발자센터의 기존 애플리케이션(소셜 로그인)에 검색을 더하려 하면 '신규로 등록할 수 없는 API'로 거절됐다.
- NAVER API HUB 뉴스 검색: `GET https://naverapihub.apigw.ntruss.com/search/v1/news`, 헤더 `X-NCP-APIGW-API-KEY-ID`·`X-NCP-APIGW-API-KEY`, 파라미터 `query`·`display`(1~100)·`start`·`sort`(`sim`·`date`). 응답 `items`의 `title`·`originallink`·`link`·`description`·`pubDate`(RFC 822, 예 `Thu, 11 Jun 2026 18:34:00 +0900`). 일치한 낱말은 `<b>`로 감싸 온다. 언론사 이름 필드는 없다. 하루 25,000회([개발 가이드](https://api.ncloud-docs.com/docs/naver-api-hub-search-news), 2026-11-03 확인).
- 네이버는 2026-09-07부터 검색 결과를 AI에 넣거나 학습·노출에 쓰는 것을 약관으로 금지했다.
- 우리 규칙: React는 Spring Boot만 부르고, 외부 호출은 backend가 하며 같은 요청을 반복하지 않는다. 키는 `.env`에만 둔다.

## 결정

- 뉴스는 NAVER API HUB 뉴스 검색으로 받는다. 키는 `NAVER_SEARCH_CLIENT_ID`·`NAVER_SEARCH_CLIENT_SECRET`(`app.naver-search.*`, `news/config/NaverSearchProperties`). 소셜 로그인 키와 따로 둔다.
- backend `news` 패키지가 부른다(`news/client/NaverNewsClient`, 경로는 `NaverSearchPaths`). 회사 이름을 검색어로 최신순(`sort=date`) 100건(한 번에 받을 수 있는 최대)을 받아, 태그·HTML 엔티티를 뺀 제목에 회사 이름(공백 무시)이 있는 기사만 앞에서 10건 쓴다(`news/domain/NewsArticle`, `news/service/CompanyNewsService`). 링크는 `originallink`(없으면 `link`), 언론사는 그 링크의 도메인으로 보인다.
- 캐시는 backend 메모리에 기업별로 30분 둔다(`news/service/CompanyNewsService`, `app.naver-search.cache-ttl`). 뉴스 자체는 DB에 저장하지 않는다(부른 횟수만 센다). 키가 없거나 호출·응답이 잘못되면 503 `COMPANY_NEWS_UNAVAILABLE`이고 실패는 캐시하지 않는다. 캐시는 넣을 때 30분 지난 기업을 지운다(`news/domain/CompanyNewsCache`).
- 뉴스 API는 로그인 없이 열려 있어 여러 기업을 돌아가며 부르면 공용 키의 하루 한도를 다 쓸 수 있다. 하루에 네이버를 부르는 횟수를 한도보다 낮은 20,000회로 막는다(`app.naver-search.daily-budget`, 한국 시간 날짜마다). backend를 다시 켜도 이어 세도록 횟수는 DB `news_call_usage`(날짜마다 한 행, `V46`)에 두고, 조건부 UPDATE(`call_count < 한도`) 한 번으로 원자적으로 센다(`news/repository/NewsCallUsageStore`). 다 쓰면 캐시가 없는 요청은 부르지 않고 503이다. 요청자별 제한은 두지 않는다(로그인 없는 API라 요청자별 제한만으로는 전체 사용량을 막지 못하고, 앱에 요청자별 제한 장치가 없음).
- 뉴스는 화면 목록에만 쓴다. 요약·AI 질문·에이전트 채팅 등 LLM에 넣지 않는다. 화면에 '외부 뉴스 · 공시 근거 아님'을 붙인다.
- API: `GET /api/companies/{corpCode}/news`(`docs/api-spec.md`).

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 뉴스 사이트를 직접 긁어 오기(크롤링) | 약관·저작권 문제, 사이트 구조가 바뀌면 깨지고 차단될 수 있음 |
| 네이버 개발자센터 검색 API | 2026-07 말 신규 신청 중단. 기존 애플리케이션에도 더할 수 없음 |
| 구글 뉴스 RSS | 공식 API가 아니라 언제든 바뀔 수 있고, 링크가 구글을 거침 |
| 뉴스를 DB에 저장(테이블) | 30분이면 지나가는 목록이라 저장할 이유가 없음. 서버를 여러 대 띄우면 다시 봄 |
| 하루 횟수를 메모리에만 세기 | backend를 같은 날 다시 켜면 0부터 다시 세어 한도를 지키지 못함 |

## 결과

- 좋아지는 점: 공식 API라 약관 문제가 없고, 키 하나로 하루 25,000회 안에서 충분하다. 30분 캐시로 같은 기업을 여러 번 열어도 네이버를 한 번만 부른다.
- 감수하는 점: 서버를 다시 켜면 캐시가 비고, 서버가 여러 대면 대마다 따로 부른다. 회사 이름이 짧거나 흔하면(예: 두 글자) 다른 뜻의 기사가 섞일 수 있다. NAVER API HUB가 유료로 바뀌면 비용이 생길 수 있다. 키가 한 사람의 네이버 클라우드 계정에 묶인다.
- 지켜야 할 것: 뉴스 제목·요약을 LLM 프롬프트에 넣지 않는다. 키를 로그·예외 메시지에 남기지 않는다. 기사 본문은 받거나 보이지 않고 원문 링크로만 보낸다.

## 다시 볼 때

- 서버를 두 대 이상 띄울 때(캐시를 DB나 공용 캐시로)
- NAVER API HUB 요금 정책이 바뀔 때
- 뉴스를 AI에 쓰고 싶어질 때(네이버 약관을 다시 확인)
