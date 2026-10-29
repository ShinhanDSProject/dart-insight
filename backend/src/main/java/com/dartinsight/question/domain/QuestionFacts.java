package com.dartinsight.question.domain;

import com.dartinsight.analysis.domain.FinancialChange;
import com.dartinsight.analysis.domain.FinancialChangeRow;
import com.dartinsight.financial.domain.AccountAliases;
import com.dartinsight.summary.domain.FinancialFacts;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 질문에 나온 계정의 사실 문장(ADR-0023). 계정 이름(공백 무시)이나 그 계정의 검색어(AccountAliases)가 질문에 들어
 * 있으면 고른다. 질문에서 먼저 나온 계정, 손익계산서·포괄손익계산서·재무상태표·현금흐름표 순, 표의 순서로 최대 3개.
 * 증감액을 계산한 계정만 쓰고(값이 같거나 계산하지 못한 계정은 빼고), 이전·현재 금액이 같은 계정(같은 계정이 손익계산서와
 * 포괄손익계산서에 함께 있는 경우)은 한 번만 쓴다. 문장은 코드(FinancialFacts)가 만든다.
 */
public final class QuestionFacts {

    static final int MAX_FACTS = 3;
    /** 계정 이름 일부로 맞출 질문 낱말의 최소 길이(2자는 '자산' 같은 낱말이 너무 많이 걸림) */
    static final int PART_TERM_LENGTH = 3;
    /** 이름 일부로 맞춘 계정은 이름이 질문에 그대로 나온 계정 뒤에 둔다 */
    private static final int PART_POSITION = 10_000;
    private static final List<String> STATEMENT_ORDER = List.of("IS", "CIS", "BS", "CF", "SCE");

    private QuestionFacts() {
    }

    public static List<QuestionFact> match(String question, List<FinancialChange> changes) {
        String compactQuestion = QuestionRetriever.compact(question);
        // 질문 낱말이 계정 이름 안에 있으면(예: '차입금' → 단기차입금·장기차입금) 이름이 바로 나온 계정 다음 순서로 고른다
        List<String> partTerms = QuestionRetriever.terms(question).stream()
                .filter(t -> t.length() >= PART_TERM_LENGTH).toList();
        List<Candidate> candidates = new ArrayList<>();
        for (FinancialChange change : changes) {
            if (change.getPreviousAmount() == null || change.getCurrentAmount() == null
                    || change.getChangeAmount() == null || change.getChangeAmount() == 0) {
                continue;
            }
            int position = firstPosition(compactQuestion, terms(change));
            if (position < 0) {
                position = partPosition(partTerms, QuestionRetriever.compact(change.getAccountName()));
            }
            if (position >= 0) {
                candidates.add(new Candidate(position, change));
            }
        }
        candidates.sort(Comparator.comparingInt(Candidate::position)
                .thenComparingInt(c -> statementRank(c.change().getSjDiv()))
                .thenComparingInt(c -> c.change().getDisplayOrder()));
        List<QuestionFact> facts = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Candidate candidate : candidates) {
            FinancialChange c = candidate.change();
            if (facts.size() == MAX_FACTS) {
                break;
            }
            if (seen.add(QuestionRetriever.compact(c.getAccountName()) + "|" + c.getPreviousAmount() + "|"
                    + c.getCurrentAmount())) {
                facts.add(fact("F" + (facts.size() + 1), c));
            }
        }
        return facts;
    }

    public static QuestionFact fact(String ref, FinancialChange c) {
        return new QuestionFact(ref, c.getId(), c.getSjDiv(), c.getAccountName(), FinancialFacts.sentence(row(c)));
    }

    /** 사실 문장을 다시 만들 수 있는 계정인지(저장된 사실을 다시 보일 때) */
    public static boolean hasFact(FinancialChange c) {
        return c.getPreviousAmount() != null && c.getCurrentAmount() != null && c.getChangeAmount() != null
                && c.getChangeAmount() != 0;
    }

    private static List<String> terms(FinancialChange change) {
        String accountId = change.getCurrentAccountId() != null ? change.getCurrentAccountId()
                : change.getPreviousAccountId();
        Set<String> terms = new LinkedHashSet<>();
        String name = QuestionRetriever.compact(change.getAccountName());
        if (name.length() >= QuestionRetriever.MIN_TERM_LENGTH) {
            terms.add(name);
        }
        AccountAliases.of(accountId, change.getAccountName()).forEach(t -> terms.add(QuestionRetriever.compact(t)));
        return List.copyOf(terms);
    }

    private static int partPosition(List<String> partTerms, String compactName) {
        for (int i = 0; i < partTerms.size(); i++) {
            if (compactName.contains(partTerms.get(i))) {
                return PART_POSITION + i;
            }
        }
        return -1;
    }

    private static int firstPosition(String compactQuestion, List<String> terms) {
        int first = -1;
        for (String term : terms) {
            int at = term.isEmpty() ? -1 : compactQuestion.indexOf(term);
            if (at >= 0 && (first < 0 || at < first)) {
                first = at;
            }
        }
        return first;
    }

    private static int statementRank(String sjDiv) {
        int rank = STATEMENT_ORDER.indexOf(sjDiv);
        return rank < 0 ? STATEMENT_ORDER.size() : rank;
    }

    private static FinancialChangeRow row(FinancialChange c) {
        return new FinancialChangeRow(c.getSjDiv(), c.getFsDiv(), c.getAccountKey(), c.getAccountName(),
                c.getDisplayOrder(), c.getAmountBasis(), c.getPreviousAmount(), c.getCurrentAmount(),
                c.getChangeAmount(), c.getChangeRate(), c.getCalcStatus(), c.getCurrency(), null, null,
                c.getAccountDetail());
    }

    private record Candidate(int position, FinancialChange change) {
    }
}
