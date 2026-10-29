package com.dartinsight.analysis.domain;

import com.dartinsight.document.domain.DocumentBlock;
import com.dartinsight.document.domain.DocumentSection;
import com.dartinsight.document.domain.ReportDocument;
import com.dartinsight.financial.domain.AccountAliases;
import com.dartinsight.financial.domain.FsDiv;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 재무 수치 근거의 원문 표 위치와 관련 문장 변경 매칭(3.14, FS-8 W-03 ②).
 * 외부 서버 호출 없이 순수 도메인 규칙으로 매칭한다.
 */
public final class FinancialEvidenceMatcher {

    private static final int MAX_RELATED_TEXT_CHANGES = 3;

    private FinancialEvidenceMatcher() {
    }

    public record TableLocation(int sectionNo, int blockNo) {
    }

    public record RelatedTextChange(
            Long changeId,
            String changeType,
            String sectionPath,
            String preview,
            String side,
            Integer sectionNo,
            Integer blockNo) {
    }

    /**
     * 보고서 원문에서 해당 재무제표의 표 위치(sectionNo, blockNo)를 찾는다.
     * 원문이 없거나 분석 완료 후 재구조화되었거나 표를 찾지 못하면 null.
     */
    public static TableLocation findTableLocation(
            ReportDocument doc,
            List<DocumentSection> sections,
            List<DocumentBlock> blocks,
            FsDiv fsDiv,
            String sjDiv,
            String accountName,
            LocalDateTime analysisCompletedAt) {
        if (doc == null || !doc.getStatus().usable() || doc.restructuredAfter(analysisCompletedAt)) {
            return null;
        }
        if (sections == null || sections.isEmpty() || blocks == null || blocks.isEmpty() || sjDiv == null) {
            return null;
        }

        List<String> keywords = statementKeywords(sjDiv);
        if (keywords.isEmpty()) {
            return null;
        }

        boolean preferConsolidated = fsDiv == FsDiv.CFS;
        List<DocumentSection> candidates = new ArrayList<>();
        for (DocumentSection section : sections) {
            String title = section.title();
            if (title == null || title.contains("주석")) {
                continue;
            }
            for (String kw : keywords) {
                if (title.contains(kw)) {
                    candidates.add(section);
                    break;
                }
            }
        }

        if (candidates.isEmpty()) {
            return null;
        }

        candidates.sort((s1, s2) -> {
            boolean c1 = s1.title().contains("연결");
            boolean c2 = s2.title().contains("연결");
            if (preferConsolidated) {
                if (c1 != c2) {
                    return c1 ? -1 : 1;
                }
            } else {
                if (c1 != c2) {
                    return c1 ? 1 : -1;
                }
            }
            return Integer.compare(s1.sectionNo(), s2.sectionNo());
        });

        Set<Integer> targetSectionNos = new LinkedHashSet<>();
        for (DocumentSection s : candidates) {
            targetSectionNos.add(s.sectionNo());
        }

        List<DocumentBlock> targetTableBlocks = blocks.stream()
                .filter(b -> targetSectionNos.contains(b.sectionNo()))
                .filter(b -> DocumentBlock.TABLE.equals(b.type()))
                .toList();

        if (targetTableBlocks.isEmpty()) {
            return null;
        }

        String compactAccount = compact(accountName);
        if (!compactAccount.isEmpty()) {
            for (DocumentBlock block : targetTableBlocks) {
                if (compact(block.text()).contains(compactAccount)) {
                    return new TableLocation(block.sectionNo(), block.blockNo());
                }
            }
        }

        DocumentBlock first = targetTableBlocks.getFirst();
        return new TableLocation(first.sectionNo(), first.blockNo());
    }

