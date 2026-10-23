-- 모든 테이블의 기본키는 자동 증가 id다(ADR-0017). docs/erd.md와 같다.
-- company·report에 id를 기본키로 넣고, 고유번호·접수번호는 UNIQUE로 남긴다. 다른 테이블의 FK는 그대로 고유번호·접수번호를 참조한다.
-- 기본키를 바꾸는 동안 그 키를 참조하는 FK를 내렸다가 UNIQUE 키에 다시 건다.
ALTER TABLE report DROP FOREIGN KEY fk_report_company;
ALTER TABLE financial_statement_fetch DROP FOREIGN KEY fk_financial_statement_fetch_company;
ALTER TABLE analysis DROP FOREIGN KEY fk_analysis_company;
ALTER TABLE analysis DROP FOREIGN KEY fk_analysis_current_report;
ALTER TABLE analysis DROP FOREIGN KEY fk_analysis_previous_report;
ALTER TABLE report_document DROP FOREIGN KEY fk_report_document_report;

ALTER TABLE company DROP PRIMARY KEY;
ALTER TABLE company ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;
ALTER TABLE company ADD CONSTRAINT uk_company_corp_code UNIQUE (corp_code);

ALTER TABLE report DROP PRIMARY KEY;
ALTER TABLE report ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;
ALTER TABLE report ADD CONSTRAINT uk_report_rcept_no UNIQUE (rcept_no);

ALTER TABLE report ADD CONSTRAINT fk_report_company FOREIGN KEY (corp_code) REFERENCES company (corp_code);
ALTER TABLE financial_statement_fetch ADD CONSTRAINT fk_financial_statement_fetch_company
    FOREIGN KEY (corp_code) REFERENCES company (corp_code);
ALTER TABLE analysis ADD CONSTRAINT fk_analysis_company FOREIGN KEY (corp_code) REFERENCES company (corp_code);
ALTER TABLE analysis ADD CONSTRAINT fk_analysis_current_report
    FOREIGN KEY (current_rcept_no) REFERENCES report (rcept_no);
ALTER TABLE analysis ADD CONSTRAINT fk_analysis_previous_report
    FOREIGN KEY (previous_rcept_no) REFERENCES report (rcept_no);
ALTER TABLE report_document ADD CONSTRAINT fk_report_document_report
    FOREIGN KEY (rcept_no) REFERENCES report (rcept_no);
