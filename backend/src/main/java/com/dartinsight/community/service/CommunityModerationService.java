package com.dartinsight.community.service;

import com.dartinsight.community.domain.CommunityComment;
import com.dartinsight.community.domain.CommunityContent;
import com.dartinsight.community.domain.CommunityModeration;
import com.dartinsight.community.domain.CommunityPost;
import com.dartinsight.community.domain.CommunityReport;
import com.dartinsight.community.domain.ModerationCommand;
import com.dartinsight.community.domain.ReportQuery;
import com.dartinsight.community.domain.ReportState;
import com.dartinsight.community.domain.ReportStatus;
import com.dartinsight.community.domain.TargetType;
import com.dartinsight.community.dto.AdminReportListResponse;
import com.dartinsight.community.dto.AdminReportResponse;
import com.dartinsight.community.dto.ModerationRequest;
import com.dartinsight.community.repository.CommunityCommentRepository;
import com.dartinsight.community.repository.CommunityModerationRepository;
import com.dartinsight.community.repository.CommunityPostRepository;
import com.dartinsight.community.repository.CommunityReportRepository;
import com.dartinsight.community.repository.ReportTargetRef;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 신고 목록과 처리(6.6 #461). 관리자인지는 SecurityConfig가 /api/admin 아래에서 확인한다(ADR-0040).
 * 블라인드 기한이 지나도 자동으로 풀지 않고 목록에 '기한 지남'으로 다시 올린다(스케줄러 없음).
 */
@Service
@RequiredArgsConstructor
public class CommunityModerationService {
    private final CommunityPostRepository posts;
    private final CommunityCommentRepository comments;
    private final CommunityReportRepository reports;
    private final CommunityModerationRepository moderations;
    private final ReportStates reportStates;
    private final ModerationViews views;
    private final Clock clock;

    /**
     * 처리할 것(todo)은 대기·블라인드 신고 건을 모두 읽어 처리할 이유가 있는 것만 고른 뒤 나눈다.
     * 신고 건은 운영자가 하나씩 처리하는 규모라 메모리에서 고르고, 많아지면 처리할 이유를 칼럼으로 저장한다.
     */
    @Transactional(readOnly = true)
    public AdminReportListResponse list(String queue, Integer page, Integer size) {
        ReportQuery query = ReportQuery.of(queue, page, size);
        LocalDateTime now = LocalDateTime.now(clock);
        if (query.queue() == ReportQuery.Queue.ALL) {
            Page<CommunityReport> found = reports.findAllByOrderByLastReportedAtDescIdDesc(
                    PageRequest.of(query.page(), query.size()));
            return new AdminReportListResponse(query.queueName(), query.page(), query.size(),
                    found.getTotalElements(), views.items(reportStates.of(found.getContent()), now));
        }
        List<ReportState> todo = ReportState.todoQueue(
                reportStates.of(reports.findByStatusIn(List.of(ReportStatus.OPEN, ReportStatus.BLINDED))), now);
        List<ReportState> pageItems = todo.stream()
                .skip((long) query.page() * query.size())
                .limit(query.size())
                .toList();
        return new AdminReportListResponse(query.queueName(), query.page(), query.size(), todo.size(),
                views.items(pageItems, now));
    }

    /**
     * 유지·블라인드·삭제로 처리하고 처리 기록을 한 줄 더한다. 글 → 댓글 → 신고 건 순으로 잠근다
     * (댓글을 지우면 글의 댓글 수를 고치므로 글부터).
     */
    @Transactional
    public AdminReportResponse moderate(long reportId, long adminId, ModerationRequest request) {
        ModerationCommand command = ModerationCommand.of(request.decision(), request.reason(), request.blindDays());
        ReportTargetRef ref = reports.findTargetById(reportId).orElseThrow(CommunityReportService::reportNotFound);
        CommunityPost post = posts.findByIdForUpdate(ref.getPostId())
                .orElseThrow(() -> new IllegalStateException("report without post: " + reportId));
        CommunityContent target = ref.getTargetType() == TargetType.POST ? post
                : comments.findByIdForUpdate(ref.getTargetId())
                        .orElseThrow(() -> new IllegalStateException("report without comment: " + reportId));
        CommunityReport report = reports.findByIdForUpdate(reportId)
                .orElseThrow(CommunityReportService::reportNotFound);
        LocalDateTime now = LocalDateTime.now(clock);
        CommunityModeration moderation = CommunityModeration.record(report, adminId, command, now);
        report.moderate(moderation);
        boolean deleted = target.moderate(command.decision(), now);
        if (deleted && target instanceof CommunityComment) post.removeComment();
        moderations.save(moderation);
        return views.items(List.of(reportStates.of(report)), now).getFirst();
    }
}
