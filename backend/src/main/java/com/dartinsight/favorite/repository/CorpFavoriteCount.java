package com.dartinsight.favorite.repository;

/** 기업 하나를 관심 기업으로 담은 회원 수 */
public interface CorpFavoriteCount {
    String getCorpCode();

    long getCount();
}
