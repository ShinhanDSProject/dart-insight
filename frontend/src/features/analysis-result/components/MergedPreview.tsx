import { match } from 'ts-pattern'
import type { MergedPart } from '../model/wordDiff'

/**
 * 수정 카드의 합쳐 보기(3.53): 이전 글과 현재 글을 한 글로 보인다.
 * 이전에만 있는 글은 줄을 긋고, 현재에 새로 들어간 글은 추가 색 바탕으로 칠한다(design-system 5-7).
 * 색만으로 알리지 않도록 화면 낭독기에는 '빠진 글', '새 글'을 읽어 준다.
 */
export function MergedPreview({ parts }: { parts: MergedPart[] }) {
  return (
    <div className="change-side change-merged">
      <span className="change-side__role">
        바뀐 곳 표시 · <del className="change-merged__removed">빠진 글</del> · <ins className="change-merged__added">새 글</ins>
      </span>
      <p className="change-side__text">
        <span className="change-side__body change-merged__body">
          {parts.map((part, index) =>
            match(part.kind)
              .with('removed', () => (
                <del key={index} className="change-merged__removed">
                  <span className="visually-hidden">빠진 글: </span>
                  {part.text}
                </del>
              ))
              .with('added', () => (
                <ins key={index} className="change-merged__added">
                  <span className="visually-hidden">새 글: </span>
                  {part.text}
                </ins>
              ))
              .with('same', () => <span key={index}>{part.text}</span>)
              .exhaustive(),
          )}
        </span>
      </p>
    </div>
  )
}
