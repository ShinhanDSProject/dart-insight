package com.dartinsight.followup.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.outlook.domain.OutlookCategory;
import com.dartinsight.outlook.domain.OutlookItem;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PlanCandidatesTest {

    static final String CUR = "20260310000123";
    static final String PAD = " 이 문단은 후보로 쓸 수 있을 만큼 충분히 길게 적은 원문 문단입니다.";
    static final Map<Integer, String> PATHS = Map.of(1, "II. 사업의 내용", 2, "IV. 이사의 경영진단 및 분석의견");

    private static DocumentBlock paragraph(int blockNo, int sectionNo, String text) {
        return new DocumentBlock(CUR, blockNo, sectionNo, DocumentBlock.PARAGRAPH, text, null);
    }

    private static CompanyPlan plan(int no, String summary, String quote) {
        return new CompanyPlan(no, OutlookCategory.INVESTMENT, summary, quote,
                new OutlookItem.Evidence("20250311000456#B" + no, "20250311000456", 1, no, "II. 사업의 내용"));
    }

    @Test
    @DisplayName("계획 요지·인용과 글자가 많이 겹치는 문단부터 3개까지 고르고, 겹치지 않는 문단은 고르지 않는다")
    void ranksParagraphsByBigramOverlapAndKeepsTopThree() {
        List<DocumentBlock> blocks = List.of(
                paragraph(1, 1, "당기 원재료 매입액은 전기와 비슷한 수준이었습니다." + PAD),
                paragraph(2, 1, "평택 신규 라인은 증설 공사를 진행 중이며 내년 가동을 목표로 합니다." + PAD),
                paragraph(3, 2, "평택 라인 외에 해외 법인의 생산 설비도 점검했습니다." + PAD),
                paragraph(4, 2, "평택 신규 라인 증설 계획은 시장 상황을 고려해 연기하였습니다." + PAD),
                paragraph(5, 2, "배당 정책은 지난해와 같습니다." + PAD),
                paragraph(6, 2, "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789"));
        PlanCandidates index = PlanCandidates.of(blocks, PATHS);

        List<PlanCandidate> candidates = index.forPlans(List.of(
                plan(1, "평택 신규 라인 증설 계획을 밝혔어요.", "당사는 평택 신규 라인 증설을 완료할 계획입니다."))).get(1);

        assertThat(candidates).hasSize(3);
        assertThat(candidates).extracting(PlanCandidate::blockNo).containsExactly(4, 2, 3);
        assertThat(candidates.getFirst().evidenceId()).isEqualTo(CUR + "#B4");
        assertThat(candidates.getFirst().sectionPath()).isEqualTo("IV. 이사의 경영진단 및 분석의견");
        assertThat(candidates).extracting(PlanCandidate::blockNo).doesNotContain(6);
    }

    @Test
    @DisplayName("같은 입력이면 같은 후보가 같은 순서로 나오고, 점수가 같으면 블록 번호가 앞선 것이 먼저다")
    void sameInputGivesSameOrderAndTiesGoToEarlierBlock() {
        List<DocumentBlock> blocks = List.of(
                paragraph(7, 1, "신규 공장 착공 계획을 적은 문단입니다." + PAD),
                paragraph(3, 1, "신규 공장 착공 계획을 적은 문단입니다." + PAD));
        CompanyPlan plan = plan(1, "신규 공장 착공 계획", "신규 공장 착공");

        List<PlanCandidate> first = PlanCandidates.of(blocks, PATHS).forPlans(List.of(plan)).get(1);
        List<PlanCandidate> second = PlanCandidates.of(blocks, PATHS).forPlans(List.of(plan)).get(1);

        assertThat(first).isEqualTo(second);
        assertThat(first).extracting(PlanCandidate::blockNo).containsExactly(3, 7);
    }

    @Test
    @DisplayName("표와 공백을 뺀 40자 미만 문단은 쓰지 않고, 쓸 문단이 없으면 비어 있다")
    void tablesAndShortParagraphsAreNotUsed() {
        List<DocumentBlock> blocks = List.of(
                paragraph(1, 1, "(3) 평택 신규 라인 증설"),
                new DocumentBlock(CUR, 2, 1, DocumentBlock.TABLE, "평택 신규 라인 증설 | 2026" + PAD, "[]"));

        PlanCandidates index = PlanCandidates.of(blocks, PATHS);

        assertThat(index.isEmpty()).isTrue();
        assertThat(index.forPlans(List.of(plan(1, "평택 신규 라인 증설", "평택 신규 라인 증설")))
                .get(1)).isEmpty();
    }

    @Test
    @DisplayName("보내는 글은 2,000자까지 자른다")
    void longParagraphIsClippedToMaxText() {
        String text = "평택 신규 라인 증설 공사를 진행합니다." + "가".repeat(3000);

        List<PlanCandidate> candidates = PlanCandidates.of(List.of(paragraph(1, 1, text)), PATHS)
                .forPlans(List.of(plan(1, "평택 신규 라인", "평택 신규 라인 증설"))).get(1);

        assertThat(candidates.getFirst().text()).hasSize(PlanCandidates.MAX_TEXT);
        assertThat(candidates.getFirst().contains("평택 신규 라인 증설 공사를 진행합니다.")).isTrue();
    }

    @Test
    @DisplayName("글자 2개 단위는 공백을 뺀 글에서 나누고 한 글자는 그대로 둔다")
    void bigramsOfCompactText() {
        assertThat(PlanCandidates.bigrams(PlanCandidates.compact("매출 액"))).containsExactly("매출", "출액");
        assertThat(PlanCandidates.bigrams("가")).containsExactly("가");
        assertThat(PlanCandidates.bigrams("")).isEmpty();
    }
}
