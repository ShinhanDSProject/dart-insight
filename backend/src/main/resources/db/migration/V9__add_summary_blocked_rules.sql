-- 투자 권유성 표현 자동 검사(5.5). 검사에 걸려 내보내지 않은 AI 문장의 규칙 ID를 남긴다. docs/erd.md와 같다.
ALTER TABLE summary_item ADD COLUMN blocked_rules VARCHAR(200);
