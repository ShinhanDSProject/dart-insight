-- 관련 수시공시(3.6, #341, ADR-0030). docs/erd.md disclosure_key_item과 같다.
-- 기간 뒤에 정정된 원본을 원본 접수일로 불러 최신 정정본의 행을 받았을 때, 그 행의 접수번호를 둔다. 같으면 null.
ALTER TABLE disclosure_key_item ADD COLUMN source_rcept_no VARCHAR(14);
