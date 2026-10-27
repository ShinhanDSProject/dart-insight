package com.dartinsight.season.repository;

import com.dartinsight.report.domain.ReportType;
import com.dartinsight.season.domain.SeasonChange;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SeasonChangeRepository extends JpaRepository<SeasonChange, Long> {
    boolean existsByReportTypeAndFiscalYear(ReportType reportType, int fiscalYear);

    List<SeasonChange> findByReportTypeAndFiscalYear(ReportType reportType, int fiscalYear);

    /** 계산한 시즌(종류·사업연도). 최근 순은 서비스가 기간 끝으로 정렬한다 */
    @Query("select distinct s.reportType, s.fiscalYear from SeasonChange s")
    List<Object[]> findSeasons();
}
