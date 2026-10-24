-- 문장 변경의 위치 이동(MOVED, #150). docs/erd.md의 text_change와 같다.
-- 위치 이동이면 이전 보고서 쪽 섹션 경로를 남기고(section_path는 현재 쪽), 그 밖은 null이다.
-- change_type은 VARCHAR(20)이라 새 값(NUMERIC_UPDATE, MOVED)을 그대로 담는다.
ALTER TABLE text_change ADD COLUMN previous_section_path VARCHAR(1000);
