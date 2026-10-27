package com.dartinsight.featured.service;

import com.dartinsight.datagokr.config.DataGoKrProperties;
import com.dartinsight.featured.config.FeaturedProperties;
import com.dartinsight.featured.config.FeaturedProperties.Sync;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 서버를 시작할 때와 하루에 한 번, 대표 기업 목록이 비었거나 오래됐으면 다시 받는다(ADR-0033).
 * 키가 없거나 받기에 실패해도 서버는 계속 뜨고 저장된 목록을 그대로 쓴다.
 */
// 새 DB에서는 기업 목록(CorpCodeSyncRunner)을 먼저 받아야 종목코드를 이을 수 있어 가장 나중에 돈다
@Order(Ordered.LOWEST_PRECEDENCE)
@Component
@RequiredArgsConstructor
public class FeaturedCompanySyncRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(FeaturedCompanySyncRunner.class);

    private final FeaturedProperties properties;
    private final DataGoKrProperties dataGoKr;
    private final FeaturedCompanyService featuredCompanyService;

    @Override
    public void run(ApplicationArguments args) {
        refreshIfStale();
    }

    // 시작할 때는 run()이 하므로 첫 확인은 한 주기 뒤에 한다
    @Scheduled(fixedDelayString = "${app.featured.check-interval:1d}",
            initialDelayString = "${app.featured.check-interval:1d}")
    public void check() {
        refreshIfStale();
    }

    void refreshIfStale() {
        if (properties.sync() == Sync.NEVER) {
            return;
        }
        if (!dataGoKr.hasApiKey()) {
            log.warn("DATA_GO_KR_API_KEY가 없어 대표 기업 목록을 받지 않았습니다. backend/.env에 키를 넣고 다시 시작해 주세요.");
            return;
        }
        try {
            if (!featuredCompanyService.isStale()) {
                return;
            }
            int saved = featuredCompanyService.refresh();
            if (saved == 0) {
                // 기업 목록(4.4)을 아직 받지 않았거나 받은 종목이 없음. 다음 확인 때 다시 받는다
                log.warn("대표 기업 목록을 바꾸지 않았습니다(이어지는 종목 없음). 저장된 목록을 그대로 씁니다.");
                return;
            }
            log.info("대표 기업 목록을 받았습니다: {}곳", saved);
        } catch (IllegalStateException e) {
            // StockPriceClient의 메시지는 키 없이 사유만 담는다
            log.warn("대표 기업 목록을 받지 못해 저장된 목록을 그대로 씁니다: {}", e.getMessage());
        } catch (RuntimeException e) {
            log.error("대표 기업 목록을 저장하지 못해 저장된 목록을 그대로 씁니다", e);
        }
    }
}
