package com.dartinsight.analysis.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.FinancialEvidenceMatcher.RelatedTextChange;
import com.dartinsight.analysis.domain.FinancialEvidenceMatcher.TableLocation;
import com.dartinsight.comparison.domain.AmountBasis;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.document.dto.StructuredDocumentResponse;
import com.dartinsight.financial.domain.FsDiv;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FinancialEvidenceMatcherTest {

    private static final LocalDateTime COMPLETED_AT = LocalDateTime.of(2026, 8, 15, 9, 0);

    private static ReportDocument structuredDocument(String rceptNo, LocalDateTime structuredAt) {
        StructuredDocumentResponse response = new StructuredDocumentResponse(rceptNo, "p1", "STRUCTURED",
                null, null, null, null, null, null, List.of(), List.of(), Map.of(), List.of());
        return ReportDocument.structured(rceptNo, response, 10, structuredAt.minusHours(1), structuredAt);
    }

    private static FinancialChange financialChange(String sjDiv, String accountName, String accountId) {
        FinancialChangeRow.Evidence prev = new FinancialChangeRow.Evidence("20250814000001", sjDiv, accountId, accountName, "제 56 기 반기");
        FinancialChangeRow.Evidence curr = new FinancialChangeRow.Evidence("20260814000123", sjDiv, accountId, accountName, "제 57 기 반기");
        FinancialChangeRow row = new FinancialChangeRow(sjDiv, FsDiv.CFS, accountId, accountName, 1,
                AmountBasis.CUMULATIVE, 100L, 120L, 20L, BigDecimal.valueOf(0.2), CalcStatus.OK, "KRW", prev, curr);
        return FinancialChange.of(1L, row);
    }

    @Test
    @DisplayName("원문에서 해당 재무제표 섹션 내 계정명이 포함된 표 블록 위치를 우선 찾는다")
    void findsTableLocationWithAccountMatch() {
        ReportDocument doc = structuredDocument("20260814000123", COMPLETED_AT.minusHours(1));

        List<DocumentSection> sections = List.of(
                new DocumentSection(1, null, 1, "I. 회사의 개요", null, false, 2),
                new DocumentSection(2, null, 1, "III. 재무에 관한 사항 > 2. 연결재무제표 > 연결손익계산서", null, false, 2),
                new DocumentSection(3, null, 1, "III. 재무에 관한 사항 > 3. 연결재무제표 주석", null, false, 5));

        List<DocumentBlock> blocks = List.of(
                new DocumentBlock("20260814000123", 10, 2, DocumentBlock.TABLE, "매출액 | 150조\n영업이익 | 15조", null),
                new DocumentBlock("20260814000123", 11, 2, DocumentBlock.TABLE, "기타수익 | 1조", null),
                new DocumentBlock("20260814000123", 20, 3, DocumentBlock.TABLE, "영업이익 주석 표", null));

        TableLocation loc = FinancialEvidenceMatcher.findTableLocation(
                doc, sections, blocks, FsDiv.CFS, "IS", "영업이익", COMPLETED_AT);

        assertThat(loc).isNotNull();
        assertThat(loc.sectionNo()).isEqualTo(2);
        assertThat(loc.blockNo()).isEqualTo(10);
    }

    @Test
    @DisplayName("계정명이 표 텍스트에 없으면 해당 재무제표 섹션의 첫 표 블록을 찾는다")
    void fallsBackToFirstTableInStatementSection() {
        ReportDocument doc = structuredDocument("20260814000123", COMPLETED_AT.minusHours(1));

        List<DocumentSection> sections = List.of(
                new DocumentSection(2, null, 1, "연결재무상태표", null, false, 2));

        List<DocumentBlock> blocks = List.of(
                new DocumentBlock("20260814000123", 15, 2, DocumentBlock.TABLE, "자산 표 내용", null),
                new DocumentBlock("20260814000123", 16, 2, DocumentBlock.TABLE, "부채 표 내용", null));

        TableLocation loc = FinancialEvidenceMatcher.findTableLocation(
                doc, sections, blocks, FsDiv.CFS, "BS", "미착품", COMPLETED_AT);

        assertThat(loc).isNotNull();
        assertThat(loc.sectionNo()).isEqualTo(2);
        assertThat(loc.blockNo()).isEqualTo(15);
    }

    @Test
    @DisplayName("분석 완료 후 재구조화되었거나 원문이 미사용 상태면 null을 돌려준다")
    void returnsNullWhenRestructuredAfterAnalysisOrUnusable() {
        ReportDocument doc = structuredDocument("20260814000123", COMPLETED_AT.plusDays(1)); // 분석 이후 재구조화

        TableLocation loc = FinancialEvidenceMatcher.findTableLocation(
                doc, List.of(new DocumentSection(1, null, 1, "재무상태표", null, false, 1)),
                List.of(new DocumentBlock("20260814000123", 1, 1, DocumentBlock.TABLE, "표", null)),
                FsDiv.CFS, "BS", "자산총계", COMPLETED_AT);

        assertThat(loc).isNull();
    }

    @Test
    @DisplayName("계정명 또는 별칭이 포함된 문장 변경을 중요도 및 목차 순으로 상위 최대 3건 돌려준다")
    void matchesRelatedTextChanges() {
        FinancialChange change = financialChange("IS", "영업이익", "dart_OperatingIncomeLoss");

        TextChangeRow row1 = new TextChangeRow(
                TextChangeRow.MODIFIED,
                DocumentBlock.PARAGRAPH,
                false,
                "MATCHED",
                "주석",
                "III. 재무에 관한 사항 > 5. 주석",
                new TextChangeRow.Side("20250814000001", 10, 100, "전기 영업손실이 발생함."),
                new TextChangeRow.Side("20260814000123", 12, 105, "당기 영업이익이 1조원 발생함."),
                BigDecimal.valueOf(0.7),
                null,
                new TextChangeRow.Priority("HIGH", 80, List.of("주석"), "1"),
                null);
        TextChange tc1 = new TextChange(101L, 1, row1);

        TextChangeRow row2 = new TextChangeRow(
                TextChangeRow.DELETED,
                DocumentBlock.PARAGRAPH,
                false,
                "MATCHED",
                "사업의 개요",
                "II. 사업의 내용 > 1. 사업의 개요",
                new TextChangeRow.Side("20250814000001", 5, 50, "영업이익 개선을 위한 구조조정 중."),
                null,
                BigDecimal.ZERO,
                null,
                new TextChangeRow.Priority("MEDIUM", 50, List.of("사업"), "1"),
                null);
        TextChange tc2 = new TextChange(102L, 2, row2);

        TextChangeRow rowUnrelated = new TextChangeRow(
                TextChangeRow.MODIFIED,
                DocumentBlock.PARAGRAPH,
                false,
                "MATCHED",
                "기타",
                "IV. 이사의 경영진단",
                new TextChangeRow.Side("20250814000001", 8, 80, "인사 제도 변경"),
                new TextChangeRow.Side("20260814000123", 8, 80, "인사 제도 추가 변경"),
                BigDecimal.valueOf(0.9),
                null,
                null,
                null);
        TextChange tcUnrelated = new TextChange(103L, 3, rowUnrelated);

        List<RelatedTextChange> related = FinancialEvidenceMatcher.relatedTextChanges(
                change, List.of(tcUnrelated, tc2, tc1));

        assertThat(related).hasSize(2);
        // tc1이 주석(+4) + HIGH(+2)로 점수가 높아 1위
        assertThat(related.get(0).changeId()).isEqualTo(101L);
        assertThat(related.get(0).side()).isEqualTo("current");
        assertThat(related.get(0).sectionNo()).isEqualTo(12);
        assertThat(related.get(0).blockNo()).isEqualTo(105);

        // tc2는 삭제이므로 side="previous"
        assertThat(related.get(1).changeId()).isEqualTo(102L);
        assertThat(related.get(1).side()).isEqualTo("previous");
        assertThat(related.get(1).sectionNo()).isEqualTo(5);
        assertThat(related.get(1).blockNo()).isEqualTo(50);
    }
}
