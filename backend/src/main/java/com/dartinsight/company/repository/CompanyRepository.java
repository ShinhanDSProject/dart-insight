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

    List<Company> findByCorpCodeIn(Collection<String> corpCodes);

    /**
     * 회사명 일부로 찾는다. 이름이 정확히 같은 회사, 상장사, 짧은 이름 순서.
     * pattern의 %·_는 호출하는 쪽에서 '!'로 이스케이프한다.
     */
    @Query("""
            select c from Company c
            where lower(c.corpName) like lower(:pattern) escape '!'
            order by case when lower(c.corpName) = lower(:exact) then 0 else 1 end,
                     case when c.stockCode is null then 1 else 0 end,
                     length(c.corpName),
                     c.corpName
            """)
    List<Company> searchByName(@Param("pattern") String pattern, @Param("exact") String exact, Pageable pageable);

    List<Company> findByStockCode(String stockCode);
}
