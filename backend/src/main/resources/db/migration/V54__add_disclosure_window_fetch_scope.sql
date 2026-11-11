-- 공시 분석 탭의 요약·타임라인에 쓸 사이 기간 공시 목록(ADR-0068). docs/erd.md와 같다.
-- 같은 표에 받는 범위를 나눠 둔다. 기존 행은 관련 수시공시(ADR-0030)다.
ALTER TABLE disclosure_window_fetch ADD COLUMN scope VARCHAR(10) NOT NULL DEFAULT 'RELATED';

-- 새 유니크 키를 먼저 만든다. 외래 키(corp_code)가 쓸 인덱스가 사라지지 않게 한다.
ALTER TABLE disclosure_window_fetch
    ADD CONSTRAINT uk_disclosure_window_fetch_scope UNIQUE (corp_code, begin_date, end_date, scope);
ALTER TABLE disclosure_window_fetch DROP INDEX uk_disclosure_window_fetch;
