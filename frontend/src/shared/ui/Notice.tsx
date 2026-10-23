import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'

/**
 * info: 안내(회색 띠), attention: 예외 상태·'검토 필요'(주의 색 띠),
 * blocked: 진행할 수 없음(비교 불가·분석 실패). 주의 색 점선 상자로 사유와 다음 행동을 담는다.
 * 요청 실패(오류 색)는 StateView의 ErrorState·AlertState를 쓴다.
 */
export type NoticeTone = 'info' | 'attention' | 'blocked'

type NoticeProps = {
  tone?: NoticeTone
  /** 굵은 첫 줄 */
  title?: ReactNode
  /** 문장 하나뿐이면 'p', 페이지 보조 영역이면 'aside' */
  as?: 'div' | 'p' | 'aside'
} & ComponentPropsWithoutRef<'div'>

/** 안내 문구. 상태가 바뀌어 나타나면 role="status"(급하면 "alert")를 넘긴다. */
export function Notice({ tone = 'info', title, as: Tag = 'div', className, children, ...rest }: NoticeProps) {
  return (
    <Tag className={cx('notice', tone !== 'info' && `notice--${tone}`, className)} {...rest}>
      {title !== undefined && <p className="notice__title">{title}</p>}
      {children}
    </Tag>
  )
}
