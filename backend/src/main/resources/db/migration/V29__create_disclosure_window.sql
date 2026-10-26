-- 관련 수시공시(3.6, #339, ADR-0030)의 공시 목록. docs/erd.md와 같다.
-- 분석 기간(이전 보고서 기간 말일 ~ 현재 보고서 제출일)마다 공시검색(list.json)을 상세유형 B001·I001·I002,
-- last_reprt_at=N(정정 전 원본 포함)으로 한 번 받아 둔다. 지난 기간이라 다시 받지 않는다.
-- company_disclosure(#332)는 최근 기간·최종본만 받고 통째로 바뀌어 같이 쓰지 않는다.
CREATE TABLE disclosure_window_fetch (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    corp_code  VARCHAR(8)  NOT NULL,
    begin_date DATE        NOT NULL,
    end_date   DATE        NOT NULL,
    status     VARCHAR(10) NOT NULL,
    fetched_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_disclosure_window_fetch PRIMARY KEY (id),
    CONSTRAINT uk_disclosure_window_fetch UNIQUE (corp_code, begin_date, end_date),
    CONSTRAINT fk_disclosure_window_fetch_company FOREIGN KEY (corp_code) REFERENCES company (corp_code)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 접수번호는 report에 없는 공시라 외래 키를 걸지 않는다.
CREATE TABLE disclosure_window_item (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    fetch_id    BIGINT       NOT NULL,
    rcept_no    VARCHAR(14)  NOT NULL,
    detail_type VARCHAR(4)   NOT NULL,
    report_name VARCHAR(500) NOT NULL,
    filer_name  VARCHAR(200),
    rcept_dt    DATE         NOT NULL,
    remark      VARCHAR(20),
    CONSTRAINT pk_disclosure_window_item PRIMARY KEY (id),
    CONSTRAINT uk_disclosure_window_item UNIQUE (fetch_id, rcept_no),
    CONSTRAINT fk_disclosure_window_item_fetch FOREIGN KEY (fetch_id) REFERENCES disclosure_window_fetch (id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
