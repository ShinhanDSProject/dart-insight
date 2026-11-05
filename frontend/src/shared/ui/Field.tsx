import { useState, type ComponentPropsWithRef, type ComponentPropsWithoutRef } from 'react'
import { cx } from '@/shared/lib/cx'
import { Button } from './Button'
import { Icon } from './Icon'

type FieldLabelProps = { as?: 'label' | 'span' } & ComponentPropsWithoutRef<'label'>

/** 입력·선택·세그먼트 앞의 굵은 이름. 입력이 아닌 것(세그먼트·값 표시)의 이름은 as="span"에 id를 주고 aria-labelledby로 잇는다. */
export function FieldLabel({ as: Tag = 'label', className, ...rest }: FieldLabelProps) {
  return <Tag className={cx('field-label', className)} {...rest} />
}

/** 이름 옆이나 아래의 보조 설명(작은 회색 글자) */
export function FieldHint({ className, ...rest }: ComponentPropsWithoutRef<'span'>) {
  return <span className={cx('field-hint', className)} {...rest} />
}

type InputProps = { invalid?: boolean } & Omit<ComponentPropsWithRef<'input'>, 'aria-invalid'>

/** 글자 입력창. invalid면 오류 색 테두리와 aria-invalid. ref는 input에 붙는다 */
export function Input({ invalid = false, className, ...rest }: InputProps) {
  return <input className={cx('input', invalid && 'input--error', className)} aria-invalid={invalid} {...rest} />
}

/**
 * 비밀번호 입력창(#689). 오른쪽 눈 버튼을 누르면 친 글자를 보이고(type=text) 다시 누르면 가린다.
 * 버튼 이름은 '비밀번호 보기'로 두고 보이는 상태는 aria-pressed로 알린다. 입력이 막히면 버튼도 막힌다
 */
export function PasswordInput({ className, disabled, ...rest }: Omit<InputProps, 'type'>) {
  const [shown, setShown] = useState(false)
  return (
    <span className="password-input">
      <Input {...rest} disabled={disabled} type={shown ? 'text' : 'password'} className={cx('password-input__field', className)} />
      <Button
        variant="icon"
        className="password-input__toggle"
        aria-label="비밀번호 보기"
        aria-pressed={shown}
        disabled={disabled}
        onClick={() => setShown((value) => !value)}
      >
        <Icon name={shown ? 'eye-off' : 'eye'} size={18} />
      </Button>
    </span>
  )
}

/** 선택창 */
export function Select({ className, ...rest }: ComponentPropsWithoutRef<'select'>) {
  return <select className={cx('select', className)} {...rest} />
}

type TextAreaProps = { invalid?: boolean } & Omit<ComponentPropsWithRef<'textarea'>, 'aria-invalid'>

/** 여러 줄 입력창(메모 등). Input과 같은 테두리·글꼴이고, invalid면 오류 색 테두리와 aria-invalid */
export function TextArea({ invalid = false, className, ...rest }: TextAreaProps) {
  return (
    <textarea
      className={cx('input', 'input--multiline', invalid && 'input--error', className)}
      aria-invalid={invalid}
      {...rest}
    />
  )
}
