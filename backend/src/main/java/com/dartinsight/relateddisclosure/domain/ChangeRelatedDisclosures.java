package com.dartinsight.relateddisclosure.domain;

import com.dartinsight.common.error.ErrorCode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

/**
 * 문장 변경 하나의 관련 수시공시(#343, docs/api-spec.md GET .../text-changes/{changeId}/related-disclosures).
 *
 * @param unavailableReason UNAVAILABLE일 때 공시 목록을 받지 못한 사유(DART_*). 아니면 null
 * @param partial           주요정보(DS005)를 받지 못해 2단계 판정을 하지 못했으면 true
 * @param computedAt        계산한 시각. UNAVAILABLE이거나 partial이면 이번 응답을 만든 시각
 * @param cached            저장돼 있던 결과를 읽었으면 true
 * @param links             STRONG 먼저, 같으면 접수일이 최근인 순서. NOT_FOUND·UNAVAILABLE이면 빈 목록
 */
public record ChangeRelatedDisclosures(long analysisId, long changeId, RelatedStatus status,
        ErrorCode unavailableReason, boolean partial, DisclosureWindow window, String ruleVersion,
        LocalDateTime computedAt, boolean cached, List<RelatedLink> links) {

    /** 화면 순서: 내용 일치 먼저, 같으면 접수일이 최근인 것, 같은 날이면 접수번호가 큰 것 */
    private static final Comparator<RelatedLink> SCREEN_ORDER = Comparator
            .comparing((RelatedLink link) -> link.matchLevel() == MatchLevel.STRONG ? 0 : 1)
            .thenComparing((RelatedLink link) -> link.disclosure().rceptDt(), Comparator.reverseOrder())
            .thenComparing((RelatedLink link) -> link.disclosure().rceptNo(), Comparator.reverseOrder());

    public ChangeRelatedDisclosures {
        links = List.copyOf(links);
    }

    /** 계산 기록 run에 든 이 변경의 연결. 화면 순서로 두고, 없으면 NOT_FOUND */
    public static ChangeRelatedDisclosures found(long analysisId, long changeId, DisclosureWindow window,
            RelatedRun run, List<RelatedLink> changeLinks, boolean cached, boolean partial) {
        List<RelatedLink> links = changeLinks.stream().sorted(SCREEN_ORDER).toList();
        return new ChangeRelatedDisclosures(analysisId, changeId,
                links.isEmpty() ? RelatedStatus.NOT_FOUND : RelatedStatus.FOUND, null, partial, window,
                run.ruleVersion(), run.computedAt(), cached, links);
    }

    /** 공시 목록을 받지 못해 일시 미제공(저장하지 않음) */
    public static ChangeRelatedDisclosures unavailable(long analysisId, long changeId, DisclosureWindow window,
            ErrorCode reason, LocalDateTime now) {
        return new ChangeRelatedDisclosures(analysisId, changeId, RelatedStatus.UNAVAILABLE, reason, false, window,
                RelatedDisclosureRules.RULE_VERSION, now, false, List.of());
    }
}
