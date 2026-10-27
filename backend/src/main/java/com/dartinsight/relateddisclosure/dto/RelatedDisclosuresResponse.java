package com.dartinsight.relateddisclosure.dto;

import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.relateddisclosure.domain.ChangeRelatedDisclosures;
import com.dartinsight.relateddisclosure.domain.DisclosureDetailType;
import com.dartinsight.relateddisclosure.domain.DisclosureTiming;
import com.dartinsight.relateddisclosure.domain.DisclosureWindow;
import com.dartinsight.relateddisclosure.domain.MatchLevel;
import com.dartinsight.relateddisclosure.domain.RelatedDisclosureRules;
import com.dartinsight.relateddisclosure.domain.RelatedLink;
import com.dartinsight.relateddisclosure.domain.RelatedStatus;
import com.dartinsight.relateddisclosure.domain.WindowDisclosure;
import com.dartinsight.report.domain.DartLinks;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/** 문장 변경의 관련 수시공시 응답(docs/api-spec.md GET /api/analyses/{analysisId}/text-changes/{changeId}/related-disclosures) */
public record RelatedDisclosuresResponse(
        long analysisId,
        long changeId,
        RelatedStatus status,
        ErrorCode unavailableReason,
        boolean partial,
        Window window,
        String ruleVersion,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss") LocalDateTime computedAt,
        boolean cached,
        List<Item> items,
        String notice) {

    public record Window(LocalDate from, LocalDate periodEnd, LocalDate to) {

        static Window from(DisclosureWindow window) {
            return new Window(window.from(), window.periodEnd(), window.to());
        }
    }

    /**
     * @param latestRceptNo 주요정보로 확인한 최신 정정본 접수번호. 모르면 rceptNo와 같음
     * @param matchedFields STRONG일 때 일치한 값 종류. TYPE_ONLY면 빈 배열
     * @param remarks       비고(rm) 원문. 없으면 null
     * @param dartUrl       latestRceptNo의 DART 공시뷰어 주소
     */
    public record Item(String rceptNo, String latestRceptNo, String reportName, LocalDate receivedDate,
            DisclosureDetailType disclosureType, DisclosureTiming timing, String matchRule, String matchRuleLabel,
            MatchLevel matchLevel, List<String> matchedFields, String remarks, String dartUrl) {

        static Item from(RelatedLink link) {
            WindowDisclosure d = link.disclosure();
            String latest = link.latestRceptNo() == null ? d.rceptNo() : link.latestRceptNo();
            List<String> fields = link.matchedFields() == null ? List.of()
                    : Arrays.asList(link.matchedFields().split(","));
            return new Item(d.rceptNo(), latest, d.reportName(), d.rceptDt(), d.detailType(), link.timing(),
                    link.matchRule(), RelatedDisclosureRules.label(link.matchRule()), link.matchLevel(), fields,
                    d.remark(), DartLinks.viewer(latest));
        }
    }

    public static RelatedDisclosuresResponse from(ChangeRelatedDisclosures result) {
        return new RelatedDisclosuresResponse(
                result.analysisId(),
                result.changeId(),
                result.status(),
                result.unavailableReason(),
                result.partial(),
                Window.from(result.window()),
                result.ruleVersion(),
                result.computedAt(),
                result.cached(),
                result.links().stream().map(Item::from).toList(),
                RelatedDisclosureRules.NOTICE);
    }
}
