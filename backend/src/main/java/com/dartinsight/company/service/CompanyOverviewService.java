package com.dartinsight.company.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.config.CompanyProperties;
import com.dartinsight.company.domain.CompanyOverview;
import com.dartinsight.company.repository.CompanyOverviewRepository;
import com.dartinsight.company.repository.CompanyRepository;
import com.dartinsight.dart.client.OpenDartClient;
import com.dartinsight.dart.domain.CachePolicy;
import com.dartinsight.dart.domain.CacheResult;
import com.dartinsight.dart.domain.CompanyOverviewEntry;
import com.dartinsight.dart.service.DartCacheLoader;
import java.time.LocalDateTime;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 기업개황(1.2, FS-45). 저장한 지 overviewRefreshAfter(기본 7일)가 지나지 않았으면 OpenDART를 부르지 않는다(ADR-0024).
 * OpenDART 호출이 트랜잭션 밖에 있어야 하므로 클래스에 @Transactional을 두지 않는다(LY-2). 저장은 DartCacheLoader가 묶는다.
 */
@Service
@RequiredArgsConstructor
public class CompanyOverviewService {

    private final CompanyRepository companyRepository;
    private final CompanyOverviewRepository overviewRepository;
    private final OpenDartClient openDartClient;
    private final DartCacheLoader cacheLoader;
    private final CompanyProperties properties;

    /** 기업 목록에 없는 고유번호면 OpenDART를 부르지 않고 COMPANY_NOT_FOUND. */
    public CacheResult<CompanyOverview> get(String corpCode) {
        if (!companyRepository.existsByCorpCode(corpCode)) {
            throw new ApiException(ErrorCode.COMPANY_NOT_FOUND);
        }
        return cacheLoader.load("기업개황 " + corpCode,
                CachePolicy.refreshAfter(properties.overviewRefreshAfter()),
                () -> overviewRepository.findByCorpCode(corpCode),
                CompanyOverview::getFetchedAt,
                () -> openDartClient.companyOverview(corpCode),
                (entry, now) -> save(corpCode, entry, now));
    }

    private CompanyOverview save(String corpCode, Optional<CompanyOverviewEntry> entry, LocalDateTime now) {
        Optional<CompanyOverview> existing = overviewRepository.findByCorpCode(corpCode);
        if (existing.isPresent()) {
            existing.get().refresh(entry, now);
            return existing.get();
        }
        return overviewRepository.save(CompanyOverview.create(corpCode, entry, now));
    }
}
