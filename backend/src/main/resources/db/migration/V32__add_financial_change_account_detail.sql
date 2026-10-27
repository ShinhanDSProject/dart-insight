-- 자본변동표의 계정 상세(OpenDART account_detail, 자본 구성요소)를 비교 결과에 둔다(#401).
-- 같은 계정명(예: 기초자본)이 구성요소마다 여러 줄이라 화면에서 구분하려면 이 값이 필요하다. docs/erd.md financial_change와 같다.
ALTER TABLE financial_change ADD COLUMN account_detail VARCHAR(500) NULL AFTER account_name;

-- 이미 있는 자본변동표 결과는 맞춘 키(account_key = 계정 키 + '|' + 정규화한 계정 상세)와 원래 계정 상세를 맞춰 채운다.
-- 정규화는 FinancialComparator.normalize(공백 제거, 소문자)와 같다.
UPDATE financial_change fc
SET fc.account_detail = (
    SELECT fa.account_detail
    FROM financial_account fa
    WHERE fa.rcept_no = COALESCE(fc.current_rcept_no, fc.previous_rcept_no)
      AND fa.sj_div = 'SCE'
      AND fa.account_detail IS NOT NULL
      AND LOWER(REPLACE(REPLACE(REPLACE(fa.account_detail, ' ', ''), '\t', ''), '\n', ''))
          = SUBSTRING(fc.account_key, LOCATE('|', fc.account_key) + 1)
    LIMIT 1
)
WHERE fc.sj_div = 'SCE'
  AND LOCATE('|', fc.account_key) > 0;
