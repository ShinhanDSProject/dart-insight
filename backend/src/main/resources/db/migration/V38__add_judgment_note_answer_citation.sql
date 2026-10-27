-- 판단 노트에 AI 답의 인용 문단을 담는다(6.5, #432, FS-57, ADR-0034). docs/erd.md judgment_note_item과 같다.
-- 질문은 참조(question_id, 외래 키 없음)와 사본(snapshot_question)을 함께 두고, 원문 확인 탭으로 돌아갈 보고서 쪽을 둔다.
ALTER TABLE judgment_note_item ADD COLUMN question_id BIGINT;
ALTER TABLE judgment_note_item ADD COLUMN snapshot_question VARCHAR(400);
ALTER TABLE judgment_note_item ADD COLUMN doc_side VARCHAR(10);
