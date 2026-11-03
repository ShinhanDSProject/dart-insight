-- 기업 뉴스가 NAVER API HUB를 부른 날짜별 횟수(#592, ADR-0046). docs/erd.md의 news_call_usage와 같다.
CREATE TABLE news_call_usage (
    id         BIGINT AUTO_INCREMENT NOT NULL,
    usage_date DATE NOT NULL,
    call_count INT  NOT NULL,
    CONSTRAINT pk_news_call_usage PRIMARY KEY (id),
    CONSTRAINT uk_news_call_usage_date UNIQUE (usage_date)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
