-- 기업 검색 초성·띄어쓰기 허용(1.1, #277). docs/erd.md의 company와 같다.
-- 두 값은 backend가 corp_name에서 계산해 채운다(CompanyNameKey). 이미 있는 행은 null로 두고 서버가 시작할 때 일괄로 채운다.
-- 검색이 부분 일치(%검색어%)라 B-tree 인덱스를 쓰지 못하므로 인덱스는 두지 않는다.
ALTER TABLE company ADD COLUMN corp_name_key VARCHAR(200);
ALTER TABLE company ADD COLUMN corp_name_chosung VARCHAR(200);
