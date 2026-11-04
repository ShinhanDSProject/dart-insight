-- 문장 변경의 목록 분류와 표 행 비교(#612, ADR-0047). docs/erd.md의 text_change·analysis와 같다.
-- 옛 분석의 행은 채우지 않는다. list_version이 null이면 분류 전에 만든 분석이다.
ALTER TABLE text_change ADD COLUMN list_group VARCHAR(20);
ALTER TABLE text_change ADD COLUMN list_field VARCHAR(20);
ALTER TABLE text_change ADD COLUMN raised_from_note BOOLEAN;
ALTER TABLE text_change ADD COLUMN note_scope VARCHAR(20);
ALTER TABLE text_change ADD COLUMN row_diff MEDIUMTEXT;
ALTER TABLE text_change ADD COLUMN list_version VARCHAR(20);
CREATE INDEX idx_text_change_list ON text_change (analysis_id, list_group, list_field, change_no);

ALTER TABLE analysis ADD COLUMN text_missing_fields VARCHAR(200);
