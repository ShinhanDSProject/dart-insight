/**
 * 위험 요인 변화(3.9, FS-61). 위험 관련은 서버가 목차 제목 낱말로 정한다(docs/api-spec.md text-changes의 riskRelated).
 * 건수만 보여 주고 위험의 크기나 좋고 나쁨은 말하지 않는다. 3.55부터 상자 대신 분야 줄의 '위험 관련' 칩으로 거른다.
 */

export const RISK_BADGE = '위험 관련'
export const RISK_EMPTY = '위험 관련 목차에서 바뀐 문장이 없어요.'
export const RISK_NOTE = '목차 제목으로 나눈 것이라 실제 내용과 다를 수 있어요.'
export const RISK_SCOPE = '위험관리·파생거래, 예측정보, 우발부채·소송, 제재 목차의 문장 변화예요.'
export const RISK_FILTERED_SCOPE = '고른 섹션·검색어 안에서 센 건수예요.'
