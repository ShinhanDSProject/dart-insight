package com.dartinsight.favorite.repository;

/** 회원 한 명의 관심 기업 수 */
public interface UserFavoriteCount {
    Long getUserId();

    long getCount();
}
