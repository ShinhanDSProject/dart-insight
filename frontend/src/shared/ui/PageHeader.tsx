import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'

type PageProps = {
  as?: 'section' | 'div' | 'article'
  /** narrow: 보통 화면(약 940px, 기본), wide: 분석 결과처럼 표·차트가 넓은 화면(약 1060px) */
  width?: 'narrow' | 'wide'
} & ComponentPropsWithoutRef<'section'>

/** 화면 하나의 본문(#548). 가운데 정렬하고 폭을 정하며, 들어올 때 옅게 떠오른다(global.css .page) */
export function Page({ as: Tag = 'section', width = 'narrow', className, ...rest }: PageProps) {
  return <Tag className={cx('page', `page--${width}`, className)} {...rest} />
}

interface PageHeaderProps {
  /** 제목 위의 작은 회색 위치 표시. 링크를 넣을 수 있다(nav aria-label="현재 위치") */
  breadcrumb?: ReactNode
  title: ReactNode
  /** h1의 id(포커스를 옮기거나 aria-labelledby로 쓸 때) */
  titleId?: string
  /** 제목 아래 회색 부제 */
  lead?: ReactNode
  /** 오른쪽 위 상태 배지나 보조 버튼 */
  aside?: ReactNode
  className?: string
}

/**
 * 화면 머리(#548): 작은 회색 브레드크럼 → 큰 굵은 제목(h1) → 회색 부제, 오른쪽 위에 상태 배지·보조 버튼.
 * 좁은 화면에서는 오른쪽 묶음이 제목 아래로 내려간다.
 */
export function PageHeader({ breadcrumb, title, titleId, lead, aside, className }: PageHeaderProps) {
  return (
    <header className={cx('page-header', className)}>
      <div className="page-header__main">
        {breadcrumb !== undefined && (
          <nav className="breadcrumb" aria-label="현재 위치">
            {breadcrumb}
          </nav>
        )}
        <h1 className="page__title" id={titleId}>
          {title}
        </h1>
        {lead !== undefined && <p className="page__lead">{lead}</p>}
      </div>
      {aside !== undefined && <div className="page-header__aside">{aside}</div>}
    </header>
  )
}
