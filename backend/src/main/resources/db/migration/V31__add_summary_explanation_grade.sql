-- 재무 설명 등급과 인용(ADR-0015, #143). docs/erd.md와 같다.
-- explanation_status는 처리 결과로 그대로 두고, 등급은 따로 둔다(NOT_FOUND이면 NONE).
ALTER TABLE summary_item ADD COLUMN explanation_grade VARCHAR(10);
ALTER TABLE summary_item ADD COLUMN quote VARCHAR(1500);
ALTER TABLE summary_item ADD COLUMN quote_evidence_id VARCHAR(40);
