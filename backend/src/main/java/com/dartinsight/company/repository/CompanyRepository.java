package com.dartinsight.company.repository;

import com.dartinsight.company.domain.Company;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    Optional<Company> findByCorpCode(String corpCode);

    boolean existsByCorpCode(String corpCode);

    List<Company> findByCorpCodeIn(Collection<String> corpCodes);

    /**
     * 공백을 뺀 소문자 회사명(corp_name_key) 일부로 찾는다. 정확히 같은 회사, 상장사, 짧은 이름 순서.
     * pattern·exact는 CompanyNameKey.key로 만든 값이고, pattern의 %·_는 호출하는 쪽에서 '!'로 이스케이프한다.
     */
    @Query("""
            select c from Company c
            where c.corpNameKey like :pattern escape '!'
            order by case when c.corpNameKey = :exact then 0 else 1 end,
                     case when c.stockCode is null then 1 else 0 end,
                     length(c.corpName),
                     c.corpName
            """)
    List<Company> searchByNameKey(@Param("pattern") String pattern, @Param("exact") String exact,
            Pageable pageable);

    /** 회사명 초성(corp_name_chosung) 일부로 찾는다. 정렬은 searchByNameKey와 같다(초성이 정확히 같은 회사 먼저). */
    @Query("""
            select c from Company c
            where c.corpNameChosung like :pattern escape '!'
            order by case when c.corpNameChosung = :exact then 0 else 1 end,
                     case when c.stockCode is null then 1 else 0 end,
                     length(c.corpName),
                     c.corpName
            """)
    List<Company> searchByChosung(@Param("pattern") String pattern, @Param("exact") String exact,
            Pageable pageable);

    List<Company> findByStockCode(String stockCode);
}
