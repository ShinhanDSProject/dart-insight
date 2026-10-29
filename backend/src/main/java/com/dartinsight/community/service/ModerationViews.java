package com.dartinsight.community.service;

import com.dartinsight.community.domain.CommunityComment;
import com.dartinsight.community.domain.CommunityContent;
import com.dartinsight.community.domain.CommunityModeration;
import com.dartinsight.community.domain.CommunityPost;
import com.dartinsight.community.domain.CommunityReport;
import com.dartinsight.community.domain.ReportReason;
import com.dartinsight.community.domain.ReportState;
import com.dartinsight.community.domain.TargetType;
import com.dartinsight.community.dto.AdminReportResponse;
import com.dartinsight.community.dto.ReportTargetResponse;
import com.dartinsight.community.repository.CommunityCommentRepository;
import com.dartinsight.community.repository.CommunityPostRepository;
import com.dartinsight.community.repository.CommunityReportEntryRepository;
import com.dartinsight.community.repository.ReasonCount;
import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.user.service.UserService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 신고 건을 관리자 신고 목록 항목으로 바꾼다. 대상·사유별 건수·닉네임·기업 이름을 한 번에 읽는다.
 * 작성자·관리자는 닉네임만, 신고한 사람은 아무것도 내보내지 않는다. 부른 쪽 트랜잭션 안에서 쓴다.
 */
@Component
@RequiredArgsConstructor
class ModerationViews {
    private final CommunityPostRepository posts;
    private final CommunityCommentRepository comments;
    private final CommunityReportEntryRepository entries;
    private final UserService userService;
    private final CompanyService companyService;

    List<AdminReportResponse> items(List<ReportState> states, LocalDateTime now) {
        if (states.isEmpty()) return List.of();
        List<CommunityReport> found = states.stream().map(ReportState::report).toList();
        Map<Long, CommunityPost> postsById = posts.findAllById(found.stream().map(CommunityReport::getPostId).toList())
                .stream()
                .collect(Collectors.toMap(CommunityPost::getId, Function.identity()));
        Map<Long, CommunityComment> commentsById = comments.findAllById(found.stream()
                        .filter(report -> report.getTargetType() == TargetType.COMMENT)
                        .map(CommunityReport::getTargetId)
                        .toList())
                .stream()
                .collect(Collectors.toMap(CommunityComment::getId, Function.identity()));
        Map<Long, Map<ReportReason, Long>> reasonCounts = entries
                .countReasons(found.stream().map(CommunityReport::getId).toList()).stream()
                .collect(Collectors.groupingBy(ReasonCount::getReportId,
                        Collectors.toMap(ReasonCount::getReason, ReasonCount::getCount)));
        Map<String, String> corpNames = companyService
                .getAll(postsById.values().stream().map(CommunityPost::getCorpCode).distinct().toList()).stream()
                .collect(Collectors.toMap(Company::getCorpCode, Company::getCorpName));
        Map<Long, String> nicknames = userService.nicknames(Stream.concat(
                        Stream.concat(postsById.values().stream().map(CommunityPost::getUserId),
                                commentsById.values().stream().map(CommunityComment::getUserId)),
                        states.stream().flatMap(state -> state.moderations().stream())
                                .map(CommunityModeration::getAdminId))
                .distinct()
                .toList());
        return states.stream()
                .map(state -> {
                    CommunityReport report = state.report();
                    CommunityPost post = postsById.get(report.getPostId());
                    CommunityContent target = report.getTargetType() == TargetType.POST
                            ? post : commentsById.get(report.getTargetId());
                    String corpCode = post.getCorpCode();
                    return AdminReportResponse.of(state,
                            ReportTargetResponse.of(target, corpCode, corpNames.get(corpCode),
                                    nicknames.get(target.getUserId())),
                            reasonCounts.getOrDefault(report.getId(), Map.of()), nicknames, now);
                })
                .toList();
    }
}
