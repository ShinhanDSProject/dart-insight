/**
 * 결과 화면 공시 용어 풀이(FS-36). 노션 '공시·재무 도메인 가이드' 6장(용어표)의 정의만 옮긴다. 새로 지어내지 않고,
 * 가이드가 바뀌면 여기도 같이 고친다.
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

export interface GlossaryEntry {
  term: string
  definition: string
}

export const glossary: Record<GlossaryKey, GlossaryEntry> = {
  // 출처: 노션 '공시·재무 도메인 가이드' 6장(용어표)
  correction: {
    term: '정정공시',
    definition: '이미 낸 보고서를 고쳐 다시 낸 것이에요. 보고서명 앞에 [기재정정] 등이 붙어요.',
  },
  // 출처: 노션 '공시·재무 도메인 가이드' 6장(용어표)
  rceptNo: {
    term: '접수번호',
    definition: '공시 한 건마다 붙는 14자리 번호예요. 원문을 찾는 열쇠예요.',
  },
  // 출처: 노션 '공시·재무 도메인 가이드' 6장(용어표)
  corpCode: {
    term: '고유번호',
    definition: 'DART가 회사마다 붙인 8자리 번호예요. 종목코드(6자리)는 상장사에만 있어요.',
  },
  // 출처: 노션 '공시·재무 도메인 가이드' 6장(용어표)
  fsDiv: {
    term: '연결 / 별도',
    definition:
      '연결은 모회사와 자회사를 합친 숫자, 별도는 모회사만의 숫자예요. 기준이 다르면 같은 회사라도 수치가 달라질 수 있어요.',
  },
  // 출처: 노션 '공시·재무 도메인 가이드' 6장(용어표)
  period: {
    term: '당기 / 전기 / 전기말',
    definition: '당기는 이번 보고 기간, 전기는 직전 사업연도의 같은 기간, 전기말은 직전 사업연도의 마지막 날이에요.',
  },
  // 출처: 노션 '공시·재무 도메인 가이드' 6장(용어표)
  amountBasis: {
    term: '3개월 / 누적',
    definition: '분기 하나만의 값과 연초부터 쌓인 값이에요.',
  },
  // 출처: 노션 '공시·재무 도메인 가이드' 6장(용어표)
  account: {
    term: '계정과목',
    definition: '재무제표 각 줄의 이름이에요 (예: 현금및현금성자산).',
  },
  // 출처: 노션 '공시·재무 도메인 가이드' 6장(용어표)
  restatement: {
    term: '재작성',
    definition: '회계정책 변경이나 오류 수정으로 과거 숫자를 고쳐 다시 실은 것이에요.',
  },
  // 출처: 노션 '공시·재무 도메인 가이드' 6장(용어표)
  operatingMargin: {
    term: '영업이익률',
    definition: '매출 100원 중 본업으로 남긴 돈의 비율이에요.',
  },
}
