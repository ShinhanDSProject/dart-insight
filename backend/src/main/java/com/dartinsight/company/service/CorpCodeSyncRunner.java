package com.dartinsight.company.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.dart.config.OpenDartProperties;
import com.dartinsight.dart.config.OpenDartProperties.CorpCodeSync;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 서버를 시작할 때 기업 목록을 받는다.
 * 기본(on-empty)은 company 테이블이 비어 있을 때만 받는다. 다시 받으려면 OPENDART_CORP_CODE_SYNC=always로 한 번 실행한다.
 * 받지 못해도 서버는 계속 뜬다(기업 검색만 COMPANY_LIST_NOT_LOADED).
 * 받기 전에 검색용 이름(corp_name_key·corp_name_chosung)이 빈 행을 먼저 채운다(1.1, #277).
 */
// 대표 기업(FeaturedCompanySyncRunner)이 종목코드를 이을 수 있게 다른 시작 작업보다 먼저 돈다
@Order(Ordered.HIGHEST_PRECEDENCE)
@Component
@RequiredArgsConstructor
public class CorpCodeSyncRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CorpCodeSyncRunner.class);

    private final OpenDartProperties properties;
    private final CompanyRepository companyRepository;
    private final CompanyImportService companyImportService;

    @Override
    public void run(ApplicationArguments args) {
        fillMissingNameKeys();
        CorpCodeSync mode = properties.corpCodeSync();
        if (mode == CorpCodeSync.NEVER) {
            return;
        }
        if (mode == CorpCodeSync.ON_EMPTY && companyRepository.count() > 0) {
            return;
        }
        if (!properties.hasApiKey()) {
            log.warn("OPENDART_API_KEY가 없어 기업 목록을 받지 않았습니다. backend/.env에 키를 넣고 다시 시작해 주세요.");
            return;
        }
        log.info("OpenDART에서 기업 목록을 받습니다(1분 정도 걸릴 수 있습니다).");
        try {
            companyImportService.importFromOpenDart();
        } catch (ApiException e) {
            log.warn("기업 목록을 받지 못했습니다: {} {}", e.errorCode(), e.getMessage());
        } catch (RuntimeException e) {
            // DB 오류 등으로 받기에 실패해도 서버는 뜨게 한다. 처음 받던 중이면 저장한 것이 없어 다음 시작 때 다시 받는다
            log.error("기업 목록을 저장하지 못했습니다", e);
        }
    }

    /** 이미 받아 둔 목록의 검색용 이름을 채운다. 받기 설정(never 포함)과 상관없이 돈다. 실패해도 서버는 뜬다. */
    private void fillMissingNameKeys() {
        try {
            companyImportService.fillMissingNameKeys();
        } catch (RuntimeException e) {
            log.error("기업 검색용 이름을 채우지 못했습니다", e);
        }
    }
}
