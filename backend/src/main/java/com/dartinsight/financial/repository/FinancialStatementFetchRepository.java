package com.dartinsight.financial.repository;

import com.dartinsight.financial.domain.FinancialStatementFetch;
import com.dartinsight.financial.domain.FsDiv;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancialStatementFetchRepository extends JpaRepository<FinancialStatementFetch, Long> {

    Optional<FinancialStatementFetch> findByCorpCodeAndFiscalYearAndReprtCodeAndFsDiv(String corpCode, int fiscalYear,
            String reprtCode, FsDiv fsDiv);

    List<FinancialStatementFetch> findByCorpCode(String corpCode);
}
