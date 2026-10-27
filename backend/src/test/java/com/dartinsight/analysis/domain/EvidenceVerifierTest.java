package com.dartinsight.analysis.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.FinancialChangeRow.Evidence;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.comparison.domain.ComparisonBasis;
import com.dartinsight.financial.domain.FsDiv;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 재무 수치 결과의 근거 확인(EvidenceVerifier.verifyFinancial). 문장 비교 쪽은 TextVerifyTest */
class EvidenceVerifierTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 21, 9, 0);

    @DisplayName("근거 접수번호·짝지은 계정·증감액이 맞지 않는 재무 수치는 설명을 돌려준다")
    @Test
    void verifyRejectsValuesWithoutMatchingEvidence() {
        Analysis analysis = Analysis.request("00000001", CUR, PREV, ComparisonBasis.YOY, null, NOW);
        FinancialChangeRow ok = new FinancialChangeRow("BS", FsDiv.CFS, "k", "자산", 0, AmountBasis.POINT, 1L, 2L,
                1L, null, CalcStatus.OK, "KRW", new Evidence(PREV, "BS", "k", "자산", null),
                new Evidence(CUR, "BS", "k", "자산", null));
        FinancialChangeRow wrongReport = new FinancialChangeRow("BS", FsDiv.CFS, "k", "자산", 0, AmountBasis.POINT,
                1L, 2L, 1L, null, CalcStatus.OK, "KRW", new Evidence("20990101000001", "BS", "k", "자산", null),
                new Evidence(CUR, "BS", "k", "자산", null));
        FinancialChangeRow wrongMath = new FinancialChangeRow("BS", FsDiv.CFS, "k", "자산", 0, AmountBasis.POINT,
                1L, 2L, 5L, null, CalcStatus.OK, "KRW", new Evidence(PREV, "BS", "k", "자산", null),
                new Evidence(CUR, "BS", "k", "자산", null));

        assertThat(EvidenceVerifier.verifyFinancial(analysis, List.of(ok))).isNull();
        assertThat(EvidenceVerifier.verifyFinancial(analysis, List.of(ok, wrongReport))).contains("이전 값의 근거");
        assertThat(EvidenceVerifier.verifyFinancial(analysis, List.of(wrongMath))).contains("증감액");
        FinancialChangeRow differentAccounts = new FinancialChangeRow("BS", FsDiv.CFS, "k", "자산", 0,
                AmountBasis.POINT, 1L, 2L, 1L, null, CalcStatus.OK, "KRW", new Evidence(PREV, "BS", "a", "자산", null),
                new Evidence(CUR, "BS", "b", "자산", null));
        assertThat(EvidenceVerifier.verifyFinancial(analysis, List.of(differentAccounts))).contains("다른 계정");
        FinancialChangeRow pairedByName = new FinancialChangeRow("BS", FsDiv.CFS, "NAME:자산", "자산", 0,
                AmountBasis.POINT, 1L, 2L, 1L, null, CalcStatus.OK, "KRW", new Evidence(PREV, "BS", "a", "자산", null),
                new Evidence(CUR, "BS", "b", "자산", null));
        assertThat(EvidenceVerifier.verifyFinancial(analysis, List.of(pairedByName))).isNull();
        FinancialChangeRow pairedByWrongName = new FinancialChangeRow("BS", FsDiv.CFS, "NAME:자산", "자산", 0,
                AmountBasis.POINT, 1L, 2L, 1L, null, CalcStatus.OK, "KRW", new Evidence(PREV, "BS", "a", "부채", null),
                new Evidence(CUR, "BS", "b", "자산", null));
        assertThat(EvidenceVerifier.verifyFinancial(analysis, List.of(pairedByWrongName))).contains("다른 계정");
    }
}
