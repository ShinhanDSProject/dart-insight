package com.dartinsight.textevent.repository;

import com.dartinsight.textevent.domain.TextEventRun;
import com.dartinsight.textevent.domain.TextEventRunStatus;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TextEventRunRepository extends JpaRepository<TextEventRun, Long> {

    /** 이 분석·버전의 마지막 실행 */
    Optional<TextEventRun> findFirstByAnalysisIdAndEventVersionOrderByAttemptNoDesc(Long analysisId,
            String eventVersion);

    /** 이 시각 전에 만들어졌고 아직 끝나지 않은 실행(서버 재시작 정리용) */
    List<TextEventRun> findByStatusInAndCreatedAtBefore(Collection<TextEventRunStatus> statuses,
            LocalDateTime createdAt);

    /** 이 시각 뒤의 실패 수. excludedErrorCode는 세지 않는다 */
    long countByAnalysisIdAndEventVersionAndStatusAndErrorCodeNotAndFinishedAtAfter(Long analysisId,
            String eventVersion, TextEventRunStatus status, String excludedErrorCode, LocalDateTime after);
}
