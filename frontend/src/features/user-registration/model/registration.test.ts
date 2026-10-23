import { describe, expect, it } from 'vitest'
import { normalizeEmail, validateRegistration } from './registration'

const password = 'Sample!password'
const valid = { email: 'member@example.com', password, passwordConfirm: password }

describe('일반 회원가입 입력', () => {
  it('앞뒤 공백과 대소문자만 정규화하고 점/태그를 보존한다', () => {
    expect(normalizeEmail('  Member.Name+Tag@Example.COM  ')).toBe('member.name+tag@example.com')
    expect(validateRegistration(valid)).toEqual({})
  })

  it.each(['', 'no-at', 'a@@example.com', '.a@example.com', 'a..b@example.com',
    'a.@example.com', 'a@localhost', 'a@-example.com', 'a@example-.com',
    'a b@example.com', '회원@example.com', 'a@예시.com', 'K@example.com', '\tuser@example.com'
  ])('잘못된 이메일을 거부한다: %s', (email) => {
    expect(validateRegistration({ ...valid, email }).email).toBeTruthy()
  })

  it('이메일 전체/로컬/도메인 레이블의 길이 경계를 검사한다', () => {
    const domain = 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(61)
    const email = 'a'.repeat(64) + '@' + domain
    expect(email).toHaveLength(254)
    expect(validateRegistration({ ...valid, email })).toEqual({})
    for (const invalid of [email + 'd', 'a'.repeat(65) + '@example.com', 'a@' + 'b'.repeat(64) + '.com']) {
      expect(validateRegistration({ ...valid, email: invalid }).email).toBeTruthy()
    }
  })

  it('비밀번호는 코드 포인트 10~128자이고 대문자와 특수문자를 포함한다', () => {
    for (const value of ['A!' + 'a'.repeat(8), 'A!' + 'a'.repeat(126), 'A!' + '😀'.repeat(8), 'A!' + '😀'.repeat(126), ' A!' + '가'.repeat(7) + ' ']) {
      expect(validateRegistration({ ...valid, password: value, passwordConfirm: value })).toEqual({})
    }
    for (const value of ['A!' + '😀'.repeat(7), 'A!' + '😀'.repeat(127), ' '.repeat(10), '\u00a0'.repeat(10),
      'A!' + 'a'.repeat(8) + String.fromCharCode(0), 'A!' + 'a'.repeat(8) + String.fromCharCode(0xd800),
      'lowercase!1', 'Uppercase12', 'Αlpha!1234']) {
      expect(validateRegistration({ ...valid, password: value, passwordConfirm: value }).password).toBeTruthy()
    }
  })

  it('비밀번호 확인은 원문과 일치해야 한다', () => {
    expect(validateRegistration({ ...valid, passwordConfirm: '' }).passwordConfirm).toBeTruthy()
    expect(validateRegistration({ ...valid, passwordConfirm: password + ' ' }).passwordConfirm).toBe('비밀번호가 일치하지 않습니다.')
  })
})
