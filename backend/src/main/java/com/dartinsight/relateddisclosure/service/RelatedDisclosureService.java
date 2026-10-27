package com.dartinsight.relateddisclosure.service;

import com.dartinsight.analysis.domain.Analysis;
import com.dartinsight.analysis.service.AnalysisResultService;
import com.dartinsight.analysis.service.TextChangeQueryService;
import com.dartinsight.analysis.service.TextChangeQueryService.CompletedTextChanges;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.trace.TraceContext;
import com.dartinsight.disclosure.domain.DisclosureKeyItems;
import com.dartinsight.disclosure.domain.KeyItemRules;
import com.dartinsight.disclosure.domain.KeyItemTarget;
import com.dartinsight.disclosure.service.DisclosureKeyItemService;
import com.dartinsight.relateddisclosure.domain.DisclosureDetailType;
import com.dartinsight.relateddisclosure.domain.DisclosureWindow;
import com.dartinsight.relateddisclosure.domain.KeyItemMatcher;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosureMatcher;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosureRules;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosures;
import com.dartinsight.relateddisclosure.domain.RelatedLink;
import com.dartinsight.relateddisclosure.domain.RelatedRun;
import com.dartinsight.relateddisclosure.domain.WindowDisclosure;
import com.dartinsight.relateddisclosure.domain.WindowDisclosures;
import com.dartinsight.relateddisclosure.repository.RelatedDisclosureStore;
import com.dartinsight.report.domain.Report;
import com.dartinsight.report.service.ReportService;
import com.dartinsight.report.service.ReportService.ReportDetail;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
 *       모든 문장 변경을 제목 규칙으로 연결한다(1단계, {@link RelatedDisclosureMatcher#match})</li>
 *   <li>1단계 연결에 든 B001 유상증자·소송·양수 공시의 주요정보(DS005)를 받아({@link DisclosureKeyItemService#load},
 *       이미 받았으면 부르지 않음) '내용 일치'를 판정한다(2단계, {@link RelatedDisclosureMatcher#strengthen})</li>
 *   <li>한 트랜잭션으로 저장한다. 연결이 0건이어도 저장한다</li>
 * </ol>
 * 공시 목록을 받지 못하면 저장하지 않고 ApiException(DART_*)을 그대로 던진다. 부르는 쪽(#343)이 '일시 미제공'으로 답한다.
 * 주요정보를 받지 못하면 1단계 결과를 저장하지 않고 돌려준다(partial, 다음 요청에서 다시 계산). 주요정보가 자료 없음(013)이면
 * 받은 것으로 본다. OpenDART 호출은 트랜잭션 밖에서 한다(LY-2).
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
    private final DisclosureKeyItemService keyItemService;
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
                .map(run -> new RelatedDisclosures(run, store.findLinks(run.id()), true, false));
    }

    private RelatedDisclosures compute(Long analysisId) {
        CompletedTextChanges completed = textChangeQueryService.completedChanges(analysisId);
        Analysis analysis = completed.analysis();
        ReportDetail current = reportService.get(analysis.getCurrentRceptNo());
        Report previous = reportService.report(analysis.getPreviousRceptNo());
        DisclosureWindow window = new DisclosureWindow(analysis.getCorpCode(), previous.getPeriodEnd(),
                current.report().getPeriodEnd(), current.report().getRceptDt());
        WindowDisclosures disclosures = windowService.load(window);
        List<RelatedLink> typeOnly = RelatedDisclosureMatcher.match(completed.changes(), disclosures.items(),
                window.periodEnd());
        Optional<Map<String, DisclosureKeyItems>> keyItems = keyItems(window.corpCode(), typeOnly);
        List<RelatedLink> links = keyItems
                .map(items -> RelatedDisclosureMatcher.strengthen(typeOnly, completed.changes(), items,
                        current.company().getCorpName()))
                .orElse(typeOnly);
        RelatedRun run = new RelatedRun(null, analysisId, RelatedDisclosureRules.RULE_VERSION,
                disclosures.fetch().id(), window.periodEnd(), links.size(), TraceContext.currentTraceId(), now());
        if (keyItems.isEmpty()) {
            return new RelatedDisclosures(run, links, false, true);
        }
        try {
            Long id = transactionTemplate.execute(status -> store.insert(run, links));
            log.info("관련 수시공시 연결 저장 analysis={}: 변경 {}건, 공시 {}건, 연결 {}건", analysisId,
                    completed.changes().size(), disclosures.items().size(), links.size());
            return new RelatedDisclosures(new RelatedRun(id, run.analysisId(), run.ruleVersion(),
                    run.windowFetchId(), run.periodEnd(), run.linkCount(), run.traceId(), run.computedAt()), links,
                    false, false);
        } catch (DataIntegrityViolationException e) {
            // 같은 분석을 다른 서버·잠금 밖에서 먼저 저장한 경우에만 저장된 것을 쓴다
            return findSaved(analysisId).orElseThrow(() -> e);
        }
    }

    /**
     * 1단계 연결에 든 B001 유상증자·소송·양수 공시의 주요정보(트랜잭션 밖). 하나라도 받지 못하면 빈 Optional이고 남은 공시는
     * 부르지 않는다(020 한도 초과일 때 더 부르지 않기 위함).
     */
    private Optional<Map<String, DisclosureKeyItems>> keyItems(String corpCode, List<RelatedLink> links) {
        Map<String, KeyItemTarget> targets = new LinkedHashMap<>();
        for (RelatedLink link : links) {
            WindowDisclosure d = link.disclosure();
            if (d.detailType() != DisclosureDetailType.B001 || targets.containsKey(d.rceptNo())) {
                continue;
            }
            KeyItemRules.classify(d.reportName())
                    .filter(KeyItemMatcher.KINDS::contains)
                    .ifPresent(kind -> targets.put(d.rceptNo(),
                            KeyItemTarget.of(d.rceptNo(), d.reportName(), d.rceptDt(), kind, d.remark())));
        }
        Map<String, DisclosureKeyItems> keyItems = new HashMap<>();
        for (KeyItemTarget target : targets.values()) {
            try {
                keyItems.put(target.rceptNo(), keyItemService.load(corpCode, target));
            } catch (ApiException e) {
                log.warn("관련 수시공시 주요정보를 받지 못해 1단계 결과만 돌려줍니다 {}: {}", target.rceptNo(),
                        e.errorCode());
                return Optional.empty();
            }
        }
        return Optional.of(keyItems);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
