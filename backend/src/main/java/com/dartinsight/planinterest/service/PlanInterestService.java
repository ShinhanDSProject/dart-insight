package com.dartinsight.planinterest.service;

import com.dartinsight.planinterest.domain.PlanInterest;
import com.dartinsight.planinterest.domain.PlanInterestTally;
import com.dartinsight.planinterest.dto.PlanInterestRequest;
import com.dartinsight.planinterest.repository.PlanInterestRepository;
import com.dartinsight.user.service.UserService;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 요금제 '관심 있어요'(3.34, FS-73). 결제 없이 수요만 센다. 같은 사람이 여러 번 눌러도 그대로 센다. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class PlanInterestService {
    private final PlanInterestRepository interests;
    private final UserService userService;
    private final Clock clock;

    /**
     * 기록 하나를 남긴다. 토큰은 유효하지만 회원 행이 없으면(탈퇴 등) 로그인하지 않은 것으로 남긴다.
     *
     * @param userId 유효한 Access Token의 회원 ID. 로그인하지 않았거나 토큰이 잘못됐으면 null
     */
    @Transactional
    public void record(Long userId, PlanInterestRequest request) {
        Long member = userId != null && userService.exists(userId) ? userId : null;
        interests.save(PlanInterest.record(request.plan(), request.source(), member, LocalDateTime.now(clock)));
    }

    /** [from, to)에 남긴 기록의 집계 */
    public PlanInterestTally tally(LocalDateTime from, LocalDateTime to) {
        return PlanInterestTally.of(interests.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to));
    }
}
