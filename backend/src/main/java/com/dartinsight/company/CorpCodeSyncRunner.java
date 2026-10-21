package com.dartinsight.company;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.dart.OpenDartProperties;
import com.dartinsight.dart.OpenDartProperties.CorpCodeSync;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 서버를 시작할 때 기업 목록을 받는다.
 * 기본(on-empty)은 company 테이블이 비어 있을 때만 받는다. 다시 받으려면 OPENDART_CORP_CODE_SYNC=always로 한 번 실행한다.
 * 받지 못해도 서버는 계속 뜬다(기업 검색만 COMPANY_LIST_NOT_LOADED).
 */
@Component
public class CorpCodeSyncRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CorpCodeSyncRunner.class);

    private final OpenDartProperties properties;
    private final CompanyRepository companyRepository;
    private final CompanyImportService companyImportService;

    public CorpCodeSyncRunner(OpenDartProperties properties, CompanyRepository companyRepository,
            CompanyImportService companyImportService) {
        this.properties = properties;
        this.companyRepository = companyRepository;
        this.companyImportService = companyImportService;
    }

    @Override
    public void run(ApplicationArguments args) {
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
        }
    }
}
