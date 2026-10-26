package com.dartinsight.favorite.repository;

import com.dartinsight.favorite.domain.FavoriteCompany;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FavoriteCompanyRepository extends JpaRepository<FavoriteCompany, Long> {
    /** 최근 추가 순. 같은 시각이면 나중에 넣은 행이 앞이다. */
    List<FavoriteCompany> findByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    Optional<FavoriteCompany> findByUserIdAndCorpCode(Long userId, String corpCode);

    long deleteByUserIdAndCorpCode(Long userId, String corpCode);
}
