package com.dartinsight.analysis.domain;

import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.financial.domain.FinancialAccount;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * 분석 결과를 저장하기 전의 근거 확인(2.3 근거 확인 단계). 재무 수치는 짝지은 계정·근거 접수번호·증감액을,
 * 문장 비교는 변경 유형과 위치·원문 글을 본다. 문제가 있으면 설명을, 없으면 null을 돌려준다.
 */
public final class EvidenceVerifier {

    private static final Set<String> BLOCK_TYPES = Set.of(DocumentBlock.PARAGRAPH, DocumentBlock.TABLE,
            TextChangeRow.SECTION);

    private EvidenceVerifier() {
    }

    /**
     * 근거 확인: 값이 있는 계정은 그 보고서의 접수번호를 근거로 갖고, 두 보고서에서 짝지은 계정은 같은 계정이며
     * (표준계정코드가 같고, 표준계정이 아니면 정규화한 계정명이 같음. 계정 ID가 바뀌어 이름으로 짝지은 계정은
     * 정규화한 계정명이 같음), 증감액이 두 값의 차와 같아야 한다.
     *
     * @return 문제가 있으면 설명, 없으면 null
     */
    public static String verifyFinancial(Analysis analysis, List<FinancialChangeRow> rows) {
        for (FinancialChangeRow row : rows) {
            if (row.previous() != null && row.current() != null && !sameAccount(row)) {
                return "다른 계정끼리 짝지었어요: " + row.accountName();
            }
            if (row.previousAmount() != null && (row.previous() == null
                    || !analysis.getPreviousRceptNo().equals(row.previous().rceptNo()))) {
                return "이전 값의 근거가 비교 보고서가 아니에요: " + row.accountName();
            }
            if (row.currentAmount() != null && (row.current() == null
                    || !analysis.getCurrentRceptNo().equals(row.current().rceptNo()))) {
                return "현재 값의 근거가 현재 보고서가 아니에요: " + row.accountName();
            }
            if (row.changeAmount() != null && (row.previousAmount() == null || row.currentAmount() == null
                    || !Objects.equals(row.changeAmount(), row.currentAmount() - row.previousAmount()))) {
                return "증감액이 두 값의 차와 달라요: " + row.accountName();
            }
        }
        return null;
    }

    /**
     * 문장 비교 근거 확인: 변경 유형에 맞는 쪽에 위치가 있고, 위치는 이 분석의 두 보고서이며,
     * 문단·표 변경은 저장된 원문 글을 가리켜야 한다. 짝을 정하지 못한 섹션은 검토 필요 사유가 있어야 한다.
     *
     * @return 문제가 있으면 설명, 없으면 null
     */
    public static String verifyText(Analysis analysis, List<TextChangeRow> rows) {
        for (TextChangeRow row : rows) {
            if (!BLOCK_TYPES.contains(String.valueOf(row.blockType())) || row.sectionStatus() == null
                    || row.sectionTitle() == null || row.sectionPath() == null) {
                return "변경 항목의 종류나 항목 이름이 비어 있어요: " + row.blockType() + " " + row.sectionPath();
            }
            boolean hasPrevious = row.previous() != null;
            boolean hasCurrent = row.current() != null;
            boolean shapeOk = switch (row.changeType() == null ? "" : row.changeType()) {
                case TextChangeRow.ADDED -> !hasPrevious && hasCurrent;
                case TextChangeRow.DELETED -> hasPrevious && !hasCurrent;
                case TextChangeRow.MODIFIED, TextChangeRow.NUMERIC_UPDATE -> hasPrevious && hasCurrent;
                case TextChangeRow.MOVED -> hasPrevious && hasCurrent && row.previousSectionPath() != null;
                case TextChangeRow.REVIEW_NEEDED -> (hasPrevious || hasCurrent) && row.reviewReason() != null;
                default -> false;
            };
            if (!shapeOk) {
                return "변경 유형과 위치가 맞지 않아요: " + row.changeType() + " " + row.sectionPath();
            }
            if (hasPrevious && !analysis.getPreviousRceptNo().equals(row.previous().rceptNo())
                    || hasCurrent && !analysis.getCurrentRceptNo().equals(row.current().rceptNo())) {
                return "변경 위치가 이 분석의 보고서가 아니에요: " + row.sectionPath();
            }
            if (row.priority() != null && TextChangeRow.REVIEW_NEEDED.equals(row.changeType())
                    != TextChangeRow.Priority.UNRANKED.equals(row.priority().level())) {
                return "검토 필요 항목만 순위를 매기지 않아야 해요: " + row.sectionPath();
            }
            if (row.priority() != null && !TextChangeRow.Priority.UNRANKED.equals(row.priority().level())
                    && row.priority().score() == null) {
                return "우선순위 점수가 없어요: " + row.sectionPath();
            }
            if (!TextChangeRow.SECTION.equals(row.blockType())
                    && (hasPrevious && (row.previous().blockNo() == null || row.previous().text() == null)
                    || hasCurrent && (row.current().blockNo() == null || row.current().text() == null))) {
                return "변경 위치의 원문을 찾지 못했어요: " + row.sectionPath();
            }
        }
        return null;
    }

    private static boolean sameAccount(FinancialChangeRow row) {
        FinancialChangeRow.Evidence previous = row.previous();
        FinancialChangeRow.Evidence current = row.current();
        boolean sameName = Objects.equals(FinancialComparator.normalize(previous.accountName()),
                FinancialComparator.normalize(current.accountName()));
        if (!Objects.equals(previous.accountId(), current.accountId())) {
            return sameName && row.accountKey().startsWith(FinancialComparator.NAME_KEY_PREFIX);
        }
        boolean standard = previous.accountId() != null && !previous.accountId().isBlank()
                && !FinancialAccount.NON_STANDARD_ACCOUNT_ID.equals(previous.accountId());
        return standard || sameName;
    }
}
