package com.dartinsight.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.dartinsight.DartInsightApplication;
import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.dto.AnalysisResponse;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.AnalysisRunner;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.comparison.service.ReportPairService;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.domain.TableJson;
import com.dartinsight.document.dto.StructuredDocumentResponse;
import com.dartinsight.report.repository.ReportRepository;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportSyncService;
import com.dartinsight.summary.repository.SummaryStore;
import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Set;
import java.util.function.BiPredicate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

/**
 * 계층·도메인 의존 규칙(conventions.yaml PKG-1, PKG-3, LY-1, EN-2). 계층은 도메인 안의 하위 패키지로 가린다(ADR-0016).
 * 컨트롤러는 {@code ..controller..}, Service는 {@code ..service..}, 저장소(JPA Repository·JdbcTemplate Store)는
 * {@code ..repository..}, 엔티티·값은 {@code ..domain..}, 요청·응답 record는 {@code ..dto..},
 * 외부 서버 호출은 {@code ..client..}, 설정 값은 {@code ..config..}에 있다. 도메인은 루트 패키지 바로 아래 첫 패키지다(common 제외).
 *
 * <p>예외 목록은 지금 있는 사례만 담는다. 새 예외를 더하지 말고, 해소하면 목록에서 지운다.
 */
@AnalyzeClasses(packagesOf = DartInsightApplication.class, importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final String ROOT = DartInsightApplication.class.getPackageName();

    private static final String CONTROLLER = "..controller..";
    private static final String SERVICE = "..service..";
    private static final String REPOSITORY = "..repository..";
    private static final String DOMAIN = "..domain..";
    private static final String DTO = "..dto..";
    private static final String CLIENT = "..client..";
    private static final String CONFIG = "..config..";

    /** ADR-0004·0016: 결과 저장과 함께 부르는 완료 처리. AnalysisResultService만 부른다. */
    private static final Set<String> COMPLETION_METHODS = Set.of("complete", "recordText", "recordSummary");

    /** PKG-3 예외: 다른 도메인의 Repository·Store를 직접 쓰는 지금 사례. 해소는 별도 이슈에서 한다. */
    private static final Set<Allowed> CROSS_DOMAIN_STORES = Set.of(
            // 요약 요청에 넣을 회사 이름을 읽는다(CompanyService 조회로 바꿀 대상)
            new Allowed(AnalysisRunner.class, CompanyRepository.class),
            // 재무·문장 변경과 요약을 한 트랜잭션에 저장한 뒤 COMPLETED로 바꾼다(ADR-0004)
            new Allowed(AnalysisResultService.class, SummaryStore.class),
            // 회사 존재 확인과 목록 받은 시각(reportsFetchedAt)으로 최신 목록을 고른다
            new Allowed(ReportService.class, CompanyRepository.class),
            // 목록을 다시 받은 뒤 회사 행에 받은 시각을 기록한다(같은 트랜잭션)
            new Allowed(ReportSyncService.class, CompanyRepository.class),
            // 현재 보고서를 회사 조건과 함께 직접 조회한다(ReportService 조회로 바꿀 대상)
            new Allowed(ReportPairService.class, ReportRepository.class));

    /**
     * 패키지 순환 예외: analysis가 summary의 요약 실행·상태·저장소를 쓰고, summary는 analysis의 분석·변경 행을 읽는다.
     * TODO(별도 이슈): 요약 실행을 summary 쪽으로 옮기거나 공용 타입을 분리해 analysis → summary 방향을 없앤다.
     */
    private static final Set<Class<?>> ANALYSIS_TO_SUMMARY = Set.of(
            Analysis.class, AnalysisResponse.class, AnalysisResultService.class, AnalysisRunner.class);

    /**
     * 계층 예외: ai-server의 원문 구조화 응답(dto)을 받아 엔티티·표 JSON으로 옮기는 domain 클래스.
     * 해소는 변환을 DocumentService로 옮기는 별도 이슈에서 한다.
     */
    private static final Set<Class<?>> DOMAIN_FROM_DTO = Set.of(ReportDocument.class, TableJson.class);

    @ArchTest
    void layersAreRespected(JavaClasses classes) {
        layeredArchitecture().consideringOnlyDependenciesInLayers()
                .layer("Controller").definedBy(CONTROLLER)
                .layer("Service").definedBy(SERVICE)
                .layer("Repository").definedBy(REPOSITORY)
                .layer("Domain").definedBy(DOMAIN)
                .layer("Dto").definedBy(DTO)
                .layer("Client").definedBy(CLIENT)
                .layer("Config").definedBy(CONFIG)
                .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
                .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller", "Dto")
                .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service")
                .whereLayer("Dto").mayOnlyBeAccessedByLayers("Controller", "Service", "Repository", "Client")
                .whereLayer("Client").mayOnlyBeAccessedByLayers("Controller", "Service", "Dto")
                .ignoreDependency(
                        DescribedPredicate.describe("원문 구조화 결과로 자신을 채우는 document 도메인 클래스",
                                origin -> DOMAIN_FROM_DTO.stream().anyMatch(c -> topLevel(origin).isEquivalentTo(c))),
                        DescribedPredicate.describe("StructuredDocumentResponse",
                                target -> topLevel(target).isEquivalentTo(StructuredDocumentResponse.class)))
                .check(classes);
    }

    @ArchTest
    void controllersDoNotUsePersistenceDirectly(JavaClasses classes) {
        classes().that().resideInAPackage(CONTROLLER)
                .should(notDependOn("Repository·Store·JdbcTemplate",
                        (origin, target) -> isPersistence(target)))
                .check(classes);
    }

    @ArchTest
    void persistenceDoesNotDependOnServicesOrControllers(JavaClasses classes) {
        noClasses().that().resideInAPackage(REPOSITORY)
                .should().dependOnClassesThat().resideInAnyPackage(SERVICE, CONTROLLER)
                .check(classes);
    }

    @ArchTest
    void controllersDoNotDependOnOtherControllers(JavaClasses classes) {
        classes().that().resideInAPackage(CONTROLLER)
                .should(notDependOn("다른 컨트롤러",
                        (origin, target) -> isController(target) && !topLevel(origin).equals(topLevel(target))))
                .check(classes);
    }

    @ArchTest
    void domainsDoNotUseOtherDomainsPersistence(JavaClasses classes) {
        classes().that().resideInAPackage(ROOT + "..")
                .should(notDependOn("다른 도메인의 Repository·Store",
                        (origin, target) -> isRepositoryPackage(target)
                                && domainOf(origin) != null && domainOf(target) != null
                                && !domainOf(origin).equals(domainOf(target))
                                && !isAllowed(CROSS_DOMAIN_STORES, origin, target)))
                .check(classes);
    }

    @ArchTest
    void onlyResultServiceCompletesAnalysis(JavaClasses classes) {
        noClasses().that(DescribedPredicate.describe("AnalysisResultService가 아닌 클래스",
                        c -> !topLevel(c).isEquivalentTo(AnalysisResultService.class)))
                .should().callMethodWhere(DescribedPredicate.describe(
                        "Analysis의 완료 처리 " + COMPLETION_METHODS,
                        (JavaMethodCall call) -> call.getTargetOwner().isEquivalentTo(Analysis.class)
                                && COMPLETION_METHODS.contains(call.getName())))
                .check(classes);
    }

    @ArchTest
    void domainsAreFreeOfCycles(JavaClasses classes) {
        slices().matching(ROOT + ".(*)..")
                .should().beFreeOfCycles()
                .ignoreDependency(
                        DescribedPredicate.describe("analysis의 요약 연동 클래스",
                                origin -> ANALYSIS_TO_SUMMARY.stream().anyMatch(c -> topLevel(origin).isEquivalentTo(c))),
                        DescribedPredicate.describe("summary 패키지",
                                target -> "summary".equals(domainOf(target))))
                .check(classes);
    }

    private static ArchCondition<JavaClass> notDependOn(String what, BiPredicate<JavaClass, JavaClass> forbidden) {
        return new ArchCondition<>("not depend on " + what) {
            @Override
            public void check(JavaClass origin, ConditionEvents events) {
                for (Dependency dependency : origin.getDirectDependenciesFromSelf()) {
                    if (forbidden.test(origin, dependency.getTargetClass())) {
                        events.add(SimpleConditionEvent.violated(dependency, dependency.getDescription()));
                    }
                }
            }
        };
    }

    private static boolean isPersistence(JavaClass target) {
        return isRepositoryPackage(target)
                || target.isAssignableTo(JpaRepository.class)
                || target.isAssignableTo(JdbcTemplate.class)
                || target.isAssignableTo(NamedParameterJdbcTemplate.class);
    }

    /** 우리 코드의 repository 패키지에 있는 클래스(JPA Repository·JdbcTemplate Store와 그 안에 선언한 클래스). */
    private static boolean isRepositoryPackage(JavaClass target) {
        return target.getPackageName().startsWith(ROOT + ".") && target.getPackageName().endsWith(".repository");
    }

    /** 우리 코드의 controller 패키지에 있는 클래스. */
    private static boolean isController(JavaClass c) {
        return c.getPackageName().startsWith(ROOT + ".") && c.getPackageName().endsWith(".controller");
    }

    private static JavaClass topLevel(JavaClass c) {
        JavaClass current = c;
        while (current.getEnclosingClass().isPresent()) {
            current = current.getEnclosingClass().get();
        }
        return current;
    }

    /** 루트 패키지 바로 아래 첫 패키지. 루트 밖이거나 common이면 null. */
    private static String domainOf(JavaClass c) {
        String pkg = c.getPackageName();
        if (!pkg.startsWith(ROOT + ".")) {
            return null;
        }
        String rest = pkg.substring(ROOT.length() + 1);
        int dot = rest.indexOf('.');
        String domain = dot < 0 ? rest : rest.substring(0, dot);
        return domain.equals("common") ? null : domain;
    }

    private static boolean isAllowed(Set<Allowed> allowed, JavaClass origin, JavaClass target) {
        return allowed.stream().anyMatch(a -> topLevel(origin).isEquivalentTo(a.origin())
                && (target.isEquivalentTo(a.target()) || topLevel(target).isEquivalentTo(a.target())));
    }

    private record Allowed(Class<?> origin, Class<?> target) {
    }
}
