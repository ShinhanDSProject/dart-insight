-- 즐겨찾기 기업의 새 정기보고서 자동 분석과 분석 완료 알림(6.4, #38, ADR-0031). docs/erd.md의 watched_report·notification과 같다.
CREATE TABLE watched_report (
    id         BIGINT AUTO_INCREMENT NOT NULL,
    rcept_no   VARCHAR(14) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_watched_report PRIMARY KEY (id),
    CONSTRAINT fk_watched_report_report FOREIGN KEY (rcept_no) REFERENCES report (rcept_no),
    CONSTRAINT uk_watched_report_rcept_no UNIQUE (rcept_no)
-- rcept_no 외래 키는 report와 문자셋·정렬이 같아야 MariaDB가 받는다(errno 150)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE notification (
    id          BIGINT AUTO_INCREMENT NOT NULL,
    user_id     BIGINT      NOT NULL,
    analysis_id BIGINT      NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    read_at     DATETIME(6),
    CONSTRAINT pk_notification PRIMARY KEY (id),
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT fk_notification_analysis FOREIGN KEY (analysis_id) REFERENCES analysis (id),
    CONSTRAINT uk_notification_user_analysis UNIQUE (user_id, analysis_id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_notification_user_created ON notification (user_id, created_at);
