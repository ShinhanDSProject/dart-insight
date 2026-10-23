# ADR-0016: backend 도메인 패키지 안을 계층별 하위 패키지로 나누고, 분석 완료 처리는 ArchUnit 규칙으로 보호한다

- 상태: 채택
- 결정한 날: 2026-10-23
- 관련: 이슈 [#175](https://github.com/ShinhanDSProject/dart-insight/issues/175), 선행 [PR #176](https://github.com/ShinhanDSProject/dart-insight/pull/176)(@RequiredArgsConstructor), [ADR-0004](0004-async-analysis-job.md), `backend/conventions.yaml` PKG-1·EN-2

## 맥락

- backend는 도메인별 패키지(`analysis`, `report`, `company`…) 안이 평평했습니다. `analysis`에만 39개 파일이 있어 컨트롤러·서비스·엔티티·응답 record를 찾기 어려웠습니다.
- 팀이 shinhan-delivery처럼 도메인 안을 계층별 하위 패키지(`controller`·`service`·`repository`·`domain`·`dto`)로 나누자고 요청했습니다.
- '결과를 저장하기 전에는 `COMPLETED`로 바꾸지 않는다'([ADR-0004](0004-async-analysis-job.md))는 지금까지 `Analysis.complete()`·`recordText()`·`recordSummary()`를 package-private로 두어, 같은 패키지의 `AnalysisResultService`만 부를 수 있게 막았습니다. 엔티티와 서비스가 다른 하위 패키지로 갈라지면 이 방법을 쓸 수 없습니다.
- 계층 규칙(LY-1, PKG-3)은 이미 ArchUnit(`backend/src/test/java/com/dartinsight/architecture/ArchitectureTest.java`)으로 `./gradlew build`에서 검사합니다. 패키지가 평평해 클래스 이름·어노테이션으로 계층을 가렸습니다.

## 결정

각 도메인 패키지 안을 아래 하위 패키지로 나눈다. `common`은 원래대로 `config`·`error`·`trace`·`web`이다. 테스트도 같은 패키지 구조를 따른다.

| 하위 패키지 | 두는 것 | 예 |
| --- | --- | --- |
| `controller` | `@RestController` | `AnalysisController`, `SystemHealthController` |
| `service` | `@Service`·실행기(`@Component` 중 업무 흐름), 서비스만 쓰는 순수 계산·선택 클래스, 다른 도메인이 구현하는 서비스 인터페이스 | `AnalysisResultService`, `AnalysisRunner`, `CorpCodeSyncRunner`, `FinancialComparator`, `StatementRules`, `SummarySelector`, `FinancialFacts`, `AccountAliases`, `Amounts`, `FinancialDataStatusProvider` |
| `repository` | JPA Repository, JdbcTemplate Store, 파일 저장소 | `AnalysisRepository`, `TextChangeStore`, `SummaryStore`, `DocumentFileCache` |
| `domain` | 엔티티, enum, 도메인 로직이 쓰는 값 record, 엔티티가 쓰는 순수 함수 | `Analysis`, `AnalysisStatus`, `AnalysisStep`, `CalcStatus`, `FinancialChange(Row)`, `TextChange(Row)`, `SummaryResult`, `CorpCodeEntry`, `ReportNameParser`, `DartLinks`, `TableJson` |
| `dto` | HTTP 요청·응답 record와 외부 서버(OpenDART·ai-server) 요청·응답 record, 응답 record만 쓰는 도우미 | `AnalysisResponse`, `TextChangeRequest`, `StructuredDocumentResponse`, `DisclosureListResponse`, `SummaryAiResponse`, `TextPreview` |
| `client` | 외부 서버 호출과 그 경로 상수·예외 (`dart`, `aiserver`) | `OpenDartClient`, `OpenDartPaths`, `CorpCodeParser`, `AiServerClient`, `AiServerPaths`, `AiServerException` |
| `config` | `@ConfigurationProperties` record | `AnalysisProperties`, `ReportProperties`, `OpenDartProperties` |

- 하위 패키지는 파일이 하나뿐이어도 만든다(`system.controller`·`system.dto`). 도메인마다 모양을 같게 해 찾는 곳을 하나로 둔다.
- 계층 사이 호출은 `ArchitectureTest.layersAreRespected`(ArchUnit layered architecture)로 검사한다. controller는 어느 계층에서도 쓰지 않는다. service는 controller·dto에서만, repository는 service에서만, client는 controller·service·dto에서만, dto는 controller·service·repository·client에서만 쓴다. domain은 어느 계층에서나 쓰고, domain에서 controller·service·repository·dto·client를 쓰는 것은 예외 목록(`DOMAIN_FROM_DTO`: `ReportDocument`·`TableJson` → `StructuredDocumentResponse`)만 허용한다.
- 기존 규칙(컨트롤러의 저장소 직접 사용 금지, 저장소 → service·controller 금지, 다른 컨트롤러 의존 금지, 다른 도메인 저장소 금지, 도메인 순환 금지)은 뜻을 그대로 두고, 판단 기준만 이름·어노테이션에서 패키지(`..controller..`, `..repository..`, `..service..`)로 바꾼다. 예외 목록(`CROSS_DOMAIN_STORES`, `ANALYSIS_TO_SUMMARY`)은 클래스 위치만 고친다.
- 분석 완료 처리 `Analysis.complete()`·`recordText()`·`recordSummary()`는 public으로 바꾸고, `ArchitectureTest.onlyResultServiceCompletesAnalysis`가 `AnalysisResultService`(와 그 안의 클래스) 밖에서 이 메서드를 부르면 빌드를 실패시킨다. ADR-0004의 결정(결과 저장과 `COMPLETED` 표시를 한 트랜잭션에서 한다)은 그대로이고, 지키는 방법만 컴파일러에서 테스트로 바뀐다.
- 다른 하위 패키지에서 부르게 된 package-private 멤버(응답 record의 `from`·`of`, `FinancialStatementFetch.refresh` 등)는 public으로 바꾼다. 같은 하위 패키지 안에서만 쓰는 것은 package-private로 둔다.

## 검토한 다른 방법

| 방법 | 고르지 않은 이유 |
| --- | --- |
| 도메인 안을 기능 단위로 나누기(예 `analysis.financial`, `analysis.text`) | 기능 사이에 `Analysis`·`AnalysisResultService`를 함께 써서 결국 공용 패키지가 생기고, 완료 처리를 package-private로 지키는 문제도 그대로 남습니다. 팀이 요청한 구조(계층별)와도 다릅니다. |
| `dto`만 따로 빼고 나머지는 평평하게 두기 | 파일 수가 가장 많은 응답 record는 정리되지만, 엔티티·저장소·서비스는 여전히 섞여 있습니다. 완료 처리 보호는 지킬 수 있으나, 반만 나눈 구조라 새 클래스를 어디에 둘지 다시 판단해야 합니다. |
| 지금처럼 평평하게 두기 | 컴파일러가 완료 처리를 막아 주는 장점이 있지만, 파일을 찾기 어렵다는 팀 요청을 해결하지 못합니다. |
| 완료 처리를 `Analysis` 안의 별도 결과 객체로 감싸 컴파일러로 막기 | 엔티티 모양이 바뀌고 저장 흐름까지 고쳐야 해 이번 이슈의 범위(동작 변경 없음)를 넘습니다. |

## 결과

- 좋아지는 점: 도메인마다 같은 위치에 같은 종류의 클래스가 있어 찾기 쉽습니다. 계층 규칙을 이름이 아니라 패키지로 검사해, 이름 규칙을 어긴 클래스도 놓치지 않습니다.
- 감수하는 점: public 메서드가 늘어납니다(응답 record의 변환, 엔티티의 도메인 메서드, 테스트가 다른 패키지에서 부르는 `AnalysisRunner.run`·`verify`·`verifyText`). 완료 처리 보호가 컴파일 오류가 아니라 `./gradlew build`의 테스트 실패로 드러납니다. ArchUnit은 테스트 코드를 검사하지 않으므로 테스트에서는 완료 처리를 직접 부를 수 있습니다.
- 지켜야 할 것: 새 클래스는 위 표의 하위 패키지에 둡니다. 완료 처리처럼 특정 서비스만 불러야 하는 메서드를 더하면 `ArchitectureTest`에 호출 제한 규칙을 함께 더합니다. 계층 예외 목록에는 새 사례를 더하지 않고, 해소하면 지웁니다.

## 다시 볼 때

- 한 하위 패키지(예 `analysis.service`·`analysis.dto`)가 다시 찾기 어려울 만큼 커질 때(기능 단위 하위 패키지 검토)
- 완료 처리 외에도 호출 제한 규칙이 여러 개 필요해질 때(모듈 경계나 별도 결과 객체로 컴파일러가 막게 할지 검토)
