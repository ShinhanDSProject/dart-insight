package com.dartinsight.user.domain;

import java.util.List;

/** 관리자 회원 목록 한 쪽 */
public record UserPage(int page, int size, long totalItems, List<UserListing> items) {

    public UserPage {
        items = List.copyOf(items);
    }
}
