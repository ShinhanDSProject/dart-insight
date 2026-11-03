package com.dartinsight.news.repository;

import java.sql.Date;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 하루에 NAVER API HUB를 부른 횟수(news_call_usage, ADR-0046). backend를 다시 켜도, 여러 요청이 함께 와도
 * 한도를 넘지 않게 DB에서 조건부 UPDATE 한 번으로 센다. 문장마다 바로 커밋한다(트랜잭션 없음).
 */
@Repository
@RequiredArgsConstructor
public class NewsCallUsageStore {

    private final JdbcTemplate jdbcTemplate;

    /** 그날 dailyLimit보다 적게 불렀으면 한 번 더해 true, 다 썼으면 false */
    public boolean tryUse(LocalDate day, int dailyLimit) {
        if (increment(day, dailyLimit)) {
            return true;
        }
        if (dailyLimit <= 0 || exists(day)) {
            return false;
        }
        try {
            jdbcTemplate.update("INSERT INTO news_call_usage (usage_date, call_count) VALUES (?, 1)", Date.valueOf(day));
            return true;
        } catch (DuplicateKeyException e) {
            // 다른 요청이 같은 날의 첫 행을 먼저 넣었다
            return increment(day, dailyLimit);
        }
    }

    private boolean increment(LocalDate day, int dailyLimit) {
        return jdbcTemplate.update("UPDATE news_call_usage SET call_count = call_count + 1"
                + " WHERE usage_date = ? AND call_count < ?", Date.valueOf(day), dailyLimit) == 1;
    }

    private boolean exists(LocalDate day) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM news_call_usage WHERE usage_date = ?",
                Integer.class, Date.valueOf(day));
        return count != null && count > 0;
    }
}
