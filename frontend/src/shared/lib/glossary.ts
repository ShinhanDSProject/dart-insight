/**
 * 결과 화면 공시 용어 풀이(FS-36)에서 쓰는 용어 키. 키는 backend 용어 카드(GET /api/glossary-terms, ADR-0061)의
 * `key`와 같고, 뜻은 그 카드에서만 받는다(화면에 따로 정의를 두지 않는다).
 */
export type GlossaryKey =
  | 'correction'
  | 'rceptNo'
  | 'corpCode'
  | 'fsDiv'
  | 'period'
  | 'amountBasis'
  | 'account'
  | 'restatement'
  | 'operatingMargin'
