-- 감사의견 체크 포인트의 계속기업 관련 강조사항(#546). docs/erd.md와 같다.
-- rows_json의 행에 강조사항 등(emphs_matter)·감사보고서 특기사항(adt_reprt_spcmnt_matter)·핵심감사사항(core_adt_matter)을
-- 더한다(행마다 값이 달라 표의 열이 아니라 JSON 행에 둔다). 이전에 저장한 행에는 이 값이 없고 OK 행은 다시 받지 않으므로,
-- 저장된 행을 모두 지워 다음 요청에 사업보고서마다 다시 받게 한다. 이 표는 OpenDART 응답 캐시라 지워도 잃는 자료가 없고
-- 이 표를 참조하는 표도 없다.
DELETE FROM disclosure_audit_opinion;
