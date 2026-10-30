import { cx } from '@/shared/lib/cx'

interface BrandLogoProps {
  /** md: 상단 바(32px 마크), lg: 첫 화면 가운데(48px 마크, #549) */
  size?: 'md' | 'lg'
  className?: string
}

/**
 * 로고(남색 사각 마크 + 'DART Insight'). 마크는 장식이라 보조기기에 숨기고, 글자가 이름이 된다.
 * 링크·제목으로 감싸는 것은 쓰는 쪽이 정한다(상단 바는 첫 화면 링크, 첫 화면은 h1).
 */
export function BrandLogo({ size = 'md', className }: BrandLogoProps) {
  return (
    <span className={cx('brand-logo', size === 'lg' && 'brand-logo--lg', className)}>
      <span className="brand-logo__mark" aria-hidden="true">
        <span className="brand-logo__sheet" />
        <span className="brand-logo__sheet brand-logo__sheet--tall" />
      </span>
      <span className="brand-logo__name">DART Insight</span>
    </span>
  )
}
