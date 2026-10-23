/** 주소 쿼리에서 바꿀 값. null이면 지운다 */
export type ParamChanges = Record<string, string | null>

/** prev를 고치지 않고 changes를 적용한 새 쿼리를 만든다 */
export function applyParamChanges(prev: URLSearchParams, changes: ParamChanges): URLSearchParams {
  const next = new URLSearchParams(prev)
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key)
    else next.set(key, value)
  }
  return next
}

/** 1 이상의 정수. 아니면 null */
export function positiveInt(value: string | null): number | null {
  const n = Number(value)
  return value !== null && Number.isInteger(n) && n > 0 ? n : null
}
