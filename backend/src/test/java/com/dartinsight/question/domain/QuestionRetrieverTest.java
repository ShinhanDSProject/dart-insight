package com.dartinsight.question.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.dartinsight.document.domain.DocumentBlock;
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
    @DisplayName("점수 높은 순, 같으면 문장이 든 문단 먼저, 현재 보고서 먼저, 그다음 문서 순서로 6개까지 고른다")
    void sourcesAreRankedByScoreThenSentenceThenCurrentFirstThenOrder() {
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

        List<QuestionSource> sources = QuestionRetriever.sources("매출액 메모리", current, Map.of(1, "II. 사업의 내용"),
                previous, Map.of());

        // '메모리 사업 5'처럼 문장이 아닌 문단은 점수가 같아도 이전 보고서의 문장 뒤로 간다
        assertThat(sources).extracting(QuestionSource::evidenceId).containsExactly(
                CUR + "#B4", PREV + "#B1", CUR + "#B1", PREV + "#B2", CUR + "#B5", CUR + "#B6");
        assertThat(sources.getFirst().side()).isEqualTo("current");
        assertThat(sources.getFirst().sectionPath()).isEqualTo("II. 사업의 내용");
        assertThat(sources.get(1).side()).isEqualTo("previous");
        assertThat(sources.get(1).sectionPath()).isEmpty();
    }

    @Test
    @DisplayName("긴 문단은 1,200자까지만 보내고, 낱말이 없으면 후보도 없다")
    void longTextIsTruncatedAndNoTermsMeansNoSources() {
        DocumentBlock longBlock = paragraph(CUR, 1, "매출액" + "가".repeat(2000));
        List<QuestionSource> sources = QuestionRetriever.sources("매출액", List.of(longBlock), Map.of(), List.of(),
                Map.of());
        assertThat(sources.getFirst().text()).hasSize(QuestionRetriever.MAX_SOURCE_CHARS);
        assertThat(QuestionRetriever.sources("왜?", List.of(longBlock), Map.of(), List.of(), Map.of())).isEmpty();
    }

    @Test
    @DisplayName("질문 낱말의 절반 이상이 들어 있는 문단만 후보로 고른다")
    void sourcesNeedAtLeastHalfOfTheTerms() {
        assertThat(QuestionRetriever.minScore(1)).isEqualTo(1);
        assertThat(QuestionRetriever.minScore(2)).isEqualTo(1);
        assertThat(QuestionRetriever.minScore(3)).isEqualTo(2);
        assertThat(QuestionRetriever.minScore(4)).isEqualTo(2);
    }

    @Test
    @DisplayName("'액'으로 끝나는 3자 이상 낱말은 '액'을 뗀 말도 같은 낱말로 한 번만 센다")
    void amountTermsAlsoMatchTheirStem() {
        assertThat(QuestionRetriever.variants("매출액")).containsExactly("매출액", "매출");
        assertThat(QuestionRetriever.variants("금액")).containsExactly("금액");
        assertThat(QuestionRetriever.variants("차입금")).containsExactly("차입금");
        assertThat(QuestionRetriever.score(List.of("매출액"), "반기 매출은 305조원으로 증가하였습니다.")).isEqualTo(1);
        assertThat(QuestionRetriever.score(List.of("매출액"), "매출액과 매출이 모두 나옵니다.")).isEqualTo(1);
    }

    @Test
    @DisplayName("질문의 증감 방향에 맞는 낱말을 고르고, 방향이 없으면 고르지 않는다")
    void directionWordsFollowTheQuestion() {
        assertThat(QuestionRetriever.directionWords("매출액은 왜 늘었나요?")).containsExactly("증가", "늘어", "늘었");
        assertThat(QuestionRetriever.directionWords("영업이익이 감소한 이유는?")).containsExactly("감소", "줄어", "줄었");
        assertThat(QuestionRetriever.directionWords("과징금 관련 내용이 있나요?")).isEmpty();
    }

    @Test
    @DisplayName("문장(…다.)이 든 문단과 제목 줄·목록 항목을 가른다")
    void sentenceParagraphsAreTold() {
        assertThat(QuestionRetriever.isSentence("매출은 98.7% 증가하였습니다.")).isTrue();
        assertThat(QuestionRetriever.isSentence("증가하였으며, 주요 매출처는 다음과 같습니다")).isTrue();
        assertThat(QuestionRetriever.isSentence("(3) 판매경로별 매출액 비중")).isFalse();
        assertThat(QuestionRetriever.isSentence("13) 최근사업연도 매출액의 5%이상 상당 제품수거, 파기")).isFalse();
    }

    @Test
    @DisplayName("삼성전자 반기보고서: '매출액은 왜 늘었나요?'에 매출 증가를 적은 문단이 제목 줄·안건 목록보다 먼저 온다")
    void revenueQuestionFindsParagraphsThatSayRevenueRose() {
        // 실제 원문(#600). 현재 20260814003699, 이전 20250814003156. 문단은 앞부분만 옮겼다
        String cur = "20260814003699";
        String prev = "20250814003156";
        List<DocumentBlock> current = List.of(
                paragraph(cur, 100, "2026년 반기 당사의 매출은 305조 3,729억원으로 전년 동기 대비 98.7% 증가하였으며, "
                        + "주요 매출처로는 Alphabet, Amazon, Apple 등(알파벳순)이 있습니다."),
                paragraph(cur, 140, "가. 매출실적 2026년(제58기) 반기 매출은 305조 3,729억원으로 전년 동기 대비 98.7% "
                        + "증가하였습니다. 부문별로는 전년 동기 대비 DX 부문이 5.7% 증가, DS 부문이 294.7% 증가하였습니다."),
                paragraph(cur, 161, "(3) 판매경로별 매출액 비중"),
                paragraph(cur, 171, "마. 주요 매출처 2026년 반기 당사의 주요 5대 매출처에 대한 매출 비중은 전체 매출액 대비 "
                        + "약 25% 수준입니다."),
                paragraph(cur, 1372, "13) 최근사업연도 매출액의 5%이상 상당 제품수거, 파기"),
                paragraph(cur, 1373, "14) 최근사업연도 매출액의 5%이상 상당 단일계약 체결"),
                paragraph(cur, 1374, "15) 최근사업연도 매출액의 5%이상 상당 단일판매 대행 또는"));
        List<DocumentBlock> previous = List.of(
                paragraph(prev, 91, "2025년 반기 당사의 매출은 153조 7,068억원으로 전년 동기 대비 5.3% 증가하였으며, "
                        + "주요 매출처로는 Apple 등이 있습니다."),
                paragraph(prev, 131, "가. 매출실적 2025년(제57기) 반기 매출은 153조 7,068억원으로 전년 동기 대비 5.3% "
                        + "증가하였습니다."),
                paragraph(prev, 152, "(3) 판매경로별 매출액 비중"));

        List<QuestionSource> sources = QuestionRetriever.sources("매출액은 왜 늘었나요?", current, Map.of(), previous,
                Map.of());

        // 매출 증가 문단(점수 2) → 문장인 주요 매출처(1) → 제목 줄(1), 안건 목록은 6개 안에 들지 못한다
        assertThat(sources).extracting(QuestionSource::evidenceId).containsExactly(
                cur + "#B100", cur + "#B140", prev + "#B91", prev + "#B131", cur + "#B171", cur + "#B161");
    }
}
