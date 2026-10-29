package com.dartinsight.community.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.community.domain.CommunityContent;
import com.dartinsight.community.domain.CommunityModeration;
import com.dartinsight.community.domain.CommunityReport;
import com.dartinsight.community.domain.CommunityReportEntry;
import com.dartinsight.community.domain.CommunityRepostRequest;
import com.dartinsight.community.domain.CommunityText;
import com.dartinsight.community.domain.ReportReason;
import com.dartinsight.community.domain.ReportState;
import com.dartinsight.community.domain.TargetType;
import com.dartinsight.community.dto.RepostCreateResponse;
import com.dartinsight.community.repository.CommunityCommentRepository;
import com.dartinsight.community.repository.CommunityPostRepository;
import com.dartinsight.community.repository.CommunityReportEntryRepository;
import com.dartinsight.community.repository.CommunityReportRepository;
import com.dartinsight.community.repository.CommunityRepostRequestRepository;
import com.dartinsight.user.service.UserService;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이용자의 신고와 작성자의 재게시 청구(6.6 #461). 신고만으로 대상을 가리지 않는다(관리자 처리는 CommunityModerationService).
 *
 * <p>잠금은 트랜잭션의 첫 조회이고, 순서는 글 → 댓글 → 신고 건이다(CommunityLikeService와 같은 이유).
 * 신고는 대상 행을 잠가 같은 대상의 신고 건이 둘 생기지 않게 하고, 재게시 청구는 신고 건 행을 잠근다.
 */
@Service
@RequiredArgsConstructor
public class CommunityReportService {
    private final CommunityPostRepository posts;
    private final CommunityCommentRepository comments;
    private final CommunityReportRepository reports;
    private final CommunityReportEntryRepository entries;
    private final CommunityRepostRequestRepository repostRequests;
    private final ReportStates reportStates;
    private final UserService userService;
    private final Clock clock;

    @Transactional
    public void reportPost(long postId, long userId, Object rawReason) {
        ReportReason reason = ReportReason.of(rawReason);
        CommunityContent post = posts.findByIdForUpdate(postId).orElseThrow(CommunityPostService::postNotFound);
        userService.requireExisting(userId);
        report(post, userId, reason);
    }

    @Transactional
    public void reportComment(long commentId, long userId, Object rawReason) {
        ReportReason reason = ReportReason.of(rawReason);
        CommunityContent comment = comments.findByIdForUpdate(commentId)
                .orElseThrow(CommunityCommentService::commentNotFound);
        userService.requireExisting(userId);
        report(comment, userId, reason);
    }

    /** 가려진 내 글·댓글의 지금 블라인드에 한 번 청구한다. 관리자 목록에 '재게시 청구'로 다시 올라간다 */
    @Transactional
    public RepostCreateResponse requestRepost(long reportId, long userId, Object rawMessage) {
        String message = CommunityText.repostMessage(rawMessage);
        CommunityReport report = reports.findByIdForUpdate(reportId).orElseThrow(CommunityReportService::reportNotFound);
        userService.requireExisting(userId);
        target(report).requireRepostableBy(userId);
        ReportState state = reportStates.of(report);
        CommunityModeration blind = state.currentBlind();
        if (state.repostRequested()) throw new ApiException(ErrorCode.COMMUNITY_REPOST_ALREADY_REQUESTED);
        CommunityRepostRequest request = repostRequests.save(
                CommunityRepostRequest.create(blind, userId, message, LocalDateTime.now(clock)));
        return new RepostCreateResponse(reportId, request.getCreatedAt());
    }

    /** 대상마다 신고 건 하나, 회원마다 한 번 */
    private void report(CommunityContent target, long userId, ReportReason reason) {
        target.requireReportableBy(userId);
        LocalDateTime now = LocalDateTime.now(clock);
        CommunityReport report = reports.findByTargetForUpdate(target.targetType(), target.getId())
                .orElseGet(() -> reports.save(CommunityReport.open(target, now)));
        if (entries.existsByReportIdAndReporterId(report.getId(), userId)) {
            throw new ApiException(ErrorCode.COMMUNITY_ALREADY_REPORTED);
        }
        entries.save(CommunityReportEntry.create(report, userId, reason, now));
        report.addReport(now);
    }

    private CommunityContent target(CommunityReport report) {
        return report.getTargetType() == TargetType.POST
                ? posts.findById(report.getTargetId()).orElseThrow(() -> missingTarget(report))
                : comments.findById(report.getTargetId()).orElseThrow(() -> missingTarget(report));
    }

    static IllegalStateException missingTarget(CommunityReport report) {
        return new IllegalStateException("report without target: " + report.getId());
    }

    static ApiException reportNotFound() {
        return new ApiException(ErrorCode.COMMUNITY_REPORT_NOT_FOUND);
    }
}
