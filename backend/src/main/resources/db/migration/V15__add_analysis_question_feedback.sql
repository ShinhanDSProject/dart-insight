-- AI 답 평가(3.12, FS-9). docs/erd.md analysis_question과 같다.
-- 질문 하나에 평가 하나이고 다시 보내면 덮어쓴다. 평가한 사람은 남기지 않는다.
ALTER TABLE analysis_question ADD COLUMN feedback_helpful BOOLEAN;
ALTER TABLE analysis_question ADD COLUMN feedback_reason VARCHAR(30);
ALTER TABLE analysis_question ADD COLUMN feedback_at DATETIME(6);
