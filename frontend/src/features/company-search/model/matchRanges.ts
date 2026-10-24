/**
 * 검색 결과에서 검색어와 맞는 부분(FS-32). 백엔드 검색 규칙(CompanyNameKey, docs/api-spec.md 기업 검색)을 따른다.
 * - 이름: 공백을 모두 빼고 소문자로 바꿔 비교한다(`삼성 전자` → 삼성전자)
 * - 초성: 공백을 뺀 검색어가 한글 자음만 2자 이상이면 각 음절의 초성과 비교한다(`ㅅㅅㅈㅈ` → 삼성전자)
 * - 종목코드: 앞뒤 공백을 뺀 검색어가 숫자 6자리면 종목코드로 찾으므로 이름은 강조하지 않는다
 */

/** 맞는 글자 범위. [시작, 끝) 원래 문자열의 위치 */
export type MatchRange = [start: number, end: number]

/** 화면에 그릴 조각. match면 <mark>로 감싼다 */
export interface MatchPart {
  text: string
  match: boolean
}

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const SYLLABLE_FIRST = 0xac00 // 가
const SYLLABLE_LAST = 0xd7a3 // 힣
/** 초성 하나에 붙는 음절 수(중성 21 × 종성 28) */
const SYLLABLES_PER_INITIAL = 21 * 28
const MIN_CHOSUNG_QUERY_LENGTH = 2
/** 한글 호환 자모 가운데 자음(ㄱ~ㅎ, U+3131~U+314E)만 */
const CONSONANTS_ONLY = /^[ㄱ-ㅎ]+$/
const STOCK_CODE = /^\d{6}$/
const SPACE = /\s/u

/** 공백(줄 바꿈·전각 공백·줄 바꿈 없는 공백 포함)을 모두 빼고 소문자로 바꾼다 */
export function nameKey(text: string): string {
  return Array.from(text)
    .filter((c) => !SPACE.test(c))
    .join('')
    .toLowerCase()
}

/** 공백을 뺀 검색어가 한글 자음(ㄱ~ㅎ)만으로 2자 이상이면 초성 검색어다 */
export function isChosungQuery(query: string): boolean {
  const key = nameKey(query)
  return key.length >= MIN_CHOSUNG_QUERY_LENGTH && CONSONANTS_ONLY.test(key)
}

/** 앞뒤 공백을 뺀 검색어가 숫자 6자리면 종목코드 검색어다 */
export function isStockCodeQuery(query: string): boolean {
  return STOCK_CODE.test(query.trim())
}

function initialOf(c: string): string {
  const code = c.charCodeAt(0)
  if (code < SYLLABLE_FIRST || code > SYLLABLE_LAST) return c
  return INITIALS[Math.floor((code - SYLLABLE_FIRST) / SYLLABLES_PER_INITIAL)]
}

/** 비교용 글자들과 각 글자의 원래 범위. 공백은 빠진다 */
function keyChars(name: string, chosung: boolean): { chars: string[]; from: MatchRange[] } {
  const chars: string[] = []
  const from: MatchRange[] = []
  let index = 0
  for (const c of name) {
    if (!SPACE.test(c)) {
      // 소문자로 바꾸면 길어지는 글자(İ 등)도 있어 바뀐 글자마다 원래 범위를 단다
      for (const lower of c.toLowerCase()) {
        chars.push(chosung ? initialOf(lower) : lower)
        from.push([index, index + c.length])
      }
    }
    index += c.length
  }
  return { chars, from }
}

/** 겹치거나 맞닿은 범위를 하나로 합친다(순서대로 들어온다) */
function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  const merged: MatchRange[] = []
  for (const [start, end] of ranges) {
    const last = merged.at(-1)
    if (last !== undefined && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}

/** 회사명에서 검색어와 맞는 범위들(앞에서부터 겹치지 않게). 종목코드 검색어거나 맞는 곳이 없으면 빈 배열 */
export function matchRanges(name: string, query: string): MatchRange[] {
  if (isStockCodeQuery(query)) return []
  const needle = Array.from(nameKey(query))
  if (needle.length === 0) return []
  const { chars, from } = keyChars(name, isChosungQuery(query))
  const ranges: MatchRange[] = []
  let i = 0
  while (i + needle.length <= chars.length) {
    if (needle.every((c, k) => chars[i + k] === c)) {
      ranges.push([from[i][0], from[i + needle.length - 1][1]])
      i += needle.length
    } else {
      i += 1
    }
  }
  return mergeRanges(ranges)
}

/** 종목코드 검색어가 그 종목코드와 같으면 종목코드 전체, 아니면 빈 배열 */
export function stockCodeRanges(stockCode: string, query: string): MatchRange[] {
  return isStockCodeQuery(query) && stockCode === query.trim() ? [[0, stockCode.length]] : []
}

/** 문자열을 범위대로 맞는 조각과 아닌 조각으로 나눈다. 범위는 matchRanges처럼 순서대로·겹침 없이 와야 한다 */
export function splitByRanges(text: string, ranges: MatchRange[]): MatchPart[] {
  const parts: MatchPart[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false })
    parts.push({ text: text.slice(start, end), match: true })
    cursor = end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts
}