    /**
     * 같은 분석의 문장 변경 중 이 계정과 연관된 항목을 찾아 중요도 순으로 최대 3건 반환한다.
     */
    public static List<RelatedTextChange> relatedTextChanges(
            FinancialChange change,
            List<TextChange> textChanges) {
        if (change == null || textChanges == null || textChanges.isEmpty()) {
            return List.of();
        }

        Set<String> searchTerms = extractSearchTerms(change);
        if (searchTerms.isEmpty()) {
            return List.of();
        }

        record ScoredChange(TextChange textChange, int score) {
        }

        List<ScoredChange> scoredList = new ArrayList<>();
        for (TextChange tc : textChanges) {
            TextChangeRow row = tc.row();
            if (TextChangeRow.REVIEW_NEEDED.equals(row.changeType())) {
                continue;
            }

            int score = scoreMatch(row, searchTerms);
            if (score > 0) {
                scoredList.add(new ScoredChange(tc, score));
            }
        }

        scoredList.sort(Comparator
                .comparingInt(ScoredChange::score).reversed()
                .thenComparingInt(sc -> sc.textChange().changeNo()));

        return scoredList.stream()
                .limit(MAX_RELATED_TEXT_CHANGES)
                .map(sc -> toRelatedTextChange(sc.textChange()))
                .toList();
    }

    private static Set<String> extractSearchTerms(FinancialChange change) {
        Set<String> terms = new LinkedHashSet<>();
        String accountId = change.getCurrentAccountId() != null
                ? change.getCurrentAccountId()
                : change.getPreviousAccountId();

        for (String alias : AccountAliases.of(accountId, change.getAccountName())) {
            String c = compact(alias);
            if (c.length() >= 2) {
                terms.add(c);
            }
        }

        String name = compact(change.getAccountName());
        if (name.length() >= 2) {
            terms.add(name);
        }

        return terms;
    }

    private static int scoreMatch(TextChangeRow row, Set<String> searchTerms) {
        String sectionPath = row.sectionPath() != null ? row.sectionPath() : "";
        String prevText = row.previous() != null && row.previous().text() != null ? row.previous().text() : "";
        String currText = row.current() != null && row.current().text() != null ? row.current().text() : "";

        String compactSection = compact(sectionPath);
        String compactPrev = compact(prevText);
        String compactCurr = compact(currText);

        boolean textMatched = false;
        boolean sectionMatched = false;

        for (String term : searchTerms) {
            if (compactSection.contains(term)) {
                sectionMatched = true;
            }
            if (compactCurr.contains(term) || compactPrev.contains(term)) {
                textMatched = true;
            }
        }

        if (!textMatched && !sectionMatched) {
            return 0;
        }

        int score = 1;
        if (compactSection.contains("주석") || compactSection.contains("재무에관한사항")) {
            score += 4;
        }
        if (compactSection.contains("사업의내용")) {
            score += 2;
        }
        if (sectionMatched) {
            score += 3;
        }
        if (row.priority() != null) {
            if ("HIGH".equals(row.priority().level())) {
                score += 2;
            } else if ("MEDIUM".equals(row.priority().level())) {
                score += 1;
            }
        }

        return score;
    }

    private static RelatedTextChange toRelatedTextChange(TextChange tc) {
        TextChangeRow row = tc.row();
        boolean isDeleted = TextChangeRow.DELETED.equals(row.changeType());
        String side = isDeleted ? "previous" : "current";

        Integer sectionNo = isDeleted
                ? (row.previous() != null ? row.previous().sectionNo() : null)
                : (row.current() != null ? row.current().sectionNo() : null);

        Integer blockNo = isDeleted
                ? (row.previous() != null ? row.previous().blockNo() : null)
                : (row.current() != null ? row.current().blockNo() : null);

        String previous = row.previous() == null ? null : row.previous().text();
        String current = row.current() == null ? null : row.current().text();

        String preview;
        if (isDeleted) {
            preview = TextPreview.cut(previous, 0);
        } else {
            int from = TextPreview.firstDifference(previous, current);
            preview = TextPreview.cut(current != null ? current : previous, from);
        }

        return new RelatedTextChange(
                tc.id(),
                row.changeType(),
                row.sectionPath(),
                preview,
                side,
                sectionNo,
                blockNo);
    }

    private static List<String> statementKeywords(String sjDiv) {
        return switch (sjDiv) {
            case "BS" -> List.of("재무상태표");
            case "IS" -> List.of("손익계산서");
            case "CIS" -> List.of("포괄손익계산서", "손익계산서");
            case "CF" -> List.of("현금흐름표");
            case "SCE" -> List.of("자본변동표");
            default -> List.of();
        };
    }

    private static String compact(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("\\s+", "");
    }
}
