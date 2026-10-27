-- 확인해 볼 공시(#411, FS-55, ADR-0033). docs/erd.md와 같다.
-- 최근 공시 목록의 사업보고서(접수번호)마다 OpenDART 회계감사인의 명칭 및 감사의견(DS002)을 한 번 부른 결과.
-- 행 목록은 backend가 정리한 JSON 배열로 둔다. company_disclosure는 통째로 바뀌고 report에 없을 수 있어 외래 키를 걸지 않는다.
CREATE TABLE disclosure_audit_opinion (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    rcept_no        VARCHAR(14) NOT NULL,
    status          VARCHAR(10) NOT NULL,
    source_rcept_no VARCHAR(14),
    rows_json       MEDIUMTEXT  NOT NULL,
    fetched_at      DATETIME(6) NOT NULL,
    CONSTRAINT pk_disclosure_audit_opinion PRIMARY KEY (id),
    CONSTRAINT uk_disclosure_audit_opinion UNIQUE (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
