package com.dartinsight.community.service;

import com.dartinsight.community.domain.CommunityModeration;
import com.dartinsight.community.domain.CommunityReport;
import com.dartinsight.community.domain.CommunityRepostRequest;
import com.dartinsight.community.domain.ReportState;
import com.dartinsight.community.domain.TargetType;
import com.dartinsight.community.repository.CommunityModerationRepository;
import com.dartinsight.community.repository.CommunityReportRepository;
import com.dartinsight.community.repository.CommunityRepostRequestRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 신고 건에 처리 기록과 마지막 블라인드의 재게시 청구를 붙여 읽는다. 부른 쪽 트랜잭션 안에서 쓴다. */
@Component
@RequiredArgsConstructor
class ReportStates {
    private final CommunityReportRepository reports;
    private final CommunityModerationRepository moderations;
    private final CommunityRepostRequestRepository repostRequests;

    /** @return 신고 건과 같은 순서 */
    List<ReportState> of(List<CommunityReport> found) {
        if (found.isEmpty()) return List.of();
        Map<Long, List<CommunityModeration>> byReport = moderations
                .findByReportIdInOrderByCreatedAtDescIdDesc(found.stream().map(CommunityReport::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(CommunityModeration::getReportId));
        Map<Long, CommunityModeration> lastBlinds = found.stream()
                .map(report -> lastBlind(byReport.getOrDefault(report.getId(), List.of())))
                .flatMap(Optional::stream)
                .collect(Collectors.toMap(CommunityModeration::getReportId, Function.identity()));
        Map<Long, CommunityRepostRequest> requests = repostRequests
                .findByModerationIdIn(lastBlinds.values().stream().map(CommunityModeration::getId).toList())
                .stream()
                .collect(Collectors.toMap(CommunityRepostRequest::getModerationId, Function.identity()));
        return found.stream()
                .map(report -> new ReportState(report, byReport.getOrDefault(report.getId(), List.of()),
                        Optional.ofNullable(lastBlinds.get(report.getId()))
                                .map(blind -> requests.get(blind.getId()))
                                .orElse(null)))
                .toList();
    }

    ReportState of(CommunityReport report) {
        return of(List.of(report)).getFirst();
    }

    /** 대상 ID → 그 대상의 신고 건 상태(신고된 대상만) */
    Map<Long, ReportState> forTargets(TargetType targetType, Collection<Long> targetIds) {
        if (targetIds.isEmpty()) return Map.of();
        return of(reports.findByTargetTypeAndTargetIdIn(targetType, targetIds)).stream()
                .collect(Collectors.toMap(state -> state.report().getTargetId(), Function.identity()));
    }

    private static Optional<CommunityModeration> lastBlind(List<CommunityModeration> recentFirst) {
        return recentFirst.stream().filter(CommunityModeration::isBlind).findFirst();
    }
}
