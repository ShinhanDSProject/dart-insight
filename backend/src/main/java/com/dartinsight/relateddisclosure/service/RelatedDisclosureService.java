package com.dartinsight.relateddisclosure.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.analysis.service.TextChangeQueryService.CompletedTextChanges;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.relateddisclosure.domain.DisclosureWindow;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosureMatcher;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosureRules;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosures;
import com.dartinsight.relateddisclosure.domain.RelatedLink;
import com.dartinsight.relateddisclosure.domain.RelatedRun;
import com.dartinsight.relateddisclosure.domain.WindowDisclosures;
import com.dartinsight.relateddisclosure.repository.RelatedDisclosureStore;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 분석 하나의 관련 수시공시 연결(3.6, ADR-0030). 분석 파이프라인 밖에서 첫 요청 때 분석 전체를 계산해 저장하고, 그 뒤에는
 * 저장된 결과를 읽는다. 분석 상태와 분석 버전은 건드리지 않는다.
 * <ol>
 *   <li>완료된 분석만(아니면 409). 그 분석·{@link RelatedDisclosureRules#RULE_VERSION}으로 저장한 결과가 있으면 돌려준다</li>
 *   <li>기간(이전 보고서 기간 말일 ~ 현재 보고서 제출일)의 공시 목록을 받고({@link DisclosureWindowService}),
 *       모든 문장 변경을 제목 규칙으로 연결해({@link RelatedDisclosureMatcher}) 한 트랜잭션으로 저장한다.
 *       연결이 0건이어도 저장한다</li>
 * </ol>
 * 공시 목록을 받지 못하면 저장하지 않고 ApiException(DART_*)을 그대로 던진다. 부르는 쪽(#343)이 '일시 미제공'으로 답한다.
 * OpenDART 호출은 트랜잭션 밖에서 한다(LY-2).
 */
@Service
@RequiredArgsConstructor
public class RelatedDisclosureService {

    private static final Logger log = LoggerFactory.getLogger(RelatedDisclosureService.class);
    private static final Object[] LOCKS = new Object[64];

    static {
        for (int i = 0; i < LOCKS.length; i++) {
            LOCKS[i] = new Object();
        }
    }

    private final AnalysisResultService analysisResultService;
    private final TextChangeQueryService textChangeQueryService;
    private final ReportService reportService;
    private final DisclosureWindowService windowService;
    private final RelatedDisclosureStore store;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * 분석의 관련 수시공시. 없는 분석은 404, 완료되지 않았으면 409.
     *
     * @throws com.dartinsight.common.error.ApiException 공시 목록을 받지 못함(DART_*, 저장하지 않음)
     */
    public RelatedDisclosures get(Long analysisId) {
        analysisResultService.completed(analysisId);
        synchronized (LOCKS[Math.floorMod(analysisId.hashCode(), LOCKS.length)]) {
            Optional<RelatedDisclosures> saved = findSaved(analysisId);
            if (saved.isPresent()) {
                return saved.get();
            }
            return compute(analysisId);
        }
    }

    private Optional<RelatedDisclosures> findSaved(long analysisId) {
        return store.findRun(analysisId, RelatedDisclosureRules.RULE_VERSION)
                .map(run -> new RelatedDisclosures(run, store.findLinks(run.id()), true));
    }

    private RelatedDisclosures compute(Long analysisId) {
        CompletedTextChanges completed = textChangeQueryService.completedChanges(analysisId);
        DisclosureWindow window = window(completed.analysis());
        WindowDisclosures disclosures = windowService.load(window);
        List<RelatedLink> links = RelatedDisclosureMatcher.match(completed.changes(), disclosures.items(),
                window.periodEnd());
        RelatedRun run = new RelatedRun(null, analysisId, RelatedDisclosureRules.RULE_VERSION,
                disclosures.fetch().id(), window.periodEnd(), links.size(), TraceContext.currentTraceId(), now());
        try {
            Long id = transactionTemplate.execute(status -> store.insert(run, links));
            log.info("관련 수시공시 연결 저장 analysis={}: 변경 {}건, 공시 {}건, 연결 {}건", analysisId,
                    completed.changes().size(), disclosures.items().size(), links.size());
            return new RelatedDisclosures(new RelatedRun(id, run.analysisId(), run.ruleVersion(),
                    run.windowFetchId(), run.periodEnd(), run.linkCount(), run.traceId(), run.computedAt()), links,
                    false);
        } catch (DataIntegrityViolationException e) {
            // 같은 분석을 다른 서버·잠금 밖에서 먼저 저장한 경우에만 저장된 것을 쓴다
            return findSaved(analysisId).orElseThrow(() -> e);
        }
    }

    /** 이전 보고서 기간 말일 ~ 현재 보고서 제출일. 현재 보고서 기간 말일로 기간 안·뒤를 나눈다 */
    private DisclosureWindow window(Analysis analysis) {
        Report current = reportService.report(analysis.getCurrentRceptNo());
        Report previous = reportService.report(analysis.getPreviousRceptNo());
        return new DisclosureWindow(analysis.getCorpCode(), previous.getPeriodEnd(), current.getPeriodEnd(),
                current.getRceptDt());
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
