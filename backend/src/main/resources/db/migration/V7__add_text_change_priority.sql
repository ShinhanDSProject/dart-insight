-- 변경 항목 우선순위(2.6). docs/erd.md와 같다. 잠정 규칙이며 적용한 규칙(이유)과 규칙 버전을 함께 남긴다.
ALTER TABLE text_change ADD COLUMN priority VARCHAR(10);
ALTER TABLE text_change ADD COLUMN priority_score INT;
ALTER TABLE text_change ADD COLUMN priority_reasons VARCHAR(1000);
ALTER TABLE text_change ADD COLUMN priority_version VARCHAR(20);
