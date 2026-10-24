package com.dartinsight.company.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.domain.CompanyNameKey;
import com.dartinsight.company.repository.CompanyRepository;
import java.util.List;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 기업 검색과 조회(1.1).
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CompanyService {

    static final int MIN_QUERY_LENGTH = 2;
    private static final Pattern STOCK_CODE = Pattern.compile("\\d{6}");

    private final CompanyRepository companyRepository;

    /** 회사명 일부(공백 무시), 회사명 초성 또는 종목코드 6자리로 찾는다. 결과가 없으면 빈 목록. */
    public List<Company> search(String query, int limit) {
        String q = query == null ? "" : query.trim();
        if (q.length() < MIN_QUERY_LENGTH) {
            throw ApiException.invalidInput("query", MIN_QUERY_LENGTH + "자 이상 입력해 주세요.");
        }

        List<Company> result;
        if (STOCK_CODE.matcher(q).matches()) {
            result = companyRepository.findByStockCode(q);
        } else {
            // 공백을 뺀 검색어로 찾는다. 한글 자음만이면 초성으로 찾는다(docs/api-spec.md)
            String key = CompanyNameKey.key(q);
            String pattern = "%" + escapeLike(key) + "%";
            PageRequest page = PageRequest.of(0, limit);
            result = CompanyNameKey.isChosungQuery(q)
                    ? companyRepository.searchByChosung(pattern, key, page)
                    : companyRepository.searchByNameKey(pattern, key, page);
        }

        if (result.isEmpty() && companyRepository.count() == 0) {
            throw new ApiException(ErrorCode.COMPANY_LIST_NOT_LOADED);
        }
        return result.size() > limit ? result.subList(0, limit) : result;
    }

    public Company get(String corpCode) {
        return companyRepository.findByCorpCode(corpCode)
                .orElseThrow(() -> new ApiException(ErrorCode.COMPANY_NOT_FOUND));
    }

    static String escapeLike(String text) {
        return text.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }
}
