package com.dartinsight.support;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 테스트 데이터 정리. CI에서는 테스트가 MariaDB 하나를 같이 쓰므로, 테스트마다 앞에서 지운다.
 * 외래 키가 있는 테이블은 자식부터 넘긴다.
 */
public final class TestData {

    private TestData() {
    }

    @SafeVarargs
    public static void clearAll(JpaRepository<?, ?>... repositoriesChildFirst) {
        for (JpaRepository<?, ?> repository : repositoriesChildFirst) {
            repository.deleteAllInBatch();
        }
    }
}
