import { splitByRanges, type MatchRange } from '../model/matchRanges'

/** 검색어와 맞는 부분을 <mark>로 감싸 보인다(FS-32). 범위가 없으면 글자 그대로 */
export function HighlightedText({ text, ranges }: { text: string; ranges: MatchRange[] }) {
  return splitByRanges(text, ranges).map((part, i) =>
    part.match ? (
      <mark key={i} className="search-match">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  )
}
