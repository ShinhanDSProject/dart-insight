package com.dartinsight.planinterest.domain;

import com.dartinsight.common.error.ApiException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.regex.Pattern;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 요금제 '관심 있어요' 한 번(docs/erd.md plan_interest). 연락처 등 개인정보는 넣지 않는다. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "plan_interest")
public class PlanInterest {
    /** source가 없을 때 쓰는 화면 */
    public static final String DEFAULT_SOURCE = "pricing";
    private static final Pattern SOURCE = Pattern.compile("[a-z0-9-]{1,40}");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Plan plan;

    @Column(nullable = false, length = 40)
    private String source;

    /** 로그인한 회원이 남겼으면 그 회원 ID, 아니면 null */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /**
     * 요청 값을 검증해 기록 하나를 만든다. plan이 네 값이 아니거나 source가 영문 소문자·숫자·'-' 1~40자가 아니면 400.
     *
     * @param userId 로그인한 회원 ID. 로그인하지 않았으면 null
     */
    public static PlanInterest record(Object rawPlan, Object rawSource, Long userId, LocalDateTime now) {
        PlanInterest interest = new PlanInterest();
        interest.plan = Plan.of(rawPlan);
        interest.source = source(rawSource);
        interest.userId = userId;
        interest.createdAt = now;
        return interest;
    }

    public boolean signedIn() {
        return userId != null;
    }

    private static String source(Object raw) {
        if (raw == null) return DEFAULT_SOURCE;
        if (!(raw instanceof String text) || !SOURCE.matcher(text).matches()) {
            throw ApiException.invalidInput("source", "영문 소문자·숫자·- 1~40자여야 합니다.");
        }
        return text;
    }
}
