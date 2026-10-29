package com.dartinsight.community.service;

import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.community.domain.CommentThread;
import com.dartinsight.community.domain.CommunityPost;
import com.dartinsight.community.domain.CommunityText;
import com.dartinsight.community.domain.PostQuery;
import com.dartinsight.community.dto.PostDetailResponse;
import com.dartinsight.community.dto.PostListResponse;
import com.dartinsight.community.dto.PostResponse;
import com.dartinsight.community.repository.CommunityCommentRepository;
import com.dartinsight.community.repository.CommunityPostRepository;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.user.service.UserService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 기업 게시판 글(6.6 #460, FS-58). 읽기는 로그인 없이 되고, 회원은 언제나 토큰의 사용자 ID로만 정한다.
 * 이용자 글은 서비스의 분석이 아니라 AI 서버·LLM에 보내지 않고 표현 검사(5.5)도 하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class CommunityPostService {
    private static final Pattern CORP_CODE = Pattern.compile("\\d{8}");

    private final CommunityPostRepository posts;
    private final CommunityCommentRepository comments;
    private final CommunityViews views;
    private final CompanyService companyService;
    private final UserService userService;
    private final Clock clock;

    /** @param viewerId 요청한 회원. 로그인하지 않았으면 null */
    @Transactional(readOnly = true)
    public PostListResponse list(String corpCode, String sort, Integer page, Integer size, Long viewerId) {
        String corp = requireCompany(corpCode);
        PostQuery query = PostQuery.of(sort, page, size);
        PageRequest pageable = PageRequest.of(query.page(), query.size());
        Page<CommunityPost> found = query.sort() == PostQuery.Sort.POPULAR
                ? posts.findPopular(corp, pageable) : posts.findLatest(corp, pageable);
        return new PostListResponse(corp, query.sortName(), query.page(), query.size(), found.getTotalElements(),
                views.posts(found.getContent(), viewerId));
    }

    @Transactional
    public PostResponse create(String corpCode, long userId, Object rawBody) {
        String corp = requireCompany(corpCode);
        String body = CommunityText.postBody(rawBody);
        userService.requireNickname(userId);
        CommunityPost post = posts.save(CommunityPost.create(corp, userId, body, LocalDateTime.now(clock)));
        return views.post(post, userId);
    }

    @Transactional(readOnly = true)
    public PostDetailResponse detail(long postId, Long viewerId) {
        CommunityPost post = findShownOrThrow(postId);
        return new PostDetailResponse(views.post(post, viewerId),
                views.threads(CommentThread.of(comments.findByPostIdOrderByCreatedAtAscIdAsc(postId)), viewerId));
    }

    @Transactional
    public PostResponse edit(long postId, long userId, Object rawBody) {
        String body = CommunityText.postBody(rawBody);
        CommunityPost post = findShownOrThrow(postId);
        post.requireOwner(userId);
        post.edit(body, LocalDateTime.now(clock));
        return views.post(post, userId);
    }

    /** 이미 지운 글이어도 작성자면 그대로 끝난다. 댓글이 있으면 '삭제된 글'로 남는다 */
    @Transactional
    public void delete(long postId, long userId) {
        CommunityPost post = posts.findByIdForUpdate(postId).orElseThrow(CommunityPostService::postNotFound);
        post.requireOwner(userId);
        post.delete(LocalDateTime.now(clock));
    }

    /** 목록·상세에 보이는 글. 없거나, 지웠고 댓글도 없으면 404 */
    private CommunityPost findShownOrThrow(long postId) {
        CommunityPost post = posts.findById(postId).orElseThrow(CommunityPostService::postNotFound);
        if (post.isGone()) throw postNotFound();
        return post;
    }

    private String requireCompany(String corpCode) {
        String corp = corpCode == null ? "" : corpCode.strip();
        if (!CORP_CODE.matcher(corp).matches()) throw ApiException.invalidInput("corpCode", "8자리 숫자여야 합니다.");
        return companyService.get(corp).getCorpCode();
    }

    static ApiException postNotFound() {
        return new ApiException(ErrorCode.COMMUNITY_POST_NOT_FOUND);
    }
}
