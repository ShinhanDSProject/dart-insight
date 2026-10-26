package com.dartinsight.notification.service;

import com.dartinsight.analysis.service.AnalysisService;
import com.dartinsight.analysis.service.AnalysisService.RequestResult;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.comparison.service.ReportPairService;
import com.dartinsight.comparison.service.ReportPairService.ReportPair;
import com.dartinsight.favorite.domain.FavoriteReportFound;
import com.dartinsight.notification.domain.WatchedReport;
import com.dartinsight.notification.repository.WatchedReportRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * 즐겨찾기 기업의 새 정기보고서를 전년 동기 보고서와 자동으로 분석한다(6.4, ADR-0031).
 * 사용자 요청과 같은 AnalysisService.request를 써서, 같은 쌍의 분석이 있으면 새로 만들지 않는다.
 * 분석이 끝나면 NotificationService가 알림을 만든다. 이미 완료된 분석을 다시 쓰면 완료 이벤트가 없어 여기서 바로 만든다.
 */
@Service
@RequiredArgsConstructor
public class FavoriteReportAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(FavoriteReportAnalyzer.class);

    private final ReportPairService reportPairService;
    private final AnalysisService analysisService;
    private final WatchedReportRepository watchedReports;
    private final NotificationService notificationService;
    private final Clock clock;

    @EventListener
    public void onFound(FavoriteReportFound event) {
        try {
            ReportPair pair = reportPairService.findPair(event.corpCode(), ComparisonBasis.YOY, event.rceptNo());
            if (pair.previous() == null) {
                log.info("전년 동기 보고서가 없어 자동 분석하지 않습니다: {} {}", event.corpCode(), event.rceptNo());
                return;
            }
            // 분석이 빨리 끝나도 알림 대상인지 놓치지 않게, 요청보다 먼저 지켜볼 보고서로 남긴다
            watch(event.rceptNo());
            RequestResult result = analysisService.request(event.corpCode(), event.rceptNo(),
                    pair.previous().getRceptNo(), ComparisonBasis.YOY);
            if (result.completed()) {
                notificationService.notifyIfWatched(result.analysis());
            }
        } catch (ApiException e) {
            log.warn("새 정기보고서를 자동 분석하지 못했습니다: {} {} {}", event.corpCode(), event.rceptNo(), e.errorCode());
        }
    }

    private void watch(String rceptNo) {
        if (watchedReports.existsByRceptNo(rceptNo)) {
            return;
        }
        try {
            watchedReports.save(WatchedReport.create(rceptNo, LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS)));
        } catch (DataIntegrityViolationException e) {
            // 같은 보고서를 동시에 넣으면 UNIQUE(rcept_no)가 막는다. 이미 지켜보고 있으니 그대로 둔다
            log.info("이미 지켜보는 보고서입니다: {}", rceptNo);
        }
    }
}
