package com.dartinsight.financial;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface FinancialAccountRepository extends JpaRepository<FinancialAccount, Long> {

    /** 원문 순서(ord)대로 */
    List<FinancialAccount> findByFetchIdOrderBySjDivAscOrdAscIdAsc(Long fetchId);

    long countByFetchId(Long fetchId);

    @Modifying
    @Query("delete from FinancialAccount a where a.fetchId = :fetchId")
    void deleteByFetchId(Long fetchId);

    @Query("select distinct a.currency from FinancialAccount a where a.fetchId = :fetchId and a.currency is not null")
    List<String> findCurrencies(Long fetchId);
}
