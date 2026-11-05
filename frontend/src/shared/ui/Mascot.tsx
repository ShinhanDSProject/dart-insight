import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import { cx } from '@/shared/lib/cx'

/** search: 찾는 중, found: 큰 변화 발견, joy: 근거 찾음, none: 확인된 설명 없음 */
export type MascotMood = 'search' | 'found' | 'joy' | 'none'

interface MascotProps {
  mood: MascotMood
  /** sm 40px(카드·채팅 줄 옆), md 72px(빈 상태), lg 100px(기다리는 화면) */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * 상태 안내 캐릭터(#706). 로고 마크(몸·눈)에 팔다리를 붙인 그림이라 몸·눈 색은 로고와 같은 토큰을 쓴다.
 * 장식이라 보조기기에 숨기고 상태는 옆 글로 전한다. 숫자가 있는 곳(재무 표·증감 줄)에는 두지 않는다(가치판단처럼 읽히지 않게).
 * 움직임은 ui.css에 있고, 동작 줄이기면 global.css가 멈춘다.
 */
export function Mascot({ mood, size = 'sm', className }: MascotProps) {
  return (
    <svg
      className={cx('mascot', `mascot--${mood}`, `mascot--${size}`, className)}
      viewBox="0 0 220 230"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse className="mascot__shadow" cx="110" cy="204" rx="50" ry="6" />
      <g className="mascot__all">
        <path className="mascot__ink" d="M88 160 L88 194 M132 160 L132 194" />
        <ellipse className="mascot__foot" cx="82" cy="200" rx="15" ry="7" />
        <ellipse className="mascot__foot" cx="138" cy="200" rx="15" ry="7" />
        <g className="mascot__top">
          {arms(mood)}
          <rect className="mascot__body" x="50" y="40" width="120" height="120" rx="32" />
          {face(mood)}
        </g>
      </g>
    </svg>
  )
}

function arm(d: string, hand: [number, number], className?: string) {
  return (
    <g className={className}>
      <path className="mascot__ink" d={d} />
      <circle className="mascot__hand" cx={hand[0]} cy={hand[1]} r="9" />
    </g>
  )
}

function arms(mood: MascotMood): ReactNode {
  return match(mood)
    .with('search', () => (
      <>
        {arm('M50 108 Q32 116 30 134', [30, 138])}
        <g className="mascot__scan">
          <line className="mascot__handle" x1="192" y1="70" x2="184" y2="52" />
          <circle className="mascot__lens" cx="178" cy="34" r="20" />
          {arm('M170 104 Q192 98 192 76', [192, 74])}
        </g>
      </>
    ))
    .with('found', () => (
      <>
        {arm('M50 96 Q30 84 30 62', [30, 58])}
        {arm('M170 96 Q190 84 190 62', [190, 58])}
      </>
    ))
    .with('joy', () => (
      <>
        {arm('M50 100 Q30 96 28 72', [28, 68])}
        <g transform="rotate(8 186 60)">
          <rect className="mascot__doc" x="160" y="22" width="52" height="66" rx="6" />
          <path className="mascot__doc-line" d="M170 38 L202 38 M170 50 L196 50 M170 76 L190 76" />
          <line className="mascot__highlight" x1="170" y1="63" x2="202" y2="63" pathLength={1} />
        </g>
        {arm('M170 104 Q186 104 180 88', [180, 86])}
      </>
    ))
    .with('none', () => (
      <>
        {arm('M50 112 Q36 126 38 146', [38, 150])}
        {arm('M170 112 Q184 126 182 146', [182, 150])}
      </>
    ))
    .exhaustive()
}

function face(mood: MascotMood): ReactNode {
  const eyes = (
    <g className="mascot__eyes">
      <rect className="mascot__eye" x="78" y="70" width="20" height="58" rx="10" />
      <rect className="mascot__eye" x="122" y="70" width="20" height="58" rx="10" />
    </g>
  )
  return match(mood)
    .with('search', () => eyes)
    .with('found', () => (
      <>
        {eyes}
        <g className="mascot__burst">
          <rect className="mascot__burst-mark" x="104" y="2" width="12" height="24" rx="6" />
          <path className="mascot__burst-line" d="M76 12 L82 24 M144 12 L138 24" />
        </g>
      </>
    ))
    .with('joy', () => <path className="mascot__smile" d="M74 106 Q88 84 102 106 M118 106 Q132 84 146 106" />)
    .with('none', () => (
      <>
        <rect className="mascot__eye" x="78" y="78" width="20" height="46" rx="10" />
        <rect className="mascot__eye" x="122" y="78" width="20" height="46" rx="10" />
        <path className="mascot__brow" d="M72 74 L104 74 L104 80 L72 100 Z M116 74 L148 74 L148 100 L116 80 Z" />
        <path className="mascot__sweat" d="M84 128 Q91 140 88 145 Q84 149 80 145 Q77 140 84 128 Z" />
      </>
    ))
    .exhaustive()
}
