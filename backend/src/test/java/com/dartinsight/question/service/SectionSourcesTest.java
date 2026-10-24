package com.dartinsight.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.analysis.domain.TextChange;
import com.dartinsight.analysis.domain.TextChangeRow;
import com.dartinsight.analysis.domain.TextChangeRow.Priority;
import com.dartinsight.analysis.domain.TextChangeRow.Side;
import com.dartinsight.question.domain.QuestionSource;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SectionSourcesTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";
    private static final String BUSINESS = "II. 사업의 내용";
    private static final String OTHER = BUSINESS + " > 7. 기타 참고사항";
    private static final List<String> PATHS = List.of("(목차 밖 본문)", "I. 회사의 개요 > 1. 회사의 개요", BUSINESS,
            BUSINESS + " > 1. 사업의 개요", OTHER, "III. 재무에 관한 사항 > 1. 요약재무정보", "XII. 상세표 > 1. 기타");

    @Test
    @DisplayName("앞 번호·공백·따옴표·괄호가 달라도 섹션 제목을 찾는다")
    void detectsSectionIgnoringNumberingSpacesAndQuotes() {
        assertThat(SectionSources.scope("사업의 내용에서 뭐가 바뀌었나요?", PATHS)).contains(BUSINESS);
        assertThat(SectionSources.scope("'II. 사업의 내용'에서 바뀐 점은?", PATHS)).contains(BUSINESS);
        assertThat(SectionSources.scope("「사업의내용」 변화 알려 주세요", PATHS)).contains(BUSINESS);
        assertThat(SectionSources.scope("[사업 의 내용] 요약", PATHS)).contains(BUSINESS);
    }

    @Test
    @DisplayName("하위 목차 제목이 맞으면 그 하위 섹션까지가 범위다")
    void subTitleScopesToSubsection() {
        assertThat(SectionSources.scope("기타 참고사항에 새로 생긴 내용은?", PATHS)).contains(OTHER);
        assertThat(SectionSources.scope("\"7. 기타참고사항\"은 왜 바뀌었나요", PATHS)).contains(OTHER);
    }

    @Test
    @DisplayName("여러 제목이 맞으면 가장 긴 제목을 고른다")
    void picksLongestMatchingTitle() {
        // '사업의내용'(5자)보다 '기타참고사항'(6자)이 길다
        assertThat(SectionSources.scope("사업의 내용 중 기타 참고사항은?", PATHS)).contains(OTHER);
        // '요약재무정보'(6자)보다 '재무에관한사항'(7자)이 길다
        assertThat(SectionSources.scope("재무에 관한 사항의 요약재무정보", PATHS)).contains("III. 재무에 관한 사항");
    }

    @Test
    @DisplayName("4자 미만 제목과 목차 밖 본문, 섹션이 없는 질문은 범위를 정하지 않는다")
    void ignoresShortTitlesAndOutsideToc() {
        assertThat(SectionSources.scope("기타 사항은?", PATHS)).isEmpty();
        assertThat(SectionSources.scope("상세표를 보여 주세요", PATHS)).isEmpty();
        assertThat(SectionSources.scope("(목차 밖 본문)에는 뭐가 있나요", PATHS)).isEmpty();
        assertThat(SectionSources.scope("매출액은 왜 늘었나요?", PATHS)).isEmpty();
        assertThat(SectionSources.scope("사업의 내용", List.of())).isEmpty();
    }

    @Test
    @DisplayName("제목 비교 꼴은 공백·따옴표를 빼고 앞 번호를 뗀다")
    void titleStripsLeadingNumbering() {
        assertThat(SectionSources.title("II. 사업의 내용")).isEqualTo("사업의내용");
        assertThat(SectionSources.title("7. 기타 참고사항")).isEqualTo("기타참고사항");
        assertThat(SectionSources.title("가. 업계의 현황")).isEqualTo("업계의현황");
        assertThat(SectionSources.title("(1) 산업의 특성")).isEqualTo("산업의특성");
        assertThat(SectionSources.title("【 대표이사 등의 확인 】")).isEqualTo("대표이사등의확인");
    }

    private static TextChange change(int no, String type, Integer score, Side previous, Side current) {
        Priority priority = score == null ? new Priority(Priority.UNRANKED, null, List.of(), "p-1")
                : new Priority("HIGH", score, List.of(), "p-1");
        return new TextChange(no * 10L, no, new TextChangeRow(type, "PARAGRAPH", false, "MATCHED", "7. 기타 참고사항",
                OTHER, previous, current, null, null, priority));
    }

    private static Side cur(int blockNo, String text) {
        return new Side(CUR, 5, blockNo, text);
    }

    private static Side prev(int blockNo, String text) {
        return new Side(PREV, 5, blockNo, text);
    }

    @Test
    @DisplayName("후보는 우선순위 점수가 높은 순, 같으면 문서 순서이고 변경마다 현재 쪽 다음 이전 쪽이다")
    void sourcesFollowPriorityThenDocumentOrderWithCurrentFirst() {
        List<QuestionSource> sources = SectionSources.sources(List.of(
                change(1, TextChangeRow.ADDED, 2, null, cur(11, "추가된 문단")),
                change(2, TextChangeRow.MODIFIED, 5, prev(20, "고치기 전"), cur(21, "고친 뒤")),
                change(3, TextChangeRow.DELETED, null, prev(30, "지운 문단"), null),
                change(4, TextChangeRow.ADDED, 2, null, cur(41, "또 추가된 문단"))));

        assertThat(sources).extracting(QuestionSource::evidenceId).containsExactly(CUR + "#B21", PREV + "#B20",
                CUR + "#B11", CUR + "#B41", PREV + "#B30");
        assertThat(sources).extracting(QuestionSource::side).containsExactly("current", "previous", "current",
                "current", "previous");
        QuestionSource first = sources.getFirst();
        assertThat(first.rceptNo()).isEqualTo(CUR);
        assertThat(first.sectionNo()).isEqualTo(5);
        assertThat(first.blockNo()).isEqualTo(21);
        assertThat(first.sectionPath()).isEqualTo(OTHER);
        assertThat(first.text()).isEqualTo("고친 뒤");
    }

    @Test
    @DisplayName("검토 필요·글 없는 쪽·블록 번호 없는 쪽은 빼고, 6개까지 글 1,200자까지 보낸다")
    void sourcesSkipUnusableSidesAndAreLimited() {
        List<TextChange> changes = new ArrayList<>();
        changes.add(change(1, TextChangeRow.REVIEW_NEEDED, 9, prev(1, "검토 필요"), cur(2, "검토 필요")));
        changes.add(change(2, TextChangeRow.ADDED, 8, null, new Side(CUR, 5, null, "섹션 단위")));
        changes.add(change(3, TextChangeRow.ADDED, 8, null, cur(3, "  ")));
        changes.add(change(4, TextChangeRow.ADDED, 7, null, cur(4, "가".repeat(1500))));
        for (int no = 5; no <= 9; no++) {
            changes.add(change(no, TextChangeRow.MODIFIED, 1, prev(no * 10, "전 " + no), cur(no * 10 + 1, "후 " + no)));
        }

        List<QuestionSource> sources = SectionSources.sources(changes);

        assertThat(sources).hasSize(QuestionRetriever.MAX_SOURCES);
        assertThat(sources).extracting(QuestionSource::evidenceId).containsExactly(CUR + "#B4", CUR + "#B51",
                PREV + "#B50", CUR + "#B61", PREV + "#B60", CUR + "#B71");
        assertThat(sources.getFirst().text()).hasSize(QuestionRetriever.MAX_SOURCE_CHARS);
    }
}
