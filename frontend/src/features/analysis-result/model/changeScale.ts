import { match } from 'ts-pattern'
import type { ChangeScale, ScaleBase, ScaleReason } from '@/shared/api/results'

/** 기준 종류 이름. 기준 계정 이름이 없을 때(찾지 못함) 쓴다 */
export function scaleBaseLabel(base: ScaleBase): string {
  return match(base)
    .with('REVENUE', () => '매출액')
    .with('TOTAL_ASSETS', () => '자산총계')
    .with('TOTAL_EQUITY', () => '자본총계')
    .exhaustive()
}

/** 기준 계정 이름. 받은 이름(원문 그대로)이 있으면 그것, 없으면 기준 종류 이름 */
export function scaleBaseName(scale: Pick<ChangeScale, 'base' | 'baseAccountName'>): string {
  return scale.baseAccountName ?? scaleBaseLabel(scale.base)
}

/**
 * 크기 비율(퍼센트, 소수 1자리): +1.2% / −0.4% / 0.0%. 0이 아닌데 0.1%에 못 미치면 '0.1% 미만'으로 부호를 붙인다.
 * 크기만 보이고 좋고 나쁨을 판단하지 않는다(색도 중립).
 */
export function formatScaleRatio(ratio: number): string {
  const percent = Math.round(Math.abs(ratio) * 1000) / 10
  if (ratio === 0) return '0.0%'
  const sign = ratio > 0 ? '+' : '−'
  if (percent === 0) return `${sign}0.1% 미만`
  return `${sign}${percent.toFixed(1)}%`
}

/** 비율이 없을 때의 짧은 사유(표 안 보조 줄) */
export function shortScaleReason(reason: ScaleReason, base: ScaleBase): string {
  return match(reason)
    .with('CHANGE_NOT_CALCULATED', () => '증감액 없음')
    .with('BASE_NOT_FOUND', () => `${scaleBaseLabel(base)} 확인 안 됨`)
    .with('BASE_MISSING', () => `${scaleBaseLabel(base)} 값 없음`)
    .with('BASE_NOT_POSITIVE', () => `${scaleBaseLabel(base)} 0 이하`)
    .exhaustive()
}

/** 비율이 없을 때의 사유 문장(근거 상세) */
export function scaleReasonMessage(reason: ScaleReason, base: ScaleBase): string {
  const label = scaleBaseLabel(base)
  return match(reason)
    .with('CHANGE_NOT_CALCULATED', () => '증감액을 계산하지 않아 비율이 없어요.')
    .with('BASE_NOT_FOUND', () => `기준 계정(${label})을 이 분석의 재무제표에서 찾지 못해 비율을 계산하지 않았어요.`)
    .with('BASE_MISSING', () => `기준 계정(${label})의 현재 값이 없어 비율을 계산하지 않았어요.`)
    .with('BASE_NOT_POSITIVE', () => `기준 계정(${label})의 현재 값이 0 이하라 비율을 계산하지 않았어요.`)
    .exhaustive()
}

/**
 * 표의 증감 옆 보조 줄: '매출액 대비 +1.2%'. 증감액이 없으면 이미 사유를 보여 주므로 null.
 * 기준 값이 없거나 0 이하면 짧은 사유.
 */
export function scaleLine(scale: ChangeScale): string | null {
  if (scale.ratio !== null) return `${scaleBaseName(scale)} 대비 ${formatScaleRatio(scale.ratio)}`
  if (scale.reason === null || scale.reason === 'CHANGE_NOT_CALCULATED') return null
  return `${scaleBaseLabel(scale.base)} 대비 · ${shortScaleReason(scale.reason, scale.base)}`
}
