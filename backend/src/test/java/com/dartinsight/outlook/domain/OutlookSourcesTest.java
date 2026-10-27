package com.dartinsight.outlook.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.service.TextEvidenceService;
import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class OutlookSourcesTest {

    static final String R = "20260310000001";
    static final String LONG = " 문단은 근거로 쓸 수 있을 만큼 충분히 길게 적은 원문 문단입니다. 마흔 자를 넘습니다.";

    private static DocumentSection section(int no, Integer parent, String title) {
        return new DocumentSection(no, parent, parent == null ? 1 : 2, title, null, false, 0);
    }

    private static DocumentBlock paragraph(int no, int section, String text) {
        return new DocumentBlock(R, no, section, DocumentBlock.PARAGRAPH, text, null);
    }

    private static List<OutlookSource> select(List<DocumentSection> sections, List<DocumentBlock> blocks) {
        return OutlookSources.select(sections, blocks, TextEvidenceService.paths(sections));
    }

    private static final List<DocumentSection> SECTIONS = List.of(
            section(1, null, "I. 회사의 개요"),
            section(2, null, "II. 사업의 내용"),
            section(3, 2, "1. 사업의 개요"),
            section(4, 2, "3. 원재료 및 생산설비"),
            section(5, 4, "다. 생산설비의 신설·매입 계획"),
            section(6, 2, "6. 주요계약 및 연구개발활동"),
            section(7, 2, "7. 기타 참고사항"),
            section(8, null, "IV. 이사의 경영진단 및 분석의견"),
            section(9, 8, "2. 개요"),
            section(10, null, "XI. 그 밖에 투자자 보호를 위하여 필요한 사항"));

    @Test
    @DisplayName("경영진단 전체와 사업의 내용의 설비·연구개발·기타 참고사항 목차에서 문단을 문서 순서로 고른다")
    void picksParagraphsFromTargetSectionsInDocumentOrder() {
        List<DocumentBlock> blocks = List.of(
                paragraph(1, 1, "회사의 개요에서 신규 사업을 추진할 계획" + LONG),
                paragraph(2, 3, "사업의 개요에서 시장 확대를 전망" + LONG),
                paragraph(3, 4, "원재료 매입 현황" + LONG),
                paragraph(4, 5, "평택 라인 증설 계획" + LONG),
                paragraph(5, 6, "연구개발 실적" + LONG),
                paragraph(6, 7, "신제품 출시 예정" + LONG),
                paragraph(7, 9, "내년 업황 전망" + LONG),
                paragraph(8, 9, "짧은 계획"),
                new DocumentBlock(R, 9, 9, DocumentBlock.TABLE, "계획 | 금액" + LONG, "[]"),
                paragraph(10, 10, "우발부채 계획" + LONG));

        List<OutlookSource> sources = select(SECTIONS, blocks);

        assertThat(sources).extracting(OutlookSource::blockNo).containsExactly(3, 4, 5, 6, 7);
        assertThat(sources).extracting(OutlookSource::planned).containsExactly(false, true, false, true, true);
        assertThat(sources.get(1).evidenceId()).isEqualTo(R + "#B4");
        assertThat(sources.get(1).sectionPath())
                .isEqualTo("II. 사업의 내용 > 3. 원재료 및 생산설비 > 다. 생산설비의 신설·매입 계획");
        assertThat(OutlookSources.anyPlanned(sources)).isTrue();
    }

    @Test
    @DisplayName("12개를 넘으면 계획·전망 낱말이 든 문단을 먼저 남기고, 보낼 때는 문서 순서로 둔다")
    void plannedParagraphsArePreferredWhenOverLimit() {
        List<DocumentBlock> blocks = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            blocks.add(paragraph(i, 9, "지난해 실적 설명 " + i + LONG));
        }
        for (int i = 11; i <= 16; i++) {
            blocks.add(paragraph(i, 9, "내년에 투자할 설비 " + i + LONG));
        }

        List<OutlookSource> sources = select(SECTIONS, blocks);

        assertThat(sources).hasSize(OutlookSources.MAX_SOURCES);
        assertThat(sources.stream().filter(OutlookSource::planned)).hasSize(6);
        assertThat(sources).extracting(OutlookSource::blockNo)
                .containsExactly(1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16);
    }

    @Test
    @DisplayName("대상 목차가 없으면 빈 목록, 낱말 든 문단이 없으면 anyPlanned가 거짓이다")
    void emptyWhenNoTargetSectionsAndNotPlannedWithoutWords() {
        List<DocumentSection> other = List.of(section(1, null, "II. 사업의 내용"), section(2, 1, "1. 사업의 개요"));
        assertThat(select(other, List.of(paragraph(1, 2, "신규 사업 계획" + LONG)))).isEmpty();

        List<OutlookSource> sources = select(SECTIONS, List.of(paragraph(1, 9, "지난해 실적 설명" + LONG)));
        assertThat(sources).hasSize(1);
        assertThat(OutlookSources.anyPlanned(sources)).isFalse();
    }

    @Test
    @DisplayName("글은 2,000자까지 자른다")
    void longTextIsClipped() {
        String text = "계획" + "가".repeat(3000);

        List<OutlookSource> sources = select(SECTIONS, List.of(paragraph(1, 9, text)));

        assertThat(sources.getFirst().text()).hasSize(OutlookSources.MAX_TEXT);
    }

    @Test
    @DisplayName("목차 제목은 공백을 빼고 낱말을 찾는다")
    void titleKeywordsIgnoreSpaces() {
        assertThat(OutlookSources.targetTitle("7. 기타 참고 사항")).isTrue();
        assertThat(OutlookSources.targetTitle("가. 시설 투자 현황")).isTrue();
        assertThat(OutlookSources.targetTitle("4. 매출 및 수주상황")).isFalse();
    }

    @Test
    @DisplayName("인용 비교는 이어진 공백을 한 칸으로 맞춘다")
    void quoteComparisonNormalizesSpaces() {
        OutlookSource source = new OutlookSource(R + "#B1", 1, 1, "", "당사는  평택\n라인을 &lt;증설&gt;할 계획입니다.", true);

        assertThat(source.contains("당사는 평택 라인을 <증설>할 계획")).isTrue();
        assertThat(source.contains("당사는 평택 라인을 늘릴 계획")).isFalse();
        assertThat(source.contains("  ")).isFalse();
        assertThat(source.contains(null)).isFalse();
    }
}
