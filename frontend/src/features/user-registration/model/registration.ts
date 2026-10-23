export interface RegistrationFields {
  email: string
  password: string
  passwordConfirm: string
}
export type RegistrationErrors = Partial<Record<keyof RegistrationFields, string>>

/** 서버와 동일하게 U+0020 앞뒤 공백만 제거한다. */
export function normalizeEmail(email: string): string {
  return email.replace(/^ +| +$/g, '').toLowerCase()
}

export function validateRegistration(fields: RegistrationFields): RegistrationErrors {
  const errors: RegistrationErrors = {}
  const email = normalizeEmail(fields.email)
  const parts = email.split('@')
  const local = parts[0]
  const labels = (parts[1] ?? '').split('.')
  const localPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/
  const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
  if (!email) {
    errors.email = '이메일을 입력해 주세요.'
  } else if (Array.from(fields.email).some((c) => c.codePointAt(0)! > 127)
    || email.length > 254 || parts.length !== 2 || local.length > 64
    || !localPattern.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || labels.length < 2 || labels.some((label) => !labelPattern.test(label))) {
    errors.email = '올바른 이메일 주소를 입력해 주세요.'
  }

  const characters = Array.from(fields.password)
  if (characters.length < 10 || characters.length > 128) {
    errors.password = '비밀번호는 10~128자로 입력해 주세요.'
  } else if (characters.every(isSpace) || characters.some((c) => {
    const cp = c.codePointAt(0)!
    return cp <= 31 || (cp >= 127 && cp <= 159) || (cp >= 0xd800 && cp <= 0xdfff)
  })) {
    errors.password = '공백만 입력하거나 제어문자를 사용할 수 없습니다.'
  } else if (!characters.some((c) => /[A-Z]/.test(c))) {
    errors.password = '영문 대문자를 1개 이상 포함해 주세요.'
  } else if (!characters.some((c) => !/[\p{L}\p{N}\s]/u.test(c))) {
    errors.password = '특수문자를 1개 이상 포함해 주세요.'
  }
  if (!fields.passwordConfirm) {
    errors.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요.'
  } else if (fields.password !== fields.passwordConfirm) {
    errors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
  }
  return errors
}

/** Java Character.isWhitespace/isSpaceChar와 동일한 공백 범위. */
function isSpace(character: string): boolean {
  const cp = character.codePointAt(0)!
  return (cp >= 9 && cp <= 13) || (cp >= 28 && cp <= 32)
    || cp === 0xa0 || cp === 0x1680 || (cp >= 0x2000 && cp <= 0x200a)
    || cp === 0x2028 || cp === 0x2029 || cp === 0x202f || cp === 0x205f || cp === 0x3000
}
