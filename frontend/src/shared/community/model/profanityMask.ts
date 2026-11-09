/**
 * 커뮤니티 욕설 순화(#468, FS-58 COM-07). 글·댓글 본문의 욕설 단어를 늘 화면에서만 순화한 말로 바꾼다.
 * 두 글자 이하는 '좋아', 세 글자 이상은 '사랑해'. 서버에 보내는 글과 저장된 본문은 그대로다.
 *
 * 단어 목록은 팀이 직접 고른 짧은 목록이다(외부 목록·라이브러리를 쓰지 않음). 흔한 욕설과 초성 줄임말만 두고,
 * 뜻이 여럿인 말(새끼, 개같이 등)은 넣지 않는다. 멀쩡한 낱말과 겹치는 것은 뒤에 오는 글자로 뺀다(시발점, 5개년 등).
 */
interface MaskWord {
  word: string
  /** 바로 뒤에 이 글자가 오면 욕설이 아니다(예: 시발 + 점 = 시발점) */
  notBefore?: readonly string[]
}

const MASK_WORDS: readonly MaskWord[] = [
  { word: '씨발' },
  { word: '씨빨' },
  { word: '씨바' },
  { word: '씨팔' },
  { word: '시발', notBefore: ['점', '역'] },
  { word: '시팔' },
  { word: '씨부랄' },
  { word: '썅' },
  { word: 'ㅅㅂ' },
  { word: 'ㅆㅂ' },
  { word: '병신' },
  { word: '븅신' },
  { word: '빙신' },
  { word: 'ㅂㅅ' },
  { word: '등신', notBefore: ['대'] },
  { word: '개새끼' },
  { word: '개새기' },
  { word: '개색기' },
  { word: '개소리' },
  { word: '씹새끼' },
  { word: '씹년' },
  { word: '좆' },
  { word: '지랄' },
  { word: '염병' },
  { word: '육시랄' },
  { word: '미친놈' },
  { word: '미친년' },
  { word: '미친새끼' },
  { word: 'ㅁㅊ' },
  { word: '존나' },
  { word: '존내' },
  { word: 'ㅈㄴ' },
  { word: '쌍놈' },
  { word: '쌍년' },
  { word: '니미' },
  { word: '니애미' },
  { word: '느금마' },
  { word: '엠창' },
  { word: '호로새끼' },
  { word: '후레자식' },
  { word: 'fuck' },
  { word: 'shit' },
  { word: 'bitch' },
]

/** 욕설 자리에 보이는 말. 욕설의 글자 수(끼워 넣은 점·숫자·기호는 빼고)로 고른다 */
export const SHORT_SOFTENED = '좋아'
export const LONG_SOFTENED = '사랑해'

/** 글자 사이에 끼워 피하는 것(점·숫자·기호, 예: 씨.발, 시1발). 띄어쓰기는 '회의 시 발언'처럼 멀쩡한 글과 겹쳐 넣지 않는다 */
const BETWEEN = '[^\\p{L}\\s]*'

function wordPattern({ word, notBefore = [] }: MaskWord): string {
  const body = Array.from(word).join(BETWEEN)
  return notBefore.length === 0 ? body : `${body}(?!${notBefore.join('|')})`
}

// 긴 단어부터 맞춰 '미친새끼'가 '미친'만 가려지지 않게 한다
const MASK_PATTERN = new RegExp(
  [...MASK_WORDS]
    .sort((a, b) => b.word.length - a.word.length)
    .map(wordPattern)
    .join('|'),
  'giu',
)

/** 욕설 단어를 순화한 말로 바꾼다. 원문은 바꾸지 않고 새 글을 돌려준다 */
export function softenProfanity(text: string): string {
  return text.replace(MASK_PATTERN, (found) =>
    found.replace(/[^\p{L}]/gu, '').length <= 2 ? SHORT_SOFTENED : LONG_SOFTENED,
  )
}
