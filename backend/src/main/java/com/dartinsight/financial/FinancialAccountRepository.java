package com.dartinsight.financial;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancialAccountRepository extends JpaRepository<FinancialAccount, Long> {

    /** 원문 순서(ord)대로 */
    List<FinancialAccount> findByFetchIdOrderBySjDivAscOrdAscIdAsc(Long fetchId);

    long countByFetchId(Long fetchId);
}
