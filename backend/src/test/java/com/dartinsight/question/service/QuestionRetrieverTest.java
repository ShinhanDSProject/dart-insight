package com.dartinsight.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.question.domain.QuestionSource;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class QuestionRetrieverTest {

    private static final String CUR = "20260814000001";
    private static final String PREV = "20250814000001";

    private static DocumentBlock paragraph(String rceptNo, int blockNo, String text) {
        return new DocumentBlock(rceptNo, blockNo, 1, DocumentBlock.PARAGRAPH, text, null);
    }

    @Test
    @DisplayName("조사를 떼고 의문·요청 낱말과 1자 낱말을 버린다")
    void termsDropParticlesAndQuestionWords() {
        assertThat(QuestionRetriever.terms("매출액은 왜 늘었나요?")).containsExactly("매출액");
        assertThat(QuestionRetriever.terms("종속기업의 소송 관련 내용을 알려 주세요"))
                .containsExactly("종속기업", "소송");
        assertThat(QuestionRetriever.terms("HBM 투자에서 어떤 변화가 있었나요")).containsExactly("hbm", "투자");
        assertThat(QuestionRetriever.terms("영업이익이 줄어든 이유는 무엇인가요?"))
                .containsExactly("영업이익");
    }

    @Test
    @DisplayName("2자 낱말은 조사처럼 보여도 떼지 않는다")
    void shortTokensKeepTheirLastLetter() {
        assertThat(QuestionRetriever.stripParticle("주가")).isEqualTo("주가");
        assertThat(QuestionRetriever.stripParticle("원가")).isEqualTo("원가");
        assertThat(QuestionRetriever.stripParticle("회사로")).isEqualTo("회사");
        assertThat(QuestionRetriever.stripParticle("해외로부터")).isEqualTo("해외로부터");
        assertThat(QuestionRetriever.stripParticle("미국으로")).isEqualTo("미국");
    }

    @Test
    @DisplayName("문단 점수는 들어 있는 서로 다른 낱말 수이고 공백·대소문자를 무시한다")
    void scoreCountsDistinctTermsIgnoringSpaces() {
        List<String> terms = List.of("매출액", "메모리", "hbm");
        assertThat(QuestionRetriever.score(terms, "매출 액은 메모리 수요와 HBM 판매로 늘었고 매출액이")).isEqualTo(3);
        assertThat(QuestionRetriever.score(terms, "당사는 반도체를 만듭니다.")).isZero();
    }

    @Test
    @DisplayName("점수 높은 순, 같으면 현재 보고서 먼저, 그다음 문서 순서로 6개까지 고른다")
    void sourcesAreRankedByScoreThenCurrentFirstThenOrder() {
        List<String> terms = List.of("매출액", "메모리");
        List<DocumentBlock> current = new ArrayList<>(List.of(
                paragraph(CUR, 1, "매출액이 늘었습니다."),
                paragraph(CUR, 2, "관련 없는 문단입니다."),
                new DocumentBlock(CUR, 3, 1, DocumentBlock.TABLE, "매출액 | 메모리", null),
                paragraph(CUR, 4, "매출액은 메모리 수요로 늘었습니다.")));
        List<DocumentBlock> previous = List.of(
                paragraph(PREV, 1, "메모리 매출액이 줄었습니다."),
                paragraph(PREV, 2, "매출액이 줄었습니다."));
        for (int i = 5; i < 10; i++) {
            current.add(paragraph(CUR, i, "메모리 사업 " + i));
        }

        List<QuestionSource> sources = QuestionRetriever.sources(terms, current, Map.of(1, "II. 사업의 내용"), previous,
                Map.of());

        assertThat(sources).extracting(QuestionSource::evidenceId).containsExactly(
                CUR + "#B4", PREV + "#B1", CUR + "#B1", CUR + "#B5", CUR + "#B6", CUR + "#B7");
        assertThat(sources.getFirst().side()).isEqualTo("current");
        assertThat(sources.getFirst().sectionPath()).isEqualTo("II. 사업의 내용");
        assertThat(sources.get(1).side()).isEqualTo("previous");
        assertThat(sources.get(1).sectionPath()).isEmpty();
    }

    @Test
    @DisplayName("긴 문단은 1,200자까지만 보내고, 낱말이 없으면 후보도 없다")
    void longTextIsTruncatedAndNoTermsMeansNoSources() {
        DocumentBlock longBlock = paragraph(CUR, 1, "매출액" + "가".repeat(2000));
        List<QuestionSource> sources = QuestionRetriever.sources(List.of("매출액"), List.of(longBlock), Map.of(),
                List.of(), Map.of());
        assertThat(sources.getFirst().text()).hasSize(QuestionRetriever.MAX_SOURCE_CHARS);
        assertThat(QuestionRetriever.sources(List.of(), List.of(longBlock), Map.of(), List.of(), Map.of())).isEmpty();
    }

    @Test
    @DisplayName("질문 낱말의 절반 이상이 들어 있는 문단만 후보로 고른다")
    void sourcesNeedAtLeastHalfOfTheTerms() {
        assertThat(QuestionRetriever.minScore(1)).isEqualTo(1);
        assertThat(QuestionRetriever.minScore(2)).isEqualTo(1);
        assertThat(QuestionRetriever.minScore(3)).isEqualTo(2);
        assertThat(QuestionRetriever.minScore(4)).isEqualTo(2);
    }
}
