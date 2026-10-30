import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { Icon, type IconName } from './Icon'

/**
 * 안내 상자 세 가지(#548). info: 정보(옅은 보라), attention: 예외 상태·'검토 필요'(옅은 노랑, 갈색 글자),
 * blocked: 진행할 수 없음(비교 불가·분석 실패, 옅은 분홍, 빨간 글자). 사유와 다음 행동을 담는다.
 * 요청 실패(오류 색)는 StateView의 ErrorState·AlertState를 쓴다.
 */
export type NoticeTone = 'info' | 'attention' | 'blocked'

const ICONS: Record<NoticeTone, IconName> = { info: 'info', attention: 'triangle-alert', blocked: 'circle-alert' }

type NoticeProps = {
  tone?: NoticeTone
  /** 굵은 첫 줄. 있으면 왼쪽에 종류 아이콘이 붙는다(아이콘 + 굵은 제목 + 설명) */
  title?: ReactNode
  /** 문장 하나뿐이면 'p', 페이지 보조 영역이면 'aside' */
  as?: 'div' | 'p' | 'aside'
} & ComponentPropsWithoutRef<'div'>

/** 안내 문구. 상태가 바뀌어 나타나면 role="status"(급하면 "alert")를 넘긴다. */
export function Notice({ tone = 'info', title, as: Tag = 'div', className, children, ...rest }: NoticeProps) {
  const titled = title !== undefined
  return (
    <Tag className={cx('notice', tone !== 'info' && `notice--${tone}`, titled && 'notice--titled', className)} {...rest}>
      {titled && (
        <>
          <span className="notice__icon">
            <Icon name={ICONS[tone]} size={16} />
          </span>
          {/* as="p" 안에도 들어가도록 문단이 아닌 span으로 둔다(블록으로 보이게는 ui.css) */}
          <span className="notice__title">{title}</span>
        </>
      )}
      {children}
    </Tag>
  )
}
