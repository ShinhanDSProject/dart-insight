package com.dartinsight.briefing.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BriefingSourcesTest {

    static final String R = "20260310000001";
    static final String LONG = " 문단은 근거로 쓸 수 있을 만큼 충분히 길게 적은 원문 문단입니다. 마흔 자를 넘습니다.";

    private static DocumentSection section(int no, Integer parent, String title) {
        return new DocumentSection(no, parent, parent == null ? 1 : 2, title, null, false, 0);
    }

    private static DocumentBlock paragraph(int no, int section, String text) {
        return new DocumentBlock(R, no, section, DocumentBlock.PARAGRAPH, text, null);
    }

    private static DocumentBlock table(int no, int section, String text) {
        return new DocumentBlock(R, no, section, DocumentBlock.TABLE, text, "[]");
    }

    private static List<BriefingSource> select(List<DocumentSection> sections, List<DocumentBlock> blocks) {
        return BriefingSources.select(sections, blocks, TextEvidenceService.paths(sections));
    }

    @Test
    @DisplayName("사업의 내용 하위 목차 제목으로 주제를 정하고, 주제마다 문단을 먼저 최대 2개 고른다")
    void picksParagraphsPerTopicFromBusinessSubsections() {
        List<DocumentSection> sections = List.of(
                section(1, null, "II. 사업의 내용"),
                section(2, 1, "1. 사업의 개요"),
                section(3, 2, "가. 산업의 특성"),
                section(4, 1, "2. 주요 제품 및 서비스"),
                section(5, 1, "3. 원재료 및 생산설비"),
                section(6, 1, "4. 매출 및 수주상황"),
                section(7, 1, "5. 위험관리 및 파생거래"));
        List<DocumentBlock> blocks = List.of(
                paragraph(1, 2, "개요 첫" + LONG),
                paragraph(2, 2, "짧은 소제목"),
                paragraph(3, 3, "산업 특성" + LONG),
                paragraph(4, 3, "산업 둘째" + LONG),
                table(5, 4, "제품 | 비중"),
                paragraph(6, 4, "제품 설명" + LONG),
                paragraph(7, 5, "원재료" + LONG),
                paragraph(8, 6, "매출" + LONG),
                paragraph(9, 7, "위험" + LONG));

        List<BriefingSource> sources = select(sections, blocks);

        assertThat(sources).extracting(BriefingSource::blockNo).containsExactly(1, 3, 6, 5, 8, 9);
        assertThat(sources).extracting(BriefingSource::topic).containsExactly(BriefingTopic.OVERVIEW,
                BriefingTopic.OVERVIEW, BriefingTopic.PRODUCTS, BriefingTopic.PRODUCTS, BriefingTopic.SALES,
                BriefingTopic.RISK);
        assertThat(sources.get(1).sectionPath()).isEqualTo("II. 사업의 내용 > 1. 사업의 개요 > 가. 산업의 특성");
        assertThat(sources.get(0).evidenceId()).isEqualTo(R + "#B1");
    }

    @Test
    @DisplayName("하위 목차를 찾지 못하면 사업의 내용 앞 문단 3개를 개요로 쓴다")
    void fallsBackToFirstBusinessParagraphs() {
        List<DocumentSection> sections = List.of(section(1, null, "II.사업의내용"), section(2, 1, "가. 기타"));
        List<DocumentBlock> blocks = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            blocks.add(paragraph(i, i % 2 + 1, i + "번" + LONG));
        }

        assertThat(select(sections, blocks)).extracting(BriefingSource::blockNo).containsExactly(1, 2, 3);
    }

    @Test
    @DisplayName("사업의 내용이 없으면 후보가 없다")
    void noBusinessSectionMeansNoSources() {
        List<DocumentSection> sections = List.of(section(1, null, "I. 회사의 개요"));

        assertThat(select(sections, List.of(paragraph(1, 1, "개요" + LONG)))).isEmpty();
    }

    @Test
    @DisplayName("위험이 모자라면 투자자 보호 대목차 문단으로 채우고, 글은 2,000자까지 자른다")
    void fillsRiskFromInvestorProtectionAndClipsText() {
        List<DocumentSection> sections = List.of(
                section(1, null, "II. 사업의 내용"),
                section(2, 1, "1. 사업의 개요"),
                section(3, null, "XI. 그 밖에 투자자 보호를 위하여 필요한 사항"));
        List<DocumentBlock> blocks = List.of(
                paragraph(1, 2, "가".repeat(2500)),
                paragraph(2, 3, "우발부채" + LONG),
                paragraph(3, 3, "제재" + LONG),
                paragraph(4, 3, "기타" + LONG));

        List<BriefingSource> sources = select(sections, blocks);

        assertThat(sources).extracting(BriefingSource::blockNo).containsExactly(1, 2, 3);
        assertThat(sources.get(0).text()).hasSize(2000);
        assertThat(sources.get(2).topic()).isEqualTo(BriefingTopic.RISK);
    }
}
