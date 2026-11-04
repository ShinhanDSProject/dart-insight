package com.dartinsight.community.repository;

/** 회원 한 명의 글 수 */
public interface AuthorCount {
    Long getUserId();

    long getCount();
}
