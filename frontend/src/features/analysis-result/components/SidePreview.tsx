interface SidePreviewProps {
  role: string
  text: string | null
  missing: string
  added?: boolean
  removed?: boolean
}

/** 변경의 이전·현재 한쪽 글. 글이 없으면 왜 없는지 적는다 */
export function SidePreview({ role, text, missing, added = false, removed = false }: SidePreviewProps) {
  return (
    <div className="change-side">
      <span className="change-side__role">{role}</span>
      {text === null ? (
        <p className="change-side__missing">{missing}</p>
      ) : (
        <p className={`change-side__text${added ? ' change-side__text--added' : ''}${removed ? ' change-side__text--removed' : ''}`}>
          <span className="change-side__body">
            {added && <span className="visually-hidden">추가된 내용: </span>}
            {removed && <span className="change-side__tag">삭제됨</span>}
            {text}
          </span>
        </p>
      )}
    </div>
  )
}
