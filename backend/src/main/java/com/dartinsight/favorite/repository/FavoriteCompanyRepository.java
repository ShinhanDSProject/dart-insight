package com.dartinsight.favorite.repository;

import com.dartinsight.favorite.domain.FavoriteCompany;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FavoriteCompanyRepository extends JpaRepository<FavoriteCompany, Long> {
    /** 최근 추가 순. 같은 시각이면 나중에 넣은 행이 앞이다. */
    List<FavoriteCompany> findByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    Optional<FavoriteCompany> findByUserIdAndCorpCode(Long userId, String corpCode);

    long deleteByUserIdAndCorpCode(Long userId, String corpCode);

    /** 이 기업을 즐겨찾기한 회원(알림, #38) */
    @Query("select f.userId from FavoriteCompany f where f.corpCode = :corpCode order by f.userId")
    List<Long> findUserIdsByCorpCode(String corpCode);

    /** 한 명이라도 즐겨찾기한 기업. 여러 회원이 같은 기업을 골랐어도 한 번만 나온다. */
    @Query("select distinct f.corpCode from FavoriteCompany f order by f.corpCode")
    List<String> findDistinctCorpCodes();

    @Query("select count(distinct f.corpCode) from FavoriteCompany f")
    long countDistinctCorpCodes();

    /** 많이 담은 기업부터(같으면 고유번호 순). 개수는 pageable로 자른다 */
    @Query("select f.corpCode as corpCode, count(f) as count from FavoriteCompany f"
            + " group by f.corpCode order by count(f) desc, f.corpCode")
    List<CorpFavoriteCount> findMostFavorited(Pageable pageable);

    @Query("select f.userId as userId, count(f) as count from FavoriteCompany f"
            + " where f.userId in :userIds group by f.userId")
    List<UserFavoriteCount> countByUserIds(@Param("userIds") Collection<Long> userIds);
}
