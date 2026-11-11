# DART Insight 시연 데이터 관리 가이드 (Demo Data Guide)

최종 발표 및 실전 라이브 시연을 위한 시연 데이터의 무결성 검증, 캐시 웜업(Pre-warm), 백업(Export), 복원(Import) 도구 사용법입니다.

---

## 1. 개요 및 빠른 실행

시연 중 외부 API(OpenDART 쿼터 소진, LLM 지연 등)에 의한 장애를 방지하고, **대기 시간 0초(캐시 100% 적재)**의 안정적인 발표 환경을 보장하기 위해 자동화 도구를 제공합니다.

| 용도 | 간편 npm 명령 | 직접 실행 쉘 스크립트 | 설명 |
| :--- | :--- | :--- | :--- |
| **상태 점검** | `npm run demo:check` | `./scripts/seed-demo-data.sh check` | 시연 기업 4곳, 고정 분석 8건, 원문 캐시 및 관리자 계정 점검 |
| **캐시 웜업** | `npm run demo:prewarm` | `./scripts/seed-demo-data.sh prewarm` | 시연 10분 전 주요 URL을 호출해 메모리 및 OS 파일 캐시 웜업 |
| **데이터 백업** | `npm run demo:export` | `./scripts/seed-demo-data.sh export` | 현재 MariaDB 데이터를 `backend/data/demo-seed.sql.gz`로 덤프 |
| **데이터 복원** | `npm run demo:seed` | `./scripts/seed-demo-data.sh import` | 시드 압축 파일에서 MariaDB로 전체 시연 데이터 즉시 복원 |
| **관리자 승격** | `npm run demo:admin` | `./scripts/seed-demo-data.sh admin [이메일]` | 로그인 계정에 `/admin` 운영 콘솔 접근 권한(ADMIN) 부여 |

---

## 2. 시연 고정 데이터 명세

시연 시 아래 4대 기업과 8개 분석 결과를 활용하면 외부 API 호출 없이 저장된 결과로 100% 시연할 수 있습니다.

### 2.1 시연 고정 기업 (4곳)
1. **삼성전자 (`00126380`, 005930)**:
   - 초성(`ㅅㅅㅈㅈ`) 및 종목코드 검색
   - AI 기업 브리핑 (`GENERATED`, 6문장), 회사 전망·계획(7건), 작년 계획 올해 대조(2건)
   - 재무 체크포인트 7개 항목 전부 `OK` (확인해 볼 점 0건)
   - 자기주식취득결정 공시 핵심 수치 (`20260821000616`, 약 15조 원)
2. **에코프로비엠 (`01160363`, 247540)**:
   - 재무 체크포인트 7개 중 **`CHECK` (확인해 볼 점) 5건** (삼성전자 0건과 극명한 대비)
   - 주요사항보고서 유상증자결정 핵심 수치 (`20261013000198`, 신주 990만 주)
   - 헝가리 양극재 공장 약속 대조 (`MENTIONED`)
3. **SK하이닉스 (`00164779`, 000660)**:
   - 삼성전자 vs SK하이닉스 기업 나란히 보기 (`/compare/companies`)
   - 전망 5건, 재무 체크포인트 1건 `CHECK`
4. **KB금융 (`00688996`, 105560)**:
   - 금융업 재무제표 특성(매출액 부재 사유) 및 `[기재정정]` 자동 채택 시연

### 2.2 고정 완료 분석 ID (8건)
- **분석 11**: 에코프로비엠 반기 YOY (`COMPLETED`, 요약 10건, MD&A 원문 근거 하이라이트)
- **분석 10**: 삼성전자 반기 YOY (`COMPLETED`, 요약 10건, 매출액 대비 크기 맥락 `scale`, 종속기업 수 230→309개 변경)
- **분석 8**: 삼성전자 사업보고서 YOY (`COMPLETED`, 연간 1년치 종합 비교, 문장 1,538건)
- **분석 9**: SK하이닉스 반기 YOY (`COMPLETED`, 영업이익 급증 및 유상증자 `STRONG` 수시공시)
- **분석 6**: 에코프로비엠 분기→반기 PREV (`COMPLETED`, 직전 기간 비교 시 누적 금액 제외 도메인 규칙)
- **분석 4**: KB금융 반기 YOY (`COMPLETED`, 원본 대신 최신 기재정정 자동 채택)
- **분석 1**: 삼성전자 반기 (`COMPLETED`, 가드레일 모음: 목표주가 질문 `OUT_OF_SCOPE` 차단)
- **분석 12**: SK하이닉스 1분기 (`textStatus: FAILED`, AI 서버 장애 시 재무 비교 부분 완료 및 Graceful Degradation 실증)

---

## 3. 상세 명령어 안내

### 3.1 상태 점검 (`./scripts/seed-demo-data.sh check`)
```bash
./scripts/seed-demo-data.sh check
```
- 백엔드/AI 서버의 실시간 통신 상태를 확인합니다.
- 공시 원문 압축 파일(`backend/data/documents/*.zip`, 22개)의 보존 여부를 확인합니다.
- 4대 고정 기업의 브리핑·전망·약속대조·체크포인트 캐시가 적재되어 있는지 검사합니다.
- 8대 고정 분석 결과의 상태와 요약 개수를 전수 검사합니다.
- 현재 관리자(ADMIN) 권한이 있는 계정 목록을 표시합니다.

### 3.2 시연 직전 웜업 (`./scripts/seed-demo-data.sh prewarm`)
```bash
./scripts/seed-demo-data.sh prewarm
```
- 발표 5~10분 전에 실행합니다.
- 주요 엔드포인트 25개를 미리 호출해 Spring Boot 영구 캐시 및 OS 파일 시스템 캐시를 메모리에 로드합니다.
- 첫 클릭 시에도 지연 시간 없이 **0.01~0.05초** 만에 즉각 화면이 열립니다.

### 3.3 데이터 내보내기/백업 (`./scripts/seed-demo-data.sh export`)
```bash
./scripts/seed-demo-data.sh export
```
- 현재 DB 상태를 `backend/data/demo-seed.sql.gz` 파일로 안전하게 압축 백업합니다. (약 18MB)

### 3.4 데이터 가져오기/복원 (`./scripts/seed-demo-data.sh import`)
```bash
./scripts/seed-demo-data.sh import
```
- 새로운 컴퓨터나 초기화된 DB 환경에서 단 6초 만에 시연 데이터 전체(11.9만 개 기업, 359개 보고서, 26개 분석 결과)를 완벽하게 복원합니다.
- 복원 직후 자동으로 `check`를 실행하여 무결성을 검증합니다.

### 3.5 관리자 권한 부여 (`./scripts/seed-demo-data.sh admin [이메일]`)
```bash
# 기본 계정(tjdals6695@gmail.com) 승격
./scripts/seed-demo-data.sh admin

# 특정 이메일 승격
./scripts/seed-demo-data.sh admin myemail@shinhan.com
```
- 지정한 계정에 `app_user.role = 'ADMIN'` 권한을 즉시 부여하여 `/admin` 콘솔에 접근할 수 있게 합니다.
