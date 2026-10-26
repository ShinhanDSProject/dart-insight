-- 정기보고서 주요정보를 받은 공시의 접수번호(#350). docs/erd.md와 같다.
-- OpenDART는 사업연도·보고서 코드마다 최신 공시 하나의 값만 주므로, 행의 rcept_no가 보고서와 다르면(정정본) 여기에 둔다.
-- report에 없는 접수번호일 수 있어 외래 키를 두지 않는다.
ALTER TABLE report_key_fact ADD COLUMN source_rcept_no VARCHAR(14) NULL;

-- 이 변경 전에는 접수번호가 다른 응답을 NO_DATA로 저장했다. 지워서 다음 조회 때 한 번 다시 받게 한다.
DELETE FROM report_key_fact WHERE status = 'NO_DATA';
