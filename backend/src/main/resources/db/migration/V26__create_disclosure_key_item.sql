-- 주요사항보고서 핵심 수치(#363, FS-51). docs/erd.md와 같다.
-- 공시(접수번호)마다 OpenDART 주요사항보고서 주요정보(DS005)를 한 번 부른 결과. 항목 목록은 backend가 정리한 JSON 배열로 둔다.
-- company_disclosure는 목록을 다시 받을 때 통째로 바뀌어 외래 키를 걸지 않는다.
CREATE TABLE disclosure_key_item (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    rcept_no   VARCHAR(14) NOT NULL,
    kind       VARCHAR(40) NOT NULL,
    status     VARCHAR(10) NOT NULL,
    items_json MEDIUMTEXT  NOT NULL,
    fetched_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_disclosure_key_item PRIMARY KEY (id),
    CONSTRAINT uk_disclosure_key_item UNIQUE (rcept_no)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
