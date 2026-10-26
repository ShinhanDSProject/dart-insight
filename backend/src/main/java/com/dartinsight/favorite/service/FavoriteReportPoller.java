package com.dartinsight.favorite.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.favorite.domain.FavoriteReportFound;
import com.dartinsight.favorite.repository.FavoriteCompanyRepository;
import com.dartinsight.report.service.ReportSyncService;
import com.dartinsight.report.service.ReportSyncService.SyncResult;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 즐겨찾기 기업의 정기보고서 목록을 주기마다 다시 받아, 새로 저장된 보고서를 FavoriteReportFound로 알린다(6.3, ADR-0027).
 * 이미 저장된 접수번호는 다시 알리지 않는다.
 */
@Service
@RequiredArgsConstructor
public class FavoriteReportPoller {

    private static final Logger log = LoggerFactory.getLogger(FavoriteReportPoller.class);

    private final FavoriteCompanyRepository favorites;
    private final ReportSyncService reportSyncService;
    private final ApplicationEventPublisher events;

    // 서버를 켤 때마다 호출하지 않게 첫 회차도 한 주기 뒤에 돈다
    @Scheduled(fixedDelayString = "${app.reports.polling-interval}",
            initialDelayString = "${app.reports.polling-interval}")
    public void poll() {
        int companies = 0;
        int found = 0;
        for (String corpCode : favorites.findDistinctCorpCodes()) {
            SyncResult result;
            try {
                result = reportSyncService.refresh(corpCode);
            } catch (ApiException e) {
                if (e.errorCode() == ErrorCode.DART_RATE_LIMITED) {
                    log.warn("OpenDART 호출 한도에 걸려 즐겨찾기 폴링을 멈춥니다: {}곳 확인", companies);
                    return;
                }
                log.warn("즐겨찾기 기업의 정기보고서 목록을 받지 못했습니다: {} {}", corpCode, e.errorCode());
                continue;
            }
            companies++;
            for (String rceptNo : result.newRceptNos()) {
                found++;
                try {
                    events.publishEvent(new FavoriteReportFound(corpCode, rceptNo));
                } catch (RuntimeException e) {
                    // 보고서는 이미 저장돼 다음 회차에 다시 잡히지 않는다. 리스너 하나의 실패로 나머지 공시까지 잃지 않게 넘어간다
                    log.error("새 정기보고서 이벤트를 처리하지 못했습니다: {} {}", corpCode, rceptNo, e);
                }
            }
            if (result.cacheFallbackError() == ErrorCode.DART_RATE_LIMITED) {
                log.warn("OpenDART 호출 한도에 걸려 즐겨찾기 폴링을 멈춥니다: {}곳 확인", companies);
                return;
            }
        }
        log.info("즐겨찾기 폴링: 기업 {}곳, 새 정기보고서 {}건", companies, found);
    }
}
