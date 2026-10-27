package com.dartinsight.note.repository;

import com.dartinsight.note.domain.JudgmentNoteItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JudgmentNoteItemRepository extends JpaRepository<JudgmentNoteItem, Long> {
    /** 최근에 담은 순. 같은 시각이면 나중에 넣은 행이 앞이다. */
    List<JudgmentNoteItem> findByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    List<JudgmentNoteItem> findByUserIdAndCorpCodeOrderByCreatedAtDescIdDesc(Long userId, String corpCode);

    /** 회원의 항목만 찾는다. 다른 회원의 항목은 없는 것과 같다(AC3) */
    Optional<JudgmentNoteItem> findByIdAndUserId(Long id, Long userId);
}
