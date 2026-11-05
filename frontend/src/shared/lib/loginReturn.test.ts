import { describe, expect, it } from 'vitest'
import { loginPath, rememberReturn, safeReturnPath, takeReturn } from './loginReturn'

function memory(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

describe('loginReturn', () => {
  it('이 앱 안의 경로만 돌아갈 주소로 받는다', () => {
    expect(safeReturnPath('/analyses/4?tab=financial')).toBe('/analyses/4?tab=financial')
    expect(safeReturnPath('https://evil.example')).toBeNull()
    expect(safeReturnPath('//evil.example/path')).toBeNull()
    expect(safeReturnPath('/\\evil.example')).toBeNull()
    expect(safeReturnPath(null)).toBeNull()
  })

  it('로그인·가입·비밀번호 찾기 화면으로는 돌아가지 않는다', () => {
    expect(safeReturnPath('/login?next=/x')).toBeNull()
    expect(safeReturnPath('/signup')).toBeNull()
    expect(safeReturnPath('/password-reset/abc')).toBeNull()
  })

  it('로그인 주소에 지금 화면을 next로 싣고, 첫 화면이나 돌아갈 수 없는 화면이면 그냥 /login이다', () => {
    expect(loginPath('/analyses/4?tab=summary')).toBe('/login?next=%2Fanalyses%2F4%3Ftab%3Dsummary')
    expect(loginPath('/')).toBe('/login')
    expect(loginPath('/login')).toBe('/login')
  })

  it('소셜 로그인용으로 남긴 주소는 한 번만 꺼내고, 안전하지 않으면 버린다', () => {
    const storage = memory()
    rememberReturn('/notes', storage)
    expect(takeReturn(storage)).toBe('/notes')
    expect(takeReturn(storage)).toBeNull()
    rememberReturn('//evil.example', storage)
    expect(takeReturn(storage)).toBeNull()
  })
})
